-- Framefolio 0003: album lifecycle (archive, expiry) and photo ordering.
-- Safe to run more than once.

-- Archived albums disappear from the dashboard list, the portfolio and the
-- client link, without deleting anything. Restoring brings them back.
alter table public.albums add column if not exists archived_at timestamptz;

-- After this moment the client link shows "this album has expired".
alter table public.albums add column if not exists expires_at timestamptz;

create index if not exists idx_albums_owner_archived on public.albums(owner_id, archived_at);

-- Saves a new photo order in one round trip: the photo at position N of
-- `photo_ids` gets sort_order N. Runs with the caller's rights, so row level
-- security still limits it to the photographer's own albums.
create or replace function public.reorder_album_photos(target_album uuid, photo_ids uuid[])
returns integer
language sql
security invoker
set search_path = public
as $$
  with ordered as (
    select id, ordinality::integer as position
    from unnest(photo_ids) with ordinality as t(id, ordinality)
  ),
  updated as (
    update public.photos p
    set sort_order = ordered.position
    from ordered
    where p.id = ordered.id
      and p.album_id = target_album
    returning p.id
  )
  select count(*)::integer from updated;
$$;

grant execute on function public.reorder_album_photos(uuid, uuid[]) to authenticated;

-- Visitor IP addresses are no longer recorded; clear the ones collected so far.
update public.album_views set viewer_ip = null where viewer_ip is not null;
