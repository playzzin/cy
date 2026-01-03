
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Memo, ChecklistItem } from '../types/memo';
import { useMemoStore } from '../store/useMemoStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus, faComment, faTrash } from '@fortawesome/free-solid-svg-icons';

import { AnimatePresence, motion } from 'framer-motion';

interface MemoChecklistProps {
    memo: Memo;
}

export const MemoChecklist: React.FC<MemoChecklistProps> = ({ memo }) => {
    const { addChecklistItem, updateChecklistItem, deleteChecklistItem, toggleChecklistItem, addChecklistComment, deleteChecklistComment } = useMemoStore();
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
    const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

    const toggleComments = (itemId: string) => {
        setExpandedComments(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const handleAddComment = (itemId: string, text: string) => {
        if (!text.trim()) return;
        addChecklistComment(memo.id, itemId, text);
    };

    const items = memo.checklistItems || [];

    const adjustHeight = useCallback((id: string) => {
        const el = textareaRefs.current[id];
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, []);

    // Focus management
    useEffect(() => {
        if (focusedId && textareaRefs.current[focusedId]) {
            textareaRefs.current[focusedId]?.focus();
            adjustHeight(focusedId);
        }
    }, [focusedId, items, adjustHeight]);

    // Auto-resize trigger
    useEffect(() => {
        items.forEach(item => adjustHeight(item.id));
    }, [items, adjustHeight]);

    const handleKeyDown = (e: React.KeyboardEvent, index: number, item: ChecklistItem) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextIndex = index + 1;
            addChecklistItem(memo.id, '', nextIndex);
        } else if (e.key === 'Backspace' && item.text === '') {
            e.preventDefault();
            if (items.length > 1) {
                const prevIndex = index - 1;
                deleteChecklistItem(memo.id, item.id);
                if (prevIndex >= 0) {
                    setFocusedId(items[prevIndex].id);
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = index - 1;
            if (prevIndex >= 0) {
                setFocusedId(items[prevIndex].id);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < items.length) {
                setFocusedId(items[nextIndex].id);
            }
        }
    };

    const handleChange = (id: string, text: string) => {
        updateChecklistItem(memo.id, id, text);
        adjustHeight(id);
    };

    return (
        <div className="flex flex-col gap-0.5">
            {items.map((item, index) => (
                <React.Fragment key={item.id}>
                    <div className="group flex items-start gap-2 py-1">
                        {/* Checkbox */}
                        <button
                            onClick={() => toggleChecklistItem(memo.id, item.id)}
                            className={`
                                flex-shrink-0 w-4 h-4 rounded mt-1 ml-[-2px] border transition-colors duration-200 flex items-center justify-center
                                ${item.isChecked
                                    ? 'bg-slate-500 border-slate-500 text-white'
                                    : 'bg-white border-slate-300 hover:border-slate-400 shadow-sm'}
                            `}
                        >
                            {item.isChecked && <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
                        </button>

                        {/* Textarea */}
                        <textarea
                            ref={el => { textareaRefs.current[item.id] = el; }}
                            value={item.text}
                            onChange={(e) => handleChange(item.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, index, item)}
                            onFocus={() => setFocusedId(item.id)}
                            rows={1}
                            placeholder={items.length === 1 ? "리스트 아이템 입력..." : ""}
                            className={`
                                flex-1 bg-transparent outline-none text-slate-700 text-sm placeholder:text-slate-300 resize-none overflow-hidden min-h-[24px] leading-relaxed
                                ${item.isChecked ? 'line-through text-slate-400' : ''}
                            `}
                        />

                        {/* Comment Button */}
                        <button
                            onClick={() => toggleComments(item.id)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 mt-0.5 hover:text-slate-500 ${(item.comments?.length || 0) > 0 ? 'opacity-100 text-slate-400' : 'text-slate-300'
                                }`}
                            tabIndex={-1}
                            title="댓글"
                        >
                            <div className="relative">
                                <FontAwesomeIcon icon={faComment} className="text-xs" />
                                {(item.comments?.length || 0) > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-slate-500 text-white text-[8px] px-1 rounded-full min-w-[12px] h-[12px] flex items-center justify-center">
                                        {item.comments?.length}
                                    </span>
                                )}
                            </div>
                        </button>

                        {/* Delete Button */}
                        <button
                            onClick={() => deleteChecklistItem(memo.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mt-0.5 text-slate-300 hover:text-slate-500"
                            tabIndex={-1}
                        >
                            &times;
                        </button>
                    </div>

                    {/* Comments Section */}
                    <AnimatePresence>
                        {expandedComments[item.id] && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden ml-8 mr-2 mb-2"
                            >
                                <div className="bg-slate-50 rounded pl-2 pr-1 py-1 flex flex-col gap-1 border border-slate-100">
                                    {item.comments?.map(comment => (
                                        <div key={comment.id} className="flex items-start gap-2 group/comment text-xs text-slate-600 mb-1">
                                            <div className="flex-1 whitespace-pre-wrap break-words">{comment.text}</div>
                                            <button
                                                onClick={() => deleteChecklistComment(memo.id, item.id, comment.id)}
                                                className="opacity-0 group-hover/comment:opacity-100 text-slate-300 hover:text-red-400 px-1"
                                            >
                                                <FontAwesomeIcon icon={faTrash} size="xs" />
                                            </button>
                                        </div>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder="댓글 입력..."
                                        className="w-full text-xs bg-transparent outline-none placeholder:text-slate-300 mt-1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAddComment(item.id, e.currentTarget.value);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </React.Fragment>
            ))}

            {/* Add Item Button */}
            <div
                className="flex items-center gap-2 py-1 opacity-50 hover:opacity-100 cursor-text transition-opacity"
                onClick={() => addChecklistItem(memo.id, '')}
            >
                <div className="w-4 h-4 ml-[-2px] flex items-center justify-center">
                    <FontAwesomeIcon icon={faPlus} className="text-xs text-slate-400" />
                </div>
                <span className="text-sm text-slate-400">항목 추가</span>
            </div>
        </div>
    );
};
