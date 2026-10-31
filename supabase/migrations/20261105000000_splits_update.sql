-- Split admin: widen who can edit/delete from just the activity creator
-- to also include the payer and the group owner. A member who paid for
-- or organized a shared expense should be able to fix or remove it.
-- splits_update already exists remotely (20261026) — recreate all
-- policies idempotently with the widened checks.
drop policy if exists splits_update on public.activity_splits;
drop policy if exists splits_insert on public.activity_splits;
drop policy if exists splits_delete on public.activity_splits;
drop policy if exists activities_update on public.activities;
drop policy if exists activities_delete on public.activities;

create policy activities_update on public.activities for update to authenticated
  using (
    created_by = auth.uid() or paid_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  )
  with check (public.is_member_of(group_id, created_by));

create policy activities_delete on public.activities for delete to authenticated
  using (
    created_by = auth.uid() or paid_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

create policy splits_insert on public.activity_splits for insert to authenticated
  with check (exists (select 1 from public.activities a join public.groups g on g.id = a.group_id
    where a.id = activity_id and (a.created_by = auth.uid() or a.paid_by = auth.uid() or g.created_by = auth.uid())));

create policy splits_update on public.activity_splits for update to authenticated
  using (exists (select 1 from public.activities a join public.groups g on g.id = a.group_id
    where a.id = activity_id and (a.created_by = auth.uid() or a.paid_by = auth.uid() or g.created_by = auth.uid())))
  with check (exists (select 1 from public.activities a join public.groups g on g.id = a.group_id
    where a.id = activity_id and (a.created_by = auth.uid() or a.paid_by = auth.uid() or g.created_by = auth.uid())));

create policy splits_delete on public.activity_splits for delete to authenticated
  using (exists (select 1 from public.activities a join public.groups g on g.id = a.group_id
    where a.id = activity_id and (a.created_by = auth.uid() or a.paid_by = auth.uid() or g.created_by = auth.uid())));
