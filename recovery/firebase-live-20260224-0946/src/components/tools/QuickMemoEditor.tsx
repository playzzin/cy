import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMemoStore } from '../../features/smart-memo/store/useMemoStore';
import { debounce } from 'lodash';
import { Loader2, Save, FilePlus } from 'lucide-react';
import { MemoColor } from '../../features/smart-memo/types/memo';
import { cn } from '../../features/smart-memo/lib/utils'; // Assuming this utility exists

const COLORS: MemoColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

export const QuickMemoEditor: React.FC = () => {
    const { currentUser } = useAuth();
    const { memos, addMemo, updateMemo, subscribeMemos } = useMemoStore();

    const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
    const [memoId, setMemoId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [color, setColor] = useState<MemoColor>('yellow'); // Default to yellow for "Post-it" feel

    // Ensure we are subscribed to memos when this component is active
    useEffect(() => {
        if (!currentUser) return;
        const unsubscribe = subscribeMemos(currentUser.uid);
        return () => {
            unsubscribe();
        };
    }, [currentUser, subscribeMemos]);

    // Find or Create "Quick Note"
    useEffect(() => {
        if (!currentUser) return;
        if (memos.length === 0) return; // Wait for memos to load

        // Try to find existing Quick Note (Pick the latest one)
        const quickMemos = memos.filter(m => m.title === 'Quick Note' && !m.isPinned);
        // Sort by updatedAt desc (assuming timestamp objects or numbers)
        quickMemos.sort((a, b) => {
            const timeA = a.updatedAt?.seconds ? a.updatedAt.seconds : (a.updatedAt || 0);
            const timeB = b.updatedAt?.seconds ? b.updatedAt.seconds : (b.updatedAt || 0);
            return timeB - timeA;
        });

        const quickMemo = quickMemos[0];

        if (quickMemo) {
            setMemoId(quickMemo.id);
            setContent(quickMemo.content);
            setColor(quickMemo.color);
            setStatus('ready');
        } else {
            // Create new one
            const createInit = async () => {
                try {
                    const newId = await addMemo({
                        title: 'Quick Note',
                        content: '',
                        color: 'yellow',
                        type: 'text',
                        isPinned: false,
                        scope: 'private',
                        order: 0,
                        x: 0,
                        y: 0,
                        w: 4,
                        h: 4,
                        checklistItems: [],
                        tags: [],
                        categoryId: null,
                        isCollapsed: false,
                    }, currentUser.uid);
                    setMemoId(newId);
                    setStatus('ready');
                } catch (e) {
                    console.error("Failed to create quick memo", e);
                    setStatus('error');
                }
            };
            // Prevent multiple creations if re-renders happen fast
            // Check if we already have a pending creation? 
            // Simplified: just strictly check again inside
            createInit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, memos.length === 0]); // Run once when memos load

    // Debounced Save
    const saveContent = useMemo(
        () => debounce(async (id: string, newContent: string, newColor: MemoColor) => {
            setStatus('saving');
            try {
                await updateMemo(id, { content: newContent, color: newColor });
                setStatus('ready');
            } catch (e) {
                setStatus('error');
            }
        }, 1000),
        [updateMemo]
    );

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);
        if (memoId) {
            saveContent(memoId, val, color);
        }
    };

    const handleColorChange = (c: MemoColor) => {
        setColor(c);
        if (memoId) {
            saveContent(memoId, content, c);
        }
    };

    // If still initial loading
    if ((status === 'loading' || !memoId) && memos.length === 0) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col h-full rounded-lg shadow-inner overflow-hidden transition-colors duration-300",
            color === 'white' ? "bg-white" :
                color === 'red' ? "bg-[#ffebec]" :
                    color === 'orange' ? "bg-[#fff0e0]" :
                        color === 'yellow' ? "bg-[#fffbe0]" :
                            color === 'green' ? "bg-[#e6fdec]" :
                                color === 'blue' ? "bg-[#e3f2fd]" :
                                    color === 'purple' ? "bg-[#f3e5f5]" :
                                        "bg-[#f5f5f5]"
        )}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-black/5 bg-black/5">
                <div className="flex gap-1.5 items-center">
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            onClick={() => handleColorChange(c)}
                            className={cn(
                                "w-4 h-4 rounded-full border border-black/10 transition-transform hover:scale-110",
                                color === c && "ring-1 ring-offset-1 ring-slate-400 scale-110",
                                c === 'white' && "bg-white",
                                c === 'red' && "bg-[#ffebec]",
                                c === 'orange' && "bg-[#fff0e0]",
                                c === 'yellow' && "bg-[#fffbe0]",
                                c === 'green' && "bg-[#e6fdec]",
                                c === 'blue' && "bg-[#e3f2fd]",
                                c === 'purple' && "bg-[#f3e5f5]",
                                c === 'gray' && "bg-[#f5f5f5]"
                            )}
                        />
                    ))}
                    <div className="w-px h-3 bg-slate-300 mx-1.5" />
                    <button
                        onClick={async () => {
                            if (!currentUser) return;
                            setStatus('saving');
                            try {
                                const newId = await addMemo({
                                    title: 'Quick Note',
                                    content: '',
                                    color: 'yellow',
                                    type: 'text',
                                    isPinned: false,
                                    scope: 'private',
                                    order: 0,
                                    x: 0,
                                    y: 0,
                                    w: 4,
                                    h: 4,
                                    checklistItems: [],
                                    tags: [],
                                    categoryId: null,
                                    isCollapsed: false,
                                }, currentUser.uid);
                                setMemoId(newId);
                                setContent('');
                                setColor('yellow');
                                setStatus('ready');
                            } catch (e) {
                                console.error("Failed to create new quick memo", e);
                                setStatus('error');
                            }
                        }}
                        className="p-1 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                        title="새 메모 작성"
                    >
                        <FilePlus className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                    {status === 'saving' ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>저장 중...</span>
                        </>
                    ) : status === 'ready' ? (
                        <>
                            <Save className="w-3 h-3" />
                            <span>저장됨</span>
                        </>
                    ) : null}
                </div>
            </div>

            {/* Editor */}
            <textarea
                className="flex-1 w-full resize-none bg-transparent p-4 text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed"
                placeholder="간단한 메모를 입력하세요 (자동 저장됨)"
                value={content}
                onChange={handleContentChange}
            />
        </div>
    );
};
