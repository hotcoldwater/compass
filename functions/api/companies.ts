import { getAuthenticatedUser, type AuthEnv } from '../_lib/auth';
import { companyJson, ensureCompanyTables, listCompanies, saveCompany } from '../_lib/companies';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => { try {
  const user = await getAuthenticatedUser(request, env); if (!user) return companyJson({ ok: false, error: '로그인이 필요합니다.' }, 401);
  await ensureCompanyTables(env); const items = await listCompanies(env, user);
  return companyJson({ ok: true, data: { items } });
} catch { return companyJson({ ok: false, error: '기업정보를 불러오지 못했습니다.' }, 500); } };

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => { try {
  const user = await getAuthenticatedUser(request, env); if (!user) return companyJson({ ok: false, error: '로그인이 필요합니다.' }, 401);
  await ensureCompanyTables(env); const data = await saveCompany(env, user, await request.json() as Record<string, unknown>);
  return companyJson({ ok: true, data }, 201);
} catch (error) { return companyJson({ ok: false, error: error instanceof Error ? error.message : '기업정보 저장에 실패했습니다.' }, 400); } };
