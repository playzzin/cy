import { Timestamp } from "firebase/firestore";

export type MemoPriority = 'low' | 'medium' | 'high';
export type MemoColor = 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';
export type MemoSortMode = 'manual' | 'newest' | 'title' | 'starred';

export type MemoType = 'text' | 'checklist';

export interface ChecklistItem {
    id: string;
    text: string;
    isChecked: boolean;
}

export interface Memo {
    id: string;
    userId: string;
    // Core Data
    type: MemoType;
    title: string;
    content: string; // Used for text type
    checklistItems?: ChecklistItem[]; // Used for checklist type

    // Styling
    color: MemoColor;
    order: number;

    // Metadata / Organization (Restored)
    isPinned: boolean;
    tags?: string[];
    categoryId?: string | null;
    priority?: MemoPriority; // Optional in V2

    // Grid Layout (RGL)
    x: number;
    y: number;
    w: number;
    h: number;

    // Collapse State (2D)
    isCollapsed: boolean;
    prevW?: number; // Width before collapse
    prevH?: number; // Height before collapse

    createdAt: any; // Firestore Timestamp
    updatedAt: any;
}

export interface Category {
    id: string;
    userId: string;
    name: string;
    color?: string;
    icon?: string;
    order: number;
    createdAt: Timestamp | null;
}

export interface MemoState {
    memos: Memo[];
    categories: Category[];
    isLoading: boolean;
    error: string | null;

    // Internal Unsubscribe Functions (for robust cleanup)
    unsubscribeMemos: (() => void) | null;
    unsubscribeCategories: (() => void) | null;

    // View Mode State (Local Only)
    expandedMemos: Record<string, boolean>; // id -> isExpanded
    isGlobalExpanded: boolean; // Track global state preference
    sortMode: MemoSortMode;
    layoutVersion: number;

    // Actions
    subscribeMemos: (userId: string) => () => void; // Returns unsubscribe function
    toggleMemoExpanded: (id: string) => void;
    setAllExpanded: (expanded: boolean) => void;
    setSortMode: (mode: MemoSortMode) => void;

    // CRUD Actions
    addMemo: (memo: Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, userId: string) => Promise<string>;
    updateMemo: (id: string, updates: Partial<Memo>) => Promise<void>;
    deleteMemo: (id: string) => Promise<void>;

    // Category Actions
    addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'userId'>, userId: string) => Promise<void>;
    updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    reorderCategories: (newCategories: Category[]) => Promise<void>;

    // Drag & Drop Actions
    reorderMemos: (newMemos: Memo[]) => Promise<void>;
    moveMemoToCategory: (memoId: string, categoryId: string | null) => Promise<void>;

    // Checklist Actions
    toggleChecklistItem: (memoId: string, itemId: string) => Promise<void>;
    addChecklistItem: (memoId: string, text: string, index?: number) => Promise<void>;
    updateChecklistItem: (memoId: string, itemId: string, text: string) => Promise<void>;
    deleteChecklistItem: (memoId: string, itemId: string) => Promise<void>;
    convertToChecklist: (memoId: string) => Promise<void>;
    convertToText: (memoId: string) => Promise<void>;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Type 3: Grid Layout Actions (RGL)
    updateMemoLayouts: (layouts: { i: string, x: number, y: number, w: number, h: number }[]) => Promise<void>;
    toggleMemoCollapse: (id: string, updates: { isCollapsed: boolean, h?: number }) => Promise<void>;
    repackMemos: (strategy?: 'date-desc' | 'date-asc' | 'title', options?: { scopeIds?: string[]; gridCols?: number }) => Promise<void>;
}
