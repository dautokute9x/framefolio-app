-- 0002: hardening + client selection workflow
-- Safe to run more than once. Run after 0001_initial.sql.

-- 1) Only one photographer: stop random sign-ups from becoming admins.
--    A new auth user gets a profile only if
--      a) a profile with the same email was pre-created (supabase/seed.sql), or
--      b) no photographer profile exists yet (very first account).
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile_id uuid;
begin
  select id into existing_profile_id
  from public.users
  where lower(email) = lower(new.email)
  limit 1;

  if existing_profile_id is not null then
    update public.users
    set auth_user_id = new.id,
        full_name = coalesce(new.raw_user_meta_data->>'full_name', full_name),
        updated_at = timezone('utc', now())
    where id = existing_profile_id;
    return new;
  end if;

  if exists (select 1 from public.users) then
    -- Someone else signed up: keep the auth user but grant no admin profile.
    return new;
  end if;

  insert into public.users (auth_user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'admin'
  );

  return new;
end;
$$;

-- 2) Preview (web-size) copy of each photo. Clients see the preview, never the original.
alter table public.photos add column if not exists preview_path text;

-- 3) Optional limit on how many photos a client may pick (e.g. package = 30 edited photos).
alter table public.albums add column if not exists selection_limit integer
  check (selection_limit is null or selection_limit > 0);

-- 4) One row per client device/session: who they are, a note, and when they submitted.
create table if not exists public.selection_sessions (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  selection_key text not null,
  selector_name text,
  selector_email text,
  note text,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (album_id, selection_key)
);

create index if not exists idx_selection_sessions_album_id on public.selection_sessions(album_id);

drop trigger if exists set_selection_sessions_updated_at on public.selection_sessions;
create trigger set_selection_sessions_updated_at
before update on public.selection_sessions
for each row
execute function public.set_updated_at();

alter table public.selection_sessions enable row level security;

drop policy if exists "selection_sessions_owner_read" on public.selection_sessions;
create policy "selection_sessions_owner_read"
on public.selection_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.albums
    where public.albums.id = selection_sessions.album_id
      and public.albums.owner_id = public.current_user_profile_id()
  )
);

-- 5) Helpful indexes for the gallery
create index if not exists idx_photos_album_sort on public.photos(album_id, sort_order);
create index if not exists idx_selections_album_key on public.selections(album_id, selection_key);

-- 6) Assign photo order at insert time. Parallel uploads used to compute
--    "max + 1" concurrently and produced duplicate sort_order values.
create or replace function public.assign_photo_sort_order()
returns trigger
language plpgsql
as $$
begin
  if new.sort_order is null or new.sort_order <= 0 then
    perform pg_advisory_xact_lock(hashtext(new.album_id::text));
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
    from public.photos
    where album_id = new.album_id;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_photo_sort_order on public.photos;
create trigger assign_photo_sort_order
before insert on public.photos
for each row
execute function public.assign_photo_sort_order();
