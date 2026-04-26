import React, { useState } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import { useAuth } from '../../../contexts/AuthContext';
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
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/Button';
import { GripVertical, Trash2, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Category } from '../types/memo';

interface CategoryManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CategoryManagerDialog = ({ open, onOpenChange }: CategoryManagerDialogProps) => {
    const { currentUser } = useAuth();
    const categories = useMemoStore(state => state.categories);
    const addCategory = useMemoStore(state => state.addCategory);
    const updateCategory = useMemoStore(state => state.updateCategory);
    const deleteCategory = useMemoStore(state => state.deleteCategory);
    const reorderCategories = useMemoStore(state => state.reorderCategories);

    const [newCategoryName, setNewCategoryName] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Prevent accidental drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = categories.findIndex((c) => c.id === active.id);
            const newIndex = categories.findIndex((c) => c.id === over?.id);
            const newOrder = arrayMove(categories, oldIndex, newIndex);
            reorderCategories(newOrder);
        }
    };

    const handleAdd = async () => {
        if (!newCategoryName.trim() || !currentUser) return;
        await addCategory({
            name: newCategoryName,
            order: categories.length,
            color: 'gray'
        }, currentUser.uid);
        setNewCategoryName('');
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            {/* Modal Content */}
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-semibold text-slate-800">Category Management</h2>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Add New Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder="New Category Name..."
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                            autoFocus
                        />
                        <Button onClick={handleAdd} size="sm" className="bg-slate-900 text-white shrink-0">
                            <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                    </div>

                    {/* Separator */}
                    <div className="h-px bg-slate-100" />

                    {/* Draggable List */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={categories.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {categories.length === 0 ? (
                                    <p className="text-center text-sm text-slate-400 py-4">No categories yet.</p>
                                ) : (
                                    categories.map((category) => (
                                        <SortableCategoryRow
                                            key={category.id}
                                            category={category}
                                            onUpdate={(name) => updateCategory(category.id, { name })}
                                            onDelete={() => {
                                                if (window.confirm(`Delete category "${category.name}"?`)) {
                                                    deleteCategory(category.id);
                                                }
                                            }}
                                        />
                                    ))
                                )}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                    <Button onClick={() => onOpenChange(false)} variant="outline" className="mr-2">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};

interface SortableCategoryRowProps {
    category: Category;
    onUpdate: (name: string) => void;
    onDelete: () => void;
}

const SortableCategoryRow = ({ category, onUpdate, onDelete }: SortableCategoryRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 99999 : 'auto', // Super high z-index for drag item
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg group hover:border-slate-300 transition-all shadow-sm",
                isDragging && "shadow-xl border-slate-900 ring-2 ring-slate-900/10 opacity-90 scale-105 z-[99999]"
            )}
        >
            <div
                {...attributes}
                {...listeners}
                className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1"
            >
                <GripVertical className="w-4 h-4" />
            </div>

            <input
                type="text"
                value={category.name}
                onChange={(e) => onUpdate(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm font-medium text-slate-700 focus:outline-none focus:text-slate-900 placeholder-slate-400"
            />

            <button
                onClick={onDelete}
                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Delete"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
};
