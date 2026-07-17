import { neon } from '@neondatabase/serverless';
import type { AuthenticatedUser, AuthEnv } from './auth';

type CardInput = Record<string, unknown>;
const statuses = ['memo', 'structured', 'ready', 'archived'];

export function cardJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function ensureExperienceCardTables(env: AuthEnv) {
  const sql = neon(env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS experience_cards (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, legacy_experience_id INTEGER UNIQUE REFERENCES experiences(id) ON DELETE SET NULL, category TEXT NOT NULL, title TEXT NOT NULL, organization TEXT, role TEXT, start_date DATE, end_date DATE, is_ongoing BOOLEAN NOT NULL DEFAULT FALSE, raw_note TEXT NOT NULL DEFAULT '', situation TEXT NOT NULL DEFAULT '', task TEXT NOT NULL DEFAULT '', actions JSONB NOT NULL DEFAULT '[]'::jsonb, result TEXT NOT NULL DEFAULT '', learning TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], status TEXT NOT NULL DEFAULT 'memo', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS experience_metrics (id SERIAL PRIMARY KEY, experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE, label TEXT NOT NULL, metric_type TEXT NOT NULL DEFAULT 'other', before_value NUMERIC, after_value NUMERIC, absolute_value NUMERIC, unit TEXT, display_text TEXT NOT NULL, calculation_note TEXT, evidence_note TEXT, verification_status TEXT NOT NULL DEFAULT 'needs_verification', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS experience_competencies (id SERIAL PRIMARY KEY, experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE, competency_name TEXT NOT NULL, strength_score INTEGER, evidence TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS experience_competencies_unique_idx ON experience_competencies (experience_card_id, competency_name)`;
  await sql`CREATE TABLE IF NOT EXISTS experience_story_angles (id SERIAL PRIMARY KEY, experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE, angle_type TEXT NOT NULL, title TEXT NOT NULL, core_message TEXT NOT NULL DEFAULT '', situation TEXT NOT NULL DEFAULT '', challenge TEXT NOT NULL DEFAULT '', action TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT '', learning TEXT NOT NULL DEFAULT '', competency_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], metric_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[], suitable_question_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], source TEXT NOT NULL DEFAULT 'manual', is_primary BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`INSERT INTO experience_cards (user_id, legacy_experience_id, category, title, raw_note, status, created_at, updated_at) SELECT user_id, id, experience_type, LEFT(REGEXP_REPLACE(content, E'[\n\r]+', ' ', 'g'), 60), content, 'memo', created_at, updated_at FROM experiences WHERE user_id IS NOT NULL ON CONFLICT (legacy_experience_id) DO NOTHING`;
}

const text = (value: unknown) => String(value || '').trim();
const textArray = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
const actions = (value: unknown) => Array.isArray(value) ? value.map((item, index) => ({ id: text((item as Record<string, unknown>).id) || `${index}`, text: text((item as Record<string, unknown>).text), sort_order: index })).filter((item) => item.text) : [];
const numberOrNull = (value: unknown) => value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);

function normalize(body: CardInput) {
  const ongoing = Boolean(body.is_ongoing);
  const start = text(body.start_date) || null;
  const end = ongoing ? null : text(body.end_date) || null;
  return { category: text(body.category), title: text(body.title), organization: text(body.organization) || null, role: text(body.role) || null, start_date: start, end_date: end, is_ongoing: ongoing, raw_note: text(body.raw_note), situation: text(body.situation), task: text(body.task), actions: actions(body.actions), result: text(body.result), learning: text(body.learning), summary: text(body.summary), tags: textArray(body.tags), status: statuses.includes(text(body.status)) ? text(body.status) : 'memo' };
}

export async function getCard(env: AuthEnv, user: AuthenticatedUser, id: number) {
  const sql = neon(env.DATABASE_URL);
  const cards = await sql`SELECT id, category, title, organization, role, start_date::text AS start_date, end_date::text AS end_date, is_ongoing, raw_note, situation, task, actions, result, learning, summary, tags, status, created_at::text AS created_at, updated_at::text AS updated_at FROM experience_cards WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`;
  if (!cards.length) return null;
  const [metrics, competencies, storyAngles] = await Promise.all([
    sql`SELECT id, label, metric_type, before_value, after_value, absolute_value, unit, display_text, calculation_note, evidence_note, verification_status, sort_order FROM experience_metrics WHERE experience_card_id = ${id} ORDER BY sort_order, id`,
    sql`SELECT id, competency_name, strength_score, evidence FROM experience_competencies WHERE experience_card_id = ${id} ORDER BY id`,
    sql`SELECT id, angle_type, title, core_message, situation, challenge, action, result, learning, competency_names, metric_ids, suitable_question_types, is_primary FROM experience_story_angles WHERE experience_card_id = ${id} ORDER BY is_primary DESC, updated_at DESC`,
  ]);
  return { card: cards[0], metrics, competencies, storyAngles, usageHistory: [] };
}

export async function saveCard(env: AuthEnv, user: AuthenticatedUser, body: CardInput, id?: number) {
  const sql = neon(env.DATABASE_URL); const card = normalize(body);
  if (!card.category || !card.title) throw new Error('카테고리와 경험 제목을 입력해주세요.');
  if (card.start_date && card.end_date && card.start_date > card.end_date) throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
  let cardId = id;
  if (id) {
    const updated = await sql`UPDATE experience_cards SET category=${card.category}, title=${card.title}, organization=${card.organization}, role=${card.role}, start_date=${card.start_date}, end_date=${card.end_date}, is_ongoing=${card.is_ongoing}, raw_note=${card.raw_note}, situation=${card.situation}, task=${card.task}, actions=${JSON.stringify(card.actions)}::jsonb, result=${card.result}, learning=${card.learning}, summary=${card.summary}, tags=${card.tags}, status=${card.status}, updated_at=NOW() WHERE id=${id} AND user_id=${user.id} RETURNING id`;
    if (!updated.length) return null;
  } else {
    const inserted = await sql`INSERT INTO experience_cards (user_id, category, title, organization, role, start_date, end_date, is_ongoing, raw_note, situation, task, actions, result, learning, summary, tags, status) VALUES (${user.id}, ${card.category}, ${card.title}, ${card.organization}, ${card.role}, ${card.start_date}, ${card.end_date}, ${card.is_ongoing}, ${card.raw_note}, ${card.situation}, ${card.task}, ${JSON.stringify(card.actions)}::jsonb, ${card.result}, ${card.learning}, ${card.summary}, ${card.tags}, ${card.status}) RETURNING id`;
    cardId = Number(inserted[0].id);
  }
  await sql`DELETE FROM experience_metrics WHERE experience_card_id = ${cardId}`;
  await sql`DELETE FROM experience_competencies WHERE experience_card_id = ${cardId}`;
  await sql`DELETE FROM experience_story_angles WHERE experience_card_id = ${cardId}`;
  for (const [index, item] of (Array.isArray(body.metrics) ? body.metrics : []).entries()) { const row = item as Record<string, unknown>; const label = text(row.label); if (label) await sql`INSERT INTO experience_metrics (experience_card_id,label,metric_type,before_value,after_value,absolute_value,unit,display_text,calculation_note,evidence_note,verification_status,sort_order) VALUES (${cardId},${label},${text(row.metric_type)||'other'},${numberOrNull(row.before_value)},${numberOrNull(row.after_value)},${numberOrNull(row.absolute_value)},${text(row.unit)||null},${text(row.display_text)||label},${text(row.calculation_note)||null},${text(row.evidence_note)||null},${['confirmed','estimated','needs_verification'].includes(text(row.verification_status)) ? text(row.verification_status) : 'needs_verification'},${index})`; }
  for (const item of Array.isArray(body.competencies) ? body.competencies : []) { const row = item as Record<string, unknown>; const name = text(row.competency_name); if (name) await sql`INSERT INTO experience_competencies (experience_card_id,competency_name,strength_score,evidence) VALUES (${cardId},${name},${numberOrNull(row.strength_score)},${text(row.evidence)})`; }
  for (const item of Array.isArray(body.storyAngles) ? body.storyAngles : []) { const row = item as Record<string, unknown>; const title = text(row.title); if (title) await sql`INSERT INTO experience_story_angles (experience_card_id,angle_type,title,core_message,situation,challenge,action,result,learning,competency_names,suitable_question_types,is_primary) VALUES (${cardId},${text(row.angle_type)||'문제 해결'},${title},${text(row.core_message)},${text(row.situation)},${text(row.challenge)},${text(row.action)},${text(row.result)},${text(row.learning)},${textArray(row.competency_names)},${textArray(row.suitable_question_types)},${Boolean(row.is_primary)})`; }
  return getCard(env, user, cardId as number);
}
