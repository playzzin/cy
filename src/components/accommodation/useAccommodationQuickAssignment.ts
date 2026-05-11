import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Accommodation } from '../../types/accommodation';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { companyService } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { AccommodationBillingTarget, AccommodationBillingTargetType } from '../../types/accommodationBillingTarget';
import { toast } from '../../utils/swal';

interface UseAccommodationQuickAssignmentParams {
    accommodation: Accommodation;
    activeAssignments: AccommodationAssignment[];
    isOpen: boolean;
    onSuccess: () => void;
}

interface TeamOption {
    id: string;
    name: string;
}

interface WorkerOption {
    key: string;
    workerId: string;
    workerName: string;
    teamName: string;
}

type AssignmentTargetType = 'team' | 'worker';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const getToday = (): string => format(new Date(), 'yyyy-MM-dd');

export const useAccommodationQuickAssignment = ({
    accommodation,
    activeAssignments,
    isOpen,
    onSuccess
}: UseAccommodationQuickAssignmentParams) => {
    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [billingSubmitting, setBillingSubmitting] = useState(false);

    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [currentBillingTarget, setCurrentBillingTarget] = useState<AccommodationBillingTarget | null>(null);

    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(getToday());
    const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
    const [assignmentTargetType, setAssignmentTargetType] = useState<AssignmentTargetType>('team');

    const [billingTargetType, setBillingTargetType] = useState<AccommodationBillingTargetType>('team');
    const [billingTeamId, setBillingTeamId] = useState('');
    const [billingTargetWorkerId, setBillingTargetWorkerId] = useState('');
    const [billingSelectionInitialized, setBillingSelectionInitialized] = useState(false);

    const teamByAnyId = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team: any) => {
            const teamId = normalizeKey(team?.id);
            const teamLegacyId = normalizeKey(team?.legacyId);
            if (teamId) map.set(teamId, team);
            if (teamLegacyId) map.set(teamLegacyId, team);
        });
        return map;
    }, [teams]);

    const teamByName = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const name = normalizeKey(team.name);
            if (!name || map.has(name)) return;
            map.set(name, team);
        });
        return map;
    }, [teams]);

    const workerByAnyId = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker: any) => {
            const workerId = normalizeKey(worker?.id);
            const workerLegacyId = normalizeKey(worker?.legacyId);
            if (workerId) map.set(workerId, worker);
            if (workerLegacyId) map.set(workerLegacyId, worker);
        });
        return map;
    }, [workers]);

    const assignmentWorkerOptions = useMemo<WorkerOption[]>(() => {
        return workers
            .map((worker: any) => {
                const workerId = normalizeKey(worker?.id) || normalizeKey(worker?.legacyId);
                const workerName = normalizeKey(worker?.name);
                if (!workerId || !workerName) return null;

                const matchedTeam = normalizeKey(worker?.teamId)
                    ? teamByAnyId.get(normalizeKey(worker?.teamId))
                    : undefined;

                return {
                    key: workerId,
                    workerId,
                    workerName,
                    teamName: normalizeKey(matchedTeam?.name ?? worker?.teamName) || '팀 미지정'
                };
            })
            .filter((item): item is WorkerOption => item !== null)
            .sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));
    }, [teamByAnyId, workers]);

    const selectedAssignmentWorkerId = selectedWorkerIds[0] ?? '';

    const setSelectedAssignmentWorkerId = useCallback((workerId: string) => {
        setSelectedWorkerIds(workerId ? [workerId] : []);
    }, []);

    const getBillingWorkerKey = useCallback((assignment: AccommodationAssignment): string => {
        const workerId = normalizeKey(assignment.workerId);
        if (workerId) return workerId;
        const workerName = normalizeKey(assignment.workerName);
        if (!workerName) return '';
        return `name:${workerName}`;
    }, []);

    const activeAssignmentsInScope = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return activeAssignments.filter((assignment) => {
            if ((assignment.status ?? 'active') === 'ended') return false;
            const endDateRaw = normalizeKey(assignment.endDate);
            if (!endDateRaw) return true;
            const endDate = new Date(endDateRaw);
            if (Number.isNaN(endDate.getTime())) return true;
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
        });
    }, [activeAssignments]);

    const billingTeamOptions = useMemo<TeamOption[]>(() => {
        const map = new Map<string, TeamOption>();
        const appendOption = (id: unknown, name: unknown) => {
            const normalizedId = normalizeKey(id);
            const normalizedName = normalizeKey(name);
            const key = normalizedId || (normalizedName ? `name:${normalizedName}` : '');
            const label = normalizedName || (normalizedId ? `팀ID:${normalizedId.slice(0, 8)}` : '');
            if (!key || !label || map.has(key)) return;
            map.set(key, { id: key, name: label });
        };

        if (currentBillingTarget?.targetType === 'team') {
            const rawTeamId = normalizeKey(currentBillingTarget.teamId);
            const matchedTeam = rawTeamId ? teamByAnyId.get(rawTeamId) : undefined;
            appendOption(matchedTeam?.id ?? rawTeamId, matchedTeam?.name ?? currentBillingTarget.teamName);
        }

        activeAssignmentsInScope.forEach((assignment) => {
            const rawTeamId = normalizeKey(assignment.teamId);
            const rawTeamName = normalizeKey(assignment.teamName);
            const matchedTeam = rawTeamId
                ? teamByAnyId.get(rawTeamId)
                : (rawTeamName ? teamByName.get(rawTeamName) : undefined);

            const canonicalId = normalizeKey(matchedTeam?.id ?? rawTeamId);
            const canonicalName =
                normalizeKey(matchedTeam?.name) ||
                rawTeamName ||
                (canonicalId ? `팀ID:${canonicalId.slice(0, 8)}` : '');
            appendOption(canonicalId, canonicalName);
        });

        teams.forEach((team) => {
            appendOption(team.id, team.name);
        });

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [activeAssignmentsInScope, currentBillingTarget, teamByAnyId, teamByName, teams]);

    const billingWorkerOptions = useMemo<WorkerOption[]>(() => {
        const map = new Map<string, WorkerOption>();
        const appendOption = (workerId: unknown, workerName: unknown, teamName: unknown) => {
            const normalizedWorkerId = normalizeKey(workerId);
            const normalizedWorkerName = normalizeKey(workerName);
            const normalizedTeamName = normalizeKey(teamName) || '팀 미지정';
            const key = normalizedWorkerId || (normalizedWorkerName ? `name:${normalizedWorkerName}` : '');
            if (!key || !normalizedWorkerName || map.has(key)) return;

            map.set(key, {
                key,
                workerId: normalizedWorkerId,
                workerName: normalizedWorkerName,
                teamName: normalizedTeamName
            });
        };

        if (currentBillingTarget?.targetType === 'worker') {
            const rawWorkerId = normalizeKey(currentBillingTarget.workerId);
            const matchedWorker = rawWorkerId ? workerByAnyId.get(rawWorkerId) : undefined;
            const matchedTeam = normalizeKey(matchedWorker?.teamId)
                ? teamByAnyId.get(normalizeKey(matchedWorker?.teamId))
                : undefined;
            appendOption(
                matchedWorker?.id ?? rawWorkerId,
                matchedWorker?.name ?? currentBillingTarget.workerName,
                matchedTeam?.name ?? matchedWorker?.teamName
            );
        }

        activeAssignmentsInScope.forEach((assignment) => {
            const key = getBillingWorkerKey(assignment);
            if (!key || map.has(key)) return;

            const workerId = normalizeKey(assignment.workerId);
            const workerName = normalizeKey(assignment.workerName) || (workerId ? `ID:${workerId.slice(0, 8)}` : '');
            if (!workerName) return;

            const matchedTeam = normalizeKey(assignment.teamId)
                ? teamByAnyId.get(normalizeKey(assignment.teamId))
                : undefined;
            const teamName = normalizeKey(matchedTeam?.name ?? assignment.teamName) || '팀 미지정';
            appendOption(workerId || key, workerName, teamName);
        });

        workers.forEach((worker) => {
            const matchedTeam = normalizeKey(worker.teamId)
                ? teamByAnyId.get(normalizeKey(worker.teamId))
                : undefined;
            appendOption(
                normalizeKey(worker.id) || normalizeKey(worker.legacyId),
                worker.name,
                matchedTeam?.name ?? worker.teamName
            );
        });

        return Array.from(map.values()).sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));
    }, [activeAssignmentsInScope, currentBillingTarget, getBillingWorkerKey, teamByAnyId, workerByAnyId, workers]);

    const filteredWorkers = useMemo(() => {
        if (!selectedTeamId) return [];
        let list = workers.filter((worker) => worker.teamId === selectedTeamId);
        if (workerSearch) {
            list = list.filter((worker) => worker.name.includes(workerSearch));
        }
        return list.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [selectedTeamId, workerSearch, workers]);

    const isSameWorker = useCallback(
        (assignment: AccommodationAssignment, selectedWorkerId: string): boolean => {
            const selectedRaw = normalizeKey(selectedWorkerId);
            if (!selectedRaw) return false;

            const assignmentName = normalizeKey(assignment.workerName);
            if (selectedRaw.startsWith('name:')) {
                const selectedName = normalizeKey(selectedRaw.slice('name:'.length));
                return selectedName.length > 0 && assignmentName === selectedName;
            }

            const selectedWorker = workerByAnyId.get(selectedRaw);
            const assignmentWorkerId = normalizeKey(assignment.workerId);
            if (assignmentWorkerId && assignmentWorkerId === selectedRaw) return true;

            if (selectedWorker) {
                const selectedWorkerPrimaryId = normalizeKey((selectedWorker as any)?.id);
                const selectedWorkerLegacyId = normalizeKey((selectedWorker as any)?.legacyId);
                if (
                    assignmentWorkerId &&
                    (assignmentWorkerId === selectedWorkerPrimaryId || assignmentWorkerId === selectedWorkerLegacyId)
                ) {
                    return true;
                }

                const selectedName = normalizeKey(selectedWorker.name);
                if (selectedName && assignmentName && selectedName === assignmentName) return true;
            }

            return false;
        },
        [workerByAnyId]
    );

    const loadDependencyData = useCallback(async () => {
        setLoadingData(true);
        try {
            const [teamsData, workersData, companies] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                companyService.getCompanies()
            ]);

            const cheongyeonCompanies = companies.filter((company: any) => company.name.includes('청연'));
            const cheongyeonIdSet = new Set(cheongyeonCompanies.map((company: any) => company.id).filter(Boolean));
            const cheongyeonNameSet = new Set(cheongyeonCompanies.map((company: any) => company.name));

            const filteredTeams = teamsData
                .filter((team: any) => {
                    if (team.companyId && cheongyeonIdSet.has(team.companyId)) return true;
                    if (team.companyName && cheongyeonNameSet.has(team.companyName)) return true;
                    return false;
                })
                .sort((a: Team, b: Team) => (a.name || '').localeCompare(b.name || '', 'ko-KR'));

            setTeams(filteredTeams);
            setWorkers(workersData);
        } catch (error) {
            console.error(error);
            toast.error('데이터를 불러오지 못했습니다.');
        } finally {
            setLoadingData(false);
        }
    }, []);

    const loadBillingTarget = useCallback(async () => {
        try {
            const target = await accommodationBillingTargetService.getTargetByAccommodationId(accommodation.id);
            setCurrentBillingTarget(target);
        } catch (error) {
            console.error(error);
            setCurrentBillingTarget(null);
        }
    }, [accommodation.id]);

    useEffect(() => {
        if (!isOpen) return;
        void Promise.all([loadDependencyData(), loadBillingTarget()]);
    }, [isOpen, loadDependencyData, loadBillingTarget]);

    useEffect(() => {
        if (!isOpen) {
            setBillingSelectionInitialized(false);
        }
    }, [isOpen]);

    useEffect(() => {
        setBillingSelectionInitialized(false);
    }, [accommodation.id]);

    useEffect(() => {
        if (!isOpen || billingSelectionInitialized) return;

        if (currentBillingTarget) {
            if (currentBillingTarget.targetType === 'worker') {
                setBillingTargetType('worker');
                const rawWorkerId = normalizeKey(currentBillingTarget.workerId);
                const canonicalWorkerId = normalizeKey(workerByAnyId.get(rawWorkerId)?.id ?? rawWorkerId);
                const fallbackWorkerName = normalizeKey(currentBillingTarget.workerName);
                const nextWorkerKey = canonicalWorkerId || (fallbackWorkerName ? `name:${fallbackWorkerName}` : '');
                const resolvedWorkerKey = billingWorkerOptions.some((option) => option.key === nextWorkerKey)
                    ? nextWorkerKey
                    : (billingWorkerOptions[0]?.key ?? nextWorkerKey);
                setBillingTargetWorkerId(resolvedWorkerKey);
                setBillingTeamId('');
            } else {
                setBillingTargetType('team');
                const rawTeamId = normalizeKey(currentBillingTarget.teamId);
                const canonicalTeamId = normalizeKey(teamByAnyId.get(rawTeamId)?.id ?? rawTeamId);
                const fallbackTeamName = normalizeKey(currentBillingTarget.teamName);
                const nextTeamId = canonicalTeamId || (fallbackTeamName ? `name:${fallbackTeamName}` : '');
                const resolvedTeamId = billingTeamOptions.some((option) => option.id === nextTeamId)
                    ? nextTeamId
                    : (billingTeamOptions[0]?.id ?? nextTeamId);
                setBillingTeamId(resolvedTeamId);
                setBillingTargetWorkerId('');
            }
            setBillingSelectionInitialized(true);
            return;
        }

        if (billingTeamOptions.length > 0) {
            setBillingTargetType('team');
            setBillingTeamId(billingTeamOptions[0].id);
            setBillingTargetWorkerId('');
            setBillingSelectionInitialized(true);
            return;
        }

        if (billingWorkerOptions.length > 0) {
            setBillingTargetType('worker');
            setBillingTargetWorkerId(billingWorkerOptions[0].key);
            setBillingTeamId('');
            setBillingSelectionInitialized(true);
        }
    }, [
        billingSelectionInitialized,
        billingTeamOptions,
        billingWorkerOptions,
        currentBillingTarget,
        isOpen,
        teamByAnyId,
        workerByAnyId
    ]);

    useEffect(() => {
        if (!isOpen || selectedTeamId || teams.length === 0) return;
        setSelectedTeamId(teams.find((team) => Boolean(team.id))?.id ?? '');
    }, [isOpen, selectedTeamId, teams]);

    useEffect(() => {
        if (!isOpen || selectedAssignmentWorkerId || assignmentWorkerOptions.length === 0) return;
        setSelectedAssignmentWorkerId(assignmentWorkerOptions[0].key);
    }, [assignmentWorkerOptions, isOpen, selectedAssignmentWorkerId, setSelectedAssignmentWorkerId]);

    const selectTeamBillingTarget = useCallback(() => {
        setBillingTargetType('team');
        if (!billingTeamId && billingTeamOptions.length > 0) {
            setBillingTeamId(billingTeamOptions[0].id);
        }
    }, [billingTeamId, billingTeamOptions]);

    const selectWorkerBillingTarget = useCallback(() => {
        setBillingTargetType('worker');
        if (!billingTargetWorkerId && billingWorkerOptions.length > 0) {
            setBillingTargetWorkerId(billingWorkerOptions[0].key);
        }
    }, [billingTargetWorkerId, billingWorkerOptions]);

    const handleToggleWorker = useCallback((id: string) => {
        setSelectedWorkerIds((previous) => {
            const exists = previous.includes(id);
            return exists ? previous.filter((workerId) => workerId !== id) : [...previous, id];
        });
    }, []);

    const handleEdit = useCallback((assignment: AccommodationAssignment) => {
        if (!assignment.id) return;
        setEditingAssignmentId(assignment.id);

        const hasWorker = assignment.source === 'worker' ||
            (assignment.source !== 'team' && Boolean(normalizeKey(assignment.workerId) || normalizeKey(assignment.workerName)));
        const rawTeamId = normalizeKey(assignment.teamId);
        const rawTeamName = normalizeKey(assignment.teamName);
        const resolvedTeam = rawTeamId ? teamByAnyId.get(rawTeamId) : (rawTeamName ? teamByName.get(rawTeamName) : undefined);

        setAssignmentTargetType(hasWorker ? 'worker' : 'team');
        setSelectedTeamId(normalizeKey(resolvedTeam?.id ?? rawTeamId));
        if (hasWorker) {
            const rawWorkerId = normalizeKey(assignment.workerId);
            const resolvedWorker = rawWorkerId ? workerByAnyId.get(rawWorkerId) : undefined;
            setSelectedAssignmentWorkerId(normalizeKey(resolvedWorker?.id ?? rawWorkerId));
        } else {
            setSelectedWorkerIds([]);
        }

        setStartDate(assignment.startDate);
        setWorkerSearch('');
    }, [setSelectedAssignmentWorkerId, teamByAnyId, teamByName, workerByAnyId]);

    const handleCancelEdit = useCallback(() => {
        setEditingAssignmentId(null);
        setSelectedWorkerIds([]);
        setAssignmentTargetType('team');
        setSelectedTeamId(teams.find((team) => Boolean(team.id))?.id ?? '');
        setStartDate(getToday());
        setWorkerSearch('');
    }, [teams]);

    const handleAssign = useCallback(async () => {
        if (!startDate) {
            toast.error('배정 시작일을 선택해주세요.');
            return;
        }

        const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId));
        const selectedWorker = workers.find((item) => String(item.id) === String(selectedAssignmentWorkerId));

        if (assignmentTargetType === 'team' && !selectedTeam) {
            toast.error('배정할 팀을 선택해주세요.');
            return;
        }

        if (assignmentTargetType === 'worker' && !selectedWorker) {
            toast.error('배정할 개인을 선택해주세요.');
            return;
        }

        const endDate = accommodationAssignmentService.buildEndDateAsDayBefore(startDate);
        const activeIdsToEnd = activeAssignmentsInScope
            .filter((assignment) => assignment.id && assignment.id !== editingAssignmentId)
            .map((assignment) => assignment.id)
            .filter((id): id is string => Boolean(id));

        const workerTeam = selectedWorker?.teamId ? teamByAnyId.get(String(selectedWorker.teamId)) : undefined;
        const nextAssignment = {
            workerId: assignmentTargetType === 'worker' ? String(selectedWorker?.id ?? '') : '',
            workerName: assignmentTargetType === 'worker' ? selectedWorker?.name ?? '' : '',
            teamId: assignmentTargetType === 'team'
                ? selectedTeam?.id
                : (workerTeam?.id ?? selectedWorker?.teamId),
            teamName: assignmentTargetType === 'team'
                ? selectedTeam?.name
                : (workerTeam?.name ?? selectedWorker?.teamName),
            accommodationId: accommodation.id,
            accommodationName: accommodation.name,
            status: 'active' as const,
            startDate,
            source: assignmentTargetType
        };

        setSubmitting(true);
        try {
            if (activeIdsToEnd.length > 0) {
                await accommodationAssignmentService.endAssignmentsBatch(activeIdsToEnd, endDate);
            }

            if (editingAssignmentId) {
                await accommodationAssignmentService.updateAssignment(editingAssignmentId, nextAssignment);
                toast.success('배정 정보가 수정되었습니다.');
                handleCancelEdit();
            } else {
                await accommodationAssignmentService.addAssignment(nextAssignment);
                toast.success('배정이 등록되었습니다.');
                setWorkerSearch('');
            }

            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('배정 저장에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    }, [
        accommodation.id,
        accommodation.name,
        activeAssignmentsInScope,
        assignmentTargetType,
        editingAssignmentId,
        handleCancelEdit,
        onSuccess,
        selectedAssignmentWorkerId,
        selectedTeamId,
        selectedWorkerIds,
        startDate,
        teamByAnyId,
        teams,
        workers
    ]);

    const handleApplyBillingTarget = useCallback(async () => {
        if (billingTargetType === 'team') {
            if (!billingTeamId) {
                toast.error('청구 대상 팀을 선택해주세요.');
                return;
            }
            const selectedOption = billingTeamOptions.find((option) => option.id === billingTeamId);
            if (!selectedOption) {
                toast.error('선택한 팀 정보를 확인할 수 없습니다.');
                return;
            }

            setBillingSubmitting(true);
            try {
                await accommodationBillingTargetService.upsertTarget({
                    accommodationId: accommodation.id,
                    accommodationName: accommodation.name,
                    targetType: 'team',
                    teamId: selectedOption.id.startsWith('name:') ? undefined : selectedOption.id,
                    teamName: selectedOption.name
                });
                toast.success('청구대상(팀) 저장 완료');
                onSuccess();
            } catch (error) {
                console.error(error);
                toast.error('청구대상 저장 실패');
            } finally {
                setBillingSubmitting(false);
            }
            return;
        }

        if (!billingTargetWorkerId) {
            toast.error('청구 대상 개인을 선택해주세요.');
            return;
        }
        const selectedWorkerOption = billingWorkerOptions.find((option) => option.key === billingTargetWorkerId);
        if (!selectedWorkerOption) {
            toast.error('선택한 개인 정보를 확인할 수 없습니다.');
            return;
        }

        setBillingSubmitting(true);
        try {
            await accommodationBillingTargetService.upsertTarget({
                accommodationId: accommodation.id,
                accommodationName: accommodation.name,
                targetType: 'worker',
                workerId: selectedWorkerOption.workerId || undefined,
                workerName: selectedWorkerOption.workerName
            });
            toast.success('청구대상(개인) 저장 완료');
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('청구대상 저장 실패');
        } finally {
            setBillingSubmitting(false);
        }
    }, [
        accommodation.id,
        accommodation.name,
        billingTargetType,
        billingTeamId,
        billingTargetWorkerId,
        billingTeamOptions,
        billingWorkerOptions,
        onSuccess
    ]);

    const handleDeleteBillingTarget = useCallback(async () => {
        const ok = window.confirm('현재 청구대상 설정을 삭제하시겠습니까?');
        if (!ok) return;

        setBillingSubmitting(true);
        try {
            await accommodationBillingTargetService.deleteTarget(accommodation.id);
            toast.success('청구대상 설정이 삭제되었습니다.');
            setCurrentBillingTarget(null);
            setBillingTargetType('team');
            setBillingTargetWorkerId('');
            setBillingTeamId(billingTeamOptions[0]?.id ?? '');
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('청구대상 삭제 실패');
        } finally {
            setBillingSubmitting(false);
        }
    }, [accommodation.id, billingTeamOptions, onSuccess]);

    const handleCheckout = useCallback(
        async (assignmentId: string, workerName: string) => {
            if (!window.confirm(`${workerName}님을 퇴실 처리하시겠습니까?`)) return;

            try {
                await accommodationAssignmentService.endAssignment(assignmentId, getToday());
                toast.success('퇴실 처리되었습니다.');
                onSuccess();
            } catch (error) {
                toast.error('퇴실 처리 실패');
            }
        },
        [onSuccess]
    );

    const currentBillingTargetDisplay = useMemo(() => {
        if (!currentBillingTarget) return '미설정';
        if (currentBillingTarget.targetType === 'worker') {
            const workerName = normalizeKey(currentBillingTarget.workerName);
            const workerId = normalizeKey(currentBillingTarget.workerId);
            return workerName || (workerId ? `ID:${workerId.slice(0, 8)}` : '개인(이름 없음)');
        }
        const teamName = normalizeKey(currentBillingTarget.teamName);
        const teamId = normalizeKey(currentBillingTarget.teamId);
        return teamName || (teamId ? `팀ID:${teamId.slice(0, 8)}` : '팀(이름 없음)');
    }, [currentBillingTarget]);

    return {
        loadingData,
        submitting,
        billingSubmitting,
        teams,
        selectedTeamId,
        setSelectedTeamId,
        workerSearch,
        setWorkerSearch,
        selectedWorkerIds,
        selectedAssignmentWorkerId,
        setSelectedAssignmentWorkerId,
        assignmentTargetType,
        setAssignmentTargetType,
        assignmentWorkerOptions,
        startDate,
        setStartDate,
        editingAssignmentId,
        filteredWorkers,
        billingTargetType,
        billingTeamId,
        setBillingTeamId,
        billingTargetWorkerId,
        setBillingTargetWorkerId,
        billingTeamOptions,
        billingWorkerOptions,
        currentBillingTarget,
        currentBillingTargetDisplay,
        getBillingWorkerKey,
        isSameWorker,
        selectTeamBillingTarget,
        selectWorkerBillingTarget,
        handleToggleWorker,
        handleEdit,
        handleCancelEdit,
        handleAssign,
        handleApplyBillingTarget,
        handleDeleteBillingTarget,
        handleCheckout
    };
};
