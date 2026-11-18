import React from 'react';

export function StatementRecruiterFeeDates({ month, workerName, dates, onChange, disabled }: {
  month: string; workerName: string; dates: string[]; onChange: (dates: string[]) => void; disabled: boolean;
}) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  return <fieldset disabled={disabled} aria-label={`${workerName} 소개비 발생일 선택`} className="mx-auto max-w-md rounded-lg border border-sky-200 bg-white p-3 text-left" data-html2canvas-ignore="true">
    <legend className="px-1 font-bold text-sky-900">{workerName} · {month} 소개비 발생일</legend>
    <p className="mb-2 text-xs text-slate-600">소개비를 실제 청구한 날짜만 선택하세요. 선택 후 ‘인력소개비 저장’을 눌러 주세요.</p>
    <div className="grid grid-cols-7 gap-1">
      {['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day} className="py-1 text-center text-xs text-slate-500">{day}</span>)}
      {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: lastDay }, (_, index) => {
        const day = index + 1;
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const selected = dates.includes(date);
        return <button key={date} type="button" aria-label={`${date} 소개비 발생일`} aria-pressed={selected}
          className={`min-h-[36px] rounded border text-center text-sm font-semibold ${selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
          onClick={() => onChange(selected ? dates.filter(value => value !== date) : [...dates, date].sort())}>{day}</button>;
      })}
    </div>
    <div className="mt-2 flex items-center justify-between text-xs"><span>선택 {dates.length}일</span><button type="button" className="rounded border px-2 py-1" onClick={() => onChange([])}>선택 지우기</button></div>
  </fieldset>;
}
