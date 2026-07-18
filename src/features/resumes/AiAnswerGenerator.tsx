import { useState } from 'react';

type GeneratedAnswer = {
  answer: string;
  versionNumber: number;
  charCount: number;
  byteCount: number;
  warnings: string[];
  unsupportedClaims: string[];
  limitStatus: { isExceeded: boolean };
};

type Followup = { question: string; answer: string };
type FlowOption = { title: string; bullets: string[] };
type PlanResponse = { ok: boolean; data?: { sufficient: boolean; questions: string[] }; error?: string };
type FlowOptionsResponse = { ok: boolean; data?: { options: FlowOption[] }; error?: string };
type GenerateResponse = { ok: boolean; data?: GeneratedAnswer; error?: string };

export function AiAnswerGenerator({
  questionId,
  disabled,
  companyInfo,
  existingAnswer,
  onApply,
}: {
  questionId?: number;
  disabled: boolean;
  companyInfo: string;
  existingAnswer: string;
  onApply: (answer: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [outline, setOutline] = useState('');
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<string[]>([]);
  const [flowOptions, setFlowOptions] = useState<FlowOption[] | null>(null);
  const [selectedFlowIndex, setSelectedFlowIndex] = useState<number | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedAnswer | null>(null);
  const [message, setMessage] = useState('');

  function openModal() {
    if (!questionId) {
      setMessage('자소서를 먼저 저장한 뒤 AI 초안을 만들 수 있습니다.');
      return;
    }
    setMessage('');
    setOutline(existingAnswer.trim());
    setFollowups([]);
    setPendingQuestions([]);
    setPendingAnswers([]);
    setFlowOptions(null);
    setSelectedFlowIndex(null);
    setPlanError('');
    setModalOpen(true);
  }

  async function checkPlan(currentFollowups: Followup[]) {
    if (!questionId) return;
    setPlanLoading(true);
    setPlanError('');
    try {
      const response = await fetch('/api/ai/plan-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeQuestionId: questionId, outline, companyInfo, followups: currentFollowups }),
      });
      const body = (await response.json()) as PlanResponse;
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error || '답변 흐름을 점검하지 못했습니다.');
      if (body.data.sufficient) {
        await fetchFlowOptions(currentFollowups);
      } else {
        setPendingQuestions(body.data.questions);
        setPendingAnswers(body.data.questions.map(() => ''));
      }
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : '답변 흐름을 점검하지 못했습니다.');
    } finally {
      setPlanLoading(false);
    }
  }

  async function fetchFlowOptions(currentFollowups: Followup[]) {
    if (!questionId) return;
    setPlanLoading(true);
    setPlanError('');
    try {
      const response = await fetch('/api/ai/flow-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeQuestionId: questionId, outline, companyInfo, followups: currentFollowups }),
      });
      const body = (await response.json()) as FlowOptionsResponse;
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error || '초안 흐름을 제안받지 못했습니다.');
      setFlowOptions(body.data.options);
      setSelectedFlowIndex(null);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : '초안 흐름을 제안받지 못했습니다.');
    } finally {
      setPlanLoading(false);
    }
  }

  function submitOutline() {
    if (!outline.trim()) {
      setPlanError('답변 흐름 또는 이미 작성한 내용을 입력해주세요.');
      return;
    }
    void checkPlan(followups);
  }

  function submitFollowupAnswers() {
    const answered = pendingQuestions.map((question, index) => ({
      question,
      answer: pendingAnswers[index]?.trim() || '',
    }));
    if (answered.some((item) => !item.answer)) {
      setPlanError('모든 추가 질문에 답변해주세요.');
      return;
    }
    const nextFollowups = [...followups, ...answered];
    setFollowups(nextFollowups);
    setPendingQuestions([]);
    setPendingAnswers([]);
    void checkPlan(nextFollowups);
  }

  function confirmFlow() {
    if (selectedFlowIndex === null || !flowOptions) {
      setPlanError('흐름을 하나 선택해주세요.');
      return;
    }
    setModalOpen(false);
    void runGenerate(followups, flowOptions[selectedFlowIndex]);
  }

  async function runGenerate(finalFollowups: Followup[], flow?: FlowOption) {
    if (!questionId) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/ai/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeQuestionId: questionId, outline, companyInfo, followups: finalFollowups, selectedFlow: flow }),
      });
      const body = (await response.json()) as GenerateResponse;
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error || 'AI 초안을 생성하지 못했습니다.');
      setResult(body.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI 초안을 생성하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const checks = result ? [...result.warnings, ...result.unsupportedClaims] : [];

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={openModal}
        className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-medium text-white disabled:bg-violet-300"
      >
        {loading ? '초안 작성 중...' : 'AI 초안 만들기'}
      </button>
      {message ? <p className="mt-2 text-xs text-red-700">{message}</p> : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                {flowOptions ? '초안 흐름 선택' : pendingQuestions.length > 0 ? '추가 질문' : '답변 흐름 작성'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-xs text-neutral-400">
                닫기
              </button>
            </div>

            {pendingQuestions.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">초안 작성에 필요한 추가 질문에 답해주세요.</p>
                {pendingQuestions.map((question, index) => (
                  <div key={question} className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">{question}</label>
                    <textarea
                      className="min-h-[70px] w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400"
                      value={pendingAnswers[index] || ''}
                      onChange={(event) =>
                        setPendingAnswers((prev) =>
                          prev.map((value, valueIndex) => (valueIndex === index ? event.target.value : value))
                        )
                      }
                    />
                  </div>
                ))}
                {planError ? <p className="text-xs text-red-700">{planError}</p> : null}
                <button
                  type="button"
                  disabled={planLoading}
                  onClick={submitFollowupAnswers}
                  className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white disabled:bg-neutral-300"
                >
                  {planLoading ? '확인 중...' : '다음'}
                </button>
              </div>
            ) : flowOptions ? (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">
                  아래 흐름 중 하나를 고르면, 그 흐름대로 전체 초안을 작성합니다. (아직 완성된 문장이 아니라 구성 방향입니다.)
                </p>
                <div className="space-y-2">
                  {flowOptions.map((option, index) => (
                    <button
                      key={option.title}
                      type="button"
                      onClick={() => setSelectedFlowIndex(index)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedFlowIndex === index
                          ? 'border-neutral-950 bg-neutral-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-400'
                      }`}
                    >
                      <div className="text-sm font-medium text-neutral-900">{option.title}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-neutral-600">
                        {option.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                {planError ? <p className="text-xs text-red-700">{planError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={planLoading}
                    onClick={confirmFlow}
                    className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white disabled:bg-neutral-300"
                  >
                    이 흐름으로 초안 만들기
                  </button>
                  <button
                    type="button"
                    disabled={planLoading}
                    onClick={() => void fetchFlowOptions(followups)}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 disabled:opacity-50"
                  >
                    {planLoading ? '다시 만드는 중...' : '다른 흐름 다시 제안받기'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">
                  이미 작성한 답변이 있다면 그대로 두고, 없다면 흐름(개요)을 적어주세요. 내용이 부족하면 AI가 추가
                  질문을 하고, 충분하면 몇 가지 구성 흐름을 제안합니다.
                </p>
                <textarea
                  className="min-h-[140px] w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-400"
                  value={outline}
                  onChange={(event) => setOutline(event.target.value)}
                  placeholder="예) 상황 → 내가 시도한 방법 → 결과 → 이 경험이 지원 직무와 연결되는 지점"
                />
                {planError ? <p className="text-xs text-red-700">{planError}</p> : null}
                <button
                  type="button"
                  disabled={planLoading}
                  onClick={submitOutline}
                  className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white disabled:bg-neutral-300"
                >
                  {planLoading ? '확인 중...' : '다음'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-violet-800">
              AI 초안 · {result.charCount}자 / {result.byteCount}byte
              {result.limitStatus.isExceeded ? ' · 제한 초과' : ''}
            </span>
            <button
              type="button"
              onClick={() => onApply(result.answer)}
              className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white"
            >
              답변에 적용
            </button>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-neutral-800">{result.answer}</p>
          {checks.length ? (
            <details className="mt-3 text-xs text-neutral-600">
              <summary className="cursor-pointer">확인 사항 {checks.length}개</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {checks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="mt-3 text-xs text-neutral-500">적용 후 자소서 저장을 눌러 반영하세요.</p>
        </div>
      ) : null}
    </div>
  );
}
