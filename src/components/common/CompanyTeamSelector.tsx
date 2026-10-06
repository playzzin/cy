import React, { useEffect, useMemo, useState } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { teamSettlementService } from '../../services/teamSettlementService';
import { getContrastingTextColor, hexToRgba, normalizeHexColor } from '../../utils/color';
import { applySupportTeamOrder, mergeVisibleSupportTeamOrder, normalizeSupportTeamOrder } from '../../utils/supportTeamOrder';

export type CompanyTeamOption = {
    id: string;
    name: string;
    color?: string;
    companyId?: string;
    isSupport?: boolean;
};

type Props = {
    internalTeams: CompanyTeamOption[];
    supportTeams?: CompanyTeamOption[];
    internalLabel?: string;
    selectedTeamId: string;
    onChange: (teamId: string) => void;
    allowAllTeams?: boolean;
    ariaLabel?: string;
    compact?: boolean;
};

// 팀 정산 페이지와 회사 공통 순서 및 로컬 캐시를 함께 사용한다.
const TEAM_ORDER_STORAGE_KEY = 'team-settlement:team-order:v1';
export const readCompanyTeamOrder = (): string[] => {
    try {
        return normalizeSupportTeamOrder(JSON.parse(window.localStorage.getItem(TEAM_ORDER_STORAGE_KEY) ?? '[]'));
    } catch {
        return [];
    }
};
const cacheOrder = (order: string[]) => {
    try {
        window.localStorage.setItem(TEAM_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {
        // 브라우저 저장소가 제한되어도 서버에 저장한 순서는 유지된다.
    }
};

const TeamButton: React.FC<{
    team: CompanyTeamOption;
    selected: boolean;
    editing: boolean;
    saving: boolean;
    compact?: boolean;
    onChange: Props['onChange'];
}> = ({ team, selected, editing, saving, compact = false, onChange }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: team.id,
        disabled: !editing || saving
    });
    const color = normalizeHexColor(team.color, '#4f46e5');
    return (
        <button
            ref={setNodeRef}
            type="button"
            {...(editing ? attributes : {})}
            {...(editing ? listeners : {})}
            disabled={saving}
            aria-label={editing ? `${team.name} 순서 변경` : `${team.name} 선택`}
            aria-pressed={editing ? undefined : selected}
            title={editing ? '드래그해서 순서를 변경하세요' : `${team.name} 선택`}
            className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border ${compact ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'} font-black tracking-tight transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${selected ? 'shadow-md ring-2 ring-slate-900/20 ring-offset-1' : 'shadow-sm'} ${editing ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${isDragging ? 'z-30 opacity-70 shadow-xl' : ''}`}
            style={{
                backgroundColor: selected ? color : hexToRgba(color, 0.12),
                borderColor: selected ? color : hexToRgba(color, 0.45),
                color: selected ? getContrastingTextColor(color) : '#1f2937',
                transform: CSS.Transform.toString(transform),
                transition
            }}
            onClick={() => { if (!editing) onChange(team.id); }}
        >
            {editing && <span className="text-base leading-none opacity-70" aria-hidden="true">⠿</span>}
            <span className="whitespace-nowrap">{team.name}</span>
        </button>
    );
};

const CompanyTeamSelector: React.FC<Props> = ({ internalTeams, supportTeams = [], internalLabel = '', selectedTeamId, onChange, allowAllTeams = true, ariaLabel = '통합 현황 팀 선택', compact = false }) => {
    const [savedOrder, setSavedOrder] = useState(readCompanyTeamOrder);
    const [draftOrder, setDraftOrder] = useState<string[]>([]);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [orderReady, setOrderReady] = useState(false);
    const [error, setError] = useState('');
    const order = editing ? draftOrder : savedOrder;
    const internal = useMemo(() => applySupportTeamOrder(internalTeams, order), [internalTeams, order]);
    const support = useMemo(() => applySupportTeamOrder(supportTeams, order), [supportTeams, order]);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        let cancelled = false;
        teamSettlementService.getTeamDisplayOrder().then((serverOrder) => {
            if (cancelled) return;
            const nextOrder = serverOrder.length > 0 ? serverOrder : readCompanyTeamOrder();
            setSavedOrder(nextOrder);
            setOrderReady(true);
        }).catch(() => {
            if (!cancelled) setError('회사 공통 팀 순서를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        });
        return () => { cancelled = true; };
    }, []);

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!editing || saving || !over || active.id === over.id) return;
        // 소속팀·지원팀 구분과 현재 회사 필터 밖의 팀 순서를 보존한다.
        const group = [internal, support].find((rows) => rows.some((team) => team.id === active.id));
        if (!group) return;
        const from = group.findIndex((team) => team.id === active.id);
        const to = group.findIndex((team) => team.id === over.id);
        if (to < 0) return;
        const allIds = [...internal, ...support].map((team) => team.id);
        const completeOrder = normalizeSupportTeamOrder([...draftOrder, ...allIds]);
        setDraftOrder(mergeVisibleSupportTeamOrder(completeOrder, arrayMove(group, from, to).map((team) => team.id)));
    };

    const saveOrder = async (reset = false) => {
        setSaving(true);
        setError('');
        try {
            const nextOrder = reset ? [] : draftOrder;
            if (reset) await teamSettlementService.resetTeamDisplayOrder();
            else await teamSettlementService.saveTeamDisplayOrder(nextOrder);
            cacheOrder(nextOrder);
            setSavedOrder(nextOrder);
            setEditing(false);
        } catch {
            setError('팀 순서를 저장하지 못했습니다. 다시 시도해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    const supportGroup = support.length > 0 && (
        <div className={compact ? 'flex shrink-0 items-center gap-2 border-l border-slate-200 pl-3' : 'mt-1 flex min-w-0 items-center gap-2.5 overflow-x-auto p-1'} role="group" aria-label="지원팀 선택">
            <span className="shrink-0 text-xs font-bold text-slate-500">지원팀</span>
            <SortableContext items={support.map((team) => team.id)} strategy={horizontalListSortingStrategy}>
                {support.map((team) => <TeamButton key={team.id} team={team} selected={team.id === selectedTeamId} editing={editing} saving={saving} compact={compact} onChange={onChange} />)}
            </SortableContext>
        </div>
    );

    return (
        <section className={`min-w-0 shrink-0 rounded-xl border border-slate-200 bg-white ${compact ? 'px-3 py-1' : 'p-3 sm:p-4'}`} aria-label={ariaLabel}>
            <div className={compact ? 'flex min-w-0 items-center gap-2' : ''}>
            <div className={compact ? 'contents' : 'flex flex-wrap items-center justify-between gap-2'}>
                <div className="flex shrink-0 items-center gap-2">
                    <h2 className={`${compact ? 'text-sm' : 'text-base'} font-black text-slate-900`} title="회사 공통 순서">팀</h2>
                    {!compact && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">회사 공통 순서</span>}
                </div>
                <div className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap ${compact ? 'order-2' : ''}`}>
                    {editing && (
                        <button type="button" disabled={saving} onClick={() => void saveOrder(true)} className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            기본 순서
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={saving || !orderReady || internal.length + support.length < 2}
                        aria-pressed={editing}
                        onClick={() => {
                            if (!editing) {
                                setDraftOrder(savedOrder);
                                setEditing(true);
                            } else if (draftOrder === savedOrder) setEditing(false);
                            else void saveOrder();
                        }}
                        className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-black transition disabled:opacity-50 ${editing ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50'}`}
                    >
                        {saving ? '저장 중...' : editing ? '순서 변경 완료' : '순서 변경'}
                    </button>
                </div>
            </div>
            {editing && <p className={compact ? 'sr-only' : 'mt-1 text-xs font-semibold text-blue-600'}>팀 버튼을 드래그해 순서를 바꾸세요. 완료하면 같은 팀 선택 메뉴에 공통 순서가 적용됩니다.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className={`flex min-w-0 items-center overflow-x-auto p-1 ${compact ? 'order-1 flex-1 gap-2' : 'mt-2 gap-2.5'}`} role="group" aria-label="팀 선택">
                    {allowAllTeams && <button
                        type="button"
                        disabled={saving || editing}
                        aria-pressed={!selectedTeamId}
                        onClick={() => onChange('')}
                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border ${compact ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'} font-black transition disabled:opacity-50 ${!selectedTeamId ? 'border-slate-900 bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20 ring-offset-1' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                        전체 팀
                    </button>}
                    {internal.length > 0 && internalLabel && <span className="shrink-0 text-xs font-bold text-slate-500">{internalLabel}</span>}
                    <SortableContext items={internal.map((team) => team.id)} strategy={horizontalListSortingStrategy}>
                        {internal.map((team) => <TeamButton key={team.id} team={team} selected={team.id === selectedTeamId} editing={editing} saving={saving} compact={compact} onChange={onChange} />)}
                    </SortableContext>
                    {compact && supportGroup}
                </div>
                {!compact && supportGroup}
            </DndContext>
            </div>
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
        </section>
    );
};

export default CompanyTeamSelector;
