import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalculator,
    faCheckDouble,
    faFloppyDisk,
    faMagnifyingGlass,
    faPlus,
    faRotateLeft,
    faSearch,
    faTrash,
    faUser,
    faUsers,
    faUpload
} from '@fortawesome/free-solid-svg-icons';
import { format, subMonths } from 'date-fns';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions, storage } from '../../config/firebase';
import { Card } from '../../types/card';
import { CardBillingCostItem, CardBillingDocument, CardBillingIssuedToType } from '../../types/cardBilling';
import { cardBillingService } from '../../services/cardBillingService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { aiSettingsService } from '../../services/aiSettingsService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { Timestamp } from '../../types/timestamp';

interface CardBillingManagerProps {
    cards: Card[];
    loadingCards: boolean;
    onRefreshCards: () => void;
}

const createEmptyLineItem = (): CardBillingCostItem => ({
    id: uuidv4(),
    label: '',
    amount: 0,
    type: 'VARIABLE',
    category: 'OTHER'
});

const computeTotals = (lineItems: CardBillingCostItem[] = []) => {
    const total = lineItems.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
    return {
        variableCost: total,
        totalAmount: total
    };
};

export const CardBillingManager: React.FC<CardBillingManagerProps> = ({ cards, loadingCards, onRefreshCards }) => {
    const [yearMonth, setYearMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [issuedToType, setIssuedToType] = useState<CardBillingIssuedToType>('team');
    const [issuedToWorkerId, setIssuedToWorkerId] = useState<string>('');
    const [createCardId, setCreateCardId] = useState<string>('');

    const [documents, setDocuments] = useState<CardBillingDocument[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [analyzingAttachment, setAnalyzingAttachment] = useState(false);
    const [selectedAttachmentPath, setSelectedAttachmentPath] = useState<string>('');
    const [isAiEnabledOnPage, setIsAiEnabledOnPage] = useState(true);
    const [newLineItemLabel, setNewLineItemLabel] = useState('');
    const [newLineItemCategory, setNewLineItemCategory] = useState('');
    const [newLineItemAmount, setNewLineItemAmount] = useState<number>(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setIsAiEnabledOnPage(aiSettingsService.isPathEnabled(window.location.pathname));
    }, []);

    useEffect(() => {
        const loadMaster = async () => {
            try {
                const [teamList, workerList] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers()
                ]);
                const sortedTeams = [...teamList].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'));
                setTeams(sortedTeams);
                setWorkers(workerList);
                setSelectedTeamId((prev) => prev || (sortedTeams[0]?.id ?? ''));
            } catch (error) {
                console.error(error);
                toast.error('팀/작업자 정보를 불러오지 못했습니다.');
            }
        };

        loadMaster();
    }, []);

    useEffect(() => {
        setCreateCardId((prev) => prev || (cards[0]?.id ?? ''));
    }, [cards]);

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

    const selectedTeam = useMemo(() => {
        return teams.find((team) => String(team.id) === String(selectedTeamId) || String(team.legacyId ?? '') === String(selectedTeamId)) ?? null;
    }, [teams, selectedTeamId]);

    const teamWorkers = useMemo(() => {
        if (!selectedTeamId) return [];

        const teamIdCandidates = new Set<string>();
        if (selectedTeam?.id) teamIdCandidates.add(String(selectedTeam.id));
        if (selectedTeam?.legacyId) teamIdCandidates.add(String(selectedTeam.legacyId));
        teamIdCandidates.add(String(selectedTeamId));

        return workers.filter((worker) => Boolean(worker.id) && worker.teamId && teamIdCandidates.has(String(worker.teamId)));
    }, [workers, selectedTeamId, selectedTeam]);

    const canEdit = selectedDocument?.status !== 'CONFIRMED';

    const selectedTotals = useMemo(() => {
        return computeTotals(selectedDocument?.lineItems ?? []);
    }, [selectedDocument]);

    useEffect(() => {
        const paths = selectedDocument?.statementAttachmentPaths ?? [];
        setSelectedAttachmentPath((prev) => {
            if (prev && paths.includes(prev)) return prev;
            return paths[paths.length - 1] ?? '';
        });
    }, [selectedDocument]);

    useEffect(() => {
        if (issuedToType === 'team') {
            if (issuedToWorkerId) setIssuedToWorkerId('');
            return;
        }

        if (!teamWorkers.some((worker) => worker.id === issuedToWorkerId)) {
            setIssuedToWorkerId(teamWorkers[0]?.id ?? '');
        }
    }, [issuedToType, issuedToWorkerId, teamWorkers]);

    useEffect(() => {
        setNewLineItemLabel('');
        setNewLineItemCategory('');
        setNewLineItemAmount(0);
    }, [selectedDocumentId]);

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

    const handleCreateNew = async () => {
        const card = cards.find((item) => String(item.id) === String(createCardId)) ?? null;
        if (!card) {
            toast.error('카드를 선택해주세요.');
            return;
        }

        if (!selectedTeam?.id) {
            toast.error('발행 팀을 선택해주세요.');
            return;
        }

        const target = issuedToType === 'worker'
            ? (() => {
                const worker = teamWorkers.find((item) => String(item.id) === String(issuedToWorkerId));
                return worker?.id ? { id: worker.id, name: worker.name } : null;
            })()
            : null;

        if (issuedToType === 'worker' && !target) {
            toast.error('발행 대상을 선택해주세요.');
            return;
        }

        setProcessing(true);
        try {
            const generatedDocs = await cardBillingService.generateAssignmentBillings(card, yearMonth);
            const teamCandidates = new Set(
                [selectedTeam.id, selectedTeam.legacyId, selectedTeamId]
                    .filter(Boolean)
                    .map((value) => String(value))
            );
            const workerCandidates = new Set(
                [target?.id, issuedToWorkerId]
                    .filter(Boolean)
                    .map((value) => String(value))
            );
            const next = generatedDocs.find((doc) => (
                teamCandidates.has(String(doc.teamId ?? '')) &&
                doc.issuedToType === issuedToType &&
                (
                    issuedToType !== 'worker' ||
                    workerCandidates.has(String(doc.issuedToWorkerId ?? ''))
                )
            ));

            if (!next) {
                toast.error('선택한 청구 대상에 해당하는 배정 이력/사용 내역이 없습니다.');
                return;
            }

            const resolvedId = next.id;

            if (documents.some((doc) => doc.id === resolvedId)) {
                const ok = await showConfirmAlert('청구서 생성', '이미 해당 카드의 청구서가 존재합니다. 재계산하여 덮어쓸까요?');
                if (!ok.isConfirmed) return;
            }

            await cardBillingService.saveBilling(next);
            toast.success('청구서가 생성되었습니다.');
            await loadBillings();
            setSelectedDocumentId(resolvedId);
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : '청구서 생성에 실패했습니다.';
            toast.error(msg);
        } finally {
            setProcessing(false);
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

            const generatedGroups = await Promise.all(targets.map((c) => cardBillingService.generateAssignmentBillings(c, yearMonth)));
            const docs = generatedGroups.reduce<CardBillingDocument[]>((acc, list) => acc.concat(list), []);
            if (docs.length === 0) {
                toast.info('배정 이력 기준으로 청구할 카드 사용 내역이 없습니다.');
                return;
            }

            const confirmedIds = new Set(
                documents
                    .filter((doc) => doc.status === 'CONFIRMED')
                    .map((doc) => doc.id)
            );
            let skippedConfirmed = 0;
            for (const doc of docs) {
                if (confirmedIds.has(doc.id)) {
                    skippedConfirmed += 1;
                    continue;
                }
                await cardBillingService.saveBilling(doc);
            }
            if (skippedConfirmed > 0) {
                toast.info(`확정 문서 ${skippedConfirmed}건은 유지했습니다.`);
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

    const handleDocumentPatch = (patch: Partial<CardBillingDocument>) => {
        if (!selectedDocument) return;
        updateSelectedDocument((doc) => ({
            ...doc,
            ...patch,
            updatedAt: Timestamp.now()
        }));
    };

    const handleLineItemChange = (id: string, patch: Partial<CardBillingCostItem>) => {
        if (!selectedDocument || !canEdit) return;

        const lineItems = (selectedDocument.lineItems ?? []).map((item) => (
            item.id === id ? { ...item, ...patch } : item
        ));
        const totals = computeTotals(lineItems);
        handleDocumentPatch({
            lineItems,
            variableCost: totals.variableCost,
            totalAmount: totals.totalAmount
        });
    };

    const handleAddLineItem = () => {
        if (!selectedDocument || !canEdit) return;
        const label = newLineItemLabel.trim();
        if (!label) {
            toast.error('항목명을 입력해주세요.');
            return;
        }

        const nextItem: CardBillingCostItem = {
            ...createEmptyLineItem(),
            label,
            amount: Number(newLineItemAmount || 0),
            category: newLineItemCategory.trim() || 'OTHER'
        };
        const lineItems = [...(selectedDocument.lineItems ?? []), nextItem];
        const totals = computeTotals(lineItems);

        handleDocumentPatch({
            lineItems,
            variableCost: totals.variableCost,
            totalAmount: totals.totalAmount
        });
        setNewLineItemLabel('');
        setNewLineItemCategory('');
        setNewLineItemAmount(0);
    };

    const handleRemoveLineItem = (id?: string) => {
        if (!selectedDocument || !canEdit || !id) return;
        const lineItems = (selectedDocument.lineItems ?? []).filter((item) => item.id !== id);
        const totals = computeTotals(lineItems);
        handleDocumentPatch({
            lineItems,
            variableCost: totals.variableCost,
            totalAmount: totals.totalAmount
        });
    };

    const handleSaveSelected = async () => {
        if (!selectedDocument) return;

        setSaving(true);
        try {
            const totals = computeTotals(selectedDocument.lineItems ?? []);
            await cardBillingService.saveBilling({
                ...selectedDocument,
                variableCost: totals.variableCost,
                totalAmount: totals.totalAmount,
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
        if (!canEdit) return;

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

    const handleCancelConfirmSelected = async () => {
        if (!selectedDocument || selectedDocument.status !== 'CONFIRMED') return;

        const result = await showConfirmAlert('확정 취소', '선택한 카드 청구서의 확정을 취소하고 다시 수정 가능하게 변경할까요?', '확정 취소');
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await cardBillingService.saveBilling({
                ...selectedDocument,
                status: 'DRAFT',
                confirmedAt: null as unknown as Timestamp,
                updatedAt: Timestamp.now()
            });
            toast.success('확정이 취소되었습니다.');
            await loadBillings();
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '확정 취소에 실패했습니다.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (!selectedDocument) return;

        const result = await showConfirmAlert('카드 청구 취소', '선택한 카드 청구서를 취소할까요? 취소하면 해당 청구 문서가 삭제됩니다.', '청구 취소');
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await cardBillingService.deleteBilling(selectedDocument.id);
            toast.success('카드 청구가 취소되었습니다.');
            await loadBillings();
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : '청구 취소에 실패했습니다.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900">카드 청구관리</h2>
                        <p className="text-slate-500 font-medium mt-1 text-sm">차량과 같은 방식으로 발행 팀/대상을 지정하고 카드 사용내역 기반 청구서를 생성합니다.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-end gap-2">
                            <div>
                                <div className="text-xs font-bold text-slate-500 mb-1">청구 월</div>
                                <input
                                    type="month"
                                    className="border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-700"
                                    value={yearMonth}
                                    onChange={(e) => setYearMonth(e.target.value)}
                                />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-500 mb-1">발행 팀</div>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm min-w-[220px]"
                                >
                                    <option value="">팀 선택</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-500 mb-1">발행 대상</div>
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setIssuedToType('team')}
                                            className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                                                issuedToType === 'team' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faUsers} />
                                            팀
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIssuedToType('worker')}
                                            className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                                                issuedToType === 'worker' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faUser} />
                                            개인
                                        </button>
                                    </div>
                                    {issuedToType === 'team' ? (
                                        <input
                                            value={selectedTeam?.name ?? ''}
                                            disabled
                                            placeholder="팀 선택"
                                            className="px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm w-[160px]"
                                        />
                                    ) : (
                                        <select
                                            value={issuedToWorkerId}
                                            onChange={(e) => setIssuedToWorkerId(e.target.value)}
                                            className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm w-[160px]"
                                        >
                                            <option value="">작업자 선택</option>
                                            {teamWorkers.map((worker) => (
                                                <option key={worker.id} value={worker.id}>
                                                    {worker.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <select
                                value={createCardId}
                                onChange={(e) => setCreateCardId(e.target.value)}
                                className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm min-w-[240px]"
                            >
                                {cards
                                    .slice()
                                    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                    .map((card) => (
                                        <option key={card.id} value={card.id}>
                                            {card.name} ({card.last4})
                                        </option>
                                    ))}
                            </select>
                            <button
                                onClick={handleCreateNew}
                                disabled={processing || loadingCards}
                                className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 ${
                                    processing ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                카드 청구서 생성
                            </button>
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
                                    processing ? 'bg-slate-400 cursor-wait' : 'bg-slate-800 hover:bg-slate-900'
                                }`}
                            >
                                <FontAwesomeIcon icon={faCalculator} />
                                {processing ? '생성 중...' : '배정 카드 일괄 생성'}
                            </button>
                        </div>
                    </div>
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
                                        disabled={saving || !canEdit}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-2 ${
                                            saving || !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                        저장
                                    </button>
                                    <button
                                        onClick={handleConfirmSelected}
                                        disabled={saving || !canEdit}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-2 ${
                                            saving || !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faCheckDouble} />
                                        확정
                                    </button>
                                    {selectedDocument.status === 'CONFIRMED' && (
                                        <button
                                            onClick={handleCancelConfirmSelected}
                                            disabled={saving}
                                            className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-2 ${
                                                saving ? 'opacity-60 cursor-wait' : ''
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faRotateLeft} />
                                            확정 취소
                                        </button>
                                    )}
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={saving}
                                        className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-2 ${
                                            saving ? 'opacity-60 cursor-wait' : ''
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                        청구 삭제
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-xs font-bold text-slate-500">변동비</div>
                                    <div className="text-2xl font-extrabold text-slate-800 font-mono mt-1">
                                        {Number(selectedTotals.variableCost ?? 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-xs font-bold text-slate-500">총액</div>
                                    <div className="text-2xl font-extrabold text-indigo-700 font-mono mt-1">
                                        {Number(selectedTotals.totalAmount ?? 0).toLocaleString()}
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
                                <div className="px-4 py-3 bg-slate-900 text-white flex flex-col xl:flex-row xl:items-end justify-between gap-3">
                                    <div className="font-extrabold text-sm">라인 아이템</div>
                                    {canEdit && (
                                        <div className="flex flex-wrap items-end gap-2 text-slate-900">
                                            <input
                                                value={newLineItemLabel}
                                                onChange={(e) => setNewLineItemLabel(e.target.value)}
                                                className="px-3 py-2 rounded-xl text-sm min-w-[220px]"
                                                placeholder="항목명"
                                            />
                                            <input
                                                value={newLineItemCategory}
                                                onChange={(e) => setNewLineItemCategory(e.target.value)}
                                                className="px-3 py-2 rounded-xl text-sm w-[140px]"
                                                placeholder="카테고리"
                                            />
                                            <input
                                                type="number"
                                                value={Number(newLineItemAmount || 0)}
                                                onChange={(e) => setNewLineItemAmount(Number(e.target.value || 0))}
                                                className="px-3 py-2 rounded-xl text-sm text-right font-mono w-[150px]"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddLineItem}
                                                className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-2"
                                            >
                                                <FontAwesomeIcon icon={faPlus} />
                                                추가
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[720px]">
                                        <thead className="bg-slate-100 text-slate-600 text-xs font-bold">
                                            <tr>
                                                <th className="px-4 py-3 text-left">항목</th>
                                                <th className="px-4 py-3 text-left">카테고리</th>
                                                <th className="px-4 py-3 text-right">금액</th>
                                                <th className="px-4 py-3 text-right w-[80px]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(selectedDocument.lineItems ?? []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-6 text-slate-400 text-center">라인 아이템이 없습니다.</td>
                                                </tr>
                                            ) : (
                                                (selectedDocument.lineItems ?? []).map((li, index) => (
                                                    <tr key={li.id ?? index} className="hover:bg-indigo-50/20">
                                                        <td className="px-4 py-3">
                                                            <input
                                                                value={li.label}
                                                                disabled={!canEdit}
                                                                onChange={(e) => li.id && handleLineItemChange(li.id, { label: e.target.value })}
                                                                className={`w-full px-3 py-2 border rounded-xl text-sm font-bold ${
                                                                    canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-50'
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                value={li.category ?? ''}
                                                                disabled={!canEdit}
                                                                onChange={(e) => li.id && handleLineItemChange(li.id, { category: e.target.value })}
                                                                className={`w-full px-3 py-2 border rounded-xl text-sm ${
                                                                    canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-50'
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <input
                                                                type="number"
                                                                value={Number(li.amount ?? 0)}
                                                                disabled={!canEdit}
                                                                onChange={(e) => li.id && handleLineItemChange(li.id, { amount: Number(e.target.value || 0) })}
                                                                className={`w-full px-3 py-2 border rounded-xl text-right font-mono font-extrabold ${
                                                                    canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-50'
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveLineItem(li.id)}
                                                                disabled={!canEdit}
                                                                className={`w-9 h-9 rounded-xl inline-flex items-center justify-center ${
                                                                    canEdit ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                            </button>
                                                        </td>
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
