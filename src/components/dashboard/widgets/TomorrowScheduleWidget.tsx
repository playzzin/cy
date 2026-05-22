import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDay,
    faChevronDown,
    faChevronUp,
    faClipboardList,
    faMapMarkerAlt,
    faRoute,
    faSpinner,
    faTruck,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { dispatchService, DailyDispatch, DispatchAssignment } from '../../../services/dispatchService';
import { manpowerService, Worker } from '../../../services/manpowerService';
import { teamService, Team } from '../../../services/teamService';
import { vehicleService } from '../../../services/vehicleService';
import { Vehicle } from '../../../types/vehicle';
import { useAuth } from '../../../contexts/AuthContext';

type ScheduleSource = 'tomorrow' | 'fallback' | 'empty';

type ExtendedDispatchAssignment = DispatchAssignment & Partial<{
    responsibleTeamId: string;
    responsibleTeamName: string;
    workerTeamIds: Record<string, string>;
    workerTeamNames: Record<string, string>;
}>;

interface LookupState {
    workersById: Map<string, Worker>;
    vehiclesById: Map<string, Vehicle>;
    teamsById: Map<string, Team>;
    teamsByName: Map<string, Team>;
}

interface DisplayChip {
    key: string;
    label: string;
    subLabel?: string;
    color?: string;
}

interface ViewerTeamScope {
    teamIds: string[];
    teamNames: string[];
    label: string;
    hasScope: boolean;
}

const DEFAULT_RESOURCE_COLOR = '#64748b';
const BOARD_WORKERS_PER_COLUMN = 8;
const BOARD_VEHICLE_TWO_COLUMN_WORKER_THRESHOLD = 10;

interface ScheduleState {
    loading: boolean;
    error: string | null;
    targetDate: string;
    dispatch: DailyDispatch | null;
    source: ScheduleSource;
}

const WidgetContainer = styled.section`
    background: #ffffff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;

    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

const TitleGroup = styled.div`
    min-width: 0;
`;

const Title = styled.h3`
    font-size: 1.1rem;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 6px;

    svg {
        color: #0ea5e9;
    }
`;

const DateText = styled.div`
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 700;
`;

const HeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;

    @media (max-width: 768px) {
        justify-content: flex-start;
    }
`;

const SourceBadge = styled.span<{ $fallback?: boolean }>`
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 800;
    color: ${(props) => (props.$fallback ? '#b45309' : '#0369a1')};
    background: ${(props) => (props.$fallback ? '#fffbeb' : '#e0f2fe')};
    border: 1px solid ${(props) => (props.$fallback ? '#fde68a' : '#bae6fd')};
`;

const FilterButton = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    border-radius: 999px;
    padding: 6px 11px;
    border: 1px solid ${(props) => (props.$active ? '#0f766e' : '#cbd5e1')};
    background: ${(props) => (props.$active ? '#0f766e' : '#ffffff')};
    color: ${(props) => (props.$active ? '#ffffff' : '#475569')};
    font-size: 0.78rem;
    font-weight: 900;
    cursor: default;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
        border-color: #0f766e;
        background: ${(props) => (props.$active ? '#115e59' : '#f0fdfa')};
        color: ${(props) => (props.$active ? '#ffffff' : '#0f766e')};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

const Metrics = styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 18px;

    @media (max-width: 768px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
`;

const Metric = styled.div`
    padding: 14px 16px;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;

    &:last-child {
        border-right: 0;
    }

    @media (max-width: 768px) {
        &:nth-child(2) {
            border-right: 0;
        }

        &:nth-child(-n + 2) {
            border-bottom: 1px solid #e2e8f0;
        }
    }
`;

const MetricLabel = styled.div`
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 800;
    margin-bottom: 6px;
`;

const MetricValue = styled.div`
    color: #0f172a;
    font-size: 1.35rem;
    font-weight: 900;
    display: flex;
    align-items: baseline;
    gap: 3px;

    small {
        color: #94a3b8;
        font-size: 0.82rem;
        font-weight: 800;
    }
`;

const Notice = styled.div`
    margin-bottom: 16px;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 0.86rem;
    font-weight: 700;
`;

const AssignmentList = styled.div`
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    max-height: 440px;
    overflow-y: auto;
`;

const AssignmentRow = styled.button`
    width: 100%;
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(150px, 0.75fr) minmax(320px, 1.6fr);
    gap: 16px;
    align-items: start;
    padding: 15px 16px;
    border: 0;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;

    &:last-child {
        border-bottom: 0;
    }

    &:hover {
        background: #f8fafc;
    }

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
        gap: 10px;
    }
`;

const SiteName = styled.div`
    color: #0f172a;
    font-size: 0.98rem;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const SubInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 5px;
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 700;
    min-width: 0;

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const TeamPill = styled.span<{ $color?: string }>`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: fit-content;
    max-width: 100%;
    padding: 5px 9px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid ${(props) => props.$color || '#cbd5e1'};
    color: #334155;
    font-size: 0.78rem;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ColorDot = styled.span<{ $color?: string }>`
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: ${(props) => props.$color || '#94a3b8'};
`;

const DetailStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const DetailRow = styled.div`
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 10px;
    align-items: start;

    @media (max-width: 520px) {
        grid-template-columns: 1fr;
        gap: 6px;
    }
`;

const DetailLabel = styled.div`
    color: #64748b;
    font-size: 0.76rem;
    font-weight: 900;
    padding-top: 5px;
`;

const ChipList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

const ResourceChip = styled.span<{ $color?: string }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 5px 9px;
    border-radius: 8px;
    color: #475569;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-left: 3px solid ${(props) => props.$color || '#cbd5e1'};
    font-size: 0.78rem;
    font-weight: 800;
    max-width: 100%;

    svg {
        color: #64748b;
    }
`;

const ChipText = styled.span`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const EmptyChipText = styled.span`
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 800;
    padding-top: 5px;
`;

const BoardSurface = styled.div`
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background-color: #f8fafc;
    background-image:
        linear-gradient(#e2e8f0 1px, transparent 1px),
        linear-gradient(90deg, #e2e8f0 1px, transparent 1px);
    background-size: 33px 33px;
    max-height: 560px;
    overflow: auto;
    padding: 18px;
`;

const BoardCards = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 28px;
`;

const BoardCard = styled.div`
    display: block;
    align-self: flex-start;
    border: 2px solid #cbd5e1;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    text-align: left;
    max-width: 100%;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    overflow: visible;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
    }
`;

const BoardCardHeader = styled.div`
    padding: 6px 8px;
    text-align: center;
`;

const BoardSiteName = styled.h4`
    margin: 0;
    font-size: 1.05rem;
    font-weight: 900;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const BoardAddress = styled.div`
    border-bottom: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: center;
    color: #0f172a;
    font-size: 0.86rem;
    font-weight: 800;

    @media (max-width: 768px) {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
    }
`;

const BoardAddressText = styled.span`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const NavigationButtons = styled.div`
    display: none;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: max-content;

    @media (max-width: 768px) {
        display: inline-flex;
    }
`;

const NavigationButton = styled.button<{ $variant: 'kakao' | 'tmap' }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 26px;
    padding: 3px 7px;
    border-radius: 6px;
    border: 1px solid ${(props) => (props.$variant === 'kakao' ? '#facc15' : '#10b981')};
    background: ${(props) => (props.$variant === 'kakao' ? '#fef08a' : '#d1fae5')};
    color: ${(props) => (props.$variant === 'kakao' ? '#713f12' : '#065f46')};
    font-size: 0.68rem;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;

    &:hover:not(:disabled) {
        filter: brightness(0.97);
        transform: translateY(-1px);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
`;

const BoardWorkerPanel = styled.div`
    display: grid;
    align-items: start;
    gap: 6px;
    border-bottom: 1px solid #cbd5e1;
    padding: 8px;
`;

const BoardNameOuter = styled.div`
    min-width: 0;
    border: 1px solid;
    padding: 4px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
`;

const BoardNameInner = styled.div`
    min-width: 0;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    padding: 2px 4px;
    text-align: center;
    font-size: 0.76rem;
    font-weight: 900;
    line-height: 1.25;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);

    span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const BoardSupportPanel = styled.div<{ $withTopBorder?: boolean }>`
    background: #ecfdf5;
    border-bottom: 1px solid #cbd5e1;
    border-top: ${(props) => (props.$withTopBorder ? '2px solid #047857' : '0')};
    padding: 8px;
`;

const BoardSupportTitle = styled.div`
    margin-bottom: 6px;
    border: 1px solid #047857;
    background: #059669;
    color: #ffffff;
    padding: 2px 8px;
    text-align: center;
    font-size: 0.72rem;
    font-weight: 900;
`;

const BoardSupportGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
`;

const BoardEmpty = styled.div`
    border-bottom: 1px solid #cbd5e1;
    padding: 10px 8px;
    text-align: center;
    color: #94a3b8;
    font-size: 0.86rem;
    font-weight: 800;
`;

const BoardVehicleGrid = styled.div`
    display: grid;
    gap: 1px;
    background: #cbd5e1;
`;

const BoardVehicleCell = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    padding: 6px 8px;
    color: #0f172a;
    text-align: center;
    font-size: 0.86rem;
    font-weight: 900;

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const EmptyState = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 120px;
    color: #94a3b8;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    font-weight: 800;
`;

const LoadingState = styled(EmptyState)`
    color: #64748b;
`;

const emptyLookups = (): LookupState => ({
    workersById: new Map(),
    vehiclesById: new Map(),
    teamsById: new Map(),
    teamsByName: new Map(),
});

const EMPTY_VIEWER_TEAM_SCOPE: ViewerTeamScope = {
    teamIds: [],
    teamNames: [],
    label: '내 팀',
    hasScope: false,
};

const toText = (value: unknown) => String(value || '').trim();
const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPad|iPod|Windows Phone/i;

const sameText = (a: unknown, b: unknown) => {
    const left = toText(a).toLowerCase();
    const right = toText(b).toLowerCase();
    return Boolean(left && right && left === right);
};

const buildViewerTeamScope = (worker?: Worker | null): ViewerTeamScope => {
    const teamIds = [toText(worker?.teamId)].filter(Boolean);
    const teamNames = [toText(worker?.teamName)].filter(Boolean);
    const hasScope = teamIds.length > 0 || teamNames.length > 0;

    return {
        teamIds,
        teamNames,
        label: teamNames[0] || teamIds[0] || '내 팀',
        hasScope,
    };
};

const buildLookupState = (workers: Worker[], vehicles: Vehicle[], teams: Team[]): LookupState => {
    const workersById = new Map<string, Worker>();
    const vehiclesById = new Map<string, Vehicle>();
    const teamsById = new Map<string, Team>();
    const teamsByName = new Map<string, Team>();

    workers.forEach((worker) => {
        const id = toText(worker.id);
        if (id) workersById.set(id, worker);
    });
    vehicles.forEach((vehicle) => {
        const id = toText(vehicle.id);
        if (id) vehiclesById.set(id, vehicle);
    });
    teams.forEach((team) => {
        const id = toText(team.id);
        const name = toText(team.name);
        if (id) teamsById.set(id, team);
        if (name) teamsByName.set(name, team);
    });

    return { workersById, vehiclesById, teamsById, teamsByName };
};

const dedupeByKey = <T extends { key: string }>(items: T[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = toText(item.key);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const hasAssignments = (dispatch: DailyDispatch | null | undefined) =>
    Array.isArray(dispatch?.assignments) && dispatch.assignments.length > 0;

const uniqueCount = (values: Array<string | undefined>) =>
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean)).size;

const getVehicleCount = (assignment: DispatchAssignment) => {
    const ids = [
        ...(assignment.vehicleIds || []),
        assignment.vehicleId,
    ].map((value) => String(value || '').trim()).filter(Boolean);

    const labels = [
        ...(assignment.vehicleLabels || []),
        assignment.vehicleLabel,
    ].map((value) => String(value || '').trim()).filter(Boolean);

    return Math.max(uniqueCount(ids), uniqueCount(labels));
};

const getSupportTeamCount = (assignment: DispatchAssignment) =>
    Math.max(
        uniqueCount((assignment.supportTeams || []).map((team) => team.id || team.name)),
        uniqueCount(assignment.supportTeamIds || [])
    );

const resolveTeam = (
    teamId: string | undefined,
    teamName: string | undefined,
    lookups: LookupState
) => {
    const byId = teamId ? lookups.teamsById.get(teamId) : undefined;
    if (byId) return byId;
    return teamName ? lookups.teamsByName.get(teamName) : undefined;
};

const getTeamColor = (
    teamId: string | undefined,
    teamName: string | undefined,
    lookups: LookupState,
    fallback?: string
) => resolveTeam(teamId, teamName, lookups)?.color || fallback || '#94a3b8';

const teamMatchesViewerScope = (
    scope: ViewerTeamScope,
    teamId?: unknown,
    teamName?: unknown
) => {
    if (!scope.hasScope) return false;

    const normalizedTeamId = toText(teamId);
    const normalizedTeamName = toText(teamName);

    return (
        Boolean(normalizedTeamId && scope.teamIds.some((id) => sameText(id, normalizedTeamId))) ||
        Boolean(normalizedTeamName && scope.teamNames.some((name) => sameText(name, normalizedTeamName)))
    );
};

const workerMatchesViewerScope = (
    assignment: ExtendedDispatchAssignment,
    workerId: string,
    worker: Worker | undefined,
    scope: ViewerTeamScope
) => {
    if (!scope.hasScope) return true;

    const assignedTeamId = toText(assignment.workerTeamIds?.[workerId]) || toText(worker?.teamId) || toText(assignment.teamId);
    const assignedTeamName = toText(assignment.workerTeamNames?.[workerId]) || toText(worker?.teamName) || toText(assignment.teamName);

    return teamMatchesViewerScope(scope, assignedTeamId, assignedTeamName);
};

const getResponsibleTeamChip = (
    assignment: ExtendedDispatchAssignment,
    lookups: LookupState
): DisplayChip => {
    const teamId = toText(assignment.responsibleTeamId || assignment.teamId);
    const teamName = toText(assignment.responsibleTeamName || assignment.teamName) || '담당팀 미지정';
    return {
        key: teamId || teamName,
        label: teamName,
        color: getTeamColor(teamId, teamName, lookups, assignment.teamColor),
    };
};

const getWorkerChips = (
    assignment: ExtendedDispatchAssignment,
    lookups: LookupState,
    scope: ViewerTeamScope = EMPTY_VIEWER_TEAM_SCOPE
): DisplayChip[] => {
    return dedupeByKey((assignment.workerIds || []).filter((workerId) => {
        const id = toText(workerId);
        const worker = lookups.workersById.get(id);
        return workerMatchesViewerScope(assignment, id, worker, scope);
    }).map((workerId) => {
        const id = toText(workerId);
        const worker = lookups.workersById.get(id);
        const teamId = toText(assignment.workerTeamIds?.[id] || worker?.teamId || assignment.teamId);
        const teamName = toText(assignment.workerTeamNames?.[id] || worker?.teamName || assignment.teamName);

        return {
            key: id,
            label: toText(worker?.name) || id,
            subLabel: teamName || undefined,
            color: getTeamColor(teamId, teamName, lookups, worker?.color || assignment.teamColor),
        };
    }));
};

const assignmentHasViewerTeamWorker = (
    assignment: ExtendedDispatchAssignment,
    lookups: LookupState,
    scope: ViewerTeamScope
) => {
    if (!scope.hasScope) return true;

    return (assignment.workerIds || []).some((workerId) => {
        const id = toText(workerId);
        const worker = lookups.workersById.get(id);
        return workerMatchesViewerScope(assignment, id, worker, scope);
    });
};

const getSupportTeamChips = (
    assignment: ExtendedDispatchAssignment,
    lookups: LookupState
): DisplayChip[] => {
    const fromObjects = (assignment.supportTeams || []).map((team) => {
        const id = toText(team.id);
        const name = toText(team.name) || id;
        return {
            key: id || name,
            label: name,
            color: team.color || getTeamColor(id, name, lookups),
        };
    });

    const objectKeys = new Set(fromObjects.map((team) => team.key));
    const fromIds = (assignment.supportTeamIds || [])
        .map((teamId) => {
            const id = toText(teamId);
            if (!id || objectKeys.has(id)) return null;
            const team = lookups.teamsById.get(id);
            return {
                key: id,
                label: toText(team?.name) || id,
                color: team?.color || '#f97316',
            };
        })
        .filter(Boolean) as DisplayChip[];

    return dedupeByKey([...fromObjects, ...fromIds]);
};

const getAssignmentTeamColor = (assignment: ExtendedDispatchAssignment, lookups: LookupState) =>
    getTeamColor(
        toText(assignment.responsibleTeamId || assignment.teamId),
        toText(assignment.responsibleTeamName || assignment.teamName),
        lookups,
        assignment.teamColor || assignment.siteColor
    );

const getVehicleTeamColor = (
    vehicle: Vehicle | undefined,
    assignment: ExtendedDispatchAssignment,
    lookups: LookupState
) => {
    const assigneeType = toText(vehicle?.currentAssigneeType).toUpperCase();

    if (assigneeType === 'TEAM') {
        const teamColor = getTeamColor(
            toText(vehicle?.currentAssigneeId),
            toText(vehicle?.currentAssigneeName),
            lookups
        );
        if (normalizeColor(teamColor)) return teamColor;
    }

    if (assigneeType === 'WORKER') {
        const worker = vehicle?.currentAssigneeId ? lookups.workersById.get(toText(vehicle.currentAssigneeId)) : undefined;
        const teamColor = getTeamColor(
            toText(worker?.teamId),
            toText(worker?.teamName || vehicle?.currentAssigneeName),
            lookups,
            worker?.color || assignment.teamColor
        );
        if (normalizeColor(teamColor)) return teamColor;
    }

    return getAssignmentTeamColor(assignment, lookups);
};

const getVehicleChips = (
    assignment: ExtendedDispatchAssignment,
    lookups: LookupState
): DisplayChip[] => {
    const vehicleIds = [
        ...(assignment.vehicleIds || []),
        assignment.vehicleId,
    ].map(toText).filter(Boolean);
    const labels = [
        ...(assignment.vehicleLabels || []),
        assignment.vehicleLabel,
    ].map(toText).filter(Boolean);

    const fromIds = vehicleIds.map((id) => {
        const vehicle = lookups.vehiclesById.get(id);
        return {
            key: id,
            label: toText(vehicle?.licensePlate) || labels.shift() || id,
            subLabel: toText(vehicle?.model) || undefined,
            color: getVehicleTeamColor(vehicle, assignment, lookups),
        };
    });

    const usedLabels = new Set(fromIds.map((item) => item.label));
    const fromLabels = labels
        .filter((label) => !usedLabels.has(label))
        .map((label) => ({
            key: label,
            label,
            color: getAssignmentTeamColor(assignment, lookups),
        }));

    return dedupeByKey([...fromIds, ...fromLabels]);
};

const normalizeColor = (value?: string | null) => {
    const color = toText(value);
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    return '';
};

const hexToRgba = (hex: string, alpha: number) => {
    const normalized = normalizeColor(hex) || DEFAULT_RESOURCE_COLOR;
    const value = normalized.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getReadableTextColor = (hex: string) => {
    const normalized = normalizeColor(hex) || DEFAULT_RESOURCE_COLOR;
    const value = normalized.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? '#0f172a' : '#ffffff';
};

const formatDateText = (date: string) => {
    try {
        return format(parseISO(date), 'yyyy년 M월 d일 EEEE', { locale: ko });
    } catch {
        return date;
    }
};

const formatShortDateText = (date: string) => {
    try {
        return format(parseISO(date), 'M월 d일', { locale: ko });
    } catch {
        return date;
    }
};

const getDispatchUpdatedMillis = (dispatch: DailyDispatch): number => {
    try {
        return dispatch.updatedAt?.toMillis?.() || 0;
    } catch {
        return 0;
    }
};

const getDestinationName = (assignment: ExtendedDispatchAssignment) =>
    toText(assignment.siteName) || toText(assignment.siteAddress) || '현장';

const getDestinationQuery = (assignment: ExtendedDispatchAssignment) => {
    const siteName = toText(assignment.siteName);
    const siteAddress = toText(assignment.siteAddress);
    return [siteName, siteAddress].filter(Boolean).join(' ');
};

const buildKakaoNaviDeepLink = (assignment: ExtendedDispatchAssignment) => {
    const params = new URLSearchParams({
        name: getDestinationName(assignment),
        coord_type: 'wgs84',
    });
    const address = toText(assignment.siteAddress);
    if (address) params.set('addr', address);
    return `kakaonavi://navigate?${params.toString()}`;
};

const buildKakaoFallbackUrl = (assignment: ExtendedDispatchAssignment) =>
    `https://map.kakao.com/link/search/${encodeURIComponent(getDestinationQuery(assignment) || getDestinationName(assignment))}`;

const buildTmapDeepLink = (assignment: ExtendedDispatchAssignment) =>
    `tmap://search?name=${encodeURIComponent(getDestinationQuery(assignment) || getDestinationName(assignment))}`;

const buildTmapFallbackUrl = (assignment: ExtendedDispatchAssignment) =>
    `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${encodeURIComponent(getDestinationQuery(assignment) || getDestinationName(assignment))}`;

const openNavigation = (deepLink: string, fallbackUrl: string) => {
    if (!MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent)) {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    let movedToApp = false;
    const handleVisibilityChange = () => {
        if (document.hidden) movedToApp = true;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange, { once: true });
    window.location.href = deepLink;

    window.setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (!movedToApp && !document.hidden) {
            window.location.href = fallbackUrl;
        }
    }, 1400);
};

export const TomorrowScheduleWidget: React.FC = () => {
    const { currentUser } = useAuth();
    const tomorrowDate = useMemo(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'), []);
    const [lookups, setLookups] = useState<LookupState>(() => emptyLookups());
    const [viewerTeamScope, setViewerTeamScope] = useState<ViewerTeamScope>(EMPTY_VIEWER_TEAM_SCOPE);
    const [showMyTeamOnly, setShowMyTeamOnly] = useState(false);
    const [isBoardCollapsed, setIsBoardCollapsed] = useState(false);
    const [state, setState] = useState<ScheduleState>({
        loading: true,
        error: null,
        targetDate: tomorrowDate,
        dispatch: null,
        source: 'empty',
    });

    useEffect(() => {
        let isMounted = true;

        const loadSchedule = async () => {
            setState((prev) => ({ ...prev, loading: true, error: null }));

            try {
                const [tomorrowDispatch, workers, vehicles, teams, linkedWorker] = await Promise.all([
                    dispatchService.getDispatchByDate(tomorrowDate),
                    manpowerService.getWorkers().catch(() => []),
                    vehicleService.listAllVehicles().catch(() => []),
                    teamService.getTeams().catch(() => []),
                    currentUser?.uid
                        ? manpowerService.getWorkerByUid(currentUser.uid).catch(() => null)
                        : Promise.resolve(null),
                ]);
                if (!isMounted) return;
                setLookups(buildLookupState(workers, vehicles, teams));
                setViewerTeamScope(buildViewerTeamScope(linkedWorker || workers.find((worker) => worker.uid === currentUser?.uid) || null));

                if (hasAssignments(tomorrowDispatch)) {
                    setState({
                        loading: false,
                        error: null,
                        targetDate: tomorrowDate,
                        dispatch: tomorrowDispatch,
                        source: 'tomorrow',
                    });
                    return;
                }

                const allDispatches = await dispatchService.getAllDispatches();
                if (!isMounted) return;

                const fallbackDispatches = allDispatches
                    .filter((dispatch) => dispatch.date !== tomorrowDate)
                    .sort((left, right) => (
                        getDispatchUpdatedMillis(right) - getDispatchUpdatedMillis(left) ||
                        (right.date || '').localeCompare(left.date || '', 'en')
                    ));
                const latestDispatch =
                    fallbackDispatches.find((dispatch) => hasAssignments(dispatch)) ||
                    fallbackDispatches[0] ||
                    null;

                setState({
                    loading: false,
                    error: null,
                    targetDate: latestDispatch?.date || tomorrowDate,
                    dispatch: latestDispatch,
                    source: latestDispatch ? 'fallback' : 'empty',
                });
            } catch (error) {
                console.error('Failed to load tomorrow dispatch schedule', error);
                if (!isMounted) return;
                setState({
                    loading: false,
                    error: '현장 일정을 불러오지 못했습니다.',
                    targetDate: tomorrowDate,
                    dispatch: null,
                    source: 'empty',
                });
            }
        };

        loadSchedule();

        return () => {
            isMounted = false;
        };
    }, [tomorrowDate, currentUser?.uid]);

    useEffect(() => {
        if (showMyTeamOnly && !viewerTeamScope.hasScope) {
            setShowMyTeamOnly(false);
        }
    }, [showMyTeamOnly, viewerTeamScope.hasScope]);

    const assignments = (state.dispatch?.assignments || []) as ExtendedDispatchAssignment[];
    const displayAssignments = useMemo(() => {
        if (!showMyTeamOnly || !viewerTeamScope.hasScope) return assignments;
        return assignments.filter((assignment) => assignmentHasViewerTeamWorker(assignment, lookups, viewerTeamScope));
    }, [assignments, lookups, showMyTeamOnly, viewerTeamScope]);

    const summary = useMemo(() => {
        return {
            siteCount: uniqueCount(displayAssignments.map((assignment) => assignment.siteId || assignment.siteName)),
            workerCount: displayAssignments.reduce(
                (sum, assignment) => sum + getWorkerChips(assignment, lookups).length,
                0
            ),
            supportTeamCount: displayAssignments.reduce((sum, assignment) => sum + getSupportTeamCount(assignment), 0),
            vehicleCount: displayAssignments.reduce((sum, assignment) => sum + getVehicleCount(assignment), 0),
        };
    }, [displayAssignments, lookups]);

    const sourceLabel =
        state.source === 'tomorrow'
            ? '내일 일정'
            : state.source === 'fallback'
                ? `최근 저장 일정 · ${formatShortDateText(state.targetDate)}`
                : '일정 없음';

    const renderChipList = (items: DisplayChip[], emptyText: string) => {
        if (items.length === 0) {
            return <EmptyChipText>{emptyText}</EmptyChipText>;
        }

        return (
            <ChipList>
                {items.map((item) => (
                    <ResourceChip key={item.key} $color={item.color} title={item.subLabel ? `${item.label} · ${item.subLabel}` : item.label}>
                        <ColorDot $color={item.color} />
                        <ChipText>{item.subLabel ? `${item.label} · ${item.subLabel}` : item.label}</ChipText>
                    </ResourceChip>
                ))}
            </ChipList>
        );
    };

    return (
        <WidgetContainer>
            <Header>
                <TitleGroup>
                    <Title>
                        <FontAwesomeIcon icon={faCalendarDay} />
                        내일 현장 일정
                    </Title>
                    <DateText>{formatDateText(state.targetDate)}</DateText>
                </TitleGroup>
                <HeaderActions>
                    {!state.loading && (
                        <SourceBadge $fallback={state.source === 'fallback'}>
                            {sourceLabel}
                        </SourceBadge>
                    )}
                    <FilterButton
                        type="button"
                        $active={showMyTeamOnly}
                        disabled={!viewerTeamScope.hasScope}
                        onClick={() => setShowMyTeamOnly((prev) => !prev)}
                        title={viewerTeamScope.hasScope ? `${viewerTeamScope.label} 인원이 포함된 현장만 보기` : '연결된 팀 정보가 없습니다.'}
                    >
                        <FontAwesomeIcon icon={faUsers} />
                        내 팀 포함 현장
                    </FilterButton>
                    <FilterButton
                        type="button"
                        $active={isBoardCollapsed}
                        onClick={() => setIsBoardCollapsed((prev) => !prev)}
                        title={isBoardCollapsed ? '현장 일정 펼치기' : '현장 일정 접기'}
                    >
                        <FontAwesomeIcon icon={isBoardCollapsed ? faChevronDown : faChevronUp} />
                        {isBoardCollapsed ? '펼치기' : '접기'}
                    </FilterButton>
                </HeaderActions>
            </Header>

            {state.loading ? (
                <LoadingState>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    현장 일정을 불러오는 중입니다.
                </LoadingState>
            ) : state.error ? (
                <EmptyState>{state.error}</EmptyState>
            ) : assignments.length === 0 ? (
                <EmptyState>
                    <FontAwesomeIcon icon={faClipboardList} />
                    저장된 현장 일정이 없습니다.
                </EmptyState>
            ) : (
                <>
                    {state.source === 'fallback' && (
                        <Notice>
                            내일 저장된 일정이 없어 마지막 저장 일정({formatDateText(state.targetDate)})을 표시합니다.
                        </Notice>
                    )}
                    <Metrics>
                        <Metric>
                            <MetricLabel>현장</MetricLabel>
                            <MetricValue>{summary.siteCount}<small>개소</small></MetricValue>
                        </Metric>
                        <Metric>
                            <MetricLabel>작업자</MetricLabel>
                            <MetricValue>{summary.workerCount}<small>명</small></MetricValue>
                        </Metric>
                        <Metric>
                            <MetricLabel>지원팀</MetricLabel>
                            <MetricValue>{summary.supportTeamCount}<small>팀</small></MetricValue>
                        </Metric>
                        <Metric>
                            <MetricLabel>차량</MetricLabel>
                            <MetricValue>{summary.vehicleCount}<small>대</small></MetricValue>
                        </Metric>
                    </Metrics>

                    {isBoardCollapsed ? null : displayAssignments.length === 0 ? (
                        <EmptyState>
                            <FontAwesomeIcon icon={faUsers} />
                            {viewerTeamScope.label} 인원이 포함된 일정이 없습니다.
                        </EmptyState>
                    ) : (
                    <BoardSurface>
                        <BoardCards>
                            {displayAssignments.map((assignment, index) => {
                                const responsibleTeam = getResponsibleTeamChip(assignment, lookups);
                                const workerChips = getWorkerChips(assignment, lookups);
                                const supportTeamChips = getSupportTeamChips(assignment, lookups);
                                const vehicleChips = getVehicleChips(assignment, lookups);
                                const siteColor =
                                    normalizeColor(assignment.siteColor) ||
                                    normalizeColor(responsibleTeam.color) ||
                                    normalizeColor(assignment.teamColor) ||
                                    DEFAULT_RESOURCE_COLOR;
                                const workerPanelColor = normalizeColor(responsibleTeam.color) || siteColor;
                                const getWorkerColumnCount = (count: number) =>
                                    count > 0 ? Math.max(2, Math.ceil(count / BOARD_WORKERS_PER_COLUMN)) : 2;
                                const workerGroups = workerChips.reduce<Array<{ key: string; rows: DisplayChip[] }>>((groups, worker) => {
                                    const key = worker.subLabel || worker.color || 'unassigned';
                                    const existing = groups.find((group) => group.key === key);
                                    if (existing) {
                                        existing.rows.push(worker);
                                        return groups;
                                    }

                                    groups.push({ key, rows: [worker] });
                                    return groups;
                                }, []);
                                const orderedWorkerChips = workerGroups.flatMap((group) => group.rows);
                                const workerColumnCount = workerChips.length > 0
                                    ? Math.max(2, Math.ceil(workerChips.length / BOARD_WORKERS_PER_COLUMN))
                                    : 2;
                                const maxWorkerLabelLength = workerChips.reduce(
                                    (max, row) => Math.max(max, Array.from(row.label).length),
                                    0
                                );
                                const workerNameFontSize = maxWorkerLabelLength >= 5 || workerColumnCount >= 3 ? 11 : 12;
                                const workerNameMinWidth = maxWorkerLabelLength >= 5 ? 58 : 54;
                                const boardCardWidth = Math.max(
                                    216,
                                    Math.min(640, workerColumnCount * 64 + Math.max(0, workerColumnCount - 1) * 6 + 16)
                                );
                                const vehicleColumnCount =
                                    workerChips.length > BOARD_VEHICLE_TWO_COLUMN_WORKER_THRESHOLD && vehicleChips.length > 1 ? 2 : 1;
                                const destinationQuery = getDestinationQuery(assignment);
                                const hasNavigationTarget = destinationQuery.length > 0;

                                return (
                                    <BoardCard
                                        key={assignment.id || `${assignment.siteId || assignment.siteName}-${index}`}
                                        style={{
                                            borderColor: siteColor,
                                            width: boardCardWidth,
                                        }}
                                    >
                                        <BoardCardHeader
                                            style={{
                                                background: `linear-gradient(180deg, ${hexToRgba(siteColor, 0.68)}, ${siteColor})`,
                                                color: getReadableTextColor(siteColor),
                                            }}
                                        >
                                            <BoardSiteName>{assignment.siteName || '현장명 미지정'}</BoardSiteName>
                                        </BoardCardHeader>

                                        <BoardAddress>
                                            <BoardAddressText title={assignment.siteAddress || '주소 없음'}>
                                                {assignment.siteAddress || '주소 없음'}
                                            </BoardAddressText>
                                            <NavigationButtons aria-label={`${getDestinationName(assignment)} 길안내`}>
                                                <NavigationButton
                                                    type="button"
                                                    $variant="kakao"
                                                    disabled={!hasNavigationTarget}
                                                    title="카카오내비로 길안내 열기"
                                                    onClick={() => openNavigation(buildKakaoNaviDeepLink(assignment), buildKakaoFallbackUrl(assignment))}
                                                >
                                                    <FontAwesomeIcon icon={faMapMarkerAlt} />
                                                    카카오
                                                </NavigationButton>
                                                <NavigationButton
                                                    type="button"
                                                    $variant="tmap"
                                                    disabled={!hasNavigationTarget}
                                                    title="TMAP으로 길안내 열기"
                                                    onClick={() => openNavigation(buildTmapDeepLink(assignment), buildTmapFallbackUrl(assignment))}
                                                >
                                                    <FontAwesomeIcon icon={faRoute} />
                                                    TMAP
                                                </NavigationButton>
                                            </NavigationButtons>
                                        </BoardAddress>
                                        {workerChips.length > 0 ? (
                                            <BoardWorkerPanel
                                                style={{
                                                    background: `linear-gradient(180deg, ${hexToRgba(workerPanelColor, 0.28)}, ${hexToRgba(workerPanelColor, 0.62)})`,
                                                    gridTemplateColumns: `repeat(${getWorkerColumnCount(orderedWorkerChips.length)}, minmax(${workerNameMinWidth}px, 1fr))`,
                                                }}
                                            >
                                                {orderedWorkerChips.map((worker) => {
                                                    const teamColor = normalizeColor(worker.color) || workerPanelColor;
                                                    return (
                                                        <BoardNameOuter
                                                            key={worker.key}
                                                            style={{
                                                                background: `linear-gradient(180deg, ${hexToRgba(teamColor, 0.9)}, ${teamColor})`,
                                                                borderColor: teamColor,
                                                            }}
                                                            title={worker.subLabel ? `${worker.label} · ${worker.subLabel}` : worker.label}
                                                        >
                                                            <BoardNameInner style={{ fontSize: workerNameFontSize }}>
                                                                <span>{worker.label}</span>
                                                            </BoardNameInner>
                                                        </BoardNameOuter>
                                                    );
                                                })}
                                            </BoardWorkerPanel>
                                        ) : (
                                            <BoardEmpty>작업자 미배치</BoardEmpty>
                                        )}

                                        {supportTeamChips.length > 0 ? (
                                            <BoardSupportPanel $withTopBorder={workerChips.length > 0}>
                                                <BoardSupportTitle>지원팀</BoardSupportTitle>
                                                <BoardSupportGrid>
                                                    {supportTeamChips.map((team) => {
                                                        const teamColor = normalizeColor(team.color) || '#22c55e';
                                                        return (
                                                            <BoardNameOuter
                                                                key={team.key}
                                                                style={{
                                                                    background: `linear-gradient(180deg, ${hexToRgba(teamColor, 0.9)}, ${teamColor})`,
                                                                    borderColor: teamColor,
                                                                }}
                                                                title={team.label}
                                                            >
                                                                <BoardNameInner>
                                                                    <span>{team.label}</span>
                                                                </BoardNameInner>
                                                            </BoardNameOuter>
                                                        );
                                                    })}
                                                </BoardSupportGrid>
                                            </BoardSupportPanel>
                                        ) : (
                                            <BoardEmpty>지원팀 미배치</BoardEmpty>
                                        )}

                                        {vehicleChips.length > 0 ? (
                                            <BoardVehicleGrid
                                                style={{
                                                    gridTemplateColumns: `repeat(${vehicleColumnCount}, minmax(0, 1fr))`,
                                                }}
                                            >
                                                {vehicleChips.map((vehicle) => {
                                                    const vehicleColor = normalizeColor(vehicle.color) || siteColor;
                                                    return (
                                                        <BoardVehicleCell
                                                            key={vehicle.key}
                                                            style={{
                                                                background: `linear-gradient(180deg, ${hexToRgba(vehicleColor, 0.28)}, ${hexToRgba(vehicleColor, 0.62)})`,
                                                            }}
                                                            title={vehicle.subLabel ? `${vehicle.label} · ${vehicle.subLabel}` : vehicle.label}
                                                        >
                                                            <FontAwesomeIcon icon={faTruck} style={{ color: vehicleColor }} />
                                                            <span>{vehicle.label}</span>
                                                        </BoardVehicleCell>
                                                    );
                                                })}
                                            </BoardVehicleGrid>
                                        ) : (
                                            <BoardEmpty>차량 미배치</BoardEmpty>
                                        )}
                                    </BoardCard>
                                );
                            })}
                        </BoardCards>
                    </BoardSurface>
                    )}
                </>
            )}
        </WidgetContainer>
    );
};
