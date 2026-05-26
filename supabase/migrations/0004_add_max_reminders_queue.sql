create table if not exists public.max_reminders (
  id text primary key,
  shift_id text not null,
  admin_name text not null,
  studio text not null default 'STAVROPOLSKAYA',
  report_slot text not null,
  scheduled_at timestamptz not null,
  message_text text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  error text,
  max_message_id text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint max_reminders_studio_check check (studio in ('STAVROPOLSKAYA', 'MACHUGI')),
  constraint max_reminders_report_slot_check check (report_slot in ('14:00', '18:00', '22:00')),
  constraint max_reminders_status_check check (status in ('pending', 'processing', 'sent', 'failed'))
);

create index if not exists max_reminders_status_scheduled_idx
  on public.max_reminders (status, scheduled_at);

create index if not exists max_reminders_shift_idx
  on public.max_reminders (shift_id);

alter table public.max_reminders enable row level security;

comment on table public.max_reminders is 'Persistent MAX reminder queue for Vercel Cron and Supabase-backed deployment.';
