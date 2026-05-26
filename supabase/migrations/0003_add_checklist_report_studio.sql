alter table public.checklist_reports
  add column if not exists studio text not null default 'STAVROPOLSKAYA';

alter table public.checklist_reports
  drop constraint if exists checklist_reports_studio_check;

alter table public.checklist_reports
  add constraint checklist_reports_studio_check check (studio in ('STAVROPOLSKAYA', 'MACHUGI'));
