import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faCar, faPen, faRotateLeft, faTrash, faUser, faUsers } from '@fortawesome/free-solid-svg-icons';
import { format, subDays } from 'date-fns';
import { Vehicle, VehicleAssigneeType, VehicleAssignmentRecord } from '../../types/vehicle';
import { Worker } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { vehicleService } from '../../services/vehicleService';
import { Team } from '../../services/teamService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import { normalizeTypedDateInput, toShortYearDateInputValue } from '../../utils/typedDateInput';
import { buildOfficeStaffAssignmentOptions, isOfficeAssignmentTeam } from '../../utils/supportAssignmentTargets';
import { getFriendlyErrorMessage, isDeadlineExceededError } from '../../utils/firebaseError';

type AssigneeMode = VehicleAssigneeType;

interface AssignmentTargetSelection {
    type: VehicleAssigneeType;
    id: string;
    name: string;
}

interface AssignmentPersonOption {
    id: string;
    name: string;
    teamId?: string | null;
    teamName?: string | null;
    source?: 'worker' | 'office_staff';
    detail?: string;
}

interface VehicleAssignmentManagerProps {
    vehicles: Vehicle[];
    workers?: Worker[];
    loading: boolean;
    initialVehicleId?: string | null;
    selectableTeams?: Team[];
    onRefresh: () => void;
}

const toDateInputValue = (d: Date): string => format(d, 'yyyy-MM-dd');
const toShortDateInputValue = (d: Date): string => toShortYearDateInputValue(toDateInputValue(d));
const DEFAULT_BILLING_START_DATE = '2026-01-01';

const buildEndDateAsDayBefore = (startDate: string): string => {
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return toDateInputValue(new Date());
    return toDateInputValue(subDays(d, 1));
};

const buildBillingEndDateAsDayBefore = (value: string): string => {
    const parsed = normalizeTypedDateInput(value);
    if (!parsed) return '';
    const [year, month, day] = parsed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return toDateInputValue(date);
};

const assignmentLabel = (vehicle: Vehicle): string => {
    if (vehicle.currentAssigneeName) {
        return `${vehicle.currentAssigneeType === 'TEAM' ? '팀' : '운전자'} · ${vehicle.currentAssigneeName}`;
    }
    return '미배정';
};

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const getWorkerOptionId = (worker: Worker): string => (
    normalizeKey(worker.id) || normalizeKey(worker.legacyId) || normalizeKey(worker.uid) || normalizeKey(worker.name)
);

const matchesWorkerReference = (worker: Worker, id?: unknown, name?: unknown): boolean => {
    const targetId = normalizeKey(id);
    const targetName = normalizeKey(name);
    const ids = [worker.id, worker.legacyId, worker.uid, worker.name].map(normalizeKey).filter(Boolean);
    return Boolean((targetId && ids.includes(targetId)) || (targetName && normalizeKey(worker.name) === targetName));
};

export const VehicleAssignmentManager: React.FC<VehicleAssignmentManagerProps> = ({
    vehicles,
    workers = [],
    loading,
    initialVehicleId,
    selectableTeams = [],
    onRefresh
}) => {
    const today = useMemo(() => toShortDateInputValue(new Date()), []);

    const [mode, setMode] = useState<AssigneeMode>('TEAM');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState('');
    const [autoUnassignExisting, setAutoUnassignExisting] = useState(true);
    const [syncBillingWithAssignee, setSyncBillingWithAssignee] = useState(true);
    const [saving, setSaving] = useState(false);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [assignmentRecords, setAssignmentRecords] = useState<VehicleAssignmentRecord[]>([]);
    const [assignmentRecordsLoading, setAssignmentRecordsLoading] = useState(false);
    const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

    useEffect(() => {
        if (selectedTeamId || selectableTeams.length === 0) return;
        setSelectedTeamId(selectableTeams.find((team) => Boolean(team.id))?.id ?? '');
    }, [selectableTeams, selectedTeamId]);

    const loadAssignmentRecords = async () => {
        setAssignmentRecordsLoading(true);
        try {
            setAssignmentRecords(await vehicleService.listAllVehicleAssignments());
        } catch (error) {
            console.error(error);
            toast.error('차량 배정 이력을 불러오지 못했습니다.');
        } finally {
            setAssignmentRecordsLoading(false);
        }
    };

    useEffect(() => {
        loadAssignmentRecords();
    }, []);

    const vehiclesById = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach((vehicle) => map.set(String(vehicle.id), vehicle));
        return map;
    }, [vehicles]);

    const selectedVehicle = useMemo(() => {
        if (!selectedVehicleId) return null;
        return vehiclesById.get(String(selectedVehicleId)) ?? null;
    }, [vehiclesById, selectedVehicleId]);

    const selectedVehicleAssignments = useMemo(
        () => assignmentRecords
            .filter((record) => String(record.vehicleId) === String(selectedVehicleId))
            .slice()
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''))),
        [assignmentRecords, selectedVehicleId]
    );

    const availableVehicles = useMemo(
        () => vehicles.filter((vehicle) => !vehicle.currentAssigneeId && (vehicle.status ?? 'AVAILABLE') !== 'ASSIGNED'),
        [vehicles]
    );

    const assignedVehicles = useMemo(
        () => vehicles.filter((vehicle) => Boolean(vehicle.currentAssigneeId) || (vehicle.status ?? 'AVAILABLE') === 'ASSIGNED'),
        [vehicles]
    );

    const selectedTeam = useMemo(
        () => selectableTeams.find((team) => String(team.id) === String(selectedTeamId)) ?? null,
        [selectableTeams, selectedTeamId]
    );
    const selectedTeamColor = selectedTeam ? normalizeHexColor(selectedTeam.color) : '#64748b';
    const selectedTeamIsOffice = isOfficeAssignmentTeam(selectedTeam);

    useEffect(() => {
        const loadOfficeStaff = async () => {
            try {
                const rows = await officeStaffService.getOfficeStaff();
                setOfficeStaffRows(rows);
            } catch (error) {
                console.error(error);
                toast.error('사무실 직원 목록을 불러오지 못했습니다.');
            }
        };
        loadOfficeStaff();
    }, []);

    const officeStaffOptions = useMemo(
        () => buildOfficeStaffAssignmentOptions(officeStaffRows),
        [officeStaffRows]
    );

    const filteredWorkers = useMemo<AssignmentPersonOption[]>(() => {
        if (selectedTeamIsOffice) return officeStaffOptions;
        const workerOptions = workers.map((worker) => ({
            id: getWorkerOptionId(worker),
            name: String(worker.name ?? ''),
            teamId: worker.teamId,
            teamName: worker.teamName,
            source: 'worker' as const
        })).filter((worker) => Boolean(worker.id && worker.name));
        return workerOptions;
    }, [officeStaffOptions, selectedTeamId, selectedTeamIsOffice, workers]);

    useEffect(() => {
        if (mode !== 'WORKER') return;
        if (selectedWorkerId && filteredWorkers.some((worker) => worker.id === selectedWorkerId)) return;
        setSelectedWorkerId(filteredWorkers.find((worker) => Boolean(worker.id))?.id ?? '');
    }, [filteredWorkers, mode, selectedWorkerId]);

    const selectedPerson = useMemo(
        () => filteredWorkers.find((worker) => String(worker.id) === String(selectedWorkerId)) ?? null,
        [filteredWorkers, selectedWorkerId]
    );

    const selectedTarget = useMemo<AssignmentTargetSelection | null>(() => {
        if (mode === 'TEAM') {
            return selectedTeam?.id ? { type: 'TEAM', id: selectedTeam.id, name: selectedTeam.name } : null;
        }
        return selectedPerson?.id ? { type: 'WORKER', id: selectedPerson.id, name: selectedPerson.name } : null;
    }, [mode, selectedPerson, selectedTeam]);

    const selectTargetFromAssignment = (assignment: VehicleAssignmentRecord) => {
        if (assignment.assigneeType === 'TEAM') {
            setMode('TEAM');
            setSelectedTeamId(assignment.assigneeId);
            return;
        }

        setMode('WORKER');
        const assignedWorker = workers.find((worker) => matchesWorkerReference(worker, assignment.assigneeId, assignment.assigneeName));
        setSelectedWorkerId(assignedWorker ? getWorkerOptionId(assignedWorker) : assignment.assigneeId);
        if (assignedWorker?.teamId) setSelectedTeamId(assignedWorker.teamId);
        if (!assignedWorker && officeStaffOptions.some((staff) => String(staff.id) === String(assignment.assigneeId))) {
            setSelectedTeamId(officeStaffOptions[0]?.teamId ?? '');
        }
    };

    const pickVehicle = (vehicle: Vehicle) => {
        setSelectedVehicleId(vehicle.id);
        setEditingAssignmentId(null);
        setEndDate('');
        const latestAssignment = assignmentRecords
            .filter((record) => String(record.vehicleId) === String(vehicle.id))
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0];

        if (latestAssignment) {
            selectTargetFromAssignment(latestAssignment);
            setStartDate(today);
            return;
        }

        if (vehicle.currentAssigneeType && vehicle.currentAssigneeId && vehicle.currentAssigneeName) {
            const snapshotAssignment: VehicleAssignmentRecord = {
                id: '',
                vehicleId: vehicle.id,
                vehiclePlate: vehicle.licensePlate,
                assigneeId: vehicle.currentAssigneeId,
                assigneeType: vehicle.currentAssigneeType,
                assigneeName: vehicle.currentAssigneeName,
                startDate: toDateInputValue(new Date())
            };
            selectTargetFromAssignment(snapshotAssignment);
        }
    };

    const pickVehicleById = (vehicleId: string) => {
        const vehicle = vehiclesById.get(String(vehicleId));
        if (vehicle) {
            pickVehicle(vehicle);
            return;
        }
        setSelectedVehicleId(vehicleId);
    };

    useEffect(() => {
        if (!initialVehicleId) return;
        pickVehicleById(String(initialVehicleId));
    }, [initialVehicleId, vehiclesById, workers, assignmentRecords]);

    const handleStartDateChange = (value: string) => {
        setStartDate(toShortYearDateInputValue(normalizeTypedDateInput(value) ?? value) || value);
    };

    const handleEndDateChange = (value: string) => {
        setEndDate(value ? (toShortYearDateInputValue(normalizeTypedDateInput(value) ?? value) || value) : '');
    };

    const handleEditAssignment = (assignment: VehicleAssignmentRecord) => {
        setSelectedVehicleId(assignment.vehicleId);
        setEditingAssignmentId(assignment.id);
        selectTargetFromAssignment(assignment);
        setStartDate(toShortYearDateInputValue(assignment.startDate) || assignment.startDate);
        setEndDate(toShortYearDateInputValue(assignment.endDate) || '');
        setAutoUnassignExisting(false);
    };

    const handleCancelEditAssignment = () => {
        setEditingAssignmentId(null);
        setEndDate('');
        setStartDate(today);
        setAutoUnassignExisting(true);
        if (selectedVehicle) pickVehicle(selectedVehicle);
    };

    const handleAssign = async () => {
        if (!selectedVehicle) {
            toast.error('차량을 선택해주세요.');
            return;
        }
        if (!startDate) {
            toast.error('배정 정보를 확인해주세요.');
            return;
        }
        const normalizedStartDate = normalizeTypedDateInput(startDate);
        if (!normalizedStartDate) {
            toast.error('배정 정보를 확인해주세요.');
            return;
        }
        const normalizedEndDate = endDate ? normalizeTypedDateInput(endDate) : '';
        if (endDate && !normalizedEndDate) {
            toast.error('배정 종료일을 확인해주세요.');
            return;
        }
        if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
            toast.error('배정 종료일은 시작일보다 빠를 수 없습니다.');
            return;
        }
        setStartDate(toShortYearDateInputValue(normalizedStartDate));
        setEndDate(toShortYearDateInputValue(normalizedEndDate));

        if (!selectedTarget) {
            toast.error(mode === 'TEAM' ? '팀을 선택해주세요.' : '운전자를 선택해주세요.');
            return;
        }

        const editingAssignment = editingAssignmentId
            ? assignmentRecords.find((record) => String(record.id) === String(editingAssignmentId))
            : null;
        if (editingAssignment) {
            const result = await showConfirmAlert(
                '차량 배정 이력 수정',
                `${selectedVehicle.licensePlate} 차량의 배정 이력을 ${selectedTarget.name}${selectedTarget.type === 'TEAM' ? '(팀)' : '(운전자)'} · ${normalizedStartDate}${normalizedEndDate ? `~${normalizedEndDate}` : '~계속'}으로 수정할까요?`
            );
            if (!result.isConfirmed) return;

            setSaving(true);
            try {
                await vehicleService.updateVehicleAssignment({
                    ...editingAssignment,
                    assigneeId: selectedTarget.id,
                    assigneeType: selectedTarget.type,
                    assigneeName: selectedTarget.name,
                    startDate: normalizedStartDate,
                    endDate: normalizedEndDate || undefined
                });
                if (syncBillingWithAssignee) {
                    await syncVehicleBillingWithAssignee(selectedVehicle.id, normalizedStartDate);
                }
                toast.success('차량 배정 이력이 수정되었습니다.');
                setEditingAssignmentId(null);
                setEndDate('');
                setAutoUnassignExisting(true);
                await loadAssignmentRecords();
                onRefresh();
            } catch (error: unknown) {
                console.error(error);
                if (isDeadlineExceededError(error)) {
                    toast.delayed('차량 배정 수정');
                    await loadAssignmentRecords().catch((reloadError) => console.error(reloadError));
                    onRefresh();
                    return;
                }
                const message = getFriendlyErrorMessage(error, '차량 배정 이력 수정에 실패했습니다.');
                toast.error(message);
            } finally {
                setSaving(false);
            }
            return;
        }

        const isAssigned = Boolean(selectedVehicle.currentAssigneeId) || (selectedVehicle.status ?? 'AVAILABLE') === 'ASSIGNED';
        if (isAssigned && !autoUnassignExisting) {
            toast.error('이미 배정된 차량입니다. 기존 배정 자동 해제를 선택해주세요.');
            return;
        }

        const result = await showConfirmAlert(
            '차량 배정',
            `${selectedVehicle.licensePlate} 차량을 ${selectedTarget.name}${selectedTarget.type === 'TEAM' ? '(팀)' : '(운전자)'}에게 배정할까요?`
        );
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            if (isAssigned) {
                await vehicleService.unassignVehicle(selectedVehicle.id, buildEndDateAsDayBefore(normalizedStartDate));
            }
            await vehicleService.assignVehicle(
                selectedVehicle.id,
                selectedTarget.id,
                selectedTarget.type,
                selectedTarget.name,
                normalizedStartDate
            );
            if (syncBillingWithAssignee) {
                await syncVehicleBillingWithAssignee(selectedVehicle.id, normalizedStartDate);
            }
            toast.success('차량 배정이 완료되었습니다.');
            await loadAssignmentRecords();
            onRefresh();
        } catch (error: unknown) {
            console.error(error);
            if (isDeadlineExceededError(error)) {
                toast.delayed('차량 배정');
                await loadAssignmentRecords().catch((reloadError) => console.error(reloadError));
                onRefresh();
                return;
            }
            const message = getFriendlyErrorMessage(error, '차량 배정에 실패했습니다.');
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const syncVehicleBillingWithAssignee = async (vehicleId: string, effectiveDate: string) => {
        const normalizedEffectiveDate = normalizeTypedDateInput(effectiveDate) ?? DEFAULT_BILLING_START_DATE;
        const previousEndDate = buildBillingEndDateAsDayBefore(normalizedEffectiveDate);
        const records = await vehicleService.listAllVehicleBillingTargets(vehicleId);
        const deleteIds = records
            .filter((record) => normalizeKey(record.startDate) >= normalizedEffectiveDate)
            .map((record) => record.id)
            .filter(Boolean);
        const closeRecords = records
            .filter((record) => {
                const start = normalizeKey(record.startDate);
                if (!start || start >= normalizedEffectiveDate) return false;
                const end = normalizeKey(record.endDate);
                return !end || end >= normalizedEffectiveDate;
            })
            .map((record) => ({ id: record.id, endDate: previousEndDate }))
            .filter((record) => Boolean(record.id && record.endDate));

        await vehicleService.applyVehicleBillingTargetChanges({
            vehicleId,
            deleteIds,
            closeRecords,
            clearSnapshot: true
        });
    };

    const handleDeleteAssignment = async (assignment: VehicleAssignmentRecord) => {
        const result = await showConfirmAlert(
            '차량 배정 이력 삭제',
            `${assignment.vehiclePlate} · ${assignment.assigneeName} 배정 이력을 삭제할까요?`
        );
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await vehicleService.deleteVehicleAssignment(assignment);
            if (editingAssignmentId === assignment.id) {
                setEditingAssignmentId(null);
                setEndDate('');
                setAutoUnassignExisting(true);
            }
            toast.success('차량 배정 이력이 삭제되었습니다.');
            await loadAssignmentRecords();
            onRefresh();
        } catch (error: unknown) {
            console.error(error);
            if (isDeadlineExceededError(error)) {
                toast.delayed('차량 배정 삭제');
                await loadAssignmentRecords().catch((reloadError) => console.error(reloadError));
                onRefresh();
                return;
            }
            const message = getFriendlyErrorMessage(error, '차량 배정 이력 삭제에 실패했습니다.');
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleUnassign = async (vehicle: Vehicle) => {
        const result = await showConfirmAlert('차량 배정 해제', `${vehicle.licensePlate} 차량 배정을 해제할까요?`);
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await vehicleService.unassignVehicle(vehicle.id, toDateInputValue(new Date()));
            toast.success('차량 배정을 해제했습니다.');
            await loadAssignmentRecords();
            onRefresh();
        } catch (error: unknown) {
            console.error(error);
            if (isDeadlineExceededError(error)) {
                toast.delayed('차량 배정 해제');
                await loadAssignmentRecords().catch((reloadError) => console.error(reloadError));
                onRefresh();
                return;
            }
            const message = getFriendlyErrorMessage(error, '차량 배정 해제에 실패했습니다.');
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faUsers} className="text-sm" />
                            </span>
                            차량 배정
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium ml-12 text-sm">
                            청구대상 배정과 같은 방식으로 차량을 팀/운전자에게 배정하거나 기존 배정을 변경합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleAssign}
                            disabled={saving}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 ${
                                saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
                            }`}
                        >
                            <FontAwesomeIcon icon={faCar} />
                            {saving ? '처리 중...' : editingAssignmentId ? '이력 수정' : selectedVehicle?.currentAssigneeId ? '배정 변경' : '차량 배정'}
                        </button>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-12 space-y-3">
                        {selectedVehicle && (
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="text-xs font-extrabold text-indigo-500">선택 차량</div>
                                        <div className="mt-1 truncate text-lg font-black text-slate-900">{selectedVehicle.licensePlate}</div>
                                        <div className="mt-1 truncate text-sm font-semibold text-slate-600">{selectedVehicle.model || '모델 미입력'} · {selectedVehicle.type || '유형 미입력'}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:min-w-[360px]">
                                        <div className="rounded-xl bg-white/80 px-3 py-2">
                                            <div className="text-slate-400">현재 배정</div>
                                            <div className="mt-1 truncate text-slate-800">{assignmentLabel(selectedVehicle)}</div>
                                        </div>
                                        <div className="rounded-xl bg-white/80 px-3 py-2">
                                            <div className="text-slate-400">저장 후</div>
                                            <div className="mt-1 truncate text-indigo-700">{selectedTarget ? `${selectedTarget.type === 'TEAM' ? '팀' : '운전자'} · ${selectedTarget.name}` : '대상 선택 필요'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('TEAM')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    mode === 'TEAM' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" /> 팀
                            </button>
                            <button
                                onClick={() => setMode('WORKER')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    mode === 'WORKER' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUser} className="mr-2" /> 운전자
                            </button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                            {!initialVehicleId && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">차량 선택</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        value={selectedVehicleId}
                                        onChange={(event) => pickVehicleById(event.target.value)}
                                    >
                                        <option value="">차량을 선택하세요</option>
                                        {vehicles
                                            .slice()
                                            .sort((a, b) => String(a.licensePlate).localeCompare(String(b.licensePlate), 'ko-KR'))
                                            .map((vehicle) => (
                                                <option key={vehicle.id} value={vehicle.id}>
                                                    {vehicle.licensePlate} · {vehicle.model} · {assignmentLabel(vehicle)}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {mode === 'TEAM' && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">배정 팀 선택</label>
                                    {selectedTeam && (
                                        <span
                                            className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                                            style={{ backgroundColor: selectedTeamColor }}
                                        />
                                    )}
                                    <select
                                        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 ${
                                            selectedTeam ? 'pl-8 pr-3' : 'px-3'
                                        }`}
                                        value={selectedTeamId}
                                        onChange={(event) => setSelectedTeamId(event.target.value)}
                                        style={
                                            selectedTeam
                                                ? {
                                                    borderColor: hexToRgba(selectedTeamColor, 0.35),
                                                    backgroundColor: hexToRgba(selectedTeamColor, 0.05),
                                                    color: selectedTeamColor
                                                }
                                                : undefined
                                        }
                                    >
                                        {selectableTeams
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((team) => (
                                                <option key={team.id} value={team.id} style={{ color: normalizeHexColor(team.color) }}>
                                                    {team.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {mode === 'WORKER' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">운전자 선택</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        value={selectedWorkerId}
                                        onChange={(event) => setSelectedWorkerId(event.target.value)}
                                    >
                                        {filteredWorkers
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((worker) => (
                                                <option key={worker.id} value={worker.id}>
                                                    {worker.name}{worker.detail ? ` (${worker.detail})` : worker.teamName ? ` (${worker.teamName})` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">배정 시작일</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="YY-MM-DD"
                                        value={startDate}
                                        onChange={(event) => handleStartDateChange(event.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                    />
                                </div>
                                {editingAssignmentId && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">배정 종료일</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={10}
                                            placeholder="계속"
                                            value={endDate}
                                            onChange={(event) => handleEndDateChange(event.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        />
                                    </div>
                                )}
                            </div>

                            {editingAssignmentId ? (
                                <button
                                    type="button"
                                    onClick={handleCancelEditAssignment}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    <FontAwesomeIcon icon={faRotateLeft} />
                                    이력 수정 취소
                                </button>
                            ) : (
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={autoUnassignExisting}
                                        onChange={(event) => setAutoUnassignExisting(event.target.checked)}
                                    />
                                    기존 배정 자동 해제
                                </label>
                            )}

                            <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={syncBillingWithAssignee}
                                    onChange={(event) => setSyncBillingWithAssignee(event.target.checked)}
                                />
                                <span>
                                    <span className="block">청구도 배정 대상과 동일하게 변경</span>
                                    <span className="mt-0.5 block text-xs font-semibold text-emerald-700/80">
                                        별도 청구대상이 있으면 배정 시작일 이후는 새 배정자를 따라가도록 정리합니다.
                                    </span>
                                </span>
                            </label>
                        </div>

                        {selectedVehicle && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-500 font-bold">선택 차량</div>
                                    <div className="text-lg font-extrabold text-slate-900 truncate">{selectedVehicle.licensePlate}</div>
                                    <div className="text-sm text-slate-500 font-medium mt-1">{selectedVehicle.model} · {assignmentLabel(selectedVehicle)}</div>
                                </div>
                                {(selectedVehicle.currentAssigneeId || (selectedVehicle.status ?? 'AVAILABLE') === 'ASSIGNED') && (
                                    <button
                                        type="button"
                                        onClick={() => handleUnassign(selectedVehicle)}
                                        disabled={saving}
                                        className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 inline-flex items-center gap-2"
                                    >
                                        <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                        배정 해제
                                    </button>
                                )}
                                </div>
                            </div>
                        )}

                        {selectedVehicle && (
                            <details open={Boolean(editingAssignmentId)} className="group bg-white rounded-2xl border border-slate-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                    <span className="font-extrabold text-slate-800">배정 이력</span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                                        {selectedVehicleAssignments.length}건
                                    </span>
                                </summary>
                                <div className="border-t border-slate-100 p-4">
                                {assignmentRecordsLoading ? (
                                    <div className="text-sm text-slate-400">불러오는 중...</div>
                                ) : selectedVehicleAssignments.length === 0 ? (
                                    <div className="text-sm text-slate-400">등록된 배정 이력이 없습니다.</div>
                                ) : (
                                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                        {selectedVehicleAssignments.map((record) => (
                                            <div key={record.id} className="rounded-xl border border-slate-100 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-extrabold text-slate-800 truncate">{record.assigneeName}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {record.assigneeType === 'TEAM' ? '팀' : '운전자'} · {record.startDate || '-'}~{record.endDate || '계속'}
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditAssignment(record)}
                                                            disabled={saving}
                                                            className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                            title="배정 이력 수정"
                                                        >
                                                            <FontAwesomeIcon icon={faPen} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteAssignment(record)}
                                                            disabled={saving}
                                                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                            title="배정 이력 삭제"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                </div>
                            </details>
                        )}
                    </div>

                    <div className="hidden">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">배정 가능한 차량</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {availableVehicles.length === 0 ? (
                                    <div className="text-sm text-slate-400">배정 가능한 차량이 없습니다.</div>
                                ) : (
                                    availableVehicles.map((vehicle) => (
                                        <button
                                            key={vehicle.id}
                                            onClick={() => pickVehicle(vehicle)}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-extrabold text-slate-800 truncate">{vehicle.licensePlate}</div>
                                                <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-indigo-100">배정</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{vehicle.model} · {assignmentLabel(vehicle)}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">배정된 차량</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {assignedVehicles.length === 0 ? (
                                    <div className="text-sm text-slate-400">배정된 차량이 없습니다.</div>
                                ) : (
                                    assignedVehicles.map((vehicle) => (
                                        <div
                                            key={vehicle.id}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button onClick={() => pickVehicle(vehicle)} className="min-w-0 text-left">
                                                    <div className="font-extrabold text-slate-800 truncate">{vehicle.licensePlate}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{vehicle.model} · {assignmentLabel(vehicle)}</div>
                                                </button>
                                                <button
                                                    onClick={() => handleUnassign(vehicle)}
                                                    disabled={saving}
                                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
                                                >
                                                    <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                                    배정 해제
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
                차량 배정을 변경하면 기존 배정 이력은 종료되고 선택한 시작일 기준으로 새 배정 이력이 생성됩니다.
            </div>
        </div>
    );
};
