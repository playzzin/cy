import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble, faFloppyDisk, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
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
        };

        loadMaster().catch((e) => {
            console.error(e);
            alert('기본 데이터를 불러오는데 실패했습니다.');
        });
    }, []);

    useEffect(() => {
        if (!selectedTeamId) return;
        const exists = teams.some((t) => t.id === selectedTeamId);
        if (!exists) {
            setSelectedTeamId('');
        }
    }, [selectedTeamId, teams]);

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
                alert('청구서 목록을 불러오는데 실패했습니다.');
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
            alert('팀을 선택해주세요.');
            return;
        }

        const target = issuedToType === 'team_leader'
            ? teamLeader
            : (() => {
                const w = teamWorkers.find((x) => x.id === issuedToWorkerId);
                return w?.id ? { id: w.id, name: w.name } : null;
            })();

        if (!target) {
            alert(issuedToType === 'team_leader' ? '팀장의 작업자 정보가 없습니다.' : '청구 대상을 선택해주세요.');
            return;
        }

        const newDoc = buildNewDocument({
            yearMonth,
            team: selectedTeam,
            issuedToType,
            issuedToWorker: target
        });

        setDraft(newDoc);
        setSelectedDocumentId(newDoc.id);
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
            alert('저장할 청구서가 없습니다.');
            return;
        }

        if (!draft.teamId || !draft.yearMonth || !draft.issuedToWorkerId) {
            alert('필수 정보(팀/월/대상)가 누락되었습니다.');
            return;
        }

        if (draft.status === 'confirmed') {
            alert('확정된 청구서는 수정할 수 없습니다.');
            return;
        }

        setSaving(true);
        try {
            const resolvedTeamName = selectedTeam?.name ?? draft.teamName;
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
                issuedToWorkerName:
                    resolvedIssuedToWorkerName,
                issuedToType,
                issuedToWorkerId
            };

            await accommodationBillingService.upsertBillingDocument(upsertDoc);
            alert('저장되었습니다.');

            setSelectedDocumentId(resolvedId);
            setDraft({ ...upsertDoc });

            const docs = await accommodationBillingService.getBillingDocuments({
                teamId: draft.teamId,
                yearMonth: draft.yearMonth
            });
            setDocuments(docs);
        } catch (e) {
            console.error(e);
            alert('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirm = async () => {
        if (!draft) return;
        if (draft.status === 'confirmed') return;

        const ok = window.confirm('확정하면 가불/공제(공제 항목)로 자동 반영됩니다. 계속할까요?');
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
            alert('확정 및 반영이 완료되었습니다.');

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
            alert('확정 처리에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const total = useMemo(() => {
        return draft ? accommodationBillingService.calculateLineItemsTotal(draft.lineItems) : 0;
    }, [draft]);

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">월</label>
                        <input
                            type="month"
                            value={yearMonth}
                            onChange={(e) => setYearMonth(e.target.value)}
                            className="w-full border-slate-300 rounded-lg text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">팀</label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">팀 선택</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">청구 대상</label>
                        <select
                            value={issuedToType}
                            onChange={(e) => setIssuedToType(e.target.value as AccommodationBillingIssuedToType)}
                            className="w-full border-slate-300 rounded-lg text-sm"
                        >
                            <option value="team_leader">팀장</option>
                            <option value="worker">개인</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">대상 작업자</label>
                        {issuedToType === 'team_leader' ? (
                            <input
                                type="text"
                                value={teamLeader ? `${teamLeader.name}` : ''}
                                disabled
                                className="w-full border-slate-300 rounded-lg text-sm bg-slate-100"
                                placeholder="팀장을 찾을 수 없습니다"
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
                </div>

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition"
                    >
                        새 청구서
                    </button>

                    <div className="flex-1" />

                    <button
                        onClick={handleGoToAdvancePayment}
                        disabled={!canGoToAdvance}
                        className={`px-4 py-2 rounded-lg font-bold text-white transition flex items-center gap-2
                            ${!canGoToAdvance ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                        `}
                        type="button"
                    >
                        가불/공제 이동
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving || !draft || !canEdit}
                        className={`px-4 py-2 rounded-lg font-bold text-white transition flex items-center gap-2
                            ${saving || !draft || !canEdit ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}
                        `}
                    >
                        <FontAwesomeIcon icon={faFloppyDisk} />
                        저장
                    </button>

                    <button
                        onClick={handleConfirm}
                        disabled={saving || !draft || !canEdit}
                        className={`px-4 py-2 rounded-lg font-bold text-white transition flex items-center gap-2
                            ${saving || !draft || !canEdit ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}
                        `}
                    >
                        <FontAwesomeIcon icon={faCheckDouble} />
                        확정 및 반영
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-sm font-bold text-slate-700 mb-3">청구서 목록</div>
                    {loading ? (
                        <div className="text-sm text-slate-400">불러오는 중...</div>
                    ) : documents.length === 0 ? (
                        <div className="text-sm text-slate-400">청구서가 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {documents
                                .slice()
                                .sort((a, b) => a.issuedToWorkerName.localeCompare(b.issuedToWorkerName, 'ko-KR'))
                                .map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setSelectedDocumentId(d.id)}
                                        className={`w-full text-left p-3 rounded-lg border transition
                                            ${selectedDocumentId === d.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}
                                        `}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="font-bold text-slate-800 text-sm">{d.issuedToWorkerName}</div>
                                            <div className={`text-xs font-bold px-2 py-0.5 rounded ${d.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {d.status === 'confirmed' ? '확정' : '임시'}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">{d.yearMonth}</div>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-2">
                    <div className="flex justify-between items-center mb-3">
                        <div className="text-sm font-bold text-slate-700">청구 항목</div>
                        <div className="text-sm font-bold text-slate-800">합계: {total.toLocaleString()}원</div>
                    </div>

                    {!draft ? (
                        <div className="text-sm text-slate-400 py-16 text-center">청구서를 선택하거나 새로 생성하세요.</div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">메모</label>
                                <input
                                    type="text"
                                    value={draft.memo ?? ''}
                                    onChange={(e) => handleDraftChange({ memo: e.target.value })}
                                    disabled={!canEdit}
                                    className="w-full border-slate-300 rounded-lg text-sm"
                                    placeholder="메모"
                                />
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[680px]">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                                        <tr>
                                            <th className="p-2 text-left">항목</th>
                                            <th className="p-2 text-left w-40">반영 컬럼</th>
                                            <th className="p-2 text-right w-40">금액</th>
                                            <th className="p-2 text-center w-16">삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {draft.lineItems.map((li) => (
                                            <tr key={li.id} className="hover:bg-slate-50">
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        value={li.label}
                                                        onChange={(e) => handleLineItemChange(li.id, { label: e.target.value })}
                                                        disabled={!canEdit}
                                                        className="w-full border border-slate-200 rounded px-2 py-1"
                                                        placeholder="예: 전기세"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        value={li.targetField}
                                                        onChange={(e) => handleLineItemChange(li.id, { targetField: e.target.value as AccommodationBillingTargetField })}
                                                        disabled={!canEdit}
                                                        className="w-full border border-slate-200 rounded px-2 py-1"
                                                    >
                                                        {TARGET_FIELD_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={li.amount}
                                                        onChange={(e) => handleLineItemChange(li.id, { amount: parseInt(e.target.value || '0', 10) || 0 })}
                                                        disabled={!canEdit}
                                                        className="w-full border border-slate-200 rounded px-2 py-1 text-right font-mono"
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        onClick={() => handleRemoveLineItem(li.id)}
                                                        disabled={!canEdit}
                                                        className={`p-2 rounded ${!canEdit ? 'text-slate-300' : 'text-red-500 hover:bg-red-50'}`}
                                                        type="button"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddLineItem}
                                    disabled={!canEdit}
                                    className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2
                                        ${!canEdit ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}
                                    `}
                                    type="button"
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                    항목 추가
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccommodationBillingManager;
