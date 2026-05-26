-- LEVTIA Library Supabase baseline.
-- Apply in Supabase SQL editor or with: supabase db push
-- The app can first use public.app_state as a compatibility layer and then migrate
-- screens one-by-one to the normalized tables below.

create extension if not exists pgcrypto;

do $$
begin
  create type public.levtia_role as enum ('OWNER', 'ASSISTANT', 'SENIOR_ADMIN', 'ADMIN', 'SENIOR_TRAINER', 'TRAINER');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.employee_status as enum ('active', 'blocked', 'read-only');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.knowledge_category as enum ('REGULATION', 'IMPORTANT_INFO', 'RESPONSIBILITY', 'TRAINING', 'KNOWLEDGE');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.link_category as enum ('WORK_TABLE', 'TRAINING', 'HELPFUL');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.refund_status as enum ('NEW', 'IN_PROGRESS', 'RESOLVED', 'DECLINED');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.expense_studio as enum ('STAVROPOLSKAYA', 'MACHUGI');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.expense_account as enum ('RS_SBER', 'TOCHKA', 'CREDIT');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_priority as enum ('high', 'medium', 'low');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_status as enum ('pending', 'in-progress', 'completed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.checklist_report_slot as enum ('14:00', '18:00', '22:00');
exception when duplicate_object then null;
end $$;

create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_tokens (
  id text primary key,
  access_token text not null,
  refresh_token text,
  expires_at bigint not null,
  scope text,
  token_type text,
  updated_at timestamptz not null default now()
);

create table if not exists public.google_oauth_states (
  state text primary key,
  created_at bigint not null
);

create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text,
  legacy_password text,
  role public.levtia_role not null,
  status public.employee_status not null default 'active',
  join_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  period text not null default '',
  role public.levtia_role not null,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'pending',
  deadline date,
  add_to_calendar boolean not null default false,
  calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.response_templates (
  id text primary key,
  title text not null,
  body text not null,
  role public.levtia_role not null,
  purpose text,
  created_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.helpful_links (
  id text primary key,
  title text not null,
  url text not null,
  category public.link_category not null default 'HELPFUL',
  role public.levtia_role not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_templates (
  id text primary key,
  title text not null,
  url text not null,
  created_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.useful_contacts (
  id text primary key,
  name text not null,
  phone text not null,
  company text not null,
  specialty text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id text primary key,
  title text not null,
  content text not null,
  role public.levtia_role not null,
  category public.knowledge_category not null,
  hashtags text,
  is_actual boolean not null default true,
  searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_checklists (
  id text primary key,
  title text not null,
  role public.levtia_role not null,
  assigned_to text not null references public.users(id) on delete cascade,
  checklist_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assigned_to, checklist_date)
);

create table if not exists public.checklist_items (
  id text primary key,
  checklist_id text not null references public.daily_checklists(id) on delete cascade,
  label text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by text references public.users(id) on delete set null,
  position integer not null default 0
);

create table if not exists public.checklist_reports (
  id text primary key default gen_random_uuid()::text,
  checklist_id text not null references public.daily_checklists(id) on delete cascade,
  slot public.checklist_report_slot not null,
  admin_name text not null,
  calls text not null default '',
  reached text not null default '',
  bookings text not null default '',
  cash text not null default '',
  came text not null default '',
  bought text not null default '',
  submitted_at timestamptz,
  sent_to_telegram boolean not null default false,
  telegram_sent_at timestamptz,
  unique (checklist_id, slot)
);

create table if not exists public.refunds (
  id text primary key,
  client_name text not null,
  requested_at timestamptz not null,
  amount numeric(12,2) not null default 0,
  reason text not null,
  status public.refund_status not null default 'NEW',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_plan_months (
  month text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_plan_rows (
  id text primary key,
  month text not null references public.financial_plan_months(month) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_plan_payments (
  row_id text not null references public.financial_plan_rows(id) on delete cascade,
  payment_date date not null,
  value text not null default '',
  updated_at timestamptz not null default now(),
  primary key (row_id, payment_date)
);

create table if not exists public.calendar_events (
  id text primary key,
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  description text,
  source_task_id text references public.tasks(id) on delete set null,
  google_event_id text,
  google_recurring_event_id text,
  google_html_link text,
  google_sync_status text,
  google_sync_error text,
  source text,
  source_name text,
  recurrence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  expense_date date not null,
  amount numeric(12,2) not null,
  account public.expense_account not null,
  category text not null,
  studio public.expense_studio not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_evaluation_sheets (
  id text primary key,
  trainer_name text not null,
  studio public.expense_studio not null,
  direction text not null,
  score numeric(5,2) not null check (score >= 0),
  evaluated_at date not null,
  sheet_url text not null,
  created_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_checklist_items (
  id text primary key default gen_random_uuid()::text,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'main',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 'main')
);

create index if not exists app_state_payload_gin_idx on public.app_state using gin (payload jsonb_path_ops);
create index if not exists google_oauth_states_created_at_idx on public.google_oauth_states (created_at);
create index if not exists users_role_status_idx on public.users (role, status);
create index if not exists tasks_role_status_deadline_idx on public.tasks (role, status, deadline);
create index if not exists response_templates_role_idx on public.response_templates (role);
create index if not exists helpful_links_role_category_idx on public.helpful_links (role, category);
create index if not exists knowledge_entries_role_category_actual_idx on public.knowledge_entries (role, category, is_actual);
create index if not exists daily_checklists_date_role_idx on public.daily_checklists (checklist_date, role);
create index if not exists daily_checklists_assigned_date_idx on public.daily_checklists (assigned_to, checklist_date);
create index if not exists checklist_items_checklist_position_idx on public.checklist_items (checklist_id, position);
create index if not exists checklist_reports_checklist_slot_idx on public.checklist_reports (checklist_id, slot);
create index if not exists refunds_status_requested_at_idx on public.refunds (status, requested_at desc);
create index if not exists financial_plan_rows_month_position_idx on public.financial_plan_rows (month, position);
create index if not exists financial_plan_payments_date_idx on public.financial_plan_payments (payment_date);
create index if not exists calendar_events_date_idx on public.calendar_events (event_date, start_time);
create index if not exists calendar_events_google_event_id_idx on public.calendar_events (google_event_id);
create index if not exists expenses_date_studio_idx on public.expenses (expense_date, studio);
create index if not exists expenses_category_idx on public.expenses (category);
create index if not exists trainer_evaluation_date_studio_idx on public.trainer_evaluation_sheets (evaluated_at, studio);
create index if not exists trainer_evaluation_trainer_date_idx on public.trainer_evaluation_sheets (trainer_name, evaluated_at);
create index if not exists call_checklist_items_position_idx on public.call_checklist_items (position);

alter table public.app_state enable row level security;
alter table public.google_calendar_tokens enable row level security;
alter table public.google_oauth_states enable row level security;
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.response_templates enable row level security;
alter table public.helpful_links enable row level security;
alter table public.document_templates enable row level security;
alter table public.useful_contacts enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.daily_checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_reports enable row level security;
alter table public.refunds enable row level security;
alter table public.financial_plan_months enable row level security;
alter table public.financial_plan_rows enable row level security;
alter table public.financial_plan_payments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.trainer_evaluation_sheets enable row level security;
alter table public.call_checklist_items enable row level security;
alter table public.app_settings enable row level security;

comment on table public.app_state is 'Compatibility JSON storage used during the SQLite-to-Supabase transition.';
comment on table public.google_calendar_tokens is 'Server-only OAuth token storage. Access through service role API only.';
comment on table public.users is 'LEVTIA role users. Replace legacy_password with Supabase Auth identities before production.';
