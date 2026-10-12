import React, { useRef, useState } from 'react';
import type { ClaimListEdit, DelegatedClaim, DelegationType, DepositStatus, RecipientKind } from '../../features/delegated-receipts/model';
import { depositLabels, recipientLabels } from '../../features/delegated-receipts/depositState';
import { emptyDirectory, getBulkRecipientLabels, ReceiptDirectory } from '../../features/delegated-receipts/teamDirectory';
import RecipientSelect from './RecipientSelect';
import ReceiptChoiceSelect from './ReceiptChoiceSelect';
import { delegationChoices, keepChoice } from './receiptChoiceOptions';

export default function DelegatedBulkEditForm({ claims, directory = emptyDirectory, busy, error, onSave }: {
  claims: DelegatedClaim[]; directory?: ReceiptDirectory; busy: boolean; error: string; onSave: (edits: ClaimListEdit[]) => void;
}) {
  const accountLabels = getBulkRecipientLabels(claims, directory);
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
      <div className="dr-bulk-recipient-field"><span>입금방법</span><ReceiptChoiceSelect label="입금방법" value={delegation} options={[keepChoice, ...delegationChoices]} disabled={busy} onChange={value => setDelegation(value as typeof delegation)} /></div>
      <div className="dr-bulk-recipient-field"><span>받는 계좌</span><RecipientSelect label="받는 계좌" value={recipient} labels={accountLabels} disabled={busy} onChange={setRecipient} allowKeep /></div>
      <label>입금여부<select value={status} disabled={busy} onChange={event => setStatus(event.target.value as typeof status)}><option value="keep">기존 유지</option>{Object.entries(depositLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="dr-form-error">{error}</p>}
    <button type="submit" className="dr-button dr-button-primary dr-full-width" disabled={busy || !changed}>{busy ? '저장 중…' : `${claims.length}건 일괄 수정`}</button>
  </form>;
}
