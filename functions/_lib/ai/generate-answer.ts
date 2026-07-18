import type { AuthEnv } from '../auth';

type AiEnv = AuthEnv & { AI_API_KEY?: string; AI_MODEL?: string; AI_PROVIDER?: string };
export type AnswerGeneration = { answer: string; usedFacts: string[]; unsupportedClaims: string[]; warnings: string[] };
const cleanList = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12) : [];

const SYSTEM_PROMPT = [
  'Write a Korean job-application answer, modeled on strong real Big-4-style 자소서 conventions. Return JSON only.',
  'Use ONLY the selected facts, confirmedMetrics, and additionalDetails (follow-up question/answer pairs) supplied by the user. Never invent or change numbers, achievements, company facts, dates, roles, or individual contribution. Do not make team outcomes sound like individual outcomes.',
  'If an outline is supplied, follow its flow and structure rather than inventing a different structure. If companyInfo is supplied, weave in its concrete proper nouns — named programs, tools, values, or initiatives (e.g. a specific AI tool, training system, or value name it mentions) — never vague adjectives like "훌륭한 기업 문화" with nothing specific behind them, and never invent claims about the company beyond what companyInfo states.',
  'If facts are insufficient, write conservatively and add a warning, but still write as fully as the facts allow.',
  'The limit field states the maximum length (limit.type is chars or bytes, limit.value is the number); always write to fill at least 90% of that maximum — never stop at a short paragraph just because the facts are sparse. Reach the target length by adding legitimate depth grounded in the given facts: concrete detail already implied by them, the reasoning or decision-making process, obstacles and how they were handled, and the significance of the result — never by inventing new facts, numbers, or claims. If limit.type is none, still write a thorough, complete answer (roughly 700–1000 Korean characters) rather than a short summary.',
  'If instructions.format is "hashtags", ignore all rules below: output only the requested number of Korean hashtag phrases (e.g. "#소통능력 #실행력 #협업지향"), each a short noun phrase grounded in selectedFacts/confirmedMetrics, separated by single spaces, nothing else.',
  'Otherwise, open every answer with a bracketed line on its own, then a blank line, then the body. The bracketed line can be either a short punchy identity phrase (e.g. "[변화에서 기회를 찾는 회계사]") or a complete first-person claim sentence (e.g. "[저는 활력, 열정 그리고 선도하는 용기를 가진 사람입니다.]") — pick whichever fits the question better, but it must be a genuine insight or claim grounded in the given facts, never a generic label like "[강점]".',
  'If flow is supplied (a chosen title plus bullet points the user already picked from proposed options), it takes priority over the shape rules below: follow its bullets as the structural skeleton in order, writing full prose (never bullets) that realizes each point — do not invent a different structure or ignore any bullet.',
  'Otherwise, decide the body shape from the question itself:',
  '- If the question asks for ONE single narrative (a single motivation, a single value, a single growth direction), write it as one continuous essay in three movements with no internal headings: (1) a hook one level above the personal anecdote — a brief, genuine observation about the field, role, or problem space, then pivot into the specific moment; never open by restating the question; (2) one concrete experience in depth — the situation, what the person specifically did, the reasoning, and a quantified or clearly observable result — then one sentence on what it taught, bridged explicitly to the target company/role via companyInfo/jobField; (3) a forward-looking commitment — for motivation/growth questions, split into a near-term focus and a longer-term aspiration.',
  '- If the question bundles multiple distinct sub-asks (e.g. "필요한 역량은 무엇이고, 이를 갖추기 위해 어떤 노력을 했으며, 회사에 어떻게 기여할지" or two separate numbered points), open with one plain-text sentence stating the general belief/principle the role demands (no brackets), then present TWO bracketed sub-headers, each a short label for a distinct concrete experience proving that belief. Each sub-header\'s paragraph must end with its own one-sentence bridge naming the specific company/division/tool it contributes to — do not save all the company-tie-in for a single closing paragraph.',
  'Whichever shape is used, put a real quantified or concretely observable detail in every experience told — even communication/collaboration/soft-skill stories should include a specific number, amount, timeframe, or measurable before/after drawn from selectedFacts/confirmedMetrics, not just a vague description.',
  'Prefer confident, forward-committing verb endings ("~하겠습니다", "~체득했습니다", "~배웠습니다") over hedged language.',
  'If instructions.mode is "expand", you are given previousAnswer: keep its subtitle and structure, and elaborate using the same facts to get much closer to the target length; do not shorten it or drop any fact it already contains.',
  'Do not overwrite any existing answer; you are creating a proposed new version.',
].join(' ');

export async function generateAnswer(env: AiEnv, input: Record<string, unknown>): Promise<AnswerGeneration> {
  if (!env.AI_API_KEY || !env.AI_MODEL) throw new Error('AI 기능을 사용하려면 AI_API_KEY와 AI_MODEL 환경변수를 설정해주세요.');
  if (env.AI_PROVIDER && env.AI_PROVIDER !== 'openai-compatible') throw new Error('현재는 AI_PROVIDER=openai-compatible만 지원합니다.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.AI_MODEL, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ ...input, outputShape: { answer: 'string', usedFacts: ['fact id or exact fact'], unsupportedClaims: ['string'], warnings: ['string'] } }) },
  ] }) });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const providerMessage = errorBody?.error?.message || '제공자 응답을 읽지 못했습니다.';
    throw new Error(`AI 자소서 초안을 생성하지 못했습니다 (${response.status}): ${providerMessage}`);
  }
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있습니다.');
  try { const parsed = JSON.parse(content) as Record<string, unknown>; return { answer: String(parsed.answer || '').trim(), usedFacts: cleanList(parsed.usedFacts), unsupportedClaims: cleanList(parsed.unsupportedClaims), warnings: cleanList(parsed.warnings) }; } catch { throw new Error('AI 응답 형식을 읽지 못했습니다.'); }
}
