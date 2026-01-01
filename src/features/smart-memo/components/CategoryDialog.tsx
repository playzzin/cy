import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useMemoStore } from '../store/useMemoStore';
import { Category } from '../types/memo';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from './ui/Dialog';
import { Button } from './ui/Button';
import { Loader2 } from 'lucide-react';

interface CategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categoryToEdit?: Category | null;
}

export const CategoryDialog: React.FC<CategoryDialogProps> = ({ open, onOpenChange, categoryToEdit }) => {
    const { currentUser } = useAuth();
    const { addCategory, updateCategory, categories } = useMemoStore();

    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (categoryToEdit) {
            setName(categoryToEdit.name);
        } else {
            setName('');
        }
        setError(null);
    }, [categoryToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("카테고리 이름을 입력해주세요");
            return;
        }
        if (!currentUser) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (categoryToEdit) {
                await updateCategory(categoryToEdit.id, { name: name.trim() });
            } else {
                await addCategory({
                    name: name.trim(),
                    order: categories.length,
                    color: 'gray'
                }, currentUser.uid);
            }
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || "카테고리 저장 실패");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-white/95 backdrop-blur-xl border-none shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-slate-800">
                        {categoryToEdit ? '카테고리 수정' : '새 카테고리'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="py-4 flex flex-col gap-4">
                    <div className="space-y-1">
                        <input
                            placeholder="카테고리 이름"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border-b border-slate-200 bg-transparent py-2 text-base outline-none focus:border-slate-800 transition-colors placeholder:text-slate-400"
                            autoFocus
                        />
                        {error && <p className="text-xs text-red-500">{error}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            취소
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white hover:bg-slate-800 rounded-full">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            저장
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
