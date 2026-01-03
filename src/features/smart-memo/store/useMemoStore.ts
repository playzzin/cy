import { create } from 'zustand';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch,
    deleteField
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Memo, Category, MemoState } from '../types/memo';

const MEMO_COLLECTION = 'smart_memos';
const CATEGORY_COLLECTION = 'smart_memo_categories';

export const useMemoStore = create<MemoState>((set, get) => ({
    memos: [],
    categories: [],
    isLoading: false,
    error: null,
    unsubscribeMemos: null,
    unsubscribeCategories: null,
    expandedMemos: {},
    isGlobalExpanded: true,
    sortMode: 'manual',
    searchQuery: '',
    layoutVersion: 0,

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortMode: (mode) => set({ sortMode: mode }),

    toggleMemoExpanded: (id) => {
        set((state) => {
            const current = state.expandedMemos[id] ?? state.isGlobalExpanded;
            return {
                expandedMemos: {
                    ...state.expandedMemos,
                    [id]: !current
                }
            };
        });
    },

    setAllExpanded: (expanded) => {
        set((state) => {
            const newExpandedMap: Record<string, boolean> = {};
            state.memos.forEach(memo => {
                newExpandedMap[memo.id] = expanded;
            });
            return {
                expandedMemos: newExpandedMap,
                isGlobalExpanded: expanded
            };
        });
    },

    subscribeMemos: (userId: string) => {
        const state = get();

        if (state.unsubscribeMemos) {
            state.unsubscribeMemos();
        }
        if (state.unsubscribeCategories) {
            state.unsubscribeCategories();
        }

        if (!userId) {
            set({ error: "User ID is required for subscription" });
            return () => { };
        }

        set({ isLoading: true });

        // Internal buffers for merge
        let privateMemos: Memo[] = [];
        let publicMemos: Memo[] = [];

        const updateMergedState = () => {
            // Merge: Private + Public
            // Deduplication: If a memo is BOTH private (my own) and public, it appears in both.
            // We use a Map keyed by ID.
            const memoMap = new Map<string, Memo>();

            // Add private first
            privateMemos.forEach(m => memoMap.set(m.id, m));
            // Add public (overwrite if exists - should be same data, but ensures we satisfy "public is public")
            publicMemos.forEach(m => memoMap.set(m.id, m));

            const merged = Array.from(memoMap.values());

            // Client-side sorting
            merged.sort((a, b) => {
                const pinnedA = a.isPinned ? 1 : 0;
                const pinnedB = b.isPinned ? 1 : 0;
                if (pinnedA !== pinnedB) return pinnedB - pinnedA;

                if (a.order !== undefined && b.order !== undefined) {
                    return a.order - b.order;
                }
                const dateA = a.updatedAt?.toMillis() || 0;
                const dateB = b.updatedAt?.toMillis() || 0;
                return dateB - dateA;
            });

            set({ memos: merged, isLoading: false, error: null });
        };

        // 1. Private Memos Listener
        const privateQuery = query(
            collection(db, MEMO_COLLECTION),
            where("userId", "==", userId)
        );

        const unsubPrivate = onSnapshot(privateQuery, (snapshot) => {
            privateMemos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Memo[];
            updateMergedState();
        }, (error) => {
            console.error("Private memo subscription error:", error);
            set({ error: error.message });
        });

        // 2. Public Memos Listener
        const publicQuery = query(
            collection(db, MEMO_COLLECTION),
            where("scope", "==", "public")
        );

        const unsubPublic = onSnapshot(publicQuery, (snapshot) => {
            publicMemos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Memo[];
            updateMergedState();
        }, (error) => {
            console.error("Public memo subscription error:", error);
            // Don't block UI if public fetch fails (e.g. permission)
        });

        // 3. Categories Listener
        const categoryQuery = query(
            collection(db, CATEGORY_COLLECTION),
            where("userId", "==", userId)
        );

        const unsubscribeCategories = onSnapshot(categoryQuery,
            (snapshot) => {
                let categories = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Category[];
                categories.sort((a, b) => (a.order || 0) - (b.order || 0));
                set({ categories });
            },
            (error) => {
                console.error("Category subscription error:", error);
            }
        );

        const unsubscribeMemos = () => {
            unsubPrivate();
            unsubPublic();
        };

        set({ unsubscribeMemos, unsubscribeCategories });

        return () => {
            unsubscribeMemos();
            unsubscribeCategories();
            set({ unsubscribeMemos: null, unsubscribeCategories: null });
        };
    },

    addMemo: async (memoData, userId) => {
        try {
            if (!userId) throw new Error("User ID is missing");

            const docRef = doc(collection(db, MEMO_COLLECTION));
            const newId = docRef.id;
            const now = serverTimestamp();

            // Logic: Category 'public' maps to scope 'public'
            const scope = memoData.categoryId === 'public' ? 'public' : 'private';

            setDoc(docRef, {
                ...memoData,
                categoryId: memoData.categoryId === 'public' ? 'public' : (memoData.categoryId ?? null),
                scope,
                userId,
                order: 0,
                createdAt: now,
                updatedAt: now,
            });

            return newId;
        } catch (error: any) {
            console.error("Failed to add memo:", error);
            set({ error: error.message });
            throw error;
        }
    },

    updateMemo: async (id, updates) => {
        try {
            const docRef = doc(db, MEMO_COLLECTION, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp(),
            });
        } catch (error: any) {
            console.error("Failed to update memo:", error);
            set({ error: error.message });
            throw error;
        }
    },

    reorderMemos: async (newMemos: Memo[]) => {
        const previousMemos = get().memos;

        // 1. Optimistic Update
        set({ memos: newMemos });

        try {
            // 2. Batch Update to Firestore
            const batch = writeBatch(db);

            newMemos.forEach((memo, index) => {
                // Determine new order value (e.g., spacing by 1000 to allow future insertions)
                const newOrder = (index + 1) * 1000;

                // Only update if order has changed (optimization)
                if (memo.order !== newOrder) {
                    const docRef = doc(db, MEMO_COLLECTION, memo.id);
                    batch.update(docRef, { order: newOrder });
                    // Update local state to match persistent state immediately to avoid drift
                    memo.order = newOrder;
                }
            });

            await batch.commit();
        } catch (error: any) {
            console.error("Failed to reorder memos:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    moveMemoToCategory: async (memoId: string, categoryId: string | null) => {
        const previousMemos = get().memos;

        // Scope logic
        const newScope = categoryId === 'public' ? 'public' : 'private';

        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m =>
                m.id === memoId ? { ...m, categoryId: categoryId || undefined, scope: newScope } : m
            )
        }));

        try {
            // 2. Firestore Update
            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                categoryId: categoryId || null,
                scope: newScope,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to move memo category:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    deleteMemo: async (id) => {
        try {
            await deleteDoc(doc(db, MEMO_COLLECTION, id));
        } catch (error: any) {
            console.error("Failed to delete memo:", error);
            set({ error: error.message });
            throw error;
        }
    },

    addCategory: async (categoryData, userId) => {
        try {
            if (!userId) throw new Error("User ID is missing");
            await addDoc(collection(db, CATEGORY_COLLECTION), {
                ...categoryData,
                userId,
                createdAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to add category:", error);
            set({ error: error.message });
            throw error;
        }
    },

    updateCategory: async (id, updates) => {
        try {
            const docRef = doc(db, CATEGORY_COLLECTION, id);
            await updateDoc(docRef, { ...updates });
        } catch (error: any) {
            console.error("Failed to update category:", error);
            set({ error: error.message });
            throw error;
        }
    },

    deleteCategory: async (id) => {
        try {
            await deleteDoc(doc(db, CATEGORY_COLLECTION, id));
        } catch (error: any) {
            console.error("Failed to delete category:", error);
            set({ error: error.message });
            throw error;
        }
    },

    reorderCategories: async (newCategories: Category[]) => {
        // 1. Optimistic Update
        set({ categories: newCategories });

        try {
            // 2. Batch Update
            const batch = writeBatch(db);
            newCategories.forEach((cat, index) => {
                const docRef = doc(db, CATEGORY_COLLECTION, cat.id);
                batch.update(docRef, { order: index, updatedAt: serverTimestamp() });
            });
            await batch.commit();
        } catch (error: any) {
            console.error("Failed to reorder categories:", error);
            // Rollback is tricky here without keeping validation state, but manageable.
        }
    },

    toggleChecklistItem: async (memoId: string, itemId: string) => {
        const previousMemos = get().memos;
        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
                    )
                };
            })
        }));

        try {
            // 2. Firestore Update
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                checklistItems: memo.checklistItems,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to toggle checklist item:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    addChecklistItem: async (memoId: string, text: string, index?: number) => {
        const previousMemos = get().memos;
        const newItem = {
            id: crypto.randomUUID(), // Local ID generation
            text,
            isChecked: false
        };

        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId) return m;
                const currentItems = m.checklistItems || [];
                const newItems = [...currentItems];
                if (typeof index === 'number' && index >= 0) {
                    newItems.splice(index, 0, newItem);
                } else {
                    newItems.push(newItem);
                }
                return { ...m, checklistItems: newItems, type: 'checklist' };
            })
        }));

        try {
            // 2. Firestore Update
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;

            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                checklistItems: memo.checklistItems,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to add checklist item:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    updateChecklistItem: async (memoId: string, itemId: string, text: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId ? { ...item, text } : item
                    )
                };
            })
        }));

        try {
            // Debounce logic could be applied at UI component level, 
            // but here we just blindly update content for simplicity.
            // If high traffic, might need debounce.
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                checklistItems: memo.checklistItems,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to update checklist item:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    deleteChecklistItem: async (memoId: string, itemId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    checklistItems: m.checklistItems.filter(item => item.id !== itemId)
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;

            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                checklistItems: memo.checklistItems,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to delete checklist item:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    addChecklistComment: async (memoId: string, itemId: string, text: string) => {
        const previousMemos = get().memos;
        const newComment = {
            id: crypto.randomUUID(),
            text,
            createdAt: Date.now()
        };

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId
                            ? { ...item, comments: [...(item.comments || []), newComment] }
                            : item
                    )
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                checklistItems: memo.checklistItems.map(item => ({
                    ...item,
                    comments: item.comments?.map(comment =>
                        comment.id === newComment.id ? { ...comment, createdAt: Date.now() } : comment
                    )
                })),
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to add checklist comment:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    deleteChecklistComment: async (memoId: string, itemId: string, commentId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId || !m.checklistItems) return m;
                return {
                    ...m,
                    checklistItems: m.checklistItems.map(item =>
                        item.id === itemId
                            ? { ...item, comments: (item.comments || []).filter(comment => comment.id !== commentId) }
                            : item
                    )
                };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo || !memo.checklistItems) return;

            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                checklistItems: memo.checklistItems,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to delete checklist comment:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    convertToChecklist: async (memoId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId) return m;
                const text = m.content || "";
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const checklistItems = lines.map(line => ({
                    id: crypto.randomUUID(),
                    text: line,
                    isChecked: false
                }));
                return { ...m, type: 'checklist', checklistItems, content: "" }; // Clear content? Or keep as backup? Clear to avoid confusing sync.
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;
            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                type: 'checklist',
                checklistItems: memo.checklistItems,
                content: "", // Clear logic
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to convert to checklist:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },

    convertToText: async (memoId: string) => {
        const previousMemos = get().memos;

        set(state => ({
            memos: state.memos.map(m => {
                if (m.id !== memoId) return m;
                const items = m.checklistItems || [];
                const content = items.map(item => item.isChecked ? `[x] ${item.text}` : item.text).join('\n');
                return { ...m, type: 'text', content, checklistItems: [] };
            })
        }));

        try {
            const memo = get().memos.find(m => m.id === memoId);
            if (!memo) return;
            const docRef = doc(db, MEMO_COLLECTION, memoId);
            await updateDoc(docRef, {
                type: 'text',
                content: memo.content,
                checklistItems: [],
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Failed to convert to text:", error);
            set({ error: error.message, memos: previousMemos });
        }
    },
    updateMemoLayouts: async (layouts) => {
        const previousMemos = get().memos;

        // 1. Optimistic Update
        set(state => ({
            memos: state.memos.map(m => {
                const layout = layouts.find(l => l.i === m.id);
                if (layout) {
                    return { ...m, x: layout.x, y: layout.y, w: layout.w, h: layout.h };
                }
                return m;
            })
        }));

        try {
            // 2. Batch Update
            const batch = writeBatch(db);
            let updateCount = 0;

            layouts.forEach(layout => {
                // Optimization: Check if actually changed? 
                // RGL gives all items usually, or just changed ones? 
                // 'onLayoutChange' gives ALL. We should filter.
                const original = previousMemos.find(m => m.id === layout.i);
                if (
                    original &&
                    (original.x !== layout.x || original.y !== layout.y || original.w !== layout.w || original.h !== layout.h)
                ) {
                    const docRef = doc(db, MEMO_COLLECTION, layout.i);
                    batch.update(docRef, {
                        x: layout.x,
                        y: layout.y,
                        w: layout.w,
                        h: layout.h,
                        updatedAt: serverTimestamp() // Only update TS if moved? optional.
                    });
                    updateCount++;
                }
            });

            if (updateCount > 0) {
                await batch.commit();
            }
        } catch (error: any) {
            console.error("Failed to update layout:", error);
            set({ error: error.message, memos: previousMemos }); // Rollback
        }
    },

    toggleMemoCollapse: async (id, updates) => {
        const memoRef = doc(db, MEMO_COLLECTION, id);
        const state = get();
        const memo = state.memos.find(m => m.id === id);

        if (!memo) return;
        if (memo.isCollapsed === updates.isCollapsed) return;

        // 1. Calculate new dimensions
        // Collapsed size: W=2, H=1 (Title only view)
        const COLLAPSED_W = 2;
        const COLLAPSED_H = 1;

        const newW = updates.isCollapsed ? COLLAPSED_W : (memo.prevW || memo.w || 4);
        const newH = updates.isCollapsed ? COLLAPSED_H : (memo.prevH || memo.h || 4);

        // 2. Optimistic State Preparation
        // Deep copy needed for mutation during collision resolution
        let newMemos = state.memos.map(m => m.id === id
            ? { ...m, isCollapsed: updates.isCollapsed, w: newW, h: newH }
            : { ...m }
        );

        // 3. PUSH LOGIC (Only when Expanding)
        // If expanding, we shove other memos down to make space.
        if (!updates.isCollapsed) {
            const collides = (r1: any, r2: any) => {
                return (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y);
            };

            const resolveCollisions = () => {
                let changed = false;
                // Sort by Y (top to bottom) to resolve cascading pushes
                newMemos.sort((a, b) => a.y - b.y || a.x - b.x);

                for (let i = 0; i < newMemos.length; i++) {
                    const m1 = newMemos[i];
                    for (let j = 0; j < newMemos.length; j++) {
                        const m2 = newMemos[j];
                        if (m1.id === m2.id) continue;

                        if (collides(m1, m2)) {
                            // Collision detected. 
                            // Rule: The one that is "below" or isn't the active one moves.
                            let mover, anchor;

                            if (m1.id === id) { mover = m2; anchor = m1; }
                            else if (m2.id === id) { mover = m1; anchor = m2; }
                            else {
                                // If neither is the expander, move the one visibly lower
                                if (m1.y < m2.y) { mover = m2; anchor = m1; }
                                else { mover = m1; anchor = m2; }
                            }

                            // Move mover below anchor
                            const requiredY = anchor.y + anchor.h;
                            if (mover.y < requiredY) {
                                mover.y = requiredY;
                                changed = true;
                            }
                        }
                    }
                }
                return changed;
            };

            // Run resolution until stable (max 10 passes to prevent infinite loops)
            let passes = 0;
            while (resolveCollisions() && passes < 10) {
                passes++;
            }
        }

        // 4. Update Store
        set({ memos: newMemos });

        // 5. Update Firestore
        try {
            const batch = writeBatch(db);

            // Update Target Memo
            const targetData: any = {
                isCollapsed: updates.isCollapsed,
                w: newW,
                h: newH,
                updatedAt: serverTimestamp()
            };

            if (updates.isCollapsed) {
                targetData.prevW = memo.w;
                targetData.prevH = memo.h;
            } else {
                targetData.prevW = deleteField();
                targetData.prevH = deleteField();
            }
            batch.update(memoRef, targetData);

            // Update Moved Memos
            newMemos.forEach(m => {
                if (m.id !== id) {
                    const original = state.memos.find(om => om.id === m.id);
                    // Only write if position actually changed
                    if (original && (original.x !== m.x || original.y !== m.y)) {
                        batch.update(doc(db, MEMO_COLLECTION, m.id), { x: m.x, y: m.y });
                    }
                }
            });

            await batch.commit();
        } catch (error: any) {
            console.error("Failed to toggle collapse:", error);
            // Rollback on error
            set({ memos: state.memos, error: error.message });
        }
    },

    repackMemos: async (strategy: 'date-desc' | 'date-asc' | 'title' = 'date-desc', options) => {
        const previousMemos = get().memos;

        const gridCols = Math.max(1, Math.floor(options?.gridCols ?? 12));
        const scopeSet = options?.scopeIds ? new Set(options.scopeIds) : null;
        const scopeMemos = scopeSet ? previousMemos.filter(m => scopeSet.has(m.id)) : previousMemos;

        const sortedMemos = [...scopeMemos];

        const getUpdatedMillis = (memo: Memo) => {
            const val = memo.updatedAt;
            // Handle Firestore Timestamp
            if (val && typeof val.toMillis === 'function') {
                return val.toMillis();
            }
            // Handle Optimistic ServerTimestamp (FieldValue or similar object)
            // If it exists but no toMillis, assume it's "now" (pending write)
            if (val && typeof val === 'object') {
                return Date.now();
            }
            // Fallback for missing date
            return 0;
        };

        sortedMemos.sort((a, b) => {
            const pinnedA = a.isPinned ? 1 : 0;
            const pinnedB = b.isPinned ? 1 : 0;
            if (pinnedA !== pinnedB) return pinnedB - pinnedA;

            if (strategy === 'date-desc') {
                return getUpdatedMillis(b) - getUpdatedMillis(a);
            }
            if (strategy === 'date-asc') {
                return getUpdatedMillis(a) - getUpdatedMillis(b);
            }
            return a.title.localeCompare(b.title);
        });

        const colHeights = new Array(gridCols).fill(0);

        const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
        const getSafeNumber = (value: unknown, fallback: number) => (isFiniteNumber(value) ? value : fallback);

        const layouts = sortedMemos.map(memo => {
            const rawW = getSafeNumber(memo.w, 4);
            const rawH = memo.isCollapsed ? 1 : getSafeNumber(memo.h, 4);

            const w = Math.min(Math.max(1, Math.floor(rawW)), gridCols);
            const h = Math.max(1, Math.floor(rawH));

            let bestX = 0;
            let bestY = Infinity;

            // Find the absolute lowest position that fits the width
            for (let x = 0; x <= gridCols - w; x++) {
                let maxYInSpan = 0;
                for (let k = x; k < x + w; k++) {
                    maxYInSpan = Math.max(maxYInSpan, colHeights[k]);
                }

                if (maxYInSpan < bestY) {
                    bestY = maxYInSpan;
                    bestX = x;
                }
            }

            // Update column heights
            for (let k = bestX; k < bestX + w; k++) {
                colHeights[k] = bestY + h;
            }

            return {
                i: memo.id,
                x: bestX,
                y: bestY,
                w,
                h
            };
        });

        const newVersion = get().layoutVersion + 1;
        set({ layoutVersion: newVersion });
        await get().updateMemoLayouts(layouts);
    }
}));
