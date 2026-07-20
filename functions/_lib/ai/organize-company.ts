import type { AuthEnv } from '../auth';

type AiEnv = AuthEnv & { AI_API_KEY?: string; AI_MODEL?: string; AI_PROVIDER?: string };
export type OrganizedCompanyInfo = { summary: string };

function assertConfigured(env: AiEnv) {
  if (!env.AI_API_KEY || !env.AI_MODEL) throw new Error('AI 기능을 사용하려면 AI_API_KEY와 AI_MODEL 환경변수를 설정해주세요.');
  if (env.AI_PROVIDER && env.AI_PROVIDER !== 'openai-compatible') throw new Error('현재는 AI_PROVIDER=openai-compatible만 지원합니다.');
}

async function callChat(env: AiEnv, system: string, userContent: Record<string, unknown>, errorLabel: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userContent) },
      ],
    }),
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const providerMessage = errorBody?.error?.message || '제공자 응답을 읽지 못했습니다.';
    throw new Error(`${errorLabel} (${response.status}): ${providerMessage}`);
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있습니다.');
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('AI 응답 형식을 읽지 못했습니다.');
  }
}

export async function organizeCompanyInfo(env: AiEnv, input: { name: string; rawNote: string }): Promise<OrganizedCompanyInfo> {
  assertConfigured(env);
  const parsed = await callChat(
    env,
    'You organize raw Korean research notes a job-seeker collected about a company they are applying to, into a clean, well-structured Korean summary for later reuse in job-application answers. Use ONLY facts present in rawNote — never invent details (values, programs, financial figures, news, hiring policy) that are not stated there. If rawNote is sparse, keep the summary short and reflect only what is there rather than padding it with generic statements. When multiple distinct topics are present, organize them under short Korean labels (e.g. 인재상/핵심가치, 최근 이슈, 채용·직무 관련 언급, 기타) each on its own line or short paragraph, omitting any label with no supporting content. Return JSON only with a single field summary containing the organized Korean text.',
    { name: input.name, rawNote: input.rawNote, outputShape: { summary: 'string' } },
    'AI가 기업 정보를 정리하지 못했습니다'
  );
  return { summary: String(parsed.summary || '').trim() };
}
