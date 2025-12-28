import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faPlus,
    faTrash,
    faSave,
    faGripVertical,
    faGlobe
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
import { SiteDataType } from '../../../../types/menu';

interface SiteManagerProps {
    isOpen: boolean;
    onClose: () => void;
    menuData: SiteDataType;
    onUpdate: (newData: SiteDataType) => void;
}

interface SiteItem {
    id: string; // key
    name: string;
    icon: string;
    order: number;
}

const SortableSiteItem = ({
    item,
    onDelete,
    onEdit
}: {
    item: SiteItem;
    onDelete: (id: string) => void;
    onEdit: (id: string, field: keyof SiteItem, value: any) => void;
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

            <div className={`w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shadow-sm`}>
                {/* @ts-ignore */}
                <FontAwesomeIcon icon={['fas', getIconName(item.icon)]} className="text-white text-xs" />
            </div>

            <div className="flex-1 grid grid-cols-12 gap-2">
                {/* Name Input */}
                <div className="col-span-5">
                    <input
                        type="text"
                        value={item.name}
                        onChange={(e) => onEdit(item.id, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                        placeholder="사이트명"
                    />
                </div>
                {/* ID Input (Read-only) */}
                <div className="col-span-4">
                    <span className="text-xs text-slate-500 font-mono flex items-center h-full px-2" title="시스템 ID">
                        {item.id}
                    </span>
                </div>
                {/* Icon Input */}
                <div className="col-span-3">
                    <input
                        type="text"
                        value={getIconName(item.icon)}
                        onChange={(e) => onEdit(item.id, 'icon', `fa-${e.target.value.replace('fa-', '')}`)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blue-500 outline-none"
                        placeholder="Icon"
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

const SiteManager: React.FC<SiteManagerProps> = ({
    isOpen,
    onClose,
    menuData,
    onUpdate
}) => {
    const [sites, setSites] = useState<SiteItem[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    // Initialize sites from menuData
    useEffect(() => {
        if (isOpen && menuData) {
            const loadedSites = Object.entries(menuData)
                .filter(([key]) => !key.startsWith('pos_')) // Filter out internal position sites
                .map(([key, data]) => ({
                    id: key,
                    name: data.name,
                    icon: data.icon,
                    order: data.order || 999 // Default to end if no order
                }))
                .sort((a, b) => a.order - b.order);

            setSites(loadedSites);
        }
    }, [isOpen, menuData]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSites((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                // Update order
                return newOrder.map((item, index) => ({ ...item, order: index }));
            });
            setIsDirty(true);
        }
    };

    // Add New Site
    const handleAdd = () => {
        const id = prompt('새 사이트 모드의 ID를 입력하세요 (예: safety, monitor)');
        if (!id) return;

        // Validation
        if (menuData[id] || sites.some(s => s.id === id)) {
            alert('이미 존재하는 ID입니다.');
            return;
        }

        const newSite: SiteItem = {
            id,
            name: '새 사이트',
            icon: 'fa-globe',
            order: sites.length
        };

        setSites([...sites, newSite]);
        setIsDirty(true);
    };

    // Delete Site
    const handleDelete = (id: string) => {
        if (id === 'admin') {
            alert('Admin 사이트는 삭제할 수 없습니다.');
            return;
        }
        if (window.confirm(`'${id}' 사이트 모드를 정말 삭제하시겠습니까? 포함된 모든 메뉴가 삭제됩니다.`)) {
            setSites(sites.filter(s => s.id !== id));
            setIsDirty(true);
        }
    };

    // Edit Site
    const handleEdit = (id: string, field: keyof SiteItem, value: any) => {
        setSites(sites.map(s =>
            s.id === id ? { ...s, [field]: value } : s
        ));
        setIsDirty(true);
    };

    // Save Changes
    const handleSave = () => {
        const newData = JSON.parse(JSON.stringify(menuData));

        // 1. Update/Add sites from 'sites' state
        sites.forEach(site => {
            if (!newData[site.id]) {
                // Create new
                newData[site.id] = {
                    name: site.name,
                    icon: site.icon,
                    menu: [],
                    order: site.order
                };
            } else {
                // Update existing
                newData[site.id].name = site.name;
                newData[site.id].icon = site.icon;
                newData[site.id].order = site.order;
            }
        });

        // 2. Remove deleted sites
        // Identify IDs that were in the filtered list but are not in 'sites' state anymore
        const initialFilteredKeys = Object.keys(menuData).filter(k => !k.startsWith('pos_'));
        initialFilteredKeys.forEach(oldKey => {
            if (!sites.some(s => s.id === oldKey)) {
                delete newData[oldKey];
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
                        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
                            <FontAwesomeIcon icon={faGlobe} />
                        </div>
                        사이트 모드 관리
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faXmark} className="text-xl" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <p className="text-sm text-slate-400 mb-4">
                        상단 우측 패널에서 전환할 수 있는 사이트 모드를 관리합니다. (직책 모드 제외)
                    </p>

                    <div className="mb-4 flex items-center justify-end">
                        <button
                            onClick={handleAdd}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            새 모드 추가
                        </button>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sites.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {sites.map((site) => (
                                <SortableSiteItem
                                    key={site.id}
                                    item={site}
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
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        변경사항 저장
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SiteManager;
