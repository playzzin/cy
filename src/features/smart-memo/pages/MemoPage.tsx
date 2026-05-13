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

type MemoRecord = {
    id: string;
    title: string;
    content: string;
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

const normalizeMemo = (id: string, data: Record<string, unknown>): MemoRecord => {
    const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
    const rawContent = typeof data.content === 'string' ? data.content : '';
    const rawCategoryId = typeof data.categoryId === 'string' ? data.categoryId : null;
    const categoryId = rawCategoryId && rawCategoryId !== 'public' ? rawCategoryId : null;
    const rawOrder = typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0;

    return {
        id,
        title: rawTitle || '제목 없음',
        content: rawContent,
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

const parseMemoText = (value: string) => {
    const lines = value.replace(/\r\n/g, '\n').split('\n');
    const rawTitle = lines.shift() ?? '';

    return {
        title: rawTitle.trim() || '제목 없음',
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
    const [moveTargetCategoryId, setMoveTargetCategoryId] = useState('uncategorized');
    const [draftText, setDraftText] = useState('');
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

            return (
                memo.title.toLowerCase().includes(queryText) ||
                memo.content.toLowerCase().includes(queryText) ||
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
            setDraftCategoryId('');
            return;
        }

        setDraftText(composeMemoText(selectedMemo.title, selectedMemo.content));
        setDraftCategoryId(selectedMemo.categoryId ?? '');
    }, [selectedMemo]);

    const parsedDraft = useMemo(() => parseMemoText(draftText), [draftText]);

    const hasDraftChanges = Boolean(
        selectedMemo &&
        (parsedDraft.title !== selectedMemo.title ||
            parsedDraft.content !== selectedMemo.content ||
            draftCategoryId !== (selectedMemo.categoryId ?? ''))
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

    const createMemo = async () => {
        if (!currentUser?.uid) return;

        setIsSaving(true);
        setErrorMessage('');

        try {
            const categoryId =
                selectedCategoryId !== 'all' && selectedCategoryId !== 'uncategorized'
                    ? selectedCategoryId
                    : null;
            const memoRef = await addDoc(collection(db, MEMO_COLLECTION), {
                userId: currentUser.uid,
                scope: 'private',
                type: 'text',
                title: '새 메모',
                content: '',
                categoryId,
                color: 'white',
                isPinned: false,
                order: Date.now(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setSelectedMemoId(memoRef.id);
            setDraftText('새 메모');
            setDraftCategoryId(categoryId ?? '');
            showStatus('새 메모를 만들었습니다.');
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
            await updateDoc(doc(db, MEMO_COLLECTION, selectedMemo.id), {
                title: parsedDraft.title,
                content: parsedDraft.content,
                categoryId: draftCategoryId || null,
                updatedAt: serverTimestamp()
            });

            setDraftText(composeMemoText(parsedDraft.title, parsedDraft.content));
            showStatus('저장했습니다.');
        } catch (error) {
            console.error('Failed to save memo:', error);
            setErrorMessage('메모를 저장하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const focusMemoEditor = (memoId: string) => {
        setSelectedMemoId(memoId);
        window.requestAnimationFrame(() => {
            editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
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

    return (
        <main className="min-h-screen bg-[#eef2f7] text-slate-900">
            <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-3 py-3 sm:px-4 lg:px-5">
                <header className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/60">
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

                        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
                            <label className="relative block min-w-0 sm:w-80 xl:w-96">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200"
                                    placeholder="제목, 내용, 카테고리 검색"
                                />
                            </label>
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
                            <button
                                type="button"
                                onClick={() => void createMemo()}
                                disabled={isSaving}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Plus className="h-4 w-4" />
                                새 메모
                            </button>
                        </div>
                    </div>
                </header>

                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {errorMessage}
                    </div>
                )}

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
                    <aside className="flex min-h-[540px] min-w-0 flex-col overflow-hidden rounded-xl border border-blue-200 bg-blue-50 shadow-sm shadow-slate-200/70 lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)]">
                        <div className="space-y-3 border-b border-blue-200 bg-white p-3">
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
                                    <button
                                        type="button"
                                        onClick={() => void createMemo()}
                                        disabled={isSaving}
                                        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Plus className="h-4 w-4" />
                                        새 메모
                                    </button>
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
                                                            <h3 className="truncate text-sm font-bold text-slate-950">{memo.title}</h3>
                                                            <span className="inline-flex max-w-[130px] shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">
                                                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
                                                                <span className="truncate">{getCategoryLabel(memo.categoryId)}</span>
                                                            </span>
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
                        className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm lg:h-[calc(100vh-1.5rem)]"
                        style={{
                            borderColor: draftAccentTheme.border,
                            backgroundColor: draftAccentTheme.surface
                        }}
                    >
                        {selectedMemo ? (
                            <div className="flex h-full min-h-[620px] flex-col">
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
                                    className="min-h-0 flex-1 overflow-y-auto p-4"
                                    style={{ backgroundColor: draftAccentTheme.surface }}
                                >
                                    <label className="flex min-h-[520px] flex-col lg:min-h-[calc(100vh-210px)]">
                                        <span
                                            className="mb-2 block rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"
                                            style={{ borderColor: draftAccentTheme.border }}
                                        >
                                            첫 줄은 제목, 다음 줄부터 내용
                                        </span>
                                        <textarea
                                            value={draftText}
                                            onChange={event => setDraftText(event.target.value)}
                                            className="min-h-[520px] flex-1 resize-none rounded-lg border border-emerald-200 bg-white p-4 text-base leading-7 text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                                            style={{ borderColor: draftAccentTheme.border }}
                                            placeholder={'제목을 첫 줄에 입력하세요.\n다음 줄부터 본문을 입력하세요.'}
                                        />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
                                <FileText className="h-8 w-8" />
                                <p className="text-sm font-semibold">좌측 목록에서 메모를 선택하세요.</p>
                                <button
                                    type="button"
                                    onClick={() => void createMemo()}
                                    disabled={isSaving}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Plus className="h-4 w-4" />
                                    새 메모
                                </button>
                            </div>
                        )}
                    </section>
                </div>

            </div>
        </main>
    );
}

export default MemoPage;
