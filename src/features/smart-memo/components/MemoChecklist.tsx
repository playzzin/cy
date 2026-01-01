
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Memo, ChecklistItem } from '../types/memo';
import { useMemoStore } from '../store/useMemoStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion } from 'framer-motion';

interface MemoChecklistProps {
    memo: Memo;
}

export const MemoChecklist: React.FC<MemoChecklistProps> = ({ memo }) => {
    const { addChecklistItem, updateChecklistItem, deleteChecklistItem, toggleChecklistItem } = useMemoStore();
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

    const items = memo.checklistItems || [];

    const adjustHeight = useCallback((id: string) => {
        const el = textareaRefs.current[id];
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, []); // No dependencies needed as it only accesses ref.current

    // Focus management
    useEffect(() => {
        if (focusedId && textareaRefs.current[focusedId]) {
            textareaRefs.current[focusedId]?.focus();
            adjustHeight(focusedId);
        }
    }, [focusedId, items, adjustHeight]); // items dependency ensures focus after re-render if needed

    // Auto-resize trigger for all items on initial load and item changes
    useEffect(() => {
        items.forEach(item => adjustHeight(item.id));
    }, [items, adjustHeight]);

    const handleKeyDown = (e: React.KeyboardEvent, index: number, item: ChecklistItem) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent newline in textarea
            const nextIndex = index + 1;
            // Add new item below current
            addChecklistItem(memo.id, '', nextIndex);
        } else if (e.key === 'Backspace' && item.text === '') {
            e.preventDefault();
            // Delete current if empty and focus previous
            if (items.length > 1) {
                const prevIndex = index - 1;
                deleteChecklistItem(memo.id, item.id);
                if (prevIndex >= 0) {
                    setFocusedId(items[prevIndex].id);
                }
            } else {
                // If it's the last item, maybe convert back to text or just clear?
                // Google keep deletes the note if empty? No, just clears.
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

    // Special handling for focusing new items:
    // If items length increases, focus the one that was added?
    // A bit tricky without ID. Let's start simple.

    // Sort items: Unchecked first? Or keep strict order?
    // Google Keep allows manual reorder. For now, strict order of array array index.
    // Checked items usually behave same as unchecked until refreshed or manually moved.

    // Sort logic optimization: Checked items visual style only?
    // Let's keep them in order for now.

    const handleChange = (id: string, text: string) => {
        updateChecklistItem(memo.id, id, text);
        adjustHeight(id); // Adjust height on change
    };

    // Separate Unchecked and Checked for visual grouping (Optional, like Keep)
    // For now, let's render mixed list to preserve index order for keyboard nav consistency.

    return (
        <div className="flex flex-col gap-0.5">
            {items.map((item, index) => (
                <div key={item.id} className="group flex items-start gap-2 py-1">
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

                    {/* Auto-resizing Textarea */}
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

                    {/* Delete Button (Hover only) */}
                    <button
                        onClick={() => deleteChecklistItem(memo.id, item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mt-0.5 text-slate-300 hover:text-slate-500"
                        tabIndex={-1}
                    >
                        &times;
                    </button>
                </div>
            ))}

            {/* Add Item Button (Bottom) - Optional specific interaction */}
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
