import type { ResumeLimitType } from '../../types';

export const LIMIT_OPTIONS: Array<{ value: ResumeLimitType; label: string }> = [
  { value: 'chars', label: '글자수' },
  { value: 'bytes', label: 'byte' },
  { value: 'none', label: '제한없음' },
];
