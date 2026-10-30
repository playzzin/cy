import React, { useRef, useState } from 'react';
import { ADVANCE_DEPOSIT_ACCOUNTS, LEGACY_ADVANCE_DEPOSIT_ACCOUNTS, isAdvancePaymentDepositAccount } from '../../../types/advancePaymentDepositAccount';
import { AdvancePaymentDepositAccountError, type AdvancePaymentDepositAccountChange } from '../../../services/advancePaymentDepositAccountService';
import type { AdvanceSummaryRow } from '../utils/advanceSummary';

interface Props {
    label: string;
    sources: AdvanceSummaryRow['depositAccountSources'];
    disabled: boolean;
    onSave: (changes: AdvancePaymentDepositAccountChange[]) => Promise<void>;
}

export default function AdvanceSummaryDepositAccountSelect({ label, sources, disabled, onSave }: Props) {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const pending = useRef(false);
    const values = new Set(sources.map(source => source.depositAccount));
    const value = values.size > 1 ? 'mixed' : sources[0]?.depositAccount || '';
    const legacyOption = LEGACY_ADVANCE_DEPOSIT_ACCOUNTS.find(option => option.value === value);
    const selectedLabel = value === 'mixed' ? '혼합' : legacyOption ? `기존: ${legacyOption.label}`
        : ADVANCE_DEPOSIT_ACCOUNTS.find(option => option.value === value)?.label || '미선택';

    const save = async (next: string) => {
        if (pending.current || disabled || !isAdvancePaymentDepositAccount(next) || next === value) return;
        // Include all sources so concurrent changes to any merged record abort the whole save.
        const changes = sources.map(source => ({ id: source.id, expectedDepositAccount: source.depositAccount, depositAccount: next }));
        pending.current = true;
        setSaving(true);
        setMessage('');
        setError('');
        try {
            await onSave(changes);
            setMessage('저장됨');
        } catch (failure) {
            setError(failure instanceof AdvancePaymentDepositAccountError ? failure.message
                : '저장하지 못했습니다. 연결 상태와 저장 권한을 확인한 뒤 다시 선택해 주세요.');
        } finally {
            pending.current = false;
            setSaving(false);
        }
    };

    return <div className="as-deposit-control" aria-busy={saving}>
        <select className={`as-deposit-select as-deposit-${value || 'none'}`} aria-label={label}
            value={value} disabled={disabled || saving || !sources.length || sources.some(source => !source.id)}
            title={value === 'mixed' ? '신청별 선택이 다릅니다. 새로 선택하면 현재 조회 중인 이 행의 모든 신청에 적용됩니다.' : '선택하면 자동 저장됩니다.'}
            onChange={event => void save(event.target.value)}>
            {value === 'mixed' && <option value="mixed" disabled>혼합</option>}
            {legacyOption && <option value={legacyOption.value} disabled>{selectedLabel}</option>}
            <option value="">미선택</option>
            {ADVANCE_DEPOSIT_ACCOUNTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className={`as-deposit-print as-deposit-${value || 'none'}`}>{selectedLabel}</span>
        {(saving || message) && <small className="as-deposit-status" role="status">{saving ? '저장 중…' : message}</small>}
        {error && <p className="as-deposit-error" role="alert">{error}</p>}
    </div>;
}
