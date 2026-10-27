-- Only one trip exists — the group shares it.
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (created_by = auth.uid() and not exists (select 1 from public.trips));
