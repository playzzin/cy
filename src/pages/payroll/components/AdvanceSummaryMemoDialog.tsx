import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AdvancePaymentMemoError, type AdvancePaymentMemoChange } from '../../../services/advancePaymentMemoService';
import type { AdvanceSummaryRow } from '../utils/advanceSummary';
import '../../../components/common/ResponsiveDetailDialog.css';

interface Props {
    workerName: string;
    context: string;
    sources: AdvanceSummaryRow['memoSources'];
    onSave: (changes: AdvancePaymentMemoChange[]) => Promise<void>;
    onClose: () => void;
}

export default function AdvanceSummaryMemoDialog({ workerName, context, sources, onSave, onClose }: Props) {
    const [drafts, setDrafts] = useState(() => sources.map(source => source.memo));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [discard, setDiscard] = useState(false);
    const pending = useRef(false);
    const returnFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const dirty = sources.some((source, index) => source.memo !== drafts[index]);

    useEffect(() => {
        if (!dirty && !saving) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, saving]);

    const close = () => {
        if (pending.current) return;
        if (dirty) setDiscard(true);
        else onClose();
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending.current || !dirty) return;
        const changes = sources.flatMap((source, index) => source.memo === drafts[index] ? []
            : [{ id: source.id, memo: drafts[index], expectedMemo: source.memo }]);
        pending.current = true;
        setSaving(true);
        setError('');
        setDiscard(false);
        try {
            await onSave(changes);
        } catch (failure) {
            setError(failure instanceof AdvancePaymentMemoError ? failure.message
                : '비고를 저장하지 못했습니다. 입력한 내용은 유지됩니다. 연결 상태와 저장 권한을 확인한 뒤 다시 시도해 주세요.');
        } finally {
            pending.current = false;
            setSaving(false);
        }
    };

    return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
        <Dialog.Portal>
        <Dialog.Overlay className="cy-detail-dialog__overlay" />
        <Dialog.Content className="cy-detail-dialog as-memo-dialog" onCloseAutoFocus={event => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}>
        <header className="cy-detail-dialog__header">
            <div><Dialog.Title>{workerName} 비고 수정</Dialog.Title><Dialog.Description>{context}</Dialog.Description></div>
            <button type="button" className="cy-detail-dialog__close" aria-label="비고 편집 닫기" onClick={close} disabled={saving}>×</button>
        </header>
        <div className="cy-detail-dialog__body">
        <form className="as-memo-form" onSubmit={save} aria-busy={saving}>
            {sources.length > 1 && <p className="as-memo-help">급여 구분별로 저장된 비고를 수정할 수 있습니다.</p>}
            {sources.map((source, index) => <label key={source.id} className="as-memo-field">
                <span>{sources.length > 1 ? `${source.salaryModel} · 내역 ${index + 1}` : '비고'}</span>
                <textarea aria-label={sources.length > 1 ? `${source.salaryModel} 비고 ${index + 1}` : '비고 내용'}
                    value={drafts[index]} maxLength={4000} rows={sources.length > 1 ? 4 : 6} disabled={saving}
                    placeholder="비고를 입력하세요" onChange={event => {
                        const value = event.target.value;
                        setDrafts(current => current.map((draft, draftIndex) => draftIndex === index ? value : draft));
                    }} />
                <small>{drafts[index].length.toLocaleString()} / 4,000</small>
            </label>)}
            {error && <p className="as-memo-error" role="alert">{error}</p>}
            <div className="as-memo-actions">
                <button type="button" onClick={close} disabled={saving}>취소</button>
                <button type="submit" className="as-memo-save" disabled={saving || !dirty}>{saving ? '저장 중…' : '비고 저장'}</button>
            </div>
            {discard && <div className="as-memo-discard" role="alert">
                <p>저장하지 않은 비고가 있습니다.</p>
                <button type="button" onClick={() => setDiscard(false)}>계속 작성</button>
                <button type="button" onClick={onClose}>변경 버리고 닫기</button>
            </div>}
        </form>
        </div>
        </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
