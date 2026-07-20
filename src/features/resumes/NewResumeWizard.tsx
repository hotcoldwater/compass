import { useState } from 'react';
import { createResume } from '../../lib/api';
import type { ResumeLimitType, ResumeRecord } from '../../types';
import { FirmField, JobFieldField } from './FirmFields';
import { LIMIT_OPTIONS } from './limitOptions';

type WizardQuestion = { question_text: string; limit_type: ResumeLimitType; limit_value: string };

const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 10;
const fieldClass = 'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 outline-none transition focus:border-neutral-400';

function emptyQuestion(): WizardQuestion {
  return { question_text: '', limit_type: 'none', limit_value: '' };
}

export function NewResumeWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (record: ResumeRecord) => void;
}) {
  const [firmName, setFirmName] = useState('');
  const [jobField, setJobField] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [questionCount, setQuestionCount] = useState(MIN_QUESTIONS);
  const [questions, setQuestions] = useState<WizardQuestion[]>([emptyQuestion()]);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 4 + questionCount;
  const isLastStep = stepIndex === totalSteps - 1;

  function resizeQuestions(count: number) {
    setQuestions((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push(emptyQuestion());
      return next;
    });
  }

  function updateQuestion(index: number, patch: Partial<WizardQuestion>) {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index
          ? { ...question, ...patch, ...(patch.limit_type === 'none' ? { limit_value: '' } : {}) }
          : question
      )
    );
  }

  function canProceed() {
    if (stepIndex === 0) return firmName.trim() !== '';
    if (stepIndex === 1) return jobField.trim() !== '';
    if (stepIndex === 2) return true;
    if (stepIndex === 3) return questionCount >= MIN_QUESTIONS && questionCount <= MAX_QUESTIONS;
    const question = questions[stepIndex - 4];
    if (!question || !question.question_text.trim()) return false;
    if (question.limit_type !== 'none' && !question.limit_value.trim()) return false;
    return true;
  }

  function handleBack() {
    if (stepIndex === 0) {
      onClose();
      return;
    }
    setStepIndex((prev) => prev - 1);
  }

  async function handleNext() {
    if (!canProceed()) return;
    if (isLastStep) {
      await submit();
      return;
    }
    setStepIndex((prev) => prev + 1);
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const record = await createResume({
        company_name: firmName.trim(),
        application_start_date: startDate.trim(),
        application_end_date: endDate.trim(),
        job_field: jobField.trim(),
        questions: questions.map((question) => ({
          question_text: question.question_text.trim(),
          limit_type: question.limit_type,
          limit_value:
            question.limit_type === 'none' || !question.limit_value.trim()
              ? null
              : Number(question.limit_value),
          answer_content: '',
          company_info: '',
        })),
      });
      onCreated(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : '자소서를 만들지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-neutral-400">{stepIndex + 1} / {totalSteps}</span>
          <button type="button" onClick={onClose} className="text-xs text-neutral-400">닫기</button>
        </div>

        {stepIndex === 0 ? (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">지원할 법인을 선택하세요</h3>
            <FirmField value={firmName} onChange={setFirmName} />
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">지원분야를 알려주세요</h3>
            <JobFieldField firmName={firmName} value={jobField} onChange={setJobField} />
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">지원 일정 (선택)</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm text-neutral-600">시작일
                <input type="date" className={`mt-2 ${fieldClass}`} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="text-sm text-neutral-600">마감일
                <input type="date" className={`mt-2 ${fieldClass}`} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
            </div>
          </div>
        ) : null}

        {stepIndex === 3 ? (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">문항이 몇 개인가요?</h3>
            <input
              type="number"
              min={MIN_QUESTIONS}
              max={MAX_QUESTIONS}
              className={fieldClass}
              value={questionCount}
              onChange={(event) => {
                const next = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Number(event.target.value) || MIN_QUESTIONS));
                setQuestionCount(next);
                resizeQuestions(next);
              }}
            />
          </div>
        ) : null}

        {stepIndex >= 4 && questions[stepIndex - 4] ? (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">문항 {stepIndex - 4 + 1} / {questionCount}</h3>
            <textarea
              className={`min-h-[120px] w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 outline-none transition focus:border-neutral-400`}
              placeholder="자소서 문항을 붙여넣으세요"
              value={questions[stepIndex - 4].question_text}
              onChange={(event) => updateQuestion(stepIndex - 4, { question_text: event.target.value })}
            />
            <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <select
                className={fieldClass}
                value={questions[stepIndex - 4].limit_type}
                onChange={(event) => updateQuestion(stepIndex - 4, { limit_type: event.target.value as ResumeLimitType })}
              >
                {LIMIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                disabled={questions[stepIndex - 4].limit_type === 'none'}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-neutral-100`}
                value={questions[stepIndex - 4].limit_value}
                onChange={(event) => updateQuestion(stepIndex - 4, { limit_value: event.target.value })}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={saving}
            className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {stepIndex === 0 ? '취소' : '이전'}
          </button>
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canProceed() || saving}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {saving ? '만드는 중...' : isLastStep ? '완료' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
