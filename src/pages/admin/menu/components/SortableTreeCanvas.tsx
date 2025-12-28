import React, { useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuItem } from '../../../../services/menuServiceV11';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faLink, faGripVertical, faChevronDown, faChevronRight, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import * as FaIcons from '@fortawesome/free-solid-svg-icons';

// --- Recursive Sortable Item ---
interface SortableItemProps {
    item: MenuItem;
    depth: number;
    onSelect: (id: string) => void;
    selectedId: string | null;
    onDelete: (id: string) => void;
}

const SortableMenuNode: React.FC<SortableItemProps> = ({ item, depth, onSelect, selectedId, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id || item.text, data: { ...item, depth } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: `${depth * 20}px`, // Visual Indentation
        zIndex: isDragging ? 999 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    const IconComponent = (FaIcons as any)[item.icon || 'faLink'] || (item.sub ? faFolder : faLink);

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                className={`group relative flex items-center gap-3 p-2 rounded-md mb-1 transition-colors border
          ${selectedId === item.id
                        ? 'bg-blue-900/40 border-blue-500/50 text-white'
                        : 'bg-gray-800/40 border-transparent hover:bg-gray-800 hover:border-gray-700 text-gray-300'
                    }
        `}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.id || '');
                }}
            >
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity p-1">
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>

                {/* Dynamic Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner ${item.sub ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>
                    <FontAwesomeIcon icon={IconComponent} />
                </div>

                {/* Content */}
                <div className="flex-1 select-none flex flex-col">
                    <span className="font-medium text-sm text-gray-200">{item.text}</span>
                    {item.path && <span className="text-[10px] text-gray-500 font-mono mt-0.5">{item.path}</span>}
                </div>

                {/* Quick Actions (Hover) */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 mr-2 bg-gray-900/80 rounded-lg px-2 py-1 backdrop-blur-sm shadow-md transition-all">
                    {/* Preview Button */}
                    {item.path && (
                        <button
                            title="새 창에서 미리보기"
                            className="text-blue-400 hover:text-blue-300 p-1.5 hover:bg-blue-900/30 rounded"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.path, '_blank');
                            }}
                        >
                            <FontAwesomeIcon icon={faLink} size="xs" />
                        </button>
                    )}

                    {/* Visibility Button */}
                    {!item.hide ? (
                        <button title="표시됨 (클릭하여 숨기기)" className="text-green-500 hover:text-green-400 p-1.5 hover:bg-green-900/30 rounded"><FontAwesomeIcon icon={faEye} size="xs" /></button>
                    ) : (
                        <button title="숨겨짐 (클릭하여 표시)" className="text-gray-500 hover:text-gray-300 p-1.5 hover:bg-gray-700 rounded"><FontAwesomeIcon icon={faEyeSlash} size="xs" /></button>
                    )}

                    <div className="w-px h-3 bg-gray-700 mx-1"></div>

                    {/* Delete Button */}
                    <button
                        title="삭제 (하위 메뉴 포함)"
                        className="text-red-500 hover:text-red-400 p-1.5 hover:bg-red-900/30 rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id || item.text); // Use text as fallback ID
                        }}
                    >
                        <FontAwesomeIcon icon={FaIcons.faTrash} size="xs" />
                    </button>
                </div>
            </div>

            {/* Recursive Children Rendering */}
            {item.sub && item.sub.length > 0 && (
                <div className="ml-2 border-l border-gray-700/50 pl-2">
                    <SortableContext items={item.sub.map(c => typeof c === 'string' ? c : (c.id || c.text))} strategy={verticalListSortingStrategy}>
                        {item.sub.map((child, idx) => {
                            if (typeof child === 'string') return <div key={idx} className="p-2 text-gray-500">{child}</div>;
                            return <SortableMenuNode key={child.id || child.text} item={child} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} onDelete={onDelete} />;
                        })}
                    </SortableContext>
                </div>
            )}
        </>
    );
};

interface SortableTreeCanvasProps {
    siteId: string;
    items: MenuItem[]; // Enforce strict type
    onItemsChange: (items: MenuItem[]) => void;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}

const SortableTreeCanvas: React.FC<SortableTreeCanvasProps> = ({ siteId, items, onItemsChange, selectedId, onSelect, onDelete }) => {
    // Flatten items to get list of IDs for SortableContext (only top level here, children handled recursively)
    const topLevelIds = items.map(i => i.id || i.text);

    return (
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar h-full">
            <div className="max-w-3xl mx-auto space-y-4 pb-20">
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-gray-900/95 backdrop-blur z-10 py-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                        메뉴 구조도 <span className="text-gray-500 text-sm font-normal ml-2">({siteId === 'cheongyeon' ? '청연 본사' : siteId})</span>
                    </h2>
                </div>

                <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
                    {items.map((item) => (
                        <SortableMenuNode
                            key={item.id || item.text}
                            item={item}
                            depth={0}
                            onSelect={onSelect}
                            selectedId={selectedId}
                            onDelete={onDelete}
                        />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};

export default SortableTreeCanvas;
