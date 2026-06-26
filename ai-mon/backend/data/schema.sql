-- AI-MON Supabase Database Schema (Phase 1)
-- Description: JSON data structures converted to PostgreSQL Relational Tables.
-- Execution: Run this script in the Supabase SQL Editor for your project.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
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
  seen_questions jsonb DEFAULT '{}',
  max_unlocked_unit jsonb DEFAULT '{"beginner":1,"intermediate":1,"advanced":1}',
  completed_units jsonb DEFAULT '{"beginner":0,"intermediate":0,"advanced":0}',
  awarded_crown_units jsonb DEFAULT '[]',
  earned_streak_milestones jsonb DEFAULT '[]',
  titles jsonb DEFAULT '[]',
  game_rewards jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2. Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Reset Tokens Table
-- token 컬럼은 SHA-256 hex digest (평문 아닌 해시만 저장).
-- ALTER TABLE 마이그레이션 (기존 DB):
--   ALTER TABLE reset_tokens
--     ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0,
--     ADD COLUMN IF NOT EXISTS send_date text,
--     ADD COLUMN IF NOT EXISTS send_count_today integer DEFAULT 0,
--     ADD COLUMN IF NOT EXISTS last_sent timestamptz;
CREATE TABLE IF NOT EXISTS reset_tokens (
  email text PRIMARY KEY,
  token text NOT NULL,             -- SHA-256(raw_token) hex — 평문 저장 금지
  expires_at timestamptz NOT NULL,
  failed_attempts integer DEFAULT 0,
  send_date text,                  -- KST 날짜(YYYY-MM-DD) — 이메일 단위 일일 발송 카운터 키
  send_count_today integer DEFAULT 0,
  last_sent timestamptz,           -- 발송 쿨다운(3분) 기준시각
  created_at timestamptz DEFAULT now()
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

-- 6. Attempts Table (풀이 전수 기록)
-- 정오답 무관, AI 피드백 호출과 완전히 독립적으로 '문제가 채점되는 순간' 매번 1건 insert.
-- (retry 재제출 포함 전수 기록 — append-only) 유저 데이터 영역이며 레슨 콘텐츠 JSON과 분리.
-- 컬럼 스키마 동결: user_id, question_id, unit, stage, level, mode, is_correct, answered_at.
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL,     -- quiz/miniboss JSON의 question_id와 동일 형식으로 정규화 저장
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
