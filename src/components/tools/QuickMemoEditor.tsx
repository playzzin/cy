import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMemoStore } from '../../features/smart-memo/store/useMemoStore';
import { debounce } from 'lodash';
import { Loader2, Save, FilePlus } from 'lucide-react';
import { MemoColor } from '../../features/smart-memo/types/memo';
import { cn } from '../../features/smart-memo/lib/utils'; // Assuming this utility exists

const COLORS: MemoColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

export const QuickMemoEditor: React.FC = () => {
    const { currentUser } = useAuth();
    return currentUser ? <QuickMemoSession key={currentUser.uid} userId={currentUser.uid} email={currentUser.email || ''} /> : null;
};

type QuickDraft = { id: string | null; content: string; color: MemoColor; dirty: boolean; revision: number };
const emptyDraft = (): QuickDraft => ({ id: null, content: '', color: 'yellow', dirty: false, revision: 0 });
const updatedMillis = (value: any): number => value?.toMillis?.() ||
    (typeof value?.seconds === 'number' ? value.seconds * 1000 : typeof value === 'number' ? value : Date.parse(value) || 0);

const QuickMemoSession: React.FC<{ userId: string; email: string }> = ({ userId, email }) => {
    const { memos, addMemo, updateMemo, subscribeMemos } = useMemoStore();
    const [status, setStatus] = useState<'ready' | 'saving' | 'error'>('ready');
    const [draft, setDraft] = useState<QuickDraft>(emptyDraft);
    const draftRef = useRef(draft);
    const saveInFlightRef = useRef<Promise<boolean> | null>(null);
    const mountedRef = useRef(true);
    const newDraftRef = useRef(false);
    const { content, color } = draft;
    const publishDraft = useCallback((next: QuickDraft) => {
        draftRef.current = next;
        if (mountedRef.current) setDraft(next);
    }, []);

    // Ensure we are subscribed to memos when this component is active
    useEffect(() => {
        const unsubscribe = subscribeMemos({ uid: userId, email });
        return () => {
            unsubscribe();
        };
    }, [userId, email, subscribeMemos]);

    // Snapshot arrival order must never create a note. Empty drafts stay local.
    useEffect(() => {
        if (draftRef.current.id || draftRef.current.dirty || newDraftRef.current) return;
        const quickMemos = memos.filter(m => m.title === 'Quick Note' && !m.isPinned && m.scope !== 'public' &&
            (m.userId === userId || Boolean(email && m.userId?.toLowerCase() === email.toLowerCase())));
        quickMemos.sort((a, b) => updatedMillis(b.updatedAt) - updatedMillis(a.updatedAt));
        const quickMemo = quickMemos[0];
        if (quickMemo) {
            publishDraft({ id: quickMemo.id, content: quickMemo.content || '', color: quickMemo.color, dirty: false, revision: 0 });
        }
    }, [memos, userId, email, publishDraft]);

    const persistDraft = useCallback((): Promise<boolean> => {
        if (saveInFlightRef.current) return saveInFlightRef.current;
        const initial = draftRef.current;
        if (!initial.dirty || (!initial.id && !initial.content.trim())) return Promise.resolve(true);
        const task = (async () => {
            if (mountedRef.current) setStatus('saving');
            try {
                // Edits made during creation update the same document once its ID arrives.
                while (draftRef.current.dirty) {
                    const saving = draftRef.current;
                    let id = saving.id;
                    if (id) {
                        await updateMemo(id, { content: saving.content, color: saving.color });
                    } else {
                        id = await addMemo({
                            title: 'Quick Note', content: saving.content, color: saving.color,
                            type: 'text', isPinned: false, scope: 'private', order: 0,
                            x: 0, y: 0, w: 4, h: 4, checklistItems: [], tags: [],
                            categoryId: null, isCollapsed: false
                        }, userId);
                    }
                    const latest = draftRef.current;
                    publishDraft({ ...latest, id, dirty: latest.revision !== saving.revision });
                }
                if (mountedRef.current) setStatus('ready');
                return true;
            } catch {
                if (mountedRef.current) setStatus('error');
                return false;
            }
        })();
        saveInFlightRef.current = task;
        void task.finally(() => { saveInFlightRef.current = null; });
        return task;
    }, [addMemo, updateMemo, userId, publishDraft]);

    const saveContent = useMemo(
        () => debounce(() => { void persistDraft(); }, 700),
        [persistDraft]
    );

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            saveContent.cancel();
            void persistDraft();
        };
    }, [persistDraft, saveContent]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const current = draftRef.current;
        publishDraft({ ...current, content: e.target.value, dirty: true, revision: current.revision + 1 });
        saveContent();
    };

    const handleColorChange = (c: MemoColor) => {
        const current = draftRef.current;
        publishDraft({ ...current, color: c, dirty: true, revision: current.revision + 1 });
        saveContent();
    };

    const startNewDraft = async () => {
        saveContent.cancel();
        if (!(await persistDraft()) || !mountedRef.current) return;
        newDraftRef.current = true;
        publishDraft(emptyDraft());
        setStatus('ready');
    };

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
                        onClick={() => void startNewDraft()}
                        disabled={status === 'saving'}
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
                            <span>{draft.dirty ? '입력 중...' : draft.id ? '저장됨' : '입력하면 자동 저장'}</span>
                        </>
                    ) : <button type="button" className="text-red-600" onClick={() => void persistDraft()}>다시 저장</button>}
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
