import type { AuthEnv } from '../auth';

type AiEnv = AuthEnv & { AI_API_KEY?: string; AI_MODEL?: string; AI_PROVIDER?: string };
export type FlowOption = { title: string; bullets: string[] };

const cleanBullets = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6) : [];

export async function generateFlowOptions(env: AiEnv, input: Record<string, unknown>): Promise<FlowOption[]> {
  if (!env.AI_API_KEY || !env.AI_MODEL) throw new Error('AI 기능을 사용하려면 AI_API_KEY와 AI_MODEL 환경변수를 설정해주세요.');
  if (env.AI_PROVIDER && env.AI_PROVIDER !== 'openai-compatible') throw new Error('현재는 AI_PROVIDER=openai-compatible만 지원합니다.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Propose exactly 3 distinct possible flows for a Korean job-application answer. Return JSON only. Output bullet-point outlines ONLY — never write full prose, complete sentences of the actual answer, or anything the user would submit as-is. Base every option strictly on materialText (the user\'s existing draft or outline, may be empty), selectedFacts, confirmedMetrics, additionalDetails, and companyInfo when present; never invent facts not present there. The 3 options must differ meaningfully — a different opening hook, a different fact or angle emphasized, or a different way of bridging to the company/role — not just reworded versions of the same structure. Each option has a short Korean title (a few words naming the angle) and 3 to 6 short Korean bullet points describing the flow in order: what the hook idea is, which experience/fact to lead with and why, how it bridges to the company/role, and what the conclusion should emphasize.',
        },
        {
          role: 'user',
          content: JSON.stringify({ ...input, outputShape: { options: [{ title: 'string', bullets: ['string'] }] } }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const providerMessage = errorBody?.error?.message || '제공자 응답을 읽지 못했습니다.';
    throw new Error(`AI 흐름 제안을 생성하지 못했습니다 (${response.status}): ${providerMessage}`);
  }

  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있습니다.');

  try {
    const parsed = JSON.parse(content) as { options?: unknown };
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .map((item) => {
            const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            return { title: String(row.title || '').trim(), bullets: cleanBullets(row.bullets) };
          })
          .filter((option) => option.title && option.bullets.length)
      : [];
    if (!options.length) throw new Error('empty');
    return options.slice(0, 3);
  } catch {
    throw new Error('AI 응답 형식을 읽지 못했습니다.');
  }
}
