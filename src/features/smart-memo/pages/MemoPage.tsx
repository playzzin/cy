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
    Copy as LucideCopy,
    FileText as LucideFileText,
    FolderPlus as LucideFolderPlus,
    List as LucideList,
    Maximize2 as LucideMaximize2,
    Minimize2 as LucideMinimize2,
    MoveRight as LucideMoveRight,
    Pin as LucidePin,
    PinOff as LucidePinOff,
    Pencil as LucidePencil,
    Plus as LucidePlus,
    Save as LucideSave,
    Trash2 as LucideTrash2,
    X as LucideX
} from 'lucide-react';

import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { MemoCardActionMenu } from '../components/MemoCardActionMenu';
import { MemoUndoToast } from '../components/MemoUndoToast';
import { MemoViewToolbar } from '../components/MemoViewToolbar';

const MEMO_COLLECTION = 'smart_memos';
const CATEGORY_COLLECTION = 'smart_memo_categories';
const AUTO_SAVE_DELAY_MS = 650;
const CATEGORY_COLORS = ['#dc2626', '#f97316', '#facc15', '#16a34a', '#2563eb', '#1e3a8a', '#7c3aed', '#64748b'];
const LEGACY_CATEGORY_COLORS: Record<string, string> = {
    red: '#dc2626',
    orange: '#f97316',
    yellow: '#facc15',
    green: '#16a34a',
    blue: '#2563eb',
    navy: '#1e3a8a',
    purple: '#7c3aed',
    gray: '#64748b',
    grey: '#64748b',
    white: '#94a3b8'
};
const BATCH_WRITE_SIZE = 450;
const LOCAL_MEMO_STORAGE_KEY = 'cy-smart-memo-dev-admin-memos';
const LOCAL_CATEGORY_STORAGE_KEY = 'cy-smart-memo-dev-admin-categories';
const MEMO_VIEW_MODE_STORAGE_KEY = 'cy-smart-memo-view-mode';
const STICKY_COLUMN_COUNT_STORAGE_KEY = 'cy-smart-memo-sticky-column-count';
const MEMO_SORT_MODE_STORAGE_KEY = 'cy-smart-memo-sort-mode';
const DELETE_UNDO_TIMEOUT_MS = 6000;

type MemoType = 'text' | 'checklist';
type MemoViewMode = 'split' | 'sticky';
type StickyColumnCount = 3 | 4;
type MobilePane = 'list' | 'editor';
type AutoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
type MemoSortMode = 'updated-desc' | 'created-desc' | 'title-asc';

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
    isPinned: boolean;
    order: number;
    createdAt?: unknown;
    updatedAt?: unknown;
};

type CategoryRecord = {
    id: string;
    name: string;
    order: number;
    color: string;
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
const Copy = iconOrFallback(LucideCopy);
const FileText = iconOrFallback(LucideFileText);
const FolderPlus = iconOrFallback(LucideFolderPlus);
const List = iconOrFallback(LucideList);
const Maximize2 = iconOrFallback(LucideMaximize2);
const Minimize2 = iconOrFallback(LucideMinimize2);
const MoveRight = iconOrFallback(LucideMoveRight);
const Pin = iconOrFallback(LucidePin);
const PinOff = iconOrFallback(LucidePinOff);
const Pencil = iconOrFallback(LucidePencil);
const Plus = iconOrFallback(LucidePlus);
const Save = iconOrFallback(LucideSave);
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
        .filter(item => item.text || item.isChecked || Boolean(item.comments?.length));
};

const checklistItemsEqual = (a: ChecklistItemRecord[], b: ChecklistItemRecord[]) => {
    return JSON.stringify(prepareChecklistItemsForSave(a)) === JSON.stringify(prepareChecklistItemsForSave(b));
};

const isTransientChecklistRow = (item: ChecklistItemRecord) => (
    item.text.trim() === '' && !item.isChecked && !item.comments?.length
);

const checklistItemsExactlyEqual = (a: ChecklistItemRecord[], b: ChecklistItemRecord[]) => (
    JSON.stringify(a) === JSON.stringify(b)
);

const mergeSavedChecklistItemsWithTransientRows = (
    savedItems: ChecklistItemRecord[],
    draftItems: ChecklistItemRecord[]
) => {
    const savedById = new Map(savedItems.map(item => [item.id, item]));
    const mergedIds = new Set<string>();
    const mergedItems: ChecklistItemRecord[] = [];

    draftItems.forEach(item => {
        const savedItem = savedById.get(item.id);
        if (savedItem) {
            mergedItems.push(savedItem);
            mergedIds.add(savedItem.id);
            return;
        }

        if (isTransientChecklistRow(item)) {
            mergedItems.push(item);
        }
    });

    savedItems.forEach(item => {
        if (!mergedIds.has(item.id)) {
            mergedItems.push(item);
        }
    });

    return checklistItemsExactlyEqual(mergedItems, draftItems) ? draftItems : mergedItems;
};

const ensureEditableChecklistItems = (items: ChecklistItemRecord[]) => (
    items.length > 0 ? items : [createChecklistItem('')]
);

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
        isPinned: data.isPinned === true,
        order: rawOrder,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
};

const normalizeCategoryColor = (value: unknown, fallback: string) => {
    if (typeof value !== 'string') return fallback;

    const normalized = value.trim().toLowerCase();
    const legacyColor = LEGACY_CATEGORY_COLORS[normalized];
    if (legacyColor) return legacyColor;

    const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(normalized);
    if (shortHexMatch) {
        return `#${shortHexMatch[1]
            .split('')
            .map(character => `${character}${character}`)
            .join('')}`;
    }

    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
};

const normalizeCategory = (id: string, data: Record<string, unknown>, fallbackOrder: number): CategoryRecord => {
    const fallbackColor = CATEGORY_COLORS[fallbackOrder % CATEGORY_COLORS.length];

    return {
        id,
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '새 카테고리',
        order: typeof data.order === 'number' ? data.order : fallbackOrder,
        color: normalizeCategoryColor(data.color, fallbackColor)
    };
};

const sortMemos = (items: MemoRecord[]) => {
    return [...items].sort((a, b) => {
        if (a.order !== b.order) return b.order - a.order;

        const bTime = getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAt);
        const aTime = getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAt);
        if (aTime !== bTime) return bTime - aTime;

        return a.title.localeCompare(b.title, 'ko-KR') || a.id.localeCompare(b.id);
    });
};

const sortVisibleMemos = (items: MemoRecord[], sortMode: MemoSortMode) => {
    return [...items].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

        if (sortMode === 'title-asc') {
            return a.title.localeCompare(b.title, 'ko-KR') || a.id.localeCompare(b.id);
        }

        const getComparableTime = (memo: MemoRecord) => sortMode === 'created-desc'
            ? getTimestampMillis(memo.createdAt)
            : getTimestampMillis(memo.updatedAt) || getTimestampMillis(memo.createdAt);

        return getComparableTime(b) - getComparableTime(a) || b.order - a.order || a.id.localeCompare(b.id);
    });
};

const composeMemoText = (title: string, content: string) => {
    return content ? `${title}\n${content}` : title;
};

const getMemoClipboardText = (memo: MemoRecord) => {
    const content = memo.type === 'checklist'
        ? checklistItemsToText(memo.checklistItems)
        : memo.content;

    return composeMemoText(memo.title, content).trim();
};

const writeTextToClipboard = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            console.warn('Clipboard API copy failed. Falling back to a legacy copy method.', error);
        }
    }

    if (typeof document === 'undefined') {
        throw new Error('Clipboard is unavailable.');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('Legacy clipboard copy failed.');
        }
    } finally {
        document.body.removeChild(textarea);
    }
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

const readLocalArray = (key: string): unknown[] => {
    if (typeof window === 'undefined') return [];

    try {
        const value = window.localStorage.getItem(key);
        if (!value) return [];
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn(`Failed to read local memo storage: ${key}`, error);
        return [];
    }
};

const writeLocalArray = (key: string, value: unknown[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
};

const readMemoViewMode = (): MemoViewMode => {
    if (typeof window === 'undefined') return 'split';

    try {
        return window.localStorage.getItem(MEMO_VIEW_MODE_STORAGE_KEY) === 'sticky' ? 'sticky' : 'split';
    } catch (error) {
        console.warn('Failed to read the memo view preference.', error);
        return 'split';
    }
};

const readStickyColumnCount = (): StickyColumnCount => {
    if (typeof window === 'undefined') return 3;

    try {
        return window.localStorage.getItem(STICKY_COLUMN_COUNT_STORAGE_KEY) === '4' ? 4 : 3;
    } catch (error) {
        console.warn('Failed to read the sticky memo column preference.', error);
        return 3;
    }
};

const readMemoSortMode = (): MemoSortMode => {
    if (typeof window === 'undefined') return 'updated-desc';

    try {
        const value = window.localStorage.getItem(MEMO_SORT_MODE_STORAGE_KEY);
        return value === 'created-desc' || value === 'title-asc' ? value : 'updated-desc';
    } catch (error) {
        console.warn('Failed to read the memo sort preference.', error);
        return 'updated-desc';
    }
};

const writeLocalPreference = (key: string, value: string) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        console.warn(`Failed to save the memo preference: ${key}`, error);
    }
};

const readLocalMemos = () => {
    const rows = readLocalArray(LOCAL_MEMO_STORAGE_KEY);

    return sortMemos(rows.map((row, index) => {
        const record = row && typeof row === 'object' ? row as Record<string, unknown> : {};
        const id = typeof record.id === 'string' && record.id ? record.id : `local-memo-${index}-${generateChecklistItemId()}`;
        return normalizeMemo(id, record);
    }));
};

const writeLocalMemos = (items: MemoRecord[]) => {
    writeLocalArray(LOCAL_MEMO_STORAGE_KEY, sortMemos(items));
};

const readLocalCategories = () => {
    const rows = readLocalArray(LOCAL_CATEGORY_STORAGE_KEY);

    return rows
        .map((row, index) => {
            const record = row && typeof row === 'object' ? row as Record<string, unknown> : {};
            const id = typeof record.id === 'string' && record.id ? record.id : `local-category-${index}-${generateChecklistItemId()}`;
            return normalizeCategory(id, record, index);
        })
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko-KR'));
};

const writeLocalCategories = (items: CategoryRecord[]) => {
    writeLocalArray(
        LOCAL_CATEGORY_STORAGE_KEY,
        [...items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko-KR'))
    );
};

export function MemoPage() {
    const { currentUser } = useAuth();
    const isLocalMemoMode = currentUser?.uid === 'dev-admin';

    const [memos, setMemos] = useState<MemoRecord[]>([]);
    const [categories, setCategories] = useState<CategoryRecord[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
    const [checkedMemoIds, setCheckedMemoIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<MemoViewMode>(readMemoViewMode);
    const [stickyColumnCount, setStickyColumnCount] = useState<StickyColumnCount>(readStickyColumnCount);
    const [sortMode, setSortMode] = useState<MemoSortMode>(readMemoSortMode);
    const [mobilePane, setMobilePane] = useState<MobilePane>('list');
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
    const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('idle');
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const [isCategoryComposerOpen, setIsCategoryComposerOpen] = useState(false);
    const [expandedStickyMemoId, setExpandedStickyMemoId] = useState<string | null>(null);
    const [stickyExpansionLevel, setStickyExpansionLevel] = useState<0 | 1 | 2>(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [deletedMemoSnapshots, setDeletedMemoSnapshots] = useState<MemoRecord[]>([]);

    const editorRef = useRef<HTMLElement | null>(null);
    const statusTimerRef = useRef<number | null>(null);
    const autoSaveTimerRef = useRef<number | null>(null);
    const savingUnlockTimerRef = useRef<number | null>(null);
    const deleteUndoTimerRef = useRef<number | null>(null);
    const savingLockRef = useRef(false);
    const draftSourceMemoIdRef = useRef<string | null>(null);
    const hasDraftChangesRef = useRef(false);
    const saveMemoRef = useRef<(mode?: 'manual' | 'auto') => Promise<boolean>>(async () => false);
    const checklistItemInputRefs = useRef(new Map<string, HTMLInputElement>());

    useEffect(() => {
        writeLocalPreference(MEMO_VIEW_MODE_STORAGE_KEY, viewMode);
    }, [viewMode]);

    useEffect(() => {
        writeLocalPreference(STICKY_COLUMN_COUNT_STORAGE_KEY, String(stickyColumnCount));
    }, [stickyColumnCount]);

    useEffect(() => {
        writeLocalPreference(MEMO_SORT_MODE_STORAGE_KEY, sortMode);
    }, [sortMode]);

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

        if (isLocalMemoMode) {
            setCategories(readLocalCategories());
            setMemos(readLocalMemos());
            setIsLoading(false);
            return;
        }

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
    }, [currentUser?.uid, isLocalMemoMode]);

    useEffect(() => {
        return () => {
            if (statusTimerRef.current !== null) {
                window.clearTimeout(statusTimerRef.current);
            }
            if (autoSaveTimerRef.current !== null) {
                window.clearTimeout(autoSaveTimerRef.current);
            }
            if (savingUnlockTimerRef.current !== null) {
                window.clearTimeout(savingUnlockTimerRef.current);
            }
            if (deleteUndoTimerRef.current !== null) {
                window.clearTimeout(deleteUndoTimerRef.current);
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

        memos.forEach(memo => {
            if (!memo.categoryId) return;

            counts.set(memo.categoryId, (counts.get(memo.categoryId) ?? 0) + 1);
        });

        return counts;
    }, [memos]);

    const filteredMemos = useMemo(() => {
        const queryText = searchQuery.trim().toLowerCase();

        const matchingMemos = memos.filter(memo => {
            const matchesCategory =
                selectedCategoryId === 'all' ||
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

        return sortVisibleMemos(matchingMemos, sortMode);
    }, [categoryNameById, memos, searchQuery, selectedCategoryId, sortMode]);

    const selectedMemo = useMemo(
        () => memos.find(memo => memo.id === selectedMemoId) ?? null,
        [memos, selectedMemoId]
    );

    const checkedMemoIdSet = useMemo(() => new Set(checkedMemoIds), [checkedMemoIds]);
    const filteredMemoIds = useMemo(() => filteredMemos.map(memo => memo.id), [filteredMemos]);
    const allFilteredChecked = filteredMemoIds.length > 0 && filteredMemoIds.every(id => checkedMemoIdSet.has(id));

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
            if (
                previous &&
                draftSourceMemoIdRef.current === previous &&
                hasDraftChangesRef.current
            ) {
                return previous;
            }
            return filteredMemoIds[0] ?? null;
        });
    }, [autoSaveState, filteredMemoIds]);

    const parsedDraft = useMemo(() => parseMemoText(draftText), [draftText]);
    const draftTextParts = useMemo(() => {
        const lines = draftText.replace(/\r\n/g, '\n').split('\n');
        const title = lines.shift() ?? '';
        return {
            title,
            content: lines.join('\n')
        };
    }, [draftText]);

    const draftMemoClipboardText = useMemo(() => {
        const title = draftMemoType === 'checklist' ? draftTitle : draftTextParts.title;
        const content = draftMemoType === 'checklist'
            ? checklistItemsToText(draftChecklistItems)
            : draftTextParts.content;

        return composeMemoText(title, content).trim();
    }, [draftChecklistItems, draftMemoType, draftTextParts.content, draftTextParts.title, draftTitle]);

    const isDraftDirtyForMemo = useCallback((memo: MemoRecord) => (
        draftMemoType !== memo.type ||
        draftCategoryId !== (memo.categoryId ?? '') ||
        (draftMemoType === 'text'
            ? parsedDraft.title !== memo.title || parsedDraft.content !== memo.content
            : normalizeMemoTitle(draftTitle) !== memo.title ||
                !checklistItemsEqual(draftChecklistItems, memo.checklistItems))
    ), [draftCategoryId, draftChecklistItems, draftMemoType, draftTitle, parsedDraft.content, parsedDraft.title]);

    const hasDraftChanges = Boolean(selectedMemo && isDraftDirtyForMemo(selectedMemo));
    hasDraftChangesRef.current = hasDraftChanges;


    useEffect(() => {
        if (!selectedMemo) {
            draftSourceMemoIdRef.current = null;
            setDraftText(previous => previous === '' ? previous : '');
            setDraftMemoType(previous => previous === 'text' ? previous : 'text');
            setDraftTitle(previous => previous === '' ? previous : '');
            setDraftChecklistItems(previous => previous.length === 0 ? previous : []);
            setDraftCategoryId(previous => previous === '' ? previous : '');
            return;
        }

        const isSameMemo = draftSourceMemoIdRef.current === selectedMemo.id;
        if (isSameMemo && isDraftDirtyForMemo(selectedMemo)) {
            return;
        }

        if (
            isSameMemo &&
            selectedMemo.type === 'checklist' &&
            draftMemoType === 'checklist' &&
            draftChecklistItems.some(isTransientChecklistRow)
        ) {
            setDraftText(composeMemoText(selectedMemo.title, selectedMemo.content));
            setDraftTitle(selectedMemo.title);
            setDraftChecklistItems(previous => mergeSavedChecklistItemsWithTransientRows(
                selectedMemo.checklistItems,
                previous
            ));
            setDraftCategoryId(selectedMemo.categoryId ?? '');
            return;
        }

        draftSourceMemoIdRef.current = selectedMemo.id;
        setDraftText(composeMemoText(selectedMemo.title, selectedMemo.content));
        setDraftMemoType(selectedMemo.type);
        setDraftTitle(selectedMemo.title);
        setDraftChecklistItems(previous => (
            selectedMemo.type === 'checklist'
                ? ensureEditableChecklistItems(selectedMemo.checklistItems)
                : previous.length === 0 ? previous : []
        ));
        setDraftCategoryId(selectedMemo.categoryId ?? '');
    }, [draftChecklistItems, draftMemoType, isDraftDirtyForMemo, selectedMemo]);

    const beginSaving = useCallback(() => {
        if (savingLockRef.current) return false;
        savingLockRef.current = true;
        if (savingUnlockTimerRef.current !== null) {
            window.clearTimeout(savingUnlockTimerRef.current);
            savingUnlockTimerRef.current = null;
        }
        setIsSaving(true);
        return true;
    }, []);

    const finishSaving = useCallback((cooldownMs = 0) => {
        if (savingUnlockTimerRef.current !== null) {
            window.clearTimeout(savingUnlockTimerRef.current);
            savingUnlockTimerRef.current = null;
        }

        const unlock = () => {
            savingLockRef.current = false;
            savingUnlockTimerRef.current = null;
            setIsSaving(false);
        };

        if (cooldownMs > 0) {
            savingUnlockTimerRef.current = window.setTimeout(unlock, cooldownMs);
            return;
        }

        unlock();
    }, []);

    const updateLocalMemos = useCallback((updater: (items: MemoRecord[]) => MemoRecord[]) => {
        const nextMemos = sortMemos(updater(readLocalMemos()));
        writeLocalMemos(nextMemos);
        setMemos(nextMemos);
        return nextMemos;
    }, []);

    const updateLocalCategories = useCallback((updater: (items: CategoryRecord[]) => CategoryRecord[]) => {
        const nextCategories = updater(readLocalCategories())
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko-KR'));
        writeLocalCategories(nextCategories);
        setCategories(nextCategories);
        return nextCategories;
    }, []);

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
        return categoryId
            ? normalizeCategoryColor(categoryById[categoryId]?.color, '#64748b')
            : '#94a3b8';
    };

    const activeListCategoryColor =
        selectedCategoryId !== 'all'
            ? getCategoryColor(selectedCategoryId)
            : selectedMemo
                ? getCategoryColor(selectedMemo.categoryId)
                : '#f97316';
    const listAccentTheme = buildAccentTheme(activeListCategoryColor);
    const draftAccentTheme = buildAccentTheme(getCategoryColor(draftCategoryId || null));
    const autoSaveLabel = autoSaveState === 'saving'
        ? '저장 중…'
        : autoSaveState === 'pending'
            ? '자동 저장 대기'
            : autoSaveState === 'error'
                ? '저장 실패'
                : '저장됨';
    const autoSaveTone = autoSaveState === 'error'
        ? 'text-red-700'
        : autoSaveState === 'pending' || autoSaveState === 'saving'
            ? 'text-amber-700'
            : 'text-emerald-700';

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

    const stageDeletedMemosForUndo = (snapshots: MemoRecord[]) => {
        if (deleteUndoTimerRef.current !== null) {
            window.clearTimeout(deleteUndoTimerRef.current);
        }

        setDeletedMemoSnapshots(snapshots);
        deleteUndoTimerRef.current = window.setTimeout(() => {
            setDeletedMemoSnapshots([]);
            deleteUndoTimerRef.current = null;
        }, DELETE_UNDO_TIMEOUT_MS);
    };

    const dismissDeleteUndo = () => {
        if (deleteUndoTimerRef.current !== null) {
            window.clearTimeout(deleteUndoTimerRef.current);
            deleteUndoTimerRef.current = null;
        }
        setDeletedMemoSnapshots([]);
    };

    const restoreDeletedMemos = async () => {
        if (!currentUser?.uid || deletedMemoSnapshots.length === 0) return;
        if (!beginSaving()) return;

        const snapshots = deletedMemoSnapshots;
        setErrorMessage('');

        if (deleteUndoTimerRef.current !== null) {
            window.clearTimeout(deleteUndoTimerRef.current);
            deleteUndoTimerRef.current = null;
        }

        try {
            if (isLocalMemoMode) {
                const restoredIds = new Set(snapshots.map(memo => memo.id));
                updateLocalMemos(items => [
                    ...snapshots,
                    ...items.filter(memo => !restoredIds.has(memo.id))
                ]);
            } else {
                for (let index = 0; index < snapshots.length; index += BATCH_WRITE_SIZE) {
                    const batch = writeBatch(db);
                    snapshots.slice(index, index + BATCH_WRITE_SIZE).forEach(memo => {
                        batch.set(doc(db, MEMO_COLLECTION, memo.id), {
                            userId: currentUser.uid,
                            scope: 'private',
                            type: memo.type,
                            title: memo.title,
                            content: memo.content,
                            checklistItems: memo.checklistItems,
                            categoryId: memo.categoryId,
                            isPinned: memo.isPinned,
                            order: memo.order,
                            createdAt: memo.createdAt ?? serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    });
                    await batch.commit();
                }
            }

            setDeletedMemoSnapshots([]);
            setSelectedMemoId(snapshots[0]?.id ?? null);
            showStatus(`${snapshots.length.toLocaleString('ko-KR')}개 메모를 복구했습니다.`);
        } catch (error) {
            console.error('Failed to restore memos:', error);
            setErrorMessage('삭제한 메모를 복구하지 못했습니다.');
            setDeletedMemoSnapshots(snapshots);
        } finally {
            finishSaving();
        }
    };

    const deleteMemosByIds = async (memoIds: string[], successMessage: string) => {
        if (memoIds.length === 0) return;
        if (!beginSaving()) return;

        setErrorMessage('');
        const memoIdSet = new Set(memoIds);
        const deletedMemos = memos.filter(memo => memoIdSet.has(memo.id));

        try {
            if (isLocalMemoMode) {
                updateLocalMemos(items => items.filter(memo => !memoIdSet.has(memo.id)));
            } else {
                for (let index = 0; index < memoIds.length; index += BATCH_WRITE_SIZE) {
                    const batch = writeBatch(db);
                    memoIds.slice(index, index + BATCH_WRITE_SIZE).forEach(memoId => {
                        batch.delete(doc(db, MEMO_COLLECTION, memoId));
                    });
                    await batch.commit();
                }
            }

            setCheckedMemoIds(previous => previous.filter(id => !memoIds.includes(id)));
            if (selectedMemoId && memoIds.includes(selectedMemoId)) {
                setSelectedMemoId(null);
                setMobilePane('list');
                setAutoSaveState('idle');
            }
            if (expandedStickyMemoId && memoIds.includes(expandedStickyMemoId)) {
                setExpandedStickyMemoId(null);
                setStickyExpansionLevel(0);
            }

            showStatus(successMessage);
            stageDeletedMemosForUndo(deletedMemos);
        } catch (error) {
            console.error('Failed to delete memos:', error);
            setErrorMessage('메모를 삭제하지 못했습니다.');
        } finally {
            finishSaving();
        }
    };

    const moveMemosToCategory = async (memoIds: string[], targetCategoryId: string | null) => {
        if (!currentUser?.uid || memoIds.length === 0) return;
        if (!beginSaving()) return;

        setErrorMessage('');

        try {
            if (isLocalMemoMode) {
                const memoIdSet = new Set(memoIds);
                const updatedAt = Date.now();
                updateLocalMemos(items => items.map(memo =>
                    memoIdSet.has(memo.id) ? { ...memo, categoryId: targetCategoryId, updatedAt } : memo
                ));
            } else {
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
            finishSaving();
        }
    };

    const createMemo = async (type: MemoType = 'text') => {
        if (!currentUser?.uid) return;
        setIsCreateMenuOpen(false);

        if (hasDraftChangesRef.current) {
            if (autoSaveTimerRef.current !== null) {
                window.clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
            const saved = await saveMemoRef.current('auto');
            if (!saved) {
                showStatus('작성 중인 메모를 저장한 뒤 다시 시도하세요.');
                return;
            }
        }

        if (!beginSaving()) return;

        setErrorMessage('');

        try {
            const categoryId =
                selectedCategoryId !== 'all'
                    ? selectedCategoryId
                    : null;
            const title = type === 'checklist' ? '새 체크리스트' : '새 메모';
            const initialDraftChecklistItems = type === 'checklist' ? [createChecklistItem('')] : [];
            const checklistItemsForSave: ChecklistItemRecord[] = [];
            let memoId = '';

            if (isLocalMemoMode) {
                const now = Date.now();
                const memo: MemoRecord = {
                    id: `local-memo-${now}-${generateChecklistItemId()}`,
                    type,
                    title,
                    content: '',
                    checklistItems: checklistItemsForSave,
                    categoryId,
                    isPinned: false,
                    order: now,
                    createdAt: now,
                    updatedAt: now
                };
                memoId = memo.id;
                updateLocalMemos(items => [memo, ...items]);
            } else {
                const memoRef = await addDoc(collection(db, MEMO_COLLECTION), {
                    userId: currentUser.uid,
                    scope: 'private',
                    type,
                    title,
                    content: '',
                    checklistItems: checklistItemsForSave,
                    categoryId,
                    color: 'white',
                    isPinned: false,
                    order: Date.now(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                memoId = memoRef.id;
            }

            draftSourceMemoIdRef.current = memoId;
            setSelectedMemoId(memoId);
            setViewMode(current => current === 'sticky' ? 'sticky' : 'split');
            setMobilePane('editor');
            setDraftText(title);
            setDraftMemoType(type);
            setDraftTitle(title);
            setDraftChecklistItems(initialDraftChecklistItems);
            setDraftCategoryId(categoryId ?? '');
            setAutoSaveState('saved');
            showStatus(type === 'checklist' ? '새 체크리스트를 만들었습니다.' : '새 메모를 만들었습니다.');
        } catch (error) {
            console.error('Failed to create memo:', error);
            setErrorMessage('메모를 만들지 못했습니다.');
        } finally {
            finishSaving(180);
        }
    };

    const saveMemo = async (mode: 'manual' | 'auto' = 'manual'): Promise<boolean> => {
        if (!currentUser?.uid || !selectedMemo) return false;
        if (!beginSaving()) {
            if (mode === 'auto' && autoSaveTimerRef.current === null) {
                setAutoSaveState('pending');
                autoSaveTimerRef.current = window.setTimeout(() => {
                    autoSaveTimerRef.current = null;
                    void saveMemoRef.current('auto');
                }, 220);
            }
            return false;
        }

        setErrorMessage('');
        setAutoSaveState('saving');

        try {
            const checklistItems = draftMemoType === 'checklist'
                ? prepareChecklistItemsForSave(draftChecklistItems)
                : [];
            const nextTitle = draftMemoType === 'checklist'
                ? normalizeMemoTitle(draftTitle)
                : parsedDraft.title;
            const nextContent = draftMemoType === 'checklist' ? '' : parsedDraft.content;

            if (isLocalMemoMode) {
                const updatedAt = Date.now();
                updateLocalMemos(items => items.map(memo => memo.id === selectedMemo.id
                    ? {
                        ...memo,
                        type: draftMemoType,
                        title: nextTitle,
                        content: nextContent,
                        checklistItems: draftMemoType === 'checklist' ? checklistItems : [],
                        categoryId: draftCategoryId || null,
                        updatedAt
                    }
                    : memo
                ));
            } else {
                await updateDoc(doc(db, MEMO_COLLECTION, selectedMemo.id), {
                    type: draftMemoType,
                    title: nextTitle,
                    content: nextContent,
                    checklistItems: draftMemoType === 'checklist' ? checklistItems : [],
                    categoryId: draftCategoryId || null,
                    updatedAt: serverTimestamp()
                });
            }

            setDraftText(composeMemoText(nextTitle, nextContent));
            setDraftTitle(nextTitle);
            if (draftMemoType === 'text') {
                setDraftChecklistItems([]);
            }
            setAutoSaveState('saved');
            showStatus(mode === 'auto' ? '자동 저장됨' : '저장했습니다.');
            return true;
        } catch (error) {
            console.error('Failed to save memo:', error);
            setAutoSaveState('error');
            setErrorMessage('메모를 저장하지 못했습니다.');
            return false;
        } finally {
            finishSaving();
        }
    };

    saveMemoRef.current = saveMemo;

    useEffect(() => {
        if (autoSaveTimerRef.current !== null) {
            window.clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        if (!selectedMemo || !hasDraftChanges) {
            setAutoSaveState(previous => previous === 'pending' ? 'saved' : previous);
            return;
        }

        setAutoSaveState('pending');
        autoSaveTimerRef.current = window.setTimeout(() => {
            autoSaveTimerRef.current = null;
            void saveMemo('auto');
        }, AUTO_SAVE_DELAY_MS);

        return () => {
            if (autoSaveTimerRef.current !== null) {
                window.clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [
        draftCategoryId,
        draftChecklistItems,
        draftMemoType,
        draftText,
        draftTitle,
        hasDraftChanges,
        selectedMemo?.id
    ]);

    useEffect(() => {
        if (!hasDraftChanges) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasDraftChanges]);

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

    const focusChecklistItem = (itemId: string) => {
        window.requestAnimationFrame(() => {
            checklistItemInputRefs.current.get(itemId)?.focus();
        });
    };

    const addDraftChecklistItem = (index?: number) => {
        const newItem = createChecklistItem('');

        setDraftChecklistItems(previous => {
            const next = [...previous];
            const requestedIndex = typeof index === 'number' ? index : next.length;
            const nextIndex = Math.max(0, Math.min(requestedIndex, next.length));
            next.splice(nextIndex, 0, newItem);
            return next;
        });

        focusChecklistItem(newItem.id);
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
        setDraftChecklistItems(previous => {
            const next = previous.filter(item => item.id !== itemId);
            return ensureEditableChecklistItems(next);
        });
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

    const saveDraftBeforeMemoChange = async () => {
        if (!hasDraftChangesRef.current) return true;

        if (autoSaveTimerRef.current !== null) {
            window.clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        const saved = await saveMemo('auto');
        if (!saved) {
            showStatus('저장을 완료한 뒤 다른 메모를 선택하세요.');
        }
        return saved;
    };

    const focusMemoEditor = async (memoId: string) => {
        if (memoId === selectedMemoId) {
            setMobilePane('editor');
            return;
        }
        if (!(await saveDraftBeforeMemoChange())) return;

        setViewMode('split');
        setSelectedMemoId(memoId);
        setMobilePane('editor');
        window.requestAnimationFrame(() => {
            editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const selectStickyMemo = async (memo: MemoRecord) => {
        if (memo.id !== selectedMemoId && !(await saveDraftBeforeMemoChange())) return;

        setSelectedMemoId(memo.id);
        setDraftText(composeMemoText(memo.title, memo.content));
        setDraftMemoType(memo.type);
        setDraftTitle(memo.title);
        setDraftChecklistItems(
            memo.type === 'checklist'
                ? ensureEditableChecklistItems(memo.checklistItems)
                : []
        );
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

    const copyMemoToClipboard = async (memo: MemoRecord, text = getMemoClipboardText(memo)) => {
        if (!text) {
            showStatus('복사할 내용이 없습니다.');
            return;
        }

        setErrorMessage('');

        try {
            await writeTextToClipboard(text);
            showStatus('메모를 클립보드에 복사했습니다.');
        } catch (error) {
            console.error('Failed to copy memo to clipboard:', error);
            setErrorMessage('메모를 클립보드에 복사하지 못했습니다.');
        }
    };

    const toggleMemoPinned = async (memo: MemoRecord) => {
        if (!currentUser?.uid || !beginSaving()) return;

        const nextPinned = !memo.isPinned;
        setErrorMessage('');

        try {
            if (isLocalMemoMode) {
                updateLocalMemos(items => items.map(item => item.id === memo.id
                    ? { ...item, isPinned: nextPinned }
                    : item
                ));
            } else {
                await updateDoc(doc(db, MEMO_COLLECTION, memo.id), { isPinned: nextPinned });
            }

            showStatus(nextPinned ? '중요 메모로 고정했습니다.' : '중요 메모 고정을 해제했습니다.');
        } catch (error) {
            console.error('Failed to update memo pin:', error);
            setErrorMessage('중요 메모 상태를 변경하지 못했습니다.');
        } finally {
            finishSaving();
        }
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
        if (!beginSaving()) return;

        setErrorMessage('');

        try {
            if (isLocalMemoMode) {
                const now = Date.now();
                updateLocalCategories(items => [
                    ...items,
                    {
                        id: `local-category-${now}-${generateChecklistItemId()}`,
                        name,
                        order: now,
                        color: newCategoryColor
                    }
                ]);
            } else {
                await addDoc(collection(db, CATEGORY_COLLECTION), {
                    userId: currentUser.uid,
                    name,
                    order: Date.now(),
                    color: newCategoryColor,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            setNewCategoryName('');
            setNewCategoryColor(CATEGORY_COLORS[(categories.length + 1) % CATEGORY_COLORS.length]);
            setIsCategoryComposerOpen(false);
            showStatus('카테고리를 추가했습니다.');
        } catch (error) {
            console.error('Failed to create category:', error);
            setErrorMessage('카테고리를 추가하지 못했습니다.');
        } finally {
            finishSaving();
        }
    };

    const startEditCategory = (category: CategoryRecord) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
        setEditingCategoryColor(normalizeCategoryColor(category.color, CATEGORY_COLORS[0]));
    };

    const saveCategory = async (category: CategoryRecord) => {
        const name = editingCategoryName.trim();
        if (!name) return;
        if (!beginSaving()) return;

        setErrorMessage('');

        try {
            if (isLocalMemoMode) {
                updateLocalCategories(items => items.map(item => item.id === category.id
                    ? { ...item, name, color: editingCategoryColor }
                    : item
                ));
            } else {
                await updateDoc(doc(db, CATEGORY_COLLECTION, category.id), {
                    name,
                    color: editingCategoryColor,
                    updatedAt: serverTimestamp()
                });
            }

            setEditingCategoryId(null);
            setEditingCategoryName('');
            setEditingCategoryColor(CATEGORY_COLORS[0]);
            showStatus('카테고리를 저장했습니다.');
        } catch (error) {
            console.error('Failed to save category:', error);
            setErrorMessage('카테고리를 저장하지 못했습니다.');
        } finally {
            finishSaving();
        }
    };

    const deleteCategory = async (category: CategoryRecord) => {
        if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요? 메모는 분류 없음으로 이동합니다.`)) return;
        if (!beginSaving()) return;

        setErrorMessage('');

        try {
            if (isLocalMemoMode) {
                const updatedAt = Date.now();
                updateLocalMemos(items => items.map(memo =>
                    memo.categoryId === category.id ? { ...memo, categoryId: null, updatedAt } : memo
                ));
                updateLocalCategories(items => items.filter(item => item.id !== category.id));
            } else {
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
            }

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
            finishSaving();
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

    const cycleStickyMemoSize = (memoId: string) => {
        if (expandedStickyMemoId !== memoId) {
            setExpandedStickyMemoId(memoId);
            setStickyExpansionLevel(1);
            return;
        }

        if (stickyExpansionLevel === 1) {
            setStickyExpansionLevel(2);
            return;
        }

        setExpandedStickyMemoId(null);
        setStickyExpansionLevel(0);
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
        compact = false,
        ariaLabel = '카테고리 색상 선택'
    ) => {
        const normalizedSelectedColor = normalizeCategoryColor(selectedColor, CATEGORY_COLORS[0]);

        return (
            <div className="flex flex-wrap items-center gap-1.5" aria-label={ariaLabel}>
                {CATEGORY_COLORS.map(color => {
                    const isSelected = normalizedSelectedColor === color;

                    return (
                        <button
                            key={color}
                            type="button"
                            onClick={() => onSelect(color)}
                            className={`${compact ? 'h-11 w-11 sm:h-8 sm:w-8' : 'h-11 w-11 sm:h-9 sm:w-9'} grid place-items-center rounded-full border-2 transition ${
                                isSelected
                                    ? 'border-slate-950 text-white shadow-sm ring-2 ring-slate-200'
                                    : 'border-white text-transparent hover:border-slate-300'
                            }`}
                            style={{ backgroundColor: color }}
                            title={`색상 ${color}`}
                            aria-label={`카테고리 색상 ${color}`}
                            aria-pressed={isSelected}
                        >
                            <Check className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} drop-shadow`} />
                        </button>
                    );
                })}
            </div>
        );
    };

    if (!currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-700">
                로그인이 필요합니다.
            </div>
        );
    }

    const memoCategoryPicker = (
        <div
            className="w-full min-w-0 rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 sm:w-auto"
            aria-label="메모 카테고리 색상 선택"
        >
            <select
                value={draftCategoryId}
                onChange={event => setDraftCategoryId(event.target.value)}
                className="h-11 w-full rounded-md border border-indigo-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:hidden"
                aria-label="메모 카테고리"
            >
                <option value="">분류 없음</option>
                {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                ))}
            </select>
            <div className="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex">
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
                    <span>분류 없음</span>
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
                            <span className="truncate">{category.name}</span>
                        </button>
                    );
                })}
            </div>
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
                <span>전체보기</span>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                        selectedCategoryId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                    {memos.length}
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
                                    aria-label={`${category.name} 카테고리 저장`}
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
                                    aria-label={`${category.name} 카테고리 편집 취소`}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-emerald-800">색상</span>
                                {renderColorOptions(
                                    editingCategoryColor,
                                    setEditingCategoryColor,
                                    true,
                                    `${category.name} 카테고리 색상 선택`
                                )}
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
                                {categoryCounts.get(category.id) ?? 0}
                            </span>
                        </button>
                        <div className="mr-1 flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => startEditCategory(category)}
                                className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/20"
                                title="카테고리 수정"
                                aria-label={`${category.name} 카테고리 수정`}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => void deleteCategory(category)}
                                className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/20"
                                title="카테고리 삭제"
                                aria-label={`${category.name} 카테고리 삭제`}
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
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition sm:h-8 ${
                    selectedCategoryId === 'all'
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
                전체보기
                <span className={selectedCategoryId === 'all' ? 'text-white/80' : 'text-slate-400'}>
                    {memos.length.toLocaleString('ko-KR')}
                </span>
            </button>
            {categories.map(category => {
                const isSelected = selectedCategoryId === category.id;

                return (
                    <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`inline-flex h-11 max-w-[180px] shrink-0 items-center gap-2 rounded-md px-3 text-xs font-bold transition sm:h-8 ${
                            isSelected ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title={category.name}
                    >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="truncate">{category.name}</span>
                        <span className={isSelected ? 'text-white/80' : 'text-slate-400'}>
                            {(categoryCounts.get(category.id) ?? 0).toLocaleString('ko-KR')}
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
                    <h2 className="sr-only">스티커 보기</h2>
                    <div className="hidden min-w-0 flex-wrap items-center gap-2 px-1 sm:flex">
                        <div
                            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 p-1"
                            role="group"
                            aria-label="스티커 열 수 선택"
                        >
                            {([3, 4] as const).map(columnCount => (
                                <button
                                    key={columnCount}
                                    type="button"
                                    onClick={() => setStickyColumnCount(columnCount)}
                                    className={`h-7 rounded-md px-2.5 text-xs font-bold transition ${
                                        stickyColumnCount === columnCount
                                            ? 'bg-slate-950 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-white'
                                    }`}
                                    aria-label={`한 줄에 스티커 ${columnCount}개 보기`}
                                    aria-pressed={stickyColumnCount === columnCount}
                                >
                                    {columnCount}열
                                </button>
                            ))}
                        </div>
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
                        <p className="text-xs font-semibold text-slate-400">상단의 새 메모 메뉴에서 바로 시작할 수 있습니다.</p>
                    </div>
                ) : (
                    <div
                        className={`grid auto-rows-[360px] items-stretch gap-3 sm:grid-cols-2 ${
                            stickyColumnCount === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
                        }`}
                        aria-label="스티커 메모 목록"
                        data-column-count={stickyColumnCount}
                    >
                        {filteredMemos.map(memo => {
                            const categoryColor = getCategoryColor(memo.categoryId);
                            const categoryTheme = buildAccentTheme(categoryColor);
                            const isSelected = selectedMemoId === memo.id;
                            const cardTheme = isSelected ? draftAccentTheme : categoryTheme;
                            const checklistTotal = memo.checklistItems.length;
                            const checklistDone = memo.checklistItems.filter(item => item.isChecked).length;
                            const isExpanded = expandedStickyMemoId === memo.id;
                            const expansionLevel = isExpanded ? stickyExpansionLevel : 0;
                            const expansionActionLabel = expansionLevel === 0
                                ? '세로로 크게 보기'
                                : expansionLevel === 1
                                    ? '가로까지 더 크게 보기'
                                    : '원래 크기로';
                            const expansionButtonText = expansionLevel === 0
                                ? '크게 보기'
                                : expansionLevel === 1
                                    ? '더 크게'
                                    : '원래 크기';

                            return (
                                <article
                                    key={memo.id}
                                    className={`flex h-full min-w-0 flex-col rounded-lg border bg-white shadow-sm transition-all duration-200 ${
                                        expansionLevel >= 1 ? 'row-span-2' : ''
                                    } ${
                                        expansionLevel === 2 ? 'sm:col-span-2' : ''
                                    } ${
                                        isSelected ? 'ring-2 ring-slate-300' : 'hover:-translate-y-0.5 hover:shadow-md'
                                    }`}
                                    aria-label={`${memo.title} 스티커 메모`}
                                    data-expansion-level={expansionLevel}
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
                                                        className="h-11 min-w-0 flex-1 rounded-md border border-white bg-white px-3 text-sm font-bold text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-white/70 sm:h-9"
                                                        placeholder="제목"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => void saveMemo()}
                                                        disabled={isSaving || !hasDraftChanges}
                                                        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                                                    >
                                                        <Save className="h-3.5 w-3.5" />
                                                        저장
                                                    </button>
                                                    <MemoCardActionMenu
                                                        memoTitle={memo.title}
                                                        isPinned={memo.isPinned}
                                                        disabled={isSaving}
                                                        onTogglePinned={() => void toggleMemoPinned(memo)}
                                                        onCopy={() => void copyMemoToClipboard(memo, draftMemoClipboardText)}
                                                        onDelete={() => void deleteMemoRecord(memo)}
                                                    />
                                                </div>
                                                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                                    <select
                                                        value={draftCategoryId}
                                                        onChange={event => setDraftCategoryId(event.target.value)}
                                                        className="h-11 min-w-[130px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-500 sm:h-8"
                                                    >
                                                        <option value="">분류 없음</option>
                                                        {categories.map(category => (
                                                            <option key={category.id} value={category.id}>
                                                                {category.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div
                                                        className="inline-flex h-14 rounded-md border border-slate-200 bg-white p-1 shadow-sm sm:h-8 sm:p-0.5"
                                                        role="group"
                                                        aria-label="메모 형식 선택"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => switchDraftType('text')}
                                                            className={`inline-flex h-full items-center gap-1 rounded px-3 text-xs font-bold transition sm:px-2 ${
                                                                draftMemoType === 'text'
                                                                    ? 'bg-slate-900 text-white'
                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                                }`}
                                                                aria-label="본문 형식"
                                                                aria-pressed={draftMemoType === 'text'}
                                                            >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            본문
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => switchDraftType('checklist')}
                                                            className={`inline-flex h-full items-center gap-1 rounded px-3 text-xs font-bold transition sm:px-2 ${
                                                                draftMemoType === 'checklist'
                                                                    ? 'bg-slate-900 text-white'
                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                                }`}
                                                                aria-label="체크리스트 형식"
                                                                aria-pressed={draftMemoType === 'checklist'}
                                                            >
                                                            <CheckSquare className="h-3.5 w-3.5" />
                                                            체크
                                                        </button>
                                                    </div>
                                                    <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                                                        <Clock3 className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{formatDate(memo.updatedAt || memo.createdAt)}</span>
                                                        <span className={`shrink-0 font-bold ${autoSaveTone}`}>{autoSaveLabel}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => cycleStickyMemoSize(memo.id)}
                                                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:h-8 sm:px-2"
                                                        aria-label={`${memo.title} ${expansionActionLabel}`}
                                                        aria-pressed={expansionLevel > 0}
                                                    >
                                                        {expansionLevel === 2 ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                                        {expansionButtonText}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className={draftMemoType === 'checklist' ? 'min-h-0 flex-1 p-2' : 'min-h-0 flex-1 p-3'}>
                                                {draftMemoType === 'text' ? (
                                                    <textarea
                                                        value={draftTextParts.content}
                                                        onChange={event => updateTextDraftContent(event.target.value)}
                                                        className="h-full min-h-[180px] w-full resize-none rounded-md border bg-white p-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                                        style={{ borderColor: cardTheme.border }}
                                                        placeholder="본문을 입력하세요."
                                                        aria-label="메모 본문"
                                                    />
                                                ) : (
                                                    <div
                                                        className="h-full min-h-[180px] overflow-y-auto rounded-md border bg-white p-1.5"
                                                        style={{ borderColor: cardTheme.border }}
                                                    >
                                                        <div className="space-y-1.5">
                                                            {draftChecklistItems.map((item, index) => (
                                                                <div key={item.id} className="group flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
                                                                    <label className="grid h-11 w-11 shrink-0 place-items-center sm:h-8 sm:w-8">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={item.isChecked}
                                                                            onChange={event => updateDraftChecklistItem(item.id, { isChecked: event.target.checked })}
                                                                            className="h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                                                                            title="완료"
                                                                            aria-label={`${item.text || '빈 항목'} 완료 여부`}
                                                                        />
                                                                    </label>
                                                                    <input
                                                                        ref={element => {
                                                                            if (element) checklistItemInputRefs.current.set(item.id, element);
                                                                            else checklistItemInputRefs.current.delete(item.id);
                                                                        }}
                                                                        value={item.text}
                                                                        onChange={event => updateDraftChecklistItem(item.id, { text: event.target.value })}
                                                                        onKeyDown={event => handleChecklistItemKeyDown(event, index, item)}
                                                                        className={`h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 sm:h-8 ${
                                                                            item.isChecked ? 'text-slate-400 line-through' : 'text-slate-800'
                                                                        }`}
                                                                        placeholder="할 일을 입력하세요."
                                                                        aria-label={`체크리스트 항목 ${index + 1}`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteDraftChecklistItem(item.id)}
                                                                        className="grid h-11 w-11 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:h-7 sm:w-7"
                                                                        title="항목 삭제"
                                                                        aria-label={`${item.text || '빈 항목'} 삭제`}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => addDraftChecklistItem()}
                                                            className="mt-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:h-8 sm:px-2"
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
                                                    onClick={() => void selectStickyMemo(memo)}
                                                    className="min-w-0 flex-1 text-left"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {memo.type === 'checklist' ? (
                                                            <CheckSquare className="h-4 w-4 shrink-0 text-slate-700" />
                                                        ) : (
                                                            <FileText className="h-4 w-4 shrink-0 text-slate-600" />
                                                        )}
                                                        {memo.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-label="중요 메모" />}
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
                                                    onClick={() => cycleStickyMemoSize(memo.id)}
                                                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:h-8 sm:w-8"
                                                    title={expansionButtonText}
                                                    aria-label={`${memo.title} ${expansionActionLabel}`}
                                                    aria-pressed={expansionLevel > 0}
                                                >
                                                    {expansionLevel === 2 ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                                </button>
                                                <MemoCardActionMenu
                                                    memoTitle={memo.title}
                                                    isPinned={memo.isPinned}
                                                    disabled={isSaving}
                                                    compact
                                                    onTogglePinned={() => void toggleMemoPinned(memo)}
                                                    onCopy={() => void copyMemoToClipboard(memo)}
                                                    onDelete={() => void deleteMemoRecord(memo)}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void selectStickyMemo(memo)}
                                                className="flex min-h-0 flex-1 appearance-none flex-col items-stretch justify-start overflow-y-auto p-2 text-left"
                                                aria-label={`${memo.title} 내용 열기`}
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
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-normal text-slate-950">스마트 메모</h1>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    {filteredMemos.length.toLocaleString('ko-KR')}개
                                </span>
                            </div>
                            <p className="sr-only" aria-live="polite">{statusMessage}</p>
                        </div>

                        <MemoViewToolbar
                            searchQuery={searchQuery}
                            sortMode={sortMode}
                            viewMode={viewMode}
                            isCreateMenuOpen={isCreateMenuOpen}
                            isSaving={isSaving}
                            onSearchQueryChange={setSearchQuery}
                            onSortModeChange={setSortMode}
                            onViewModeChange={setViewMode}
                            onOpenCategoryComposer={() => setIsCategoryComposerOpen(true)}
                            onToggleCreateMenu={() => setIsCreateMenuOpen(previous => !previous)}
                            onCloseCreateMenu={() => setIsCreateMenuOpen(false)}
                            onCreateMemo={type => void createMemo(type)}
                        />
                    </div>
                </header>

                {isCategoryComposerOpen && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
                        <section
                            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="new-category-title"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 id="new-category-title" className="text-lg font-bold text-slate-950">새 카테고리</h2>
                                    <p className="mt-1 text-sm text-slate-500">이름과 구분 색상을 선택하세요.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCategoryComposerOpen(false)}
                                    className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                                    aria-label="카테고리 창 닫기"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <label className="mt-5 block">
                                <span className="mb-2 block text-sm font-bold text-slate-700">카테고리 이름</span>
                                <input
                                    value={newCategoryName}
                                    onChange={event => setNewCategoryName(event.target.value)}
                                    onKeyDown={handleCategoryKeyDown}
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    placeholder="예: 현장 업무"
                                    autoFocus
                                />
                            </label>
                            <div className="mt-4">
                                <span className="mb-2 block text-sm font-bold text-slate-700">구분 색상</span>
                                {renderColorOptions(
                                    newCategoryColor,
                                    setNewCategoryColor,
                                    true,
                                    '새 카테고리 색상 선택'
                                )}
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCategoryComposerOpen(false)}
                                    className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void createCategory()}
                                    disabled={isSaving || !newCategoryName.trim()}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <FolderPlus className="h-4 w-4" />
                                    카테고리 추가
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
                        {errorMessage}
                    </div>
                )}

                {viewMode === 'split' && (
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm lg:hidden" role="tablist" aria-label="메모 모바일 화면">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mobilePane === 'list'}
                            onClick={() => setMobilePane('list')}
                            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${
                                mobilePane === 'list' ? 'bg-blue-700 text-white' : 'text-slate-600'
                            }`}
                        >
                            <List className="h-4 w-4" />
                            메모 목록
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mobilePane === 'editor'}
                            onClick={() => setMobilePane('editor')}
                            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${
                                mobilePane === 'editor' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                            }`}
                        >
                            <FileText className="h-4 w-4" />
                            편집
                        </button>
                    </div>
                )}

                {viewMode === 'sticky' ? stickyMemoBoard : (
                <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[420px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[480px_minmax(0,1fr)]">
                    <aside className={`${mobilePane === 'list' ? 'flex' : 'hidden'} min-h-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-blue-200 bg-blue-50 shadow-sm shadow-slate-200/70 lg:flex lg:h-full lg:min-h-0`}>
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

                            {checkedMemoIds.length > 0 && (
                            <div className="grid gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
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
                            )}
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
                                    <p className="mt-1 text-xs font-semibold text-slate-400">검색 조건을 바꾸거나 상단에서 새 메모를 만드세요.</p>
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
                                                        aria-label={`${memo.title} 선택`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => void focusMemoEditor(memo.id)}
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
                                                        {memo.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-label="중요 메모" />}
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
                                                        onClick={() => void toggleMemoPinned(memo)}
                                                        disabled={isSaving}
                                                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border bg-white opacity-100 transition sm:h-8 sm:w-8 lg:opacity-0 lg:group-hover:opacity-100 ${
                                                            memo.isPinned
                                                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50 lg:opacity-100'
                                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                                        }`}
                                                        title={memo.isPinned ? '중요 메모 고정 해제' : '중요 메모로 고정'}
                                                        aria-label={`${memo.title} ${memo.isPinned ? '중요 메모 고정 해제' : '중요 메모로 고정'}`}
                                                        aria-pressed={memo.isPinned}
                                                    >
                                                        {memo.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyMemoToClipboard(memo)}
                                                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 opacity-100 transition hover:bg-slate-50 hover:text-slate-950 sm:h-8 sm:w-8 lg:opacity-0 lg:group-hover:opacity-100"
                                                        title="클립보드에 복사"
                                                        aria-label={`${memo.title} 메모 복사`}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void deleteMemoRecord(memo)}
                                                        disabled={isSaving}
                                                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-red-200 bg-white text-red-700 opacity-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8 lg:opacity-0 lg:group-hover:opacity-100"
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
                        className={`${mobilePane === 'editor' ? 'flex' : 'hidden'} min-h-[420px] min-w-0 flex-col overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm lg:flex lg:h-full lg:min-h-0`}
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
                                                <span className={`shrink-0 font-bold ${autoSaveTone}`}>{autoSaveLabel}</span>
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                            {memoCategoryPicker}
                                            <div
                                                className="inline-flex h-11 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:h-9"
                                                role="group"
                                                aria-label="메모 형식 선택"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => switchDraftType('text')}
                                                    className={`inline-flex h-full items-center gap-1.5 rounded-md px-3 text-xs font-bold transition sm:px-2 ${
                                                        draftMemoType === 'text'
                                                            ? 'bg-slate-900 text-white'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                    aria-label="본문 형식"
                                                    aria-pressed={draftMemoType === 'text'}
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    본문
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => switchDraftType('checklist')}
                                                    className={`inline-flex h-full items-center gap-1.5 rounded-md px-3 text-xs font-bold transition sm:px-2 ${
                                                        draftMemoType === 'checklist'
                                                            ? 'bg-slate-900 text-white'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                    aria-label="체크리스트 형식"
                                                    aria-pressed={draftMemoType === 'checklist'}
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    체크
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void saveMemo()}
                                                disabled={isSaving || !hasDraftChanges}
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                                            >
                                                <Save className="h-4 w-4" />
                                                저장
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void toggleMemoPinned(selectedMemo)}
                                                disabled={isSaving}
                                                className={`grid h-11 w-11 place-items-center rounded-lg border bg-white transition sm:h-9 sm:w-9 ${
                                                    selectedMemo.isPinned
                                                        ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                                }`}
                                                title={selectedMemo.isPinned ? '중요 메모 고정 해제' : '중요 메모로 고정'}
                                                aria-label={selectedMemo.isPinned ? '선택한 메모 중요 고정 해제' : '선택한 메모 중요 고정'}
                                                aria-pressed={selectedMemo.isPinned}
                                            >
                                                {selectedMemo.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void copyMemoToClipboard(selectedMemo, draftMemoClipboardText)}
                                                className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:h-9 sm:w-9"
                                                title="클립보드에 복사"
                                                aria-label="선택한 메모 복사"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void deleteMemo()}
                                                disabled={isSaving}
                                                className="grid h-11 w-11 place-items-center rounded-lg border border-red-200 bg-white text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
                                                title="삭제"
                                                aria-label="선택한 메모 삭제"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={draftMemoType === 'checklist' ? 'min-h-0 flex-1 overflow-y-auto p-2' : 'min-h-0 flex-1 overflow-y-auto p-3'}
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
                                                aria-label="메모 제목과 본문"
                                            />
                                        </label>
                                    ) : (
                                        <div className="flex min-h-[420px] flex-col gap-2 lg:h-full lg:min-h-0">
                                            <label
                                                className="flex shrink-0 items-center gap-2 rounded-lg border bg-white px-2.5 py-2"
                                                style={{ borderColor: draftAccentTheme.border }}
                                            >
                                                <span className="shrink-0 text-xs font-bold text-slate-600">제목</span>
                                                <input
                                                    value={draftTitle}
                                                    onChange={event => setDraftTitle(event.target.value)}
                                                    className="h-9 min-w-0 flex-1 rounded-md bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-100"
                                                    placeholder="체크리스트 제목"
                                                    aria-label="체크리스트 제목"
                                                />
                                            </label>
                                            <div
                                                className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white p-2"
                                                style={{ borderColor: draftAccentTheme.border }}
                                                aria-label="체크리스트 항목 편집 영역"
                                            >
                                                <div className="space-y-2">
                                                    {draftChecklistItems.map((item, index) => (
                                                        <div key={item.id} className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                                                            <label className="grid h-11 w-11 shrink-0 place-items-center sm:h-9 sm:w-9">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.isChecked}
                                                                    onChange={event => updateDraftChecklistItem(item.id, { isChecked: event.target.checked })}
                                                                    className="h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                                                                    title="완료"
                                                                    aria-label={`${item.text || '빈 항목'} 완료 여부`}
                                                                />
                                                            </label>
                                                            <input
                                                                ref={element => {
                                                                    if (element) checklistItemInputRefs.current.set(item.id, element);
                                                                    else checklistItemInputRefs.current.delete(item.id);
                                                                }}
                                                                value={item.text}
                                                                onChange={event => updateDraftChecklistItem(item.id, { text: event.target.value })}
                                                                onKeyDown={event => handleChecklistItemKeyDown(event, index, item)}
                                                                className={`h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 sm:h-9 ${
                                                                    item.isChecked ? 'text-slate-400 line-through' : 'text-slate-800'
                                                                }`}
                                                                placeholder="할 일을 입력하세요"
                                                                aria-label={`체크리스트 항목 ${index + 1}`}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteDraftChecklistItem(item.id)}
                                                                className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:h-8 sm:w-8"
                                                                title="항목 삭제"
                                                                aria-label={`${item.text || '빈 항목'} 삭제`}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => addDraftChecklistItem()}
                                                    className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:h-10"
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
                                <p className="text-sm font-semibold">메모 목록에서 편집할 항목을 선택하세요.</p>
                                <button
                                    type="button"
                                    onClick={() => setMobilePane('list')}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 lg:hidden"
                                >
                                    <List className="h-4 w-4" />
                                    목록으로 이동
                                </button>
                            </div>
                        )}
                    </section>
                </div>
                )}

                <MemoUndoToast
                    count={deletedMemoSnapshots.length}
                    disabled={isSaving}
                    onUndo={() => void restoreDeletedMemos()}
                    onDismiss={dismissDeleteUndo}
                />
            </div>
        </main>
    );
}

export default MemoPage;
