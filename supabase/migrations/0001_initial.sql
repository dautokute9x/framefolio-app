create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'album_visibility') then
    create type public.album_visibility as enum ('public', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('Draft', 'Sent', 'Client Selecting', 'Editing', 'Delivered');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'admin',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  status public.job_status not null default 'Draft',
  visibility public.album_visibility not null default 'private',
  password_hash text,
  share_token uuid not null default gen_random_uuid(),
  event_date date,
  delivered_at timestamptz,
  cover_photo_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  storage_bucket text not null default 'albums',
  width integer,
  height integer,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.albums
  drop constraint if exists albums_cover_photo_id_fkey;

alter table public.albums
  add constraint albums_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.photos (id) on delete set null;

create table if not exists public.selections (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  photo_id uuid not null references public.photos (id) on delete cascade,
  selection_key text not null,
  selector_name text,
  selector_email text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (album_id, photo_id, selection_key)
);

create table if not exists public.album_views (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  viewer_ip text,
  viewer_agent text,
  share_token text,
  viewed_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_clients_owner_id on public.clients(owner_id);
create index if not exists idx_albums_owner_id on public.albums(owner_id);
create index if not exists idx_albums_slug on public.albums(slug);
create index if not exists idx_photos_album_id on public.photos(album_id);
create index if not exists idx_photos_owner_id on public.photos(owner_id);
create index if not exists idx_selections_album_id on public.selections(album_id);
create index if not exists idx_selections_selection_key on public.selections(selection_key);
create index if not exists idx_album_views_album_id on public.album_views(album_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_albums_updated_at on public.albums;
create trigger set_albums_updated_at
before update on public.albums
for each row
execute function public.set_updated_at();

create or replace function public.current_user_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

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
  where email = new.email
  limit 1;

  if existing_profile_id is not null then
    update public.users
    set auth_user_id = new.id,
        full_name = coalesce(new.raw_user_meta_data->>'full_name', full_name),
        updated_at = timezone('utc', now())
    where id = existing_profile_id;
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.selections enable row level security;
alter table public.album_views enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "clients_owner_all" on public.clients;
create policy "clients_owner_all"
on public.clients
for all
to authenticated
using (owner_id = public.current_user_profile_id())
with check (owner_id = public.current_user_profile_id());

drop policy if exists "albums_owner_all" on public.albums;
create policy "albums_owner_all"
on public.albums
for all
to authenticated
using (owner_id = public.current_user_profile_id())
with check (owner_id = public.current_user_profile_id());

drop policy if exists "photos_owner_all" on public.photos;
create policy "photos_owner_all"
on public.photos
for all
to authenticated
using (owner_id = public.current_user_profile_id())
with check (owner_id = public.current_user_profile_id());

drop policy if exists "selections_owner_read" on public.selections;
create policy "selections_owner_read"
on public.selections
for select
to authenticated
using (
  exists (
    select 1
    from public.albums
    where public.albums.id = selections.album_id
      and public.albums.owner_id = public.current_user_profile_id()
  )
);

drop policy if exists "album_views_owner_read" on public.album_views;
create policy "album_views_owner_read"
on public.album_views
for select
to authenticated
using (
  exists (
    select 1
    from public.albums
    where public.albums.id = album_views.album_id
      and public.albums.owner_id = public.current_user_profile_id()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'albums',
  'albums',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

drop policy if exists "albums_bucket_owner_insert" on storage.objects;
create policy "albums_bucket_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'albums'
  and (storage.foldername(name))[1] = public.current_user_profile_id()::text
);

drop policy if exists "albums_bucket_owner_select" on storage.objects;
create policy "albums_bucket_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'albums'
  and (storage.foldername(name))[1] = public.current_user_profile_id()::text
);

drop policy if exists "albums_bucket_owner_update" on storage.objects;
create policy "albums_bucket_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'albums'
  and (storage.foldername(name))[1] = public.current_user_profile_id()::text
)
with check (
  bucket_id = 'albums'
  and (storage.foldername(name))[1] = public.current_user_profile_id()::text
);

drop policy if exists "albums_bucket_owner_delete" on storage.objects;
create policy "albums_bucket_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'albums'
  and (storage.foldername(name))[1] = public.current_user_profile_id()::text
);
