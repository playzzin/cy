import React, { useState, useEffect } from 'react';
import { Memo, MemoColor } from '../types/memo';
import { useAuth } from '../../../contexts/AuthContext';
import { useMemoStore } from '../store/useMemoStore';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from './ui/Dialog';
import { Button } from './ui/Button';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface MemoEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memoToEdit?: Memo | null;
}

const COLORS: MemoColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

export const MemoEditor: React.FC<MemoEditorProps> = ({ open, onOpenChange, memoToEdit }) => {
    const { currentUser } = useAuth();
    const { addMemo, updateMemo } = useMemoStore();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState<MemoColor>('white');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync state when memoToEdit changes
    useEffect(() => {
        if (memoToEdit) {
            setTitle(memoToEdit.title);
            setContent(memoToEdit.content);
            setColor(memoToEdit.color);
        } else {
            // Reset for new memo
            setTitle('');
            setContent('');
            setColor('white');
        }
        setError(null);
    }, [memoToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError("제목을 입력해주세요");
            return;
        }
        if (!currentUser) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (memoToEdit) {
                await updateMemo(memoToEdit.id, {
                    title,
                    content,
                    color,
                });
            } else {
                await addMemo({
                    title,
                    content,
                    color,
                    isPinned: false, // Default
                    type: 'text',
                    order: 0,
                    w: 4,
                    h: 4,
                    x: 0,
                    y: 0,
                    isCollapsed: false,
                    checklistItems: []
                }, currentUser.uid);
            }
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || "메모 저장 실패");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[500px] shadow-2xl border-none p-0 overflow-hidden bg-white/95 backdrop-blur-xl"
                overlayClassName="bg-black/10 backdrop-blur-[2px]"
            >
                <div className={cn("p-6 flex flex-col gap-5",
                    color === 'white' ? "bg-white" :
                        color === 'red' ? "bg-[#ffebec]" :
                            color === 'orange' ? "bg-[#fff0e0]" :
                                color === 'yellow' ? "bg-[#fffbe0]" :
                                    color === 'green' ? "bg-[#e6fdec]" :
                                        color === 'blue' ? "bg-[#e3f2fd]" :
                                            color === 'purple' ? "bg-[#f3e5f5]" :
                                                "bg-[#f5f5f5]"
                )}>
                    <DialogHeader className="px-1">
                        <DialogTitle className="text-lg font-bold text-slate-800">{memoToEdit ? '메모 수정' : '새 메모'}</DialogTitle>
                    </DialogHeader>

                    {/* Color Picker - Sticker Style */}
                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                        {COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={cn(
                                    "h-8 w-8 rounded-full border shadow-sm transition-all hover:scale-110",
                                    c === 'white' && "bg-[#fffdf5] border-slate-200",
                                    c === 'red' && "bg-[#ffebec] border-red-100",
                                    c === 'orange' && "bg-[#fff0e0] border-orange-100",
                                    c === 'yellow' && "bg-[#fffbe0] border-yellow-100",
                                    c === 'green' && "bg-[#e6fdec] border-green-100",
                                    c === 'blue' && "bg-[#e3f2fd] border-blue-100",
                                    c === 'purple' && "bg-[#f3e5f5] border-purple-100",
                                    c === 'gray' && "bg-[#f5f5f5] border-slate-200",
                                    color === c && "ring-2 ring-slate-400 ring-offset-2 scale-110"
                                )}
                                aria-label={`Select color ${c}`}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="space-y-1">
                            <input
                                placeholder="제목"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border-none bg-transparent text-xl font-bold placeholder:text-black/30 focus:outline-none focus:ring-0 px-1"
                            />
                            {error && <p className="text-xs text-red-500 font-medium px-1">{error}</p>}
                        </div>

                        <textarea
                            placeholder="내용을 입력하세요..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[200px] w-full resize-none border-none bg-transparent text-base leading-relaxed placeholder:text-black/30 focus:outline-none focus:ring-0 px-1"
                        />

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-black/5">
                                취소
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-6">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                저장
                            </Button>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
};
