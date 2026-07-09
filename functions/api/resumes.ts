import type { ResumePayload } from '../_lib/resumes';
import {
  createResumeRecord,
  ensureResumeTables,
  jsonResponse,
  loadResumeRecords,
} from '../_lib/resumes';

type Env = {
  DATABASE_URL: string;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await ensureResumeTables(context.env);
    const resumes = await loadResumeRecords(context.env);

    return jsonResponse({
      ok: true,
      resumes,
    });
  } catch (error) {
    console.error('Failed to load resumes:', error);

    return jsonResponse(
      {
        ok: false,
        error: '최근 기록을 불러오지 못했습니다.',
      },
      500
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await ensureResumeTables(context.env);
    const body = (await context.request.json()) as Partial<ResumePayload>;
    const resume = await createResumeRecord(context.env, body);

    return jsonResponse({
      ok: true,
      resume,
    });
  } catch (error) {
    console.error('Failed to create resume:', error);

    return jsonResponse(
      {
        ok: false,
        error: '자소서 저장 중 문제가 발생했습니다.',
      },
      500
    );
  }
};
