import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuItem } from '../../../../services/menuServiceV11';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faLink, faGripVertical, faEye, faEyeSlash, faArrowRight, faArrowLeft, faChartPie, faTrash } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../../../constants/iconMap';
import { getDividerAppearance, isMenuDivider } from '../../../../utils/menuDivider';
import { getLinkedMenuRef, isLinkedMenuContainer } from '../../../../utils/linkedPositionMenus';

// --- Recursive Sortable Item ---
interface SortableItemProps {
    item: MenuItem;
    depth: number;
    onSelect: (id: string, multiSelect?: boolean) => void;
    selectedIds: string[];
    onDelete: (id: string) => void;
    onIndent?: (id: string) => void;
    onOutdent?: (id: string) => void;
    onToggleVisibility?: (id: string) => void;
    isSourceRoot?: boolean;
    isMultiSelectMode?: boolean;
    index: number; // Added index prop
    isFirst: boolean;
}

const SortableMenuNode: React.FC<SortableItemProps> = ({ item, depth, onSelect, selectedIds, onDelete, onIndent, onOutdent, onToggleVisibility, isSourceRoot, isMultiSelectMode, index, isFirst }) => {
    const isLinkedContainer = isLinkedMenuContainer(item.id);
    const isLinkedGroup = isLinkedContainer && Boolean(getLinkedMenuRef(item.id));
    const [groupOpen, setGroupOpen] = React.useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id || item.text, data: { ...item, depth }, disabled: { draggable: isLinkedContainer } });

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
    const isDivider = isMenuDivider(item);
    const divider = getDividerAppearance(item);
    const rowRef = React.useRef<HTMLDivElement | null>(null);
    React.useEffect(() => {
        if (isDivider && isSelected) rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, [isDivider, isSelected]);

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
                ref={node => { setNodeRef(node); rowRef.current = node; }}
                style={{
                    ...style,
                    backgroundColor: isDivider && !isSelected && !isHovered ? 'transparent' : effectiveBgColor,
                    borderColor: effectiveBorderColor,
                    borderWidth: '1px',
                    ...(isDivider ? { paddingTop: divider.gap, paddingBottom: divider.gap } : {}),
                }}
                data-menu-kind={isDivider ? 'divider' : 'menu'}
                className={`group relative flex items-center gap-3 p-2 rounded-md mb-1 transition-all duration-200
                    ${isSelected ? 'font-bold' : 'text-gray-300'}
                `}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.id || '', e.ctrlKey || e.metaKey);
                    if (isLinkedGroup) setGroupOpen(open => !open);
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Drag Handle */}
                {!isLinkedContainer && <div {...attributes} {...listeners} aria-label={isDivider ? '구분선 순서 이동' : `${item.text} 순서 이동`} className="cursor-grab opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-gray-500 hover:text-white transition-opacity p-1 min-w-[20px]">
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>}

                {/* Selection Checkbox */}
                {!isLinkedContainer && <div className="flex items-center justify-center mr-1" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        aria-label={isDivider ? '구분선 선택' : `${item.text} 선택`}
                        checked={isSelected}
                        onChange={(_e) => onSelect(item.id || '', true)}
                        className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700 cursor-pointer"
                    />
                </div>}
                {isLinkedGroup && <button type="button" aria-expanded={groupOpen} aria-label={`${item.text} 연결 메뉴 ${groupOpen ? '접기' : '펼치기'}`} className="rounded px-2 py-1 text-blue-300">{groupOpen ? '▾' : '▸'}</button>}

                {isDivider ? (
                    <button type="button" aria-label="구분선 설정 열기" className="flex min-w-0 flex-1 items-center gap-3 rounded py-1 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                        <span aria-hidden="true" className="min-w-4 flex-1 border-t border-slate-500/60" style={{ borderTopStyle: divider.lineStyle }} />
                        <span className="shrink-0 text-[11px] font-normal tracking-wide">구분선{item.hide ? ' · 숨김' : ''}</span>
                        <span aria-hidden="true" className="min-w-4 flex-1 border-t border-slate-500/60" style={{ borderTopStyle: divider.lineStyle }} />
                    </button>
                ) : (
                    <>
                        {/* Dynamic Icon */}
                        <div
                            className="w-6 h-6 flex items-center justify-center transition-colors duration-200"
                            style={{ color: effectiveIconColor || '#9ca3af' }}
                        >
                            <FontAwesomeIcon icon={IconComponent} />
                        </div>
                        {isLinkedGroup && <span className="text-xs text-blue-300">원본 연결</span>}

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
                    </>
                )}

                {/* Indent/Outdent Actions (Hover) */}
                {!isLinkedContainer && <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-1 mr-2 transition-opacity">
                    {onOutdent && depth > 0 && !isSourceRoot && (
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
                </div>}

                {/* Quick Actions (Hover) */}
                {!isLinkedContainer && <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-2 mr-2 bg-gray-900/90 rounded-lg px-2 py-1 backdrop-blur-sm shadow-md transition-all z-10">
                    {/* Preview Button */}
                    {!isDivider && item.path && (
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

                    {!isDivider && onToggleVisibility && <button
                        type="button" title={item.hide ? '숨겨짐 (클릭하여 표시)' : '표시됨 (클릭하여 숨기기)'}
                        aria-label={item.text + (item.hide ? ' 표시하기' : ' 숨기기')}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-300"
                        onClick={event => { event.stopPropagation(); onToggleVisibility(item.id || item.text); }}>
                        <FontAwesomeIcon icon={item.hide ? faEyeSlash : faEye} size="xs" />
                    </button>}

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
                </div>}
            </div>

            {/* Recursive Children Rendering */}
            {!isDivider && (!isLinkedGroup || groupOpen) && item.sub && item.sub.length > 0 && (
                <div className="ml-4 border-l-2 border-gray-800 pl-2 mt-1">
                    <SortableContext items={item.sub.map(c => typeof c === 'string' ? c : (c.id || c.text))} strategy={verticalListSortingStrategy}>
                        {item.sub.map((child, idx) => {
                            if (typeof child === 'string' && !isMenuDivider(child)) return <div key={idx} className="p-2 text-gray-500">{child}</div>;
                            const childItem = typeof child === 'string' ? { id: child, text: child } : child;
                            return (
                                <SortableMenuNode
                                    key={childItem.id || `fallback_${idx}_${childItem.text}`}
                                    item={childItem}
                                    depth={depth + 1}
                                    onSelect={onSelect}
                                    selectedIds={selectedIds}
                                    onDelete={onDelete}
                                    onIndent={onIndent}
                                    onOutdent={onOutdent}
                                    onToggleVisibility={onToggleVisibility}
                                    isSourceRoot={isLinkedGroup}
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
    title?: string;
    emptyMessage?: string;
    emptyHint?: React.ReactNode;
    items: MenuItem[]; // Enforce strict type
    onItemsChange: (items: MenuItem[]) => void;
    selectedIds: string[];
    onSelect: (id: string, multiSelect?: boolean) => void;
    onDelete: (id: string) => void;
    onIndent?: (id: string) => void;
    onOutdent?: (id: string) => void;
    onToggleVisibility?: (id: string) => void;
    isMultiSelectMode?: boolean;
    headerActions?: React.ReactNode;
}

const SortableTreeCanvas: React.FC<SortableTreeCanvasProps> = ({ siteId, title, emptyMessage, emptyHint, items, onItemsChange, selectedIds, onSelect, onDelete, onIndent, onOutdent, onToggleVisibility, isMultiSelectMode, headerActions }) => {
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
            <div className="max-w-3xl mx-auto pb-20 min-h-[500px]">
                <div className="mb-6 flex flex-col items-start gap-3 border-b border-gray-800 py-4">
                    <h2 className="flex items-center gap-3 whitespace-nowrap text-lg font-bold text-gray-100">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                        {title || '메뉴 구조'} <span className="text-gray-500 text-sm font-normal ml-2">({siteId === 'cheongyeon' ? '청연 본사' : siteId})</span>
                    </h2>
                    {headerActions && <div className="flex w-full flex-wrap items-center gap-2">{headerActions}</div>}
                </div>

                <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
                    {items.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
                            <p className="text-gray-500 mb-2">{emptyMessage || '메뉴가 비어있습니다.'}</p>
                            <p className="text-sm text-gray-600">{emptyHint || <>오른쪽 도구 상자에서 메뉴를 드래그하거나<br />빠른 추가 버튼을 사용하세요.</>}</p>
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
                                onToggleVisibility={onToggleVisibility}
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

