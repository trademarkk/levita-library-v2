alter table public.admin_shifts
  add column if not exists closed_at timestamptz;

create index if not exists admin_shifts_closed_at_idx on public.admin_shifts (closed_at);
