import type { CardStatus } from './types';

const CATEGORY_STYLES: Record<string, string> = {
  프로젝트: 'border-blue-100 bg-blue-50 text-blue-700',
  학업: 'border-violet-100 bg-violet-50 text-violet-700',
  동아리: 'border-teal-100 bg-teal-50 text-teal-700',
  대외활동: 'border-amber-100 bg-amber-50 text-amber-800',
  인턴: 'border-rose-100 bg-rose-50 text-rose-700',
  업무: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  기타: 'border-neutral-200 bg-neutral-100 text-neutral-600',
};

const STATUS_META: Record<CardStatus, { label: string; dot: string; text: string }> = {
  memo: { label: '메모', dot: 'bg-neutral-400', text: 'text-neutral-500' },
  structured: { label: '구조화', dot: 'bg-amber-500', text: 'text-neutral-600' },
  ready: { label: '완성', dot: 'bg-emerald-500', text: 'text-neutral-700 font-medium' },
  archived: { label: '보관', dot: 'bg-neutral-300', text: 'text-neutral-400' },
};

export function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES['기타'];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style}`}>
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: CardStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.memo;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
