import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faRotateLeft, faUser, faUsers } from '@fortawesome/free-solid-svg-icons';
import { Vehicle, VehicleAssigneeType } from '../../types/vehicle';
import { Worker } from '../../services/manpowerService';
import { vehicleService } from '../../services/vehicleService';
import { Team } from '../../services/teamService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { hexToRgba, normalizeHexColor } from '../../utils/color';

type BillingTargetMode = VehicleAssigneeType;

interface BillingTargetSelection {
    type: VehicleAssigneeType;
    id: string;
    name: string;
}

interface VehicleBillingTargetManagerProps {
    vehicles: Vehicle[];
    workers?: Worker[];
    loading: boolean;
    initialVehicleId?: string | null;
    selectableTeams?: Team[];
    onRefresh: () => void;
}

const targetLabel = (vehicle: Vehicle): string => {
    if (vehicle.billingTargetType && vehicle.billingTargetId && vehicle.billingTargetName) {
        return `${vehicle.billingTargetType === 'TEAM' ? '팀' : '개인'} · ${vehicle.billingTargetName}`;
    }
    if (vehicle.currentAssigneeName) {
        return `배정과 동일 · ${vehicle.currentAssigneeName}`;
    }
    return '청구대상 미지정';
};

export const VehicleBillingTargetManager: React.FC<VehicleBillingTargetManagerProps> = ({
    vehicles,
    workers = [],
    loading,
    initialVehicleId,
    selectableTeams = [],
    onRefresh
}) => {
    const [mode, setMode] = useState<BillingTargetMode>('TEAM');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (selectedTeamId || selectableTeams.length === 0) return;
        setSelectedTeamId(selectableTeams.find((team) => Boolean(team.id))?.id ?? '');
    }, [selectableTeams, selectedTeamId]);

    const vehiclesById = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach((vehicle) => map.set(String(vehicle.id), vehicle));
        return map;
    }, [vehicles]);

    const selectedVehicle = useMemo(() => {
        if (!selectedVehicleId) return null;
        return vehiclesById.get(String(selectedVehicleId)) ?? null;
    }, [vehiclesById, selectedVehicleId]);
    const selectedVehicleHasExplicitBillingTarget = Boolean(selectedVehicle?.billingTargetType && selectedVehicle?.billingTargetId);

    const selectedTeam = useMemo(
        () => selectableTeams.find((team) => String(team.id) === String(selectedTeamId)) ?? null,
        [selectableTeams, selectedTeamId]
    );
    const selectedTeamColor = selectedTeam ? normalizeHexColor(selectedTeam.color) : '#64748b';

    const filteredWorkers = useMemo(() => {
        if (!selectedTeamId) return workers;
        return workers.filter((worker) => String(worker.teamId ?? '') === String(selectedTeamId));
    }, [selectedTeamId, workers]);

    useEffect(() => {
        if (mode !== 'WORKER') return;
        if (selectedWorkerId && filteredWorkers.some((worker) => worker.id === selectedWorkerId)) return;
        setSelectedWorkerId(filteredWorkers.find((worker) => Boolean(worker.id))?.id ?? '');
    }, [filteredWorkers, mode, selectedWorkerId]);

    const explicitVehicles = useMemo(
        () => vehicles.filter((vehicle) => Boolean(vehicle.billingTargetType && vehicle.billingTargetId)),
        [vehicles]
    );

    const followingVehicles = useMemo(
        () => vehicles.filter((vehicle) => !vehicle.billingTargetType || !vehicle.billingTargetId),
        [vehicles]
    );

    const selectedTarget = useMemo<BillingTargetSelection | null>(() => {
        if (mode === 'TEAM') {
            const team = selectableTeams.find((item) => String(item.id) === String(selectedTeamId));
            return team?.id ? { type: 'TEAM', id: team.id, name: team.name } : null;
        }
        const worker = workers.find((item) => String(item.id) === String(selectedWorkerId));
        return worker?.id ? { type: 'WORKER', id: worker.id, name: worker.name } : null;
    }, [mode, selectableTeams, selectedTeamId, selectedWorkerId, workers]);

    const saveBillingTarget = async (vehicle: Vehicle, target: BillingTargetSelection | null) => {
        setSaving(true);
        try {
            await vehicleService.updateVehicle(vehicle.id, {
                billingTargetId: target?.id ?? null,
                billingTargetType: target?.type ?? null,
                billingTargetName: target?.name ?? null
            } as Partial<Vehicle>);
            toast.success(target ? '차량 청구대상을 배정했습니다.' : '차량 청구대상을 배정과 동일하게 되돌렸습니다.');
            onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedVehicle) {
            toast.error('차량을 선택해주세요.');
            return;
        }
        if (!selectedTarget) {
            toast.error(mode === 'TEAM' ? '팀을 선택해주세요.' : '작업자를 선택해주세요.');
            return;
        }

        const result = await showConfirmAlert(
            '차량 청구대상 배정',
            `${selectedVehicle.licensePlate} 차량의 청구대상을 ${selectedTarget.name}${selectedTarget.type === 'TEAM' ? '(팀)' : '(개인)'}으로 배정할까요?`
        );
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(selectedVehicle, selectedTarget);
        } catch (error) {
            console.error(error);
            toast.error('차량 청구대상 배정에 실패했습니다.');
        }
    };

    const handleReset = async (vehicle: Vehicle) => {
        const result = await showConfirmAlert('청구대상 초기화', `${vehicle.licensePlate} 차량의 청구대상을 배정과 동일하게 되돌릴까요?`);
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(vehicle, null);
        } catch (error) {
            console.error(error);
            toast.error('차량 청구대상 초기화에 실패했습니다.');
        }
    };

    const pickVehicle = (vehicle: Vehicle) => {
        setSelectedVehicleId(vehicle.id);
        if (vehicle.billingTargetType === 'TEAM' && vehicle.billingTargetId) {
            setMode('TEAM');
            setSelectedTeamId(vehicle.billingTargetId);
        }
        if (vehicle.billingTargetType === 'WORKER' && vehicle.billingTargetId) {
            setMode('WORKER');
            setSelectedWorkerId(vehicle.billingTargetId);
            const assignedWorker = workers.find((worker) => String(worker.id) === String(vehicle.billingTargetId));
            if (assignedWorker?.teamId) setSelectedTeamId(assignedWorker.teamId);
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
    }, [initialVehicleId, vehiclesById, workers]);

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-emerald-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-sm" />
                            </span>
                            차량 청구대상 배정
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium ml-12 text-sm">
                            차량 사용자와 별도로 실제 청구를 받을 팀/개인을 지정합니다. 미지정이면 현재 배정 대상에게 청구됩니다.
                        </p>
                    </div>
                    <button
                        onClick={handleAssign}
                        disabled={saving}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 ${
                            saving ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5'
                        }`}
                    >
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                        {saving ? '처리 중...' : selectedVehicleHasExplicitBillingTarget ? '청구대상 변경' : '청구대상 배정'}
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-4 space-y-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('TEAM')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    mode === 'TEAM' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" /> 팀
                            </button>
                            <button
                                onClick={() => setMode('WORKER')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    mode === 'WORKER' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUser} className="mr-2" /> 개인
                            </button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
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
                                                {vehicle.licensePlate} · {vehicle.model} · {targetLabel(vehicle)}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {mode === 'TEAM' && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">청구 팀 선택</label>
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
                                    <label className="block text-xs font-bold text-slate-600 mb-1">청구 개인 선택</label>
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
                                                    {worker.name}{worker.teamName ? ` (${worker.teamName})` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {selectedVehicle && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-500 font-bold">선택 차량</div>
                                    <div className="text-lg font-extrabold text-slate-900 truncate">{selectedVehicle.licensePlate}</div>
                                    <div className="text-sm text-slate-500 font-medium mt-1">{selectedVehicle.model} · {targetLabel(selectedVehicle)}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">배정과 동일한 차량</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {followingVehicles.length === 0 ? (
                                    <div className="text-sm text-slate-400">모든 차량에 별도 청구대상이 있습니다.</div>
                                ) : (
                                    followingVehicles.map((vehicle) => (
                                        <button
                                            key={vehicle.id}
                                            onClick={() => pickVehicle(vehicle)}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-extrabold text-slate-800 truncate">{vehicle.licensePlate}</div>
                                                <span className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-emerald-100">배정</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{vehicle.model} · {targetLabel(vehicle)}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">별도 청구대상 차량</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {explicitVehicles.length === 0 ? (
                                    <div className="text-sm text-slate-400">별도 청구대상이 지정된 차량이 없습니다.</div>
                                ) : (
                                    explicitVehicles.map((vehicle) => (
                                        <div
                                            key={vehicle.id}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button onClick={() => pickVehicle(vehicle)} className="min-w-0 text-left">
                                                    <div className="font-extrabold text-slate-800 truncate">{vehicle.licensePlate}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{vehicle.model} · {targetLabel(vehicle)}</div>
                                                </button>
                                                <button
                                                    onClick={() => handleReset(vehicle)}
                                                    disabled={saving}
                                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} />
                                                    배정과 동일
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

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                차량 사용자는 그대로 두고 청구만 다른 팀/개인에게 보낼 때 사용합니다. 별도 청구대상이 없으면 월별 청구 생성 시 현재 배정 대상이 자동으로 사용됩니다.
            </div>
        </div>
    );
};
