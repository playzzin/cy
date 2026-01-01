import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useMemoStore } from '../store/useMemoStore';
import { cn } from '../lib/utils';
import { Plus, MoreHorizontal, Pencil, Trash2, ChevronsDown, ChevronsUp, ArrowUpDown } from 'lucide-react';
import { Button } from './ui/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './ui/DropdownMenu';
import { CategoryDialog } from './CategoryDialog';
import { Category } from '../types/memo';

interface CategoryTabProps {
    id: string | null;
    label: string;
    isActive: boolean;
    onClick: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isRemovable?: boolean;
}

const CategoryDropTarget: React.FC<CategoryTabProps> = ({
    id,
    label,
    isActive,
    onClick,
    onEdit,
    onDelete,
    isRemovable
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id || 'uncategorized',
        data: { type: 'category', id }
    });

    return (
        <div ref={setNodeRef} className="relative group">
            <button
                onClick={onClick}
                className={cn(
                    "relative flex items-center px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap border",
                    isActive
                        ? "bg-slate-800 text-white shadow-sm border-slate-800"
                        : "text-slate-500 hover:bg-slate-100/80 bg-white/50 border-slate-200/50 hover:border-slate-300/50",
                    isOver && "ring-2 ring-amber-500 ring-offset-2 scale-105 bg-amber-50"
                )}
            >
                {label}
            </button>

            {/* Context Menu Trigger */}
            {isRemovable && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-4 w-4 bg-white rounded-full shadow-sm border flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-700">
                                <MoreHorizontal className="h-2.5 w-2.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" sideOffset={2}>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }} className="text-[10px] py-1">
                                <Pencil className="h-3 w-3 mr-1.5" />
                                수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                                className="text-red-600 focus:text-red-600 text-[10px] py-1"
                            >
                                <Trash2 className="h-3 w-3 mr-1.5" />
                                삭제
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};

// Update MemoTopBar Props
interface MemoTopBarProps {
    currentFilter: string | null;
    onFilterChange: (categoryId: string | null) => void;
    filteredCount?: number;
    totalCount?: number;
    onCreate?: () => void;
}

export const MemoTopBar: React.FC<MemoTopBarProps> = ({ currentFilter, onFilterChange, filteredCount, totalCount, onCreate }) => {
    const { categories, deleteCategory, isGlobalExpanded, setAllExpanded, sortMode, setSortMode } = useMemoStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);

    const handleAddCategory = () => {
        setCategoryToEdit(null);
        setIsDialogOpen(true);
    };

    const handleEditCategory = (category: Category) => {
        setCategoryToEdit(category);
        setIsDialogOpen(true);
    };

    const handleDeleteCategory = async (id: string) => {
        if (window.confirm('카테고리를 삭제하시겠습니까? \n포함된 메모는 삭제되지 않습니다.')) {
            await deleteCategory(id);
            if (currentFilter === id) {
                onFilterChange(null);
            }
        }
    };

    return (
        <>
            <div className="flex items-center gap-1.5 p-0.5 overflow-x-auto scrollbar-hide">
                <CategoryDropTarget
                    id={null}
                    label="전체"
                    isActive={currentFilter === null}
                    onClick={() => onFilterChange(null)}
                    isRemovable={false}
                />

                <div className="w-px h-3 bg-slate-300/50 flex-shrink-0 mx-1" />

                {categories.map(category => (
                    <CategoryDropTarget
                        key={category.id}
                        id={category.id}
                        label={category.name}
                        isActive={currentFilter === category.id}
                        onClick={() => onFilterChange(category.id)}
                        isRemovable={true}
                        onEdit={() => handleEditCategory(category)}
                        onDelete={() => handleDeleteCategory(category.id)}
                    />
                ))}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddCategory}
                    className="rounded-full h-6 w-6 p-0 bg-slate-50 hover:bg-slate-100 text-slate-400 ml-0.5 flex-shrink-0 border border-slate-200/50 shadow-sm"
                    title="새 카테고리 추가"
                >
                    <Plus className="h-3 w-3" />
                </Button>

                <div className="w-px h-3 bg-slate-300/50 flex-shrink-0 mx-1" />

                {onCreate && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCreate}
                            className="rounded-full h-6 px-2 text-[10px] font-medium text-blue-600 hover:bg-blue-50 bg-white/50 border border-blue-100 shadow-sm mr-0.5"
                        >
                            <Pencil className="h-3 w-3 mr-1" />
                            메모 작성
                        </Button>
                        <div className="w-px h-3 bg-slate-300/50 flex-shrink-0 mx-1" />
                    </>
                )}

                {/* Sort Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full h-6 px-2 text-[10px] font-medium text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 bg-white/50 border border-slate-200/50 shadow-sm"
                        >
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            {sortMode === 'manual' && '순서'}
                            {sortMode === 'newest' && '최신'}
                            {sortMode === 'title' && '이름'}
                            {sortMode === 'starred' && '중요'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setSortMode('manual')} className="text-xs">
                            <span className={cn("mr-2", sortMode === 'manual' ? "opacity-100" : "opacity-0")}>✓</span>
                            사용자 지정 순서 (DND)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortMode('newest')} className="text-xs">
                            <span className={cn("mr-2", sortMode === 'newest' ? "opacity-100" : "opacity-0")}>✓</span>
                            최신순
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortMode('title')} className="text-xs">
                            <span className={cn("mr-2", sortMode === 'title' ? "opacity-100" : "opacity-0")}>✓</span>
                            이름순
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortMode('starred')} className="text-xs">
                            <span className={cn("mr-2", sortMode === 'starred' ? "opacity-100" : "opacity-0")}>✓</span>
                            중요 표시순
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-3 bg-slate-300/50 flex-shrink-0 mx-1" />

                {/* Global View Toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full h-6 px-2 text-[10px] font-medium text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 bg-white/50 border border-slate-200/50 shadow-sm ml-auto"
                    onClick={() => setAllExpanded(!isGlobalExpanded)}
                >
                    {isGlobalExpanded ? (
                        <>
                            <ChevronsUp className="h-3 w-3 mr-1" />
                            접기
                        </>
                    ) : (
                        <>
                            <ChevronsDown className="h-3 w-3 mr-1" />
                            펼치기
                        </>
                    )}
                </Button>

                <div className="w-px h-3 bg-slate-300/50 flex-shrink-0 mx-1" />

                {/* Count Indicator */}
                <div className="text-[10px] text-slate-400 font-medium px-1">
                    {filteredCount !== undefined && totalCount !== undefined && (
                        <span>{filteredCount} / {totalCount}</span>
                    )}
                </div>
            </div >

            <CategoryDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                categoryToEdit={categoryToEdit}
            />
        </>
    );
};
