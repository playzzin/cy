import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faPlus,
    faTrash,
    faSave,
    faGripVertical,
    faPalette
} from '@fortawesome/free-solid-svg-icons';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SiteDataType, PositionItem } from '../../../../types/menu';

interface RoleManagerProps {
    isOpen: boolean;
    onClose: () => void;
    menuData: SiteDataType;
    onUpdate: (newData: SiteDataType) => void;
}

const SortablePositionItem = ({
    item,
    onDelete,
    onEdit
}: {
    item: PositionItem;
    onDelete: (id: string) => void;
    onEdit: (id: string, field: keyof PositionItem, value: any) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    const getIconName = (iconClass: string) => iconClass.replace('fa-', '');

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 mb-2 group"
        >
            <button
                {...attributes}
                {...listeners}
                className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1"
            >
                <FontAwesomeIcon icon={faGripVertical} />
            </button>

            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm`}>
                {/* @ts-ignore */}
                <FontAwesomeIcon icon={['fas', getIconName(item.icon)]} className="text-white text-xs" />
            </div>

            <div className="flex-1 grid grid-cols-12 gap-2">
                {/* Name Input */}
                <div className="col-span-4">
                    <input
                        type="text"
                        value={item.name}
                        onChange={(e) => onEdit(item.id, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                        placeholder="직책명"
                    />
                </div>
                {/* ID Input (Read-only if exists, or editable?) let's make it readonly for stability except new ones? No, user might want to change ID but that breaks map. ID should be immutable ideally. */}
                <div className="col-span-3">
                    <span className="text-xs text-slate-500 font-mono flex items-center h-full px-2">
                        {item.id}
                    </span>
                </div>
                {/* Icon Input */}
                <div className="col-span-2">
                    <input
                        type="text"
                        value={getIconName(item.icon)}
                        onChange={(e) => onEdit(item.id, 'icon', `fa-${e.target.value.replace('fa-', '')}`)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blue-500 outline-none"
                        placeholder="Icon"
                    />
                </div>
                {/* Color Input (Tailwind classes) */}
                <div className="col-span-3 relative">
                    <input
                        type="text"
                        value={item.color}
                        onChange={(e) => onEdit(item.id, 'color', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blue-500 outline-none"
                        placeholder="Color classes"
                    />
                </div>
            </div>

            <button
                onClick={() => onDelete(item.id)}
                className="text-slate-500 hover:text-red-400 p-2 transition-colors opacity-0 group-hover:opacity-100"
                title="삭제"
            >
                <FontAwesomeIcon icon={faTrash} />
            </button>
        </div>
    );
};


const RoleManager: React.FC<RoleManagerProps> = ({
    isOpen,
    onClose,
    menuData,
    onUpdate
}) => {
    const [positions, setPositions] = useState<PositionItem[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    // Load initial positions
    React.useEffect(() => {
        if (menuData.admin?.positionConfig) {
            // Sort by order
            const sorted = [...menuData.admin.positionConfig].sort((a, b) => (a.order || 0) - (b.order || 0));
            setPositions(sorted);
        }
    }, [menuData]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPositions((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Update 'order' property
                return newOrder.map((item, index) => ({ ...item, order: index }));
            });
            setIsDirty(true);
        }
    };

    const handleAdd = () => {
        const id = prompt('새 직책의 ID를 입력하세요 (예: intern)');
        if (!id) return;

        // Prevent duplicate IDs
        if (positions.some(p => p.id === id)) {
            alert('이미 존재하는 ID입니다.');
            return;
        }

        const newPos: PositionItem = {
            id,
            name: '새 직책',
            icon: 'fa-user',
            color: 'from-gray-600 to-gray-400',
            order: positions.length
        };

        setPositions([...positions, newPos]);
        setIsDirty(true);
    };

    const handleDelete = (id: string) => {
        if (id === 'full') {
            alert('전체 메뉴는 삭제할 수 없습니다.');
            return;
        }
        if (window.confirm('정말 삭제하시겠습니까? 해당 직책의 메뉴 데이터도 함께 삭제됩니다.')) {
            setPositions(positions.filter(p => p.id !== id));
            setIsDirty(true);
        }
    };

    const handleEdit = (id: string, field: keyof PositionItem, value: any) => {
        setPositions(positions.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
        setIsDirty(true);
    };

    const handleSave = () => {
        // Deep clone menuData
        const newData = JSON.parse(JSON.stringify(menuData));

        // Update positionConfig in admin
        if (!newData.admin) newData.admin = { name: 'Admin', icon: 'fa-cog', menu: [] };
        newData.admin.positionConfig = positions;

        // Ensure corresponding sites exist
        positions.forEach(pos => {
            if (pos.id === 'full') return;
            const siteKey = pos.id.startsWith('pos_') ? pos.id : `pos_${pos.id}`;

            if (!newData[siteKey]) {
                // Initialize new site data
                newData[siteKey] = {
                    name: pos.name,
                    icon: pos.icon,
                    menu: [] // Empty menu by default
                };
            } else {
                // Update name/icon if changed
                newData[siteKey].name = pos.name;
                newData[siteKey].icon = pos.icon;
            }
        });

        // Optional: Clean up deleted sites?
        // If a position was removed, we might want to delete the siteKey?
        // Let's compare with old list.
        const oldPositions = menuData.admin?.positionConfig || [];
        oldPositions.forEach(oldPos => {
            const siteKey = oldPos.id.startsWith('pos_') ? oldPos.id : `pos_${oldPos.id}`;
            // If this ID is no longer in current positions, delete the site data?
            if (!positions.some(p => p.id === oldPos.id) && oldPos.id !== 'full') {
                // Move to deletedItems or just delete from object?
                // Safe delete from object.
                delete newData[siteKey];
            }
        });

        onUpdate(newData);
        setIsDirty(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-slate-900 w-[800px] max-h-[80vh] rounded-2xl shadow-2xl border border-slate-700 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                            <FontAwesomeIcon icon={faPalette} />
                        </div>
                        직책 및 상단 메뉴 관리
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faXmark} className="text-xl" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="mb-4 flex items-center justify-end">
                        <button
                            onClick={handleAdd}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            새 직책 추가
                        </button>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={positions.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {positions.map((pos) => (
                                <SortablePositionItem
                                    key={pos.id}
                                    item={pos}
                                    onDelete={handleDelete}
                                    onEdit={handleEdit}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        변경사항 저장
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoleManager;
