-- ============================================================
-- AI Scribe — initial schema
-- Run via: supabase db push  (or paste into Supabase SQL editor)
-- ============================================================

create table public.sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  status       text        not null default 'created'
                           check (status in ('created','uploaded','processing','completed','failed')),
  audio_path   text,
  transcript   text,
  soap_note    jsonb,       -- { subjective, objective, assessment, plan }
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for the common query: list sessions by user, newest first
create index sessions_user_id_created_at_idx
  on public.sessions (user_id, created_at desc);

-- Auto-update updated_at on every write
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.update_updated_at();

-- Row Level Security: users can only see and modify their own sessions
alter table public.sessions enable row level security;

create policy "owner_all"
  on public.sessions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
