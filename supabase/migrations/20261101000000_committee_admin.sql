-- One committee only, and the creator (admin) can reorder members.
drop policy if exists committees_insert on public.committees;
create policy committees_insert on public.committees for insert to authenticated
  with check (created_by = auth.uid() and not exists (select 1 from public.committees));

create policy committee_members_update on public.committee_members for update to authenticated
  using (exists (select 1 from public.committees c where c.id = committee_id and c.created_by = auth.uid()))
  with check (exists (select 1 from public.committees c where c.id = committee_id and c.created_by = auth.uid()));
