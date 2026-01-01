import React, { useState, useRef, useEffect } from 'react';
import { Memo, MemoColor } from '../types/memo';
import { Trash2, GripHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import lodashDebounce from 'lodash.debounce';
import { cn } from '../lib/utils';
import { useMemoStore } from '../store/useMemoStore';

// Custom Simple Renderer to avoid heavy dependencies
const SimpleRenderer = ({ content }: { content: string }) => {
    // Regex to capture URLs only
    const parts = content.split(/(https?:\/\/[^\s]+|\n)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part === '\n') return <br key={index} />;
                if (part.startsWith('http')) {
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline cursor-pointer relative z-50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                return <span key={index}>{part}</span>;
            })}
        </>
    );
};

interface MemoCardProps {
    memo: Memo;
    onDelete: () => void;
    className?: string;
    // RGL Props
    style?: React.CSSProperties;
    onMouseDown?: React.MouseEventHandler;
    onMouseUp?: React.MouseEventHandler;
    onTouchEnd?: React.TouchEventHandler;
}

const COLOR_MAP: Record<MemoColor, string> = {
    white: 'bg-white border-slate-200',
    red: 'bg-rose-100 border-rose-200',
    orange: 'bg-orange-100 border-orange-200',
    yellow: 'bg-amber-100 border-amber-200',
    green: 'bg-emerald-100 border-emerald-200',
    blue: 'bg-sky-100 border-sky-200',
    purple: 'bg-violet-100 border-violet-200',
    gray: 'bg-slate-100 border-slate-200',
};

// --- Sub-Component: Auto-Resizing Textarea for Checklist ---
const ChecklistTextarea = ({
    value,
    onChange,
    onKeyDown,
    isChecked
}: {
    value: string;
    onChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    isChecked: boolean;
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localValue, setLocalValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);

    // Sync from props if not focused to avoid race conditions
    useEffect(() => {
        if (!isFocused && value !== localValue) {
            setLocalValue(value);
        }
    }, [value, isFocused, localValue]);

    // Debounced update to parent (Store)
    const debouncedOnChange = useRef(
        lodashDebounce((newValue: string) => {
            onChange(newValue);
        }, 500)
    ).current;

    // Auto-resize logic
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [localValue]);

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            value={localValue}
            onChange={(e) => {
                const val = e.target.value;
                setLocalValue(val);
                debouncedOnChange(val);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                setIsFocused(false);
                // Force sync on blur to ensure consistency
                if (localValue !== value) {
                    onChange(localValue);
                }
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
                onKeyDown(e);
            }}
            placeholder="List item..."
            className={cn(
                "flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-300 resize-none overflow-hidden min-h-[24px]",
                isChecked ? "line-through text-slate-400" : ""
            )}
            style={{
                lineHeight: '1.5',
                paddingTop: '2px',
                paddingBottom: '2px'
            }}
            spellCheck={false}
        />
    );
};
// -----------------------------------------------------------

// Use forwardRef for RGL compatibility
export const MemoCard = React.forwardRef<HTMLDivElement, MemoCardProps>(({
    memo,
    onDelete,
    className,
    style,
    onMouseDown,
    onMouseUp,
    onTouchEnd,
    ...props
}, ref) => {
    const updateMemo = useMemoStore(state => state.updateMemo);
    const toggleMemoCollapse = useMemoStore(state => state.toggleMemoCollapse);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Local State for smooth typing
    const [title, setTitle] = useState(memo.title || '');
    const [content, setContent] = useState(memo.content || '');
    const [isFocused, setIsFocused] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Sync from Props (Firestore) -> Local State
    // Only if user is NOT typing (not focused)
    useEffect(() => {
        if (!isFocused && !isEditing) {
            if (memo.title !== title) setTitle(memo.title || '');
            if (memo.content !== content) setContent(memo.content || '');
        }
    }, [memo.title, memo.content, isFocused, isEditing]);

    // Debounced Updaters
    const debouncedUpdateContent = useRef(
        lodashDebounce(async (id: string, newContent: string) => {
            await updateMemo(id, { content: newContent });
        }, 800)
    ).current;

    const debouncedUpdateTitle = useRef(
        lodashDebounce(async (id: string, newTitle: string) => {
            await updateMemo(id, { title: newTitle });
        }, 800)
    ).current;

    // Handlers
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);
        debouncedUpdateContent(memo.id, val);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTitle(val);
        debouncedUpdateTitle(memo.id, val);
    };

    // Formatting Logic
    const handleFormat = (tag: 'b' | 'u', e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isEditing) {
            setIsEditing(true);
            // Use setTimeout to allow render
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    // Append at end if no selection
                    const len = textareaRef.current.value.length;
                    textareaRef.current.setSelectionRange(len, len);
                }
            }, 0);
            return;
        }

        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        if (start === end) return; // No selection

        const wrapper = tag === 'b' ? '**' : '<u>';
        const wrapperEnd = tag === 'b' ? '**' : '</u>';

        const selectedText = content.substring(start, end);
        const newContent = content.substring(0, start) + wrapper + selectedText + wrapperEnd + content.substring(end);

        setContent(newContent);
        debouncedUpdateContent(memo.id, newContent);

        // Restore focus? Might not be needed for simple button click
    };

    const handleCollapseToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag start
        await toggleMemoCollapse(memo.id, {
            isCollapsed: !memo.isCollapsed
        });
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag start
        onDelete();
    };

    return (
        <div
            ref={ref}
            className={cn(
                "flex flex-col w-full h-full rounded-2xl transition-all duration-200",
                "shadow-sm hover:shadow-lg border",
                COLOR_MAP[memo.color] || COLOR_MAP.white,
                memo.isCollapsed ? "shadow-md" : "",
                className
            )}
            style={style}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onTouchEnd={onTouchEnd}
            {...props}
        >
            {/* Header: Glass-like feeling */}
            <div className={cn(
                "flex items-center justify-between px-3 py-2 z-10 shrink-0",
                "rounded-t-2xl border-b border-black/5",
                "bg-white/30 backdrop-blur-sm transition-colors",
                !memo.isCollapsed ? "grid-drag-handle cursor-grab active:cursor-grabbing" : ""
            )}>
                {/* 1. Drag Handle + Type Icon */}
                <div className={cn(
                    "mr-2 text-black/20 flex items-center gap-1",
                    !memo.isCollapsed ? "opacity-100" : "opacity-0"
                )}>
                    <GripHorizontal className="w-4 h-4" />
                </div>

                {/* 2. Title Input */}
                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onMouseDown={(e) => e.stopPropagation()} // Allow text selection
                    placeholder="Title"
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-slate-400 min-w-0"
                />

                {/* 3. Controls */}
                <div className="flex items-center gap-1 ml-2 relative">
                    {/* Color Picker Pattern */}
                    {!memo.isCollapsed && (
                        <div className="relative group/color">
                            <button
                                className={cn(
                                    "p-1.5 rounded-full hover:bg-black/5 transition-colors",
                                    "text-slate-400 hover:text-slate-600"
                                )}
                                title="Change Color"
                            >
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded-full border border-slate-300",
                                    {
                                        'bg-white': memo.color === 'white',
                                        'bg-rose-400': memo.color === 'red',
                                        'bg-orange-400': memo.color === 'orange',
                                        'bg-amber-400': memo.color === 'yellow',
                                        'bg-emerald-400': memo.color === 'green',
                                        'bg-sky-400': memo.color === 'blue',
                                        'bg-violet-400': memo.color === 'purple',
                                        'bg-slate-400': memo.color === 'gray',
                                    }
                                )} />
                            </button>

                            {/* Color Picker Popover (Hover Trigger for ease) */}
                            <div className="absolute top-full right-0 mt-1 p-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 hidden group-hover/color:grid grid-cols-4 gap-2 w-[110px]">
                                {(['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const).map((c) => (
                                    <button
                                        key={c}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateMemo(memo.id, { color: c });
                                        }}
                                        className={cn(
                                            "w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform",
                                            {
                                                'bg-white': c === 'white',
                                                'bg-rose-400': c === 'red',
                                                'bg-orange-400': c === 'orange',
                                                'bg-amber-400': c === 'yellow',
                                                'bg-emerald-400': c === 'green',
                                                'bg-sky-400': c === 'blue',
                                                'bg-violet-400': c === 'purple',
                                                'bg-slate-400': c === 'gray',
                                                'ring-2 ring-slate-400 ring-offset-1': memo.color === c
                                            }
                                        )}
                                        title={c.charAt(0).toUpperCase() + c.slice(1)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Formatting Buttons Removed */}

                    {/* Convert Type Button (Text <-> Checklist) */}
                    {!memo.isCollapsed && (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                const store = useMemoStore.getState();
                                if (memo.type === 'checklist') {
                                    await store.convertToText(memo.id);
                                } else {
                                    await store.convertToChecklist(memo.id);
                                }
                            }}
                            className="p-1.5 rounded-full hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
                            title={memo.type === 'checklist' ? "Convert to Text" : "Convert to Checklist"}
                        >
                            {memo.type === 'checklist' ? (
                                <span className="text-[10px] font-bold">TXT</span>
                            ) : (
                                <span className="text-[10px] font-bold">CHK</span>
                            )}
                        </button>
                    )}

                    <button
                        onClick={handleCollapseToggle}
                        className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-700 transition-colors"
                        title={memo.isCollapsed ? "Expand" : "Collapse"}
                    >
                        {memo.isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>

                    {!memo.isCollapsed && (
                        <button
                            onClick={handleDelete}
                            className="p-1.5 rounded-full hover:bg-red-100 hover:text-red-500 text-slate-400 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Body: Content (Text or Checklist) */}
            <div className={cn(
                "flex-1 w-full min-h-0 relative transition-opacity duration-200 overflow-hidden",
                memo.isCollapsed ? "opacity-0 pointer-events-none hidden" : "opacity-100"
            )}>
                {memo.type === 'checklist' ? (
                    <div className="w-full h-full p-2 overflow-y-auto no-scrollbar" onMouseDown={e => e.stopPropagation()}>
                        {/* Checklist Render */}
                        {(memo.checklistItems || []).map((item, index) => (
                            <div key={item.id} className="flex items-start gap-2 mb-1 group px-1">
                                <input
                                    type="checkbox"
                                    checked={item.isChecked}
                                    onChange={() => useMemoStore.getState().toggleChecklistItem(memo.id, item.id)}
                                    className="mt-1.5 accent-slate-500 cursor-pointer w-3.5 h-3.5 shrink-0"
                                />
                                <ChecklistTextarea
                                    value={item.text}
                                    isChecked={item.isChecked}
                                    onChange={(val) => useMemoStore.getState().updateChecklistItem(memo.id, item.id, val)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            useMemoStore.getState().addChecklistItem(memo.id, '', index + 1);
                                        }
                                        if (e.key === 'Backspace' && item.text === '') {
                                            useMemoStore.getState().deleteChecklistItem(memo.id, item.id);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => useMemoStore.getState().deleteChecklistItem(memo.id, item.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-opacity shrink-0"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {/* Add New Item Button (Ghost) */}
                        <div
                            className="flex items-center gap-2 px-1 py-1 cursor-text opacity-50 hover:opacity-100 transition-opacity"
                            onClick={() => useMemoStore.getState().addChecklistItem(memo.id, '')}
                        >
                            <span className="text-lg text-slate-400">+</span>
                            <span className="text-sm text-slate-400">List Item</span>
                        </div>
                    </div>
                ) : (
                    // Toggle: Markdown View <-> Textarea Edit
                    isEditing || !content ? (
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleContentChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => {
                                setIsFocused(false);
                                if (content.trim()) setIsEditing(false); // Switch to View on blur
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="Write here..."
                            className={cn(
                                "w-full h-full p-4 resize-none bg-transparent border-none outline-none",
                                "text-slate-700 text-sm placeholder:text-slate-300"
                            )}
                            style={{
                                lineHeight: '1.5'
                            }}
                            spellCheck={false}
                            autoFocus={isEditing}
                        />
                    ) : (
                        <div
                            className="w-full h-full p-4 overflow-y-auto cursor-text text-sm text-slate-700 whitespace-pre-wrap"
                            onClick={() => setIsEditing(true)}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <SimpleRenderer content={content} />
                        </div>
                    )
                )}
            </div>
        </div>
    );
});

MemoCard.displayName = "MemoCard";
