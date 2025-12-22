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
import { faBuilding, faCalendarAlt, faMapMarkerAlt, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';

// --- Types ---
type SiteStatus = 'planned' | 'active' | 'completed';

interface ColumnData {
    id: SiteStatus;
    title: string;
    items: Site[];
}

// --- Sortable Item Component ---
interface SortableItemProps {
    site: Site;
}

const SortableItem: React.FC<SortableItemProps> = ({ site }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: site.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-3 cursor-grab hover:shadow-md transition-shadow"
        >
            <div className="font-bold text-slate-800 mb-1">{site.name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                {site.address}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
                <FontAwesomeIcon icon={faCalendarAlt} />
                {site.startDate} ~ {site.endDate}
            </div>
            {site.responsibleTeamName && (
                <div className="mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                    담당: {site.responsibleTeamName}
                </div>
            )}
        </div>
    );
};

// --- Column Component ---
interface ColumnProps {
    column: ColumnData;
}

const Column: React.FC<ColumnProps> = ({ column }) => {
    const { setNodeRef } = useSortable({
        id: column.id,
        data: {
            type: 'Column',
            column,
        },
    });

    return (
        <div className="flex flex-col h-full bg-slate-100 rounded-xl p-4 min-w-[300px]">
            <h3 className={`font-bold text-lg mb-4 flex items-center justify-between ${column.id === 'planned' ? 'text-slate-600' :
                column.id === 'active' ? 'text-blue-600' : 'text-green-600'
                }`}>
                {column.title}
                <span className="bg-white px-2 py-0.5 rounded-full text-sm shadow-sm border border-slate-200">
                    {column.items.length}
                </span>
            </h3>
            <div ref={setNodeRef} className="flex-1 overflow-y-auto min-h-[100px]">
                <SortableContext items={column.items.map(i => i.id!)} strategy={verticalListSortingStrategy}>
                    {column.items.map((site) => (
                        <SortableItem key={site.id} site={site} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const SiteAssignmentPage: React.FC = () => {
    const [columns, setColumns] = useState<Record<SiteStatus, ColumnData>>({
        planned: { id: 'planned', title: '예정된 현장', items: [] },
        active: { id: 'active', title: '진행중인 현장', items: [] },
        completed: { id: 'completed', title: '마감된 현장', items: [] },
    });
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        try {
            const sites = await siteService.getSites();
            const newColumns: Record<SiteStatus, ColumnData> = {
                planned: { id: 'planned', title: '예정된 현장', items: [] },
                active: { id: 'active', title: '진행중인 현장', items: [] },
                completed: { id: 'completed', title: '마감된 현장', items: [] },
            };

            sites.forEach(site => {
                if (newColumns[site.status]) {
                    newColumns[site.status].items.push(site);
                } else {
                    // Fallback for unknown status
                    newColumns['planned'].items.push(site);
                }
            });

            setColumns(newColumns);
        } catch (error) {
            console.error("Failed to fetch sites", error);
        }
    };

    const findContainer = (id: string): SiteStatus | undefined => {
        if (id in columns) return id as SiteStatus;
        return (Object.keys(columns) as SiteStatus[]).find(key =>
            columns[key].items.find(item => item.id === id)
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setColumns((prev) => {
            const activeItems = prev[activeContainer].items;
            const overItems = prev[overContainer].items;
            const activeIndex = activeItems.findIndex((item) => item.id === active.id);
            const overIndex = overItems.findIndex((item) => item.id === overId);

            let newIndex;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: {
                    ...prev[activeContainer],
                    items: [
                        ...prev[activeContainer].items.filter((item) => item.id !== active.id),
                    ],
                },
                [overContainer]: {
                    ...prev[overContainer],
                    items: [
                        ...prev[overContainer].items.slice(0, newIndex),
                        activeItems[activeIndex],
                        ...prev[overContainer].items.slice(newIndex, prev[overContainer].items.length),
                    ],
                },
            };
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over?.id as string);

        if (
            !activeContainer ||
            !overContainer ||
            (activeContainer === overContainer && active.id === over?.id)
        ) {
            setActiveId(null);
            return;
        }

        // Update local state for reordering within same column
        if (activeContainer === overContainer) {
            const activeIndex = columns[activeContainer].items.findIndex(i => i.id === active.id);
            const overIndex = columns[overContainer].items.findIndex(i => i.id === over?.id);

            if (activeIndex !== overIndex) {
                setColumns((prev) => ({
                    ...prev,
                    [activeContainer]: {
                        ...prev[activeContainer],
                        items: arrayMove(prev[activeContainer].items, activeIndex, overIndex),
                    },
                }));
            }
        } else {
            // Moved to different column -> Update Status in Firestore
            // Note: handleDragOver already updated the UI optimistically.
            // We just need to persist the change.
            const item = columns[overContainer].items.find(i => i.id === active.id);

            // If item is not found in overContainer, it might be because handleDragOver didn't fire correctly or state wasn't updated yet.
            // However, with dnd-kit, handleDragOver handles the visual move.
            // Let's ensure we find the item even if it's still conceptually in the old container for the logic, 
            // but visually it should be in the new one.

            // Actually, in dnd-kit with sortable, handleDragOver moves the item in the state.
            // So at DragEnd, the item IS in the overContainer in our state.

            if (item) {
                try {
                    await siteService.updateSite(item.id!, { status: overContainer });
                    console.log(`Updated site ${item.name} status to ${overContainer}`);
                } catch (error) {
                    console.error("Failed to update site status", error);
                    alert("상태 업데이트에 실패했습니다.");
                    fetchSites(); // Revert on failure
                }
            } else {
                // Fallback: If for some reason the item isn't in the new container yet (rare race condition or logic error),
                // we try to find it in the old container and move it manually.
                const oldItem = columns[activeContainer].items.find(i => i.id === active.id);
                if (oldItem) {
                    try {
                        await siteService.updateSite(oldItem.id!, { status: overContainer });
                        // Manually update state to reflect the move if handleDragOver didn't
                        setColumns(prev => ({
                            ...prev,
                            [activeContainer]: {
                                ...prev[activeContainer],
                                items: prev[activeContainer].items.filter(i => i.id !== active.id)
                            },
                            [overContainer]: {
                                ...prev[overContainer],
                                items: [...prev[overContainer].items, oldItem]
                            }
                        }));
                    } catch (error) {
                        console.error("Failed to update site status (fallback)", error);
                    }
                }
            }
        }

        setActiveId(null);
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    return (
        <div className="p-6 h-full flex flex-col max-w-[1600px] mx-auto">
            <div className="mb-6">
                <button
                    onClick={() => window.history.back()}
                    className="mb-4 px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    뒤로 가기
                </button>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBuilding} className="text-blue-600" />
                    현장 배정 관리 (Kanban)
                </h1>
                <p className="text-slate-600 mt-2">
                    현장 상태를 드래그 앤 드롭으로 관리하세요.
                </p>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                    <Column column={columns.planned} />
                    <Column column={columns.active} />
                    <Column column={columns.completed} />
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? (
                        <div className="bg-white p-4 rounded-lg shadow-lg border border-blue-200 opacity-90 rotate-3 cursor-grabbing">
                            {/* Find the item to render overlay */}
                            {(() => {
                                const container = findContainer(activeId);
                                const item = container ? columns[container].items.find(i => i.id === activeId) : null;
                                return item ? (
                                    <>
                                        <div className="font-bold text-slate-800 mb-1">{item.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                                            <FontAwesomeIcon icon={faMapMarkerAlt} />
                                            {item.address}
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

export default SiteAssignmentPage;
