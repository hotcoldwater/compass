import { neon } from '@neondatabase/serverless';
import { getAuthenticatedUser, type AuthEnv } from '../../_lib/auth';
import { companyJson, ensureCompanyTables } from '../../_lib/companies';
import { organizeCompanyInfo } from '../../_lib/ai/organize-company';

type AiEnv = AuthEnv & { AI_API_KEY?: string; AI_MODEL?: string; AI_PROVIDER?: string };

export const onRequestPost: PagesFunction<AiEnv> = async ({ request, env }) => {
  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return companyJson({ ok: false, error: '로그인이 필요합니다.' }, 401);

    const body = (await request.json()) as { companyId?: unknown };
    const companyId = Number(body.companyId);
    if (!Number.isInteger(companyId)) return companyJson({ ok: false, error: '먼저 기업을 저장한 뒤 AI 정리를 사용할 수 있습니다.' }, 400);

    await ensureCompanyTables(env);
    const sql = neon(env.DATABASE_URL);
    const companies = await sql`SELECT name, raw_note FROM companies WHERE id=${companyId} AND user_id=${user.id} LIMIT 1`;
    if (!companies.length) return companyJson({ ok: false, error: '기업정보를 찾을 수 없습니다.' }, 404);
    const { name, raw_note: rawNote } = companies[0] as { name: string; raw_note: string };
    if (!rawNote.trim()) return companyJson({ ok: false, error: '정리할 원문 내용이 없습니다.' }, 400);

    const organized = await organizeCompanyInfo(env, { name, rawNote });
    if (!organized.summary) return companyJson({ ok: false, error: 'AI가 기업 정보를 정리하지 못했습니다.' }, 500);

    await sql`UPDATE companies SET summary=${organized.summary}, updated_at=NOW() WHERE id=${companyId} AND user_id=${user.id}`;

    return companyJson({ ok: true, data: { summary: organized.summary } });
  } catch (error) {
    return companyJson({ ok: false, error: error instanceof Error ? error.message : '기업 정보를 정리하지 못했습니다.' }, 500);
  }
};
