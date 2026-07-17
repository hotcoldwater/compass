import { neon } from '@neondatabase/serverless';
import { getAuthenticatedUser, type AuthEnv } from '../_lib/auth';

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function ensureTable(databaseUrl: string) {
  const sql = neon(databaseUrl);
  await sql`CREATE TABLE IF NOT EXISTS resume_question_experience_links (id SERIAL PRIMARY KEY, resume_question_id INTEGER NOT NULL REFERENCES resume_questions(id) ON DELETE CASCADE, experience_card_id INTEGER NOT NULL REFERENCES experience_cards(id) ON DELETE CASCADE, story_angle_id INTEGER REFERENCES experience_story_angles(id) ON DELETE SET NULL, link_order INTEGER NOT NULL DEFAULT 0, is_primary BOOLEAN NOT NULL DEFAULT FALSE, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (resume_question_id, experience_card_id, story_angle_id))`;
}

async function ownedQuestion(sql: any, questionId: number, userId: number) {
  const rows = await sql`SELECT q.id FROM resume_questions q INNER JOIN resumes r ON r.id = q.resume_id WHERE q.id = ${questionId} AND r.user_id = ${userId} LIMIT 1`;
  return rows.length > 0;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  try {
    const user = await getAuthenticatedUser(request, env);
    const questionId = Number(new URL(request.url).searchParams.get('questionId'));
    if (!user) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
    if (!Number.isInteger(questionId)) return json({ ok: false, error: '잘못된 문항 ID입니다.' }, 400);
    await ensureTable(env.DATABASE_URL); const sql = neon(env.DATABASE_URL);
    if (!(await ownedQuestion(sql, questionId, user.id))) return json({ ok: false, error: '문항을 찾을 수 없습니다.' }, 404);
    const links = await sql`SELECT l.id, l.experience_card_id, l.story_angle_id, l.link_order, l.is_primary, l.note, c.title AS experience_title, c.category, c.summary, c.situation, c.task, c.actions, c.result, s.title AS story_title, s.core_message, COALESCE((SELECT json_agg(metric_row) FROM (SELECT display_text, verification_status FROM experience_metrics m WHERE m.experience_card_id = c.id ORDER BY sort_order, id LIMIT 3) metric_row), '[]'::json) AS metrics FROM resume_question_experience_links l INNER JOIN experience_cards c ON c.id = l.experience_card_id LEFT JOIN experience_story_angles s ON s.id = l.story_angle_id WHERE l.resume_question_id = ${questionId} AND c.user_id = ${user.id} ORDER BY l.is_primary DESC, l.link_order, l.id`;
    return json({ ok: true, data: links });
  } catch { return json({ ok: false, error: '연결 경험을 불러오지 못했습니다.' }, 500); }
};

export const onRequestPut: PagesFunction<AuthEnv> = async ({ request, env }) => {
  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
    const body = await request.json() as { questionId?: unknown; links?: unknown };
    const questionId = Number(body.questionId); const links = Array.isArray(body.links) ? body.links : [];
    if (!Number.isInteger(questionId)) return json({ ok: false, error: '잘못된 문항 ID입니다.' }, 400);
    if (links.length > 3) return json({ ok: false, error: '문항에는 최대 3개의 경험만 연결할 수 있습니다.' }, 400);
    if (links.filter((item) => Boolean((item as { is_primary?: boolean }).is_primary)).length > 1) return json({ ok: false, error: '핵심 경험은 하나만 선택할 수 있습니다.' }, 400);
    await ensureTable(env.DATABASE_URL); const sql = neon(env.DATABASE_URL);
    if (!(await ownedQuestion(sql, questionId, user.id))) return json({ ok: false, error: '문항을 찾을 수 없습니다.' }, 404);
    for (const item of links) { const cardId = Number((item as { experience_card_id?: unknown }).experience_card_id); const storyId = Number((item as { story_angle_id?: unknown }).story_angle_id) || null; const cards = await sql`SELECT id FROM experience_cards WHERE id = ${cardId} AND user_id = ${user.id} LIMIT 1`; if (!cards.length) return json({ ok: false, error: '선택한 경험카드를 찾을 수 없습니다.' }, 400); if (storyId) { const stories = await sql`SELECT id FROM experience_story_angles WHERE id = ${storyId} AND experience_card_id = ${cardId} LIMIT 1`; if (!stories.length) return json({ ok: false, error: '선택한 스토리 각도가 경험카드와 일치하지 않습니다.' }, 400); } }
    await sql`DELETE FROM resume_question_experience_links WHERE resume_question_id = ${questionId}`;
    for (const [index, item] of links.entries()) { const link = item as { experience_card_id: unknown; story_angle_id?: unknown; is_primary?: unknown; note?: unknown }; await sql`INSERT INTO resume_question_experience_links (resume_question_id,experience_card_id,story_angle_id,link_order,is_primary,note) VALUES (${questionId},${Number(link.experience_card_id)},${Number(link.story_angle_id) || null},${index},${Boolean(link.is_primary)},${String(link.note || '').trim()})`; }
    return onRequestGet({ request: new Request(`${new URL(request.url).origin}/api/resume-question-experience-links?questionId=${questionId}`, { headers: request.headers }), env } as Parameters<typeof onRequestGet>[0]);
  } catch { return json({ ok: false, error: '경험 연결을 저장하지 못했습니다.' }, 500); }
};
