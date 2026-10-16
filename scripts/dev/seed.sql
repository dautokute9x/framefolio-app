insert into public.users (email, full_name, role)
values ('demo@framefolio.local', 'Demo Photographer', 'admin')
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role;
