-- Personal IOUs: money or items you owe / are owed, tracked to settlement.
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('i_owe', 'owed_to_me')),
  kind text not null default 'money' check (kind in ('money', 'item')),
  counterparty text not null,
  title text not null default '',
  total_amount numeric not null check (total_amount > 0),
  settled_amount numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'settled')),
  due_date date,
  created_at timestamptz not null default now()
);

-- Savings goals: wants & needs funded from the weekly set-aside.
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('need', 'want')),
  title text not null,
  target_amount numeric not null check (target_amount > 0),
  saved_amount numeric not null default 0 check (saved_amount >= 0),
  allocation_percent numeric(5,2) not null default 0, -- % of weekly set-aside
  status text not null default 'active' check (status in ('active', 'done')),
  created_at timestamptz not null default now()
);

create index idx_obligations_user on public.obligations (user_id, status);
create index idx_goals_user on public.savings_goals (user_id, status);

alter table public.obligations enable row level security;
alter table public.savings_goals enable row level security;

create policy obligations_all on public.obligations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goals_all on public.savings_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
