import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faMapMarkerAlt, faArrowLeft, faHardHat, faBriefcase, faPhone, faUserTie } from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';

// --- Types ---
interface ColumnData {
    id: string;
    title: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[];
}

// --- Components ---

// 1. Sortable Item (Company Card)
interface SortableItemProps {
    id: string;
    company: Company;
}

const SortableItem = ({ id, company }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id, data: { company } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleTypeChange = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag start
        const newType = company.type === '협력사' ? '건설사' : '협력사';
        if (window.confirm(`'${company.name}'의 구분을 '${newType}'(으)로 변경하시겠습니까?`)) {
            try {
                await companyService.updateCompany(company.id!, { type: newType });
                // Note: Parent component needs to refresh data. 
                // In a real app, we might use a callback or global state.
                // For now, we'll rely on the drag end or manual refresh, 
                // but ideally this component should accept a callback.
                // Since we can't easily pass a callback through dnd-kit without context,
                // we'll just alert for now or assume the user will refresh if needed.
                // Better: Pass a refresh trigger via props if possible, or use a context.
                window.location.reload(); // Simple brute-force refresh for this specific action
            } catch (error) {
                console.error("Failed to update type", error);
                alert("변경 실패");
            }
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-3 cursor-grab hover:shadow-md transition-all group relative"
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded ${company.type === '협력사' || company.type === '시공사' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                    {company.type}
                </span>
                <button
                    onClick={handleTypeChange}
                    className="text-slate-300 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="구분 변경 (협력사 <-> 건설사)"
                >
                    <FontAwesomeIcon icon={faBriefcase} />
                </button>
            </div>

            <div className="font-bold text-slate-800 mb-1">{company.name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <FontAwesomeIcon icon={faUserTie} />
                {company.ceoName}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
                <FontAwesomeIcon icon={faPhone} />
                {company.phone}
            </div>
        </div>
    );
};

// 2. Droppable Column
const Column = ({ id, title, items }: ColumnData) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex flex-col h-full bg-slate-100 rounded-xl p-4 min-w-[300px]">
            <h2 className="font-bold text-slate-700 mb-4 flex justify-between items-center">
                {title}
                <span className="bg-white px-2 py-0.5 rounded-full text-xs text-slate-500 shadow-sm">
                    {items.length}
                </span>
            </h2>
            <div ref={setNodeRef} className="flex-1 overflow-y-auto">
                <SortableContext items={items.map((i: any) => i.id!)} strategy={verticalListSortingStrategy}>
                    {items.map((company: Company) => (
                        <SortableItem key={company.id} id={company.id!} company={company} />
                    ))}
                </SortableContext>
                {items.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                        여기로 드래그하세요
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Page ---
const CompanyAssignmentPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeTab, setActiveTab] = useState<'contractor' | 'client'>('contractor');
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        fetchCompanies();
    }, [activeTab]);

    const fetchCompanies = async () => {
        // Fetch all and filter client-side for status, but type is filtered by query usually.
        // For this board, we want ALL statuses for the selected TYPE.
        const type = activeTab === 'contractor' ? '협력사' : '건설사';
        const data = await companyService.getCompaniesByType(type);
        setCompanies(data);
    };

    // Group by status
    const columns: Record<string, ColumnData> = {
        active: { id: 'active', title: '거래중 (Active)', items: companies.filter(c => c.status === 'active') },
        inactive: { id: 'inactive', title: '거래중지 (Inactive)', items: companies.filter(c => c.status === 'inactive') },
        archived: { id: 'archived', title: '폐업/삭제 (Archived)', items: companies.filter(c => c.status === 'archived') },
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find source and destination containers
        const findContainer = (id: string): string | undefined => {
            if (id in columns) return id;
            return Object.keys(columns).find(key =>
                columns[key].items.find(item => item.id === id)
            );
        };

        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        // Optimistic UI Update
        const company = companies.find(c => c.id === activeId);
        if (company) {
            const newStatus = overContainer as 'active' | 'inactive' | 'archived';
            setCompanies(prev => prev.map(c =>
                c.id === activeId ? { ...c, status: newStatus } : c
            ));

            // API Update
            try {
                await companyService.updateCompany(activeId, { status: newStatus });
            } catch (error) {
                console.error("Failed to update status", error);
                // Revert on failure (omitted for brevity, but recommended)
                fetchCompanies();
            }
        }
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: { opacity: '0.5' },
            },
        }),
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-[1920px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBuilding} className="text-blue-600" />
                    회사 배정 (상태 관리)
                </h1>

                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('contractor')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'contractor'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faHardHat} />
                        시공사 (지원팀)
                    </button>
                    <button
                        onClick={() => setActiveTab('client')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'client'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faBriefcase} />
                        건설사 (발주사)
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
                    <Column {...columns.active} />
                    <Column {...columns.inactive} />
                    <Column {...columns.archived} />
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? (
                        <div className="bg-white p-4 rounded-lg shadow-lg border border-blue-200 opacity-90 rotate-3 scale-105">
                            {(() => {
                                const company = companies.find(c => c.id === activeId);
                                return company ? (
                                    <>
                                        <div className="font-bold text-slate-800 mb-1">{company.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <FontAwesomeIcon icon={faUserTie} />
                                            {company.ceoName}
                                        </div>
                                    </>
                                ) : null;
                            })()}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default CompanyAssignmentPage;
