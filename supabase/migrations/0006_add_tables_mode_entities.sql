create table if not exists public.admin_shifts (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  admin_name text not null,
  studio text not null default 'STAVROPOLSKAYA',
  shift_date date not null,
  started_at timestamptz not null,
  reminders_scheduled_at timestamptz,
  reminder_schedule_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_shifts_studio_check check (studio in ('STAVROPOLSKAYA', 'MACHUGI')),
  unique (user_id, shift_date)
);

create table if not exists public.audit_log (
  id text primary key,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text not null,
  description text,
  actor_id text references public.users(id) on delete set null,
  actor_name text not null,
  actor_role public.levtia_role,
  created_at timestamptz not null default now()
);

create table if not exists public.call_reviews (
  id text primary key,
  source text not null default 'levita-calls',
  external_id text not null,
  admin_name text not null,
  studio public.expense_studio not null,
  score numeric(5,2) not null check (score >= 0),
  reviewed_at date not null,
  amo_crm_deal_url text,
  call_url text,
  original_filename text,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists admin_shifts_date_studio_idx on public.admin_shifts (shift_date, studio);
create index if not exists admin_shifts_user_date_idx on public.admin_shifts (user_id, shift_date);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_created_idx on public.audit_log (actor_id, created_at desc);
create index if not exists call_reviews_admin_date_idx on public.call_reviews (admin_name, reviewed_at);
create index if not exists call_reviews_studio_date_idx on public.call_reviews (studio, reviewed_at);

alter table public.admin_shifts enable row level security;
alter table public.audit_log enable row level security;
alter table public.call_reviews enable row level security;

comment on table public.admin_shifts is 'Opened administrator shifts used by report reminders and control center.';
comment on table public.audit_log is 'Application audit events assembled from role actions.';
comment on table public.call_reviews is 'Call review scores synchronized from levita-calls.';
