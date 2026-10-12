import React, { useState } from 'react';
import type { RecipientKind } from '../../features/delegated-receipts/model';
import { isCustomRecipient, recipientLabel, recipientLabels } from '../../features/delegated-receipts/depositState';
import ReceiptChoiceSelect from './ReceiptChoiceSelect';
import { customRecipientChoice, keepChoice, recipientChoices } from './receiptChoiceOptions';
import './RecipientSelect.css';

export default function RecipientSelect({ label, value, labels = recipientLabels, disabled, onChange, saveCustom = false, allowKeep = false }: {
  label: string; value: RecipientKind | 'keep'; labels?: typeof recipientLabels; disabled?: boolean;
  onChange: (value: RecipientKind | 'keep') => void; saveCustom?: boolean; allowKeep?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const custom = isCustomRecipient(value);
  const editing = draft !== null || (!saveCustom && custom);
  const text = draft ?? (custom ? value.slice(7) : '');
  const commit = () => { if (!disabled && text.trim()) { onChange(`custom:${text.trim()}`); setDraft(null); } };
  const options = [...(allowKeep ? [keepChoice] : []), ...recipientChoices(labels),
    ...(saveCustom && custom ? [{ ...customRecipientChoice, value, label: value.slice(7) }] : []), customRecipientChoice];
  return <div className="dr-recipient-control">
    <ReceiptChoiceSelect label={label} value={editing ? 'custom' : value} disabled={disabled} options={options} onChange={selected => {
      if (selected === 'custom') { if (saveCustom) setDraft(custom ? value.slice(7) : ''); else onChange('custom:'); }
      else { setDraft(null); onChange(selected as RecipientKind | 'keep'); }
    }} />
    {editing && <div className="dr-recipient-custom">
      <input aria-label={`${label} 직접 입력`} autoFocus={saveCustom} value={text} maxLength={120} disabled={disabled} required={!saveCustom} placeholder="계좌 구분 또는 받는 사람" onChange={event => saveCustom ? setDraft(event.target.value) : onChange(`custom:${event.target.value}`)} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (saveCustom && event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); }
        if (saveCustom && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(null); }
      }} />
      {saveCustom && <div className="dr-recipient-actions"><button type="button" disabled={disabled} onClick={() => setDraft(null)}>취소</button><button type="button" disabled={disabled || !text.trim()} onClick={commit}>저장</button></div>}
    </div>}
  </div>;
}
