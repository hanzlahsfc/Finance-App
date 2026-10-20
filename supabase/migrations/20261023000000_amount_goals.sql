-- Move goal funding from % allocation to per-week amounts + priority.
alter table public.savings_goals
  add column if not exists weekly_amount numeric not null default 0,
  add column if not exists priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  drop column if exists allocation_percent;

-- Obligations get a weekly pay-down plan and an earmarked reserve
-- funded from the set-aside pool.
alter table public.obligations
  add column if not exists weekly_amount numeric not null default 0,
  add column if not exists reserved_amount numeric not null default 0;
