import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Estimate, EstimateItem, estimateService, EstimateRequestType, EstimateStatus } from '../../services/estimateService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faPlus, faTrash, faSave, faEdit } from '@fortawesome/free-solid-svg-icons';

const generateItemId = (): string => {
    return `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

const defaultItems: EstimateItem[] = [
    {
        id: generateItemId(),
        label: '디자인',
        description: '메인/서브 페이지 UI 디자인',
        category: 'design',
        unitPrice: 0,
        quantity: 1,
        amount: 0,
        isOptional: false
    },
    {
        id: generateItemId(),
        label: '퍼블리싱',
        description: '반응형 HTML/CSS/JS 구현',
        category: 'frontend',
        unitPrice: 0,
        quantity: 1,
        amount: 0,
        isOptional: false
    },
    {
        id: generateItemId(),
        label: '유지보수 (3개월)',
        description: '경미한 수정 및 장애 대응',
        category: 'maintenance',
        unitPrice: 0,
        quantity: 1,
        amount: 0,
        isOptional: true
    }
];

const EstimatePage: React.FC = () => {
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);

    const [title, setTitle] = useState<string>('');
    const [clientName, setClientName] = useState<string>('');
    const [clientCompany, setClientCompany] = useState<string>('');
    const [requestType, setRequestType] = useState<EstimateRequestType>('build');
    const [status, setStatus] = useState<EstimateStatus>('draft');
    const [validUntilDate, setValidUntilDate] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [items, setItems] = useState<EstimateItem[]>(defaultItems);
    const [discount, setDiscount] = useState<number>(0);
    const [tax, setTax] = useState<number>(0);

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + item.amount, 0),
        [items]
    );

    const total = useMemo(
        () => subtotal - discount + tax,
        [subtotal, discount, tax]
    );

    const resetForm = (): void => {
        setEditingId(null);
        setTitle('');
        setClientName('');
        setClientCompany('');
        setRequestType('build');
        setStatus('draft');
        setValidUntilDate('');
        setNotes('');
        setItems(defaultItems.map((item) => ({ ...item, id: generateItemId(), unitPrice: 0, quantity: 1, amount: 0 })));
        setDiscount(0);
        setTax(0);
    };

    const loadEstimates = async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);
            const data = await estimateService.getEstimates();
            setEstimates(data);
        } catch (e) {
            setError('견적 데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadEstimates();
    }, []);

    const handleItemChange = (index: number, field: keyof Omit<EstimateItem, 'id' | 'amount'>, value: string | number | boolean): void => {
        setItems((prev) => {
            const updated = [...prev];
            const target = { ...updated[index] };

            if (field === 'unitPrice' || field === 'quantity') {
                const numValue = typeof value === 'number' ? value : Number(value) || 0;
                (target as any)[field] = numValue;
            } else if (field === 'isOptional') {
                target.isOptional = Boolean(value);
            } else if (field === 'label' || field === 'description' || field === 'category') {
                (target as any)[field] = String(value);
            }

            target.amount = (target.unitPrice || 0) * (target.quantity || 0);
            updated[index] = target;
            return updated;
        });
    };

    const handleAddItem = (): void => {
        setItems((prev) => [
            ...prev,
            {
                id: generateItemId(),
                label: '새 항목',
                description: '',
                category: '',
                unitPrice: 0,
                quantity: 1,
                amount: 0,
                isOptional: false
            }
        ]);
    };

    const handleRemoveItem = (id: string): void => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const parseNumber = (value: string): number => {
        const num = Number(value.replace(/,/g, ''));
        return Number.isNaN(num) ? 0 : num;
    };

    const setEditingEstimate = (estimate: Estimate): void => {
        setEditingId(estimate.id ?? null);
        setTitle(estimate.title);
        setClientName(estimate.clientName);
        setClientCompany(estimate.clientCompany ?? '');
        setRequestType(estimate.requestType);
        setStatus(estimate.status);
        setValidUntilDate(
            estimate.validUntil ? new Date(estimate.validUntil.toDate()).toISOString().split('T')[0] : ''
        );
        setNotes(estimate.notes ?? '');
        setItems(
            (estimate.items ?? []).map((item) => ({
                ...item,
                amount: (item.unitPrice || 0) * (item.quantity || 0)
            }))
        );
        setDiscount(estimate.discount ?? 0);
        setTax(estimate.tax ?? 0);
    };

    const handleSave = async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const validUntilTimestamp = validUntilDate
                ? Timestamp.fromDate(new Date(validUntilDate))
                : undefined;

            const payload: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'> = {
                title,
                clientName,
                clientCompany: clientCompany || undefined,
                requestType,
                status,
                items,
                subtotal,
                discount,
                tax,
                total,
                validUntil: validUntilTimestamp,
                notes: notes || undefined
            };

            if (editingId) {
                await estimateService.updateEstimate(editingId, payload);
            } else {
                await estimateService.addEstimate(payload);
            }

            await loadEstimates();
            resetForm();
        } catch (e) {
            setError('견적 저장 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string): Promise<void> => {
        if (!window.confirm('이 견적을 삭제하시겠습니까?')) return;
        try {
            setLoading(true);
            setError(null);
            await estimateService.deleteEstimate(id);
            await loadEstimates();
            if (editingId === id) {
                resetForm();
            }
        } catch (e) {
            setError('견적 삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">홈페이지 견적 프로그램</h1>
                        <p className="text-sm text-slate-500">
                            홈페이지 제작/수정 요청을 기반으로 항목별 단가와 수량을 입력해 상용 수준의 견적서를 관리합니다.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    새 견적
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Estimate List */}
                <div className="w-[40%] border-r border-slate-200 bg-white overflow-y-auto">
                    <div className="p-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-700">견적 목록</h2>
                    </div>
                    {loading && estimates.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">로딩 중...</div>
                    ) : estimates.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">등록된 견적이 없습니다. 상단의 "새 견적"을 눌러 생성하세요.</div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {estimates.map((estimate) => (
                                <li
                                    key={estimate.id}
                                    className="px-4 py-3 cursor-pointer hover:bg-slate-50 flex items-start justify-between gap-2"
                                    onClick={() => setEditingEstimate(estimate)}
                                >
                                    <div>
                                        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            {estimate.title}
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                {estimate.requestType === 'build' ? '제작' : '수정'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {estimate.clientCompany && <span className="mr-2">{estimate.clientCompany}</span>}
                                            <span>{estimate.clientName}</span>
                                        </div>
                                        <div className="text-xs text-emerald-600 mt-1 font-semibold">
                                            총액: {estimate.total.toLocaleString()} 원
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                estimate.status === 'approved'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : estimate.status === 'sent'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : estimate.status === 'rejected'
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}
                                        >
                                            {estimate.status === 'draft'
                                                ? '임시저장'
                                                : estimate.status === 'sent'
                                                ? '발송'
                                                : estimate.status === 'approved'
                                                ? '승인'
                                                : '반려'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (estimate.id) {
                                                    void handleDelete(estimate.id);
                                                }
                                            }}
                                            className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600"
                                        >
                                            <FontAwesomeIcon icon={faTrash} /> 삭제
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Right: Editor */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faEdit} className="text-indigo-500" /> 견적 입력
                                </h2>
                                {editingId && (
                                    <p className="text-xs text-slate-500 mt-1">선택한 견적을 수정 중입니다.</p>
                                )}
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">견적 제목</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="예: 회사 홈페이지 제작 견적"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">고객명</label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="담당자 이름"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">고객 회사명</label>
                                <input
                                    type="text"
                                    value={clientCompany}
                                    onChange={(e) => setClientCompany(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="회사 이름 (선택)"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">요청 유형</label>
                                    <select
                                        value={requestType}
                                        onChange={(e) => setRequestType(e.target.value as EstimateRequestType)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="build">제작 요청</option>
                                        <option value="modify">수정 요청</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">견적 상태</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as EstimateStatus)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="draft">임시저장</option>
                                        <option value="sent">발송됨</option>
                                        <option value="approved">승인됨</option>
                                        <option value="rejected">반려됨</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">유효기간</label>
                                <input
                                    type="date"
                                    value={validUntilDate}
                                    onChange={(e) => setValidUntilDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700">항목별 내역</h3>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200"
                                >
                                    <FontAwesomeIcon icon={faPlus} /> 항목 추가
                                </button>
                            </div>
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">항목명</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">설명</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600">카테고리</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600">단가</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600">수량</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600">금액</th>
                                            <th className="px-3 py-2 text-center font-semibold text-slate-600">옵션</th>
                                            <th className="px-3 py-2 text-center font-semibold text-slate-600">삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => (
                                            <tr key={item.id} className="border-t border-slate-100">
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        type="text"
                                                        value={item.label}
                                                        onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <textarea
                                                        value={item.description ?? ''}
                                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs min-h-[32px]"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        type="text"
                                                        value={item.category ?? ''}
                                                        onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                                        placeholder="design / frontend 등"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top text-right">
                                                    <input
                                                        type="text"
                                                        value={item.unitPrice.toLocaleString()}
                                                        onChange={(e) => handleItemChange(index, 'unitPrice', parseNumber(e.target.value))}
                                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-right"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top text-right">
                                                    <input
                                                        type="text"
                                                        value={item.quantity.toString()}
                                                        onChange={(e) => handleItemChange(index, 'quantity', parseNumber(e.target.value))}
                                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-right"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top text-right text-slate-800 font-semibold">
                                                    {item.amount.toLocaleString()} 원
                                                </td>
                                                <td className="px-3 py-2 align-top text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.isOptional ?? false}
                                                        onChange={(e) => handleItemChange(index, 'isOptional', e.target.checked)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="text-rose-500 hover:text-rose-600"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">비고 / 메모</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="고객과 합의한 특이사항, 제외 항목, 결제 조건 등을 기록하세요."
                                />
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">소계(Subtotal)</span>
                                    <span className="font-semibold text-slate-800">{subtotal.toLocaleString()} 원</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">할인(Discount)</span>
                                    <input
                                        type="text"
                                        value={discount.toLocaleString()}
                                        onChange={(e) => setDiscount(parseNumber(e.target.value))}
                                        className="w-32 border border-slate-300 rounded px-2 py-1 text-xs text-right"
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">세금(Tax)</span>
                                    <input
                                        type="text"
                                        value={tax.toLocaleString()}
                                        onChange={(e) => setTax(parseNumber(e.target.value))}
                                        className="w-32 border border-slate-300 rounded px-2 py-1 text-xs text-right"
                                    />
                                </div>
                                <div className="border-t border-slate-200 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold">총액(Total)</span>
                                    <span className="text-lg font-extrabold text-emerald-600">{total.toLocaleString()} 원</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
                            >
                                초기화
                            </button>
                            <button
                                type="button"
                                onClick={() => { void handleSave(); }}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                {editingId ? '견적 수정 저장' : '견적 저장'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EstimatePage;
