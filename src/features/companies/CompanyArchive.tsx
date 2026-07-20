import { FormEvent, useEffect, useState } from 'react';
import { deleteCompany, listCompanies, organizeCompany, saveCompany } from './api';
import type { Company } from './types';

const empty = (): Company => ({ id: 0, name: '', raw_note: '', summary: '', created_at: '', updated_at: '' });

export function CompanyArchive({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<Company[]>([]);
  const [detail, setDetail] = useState<Company | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems((await listCompanies()).items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '기업정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [enabled]);

  const visible = items.filter((item) => `${item.name} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));

  function open(company: Company) {
    setDetail(company);
    setMessage('');
  }

  function update(key: keyof Company, value: string) {
    if (detail) setDetail({ ...detail, [key]: value });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      const saved = await saveCompany({ id: detail.id || undefined, name: detail.name, raw_note: detail.raw_note });
      setDetail(saved);
      setMessage('저장되었습니다.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!detail?.id) return;
    if (!window.confirm('이 기업정보를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setDeleting(true);
    try {
      await deleteCompany(detail.id);
      setDetail(null);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '삭제하지 못했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  async function organize() {
    if (!detail?.id) return;
    setOrganizing(true);
    setMessage('');
    try {
      const result = await organizeCompany(detail.id);
      setDetail({ ...detail, summary: result.summary });
      setMessage('AI가 기업 정보를 정리했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '기업 정보를 정리하지 못했습니다.');
    } finally {
      setOrganizing(false);
    }
  }

  if (detail) {
    return (
      <section className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setDetail(null)} className="mb-5 text-sm text-neutral-500">← 기업정보 목록</button>
        <form onSubmit={save} className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{detail.id ? '기업정보 수정' : '새 기업'}</h1>
              <p className="mt-2 text-sm text-neutral-500">기업 자료를 줄글로 적어두면, 자소서 작성 시 이 기업을 선택해 재사용할 수 있습니다.</p>
            </div>
            <div className="flex gap-2">
              {detail.id ? (
                <button type="button" onClick={() => void remove()} disabled={deleting} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              ) : null}
              <button disabled={saving || !enabled} className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white disabled:bg-neutral-300">
                {saving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
          {message ? <p className="mt-4 text-sm text-neutral-600">{message}</p> : null}
          <div className="mt-8 space-y-5">
            <label className="block text-sm font-medium">기업명
              <input required value={detail.name} onChange={(e) => update('name', e.target.value)} placeholder="예: 삼일회계법인" className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-medium">기업 자료 (인재상·정책·신년사 등, 줄글)
              <textarea value={detail.raw_note} onChange={(e) => update('raw_note', e.target.value)} placeholder="조사한 기업 정보를 자유롭게 적어주세요." className="mt-2 min-h-48 w-full rounded-md border border-neutral-200 px-3 py-3 font-normal leading-7" />
            </label>
          </div>
          {detail.id ? (
            <div className="mt-8 border-t border-neutral-100 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">정리된 요약</h2>
                  <p className="mt-1 text-sm text-neutral-500">AI가 위 자료를 근거로만 일목요연하게 정리합니다. 자소서 AI 초안에 이 요약이 활용됩니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void organize()}
                  disabled={organizing || !detail.raw_note.trim()}
                  className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800 disabled:opacity-50"
                >
                  {organizing ? '정리하는 중...' : 'AI 정리'}
                </button>
              </div>
              <textarea
                value={detail.summary}
                onChange={(e) => update('summary', e.target.value)}
                placeholder="AI 정리를 누르면 여기에 정리된 요약이 채워집니다. 직접 다듬어도 됩니다."
                className="mt-4 min-h-40 w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm leading-7 outline-none transition focus:border-neutral-400"
              />
            </div>
          ) : null}
        </form>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">기업정보</h1>
          <p className="mt-2 text-sm text-neutral-500">지원할 기업을 조사해두고, 자소서 작성 시 선택해서 재사용하세요.</p>
        </div>
        <button type="button" disabled={!enabled} onClick={() => { setDetail(empty()); setMessage(''); }} className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300">+ 기업 추가</button>
      </div>
      <div className="mt-8 flex items-center gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="기업 검색" className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none" />
        <span className="shrink-0 text-xs text-neutral-400">{visible.length}개</span>
      </div>
      {message ? <p className="mt-4 text-sm text-neutral-600">{message}</p> : null}
      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-neutral-500">불러오는 중...</p>
        ) : visible.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => open(item)}
                className="group flex h-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-[15px] font-medium text-neutral-900">{item.name || '이름 없음'}</h2>
                  <span className={`shrink-0 text-xs ${item.summary ? 'text-emerald-600' : 'text-neutral-400'}`}>{item.summary ? '정리됨' : '미정리'}</span>
                </div>
                <p className="line-clamp-2 text-sm leading-5 text-neutral-500">{item.summary || item.raw_note || '아직 작성한 내용이 없습니다.'}</p>
                <div className="mt-auto flex items-center justify-end border-t border-neutral-100 pt-2 text-[11px] text-neutral-400">
                  <time>{new Date(item.updated_at).toLocaleDateString('ko-KR')}</time>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            {enabled ? '아직 등록한 기업이 없습니다. 지원할 기업을 추가해보세요.' : '로그인 후 기업정보를 기록할 수 있습니다.'}
          </div>
        )}
      </div>
    </section>
  );
}
