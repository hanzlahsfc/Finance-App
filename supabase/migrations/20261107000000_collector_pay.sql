-- Collector can record a payment on behalf of any member (they handed
-- cash over directly), and remove a misentered one.
drop policy if exists committee_payments_insert on public.committee_payments;
create policy committee_payments_insert on public.committee_payments for insert to authenticated
  with check (
    public.is_committee_member(committee_id)
    and ((user_id = auth.uid() and status = 'pending') or public.is_committee_collector(committee_id))
  );

drop policy if exists committee_payments_delete on public.committee_payments;
create policy committee_payments_delete on public.committee_payments for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_committee_collector(committee_id));
