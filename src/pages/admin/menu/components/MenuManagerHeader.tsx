import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGlobe,
    faUsers,
    faPlus,
    faCog
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
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SiteDataType, PositionItem } from '../../../../types/menu';

interface MenuManagerHeaderProps {
    menuData: SiteDataType;
    selectedSite: string;
    onSelectSite: (siteKey: string) => void;
    onUpdateMenuData: (newData: SiteDataType) => void;
    onOpenSiteManager: () => void;
    onOpenRoleManager: () => void;
}

interface SortableTabProps {
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
    color?: string;
}

const SortableTab = ({ id, label, isActive, onClick, color = 'bg-slate-700' }: SortableTabProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all min-w-[100px] text-center border-t border-l border-r border-transparent
                ${isActive
                    ? 'bg-slate-800 text-blue-400 border-slate-600 border-b-slate-800 z-10'  // Active: connects to content below
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-b-slate-700'
                } relative`}
        >
            {label}
            {isActive && <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-slate-800" />}
        </button>
    );
};

// specialized style for pills (Roles)
const SortablePill = ({ id, label, isActive, onClick, color = 'bg-slate-700' }: SortableTabProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border
                ${isActive
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                }`}
        >
            {label}
        </button>
    );
};

const MenuManagerHeader: React.FC<MenuManagerHeaderProps> = ({
    menuData,
    selectedSite,
    onSelectSite,
    onUpdateMenuData,
    onOpenSiteManager,
    onOpenRoleManager
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    // Prepare Lists
    const sites = Object.keys(menuData)
        .filter(key => !key.startsWith('pos_'))
        .sort((a, b) => (menuData[a].order || 999) - (menuData[b].order || 999))
        .map(key => ({ id: key, name: menuData[key].name }));

    const roles = (menuData.admin?.positionConfig || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(pos => ({ id: pos.id, name: pos.name, fullId: pos.id === 'full' ? 'admin' : (pos.id.startsWith('pos_') ? pos.id : `pos_${pos.id}`) }));

    // Handlers
    const handleDragEndSites = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = sites.findIndex(s => s.id === active.id);
            const newIndex = sites.findIndex(s => s.id === over.id);
            // We need to reorder the *keys* in menuData basically effectively by updating 'order' prop
            // Actually better to just update 'order' prop on all items based on new sequence
            const newOrder = [...sites];
            const movedItem = newOrder.splice(oldIndex, 1)[0];
            newOrder.splice(newIndex, 0, movedItem);

            const newData = { ...menuData };
            newOrder.forEach((site, index) => {
                if (newData[site.id]) newData[site.id].order = index;
            });
            onUpdateMenuData(newData);
        }
    };

    const handleDragEndRoles = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const config = [...(menuData.admin?.positionConfig || [])];
            // Sort first to match display
            config.sort((a, b) => (a.order || 0) - (b.order || 0));

            const oldIndex = config.findIndex(p => p.id === active.id);
            const newIndex = config.findIndex(p => p.id === over.id);

            const newConfig = arrayMove(config, oldIndex, newIndex);
            // Update order
            const finalConfig = newConfig.map((item, index) => ({ ...item, order: index }));

            const newData = { ...menuData };
            if (!newData.admin) newData.admin = { name: 'Admin', icon: 'fa-cog', menu: [] };
            newData.admin.positionConfig = finalConfig;

            onUpdateMenuData(newData);
        }
    };

    return (
        <div className="flex flex-col bg-slate-900 border-b border-slate-700">
            {/* Top Row: Sites */}
            <div className="flex items-center px-4 pt-2 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 mr-4 text-indigo-400 font-bold text-sm">
                    <FontAwesomeIcon icon={faGlobe} />
                    <span>사이트</span>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar flex items-end">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSites}>
                        <SortableContext items={sites.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                            {sites.map(site => (
                                <SortableTab
                                    key={site.id}
                                    id={site.id}
                                    label={site.name}
                                    isActive={selectedSite === site.id}
                                    onClick={() => onSelectSite(site.id)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                <button
                    onClick={onOpenSiteManager}
                    className="ml-2 p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                    title="사이트 관리"
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
            </div>

            {/* Bottom Row: Roles */}
            <div className="flex items-center px-4 py-2 bg-slate-800">
                <div className="flex items-center gap-2 mr-4 text-blue-400 font-bold text-sm">
                    <FontAwesomeIcon icon={faUsers} />
                    <span>직책</span>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar flex items-center gap-2">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndRoles}>
                        <SortableContext items={roles.map(r => r.id)} strategy={horizontalListSortingStrategy}>
                            {roles.map(role => {
                                // Determine if active: 
                                // Logic: if selectedSite matches 'pos_' + id OR if id='full' and selectedSite='admin' (ambiguous)
                                // Actually, RoleManager saves 'pos_' sites. 
                                // Let's try to match exact siteKey.
                                const targetSite = role.id === 'full' ? 'admin' : (role.id.startsWith('pos_') ? role.id : `pos_${role.id}`);
                                return (
                                    <SortablePill
                                        key={role.id}
                                        id={role.id}
                                        label={role.name}
                                        isActive={selectedSite === targetSite}
                                        onClick={() => onSelectSite(targetSite)}
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                </div>

                <button
                    onClick={onOpenRoleManager}
                    className="ml-2 p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                    title="직책 관리"
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
            </div>
        </div>
    );
};

export default MenuManagerHeader;
