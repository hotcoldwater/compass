import { neon } from '@neondatabase/serverless';
import type { AuthenticatedUser, AuthEnv } from './auth';

type CompanyInput = Record<string, unknown>;

export function companyJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function ensureCompanyTables(env: Pick<AuthEnv, 'DATABASE_URL'>) {
  const sql = neon(env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, raw_note TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE INDEX IF NOT EXISTS companies_user_updated_idx ON companies (user_id, updated_at DESC)`;
}

const text = (value: unknown) => String(value || '').trim();

function normalize(body: CompanyInput) {
  return { name: text(body.name), raw_note: text(body.raw_note) };
}

export async function listCompanies(env: AuthEnv, user: AuthenticatedUser) {
  const sql = neon(env.DATABASE_URL);
  return sql`SELECT id, name, raw_note, summary, created_at::text AS created_at, updated_at::text AS updated_at FROM companies WHERE user_id = ${user.id} ORDER BY updated_at DESC, id DESC`;
}

export async function getCompany(env: AuthEnv, user: AuthenticatedUser, id: number) {
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT id, name, raw_note, summary, created_at::text AS created_at, updated_at::text AS updated_at FROM companies WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`;
  return rows[0] || null;
}

export async function saveCompany(env: AuthEnv, user: AuthenticatedUser, body: CompanyInput, id?: number) {
  const sql = neon(env.DATABASE_URL);
  const company = normalize(body);
  if (!company.name) throw new Error('기업명을 입력해주세요.');
  if (id) {
    const updated = await sql`UPDATE companies SET name=${company.name}, raw_note=${company.raw_note}, updated_at=NOW() WHERE id=${id} AND user_id=${user.id} RETURNING id`;
    if (!updated.length) return null;
    return getCompany(env, user, id);
  }
  const inserted = await sql`INSERT INTO companies (user_id, name, raw_note) VALUES (${user.id}, ${company.name}, ${company.raw_note}) RETURNING id`;
  return getCompany(env, user, Number(inserted[0].id));
}

export async function deleteCompany(env: AuthEnv, user: AuthenticatedUser, id: number) {
  const sql = neon(env.DATABASE_URL);
  const deleted = await sql`DELETE FROM companies WHERE id = ${id} AND user_id = ${user.id} RETURNING id`;
  return deleted.length > 0;
}

export async function findOrCreateCompanyByName(
  env: Pick<AuthEnv, 'DATABASE_URL'>,
  user: AuthenticatedUser,
  name: string
): Promise<number | null> {
  const trimmed = text(name);
  if (!trimmed) return null;
  const sql = neon(env.DATABASE_URL);
  const existing = await sql`SELECT id FROM companies WHERE user_id=${user.id} AND name=${trimmed} LIMIT 1`;
  if (existing.length) return Number(existing[0].id);
  const inserted = await sql`INSERT INTO companies (user_id, name) VALUES (${user.id}, ${trimmed}) RETURNING id`;
  return Number(inserted[0].id);
}
