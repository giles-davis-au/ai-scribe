ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS clinical_facts jsonb;
