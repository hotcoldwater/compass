CREATE TABLE IF NOT EXISTS experience_story_angles (
  id SERIAL PRIMARY KEY, experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE,
  angle_type TEXT NOT NULL, title TEXT NOT NULL, core_message TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '', challenge TEXT NOT NULL DEFAULT '', action TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT '', learning TEXT NOT NULL DEFAULT '',
  competency_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], metric_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[], suitable_question_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source TEXT NOT NULL DEFAULT 'manual', is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experience_story_angles_source_check CHECK (source IN ('manual','ai_suggested','ai_confirmed'))
);
CREATE INDEX IF NOT EXISTS experience_story_angles_card_idx ON experience_story_angles (experience_card_id, updated_at DESC);
