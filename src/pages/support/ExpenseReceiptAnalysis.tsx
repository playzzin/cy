import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { teamExpenseRequestService } from '../../services/teamExpenseRequestService';
import type { ExpenseReceiptAnalysis as Analysis, ExpenseReceiptFields } from '../../types/teamExpenseRequest';

export type ExpenseReceiptFile = { id: string; file: File; preview: string };
export function ExpenseReceiptDocument({ receipt }: { receipt: ExpenseReceiptFile }) {
  return <div className="expense-receipt-document">
    {receipt.file.type.startsWith('image/') ? <img src={receipt.preview} alt={`${receipt.file.name} 원본 영수증`} /> : <object aria-label={`${receipt.file.name} 원본 영수증`} data={receipt.preview} type="application/pdf"><p>PDF가 표시되지 않으면 아래의 크게 보기를 눌러 원본을 확인해 주세요.</p></object>}
    {receipt.file.type === 'application/pdf' && <p className="expense-request-note">PDF 미리보기를 지원하지 않는 기기에서는 아래의 크게 보기로 확인해 주세요.</p>}
    <a href={receipt.preview} target="_blank" rel="noreferrer">{receipt.file.name} 크게 보기</a>
  </div>;
}

type Props = {
  receipt: ExpenseReceiptFile;
  teamId: string;
  categories: Array<{ id: string; label: string }>;
  onApply: (fields: ExpenseReceiptFields) => void;
  onClose: () => void;
};
const blank = (): ExpenseReceiptFields => ({ date: '', amount: '', paymentMethod: '', category: '' });

export default function ExpenseReceiptAnalysis({ receipt, teamId, categories, onApply, onClose }: Props) {
  const [fields, setFields] = useState(blank);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const task = useRef<{ attempt: number; promise: Promise<Analysis> }>();
  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    // Reuse the same request during React StrictMode's effect replay.
    if (!task.current || task.current.attempt !== attempt) task.current = { attempt, promise: teamExpenseRequestService.analyze(teamId, receipt.file) };
    task.current.promise.then(result => {
      if (!active) return;
      setFields({ date: result.date || '', amount: result.amount === null ? '' : String(result.amount), paymentMethod: result.paymentMethod || '', category: result.category || '' });
      setWarnings(result.warnings);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '분석하지 못했습니다. 직접 입력해 주세요.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [attempt, receipt.file, teamId]);
  const change = (field: keyof ExpenseReceiptFields, value: string) => setFields(previous => ({ ...previous, [field]: value }));
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!fields.date || !Number.isSafeInteger(Number(fields.amount)) || Number(fields.amount) <= 0 || Number(fields.amount) > 1_000_000_000 || !fields.paymentMethod || !categories.some(category => category.id === fields.category)) {
      setError('사용일·금액·결제수단·경비 구분을 모두 확인해 주세요.'); return;
    }
    onApply(fields);
  };
  return <div className="expense-request-modal" role="dialog" aria-modal="true" aria-labelledby="expense-analysis-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className="expense-preview-panel">
      <div className="expense-request-header"><h2 id="expense-analysis-title">영수증 분석 미리보기</h2><button type="button" autoFocus onClick={onClose} aria-label="분석 미리보기 닫기"><X size={18} /></button></div>
      <p>원본과 비교해 항목을 확인하고 수정하세요. 적용한 뒤에도 승인 요청 전까지 수정할 수 있습니다.</p>
      <div className="expense-preview-grid"><ExpenseReceiptDocument receipt={receipt} /><form onSubmit={apply}>
        {busy && <p role="status" className="expense-analysis-status"><Loader2 size={18} className="animate-spin" />Gemini가 영수증을 분석하고 있습니다…</p>}
        {error && <p role="alert" className="expense-request-error">{error}</p>}
        {!busy && warnings.length > 0 && <div className="expense-analysis-warnings"><strong>확인할 항목</strong><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
        <fieldset disabled={busy}>
          <label>분석 사용일<input type="date" required value={fields.date} onChange={event => change('date', event.target.value)} /></label>
          <label>분석 금액 (원)<input type="number" inputMode="numeric" required min="1" max="1000000000" step="1" value={fields.amount} onChange={event => change('amount', event.target.value)} /></label>
          <label>분석 결제수단<select required value={fields.paymentMethod} onChange={event => change('paymentMethod', event.target.value)}><option value="">직접 확인 후 선택</option><option>현찰</option><option>개인카드</option><option>계좌이체</option></select></label>
          <label>분석 경비 구분<select required value={fields.category} onChange={event => change('category', event.target.value)}><option value="">직접 확인 후 선택</option>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
        </fieldset>
        <div className="expense-request-actions"><button type="button" disabled={busy} onClick={() => setAttempt(previous => previous + 1)}><Sparkles size={16} />다시 분석</button><button type="submit" className="primary" disabled={busy}>확인 후 입력란에 적용</button></div>
        <button type="button" className="expense-preview-close" onClick={onClose}>적용하지 않고 닫기</button>
      </form></div>
    </div>
  </div>;
}
