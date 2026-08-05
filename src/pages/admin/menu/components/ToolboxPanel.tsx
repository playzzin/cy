import React, { useState, useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolder,
    faLink,
    faChevronLeft,
    faChevronRight,
    faTrash,
    faSearch,
    faFileLines,
    faArrowUpRightFromSquare,
    faEye,
    faEyeSlash,
    faPen,
    faCheck,
    faXmark,
    faPlus
} from '@fortawesome/free-solid-svg-icons';
import { MENU_PATHS } from '../../../../constants/menuPaths';

interface ToolboxPanelProps {
    isOpen: boolean;
    toggle: () => void;
    systemPageLabels?: Record<string, string>;
    onRenameSystemPage: (path: string, name: string) => void;
    targetMenuName: string;
    isSystemPageAdded: (path: string) => boolean;
    onAddSystemPage: (page: { name: string; path: string }) => void;
}

interface SystemPageSource {
    defaultName: string;
    name: string;
    path: string;
    aliases: string[];
}

// Keep frequently used pages discoverable by the names people use in the
// menu editor, even when the same route has legacy aliases in MENU_PATHS.
const SYSTEM_PAGE_DEFAULT_LABELS: Record<string, string> = {
    '/database/partner-photo-registration': '명함관리 페이지',
    '/payroll/field-buyback': '바이백',
    '/payroll/progress-claims?tab=buyback': '관계자 배분 (기성관리)',
};

interface DraggableItemProps {
    id: string;
    label: string;
    icon: any;
    color: string;
    type?: 'new-item' | 'system-page';
    payload?: any;
    showPreview?: boolean;
    path?: string;
}

const DraggableItem = ({ id, label, icon, color, type = 'new-item', payload = {}, showPreview = false, path = '' }: DraggableItemProps) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: id,
        data: { type, ...payload }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        opacity: 0.8,
    } : undefined;

    const handlePreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (path) {
            window.open(path, '_blank');
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-move shadow-sm hover:shadow-md transition-all group select-none ring-1 ring-white/5 relative`}
        >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color} text-white shadow-inner flex-shrink-0`}
                {...listeners} {...attributes}>
                <FontAwesomeIcon icon={icon} />
            </div>

            <div className="flex-1 min-w-0" {...listeners} {...attributes}>
                <span className="font-medium text-gray-300 group-hover:text-white text-sm truncate block">{label}</span>
                {path && <span className="text-[10px] text-gray-500 truncate block mt-0.5">{path}</span>}
            </div>

            {showPreview && path && (
                <button
                    onClick={handlePreview}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-blue-400 transition-colors z-10"
                    title="새 창에서 미리보기"
                >
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} size="xs" />
                </button>
            )}
        </div>
    );
};

const ToolboxPanel: React.FC<ToolboxPanelProps> = ({
    isOpen,
    toggle,
    systemPageLabels = {},
    onRenameSystemPage,
    targetMenuName,
    isSystemPageAdded,
    onAddSystemPage
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showHidden, setShowHidden] = useState(false);
    const [editingPagePath, setEditingPagePath] = useState<string | null>(null);
    const [editingPageName, setEditingPageName] = useState('');
    const { setNodeRef: setTrashNodeRef, isOver: isTrashOver } = useDroppable({
        id: 'trash-zone',
    });

    // Persistent hidden state
    const [hiddenPages, setHiddenPages] = useState<string[]>(() => {
        const saved = localStorage.getItem('menu_manager_hidden_pages');
        return saved ? JSON.parse(saved) : [];
    });

    const toggleHide = (pageKey: string) => {
        setHiddenPages(prev => {
            const next = prev.includes(pageKey)
                ? prev.filter(p => p !== pageKey)
                : [...prev, pageKey];
            localStorage.setItem('menu_manager_hidden_pages', JSON.stringify(next));
            return next;
        });
    };

    const sourcePageSummary = useMemo(() => {
        const rawPages = Object.entries(MENU_PATHS);
        const pagesByPath = new Map<string, Omit<SystemPageSource, 'name'>>();

        rawPages.forEach(([name, rawPath]) => {
            const path = String(rawPath || '').trim();
            if (!path) return;

            const existing = pagesByPath.get(path);
            if (existing) {
                existing.aliases.push(name);
                return;
            }

            pagesByPath.set(path, {
                defaultName: name,
                path,
                aliases: [name]
            });
        });

        const query = searchTerm.trim().toLowerCase();
        const uniquePages = Array.from(pagesByPath.values()).map((page) => ({
            ...page,
            name: String(
                systemPageLabels[page.path]
                || SYSTEM_PAGE_DEFAULT_LABELS[page.path]
                || page.defaultName
            ).trim() || page.defaultName
        }));
        const filteredPages = query
            ? uniquePages.filter((page) => (
                page.name.toLowerCase().includes(query)
                || page.path.toLowerCase().includes(query)
                || page.aliases.some((alias) => alias.toLowerCase().includes(query))
            ))
            : uniquePages;

        return {
            pages: filteredPages,
            uniqueCount: uniquePages.length,
            duplicateCount: rawPages.length - uniquePages.length
        };
    }, [searchTerm, systemPageLabels]);

    const savePageName = (page: SystemPageSource) => {
        const nextName = editingPageName.trim();
        if (!nextName) return;
        onRenameSystemPage(page.path, nextName);
        setEditingPagePath(null);
        setEditingPageName('');
    };

    return (
        <div className={`relative flex flex-shrink-0 flex-col border-r border-gray-700 bg-gray-800 shadow-xl transition-all duration-300 ease-in-out ${isOpen ? 'w-[420px] max-w-[45vw]' : 'w-0'}`}>
            <button
                onClick={toggle}
                className="absolute -right-4 top-1/2 -translate-y-1/2 bg-gray-700 text-gray-400 hover:text-white p-1 rounded-r-md border border-l-0 border-gray-600 shadow-md z-20 w-4 h-12 flex items-center justify-center text-xs"
            >
                <FontAwesomeIcon icon={isOpen ? faChevronLeft : faChevronRight} />
            </button>

            <div className={`flex flex-col h-full overflow-hidden ${!isOpen && 'opacity-0 invisible'}`}>
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <h2 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-2">
                        <FontAwesomeIcon icon={faFolder} className="text-blue-400" />
                        도구 모음 (Toolbox)
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* 1. Basic Tools */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">기본 항목</label>
                        <DraggableItem
                            id="new-folder"
                            label="새 폴더 그룹"
                            icon={faFolder}
                            color="bg-amber-600"
                            payload={{ template: 'folder' }}
                        />
                        <DraggableItem
                            id="new-link"
                            label="빈 메뉴 링크"
                            icon={faLink}
                            color="bg-indigo-600"
                            payload={{ template: 'link' }}
                        />
                        <DraggableItem
                            id="new-divider"
                            label="구분선 (-)"
                            icon={faFileLines}
                            color="bg-gray-600"
                            payload={{ template: 'divider' }}
                        />
                    </div>

                    {/* 2. System Pages (Import) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">원본 메뉴 ({sourcePageSummary.uniqueCount})</label>
                            {sourcePageSummary.duplicateCount > 0 && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                    중복 {sourcePageSummary.duplicateCount}개 정리됨
                                </span>
                            )}
                        </div>

                        <p className="px-1 text-[10px] leading-relaxed text-gray-500">
                            같은 이동 경로는 하나만 표시합니다. 연필 버튼으로 원본 메뉴 이름을 바꿀 수 있습니다.
                        </p>

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="페이지 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md py-1.5 pl-8 pr-3 text-sm text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                        </div>

                        {/* Visibility Toggle */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowHidden(!showHidden)}
                                className={`text-[10px] flex items-center gap-1 ${showHidden ? 'text-blue-400' : 'text-gray-500 hover:text-gray-400'}`}
                            >
                                <FontAwesomeIcon icon={showHidden ? faEye : faEyeSlash} />
                                {showHidden ? '숨긴 항목 보기' : '숨긴 항목 감추기'}
                            </button>
                        </div>

                        <div className="grid gap-2">
                            {sourcePageSummary.pages.map((page) => {
                                const isHidden = hiddenPages.includes(page.path) || hiddenPages.includes(page.defaultName);
                                const isAdded = isSystemPageAdded(page.path);
                                if (isHidden && !showHidden) return null;

                                if (editingPagePath === page.path) {
                                    return (
                                        <form
                                            key={page.path}
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                savePageName(page);
                                            }}
                                            className="rounded-lg border border-blue-500/40 bg-gray-900 p-3 shadow-lg"
                                        >
                                            <label className="mb-1.5 block text-[10px] font-bold text-blue-300">원본 메뉴 이름</label>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    autoFocus
                                                    aria-label={`${page.defaultName} 원본 메뉴 이름`}
                                                    value={editingPageName}
                                                    onChange={(event) => setEditingPageName(event.target.value)}
                                                    className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                                <button type="submit" disabled={!editingPageName.trim()} title="원본 메뉴 이름 저장" className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                                                    <FontAwesomeIcon icon={faCheck} size="xs" />
                                                </button>
                                                <button type="button" onClick={() => setEditingPagePath(null)} title="이름 수정 취소" className="flex h-8 w-8 items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white">
                                                    <FontAwesomeIcon icon={faXmark} size="xs" />
                                                </button>
                                            </div>
                                            <span className="mt-1.5 block truncate text-[10px] text-gray-500">{page.path}</span>
                                        </form>
                                    );
                                }

                                return (
                                    <div key={page.path} data-system-page-path={page.path} className="relative group/item">
                                        <DraggableItem
                                            id={`sys-${page.path}`}
                                            label={page.name}
                                            icon={faFileLines}
                                            color={isHidden ? "bg-gray-600 grayscale opacity-50" : "bg-emerald-600"}
                                            type="system-page"
                                            payload={{ text: page.name, path: page.path }}
                                            path={page.path}
                                        />
                                        <div className="mt-1 flex w-full items-stretch gap-1">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setEditingPagePath(page.path);
                                                    setEditingPageName(page.name);
                                                }}
                                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-gray-700 bg-gray-800 text-gray-400 transition-colors hover:border-blue-500/50 hover:bg-gray-700 hover:text-blue-300"
                                                title={`${page.name} 원본 메뉴 이름 수정`}
                                            >
                                                <FontAwesomeIcon icon={faPen} size="xs" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleHide(page.path);
                                                }}
                                                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${isHidden
                                                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                                                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                                                    }`}
                                                title={isHidden ? '보이기' : '숨기기 (안전한 삭제)'}
                                            >
                                                <FontAwesomeIcon icon={isHidden ? faEye : faEyeSlash} size="xs" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    window.open(page.path, '_blank', 'noopener,noreferrer');
                                                }}
                                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-gray-700 bg-gray-800 text-gray-400 transition-colors hover:border-blue-500/50 hover:bg-gray-700 hover:text-blue-300"
                                                title="새 창에서 미리보기"
                                                aria-label={`${page.name} 새 창에서 미리보기`}
                                            >
                                                <FontAwesomeIcon icon={faArrowUpRightFromSquare} size="xs" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onAddSystemPage({ name: page.name, path: page.path });
                                                }}
                                                disabled={isAdded}
                                                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors ${isAdded
                                                    ? 'cursor-default border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                                    : 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:border-blue-400 hover:bg-blue-500/20 hover:text-white'
                                                    }`}
                                                title={isAdded
                                                    ? `${targetMenuName} 좌측 메뉴에 이미 추가됨`
                                                    : `${targetMenuName} 좌측 메뉴에 바로 추가`}
                                            >
                                                <FontAwesomeIcon icon={isAdded ? faCheck : faPlus} size="xs" />
                                                <span className="truncate">{isAdded ? '추가됨' : `${targetMenuName}에 바로 추가`}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {sourcePageSummary.pages.length === 0 && (
                                <div className="text-center py-4 text-xs text-gray-600 italic">
                                    검색 결과가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Trash Zone */}
                    <div className="mt-auto pt-6 border-t border-gray-700 bg-gray-800">
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-3 pl-1">휴지통</label>
                        <div
                            ref={setTrashNodeRef}
                            id="trash-zone"
                            className={`group border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all duration-300 ${isTrashOver
                                ? 'border-red-400 bg-red-500/15 text-red-300 ring-2 ring-red-500/20'
                                : 'border-red-900/30 bg-red-900/5 text-red-400/50 hover:bg-red-900/20 hover:border-red-500/50 hover:text-red-400'
                                }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <FontAwesomeIcon icon={faTrash} className="text-lg" />
                            </div>
                            <span className="text-xs font-medium">여기로 드래그하여 삭제</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ToolboxPanel;
