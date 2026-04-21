import React, { useState, useEffect, useRef } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSave,
    faCalendarAlt,
    faUsers,
    faBuilding,
    faHardHat,
    faCheckSquare,
    faSquare,
    faCopy,
    faSearch,
    faArrowRight,
    faUndo,
    faCheckDouble,
    faChevronDown,
    faTimes,
    faTrash
} from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker as WorkerModel } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { authService } from '../../services/authService';
import { companyService, Company } from '../../services/companyService';
import { geminiService } from '../../services/geminiService'; // Import Gemini Service

// --- Types ---
interface WorkerItem extends WorkerModel {
    tempId: string; // Unique ID for dnd-kit
    currentSiteId: string | null; // null means "Unassigned"
    manDay: number;
    workContent: string;
    status: 'attendance' | 'absent' | 'half';
    isConfirmed: boolean; // True if in Top Layer
    teamColor?: string; // Team Color for Background
}

// Custom Helper
const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- Components ---

// 1. Draggable Worker Card
interface WorkerCardProps {
    worker: WorkerItem;
    isOverlay?: boolean;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
    selectionCount?: number;
    onDoubleClick?: () => void;
    companyStatus?: 'internal' | 'external' | 'none'; // 'internal' = Blue, 'external' = Orange
    showManDay?: boolean; // If true, show Man-Day Edit/Display. If false, show Team Name.
    onChangeManDay?: (val: number) => void;
    onChangeWorkContent?: (val: string) => void;

    // NEW Props for Subcontractor
    teams?: Team[];
    onChangeTeam?: (workerId: string, teamId: string) => void;
}


const WorkerCard = ({
    worker,
    isOverlay = false,
    selected = false,
    onToggleSelect,
    selectionCount = 0,
    onDoubleClick,
    companyStatus = 'none',
    showManDay = false,
    onChangeManDay,
    onChangeWorkContent,
    iconColor,

    teams = [],
    onChangeTeam
}: WorkerCardProps & { iconColor?: string }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: worker.tempId, data: { type: 'worker', worker } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    // Role Badge Helper
    const getRoleBadge = (role?: string, className = '') => {
        const map: { [key: string]: { text: string, color: string } } = {
            '팀장': { text: '팀장', color: 'bg-indigo-100 text-indigo-700' },
            '반장': { text: '반장', color: 'bg-purple-100 text-purple-700' },
            '기공': { text: '기공', color: 'bg-blue-100 text-blue-700' },
            '조공': { text: '조공', color: 'bg-slate-100 text-slate-700' },
            '일반': { text: '일반', color: 'bg-slate-100 text-slate-600' }
        };
        const badge = (role && map[role]) || { text: role || '일반', color: 'bg-slate-100 text-slate-500' };

        // If team color exists, use it for badge border or something?
        // Or keep role badge standard. Standard is better for role distinction.
        return (
            <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${badge.color} border border-black/5 ${className}`}>
                {badge.text}
            </span>
        );
    };

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`
                relative bg-white border rounded-lg p-2.5 shadow-sm transition-all select-none
                ${selected ? 'bg-green-50 border-green-200' : 'hover:border-blue-300 hover:shadow-md border-slate-200'}
                ${isOverlay ? 'shadow-xl rotate-2 scale-105 z-50 cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
                ${worker.teamColor ? 'border-l-[8px]' : (companyStatus === 'internal' ? 'border-l-[8px] border-l-blue-500' : '')}
                ${!worker.teamColor && companyStatus === 'external' ? 'border-l-[8px] border-l-orange-400' : ''}
    `}
            // Remove click/doubleClick propagation handled by parent mostly? isOverlay checks?
            onClick={(e) => {
                // If clicking dropdown, dont toggle (handled in select)
                onToggleSelect && onToggleSelect(worker.tempId);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick && onDoubleClick();
            }}
            style={{
                ...style,
                backgroundColor: worker.teamColor ? hexToRgba(worker.teamColor, 0.1) : undefined,
                borderColor: worker.teamColor ? hexToRgba(worker.teamColor, 0.3) : undefined,
                borderLeftColor: worker.teamColor ? worker.teamColor : undefined // Override left border color if team color exists
            }}
        >
            {/* Selection Checkbox (Stop propagation to prevent drag start) */}
            {!isOverlay && onToggleSelect && (
                <div
                    className="absolute top-2 left-2 cursor-pointer text-slate-400 hover:text-green-600 p-1 z-10"
                    onPointerDown={(e) => {
                        e.stopPropagation(); // Prevent drag start
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(worker.tempId);
                    }}
                >
                    <FontAwesomeIcon icon={selected ? faCheckSquare : faSquare} className={selected ? "text-green-600 text-lg" : "text-lg"} />
                </div>
            )}

            {/* Drag Handle Area */}
            <div className="flex items-center gap-3 flex-1 min-w-0 pl-8">
                {/* Header: Name Only (Larger) */}
                <div className="flex justify-between items-center mb-1 w-full">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faHardHat} style={{ color: worker.teamColor || iconColor || '#2563eb' }} className="text-sm" />
                            <span className="font-bold text-slate-800 text-lg">{worker.name}</span>
                        </div>
                        {/* Sub-info: Team Name & Role */}
                        {companyStatus === 'external' ? (
                            <div className="flex items-center gap-1 mt-1">
                                <select
                                    value={worker.teamId || ''}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onChangeTeam && onChangeTeam(worker.tempId, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Prevent card selection
                                    className="text-[10px] px-1 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-bold focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">팀 선택</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={worker.manDay || 0}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onChangeManDay && onChangeManDay(parseFloat(e.target.value));
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Prevent card selection
                                    className="w-12 text-[10px] px-1 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-bold text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    min="0"
                                    step="0.5"
                                />
                                <span className="text-[10px] text-slate-500">공수</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 mt-1">
                                {worker.teamName && (
                                    <span className="text-[10px] px-1 py-0.5 rounded font-bold bg-slate-100 text-slate-600 border border-black/5">
                                        {worker.teamName}
                                    </span>
                                )}
                                {getRoleBadge(worker.role)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sub-info: Team Name & Man-Day/Status */}
            <div className="flex items-end justify-between mt-1 pl-8">
                {/* Team Name Removed from here as handled above */}
                {/* Individual Work Content Input REMOVED - Moved to Site Level */}

                {/* Right Bottom Action: Man-Day Input */}
                {/* Man-Day Input REMOVED by user request */}
                {false && showManDay ? (
                    <input
                        type="number"
                    // ... removed
                    />
                ) : null}
            </div>

            {/* Selection Badge */}
            {selectionCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md border-2 border-white z-10">
                    {selectionCount}
                </div>
            )}
        </div>
    );
};


// 3. Confirmed Zone (Top Layer)


// 2. Droppable Site Column
interface SiteColumnProps {
    site: Site | null;
    workers: WorkerItem[];
    selectedWorkerIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll?: () => void;
    isGrid?: boolean;
    isAccordion?: boolean;
    isExpanded?: boolean;
    onHeaderClick?: () => void;
    onWorkerDoubleClick?: (workerId: string) => void;
    selectedCompany?: string;
    isConfirmedView?: boolean; // New prop for Top Layer styling
    onChangeManDay?: (workerId: string, val: number) => void; // For Man-Day Edit
    onChangeWorkContent?: (workerId: string, val: string) => void;
    isActiveSite?: boolean; // If site is 'active' (Unconfirmed workers exist). Not strictly used yet.
    responsibleTeamCompanyName?: string; // [MODIFIED] Added to display team's company
    onSiteSelect?: (siteId: string) => void; // NEW: To set Active Target Site
    isTargetSite?: boolean; // NEW: Visual Highlight
    siteWorkContent?: string; // NEW: Site Level Work Content
    onSiteWorkContentChange?: (val: string) => void; // NEW: Handler
    teams?: Team[]; // NEW: For subcontractor team selection
    onChangeWorkerTeam?: (workerId: string, teamId: string) => void; // NEW: For subcontractor team selection
}

const SiteColumn = ({
    site,
    workers,
    selectedWorkerIds,
    onToggleSelect,
    onSelectAll,
    isGrid = false,
    isAccordion = false,
    isExpanded = true,
    onHeaderClick,
    onWorkerDoubleClick,
    selectedCompany,
    isConfirmedView = false,
    onChangeManDay,
    onChangeWorkContent,

    responsibleTeamCompanyName,
    onSiteSelect,
    isTargetSite,
    siteWorkContent,
    onSiteWorkContentChange,
    responsibleTeamColor,
    siteColor,
    teams, // NEW
    onChangeWorkerTeam // NEW
}: SiteColumnProps & { responsibleTeamColor?: string; siteColor?: string }) => {
    // Unique ID for Droppable
    // If Confirmed View, ID = `confirmed - site - ${ site.id } `
    const droppableId = isConfirmedView
        ? (site ? `confirmed-site-${site.id}` : 'confirmed-unassigned')
        : (site ? (site.id || 'unknown-site') : 'unassigned');

    // Single Sortable Hook for the Site Column (Container)
    // Acts as BOTH Droppable (for workers) AND Draggable (for reordering)
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: droppableId, // Use Site ID as the drag ID
        data: {
            type: 'container', // Keeping 'container' type ref for worker drop logic
            siteId: site ? site.id : null,
            isConfirmedView
        },
        disabled: !site // Disable dragging for "Unassigned" column (if it were in this list)
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Header Style for Dragging



    const isAllSelected = workers.length > 0 && workers.every(w => selectedWorkerIds.has(w.tempId));

    // Calculate Site Total Man-Day
    const siteTotalManDay = workers.reduce((sum, w) => sum + (w.manDay || 0), 0);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                flex flex-col h-full rounded-xl border-2 transition-colors duration-200
                ${site ? 'bg-slate-50' : 'bg-white'}
                ${isDragging ? 'z-50 shadow-2xl scale-105' : ''} 
                ${!site ? 'border-dashed border-slate-300' : ''}
                ${isConfirmedView ? 'bg-green-50/50 border-green-200' : ''}
    `}
        >
            {/* Header (Drag Handle) */}
            <div
                {...attributes}
                {...listeners}
                className={`p-3 border-b ${site ? 'border-slate-200 bg-white rounded-t-xl cursor-grab active:cursor-grabbing border-l-[8px]' : 'border-slate-100'} ${isAccordion && site ? 'hover:bg-purple-50 hover:border-purple-200 transition-colors' : ''}
                ${!siteColor && site && selectedCompany && site.companyName !== selectedCompany ? '' : '' /* Removed Company Color Classes */}
                ${!siteColor && site && selectedCompany && site.companyName === selectedCompany ? '' : '' /* Removed Company Color Classes */}
                ${isConfirmedView ? '!bg-green-100 !border-green-300' : ''}
                ${isAccordion && isExpanded && site && !siteColor && !isConfirmedView ? '' : ''}
                ${isTargetSite ? '!bg-purple-100 !border-purple-200 z-10' : ''} 
    `}
                style={{
                    // Priority: Responsible Team Color -> Site Color -> Default Green
                    backgroundColor: isConfirmedView ? undefined : hexToRgba(responsibleTeamColor || siteColor || '#059669', 0.1),
                    borderColor: isConfirmedView ? undefined : hexToRgba(responsibleTeamColor || siteColor || '#059669', 0.3),
                    borderLeftColor: (site && responsibleTeamColor) ? responsibleTeamColor : undefined
                }}
                onClick={(e) => {
                    // Primary Click: Select Site as Target AND Toggle Expansion
                    if (isAccordion && site) {
                        if (onSiteSelect) onSiteSelect(site.id || '');
                        if (onHeaderClick) onHeaderClick();
                    }
                }}
            >
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg truncate max-w-[250px]" title={site?.name}>
                        <FontAwesomeIcon
                            icon={site ? faBuilding : faUsers}
                            className={
                                !site ? "text-slate-400" :
                                    (isConfirmedView ? "text-green-600" : undefined)
                            }
                            style={!isConfirmedView ? { color: siteColor || (site ? '#059669' : '#94a3b8') } : undefined}
                        />
                        {site ? site.name : (isConfirmedView ? "현장 미배정 (확정)" : "미배정 인원")}
                        {isAccordion && site && (
                            <div className="p-1 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faChevronDown} className={`text-slate-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                        )}
                        {isConfirmedView && <span className="text-[10px] text-green-600 border border-green-200 px-1 rounded bg-green-50">출력대기</span>}
                    </h3>
                    <div className="flex items-center gap-1.5">
                        {/* Man-Day Sum Removed by user request */}
                        {false && site && (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {siteTotalManDay.toFixed(1)}공수
                            </span>
                        )}
                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-bold">
                            {workers.length}명
                        </span>
                    </div>
                </div>
                <div className="text-xs text-slate-400 pl-6 truncate">
                    {site && (
                        <>
                            <FontAwesomeIcon icon={faUsers} style={{ color: responsibleTeamColor || '#4f46e5' }} className="mr-1" />
                            {site.responsibleTeamName || '-'}
                            {responsibleTeamCompanyName && (
                                <span className="text-slate-300 mx-1">|</span>
                            )}
                            {responsibleTeamCompanyName && (
                                <span className="text-slate-500">{responsibleTeamCompanyName}</span>
                            )}
                            {site.clientCompanyName && site.clientCompanyName.trim() !== '' && (
                                <>
                                    <span className="text-slate-300 mx-1">|</span>
                                    <span className="text-slate-500">발주:{site.clientCompanyName}</span>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Select All Button (Only for Unassigned or if needed) */}
                {!site && workers.length > 0 && onSelectAll && (
                    <button
                        onClick={onSelectAll}
                        className="mt-2 w-full text-xs py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center gap-1 transition-colors"
                    >
                        <FontAwesomeIcon icon={isAllSelected ? faCheckDouble : faSquare} />
                        {isAllSelected ? '전체 해제' : '전체 선택'}
                    </button>
                )}
            </div>

            {/* Worker List */}
            {(!isAccordion || isExpanded) && (
                <div className={`flex-1 p-2 overflow-y-auto ${isAccordion ? 'min-h-[100px] max-h-[500px]' : 'min-h-[150px]'}`}>
                    <SortableContext
                        items={workers.map(w => w.tempId)}
                        strategy={verticalListSortingStrategy}
                    >
                        {/* 1. Internal Workers (Constructors) */}
                        <div className={isGrid ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
                            {workers.filter(w => !w.teamType || w.teamType === '시공팀' || w.role !== '팀').map(worker => (
                                <WorkerCard
                                    key={worker.tempId}
                                    worker={worker}
                                    selected={selectedWorkerIds.has(worker.tempId)}
                                    onToggleSelect={onToggleSelect}
                                    onDoubleClick={() => onWorkerDoubleClick && onWorkerDoubleClick(worker.tempId)}
                                    showManDay={!!site}
                                    onChangeManDay={onChangeManDay ? (val) => onChangeManDay(worker.tempId, val) : undefined}
                                    onChangeWorkContent={onChangeWorkContent ? (val) => onChangeWorkContent(worker.tempId, val) : undefined}
                                    companyStatus={'internal'} // Force Internal view for these
                                    iconColor={worker.color || (worker.role === '팀장' ? responsibleTeamColor : undefined) || '#2563eb'}
                                />
                            ))}
                        </div>

                        {/* 2. Subcontractor Teams (External) - Rendered as Table */}
                        {workers.some(w => w.role === '팀' || w.teamType === '용역팀' || w.teamType === '지원팀') && (
                            <div className="mt-4">
                                <div className="text-xs font-bold text-slate-500 mb-1 px-1 flex justify-between items-center">
                                    <span>협력사 (팀 배정)</span>
                                    <span className="text-[10px] font-normal text-slate-400">인원수 입력</span>
                                </div>
                                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="px-2 py-1.5 w-[60%]">팀명 (협력사)</th>
                                                <th className="px-2 py-1.5 text-center">인원(공수)</th>
                                                <th className="px-2 py-1.5 w-[10%]"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {workers.filter(w => w.role === '팀' || w.teamType === '용역팀' || w.teamType === '지원팀').map(worker => (
                                                <tr key={worker.tempId} className="border-b border-slate-100 last:border-none hover:bg-slate-50 relative group">
                                                    <td className="px-2 py-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-2 h-2 rounded-full shrink-0"
                                                                style={{ backgroundColor: worker.teamColor || '#94a3b8' }}
                                                            ></div>
                                                            <span className="font-bold text-slate-700 truncate max-w-[120px]" title={worker.teamName || worker.name}>
                                                                {worker.teamName || worker.name}
                                                            </span>
                                                        </div>
                                                        {/* Hidden Sortable Handle for this row? */}
                                                        {/* We need to render a Sortable Item here to keep Dnd working. 
                                                            But simpler to just use the Sortable logic on a wrapper or custom Row component.
                                                            For now, let's just render the input interactively. 
                                                            Drag compatibility might be tricky if we don't wrap this TR in Sortable.
                                                            Let's assume refined User check: "데이터베이스 건들지말고..."
                                                            They just want Input. Dragging OUT might not be needed?
                                                            But Dragging IN creates these.
                                                            Reordering? SortableContext expects items.
                                                            If we don't wrap in SortableItem, drag might fail or crash if index mismatch.
                                                            Actually, if we just render static rows here, SortableContext might get confused if these IDs are passed to it.
                                                            So we MUST wrap these in a Sortable Item or exclude them from SortableContext items prop?
                                                            If we exclude them, we can't reorder them.
                                                            Let's excluded them from SortableContext items for now to avoid crash? 
                                                            No, `workers.map` includes them.
                                                            
                                                            Let's create a minimal SortableRow wrapper if possible, or just standard WorkerCard but styled as Row?
                                                            No, User wants a Table.
                                                            
                                                            Solution: Exclude these 'Team' workers from SortableContext items list? 
                                                            Then they are not draggable/sortable. That's fine for "Table" rows usually.
                                                        */}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <input
                                                            type="number"
                                                            value={worker.manDay || 0}
                                                            onChange={(e) => onChangeManDay && onChangeManDay(worker.tempId, parseFloat(e.target.value))}
                                                            className="w-12 text-center text-xs font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 py-0.5"
                                                            min="0"
                                                            step="0.5"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <button
                                                            onClick={() => onWorkerDoubleClick && onWorkerDoubleClick(worker.tempId)}
                                                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="삭제"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </SortableContext>
                    {workers.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs italic p-4 text-center">
                            {site ? "작업자를 드래그하거나 선택하여 배정하세요" : "모든 인원이 배정되었습니다"}
                        </div>
                    )}
                </div>
            )}

            {/* Site Work Content Input (Footer) */}
            {site && (!isAccordion || isExpanded) && onSiteWorkContentChange && (
                <div className="p-2 border-t border-slate-100 bg-slate-50">
                    <textarea
                        value={siteWorkContent || ''}
                        onChange={(e) => onSiteWorkContentChange(e.target.value)}
                        placeholder="현장 작업내용 입력"
                        className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 overflow-hidden"
                        rows={1}
                        style={{ minHeight: '30px' }}
                        onInput={(e) => {
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent accordion toggle
                    />
                </div>
            )}
        </div>
    );
};

// --- MultiSelect Component ---
interface MultiSelectProps {
    options: { id: string; name: string }[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
    label?: string;
}

const MultiSelect = ({ options, selectedIds, onChange, placeholder = 'Select...', label }: MultiSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id: string) => {
        const newSelected = selectedIds.includes(id)
            ? selectedIds.filter(item => item !== id)
            : [...selectedIds, id];
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map(o => o.id));
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>}
            <div
                className="flex items-center justify-between w-full min-w-[200px] bg-white border border-slate-300 hover:border-blue-400 rounded-lg px-3 py-1.5 cursor-pointer text-sm shadow-sm transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                    <span className="text-slate-700 truncate max-w-[150px] font-medium">
                        {selectedIds.length === 0
                            ? placeholder
                            : selectedIds.length === options.length
                                ? '전체 선택됨'
                                : `${selectedIds.length}개 선택됨`}
                    </span>
                </div>
                <FontAwesomeIcon icon={faChevronDown} className={`text-slate-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto flex flex-col">
                    <div
                        className="p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-sm font-bold text-slate-600 sticky top-0 bg-white"
                        onClick={handleSelectAll}
                    >
                        <FontAwesomeIcon
                            icon={selectedIds.length === options.length ? faCheckSquare : faSquare}
                            className={selectedIds.length === options.length ? "text-blue-500" : "text-slate-300"}
                        />
                        <span>전체 {selectedIds.length === options.length ? '해제' : '선택'}</span>
                    </div>
                    {options.map(option => (
                        <div
                            key={option.id}
                            className="p-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-sm border-b border-slate-50 last:border-none"
                            onClick={() => toggleOption(option.id)}
                        >
                            <FontAwesomeIcon
                                icon={selectedIds.includes(option.id) ? faCheckSquare : faSquare}
                                className={selectedIds.includes(option.id) ? "text-blue-500" : "text-slate-300"}
                            />
                            <span className={selectedIds.includes(option.id) ? "text-slate-800 font-medium" : "text-slate-500"}>
                                {option.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Main Page ---
const DailyReportDragDropPage = () => {
    // Top-Level Data (From DB)
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [allWorkers, setAllWorkers] = useState<WorkerModel[]>([]);

    // State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCompany, setSelectedCompany] = useState<string>(''); // Auto-selected after companies load
    const [weather, setWeather] = useState<string>('맑음'); // Default Weather

    // Confirmed Sites (Top Layer)
    const [confirmedSiteIds, setConfirmedSiteIds] = useState<Set<string>>(new Set());

    // Selection & Items
    const [activeTeamId, setActiveTeamId] = useState<string>(''); // Currently focused team (Left Pane)


    const [workerItems, setWorkerItems] = useState<WorkerItem[]>([]);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]); // Keep for data loading legacy, but main nav is activeTeamId
    const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [siteColumns, setSiteColumns] = useState<{ [key: string]: string[] }>({
        'col-1': [], 'col-2': [], 'col-3': [], 'col-4': []
    });
    // New: Site Level Work Content Map
    const [siteWorkContentMap, setSiteWorkContentMap] = useState<Map<string, string>>(new Map());
    const [isColumnsInitialized, setIsColumnsInitialized] = useState(false);

    // Enhanced Features State
    const [targetSiteId, setTargetSiteId] = useState<string>('');

    // Filter Modal States
    const [showTeamFilter, setShowTeamFilter] = useState(false);
    const [showSiteFilter, setShowSiteFilter] = useState(false);

    // AI Command State
    // AI Command State Removed

    const [copying, setCopying] = useState(false);

    // Visibility Filters
    const [visibleTeamIds, setVisibleTeamIds] = useState<string[]>([]);
    const [visibleSiteIds, setVisibleSiteIds] = useState<string[]>([]);

    // Accordion State (Empty = All Closed, i.e., "Tile Mode")
    const [expandedSiteIds, setExpandedSiteIds] = useState<Set<string>>(new Set());

    const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());

    // Support Team Allocation State & Derived Logic (Moved here to have access to dependencies)
    const [inputMode, setInputMode] = useState<'member' | 'support'>('member');

    // Derived State for Teams
    // constructorTeams: 내부 시공 팀 (DB type '일반', '새끼팀' 등 — 협력사 제외)
    const constructorTeams = React.useMemo(() => teams.filter(t => !['협력사', '지원팀'].includes(t.type)), [teams]);
    // supportTeams: 협력사(Company type='협력사')를 Team 형태로 변환하여 지원팀 탭에 표시
    const supportTeams: Team[] = React.useMemo(() =>
        companies
            .filter(c => c.type === '협력사')
            .map(c => ({
                id: c.id,
                name: c.name,
                type: '협력사',
                leaderId: '',
                leaderName: '',
                companyId: c.id,
                companyName: c.name,
                color: undefined,
            } as Team)),
        [companies]
    );

    const visibleTeams = React.useMemo(() => {
        if (!selectedCompany) return [];
        const companyObj = companies.find(c => c.name === selectedCompany);
        if (companyObj?.type === '협력사') {
            // 회사 드롭다운에서 협력사 직접 선택한 경우 → 해당 협력사 소속 팀
            return teams.filter(t => t.companyId === companyObj.id);
        }
        // 시공사 선택 상태
        if (inputMode === 'support') {
            return supportTeams; // 지원팀 탭 → 협력사 목록
        }
        // 시공팀 탭 → 내부 시공 팀
        if (visibleTeamIds.length === 0) return constructorTeams;
        return constructorTeams.filter(t => visibleTeamIds.includes(t.id || ''));
    }, [teams, visibleTeamIds, selectedCompany, companies, inputMode, constructorTeams, supportTeams]);

    const unassignedWorkers = React.useMemo(() => {
        if (inputMode === 'support') return []; // No workers in support mode source
        if (!activeTeamId) return [];
        return workerItems.filter(w => !w.currentSiteId && w.teamId === activeTeamId);
    }, [workerItems, activeTeamId, inputMode]);

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Load Daily Reports when Date Changes
    useEffect(() => {
        if (date) {
            loadDailyReports(date);
        }
    }, [date, allWorkers, teams]); // Added teams dependency

    // Init Visibility Filters (Restored)
    useEffect(() => {
        if (constructorTeams.length > 0 && visibleTeamIds.length === 0) {
            setVisibleTeamIds(constructorTeams.map(t => t.id || ''));
        }
        if (sites.length > 0 && visibleSiteIds.length === 0) {
            setVisibleSiteIds(sites.map(s => s.id || ''));
        }
    }, [teams, sites]);

    // Auto-select first 시공사 company when companies load
    useEffect(() => {
        if (companies.length > 0 && !selectedCompany) {
            const defaultCompany = companies.find(c => c.type === '시공사') || companies[0];
            if (defaultCompany) setSelectedCompany(defaultCompany.name);
        }
    }, [companies, selectedCompany]);

    const loadDailyReports = async (targetDate: string) => {
        try {
            // 1. Fetch Reports
            // We need to fetch ALL reports for the date (all teams) to visualize the full board.
            // dailyReportService.getReports(date) returns all reports if teamId is not provided.
            // But getReports definition (viewed earlier) takes (date, teamId?).
            // Let's verify if I can pass undefined for teamId to get all.
            // Checked dailyReportService.ts: getReports(date, teamId?) -> query(where date), if teamId q=query(q, where teamId).
            // So passing undefined gets all.
            const reports = await dailyReportService.getReports(targetDate);
            console.log(`[LoadReports] Loaded ${reports.length} reports for date ${targetDate}`);

            const teamIdToUuid = new Map<string, string>();
            teams.forEach((t) => {
                const uuid = t.id ? String(t.id) : '';
                if (!uuid) return;
                teamIdToUuid.set(uuid, uuid);
                const legacy = (t as any)?.legacyId ? String((t as any).legacyId) : '';
                if (legacy) teamIdToUuid.set(legacy, uuid);
            });

            const workerIdToUuid = new Map<string, string>();
            allWorkers.forEach((w) => {
                const uuid = w?.id ? String(w.id) : '';
                if (!uuid) return;
                workerIdToUuid.set(uuid, uuid);
                const legacy = (w as any)?.legacyId ? String((w as any).legacyId) : '';
                if (legacy) workerIdToUuid.set(legacy, uuid);
            });

            // 2. Map Assignments (Re-designed to handle Manual Workers)
            const loadedWorkerItems: WorkerItem[] = [];
            const usedWorkerIds = new Set<string>();
            const confirmedSites = new Set<string>();

            if (reports.length > 0) {
                if (reports[0].weather) setWeather(reports[0].weather);
            }

            // A. Process Assigned Workers (from Daily Report)
            const loadedWorkContent = new Map<string, string>(); // Temp map for work content

            reports.forEach(report => {
                confirmedSites.add(report.siteId);
                // Load Work Content for the site
                if (report.workContent) {
                    loadedWorkContent.set(report.siteId, report.workContent);
                }
                report.workers.forEach(rw => {
                    // Try to match with DB worker
                    const rawWorkerId = rw.workerId ? String(rw.workerId) : '';
                    const resolvedWorkerId = rawWorkerId ? (workerIdToUuid.get(rawWorkerId) ?? rawWorkerId) : '';
                    const dbWorker = resolvedWorkerId ? allWorkers.find(w => String(w.id) === resolvedWorkerId) : undefined;

                    const resolvedTeamIdRaw = (rw as any)?.teamId ? String((rw as any).teamId) : (report as any)?.teamId ? String((report as any).teamId) : '';
                    const resolvedTeamId = resolvedTeamIdRaw ? (teamIdToUuid.get(resolvedTeamIdRaw) ?? resolvedTeamIdRaw) : '';
                    const salaryModelSnapshot =
                        (typeof rw.salaryModel === 'string' && rw.salaryModel.trim().length > 0
                            ? rw.salaryModel
                            : typeof rw.payType === 'string' && rw.payType.trim().length > 0
                                ? rw.payType
                                : dbWorker?.teamType === '지원팀'
                                    ? '지원팀'
                                    : dbWorker?.teamType === '용역팀'
                                        ? '용역팀'
                                        : '일급제');
                    if (dbWorker && dbWorker.id) usedWorkerIds.add(dbWorker.id);

                    loadedWorkerItems.push({
                        ...(dbWorker ?? {}),
                        id: resolvedWorkerId || `manual_${Math.random().toString(36).substr(2, 9)}`,
                        tempId: resolvedWorkerId || `manual_${Math.random().toString(36).substr(2, 9)}`,
                        name: rw.name,
                        role: dbWorker?.role || rw.role || '작업자',
                        companyName: dbWorker?.companyName || '',
                        teamId: resolvedTeamId || undefined,
                        teamName: resolvedTeamId ? (teams.find(t => t.id === resolvedTeamId)?.name || '') : report.teamName,
                        teamColor: resolvedTeamId ? (teams.find(t => t.id === resolvedTeamId)?.color) : undefined,
                        currentSiteId: report.siteId,
                        manDay: rw.manDay,
                        workContent: rw.workContent || '',
                        unitPrice: rw.unitPrice || dbWorker?.unitPrice || 0,
                        status: rw.status as 'attendance' | 'absent' | 'half',
                        isConfirmed: true,
                        // Defaults
                        idNumber: dbWorker?.idNumber || '-',
                        teamType: dbWorker?.teamType || '일반',
                        // Removed invalid props: workerId, birthDate
                        contact: dbWorker?.contact || '',
                        address: dbWorker?.address || '',
                        accountNumber: dbWorker?.accountNumber || '',
                        bankName: dbWorker?.bankName || '',
                        salaryModel: salaryModelSnapshot,
                        employmentType: dbWorker?.employmentType || ''
                    } as WorkerItem);
                });
            });

            // B. Process Unassigned Workers (from All Workers DB)
            // Filter only workers belonging to the loaded teams
            const teamWorkers = allWorkers
                .filter(w => w.status !== '퇴사' && w.status !== '퇴사자') // 퇴사자 필터링
                .map((w) => {
                    const raw = w?.teamId ? String(w.teamId) : '';
                    const resolved = raw ? (teamIdToUuid.get(raw) ?? raw) : '';
                    return { worker: w, teamUuid: resolved };
                })
                .filter(({ teamUuid }) => !!teamUuid && teams.some((t) => String(t.id) === String(teamUuid)));

            const unassignedItems: WorkerItem[] = teamWorkers
                .map(({ worker, teamUuid }) => {
                    const uuid = worker?.id ? String(worker.id) : '';
                    return { worker, teamUuid, workerUuid: uuid };
                })
                .filter(({ workerUuid }) => workerUuid && !usedWorkerIds.has(workerUuid))
                .map(({ worker, teamUuid, workerUuid }) => ({
                    ...worker,
                    id: workerUuid,
                    tempId: workerUuid || `temp-${Math.random()}`,
                    teamId: teamUuid,
                    teamName: teams.find(t => String(t.id) === String(teamUuid))?.name || '',
                    teamColor: teams.find(t => String(t.id) === String(teamUuid))?.color,
                    currentSiteId: null,
                    manDay: 1.0,
                    workContent: '',
                    unitPrice: worker.unitPrice || 0,
                    status: 'attendance',
                    isConfirmed: false
                }));

            // 3. Update Worker Items
            setWorkerItems([...loadedWorkerItems, ...unassignedItems]);
            setConfirmedSiteIds(confirmedSites);
            setSiteWorkContentMap(loadedWorkContent);
            console.log(`[LoadReports] Merged: ${loadedWorkerItems.length} assigned + ${unassignedItems.length} unassigned.`);

            setConfirmedSiteIds(confirmedSites);
            // console.log("Loaded Reports:", reports.length);

        } catch (error) {
            console.error("Failed to load daily reports:", error);
        }
    };

    // Initialize Columns with Sites (Round Robin)
    useEffect(() => {
        if (sites.length > 0 && !isColumnsInitialized) {
            const newCols: Record<string, string[]> = { 'col-1': [], 'col-2': [], 'col-3': [], 'col-4': [] };
            const visibleSites = sites; // Or filtered? Let's init with all.

            visibleSites.forEach((site, index) => {
                const colKey = `col-${(index % 4) + 1}`;
                newCols[colKey].push(site.id || '');
            });

            setSiteColumns(newCols);
            setIsColumnsInitialized(true);
        }
    }, [sites, isColumnsInitialized]);

    // Set default active team
    useEffect(() => {
        if (teams.length > 0 && !activeTeamId) {
            setActiveTeamId(teams[0].id || '');
        }
    }, [teams]);

    const fetchInitialData = async () => {
        try {
            const [teamsRes, sitesRes, workersRes, companiesRes] = await Promise.allSettled([
                teamService.getTeams(),
                siteService.getSites(),
                manpowerService.getWorkers(),
                companyService.getCompanies()
            ]);

            if (teamsRes.status === 'fulfilled') setTeams(teamsRes.value);
            else console.error('Failed to fetch teams:', teamsRes.reason);

            if (sitesRes.status === 'fulfilled') setSites(sitesRes.value);
            else console.error('Failed to fetch sites:', sitesRes.reason);

            if (workersRes.status === 'fulfilled') setAllWorkers(workersRes.value);
            else console.error('Failed to fetch workers:', workersRes.reason);

            if (companiesRes.status === 'fulfilled') setCompanies(companiesRes.value);
            else console.error('Failed to fetch companies:', companiesRes.reason);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    // const loadTeamWorkers = (teamIds: string[]) => { ... } // REMOVED: We now keep all workers in state


    // --- Selection Logic ---
    // --- Selection Logic ---
    const handleToggleSelect = (id: string) => {
        const targetWorker = workerItems.find(w => w.tempId === id);
        if (!targetWorker) return;

        const isTargetUnassigned = targetWorker.currentSiteId === null;

        setSelectedWorkerIds(prev => {
            const newSet = new Set(prev);

            // Check if we are mixing contexts
            let hasMixedContext = false;
            const currentSelection = Array.from(prev);
            for (const selectedId of currentSelection) {
                const w = workerItems.find(item => item.tempId === selectedId);
                if (w) {
                    const isSelectedUnassigned = w.currentSiteId === null;
                    if (isTargetUnassigned !== isSelectedUnassigned) {
                        hasMixedContext = true;
                        break;
                    }
                }
            }

            // If mixing contexts, clear previous selection and start fresh with the target
            if (hasMixedContext) {
                return new Set([id]);
            }

            // Normal toggle
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAllUnassigned = () => {
        const unassignedIds = workerItems
            .filter(w => w.currentSiteId === null && w.teamId === activeTeamId)
            .map(w => w.tempId);

        const allSelected = unassignedIds.every(id => selectedWorkerIds.has(id));

        if (allSelected) {
            // Deselect all unassigned
            setSelectedWorkerIds(prev => {
                const newSet = new Set(prev);
                unassignedIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        } else {
            // Select all unassigned
            setSelectedWorkerIds(prev => {
                const newSet = new Set(prev);
                unassignedIds.forEach(id => newSet.add(id));
                return newSet;
            });
        }
    };

    const handleClearSelection = () => {
        setSelectedWorkerIds(new Set());
    };

    // --- Enhanced Features Logic ---

    const handleQuickAssign = () => {
        if (!targetSiteId) {
            alert("배정할 현장을 선택해주세요.");
            return;
        }
        if (selectedWorkerIds.size === 0) {
            alert("배정할 인원을 선택해주세요.");
            return;
        }

        setWorkerItems(prev => prev.map(w => {
            if (selectedWorkerIds.has(w.tempId)) {
                return { ...w, currentSiteId: targetSiteId };
            }
            return w;
        }));

        setSelectedWorkerIds(new Set()); // Clear selection after assign
    };

    const handleCopyPreviousDay = async () => {
        if (selectedTeamIds.length === 0) {
            alert("팀을 먼저 선택해주세요.");
            return;
        }

        if (!window.confirm("선택된 팀들의 가장 최근 일보 내역을 불러와서 적용하시겠습니까?\n현재 작성 중인 내용은 초기화됩니다.")) {
            return;
        }

        setCopying(true);
        try {
            const workerSiteMap = new Map<string, string>(); // workerId -> siteId
            const confirmedSiteIdsFromReports = new Set<string>();

            // Loop through each selected team
            for (const teamId of selectedTeamIds) {
                // 1. Find last report date for this team
                const lastDate = await dailyReportService.getLastReportDate(teamId);
                if (!lastDate) continue;

                // 2. Fetch reports for that date
                const reports = await dailyReportService.getReports(lastDate, teamId);

                // 3. Map workers to sites
                reports.forEach(report => {
                    confirmedSiteIdsFromReports.add(report.siteId);
                    report.workers.forEach(w => {
                        workerSiteMap.set(w.workerId, report.siteId);
                    });
                });
            }

            if (workerSiteMap.size === 0) {
                alert("이전 일보 내역을 찾을 수 없습니다.");
                return;
            }

            // 4. Apply to current workerItems
            setWorkerItems(prev => prev.map(w => {
                const prevSiteId = workerSiteMap.get(w.id || '');
                if (prevSiteId) {
                    return { ...w, currentSiteId: prevSiteId, isConfirmed: true }; // Workers from previous reports are confirmed
                }
                return { ...w, currentSiteId: null, isConfirmed: false }; // Reset if not found in prev report
            }));
            setConfirmedSiteIds(confirmedSiteIdsFromReports); // Set confirmed sites from reports

            alert(`이전 일보 내용을 불러왔습니다.`);

        } catch (error) {
            console.error("Error copying previous day:", error);
            alert("전일 복사 중 오류가 발생했습니다.");
        } finally {
            setCopying(false);
        }
    };

    const handleResetAssignments = () => {
        if (!window.confirm("모든 배정을 초기화하시겠습니까?")) return;
        setWorkerItems(prev => prev.map(w => ({ ...w, currentSiteId: null, isConfirmed: false })));
        setConfirmedSiteIds(new Set());
    };

    // --- Accordion Logic ---
    const toggleSiteExpansion = (siteId: string) => {
        setExpandedSiteIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(siteId)) {
                newSet.delete(siteId); // Collapse
            } else {
                newSet.add(siteId); // Expand
            }
            return newSet;
        });
    };

    const handleExpandAll = () => {
        const allIds = new Set(sites.map(s => s.id || ''));
        setExpandedSiteIds(allIds);
    };

    const handleCollapseAll = () => {
        setExpandedSiteIds(new Set());
    };

    const handleWorkerDoubleClick = (workerId: string) => {
        const targetWorker = workerItems.find(w => w.tempId === workerId);
        if (!targetWorker) return;

        // Case 1: Assigned -> Unassign (Return to Pool)
        if (targetWorker.currentSiteId !== null) {
            setWorkerItems(prev => prev.map(w => {
                if (w.tempId === workerId) {
                    return { ...w, currentSiteId: null };
                }
                return w;
            }));
        }
        // Case 2: Unassigned -> Assign to Target Site
        else {
            if (!targetSiteId) {
                alert("먼저 '빠른 배정'에서 현장을 선택해주세요.");
                return;
            }
            setWorkerItems(prev => prev.map(w => {
                if (w.tempId === workerId) {
                    return { ...w, currentSiteId: targetSiteId, manDay: 1.0, isConfirmed: true };
                }
                return w;
            }));
        }
    };

    const handleManDayChange = (workerId: string, val: number) => {
        setWorkerItems(prev => prev.map(w => {
            if (w.tempId === workerId) {
                return { ...w, manDay: val };
            }
            return w;
        }));
    };

    const handleWorkContentChange = (workerId: string, val: string) => {
        setWorkerItems(prev => prev.map(w => {
            if (w.tempId === workerId) {
                return { ...w, workContent: val };
            }
            return w;
        }));
    };

    // Subcontractor Logic: Handle Team Change
    const handleWorkerTeamChange = (workerId: string, teamId: string) => {
        setWorkerItems(prev => prev.map(w => {
            if (w.tempId === workerId) {
                return { ...w, teamId: teamId };
            }
            return w;
        }));
    };

    // --- AI Command Handler Removed ---

    // --- Drag Logic ---

    const handleDragStart = (event: DragStartEvent) => {
        const id = event.active.id as string;
        setActiveDragId(id);

        if (!selectedWorkerIds.has(id)) {
            setSelectedWorkerIds(new Set([id]));
        }
    };

    const findColumn = (id: string) => {
        if (id in siteColumns) return id;
        return Object.keys(siteColumns).find(key => siteColumns[key].includes(id));
    };

    const handleDragOver = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Only handle Site-Column movement here (Worker movement is in DragEnd typically, or separate)
        // Actually for multi-container sortable, we need DragOver to move items visually
        if (active.data.current?.type === 'container' && (over.data.current?.type === 'container' || over.id.toString().startsWith('col-'))) {
            const activeColumn = findColumn(activeId);
            const overColumn = findColumn(overId);

            if (!activeColumn || !overColumn || activeColumn === overColumn) return;

            setSiteColumns(prev => {
                const activeItems = prev[activeColumn];
                const overItems = prev[overColumn];
                const activeIndex = activeItems.indexOf(activeId);
                const overIndex = overItems.indexOf(overId);

                let newIndex;
                if (overId in prev) {
                    newIndex = overItems.length + 1;
                } else {
                    const isBelowOverItem =
                        over &&
                        active.rect.current.translated &&
                        active.rect.current.translated.top >
                        over.rect.top + over.rect.height;

                    const modifier = isBelowOverItem ? 1 : 0;
                    newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
                }

                return {
                    ...prev,
                    [activeColumn]: [
                        ...prev[activeColumn].filter(item => item !== activeId)
                    ],
                    [overColumn]: [
                        ...prev[overColumn].slice(0, newIndex),
                        activeId,
                        ...prev[overColumn].slice(newIndex, prev[overColumn].length)
                    ]
                };
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // --- Container Reordering Logic (Within Column) ---
        if (active.data.current?.type === 'container') {
            const activeColumn = findColumn(activeId);
            const overColumn = findColumn(overId);

            if (activeColumn && overColumn && activeColumn === overColumn) {
                const activeIndex = siteColumns[activeColumn].indexOf(activeId);
                const overIndex = siteColumns[activeColumn].indexOf(overId);

                if (activeIndex !== overIndex) {
                    setSiteColumns(prev => ({
                        ...prev,
                        [activeColumn]: arrayMove(prev[activeColumn], activeIndex, overIndex)
                    }));
                }
            }
            return;
        }

        let newSiteId: string | null = null;

        // 1. Identify Target (Where did we drop?)
        if (over.id === 'unassigned') {
            // Dropped in Left Pane Pool
            newSiteId = null;
        } else if (over.data.current?.type === 'container') {
            // Dropped on a Site Column (Right Pane)
            newSiteId = over.data.current.siteId;
        } else if (over.data.current?.type === 'worker') {
            // Dropped on another worker
            const overWorker = workerItems.find(w => w.tempId === overId);
            if (overWorker) {
                newSiteId = overWorker.currentSiteId;
            }
        }

        // 2. Identify Items to Move (or Create)
        const isTeamDrag = activeId.startsWith('team-source-');

        // Look up company object for type check
        const selectedCompanyObj = companies.find(c => c.name === selectedCompany);

        if (isTeamDrag && newSiteId) {
            // CASE: Dragging a Team from Source -> Create New Worker Item (Team Entry)
            const teamId = activeId.replace('team-source-', '');
            const team = teams.find(t => t.id === teamId) || supportTeams.find(t => t.id === teamId);

            if (team) {
                // Determine if Support Team or Subcontractor
                const isSupportTeam = team.type === '지원팀';
                const isSubcontractor = team.type === '협력사';

                const newWorkerItem: WorkerItem = {
                    id: '', // Will be generated or ignored on save? Better generate temp ID
                    tempId: `new-team-${team.id}-${Date.now()}`,
                    name: team.name, // Team Name
                    role: '팀', // Marker for Team Entry
                    teamId: team.id,
                    teamName: team.name, // Team Name as Team Name
                    manDay: isSubcontractor ? 0 : 1.0, // Default 1.0 for Support Team (adjustable), 0 for Subcontractor
                    currentSiteId: newSiteId,
                    isConfirmed: true,
                    status: 'attendance',
                    workContent: '',
                    unitPrice: team.supportRate || 0, // Default Unit Price
                    teamType: isSupportTeam ? '지원팀' : (isSubcontractor ? '용역팀' : '일반'),
                    salaryModel: isSupportTeam ? '지원팀' : '일급제',
                    teamColor: team.color,
                    companyName: selectedCompany, // Assign selected company name
                    idNumber: '-' // Added missing prop
                };

                setWorkerItems(prev => [...prev, newWorkerItem]);
            }
            return;
        }

        const itemsToMove = selectedWorkerIds.has(activeId)
            ? Array.from(selectedWorkerIds)
            : [activeId];

        // 3. Update State
        setWorkerItems(prev => {
            return prev.map(w => {
                if (itemsToMove.includes(w.tempId)) {
                    // Maintain ManDay if site is same (e.g. reorder attempt), Reset if site changed
                    const isSiteChanged = w.currentSiteId !== newSiteId;
                    return {
                        ...w,
                        currentSiteId: newSiteId,
                        manDay: isSiteChanged ? (selectedCompanyObj?.type === '협력사' ? 0 : 1.0) : w.manDay,
                        isConfirmed: !!newSiteId // Assigned = Confirmed
                    };
                }
                return w;
            });
        });

        // 4. Cleanup
        if (itemsToMove.length > 1) {
            setSelectedWorkerIds(new Set());
        }
    };

    // --- Save Logic ---
    const handleSave = async () => {
        // Filter ONLY Confirmed Workers (and Assigned)
        // If unassigned but confirmed? User might want to save unassigned status? 
        // Typically Daily Report is for Site. 
        // Let's strictly require Site for now.
        const assignedWorkers = workerItems.filter(w => w.isConfirmed && w.currentSiteId !== null);

        if (assignedWorkers.length === 0) {
            // Allow saving empty state (to clear DB)
            // But confirm if user wants to save "Empty"
            if (!window.confirm("배정된 인원이 없습니다. 저장하면 기존 일보가 삭제됩니다. 계속하시겠습니까?")) {
                return;
            }
        }

        setSaving(true);
        try {
            // Group by Site AND Team (Since we have multiple teams now)
            // Key: `${siteId}_${teamId} `
            const reportsMap = new Map<string, WorkerItem[]>();

            assignedWorkers.forEach(w => {
                if (!w.teamId) return; // Should have teamId
                const key = `${w.currentSiteId}_${w.teamId}`; // Fixed: Removed trailing space
                const existing = reportsMap.get(key) || [];
                existing.push(w);
                reportsMap.set(key, existing);
            });

            const reportsToSave: Omit<DailyReport, 'id'>[] = [];
            const currentUser = authService.getCurrentUser();

            const entries = Array.from(reportsMap.entries());

            for (const [key, workers] of entries) {
                const [siteId, teamId] = key.split('_');
                const site = sites.find(s => s.id === siteId);
                const team = teams.find(t => t.id === teamId);

                if (!site || !team) {
                    console.warn(`[HandleSave] Missing Site/Team for key ${key}. Site: ${site}, Team: ${team}`);
                    continue;
                }

                const totalManDay = workers.reduce((sum: number, w: WorkerItem) => sum + w.manDay, 0);
                const totalAmount = workers.reduce((sum: number, w: WorkerItem) => sum + (w.manDay * (w.unitPrice || 0)), 0);

                reportsToSave.push({
                    date,
                    teamId: team.id || '',
                    teamName: team.name,
                    siteId: site.id || '',
                    siteName: site.name,
                    responsibleTeamId: site.responsibleTeamId || '',
                    responsibleTeamName: site.responsibleTeamName || '',

                    companyId: site.clientCompanyId || '',
                    companyName: site.clientCompanyName || '',

                    constructorCompanyId: site.companyId || '',
                    constructorCompanyName: site.companyName || '',

                    partnerId: site.partnerId || '',
                    partnerName: site.partnerName != null ? String(site.partnerName) : '',

                    writerId: currentUser?.uid || 'unknown',
                    workers: workers.map((w: WorkerItem) => ({
                        workerId: w.id || '',
                        name: w.name,
                        role: w.role || '작업자',
                        status: w.status,
                        manDay: w.manDay,
                        workContent: w.workContent || '',
                        teamId: w.teamId || '',
                        unitPrice: w.unitPrice || 0,
                        salaryModel:
                            w.teamType === '지원팀'
                                ? '지원팀'
                                : w.teamType === '용역팀'
                                    ? '용역팀'
                                    : w.salaryModel || '일급제'
                    })),
                    totalManDay,
                    totalAmount,
                    weather: weather || '', // Include selected weather
                    workContent: siteWorkContentMap.get(siteId) || '' // Save Site Work Content
                });
            }

            // Use Overwrite Reports
            // Pass ALL teams ID to ensure we clear reports for all managed teams on this page
            const allTeamIds = teams.map(t => t.id || '');
            await dailyReportService.overwriteReports(date, reportsToSave, allTeamIds);
            alert("일보가 저장되었습니다.");
        } catch (error: any) {
            console.error("Save failed:", error);
            alert(`저장에 실패했습니다.\n오류 내용: ${error?.message || error}`);
        } finally {
            setSaving(false);
        }
    };

    // --- Render Helpers ---
    // --- Render Helpers ---
    // Left Pane: Show Unassigned workers FOR THE ACTIVE TEAM ONLY
    // Also show "Assigned" workers for this team? No, only unassigned. Assigned are on the right.
    // Actually, maybe show all team members? 
    // User Requirement: "Team Quick Tabs... One click switches pool."
    // Let's show Unassigned members of activeTeamId.
    // unassignedWorkers moved to top level derived state

    // Right Pane: All sites.
    // We should show ALL sites that match search or are selected.
    // The distinction of "Confirmed" vs "Bottom" is gone. allActiveSiteIds?
    // Let's just use 'sites' filtered by search.
    // And maybe "Selected Site IDs" if user wants to filter right pane?
    // For now, show ALL sites that match search.

    // Consolidated Site List for Right Pane
    const rightPaneSites = sites.filter(site => {
        // 1. Visibility Filter
        const isVisible = visibleSiteIds.length === 0 || visibleSiteIds.includes(site.id || '');
        if (!isVisible) return false;

        // 2. Search Filter (Removed)
        // const matchesSearch = site.name.toLowerCase().includes(siteSearchTerm.toLowerCase()) ||
        //     (site.responsibleTeamName && site.responsibleTeamName.toLowerCase().includes(siteSearchTerm.toLowerCase()));
        // if (!matchesSearch) return false;
        return true;
    });

    // Filtered Teams
    // visibleTeams moved to top level derived state


    const activeWorker = activeDragId ? workerItems.find(w => w.tempId === activeDragId) : null;

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] font-['Pretendard']">
            {/* Header / Top Bar (Global Controls like Date, Save) */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm z-30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span>일보 배차판</span>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Allocator Dashboard</span>
                    </h1>
                    <div className="h-5 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400 text-sm" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0 w-[110px]"
                        />
                    </div>
                    {/* Weather Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                        <span className="text-sm text-slate-400">날씨</span>
                        <select
                            value={weather}
                            onChange={(e) => setWeather(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0"
                        >
                            <option value="맑음">맑음 ☀️</option>
                            <option value="흐림">흐림 ☁️</option>
                            <option value="비">비 ☔</option>
                            <option value="눈">눈 ❄️</option>
                        </select>
                    </div>
                </div>


                {/* VISIBILITY FILTERS (New Header Section - Layer Mode) */}
                <div className="flex items-center gap-2 mx-4 flex-1 justify-center relative">
                    {/* Company Selector */}
                    <select
                        value={selectedCompany || ''}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none"
                    >
                        {companies.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    <div className="w-px h-4 bg-slate-300 mx-1"></div>

                    {/* Team Filter - Only for Internal Companies */}
                    {(companies.find(c => c.name === selectedCompany)?.type === '시공사' ||
                        companies.find(c => c.name === selectedCompany)?.type === '건설사' ||
                        !companies.find(c => c.name === selectedCompany)) && (
                            <button
                                onClick={() => setShowTeamFilter(true)}
                                className={`
                                px-3 py-1.5 rounded-lg text-sm font-bold border flex items-center gap-2 transition-colors
                                ${visibleTeamIds.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}
                            `}
                            >
                                <FontAwesomeIcon icon={faUsers} />
                                <span>팀 선택 {visibleTeamIds.length > 0 ? `(${visibleTeamIds.length})` : '(전체)'}</span>
                                <FontAwesomeIcon icon={faChevronDown} className="text-xs opacity-50" />
                            </button>
                        )}

                    <div className="w-px h-4 bg-slate-300 mx-1"></div>

                    <button
                        onClick={() => setShowSiteFilter(true)}
                        className={`
                            px-3 py-1.5 rounded-lg text-sm font-bold border flex items-center gap-2 transition-colors
                            ${visibleSiteIds.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}
                        `}
                    >
                        <FontAwesomeIcon icon={faBuilding} />
                        <span>현장 선택 {visibleSiteIds.length > 0 ? `(${visibleSiteIds.length})` : '(전체)'}</span>
                        <FontAwesomeIcon icon={faChevronDown} className="text-xs opacity-50" />
                    </button>

                    {/* Team Filter Layer */}
                    {showTeamFilter && (
                        <>
                            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowTeamFilter(false)}></div>
                            <div className="absolute top-10 left-0 bg-white border border-slate-200 shadow-xl rounded-xl p-4 w-[300px] z-50 flex flex-col gap-3">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <h3 className="font-bold text-slate-800">팀 필터</h3>
                                    <div className="flex gap-2 text-xs">
                                        <button onClick={() => setVisibleTeamIds([])} className="text-blue-600 hover:underline">전체 선택</button>
                                        {/* Logic: Empty array = All in our app logic. If we want explicit all, we clear array. */}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                    {constructorTeams.map(t => {
                                        const isSelected = visibleTeamIds.includes(t.id || '');
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => {
                                                    setVisibleTeamIds(prev =>
                                                        prev.includes(t.id || '')
                                                            ? prev.filter(id => id !== t.id)
                                                            : [...prev, t.id || '']
                                                    );
                                                }}
                                                className={`
                                                    px-2 py-1.5 rounded text-xs font-bold border transition-all text-left truncate flex items-center gap-2
                                                    ${isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                    }
                                                `}
                                            >
                                                <FontAwesomeIcon icon={faUsers} className={isSelected ? "text-white" : "text-slate-400"} />
                                                {t.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Site Filter Layer */}
                    {showSiteFilter && (
                        <>
                            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowSiteFilter(false)}></div>
                            <div className="absolute top-10 left-[120px] bg-white border border-slate-200 shadow-xl rounded-xl p-4 w-[400px] z-50 flex flex-col gap-3">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <h3 className="font-bold text-slate-800">현장 필터</h3>
                                    <div className="flex gap-2 text-xs">
                                        <button onClick={() => setVisibleSiteIds([])} className="text-blue-600 hover:underline">전체 선택</button>
                                        <button onClick={() => setVisibleSiteIds(sites.map(s => s.id || ''))} className="text-slate-500 hover:underline">모두 선택(데이터)</button>
                                        <button onClick={() => setVisibleSiteIds([])} className="text-red-500 hover:underline">초기화</button>
                                        {/* In our logic: Empty = All. explicit selection is filter. */}
                                        {/* Let's simplify: "Initialize (All)" sets to [] */}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                                    {sites.map(s => {
                                        const isSelected = visibleSiteIds.includes(s.id || '');
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    setVisibleSiteIds(prev =>
                                                        prev.includes(s.id || '')
                                                            ? prev.filter(id => id !== s.id)
                                                            : [...prev, s.id || '']
                                                    );
                                                }}
                                                className={`
                                                    px-2 py-1.5 rounded text-xs font-bold border transition-all text-left truncate flex items-center gap-2
                                                    ${isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                    }
                                                `}
                                            >
                                                <FontAwesomeIcon icon={faBuilding} className={isSelected ? "text-white" : "text-slate-400"} />
                                                {s.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* AI Command Bar Removed */}

                <div className="flex items-center gap-2">


                    <button
                        onClick={handleCopyPreviousDay}
                        disabled={copying || !activeTeamId}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faCopy} />
                        전일 복사
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        저장
                    </button>
                </div>
            </div>


            {/* Main 2-Pane Content */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-hidden flex flex-row">
                    {/* LEFT PANE: SOURCE (Manpower Pool) */}
                    <div className="w-[420px] flex flex-col bg-white border-r border-slate-200 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-20">


                        {/* Quick Assign Toolbar (Target Site Selector) */}
                        <div className="p-3 bg-white border-b border-slate-200 space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 px-1 flex items-center justify-between">
                                <span>빠른 배정 (Target)</span>
                                {targetSiteId && <span className="text-[10px] text-blue-600 font-normal">더블클릭/버튼으로 배정</span>}
                            </h3>
                            <div className="flex gap-2">
                                <div className={`flex-1 text-xs border rounded px-3 py-1.5 flex items-center ${targetSiteId ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                    {targetSiteId
                                        ? (
                                            <span className="flex items-center gap-1.5">
                                                <FontAwesomeIcon icon={faBuilding} style={{ color: sites.find(s => s.id === targetSiteId)?.color || '#059669' }} />
                                                {sites.find(s => s.id === targetSiteId)?.name}
                                            </span>
                                        )
                                        : '우측 현장 카드를 클릭하세요'
                                    }
                                </div>
                                <button
                                    onClick={handleQuickAssign}
                                    disabled={!targetSiteId || selectedWorkerIds.size === 0}
                                    className="bg-blue-600 disabled:bg-slate-300 text-white text-xs font-bold px-3 rounded hover:bg-blue-700 transition-colors shrink-0"
                                >
                                    배정
                                </button>
                            </div>
                        </div>

                        {/* Team Tabs (Quick Switch) - Only for Internal */}
                        {companies.find(c => c.name === selectedCompany)?.type !== '협력사' && (
                            <div className="bg-slate-50 border-b border-slate-200">
                                {/* Mode Tabs */}
                                <div className="flex border-b border-slate-200">
                                    <button
                                        onClick={() => setInputMode('member')}
                                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${inputMode === 'member' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        시공팀 (멤버)
                                    </button>
                                    <button
                                        onClick={() => setInputMode('support')}
                                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${inputMode === 'support' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        지원팀
                                    </button>
                                </div>

                                {/* Team List (Only for Member Mode) */}
                                {inputMode === 'member' && (
                                    <div className="p-3">
                                        <h3 className="text-xs font-bold text-slate-500 mb-2 px-1">
                                            팀 선택 (Source)
                                        </h3>
                                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                            {visibleTeams.length === 0 && (
                                                <div className="text-xs text-slate-400 p-2 text-center w-full">표시할 팀이 없습니다.</div>
                                            )}
                                            {visibleTeams.map(team => (
                                                <button
                                                    key={team.id}
                                                    onClick={() => setActiveTeamId(team.id || '')}
                                                    className={`
                                                px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                                ${activeTeamId === team.id
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-100'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                                            `}
                                                >
                                                    {team.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Unassigned Worker List OR External/Support Team Table */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/50">
                            <div className="flex-1 p-2 overflow-y-auto">
                                {(companies.find(c => c.name === selectedCompany)?.type === '협력사' || inputMode === 'support') ? (
                                    /* External/Support Team Table View */
                                    <SortableContext
                                        items={visibleTeams.map(t => `team-source-${t.id}`)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            {/* Header */}
                                            <div className="flex bg-slate-50 border-b border-slate-200 p-2 text-xs font-bold text-slate-500 sticky top-0 z-10">
                                                <div className="flex-1 pl-1">팀명</div>
                                                <div className="w-10 text-center">색상</div>
                                            </div>
                                            {/* Rows */}
                                            {visibleTeams.map(team => (
                                                <DraggableTeamRow key={team.id} team={team} />
                                            ))}
                                            {visibleTeams.length === 0 && (
                                                <div className="p-8 text-center text-xs text-slate-400">
                                                    {inputMode === 'support' ? '등록된 협력사가 없습니다.' : '등록된 협력사 팀이 없습니다.'}
                                                </div>
                                            )}
                                        </div>
                                    </SortableContext>
                                ) : (
                                    /* Internal Worker List */
                                    <SiteColumn
                                        site={null} // Represents Unassigned
                                        workers={unassignedWorkers}
                                        selectedWorkerIds={selectedWorkerIds}
                                        onToggleSelect={handleToggleSelect}
                                        onSelectAll={handleSelectAllUnassigned}
                                        isGrid={true} // Use Grid for compact view
                                        onWorkerDoubleClick={handleWorkerDoubleClick}
                                        selectedCompany={selectedCompany}
                                        teams={teams}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANE: TARGET (Sites) */}
                    <div className="flex-1 flex flex-col bg-[#f1f5f9] overflow-hidden relative">
                        {/* Right Pane Header (Stats & Filters) */}
                        <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10 shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faBuilding} className="text-blue-500" />
                                    현장 목록 ({rightPaneSites.length}개)
                                </h2>
                                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    총 배정: <span className="font-bold text-blue-600">{workerItems.filter(w => w.currentSiteId !== null).length}</span>명
                                    <span className="mx-1 text-slate-300">|</span>
                                    총 공수: <span className="font-bold text-blue-600">
                                        {workerItems
                                            .filter(w => w.currentSiteId !== null)
                                            .reduce((sum, w) => sum + (w.manDay || 0), 0)
                                            .toFixed(1)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExpandAll}
                                    className="text-xs px-2 py-1 rounded hover:bg-slate-100 text-slate-600 border border-transparent hover:border-slate-200 transition-colors"
                                >
                                    전체 펼치기
                                </button>
                                <button
                                    onClick={handleCollapseAll}
                                    className="text-xs px-2 py-1 rounded hover:bg-slate-100 text-slate-600 border border-transparent hover:border-slate-200 transition-colors"
                                >
                                    전체 접기
                                </button>
                                <div className="h-3 w-px bg-slate-200 mx-1"></div>
                                <button
                                    onClick={handleResetAssignments}
                                    className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-transparent hover:border-red-100 transition-colors flex items-center gap-1"
                                >
                                    <FontAwesomeIcon icon={faUndo} />
                                    배정 초기화
                                </button>
                            </div>
                        </div>

                        {/* Background Grid Pattern */}
                        <div className="absolute inset-0 z-0 opacity-[0.03]"
                            style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 z-10 custom-scrollbar">
                            {/* 4-Column Flex Layout (Kanban Style) */}
                            <div className="flex gap-4 h-full pb-20 items-start">
                                {['col-1', 'col-2', 'col-3', 'col-4'].map(colId => (
                                    <div key={colId} className="flex-1 flex flex-col gap-4 min-w-[200px]">
                                        <SortableContext
                                            id={colId}
                                            items={siteColumns[colId]}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {siteColumns[colId].map(siteId => {
                                                const site = rightPaneSites.find(s => s.id === siteId);
                                                // If site is filtered out by search, don't show it (visual filter)
                                                // BUT Keep it in the sortable context to maintain index?
                                                // If we remove from context, drag might break.
                                                // Better to filter visual only, but dnd-kit likes mapping.
                                                // If filtered out, let's just null check.
                                                if (!site) return null;

                                                // Sort siteWorkers by Role Priority
                                                const rolePriority: { [key: string]: number } = {
                                                    '팀장': 5,
                                                    '반장': 4,
                                                    '기공': 3,
                                                    '조공': 2,
                                                    '일반': 1
                                                };

                                                const siteWorkers = workerItems
                                                    .filter(w => w.currentSiteId === site.id)
                                                    .sort((a, b) => {
                                                        const rankA = rolePriority[a.role || '일반'] || 0;
                                                        const rankB = rolePriority[b.role || '일반'] || 0;
                                                        if (rankA !== rankB) return rankB - rankA; // Higher rank first
                                                        return a.name.localeCompare(b.name); // Name fallback
                                                    });

                                                const responsibleTeam = teams.find(t => t.id === site.responsibleTeamId);
                                                const isExpanded = expandedSiteIds.has(site.id || '');

                                                return (
                                                    <SiteColumn
                                                        key={site.id}
                                                        site={site}
                                                        workers={siteWorkers}
                                                        selectedWorkerIds={selectedWorkerIds}
                                                        onToggleSelect={handleToggleSelect}
                                                        isAccordion={true}
                                                        isExpanded={isExpanded}
                                                        onHeaderClick={() => toggleSiteExpansion(site.id || '')}
                                                        isGrid={true}
                                                        selectedCompany={selectedCompany}
                                                        responsibleTeamCompanyName={responsibleTeam?.companyName}
                                                        onWorkerDoubleClick={handleWorkerDoubleClick}
                                                        onSiteSelect={() => setTargetSiteId(site.id || '')}
                                                        isTargetSite={targetSiteId === site.id}
                                                        onChangeManDay={handleManDayChange}
                                                        onChangeWorkContent={handleWorkContentChange}
                                                        siteWorkContent={siteWorkContentMap.get(site.id || '') || ''}
                                                        onSiteWorkContentChange={(val) => {
                                                            setSiteWorkContentMap(prev => new Map(prev).set(site.id || '', val));
                                                        }}
                                                        onChangeWorkerTeam={handleWorkerTeamChange}
                                                        responsibleTeamColor={responsibleTeam?.color}
                                                        siteColor={site.color}
                                                        // Subcontractor Props
                                                        teams={teams}
                                                    />
                                                );
                                            })}
                                        </SortableContext>
                                        {/* Empty Drop Zone for Column */}
                                        {siteColumns[colId].length === 0 && (
                                            <div id={colId} className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 text-xs">
                                                빈 열
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </DndContext>

            <DragOverlay>
                {activeDragId ? (
                    <WorkerCard
                        worker={activeWorker!}
                        isOverlay
                        selectionCount={selectedWorkerIds.size > 1 && selectedWorkerIds.has(activeDragId as string) ? selectedWorkerIds.size : 0}
                    />
                ) : null}
            </DragOverlay>
        </div >
    );
};

// Helper Component for External Team Row
interface DraggableTeamRowProps {
    team: Team;
}

const DraggableTeamRow = ({ team }: DraggableTeamRowProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `team-source-${team.id}`,
        data: {
            type: 'Team',
            team
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex items-center p-2 border-b border-slate-100 hover:bg-slate-50 cursor-grab active:cursor-grabbing bg-white text-xs"
        >
            <div className="flex-1 font-bold text-slate-700 truncate flex items-center gap-2">
                <FontAwesomeIcon icon={faUsers} className="text-slate-400 text-[10px]" />
                {team.name}
            </div>
            <div className="w-10 flex justify-center">
                <div className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: team.color }}></div>
            </div>
        </div>
    );
};

export default DailyReportDragDropPage;
