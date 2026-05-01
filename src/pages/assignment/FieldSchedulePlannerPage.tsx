import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    AlertTriangle,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardCopy,
    Download,
    GripVertical,
    MapPin,
    RefreshCw,
    Save,
    Search,
    Trash2,
    Truck,
    UserPlus,
    UsersRound,
    X,
} from 'lucide-react';
import { dispatchService, DispatchAssignment } from '../../services/dispatchService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { vehicleService } from '../../services/vehicleService';
import { Vehicle } from '../../types/vehicle';

type ScheduleStatus = 'draft' | 'confirmed' | 'working' | 'done';
type DragKind = 'team' | 'worker' | 'vehicle' | 'schedule';
type LeftPanelTab = 'teams' | 'support' | 'vehicles';
type RosterKind = 'team' | 'support' | 'unassigned';

interface ScheduleItem {
    id: string;
    date: string;
    teamId: string;
    teamName: string;
    teamColor: string;
    siteId: string;
    siteName: string;
    siteAddress: string;
    siteColor: string;
    workerIds: string[];
    supportTeams: ScheduleSupportTeam[];
    vehicleIds: string[];
    vehicleLabels: string[];
    vehicleId: string;
    vehicleLabel: string;
    status: ScheduleStatus;
    memo: string;
}

interface ScheduleSupportTeam {
    id: string;
    name: string;
    color: string;
}

interface TeamRoster {
    id: string;
    name: string;
    color: string;
    kind: RosterKind;
    leaderName?: string;
    workers: Worker[];
}

interface DragPayload {
    kind: DragKind;
    id: string;
    label: string;
    sourceScheduleId?: string;
}

const UNASSIGNED_TEAM_ID = 'unassigned';
const UNASSIGNED_SUPPORT_TEAM_ID = 'unassigned-support';
const DEFAULT_RESOURCE_COLOR = '#64748b';

const STATUS_META: Record<ScheduleStatus, { label: string; className: string }> = {
    draft: { label: '작성중', className: 'bg-slate-100 text-slate-600' },
    confirmed: { label: '확정', className: 'bg-emerald-100 text-emerald-700' },
    working: { label: '진행', className: 'bg-blue-100 text-blue-700' },
    done: { label: '완료', className: 'bg-zinc-100 text-zinc-600' },
};

const getTodayInputValue = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const shiftDate = (date: string, amount: number) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + amount);
    const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const formatDisplayDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

const makeScheduleId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `field_schedule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const cleanIds = (ids: Array<string | undefined | null>) =>
    Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

const getScheduleVehicleIds = (schedule: Partial<ScheduleItem>) =>
    cleanIds([...(schedule.vehicleIds || []), schedule.vehicleId]);

const makeSiteKey = (schedule: Pick<ScheduleItem, 'siteId' | 'siteName'>) =>
    schedule.siteId ? `id:${schedule.siteId}` : schedule.siteName.trim() ? `name:${schedule.siteName.trim()}` : '';

const mergeSupportTeams = (supportTeams: ScheduleSupportTeam[]) => {
    const map = new Map<string, ScheduleSupportTeam>();
    supportTeams.forEach((team) => {
        const key = team.id || team.name;
        if (key && !map.has(key)) {
            map.set(key, team);
        }
    });
    return Array.from(map.values());
};

const mergeScheduleEntries = (base: ScheduleItem, incoming: ScheduleItem): ScheduleItem => {
    const vehicleIds = getScheduleVehicleIds({ vehicleIds: [...getScheduleVehicleIds(base), ...getScheduleVehicleIds(incoming)] });
    const vehicleLabels = vehicleIds.map((vehicleId) => {
        const baseIndex = getScheduleVehicleIds(base).indexOf(vehicleId);
        if (baseIndex >= 0) return base.vehicleLabels?.[baseIndex] || base.vehicleLabel;
        const incomingIndex = getScheduleVehicleIds(incoming).indexOf(vehicleId);
        return incoming.vehicleLabels?.[incomingIndex] || incoming.vehicleLabel;
    });

    return {
        ...base,
        teamId: base.teamId || incoming.teamId,
        teamName: base.teamName || incoming.teamName,
        teamColor: base.teamColor || incoming.teamColor,
        siteId: base.siteId || incoming.siteId,
        siteName: base.siteName || incoming.siteName,
        siteAddress: base.siteAddress || incoming.siteAddress,
        siteColor: base.siteColor || incoming.siteColor,
        workerIds: cleanIds([...base.workerIds, ...incoming.workerIds]),
        supportTeams: mergeSupportTeams([...(base.supportTeams || []), ...(incoming.supportTeams || [])]),
        vehicleIds,
        vehicleLabels,
        vehicleId: vehicleIds[0] || '',
        vehicleLabel: vehicleLabels[0] || '',
        memo: [base.memo, incoming.memo].filter(Boolean).join(' / '),
    };
};

const mergeSchedulesBySite = (items: ScheduleItem[]) => {
    const rows: ScheduleItem[] = [];
    items.forEach((item) => {
        const key = makeSiteKey(item);
        const existingIndex = key ? rows.findIndex((row) => makeSiteKey(row) === key) : -1;
        if (existingIndex >= 0) {
            rows[existingIndex] = mergeScheduleEntries(rows[existingIndex], item);
            return;
        }
        rows.push(item);
    });
    return rows;
};

const normalizeColor = (color?: string | null) => {
    const trimmed = typeof color === 'string' ? color.trim() : '';
    if (!trimmed) return '';
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : '';
};

const getTeamColor = (team: Partial<Team> | undefined) => {
    return normalizeColor(team?.color) || DEFAULT_RESOURCE_COLOR;
};

const hexToRgba = (hex: string, opacity: number) => {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return `rgba(37, 99, 235, ${opacity})`;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const isInactiveWorker = (worker?: Worker) => {
    const status = String(worker?.status ?? '');
    return status.includes('퇴사') || status.includes('휴무') || worker?.isActive === false;
};

const isUnavailableVehicle = (vehicle?: Vehicle) =>
    vehicle?.status === 'MAINTENANCE' || vehicle?.status === 'DISPOSED';

const includesSupportKeyword = (...values: unknown[]) =>
    values.some((value) => {
        const text = String(value ?? '').trim();
        return text.includes('지원') || text.includes('용역');
    });

const isSupportWorker = (worker?: Worker) =>
    includesSupportKeyword(worker?.teamType, worker?.salaryModel, worker?.payType, worker?.role);

const isSupportTeam = (team: Team, teamWorkers: Worker[]) => {
    const supportRate = Number(team.supportRate);
    return (
        includesSupportKeyword(
            team.name,
            team.type,
            team.role,
            team.defaultSalaryModel,
            team.supportDescription,
            team.serviceDescription
        ) ||
        Boolean(team.supportModel) ||
        (Number.isFinite(supportRate) && supportRate > 0) ||
        teamWorkers.some(isSupportWorker)
    );
};

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

const DraggableWorkerPill: React.FC<{
    worker: Worker;
    sourceScheduleId?: string;
    onRemove?: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}> = ({ worker, sourceScheduleId, onRemove, selectable, selected, onToggleSelect }) => {
    const workerId = worker.id || '';
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: sourceScheduleId ? `schedule-worker:${sourceScheduleId}:${workerId}` : `worker:${workerId}`,
        data: {
            kind: 'worker',
            id: workerId,
            label: worker.name,
            sourceScheduleId,
        } satisfies DragPayload,
        disabled: !workerId,
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
        : { opacity: isDragging ? 0.35 : 1 };

    return (
        <span
            ref={setNodeRef}
            style={style}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-pressed={selectable ? selected : undefined}
            onClick={selectable ? onToggleSelect : undefined}
            onKeyDown={(event) => {
                if (!selectable || !onToggleSelect) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleSelect();
                }
            }}
            className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                selected
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : isInactiveWorker(worker)
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-700'
            } ${selectable ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50' : ''}`}
        >
            <span
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="cursor-grab active:cursor-grabbing"
            >
                <GripVertical size={12} />
            </span>
            {selectable ? (
                <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'
                    }`}
                >
                    {selected ? <Check size={10} /> : null}
                </span>
            ) : null}
            <span className="truncate">{worker.name}</span>
            {onRemove ? (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }}
                    className="text-slate-400 hover:text-red-500"
                    title="작업자 제거"
                >
                    <X size={12} />
                </button>
            ) : null}
        </span>
    );
};

const DraggableVehicleCard: React.FC<{
    vehicle: Vehicle;
    assigned?: boolean;
}> = ({ vehicle, assigned }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `vehicle:${vehicle.id}`,
        data: {
            kind: 'vehicle',
            id: vehicle.id,
            label: vehicle.licensePlate,
        } satisfies DragPayload,
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
        : { opacity: isDragging ? 0.35 : 1 };

    return (
        <article
            ref={setNodeRef}
            style={style}
            className={`flex cursor-grab items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition hover:border-slate-300 active:cursor-grabbing ${
                isUnavailableVehicle(vehicle) ? 'border-red-200 bg-red-50' : 'border-slate-200'
            }`}
            {...attributes}
            {...listeners}
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Truck size={17} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-900">{vehicle.licensePlate}</span>
                <span className="block truncate text-xs font-medium text-slate-500">
                    {vehicle.model || vehicle.currentAssigneeName || '차량'}
                </span>
            </span>
            <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    isUnavailableVehicle(vehicle)
                        ? 'bg-red-100 text-red-700'
                        : assigned
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-500'
                }`}
            >
                {isUnavailableVehicle(vehicle) ? '사용불가' : assigned ? '배정' : '대기'}
            </span>
        </article>
    );
};

const TeamRosterCard: React.FC<{
    roster: TeamRoster;
    selected: boolean;
    onSelect: () => void;
    selectedWorkerIds: Set<string>;
    onToggleWorker: (workerId: string) => void;
}> = ({ roster, selected, onSelect, selectedWorkerIds, onToggleWorker }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `team:${roster.id}`,
        data: { kind: 'team', id: roster.id, label: roster.name } satisfies DragPayload,
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
        : { opacity: isDragging ? 0.35 : 1 };
    const isSupportRoster = roster.kind === 'support';
    const selectedCount = roster.workers.filter((worker) => worker.id && selectedWorkerIds.has(worker.id)).length;

    return (
        <article
            ref={setNodeRef}
            style={style}
            className={`rounded-lg border bg-white p-3 shadow-sm transition ${
                selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: roster.color }} />
                        <h3 className="truncate text-sm font-black text-slate-900">{roster.name}</h3>
                        {roster.kind === 'support' ? (
                            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">
                                지원팀
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                        {roster.leaderName ? `팀장 ${roster.leaderName} · ` : ''}
                        {isSupportRoster ? '팀명 배치' : `작업자 ${roster.workers.length}명`}
                    </p>
                </button>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="팀 선택"
                >
                    <GripVertical size={16} />
                </button>
            </div>

            {!isSupportRoster ? (
                <div
                    className="mt-3 flex flex-wrap gap-1.5 rounded-md p-2"
                    style={{ backgroundColor: hexToRgba(roster.color, 0.06) }}
                >
                    {roster.workers.length > 0 ? (
                        roster.workers.map((worker) => (
                            <DraggableWorkerPill
                                key={worker.id}
                                worker={worker}
                                selectable
                                selected={Boolean(worker.id && selectedWorkerIds.has(worker.id))}
                                onToggleSelect={() => worker.id && onToggleWorker(worker.id)}
                            />
                        ))
                    ) : (
                        <span className="text-xs font-semibold text-slate-400">등록된 작업자가 없습니다.</span>
                    )}
                </div>
            ) : null}

            {selected && !isSupportRoster ? (
                <div className="mt-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600">
                    선택 {selectedCount}명
                </div>
            ) : null}
        </article>
    );
};

const ScheduleCard: React.FC<{
    schedule: ScheduleItem;
    sites: Site[];
    workersById: Map<string, Worker>;
    vehiclesById: Map<string, Vehicle>;
    issues: string[];
    isSupportSchedule: boolean;
    onPatch: (patch: Partial<ScheduleItem>) => void;
    onSelectSite: (siteId: string) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onRemoveWorker: (workerId: string) => void;
    onRemoveSupportTeam: (teamId: string) => void;
    onRemoveVehicle: (vehicleId: string) => void;
}> = ({
    schedule,
    sites,
    workersById,
    vehiclesById,
    issues,
    isSupportSchedule,
    onPatch,
    onSelectSite,
    onDuplicate,
    onDelete,
    onRemoveWorker,
    onRemoveSupportTeam,
    onRemoveVehicle,
}) => {
    const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
        id: `schedule-drop:${schedule.id}`,
        data: { kind: 'schedule-drop', scheduleId: schedule.id },
    });
    const { attributes, listeners, setNodeRef: setDragNodeRef, transform, isDragging } = useDraggable({
        id: `schedule:${schedule.id}`,
        data: { kind: 'schedule', id: schedule.id, label: schedule.siteName || schedule.teamName } satisfies DragPayload,
    });

    const scheduleVehicleIds = getScheduleVehicleIds(schedule);

    const setRefs = (node: HTMLDivElement | null) => {
        setDropNodeRef(node);
        setDragNodeRef(node);
    };

    const style = {
        transform: CSS.Translate.toString(transform),
        borderColor: issues.length > 0 ? '#ef4444' : isOver ? schedule.teamColor : schedule.siteColor || undefined,
        opacity: isDragging ? 0.35 : 1,
    };

    return (
        <article ref={setRefs} style={style} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div
                className="-mx-4 -mt-4 mb-3 h-1 rounded-t-lg"
                style={{ backgroundColor: schedule.siteColor || schedule.teamColor }}
            />
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: schedule.teamColor }} />
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${STATUS_META[schedule.status].className}`}>
                            {STATUS_META[schedule.status].label}
                        </span>
                        {issues.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-600">
                                <AlertTriangle size={12} />
                                {issues.length}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="truncate text-base font-black text-slate-950">{schedule.siteName || '현장 선택 필요'}</h3>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: schedule.siteColor || '#cbd5e1' }} />
                        <p className="truncate text-xs font-medium text-slate-500">{schedule.siteAddress || '주소 없음'}</p>
                    </div>
                </div>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="카드 순서 이동"
                >
                    <GripVertical size={17} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
                <label className="block">
                    <span className="mb-1 block text-[11px] font-black text-slate-400">상태</span>
                    <select
                        value={schedule.status}
                        onChange={(event) => onPatch({ status: event.target.value as ScheduleStatus })}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                    >
                        {Object.entries(STATUS_META).map(([key, meta]) => (
                            <option key={key} value={key}>
                                {meta.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <label className="mt-2 block">
                <span className="mb-1 block text-[11px] font-black text-slate-400">현장</span>
                <select
                    value={schedule.siteId}
                    onChange={(event) => onSelectSite(event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                >
                    <option value="">현장 선택</option>
                    {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                            {site.name}
                        </option>
                    ))}
                </select>
            </label>

            {(!isSupportSchedule || schedule.workerIds.length > 0) ? (
                <div
                    className="mt-3 rounded-md border border-dashed border-slate-200 p-2"
                    style={{ backgroundColor: hexToRgba(schedule.teamColor, 0.05) }}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-500">작업자 {schedule.workerIds.length}명</span>
                        <span className="text-[11px] font-semibold text-slate-400">작업자를 드래그해서 추가</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {schedule.workerIds.length > 0 ? (
                            schedule.workerIds.map((workerId) => {
                                const worker = workersById.get(workerId);
                                if (!worker) return null;
                                return (
                                    <DraggableWorkerPill
                                        key={workerId}
                                        worker={worker}
                                        sourceScheduleId={schedule.id}
                                        onRemove={() => onRemoveWorker(workerId)}
                                    />
                                );
                            })
                        ) : (
                            <span className="text-xs font-semibold text-slate-400">작업자가 비어 있습니다.</span>
                        )}
                    </div>
                </div>
            ) : null}

            {schedule.supportTeams.length > 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-500">지원팀 {schedule.supportTeams.length}팀</span>
                        <span className="text-[11px] font-semibold text-slate-400">팀명 배치</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {schedule.supportTeams.map((team) => (
                            <span
                                key={team.id || team.name}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700"
                            >
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                                <span className="truncate">{team.name}</span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onRemoveSupportTeam(team.id || team.name);
                                    }}
                                    className="text-slate-400 hover:text-red-500"
                                    title="지원팀 제거"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 p-2">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-500">차량</span>
                    <span className="text-[11px] font-semibold text-slate-400">차량을 드래그해서 등록</span>
                </div>
                {scheduleVehicleIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {scheduleVehicleIds.map((vehicleId, index) => {
                            const assignedVehicle = vehiclesById.get(vehicleId);
                            return (
                                <span
                                    key={vehicleId}
                                    className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                                        isUnavailableVehicle(assignedVehicle)
                                            ? 'border-red-200 bg-red-50 text-red-700'
                                            : 'border-slate-200 bg-white text-slate-700'
                                    }`}
                                >
                                    <Truck size={13} />
                                    <span className="truncate">
                                        {assignedVehicle?.licensePlate || schedule.vehicleLabels[index] || schedule.vehicleLabel}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRemoveVehicle(vehicleId);
                                        }}
                                        className="text-slate-400 hover:text-red-500"
                                        title="차량 제거"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <span className="text-xs font-semibold text-slate-400">차량이 비어 있습니다.</span>
                )}
            </div>

            {issues.length > 0 ? (
                <div className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700">
                    {issues[0]}
                </div>
            ) : null}

            <label className="mt-3 block">
                <span className="mb-1 block text-[11px] font-black text-slate-400">메모</span>
                <input
                    value={schedule.memo}
                    onChange={(event) => onPatch({ memo: event.target.value })}
                    placeholder="특이사항"
                    className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-400"
                />
            </label>

            <div className="mt-3 flex justify-end gap-1">
                <button
                    type="button"
                    onClick={onDuplicate}
                    className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                    <ClipboardCopy size={14} />
                    복사
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                    <Trash2 size={14} />
                    삭제
                </button>
            </div>
        </article>
    );
};

const FieldSchedulePlannerPage: React.FC = () => {
    const boardRef = useRef<HTMLDivElement | null>(null);
    const [date, setDate] = useState(getTodayInputValue());
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('teams');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
    const [deletedSchedule, setDeletedSchedule] = useState<ScheduleItem | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor)
    );

    const { setNodeRef: setBoardDropRef, isOver: isBoardOver } = useDroppable({
        id: 'schedule-board-drop',
        data: { kind: 'board-drop' },
    });

    const workersById = useMemo(() => new Map(workers.map((worker) => [worker.id || '', worker])), [workers]);
    const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
    const sitesById = useMemo(() => new Map(sites.map((site) => [site.id || '', site])), [sites]);
    const teamsById = useMemo(() => new Map(teams.map((team) => [team.id || '', team])), [teams]);

    const getSiteColor = useCallback(
        (site?: Site, fallbackColor = DEFAULT_RESOURCE_COLOR) => {
            const responsibleTeam =
                (site?.responsibleTeamId ? teamsById.get(site.responsibleTeamId) : undefined) ||
                teams.find((team) => team.name === site?.responsibleTeamName);
            const responsibleTeamColor = normalizeColor(responsibleTeam?.color);
            if (responsibleTeamColor) return responsibleTeamColor;

            const directSiteColor = normalizeColor(site?.color);
            if (directSiteColor) return directSiteColor;

            return fallbackColor;
        },
        [teams, teamsById]
    );

    const rosters = useMemo<TeamRoster[]>(() => {
        const activeTeams = teams.filter((team) => team.status !== 'closed');
        const rows: TeamRoster[] = activeTeams.map((team) => {
            const memberIds = new Set([...(team.assignedWorkers || []), ...(team.memberIds || [])]);
            const teamWorkers = workers.filter((worker) => {
                if (!worker.id) return false;
                return worker.teamId === team.id || memberIds.has(worker.id);
            });
            const kind: RosterKind = isSupportTeam(team, teamWorkers) ? 'support' : 'team';

            return {
                id: team.id || team.name,
                name: team.name,
                color: getTeamColor(team),
                kind,
                leaderName: team.leaderName || undefined,
                workers: teamWorkers,
            };
        });

        const assignedWorkerIds = new Set(rows.flatMap((row) => row.workers.map((worker) => worker.id || '')));
        const unassignedWorkers = workers.filter((worker) => worker.id && !assignedWorkerIds.has(worker.id));
        const unassignedSupportWorkers = unassignedWorkers.filter(isSupportWorker);
        const unassignedRegularWorkers = unassignedWorkers.filter((worker) => !isSupportWorker(worker));

        if (unassignedRegularWorkers.length > 0) {
            rows.push({
                id: UNASSIGNED_TEAM_ID,
                name: '미배정 작업자',
                color: DEFAULT_RESOURCE_COLOR,
                kind: 'unassigned',
                leaderName: undefined,
                workers: unassignedRegularWorkers,
            });
        }

        if (unassignedSupportWorkers.length > 0) {
            rows.push({
                id: UNASSIGNED_SUPPORT_TEAM_ID,
                name: '미배정 지원팀',
                color: DEFAULT_RESOURCE_COLOR,
                kind: 'support',
                leaderName: undefined,
                workers: unassignedSupportWorkers,
            });
        }

        return rows;
    }, [teams, workers]);

    const assignedVehicleIds = useMemo(
        () => new Set(schedules.flatMap((schedule) => getScheduleVehicleIds(schedule))),
        [schedules]
    );

    const panelRosters = useMemo(
        () =>
            rosters.filter((roster) =>
                leftPanelTab === 'support' ? roster.kind === 'support' : roster.kind !== 'support'
            ),
        [leftPanelTab, rosters]
    );

    const filteredRosters = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return panelRosters;
        return panelRosters.filter((roster) => {
            const workerNames =
                roster.kind === 'support' ? '' : roster.workers.map((worker) => `${worker.name} ${worker.role || ''}`).join(' ');
            return `${roster.name} ${roster.leaderName || ''} ${workerNames}`.toLowerCase().includes(term);
        });
    }, [panelRosters, searchTerm]);

    const filteredVehicles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return vehicles.filter((vehicle) => {
            if (!term) return true;
            return `${vehicle.licensePlate} ${vehicle.model || ''} ${vehicle.currentAssigneeName || ''}`.toLowerCase().includes(term);
        });
    }, [searchTerm, vehicles]);

    const selectedRoster = useMemo(
        () => rosters.find((roster) => roster.id === selectedTeamId) || rosters[0],
        [rosters, selectedTeamId]
    );
    const selectedWorkerIdSet = useMemo(() => new Set(selectedWorkerIds), [selectedWorkerIds]);
    const selectedWorkers = useMemo(
        () => selectedWorkerIds.map((workerId) => workersById.get(workerId)).filter((worker): worker is Worker => Boolean(worker)),
        [selectedWorkerIds, workersById]
    );
    const isSupportScheduleItem = useCallback(
        (schedule: ScheduleItem) => {
            const scheduleRoster = rosters.find((roster) => roster.id === schedule.teamId);
            return schedule.supportTeams.length > 0 || scheduleRoster?.kind === 'support' || includesSupportKeyword(schedule.teamName);
        },
        [rosters]
    );

    const getScheduleIssues = useCallback(
        (schedule: ScheduleItem, allSchedules = schedules) => {
            const issues: string[] = [];
            const isSupportSchedule = isSupportScheduleItem(schedule);
            if (!schedule.siteId && !schedule.siteName.trim()) issues.push('현장이 선택되지 않았습니다.');
            const scheduleVehicleIds = getScheduleVehicleIds(schedule);
            if (scheduleVehicleIds.length === 0) issues.push('차량이 등록되지 않았습니다.');
            if (!isSupportSchedule && schedule.workerIds.length === 0) issues.push('작업자 또는 지원팀이 없습니다.');

            schedule.workerIds.forEach((workerId) => {
                const worker = workersById.get(workerId);
                const duplicated = allSchedules.filter((entry) => entry.workerIds.includes(workerId));
                if (duplicated.length > 1) issues.push(`${worker?.name || '작업자'} 중복 배정`);
                if (isInactiveWorker(worker)) issues.push(`${worker?.name || '작업자'} 상태 확인 필요`);
            });

            scheduleVehicleIds.forEach((vehicleId) => {
                const vehicle = vehiclesById.get(vehicleId);
                const duplicated = allSchedules.filter((entry) => getScheduleVehicleIds(entry).includes(vehicleId));
                if (duplicated.length > 1) issues.push(`${vehicle?.licensePlate || '차량'} 중복 배정`);
                if (isUnavailableVehicle(vehicle)) issues.push(`${vehicle?.licensePlate || '차량'} 사용 불가 상태`);
            });

            return Array.from(new Set(issues));
        },
        [isSupportScheduleItem, schedules, vehiclesById, workersById]
    );

    const totalIssues = useMemo(
        () => schedules.reduce((count, schedule) => count + getScheduleIssues(schedule).length, 0),
        [getScheduleIssues, schedules]
    );

    const mapAssignmentToSchedule = useCallback(
        (assignment: DispatchAssignment, index: number): ScheduleItem => {
            const raw = assignment as DispatchAssignment & Partial<ScheduleItem> & { supportTeamIds?: string[] };
            const rawWorkerIds = cleanIds(assignment.workerIds || []);
            const firstWorkerTeamId = rawWorkerIds.map((workerId) => workersById.get(workerId)?.teamId || '').find(Boolean);
            const teamId = raw.teamId || firstWorkerTeamId || UNASSIGNED_TEAM_ID;
            const team = teamsById.get(teamId);
            const vehicleIds = cleanIds([...(raw.vehicleIds || []), ...(assignment.vehicleIds || []), raw.vehicleId]);
            const site = assignment.siteId ? sitesById.get(assignment.siteId) : undefined;
            const teamColor = raw.teamColor || getTeamColor(team);
            const isSupportAssignment = Boolean(team && isSupportTeam(team, []));
            const workerIds = isSupportAssignment ? [] : rawWorkerIds;
            const supportTeams = mergeSupportTeams([
                ...(raw.supportTeams || []),
                ...(raw.supportTeamIds || []).map((supportTeamId) => {
                    const supportTeam = teamsById.get(supportTeamId);
                    return {
                        id: supportTeamId,
                        name: supportTeam?.name || supportTeamId,
                        color: getTeamColor(supportTeam),
                    };
                }),
                ...(isSupportAssignment && team ? [{ id: teamId, name: team.name, color: teamColor }] : []),
            ]);
            const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || raw.vehicleLabel || '');

            return {
                id: raw.id || `${date}_${teamId}_${assignment.siteId || 'site'}_${index}`,
                date,
                teamId,
                teamName: raw.teamName || team?.name || '미배정',
                teamColor,
                siteId: assignment.siteId || '',
                siteName: assignment.siteName || site?.name || '',
                siteAddress: raw.siteAddress || site?.address || '',
                siteColor: raw.siteColor || getSiteColor(site, teamColor),
                workerIds,
                supportTeams,
                vehicleIds,
                vehicleLabels,
                vehicleId: vehicleIds[0] || '',
                vehicleLabel: vehicleLabels[0] || '',
                status: (raw.status as ScheduleStatus) || 'confirmed',
                memo: assignment.note || raw.memo || '',
            };
        },
        [date, getSiteColor, sitesById, teamsById, vehiclesById, workersById]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        setMessage('');

        try {
            const [teamRows, workerRows, siteRows, vehicleRows] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                siteService.getSites(),
                vehicleService.getVehicles(),
            ]);

            setTeams(teamRows);
            setWorkers(workerRows);
            setSites(siteRows);
            setVehicles(vehicleRows);

            const workerMap = new Map(workerRows.map((worker) => [worker.id || '', worker]));
            const teamMap = new Map(teamRows.map((team) => [team.id || '', team]));
            const siteMap = new Map(siteRows.map((site) => [site.id || '', site]));
            const vehicleMap = new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle]));
            const getLoadedSiteColor = (site?: Site, fallbackColor = DEFAULT_RESOURCE_COLOR) => {
                const responsibleTeam =
                    (site?.responsibleTeamId ? teamMap.get(site.responsibleTeamId) : undefined) ||
                    teamRows.find((team) => team.name === site?.responsibleTeamName);
                const responsibleTeamColor = normalizeColor(responsibleTeam?.color);
                if (responsibleTeamColor) return responsibleTeamColor;

                const directSiteColor = normalizeColor(site?.color);
                if (directSiteColor) return directSiteColor;

                return fallbackColor;
            };

            const dispatch = await dispatchService.getDispatchByDate(date);
            const nextSchedules = (dispatch?.assignments || []).map((assignment, index) => {
                const raw = assignment as DispatchAssignment & Partial<ScheduleItem> & { supportTeamIds?: string[] };
                const rawWorkerIds = cleanIds(assignment.workerIds || []);
                const teamId =
                    raw.teamId ||
                    rawWorkerIds.map((workerId) => workerMap.get(workerId)?.teamId || '').find(Boolean) ||
                    UNASSIGNED_TEAM_ID;
                const team = teamMap.get(teamId);
                const site = assignment.siteId ? siteMap.get(assignment.siteId) : undefined;
                const vehicleIds = cleanIds([...(raw.vehicleIds || []), ...(assignment.vehicleIds || []), raw.vehicleId]);
                const teamColor = raw.teamColor || getTeamColor(team);
                const isSupportAssignment = Boolean(team && isSupportTeam(team, []));
                const workerIds = isSupportAssignment ? [] : rawWorkerIds;
                const supportTeams = mergeSupportTeams([
                    ...(raw.supportTeams || []),
                    ...(raw.supportTeamIds || []).map((supportTeamId) => {
                        const supportTeam = teamMap.get(supportTeamId);
                        return {
                            id: supportTeamId,
                            name: supportTeam?.name || supportTeamId,
                            color: getTeamColor(supportTeam),
                        };
                    }),
                    ...(isSupportAssignment && team ? [{ id: teamId, name: team.name, color: teamColor }] : []),
                ]);
                const vehicleLabels = vehicleIds.map((id) => vehicleMap.get(id)?.licensePlate || raw.vehicleLabel || '');

                return {
                    id: raw.id || `${date}_${teamId}_${assignment.siteId || 'site'}_${index}`,
                    date,
                    teamId,
                    teamName: raw.teamName || team?.name || '미배정',
                    teamColor,
                    siteId: assignment.siteId || '',
                    siteName: assignment.siteName || site?.name || '',
                    siteAddress: raw.siteAddress || site?.address || '',
                    siteColor: raw.siteColor || getLoadedSiteColor(site, teamColor),
                    workerIds,
                    supportTeams,
                    vehicleIds,
                    vehicleLabels,
                    vehicleId: vehicleIds[0] || '',
                    vehicleLabel: vehicleLabels[0] || '',
                    status: (raw.status as ScheduleStatus) || 'confirmed',
                    memo: assignment.note || raw.memo || '',
                } satisfies ScheduleItem;
            });

            setSchedules(mergeSchedulesBySite(nextSchedules));
            setSelectedTeamId((prev) => prev || teamRows[0]?.id || UNASSIGNED_TEAM_ID);
            setSelectedSiteId((prev) => (prev && siteRows.some((site) => site.id === prev) ? prev : ''));
            setDirty(false);
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to load data', error);
            setMessage('데이터를 불러오지 못했습니다. 권한과 네트워크를 확인해주세요.');
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (!selectedTeamId && rosters[0]) {
            setSelectedTeamId(rosters[0].id);
        }
    }, [rosters, selectedTeamId]);

    useEffect(() => {
        if (!selectedRoster || selectedRoster.kind === 'support') {
            setSelectedWorkerIds([]);
            return;
        }

        const availableWorkerIds = new Set(selectedRoster.workers.map((worker) => worker.id).filter(Boolean));
        setSelectedWorkerIds((prev) => prev.filter((workerId) => availableWorkerIds.has(workerId)));
    }, [selectedRoster]);

    const toggleWorkerSelection = (rosterId: string, workerId: string) => {
        setSelectedTeamId(rosterId);
        setSelectedWorkerIds((prev) => {
            const base = selectedTeamId === rosterId ? prev : [];
            return base.includes(workerId) ? base.filter((id) => id !== workerId) : [...base, workerId];
        });
    };

    const updateSchedules = (updater: React.SetStateAction<ScheduleItem[]>) => {
        setSchedules(updater);
        setDirty(true);
    };

    const patchSchedule = (scheduleId: string, patch: Partial<ScheduleItem>) => {
        updateSchedules((prev) =>
            prev.map((schedule) => (schedule.id === scheduleId ? { ...schedule, ...patch } : schedule))
        );
    };

    const makeScheduleFromRoster = (roster: TeamRoster, overrides: Partial<ScheduleItem> = {}): ScheduleItem => {
        const siteId = overrides.siteId ?? selectedSiteId;
        const site = siteId ? sitesById.get(siteId) : undefined;
        const teamColor = overrides.teamColor ?? roster.color;
        const defaultWorkerIds =
            roster.kind === 'support' ? [] : cleanIds(roster.workers.map((worker) => worker.id));
        const supportTeams =
            overrides.supportTeams ??
            (roster.kind === 'support'
                ? [{ id: roster.id, name: roster.name, color: roster.color }]
                : []);
        const vehicleIds = cleanIds([...(overrides.vehicleIds || []), overrides.vehicleId]);
        const vehicleLabels =
            overrides.vehicleLabels ??
            vehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)?.licensePlate || overrides.vehicleLabel || '');

        return {
            id: makeScheduleId(),
            date,
            teamId: overrides.teamId ?? roster.id,
            teamName: overrides.teamName ?? roster.name,
            teamColor,
            siteId,
            siteName: overrides.siteName ?? site?.name ?? '',
            siteAddress: overrides.siteAddress ?? site?.address ?? '',
            siteColor: overrides.siteColor ?? getSiteColor(site, teamColor),
            workerIds: overrides.workerIds ?? defaultWorkerIds,
            supportTeams,
            vehicleIds,
            vehicleLabels,
            vehicleId: vehicleIds[0] || '',
            vehicleLabel: vehicleLabels[0] || '',
            status: overrides.status ?? 'draft',
            memo: overrides.memo ?? '',
        };
    };

    const upsertScheduleForSite = (incoming: ScheduleItem) => {
        updateSchedules((prev) => {
            const key = makeSiteKey(incoming);
            const incomingWorkerIds = new Set(incoming.workerIds);
            const incomingVehicleIds = new Set(getScheduleVehicleIds(incoming));
            const cleanedPrev = prev.map((schedule) => {
                if (makeSiteKey(schedule) === key) return schedule;
                const vehicleIds = getScheduleVehicleIds(schedule).filter((vehicleId) => !incomingVehicleIds.has(vehicleId));
                const vehicleLabels = vehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)?.licensePlate || '');
                return {
                    ...schedule,
                    workerIds: schedule.workerIds.filter((workerId) => !incomingWorkerIds.has(workerId)),
                    vehicleIds,
                    vehicleLabels,
                    vehicleId: vehicleIds[0] || '',
                    vehicleLabel: vehicleLabels[0] || '',
                };
            });

            const existingIndex = key ? cleanedPrev.findIndex((schedule) => makeSiteKey(schedule) === key) : -1;
            if (existingIndex < 0) return [incoming, ...cleanedPrev];

            const next = [...cleanedPrev];
            next[existingIndex] = mergeScheduleEntries(next[existingIndex], incoming);
            return next;
        });
    };

    const moveRosterToBoard = (roster: TeamRoster, overrides: Partial<ScheduleItem> = {}) => {
        if (!roster) return;
        const workerIds =
            roster.kind === 'support'
                ? []
                : cleanIds(overrides.workerIds ?? (selectedTeamId === roster.id ? selectedWorkerIds : []));

        if (!selectedSiteId && !overrides.siteId) {
            setSelectedTeamId(roster.id);
            setMessage('현장을 먼저 선택한 뒤 보드로 이동하세요.');
            return;
        }

        if (roster.kind !== 'support' && workerIds.length === 0) {
            setSelectedTeamId(roster.id);
            setMessage('작업자를 선택한 뒤 보드로 이동하세요.');
            return;
        }

        const next = makeScheduleFromRoster(roster, { ...overrides, workerIds });
        upsertScheduleForSite(next);
        setSelectedTeamId(roster.id);
        if (roster.kind !== 'support') {
            setSelectedWorkerIds([]);
        }
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(`${roster.name} → ${next.siteName || '현장'} 이동 등록되었습니다. 차량은 좌측 차량 목록에서 카드로 드래그해 등록하세요.`);
    };

    const moveSelectedToBoard = () => {
        if (!selectedRoster) return;
        moveRosterToBoard(selectedRoster);
    };

    const addSupportTeamToSchedule = (scheduleId: string, teamId: string) => {
        const roster = rosters.find((entry) => entry.id === teamId);
        if (!roster || roster.kind !== 'support') {
            setMessage('지원팀은 지원팀 탭에서 팀명만 현장에 배치합니다.');
            return;
        }
        patchSchedule(scheduleId, {
            supportTeams: mergeSupportTeams([
                ...(schedules.find((entry) => entry.id === scheduleId)?.supportTeams || []),
                { id: roster.id, name: roster.name, color: roster.color },
            ]),
        });
    };

    const applySiteToSchedule = (scheduleId: string, siteId: string) => {
        const site = siteId ? sitesById.get(siteId) : undefined;
        updateSchedules((prev) => {
            const target = prev.find((entry) => entry.id === scheduleId);
            if (!target) return prev;

            const patched: ScheduleItem = {
                ...target,
                siteId,
                siteName: site?.name || '',
                siteAddress: site?.address || '',
                siteColor: site ? getSiteColor(site, target.teamColor) : '',
            };
            const key = makeSiteKey(patched);
            const existingIndex = key ? prev.findIndex((entry) => entry.id !== scheduleId && makeSiteKey(entry) === key) : -1;
            if (existingIndex < 0) {
                return prev.map((entry) => (entry.id === scheduleId ? patched : entry));
            }

            const next = prev.filter((entry) => entry.id !== scheduleId);
            const mergeIndex = next.findIndex((entry) => makeSiteKey(entry) === key);
            next[mergeIndex] = mergeScheduleEntries(next[mergeIndex], patched);
            return next;
        });
    };

    const addWorkerToSchedule = (scheduleId: string, workerId: string, sourceScheduleId?: string) => {
        updateSchedules((prev) =>
            prev.map((schedule) => {
                if (sourceScheduleId && schedule.id === sourceScheduleId) {
                    return { ...schedule, workerIds: schedule.workerIds.filter((id) => id !== workerId) };
                }

                if (!sourceScheduleId && schedule.id !== scheduleId && schedule.workerIds.includes(workerId)) {
                    return { ...schedule, workerIds: schedule.workerIds.filter((id) => id !== workerId) };
                }

                if (schedule.id === scheduleId) {
                    return { ...schedule, workerIds: cleanIds([...schedule.workerIds, workerId]) };
                }

                return schedule;
            })
        );
    };

    const addVehicleToSchedule = (scheduleId: string, vehicleId: string) => {
        updateSchedules((prev) =>
            prev.map((schedule) => {
                if (schedule.id === scheduleId) {
                    const vehicleIds = cleanIds([...getScheduleVehicleIds(schedule), vehicleId]);
                    const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || schedule.vehicleLabel || '');
                    return {
                        ...schedule,
                        vehicleIds,
                        vehicleLabels,
                        vehicleId: vehicleIds[0] || '',
                        vehicleLabel: vehicleLabels[0] || '',
                    };
                }

                if (getScheduleVehicleIds(schedule).includes(vehicleId)) {
                    const vehicleIds = getScheduleVehicleIds(schedule).filter((id) => id !== vehicleId);
                    const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || '');
                    return {
                        ...schedule,
                        vehicleIds,
                        vehicleLabels,
                        vehicleId: vehicleIds[0] || '',
                        vehicleLabel: vehicleLabels[0] || '',
                    };
                }

                return schedule;
            })
        );
    };

    const removeWorkerFromSchedule = (scheduleId: string, workerId: string) => {
        patchSchedule(scheduleId, {
            workerIds: schedules.find((schedule) => schedule.id === scheduleId)?.workerIds.filter((id) => id !== workerId) || [],
        });
    };

    const removeSupportTeamFromSchedule = (scheduleId: string, teamId: string) => {
        patchSchedule(scheduleId, {
            supportTeams:
                schedules
                    .find((schedule) => schedule.id === scheduleId)
                    ?.supportTeams.filter((team) => (team.id || team.name) !== teamId) || [],
        });
    };

    const removeVehicleFromSchedule = (scheduleId: string, vehicleId: string) => {
        const vehicleIds =
            getScheduleVehicleIds(schedules.find((schedule) => schedule.id === scheduleId) || {}).filter((id) => id !== vehicleId);
        const vehicleLabels = vehicleIds.map((id) => vehiclesById.get(id)?.licensePlate || '');
        patchSchedule(scheduleId, {
            vehicleIds,
            vehicleLabels,
            vehicleId: vehicleIds[0] || '',
            vehicleLabel: vehicleLabels[0] || '',
        });
    };

    const deleteSchedule = (scheduleId: string) => {
        const target = schedules.find((schedule) => schedule.id === scheduleId);
        if (!target) return;
        setDeletedSchedule(target);
        updateSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId));
    };

    const restoreDeletedSchedule = () => {
        if (!deletedSchedule) return;
        updateSchedules((prev) => [deletedSchedule, ...prev]);
        setDeletedSchedule(null);
    };

    const duplicateSchedule = (schedule: ScheduleItem) => {
        const next = {
            ...schedule,
            id: makeScheduleId(),
            siteId: '',
            siteName: '',
            siteAddress: '',
            siteColor: schedule.teamColor,
            status: 'draft' as ScheduleStatus,
        };
        updateSchedules((prev) => [next, ...prev]);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActivePayload(event.active.data.current as DragPayload);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const activeData = event.active.data.current as DragPayload | undefined;
        const overData = event.over?.data.current as any;
        setActivePayload(null);

        if (!activeData || !event.over) return;

        if (activeData.kind === 'schedule' && overData?.kind === 'schedule-drop') {
            const fromIndex = schedules.findIndex((schedule) => schedule.id === activeData.id);
            const toIndex = schedules.findIndex((schedule) => schedule.id === overData.scheduleId);
            updateSchedules((prev) => moveItem(prev, fromIndex, toIndex));
            return;
        }

        if (overData?.kind === 'schedule-drop') {
            const targetScheduleId = String(overData.scheduleId);
            if (activeData.kind === 'worker') {
                addWorkerToSchedule(targetScheduleId, activeData.id, activeData.sourceScheduleId);
            }
            if (activeData.kind === 'vehicle') {
                addVehicleToSchedule(targetScheduleId, activeData.id);
            }
            if (activeData.kind === 'team') {
                addSupportTeamToSchedule(targetScheduleId, activeData.id);
            }
            return;
        }

        if (overData?.kind === 'board-drop') {
            if (activeData.kind === 'team') {
                const roster = rosters.find((entry) => entry.id === activeData.id);
                if (roster) moveRosterToBoard(roster);
                return;
            }

            if (activeData.kind === 'worker') {
                const worker = workersById.get(activeData.id);
                const roster =
                    rosters.find(
                        (entry) =>
                            entry.id === worker?.teamId ||
                            entry.workers.some((entryWorker) => entryWorker.id === activeData.id)
                    ) || selectedRoster;
                if (!roster) return;
                moveRosterToBoard(roster, { workerIds: [activeData.id] });
                return;
            }

            if (activeData.kind === 'vehicle') {
                const roster = selectedRoster || rosters[0];
                const vehicle = vehiclesById.get(activeData.id);
                if (!roster || !vehicle) return;
                moveRosterToBoard(roster, {
                    vehicleIds: [activeData.id],
                    vehicleLabels: [vehicle.licensePlate],
                });
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        try {
            const normalizedSchedules = mergeSchedulesBySite(schedules);
            const assignments = normalizedSchedules.map((schedule) => ({
                id: schedule.id,
                siteId: schedule.siteId,
                siteName: schedule.siteName,
                siteAddress: schedule.siteAddress,
                teamId: schedule.teamId,
                teamName: schedule.teamName,
                teamColor: schedule.teamColor,
                siteColor: schedule.siteColor,
                workerIds: schedule.workerIds,
                supportTeams: schedule.supportTeams,
                supportTeamIds: schedule.supportTeams.map((team) => team.id),
                vehicleIds: getScheduleVehicleIds(schedule),
                vehicleId: getScheduleVehicleIds(schedule)[0] || '',
                vehicleLabel: schedule.vehicleLabels[0] || schedule.vehicleLabel,
                vehicleLabels: schedule.vehicleLabels,
                status: schedule.status,
                note: schedule.memo,
            })) as DispatchAssignment[];

            await dispatchService.saveDispatch(date, assignments);
            setSchedules(normalizedSchedules);
            setDirty(false);
            setMessage('일정이 저장되었습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to save', error);
            setMessage('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyPreviousDay = async () => {
        const previousDate = shiftDate(date, -1);
        const ok = window.confirm(`${previousDate} 일정을 현재 날짜로 가져올까요? 현재 작성 중인 내용은 대체됩니다.`);
        if (!ok) return;

        const source = await dispatchService.getDispatchByDate(previousDate);
        if (!source || source.assignments.length === 0) {
            setMessage('전날 일정이 없습니다.');
            return;
        }

        const copied = source.assignments.map((assignment, index) => ({
            ...mapAssignmentToSchedule(assignment, index),
            id: makeScheduleId(),
            date,
            status: 'draft' as ScheduleStatus,
        }));
        updateSchedules(mergeSchedulesBySite(copied));
        setMessage('전날 일정을 가져왔습니다. 확인 후 저장하세요.');
    };

    const handleExportImage = async () => {
        if (!boardRef.current) return;
        setMessage('이미지를 생성하는 중입니다.');

        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(boardRef.current, {
                background: '#f8fafc',
                scale: 2,
                useCORS: true,
            } as any);
            const link = document.createElement('a');
            link.download = `현장일정_${date}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            setMessage('이미지 저장 파일이 생성되었습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Image export failed', error);
            setMessage('이미지 저장에 실패했습니다.');
        }
    };

    const selectedSite = selectedSiteId ? sitesById.get(selectedSiteId) : undefined;
    const selectedSiteColor = selectedSite ? getSiteColor(selectedSite, selectedRoster?.color) : '';
    const isSelectedSupportRoster = selectedRoster?.kind === 'support';
    const canMoveSelected =
        Boolean(selectedRoster && selectedSiteId) && (isSelectedSupportRoster || selectedWorkerIds.length > 0);
    const moveTargetLabel = selectedSite?.name || '현장 선택';
    const moveSourceLabel = selectedRoster?.name || '팀 선택';
    const selectedWorkerNames = selectedWorkers.map((worker) => worker.name);
    const moveWorkerLabel = isSelectedSupportRoster
        ? '팀명 배치'
        : selectedWorkers.length > 0
            ? `${selectedWorkerNames.slice(0, 3).join(', ')}${selectedWorkerNames.length > 3 ? ` 외 ${selectedWorkerNames.length - 3}명` : ''}`
            : '작업자 선택';

    return (
        <div className="min-h-full bg-slate-100 text-slate-900">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex h-[calc(100vh-72px)] min-h-[760px] flex-col">
                    <header className="border-b border-slate-200 bg-white px-5 py-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    <UsersRound size={14} />
                                    현장 이동 일정 등록
                                </div>
                                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">현장 일정 보드</h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    현장을 선택하고 작업자 또는 지원팀명을 고른 뒤 하나의 현장 카드에 모아 배치합니다.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setDate((prev) => shiftDate(prev, -1))}
                                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-white"
                                        title="이전일"
                                    >
                                        <ChevronLeft size={17} />
                                    </button>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(event) => setDate(event.target.value)}
                                        className="h-9 rounded-md border-0 bg-transparent px-2 text-sm font-bold text-slate-800 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setDate((prev) => shiftDate(prev, 1))}
                                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-white"
                                        title="다음일"
                                    >
                                        <ChevronRight size={17} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDate(getTodayInputValue())}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    오늘
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyPreviousDay}
                                    className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <ClipboardCopy size={16} />
                                    전날 가져오기
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportImage}
                                    className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <Download size={16} />
                                    이미지
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !dirty}
                                    className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <Save size={16} />
                                    {saving ? '저장 중' : dirty ? '저장' : '저장됨'}
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] overflow-hidden">
                        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
                            <div className="border-b border-slate-200 p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder={leftPanelTab === 'vehicles' ? '차량번호, 모델 검색' : '팀, 작업자 검색'}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                                    />
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('teams')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'teams' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <UsersRound size={14} />
                                        팀/작업자
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('support')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'support' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <UserPlus size={14} />
                                        지원팀
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('vehicles')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'vehicles' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <Truck size={14} />
                                        차량
                                    </button>
                                </div>

                                <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-700">
                                    {leftPanelTab === 'vehicles'
                                        ? '차량을 일정 카드로 드래그하면 해당 카드에 차량이 등록됩니다.'
                                        : leftPanelTab === 'support'
                                            ? '지원팀명을 선택하고 이동 버튼으로 현장에 배치합니다.'
                                            : '현장을 선택하고 작업자를 체크한 뒤 보드로 이동 버튼으로 등록합니다.'}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                                {loading ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">
                                        데이터를 불러오는 중입니다.
                                    </div>
                                ) : leftPanelTab !== 'vehicles' ? (
                                    filteredRosters.length > 0 ? (
                                        filteredRosters.map((roster) => (
                                            <TeamRosterCard
                                                key={roster.id}
                                                roster={roster}
                                                selected={selectedRoster?.id === roster.id}
                                                onSelect={() => setSelectedTeamId(roster.id)}
                                                selectedWorkerIds={selectedRoster?.id === roster.id ? selectedWorkerIdSet : new Set()}
                                                onToggleWorker={(workerId) => toggleWorkerSelection(roster.id, workerId)}
                                            />
                                        ))
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            {leftPanelTab === 'support' ? '표시할 지원팀이 없습니다.' : '표시할 팀이나 작업자가 없습니다.'}
                                        </div>
                                    )
                                ) : filteredVehicles.length > 0 ? (
                                    filteredVehicles.map((vehicle) => (
                                        <DraggableVehicleCard
                                            key={vehicle.id}
                                            vehicle={vehicle}
                                            assigned={assignedVehicleIds.has(vehicle.id)}
                                        />
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                        표시할 차량이 없습니다.
                                    </div>
                                )}
                            </div>
                        </aside>

                        <main className="min-w-0 overflow-hidden bg-slate-100">
                            <div className="border-b border-slate-200 bg-white px-5 py-4">
                                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1.4fr] xl:items-end">
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-500">선택 팀</span>
                                        <select
                                            value={selectedRoster?.id || ''}
                                            onChange={(event) => setSelectedTeamId(event.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400"
                                        >
                                            {rosters.map((roster) => (
                                                <option key={roster.id} value={roster.id}>
                                                    {roster.kind === 'support' ? '[지원팀] ' : ''}
                                                    {roster.name}
                                                    {roster.kind === 'support' ? ' (팀 등록)' : ` (${roster.workers.length}명)`}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-500">현장</span>
                                        <select
                                            value={selectedSiteId}
                                            onChange={(event) => setSelectedSiteId(event.target.value)}
                                            style={{ borderColor: selectedSiteColor || undefined }}
                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400"
                                        >
                                            <option value="">현장 선택</option>
                                            {sites.map((site) => (
                                                <option key={site.id} value={site.id}>
                                                    {site.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 xl:grid-cols-[1fr_auto] xl:items-center">
                                    <div className="min-w-0">
                                        <div className="mb-2 text-xs font-black text-slate-500">이동 경로</div>
                                        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-800">
                                            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedRoster?.color || '#cbd5e1' }} />
                                                <span className="truncate">{moveSourceLabel}</span>
                                            </span>
                                            <ChevronRight size={16} className="text-slate-400" />
                                            <span className="inline-flex max-w-full items-center rounded-md bg-white px-2.5 py-1 text-slate-600">
                                                <span className="truncate">{moveWorkerLabel}</span>
                                            </span>
                                            <ChevronRight size={16} className="text-slate-400" />
                                            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedSiteColor || '#cbd5e1' }} />
                                                <span className="truncate">{moveTargetLabel}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={moveSelectedToBoard}
                                        disabled={!canMoveSelected}
                                        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        <ChevronRight size={17} />
                                        보드로 이동
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                        <UsersRound size={13} />
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedRoster?.color || '#cbd5e1' }} />
                                        {selectedRoster?.name || '팀 미선택'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                        <MapPin size={13} />
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedSiteColor || '#cbd5e1' }} />
                                        {selectedSite?.name || '현장 미선택'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                                        <Truck size={13} />
                                        차량은 카드에 드래그 등록
                                    </span>
                                    {totalIssues > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-red-600">
                                            <AlertTriangle size={13} />
                                            확인 필요 {totalIssues}건
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                            <Check size={13} />
                                            충돌 없음
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={loadData}
                                        className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
                                    >
                                        <RefreshCw size={13} />
                                        새로고침
                                    </button>
                                </div>
                            </div>

                            <div
                                ref={(node) => {
                                    setBoardDropRef(node);
                                    boardRef.current = node;
                                }}
                                id="field-schedule-board"
                                className={`h-full overflow-y-auto p-5 transition ${
                                    isBoardOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-100' : ''
                                }`}
                            >
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-black text-slate-950">{formatDisplayDate(date)}</h2>
                                        <p className="mt-1 text-sm font-medium text-slate-500">
                                            현장 카드 {schedules.length}건 · 같은 날짜의 같은 현장은 하나의 카드에 합쳐집니다.
                                        </p>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-500">
                                        일정을 불러오는 중입니다.
                                    </div>
                                ) : schedules.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                                        {schedules.map((schedule) => (
                                            <ScheduleCard
                                                key={schedule.id}
                                                schedule={schedule}
                                                sites={sites}
                                                workersById={workersById}
                                                vehiclesById={vehiclesById}
                                                issues={getScheduleIssues(schedule)}
                                                isSupportSchedule={isSupportScheduleItem(schedule)}
                                                onPatch={(patch) => patchSchedule(schedule.id, patch)}
                                                onSelectSite={(siteId) => applySiteToSchedule(schedule.id, siteId)}
                                                onDuplicate={() => duplicateSchedule(schedule)}
                                                onDelete={() => deleteSchedule(schedule.id)}
                                                onRemoveWorker={(workerId) => removeWorkerFromSchedule(schedule.id, workerId)}
                                                onRemoveSupportTeam={(teamId) => removeSupportTeamFromSchedule(schedule.id, teamId)}
                                                onRemoveVehicle={(vehicleId) => removeVehicleFromSchedule(schedule.id, vehicleId)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex min-h-[460px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
                                        <UserPlus size={36} className="text-slate-400" />
                                        <p className="mt-3 text-base font-black text-slate-800">아직 만든 일정이 없습니다.</p>
                                        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                                            현장을 선택하고 작업자를 고른 뒤 이동 경로의 보드로 이동 버튼을 누르세요.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>

                    {(message || deletedSchedule) && (
                        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xl">
                            {message ? <span>{message}</span> : null}
                            {deletedSchedule ? (
                                <button type="button" onClick={restoreDeletedSchedule} className="ml-3 text-blue-700 hover:text-blue-800">
                                    삭제 되돌리기
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>

                <DragOverlay>
                    {activePayload ? (
                        <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-black text-slate-800 shadow-xl">
                            {activePayload.label}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default FieldSchedulePlannerPage;
