import React, { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { AdvanceSummaryWorker } from '../utils/advanceSummary';
import '../../../components/common/ResponsiveDetailDialog.css';

interface Props {
    workers: AdvanceSummaryWorker[];
    initialWorkerId: string;
    amounts: Map<string, number>;
    month: string;
    onSave: (workerId: string, amount: number, expectedAmount: number) => Promise<void>;
    onClose: () => void;
}
export default function AdvancePrepaymentDialog({ workers, initialWorkerId, amounts, month, onSave, onClose }: Props) {
    const [workerId, setWorkerId] = useState(initialWorkerId);
    const [draft, setDraft] = useState(String(amounts.get(initialWorkerId) || ''));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef(false);
    const amount = Number(draft.replace(/,/g, ''));
    const valid = draft.trim() !== '' && Number.isSafeInteger(amount) && amount >= 0;
    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending.current || !workerId || !valid) return;
        pending.current = true; setSaving(true); setError('');
        try { await onSave(workerId, amount, amounts.get(workerId) || 0); }
        catch { setError('선입금을 저장하지 못했습니다. 다른 화면의 변경 여부와 권한을 확인하고 다시 입력해 주세요.'); }
        finally { pending.current = false; setSaving(false); }
    };
    return <Dialog.Root open onOpenChange={open => { if (!open && !pending.current) onClose(); }}><Dialog.Portal>
        <Dialog.Overlay className="cy-detail-dialog__overlay" />
        <Dialog.Content className="cy-detail-dialog as-prepayment-dialog">
            <header className="cy-detail-dialog__header"><div><Dialog.Title>선입금 수기 입력</Dialog.Title><Dialog.Description>{month} · 직접 입력한 금액만 선입금으로 집계합니다.</Dialog.Description></div>
                <button type="button" className="cy-detail-dialog__close" aria-label="선입금 입력 닫기" disabled={saving} onClick={onClose}>×</button></header>
            <form className="cy-detail-dialog__body as-memo-form" onSubmit={save}>
                <label className="as-memo-field">작업자<select aria-label="선입금 작업자" value={workerId} disabled={saving} onChange={event => {
                    setWorkerId(event.target.value); setDraft(String(amounts.get(event.target.value) || '')); setError('');
                }}><option value="">작업자 선택</option>{workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name} · {worker.teamName || '소속 팀'}</option>)}</select></label>
                <label className="as-memo-field">선입금 금액 (원)<input aria-label="선입금 금액" inputMode="numeric" value={draft} disabled={saving}
                    onChange={event => setDraft(event.target.value.replace(/[^0-9]/g, ''))} placeholder="금액 입력" /></label>
                <p className="as-memo-help">해당 월의 선입금 총액을 입력하세요. 기존 금액을 비우려면 0원을 저장하세요.</p>
                {error && <p role="alert" className="as-memo-error">{error}</p>}
                <div className="as-memo-actions"><button type="button" disabled={saving} onClick={onClose}>닫기</button><button type="submit" className="as-memo-save" disabled={saving || !workerId || !valid}>{saving ? '저장 중' : '선입금 저장'}</button></div>
            </form>
        </Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
}
