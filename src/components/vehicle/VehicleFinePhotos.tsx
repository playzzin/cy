import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { VehicleExpenseRecord } from '../../types/vehicle';
import { vehicleFineImportService } from '../../services/vehicleFineImportService';

export default function VehicleFinePhotos({ expenses, vehiclePlate }: { expenses: VehicleExpenseRecord[]; vehiclePlate: string }) {
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
    if (!expenses.length) return null;
    return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (value) setSelectedId(expenses[0].id); }}>
        <Dialog.Trigger asChild><button type="button" className="w-full rounded px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50" aria-label={`${vehiclePlate} 과태료 사진 보기`}>사진 보기 · {expenses.length}건</button></Dialog.Trigger>
        <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[92vh] w-[96vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-lg font-bold">{vehiclePlate} 과태료 사진</Dialog.Title><Dialog.Close className="rounded border px-3 py-1">닫기</Dialog.Close></div>
                <Dialog.Description className="text-sm text-slate-600">고지서를 선택하면 등록한 사진 또는 PDF 원본을 볼 수 있습니다.</Dialog.Description>
                <div className="flex max-h-40 shrink-0 flex-wrap gap-2 overflow-y-auto" aria-label="과태료 고지서 목록">{expenses.map(expense => <button type="button" key={expense.id} aria-pressed={selectedId === expense.id} onClick={() => setSelectedId(expense.id)} className={`max-w-full break-all rounded border px-3 py-2 text-left text-sm ${selectedId === expense.id ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : ''}`}>
                    {expense.date} · {expense.amount.toLocaleString('ko-KR')}원 · {expense.fineNotice?.sourceFileName || '수동 등록'}
                </button>)}</div>
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
