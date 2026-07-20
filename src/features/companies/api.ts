import type { Company } from './types';

async function read<T>(response: Response) {
  const body = (await response.json()) as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !body.ok || !body.data) throw new Error(body.error || '요청을 처리하지 못했습니다.');
  return body.data;
}

export async function listCompanies() {
  return read<{ items: Company[] }>(await fetch('/api/companies'));
}

export async function saveCompany(input: { id?: number; name: string; raw_note: string }) {
  const id = input.id;
  return read<Company>(
    await fetch(id ? `/api/companies/${id}` : '/api/companies', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
}

export async function deleteCompany(id: number) {
  const response = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
  const body = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !body.ok) throw new Error(body.error || '기업정보를 삭제하지 못했습니다.');
}

export async function organizeCompany(companyId: number) {
  return read<{ summary: string }>(
    await fetch('/api/ai/organize-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
  );
}
