-- Framefolio 0004: per-photo client notes, original downloads, rate limiting.
-- Safe to run more than once.

-- A short note from the client on one selected photo ("remove the person behind").
alter table public.selections add column if not exists comment text
  check (comment is null or char_length(comment) <= 500);

-- When true, clients can download the full-resolution original of each photo.
alter table public.albums add column if not exists allow_download boolean not null default false;

-- Fixed-window rate limiting shared by every server instance.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

alter table public.rate_limits enable row level security;
-- No policies: only the service role (server) touches this table.

-- Counts one hit for `p_key` and returns true while the caller is within
-- `p_limit` hits per `p_window_seconds`.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into current_hits;

  -- Opportunistic cleanup of long-expired rows.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return current_hits <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
