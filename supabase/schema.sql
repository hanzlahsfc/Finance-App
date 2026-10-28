-- ============================================================
-- Hisab — Supabase schema
-- Run this in the Supabase SQL editor (or via supabase db push).
-- ============================================================

create extension if not exists pgcrypto;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  currency text not null default 'PKR',
  savings_percent numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

-- ============ FRIENDSHIPS ============
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ============ INCOME (weekly pay / bonuses) ============
create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'pay' check (kind in ('pay', 'bonus', 'other')),
  label text not null default '',
  amount numeric not null check (amount >= 0),
  week_start date not null,
  received_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============ BILLS ============
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly', 'once')),
  category text not null default 'other',
  due_day int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  period_start date not null,
  paid_at timestamptz not null default now()
);

-- ============ TRANSACTIONS ============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'income', 'loan_given', 'loan_taken')),
  amount numeric not null check (amount > 0),
  category text not null default 'other',
  note text not null default '',
  place text not null default '',        -- where it was made (shop, station, app…)
  counterparty text not null default '', -- paid to / received from whom
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_transactions_user_time on public.transactions (user_id, occurred_at desc);
create index idx_income_user_week on public.income_entries (user_id, week_start desc);

-- ============ GROUPS ============
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ============ ACTIVITIES (shared expenses) ============
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  paid_by uuid not null references public.profiles(id),
  title text not null,
  total_amount numeric not null check (total_amount > 0),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.activity_splits (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  owed_amount numeric not null check (owed_amount >= 0),
  settled_amount numeric not null default 0 check (settled_amount >= 0),
  unique (activity_id, user_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  note text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_activities_group on public.activities (group_id, occurred_at desc);
create index idx_splits_activity on public.activity_splits (activity_id);
create index idx_settlements_group on public.settlements (group_id, created_at desc);

-- ============ TRIP POOL ============
-- Members each pay toward a shared target; a named collector confirms
-- receipt. Individual payment rows are visible only to payer + collector.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  collector_id uuid not null references public.profiles(id),
  target_amount numeric not null default 0 check (target_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.trip_contributions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'received')),
  paid_at timestamptz not null default now(),
  received_at timestamptz
);

create index idx_trip_contrib_trip on public.trip_contributions (trip_id, paid_at desc);

-- ============ COMMITTEE (rotating monthly pot) ============
-- Members each pay the same amount every month; the member whose position
-- matches the month takes the whole pot. Order fixed upfront.
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

-- ============ HELPER FUNCTIONS (security definer to avoid RLS recursion) ============
create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from group_members where group_id = p_group_id and user_id = auth.uid()) $$;

create or replace function public.is_member_of(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from group_members where group_id = p_group_id and user_id = p_user_id) $$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from friendships
     where status = 'accepted'
       and ((user_id = a and friend_id = b) or (user_id = b and friend_id = a))
   ) $$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid()) $$;

create or replace function public.is_trip_collector(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from trips where id = p_trip_id and collector_id = auth.uid()) $$;

create or replace function public.is_committee_member(p_committee_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from committee_members where committee_id = p_committee_id and user_id = auth.uid()) $$;

create or replace function public.is_committee_collector(p_committee_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from committees where id = p_committee_id and collector_id = auth.uid()) $$;

-- Keep each member's running total in sync with received payments.
create or replace function public.refresh_trip_paid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.trip_members tm set paid_amount = (
    select coalesce(sum(amount), 0) from public.trip_contributions
    where trip_id = tm.trip_id and user_id = tm.user_id and status = 'received'
  ) where tm.trip_id = coalesce(new.trip_id, old.trip_id)
    and tm.user_id = coalesce(new.user_id, old.user_id);
  return coalesce(new, old);
end $$;

create trigger trg_trip_paid after insert or update or delete on public.trip_contributions
  for each row execute function public.refresh_trip_paid();

-- Record a payment toward an activity split.
-- Allowed when caller is the debtor (p_from_user = self), the person who paid
-- the activity (confirming cash received), or the activity admin.
create or replace function public.record_payment(
  p_activity_id uuid,
  p_from_user uuid,
  p_amount numeric,
  p_note text default ''
) returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_activity public.activities%rowtype;
  v_split public.activity_splits%rowtype;
  v_id uuid := gen_random_uuid();
begin
  select * into v_activity from public.activities where id = p_activity_id;
  if not found then raise exception 'activity not found'; end if;
  if not public.is_group_member(v_activity.group_id) then raise exception 'not a group member'; end if;
  if auth.uid() <> p_from_user
     and auth.uid() <> v_activity.paid_by
     and auth.uid() <> v_activity.created_by then
    raise exception 'not allowed';
  end if;
  select * into v_split from public.activity_splits
    where activity_id = p_activity_id and user_id = p_from_user;
  if not found then raise exception 'no split for user'; end if;
  if p_amount <= 0 or v_split.settled_amount + p_amount > v_split.owed_amount then
    raise exception 'invalid amount';
  end if;
  update public.activity_splits set settled_amount = settled_amount + p_amount where id = v_split.id;
  insert into public.settlements (id, activity_id, group_id, from_user, to_user, amount, note, created_by)
    values (v_id, p_activity_id, v_activity.group_id, p_from_user, v_activity.paid_by, p_amount, p_note, auth.uid());
  return v_id;
end;
$$;

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.income_entries enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;
alter table public.transactions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.activities enable row level security;
alter table public.activity_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_contributions enable row level security;
alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.committee_payments enable row level security;
alter table public.committee_payouts enable row level security;

-- profiles: anyone signed in can look up users (needed for friend search);
-- only you can create/edit your own row.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friendships
create policy friendships_read on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy friendships_insert on public.friendships for insert to authenticated
  with check (user_id = auth.uid());
create policy friendships_update on public.friendships for update to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy friendships_delete on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

-- personal finance tables: owner only
create policy income_all on public.income_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bills_all on public.bills for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bill_payments_all on public.bill_payments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy transactions_all on public.transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- groups: visible to members; creator manages
create policy groups_read on public.groups for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy groups_update on public.groups for update to authenticated
  using (created_by = auth.uid());
create policy groups_delete on public.groups for delete to authenticated
  using (created_by = auth.uid());

-- group_members: any member can view; any member can add; remove self or creator removes
create policy group_members_read on public.group_members for select to authenticated
  using (public.is_group_member(group_id) or user_id = auth.uid());
create policy group_members_insert on public.group_members for insert to authenticated
  with check (public.is_group_member(group_id)
              or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));
create policy group_members_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));

-- activities: members read; members create; only creator edits/deletes.
-- created_by can be reassigned to another member (admin transfer).
create policy activities_read on public.activities for select to authenticated
  using (public.is_group_member(group_id));
create policy activities_insert on public.activities for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy activities_update on public.activities for update to authenticated
  using (created_by = auth.uid())
  with check (public.is_member_of(group_id, created_by));
create policy activities_delete on public.activities for delete to authenticated
  using (created_by = auth.uid());

-- activity_splits: members read; activity creator inserts; amounts settle via record_payment()
create policy splits_read on public.activity_splits for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id and public.is_group_member(a.group_id)));
create policy splits_insert on public.activity_splits for insert to authenticated
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.created_by = auth.uid()));
create policy splits_delete on public.activity_splits for delete to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id and a.created_by = auth.uid()));

-- settlements: members read; inserts go through record_payment()
create policy settlements_read on public.settlements for select to authenticated
  using (public.is_group_member(group_id));

-- trips: members read; creator manages
create policy trips_read on public.trips for select to authenticated
  using (public.is_trip_member(id) or created_by = auth.uid());
create policy trips_insert on public.trips for insert to authenticated
  with check (created_by = auth.uid() and not exists (select 1 from public.trips));
create policy trips_update on public.trips for update to authenticated
  using (created_by = auth.uid() or collector_id = auth.uid());
create policy trips_delete on public.trips for delete to authenticated
  using (created_by = auth.uid());

-- trip_members: members read; creator or collector adds; remove self or creator removes
create policy trip_members_read on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy trip_members_insert on public.trip_members for insert to authenticated
  with check (exists (select 1 from public.trips t
    where t.id = trip_id
      and (t.created_by = auth.uid() or t.collector_id = auth.uid())));
create policy trip_members_delete on public.trip_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));

-- trip_contributions: payer sees own rows; collector sees every row in their trip
create policy trip_contrib_read on public.trip_contributions for select to authenticated
  using (user_id = auth.uid() or public.is_trip_collector(trip_id));
create policy trip_contrib_insert on public.trip_contributions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and public.is_trip_member(trip_id));
create policy trip_contrib_update on public.trip_contributions for update to authenticated
  using (public.is_trip_collector(trip_id));
create policy trip_contrib_delete on public.trip_contributions for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- committees: members read; creator manages; collector can update
create policy committees_read on public.committees for select to authenticated
  using (public.is_committee_member(id) or created_by = auth.uid());
create policy committees_insert on public.committees for insert to authenticated
  with check (created_by = auth.uid() and not exists (select 1 from public.committees));
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
create policy committee_members_update on public.committee_members for update to authenticated
  using (exists (select 1 from public.committees c where c.id = committee_id and c.created_by = auth.uid()))
  with check (exists (select 1 from public.committees c where c.id = committee_id and c.created_by = auth.uid()));
create policy committee_members_delete on public.committee_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.committees c where c.id = committee_id and c.created_by = auth.uid()));

-- payments: all members see all payments (transparency is the point);
-- members log their own, collector approves
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

-- ============ REALTIME ============
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.activity_splits;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.trip_members;
alter publication supabase_realtime add table public.trip_contributions;
alter publication supabase_realtime add table public.committees;
alter publication supabase_realtime add table public.committee_members;
alter publication supabase_realtime add table public.committee_payments;
alter publication supabase_realtime add table public.committee_payouts;
