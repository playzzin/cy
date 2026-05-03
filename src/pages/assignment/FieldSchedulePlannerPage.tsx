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
    Plus,
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
type DragKind = 'team' | 'worker' | 'vehicle' | 'site' | 'schedule';
type LeftPanelTab = 'sites' | 'teams' | 'support' | 'vehicles';
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
    sourceLabel?: string;
    workers: Worker[];
}

interface DragPayload {
    kind: DragKind;
    id: string;
    label: string;
    sourceScheduleId?: string;
}

const UNASSIGNED_TEAM_ID = 'unassigned';
const DEFAULT_RESOURCE_COLOR = '#64748b';
const TEMP_DRAFT_STORAGE_PREFIX = 'fieldSchedulePlannerDraft';

const getTempDraftStorageKey = (date: string) => `${TEMP_DRAFT_STORAGE_PREFIX}:${date}`;

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

const makeSiteSelectionKey = (site: Site) =>
    makeSiteKey({ siteId: site.id || '', siteName: site.name });

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

const normalizeComparableText = (value?: unknown) =>
    String(value ?? '')
        .replace(/\s+/g, '')
        .toLowerCase();

const sameText = (left?: unknown, right?: unknown) => {
    const normalizedLeft = normalizeComparableText(left);
    const normalizedRight = normalizeComparableText(right);
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const koreanNameCollator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

const compareKoreanName = (left?: unknown, right?: unknown) =>
    koreanNameCollator.compare(String(left ?? ''), String(right ?? ''));

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

const getWorkerAssignedTeam = (worker: Worker | undefined, teamsById: Map<string, Team>, teams: Team[]) => {
    if (!worker) return undefined;

    const teamId = String(worker.teamId || '');
    if (teamId) {
        const byId = teamsById.get(teamId);
        if (byId) return byId;

        const byLegacyId = teams.find((team) => String(team.legacyId || '') === teamId);
        if (byLegacyId) return byLegacyId;
    }

    return teams.find((team) => sameText(team.name, worker.teamName));
};

const getVehicleAssignedTeam = (vehicle: Vehicle | undefined, teamsById: Map<string, Team>, teams: Team[]) => {
    if (!vehicle || String(vehicle.currentAssigneeType || '').toUpperCase() !== 'TEAM') return undefined;

    const assigneeId = String(vehicle.currentAssigneeId || '');
    if (assigneeId) {
        const byId = teamsById.get(assigneeId);
        if (byId) return byId;

        const byLegacyId = teams.find((team) => String(team.legacyId || '') === assigneeId);
        if (byLegacyId) return byLegacyId;
    }

    return teams.find((team) => sameText(team.name, vehicle.currentAssigneeName));
};

const includesKeyword = (keywords: string[], ...values: unknown[]) =>
    values.some((value) => {
        const text = normalizeComparableText(value);
        return Boolean(text) && keywords.some((keyword) => text.includes(normalizeComparableText(keyword)));
    });

const includesSupportKeyword = (...values: unknown[]) =>
    includesKeyword(['지원', '용역'], ...values);

const includesConstructionKeyword = (...values: unknown[]) =>
    includesKeyword(['시공사', '시공팀', '시공'], ...values);

const includesCheongyeonKeyword = (...values: unknown[]) =>
    includesKeyword(['청연이엔지', '청연엔지', '청연', 'cheongyeon'], ...values);

const isSupportWorker = (worker?: Worker) =>
    includesSupportKeyword(worker?.teamType, worker?.salaryModel, worker?.payType, worker?.role);

const isFieldTeamSource = (team: Team, teamWorkers: Worker[] = []) =>
    includesConstructionKeyword(team.name, team.type, team.role, team.companyName, team.parentTeamName) ||
    includesCheongyeonKeyword(team.name, team.type, team.role, team.companyName, team.parentTeamName) ||
    teamWorkers.some((worker) =>
        includesConstructionKeyword(worker.teamName, worker.teamType, worker.role, worker.companyName) ||
        includesCheongyeonKeyword(worker.teamName, worker.teamType, worker.companyName)
    );

const isSupportTeam = (team: Team, teamWorkers: Worker[]) => {
    if (isFieldTeamSource(team, teamWorkers)) return false;

    const explicitSupportTeam = includesSupportKeyword(
        team.name,
        team.type,
        team.role,
        team.companyName,
        team.parentTeamName,
        team.defaultSalaryModel,
        team.supportModel,
        team.supportDescription,
        team.serviceDescription
    );
    if (explicitSupportTeam) return true;

    return teamWorkers.length > 0 && teamWorkers.every(isSupportWorker);
};

const getWorkerSourceLabel = (worker?: Worker) => {
    if (includesConstructionKeyword(worker?.teamType, worker?.role, worker?.companyName)) return '시공사';
    if (includesCheongyeonKeyword(worker?.companyName, worker?.teamType, worker?.teamName)) return '(주)청연이엔지';
    return String(worker?.companyName || worker?.teamType || '작업자').trim();
};

const getTeamSourceLabel = (team: Team, teamWorkers: Worker[]) => {
    if (includesConstructionKeyword(team.type, team.role, team.companyName, team.name)) return '시공사';
    if (includesCheongyeonKeyword(team.companyName, team.parentTeamName, team.name, team.role)) return '(주)청연이엔지';
    if (teamWorkers.some((worker) => includesConstructionKeyword(worker.teamType, worker.role, worker.companyName))) return '시공사';
    if (teamWorkers.some((worker) => includesCheongyeonKeyword(worker.companyName, worker.teamName, worker.teamType))) {
        return '(주)청연이엔지';
    }
    return String(team.companyName || team.type || '팀').trim();
};

const workerMatchesTeam = (worker: Worker, team: Team, memberIds: Set<string>, memberNames: Set<string>) => {
    if (!worker.id) return false;
    if (worker.teamId) return Boolean(team.id && worker.teamId === team.id);
    if (memberIds.has(worker.id)) return true;
    if (memberNames.has(normalizeComparableText(worker.name))) return true;
    return sameText(worker.teamName, team.name);
};

const groupUnassignedWorkers = (workers: Worker[], kind: RosterKind, fallbackName: string, fallbackId: string): TeamRoster[] => {
    const groups = new Map<string, TeamRoster>();

    workers.forEach((worker) => {
        const existing = groups.get(fallbackId);
        if (existing) {
            existing.workers.push(worker);
            return;
        }

        groups.set(fallbackId, {
            id: fallbackId,
            name: fallbackName,
            color: normalizeColor(worker.color) || DEFAULT_RESOURCE_COLOR,
            kind,
            sourceLabel: getWorkerSourceLabel(worker),
            workers: [worker],
        });
    });

    return Array.from(groups.values()).map((group) => ({
        ...group,
        workers: [...group.workers].sort((left, right) => compareKoreanName(left.name, right.name)),
    }));
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
    teamColor?: string;
    onRemove?: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}> = ({ worker, sourceScheduleId, teamColor, onRemove, selectable, selected, onToggleSelect }) => {
    const workerId = worker.id || '';
    const workerTeamColor = normalizeColor(teamColor) || normalizeColor(worker.color) || DEFAULT_RESOURCE_COLOR;
    const inactive = isInactiveWorker(worker);
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

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: inactive ? '#fecaca' : selected ? workerTeamColor : hexToRgba(workerTeamColor, 0.45),
        backgroundColor: inactive
            ? '#fef2f2'
            : selected
                ? hexToRgba(workerTeamColor, 0.14)
                : hexToRgba(workerTeamColor, 0.06),
        boxShadow: selected && !inactive ? `0 0 0 2px ${hexToRgba(workerTeamColor, 0.16)}` : undefined,
    };

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
                inactive ? 'text-red-700' : 'text-slate-800'
            } ${selectable ? 'cursor-pointer hover:shadow-sm' : ''}`}
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
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border bg-white"
                    style={
                        selected && !inactive
                            ? { borderColor: workerTeamColor, backgroundColor: workerTeamColor, color: '#fff' }
                            : { borderColor: hexToRgba(workerTeamColor, 0.45) }
                    }
                >
                    {selected ? <Check size={10} /> : null}
                </span>
            ) : null}
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: inactive ? '#ef4444' : workerTeamColor }} />
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
    selected?: boolean;
    assignedTeamColor?: string;
    onToggleSelect?: () => void;
    onAdd?: () => void;
}> = ({ vehicle, selected, assignedTeamColor, onToggleSelect, onAdd }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `vehicle:${vehicle.id}`,
        data: {
            kind: 'vehicle',
            id: vehicle.id,
            label: vehicle.licensePlate,
        } satisfies DragPayload,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: selected
            ? '#2563eb'
            : isUnavailableVehicle(vehicle)
                ? '#fecaca'
                : assignedTeamColor
                    ? hexToRgba(assignedTeamColor, 0.55)
                    : '#cbd5e1',
        backgroundColor: !selected && assignedTeamColor && !isUnavailableVehicle(vehicle) ? hexToRgba(assignedTeamColor, 0.07) : undefined,
        boxShadow: selected ? '0 0 0 3px rgba(37, 99, 235, 0.16)' : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            onClick={onToggleSelect}
            className={`flex h-12 cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-2.5 shadow-sm transition hover:shadow-md ${
                isUnavailableVehicle(vehicle) ? 'bg-red-50' : ''
            }`}
        >
            <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600"
                style={
                    assignedTeamColor && !isUnavailableVehicle(vehicle)
                        ? { backgroundColor: hexToRgba(assignedTeamColor, 0.12), color: assignedTeamColor }
                        : undefined
                }
            >
                <Truck size={15} />
            </span>
            <h3 className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{vehicle.licensePlate}</h3>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onAdd?.();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                title="차량 추가"
            >
                <Plus size={14} />
            </button>
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="차량 드래그"
            >
                <GripVertical size={14} />
            </button>
        </article>
    );
};

const DraggableSiteCard: React.FC<{
    site: Site;
    color: string;
    selected: boolean;
    onSelect: () => void;
    onRegister: () => void;
}> = ({ site, color, selected, onSelect, onRegister }) => {
    const siteId = site.id || site.name;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `site:${siteId}`,
        data: {
            kind: 'site',
            id: siteId,
            label: site.name,
        } satisfies DragPayload,
        disabled: !siteId,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: selected ? color : hexToRgba(color, 0.5),
        boxShadow: selected ? `0 0 0 3px ${hexToRgba(color, 0.18)}` : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-2.5 shadow-sm transition hover:shadow-md"
        >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{site.name}</h3>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onRegister();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                title="현장 등록"
            >
                <Plus size={14} />
            </button>
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="현장 드래그"
            >
                <GripVertical size={14} />
            </button>
        </article>
    );
};

const SupportRosterLineCard: React.FC<{
    roster: TeamRoster;
    selected: boolean;
    onSelect: () => void;
    onAdd: () => void;
}> = ({ roster, selected, onSelect, onAdd }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `team:${roster.id}`,
        data: { kind: 'team', id: roster.id, label: roster.name } satisfies DragPayload,
    });

    const style: React.CSSProperties = {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderColor: selected ? roster.color : hexToRgba(roster.color, 0.5),
        boxShadow: selected ? `0 0 0 3px ${hexToRgba(roster.color, 0.18)}` : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-2.5 shadow-sm transition hover:shadow-md"
        >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: roster.color }} />
            <h3 className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{roster.name}</h3>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onAdd();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                title="지원팀 추가"
            >
                <Plus size={14} />
            </button>
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="지원팀 드래그"
            >
                <GripVertical size={14} />
            </button>
        </article>
    );
};

const TeamRosterCard: React.FC<{
    roster: TeamRoster;
    selected: boolean;
    onSelect: () => void;
    selectedWorkerIds: Set<string>;
    supportSelected: boolean;
    onToggleSupportTeam: () => void;
    onToggleWorker: (workerId: string) => void;
    onToggleAllWorkers: () => void;
}> = ({
    roster,
    selected,
    onSelect,
    selectedWorkerIds,
    supportSelected,
    onToggleSupportTeam,
    onToggleWorker,
    onToggleAllWorkers,
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `team:${roster.id}`,
        data: { kind: 'team', id: roster.id, label: roster.name } satisfies DragPayload,
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
        : { opacity: isDragging ? 0.35 : 1 };
    const isSupportRoster = roster.kind === 'support';
    const selectedCount = roster.workers.filter((worker) => worker.id && selectedWorkerIds.has(worker.id)).length;
    const allWorkersSelected = !isSupportRoster && roster.workers.length > 0 && selectedCount === roster.workers.length;
    const someWorkersSelected = !isSupportRoster && selectedCount > 0;
    const rosterSelected = selected || supportSelected;
    const cardStyle: React.CSSProperties = {
        ...style,
        borderColor: rosterSelected ? roster.color : hexToRgba(roster.color, 0.55),
        boxShadow: rosterSelected ? `0 0 0 3px ${hexToRgba(roster.color, 0.18)}` : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={cardStyle}
            className="rounded-lg border-2 bg-white p-3 shadow-sm transition hover:shadow-md"
        >
            <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: roster.color }} />
                        <h3 className="truncate text-sm font-black text-slate-900">{roster.name}</h3>
                        {roster.sourceLabel ? (
                            <span
                                className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black"
                                style={{
                                    borderColor: hexToRgba(roster.color, 0.35),
                                    backgroundColor: hexToRgba(roster.color, 0.08),
                                    color: roster.color,
                                }}
                            >
                                {roster.sourceLabel}
                            </span>
                        ) : null}
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
                    <label
                        onClick={(event) => event.stopPropagation()}
                        className="mb-1 flex w-full cursor-pointer items-center justify-between rounded-md bg-white px-2 py-1.5 text-xs font-black text-slate-700"
                    >
                        <span className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={allWorkersSelected}
                                ref={(node) => {
                                    if (node) node.indeterminate = someWorkersSelected && !allWorkersSelected;
                                }}
                                onChange={onToggleAllWorkers}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            전체 선택
                        </span>
                        <span className="text-slate-400">
                            {selectedCount}/{roster.workers.length}
                        </span>
                    </label>
                    {roster.workers.length > 0 ? (
                        roster.workers.map((worker) => (
                            <DraggableWorkerPill
                                key={worker.id}
                                worker={worker}
                                teamColor={roster.kind === 'unassigned' ? normalizeColor(worker.color) || roster.color : roster.color}
                                selectable
                                selected={Boolean(worker.id && selectedWorkerIds.has(worker.id))}
                                onToggleSelect={() => worker.id && onToggleWorker(worker.id)}
                            />
                        ))
                    ) : (
                        <span className="text-xs font-semibold text-slate-400">등록된 작업자가 없습니다.</span>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleSupportTeam();
                    }}
                    className={`mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs font-black ${
                        supportSelected
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                >
                    <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                            supportSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'
                        }`}
                    >
                        {supportSelected ? <Check size={11} /> : null}
                    </span>
                    팀명 선택
                </button>
            )}

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
    workersById: Map<string, Worker>;
    workerTeamColorById: Map<string, string>;
    vehiclesById: Map<string, Vehicle>;
    vehicleAssignedTeamColorById: Map<string, string>;
    issues: string[];
    selectedDestination: boolean;
    recentlyUpdated: boolean;
    onSelectDestination: () => void;
    onDelete: () => void;
    onRemoveWorker: (workerId: string) => void;
    onRemoveSupportTeam: (teamId: string) => void;
    onRemoveVehicle: (vehicleId: string) => void;
}> = ({
    schedule,
    workersById,
    workerTeamColorById,
    vehiclesById,
    vehicleAssignedTeamColorById,
    issues,
    selectedDestination,
    recentlyUpdated,
    onSelectDestination,
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
        <article
            ref={setRefs}
            style={style}
            onClick={onSelectDestination}
            className={`relative cursor-pointer rounded-lg bg-white p-4 shadow-sm transition hover:shadow-md ${
                recentlyUpdated
                    ? 'border-2 border-emerald-400 ring-4 ring-emerald-100 animate-pulse'
                    : 'border border-slate-200'
            }`}
        >
            {selectedDestination ? (
                <span
                    className="absolute right-12 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200"
                    title="선택 중인 이동 대상"
                >
                    <MapPin size={17} />
                </span>
            ) : null}
            <div
                className="-mx-4 -mt-4 mb-3 h-1 rounded-t-lg"
                style={{ backgroundColor: schedule.siteColor || schedule.teamColor }}
            />
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: schedule.teamColor }} />
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

            {schedule.workerIds.length > 0 ? (
                <div
                    className="mt-3 rounded-md border border-dashed border-slate-200 p-2"
                    style={{ backgroundColor: hexToRgba(schedule.teamColor, 0.05) }}
                >
                    <div className="mb-2 flex items-center">
                        <span className="text-[11px] font-black text-slate-500">작업자 {schedule.workerIds.length}명</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {schedule.workerIds.map((workerId) => {
                            const worker = workersById.get(workerId);
                            if (!worker) return null;
                            return (
                                <DraggableWorkerPill
                                    key={workerId}
                                    worker={worker}
                                    teamColor={workerTeamColorById.get(workerId) || schedule.teamColor}
                                    sourceScheduleId={schedule.id}
                                    onRemove={() => onRemoveWorker(workerId)}
                                />
                            );
                        })}
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

            {scheduleVehicleIds.length > 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 flex items-center">
                        <span className="text-[11px] font-black text-slate-500">차량</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {scheduleVehicleIds.map((vehicleId, index) => {
                            const assignedVehicle = vehiclesById.get(vehicleId);
                            const vehicleTeamColor = vehicleAssignedTeamColorById.get(vehicleId);
                            const vehicleUnavailable = isUnavailableVehicle(assignedVehicle);
                            return (
                                <span
                                    key={vehicleId}
                                    className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                                        vehicleUnavailable
                                            ? 'border-red-200 bg-red-50 text-red-700'
                                            : 'text-slate-800'
                                    }`}
                                    style={
                                        vehicleUnavailable
                                            ? undefined
                                            : vehicleTeamColor
                                                ? {
                                                    borderColor: hexToRgba(vehicleTeamColor, 0.5),
                                                    backgroundColor: hexToRgba(vehicleTeamColor, 0.08),
                                                }
                                            : {
                                                borderColor: '#cbd5e1',
                                                backgroundColor: '#f8fafc',
                                            }
                                    }
                                >
                                    <Truck size={13} style={vehicleUnavailable || !vehicleTeamColor ? undefined : { color: vehicleTeamColor }} />
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
                </div>
            ) : null}

            {issues.length > 0 ? (
                <div className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700">
                    {issues[0]}
                </div>
            ) : null}

            <div className="mt-3 flex justify-end gap-1">
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
    const [selectedSupportTeamIds, setSelectedSupportTeamIds] = useState<string[]>([]);
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
    const [recentlyUpdatedSiteKey, setRecentlyUpdatedSiteKey] = useState('');
    const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('sites');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
    const [deletedSchedule, setDeletedSchedule] = useState<ScheduleItem | null>(null);
    const [hasTemporaryDraft, setHasTemporaryDraft] = useState(false);

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
        const activeTeams = teams
            .filter((team) => team.status !== 'closed')
            .sort((left, right) => compareKoreanName(left.name, right.name));
        const activeWorkers = workers.filter((worker) => worker.id && !isInactiveWorker(worker));
        const rows: TeamRoster[] = activeTeams.map((team) => {
            const memberIds = new Set([...(team.assignedWorkers || []), ...(team.memberIds || [])]);
            const memberNames = new Set((team.memberNames || []).map((name) => normalizeComparableText(name)));
            const teamWorkers = activeWorkers
                .filter((worker) => {
                    return workerMatchesTeam(worker, team, memberIds, memberNames);
                })
                .sort((left, right) => compareKoreanName(left.name, right.name));
            const kind: RosterKind = isSupportTeam(team, teamWorkers) ? 'support' : 'team';

            return {
                id: team.id || team.name,
                name: team.name,
                color: getTeamColor(team),
                kind,
                leaderName: team.leaderName || undefined,
                sourceLabel: getTeamSourceLabel(team, teamWorkers),
                workers: teamWorkers,
            };
        });

        const assignedWorkerIds = new Set(rows.flatMap((row) => row.workers.map((worker) => worker.id || '')));
        const unassignedWorkers = activeWorkers.filter((worker) => worker.id && !assignedWorkerIds.has(worker.id));
        const unassignedRegularWorkers = unassignedWorkers.filter((worker) => !isSupportWorker(worker));

        rows.push(...groupUnassignedWorkers(unassignedRegularWorkers, 'unassigned', '미배정 작업자', UNASSIGNED_TEAM_ID));

        return rows;
    }, [teams, workers]);

    const assignedWorkerIdSet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => schedule.workerIds.forEach((workerId) => workerId && set.add(workerId)));
        return set;
    }, [schedules]);

    const assignedSupportTeamKeySet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => {
            schedule.supportTeams.forEach((team) => {
                const key = team.id || team.name;
                if (key) set.add(key);
            });
        });
        return set;
    }, [schedules]);

    const assignedVehicleIdSet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => getScheduleVehicleIds(schedule).forEach((vehicleId) => vehicleId && set.add(vehicleId)));
        return set;
    }, [schedules]);

    const registeredSiteKeySet = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((schedule) => {
            const key = makeSiteKey(schedule);
            if (key) set.add(key);
        });
        return set;
    }, [schedules]);

    const availableRosters = useMemo(
        () =>
            rosters
                .map((roster) => {
                    if (roster.kind === 'support') return roster;
                    return {
                        ...roster,
                        workers: roster.workers.filter((worker) => worker.id && !assignedWorkerIdSet.has(worker.id)),
                    };
                })
                .filter((roster) => {
                    if (roster.kind === 'support') return !assignedSupportTeamKeySet.has(roster.id || roster.name);
                    return roster.workers.length > 0;
                }),
        [assignedSupportTeamKeySet, assignedWorkerIdSet, rosters]
    );

    const panelRosters = useMemo(
        () =>
            availableRosters.filter((roster) =>
                leftPanelTab === 'support' ? roster.kind === 'support' : roster.kind !== 'support'
            ).sort((left, right) => compareKoreanName(left.name, right.name)),
        [availableRosters, leftPanelTab]
    );

    const filteredRosters = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return panelRosters;
        return panelRosters.filter((roster) => {
            const workerNames =
                roster.kind === 'support' ? '' : roster.workers.map((worker) => `${worker.name} ${worker.role || ''}`).join(' ');
            return `${roster.name} ${roster.sourceLabel || ''} ${roster.leaderName || ''} ${workerNames}`.toLowerCase().includes(term);
        }).sort((left, right) => compareKoreanName(left.name, right.name));
    }, [panelRosters, searchTerm]);

    const filteredVehicles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return vehicles
            .filter((vehicle) => {
                if (assignedVehicleIdSet.has(vehicle.id)) return false;
                if (!term) return true;
                return `${vehicle.licensePlate} ${vehicle.model || ''} ${vehicle.currentAssigneeName || ''}`.toLowerCase().includes(term);
            })
            .sort((left, right) => compareKoreanName(left.licensePlate || left.model, right.licensePlate || right.model));
    }, [assignedVehicleIdSet, searchTerm, vehicles]);

    const vehicleAssignedTeamColorById = useMemo(() => {
        const map = new Map<string, string>();
        vehicles.forEach((vehicle) => {
            const assignedTeam = getVehicleAssignedTeam(vehicle, teamsById, teams);
            const color = normalizeColor(assignedTeam?.color);
            if (vehicle.id && color) map.set(vehicle.id, color);
        });
        return map;
    }, [teams, teamsById, vehicles]);

    const workerTeamColorById = useMemo(() => {
        const map = new Map<string, string>();
        workers.forEach((worker) => {
            const assignedTeam = getWorkerAssignedTeam(worker, teamsById, teams);
            const color = normalizeColor(assignedTeam?.color) || normalizeColor(worker.color);
            if (worker.id && color) map.set(worker.id, color);
        });
        return map;
    }, [teams, teamsById, workers]);

    const filteredSites = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return sites
            .filter((site) => {
                if (registeredSiteKeySet.has(makeSiteSelectionKey(site))) return false;
                if (!term) return true;
                return `${site.name} ${site.address || ''} ${site.responsibleTeamName || ''} ${site.companyName || ''} ${site.code || ''}`
                    .toLowerCase()
                    .includes(term);
            })
            .sort((left, right) => compareKoreanName(left.name, right.name));
    }, [registeredSiteKeySet, searchTerm, sites]);

    const selectedRoster = useMemo(
        () => availableRosters.find((roster) => roster.id === selectedTeamId) || availableRosters[0],
        [availableRosters, selectedTeamId]
    );
    const selectedWorkerIdSet = useMemo(() => new Set(selectedWorkerIds), [selectedWorkerIds]);
    const selectedSupportTeamIdSet = useMemo(() => new Set(selectedSupportTeamIds), [selectedSupportTeamIds]);
    const selectedVehicleIdSet = useMemo(() => new Set(selectedVehicleIds), [selectedVehicleIds]);
    const selectedWorkers = useMemo(
        () => selectedWorkerIds.map((workerId) => workersById.get(workerId)).filter((worker): worker is Worker => Boolean(worker)),
        [selectedWorkerIds, workersById]
    );
    const selectedSupportTeams = useMemo(
        () => selectedSupportTeamIds.map((teamId) => availableRosters.find((roster) => roster.id === teamId)).filter((team): team is TeamRoster => Boolean(team)),
        [availableRosters, selectedSupportTeamIds]
    );
    const selectedVehicles = useMemo(
        () => selectedVehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)).filter((vehicle): vehicle is Vehicle => Boolean(vehicle)),
        [selectedVehicleIds, vehiclesById]
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
            const hasAssignedResources =
                schedule.workerIds.length > 0 || schedule.supportTeams.length > 0 || scheduleVehicleIds.length > 0;
            if (hasAssignedResources && scheduleVehicleIds.length === 0) issues.push('차량이 등록되지 않았습니다.');
            if (hasAssignedResources && !isSupportSchedule && schedule.workerIds.length === 0) {
                issues.push('작업자 또는 지원팀이 없습니다.');
            }

            schedule.workerIds.forEach((workerId) => {
                const worker = workersById.get(workerId);
                const duplicated = allSchedules.filter((entry) => entry.workerIds.includes(workerId));
                if (duplicated.length > 1) issues.push(`${worker?.name || '작업자'} 중복 배정`);
            });

            scheduleVehicleIds.forEach((vehicleId) => {
                const vehicle = vehiclesById.get(vehicleId);
                const duplicated = allSchedules.filter((entry) => getScheduleVehicleIds(entry).includes(vehicleId));
                if (duplicated.length > 1) issues.push(`${vehicle?.licensePlate || '차량'} 중복 배정`);
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
            const rawWorkerIds = cleanIds(assignment.workerIds || []).filter((workerId) => {
                const worker = workersById.get(workerId);
                return Boolean(worker && !isInactiveWorker(worker));
            });
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
                const rawWorkerIds = cleanIds(assignment.workerIds || []).filter((workerId) => {
                    const worker = workerMap.get(workerId);
                    return Boolean(worker && !isInactiveWorker(worker));
                });
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
        if (typeof window === 'undefined') return;
        setHasTemporaryDraft(Boolean(window.localStorage.getItem(getTempDraftStorageKey(date))));
    }, [date]);

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

    useEffect(() => {
        setSelectedWorkerIds((prev) => prev.filter((workerId) => !assignedWorkerIdSet.has(workerId)));
        setSelectedSupportTeamIds((prev) => prev.filter((teamId) => !assignedSupportTeamKeySet.has(teamId)));
        setSelectedVehicleIds((prev) => prev.filter((vehicleId) => !assignedVehicleIdSet.has(vehicleId)));
    }, [assignedSupportTeamKeySet, assignedVehicleIdSet, assignedWorkerIdSet]);

    useEffect(() => {
        if (!recentlyUpdatedSiteKey) return;
        const timeout = window.setTimeout(() => setRecentlyUpdatedSiteKey(''), 900);
        return () => window.clearTimeout(timeout);
    }, [recentlyUpdatedSiteKey]);

    const toggleWorkerSelection = (rosterId: string, workerId: string) => {
        setSelectedTeamId(rosterId);
        setSelectedWorkerIds((prev) => {
            const base = selectedTeamId === rosterId ? prev : [];
            return base.includes(workerId) ? base.filter((id) => id !== workerId) : [...base, workerId];
        });
    };

    const toggleAllWorkers = (roster: TeamRoster) => {
        setSelectedTeamId(roster.id);
        const workerIds = cleanIds(roster.workers.map((worker) => worker.id));
        setSelectedWorkerIds((prev) => {
            const current = selectedTeamId === roster.id ? prev : [];
            const allSelected = workerIds.length > 0 && workerIds.every((workerId) => current.includes(workerId));
            return allSelected ? [] : workerIds;
        });
    };

    const toggleSupportTeamSelection = (roster: TeamRoster) => {
        setSelectedTeamId(roster.id);
        setSelectedSupportTeamIds((prev) =>
            prev.includes(roster.id) ? prev.filter((teamId) => teamId !== roster.id) : [...prev, roster.id]
        );
    };

    const toggleVehicleSelection = (vehicleId: string) => {
        setSelectedVehicleIds((prev) =>
            prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
        );
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
        const siteKey = makeSiteKey(incoming);
        setRecentlyUpdatedSiteKey(siteKey);
        if (incoming.siteId) {
            setSelectedSiteId(incoming.siteId);
        }
        updateSchedules((prev) => {
            const key = siteKey;
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

    const registerSiteToBoard = (siteIdOrName?: string) => {
        const site =
            (siteIdOrName ? sitesById.get(siteIdOrName) : undefined) ||
            sites.find((entry) => entry.name === siteIdOrName) ||
            selectedSite;
        if (!site) {
            setMessage('등록할 현장을 먼저 선택하세요.');
            return;
        }

        const siteColor = getSiteColor(site, selectedRoster?.color || DEFAULT_RESOURCE_COLOR);
        const next: ScheduleItem = {
            id: makeScheduleId(),
            date,
            teamId: '',
            teamName: '',
            teamColor: siteColor,
            siteId: site.id || '',
            siteName: site.name,
            siteAddress: site.address || '',
            siteColor,
            workerIds: [],
            supportTeams: [],
            vehicleIds: [],
            vehicleLabels: [],
            vehicleId: '',
            vehicleLabel: '',
            status: 'draft',
            memo: '',
        };

        setSelectedSiteId(site.id || '');
        upsertScheduleForSite(next);
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(`${site.name} 현장을 먼저 등록했습니다. 이후 작업자, 지원팀, 차량을 추가하세요.`);
    };

    const moveVehicleToBoard = (vehicle: Vehicle) => {
        if (!selectedSiteId || !selectedSite) {
            setMessage('이동 대상 현장을 먼저 선택하세요.');
            return;
        }
        if (isUnavailableVehicle(vehicle)) {
            setMessage('사용할 수 없는 차량입니다.');
            return;
        }

        const siteColor = getSiteColor(selectedSite, selectedRoster?.color || DEFAULT_RESOURCE_COLOR);
        const next: ScheduleItem = {
            id: makeScheduleId(),
            date,
            teamId: '',
            teamName: '',
            teamColor: selectedRoster?.color || siteColor,
            siteId: selectedSiteId,
            siteName: selectedSite.name,
            siteAddress: selectedSite.address || '',
            siteColor,
            workerIds: [],
            supportTeams: [],
            vehicleIds: [vehicle.id],
            vehicleLabels: [vehicle.licensePlate],
            vehicleId: vehicle.id,
            vehicleLabel: vehicle.licensePlate,
            status: 'draft',
            memo: '',
        };

        upsertScheduleForSite(next);
        setSelectedVehicleIds((prev) => prev.filter((vehicleId) => vehicleId !== vehicle.id));
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(`${selectedSite.name}에 ${vehicle.licensePlate} 차량을 추가했습니다.`);
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
        if (!selectedSiteId || !selectedSite) {
            setMessage('이동 대상 현장을 먼저 선택하세요.');
            return;
        }

        const supportTeams = selectedSupportTeams.map((team) => ({
            id: team.id,
            name: team.name,
            color: team.color,
        }));
        const workerIds = cleanIds(selectedWorkerIds);
        const vehicleIds = cleanIds(selectedVehicleIds);

        if (workerIds.length === 0 && supportTeams.length === 0 && vehicleIds.length === 0) {
            setMessage('추가할 작업자, 지원팀 또는 차량을 선택하세요.');
            return;
        }

        const sourceRoster = selectedRoster || selectedSupportTeams[0] || rosters[0];
        if (!sourceRoster) return;

        const next = makeScheduleFromRoster(sourceRoster, {
            siteId: selectedSiteId,
            siteName: selectedSite.name,
            siteAddress: selectedSite.address || '',
            siteColor: getSiteColor(selectedSite, sourceRoster.color),
            workerIds,
            supportTeams,
            vehicleIds,
            vehicleLabels: vehicleIds.map((vehicleId) => vehiclesById.get(vehicleId)?.licensePlate || ''),
        });

        upsertScheduleForSite(next);
        setSelectedWorkerIds([]);
        setSelectedSupportTeamIds([]);
        setSelectedVehicleIds([]);
        boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage(`${selectedSite.name}에 선택한 리소스를 추가했습니다.`);
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
            if (activeData.kind === 'site') {
                applySiteToSchedule(targetScheduleId, activeData.id);
                setSelectedSiteId(activeData.id);
            }
            return;
        }

        if (overData?.kind === 'board-drop') {
            if (activeData.kind === 'site') {
                registerSiteToBoard(activeData.id);
                return;
            }

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
                const vehicle = vehiclesById.get(activeData.id);
                if (!vehicle) return;
                moveVehicleToBoard(vehicle);
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
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(getTempDraftStorageKey(date));
                setHasTemporaryDraft(false);
            }
            setMessage('일정이 저장되었습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to save', error);
            setMessage('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    const handleTemporarySave = () => {
        if (typeof window === 'undefined') return;

        const normalizedSchedules = mergeSchedulesBySite(schedules);
        const payload = {
            version: 1,
            date,
            savedAt: new Date().toISOString(),
            selectedSiteId,
            schedules: normalizedSchedules,
        };

        window.localStorage.setItem(getTempDraftStorageKey(date), JSON.stringify(payload));
        setHasTemporaryDraft(true);
        setMessage('임시저장되었습니다.');
    };

    const handleLoadTemporaryDraft = () => {
        if (typeof window === 'undefined') return;

        const raw = window.localStorage.getItem(getTempDraftStorageKey(date));
        if (!raw) {
            setHasTemporaryDraft(false);
            setMessage('불러올 임시저장이 없습니다.');
            return;
        }

        try {
            const parsed = JSON.parse(raw) as {
                schedules?: ScheduleItem[];
                selectedSiteId?: string;
            };
            const draftSchedules = Array.isArray(parsed.schedules) ? parsed.schedules : [];
            setSchedules(mergeSchedulesBySite(draftSchedules));
            setSelectedSiteId(parsed.selectedSiteId || '');
            setDirty(true);
            setMessage('임시저장을 불러왔습니다.');
        } catch (error) {
            console.error('[FieldSchedulePlanner] Failed to load temporary draft', error);
            window.localStorage.removeItem(getTempDraftStorageKey(date));
            setHasTemporaryDraft(false);
            setMessage('임시저장을 불러오지 못했습니다.');
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
    const selectedResourceCount = selectedWorkerIds.length + selectedSupportTeamIds.length + selectedVehicleIds.length;
    const canMoveSelected =
        Boolean(selectedSiteId) && selectedResourceCount > 0;
    const moveTargetLabel = selectedSite?.name || '현장 선택';
    const moveSourceLabel =
        selectedWorkerIds.length > 0
            ? selectedRoster?.name || '팀 선택'
            : selectedSupportTeams.length > 0
                ? selectedSupportTeams[0].name
                : selectedVehicleIds.length > 0
                    ? '차량'
                    : '대상 선택';
    const selectedWorkerNames = selectedWorkers.map((worker) => worker.name);
    const selectedResourceParts = [
        selectedWorkers.length > 0
            ? `${selectedWorkerNames.slice(0, 3).join(', ')}${selectedWorkerNames.length > 3 ? ` 외 ${selectedWorkerNames.length - 3}명` : ''}`
            : '',
        selectedSupportTeams.length > 0 ? `지원팀 ${selectedSupportTeams.length}팀` : '',
        selectedVehicles.length > 0 ? `차량 ${selectedVehicles.length}대` : '',
    ].filter(Boolean);
    const moveWorkerLabel = selectedResourceParts.join(' · ') || '작업자/지원팀/차량 선택';
    const addGuideLabel = selectedSite
        ? selectedResourceParts.length > 0
            ? `${selectedSite.name}으로 ${selectedResourceParts.join(', ')} 추가`
            : `${selectedSite.name} 현장만 먼저 등록할 수 있습니다.`
        : '현장 카드를 먼저 선택하세요';
    const selectedDestinationScheduleKey = selectedSite
        ? makeSiteKey({ siteId: selectedSite.id || '', siteName: selectedSite.name } as Pick<ScheduleItem, 'siteId' | 'siteName'>)
        : '';

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
                                    onClick={handleTemporarySave}
                                    className="flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-700 hover:bg-amber-100"
                                >
                                    <Save size={16} />
                                    임시저장
                                </button>
                                {hasTemporaryDraft ? (
                                    <button
                                        type="button"
                                        onClick={handleLoadTemporaryDraft}
                                        className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                        <RefreshCw size={16} />
                                        임시불러오기
                                    </button>
                                ) : null}
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
                                        placeholder={
                                            leftPanelTab === 'vehicles'
                                                ? '차량번호, 모델 검색'
                                                : leftPanelTab === 'sites'
                                                    ? '현장명, 주소 검색'
                                                    : '팀, 작업자 검색'
                                        }
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                                    />
                                </div>

                                <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setLeftPanelTab('sites')}
                                        className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black ${
                                            leftPanelTab === 'sites' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                        }`}
                                    >
                                        <MapPin size={14} />
                                        현장
                                    </button>
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

                                {leftPanelTab !== 'sites' ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                        <div className="mb-2 flex min-w-0 items-center gap-2 px-1 text-xs font-bold text-slate-600">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedSiteColor || '#cbd5e1' }} />
                                            <span className="min-w-0 flex-1 truncate">{moveTargetLabel}</span>
                                            <span className="shrink-0 text-slate-400">{selectedResourceCount}개 선택</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={moveSelectedToBoard}
                                            disabled={!canMoveSelected}
                                            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            <Plus size={17} />
                                            추가하기
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                                {loading ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">
                                        데이터를 불러오는 중입니다.
                                    </div>
                                ) : leftPanelTab === 'sites' ? (
                                    filteredSites.length > 0 ? (
                                        <div className="space-y-2">
                                            {filteredSites.map((site) => {
                                                const siteColor = getSiteColor(site, selectedRoster?.color || DEFAULT_RESOURCE_COLOR);
                                                const siteKey = makeSiteSelectionKey(site);
                                                return (
                                                    <DraggableSiteCard
                                                        key={site.id || site.name}
                                                        site={site}
                                                        color={siteColor}
                                                        selected={Boolean(selectedSite && siteKey === makeSiteSelectionKey(selectedSite))}
                                                        onSelect={() => {
                                                            setSelectedSiteId(site.id || '');
                                                            setMessage(`이동 대상: ${site.name}`);
                                                        }}
                                                        onRegister={() => registerSiteToBoard(site.id || site.name)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            표시할 현장이 없습니다.
                                        </div>
                                    )
                                ) : leftPanelTab === 'support' ? (
                                    filteredRosters.length > 0 ? (
                                        <div className="space-y-2">
                                            {filteredRosters.map((roster) => (
                                                <SupportRosterLineCard
                                                    key={roster.id}
                                                    roster={roster}
                                                    selected={selectedSupportTeamIdSet.has(roster.id)}
                                                    onSelect={() => toggleSupportTeamSelection(roster)}
                                                    onAdd={() => moveRosterToBoard(roster)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            표시할 지원팀이 없습니다.
                                        </div>
                                    )
                                ) : leftPanelTab !== 'vehicles' ? (
                                    filteredRosters.length > 0 ? (
                                        filteredRosters.map((roster) => (
                                            <TeamRosterCard
                                                key={roster.id}
                                                roster={roster}
                                                selected={selectedRoster?.id === roster.id}
                                                onSelect={() => setSelectedTeamId(roster.id)}
                                                selectedWorkerIds={selectedRoster?.id === roster.id ? selectedWorkerIdSet : new Set()}
                                                supportSelected={selectedSupportTeamIdSet.has(roster.id)}
                                                onToggleSupportTeam={() => toggleSupportTeamSelection(roster)}
                                                onToggleWorker={(workerId) => toggleWorkerSelection(roster.id, workerId)}
                                                onToggleAllWorkers={() => toggleAllWorkers(roster)}
                                            />
                                        ))
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                            표시할 팀이나 작업자가 없습니다.
                                        </div>
                                    )
                                ) : filteredVehicles.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredVehicles.map((vehicle) => (
                                            <DraggableVehicleCard
                                                key={vehicle.id}
                                                vehicle={vehicle}
                                                selected={selectedVehicleIdSet.has(vehicle.id)}
                                                assignedTeamColor={vehicleAssignedTeamColorById.get(vehicle.id)}
                                                onToggleSelect={() => toggleVehicleSelection(vehicle.id)}
                                                onAdd={() => moveVehicleToBoard(vehicle)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                        표시할 차량이 없습니다.
                                    </div>
                                )}
                            </div>
                        </aside>

                        <main className="min-w-0 overflow-hidden bg-slate-100">
                            <div className="border-b border-slate-200 bg-white px-5 py-4">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <span>{addGuideLabel}</span>
                                        </div>
                                    </div>
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
                                        차량 선택 후 추가 가능
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
                                    <div
                                        className="grid gap-3"
                                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                                    >
                                        {schedules.map((schedule) => {
                                            const scheduleKey = makeSiteKey(schedule);
                                            return (
                                                <ScheduleCard
                                                    key={schedule.id}
                                                    schedule={schedule}
                                                    workersById={workersById}
                                                    workerTeamColorById={workerTeamColorById}
                                                    vehiclesById={vehiclesById}
                                                    vehicleAssignedTeamColorById={vehicleAssignedTeamColorById}
                                                    issues={getScheduleIssues(schedule)}
                                                    selectedDestination={Boolean(selectedDestinationScheduleKey && scheduleKey === selectedDestinationScheduleKey)}
                                                    recentlyUpdated={Boolean(recentlyUpdatedSiteKey && scheduleKey === recentlyUpdatedSiteKey)}
                                                    onSelectDestination={() => {
                                                        if (schedule.siteId) {
                                                            setSelectedSiteId(schedule.siteId);
                                                            setMessage(`이동 대상: ${schedule.siteName}`);
                                                        }
                                                    }}
                                                    onDelete={() => deleteSchedule(schedule.id)}
                                                    onRemoveWorker={(workerId) => removeWorkerFromSchedule(schedule.id, workerId)}
                                                    onRemoveSupportTeam={(teamId) => removeSupportTeamFromSchedule(schedule.id, teamId)}
                                                    onRemoveVehicle={(vehicleId) => removeVehicleFromSchedule(schedule.id, vehicleId)}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex min-h-[460px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
                                        <UserPlus size={36} className="text-slate-400" />
                                        <p className="mt-3 text-base font-black text-slate-800">아직 만든 일정이 없습니다.</p>
                                        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                                            좌측 현장 탭에서 현장을 먼저 등록하거나, 현장 선택 후 작업자와 차량을 추가하세요.
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
