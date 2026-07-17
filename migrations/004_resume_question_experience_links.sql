CREATE TABLE IF NOT EXISTS resume_question_experience_links (
  id SERIAL PRIMARY KEY,
  resume_question_id INTEGER NOT NULL REFERENCES resume_questions(id) ON DELETE CASCADE,
  experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE,
  story_angle_id INTEGER REFERENCES experience_story_angles(id) ON DELETE SET NULL,
  link_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resume_question_id, experience_card_id, story_angle_id)
);
CREATE INDEX IF NOT EXISTS resume_question_experience_links_question_idx
  ON resume_question_experience_links (resume_question_id, link_order, id);
