import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { VehicleExpenseRecord } from '../../types/vehicle';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';

export default function VehicleFinePhotos({ expenses, vehiclePlate, onRemoved, removalDisabled }: { expenses: VehicleExpenseRecord[]; vehiclePlate: string; onRemoved?: () => void; removalDisabled?: boolean }) {
    const [removedIds, setRemovedIds] = useState<string[]>([]);
    const visibleExpenses = expenses.filter(expense => !expense.fineNotice?.attachmentRemoved && !removedIds.includes(expense.id));
    const [confirmId, setConfirmId] = useState('');
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState('');
    const removingRef = useRef(false);
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [preview, setPreview] = useState<{ url: string; mimeType: string; fileName: string } | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        setPreview(null);
        setError('');
        if (!open || !selectedId) return;
        let disposed = false;
        let objectUrl = '';
        void vehicleFineImportService.getAttachment(selectedId).then(file => {
            if (disposed) return;
            const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
            objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
            setPreview({ url: objectUrl, mimeType: file.mimeType, fileName: file.fileName });
        }).catch(reason => {
            if (!disposed) setError(reason instanceof Error ? reason.message : '사진을 불러오지 못했습니다. 다시 열어 주세요.');
        });
        return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [open, selectedId]);
    const remove = async () => {
        if (!confirmId || removingRef.current || removalDisabled) return;
        removingRef.current = true; setRemoving(true); setRemoveError('');
        try {
            await vehicleFineImportService.removeAttachment(confirmId);
            setRemovedIds(ids => [...ids, confirmId]);
            const next = visibleExpenses.find(expense => expense.id !== confirmId);
            setSelectedId(next?.id || ''); setConfirmId('');
            if (!next) setOpen(false);
            onRemoved?.();
        } catch (cause) { setRemoveError(cause instanceof Error ? cause.message : '파일 삭제에 실패했습니다.'); }
        finally { removingRef.current = false; setRemoving(false); }
    };
    if (!visibleExpenses.length) return null;
    return <Dialog.Root open={open} onOpenChange={value => { if (removingRef.current) return; setOpen(value); setConfirmId(''); if (value) setSelectedId(visibleExpenses[0].id); }}>
        <Dialog.Trigger asChild><button type="button" className="w-full rounded px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50" aria-label={`${vehiclePlate} 과태료 사진 보기`}>사진 보기 · {visibleExpenses.length}건</button></Dialog.Trigger>
        <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[92vh] w-[96vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-lg font-bold">{vehiclePlate} 과태료 사진</Dialog.Title><Dialog.Close className="rounded border px-3 py-1">닫기</Dialog.Close></div>
                <Dialog.Description className="text-sm text-slate-600">고지서를 선택하면 등록한 사진 또는 PDF 원본을 볼 수 있습니다.</Dialog.Description>
                <div className="flex max-h-40 shrink-0 flex-wrap gap-2 overflow-y-auto" aria-label="과태료 고지서 목록">{visibleExpenses.map(expense => <button type="button" key={expense.id} disabled={removing} aria-pressed={selectedId === expense.id} onClick={() => setSelectedId(expense.id)} className={`max-w-full break-all rounded border px-3 py-2 text-left text-sm ${selectedId === expense.id ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : ''}`}>
                    {expense.date} · {expense.amount.toLocaleString('ko-KR')}원 · {expense.fineNotice?.sourceFileName || '수동 등록'}
                </button>)}</div>
                <button type="button" disabled={!selectedId || removing || removalDisabled || !!confirmId} onClick={() => { setConfirmId(selectedId); setRemoveError(''); }} className="self-start rounded border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">선택한 파일 삭제</button>
                {removalDisabled && <p className="text-sm text-amber-800">변경사항을 저장한 뒤 파일을 삭제해 주세요.</p>}
                {confirmId && <div role="group" aria-label="고지서 파일 삭제 확인" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="break-all font-bold">{expenses.find(expense => expense.id === confirmId)?.fineNotice?.sourceFileName}</p><p>이 파일을 첨부 목록에서 삭제할까요? 다른 파일과 과태료 금액은 유지되며, 원본과 삭제 기록은 이력에 보관됩니다.</p>{removeError && <p role="alert">{removeError}</p>}<div className="mt-2 flex gap-2"><button type="button" disabled={removing} onClick={() => setConfirmId('')} className="rounded border bg-white px-3 py-2">돌아가기</button><button type="button" disabled={removing || removalDisabled} onClick={() => void remove()} className="rounded bg-rose-700 px-3 py-2 text-white">{removing ? '삭제 중…' : '확인, 파일 삭제'}</button></div></div>}
                {error ? <p role="alert" className="rounded bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : !preview ? <p role="status">사진을 불러오는 중입니다…</p> : <>
                    <a href={preview.url} download={preview.fileName} className="text-sm text-indigo-700 underline">원본 다운로드</a>
                    <div className="min-h-0 overflow-auto rounded bg-slate-100 text-center">
                        {preview.mimeType === 'application/pdf' ? <iframe title="과태료 PDF 원본" src={preview.url} className="h-[65vh] w-full" /> : <img src={preview.url} alt="과태료 고지서 원본" className="mx-auto max-h-[65vh] max-w-full object-contain" />}
                    </div>
                </>}
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
