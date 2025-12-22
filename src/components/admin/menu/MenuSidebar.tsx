import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MenuItem } from '../../../types/menu';

interface DraggableAvailableItemProps {
    id: string;
    text: string;
    path?: string;
}

const DraggableAvailableItem: React.FC<DraggableAvailableItemProps> = ({ id, text, path }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `available-${id}`,
        data: {
            type: 'available',
            item: { id, text, path }
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm cursor-grab hover:shadow-md hover:border-indigo-300 transition-all group"
        >
            <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <FontAwesomeIcon icon={faPlus} size="sm" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-700 text-sm">{text}</div>
                {path && <div className="text-[10px] text-slate-400 truncate">{path}</div>}
            </div>
        </div>
    );
};

interface MenuSidebarProps {
    availableItems: MenuItem[];
}

export const MenuSidebar: React.FC<MenuSidebarProps> = ({ availableItems }) => {
    return (
        <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 sticky top-6">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPlus} className="text-indigo-500" />
                    사용 가능 모듈
                </h3>
                <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1 custom-scrollbar">
                    {/* Helper to create generic folders */}
                    <DraggableAvailableItem id="new-folder" text="새 폴더 (그룹)" path="하위 메뉴를 포함할 수 있습니다" />
                    <div className="h-px bg-slate-200 my-3" />
                    {availableItems.map(item => (
                        <DraggableAvailableItem key={item.id} id={item.id!} text={item.text} path={item.path} />
                    ))}
                </div>
            </div>
        </div>
    );
};
