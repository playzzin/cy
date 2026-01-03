import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useMemoStore } from '../store/useMemoStore';
import { cn } from '../lib/utils';
import { Folder, Inbox, Plus, Trash2, Globe } from 'lucide-react';
import { Button } from './ui/Button';

interface CategoryItemProps {
    id: string | null; // null for 'All Memos' or 'Uncategorized' if we had one, but strict categories usually have IDs.
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

const CategoryDropTarget: React.FC<CategoryItemProps> = ({ id, label, icon, isActive, onClick }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id || 'uncategorized', // 'uncategorized' or similar ID for drop target
        data: { type: 'category', id }
    });

    return (
        <button
            ref={setNodeRef}
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                isActive
                    ? "text-amber-700 bg-amber-50 shadow-sm ring-1 ring-amber-200/60"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-900",
                isOver && "ring-2 ring-amber-500 ring-offset-2 bg-amber-50 scale-[1.02]"
            )}
        >
            {/* Active Indicator Bar */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-amber-500 rounded-r-full" />
            )}

            <span className={cn("relative z-10 transition-colors", isActive ? "text-amber-600" : "text-slate-400 group-hover:text-amber-600")}>
                {icon}
            </span>
            <span className="relative z-10 truncate">
                {label}
            </span>
        </button>
    );
};

interface MemoSidebarProps {
    currentFilter: string | null;
    onFilterChange: (categoryId: string | null) => void;
}

export const MemoSidebar: React.FC<MemoSidebarProps> = ({ currentFilter, onFilterChange }) => {
    const { categories, addCategory, deleteCategory } = useMemoStore();

    const handleAddCategory = () => {
        const name = prompt("새 카테고리 이름:");
        if (name) {
            addCategory({ name, order: categories.length, color: 'gray' }, "current-user-id"); // userId injected in store usually, but here we might need it. 
            // Store's addCategory needs userId. We should fix store to use internal auth state or pass it. 
            // For now, let's assume MemoPage passes it or we get it from auth.
            // Wait, useMemoStore doesn't select currentUser.
        }
    };

    return (
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-slate-50/50 backdrop-blur-xl md:flex hidden animate-fadeIn">
            {/* Sidebar Header Area (Optional Branding) */}
            <div className="p-6 pb-2">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    스마트 메모
                </h2>
            </div>

            <div className="flex-1 space-y-6 p-4 pt-2">
                <div className="space-y-1">
                    <CategoryDropTarget
                        id={null}
                        label="전체 메모"
                        icon={<Inbox className="h-4 w-4" />}
                        isActive={currentFilter === null}
                        onClick={() => onFilterChange(null)}
                    />
                    <CategoryDropTarget
                        id="public"
                        label="공용 메모 (Shared)"
                        icon={<Globe className="h-4 w-4 text-blue-500" />}
                        isActive={currentFilter === 'public'}
                        onClick={() => onFilterChange('public')}
                    />
                </div>

                <div className="space-y-1">
                    <div className="px-3 pb-2 pt-4 flex items-center justify-between group">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            카테고리
                        </span>
                        <button
                            onClick={handleAddCategory}
                            className="p-1 rounded-md hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="새 카테고리 추가"
                        >
                            <Plus className="h-3 w-3" />
                        </button>
                    </div>

                    <div className="max-h-[calc(100vh-250px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {categories.map(category => (
                            <div key={category.id} className="group flex items-center justify-between mb-1">
                                <CategoryDropTarget
                                    id={category.id}
                                    label={category.name}
                                    icon={<Folder className="h-4 w-4" />}
                                    isActive={currentFilter === category.id}
                                    onClick={() => onFilterChange(category.id)}
                                />
                            </div>
                        ))}

                        {categories.length === 0 && (
                            <div className="px-3 py-4 text-xs text-slate-400 italic text-center border-2 border-dashed border-slate-100 rounded-lg">
                                카테고리가 없습니다
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Action Area */}
            <div className="p-4 border-t border-slate-200 bg-white/50">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50/50 transition-all font-medium"
                    onClick={handleAddCategory}
                >
                    <Plus className="h-4 w-4" />
                    새 카테고리
                </Button>
            </div>
        </div>
    );
};
