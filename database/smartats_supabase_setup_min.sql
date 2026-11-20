CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE TABLE IF NOT EXISTS public.profiles (
  id                        UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email                     TEXT,
  full_name                 TEXT,
  avatar_url                TEXT,
  is_premium                BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_status       TEXT
    CHECK (subscription_status IS NULL OR subscription_status IN (
      'active', 'canceled', 'past_due', 'unpaid',
      'incomplete', 'incomplete_expired', 'trialing'
    )),
  stripe_customer_id        TEXT UNIQUE,
  stripe_subscription_id    TEXT UNIQUE,
  stripe_session_id         TEXT UNIQUE,
  subscription_start_date   TIMESTAMPTZ,
  subscription_end_date     TIMESTAMPTZ,
  last_active_at            TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_session_id      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at        TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status   TEXT;
CREATE TABLE IF NOT EXISTS public.resumes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'Untitled Resume',
  template_id      TEXT NOT NULL DEFAULT 'professional',
  content          JSONB NOT NULL DEFAULT '{}'::jsonb,
  name             TEXT,
  data             JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_role      TEXT,
  industry_focus   TEXT,
  score_breakdown  JSONB,
  ats_score        INTEGER DEFAULT 0 CHECK (ats_score IS NULL OR (ats_score >= 0 AND ats_score <= 100)),
  ats_analysis     JSONB DEFAULT '{}'::jsonb,
  is_public        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS name             TEXT;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS data             JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS target_role      TEXT;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS industry_focus   TEXT;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS score_breakdown  JSONB;
CREATE TABLE IF NOT EXISTS public.resume_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id       UUID NOT NULL REFERENCES public.resumes (id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  content         JSONB NOT NULL,
  ats_score       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (resume_id, version_number)
);
CREATE TABLE IF NOT EXISTS public.templates (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  category           TEXT NOT NULL,
  is_premium         BOOLEAN DEFAULT FALSE,
  preview_image_url  TEXT,
  template_config    JSONB DEFAULT '{}'::jsonb,
  is_active          BOOLEAN DEFAULT TRUE,
  sort_order         INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  event_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash  VARCHAR(64) NOT NULL,
  model        VARCHAR(50) NOT NULL,
  response     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  CONSTRAINT ai_cache_unique UNIQUE (prompt_hash, model)
);
CREATE TABLE IF NOT EXISTS public.job_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  company     TEXT NOT NULL,
  position    TEXT NOT NULL,
  location    TEXT,
  url         TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE TABLE IF NOT EXISTS public.leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_account_id           TEXT NOT NULL UNIQUE,
  display_name                TEXT,
  contact_email               TEXT,
  country                     TEXT,
  capability_status           TEXT,
  requirements_status         TEXT,
  requirements_currently_due  JSONB DEFAULT '[]'::jsonb,
  requirements_past_due       JSONB DEFAULT '[]'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.connected_accounts ADD COLUMN IF NOT EXISTS capability_status          TEXT;
ALTER TABLE public.connected_accounts ADD COLUMN IF NOT EXISTS requirements_status        TEXT;
ALTER TABLE public.connected_accounts ADD COLUMN IF NOT EXISTS requirements_currently_due JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.connected_accounts ADD COLUMN IF NOT EXISTS requirements_past_due      JSONB DEFAULT '[]'::jsonb;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
DROP VIEW IF EXISTS public.usage_statistics;
CREATE VIEW public.usage_statistics
WITH (security_invoker = true) AS
SELECT
  user_id,
  (created_at AT TIME ZONE 'utc')::date AS usage_date,
  event_type                            AS action,
  COUNT(*)::int                         AS usage_count
FROM public.user_analytics
GROUP BY user_id, (created_at AT TIME ZONE 'utc')::date, event_type;
GRANT SELECT ON public.usage_statistics TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id   ON public.profiles (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status  ON public.profiles (subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium           ON public.profiles (is_premium);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at       ON public.profiles (last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id               ON public.resumes (user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_template_id           ON public.resumes (template_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at            ON public.resumes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_updated_at            ON public.resumes (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_ats_score             ON public.resumes (ats_score DESC);
CREATE INDEX IF NOT EXISTS idx_resume_versions_resume_id     ON public.resume_versions (resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at    ON public.resume_versions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_category            ON public.templates (category);
CREATE INDEX IF NOT EXISTS idx_templates_is_premium          ON public.templates (is_premium);
CREATE INDEX IF NOT EXISTS idx_templates_is_active           ON public.templates (is_active);
CREATE INDEX IF NOT EXISTS idx_templates_sort_order          ON public.templates (sort_order);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id        ON public.user_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_event_type     ON public.user_analytics (event_type);
CREATE INDEX IF NOT EXISTS idx_user_analytics_created_at     ON public.user_analytics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_action_created
  ON public.user_analytics (user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup               ON public.ai_cache (prompt_hash, model);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires              ON public.ai_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id      ON public.job_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status       ON public.job_applications (status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at   ON public.job_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email                  ON public.leads (lower(email));
CREATE INDEX IF NOT EXISTS idx_leads_created_at              ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id    ON public.connected_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_stripe_id  ON public.connected_accounts (stripe_account_id);
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "resumes_select_own" ON public.resumes;
CREATE POLICY "resumes_select_own" ON public.resumes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "resumes_insert_own" ON public.resumes;
CREATE POLICY "resumes_insert_own" ON public.resumes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "resumes_update_own" ON public.resumes;
CREATE POLICY "resumes_update_own" ON public.resumes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "resumes_delete_own" ON public.resumes;
CREATE POLICY "resumes_delete_own" ON public.resumes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "resumes_select_public" ON public.resumes;
CREATE POLICY "resumes_select_public" ON public.resumes
  FOR SELECT USING (is_public = true);
DROP POLICY IF EXISTS "resume_versions_select_own" ON public.resume_versions;
CREATE POLICY "resume_versions_select_own" ON public.resume_versions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.resumes r
            WHERE r.id = resume_versions.resume_id AND r.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "resume_versions_insert_own" ON public.resume_versions;
CREATE POLICY "resume_versions_insert_own" ON public.resume_versions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.resumes r
            WHERE r.id = resume_versions.resume_id AND r.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "templates_select_active" ON public.templates;
CREATE POLICY "templates_select_active" ON public.templates
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "user_analytics_select_own" ON public.user_analytics;
CREATE POLICY "user_analytics_select_own" ON public.user_analytics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_analytics_insert_own" ON public.user_analytics;
CREATE POLICY "user_analytics_insert_own" ON public.user_analytics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_cache_select" ON public.ai_cache;
CREATE POLICY "ai_cache_select" ON public.ai_cache
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ai_cache_insert" ON public.ai_cache;
CREATE POLICY "ai_cache_insert" ON public.ai_cache
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ai_cache_update" ON public.ai_cache;
CREATE POLICY "ai_cache_update" ON public.ai_cache
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ai_cache_delete_expired" ON public.ai_cache;
CREATE POLICY "ai_cache_delete_expired" ON public.ai_cache
  FOR DELETE TO authenticated USING (expires_at < now());
DROP POLICY IF EXISTS "job_applications_select_own" ON public.job_applications;
CREATE POLICY "job_applications_select_own" ON public.job_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "job_applications_insert_own" ON public.job_applications;
CREATE POLICY "job_applications_insert_own" ON public.job_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "job_applications_update_own" ON public.job_applications;
CREATE POLICY "job_applications_update_own" ON public.job_applications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "job_applications_delete_own" ON public.job_applications;
CREATE POLICY "job_applications_delete_own" ON public.job_applications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_insert_anyone" ON public.leads;
CREATE POLICY "leads_insert_anyone" ON public.leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "connected_accounts_select_own" ON public.connected_accounts;
CREATE POLICY "connected_accounts_select_own" ON public.connected_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "connected_accounts_insert_own" ON public.connected_accounts;
CREATE POLICY "connected_accounts_insert_own" ON public.connected_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "connected_accounts_update_own" ON public.connected_accounts;
CREATE POLICY "connected_accounts_update_own" ON public.connected_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.log_usage(
  p_user_id UUID,
  p_action  TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.user_analytics (user_id, event_type, event_data)
  VALUES (p_user_id, p_action, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_daily_usage_count(
  p_user_id UUID,
  p_action  TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_start TIMESTAMPTZ;
  v_end   TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN 0;
  END IF;
  v_start := date_trunc('day', timezone('utc'::text, now()));
  v_end   := v_start + interval '1 day';
  SELECT COUNT(*)::int INTO v_count
  FROM public.user_analytics
  WHERE user_id = p_user_id
    AND event_type = p_action
    AND created_at >= v_start
    AND created_at <  v_end;
  RETURN COALESCE(v_count, 0);
END;
$$;
CREATE OR REPLACE FUNCTION public.check_daily_limit(
  p_user_id UUID,
  p_action  TEXT,
  p_limit   INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN TRUE;              -- negative limit means unlimited
  END IF;
  v_used := public.get_daily_usage_count(p_user_id, p_action);
  RETURN v_used < p_limit;
END;
$$;
CREATE OR REPLACE FUNCTION public.cleanup_expired_ai_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_usage(UUID, TEXT, JSONB)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_usage_count(UUID, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_daily_limit(UUID, TEXT, INTEGER)  TO authenticated;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_resumes_updated_at ON public.resumes;
CREATE TRIGGER update_resumes_updated_at
  BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_templates_updated_at ON public.templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_connected_accounts_updated_at ON public.connected_accounts;
CREATE TRIGGER update_connected_accounts_updated_at
  BEFORE UPDATE ON public.connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO public.templates (id, name, description, category, is_premium, sort_order) VALUES
  ('professional',    'Professional',    'Clean and professional template perfect for corporate roles', 'business',  FALSE, 1),
  ('modern',          'Modern',          'Contemporary design with a fresh look',                       'creative',  FALSE, 2),
  ('executive',       'Executive',       'Sophisticated template for senior positions',                 'business',  FALSE, 3),
  ('creative',        'Creative',        'Bold and creative design for artistic roles',                 'creative',  TRUE,  4),
  ('technical',       'Technical',       'Optimized for technical and engineering roles',               'technical', FALSE, 5),
  ('executive-elite', 'Executive Elite', 'Premium template for C-level executives',                     'business',  TRUE,  6),
  ('startup-founder', 'Startup Founder', 'Dynamic template for entrepreneurs',                          'business',  TRUE,  7),
  ('designer-pro',    'Designer Pro',    'Premium template for design professionals',                   'creative',  TRUE,  8)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_premium  = EXCLUDED.is_premium,
  sort_order  = EXCLUDED.sort_order,
  is_active   = TRUE;
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
SELECT 'tables' AS kind, count(*)::text AS found
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name IN ('profiles','resumes','resume_versions','templates','user_analytics',
                     'ai_cache','job_applications','leads','connected_accounts')
UNION ALL
SELECT 'functions', count(*)::text
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_updated_at_column','handle_new_user','log_usage',
                       'get_daily_usage_count','check_daily_limit','cleanup_expired_ai_cache');
