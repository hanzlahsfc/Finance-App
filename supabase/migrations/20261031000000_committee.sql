-- Committee (rotating monthly pot): fixed payout order agreed upfront.
-- Each member pays the same amount every month; the member whose position
-- matches the month takes the whole pot.

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null check (amount > 0),
  created_by uuid not null references public.profiles(id),
  collector_id uuid not null references public.profiles(id),
  start_month date not null,
  created_at timestamptz not null default now()
);

create table public.committee_members (
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position int not null check (position > 0),
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (committee_id, user_id),
  unique (committee_id, position)
);

create table public.committee_payments (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  month int not null check (month > 0),
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'received')),
  paid_at timestamptz not null default now(),
  received_at timestamptz,
  unique (committee_id, user_id, month)
);

create table public.committee_payouts (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  month int not null check (month > 0),
  paid_at timestamptz not null default now(),
  unique (committee_id, month)
);

create index idx_committee_pay on public.committee_payments (committee_id, month);

create or replace function public.is_committee_member(p_committee_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from committee_members where committee_id = p_committee_id and user_id = auth.uid()) $$;

create or replace function public.is_committee_collector(p_committee_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from committees where id = p_committee_id and collector_id = auth.uid()) $$;

alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.committee_payments enable row level security;
alter table public.committee_payouts enable row level security;

-- committees: members read; creator manages; collector can update
create policy committees_read on public.committees for select to authenticated
  using (public.is_committee_member(id) or created_by = auth.uid());
create policy committees_insert on public.committees for insert to authenticated
  with check (created_by = auth.uid());
create policy committees_update on public.committees for update to authenticated
  using (created_by = auth.uid() or collector_id = auth.uid());
create policy committees_delete on public.committees for delete to authenticated
  using (created_by = auth.uid());

-- committee_members: members read; creator or collector adds; self/creator removes
create policy committee_members_read on public.committee_members for select to authenticated
  using (public.is_committee_member(committee_id));
create policy committee_members_insert on public.committee_members for insert to authenticated
  with check (exists (select 1 from public.committees c
    where c.id = committee_id
      and (c.created_by = auth.uid() or c.collector_id = auth.uid())));
create policy committee_members_delete on public.committee_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.committees c where c.id = committee_id and c.created_by = auth.uid()));

-- payments: all members see all payments (it's a trust pool — transparency
-- is the point); members log their own, collector approves
create policy committee_payments_read on public.committee_payments for select to authenticated
  using (public.is_committee_member(committee_id));
create policy committee_payments_insert on public.committee_payments for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and public.is_committee_member(committee_id));
create policy committee_payments_update on public.committee_payments for update to authenticated
  using (public.is_committee_collector(committee_id));
create policy committee_payments_delete on public.committee_payments for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- payouts: members read; collector marks/unmarks
create policy committee_payouts_read on public.committee_payouts for select to authenticated
  using (public.is_committee_member(committee_id));
create policy committee_payouts_insert on public.committee_payouts for insert to authenticated
  with check (public.is_committee_collector(committee_id));
create policy committee_payouts_delete on public.committee_payouts for delete to authenticated
  using (public.is_committee_collector(committee_id));

alter publication supabase_realtime add table public.committees;
alter publication supabase_realtime add table public.committee_members;
alter publication supabase_realtime add table public.committee_payments;
alter publication supabase_realtime add table public.committee_payouts;
