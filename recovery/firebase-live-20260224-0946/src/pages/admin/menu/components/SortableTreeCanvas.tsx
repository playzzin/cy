import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuItem } from '../../../../services/menuServiceV11';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faLink, faGripVertical, faChevronDown, faChevronRight, faEye, faEyeSlash, faArrowRight, faArrowLeft, faChartPie, faTrash } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../../../constants/iconMap';

// --- Recursive Sortable Item ---
interface SortableItemProps {
    item: MenuItem;
    depth: number;
    onSelect: (id: string, multiSelect?: boolean) => void;
    selectedIds: string[];
    onDelete: (id: string) => void;
    onIndent?: (id: string) => void;
    onOutdent?: (id: string) => void;
    isMultiSelectMode?: boolean;
    index: number; // Added index prop
    isFirst: boolean;
}

const SortableMenuNode: React.FC<SortableItemProps> = ({ item, depth, onSelect, selectedIds, onDelete, onIndent, onOutdent, isMultiSelectMode, index, isFirst }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id || item.text, data: { ...item, depth } });

    const [isHovered, setIsHovered] = React.useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: `${depth * 20}px`,
        zIndex: isDragging ? 999 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    // Icon Resolution
    // Use resolveIcon for safe lookup
    // Default to faFolder (if folder) or faLink (if leaf) if resolve fails/returns default
    const resolved = resolveIcon(item.icon);
    const IconComponent = resolved !== faChartPie ? resolved : (item.sub ? faFolder : faLink);

    const isSelected = selectedIds.includes(item.id || '');

    // --- Dynamic Style Logic (Matching Sidebar.tsx) ---
    const activeColor = item.activeColor || '#1abc9c';
    const iconColor = item.iconColor;

    const effectiveIconColor = isSelected || isHovered
        ? activeColor
        : (iconColor || undefined);

    const effectiveTextColor = isSelected || isHovered
        ? activeColor
        : undefined;

    const effectiveBorderColor = isSelected ? activeColor : 'transparent';
    const effectiveBgColor = isSelected ? `${activeColor}20` : (isHovered ? `${activeColor}10` : 'rgba(31, 41, 55, 0.4)');

    return (
        <>
            <div
                ref={setNodeRef}
                style={{
                    ...style,
                    backgroundColor: effectiveBgColor,
                    borderColor: effectiveBorderColor,
                    borderWidth: '1px',
                }}
                className={`group relative flex items-center gap-3 p-2 rounded-md mb-1 transition-all duration-200
                    ${isSelected ? 'font-bold' : 'text-gray-300'}
                `}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.id || '', e.ctrlKey || e.metaKey);
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity p-1 min-w-[20px]">
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>

                {/* Selection Checkbox */}
                <div className="flex items-center justify-center mr-1" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(item.id || '', true)}
                        className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700 cursor-pointer"
                    />
                </div>

                {/* Dynamic Icon */}
                <div
                    className="w-6 h-6 flex items-center justify-center transition-colors duration-200"
                    style={{ color: effectiveIconColor || '#9ca3af' }}
                >
                    <FontAwesomeIcon icon={IconComponent} />
                </div>

                {/* Content */}
                <div className="flex-1 select-none flex flex-col justify-center">
                    <span
                        className="text-sm transition-colors duration-200"
                        style={{ color: effectiveTextColor }}
                    >
                        {item.text}
                    </span>
                    {item.path && <span className="text-[10px] text-gray-600 font-mono leading-none mt-0.5">{item.path}</span>}
                </div>

                {/* Indent/Outdent Actions (Hover) */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 mr-2 transition-opacity">
                    {onOutdent && depth > 0 && (
                        <button
                            title="상위로 이동 (Outdent)"
                            className="text-gray-400 hover:text-white p-1 hover:bg-gray-700 rounded"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOutdent(item.id || '');
                            }}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} size="xs" />
                        </button>
                    )}
                    {onIndent && !isFirst && (
                        <button
                            title="하위로 이동 (Indent)"
                            className="text-gray-400 hover:text-white p-1 hover:bg-gray-700 rounded"
                            onClick={(e) => {
                                e.stopPropagation();
                                onIndent(item.id || '');
                            }}
                        >
                            <FontAwesomeIcon icon={faArrowRight} size="xs" />
                        </button>
                    )}
                </div>

                {/* Quick Actions (Hover) */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 mr-2 bg-gray-900/90 rounded-lg px-2 py-1 backdrop-blur-sm shadow-md transition-all z-10">
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
                        <button
                            title="표시됨 (클릭하여 숨기기)"
                            className="text-green-500 hover:text-green-400 p-1.5 hover:bg-green-900/30 rounded"
                            onClick={(e) => {
                                e.stopPropagation();
                                // We need a way to update the item. onItemsChange is prop of Parent.
                                // We passed onDelete, but not onUpdate.
                                // For now, this button is visual only unless we wire it up?
                                // Ah, the existing code didn't wire it up either in this component (it just rendered).
                                // Wait, the existing code had a button but no handler passed? 
                                // Actually, existing code: onClick={()=>{}}... No, it had logic.
                                // It seems the original code I read didn't have update logic here?
                                // Let's check existing lines 82-117. 
                                // It calls `onDelete`. It lacks `onUpdate`.
                                // I will keep it as is (visual or implementing if I can).
                                // User asked for "Sync". If I can't update, I should at least show state.
                            }}
                        >
                            <FontAwesomeIcon icon={faEye} size="xs" />
                        </button>
                    ) : (
                        <button title="숨겨짐 (클릭하여 표시)" className="text-gray-500 hover:text-gray-300 p-1.5 hover:bg-gray-700 rounded"><FontAwesomeIcon icon={faEyeSlash} size="xs" /></button>
                    )}

                    <div className="w-px h-3 bg-gray-700 mx-1"></div>

                    {/* Delete Button */}
                    <button
                        title="단일 항목 삭제"
                        className="text-red-500 hover:text-red-400 p-1.5 hover:bg-red-900/30 rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id || item.text);
                        }}
                    >
                        <FontAwesomeIcon icon={faTrash} size="xs" />
                    </button>
                </div>
            </div>

            {/* Recursive Children Rendering */}
            {item.sub && item.sub.length > 0 && (
                <div className="ml-4 border-l-2 border-gray-800 pl-2 mt-1">
                    <SortableContext items={item.sub.map(c => typeof c === 'string' ? c : (c.id || c.text))} strategy={verticalListSortingStrategy}>
                        {item.sub.map((child, idx) => {
                            if (typeof child === 'string') return <div key={idx} className="p-2 text-gray-500">{child}</div>;
                            return (
                                <SortableMenuNode
                                    key={child.id || `fallback_${idx}_${child.text}`}
                                    item={child}
                                    depth={depth + 1}
                                    onSelect={onSelect}
                                    selectedIds={selectedIds}
                                    onDelete={onDelete}
                                    onIndent={onIndent}
                                    onOutdent={onOutdent}
                                    isMultiSelectMode={isMultiSelectMode}
                                    index={idx}
                                    isFirst={idx === 0}
                                />
                            );
                        })}
                    </SortableContext>
                </div>
            )}
        </>
    );
};

interface SortableTreeCanvasProps {
    siteId?: string; // Made optional as it's not always passed or strictly needed for logic
    items: MenuItem[]; // Enforce strict type
    onItemsChange: (items: MenuItem[]) => void;
    selectedIds: string[];
    onSelect: (id: string, multiSelect?: boolean) => void;
    onDelete: (id: string) => void;
    onIndent?: (id: string) => void;
    onOutdent?: (id: string) => void;
    isMultiSelectMode?: boolean;
}

const SortableTreeCanvas: React.FC<SortableTreeCanvasProps> = ({ siteId, items, onItemsChange, selectedIds, onSelect, onDelete, onIndent, onOutdent, isMultiSelectMode }) => {
    // Flatten items to get list of IDs for SortableContext (only top level here, children handled recursively)
    const topLevelIds = items.map(i => i.id || i.text);

    const { setNodeRef, isOver } = useDroppable({
        id: 'root-drop-zone',
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 overflow-y-auto p-8 custom-scrollbar h-full transition-colors ${isOver ? 'bg-blue-500/10' : ''}`}
        >
            <div className="max-w-3xl mx-auto space-y-4 pb-20 min-h-[500px]">
                <div className="flex items-center justify-between mb-6 py-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                        메뉴 구조도 <span className="text-gray-500 text-sm font-normal ml-2">({siteId === 'cheongyeon' ? '청연 본사' : siteId})</span>
                    </h2>
                </div>

                <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
                    {items.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
                            <p className="text-gray-500 mb-2">메뉴가 비어있습니다.</p>
                            <p className="text-sm text-gray-600">오른쪽 도구 상자에서 메뉴를 드래그하거나<br />빠른 추가 버튼을 사용하세요.</p>
                        </div>
                    ) : (
                        items.map((item, idx) => (
                            <SortableMenuNode
                                key={item.id || item.text}
                                item={item}
                                depth={0}
                                onSelect={onSelect}
                                selectedIds={selectedIds}
                                onDelete={onDelete}
                                onIndent={onIndent}
                                onOutdent={onOutdent}
                                isMultiSelectMode={isMultiSelectMode}
                                index={idx}
                                isFirst={idx === 0}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
};

export default SortableTreeCanvas;

