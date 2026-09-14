import React, { useEffect, useMemo, useState } from 'react';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    type DragEndEvent,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable
} from '@dnd-kit/sortable';
import { CSS as DndCss } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { Team } from '../../services/teamService';
import { resolveIcon } from '../../constants/iconMap';
import { getContrastingTextColor, hexToRgba, normalizeHexColor } from '../../utils/color';
import {
    applySupportTeamOrder,
    clearSupportTeamOrder,
    getSupportTeamOrderId,
    mergeVisibleSupportTeamOrder,
    readSupportTeamOrder,
    saveSupportTeamOrder
} from '../../utils/supportTeamOrder';

interface SupportTeamFilterTabsProps {
    teams: Team[];
    selectedTeamId: string;
    onChange: (teamId: string) => void;
    disabled?: boolean;
    allLabel?: string;
    className?: string;
    ariaLabel?: string;
    showTeamIcons?: boolean;
}

interface SortableSupportTeamTabProps {
    team: Team;
    selectedTeamId: string;
    disabled: boolean;
    isOrderEditing: boolean;
    showTeamIcons: boolean;
    onChange: (teamId: string) => void;
}

const buttonBase = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-extrabold transition-all';

const SortableSupportTeamTab: React.FC<SortableSupportTeamTabProps> = ({
    team,
    selectedTeamId,
    disabled,
    isOrderEditing,
    showTeamIcons,
    onChange
}) => {
    const teamId = getSupportTeamOrderId(team);
    const color = normalizeHexColor(team.color);
    const selectedTextColor = getContrastingTextColor(color);
    const isSelected = String(selectedTeamId) === teamId;
    const teamIcon = resolveIcon(team.iconKey || team.icon || 'fa-users', faUsers);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: teamId,
        disabled: disabled || !isOrderEditing
    });
    const {
        role: _sortableRole,
        'aria-disabled': _sortableAriaDisabled,
        ...sortableTabAttributes
    } = attributes;

    return (
        <button
            ref={setNodeRef}
            {...(isOrderEditing && !disabled ? sortableTabAttributes : {})}
            {...(isOrderEditing && !disabled ? listeners : {})}
            type="button"
            disabled={disabled}
            role="tab"
            aria-selected={isSelected}
            aria-label={isOrderEditing ? `${team.name} 순서 변경` : `팀별 보기: ${team.name}`}
            aria-disabled={disabled || undefined}
            onClick={() => {
                if (!disabled && !isOrderEditing) onChange(teamId);
            }}
            className={`${buttonBase} ${
                isSelected
                    ? 'shadow-sm'
                    : 'bg-white hover:-translate-y-0.5'
            } ${disabled ? 'cursor-not-allowed opacity-50 hover:translate-y-0' : ''} ${
                isOrderEditing ? 'cursor-grab touch-none active:cursor-grabbing' : ''
            } ${isDragging ? 'z-30 opacity-70 shadow-xl' : ''}`}
            style={{
                ...(isSelected
                    ? {
                        backgroundColor: color,
                        borderColor: color,
                        color: selectedTextColor
                    }
                    : {
                        color: '#0f172a',
                        borderColor: hexToRgba(color, 0.45),
                        backgroundColor: hexToRgba(color, 0.14)
                    }),
                transform: DndCss.Transform.toString(transform),
                transition
            }}
            title={isOrderEditing ? '드래그해서 팀 순서를 변경하세요' : team.name}
        >
            {isOrderEditing && (
                <span className="text-sm leading-none opacity-70" aria-hidden="true">⠿</span>
            )}
            {showTeamIcons ? (
                <span
                    className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] shadow-sm"
                    style={{
                        borderColor: isSelected ? hexToRgba(selectedTextColor, 0.4) : hexToRgba(color, 0.35),
                        backgroundColor: isSelected ? hexToRgba(selectedTextColor, 0.14) : hexToRgba(color, 0.12),
                        color: isSelected ? selectedTextColor : color
                    }}
                    aria-hidden="true"
                    data-team-visual="true"
                    title={`팀 색상 ${color}`}
                >
                    <FontAwesomeIcon icon={teamIcon} data-testid="team-icon" />
                </span>
            ) : (
                <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: isSelected ? selectedTextColor : color }}
                    aria-hidden="true"
                />
            )}
            <span className="whitespace-nowrap">{team.name}</span>
        </button>
    );
};

export const SupportTeamFilterTabs: React.FC<SupportTeamFilterTabsProps> = ({
    teams,
    selectedTeamId,
    onChange,
    disabled = false,
    allLabel = '전체',
    className = '',
    ariaLabel = '팀 선택',
    showTeamIcons = false
}) => {
    const [preferredOrder, setPreferredOrder] = useState<string[]>(readSupportTeamOrder);
    const [isOrderEditing, setIsOrderEditing] = useState(false);
    const orderedTeams = useMemo(
        () => applySupportTeamOrder(teams, preferredOrder),
        [preferredOrder, teams]
    );
    const teamOrderSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (disabled) setIsOrderEditing(false);
    }, [disabled]);

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;

        const oldIndex = orderedTeams.findIndex((team) => getSupportTeamOrderId(team) === String(active.id));
        const newIndex = orderedTeams.findIndex((team) => getSupportTeamOrderId(team) === String(over.id));
        if (oldIndex < 0 || newIndex < 0) return;

        const reorderedTeams = arrayMove(orderedTeams, oldIndex, newIndex);
        const nextOrder = mergeVisibleSupportTeamOrder(
            preferredOrder,
            reorderedTeams.map(getSupportTeamOrderId)
        );
        setPreferredOrder(nextOrder);
        saveSupportTeamOrder(nextOrder);
    };

    const handleResetOrder = () => {
        clearSupportTeamOrder();
        setPreferredOrder([]);
        setIsOrderEditing(false);
    };

    return (
        <div className={`min-w-0 ${className}`}>
            <div className="flex min-w-0 items-center gap-1.5">
                <DndContext
                    sensors={teamOrderSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <div
                        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1"
                        role="tablist"
                        aria-label={isOrderEditing ? `${ariaLabel} 순서 변경` : ariaLabel}
                    >
                        <button
                            type="button"
                            disabled={disabled}
                            role="tab"
                            aria-selected={!selectedTeamId}
                            onClick={() => {
                                if (!disabled && !isOrderEditing) onChange('');
                            }}
                            aria-disabled={disabled || undefined}
                            aria-label={`팀별 보기: ${allLabel}`}
                            className={`${buttonBase} ${
                                !selectedTeamId
                                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                    : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-800'
                            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            {allLabel}
                        </button>
                        <SortableContext
                            items={orderedTeams.map(getSupportTeamOrderId)}
                            strategy={horizontalListSortingStrategy}
                        >
                            {orderedTeams.map((team) => {
                                const teamId = getSupportTeamOrderId(team);
                                if (!teamId) return null;
                                return (
                                    <SortableSupportTeamTab
                                        key={teamId}
                                        team={team}
                                        selectedTeamId={selectedTeamId}
                                        disabled={disabled}
                                        isOrderEditing={isOrderEditing}
                                        showTeamIcons={showTeamIcons}
                                        onChange={onChange}
                                    />
                                );
                            })}
                        </SortableContext>
                    </div>
                </DndContext>

                <div className="flex shrink-0 items-center gap-1">
                    {isOrderEditing && (
                        <button
                            type="button"
                            onClick={handleResetOrder}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-50"
                        >
                            기본 순서
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOrderEditing((current) => !current)}
                        disabled={disabled || teams.length < 2}
                        aria-pressed={isOrderEditing}
                        className={`inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            isOrderEditing
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                    >
                        {isOrderEditing ? '순서 변경 완료' : '순서 변경'}
                    </button>
                </div>
            </div>
            <span className="sr-only" aria-live="polite">
                {isOrderEditing ? '팀 버튼을 드래그해서 순서를 변경하세요.' : ''}
            </span>
        </div>
    );
};

export default SupportTeamFilterTabs;
