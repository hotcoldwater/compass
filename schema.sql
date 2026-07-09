CREATE TABLE IF NOT EXISTS experiences (
  id SERIAL PRIMARY KEY,
  experience_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  company_name TEXT,
  application_start_date DATE,
  application_end_date DATE,
  job_field TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resume_questions (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL DEFAULT '',
  limit_type TEXT NOT NULL DEFAULT 'none',
  limit_value INTEGER,
  answer_content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT resume_questions_limit_type_check
    CHECK (limit_type IN ('chars', 'bytes', 'none'))
);

CREATE INDEX IF NOT EXISTS idx_resume_questions_resume_id
  ON resume_questions (resume_id, sort_order, id);
