-- AI-MON Supabase Database Schema (Phase 1)
-- Description: JSON data structures converted to PostgreSQL Relational Tables.
-- Execution: Run this script in the Supabase SQL Editor for your project.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username text NOT NULL, -- UNIQUE constraint removed to allow active-only partial unique index
  password text,
  nickname text,
  email text,
  role text DEFAULT 'student',
  course_level text DEFAULT 'beginner',
  is_level_tested boolean DEFAULT false,
  marketing_agreed boolean DEFAULT false,
  character text DEFAULT 'slime',
  lv integer DEFAULT 1,
  xp integer DEFAULT 0,

  -- GP·Coin·Ranking
  coin_balance integer NOT NULL DEFAULT 0,
  total_coin_earned integer NOT NULL DEFAULT 0,
  gp integer NOT NULL DEFAULT 0,
  gp_level_base integer NOT NULL DEFAULT 0,
  evolution_stage integer NOT NULL DEFAULT 0,
  ranking_score integer NOT NULL DEFAULT 0,
  weekly_ranking_score integer NOT NULL DEFAULT 0,
  legacy_xp_snapshot integer DEFAULT NULL,
  
  crowns integer DEFAULT 5,
  streak integer DEFAULT 0, 
  last_login text,
  daily_free_attempts integer DEFAULT 2,
  last_free_attempt_date text,
  ai_feedback_count integer DEFAULT 0,
  token_version integer DEFAULT 1,
  group_id uuid,
  equipped_title text,
  endboss_cleared_levels jsonb DEFAULT '[]',
  miniboss_cleared_stages jsonb DEFAULT '[]',
  unitboss_cleared_units jsonb DEFAULT '[]',
  battle_sessions jsonb DEFAULT '{}',
  seen_questions jsonb DEFAULT '{}',
  max_unlocked_unit jsonb DEFAULT '{"beginner":1,"intermediate":1,"advanced":1}',
  completed_units jsonb DEFAULT '{"beginner":0,"intermediate":0,"advanced":0}',
  awarded_crown_units jsonb DEFAULT '[]',
  earned_streak_milestones jsonb DEFAULT '[]',
  titles jsonb DEFAULT '[]',
  game_rewards jsonb DEFAULT '{}',
  version bigint NOT NULL DEFAULT 0, -- Used for optimistic concurrency control (CAS)
  missions jsonb DEFAULT '{}', -- Stores user mission progress
  purchased_themes jsonb DEFAULT '["dark"]', -- Stores purchased themes
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

-- Active-only partial unique indexes (allows reuse of username/email after soft delete)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uq
  ON users (lower(username)) -- lower() 적용
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uq
  ON users (lower(email)) -- lower() 적용
  WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> '';


-- Future optional nickname uniqueness, apply only after cleaning duplicates:
-- CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_active_uq
--   ON users ((lower(trim(nickname))))
--   WHERE deleted_at IS NULL AND nickname IS NOT NULL AND trim(nickname) <> '';

-- Migration helper for existing databases:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS missions jsonb DEFAULT '{}';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS purchased_themes jsonb DEFAULT '["dark"]';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_sessions jsonb DEFAULT '{}';
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- 2. Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Reset Tokens Table
-- token column stores SHA-256 hex digest of the raw reset token.
CREATE TABLE IF NOT EXISTS reset_tokens (
  email text PRIMARY KEY,
  token text NOT NULL,             -- SHA-256(raw_token) hex
  expires_at timestamptz NOT NULL,
  failed_attempts integer DEFAULT 0,
  send_date text,                  -- KST Date (YYYY-MM-DD)
  send_count_today integer DEFAULT 0,
  last_sent timestamptz,           -- 3-minute cooldown reference
  created_at timestamptz DEFAULT now()
);

-- 3-A. Email Verification Codes Table
-- code_hash stores an HMAC-SHA256 digest of the 6-digit email verification code.
CREATE TABLE IF NOT EXISTS email_verification_codes (
  email text NOT NULL,
  purpose text NOT NULL DEFAULT 'register',
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer DEFAULT 0,
  verified boolean DEFAULT false,
  last_sent timestamptz,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (email, purpose)
);

-- 4. Progress Table
CREATE TABLE IF NOT EXISTS progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  unit integer NOT NULL,
  stage text NOT NULL,
  score integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  checkpoint text,
  course_level text DEFAULT 'beginner',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, unit, stage, course_level)
);

-- 5. Wrong Answers Table
CREATE TABLE IF NOT EXISTS wrong_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  question_id text,
  user_answer text,
  feedback text,
  ai_explanation text,
  reviewed boolean DEFAULT false,
  timestamp text,
  created_at timestamptz DEFAULT now()
);

-- 6. Attempts Table (Full log of all graded questions)
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  unit integer,
  stage text,
  level text,                    -- beginner | intermediate | advanced
  mode text NOT NULL,            -- quiz | train | miniboss | unitboss | endboss
  is_correct boolean NOT NULL,
  answered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user      ON attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_q    ON attempts (user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_unit ON attempts (user_id, unit);


-- 7. Atomic User Update RPC (update_user_atomic)
-- Prevents lost updates during concurrent read-modify-write operations.
CREATE OR REPLACE FUNCTION update_user_atomic(
  p_user_id uuid,
  p_numeric_deltas jsonb,
  p_jsonb_merges jsonb,
  p_other_updates jsonb
) RETURNS void 
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text;
  v_val jsonb;
  v_sql text;
BEGIN
  v_sql := 'UPDATE users SET ';
  
  -- 1. Atomic increment for numeric columns
  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_numeric_deltas) LOOP
    v_sql := v_sql || quote_ident(v_key) || ' = COALESCE(' || quote_ident(v_key) || ', 0) + ' || (v_val::text) || ', ';
  END LOOP;
  
  -- 2. Merge JSONB columns
  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_jsonb_merges) LOOP
    v_sql := v_sql || quote_ident(v_key) || ' = COALESCE(' || quote_ident(v_key) || ', ''{}''::jsonb) || ' || quote_literal(v_val::text) || '::jsonb, ';
  END LOOP;
  
  -- 3. Overwrite other columns
  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_other_updates) LOOP
    v_sql := v_sql || quote_ident(v_key) || ' = ' || 
      CASE jsonb_typeof(v_val)
        WHEN 'string' THEN quote_literal(v_val#>>'{}')
        WHEN 'boolean' THEN (v_val::text)
        WHEN 'null' THEN 'NULL'
        ELSE quote_literal(v_val::text) || '::jsonb'
      END || ', ';
  END LOOP;
  
  -- Remove trailing comma
  IF RIGHT(v_sql, 2) = ', ' THEN
    v_sql := LEFT(v_sql, LENGTH(v_sql) - 2);
  ELSE
    RETURN;
  END IF;
  
  v_sql := v_sql || ' WHERE id = ' || quote_literal(p_user_id::text) || '::uuid';
  
  EXECUTE v_sql;
END;
$$;

-- Security: Revoke public execution rights to prevent direct client-side exploitation via PostgREST.
REVOKE EXECUTE ON FUNCTION update_user_atomic(uuid, jsonb, jsonb, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION update_user_atomic(uuid, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION update_user_atomic(uuid, jsonb, jsonb, jsonb) FROM authenticated;

-- Existing database migration helper: align an older attempts table without deleting rows.
-- Paste this block into the Supabase SQL Editor if attempts writes fail after a schema migration.
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  unit integer,
  stage text,
  level text,
  mode text NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS question_id text;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS unit integer;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_correct boolean;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS answered_at timestamptz DEFAULT now();
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
DECLARE
  v_type text;
  v_bad_count integer;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'id';

  IF v_type <> 'uuid' THEN
    EXECUTE 'SELECT count(*) FROM attempts WHERE id IS NOT NULL AND id::text !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'''
      INTO v_bad_count;
    IF v_bad_count > 0 THEN
      RAISE EXCEPTION 'attempts.id has % non-uuid values; fix them before converting the column', v_bad_count;
    END IF;
    ALTER TABLE attempts ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;

  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'user_id';

  IF v_type <> 'uuid' THEN
    EXECUTE 'SELECT count(*) FROM attempts WHERE user_id IS NOT NULL AND user_id::text !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'''
      INTO v_bad_count;
    IF v_bad_count > 0 THEN
      RAISE EXCEPTION 'attempts.user_id has % non-uuid values; fix them before converting the column', v_bad_count;
    END IF;
    ALTER TABLE attempts ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
  END IF;

  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'answered_at';

  IF v_type NOT IN ('timestamp with time zone') THEN
    ALTER TABLE attempts ALTER COLUMN answered_at TYPE timestamptz USING answered_at::timestamptz;
  END IF;

  SELECT count(*) INTO v_bad_count FROM attempts WHERE question_id IS NULL OR mode IS NULL OR is_correct IS NULL;
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'attempts has % rows with null question_id/mode/is_correct; fix them before adding NOT NULL constraints', v_bad_count;
  END IF;

  SELECT count(*) INTO v_bad_count
  FROM attempts a
  WHERE a.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id);
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'attempts has % rows whose user_id does not exist in users.id; fix orphan rows before adding the FK', v_bad_count;
  END IF;
END $$;

ALTER TABLE attempts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE attempts ALTER COLUMN id SET NOT NULL;
ALTER TABLE attempts ALTER COLUMN question_id SET NOT NULL;
ALTER TABLE attempts ALTER COLUMN mode SET NOT NULL;
ALTER TABLE attempts ALTER COLUMN is_correct SET NOT NULL;
ALTER TABLE attempts ALTER COLUMN answered_at SET DEFAULT now();
ALTER TABLE attempts ALTER COLUMN created_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attempts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE attempts ADD CONSTRAINT attempts_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'attempts'::regclass AND conname = 'attempts_user_id_fkey'
  ) THEN
    ALTER TABLE attempts
      ADD CONSTRAINT attempts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attempts_user      ON attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_q    ON attempts (user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_unit ON attempts (user_id, unit);
