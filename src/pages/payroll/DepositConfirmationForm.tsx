import React, { useRef, useState } from 'react';
import type { DelegatedClaim, DepositConfirmation, DepositStatus, RecipientKind } from '../../features/delegated-receipts/model';
import { depositLabels, getDepositState, recipientLabels } from '../../features/delegated-receipts/depositState';
import RecipientSelect from './RecipientSelect';

export default function DepositConfirmationForm({ claims, busy, error, onSave }: {
  claims: DelegatedClaim[]; busy: boolean; error: string;
  onSave: (confirmation: DepositConfirmation, preserveRecipient: boolean) => void;
}) {
  const bulk = claims.length > 1;
  const [status, setStatus] = useState<DepositStatus>(bulk ? 'complete' : getDepositState(claims[0]).status);
  const [recipient, setRecipient] = useState<RecipientKind | 'keep'>(bulk ? 'keep' : getDepositState(claims[0]).recipient);
  const [note, setNote] = useState('');
  const pending = useRef<{ signature: string; value: DepositConfirmation } | null>(null);
  return <form className="dr-form dr-confirm-form" onSubmit={event => {
    event.preventDefault();
    const signature = JSON.stringify([status, recipient, note]);
    if (pending.current?.signature !== signature) pending.current = { signature, value: { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `confirmation-${Date.now()}-${Math.random().toString(36).slice(2)}`, status, recipient: recipient === 'keep' ? 'unknown' : recipient, note: note.trim(), recordedAt: new Date().toISOString() } };
    onSave(pending.current.value, recipient === 'keep');
  }}>
    <h3>{bulk ? `선택한 ${claims.length}건 입금여부 확인` : '입금여부 확인'}</h3>
    <p className="dr-form-help">통장 입금 여부를 확인한 뒤 저장하세요. 입금액을 입력하지 않아도 입금완료로 표시할 수 있습니다.</p>
    <div className="dr-confirm-options" role="group" aria-label="입금여부 선택">{Object.entries(depositLabels).map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} className={`dr-button ${status === value ? 'dr-button-primary' : ''}`} disabled={busy} onClick={() => setStatus(value as DepositStatus)}>{label}</button>)}</div>
    <label>입금받는 계좌<RecipientSelect label="입금받는 계좌" value={recipient} disabled={busy} onChange={setRecipient} allowKeep={bulk} /></label>
    <label>확인 메모<input maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="선택 입력 · 확인한 내용" /></label>
    {error && <p role="alert" className="dr-form-error">{error}</p>}
    <button type="submit" className="dr-button dr-button-primary dr-full-width" disabled={busy}>{busy ? '저장 중…' : `${bulk ? `${claims.length}건 ` : ''}${depositLabels[status]} 저장`}</button>
    <p className="dr-form-help">확인 이력이 남습니다. 실제 입금일·입금액 기록은 별도로 보존합니다.</p>
  </form>;
}
