CREATE TABLE IF NOT EXISTS experience_metrics (
  id SERIAL PRIMARY KEY,
  experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE,
  label TEXT NOT NULL, metric_type TEXT NOT NULL DEFAULT 'other',
  before_value NUMERIC, after_value NUMERIC, absolute_value NUMERIC, unit TEXT,
  display_text TEXT NOT NULL, calculation_note TEXT, evidence_note TEXT,
  verification_status TEXT NOT NULL DEFAULT 'needs_verification', sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experience_metrics_type_check CHECK (metric_type IN ('count','rate','amount','duration','score','rank','quality','other')),
  CONSTRAINT experience_metrics_verification_check CHECK (verification_status IN ('confirmed','estimated','needs_verification'))
);
CREATE INDEX IF NOT EXISTS experience_metrics_card_idx ON experience_metrics (experience_card_id, sort_order, id);

CREATE TABLE IF NOT EXISTS experience_competencies (
  id SERIAL PRIMARY KEY, experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE,
  competency_name TEXT NOT NULL, strength_score INTEGER, evidence TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experience_competencies_score_check CHECK (strength_score IS NULL OR strength_score BETWEEN 1 AND 5),
  CONSTRAINT experience_competencies_source_check CHECK (source IN ('manual','ai_suggested','ai_confirmed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS experience_competencies_unique_idx ON experience_competencies (experience_card_id, competency_name);
