-- Business savings: money set aside from Cemzlah into the personal
-- savings pool. txn_id links to the paired set_aside transaction so
-- deleting the business entry removes the personal one too.
alter table public.business_entries
  drop constraint business_entries_kind_check;

alter table public.business_entries
  add constraint business_entries_kind_check
  check (kind in ('income', 'expense', 'zakat', 'draw', 'save'));

alter table public.business_entries
  add column txn_id uuid references public.transactions(id) on delete set null;
