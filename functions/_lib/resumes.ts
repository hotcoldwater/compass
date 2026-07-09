import { neon } from '@neondatabase/serverless';

type Env = {
  DATABASE_URL: string;
};

export type ResumeQuestionRow = {
  id: number;
  sort_order: number;
  question_text: string;
  limit_type: 'chars' | 'bytes' | 'none';
  limit_value: number | null;
  answer_content: string;
};

export type ResumeRow = {
  id: number;
  company_name: string | null;
  application_start_date: string | null;
  application_end_date: string | null;
  job_field: string | null;
  created_at: string;
  updated_at: string;
};

export type ResumeRecord = ResumeRow & {
  questions: ResumeQuestionRow[];
};

export type ResumePayloadQuestion = {
  id?: number;
  question_text?: string;
  limit_type?: 'chars' | 'bytes' | 'none';
  limit_value?: number | null;
  answer_content?: string;
};

export type ResumePayload = {
  company_name?: string;
  application_start_date?: string;
  application_end_date?: string;
  job_field?: string;
  questions?: ResumePayloadQuestion[];
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function ensureResumeTables(env: Env) {
  const sql = neon(env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS resumes (
      id SERIAL PRIMARY KEY,
      company_name TEXT,
      application_start_date DATE,
      application_end_date DATE,
      job_field TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS resume_questions (
      id SERIAL PRIMARY KEY,
      resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      question_text TEXT NOT NULL DEFAULT '',
      limit_type TEXT NOT NULL DEFAULT 'none',
      limit_value INTEGER,
      answer_content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT resume_questions_limit_type_check
        CHECK (limit_type IN ('chars', 'bytes', 'none'))
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_resume_questions_resume_id
    ON resume_questions (resume_id, sort_order, id)
  `;
}

function normalizeDate(value: string | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeNullableText(value: string | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeQuestion(question: ResumePayloadQuestion, index: number) {
  const rawLimitType = question.limit_type;
  const limitType =
    rawLimitType === 'chars' || rawLimitType === 'bytes' || rawLimitType === 'none'
      ? rawLimitType
      : 'none';
  const rawLimitValue = question.limit_value;
  const limitValue =
    limitType === 'none'
      ? null
      : typeof rawLimitValue === 'number' &&
          Number.isInteger(rawLimitValue) &&
          rawLimitValue > 0
        ? rawLimitValue
        : null;

  return {
    id: question.id,
    sort_order: index,
    question_text: String(question.question_text || '').trim(),
    limit_type: limitType,
    limit_value: limitValue,
    answer_content: String(question.answer_content || ''),
  };
}

export function normalizeResumePayload(body: Partial<ResumePayload>) {
  return {
    company_name: normalizeNullableText(body.company_name),
    application_start_date: normalizeDate(body.application_start_date),
    application_end_date: normalizeDate(body.application_end_date),
    job_field: normalizeNullableText(body.job_field),
    questions: Array.isArray(body.questions)
      ? body.questions.map(normalizeQuestion)
      : [],
  };
}

export async function loadResumeRecords(env: Env): Promise<ResumeRecord[]> {
  const sql = neon(env.DATABASE_URL);

  const resumes = await sql<ResumeRow[]>`
    SELECT
      id,
      company_name,
      application_start_date::text AS application_start_date,
      application_end_date::text AS application_end_date,
      job_field,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM resumes
    ORDER BY updated_at DESC, id DESC
  `;

  const questions = await sql<ResumeQuestionRow[]>`
    SELECT
      id,
      resume_id,
      sort_order,
      question_text,
      limit_type,
      limit_value,
      answer_content
    FROM resume_questions
    ORDER BY resume_id DESC, sort_order ASC, id ASC
  `;

  const questionMap = new Map<number, ResumeQuestionRow[]>();

  for (const question of questions as Array<ResumeQuestionRow & { resume_id: number }>) {
    const current = questionMap.get(question.resume_id) || [];

    current.push({
      id: question.id,
      sort_order: question.sort_order,
      question_text: question.question_text,
      limit_type: question.limit_type,
      limit_value: question.limit_value,
      answer_content: question.answer_content,
    });
    questionMap.set(question.resume_id, current);
  }

  return resumes.map((resume) => ({
    ...resume,
    questions: questionMap.get(resume.id) || [],
  }));
}

export async function createResumeRecord(
  env: Env,
  body: Partial<ResumePayload>
): Promise<ResumeRecord> {
  const sql = neon(env.DATABASE_URL);
  const normalized = normalizeResumePayload(body);

  const insertedRows = await sql<ResumeRow[]>`
    INSERT INTO resumes (
      company_name,
      application_start_date,
      application_end_date,
      job_field
    )
    VALUES (
      ${normalized.company_name},
      ${normalized.application_start_date},
      ${normalized.application_end_date},
      ${normalized.job_field}
    )
    RETURNING
      id,
      company_name,
      application_start_date::text AS application_start_date,
      application_end_date::text AS application_end_date,
      job_field,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;

  const resume = insertedRows[0];

  if (normalized.questions.length > 0) {
    for (const question of normalized.questions) {
      await sql`
        INSERT INTO resume_questions (
          resume_id,
          sort_order,
          question_text,
          limit_type,
          limit_value,
          answer_content
        )
        VALUES (
          ${resume.id},
          ${question.sort_order},
          ${question.question_text},
          ${question.limit_type},
          ${question.limit_value},
          ${question.answer_content}
        )
      `;
    }
  }

  const records = await loadResumeRecords(env);
  return records.find((item) => item.id === resume.id) as ResumeRecord;
}

export async function updateResumeRecord(
  env: Env,
  id: number,
  body: Partial<ResumePayload>
): Promise<ResumeRecord | null> {
  const sql = neon(env.DATABASE_URL);
  const normalized = normalizeResumePayload(body);

  const existing = await sql<ResumeRow[]>`
    SELECT
      id,
      company_name,
      application_start_date::text AS application_start_date,
      application_end_date::text AS application_end_date,
      job_field,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM resumes
    WHERE id = ${id}
    LIMIT 1
  `;

  if (existing.length === 0) {
    return null;
  }

  await sql`
    UPDATE resumes
    SET
      company_name = ${normalized.company_name},
      application_start_date = ${normalized.application_start_date},
      application_end_date = ${normalized.application_end_date},
      job_field = ${normalized.job_field},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  await sql`
    DELETE FROM resume_questions
    WHERE resume_id = ${id}
  `;

  for (const question of normalized.questions) {
    await sql`
      INSERT INTO resume_questions (
        resume_id,
        sort_order,
        question_text,
        limit_type,
        limit_value,
        answer_content
      )
      VALUES (
        ${id},
        ${question.sort_order},
        ${question.question_text},
        ${question.limit_type},
        ${question.limit_value},
        ${question.answer_content}
      )
    `;
  }

  await sql`
    UPDATE resumes
    SET updated_at = NOW()
    WHERE id = ${id}
  `;

  const records = await loadResumeRecords(env);
  return records.find((item) => item.id === id) || null;
}
