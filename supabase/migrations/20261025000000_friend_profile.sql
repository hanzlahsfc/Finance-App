-- Friend profiles: email (privacy-controlled) for the friend detail view.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists show_email boolean not null default true;
