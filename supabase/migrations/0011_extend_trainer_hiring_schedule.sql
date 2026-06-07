alter table public.trainer_hiring_candidates
  add column if not exists intro_zoom_time time,
  add column if not exists second_certification_preparation_zoom_scheduled boolean not null default false,
  add column if not exists second_certification_preparation_zoom_date date,
  add column if not exists second_certification_preparation_zoom_time time,
  add column if not exists second_certification_time time,
  add column if not exists third_certification_time time,
  add column if not exists third_certification_result text not null default 'pending',
  add column if not exists third_certification_preparation_zoom_time time;

alter table public.trainer_hiring_candidates
  drop constraint if exists trainer_hiring_candidates_third_certification_result_check;

alter table public.trainer_hiring_candidates
  add constraint trainer_hiring_candidates_third_certification_result_check
  check (third_certification_result in ('pending', 'passed', 'failed'));
