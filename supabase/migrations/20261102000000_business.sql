-- Samzlah: business income & expenses, zakat is computed client-side
-- (percent of profit) against recorded zakat payments.
create table public.business_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'zakat')),
  amount numeric not null check (amount > 0),
  note text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_business_entries_user on public.business_entries (user_id, occurred_at desc);

alter table public.business_entries enable row level security;

create policy business_entries_all on public.business_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
