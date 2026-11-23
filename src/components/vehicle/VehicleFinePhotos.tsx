import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import OriginalDocumentPreview from '../common/OriginalDocumentPreview';
import { VehicleFineThumbnail } from '../common/OriginalDocumentThumbnail';
import type { VehicleExpenseRecord } from '../../types/vehicle';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';

const hasFineOriginal = (expense: VehicleExpenseRecord) => /^[a-f0-9]{64}$/i.test(expense.fineNotice?.sourceSha256 || '');

export default function VehicleFinePhotos({ expenses, vehiclePlate, onRemoved, removalDisabled, triggerLabel = '사진 보기', gallery = false }: { expenses: VehicleExpenseRecord[]; vehiclePlate: string; triggerLabel?: string; gallery?: boolean; onRemoved?: () => void; removalDisabled?: boolean }) {
    const [removedIds, setRemovedIds] = useState<string[]>([]);
    const visibleExpenses = expenses.filter(expense => !expense.fineNotice?.attachmentRemoved && !removedIds.includes(expense.id));
    const [confirmId, setConfirmId] = useState('');
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState('');
    const removingRef = useRef(false);
    const originalExpenses = gallery ? visibleExpenses.filter(hasFineOriginal) : visibleExpenses;
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [loaded, setLoaded] = useState<{ id: string; url: string; mimeType: string; fileName: string } | null>(null);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const returnFocus = useRef<HTMLElement | null>(null);
    const selected = originalExpenses.find(expense => expense.id === selectedId) ?? originalExpenses[0] ?? visibleExpenses[0];
    const activeId = selected?.id;
    const activeIndex = originalExpenses.findIndex(expense => expense.id === activeId);
    const preview = loaded?.id === activeId ? loaded : null;
    useEffect(() => {
        setLoaded(null);
        setError('');
        if (!open || !activeId) return;
        let disposed = false;
        let objectUrl = '';
        void vehicleFineImportService.getAttachment(activeId).then(file => {
            if (disposed) return;
            const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
            objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
            setLoaded({ id: activeId, url: objectUrl, mimeType: file.mimeType, fileName: file.fileName });
        }).catch(reason => {
            if (!disposed) setError(reason instanceof Error ? reason.message : '사진을 불러오지 못했습니다. 다시 열어 주세요.');
        });
        return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [open, activeId, retry]);
    const remove = async () => {
        if (!confirmId || removingRef.current || removalDisabled) return;
        removingRef.current = true; setRemoving(true); setRemoveError('');
        try {
            await vehicleFineImportService.removeAttachment(confirmId);
            setRemovedIds(ids => [...ids, confirmId]);
            const next = originalExpenses.find(expense => expense.id !== confirmId);
            setSelectedId(next?.id || ''); setConfirmId('');
            if (!next) setOpen(false);
            onRemoved?.();
        } catch (cause) { setRemoveError(cause instanceof Error ? cause.message : '파일 삭제에 실패했습니다.'); }
        finally { removingRef.current = false; setRemoving(false); }
    };
    if (!visibleExpenses.length) return null;
    return <Dialog.Root open={open} onOpenChange={value => { if (removingRef.current) return; setOpen(value); setConfirmId(''); if (value) setSelectedId(originalExpenses[0]?.id || ''); }}>
        <Dialog.Trigger asChild><button type="button" className="fine-original-trigger" disabled={!originalExpenses.length} aria-label={originalExpenses.length ? `${vehiclePlate} 과태료 ${triggerLabel}` : `${vehiclePlate} 등록된 고지서 없음`}><FileText size={17} />{originalExpenses.length ? `${triggerLabel} · ${originalExpenses.length}건` : '등록된 고지서 없음'}</button></Dialog.Trigger>
        {gallery && <div className="fine-photo-gallery" aria-label={`${vehiclePlate} 과태료 사진 목록`}>
            {visibleExpenses.map(expense => <button key={expense.id} type="button" className="fine-photo-card" disabled={!hasFineOriginal(expense)}
                aria-label={`${vehiclePlate} ${expense.date} 과태료 ${expense.amount.toLocaleString('ko-KR')}원 원본 보기`}
                onClick={event => { returnFocus.current = event.currentTarget; setSelectedId(expense.id); setOpen(true); }}>
                {hasFineOriginal(expense) ? <VehicleFineThumbnail expenseId={expense.id} label={`${vehiclePlate} ${expense.date} 고지서`} /> : <span className="original-thumbnail"><span className="original-thumbnail__placeholder"><FileText size={26} />등록된 고지서 없음</span></span>}
                <span className="fine-photo-card__amount"><span>고지 금액</span><strong>{expense.amount.toLocaleString('ko-KR')}원</strong></span>
                <span className="fine-photo-card__description">{expense.fineNotice?.violationDescription || expense.note || '과태료 고지서'}</span>
                <span className="fine-photo-card__meta">{expense.fineNotice?.violationDateTime ? `위반일시 ${expense.fineNotice.violationDateTime}` : `등록일 ${expense.date}`}</span>
                {expense.fineNotice?.violationLocation && <span className="fine-photo-card__meta">{expense.fineNotice.violationLocation}</span>}
                {expense.fineNotice?.dueDate && <span className="fine-photo-card__meta fine-photo-card__due">납부기한 {expense.fineNotice.dueDate}</span>}
            </button>)}
        </div>}
        <Dialog.Portal>
            <Dialog.Overlay className="original-files-overlay" />
            <Dialog.Content className="original-files-dialog" onCloseAutoFocus={event => {
                if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); returnFocus.current = null; }
            }}>
                <div className="original-files-dialog__header">
                    <div><Dialog.Title>{vehiclePlate} 과태료 고지서</Dialog.Title><Dialog.Description>고지서를 선택하면 사진 또는 PDF 원본을 바로 볼 수 있습니다.</Dialog.Description></div>
                    <Dialog.Close disabled={removing}>닫기</Dialog.Close>
                </div>
                <div className="original-files-dialog__navigation" aria-label="과태료 고지서 목록">
                    <select disabled={removing || !!confirmId} aria-label="과태료 고지서 선택" value={activeId} onChange={event => setSelectedId(event.target.value)}>
                        {originalExpenses.map((expense, index) => <option key={expense.id} value={expense.id}>{index + 1}. {expense.date} · {expense.amount.toLocaleString('ko-KR')}원 · {expense.fineNotice?.sourceFileName || '수동 등록'}</option>)}
                    </select>
                    <button type="button" aria-label="이전 고지서" disabled={removing || !!confirmId || activeIndex <= 0} onClick={() => setSelectedId(originalExpenses[activeIndex - 1].id)}><ChevronLeft size={17} />이전</button>
                    <span aria-live="polite">{activeIndex + 1} / {originalExpenses.length}</span>
                    <button type="button" aria-label="다음 고지서" disabled={removing || !!confirmId || activeIndex >= originalExpenses.length - 1} onClick={() => setSelectedId(originalExpenses[activeIndex + 1].id)}>다음<ChevronRight size={17} /></button>
                </div>
                <dl className="original-files-dialog__fine-summary" aria-label="선택한 과태료 정보">
                    <div><dt>금액</dt><dd>{selected.amount.toLocaleString('ko-KR')}원</dd></div>
                    <div><dt>{selected.fineNotice?.violationDateTime ? '위반일시' : '등록일'}</dt><dd>{selected.fineNotice?.violationDateTime || selected.date}</dd></div>
                    {selected.fineNotice?.dueDate && <div><dt>납부기한</dt><dd>{selected.fineNotice.dueDate}</dd></div>}
                    {selected.fineNotice?.violationLocation && <div><dt>위반장소</dt><dd>{selected.fineNotice.violationLocation}</dd></div>}
                    {selected.fineNotice?.violationDescription && <div><dt>위반내용</dt><dd>{selected.fineNotice.violationDescription}</dd></div>}
                </dl>
                <button type="button" disabled={!activeId || removing || removalDisabled || !!confirmId} onClick={() => { setConfirmId(activeId); setRemoveError(''); }} className="self-start rounded border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">선택한 파일 삭제</button>
                {removalDisabled && <p className="text-sm text-amber-800">변경사항을 저장한 뒤 파일을 삭제해 주세요.</p>}
                {confirmId && <div role="group" aria-label="고지서 파일 삭제 확인" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="break-all font-bold">{expenses.find(expense => expense.id === confirmId)?.fineNotice?.sourceFileName}</p><p>이 파일을 첨부 목록에서 삭제할까요? 다른 파일과 과태료 금액은 유지되며, 원본과 삭제 기록은 이력에 보관됩니다.</p>{removeError && <p role="alert">{removeError}</p>}<div className="mt-2 flex gap-2"><button type="button" disabled={removing} onClick={() => setConfirmId('')} className="rounded border bg-white px-3 py-2">돌아가기</button><button type="button" disabled={removing || removalDisabled} onClick={() => void remove()} className="rounded bg-rose-700 px-3 py-2 text-white">{removing ? '삭제 중…' : '확인, 파일 삭제'}</button></div></div>}
                {error ? <div role="alert" className="original-files-dialog__message"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>
                    : !preview ? <p role="status" className="original-files-dialog__message">사진을 불러오는 중입니다…</p>
                    : <OriginalDocumentPreview key={`${activeId}:${preview.url}`} url={preview.url} fileName={preview.fileName}
                        kind={preview.mimeType === 'application/pdf' ? 'pdf' : preview.mimeType.startsWith('image/') ? 'image' : 'file'}
                        imageAlt="과태료 고지서 원본" pdfTitle="과태료 PDF 원본" downloadable />}
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
