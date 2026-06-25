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
CREATE TABLE IF NOT EXISTS reset_tokens (
  email text PRIMARY KEY,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
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
