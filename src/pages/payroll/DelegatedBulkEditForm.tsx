import React, { useRef, useState } from 'react';
import type { ClaimListEdit, DelegatedClaim, DelegationType, DepositStatus, RecipientKind } from '../../features/delegated-receipts/model';
import { depositLabels, recipientLabels } from '../../features/delegated-receipts/depositState';

export default function DelegatedBulkEditForm({ claims, busy, error, onSave }: {
  claims: DelegatedClaim[]; busy: boolean; error: string; onSave: (edits: ClaimListEdit[]) => void;
}) {
  const [delegation, setDelegation] = useState<DelegationType | 'keep'>('keep');
  const [recipient, setRecipient] = useState<RecipientKind | 'keep'>('keep');
  const [status, setStatus] = useState<DepositStatus | 'keep'>('keep');
  const pending = useRef<{ signature: string; edits: ClaimListEdit[] }>();
  const changed = delegation !== 'keep' || recipient !== 'keep' || status !== 'keep';
  return <form className="dr-form dr-bulk-edit-form" onSubmit={event => {
    event.preventDefault();
    if (!changed || busy) return;
    const signature = JSON.stringify([delegation, recipient, status]);
    if (pending.current?.signature !== signature) {
      const changes: ClaimListEdit['change'][] = [];
      if (delegation !== 'keep') changes.push({ field: 'delegation', value: delegation });
      if (recipient !== 'keep') changes.push({ field: 'recipient', value: recipient });
      if (status !== 'keep') changes.push({ field: 'status', value: status });
      const recordedAt = new Date().toISOString();
      pending.current = { signature, edits: changes.map(change => ({ change, recordedAt,
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bulk-${Date.now()}-${Math.random().toString(36).slice(2)}` })) };
    }
    onSave(pending.current.edits);
  }}>
    <p className="dr-form-help">선택한 {claims.length}건에 적용합니다. 바꿀 항목만 선택하세요.</p>
    <div className="dr-bulk-edit-fields">
      <label>입금방법<select value={delegation} disabled={busy} onChange={event => setDelegation(event.target.value as typeof delegation)}><option value="keep">기존 유지</option><option value="delegate">위임</option><option value="direct">직불</option><option value="unknown">미확인</option></select></label>
      <label>받는 계좌<select value={recipient} disabled={busy} onChange={event => setRecipient(event.target.value as typeof recipient)}><option value="keep">기존 유지</option>{Object.entries(recipientLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>입금여부<select value={status} disabled={busy} onChange={event => setStatus(event.target.value as typeof status)}><option value="keep">기존 유지</option>{Object.entries(depositLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="dr-form-error">{error}</p>}
    <button type="submit" className="dr-button dr-button-primary dr-full-width" disabled={busy || !changed}>{busy ? '저장 중…' : `${claims.length}건 일괄 수정`}</button>
  </form>;
}
