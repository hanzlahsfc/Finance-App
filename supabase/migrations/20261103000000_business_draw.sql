-- Owner draw: money out of the business into personal income.
-- income_id links the draw to the paired income_entries row so a
-- delete on the business side removes the personal income row too.
alter table public.business_entries
  drop constraint business_entries_kind_check;

alter table public.business_entries
  add constraint business_entries_kind_check
  check (kind in ('income', 'expense', 'zakat', 'draw'));

alter table public.business_entries
  add column income_id uuid references public.income_entries(id) on delete set null;
