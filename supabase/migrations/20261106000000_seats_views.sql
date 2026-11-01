-- Committee seats: one person can hold multiple shares. Each share is
-- a payout slot in the rotation and adds the monthly due, so the
-- composite (committee_id, user_id) pk becomes a surrogate id.
alter table public.committee_members add column id uuid not null default gen_random_uuid();
alter table public.committee_members drop constraint committee_members_pkey;
alter table public.committee_members add primary key (id);
-- unique (committee_id, position) stays — every seat keeps its own slot

-- Dashboard access control: profiles.admin marks app admins, and
-- user_views holds which dashboards each member may open.
alter table public.profiles add column admin boolean not null default false;
update public.profiles set admin = true where username = 'hanzlah';

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and admin) $$;

create table public.user_views (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  views text[] not null default '{trip}',
  updated_at timestamptz not null default now()
);

alter table public.user_views enable row level security;

create policy user_views_read on public.user_views for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy user_views_write on public.user_views for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
