alter table public.financial_plan_payments
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz;

create table if not exists public.financial_payment_notification_runs (
  notification_date date primary key,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed', 'skipped')),
  message_text text,
  max_message_id text,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_plan_unpaid_payment_date_idx
  on public.financial_plan_payments (payment_date)
  where is_paid = false and nullif(btrim(value), '') is not null;

alter table public.financial_payment_notification_runs enable row level security;
