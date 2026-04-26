import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalculator,
    faCheckDouble,
    faFloppyDisk,
    faMagnifyingGlass,
    faSearch,
    faTrash,
    faUpload
} from '@fortawesome/free-solid-svg-icons';
import { format, subMonths } from 'date-fns';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions, storage } from '../../config/firebase';
import { Card } from '../../types/card';
import { CardBillingCostItem, CardBillingDocument } from '../../types/cardBilling';
import { cardBillingService } from '../../services/cardBillingService';
import { aiSettingsService } from '../../services/aiSettingsService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { Timestamp } from '../../types/timestamp';

interface CardBillingManagerProps {
    cards: Card[];
    loadingCards: boolean;
    onRefreshCards: () => void;
}

export const CardBillingManager: React.FC<CardBillingManagerProps> = ({ cards, loadingCards, onRefreshCards }) => {
    const [yearMonth, setYearMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));

    const [documents, setDocuments] = useState<CardBillingDocument[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [analyzingAttachment, setAnalyzingAttachment] = useState(false);
    const [selectedAttachmentPath, setSelectedAttachmentPath] = useState<string>('');
    const [isAiEnabledOnPage, setIsAiEnabledOnPage] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setIsAiEnabledOnPage(aiSettingsService.isPathEnabled(window.location.pathname));
    }, []);

    useEffect(() => {
        loadBillings();
    }, [yearMonth]);

    const loadBillings = async () => {
        setLoading(true);
        try {
            const data = await cardBillingService.getBillingsByMonth(yearMonth);
            const sorted = data
                .slice()
                .sort((a, b) => {
                    const cardCmp = String(a.cardLabel ?? '').localeCompare(String(b.cardLabel ?? ''), 'ko-KR');
                    if (cardCmp !== 0) return cardCmp;
                    const teamCmp = String(a.teamName ?? a.assignedTeamName ?? '').localeCompare(String(b.teamName ?? b.assignedTeamName ?? ''), 'ko-KR');
                    if (teamCmp !== 0) return teamCmp;
                    return String(a.issuedToWorkerName ?? '').localeCompare(String(b.issuedToWorkerName ?? ''), 'ko-KR');
                });

            setDocuments(sorted);
            setSelectedDocumentId((prev) => {
                if (prev && sorted.some((d) => d.id === prev)) return prev;
                return sorted[0]?.id ?? '';
            });
        } catch (e) {
            console.error(e);
            toast.error('청구 문서를 불러오지 못했습니다.');
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    const selectedDocument = useMemo(() => {
        if (!selectedDocumentId) return null;
        return documents.find((d) => d.id === selectedDocumentId) ?? null;
    }, [documents, selectedDocumentId]);

    useEffect(() => {
        const paths = selectedDocument?.statementAttachmentPaths ?? [];
        setSelectedAttachmentPath((prev) => {
            if (prev && paths.includes(prev)) return prev;
            return paths[paths.length - 1] ?? '';
        });
    }, [selectedDocument]);

    const sanitizeFileName = (name: string): string => {
        const v = String(name || '').trim();
        if (!v) return 'statement';
        return v.replace(/[\\/\n\r\t]/g, '_');
    };

    const parseAmount = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const normalized = trimmed.replace(/,/g, '');
            const num = Number(normalized);
            return Number.isFinite(num) ? num : null;
        }
        return null;
    };

    const isRecord = (value: unknown): value is Record<string, unknown> => {
        return typeof value === 'object' && value !== null;
    };

    type AnalyzeCardBillingStatementRequest = {
        statementPath: string;
        billingId?: string;
        yearMonth?: string;
        cardLabel?: string;
    };

    type AnalyzeCardBillingStatementResponse = {
        ok: boolean;
        analysis?: {
            status?: string;
            message?: string;
            gemini?: {
                rawText?: string;
                parsed?: unknown;
            } | null;
        };
    };

    const updateSelectedDocument = (updater: (doc: CardBillingDocument) => CardBillingDocument) => {
        setDocuments((prev) => prev.map((d) => (d.id === selectedDocumentId ? updater(d) : d)));
    };

    const handleUploadAttachment = async (file: File) => {
        if (!selectedDocument) {
            toast.error('문서를 먼저 선택해주세요.');
            return;
        }

        if (!file) return;

        setUploadingAttachment(true);
        try {
            const safeName = sanitizeFileName(file.name);
            const base = `card-billing-statements/${selectedDocument.yearMonth}/${selectedDocument.id}`;
            const objectPath = `${base}/${Date.now()}_${safeName}`;

            const r = storageRef(storage, objectPath);
            await uploadBytes(r, file, file.type ? { contentType: file.type } : undefined);

            updateSelectedDocument((doc) => {
                const nextPaths = [...(doc.statementAttachmentPaths ?? []), objectPath];
                return {
                    ...doc,
                    statementAttachmentPaths: nextPaths,
                    updatedAt: Timestamp.now()
                };
            });

            setSelectedAttachmentPath(objectPath);
            toast.success('첨부 업로드가 완료되었습니다. 저장 버튼을 눌러 반영해주세요.');
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '첨부 업로드에 실패했습니다.';
            toast.error(msg);
        } finally {
            setUploadingAttachment(false);
        }
    };

    const handleOpenAttachment = async (path: string) => {
        if (!path) return;
        try {
            const url = await getDownloadURL(storageRef(storage, path));
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            console.error(e);
            toast.error('첨부 파일을 열 수 없습니다.');
        }
    };

    const handleAnalyzeAttachment = async () => {
        try {
            aiSettingsService.assertCurrentPageEnabled('Gemini 청구서 분석');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : '이 페이지의 AI 분석이 비활성화되어 있습니다.');
            return;
        }

        if (!selectedDocument) {
            toast.error('문서를 먼저 선택해주세요.');
            return;
        }

        const path = selectedAttachmentPath || (selectedDocument.statementAttachmentPaths ?? [])[0] || '';
        if (!path) {
            toast.error('분석할 첨부 파일이 없습니다.');
            return;
        }

        const confirm = await showConfirmAlert('Gemini 분석', 'Gemini 분석 결과로 라인 아이템을 덮어쓸까요?', '분석');
        if (!confirm.isConfirmed) return;

        setAnalyzingAttachment(true);
        try {
            const callable = httpsCallable<AnalyzeCardBillingStatementRequest, AnalyzeCardBillingStatementResponse>(
                firebaseFunctions,
                'analyzeCardBillingStatement'
            );

            const res = await callable({
                statementPath: path,
                billingId: selectedDocument.id,
                yearMonth: selectedDocument.yearMonth,
                cardLabel: selectedDocument.cardLabel
            });

            const data = res.data;
            const parsed = data?.analysis?.gemini?.parsed;
            if (!parsed) {
                toast.error(data?.analysis?.message ?? 'Gemini 분석 결과가 없습니다.');
                return;
            }

            if (!isRecord(parsed)) {
                toast.error('Gemini 분석 결과 형식이 올바르지 않습니다.');
                return;
            }

            const totalAmount = parseAmount(parsed.totalAmount);
            const itemsRaw = parsed.items;
            const nextItems: CardBillingCostItem[] = [];

            if (Array.isArray(itemsRaw)) {
                itemsRaw.forEach((it, idx) => {
                    if (!isRecord(it)) return;
                    const label = typeof it.label === 'string' ? it.label.trim() : '';
                    const amount = parseAmount(it.amount);
                    if (!label || amount == null) return;
                    const category = typeof it.category === 'string' ? it.category.trim() : '';
                    nextItems.push({
                        id: `ai_${Date.now()}_${idx}`,
                        label,
                        amount,
                        type: 'VARIABLE',
                        category: category || undefined
                    });
                });
            }

            if (nextItems.length === 0 && totalAmount != null) {
                nextItems.push({
                    id: `ai_total_${Date.now()}`,
                    label: '청구서 총액',
                    amount: totalAmount,
                    type: 'VARIABLE',
                    category: 'STATEMENT'
                });
            }

            const computedTotal = nextItems.reduce((acc, it) => acc + (Number.isFinite(it.amount) ? it.amount : 0), 0);
            updateSelectedDocument((doc) => ({
                ...doc,
                lineItems: nextItems,
                variableCost: computedTotal,
                totalAmount: computedTotal,
                updatedAt: Timestamp.now()
            }));

            toast.success('Gemini 분석 결과가 적용되었습니다. 저장 버튼을 눌러 반영해주세요.');
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : 'Gemini 분석에 실패했습니다.';
            toast.error(msg);
        } finally {
            setAnalyzingAttachment(false);
        }
    };

    const handleGenerateDrafts = async () => {
        const result = await showConfirmAlert('청구 문서 생성', `${yearMonth} 기준으로 청구 초안을 생성할까요?`);
        if (!result.isConfirmed) return;

        setProcessing(true);
        try {
            const targets = cards.filter((c) => c.status === 'ASSIGNED');
            if (targets.length === 0) {
                toast.info('배정된 카드가 없어 생성할 문서가 없습니다.');
                return;
            }

            const docs = await Promise.all(targets.map((c) => cardBillingService.generateBilling(c, yearMonth)));
            for (const doc of docs) {
                await cardBillingService.saveBilling(doc);
            }

            toast.success('청구 초안 생성이 완료되었습니다.');
            await loadBillings();
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '청구 문서 생성에 실패했습니다.';
            toast.error(msg);
        } finally {
            setProcessing(false);
            onRefreshCards();
        }
    };

    const handleSaveSelected = async () => {
        if (!selectedDocument) return;

        setSaving(true);
        try {
            await cardBillingService.saveBilling({
                ...selectedDocument,
                updatedAt: Timestamp.now()
            });
            toast.success('저장되었습니다.');
            await loadBillings();
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmSelected = async () => {
        if (!selectedDocument) return;

        const result = await showConfirmAlert('청구 확정', '선택한 청구 문서를 확정할까요?', '확정');
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await cardBillingService.saveBilling({
                ...selectedDocument,
                status: 'CONFIRMED',
                confirmedAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            toast.success('확정되었습니다.');
            await loadBillings();
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '확정에 실패했습니다.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (!selectedDocument) return;

        const result = await showConfirmAlert('청구 문서 삭제', '선택한 청구 문서를 삭제할까요?', '삭제');
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await cardBillingService.deleteBilling(selectedDocument.id);
            toast.success('삭제되었습니다.');
            await loadBillings();
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '삭제에 실패했습니다.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900">카드 청구관리</h2>
                    <p className="text-slate-500 font-medium mt-1 text-sm">배정된 카드의 월별 사용내역을 기반으로 청구 문서를 생성/확정합니다.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-700"
                        value={yearMonth}
                        onChange={(e) => setYearMonth(e.target.value)}
                        placeholder="YYYY-MM"
                    />
                    <button
                        onClick={loadBillings}
                        disabled={loading || loadingCards}
                        className="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        조회
                    </button>
                    <button
                        onClick={handleGenerateDrafts}
                        disabled={processing || loadingCards}
                        className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 ${
                            processing ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        <FontAwesomeIcon icon={faCalculator} />
                        {processing ? '생성 중...' : '초안 생성'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                        <div className="text-sm font-extrabold text-slate-900">문서 목록</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">{documents.length}건</div>
                    </div>
                    <div className="max-h-[520px] overflow-y-auto">
                        {(loading || loadingCards) ? (
                            <div className="p-6 text-slate-400">불러오는 중...</div>
                        ) : documents.length === 0 ? (
                            <div className="p-6 text-slate-400">문서가 없습니다.</div>
                        ) : (
                            documents.map((d) => (
                                <button
                                    key={d.id}
                                    onClick={() => setSelectedDocumentId(d.id)}
                                    className={`w-full text-left p-4 border-b border-slate-50 hover:bg-indigo-50/30 transition ${
                                        selectedDocumentId === d.id ? 'bg-indigo-50/60' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-extrabold text-slate-800">{d.cardLabel}</div>
                                        <div className="text-xs font-bold text-slate-500">{d.status}</div>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {d.teamName ?? d.assignedTeamName ?? '-'} / {d.issuedToWorkerName ?? '-'}
                                    </div>
                                    <div className="text-sm font-extrabold text-indigo-700 font-mono mt-2">
                                        {Number(d.totalAmount ?? 0).toLocaleString()}원
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5">
                    {!selectedDocument ? (
                        <div className="text-slate-400">문서를 선택해주세요.</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold text-slate-500">선택 문서</div>
                                    <div className="text-2xl font-extrabold text-slate-900">{selectedDocument.cardLabel}</div>
                                    <div className="text-sm text-slate-500 font-medium mt-1">
                                        {selectedDocument.teamName ?? selectedDocument.assignedTeamName ?? '-'} / {selectedDocument.issuedToWorkerName ?? '-'}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={handleSaveSelected}
                                        disabled={saving}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-2 ${
                                            saving ? 'opacity-60 cursor-wait' : ''
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                        저장
                                    </button>
                                    <button
                                        onClick={handleConfirmSelected}
                                        disabled={saving}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-2 ${
                                            saving ? 'opacity-60 cursor-wait' : ''
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faCheckDouble} />
                                        확정
                                    </button>
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={saving}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-2 ${
                                            saving ? 'opacity-60 cursor-wait' : ''
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                        삭제
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-xs font-bold text-slate-500">변동비</div>
                                    <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">
                                        {Number(selectedDocument.variableCost ?? 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-xs font-bold text-slate-500">총액</div>
                                    <div className="text-2xl font-extrabold text-indigo-700 font-mono mt-1">
                                        {Number(selectedDocument.totalAmount ?? 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-xs font-bold text-slate-500">상태</div>
                                    <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">{selectedDocument.status}</div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-extrabold text-slate-900">청구서 첨부</div>
                                        <div className="text-xs text-slate-500 font-medium mt-1">PDF/이미지를 업로드하고 Gemini로 총액/항목을 추출할 수 있습니다.</div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label
                                            className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 cursor-pointer ${
                                                uploadingAttachment ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faUpload} />
                                            {uploadingAttachment ? '업로드 중...' : '첨부 업로드'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="application/pdf,image/*"
                                                disabled={uploadingAttachment}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0] ?? null;
                                                    e.target.value = '';
                                                    if (f) void handleUploadAttachment(f);
                                                }}
                                            />
                                        </label>
                                        <button
                                            onClick={handleAnalyzeAttachment}
                                            disabled={analyzingAttachment || uploadingAttachment || !isAiEnabledOnPage}
                                            className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2 ${
                                                analyzingAttachment ? 'opacity-60 cursor-wait' : ''
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                                            {analyzingAttachment ? '분석 중...' : (isAiEnabledOnPage ? 'Gemini 분석' : 'AI 비활성')}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="md:col-span-2">
                                        <div className="text-xs font-bold text-slate-600 mb-1">첨부 파일</div>
                                        <select
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                            value={selectedAttachmentPath}
                                            onChange={(e) => setSelectedAttachmentPath(e.target.value)}
                                        >
                                            <option value="">선택하세요</option>
                                            {(selectedDocument.statementAttachmentPaths ?? []).map((p) => (
                                                <option key={p} value={p}>
                                                    {p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-600 mb-1">열기</div>
                                        <button
                                            onClick={() => void handleOpenAttachment(selectedAttachmentPath)}
                                            disabled={!selectedAttachmentPath}
                                            className={`w-full px-4 py-2.5 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 ${
                                                !selectedAttachmentPath ? 'opacity-60 cursor-not-allowed' : ''
                                            }`}
                                        >
                                            첨부 열기
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-900 text-white font-extrabold text-sm">라인 아이템</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[720px]">
                                        <thead className="bg-slate-100 text-slate-600 text-xs font-bold">
                                            <tr>
                                                <th className="px-4 py-3 text-left">항목</th>
                                                <th className="px-4 py-3 text-left">카테고리</th>
                                                <th className="px-4 py-3 text-right">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(selectedDocument.lineItems ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-6 text-slate-400 text-center">라인 아이템이 없습니다.</td>
                                                </tr>
                                            ) : (
                                                (selectedDocument.lineItems ?? []).map((li) => (
                                                    <tr key={li.id} className="hover:bg-indigo-50/20">
                                                        <td className="px-4 py-3 font-bold text-slate-800">{li.label}</td>
                                                        <td className="px-4 py-3 text-slate-600">{li.category ?? '-'}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-extrabold text-slate-800">{Number(li.amount ?? 0).toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
