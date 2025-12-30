import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble, faFloppyDisk, faPlus, faTrash, faFileInvoiceDollar, faCalendarAlt, faUser, faUsers, faMoneyBillWave, faSearch } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { companyService } from '../../services/companyService';
import { accommodationBillingService } from '../../services/accommodationBillingService';
import {
    AccommodationBillingDocument,
    AccommodationBillingIssuedToType,
    AccommodationBillingLineItem,
    AccommodationBillingTargetField
} from '../../types/accommodationBilling';
import { useNavigate } from 'react-router-dom';
import { StartOfMonth, FormatYearMonth } from '../../utils/dateUtils';
import { toast } from '../../utils/swal';

const TARGET_FIELD_OPTIONS: Array<{ value: AccommodationBillingTargetField; label: string }> = [
    { value: 'accommodation', label: '숙소비' },
    { value: 'privateRoom', label: '개인방' },
    { value: 'electricity', label: '전기료' },
    { value: 'gas', label: '도시가스' },
    { value: 'internet', label: '인터넷' },
    { value: 'water', label: '수도세' },
    { value: 'fines', label: '과태료' },
    { value: 'deposit', label: '보증금' },
    { value: 'gloves', label: '장갑' }
];

const createEmptyLineItem = (): AccommodationBillingLineItem => {
    return {
        id: uuidv4(),
        label: '',
        amount: 0,
        targetField: 'accommodation'
    };
};

const buildNewDocument = (params: {
    yearMonth: string;
    team: Team;
    issuedToType: AccommodationBillingIssuedToType;
    issuedToWorker: { id: string; name: string };
}): AccommodationBillingDocument => {
    const id = accommodationBillingService.buildBillingDocumentId({
        teamId: params.team.id ?? '',
        issuedToType: params.issuedToType,
        workerId: params.issuedToWorker.id,
        yearMonth: params.yearMonth
    });

    return {
        id,
        yearMonth: params.yearMonth,
        teamId: params.team.id ?? '',
        teamName: params.team.name,
        issuedToType: params.issuedToType,
        issuedToWorkerId: params.issuedToWorker.id,
        issuedToWorkerName: params.issuedToWorker.name,
        status: 'draft',
        memo: '',
        lineItems: [createEmptyLineItem()]
    };
};

const AccommodationBillingManager: React.FC = () => {
    const navigate = useNavigate();
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);

    const [yearMonth, setYearMonth] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [issuedToType, setIssuedToType] = useState<AccommodationBillingIssuedToType>('team_leader');
    const [issuedToWorkerId, setIssuedToWorkerId] = useState<string>('');

    const [documents, setDocuments] = useState<AccommodationBillingDocument[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');

    const [draft, setDraft] = useState<AccommodationBillingDocument | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        const loadMaster = async () => {
            const [teamList, workerList, constructionCompanies] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                companyService.getCompaniesByType('시공사')
            ]);

            const constructionCompanyIdSet = new Set(
                constructionCompanies
                    .map((c) => c.id)
                    .filter((id): id is string => Boolean(id))
            );
            const constructionCompanyNameSet = new Set(constructionCompanies.map((c) => c.name));

            const allowedTeams = teamList.filter((team) => {
                if (team.companyId) return constructionCompanyIdSet.has(team.companyId);
                if (team.companyName) return constructionCompanyNameSet.has(team.companyName);
                return false;
            });

            const sortedTeams = [...allowedTeams].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'));
            setTeams(sortedTeams);
            setWorkers(workerList);

            // Default select first team if available
            if (sortedTeams.length > 0) {
                setSelectedTeamId(sortedTeams[0].id ?? '');
            }
        };

        loadMaster().catch((e) => {
            console.error(e);
            toast.error('기본 데이터를 불러오는데 실패했습니다.');
        });
    }, []);

    const selectedTeam = useMemo(() => {
        return teams.find((t) => t.id === selectedTeamId);
    }, [teams, selectedTeamId]);

    const teamWorkers = useMemo(() => {
        if (!selectedTeamId) return [];
        return workers.filter((w) => w.teamId === selectedTeamId && Boolean(w.id));
    }, [workers, selectedTeamId]);

    const teamLeader = useMemo(() => {
        if (!selectedTeam?.leaderId) return null;
        const leader = teamWorkers.find((w) => w.id === selectedTeam.leaderId);
        if (!leader?.id) return null;
        return { id: leader.id, name: leader.name };
    }, [selectedTeam?.leaderId, teamWorkers]);

    useEffect(() => {
        if (!selectedTeamId) {
            setDocuments([]);
            setSelectedDocumentId('');
            setDraft(null);
            return;
        }

        const loadDocs = async () => {
            setLoading(true);
            try {
                const docs = await accommodationBillingService.getBillingDocuments({
                    teamId: selectedTeamId,
                    yearMonth
                });
                setDocuments(docs);
            } catch (e) {
                console.error(e);
                toast.error('청구서 목록을 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        loadDocs();
    }, [selectedTeamId, yearMonth]);

    useEffect(() => {
        if (!selectedDocumentId) return;
        const found = documents.find((d) => d.id === selectedDocumentId);
        if (!found) return;
        setDraft(found);

        setIssuedToType(found.issuedToType);
        setIssuedToWorkerId(found.issuedToWorkerId);
    }, [documents, selectedDocumentId]);

    useEffect(() => {
        if (issuedToType === 'team_leader') {
            setIssuedToWorkerId(teamLeader?.id ?? '');
            return;
        }

        if (!teamWorkers.some((w) => w.id === issuedToWorkerId)) {
            const first = teamWorkers.find((w) => Boolean(w.id));
            setIssuedToWorkerId(first?.id ?? '');
        }
    }, [issuedToType, teamLeader?.id, teamWorkers, issuedToWorkerId]);

    const canEdit = draft?.status !== 'confirmed';

    const canGoToAdvance = Boolean(
        draft &&
        draft.status === 'confirmed' &&
        draft.teamId &&
        draft.yearMonth &&
        draft.issuedToWorkerId &&
        draft.postedAdvancePaymentId
    );

    const handleGoToAdvancePayment = () => {
        if (!draft) return;
        if (!draft.teamId || !draft.yearMonth || !draft.issuedToWorkerId) return;

        navigate(
            `/payroll/advance-payment?teamId=${encodeURIComponent(draft.teamId)}&yearMonth=${encodeURIComponent(draft.yearMonth)}&highlightWorkerId=${encodeURIComponent(draft.issuedToWorkerId)}`
        );
    };

    const handleCreateNew = () => {
        if (!selectedTeam || !selectedTeam.id) {
            toast.error('팀을 선택해주세요.');
            return;
        }

        const target = issuedToType === 'team_leader'
            ? teamLeader
            : (() => {
                const w = teamWorkers.find((x) => x.id === issuedToWorkerId);
                return w?.id ? { id: w.id, name: w.name } : null;
            })();

        if (!target) {
            toast.error(issuedToType === 'team_leader' ? '팀장의 작업자 정보가 없습니다.' : '청구 대상을 선택해주세요.');
            return;
        }

        const newDoc = buildNewDocument({
            yearMonth,
            team: selectedTeam,
            issuedToType,
            issuedToWorker: target
        });

        // Check availability
        if (documents.some(d => d.id === newDoc.id)) {
            const confirmOverwrite = window.confirm('이미 해당 대상의 청구서가 존재합니다. 덮어쓰시겠습니까?');
            if (!confirmOverwrite) return;
        }

        setDraft(newDoc);
        setSelectedDocumentId(newDoc.id);
        toast.success('새 청구서 양식이 생성되었습니다.');
    };

    const handleDraftChange = (next: Partial<AccommodationBillingDocument>) => {
        if (!draft) return;
        setDraft({ ...draft, ...next });
    };

    const handleLineItemChange = (id: string, patch: Partial<AccommodationBillingLineItem>) => {
        if (!draft) return;
        const nextItems = draft.lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li));
        setDraft({ ...draft, lineItems: nextItems });
    };

    const handleAddLineItem = () => {
        if (!draft) return;
        setDraft({ ...draft, lineItems: [...draft.lineItems, createEmptyLineItem()] });
    };

    const handleRemoveLineItem = (id: string) => {
        if (!draft) return;
        const next = draft.lineItems.filter((li) => li.id !== id);
        setDraft({ ...draft, lineItems: next.length > 0 ? next : [createEmptyLineItem()] });
    };

    const handleSave = async () => {
        if (!draft) {
            toast.error('저장할 청구서가 없습니다.');
            return;
        }

        if (!draft.teamId || !draft.yearMonth || !draft.issuedToWorkerId) {
            toast.error('필수 정보(팀/월/대상)가 누락되었습니다.');
            return;
        }

        if (draft.status === 'confirmed') {
            toast.error('확정된 청구서는 수정할 수 없습니다.');
            return;
        }

        setSaving(true);
        try {
            const resolvedIssuedToWorkerName =
                issuedToType === 'team_leader'
                    ? (teamLeader?.name ?? draft.issuedToWorkerName)
                    : (teamWorkers.find((w) => w.id === issuedToWorkerId)?.name ?? draft.issuedToWorkerName);

            const resolvedId = accommodationBillingService.buildBillingDocumentId({
                teamId: draft.teamId,
                issuedToType,
                workerId: issuedToWorkerId,
                yearMonth: draft.yearMonth
            });

            const upsertDoc: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'> = {
                ...draft,
                id: resolvedId,
                teamName: selectedTeam?.name ?? draft.teamName,
                issuedToWorkerName: resolvedIssuedToWorkerName,
                issuedToType,
                issuedToWorkerId
            };

            await accommodationBillingService.upsertBillingDocument(upsertDoc);
            toast.success('저장되었습니다.');

            setSelectedDocumentId(resolvedId);
            setDraft({ ...upsertDoc });

            const docs = await accommodationBillingService.getBillingDocuments({
                teamId: draft.teamId,
                yearMonth: draft.yearMonth
            });
            setDocuments(docs);
        } catch (e) {
            console.error(e);
            toast.error('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirm = async () => {
        if (!draft) return;
        if (draft.status === 'confirmed') return;

        const ok = window.confirm('확정하면 가불/공제(공제 항목)로 자동 반영됩니다.\n\n계속하시겠습니까?');
        if (!ok) return;

        setSaving(true);
        try {
            const resolvedIssuedToWorkerName =
                issuedToType === 'team_leader'
                    ? (teamLeader?.name ?? draft.issuedToWorkerName)
                    : (teamWorkers.find((w) => w.id === issuedToWorkerId)?.name ?? draft.issuedToWorkerName);

            const resolvedId = accommodationBillingService.buildBillingDocumentId({
                teamId: draft.teamId,
                issuedToType,
                workerId: issuedToWorkerId,
                yearMonth: draft.yearMonth
            });

            const upsertDoc: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'> = {
                ...draft,
                id: resolvedId,
                teamName: selectedTeam?.name ?? draft.teamName,
                issuedToWorkerName: resolvedIssuedToWorkerName,
                issuedToType,
                issuedToWorkerId
            };

            await accommodationBillingService.upsertBillingDocument(upsertDoc);
            await accommodationBillingService.confirmAndPostToAdvancePayment(resolvedId);
            toast.success('확정 및 반영이 완료되었습니다.');

            const docs = await accommodationBillingService.getBillingDocuments({
                teamId: draft.teamId,
                yearMonth: draft.yearMonth
            });
            setDocuments(docs);
            const found = docs.find((d) => d.id === resolvedId);
            if (found) setDraft(found);
            setSelectedDocumentId(resolvedId);
        } catch (e) {
            console.error(e);
            toast.error('확정 처리에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const total = useMemo(() => {
        return draft ? accommodationBillingService.calculateLineItemsTotal(draft.lineItems) : 0;
    }, [draft]);

    const totalDocsAmount = useMemo(() => {
        return documents.reduce((sum, d) => sum + accommodationBillingService.calculateLineItemsTotal(d.lineItems), 0);
    }, [documents]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[600px]">
            {/* Left Sidebar: Controls & List */}
            <div className="w-full lg:w-96 flex flex-col gap-6 h-full">

                {/* 1. Filter Control */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faSearch} className="text-indigo-500" />
                        검색 조건
                    </h3>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">청구 월</label>
                        <input
                            type="month"
                            value={yearMonth}
                            onChange={(e) => setYearMonth(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-indigo-100 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">팀 선택</label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-indigo-100 outline-none font-medium"
                        >
                            <option value="">팀 선택...</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 2. Document List Directory */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">청구서 목록</div>
                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {documents.length}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-sm">불러오는 중...</div>
                        ) : documents.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-2xl opacity-20" />
                                <span>청구서 없음</span>
                            </div>
                        ) : (
                            documents
                                .sort((a, b) => a.issuedToWorkerName.localeCompare(b.issuedToWorkerName, 'ko-KR'))
                                .map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setSelectedDocumentId(d.id)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden
                                            ${selectedDocumentId === d.id
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm text-slate-700'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-bold text-sm ${selectedDocumentId === d.id ? 'text-white' : 'text-slate-800'}`}>
                                                {d.issuedToWorkerName}
                                            </span>
                                            {d.status === 'confirmed' ? (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selectedDocumentId === d.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    확정
                                                </span>
                                            ) : (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selectedDocumentId === d.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                    임시
                                                </span>
                                            )}
                                        </div>
                                        <div className={`text-xs ${selectedDocumentId === d.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                                            {accommodationBillingService.calculateLineItemsTotal(d.lineItems).toLocaleString()}원
                                        </div>
                                    </button>
                                ))
                        )}
                    </div>
                    {documents.length > 0 && (
                        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
                            <div className="text-xs text-slate-500 font-bold">전체 합계</div>
                            <div className="text-lg font-bold text-indigo-600">{totalDocsAmount.toLocaleString()}원</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Editor Area */}
            <div className="flex-1 flex flex-col gap-6">

                {/* Editor Header / New Creation Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex flex-col xl:flex-row gap-5 items-end justify-between">
                        <div className="flex gap-4 items-end w-full xl:w-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">청구 대상 유형</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setIssuedToType('team_leader')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${issuedToType === 'team_leader' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        팀장
                                    </button>
                                    <button
                                        onClick={() => setIssuedToType('worker')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${issuedToType === 'worker' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        개인
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 xl:w-64">
                                <label className="block text-xs font-bold text-slate-500 mb-1">대상자 선택</label>
                                {issuedToType === 'team_leader' ? (
                                    <input
                                        type="text"
                                        value={teamLeader ? `${teamLeader.name}` : ''}
                                        disabled
                                        className="w-full border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600"
                                        placeholder="팀장 정보 없음"
                                    />
                                ) : (
                                    <select
                                        value={issuedToWorkerId}
                                        onChange={(e) => setIssuedToWorkerId(e.target.value)}
                                        className="w-full border-slate-300 rounded-lg text-sm"
                                    >
                                        <option value="">작업자 선택</option>
                                        {teamWorkers.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <button
                                onClick={handleCreateNew}
                                className="px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm hover:shadow-md active:translate-y-0.5"
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                생성
                            </button>
                        </div>
                    </div>
                </div>

                {/* Draft Editor */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
                    {!draft ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-6xl mb-4 opacity-20" />
                            <span className="text-lg font-bold opacity-40">청구서를 선택하거나 새로 생성하세요</span>
                        </div>
                    ) : (
                        <>
                            {/* Invoice Header */}
                            <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-bold text-slate-800">청구서</h2>
                                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${draft.status === 'confirmed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                            {draft.status === 'confirmed' ? 'CONFIRMED' : 'DRAFT'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        No. <span className="font-mono">{draft.id.slice(0, 8)}...</span>
                                    </div>
                                    <div className="mt-4 flex gap-8">
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">청구 대상</div>
                                            <div className="font-bold text-slate-700 text-lg">{draft.issuedToWorkerName}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">팀</div>
                                            <div className="font-bold text-slate-700 text-lg">{draft.teamName}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">총 청구액</div>
                                    <div className="text-3xl font-extrabold text-indigo-600">{total.toLocaleString()}원</div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">메모 / 비고</label>
                                    <input
                                        type="text"
                                        value={draft.memo ?? ''}
                                        onChange={(e) => handleDraftChange({ memo: e.target.value })}
                                        disabled={!canEdit}
                                        className="w-full border-b border-slate-200 pb-2 text-sm focus:border-indigo-500 outline-none transition-colors bg-transparent placeholder-slate-300"
                                        placeholder="특이사항을 입력하세요..."
                                    />
                                </div>

                                <table className="w-full text-sm">
                                    <thead className="text-left text-slate-400 font-bold border-b-2 border-slate-100 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="pb-3 w-12">No.</th>
                                            <th className="pb-3">항목명</th>
                                            <th className="pb-3 w-40">급여 반영 항목</th>
                                            <th className="pb-3 w-48 text-right">금액</th>
                                            <th className="pb-3 w-16 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {draft.lineItems.map((li, idx) => (
                                            <tr key={li.id} className="group">
                                                <td className="py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                <td className="py-3">
                                                    <input
                                                        type="text"
                                                        value={li.label}
                                                        onChange={(e) => handleLineItemChange(li.id, { label: e.target.value })}
                                                        disabled={!canEdit}
                                                        className="w-full bg-slate-50 border-none rounded px-3 py-2 focus:ring-2 focus:ring-indigo-100 transition-all font-medium placeholder-slate-300"
                                                        placeholder="항목 입력"
                                                    />
                                                </td>
                                                <td className="py-3 px-2">
                                                    <select
                                                        value={li.targetField}
                                                        onChange={(e) => handleLineItemChange(li.id, { targetField: e.target.value as AccommodationBillingTargetField })}
                                                        disabled={!canEdit}
                                                        className="w-full bg-white border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 transition-all"
                                                    >
                                                        {TARGET_FIELD_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="py-3">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={li.amount}
                                                            onChange={(e) => handleLineItemChange(li.id, { amount: parseInt(e.target.value || '0', 10) || 0 })}
                                                            disabled={!canEdit}
                                                            className="w-full bg-slate-50 border-none rounded px-3 py-2 text-right font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                                                        />
                                                        <span className="absolute right-8 top-2 text-slate-400 text-xs pointer-events-none hidden">원</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveLineItem(li.id)}
                                                        disabled={!canEdit}
                                                        className={`w-8 h-8 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 ${!canEdit && 'hidden'}`}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {canEdit && (
                                    <button
                                        onClick={handleAddLineItem}
                                        className="mt-4 w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-slate-50 transition-all font-bold text-sm flex items-center justify-center gap-2"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        항목 추가하기
                                    </button>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="bg-slate-50 p-5 border-t border-slate-200 flex items-center justify-between">
                                <div>
                                    {canGoToAdvance && (
                                        <button
                                            onClick={handleGoToAdvancePayment}
                                            className="px-4 py-2 rounded-lg font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={faMoneyBillWave} />
                                            가불/공제 내역 확인
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !canEdit}
                                        className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2
                                            ${saving || !canEdit
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}
                                        `}
                                    >
                                        <FontAwesomeIcon icon={faFloppyDisk} />
                                        임시 저장
                                    </button>

                                    <button
                                        onClick={handleConfirm}
                                        disabled={saving || !canEdit}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-white transition flex items-center gap-2 shadow-lg hover:-translate-y-0.5
                                            ${saving || !canEdit
                                                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}
                                        `}
                                    >
                                        <FontAwesomeIcon icon={faCheckDouble} />
                                        확정 및 반영
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccommodationBillingManager;
