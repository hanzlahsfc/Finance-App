-- Allow "set_aside" transactions: money moved into the savings pool.
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('expense', 'income', 'loan_given', 'loan_taken', 'set_aside'));
