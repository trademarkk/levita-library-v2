alter table public.knowledge_entries
  add column if not exists video_url text;

create table if not exists public.content_attachments (
  id text primary key,
  knowledge_entry_id text not null references public.knowledge_entries(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists content_attachments_entry_position_idx
  on public.content_attachments (knowledge_entry_id, position, created_at);

alter table public.content_attachments enable row level security;

comment on table public.content_attachments is
  'Metadata for private screenshots stored in Supabase Storage.';
