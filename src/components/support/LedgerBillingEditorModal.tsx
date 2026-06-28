import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble, faFloppyDisk, faPlus, faRotateLeft, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';

export interface LedgerBillingEditorLineItem {
    id?: string;
    label: string;
    amount: number;
    type?: string;
    category?: string;
    targetField?: string;
}

interface LedgerBillingEditorModalProps<TLineItem extends LedgerBillingEditorLineItem> {
    title: string;
    subtitle?: string;
    statusLabel: string;
    readOnly?: boolean;
    lineItems: TLineItem[];
    memo?: string;
    saving?: boolean;
    onClose: () => void;
    onSave: (lineItems: TLineItem[], memo: string) => Promise<void>;
    onConfirm?: (lineItems: TLineItem[], memo: string) => Promise<void>;
    onCancelConfirm?: () => Promise<void>;
}

const makeLineItemId = () => {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `ledger-line-${random}`;
};

const parseAmount = (value: string): number => {
    const cleaned = value.replace(/[^0-9-]/g, '').trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

const LedgerBillingEditorModal = <TLineItem extends LedgerBillingEditorLineItem,>({
    title,
    subtitle,
    statusLabel,
    readOnly = false,
    lineItems,
    memo,
    saving = false,
    onClose,
    onSave,
    onConfirm,
    onCancelConfirm
}: LedgerBillingEditorModalProps<TLineItem>) => {
    const [draftItems, setDraftItems] = useState<TLineItem[]>(() => lineItems.map((item) => ({ ...item })));
    const [draftMemo, setDraftMemo] = useState(memo ?? '');
    const totalAmount = useMemo(
        () => draftItems.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0),
        [draftItems]
    );

    const updateItem = (index: number, patch: Partial<TLineItem>) => {
        setDraftItems((prev) => prev.map((item, idx) => idx === index ? { ...item, ...patch } : item));
    };

    const removeItem = (index: number) => {
        setDraftItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    const addItem = () => {
        setDraftItems((prev) => [
            ...prev,
            {
                id: makeLineItemId(),
                label: '',
                amount: 0,
                type: 'VARIABLE',
                category: 'OTHER'
            } as TLineItem
        ]);
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-extrabold text-slate-900 truncate">{title}</h2>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                                statusLabel.includes('확정') || statusLabel.includes('CONFIRMED')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                                {statusLabel}
                            </span>
                        </div>
                        {subtitle && <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                        title="닫기"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">항목</th>
                                    <th className="px-4 py-3 text-right w-44">금액</th>
                                    <th className="px-4 py-3 text-center w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {draftItems.map((item, index) => (
                                    <tr key={String(item.id ?? index)}>
                                        <td className="p-2">
                                            <input
                                                value={item.label ?? ''}
                                                disabled={readOnly}
                                                onChange={(event) => updateItem(index, { label: event.target.value } as Partial<TLineItem>)}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                value={Number.isFinite(item.amount) && item.amount !== 0 ? item.amount.toLocaleString() : ''}
                                                disabled={readOnly}
                                                onChange={(event) => updateItem(index, { amount: parseAmount(event.target.value) } as Partial<TLineItem>)}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-extrabold font-mono text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="w-9 h-9 rounded-lg text-rose-500 hover:bg-rose-50"
                                                    title="항목 삭제"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {draftItems.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-12 text-center text-slate-400 font-bold">
                                            청구 항목이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!readOnly && (
                        <button
                            type="button"
                            onClick={addItem}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            항목 추가
                        </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 items-start">
                        <label className="block">
                            <span className="block text-xs font-extrabold text-slate-500 mb-1">메모</span>
                            <textarea
                                value={draftMemo}
                                disabled={readOnly}
                                onChange={(event) => setDraftMemo(event.target.value)}
                                className="w-full min-h-[92px] rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="청구 메모"
                            />
                        </label>
                        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-right">
                            <div className="text-xs font-extrabold text-indigo-500">총 청구액</div>
                            <div className="mt-1 text-2xl font-black font-mono text-indigo-700">
                                {totalAmount.toLocaleString()}
                            </div>
                            <div className="text-xs font-bold text-indigo-400 mt-0.5">원</div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold hover:bg-slate-100"
                    >
                        닫기
                    </button>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={() => onSave(draftItems, draftMemo)}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:bg-indigo-300 inline-flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faFloppyDisk} />
                            저장
                        </button>
                    )}
                    {!readOnly && onConfirm && (
                        <button
                            type="button"
                            onClick={() => onConfirm(draftItems, draftMemo)}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:bg-emerald-300 inline-flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faCheckDouble} />
                            확정
                        </button>
                    )}
                    {readOnly && onCancelConfirm && (
                        <button
                            type="button"
                            onClick={onCancelConfirm}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:bg-amber-300 inline-flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            확정 취소
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LedgerBillingEditorModal;
