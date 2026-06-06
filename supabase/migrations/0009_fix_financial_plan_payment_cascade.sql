do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'financial_plan_payments_row_id_fkey'
      and conrelid = 'public.financial_plan_payments'::regclass
  ) then
    alter table public.financial_plan_payments
      drop constraint financial_plan_payments_row_id_fkey;
  end if;

  alter table public.financial_plan_payments
    add constraint financial_plan_payments_row_id_fkey
    foreign key (row_id)
    references public.financial_plan_rows(id)
    on delete cascade;
end $$;
