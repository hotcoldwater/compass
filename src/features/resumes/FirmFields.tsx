import { useState } from 'react';
import { ANJIN_DEPARTMENTS, CUSTOM_FIRM, FIRM_OPTIONS } from './firmOptions';

const fieldClass = 'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 outline-none transition focus:border-neutral-400';

const isFixedFirm = (value: string) => (FIRM_OPTIONS as readonly string[]).includes(value);

export function FirmField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isCustomMode, setIsCustomMode] = useState(() => value !== '' && !isFixedFirm(value));
  const selectValue = isCustomMode ? CUSTOM_FIRM : isFixedFirm(value) ? value : '';

  function handleSelectChange(next: string) {
    if (next === CUSTOM_FIRM) {
      setIsCustomMode(true);
      onChange('');
    } else {
      setIsCustomMode(false);
      onChange(next);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">법인</label>
      <select className={fieldClass} value={selectValue} onChange={(event) => handleSelectChange(event.target.value)}>
        <option value="">선택하세요</option>
        {FIRM_OPTIONS.map((firm) => (
          <option key={firm} value={firm}>{firm}</option>
        ))}
        <option value={CUSTOM_FIRM}>{CUSTOM_FIRM}</option>
      </select>
      {isCustomMode ? (
        <input
          className={fieldClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="법인명을 입력하세요"
        />
      ) : null}
    </div>
  );
}

export function JobFieldField({
  firmName,
  value,
  onChange,
}: {
  firmName: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (firmName === '안진회계법인') {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700">근무희망부서</label>
        <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">선택하세요</option>
          {ANJIN_DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">지원분야</label>
      <input className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
