import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMemoStore } from '../store/useMemoStore';
import { useMemo$ } from '../hooks/useMemoSelector';
import { cn } from '../lib/utils';
import { X, Trash2, Globe, Pin, List, FileText } from 'lucide-react';
import debounce from 'lodash.debounce';

const COLOR_MAP: Record<string, string> = {
    white: 'bg-white',
    red: 'bg-rose-100',
    orange: 'bg-orange-100',
    yellow: 'bg-amber-100',
    green: 'bg-emerald-100',
    blue: 'bg-sky-100',
    purple: 'bg-violet-100',
    gray: 'bg-slate-100',
};

export const MemoDetailModal: React.FC = () => {
    const expandedMemoId = useMemoStore(state => state.selectedMemoId); // Mapped to selectedMemoId now
    const setExpandedMemoId = useMemoStore(state => state.setSelectedMemoId);
    const updateMemo = useMemoStore(state => state.updateMemo);
    const deleteMemo = useMemoStore(state => state.deleteMemo);
    const convertToChecklist = useMemoStore(state => state.convertToChecklist);
    const convertToText = useMemoStore(state => state.convertToText);

    const memo = useMemo$(expandedMemoId);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const titleRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLTextAreaElement>(null);

    // Sync local state with memo
    useEffect(() => {
        if (memo) {
            setTitle(memo.title || '');
            setContent(memo.content || '');
        }
    }, [memo?.id]); // Only on memo change

    // Debounced save
    const debouncedSave = useRef(
        debounce((id: string, updates: Record<string, any>) => {
            void updateMemo(id, updates).catch(() => { });
        }, 600)
    ).current;

    useEffect(() => {
        return () => {
            debouncedSave.flush();
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        if (memo) debouncedSave(memo.id, { title: e.target.value });
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        if (memo) debouncedSave(memo.id, { content: e.target.value });
    };

    const handleClose = () => {
        debouncedSave.flush(); // Ensure pending save is committed
        setExpandedMemoId(null);
    };

    const handleDelete = async () => {
        if (memo) {
            await deleteMemo(memo.id);
            setExpandedMemoId(null);
        }
    };

    const handleTogglePin = () => {
        if (memo) updateMemo(memo.id, { isPinned: !memo.isPinned });
    };

    const handleToggleType = () => {
        if (memo) {
            if (memo.type === 'checklist') {
                convertToText(memo.id);
            } else {
                convertToChecklist(memo.id);
            }
        }
    };

    if (!memo) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
        >
            <motion.div
                layoutId={`memo-card-${memo.id}`}
                className={cn(
                    "relative w-full max-w-2xl max-h-[80vh] m-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col",
                    COLOR_MAP[memo.color] || COLOR_MAP.white
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
                    <div className="flex items-center gap-3 flex-1">
                        {memo.scope === 'public' && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                                <Globe size={12} />
                                <span className="text-[10px] font-bold">Public</span>
                            </div>
                        )}
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="제목 없음"
                            className="flex-1 bg-transparent text-xl font-bold text-slate-800 placeholder:text-slate-400 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTogglePin}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                memo.isPinned
                                    ? "bg-amber-100 text-amber-600"
                                    : "text-slate-400 hover:bg-slate-100"
                            )}
                            title={memo.isPinned ? "고정 해제" : "고정"}
                        >
                            <Pin size={18} />
                        </button>
                        <button
                            onClick={handleToggleType}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                            title={memo.type === 'checklist' ? "텍스트로 변환" : "체크리스트로 변환"}
                        >
                            {memo.type === 'checklist' ? <FileText size={18} /> : <List size={18} />}
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="삭제"
                        >
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                            title="닫기"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {memo.type === 'checklist' ? (
                        <div className="space-y-2">
                            {(memo.checklistItems || []).map(item => (
                                <div key={item.id} className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={item.isChecked}
                                        onChange={() => useMemoStore.getState().toggleChecklistItem(memo.id, item.id)}
                                        className="mt-1 w-4 h-4 accent-slate-600"
                                    />
                                    <span className={cn(
                                        "flex-1 text-slate-700",
                                        item.isChecked && "line-through text-slate-400"
                                    )}>
                                        {item.text || <span className="text-slate-300 italic">빈 항목</span>}
                                    </span>
                                </div>
                            ))}
                            {(!memo.checklistItems || memo.checklistItems.length === 0) && (
                                <p className="text-slate-400 italic">체크리스트 항목이 없습니다.</p>
                            )}
                        </div>
                    ) : (
                        <textarea
                            ref={contentRef}
                            value={content}
                            onChange={handleContentChange}
                            placeholder="내용을 입력하세요..."
                            className="w-full h-full min-h-[200px] bg-transparent text-slate-700 placeholder:text-slate-400 outline-none resize-none"
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-black/5 text-xs text-slate-400">
                    마지막 수정: {memo.updatedAt?.toDate?.()?.toLocaleString?.() || '방금 전'}
                </div>
            </motion.div>
        </motion.div>
    );
};
