import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import {
    Check as LucideCheck,
    CheckSquare as LucideCheckSquare,
    Clock3 as LucideClock3,
    FileText as LucideFileText,
    FolderPlus as LucideFolderPlus,
    MoveRight as LucideMoveRight,
    Pencil as LucidePencil,
    Plus as LucidePlus,
    Save as LucideSave,
    Search as LucideSearch,
    Trash2 as LucideTrash2,
    X as LucideX
} from 'lucide-react';

import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';

const MEMO_COLLECTION = 'smart_memos';
const CATEGORY_COLLECTION = 'smart_memo_categories';
const CATEGORY_COLORS = ['#dc2626', '#f97316', '#facc15', '#2563eb', '#1e3a8a', '#7c3aed'];
const BATCH_WRITE_SIZE = 450;

type MemoType = 'text' | 'checklist';
type MemoViewMode = 'split' | 'sticky';

type ChecklistCommentRecord = {
    id: string;
    text: string;
    createdAt: number;
};

type ChecklistItemRecord = {
    id: string;
    text: string;
    isChecked: boolean;
    comments?: ChecklistCommentRecord[];
};

type MemoRecord = {
    id: string;
    type: MemoType;
    title: string;
    content: string;
    checklistItems: ChecklistItemRecord[];
    categoryId: string | null;
    order: number;
    createdAt?: unknown;
    updatedAt?: unknown;
};

type CategoryRecord = {
    id: string;
    name: string;
    order: number;
    color?: string;
};

type TimestampLike = {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
};

type IconProps = {
    className?: string;
};

type IconComponent = React.ElementType<IconProps>;

const EmptyIcon = ({ className }: IconProps) => <span aria-hidden="true" className={className} />;
const iconOrFallback = (Icon: IconComponent | undefined): IconComponent => Icon ?? EmptyIcon;

const Check = iconOrFallback(LucideCheck);
const CheckSquare = iconOrFallback(LucideCheckSquare);
const Clock3 = iconOrFallback(LucideClock3);
const FileText = iconOrFallback(LucideFileText);
const FolderPlus = iconOrFallback(LucideFolderPlus);
const MoveRight = iconOrFallback(LucideMoveRight);
const Pencil = iconOrFallback(LucidePencil);
const Plus = iconOrFallback(LucidePlus);
const Save = iconOrFallback(LucideSave);
const Search = iconOrFallback(LucideSearch);
const Trash2 = iconOrFallback(LucideTrash2);
const X = iconOrFallback(LucideX);

const getTimestampMillis = (value: unknown) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Date.parse(value) || 0;

    if (typeof value === 'object') {
        const timestamp = value as TimestampLike;
        if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
        if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
        if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
    }

    return 0;
};

const formatDate = (value: unknown) => {
    const millis = getTimestampMillis(value);
    if (!millis) return '방금 전';

    return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(millis));
};

const generateChecklistItemId = () => {
    const cryptoApi = typeof globalThis !== 'undefined'
        ? (globalThis.crypto as { randomUUID?: () => string } | undefined)
        : undefined;

    if (typeof cryptoApi?.randomUUID === 'function') {
        return cryptoApi.randomUUID();
    }

    return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
};

const createChecklistItem = (text = '', isChecked = false): ChecklistItemRecord => ({
    id: generateChecklistItemId(),
    text,
    isChecked
});

const normalizeChecklistComments = (value: unknown): ChecklistCommentRecord[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    const comments = value
        .map(comment => {
            if (!comment || typeof comment !== 'object') return null;
            const record = comment as Record<string, unknown>;
            const text = typeof record.text === 'string' ? record.text : '';
            if (!text.trim()) return null;

            return {
                id: typeof record.id === 'string' && record.id ? record.id : generateChecklistItemId(),
                text,
                createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now()
            };
        })
        .filter((comment): comment is ChecklistCommentRecord => Boolean(comment));

    return comments.length > 0 ? comments : undefined;
};

const normalizeChecklistItems = (value: unknown): ChecklistItemRecord[] => {
    if (!Array.isArray(value)) return [];

    return value.map(item => {
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};

        return {
            id: typeof record.id === 'string' && record.id ? record.id : generateChecklistItemId(),
            text: typeof record.text === 'string' ? record.text : '',
            isChecked: record.isChecked === true,
            comments: normalizeChecklistComments(record.comments)
        };
    });
};

const parseChecklistLine = (line: string): ChecklistItemRecord => {
    const checkedMatch = line.match(/^\s*(?:[-*]\s*)?\[(x|X| )\]\s*(.*)$/);
    if (checkedMatch) {
        return createChecklistItem(checkedMatch[2].trim(), checkedMatch[1].toLowerCase() === 'x');
    }

    return createChecklistItem(line.trim(), false);
};

const checklistItemsFromText = (content: string): ChecklistItemRecord[] => {
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(parseChecklistLine);
};

const checklistItemsToText = (items: ChecklistItemRecord[]) => {
    return items
        .map(item => item.isChecked ? `[x] ${item.text}` : item.text)
        .join('\n');
};

const prepareChecklistItemsForSave = (items: ChecklistItemRecord[]) => {
    return items
        .map(item => {
            const next: ChecklistItemRecord = {
                id: item.id,
                text: item.text.trim(),
                isChecked: item.isChecked
            };

            if (item.comments && item.comments.length > 0) {
                next.comments = item.comments;
            }

            return next;
        })
        .filter(item => item.text || item.isChecked);
};

const checklistItemsEqual = (a: ChecklistItemRecord[], b: ChecklistItemRecord[]) => {
    return JSON.stringify(prepareChecklistItemsForSave(a)) === JSON.stringify(prepareChecklistItemsForSave(b));
};

const normalizeMemo = (id: string, data: Record<string, unknown>): MemoRecord => {
    const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
    const rawContent = typeof data.content === 'string' ? data.content : '';
    const type: MemoType = data.type === 'checklist' ? 'checklist' : 'text';
    const rawChecklistItems = normalizeChecklistItems(data.checklistItems);
    const checklistItems = rawChecklistItems.length > 0 || type !== 'checklist'
        ? rawChecklistItems
        : checklistItemsFromText(rawContent);
    const rawCategoryId = typeof data.categoryId === 'string' ? data.categoryId : null;
    const categoryId = rawCategoryId && rawCategoryId !== 'public' ? rawCategoryId : null;
    const rawOrder = typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0;

    return {
        id,
        type,
        title: rawTitle || '제목 없음',
        content: rawContent,
        checklistItems,
        categoryId,
        order: rawOrder,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
};

const normalizeCategory = (id: string, data: Record<string, unknown>, fallbackOrder: number): CategoryRecord => ({
    id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '새 카테고리',
    order: typeof data.order === 'number' ? data.order : fallbackOrder,
    color: typeof data.color === 'string' ? data.color : CATEGORY_COLORS[fallbackOrder % CATEGORY_COLORS.length]
});

const sortMemos = (items: MemoRecord[]) => {
    return [...items].sort((a, b) => {
        if (a.order !== b.order) return b.order - a.order;

        const bTime = getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAt);
        const aTime = getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAt);
        if (aTime !== bTime) return bTime - aTime;

        return a.title.localeCompare(b.title, 'ko-KR') || a.id.localeCompare(b.id);
    });
};

const composeMemoText = (title: string, content: string) => {
    return content ? `${title}\n${content}` : title;
};

const normalizeMemoTitle = (value: string) => value.trim() || '제목 없음';

const parseMemoText = (value: string) => {
    const lines = value.replace(/\r\n/g, '\n').split('\n');
    const rawTitle = lines.shift() ?? '';

    return {
        title: normalizeMemoTitle(rawTitle),
        content: lines.join('\n')
    };
};

const hexToRgba = (color: string, alpha: number) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
    if (!match) return `rgba(148, 163, 184, ${alpha})`;

    const value = Number.parseInt(match[1], 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const buildAccentTheme = (color: string) => ({
    border: hexToRgba(color, 0.42),
    surface: hexToRgba(color, 0.1),
    header: hexToRgba(color, 0.2),
    strip: hexToRgba(color, 0.14),
    strong: color
});

export function MemoPage() {
    const { currentUser } = useAuth();

    const [memos, setMemos] = useState<MemoRecord[]>([]);
    const [categories, setCategories] = useState<CategoryRecord[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
    const [checkedMemoIds, setCheckedMemoIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<MemoViewMode>('split');
    const [moveTargetCategoryId, setMoveTargetCategoryId] = useState('uncategorized');
    const [draftText, setDraftText] = useState('');
    const [draftMemoType, setDraftMemoType] = useState<MemoType>('text');
    const [draftTitle, setDraftTitle] = useState('');
    const [draftChecklistItems, setDraftChecklistItems] = useState<ChecklistItemRecord[]>([]);
    const [draftCategoryId, setDraftCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState(CATEGORY_COLORS[0]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const editorRef = useRef<HTMLElement | null>(null);
    const statusTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!currentUser?.uid) {
            setMemos([]);
            setCategories([]);
            setSelectedMemoId(null);
            setCheckedMemoIds([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const categoryQuery = query(
            collection(db, CATEGORY_COLLECTION),
            where('userId', '==', currentUser.uid)
        );
        const memoQuery = query(
            collection(db, MEMO_COLLECTION),
            where('userId', '==', currentUser.uid)
        );

        const unsubscribeCategories = onSnapshot(
            categoryQuery,
            snapshot => {
                const nextCategories = snapshot.docs
                    .map((categoryDoc, index) => normalizeCategory(categoryDoc.id, categoryDoc.data(), index))
                    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko-KR'));

                setCategories(nextCategories);
            },
            error => {
                console.error('Failed to load memo categories:', error);
                setErrorMessage('카테고리를 불러오지 못했습니다.');
            }
        );

        const unsubscribeMemos = onSnapshot(
            memoQuery,
            snapshot => {
                const nextMemos = snapshot.docs.map(memoDoc => normalizeMemo(memoDoc.id, memoDoc.data()));
                setMemos(sortMemos(nextMemos));
                setIsLoading(false);
            },
            error => {
                console.error('Failed to load memos:', error);
                setErrorMessage('메모를 불러오지 못했습니다.');
                setIsLoading(false);
            }
        );

        return () => {
            unsubscribeCategories();
            unsubscribeMemos();
        };
    }, [currentUser?.uid]);

    useEffect(() => {
        return () => {
            if (statusTimerRef.current !== null) {
                window.clearTimeout(statusTimerRef.current);
            }
        };
    }, []);

    const categoryNameById = useMemo(() => {
        return categories.reduce<Record<string, string>>((acc, category) => {
            acc[category.id] = category.name;
            return acc;
        }, {});
    }, [categories]);

    const categoryById = useMemo(() => {
        return categories.reduce<Record<string, CategoryRecord>>((acc, category) => {
            acc[category.id] = category;
            return acc;
        }, {});
    }, [categories]);

    const categoryCounts = useMemo(() => {
        const counts = new Map<string, number>();
        let uncategorized = 0;

        memos.forEach(memo => {
            if (!memo.categoryId) {
                uncategorized += 1;
                return;
            }

            counts.set(memo.categoryId, (counts.get(memo.categoryId) ?? 0) + 1);
        });

        return { counts, uncategorized };
    }, [memos]);

    const filteredMemos = useMemo(() => {
        const queryText = searchQuery.trim().toLowerCase();

        return memos.filter(memo => {
            const matchesCategory =
                selectedCategoryId === 'all' ||
                (selectedCategoryId === 'uncategorized' && !memo.categoryId) ||
                memo.categoryId === selectedCategoryId;

            if (!matchesCategory) return false;
            if (!queryText) return true;

            const checklistText = memo.checklistItems.map(item => item.text).join(' ').toLowerCase();

            return (
                memo.title.toLowerCase().includes(queryText) ||
                memo.content.toLowerCase().includes(queryText) ||
                checklistText.includes(queryText) ||
                (memo.categoryId ? categoryNameById[memo.categoryId]?.toLowerCase().includes(queryText) : false)
            );
        });
    }, [categoryNameById, memos, searchQuery, selectedCategoryId]);

    const selectedMemo = useMemo(
        () => memos.find(memo => memo.id === selectedMemoId) ?? null,
        [memos, selectedMemoId]
    );

    const checkedMemoIdSet = useMemo(() => new Set(checkedMemoIds), [checkedMemoIds]);
    const filteredMemoIds = useMemo(() => filteredMemos.map(memo => memo.id), [filteredMemos]);
    const allFilteredChecked = filteredMemoIds.length > 0 && filteredMemoIds.every(id => checkedMemoIdSet.has(id));

    const selectedCategoryLabel =
        selectedCategoryId === 'all'
            ? '전체 메모'
            : selectedCategoryId === 'uncategorized'
                ? '분류 없음'
                : categoryNameById[selectedCategoryId] ?? '카테고리';

    useEffect(() => {
        const liveMemoIds = new Set(memos.map(memo => memo.id));

        setCheckedMemoIds(previous => {
            const next = previous.filter(id => liveMemoIds.has(id));
            return next.length === previous.length ? previous : next;
        });
    }, [memos]);

    useEffect(() => {
        const filteredIdSet = new Set(filteredMemoIds);

        setSelectedMemoId(previous => {
            if (previous && filteredIdSet.has(previous)) return previous;
            return filteredMemoIds[0] ?? null;
        });
    }, [filteredMemoIds]);

    useEffect(() => {
        if (!selectedMemo) {
            setDraftText('');
            setDraftMemoType('text');
            setDraftTitle('');
            setDraftChecklistItems([]);
            setDraftCategoryId('');
            return;
        }

        setDraftText(composeMemoText(selectedMemo.title, selectedMemo.content));
        setDraftMemoType(selectedMemo.type);
        setDraftTitle(selectedMemo.title);
        setDraftChecklistItems(selectedMemo.checklistItems);
        setDraftCategoryId(selectedMemo.categoryId ?? '');
    }, [selectedMemo]);

    const parsedDraft = useMemo(() => parseMemoText(draftText), [draftText]);
    const draftTextParts = useMemo(() => {
        const lines = draftText.replace(/\r\n/g, '\n').split('\n');
        const title = lines.shift() ?? '';
        return {
            title,
            content: lines.join('\n')
        };
    }, [draftText]);

    const hasDraftChanges = Boolean(
        selectedMemo &&
        (draftMemoType !== selectedMemo.type ||
            draftCategoryId !== (selectedMemo.categoryId ?? '') ||
            (draftMemoType === 'text'
                ? parsedDraft.title !== selectedMemo.title || parsedDraft.content !== selectedMemo.content
                : normalizeMemoTitle(draftTitle) !== selectedMemo.title ||
                    !checklistItemsEqual(draftChecklistItems, selectedMemo.checklistItems)))
    );

    const showStatus = useCallback((message: string) => {
        setStatusMessage(message);

        if (statusTimerRef.current !== null) {
            window.clearTimeout(statusTimerRef.current);
        }

        statusTimerRef.current = window.setTimeout(() => {
            setStatusMessage('');
            statusTimerRef.current = null;
        }, 1800);
    }, []);

    const getCategoryLabel = (categoryId: string | null) => {
        return categoryId ? categoryNameById[categoryId] ?? '분류 없음' : '분류 없음';
    };

    const getCategoryColor = (categoryId: string | null) => {
        return categoryId ? categoryById[categoryId]?.color ?? '#64748b' : '#94a3b8';
    };

    const activeListCategoryColor =
        selectedCategoryId !== 'all' && selectedCategoryId !== 'uncategorized'
            ? getCategoryColor(selectedCategoryId)
            : selectedMemo
                ? getCategoryColor(selectedMemo.categoryId)
                : '#f97316';
    const listAccentTheme = buildAccentTheme(activeListCategoryColor);
    const draftAccentTheme = buildAccentTheme(getCategoryColor(draftCategoryId || null));

    const renderStickyMemoBody = (memo: MemoRecord) => {
        if (memo.type === 'checklist') {
            if (memo.checklistItems.length === 0) {
                return <p className="text-sm font-semibold text-slate-400">체크리스트가 비어 있습니다.</p>;
            }

            return (
                <ul className="space-y-2">
                    {memo.checklistItems.map(item => (
                        <li key={item.id} className="flex items-start gap-2 text-sm leading-5">
                            <span
                                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold ${
                                    item.isChecked
                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                        : 'border-slate-300 bg-white text-transparent'
                                }`}
                            >
                                ✓
                            </span>
                            <span className={item.isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}>
                                {item.text || '빈 항목'}
                            </span>
                        </li>
                    ))}
                </ul>
            );
        }

        return memo.content.trim() ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{memo.content}</p>
        ) : (
            <p className="text-sm font-semibold text-slate-400">본문 미작성</p>
        );
    };

    const deleteMemosByIds = async (memoIds: string[], successMessage: string) => {
        if (memoIds.length === 0) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            for (let index = 0; index < memoIds.length; index += BATCH_WRITE_SIZE) {
                const batch = writeBatch(db);
                memoIds.slice(index, index + BATCH_WRITE_SIZE).forEach(memoId => {
                    batch.delete(doc(db, MEMO_COLLECTION, memoId));
                });
                await batch.commit();
            }

            setCheckedMemoIds(previous => previous.filter(id => !memoIds.includes(id)));
            if (selectedMemoId && memoIds.includes(selectedMemoId)) {
                setSelectedMemoId(null);
            }

            showStatus(successMessage);
        } catch (error) {
            console.error('Failed to delete memos:', error);
            setErrorMessage('메모를 삭제하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const moveMemosToCategory = async (memoIds: string[], targetCategoryId: string | null) => {
        if (!currentUser?.uid || memoIds.length === 0) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            for (let index = 0; index < memoIds.length; index += BATCH_WRITE_SIZE) {
                const batch = writeBatch(db);
                memoIds.slice(index, index + BATCH_WRITE_SIZE).forEach(memoId => {
                    batch.update(doc(db, MEMO_COLLECTION, memoId), {
                        categoryId: targetCategoryId,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
            }

            if (selectedMemoId && memoIds.includes(selectedMemoId)) {
                setDraftCategoryId(targetCategoryId ?? '');
            }

            const label = targetCategoryId ? categoryNameById[targetCategoryId] ?? '선택 카테고리' : '분류 없음';
            showStatus(`${memoIds.length.toLocaleString('ko-KR')}개 메모를 ${label}(으)로 이동했습니다.`);
        } catch (error) {
            console.error('Failed to move memos:', error);
            setErrorMessage('메모 카테고리를 이동하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const createMemo = async (type: MemoType = 'text') => {
        if (!currentUser?.uid) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            const categoryId =
                selectedCategoryId !== 'all' && selectedCategoryId !== 'uncategorized'
                    ? selectedCategoryId
                    : null;
            const title = type === 'checklist' ? '새 체크리스트' : '새 메모';
            const checklistItems = type === 'checklist' ? [createChecklistItem('')] : [];

            const memoRef = await addDoc(collection(db, MEMO_COLLECTION), {
                userId: currentUser.uid,
                scope: 'private',
                type,
                title,
                content: '',
                checklistItems,
                categoryId,
                color: 'white',
                isPinned: false,
                order: Date.now(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setSelectedMemoId(memoRef.id);
            setViewMode(current => current === 'sticky' ? 'sticky' : 'split');
            setDraftText(title);
            setDraftMemoType(type);
            setDraftTitle(title);
            setDraftChecklistItems(checklistItems);
            setDraftCategoryId(categoryId ?? '');
            showStatus(type === 'checklist' ? '새 체크리스트를 만들었습니다.' : '새 메모를 만들었습니다.');
        } catch (error) {
            console.error('Failed to create memo:', error);
            setErrorMessage('메모를 만들지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const saveMemo = async () => {
        if (!currentUser?.uid || !selectedMemo) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            const checklistItems = prepareChecklistItemsForSave(draftChecklistItems);
            const nextTitle = draftMemoType === 'checklist'
                ? normalizeMemoTitle(draftTitle)
                : parsedDraft.title;
            const nextContent = draftMemoType === 'checklist' ? '' : parsedDraft.content;

            await updateDoc(doc(db, MEMO_COLLECTION, selectedMemo.id), {
                type: draftMemoType,
                title: nextTitle,
                content: nextContent,
                checklistItems: draftMemoType === 'checklist' ? checklistItems : [],
                categoryId: draftCategoryId || null,
                updatedAt: serverTimestamp()
            });

            setDraftText(composeMemoText(nextTitle, nextContent));
            setDraftTitle(nextTitle);
            setDraftChecklistItems(checklistItems);
            showStatus('저장했습니다.');
        } catch (error) {
            console.error('Failed to save memo:', error);
            setErrorMessage('메모를 저장하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const switchDraftType = (type: MemoType) => {
        if (draftMemoType === type) return;

        if (type === 'checklist') {
            const currentDraft = parseMemoText(draftText);
            const items = checklistItemsFromText(currentDraft.content);

            setDraftMemoType('checklist');
            setDraftTitle(currentDraft.title);
            setDraftChecklistItems(items.length > 0 ? items : [createChecklistItem('')]);
            return;
        }

        setDraftMemoType('text');
        setDraftText(composeMemoText(
            normalizeMemoTitle(draftTitle),
            checklistItemsToText(draftChecklistItems)
        ));
    };

    const addDraftChecklistItem = (index?: number) => {
        setDraftChecklistItems(previous => {
            const next = [...previous];
            const nextIndex = typeof index === 'number' ? index : next.length;
            next.splice(nextIndex, 0, createChecklistItem(''));
            return next;
        });
    };

    const updateDraftChecklistItem = (
        itemId: string,
        updates: Partial<Pick<ChecklistItemRecord, 'text' | 'isChecked'>>
    ) => {
        setDraftChecklistItems(previous =>
            previous.map(item => item.id === itemId ? { ...item, ...updates } : item)
        );
    };

    const deleteDraftChecklistItem = (itemId: string) => {
        setDraftChecklistItems(previous => previous.filter(item => item.id !== itemId));
    };

    const handleChecklistItemKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number, item: ChecklistItemRecord) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addDraftChecklistItem(index + 1);
        }

        if (event.key === 'Backspace' && item.text === '' && draftChecklistItems.length > 1) {
            event.preventDefault();
            deleteDraftChecklistItem(item.id);
        }
    };

    const focusMemoEditor = (memoId: string) => {
        setViewMode('split');
        setSelectedMemoId(memoId);
        window.requestAnimationFrame(() => {
            editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const selectStickyMemo = (memo: MemoRecord) => {
        setSelectedMemoId(memo.id);
        setDraftText(composeMemoText(memo.title, memo.content));
        setDraftMemoType(memo.type);
        setDraftTitle(memo.title);
        setDraftChecklistItems(memo.checklistItems);
        setDraftCategoryId(memo.categoryId ?? '');
    };

    const updateTextDraftTitle = (title: string) => {
        setDraftText(composeMemoText(title, draftTextParts.content));
    };

    const updateTextDraftContent = (content: string) => {
        setDraftText(composeMemoText(draftTextParts.title, content));
    };

    const deleteMemoRecord = async (memo: MemoRecord) => {
        if (!window.confirm(`"${memo.title}" 메모를 삭제할까요?`)) return;
        await deleteMemosByIds([memo.id], '메모를 삭제했습니다.');
    };

    const deleteMemo = async () => {
        if (!selectedMemo) return;
        await deleteMemoRecord(selectedMemo);
    };

    const deleteCheckedMemos = async () => {
        if (checkedMemoIds.length === 0) return;
        if (!window.confirm(`선택한 ${checkedMemoIds.length.toLocaleString('ko-KR')}개 메모를 삭제할까요?`)) return;
        await deleteMemosByIds(checkedMemoIds, '선택한 메모를 삭제했습니다.');
    };

    const createCategory = async () => {
        if (!currentUser?.uid) return;

        const name = newCategoryName.trim();
        if (!name) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            await addDoc(collection(db, CATEGORY_COLLECTION), {
                userId: currentUser.uid,
                name,
                order: Date.now(),
                color: newCategoryColor,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setNewCategoryName('');
            setNewCategoryColor(CATEGORY_COLORS[(categories.length + 1) % CATEGORY_COLORS.length]);
            showStatus('카테고리를 추가했습니다.');
        } catch (error) {
            console.error('Failed to create category:', error);
            setErrorMessage('카테고리를 추가하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const startEditCategory = (category: CategoryRecord) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
        setEditingCategoryColor(category.color ?? CATEGORY_COLORS[0]);
    };

    const saveCategory = async (category: CategoryRecord) => {
        const name = editingCategoryName.trim();
        if (!name) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            await updateDoc(doc(db, CATEGORY_COLLECTION, category.id), {
                name,
                color: editingCategoryColor,
                updatedAt: serverTimestamp()
            });

            setEditingCategoryId(null);
            setEditingCategoryName('');
            setEditingCategoryColor(CATEGORY_COLORS[0]);
            showStatus('카테고리를 저장했습니다.');
        } catch (error) {
            console.error('Failed to save category:', error);
            setErrorMessage('카테고리를 저장하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteCategory = async (category: CategoryRecord) => {
        if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요? 메모는 분류 없음으로 이동합니다.`)) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            const affectedMemos = memos.filter(memo => memo.categoryId === category.id);

            for (let index = 0; index < affectedMemos.length; index += BATCH_WRITE_SIZE) {
                const batch = writeBatch(db);
                affectedMemos.slice(index, index + BATCH_WRITE_SIZE).forEach(memo => {
                    batch.update(doc(db, MEMO_COLLECTION, memo.id), {
                        categoryId: null,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
            }

            await deleteDoc(doc(db, CATEGORY_COLLECTION, category.id));

            if (selectedCategoryId === category.id) {
                setSelectedCategoryId('all');
            }
            if (draftCategoryId === category.id) {
                setDraftCategoryId('');
            }

            showStatus('카테고리를 삭제했습니다.');
        } catch (error) {
            console.error('Failed to delete category:', error);
            setErrorMessage('카테고리를 삭제하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleMemoChecked = (memoId: string) => {
        setCheckedMemoIds(previous =>
            previous.includes(memoId) ? previous.filter(id => id !== memoId) : [...previous, memoId]
        );
    };

    const toggleFilteredChecked = () => {
        setCheckedMemoIds(previous => {
            const filteredIdSet = new Set(filteredMemoIds);
            if (allFilteredChecked) {
                return previous.filter(id => !filteredIdSet.has(id));
            }

            return Array.from(new Set([...previous, ...filteredMemoIds]));
        });
    };

    const handleMoveChecked = () => {
        const targetCategoryId = moveTargetCategoryId === 'uncategorized' ? null : moveTargetCategoryId;
        void moveMemosToCategory(checkedMemoIds, targetCategoryId);
    };

    const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void createCategory();
        }
    };

    const handleEditCategoryKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
        category: CategoryRecord
    ) => {
        if (event.key === 'Enter') {
            void saveCategory(category);
        }
        if (event.key === 'Escape') {
            setEditingCategoryId(null);
            setEditingCategoryName('');
            setEditingCategoryColor(CATEGORY_COLORS[0]);
        }
    };

    const renderColorOptions = (
        selectedColor: string,
        onSelect: (color: string) => void,
        compact = false
    ) => (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="카테고리 색상 선택">
            {CATEGORY_COLORS.map(color => {
                const isSelected = selectedColor === color;

                return (
                    <button
                        key={color}
                        type="button"
                        onClick={() => onSelect(color)}
                        className={`${compact ? 'h-6 w-6' : 'h-7 w-7'} rounded-full border-2 transition ${
                            isSelected ? 'border-slate-950 ring-2 ring-slate-200' : 'border-white hover:border-slate-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={`색상 ${color}`}
                        aria-label={`카테고리 색상 ${color}`}
                    />
                );
            })}
        </div>
    );

    if (!currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-700">
                로그인이 필요합니다.
            </div>
        );
    }

    const memoCategoryPicker = (
        <div
            className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 p-1.5"
            aria-label="메모 카테고리 색상 선택"
        >
            <button
                type="button"
                onClick={() => setDraftCategoryId('')}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-bold transition ${
                    draftCategoryId === ''
                        ? 'border-slate-900 bg-white text-slate-950 shadow-sm ring-2 ring-indigo-100'
                        : 'border-transparent bg-transparent text-slate-600 hover:bg-white/80'
                }`}
                title="분류 없음"
            >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-slate-300" />
                <span className="hidden sm:inline">분류 없음</span>
            </button>
            {categories.map(category => {
                const isSelected = draftCategoryId === category.id;

                return (
                    <button
                        key={category.id}
                        type="button"
                        onClick={() => setDraftCategoryId(category.id)}
                        className={`inline-flex h-8 max-w-[150px] items-center gap-1.5 rounded-md border px-2 text-xs font-bold transition ${
                            isSelected
                                ? 'border-slate-900 bg-white text-slate-950 shadow-sm ring-2 ring-indigo-100'
                                : 'border-transparent bg-transparent text-slate-600 hover:bg-white/80'
                        }`}
                        title={category.name}
                    >
                        <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                        />
                        <span className="hidden truncate lg:inline">{category.name}</span>
                    </button>
                );
            })}
        </div>
    );

    const categoryList = (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-blue-100 px-2 py-1.5">
                <span className="text-xs font-bold text-blue-900">카테고리</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    {categories.length.toLocaleString('ko-KR')}개
                </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-sm font-semibold transition ${
                    selectedCategoryId === 'all'
                        ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                        : 'border-blue-100 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-100/60'
                }`}
            >
                <span>전체</span>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                        selectedCategoryId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                    {memos.length}
                </span>
            </button>
            <button
                type="button"
                onClick={() => setSelectedCategoryId('uncategorized')}
                className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-sm font-semibold transition ${
                    selectedCategoryId === 'uncategorized'
                        ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                        : 'border-blue-100 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-100/60'
                }`}
            >
                <span>분류 없음</span>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                        selectedCategoryId === 'uncategorized' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                    {categoryCounts.uncategorized}
                </span>
            </button>

            {categories.map(category => {
                const isEditing = editingCategoryId === category.id;
                const isSelected = selectedCategoryId === category.id;

                if (isEditing) {
                    return (
                        <div key={category.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <div className="flex h-8 items-center gap-1">
                                <input
                                    value={editingCategoryName}
                                    onChange={event => setEditingCategoryName(event.target.value)}
                                    onKeyDown={event => handleEditCategoryKeyDown(event, category)}
                                    className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-600"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => void saveCategory(category)}
                                    className="grid h-8 w-8 place-items-center rounded-md text-emerald-700 hover:bg-white"
                                    title="저장"
                                >
                                    <Check className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingCategoryId(null);
                                        setEditingCategoryName('');
                                        setEditingCategoryColor(CATEGORY_COLORS[0]);
                                    }}
                                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-white"
                                    title="취소"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-emerald-800">색상</span>
                                {renderColorOptions(editingCategoryColor, setEditingCategoryColor, true)}
                            </div>
                        </div>
                    );
                }

                return (
                    <div
                        key={category.id}
                        className={`group flex h-10 items-center rounded-lg border transition ${
                            isSelected
                                ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                                : 'border-blue-100 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-100/60'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryId(category.id)}
                            className="flex h-full min-w-0 flex-1 items-center justify-between gap-3 pl-3 pr-2 text-sm font-semibold"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                                <span className="max-w-[160px] truncate">{category.name}</span>
                            </span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                {categoryCounts.counts.get(category.id) ?? 0}
                            </span>
                        </button>
                        <div className="mr-1 flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => startEditCategory(category)}
                                className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/20"
                                title="카테고리 수정"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => void deleteCategory(category)}
                                className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/20"
                                title="카테고리 삭제"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
            </div>
        </section>
    );

    const stickyCategoryTabs = (
        <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
            <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${
                    selectedCategoryId === 'all'
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
                전체
                <span className={selectedCategoryId === 'all' ? 'text-white/80' : 'text-slate-400'}>
                    {memos.length.toLocaleString('ko-KR')}
                </span>
            </button>
            <button
                type="button"
                onClick={() => setSelectedCategoryId('uncategorized')}
                className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${
                    selectedCategoryId === 'uncategorized'
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
                분류 없음
                <span className={selectedCategoryId === 'uncategorized' ? 'text-white/80' : 'text-slate-400'}>
                    {categoryCounts.uncategorized.toLocaleString('ko-KR')}
                </span>
            </button>
            {categories.map(category => {
                const isSelected = selectedCategoryId === category.id;

                return (
                    <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`inline-flex h-8 max-w-[180px] shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${
                            isSelected ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title={category.name}
                    >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="truncate">{category.name}</span>
                        <span className={isSelected ? 'text-white/80' : 'text-slate-400'}>
                            {(categoryCounts.counts.get(category.id) ?? 0).toLocaleString('ko-KR')}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const stickyMemoBoard = (
        <section className="flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm lg:min-h-0">
            <div className="shrink-0 border-b border-slate-200 bg-white p-2">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 px-1">
                        <h2 className="text-sm font-bold text-slate-950">스티커 보기</h2>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            표시 {filteredMemos.length.toLocaleString('ko-KR')}개
                        </p>
                    </div>
                    <div className="min-w-0 xl:max-w-[72%]">
                        {stickyCategoryTabs}
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {isLoading ? (
                    <div className="p-10 text-center text-sm font-semibold text-slate-500">
                        불러오는 중
                    </div>
                ) : filteredMemos.length === 0 ? (
                    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                        <FileText className="h-8 w-8 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">표시할 메모가 없습니다.</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => void createMemo()}
                                disabled={isSaving}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Plus className="h-4 w-4" />
                                새 메모
                            </button>
                            <button
                                type="button"
                                onClick={() => void createMemo('checklist')}
                                disabled={isSaving}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <CheckSquare className="h-4 w-4" />
                                체크리스트
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {filteredMemos.map(memo => {
                            const categoryColor = getCategoryColor(memo.categoryId);
                            const categoryTheme = buildAccentTheme(categoryColor);
                            const isSelected = selectedMemoId === memo.id;
                            const cardTheme = isSelected ? draftAccentTheme : categoryTheme;
                            const checklistTotal = memo.checklistItems.length;
                            const checklistDone = memo.checklistItems.filter(item => item.isChecked).length;

                            return (
                                <article
                                    key={memo.id}
                                    className={`flex h-[360px] min-w-0 flex-col rounded-lg border bg-white shadow-sm transition ${
                                        isSelected ? 'ring-2 ring-slate-300' : 'hover:-translate-y-0.5 hover:shadow-md'
                                    }`}
                                    style={{
                                        borderColor: cardTheme.border,
                                        backgroundColor: cardTheme.surface
                                    }}
                                >
                                    {isSelected ? (
                                        <div className="flex h-full min-h-0 flex-col">
                                            <div
                                                className="shrink-0 border-b px-3 py-3"
                                                style={{ borderColor: cardTheme.border, backgroundColor: cardTheme.header }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-2 shrink-0 text-slate-700">
                                                        {draftMemoType === 'checklist' ? (
                                                            <CheckSquare className="h-4 w-4" />
                                                        ) : (
                                                            <FileText className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <input
                                                        value={draftMemoType === 'checklist' ? draftTitle : draftTextParts.title}
                                                        onChange={event => {
                                                            if (draftMemoType === 'checklist') {
                                                                setDraftTitle(event.target.value);
                                                                return;
                                                            }
                                                            updateTextDraftTitle(event.target.value);
                                                        }}
                                                        className="h-9 min-w-0 flex-1 rounded-md border border-white bg-white px-3 text-sm font-bold text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-white/70"
                                                        placeholder="제목"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => void saveMemo()}
                                                        disabled={isSaving || !hasDraftChanges}
                                                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Save className="h-3.5 w-3.5" />
                                                        저장
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void deleteMemoRecord(memo)}
                                                        disabled={isSaving}
                                                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="삭제"
                                                        aria-label="메모 삭제"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                                    <select
                                                        value={draftCategoryId}
                                                        onChange={event => setDraftCategoryId(event.target.value)}
                                                        className="h-8 min-w-[130px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500"
                                                    >
                                                        <option value="">분류 없음</option>
                                                        {categories.map(category => (
                                                            <option key={category.id} value={category.id}>
                                                                {category.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="inline-flex h-8 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
                                                        <button
                                                            type="button"
                                                            onClick={() => switchDraftType('text')}
                                                            className={`inline-flex items-center gap-1 rounded px-2 text-xs font-bold transition ${
                                                                draftMemoType === 'text'
                                                                    ? 'bg-slate-900 text-white'
                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            본문
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => switchDraftType('checklist')}
                                                            className={`inline-flex items-center gap-1 rounded px-2 text-xs font-bold transition ${
                                                                draftMemoType === 'checklist'
                                                                    ? 'bg-slate-900 text-white'
                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <CheckSquare className="h-3.5 w-3.5" />
                                                            체크
                                                        </button>
                                                    </div>
                                                    <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                                                        <Clock3 className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{formatDate(memo.updatedAt || memo.createdAt)}</span>
                                                        {hasDraftChanges && <span className="shrink-0 text-amber-700">수정 중</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="min-h-0 flex-1 p-3">
                                                {draftMemoType === 'text' ? (
                                                    <textarea
                                                        value={draftTextParts.content}
                                                        onChange={event => updateTextDraftContent(event.target.value)}
                                                        className="h-full min-h-[180px] w-full resize-none rounded-md border bg-white p-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                                        style={{ borderColor: cardTheme.border }}
                                                        placeholder="본문을 입력하세요."
                                                    />
                                                ) : (
                                                    <div
                                                        className="h-full min-h-[180px] overflow-y-auto rounded-md border bg-white p-2"
                                                        style={{ borderColor: cardTheme.border }}
                                                    >
                                                        <div className="space-y-2">
                                                            {draftChecklistItems.map((item, index) => (
                                                                <div key={item.id} className="group flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.isChecked}
                                                                        onChange={event => updateDraftChecklistItem(item.id, { isChecked: event.target.checked })}
                                                                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                                                                        title="완료"
                                                                    />
                                                                    <input
                                                                        value={item.text}
                                                                        onChange={event => updateDraftChecklistItem(item.id, { text: event.target.value })}
                                                                        onKeyDown={event => handleChecklistItemKeyDown(event, index, item)}
                                                                        className={`h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 ${
                                                                            item.isChecked ? 'text-slate-400 line-through' : 'text-slate-800'
                                                                        }`}
                                                                        placeholder="할 일을 입력하세요."
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteDraftChecklistItem(item.id)}
                                                                        className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                                                        title="항목 삭제"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => addDraftChecklistItem()}
                                                            className="mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            항목 추가
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="flex shrink-0 items-start gap-2 border-b px-3 py-3"
                                                style={{ borderColor: cardTheme.border, backgroundColor: cardTheme.header }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => selectStickyMemo(memo)}
                                                    className="min-w-0 flex-1 text-left"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {memo.type === 'checklist' ? (
                                                            <CheckSquare className="h-4 w-4 shrink-0 text-slate-700" />
                                                        ) : (
                                                            <FileText className="h-4 w-4 shrink-0 text-slate-600" />
                                                        )}
                                                        <h3 className="truncate text-sm font-bold text-slate-950">{memo.title}</h3>
                                                    </div>
                                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                                                        <span className="inline-flex max-w-[160px] items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">
                                                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
                                                            <span className="truncate">{getCategoryLabel(memo.categoryId)}</span>
                                                        </span>
                                                        {memo.type === 'checklist' && (
                                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 shadow-sm">
                                                                {checklistDone}/{checklistTotal}
                                                            </span>
                                                        )}
                                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 shadow-sm">
                                                            {formatDate(memo.updatedAt || memo.createdAt)}
                                                        </span>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void deleteMemoRecord(memo)}
                                                    disabled={isSaving}
                                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-red-200 bg-white text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    title="삭제"
                                                    aria-label="메모 삭제"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => selectStickyMemo(memo)}
                                                className="min-h-0 flex-1 overflow-y-auto p-3 text-left"
                                            >
                                                {renderStickyMemoBody(memo)}
                                            </button>
                                        </>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );

    return (
        <main className="min-h-[calc(100vh-var(--header-height))] bg-[#eef2f7] text-slate-900 lg:h-[calc(100vh-var(--header-height))] lg:overflow-hidden">
            <div className="flex min-h-[calc(100vh-var(--header-height))] w-full flex-col gap-2 p-2 lg:h-full lg:min-h-0">
                <header className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/60">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-normal text-slate-950">스마트 메모</h1>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    {selectedCategoryLabel}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                                전체 {memos.length.toLocaleString('ko-KR')}개 · 표시 {filteredMemos.length.toLocaleString('ko-KR')}개
                                {statusMessage ? ` · ${statusMessage}` : ''}
                            </p>
                        </div>

                        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                            <label className="relative block min-w-0 sm:w-80 xl:w-96">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200"
                                    placeholder="제목, 내용, 카테고리 검색"
                                />
                            </label>
                            <div className="inline-flex h-11 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('split')}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 text-sm font-bold transition ${
                                        viewMode === 'split'
                                            ? 'bg-slate-950 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-white'
                                    }`}
                                >
                                    <FileText className="h-4 w-4" />
                                    목록/편집
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('sticky')}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 text-sm font-bold transition ${
                                        viewMode === 'sticky'
                                            ? 'bg-slate-950 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-white'
                                    }`}
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    스티커 보기
                                </button>
                            </div>
                            <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center">
                                <input
                                    value={newCategoryName}
                                    onChange={event => setNewCategoryName(event.target.value)}
                                    onKeyDown={handleCategoryKeyDown}
                                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200 sm:w-40"
                                    placeholder="새 카테고리"
                                />
                                {renderColorOptions(newCategoryColor, setNewCategoryColor, true)}
                                <button
                                    type="button"
                                    onClick={() => void createCategory()}
                                    disabled={isSaving || !newCategoryName.trim()}
                                    className="grid h-9 w-full shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-9"
                                    title="카테고리 추가"
                                >
                                    <FolderPlus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="grid min-w-[300px] grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => void createMemo()}
                                    disabled={isSaving}
                                    className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Plus className="h-4 w-4" />
                                    새 메모
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void createMemo('checklist')}
                                    disabled={isSaving}
                                    className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    체크리스트
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {errorMessage}
                    </div>
                )}

                {viewMode === 'sticky' ? stickyMemoBoard : (
                <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[420px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[480px_minmax(0,1fr)]">
                    <aside className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-blue-200 bg-blue-50 shadow-sm shadow-slate-200/70 lg:h-full lg:min-h-0">
                        <div className="space-y-3 border-b border-blue-200 bg-white p-2">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold text-blue-950">메모 목록</h2>
                                    <p className="mt-1 text-xs text-blue-700">
                                        선택 {checkedMemoIds.length.toLocaleString('ko-KR')}개
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleFilteredChecked}
                                    disabled={filteredMemos.length === 0 || isSaving}
                                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    {allFilteredChecked ? '해제' : '전체 선택'}
                                </button>
                            </div>

                            {categoryList}

                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                                <select
                                    value={moveTargetCategoryId}
                                    onChange={event => setMoveTargetCategoryId(event.target.value)}
                                    className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                >
                                    <option value="uncategorized">분류 없음</option>
                                    {categories.map(category => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleMoveChecked}
                                    disabled={checkedMemoIds.length === 0 || isSaving}
                                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <MoveRight className="h-4 w-4" />
                                    이동
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void deleteCheckedMemos()}
                                    disabled={checkedMemoIds.length === 0 || isSaving}
                                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    삭제
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto bg-amber-50">
                            {isLoading ? (
                                <div className="p-10 text-center text-sm font-semibold text-slate-500">
                                    불러오는 중
                                </div>
                            ) : filteredMemos.length === 0 ? (
                                <div className="p-10 text-center">
                                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                                    <p className="mt-3 text-sm font-bold text-slate-700">표시할 메모가 없습니다.</p>
                                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void createMemo()}
                                            disabled={isSaving}
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Plus className="h-4 w-4" />
                                            새 메모
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void createMemo('checklist')}
                                            disabled={isSaving}
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <CheckSquare className="h-4 w-4" />
                                            체크리스트
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2 p-2">
                                    <div
                                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border px-3 py-2 text-xs font-bold text-slate-950 shadow-sm"
                                        style={{
                                            borderColor: listAccentTheme.border,
                                            backgroundColor: listAccentTheme.header
                                        }}
                                    >
                                        <span>제목 / 카테고리</span>
                                        <span>작업</span>
                                    </div>
                                    {filteredMemos.map(memo => {
                                        const isChecked = checkedMemoIdSet.has(memo.id);
                                        const isSelected = selectedMemoId === memo.id;
                                        const categoryColor = getCategoryColor(memo.categoryId);
                                        const checklistTotal = memo.checklistItems.length;
                                        const checklistDone = memo.checklistItems.filter(item => item.isChecked).length;

                                        return (
                                            <article
                                                key={memo.id}
                                                className={`group rounded-xl border transition ${
                                                    isSelected
                                                        ? 'border-amber-400 bg-white shadow-sm ring-2 ring-amber-200'
                                                        : 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3 p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleMemoChecked(memo.id)}
                                                        className="mt-1.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                                        title="메모 선택"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => focusMemoEditor(memo.id)}
                                                        className="min-w-0 flex-1 text-left"
                                                    >
                                                        <div
                                                            className="flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1"
                                                            style={{
                                                                borderColor: hexToRgba(categoryColor, 0.28),
                                                                backgroundColor: hexToRgba(categoryColor, isSelected ? 0.16 : 0.08)
                                                            }}
                                                        >
                                                            {memo.type === 'checklist' ? (
                                                                <CheckSquare className="h-4 w-4 shrink-0 text-slate-700" />
                                                            ) : (
                                                                <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                                                            )}
                                                            <h3 className="truncate text-sm font-bold text-slate-950">{memo.title}</h3>
                                                            <span className="inline-flex max-w-[130px] shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">
                                                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
                                                                <span className="truncate">{getCategoryLabel(memo.categoryId)}</span>
                                                            </span>
                                                            {memo.type === 'checklist' && (
                                                                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 shadow-sm">
                                                                    {checklistDone}/{checklistTotal}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void deleteMemoRecord(memo)}
                                                        disabled={isSaving}
                                                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-red-200 bg-white text-red-700 opacity-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
                                                        title="삭제"
                                                        aria-label="메모 삭제"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </aside>

                    <section
                        ref={editorRef}
                        className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm lg:h-full lg:min-h-0"
                        style={{
                            borderColor: draftAccentTheme.border,
                            backgroundColor: draftAccentTheme.surface
                        }}
                    >
                        {selectedMemo ? (
                            <div className="flex h-full min-h-0 flex-col">
                                <div
                                    className="border-b px-4 py-4"
                                    style={{
                                        borderColor: draftAccentTheme.border,
                                        backgroundColor: draftAccentTheme.header
                                    }}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-sm font-bold text-emerald-950">메모 본문</h2>
                                                <span
                                                    className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm"
                                                    style={{ borderColor: draftAccentTheme.border }}
                                                >
                                                    <span
                                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                        style={{ backgroundColor: getCategoryColor(draftCategoryId || null) }}
                                                    />
                                                    <span className="truncate">{getCategoryLabel(draftCategoryId || null)}</span>
                                                </span>
                                            </div>
                                            <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-emerald-700">
                                                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{formatDate(selectedMemo.updatedAt || selectedMemo.createdAt)}</span>
                                                {hasDraftChanges && <span className="shrink-0 font-bold text-amber-700">수정 중</span>}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                            {memoCategoryPicker}
                                            <div className="inline-flex h-9 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => switchDraftType('text')}
                                                    className={`inline-flex items-center gap-1.5 rounded-md px-2 text-xs font-bold transition ${
                                                        draftMemoType === 'text'
                                                            ? 'bg-slate-900 text-white'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    본문
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => switchDraftType('checklist')}
                                                    className={`inline-flex items-center gap-1.5 rounded-md px-2 text-xs font-bold transition ${
                                                        draftMemoType === 'checklist'
                                                            ? 'bg-slate-900 text-white'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    체크
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void saveMemo()}
                                                disabled={isSaving || !hasDraftChanges}
                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Save className="h-4 w-4" />
                                                저장
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void deleteMemo()}
                                                disabled={isSaving}
                                                className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-white text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                title="삭제"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="min-h-0 flex-1 overflow-y-auto p-3"
                                    style={{ backgroundColor: draftAccentTheme.surface }}
                                >
                                    {draftMemoType === 'text' ? (
                                        <label className="flex min-h-[420px] flex-col lg:h-full lg:min-h-0">
                                            <span
                                                className="mb-2 block rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"
                                                style={{ borderColor: draftAccentTheme.border }}
                                            >
                                                첫 줄은 제목, 다음 줄부터 내용
                                            </span>
                                            <textarea
                                                value={draftText}
                                                onChange={event => setDraftText(event.target.value)}
                                                className="min-h-[420px] flex-1 resize-none rounded-lg border border-emerald-200 bg-white p-4 text-base leading-7 text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 lg:min-h-0"
                                                style={{ borderColor: draftAccentTheme.border }}
                                                placeholder={'제목을 첫 줄에 입력하세요.\n다음 줄부터 본문을 입력하세요.'}
                                            />
                                        </label>
                                    ) : (
                                        <div className="flex min-h-[420px] flex-col gap-3 lg:h-full lg:min-h-0">
                                            <label className="block">
                                                <span
                                                    className="mb-2 block rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"
                                                    style={{ borderColor: draftAccentTheme.border }}
                                                >
                                                    체크리스트 제목
                                                </span>
                                                <input
                                                    value={draftTitle}
                                                    onChange={event => setDraftTitle(event.target.value)}
                                                    className="h-12 w-full rounded-lg border bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                                                    style={{ borderColor: draftAccentTheme.border }}
                                                    placeholder="체크리스트 제목"
                                                />
                                            </label>
                                            <div
                                                className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white p-3"
                                                style={{ borderColor: draftAccentTheme.border }}
                                            >
                                                <div className="space-y-2">
                                                    {draftChecklistItems.map((item, index) => (
                                                        <div key={item.id} className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.isChecked}
                                                                onChange={event => updateDraftChecklistItem(item.id, { isChecked: event.target.checked })}
                                                                className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                                                                title="완료"
                                                            />
                                                            <input
                                                                value={item.text}
                                                                onChange={event => updateDraftChecklistItem(item.id, { text: event.target.value })}
                                                                onKeyDown={event => handleChecklistItemKeyDown(event, index, item)}
                                                                className={`h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 ${
                                                                    item.isChecked ? 'text-slate-400 line-through' : 'text-slate-800'
                                                                }`}
                                                                placeholder="할 일을 입력하세요"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteDraftChecklistItem(item.id)}
                                                                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                                                title="항목 삭제"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => addDraftChecklistItem()}
                                                    className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    항목 추가
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center text-slate-500 lg:min-h-0">
                                <FileText className="h-8 w-8" />
                                <p className="text-sm font-semibold">좌측 목록에서 메모를 선택하세요.</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void createMemo()}
                                        disabled={isSaving}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Plus className="h-4 w-4" />
                                        새 메모
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void createMemo('checklist')}
                                        disabled={isSaving}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <CheckSquare className="h-4 w-4" />
                                        체크리스트
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
                )}

            </div>
        </main>
    );
}

export default MemoPage;
