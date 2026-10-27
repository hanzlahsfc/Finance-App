-- Let the collector add people too, not just the trip creator.
drop policy if exists trip_members_insert on public.trip_members;
create policy trip_members_insert on public.trip_members for insert to authenticated
  with check (exists (select 1 from public.trips t
    where t.id = trip_id
      and (t.created_by = auth.uid() or t.collector_id = auth.uid())));
