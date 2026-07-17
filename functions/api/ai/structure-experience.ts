import { getAuthenticatedUser, type AuthEnv } from '../../_lib/auth';
import { ensureExperienceCardTables, getCard, cardJson } from '../../_lib/experience-cards';
import { suggestExperienceStructure } from '../../_lib/ai/structure-experience';

type AiEnv = AuthEnv & { AI_API_KEY?: string; AI_MODEL?: string; AI_PROVIDER?: string };
export const onRequestPost: PagesFunction<AiEnv> = async ({ request, env }) => {
  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return cardJson({ ok: false, error: '로그인이 필요합니다.' }, 401);
    const id = Number((await request.json() as { experienceCardId?: unknown }).experienceCardId);
    if (!Number.isInteger(id) || id <= 0) return cardJson({ ok: false, error: '저장된 경험카드에서만 AI 제안을 사용할 수 있습니다.' }, 400);
    await ensureExperienceCardTables(env); const detail = await getCard(env, user, id);
    if (!detail) return cardJson({ ok: false, error: '경험카드를 찾을 수 없습니다.' }, 404);
    if (!detail.card.raw_note.trim()) return cardJson({ ok: false, error: 'AI 제안을 받으려면 먼저 최초 메모를 작성해주세요.' }, 400);
    const data = await suggestExperienceStructure(env, { rawNote: detail.card.raw_note, category: detail.card.category, organization: detail.card.organization || '', existingFacts: { title: detail.card.title, situation: detail.card.situation, task: detail.card.task, result: detail.card.result, learning: detail.card.learning } });
    return cardJson({ ok: true, data });
  } catch (error) { return cardJson({ ok: false, error: error instanceof Error ? error.message : 'AI 제안을 생성하지 못했습니다.' }, 500); }
};
