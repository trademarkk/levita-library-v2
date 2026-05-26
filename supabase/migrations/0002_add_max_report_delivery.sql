alter table public.checklist_reports
  add column if not exists sent_to_max boolean not null default false,
  add column if not exists max_sent_at timestamptz,
  add column if not exists max_send_error text,
  add column if not exists max_message_id text;
