import type {
  CreateExperienceInput,
  Experience,
  ResumePayload,
  ResumeRecord,
} from '../types';

type ExperienceListResponse = {
  ok: boolean;
  experiences?: Experience[];
  error?: string;
};

type ExperienceCreateResponse = {
  ok: boolean;
  experience?: Experience;
  error?: string;
};

type ResumeListResponse = {
  ok: boolean;
  resumes?: ResumeRecord[];
  error?: string;
};

type ResumeMutationResponse = {
  ok: boolean;
  resume?: ResumeRecord;
  error?: string;
};

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchExperiences(): Promise<Experience[]> {
  const res = await fetch('/api/experiences');
  const data = await readJson<ExperienceListResponse>(res);

  if (!res.ok || !data.ok || !data.experiences) {
    throw new Error(data.error || '경험 목록을 불러오지 못했습니다.');
  }

  return data.experiences;
}

export async function createExperience(
  input: CreateExperienceInput
): Promise<Experience> {
  const res = await fetch('/api/experiences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await readJson<ExperienceCreateResponse>(res);

  if (!res.ok || !data.ok || !data.experience) {
    throw new Error(data.error || '경험 저장에 실패했습니다.');
  }

  return data.experience;
}

export async function fetchResumes(): Promise<ResumeRecord[]> {
  const res = await fetch('/api/resumes');
  const data = await readJson<ResumeListResponse>(res);

  if (!res.ok || !data.ok || !data.resumes) {
    throw new Error(data.error || '최근 기록을 불러오지 못했습니다.');
  }

  return data.resumes;
}

export async function createResume(input: ResumePayload): Promise<ResumeRecord> {
  const res = await fetch('/api/resumes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await readJson<ResumeMutationResponse>(res);

  if (!res.ok || !data.ok || !data.resume) {
    throw new Error(data.error || '자소서 저장에 실패했습니다.');
  }

  return data.resume;
}

export async function updateResume(
  id: number,
  input: ResumePayload
): Promise<ResumeRecord> {
  const res = await fetch(`/api/resumes/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await readJson<ResumeMutationResponse>(res);

  if (!res.ok || !data.ok || !data.resume) {
    throw new Error(data.error || '자소서 저장에 실패했습니다.');
  }

  return data.resume;
}
