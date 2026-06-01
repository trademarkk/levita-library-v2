alter table public.max_reminders
  drop constraint if exists max_reminders_report_slot_check;

delete from public.max_reminders
where report_slot = '22:00'
  and status in ('pending', 'processing', 'failed');

alter table public.max_reminders
  add constraint max_reminders_report_slot_check check (report_slot in ('14:00', '18:00'));
