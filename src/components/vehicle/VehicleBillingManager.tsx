import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalculator, faCheckDouble, faFileInvoiceDollar, faFloppyDisk, faPlus, faSearch, faTrash, faUser, faUsers } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { companyService } from '../../services/companyService';
import { vehicleBillingService } from '../../services/vehicleBillingService';
import { vehicleService } from '../../services/vehicleService';
import { VehicleBillingDocument, VehicleBillingIssuedToType } from '../../types/vehicleBilling';
import { toast, showConfirmAlert } from '../../utils/swal';
import { format, subMonths } from 'date-fns';
import { Vehicle } from '../../types/vehicle';
import { Timestamp } from '../../types/timestamp';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';

type DraftStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'OVERDUE';

const createEmptyLineItem = () => {
    return {
        id: uuidv4(),
        label: '',
        amount: 0,
        type: 'VARIABLE' as const,
        category: 'OTHER'
    };
};

const getLedgerRowIdSuffix = (id?: string): string => {
    const match = String(id ?? '').match(/(__row_.+)$/);
    return match ? match[1] : '';
};

const computeTotals = (draft: VehicleBillingDocument) => {
    const fixedCost = (draft.lineItems ?? []).filter((li) => li.type === 'FIXED').reduce((sum, li) => sum + (li.amount || 0), 0);
    const variableCost = (draft.lineItems ?? []).filter((li) => li.type === 'VARIABLE').reduce((sum, li) => sum + (li.amount || 0), 0);
    const totalAmount = fixedCost + variableCost;
    return { fixedCost, variableCost, totalAmount };
};

export const VehicleBillingManager: React.FC = () => {
    const [yearMonth, setYearMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [issuedToType, setIssuedToType] = useState<VehicleBillingIssuedToType>('team');
    const [issuedToWorkerId, setIssuedToWorkerId] = useState<string>('');

    const [documents, setDocuments] = useState<VehicleBillingDocument[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
    const [draft, setDraft] = useState<VehicleBillingDocument | null>(null);

    const [newLineItemType, setNewLineItemType] = useState<'FIXED' | 'VARIABLE'>('VARIABLE');
    const [newLineItemLabel, setNewLineItemLabel] = useState<string>('');
    const [newLineItemAmount, setNewLineItemAmount] = useState<number>(0);

    const [createVehicleId, setCreateVehicleId] = useState<string>('');
    const [search, setSearch] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadMaster = async () => {
            try {
                const [vehicleList, teamList, companyList, workerList] = await Promise.all([
                    vehicleService.getVehicles(),
                    teamService.getTeams(),
                    companyService.getCompanies(),
                    manpowerService.getWorkers()
                ]);

                setVehicles(vehicleList);
                setCreateVehicleId((prev) => prev || (vehicleList[0]?.id ?? ''));

                const selectableTeams = buildCheongyeonEngTeams(teamList, companyList);
                setTeams(selectableTeams);
                setWorkers(workerList);
                setSelectedTeamId((prev) => prev || (selectableTeams[0]?.id ?? ''));
            } catch (e) {
                console.error(e);
                setVehicles([]);
                setTeams([]);
                setWorkers([]);
            }
        };

        loadMaster();
    }, []);

    const selectedTeam = useMemo(() => {
        return teams.find((t) => t.id === selectedTeamId);
    }, [teams, selectedTeamId]);

    const resolveTeamSelectionId = (rawId: string) => {
        const raw = rawId ? String(rawId) : '';
        if (!raw) return '';
        const hit = teams.find((t) => String(t.id) === raw || String(t.legacyId ?? '') === raw);
        return hit?.id ?? raw;
    };

    useEffect(() => {
        if (!selectedTeamId) return;
        if (selectedTeam) return;
        const normalized = resolveTeamSelectionId(selectedTeamId);
        if (normalized && normalized !== selectedTeamId) {
            setSelectedTeamId(normalized);
        }
    }, [teams, selectedTeamId, selectedTeam]);

    const teamWorkers = useMemo(() => {
        if (!selectedTeamId) return [];

        const team = teams.find((t) => String(t.id) === String(selectedTeamId) || String(t.legacyId ?? '') === String(selectedTeamId));
        const teamIdCandidates = new Set<string>();
        if (team?.id) teamIdCandidates.add(String(team.id));
        if (team?.legacyId) teamIdCandidates.add(String(team.legacyId));
        teamIdCandidates.add(String(selectedTeamId));

        return workers.filter((w) => Boolean(w.id) && w.teamId && teamIdCandidates.has(String(w.teamId)));
    }, [workers, selectedTeamId, teams]);

    const teamLeader = useMemo(() => {
        if (!selectedTeam?.leaderId) return null;
        const leader = teamWorkers.find((w) => w.id === selectedTeam.leaderId);
        if (!leader?.id) return null;
        return { id: leader.id, name: leader.name };
    }, [selectedTeam?.leaderId, teamWorkers]);

    useEffect(() => {
        loadBillings();
    }, [yearMonth]);

    const loadBillings = async () => {
        setLoading(true);
        try {
            const data = await vehicleBillingService.getBillingsByMonth(yearMonth);
            const sorted = data
                .slice()
                .sort((a, b) => {
                    const plateCmp = String(a.vehiclePlate ?? '').localeCompare(String(b.vehiclePlate ?? ''), 'ko-KR');
                    if (plateCmp !== 0) return plateCmp;
                    const teamCmp = String(a.teamName ?? a.assignedTeamName ?? '').localeCompare(String(b.teamName ?? b.assignedTeamName ?? ''), 'ko-KR');
                    if (teamCmp !== 0) return teamCmp;
                    return String(a.issuedToWorkerName ?? '').localeCompare(String(b.issuedToWorkerName ?? ''), 'ko-KR');
                });
            setDocuments(sorted);

            setSelectedDocumentId((prev) => {
                if (prev && sorted.some((d) => d.id === prev)) return prev;
                return sorted[0]?.id ?? '';
            });
        } catch (error) {
            console.error(error);
            toast.error("청구서 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedDocumentId) {
            setDraft(null);
            return;
        }
        const found = documents.find((d) => d.id === selectedDocumentId) ?? null;
        setDraft(found);

        if (found) {
            const nextTeamId = found.teamId ?? found.assignedTeamId ?? '';
            setSelectedTeamId(resolveTeamSelectionId(nextTeamId));
            const normalizedIssuedToType = (found.issuedToType === 'team_leader' ? 'team' : (found.issuedToType ?? 'team')) as VehicleBillingIssuedToType;
            setIssuedToType(normalizedIssuedToType);
            setIssuedToWorkerId(normalizedIssuedToType === 'worker' ? (found.issuedToWorkerId ?? '') : '');
        }
    }, [documents, selectedDocumentId]);

    useEffect(() => {
        setNewLineItemType('VARIABLE');
        setNewLineItemLabel('');
        setNewLineItemAmount(0);
    }, [draft?.id]);

    useEffect(() => {
        const normalizedIssuedToType = issuedToType === 'team_leader' ? 'team' : issuedToType;
        if (normalizedIssuedToType === 'team') {
            if (issuedToWorkerId) setIssuedToWorkerId('');
            return;
        }

        if (!teamWorkers.some((w) => w.id === issuedToWorkerId)) {
            const first = teamWorkers.find((w) => Boolean(w.id));
            setIssuedToWorkerId(first?.id ?? '');
        }
    }, [issuedToType, teamWorkers, issuedToWorkerId]);

    useEffect(() => {
        if (!draft) return;

        const normalizedIssuedToType = issuedToType === 'team_leader' ? 'team' : issuedToType;

        const resolvedIssuedToWorkerName =
            normalizedIssuedToType === 'team'
                ? (selectedTeam?.name ?? draft.teamName ?? draft.assignedTeamName ?? '')
                : (teamWorkers.find((w) => w.id === issuedToWorkerId)?.name ?? draft.issuedToWorkerName);

        setDraft((prev) => {
            if (!prev) return prev;

            const nextTeamId = selectedTeamId || prev.teamId;
            const nextTeamName = selectedTeam?.name ?? prev.teamName;
            const nextWorkerId = normalizedIssuedToType === 'team' ? '' : (issuedToWorkerId || prev.issuedToWorkerId);

            const shouldUpdate =
                String(prev.teamId ?? '') !== String(nextTeamId ?? '') ||
                String(prev.teamName ?? '') !== String(nextTeamName ?? '') ||
                String(prev.issuedToType ?? '') !== String(issuedToType ?? '') ||
                String(prev.issuedToWorkerId ?? '') !== String(nextWorkerId ?? '') ||
                String(prev.issuedToWorkerName ?? '') !== String(resolvedIssuedToWorkerName ?? '');

            if (!shouldUpdate) return prev;

            return {
                ...prev,
                teamId: nextTeamId,
                teamName: nextTeamName,
                issuedToType: normalizedIssuedToType,
                issuedToWorkerId: normalizedIssuedToType === 'worker' ? nextWorkerId : undefined,
                issuedToWorkerName: resolvedIssuedToWorkerName
            };
        });
    }, [draft?.id, issuedToType, issuedToWorkerId, selectedTeamId, selectedTeam?.name, teamWorkers]);

    const handleCalculate = async () => {
        const result = await showConfirmAlert(
            "청구서 계산",
            `${yearMonth}월 DRAFT 청구서를 재계산하시겠습니까? (확정된 문서는 변경되지 않습니다.)`
        );
        if (!result.isConfirmed) return;

        setProcessing(true);
        try {
            const generatedGroups = await Promise.all(
                vehicles.map((vehicle) => vehicleBillingService.generateAssignmentBillings(vehicle, yearMonth))
            );
            const targets = generatedGroups.reduce<VehicleBillingDocument[]>((acc, list) => acc.concat(list), []);
            if (targets.length === 0) {
                toast.info('재계산할 DRAFT 문서가 없습니다.');
                return;
            }

            const confirmedIds = new Set(
                documents
                    .filter((doc) => doc.status === 'CONFIRMED')
                    .map((doc) => doc.id)
            );
            let skipped = 0;
            for (const doc of targets) {
                if (confirmedIds.has(doc.id)) {
                    skipped += 1;
                    continue;
                }
                await vehicleBillingService.saveBilling(doc);
            }
            if (skipped > 0) {
                toast.info(`확정 문서 ${skipped}건은 유지했습니다.`);
            }

            const successMessage = skipped > 0
                ? `배정 이력 기준 차량 청구 초안 반영 완료 (대상 ${targets.length}건 중 확정 ${skipped}건 유지)`
                : `배정 이력 기준 차량 청구 초안 반영 완료 (${targets.length}건)`;

            const msg = skipped > 0
                ? `재계산 완료 (대상 ${targets.length}건 중 ${skipped}건은 차량 매칭 실패로 스킵)`
                : `재계산 완료 (${targets.length}건)`;

            toast.success(successMessage);
            await loadBillings();
        } catch (error) {
            console.error(error);
            toast.error("계산에 실패했습니다.");
        } finally {
            setProcessing(false);
        }
    };

    const selectedVehicle = useMemo(() => {
        if (!draft?.vehicleId) return null;
        return vehicles.find((v) => String(v.id) === String(draft.vehicleId)) ?? null;
    }, [vehicles, draft?.vehicleId]);

    const draftTotals = useMemo(() => {
        if (!draft) return { fixedCost: 0, variableCost: 0, totalAmount: 0 };
        return computeTotals(draft);
    }, [draft]);

    const canEdit = draft?.status !== 'CONFIRMED';

    const totals = useMemo(() => {
        return documents.reduce(
            (acc, d) => {
                acc.fixed += d.fixedCost || 0;
                acc.variable += d.variableCost || 0;
                acc.total += d.totalAmount || 0;
                return acc;
            },
            { fixed: 0, variable: 0, total: 0 }
        );
    }, [documents]);

    const visibleDocuments = useMemo(() => {
        const q = search.trim();
        if (!q) return documents;
        return documents.filter((d) => {
            const plate = String(d.vehiclePlate ?? '');
            const team = String(d.teamName ?? d.assignedTeamName ?? '');
            const issuedTo = String(d.issuedToWorkerName ?? '');
            return plate.includes(q) || team.includes(q) || issuedTo.includes(q);
        });
    }, [documents, search]);

    const handleCreateNew = async () => {
        const vehicle = vehicles.find((v) => String(v.id) === String(createVehicleId)) ?? null;
        if (!vehicle) {
            toast.error('차량을 선택해주세요.');
            return;
        }

        if (!selectedTeam || !selectedTeam.id) {
            toast.error('발행 팀을 선택해주세요.');
            return;
        }

        const normalizedIssuedToType = issuedToType === 'team_leader' ? 'team' : issuedToType;
        const target = normalizedIssuedToType === 'worker'
            ? (() => {
                const w = teamWorkers.find((x) => x.id === issuedToWorkerId);
                return w?.id ? { id: w.id, name: w.name } : null;
            })()
            : null;

        if (normalizedIssuedToType === 'worker' && !target) {
            toast.error('발행 대상을 선택해주세요.');
            return;
        }

        setProcessing(true);
        try {
            const generatedDocs = await vehicleBillingService.generateAssignmentBillings(vehicle, yearMonth);
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
            const withIssue = generatedDocs.find((doc) => (
                teamCandidates.has(String(doc.teamId ?? '')) &&
                doc.issuedToType === normalizedIssuedToType &&
                (
                    normalizedIssuedToType !== 'worker' ||
                    workerCandidates.has(String(doc.issuedToWorkerId ?? ''))
                )
            ));

            if (!withIssue) {
                toast.error('선택한 청구 대상에 해당하는 배정 이력/금액이 없습니다.');
                return;
            }

            const resolvedId = withIssue.id;

            const exists = documents.some((d) => d.id === resolvedId);

            if (exists) {
                const ok = await showConfirmAlert('청구서 생성', '이미 해당 차량의 청구서가 존재합니다. 재계산하여 덮어쓸까요?');
                if (!ok.isConfirmed) return;
            }

            await vehicleBillingService.saveBilling(withIssue);
            await loadBillings();
            setSelectedDocumentId(resolvedId);
            toast.success('청구서가 생성되었습니다.');
        } catch (e) {
            console.error(e);
            toast.error('청구서 생성에 실패했습니다.');
        } finally {
            setProcessing(false);
        }
    };

    const handleDraftChange = (patch: Partial<VehicleBillingDocument>) => {
        if (!draft) return;
        setDraft({ ...draft, ...patch });
    };

    const handleLineItemChange = (id: string, patch: Partial<VehicleBillingDocument['lineItems'][number]>) => {
        if (!draft) return;
        const items = (draft.lineItems ?? []).map((li) => (li.id === id ? { ...li, ...patch } : li));
        setDraft({ ...draft, lineItems: items });
    };

    const handleAddLineItemFromForm = () => {
        if (!draft) return;
        if (!canEdit) return;

        const label = newLineItemLabel.trim();
        if (!label) {
            toast.error('항목명을 입력해주세요.');
            return;
        }

        const amount = Number(newLineItemAmount || 0);
        const nextItem = {
            ...createEmptyLineItem(),
            type: newLineItemType,
            label,
            amount,
            category: 'OTHER'
        };

        const items = [...(draft.lineItems ?? []), nextItem];
        setDraft({ ...draft, lineItems: items });
        setNewLineItemType('VARIABLE');
        setNewLineItemLabel('');
        setNewLineItemAmount(0);
    };

    const handleRemoveLineItem = (id: string) => {
        if (!draft) return;
        const items = (draft.lineItems ?? []).filter((li) => li.id !== id);
        setDraft({ ...draft, lineItems: items });
    };

    const handleSave = async () => {
        if (!draft) return;

        if (!selectedTeamId) {
            toast.error('발행 팀을 선택해주세요.');
            return;
        }

        const normalizedIssuedToType = issuedToType === 'team_leader' ? 'team' : issuedToType;
        if (normalizedIssuedToType === 'worker' && !issuedToWorkerId) {
            toast.error('발행 대상을 선택해주세요.');
            return;
        }

        setSaving(true);
        try {
            const computed = computeTotals(draft);

            const resolvedIssuedToWorkerName =
                normalizedIssuedToType === 'team'
                    ? (selectedTeam?.name ?? draft.teamName ?? draft.assignedTeamName ?? '')
                    : (teamWorkers.find((w) => w.id === issuedToWorkerId)?.name ?? draft.issuedToWorkerName);

            const resolvedId = vehicleBillingService.buildBillingDocumentId({
                vehicleId: draft.vehicleId,
                teamId: selectedTeamId,
                issuedToType: normalizedIssuedToType as any,
                workerId: normalizedIssuedToType === 'worker' ? issuedToWorkerId : undefined,
                yearMonth: draft.yearMonth
            });
            const nextId = `${resolvedId}${getLedgerRowIdSuffix(draft.id)}`;

            const next: VehicleBillingDocument = {
                ...draft,
                id: nextId,
                fixedCost: computed.fixedCost,
                variableCost: computed.variableCost,
                totalAmount: computed.totalAmount,
                teamId: selectedTeamId,
                teamName: selectedTeam?.name ?? draft.teamName,
                issuedToType: normalizedIssuedToType,
                issuedToWorkerId: normalizedIssuedToType === 'worker' ? issuedToWorkerId : undefined,
                issuedToWorkerName: resolvedIssuedToWorkerName,
                status: (draft.status || 'DRAFT') as DraftStatus
            };
            await vehicleBillingService.saveBilling(next);
            toast.success('저장되었습니다.');
            await loadBillings();
            setSelectedDocumentId(nextId);
        } catch (e) {
            console.error(e);
            toast.error('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirm = async () => {
        if (!draft) return;

        if (!selectedTeamId) {
            toast.error('발행 팀을 선택해주세요.');
            return;
        }

        const normalizedIssuedToType = issuedToType === 'team_leader' ? 'team' : issuedToType;
        if (normalizedIssuedToType === 'worker' && !issuedToWorkerId) {
            toast.error('발행 대상을 선택해주세요.');
            return;
        }

        const result = await showConfirmAlert('확정 처리', '해당 청구서를 확정할까요? (확정 후 편집이 제한됩니다)');
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            const computed = computeTotals(draft);

            const resolvedIssuedToWorkerName =
                normalizedIssuedToType === 'team'
                    ? (selectedTeam?.name ?? draft.teamName ?? draft.assignedTeamName ?? '')
                    : (teamWorkers.find((w) => w.id === issuedToWorkerId)?.name ?? draft.issuedToWorkerName);

            const resolvedId = vehicleBillingService.buildBillingDocumentId({
                vehicleId: draft.vehicleId,
                teamId: selectedTeamId,
                issuedToType: normalizedIssuedToType as any,
                workerId: normalizedIssuedToType === 'worker' ? issuedToWorkerId : undefined,
                yearMonth: draft.yearMonth
            });
            const nextId = `${resolvedId}${getLedgerRowIdSuffix(draft.id)}`;

            const next: VehicleBillingDocument = {
                ...draft,
                id: nextId,
                fixedCost: computed.fixedCost,
                variableCost: computed.variableCost,
                totalAmount: computed.totalAmount,
                teamId: selectedTeamId,
                teamName: selectedTeam?.name ?? draft.teamName,
                issuedToType: normalizedIssuedToType,
                issuedToWorkerId: normalizedIssuedToType === 'worker' ? issuedToWorkerId : undefined,
                issuedToWorkerName: resolvedIssuedToWorkerName,
                status: 'CONFIRMED',
                confirmedAt: Timestamp.now() as any
            };
            await vehicleBillingService.saveBilling(next);
            toast.success('확정되었습니다.');
            await loadBillings();
            setSelectedDocumentId(nextId);
        } catch (e) {
            console.error(e);
            toast.error('확정에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-600" />
                            차량 청구관리
                        </h2>
                        <div className="flex items-center gap-3 ml-2">
                            <span className="text-sm font-bold text-slate-600">청구 월</span>
                            <input
                                type="month"
                                value={yearMonth}
                                onChange={(e) => setYearMonth(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex flex-col md:flex-row md:items-end gap-2">
                            <div>
                                <div className="text-xs font-bold text-slate-500 mb-1">발행 팀</div>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm min-w-[220px]"
                                >
                                    {teams
                                        .filter((t) => Boolean(t.id))
                                        .map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <div className="text-xs font-bold text-slate-500 mb-1">발행 대상</div>
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setIssuedToType('team')}
                                            className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1 ${issuedToType === 'team' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            type="button"
                                        >
                                            <FontAwesomeIcon icon={faUsers} />
                                            팀
                                        </button>
                                        <button
                                            onClick={() => setIssuedToType('worker')}
                                            className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1 ${issuedToType === 'worker' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            type="button"
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
                                            className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm w-[160px]"
                                        />
                                    ) : (
                                        <select
                                            value={issuedToWorkerId}
                                            onChange={(e) => setIssuedToWorkerId(e.target.value)}
                                            className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm w-[160px]"
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
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={createVehicleId}
                                onChange={(e) => setCreateVehicleId(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm min-w-[240px]"
                            >
                                {vehicles
                                    .slice()
                                    .sort((a, b) => String(a.licensePlate).localeCompare(String(b.licensePlate), 'ko-KR'))
                                    .map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.licensePlate} ({v.model})
                                        </option>
                                    ))}
                            </select>
                            <button
                                onClick={handleCreateNew}
                                disabled={processing}
                                className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 ${processing ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                차량 청구서 생성
                            </button>
                        </div>

                        <button
                            onClick={handleCalculate}
                            disabled={processing}
                            className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 ${processing ? 'bg-slate-400 cursor-wait' : 'bg-slate-800 hover:bg-slate-900 hover:-translate-y-0.5'
                                }`}
                        >
                            <FontAwesomeIcon icon={faCalculator} />
                            DRAFT 재계산
                        </button>
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-6 text-right">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">고정비</p>
                        <p className="font-extrabold text-slate-700 font-mono">{totals.fixed.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">변동비</p>
                        <p className="font-extrabold text-slate-700 font-mono">{totals.variable.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">합계</p>
                        <p className="font-extrabold text-indigo-700 text-xl font-mono">{totals.total.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="차량번호/팀/대상 검색"
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 text-xs text-slate-500 font-medium">
                                문서 {visibleDocuments.length}건
                            </div>
                        </div>

                        <div className="max-h-[720px] overflow-y-auto">
                            {loading ? (
                                <div className="p-10 text-center text-slate-400">불러오는 중...</div>
                            ) : visibleDocuments.length === 0 ? (
                                <div className="p-10 text-center text-slate-400">해당 월 청구서가 없습니다.</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {visibleDocuments.map((doc) => {
                                        const isSelected = doc.id === selectedDocumentId;
                                        return (
                                            <button
                                                key={doc.id}
                                                onClick={() => setSelectedDocumentId(doc.id)}
                                                className={`w-full text-left p-4 hover:bg-indigo-50/40 transition ${isSelected ? 'bg-indigo-50 ring-1 ring-indigo-100' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-extrabold text-slate-800">
                                                            {doc.vehiclePlate || '-'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {doc.teamName || doc.assignedTeamName ? `팀: ${doc.teamName ?? doc.assignedTeamName}` : '팀: -'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {doc.issuedToWorkerName ? `대상: ${doc.issuedToWorkerName}` : '대상: -'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-extrabold text-slate-800 font-mono">
                                                            {(doc.totalAmount || 0).toLocaleString()}
                                                        </div>
                                                        <div>
                                                            <span
                                                                className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold border ${doc.status === 'CONFIRMED'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                                                    }`}
                                                            >
                                                                {doc.status === 'CONFIRMED' ? '확정' : '작성중'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-8">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[720px]">
                        {!draft ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                선택된 청구서가 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div>
                                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            {draft.vehiclePlate || '-'}
                                        </div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">
                                            {selectedVehicle ? `${selectedVehicle.model} / ${selectedVehicle.type}` : ''}
                                        </div>
                                        <div className="text-sm text-slate-600 font-bold mt-3">
                                            발행 팀: {draft.teamName ?? draft.assignedTeamName ?? '-'}
                                        </div>
                                        <div className="text-sm text-slate-600 font-bold mt-1">
                                            발행 대상: {draft.issuedToWorkerName ?? '-'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={!canEdit || saving}
                                            className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 ${!canEdit || saving
                                                ? 'bg-indigo-300 cursor-not-allowed'
                                                : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
                                                }`}
                                        >
                                            <FontAwesomeIcon icon={faFloppyDisk} />
                                            저장
                                        </button>
                                        <button
                                            onClick={handleConfirm}
                                            disabled={!canEdit || saving}
                                            className={`px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 ${!canEdit || saving
                                                ? 'bg-emerald-300 cursor-not-allowed'
                                                : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5'
                                                }`}
                                        >
                                            <FontAwesomeIcon icon={faCheckDouble} />
                                            확정
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                                        <div className="text-xs text-slate-500 font-bold uppercase">고정비</div>
                                        <div className="text-xl font-extrabold text-slate-800 font-mono mt-1">{draftTotals.fixedCost.toLocaleString()}</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                                        <div className="text-xs text-slate-500 font-bold uppercase">변동비</div>
                                        <div className="text-xl font-extrabold text-slate-800 font-mono mt-1">{draftTotals.variableCost.toLocaleString()}</div>
                                    </div>
                                    <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
                                        <div className="text-xs text-indigo-600 font-bold uppercase">합계</div>
                                        <div className="text-xl font-extrabold text-indigo-700 font-mono mt-1">{draftTotals.totalAmount.toLocaleString()}</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-sm font-extrabold text-slate-800">메모</div>
                                    <textarea
                                        value={draft.memo ?? ''}
                                        disabled={!canEdit}
                                        onChange={(e) => handleDraftChange({ memo: e.target.value })}
                                        className={`w-full min-h-[90px] p-3 border rounded-2xl text-sm ${canEdit ? 'border-slate-200 focus:ring-2 focus:ring-indigo-100' : 'border-slate-100 bg-slate-50'
                                            }`}
                                    />
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                        <div className="text-sm font-extrabold text-slate-800">라인 아이템</div>
                                        <div className="flex flex-wrap items-end gap-2">
                                            <div>
                                                <div className="text-[11px] font-bold text-slate-500 mb-1">구분</div>
                                                <select
                                                    value={newLineItemType}
                                                    disabled={!canEdit}
                                                    onChange={(e) => setNewLineItemType(e.target.value as 'FIXED' | 'VARIABLE')}
                                                    className={`px-3 py-2 border rounded-xl bg-white text-xs font-bold ${canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-100 text-slate-400'
                                                        }`}
                                                >
                                                    <option value="FIXED">고정</option>
                                                    <option value="VARIABLE">변동</option>
                                                </select>
                                            </div>

                                            <div className="min-w-[220px]">
                                                <div className="text-[11px] font-bold text-slate-500 mb-1">항목</div>
                                                <input
                                                    value={newLineItemLabel}
                                                    disabled={!canEdit}
                                                    onChange={(e) => setNewLineItemLabel(e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-xl text-sm ${canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-100 text-slate-400'
                                                        }`}
                                                    placeholder="예: 주유비, 렌트료"
                                                />
                                            </div>

                                            <div className="min-w-[160px]">
                                                <div className="text-[11px] font-bold text-slate-500 mb-1">금액</div>
                                                <input
                                                    type="number"
                                                    value={Number(newLineItemAmount || 0)}
                                                    disabled={!canEdit}
                                                    onChange={(e) => setNewLineItemAmount(Number(e.target.value || 0))}
                                                    className={`w-full px-3 py-2 border rounded-xl text-right font-mono ${canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-100 text-slate-400'
                                                        }`}
                                                />
                                            </div>

                                            <button
                                                onClick={handleAddLineItemFromForm}
                                                disabled={!canEdit}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 ${canEdit ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    }`}
                                                type="button"
                                            >
                                                <FontAwesomeIcon icon={faPlus} />
                                                추가
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[820px]">
                                            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left w-[120px]">구분</th>
                                                    <th className="px-4 py-3 text-left">항목</th>
                                                    <th className="px-4 py-3 text-right w-[180px]">금액</th>
                                                    <th className="px-4 py-3 text-right w-[90px]"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(draft.lineItems ?? []).length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                                                            항목이 없습니다.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    (draft.lineItems ?? []).map((li) => (
                                                        <tr key={li.id} className="hover:bg-indigo-50/30">
                                                            <td className="px-4 py-3">
                                                                <select
                                                                    value={li.type}
                                                                    disabled={!canEdit}
                                                                    onChange={(e) => handleLineItemChange(li.id, { type: e.target.value as 'FIXED' | 'VARIABLE' })}
                                                                    className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold"
                                                                >
                                                                    <option value="FIXED">고정</option>
                                                                    <option value="VARIABLE">변동</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    value={li.label}
                                                                    disabled={!canEdit}
                                                                    onChange={(e) => handleLineItemChange(li.id, { label: e.target.value })}
                                                                    className={`w-full px-3 py-2 border rounded-xl text-sm ${canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-50'
                                                                        }`}
                                                                    placeholder="예: 주유비, 렌트료"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={Number(li.amount || 0)}
                                                                    disabled={!canEdit}
                                                                    onChange={(e) => handleLineItemChange(li.id, { amount: Number(e.target.value || 0) })}
                                                                    className={`w-full px-3 py-2 border rounded-xl text-right font-mono ${canEdit ? 'border-slate-200' : 'border-slate-100 bg-slate-50'
                                                                        }`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button
                                                                    onClick={() => handleRemoveLineItem(li.id)}
                                                                    disabled={!canEdit}
                                                                    className={`w-9 h-9 rounded-xl inline-flex items-center justify-center ${canEdit ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
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
        </div>
    );
};
