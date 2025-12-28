import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
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
    faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import { MENU_PATHS } from '../../../../constants/menuPaths';

interface ToolboxPanelProps {
    isOpen: boolean;
    toggle: () => void;
}

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

const ToolboxPanel: React.FC<ToolboxPanelProps> = ({ isOpen, toggle }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showHidden, setShowHidden] = useState(false);

    // Persistent hidden state
    const [hiddenPages, setHiddenPages] = useState<string[]>(() => {
        const saved = localStorage.getItem('menu_manager_hidden_pages');
        return saved ? JSON.parse(saved) : [];
    });

    const toggleHide = (pageName: string) => {
        setHiddenPages(prev => {
            const next = prev.includes(pageName)
                ? prev.filter(p => p !== pageName)
                : [...prev, pageName];
            localStorage.setItem('menu_manager_hidden_pages', JSON.stringify(next));
            return next;
        });
    };

    const systemPages = useMemo(() => {
        return Object.entries(MENU_PATHS)
            .map(([name, path]) => ({ name, path }))
            .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm]);

    return (
        <div className={`relative bg-gray-800 border-r border-gray-700 shadow-xl transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'w-80' : 'w-0'}`}>
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
                    </div>

                    {/* 2. System Pages (Import) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">시스템 페이지 ({systemPages.length})</label>
                        </div>

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
                            {systemPages.map((page) => {
                                const isHidden = hiddenPages.includes(page.name);
                                if (isHidden && !showHidden) return null;

                                return (
                                    <div key={page.name} className="relative group/item">
                                        <DraggableItem
                                            id={`sys-${page.name}`}
                                            label={page.name}
                                            icon={faFileLines}
                                            color={isHidden ? "bg-gray-600 grayscale opacity-50" : "bg-emerald-600"}
                                            type="system-page"
                                            payload={{ text: page.name, path: page.path }}
                                            showPreview={!isHidden}
                                            path={page.path}
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleHide(page.name);
                                            }}
                                            className={`absolute top-1/2 -translate-y-1/2 right-9 w-6 h-6 rounded flex items-center justify-center transition-colors z-20
                                                ${isHidden
                                                    ? 'text-blue-400 hover:bg-gray-600 hover:text-white'
                                                    : 'text-gray-500 hover:text-red-400 hover:bg-gray-700 opacity-0 group-hover/item:opacity-100'}`}
                                            title={isHidden ? "보이기" : "숨기기 (안전한 삭제)"}
                                        >
                                            <FontAwesomeIcon icon={isHidden ? faEye : faEyeSlash} size="xs" />
                                        </button>
                                    </div>
                                );
                            })}
                            {systemPages.length === 0 && (
                                <div className="text-center py-4 text-xs text-gray-600 italic">
                                    검색 결과가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Trash Zone */}
                    <div className="mt-auto pt-6 border-t border-gray-700 bg-gray-800">
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-3 pl-1">휴지통</label>
                        <div id="trash-zone" className="group border-2 border-dashed border-red-900/30 bg-red-900/5 rounded-xl p-4 flex flex-col items-center justify-center text-red-400/50 hover:bg-red-900/20 hover:border-red-500/50 hover:text-red-400 transition-all duration-300">
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
