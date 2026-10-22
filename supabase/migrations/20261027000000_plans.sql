-- Per-profile plans: links to hosted HTML pages (workout plan, diet plan…)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

-- all authenticated users can read plans (shown on friend profiles);
-- only the owner manages their own.
create policy plans_read on public.plans for select to authenticated using (true);
create policy plans_write on public.plans for insert to authenticated with check (user_id = auth.uid());
create policy plans_update on public.plans for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plans_delete on public.plans for delete to authenticated
  using (user_id = auth.uid());
