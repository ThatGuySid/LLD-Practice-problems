CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  prompt TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id TEXT NOT NULL,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','evaluating','completed','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_learner ON attempts(learner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status, updated_at);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL DEFAULT '',
  diagram_json JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  serialized_diagram TEXT NOT NULL DEFAULT '',
  detected_code BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','evaluating','completed','failed')),
  result_json JSONB,
  precheck_json JSONB NOT NULL DEFAULT '{"hardFailures":[],"hints":[]}'::jsonb,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status, updated_at);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('Strong','Adequate','Needs work','Not addressed')),
  evidence TEXT NOT NULL,
  concern TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('High','Medium','Low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, criterion_key)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
