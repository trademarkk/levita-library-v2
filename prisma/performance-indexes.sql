create index if not exists idx_call_reviews_reviewed_at
  on public.call_reviews (reviewed_at desc);

create index if not exists idx_call_reviews_reviewed_at_admin
  on public.call_reviews (reviewed_at desc, admin_name);

create index if not exists idx_call_reviews_reviewed_at_studio
  on public.call_reviews (reviewed_at desc, studio);

create index if not exists idx_trainer_evaluation_sheets_evaluated_at
  on public.trainer_evaluation_sheets (evaluated_at desc);

create index if not exists idx_trainer_evaluation_sheets_evaluated_at_trainer
  on public.trainer_evaluation_sheets (evaluated_at desc, trainer_name);

create index if not exists idx_trainer_evaluation_sheets_evaluated_at_studio
  on public.trainer_evaluation_sheets (evaluated_at desc, studio);

create index if not exists idx_expenses_expense_date
  on public.expenses (expense_date desc);

create index if not exists idx_financial_plan_rows_month_position
  on public.financial_plan_rows (month, position);

create index if not exists idx_financial_plan_payments_date_row
  on public.financial_plan_payments (payment_date, row_id);

create index if not exists idx_daily_checklists_date_assigned
  on public.daily_checklists (checklist_date desc, assigned_to);

create index if not exists idx_checklist_items_checklist_position
  on public.checklist_items (checklist_id, position);

create index if not exists idx_checklist_reports_checklist_slot
  on public.checklist_reports (checklist_id, slot);

create index if not exists idx_admin_shifts_date_user_closed
  on public.admin_shifts (shift_date desc, user_id, closed_at);

create index if not exists idx_knowledge_entries_role_category_business
  on public.knowledge_entries (role, category, business_model);

create unique index if not exists idx_content_favorites_user_entity_unique
  on public.content_favorites (user_id, entity_type, entity_id);
