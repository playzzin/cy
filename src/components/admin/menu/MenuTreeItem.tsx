import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGripVertical, faChevronRight, faChevronDown, faFolder, faFile,
    faArrowUp, faArrowDown, faArrowLeft, faArrowRight, faCog, faTrash
} from '@fortawesome/free-solid-svg-icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuItem } from '../../../types/menu';
import { getIcon } from '../../../utils/iconMapper';

export interface MenuTreeItemProps {
    id: string;
    item: MenuItem;
    depth: number;
    onRemove: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onSettingsClick: (item: MenuItem) => void;
    onToggleCollapse: (id: string) => void;
    isCollapsed: boolean;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onMoveToParent: (id: string) => void;
    onMoveToChild: (id: string) => void;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
}

export const MenuTreeItem: React.FC<MenuTreeItemProps> = ({
    id,
    item,
    depth,
    onRemove,
    onRename,
    onSettingsClick,
    onToggleCollapse,
    isCollapsed,
    onMoveUp,
    onMoveDown,
    onMoveToParent,
    onMoveToChild,
    isSelected,
    onSelect
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver
    } = useSortable({ id });

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.text);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        marginLeft: `${depth * 24}px`
    };

    const handleDoubleClick = () => {
        setIsEditing(true);
        setEditValue(item.text);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (editValue.trim() && editValue !== item.text) {
            onRename(id, editValue.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(item.text);
        }
    };

    const hasChildren = item.sub && item.sub.length > 0;
    const isFolder = hasChildren || !item.path;

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelect(id)}
            className={`
                group relative cursor-pointer
                ${isDragging ? 'opacity-50 z-50' : ''}
                ${isOver ? 'ring-2 ring-indigo-500 ring-offset-2 rounded-lg' : ''}
            `}
        >
            <div
                className={`
                    flex items-center gap-2 p-2.5 rounded-lg border transition-all
                    ${isDragging
                        ? 'bg-indigo-50 border-indigo-300 shadow-lg'
                        : isSelected
                            ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                    }
                `}
            >
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500 p-1"
                >
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>

                {/* Collapse Toggle */}
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapse(id);
                        }}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
                    >
                        <FontAwesomeIcon
                            icon={isCollapsed ? faChevronRight : faChevronDown}
                            size="xs"
                        />
                    </button>
                ) : (
                    <div className="w-5 h-5" />
                )}

                {/* Icon */}
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${isFolder ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
                    <FontAwesomeIcon
                        icon={item.icon ? getIcon(item.icon) : (isFolder ? faFolder : faFile)}
                        size="sm"
                    />
                </div>

                {/* Text */}
                {isEditing ? (
                    <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                ) : (
                    <span
                        onDoubleClick={handleDoubleClick}
                        className="flex-1 font-medium text-slate-700 text-sm cursor-text"
                    >
                        {item.text}
                    </span>
                )}

                {/* Path Badge */}
                {item.path && (
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded hidden lg:block">
                        {item.path}
                    </span>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveUp(id); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="위로 이동"
                    >
                        <FontAwesomeIcon icon={faArrowUp} size="xs" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveDown(id); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="아래로 이동"
                    >
                        <FontAwesomeIcon icon={faArrowDown} size="xs" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveToParent(id); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="상위로 이동"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} size="xs" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveToChild(id); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="하위로 이동"
                    >
                        <FontAwesomeIcon icon={faArrowRight} size="xs" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSettingsClick(item); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="설정"
                    >
                        <FontAwesomeIcon icon={faCog} size="xs" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(id); }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                        title="삭제"
                    >
                        <FontAwesomeIcon icon={faTrash} size="xs" />
                    </button>
                </div>
            </div>
        </div>
    );
};
