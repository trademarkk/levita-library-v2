create table if not exists public.trainer_hiring_candidates (
  id text primary key,
  full_name text not null,
  status text not null default 'active' check (status in ('active', 'rejected')),
  video_intro_approved boolean,
  primary_documents_received boolean not null default false,
  nda_signed boolean not null default false,
  nda_link text,
  intro_zoom_scheduled boolean not null default false,
  intro_zoom_date date,
  second_certification_scheduled boolean not null default false,
  second_certification_date date,
  second_certification_result text not null default 'pending' check (second_certification_result in ('pending', 'passed', 'failed')),
  second_certification_retake_date date,
  trainings_visited_after_second_certification boolean not null default false,
  media_collected boolean not null default false,
  third_certification_scheduled boolean not null default false,
  third_certification_date date,
  third_certification_preparation_zoom_date date,
  working_hours_assigned boolean not null default false,
  first_shift_date date,
  created_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rejected_at timestamptz
);

create index if not exists trainer_hiring_candidates_status_updated_idx
  on public.trainer_hiring_candidates (status, updated_at desc);

alter table public.trainer_hiring_candidates enable row level security;
