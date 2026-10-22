-- Let the activity creator edit split amounts (settled amounts stay
-- protected client-side; record_payment remains the settlement path).
create policy splits_update on public.activity_splits for update to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id and a.created_by = auth.uid()))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.created_by = auth.uid()));
