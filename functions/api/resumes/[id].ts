import type { ResumePayload } from '../../_lib/resumes';
import {
  ensureResumeTables,
  jsonResponse,
  updateResumeRecord,
} from '../../_lib/resumes';

type Env = {
  DATABASE_URL: string;
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    await ensureResumeTables(context.env);

    const id = Number(context.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return jsonResponse(
        {
          ok: false,
          error: '잘못된 자소서 ID입니다.',
        },
        400
      );
    }

    const body = (await context.request.json()) as Partial<ResumePayload>;
    const resume = await updateResumeRecord(context.env, id, body);

    if (!resume) {
      return jsonResponse(
        {
          ok: false,
          error: '자소서를 찾을 수 없습니다.',
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      resume,
    });
  } catch (error) {
    console.error('Failed to update resume:', error);

    return jsonResponse(
      {
        ok: false,
        error: '자소서 저장 중 문제가 발생했습니다.',
      },
      500
    );
  }
};
