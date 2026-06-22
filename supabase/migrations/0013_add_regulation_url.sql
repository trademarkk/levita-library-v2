alter table public.knowledge_entries
  add column if not exists regulation_url text;

update public.knowledge_entries
set regulation_url = substring(content from '(https?://[^[:space:]<>()]+)')
where category = 'REGULATION'
  and nullif(btrim(regulation_url), '') is null
  and content ~ 'https?://';

comment on column public.knowledge_entries.regulation_url is
  'Clickable external document URL for a regulation. Existing content and role ownership remain unchanged.';
