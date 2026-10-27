-- Trip pool: members each pay toward a shared target; a named collector
-- confirms receipt. Individual payment rows are visible only to the payer
-- and the collector — everyone else just sees each member's progress total.

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

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid()) $$;

create or replace function public.is_trip_collector(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from trips where id = p_trip_id and collector_id = auth.uid()) $$;

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

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_contributions enable row level security;

-- trips: members read; creator manages
create policy trips_read on public.trips for select to authenticated
  using (public.is_trip_member(id) or created_by = auth.uid());
create policy trips_insert on public.trips for insert to authenticated
  with check (created_by = auth.uid());
create policy trips_update on public.trips for update to authenticated
  using (created_by = auth.uid() or collector_id = auth.uid());
create policy trips_delete on public.trips for delete to authenticated
  using (created_by = auth.uid());

-- trip_members: members read; creator adds; remove self or creator removes
create policy trip_members_read on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy trip_members_insert on public.trip_members for insert to authenticated
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));
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

alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.trip_members;
alter publication supabase_realtime add table public.trip_contributions;
