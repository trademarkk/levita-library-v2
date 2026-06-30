alter table public.expenses
  add column if not exists previous_month_credit boolean not null default false;
