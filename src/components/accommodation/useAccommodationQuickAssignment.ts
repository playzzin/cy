import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Accommodation } from '../../types/accommodation';
import { AccommodationAssignment, AccommodationAssignmentSource } from '../../types/accommodationAssignment';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { companyService } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { teamService, Team } from '../../services/teamService';
import { AccommodationBillingTarget, AccommodationBillingTargetType } from '../../types/accommodationBillingTarget';
import { toast } from '../../utils/swal';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import { appendOfficeAssignmentTeam, buildOfficeStaffAssignmentOptions, isOfficeAssignmentTeam } from '../../utils/supportAssignmentTargets';
import { normalizeTypedDateInput, toShortYearDateInputValue } from '../../utils/typedDateInput';
import { findAccommodationAssignmentForDate } from '../../utils/accommodationAssignmentTimeline';
import { BillingMode } from '../support/BillingModeSelector';

interface UseAccommodationQuickAssignmentParams {
    accommodation: Accommodation;
    activeAssignments: AccommodationAssignment[];
    assignmentHistory?: AccommodationAssignment[];
    isOpen: boolean;
    initialBillingSplitMode?: boolean;
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
    teamId?: string;
    source?: 'worker' | 'office_staff';
}

interface BillingTargetOption {
    key: string;
    type: AccommodationBillingTargetType;
    id: string;
    name: string;
    group: string;
    detail?: string;
}

type AssignmentTargetType = 'team' | 'worker';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const getToday = (): string => toShortYearDateInputValue(format(new Date(), 'yyyy-MM-dd'));
const DEFAULT_BILLING_START_DATE = '2026-01-01';
const getDefaultBillingStartDate = (): string => toShortYearDateInputValue(DEFAULT_BILLING_START_DATE) || '26-01-01';
const displayDate = (value?: string | null): string => toShortYearDateInputValue(value) || '';
const toDateText = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const buildEndDateAsDayBefore = (startDate: string): string => {
    const parsed = normalizeTypedDateInput(startDate);
    if (!parsed) return '';
    const [year, month, day] = parsed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return toDateText(date);
};
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';

const getBillingTargetOptionKey = (type?: AccommodationBillingTargetType | null, id?: string | null): string => {
    const normalizedType = normalizeKey(type);
    const normalizedId = normalizeKey(id);
    return normalizedType && normalizedId ? `${normalizedType}:${normalizedId}` : '';
};

const getOfficeStaffTargetId = (staff: OfficeStaff): string => (
    normalizeKey(staff.id) || normalizeKey(staff.legacyId) || normalizeKey(staff.uid) || normalizeKey(staff.name)
);

const includesCheongyeonKeyword = (...values: unknown[]): boolean => {
    const text = values.map((value) => String(value ?? '').toLowerCase()).join(' ');
    return ['청연이엔지', '청연엔지', '청연', 'cheongyeon'].some((keyword) => text.includes(keyword));
};

export const useAccommodationQuickAssignment = ({
    accommodation,
    activeAssignments,
    assignmentHistory = activeAssignments,
    isOpen,
    initialBillingSplitMode = false,
    onSuccess
}: UseAccommodationQuickAssignmentParams) => {
    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [billingSubmitting, setBillingSubmitting] = useState(false);

    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [billingTargetRecords, setBillingTargetRecords] = useState<AccommodationBillingTarget[]>([]);
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
    const [selectedBillingTargetKey, setSelectedBillingTargetKey] = useState('');
    const [billingTargetStartDate, setBillingTargetStartDate] = useState(getDefaultBillingStartDate());
    const [billingTargetEndDate, setBillingTargetEndDate] = useState('');
    const [billingSelectionInitialized, setBillingSelectionInitialized] = useState(false);
    const [billingMode, setBillingModeState] = useState<BillingMode>('same');

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

    const selectedAssignmentTeam = useMemo(() => {
        if (!selectedTeamId) return undefined;
        return teamByAnyId.get(normalizeKey(selectedTeamId));
    }, [selectedTeamId, teamByAnyId]);
    const selectedAssignmentTeamIsOffice = isOfficeAssignmentTeam(selectedAssignmentTeam);
    const officeStaffAssignmentOptions = useMemo(
        () => buildOfficeStaffAssignmentOptions(officeStaffRows),
        [officeStaffRows]
    );

    const assignmentWorkerOptions = useMemo<WorkerOption[]>(() => {
        if (selectedAssignmentTeamIsOffice) {
            return officeStaffAssignmentOptions.map((staff) => ({
                key: staff.id,
                workerId: staff.id,
                workerName: staff.name,
                teamId: staff.teamId,
                teamName: staff.teamName,
                source: 'office_staff' as const
            }));
        }

        return workers
            .map((worker: any): WorkerOption | null => {
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
                    teamId: normalizeKey(matchedTeam?.id ?? worker?.teamId),
                    teamName: normalizeKey(matchedTeam?.name ?? worker?.teamName) || '팀 미지정',
                    source: 'worker' as const
                };
            })
            .filter((item): item is WorkerOption => item !== null)
            .sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));
    }, [officeStaffAssignmentOptions, selectedAssignmentTeamIsOffice, teamByAnyId, workers]);

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

    const selectableTeamIds = useMemo(() => new Set(
        teams
            .flatMap((team) => [team.id, team.legacyId])
            .map((value) => normalizeKey(value))
            .filter(Boolean)
    ), [teams]);

    const selectableTeamNames = useMemo(() => new Set(
        teams
            .map((team) => normalizeKey(team.name))
            .filter(Boolean)
    ), [teams]);

    const billingTargetOptions = useMemo<BillingTargetOption[]>(() => {
        const teamOptions: BillingTargetOption[] = teams
            .filter((team) => Boolean(team.id && team.name) && !isOfficeAssignmentTeam(team))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((team) => ({
                key: getBillingTargetOptionKey('team', String(team.id)),
                type: 'team',
                id: String(team.id),
                name: String(team.name),
                group: '청연이엔지 소속팀',
                detail: normalizeKey(team.companyName)
            }));

        const workerOptions: BillingTargetOption[] = workers
            .filter((worker) => {
                const teamId = normalizeKey(worker.teamId);
                const teamName = normalizeKey(worker.teamName);
                return (
                    selectableTeamIds.has(teamId) ||
                    selectableTeamNames.has(teamName) ||
                    includesCheongyeonKeyword(worker.companyName, worker.teamType, worker.teamName)
                );
            })
            .map((worker): BillingTargetOption | null => {
                const id = normalizeKey(worker.id) || normalizeKey(worker.legacyId) || normalizeKey(worker.name);
                const name = normalizeKey(worker.name);
                if (!id || !name) return null;
                return {
                    key: getBillingTargetOptionKey('worker', id),
                    type: 'worker' as const,
                    id,
                    name,
                    group: '작업자',
                    detail: normalizeKey(worker.teamName) || normalizeKey(worker.companyName)
                };
            })
            .filter((item): item is BillingTargetOption => item !== null)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

        const officeStaffOptions: BillingTargetOption[] = officeStaffRows
            .filter((staff) => staff.isActive !== false)
            .map((staff): BillingTargetOption | null => {
                const id = getOfficeStaffTargetId(staff);
                const name = normalizeKey(staff.name);
                if (!id || !name) return null;
                return {
                    key: getBillingTargetOptionKey('office_staff', id),
                    type: 'office_staff' as const,
                    id,
                    name,
                    group: '사무실직원',
                    detail: normalizeKey(staff.department) || normalizeKey(staff.role)
                };
            })
            .filter((item): item is BillingTargetOption => item !== null)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

        return [
            ...teamOptions,
            ...workerOptions,
            {
                key: getBillingTargetOptionKey('office', OFFICE_TARGET_ID),
                type: 'office',
                id: OFFICE_TARGET_ID,
                name: OFFICE_TARGET_NAME,
                group: '사무실',
                detail: '사무실 공통 청구'
            },
            ...officeStaffOptions
        ];
    }, [officeStaffRows, selectableTeamIds, selectableTeamNames, teams, workers]);

    const billingTargetOptionByKey = useMemo(() => {
        const map = new Map<string, BillingTargetOption>();
        billingTargetOptions.forEach((option) => map.set(option.key, option));
        return map;
    }, [billingTargetOptions]);

    const selectedBillingTarget = useMemo(
        () => billingTargetOptionByKey.get(selectedBillingTargetKey) ?? null,
        [billingTargetOptionByKey, selectedBillingTargetKey]
    );
    const showBillingDateFields = false;

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
            const [teamsData, workersData, companies, officeStaffData] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                companyService.getCompanies(),
                officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
            ]);

            const filteredTeams = appendOfficeAssignmentTeam(
                buildCheongyeonEngTeams(teamsData, companies),
                teamsData
            );

            setTeams(filteredTeams);
            setWorkers(workersData);
            setOfficeStaffRows(officeStaffData);
        } catch (error) {
            console.error(error);
            toast.error('데이터를 불러오지 못했습니다.');
        } finally {
            setLoadingData(false);
        }
    }, []);

    const loadBillingTarget = useCallback(async () => {
        try {
            const targets = await accommodationBillingTargetService.listTargetsByAccommodationId(accommodation.id);
            const today = toDateText(new Date());
            const target = targets.find((item) => {
                const startDate = normalizeKey(item.startDate);
                const endDate = normalizeKey(item.endDate);
                return (!startDate || startDate <= today) && (!endDate || endDate >= today);
            }) ?? null;
            setBillingTargetRecords(targets);
            setCurrentBillingTarget(target);
        } catch (error) {
            console.error(error);
            setBillingTargetRecords([]);
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
            const currentTargetId = currentBillingTarget.targetType === 'team' || currentBillingTarget.targetType === 'office'
                ? normalizeKey(currentBillingTarget.teamId) || normalizeKey(currentBillingTarget.teamName)
                : normalizeKey(currentBillingTarget.workerId) || normalizeKey(currentBillingTarget.workerName);
            const nextKey = getBillingTargetOptionKey(currentBillingTarget.targetType, currentTargetId);
            setSelectedBillingTargetKey(
                billingTargetOptionByKey.has(nextKey)
                    ? nextKey
                    : (billingTargetOptions[0]?.key ?? nextKey)
            );
            setBillingTargetType(currentBillingTarget.targetType);
            setBillingTeamId(normalizeKey(currentBillingTarget.teamId));
            setBillingTargetWorkerId(normalizeKey(currentBillingTarget.workerId));
            setBillingTargetStartDate(getDefaultBillingStartDate());
            setBillingTargetEndDate('');
            setBillingModeState('custom');
            setBillingSelectionInitialized(true);
            return;
        }

        if (billingTargetOptions.length > 0) {
            const first = billingTargetOptions[0];
            setSelectedBillingTargetKey(first.key);
            setBillingTargetType(first.type);
            setBillingTeamId(first.type === 'team' ? first.id : '');
            setBillingTargetWorkerId('');
            setBillingTargetStartDate(getDefaultBillingStartDate());
            setBillingTargetEndDate('');
            setBillingModeState('same');
            setBillingSelectionInitialized(true);
            return;
        }
    }, [
        billingSelectionInitialized,
        billingTargetOptionByKey,
        billingTargetOptions,
        currentBillingTarget,
        isOpen
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

    const setBillingMode = useCallback((mode: BillingMode) => {
        if (mode === 'split') {
            setBillingModeState('custom');
            setBillingTargetStartDate(getDefaultBillingStartDate());
            setBillingTargetEndDate('');
            return;
        }
        setBillingModeState(mode);
        if (mode === 'custom') {
            setBillingTargetStartDate(getDefaultBillingStartDate());
            setBillingTargetEndDate('');
            return;
        }

        setBillingTargetStartDate(getDefaultBillingStartDate());
        setBillingTargetEndDate('');
    }, [currentBillingTarget]);

    const buildSelectedBillingTargetInput = useCallback((
        target: BillingTargetOption,
        startDate: string,
        endDate: string,
        id?: string
    ) => ({
        id,
        accommodationId: accommodation.id,
        accommodationName: accommodation.name,
        targetType: target.type,
        teamId: target.type === 'team' || target.type === 'office'
            ? target.id
            : undefined,
        teamName: target.type === 'team' || target.type === 'office'
            ? target.name
            : undefined,
        workerId: target.type === 'worker' || target.type === 'office_staff'
            ? target.id
            : undefined,
        workerName: target.type === 'worker' || target.type === 'office_staff'
            ? target.name
            : undefined,
        startDate,
        endDate: endDate || undefined
    }), [accommodation.id, accommodation.name]);

    const buildActiveAssignmentBillingTargetInput = useCallback((startDate: string, endDate: string) => {
        const assignment = findAccommodationAssignmentForDate(assignmentHistory, endDate || startDate)
            ?? activeAssignmentsInScope[0];
        if (!assignment) return null;

        const isTeamAssignment = assignment.source === 'team' ||
            (!normalizeKey(assignment.workerId) && !normalizeKey(assignment.workerName));

        if (isTeamAssignment) {
            const teamId = normalizeKey(assignment.teamId) || normalizeKey(assignment.teamName);
            const teamName = normalizeKey(assignment.teamName);
            if (!teamId && !teamName) return null;

            return {
                accommodationId: accommodation.id,
                accommodationName: accommodation.name,
                targetType: 'team' as const,
                teamId,
                teamName,
                startDate,
                endDate,
                memo: '분할 전 기본 입실자'
            };
        }

        const workerId = normalizeKey(assignment.workerId) || normalizeKey(assignment.workerName);
        const workerName = normalizeKey(assignment.workerName);
        if (!workerId && !workerName) return null;

        return {
            accommodationId: accommodation.id,
            accommodationName: accommodation.name,
            targetType: assignment.source === 'office_staff' ? 'office_staff' as const : 'worker' as const,
            workerId,
            workerName,
            startDate,
            endDate,
            memo: '분할 전 기본 입실자'
        };
    }, [accommodation.id, accommodation.name, activeAssignmentsInScope, assignmentHistory]);

    const applySameBillingTarget = useCallback(async (effectiveDate: string = DEFAULT_BILLING_START_DATE) => {
        const targets = await accommodationBillingTargetService.listTargetsByAccommodationId(accommodation.id);
        const previousEndDate = buildEndDateAsDayBefore(effectiveDate);
        const deleteIds = targets
            .filter((target) => normalizeKey(target.startDate) >= effectiveDate)
            .map((target) => target.id)
            .filter(Boolean);
        const closeRecords = targets
            .filter((target) => {
                const startDate = normalizeKey(target.startDate);
                if (!startDate || startDate >= effectiveDate) return false;
                const endDate = normalizeKey(target.endDate);
                return !endDate || endDate >= effectiveDate;
            })
            .map((target) => ({ id: target.id, endDate: previousEndDate }))
            .filter((target) => Boolean(target.id && target.endDate));

        await accommodationBillingTargetService.applyTargetChanges({
            accommodationId: accommodation.id,
            closeRecords,
            deleteIds
        });
    }, [accommodation.id]);

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

        setStartDate(displayDate(assignment.startDate) || getToday());
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
        const normalizedStartDate = normalizeTypedDateInput(startDate);
        if (!normalizedStartDate) {
            toast.error('배정 시작일을 올바른 날짜로 입력해주세요.');
            return;
        }

        const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId));
        const selectedWorker = assignmentWorkerOptions.find((item) => String(item.key) === String(selectedAssignmentWorkerId));

        if (assignmentTargetType === 'team' && !selectedTeam) {
            toast.error('배정할 팀을 선택해주세요.');
            return;
        }

        if (assignmentTargetType === 'worker' && !selectedWorker) {
            toast.error('배정할 개인을 선택해주세요.');
            return;
        }

        const endDate = accommodationAssignmentService.buildEndDateAsDayBefore(normalizedStartDate);
        const activeIdsToEnd = activeAssignmentsInScope
            .filter((assignment) => assignment.id && assignment.id !== editingAssignmentId)
            .map((assignment) => assignment.id)
            .filter((id): id is string => Boolean(id));

        const workerTeam = selectedWorker?.teamId ? teamByAnyId.get(String(selectedWorker.teamId)) : undefined;
        const nextAssignmentSource: AccommodationAssignmentSource = assignmentTargetType === 'worker'
            ? (selectedWorker?.source === 'office_staff' ? 'office_staff' : 'worker')
            : 'team';
        const nextAssignment = {
            workerId: assignmentTargetType === 'worker' ? String(selectedWorker?.workerId ?? '') : '',
            workerName: assignmentTargetType === 'worker' ? selectedWorker?.workerName ?? '' : '',
            teamId: assignmentTargetType === 'team'
                ? selectedTeam?.id
                : (workerTeam?.id ?? selectedWorker?.teamId),
            teamName: assignmentTargetType === 'team'
                ? selectedTeam?.name
                : (workerTeam?.name ?? selectedWorker?.teamName),
            accommodationId: accommodation.id,
            accommodationName: accommodation.name,
            status: 'active' as const,
            startDate: normalizedStartDate,
            source: nextAssignmentSource
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
        assignmentWorkerOptions,
        teamByAnyId,
        teams,
    ]);

    const handleApplyBillingTarget = useCallback(async () => {
        if (billingMode === 'same') {
            const ok = window.confirm(
                currentBillingTarget
                    ? '숙소의 26-01-01 이후 별도 청구를 종료하고 현재 입실자와 동일하게 청구할까요?'
                    : '별도 청구대상 없이 현재 입실자를 기본 청구대상으로 둘까요?'
            );
            if (!ok) return;

            setBillingSubmitting(true);
            try {
                await applySameBillingTarget();
                toast.success('기준일 이후 숙소 청구를 현재 입실자와 동일하게 변경했습니다.');
                setCurrentBillingTarget(null);
                setBillingTargetType('team');
                setBillingTargetWorkerId('');
                setBillingTeamId(billingTeamOptions[0]?.id ?? '');
                setSelectedBillingTargetKey(billingTargetOptions[0]?.key ?? '');
                setBillingTargetStartDate(getDefaultBillingStartDate());
                setBillingTargetEndDate('');
                onSuccess();
            } catch (error) {
                console.error(error);
                toast.error('청구 처리에 실패했습니다.');
            } finally {
                setBillingSubmitting(false);
            }
            return;
        }

        if (!selectedBillingTarget) {
            toast.error('청구대상을 선택해주세요.');
            return;
        }
        if (showBillingDateFields && !billingTargetStartDate) {
            toast.error('기간 시작일을 입력해주세요.');
            return;
        }
        const normalizedBillingStartDate = normalizeTypedDateInput(billingTargetStartDate) ?? DEFAULT_BILLING_START_DATE;
        if (!normalizedBillingStartDate) {
            toast.error('기간 시작일을 올바른 날짜로 입력해주세요.');
            return;
        }
        let normalizedBillingEndDate = '';
        if (billingTargetEndDate) {
            const parsedBillingEndDate = normalizeTypedDateInput(billingTargetEndDate);
            if (!parsedBillingEndDate) {
                toast.error('기간 종료일을 올바른 날짜로 입력해주세요.');
                return;
            }
            normalizedBillingEndDate = parsedBillingEndDate;
        }
        setBillingTargetStartDate(displayDate(normalizedBillingStartDate));
        setBillingTargetEndDate(displayDate(normalizedBillingEndDate));

        if (normalizedBillingEndDate && normalizedBillingEndDate < normalizedBillingStartDate) {
            toast.error('청구 종료일은 시작일보다 빠를 수 없습니다.');
            return;
        }
        const shouldCreateSplitTarget = Boolean(billingMode === 'split' && currentBillingTarget);
        if (shouldCreateSplitTarget && currentBillingTarget?.startDate && normalizedBillingStartDate <= currentBillingTarget.startDate) {
            toast.error(`기간 시작일은 기존 최신 청구 시작일(${displayDate(currentBillingTarget.startDate)})보다 뒤여야 합니다.`);
            return;
        }
        if (billingMode === 'split' && !currentBillingTarget && normalizedBillingStartDate <= DEFAULT_BILLING_START_DATE) {
            toast.error('기간 시작일은 기본 청구 시작일(26-01-01)보다 뒤여야 합니다.');
            return;
        }

        setBillingSubmitting(true);
        try {
            const upserts = [];
            const closeRecords: Array<{ id: string; endDate: string }> = [];

            if (shouldCreateSplitTarget && currentBillingTarget) {
                const previousEndDate = buildEndDateAsDayBefore(normalizedBillingStartDate);
                if (previousEndDate && (!currentBillingTarget.endDate || currentBillingTarget.endDate >= normalizedBillingStartDate)) {
                    closeRecords.push({ id: currentBillingTarget.id, endDate: previousEndDate });
                }
            } else if (billingMode === 'split' && !currentBillingTarget) {
                const previousEndDate = buildEndDateAsDayBefore(normalizedBillingStartDate);
                const defaultInput = buildActiveAssignmentBillingTargetInput(DEFAULT_BILLING_START_DATE, previousEndDate);
                if (!defaultInput) {
                    throw new Error('분할 전 기본 입실자가 없어 분할청구를 만들 수 없습니다.');
                }
                upserts.push(defaultInput);
            }

            const targetInput = buildSelectedBillingTargetInput(
                selectedBillingTarget,
                normalizedBillingStartDate,
                normalizedBillingEndDate,
                billingMode === 'split' ? undefined : currentBillingTarget?.id
            );
            upserts.push(targetInput);

            const savedIds = billingMode === 'split'
                ? await accommodationBillingTargetService.applyTargetChanges({
                    accommodationId: accommodation.id,
                    closeRecords,
                    upserts
                })
                : [await accommodationBillingTargetService.upsertTarget(targetInput)];
            const savedTargetId = savedIds[savedIds.length - 1] ?? currentBillingTarget?.id ?? '';
            setCurrentBillingTarget({
                id: savedTargetId,
                accommodationId: accommodation.id,
                accommodationName: accommodation.name,
                targetType: selectedBillingTarget.type,
                teamId: selectedBillingTarget.type === 'team' || selectedBillingTarget.type === 'office' ? selectedBillingTarget.id : undefined,
                teamName: selectedBillingTarget.type === 'team' || selectedBillingTarget.type === 'office' ? selectedBillingTarget.name : undefined,
                workerId: selectedBillingTarget.type === 'worker' || selectedBillingTarget.type === 'office_staff' ? selectedBillingTarget.id : undefined,
                workerName: selectedBillingTarget.type === 'worker' || selectedBillingTarget.type === 'office_staff' ? selectedBillingTarget.name : undefined,
                startDate: normalizedBillingStartDate,
                endDate: normalizedBillingEndDate || undefined
            });
            setBillingTargetRecords(await accommodationBillingTargetService.listTargetsByAccommodationId(accommodation.id));
            toast.success('숙소 청구대상이 설정되었습니다.');
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '청구 처리에 실패했습니다.');
        } finally {
            setBillingSubmitting(false);
        }
    }, [
        accommodation.id,
        accommodation.name,
        applySameBillingTarget,
        buildActiveAssignmentBillingTargetInput,
        buildSelectedBillingTargetInput,
        billingMode,
        billingTeamOptions,
        billingTargetOptions,
        billingTargetEndDate,
        billingTargetStartDate,
        currentBillingTarget,
        onSuccess,
        selectedBillingTarget,
        showBillingDateFields
    ]);

    const handleDeleteBillingTarget = useCallback(async () => {
        const ok = window.confirm('현재 청구대상 설정을 삭제하시겠습니까?');
        if (!ok) return;

        setBillingSubmitting(true);
        try {
            await accommodationBillingTargetService.deleteTarget(accommodation.id);
            toast.success('숙소 청구가 취소되었습니다.');
            setCurrentBillingTarget(null);
            setBillingTargetRecords([]);
            setBillingTargetType('team');
            setBillingTargetWorkerId('');
            setBillingTeamId(billingTeamOptions[0]?.id ?? '');
            setSelectedBillingTargetKey(billingTargetOptions[0]?.key ?? '');
            setBillingTargetStartDate(getDefaultBillingStartDate());
            setBillingTargetEndDate('');
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('미청구 처리 실패');
        } finally {
            setBillingSubmitting(false);
        }
    }, [accommodation.id, billingTargetOptions, billingTeamOptions, onSuccess]);

    const handleCheckout = useCallback(
        async (assignmentId: string, workerName: string) => {
            if (!window.confirm(`${workerName}님을 퇴실 처리하시겠습니까?`)) return;

            try {
                await accommodationAssignmentService.endAssignment(
                    assignmentId,
                    normalizeTypedDateInput(getToday()) ?? format(new Date(), 'yyyy-MM-dd')
                );
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
        if (currentBillingTarget.targetType === 'worker' || currentBillingTarget.targetType === 'office_staff') {
            const workerName = normalizeKey(currentBillingTarget.workerName);
            const workerId = normalizeKey(currentBillingTarget.workerId);
            const label = currentBillingTarget.targetType === 'office_staff' ? '사무실직원' : '작업자';
            return `${label} · ${workerName || (workerId ? `ID:${workerId.slice(0, 8)}` : '이름 없음')}`;
        }
        if (currentBillingTarget.targetType === 'office') {
            return `사무실 · ${normalizeKey(currentBillingTarget.teamName) || OFFICE_TARGET_NAME}`;
        }
        const teamName = normalizeKey(currentBillingTarget.teamName);
        const teamId = normalizeKey(currentBillingTarget.teamId);
        return `팀 · ${teamName || (teamId ? `팀ID:${teamId.slice(0, 8)}` : '이름 없음')}`;
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
        billingTargetOptions,
        billingMode,
        setBillingMode,
        selectedBillingTargetKey,
        setSelectedBillingTargetKey,
        selectedBillingTarget,
        showBillingDateFields,
        billingTargetStartDate,
        setBillingTargetStartDate,
        billingTargetEndDate,
        setBillingTargetEndDate,
        billingTargetRecords,
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
