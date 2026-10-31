-- Split edits were silently dropped: activity_splits had no UPDATE
-- policy, so updateSplit ops were RLS-rejected and retried out of the
-- outbox. Allow the activity creator to update splits on their events.
create policy splits_update on public.activity_splits for update to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id and a.created_by = auth.uid()))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.created_by = auth.uid()));
