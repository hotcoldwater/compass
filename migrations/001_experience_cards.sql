CREATE TABLE IF NOT EXISTS experience_cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legacy_experience_id INTEGER UNIQUE REFERENCES experiences(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  organization TEXT,
  role TEXT,
  start_date DATE,
  end_date DATE,
  is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
  raw_note TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '',
  task TEXT NOT NULL DEFAULT '',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  result TEXT NOT NULL DEFAULT '',
  learning TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'memo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experience_cards_status_check CHECK (status IN ('memo', 'structured', 'ready', 'archived')),
  CONSTRAINT experience_cards_period_check CHECK (is_ongoing OR start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS experience_cards_user_updated_idx ON experience_cards (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS experience_cards_user_category_idx ON experience_cards (user_id, category);
CREATE INDEX IF NOT EXISTS experience_cards_tags_gin_idx ON experience_cards USING GIN (tags);

INSERT INTO experience_cards (user_id, legacy_experience_id, category, title, raw_note, status, created_at, updated_at)
SELECT user_id, id, experience_type,
  LEFT(REGEXP_REPLACE(content, E'[\\n\\r]+', ' ', 'g'), 60), content, 'memo', created_at, updated_at
FROM experiences WHERE user_id IS NOT NULL
ON CONFLICT (legacy_experience_id) DO NOTHING;
