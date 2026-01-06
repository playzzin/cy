import { useMemo } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import { Memo } from '../types/memo';

// Helper to safely get millis
const getMillis = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toMillis === 'function') return val.toMillis();
    return Date.now();
};

export const useMemoSelector = (selectedCategoryId: string | null = null) => {
    const memos = useMemoStore(state => state.memos);
    const filters = useMemoStore(state => state.filters);
    const sortConfig = useMemoStore(state => state.sortConfig);
    const activeSpace = useMemoStore(state => state.activeSpace);
    const searchQuery = useMemoStore(state => state.searchQuery);

    return useMemo(() => {
        let result = [...memos];

        // 1. Space Filter
        result = result.filter(memo =>
            activeSpace === 'team' ? memo.scope === 'public' : memo.scope !== 'public'
        );

        // 2. Category Filter
        if (selectedCategoryId) {
            result = result.filter(m => m.categoryId === selectedCategoryId);
        }

        // 3. Color Filter
        if (filters.colorFilter) {
            result = result.filter(m => m.color === filters.colorFilter);
        }

        // 4. Type Filter
        if (filters.typeFilter) {
            result = result.filter(m => m.type === filters.typeFilter);
        }

        // 5. Search Filter
        const query = (searchQuery || '').toLowerCase().trim();
        if (query) {
            result = result.filter(memo => {
                const titleMatch = (memo.title || '').toLowerCase().includes(query);
                const contentMatch = (memo.content || '').toLowerCase().includes(query);
                const checklistMatch = memo.checklistItems?.some(item =>
                    item.text.toLowerCase().includes(query)
                );
                return titleMatch || contentMatch || checklistMatch;
            });
        }

        // 6. Sort
        result.sort((a, b) => {
            // Pinned always first
            if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;

            const dir = sortConfig.direction === 'asc' ? 1 : -1;

            switch (sortConfig.field) {
                case 'createdAt':
                    return dir * (getMillis(a.createdAt) - getMillis(b.createdAt));
                case 'updatedAt':
                    return dir * (getMillis(a.updatedAt) - getMillis(b.updatedAt));
                case 'title':
                    return dir * (a.title || '').localeCompare(b.title || '');
                case 'color':
                    return dir * (a.color || '').localeCompare(b.color || '');
                case 'manual':
                default:
                    return (a.order || 0) - (b.order || 0);
            }
        });

        return result;
    }, [memos, filters, sortConfig, activeSpace, selectedCategoryId, searchQuery]);
};

// Specific selector for getting a single memo (for expansion modal)
export const useMemo$ = (id: string | null): Memo | null => {
    const memos = useMemoStore(state => state.memos);
    return useMemo(() => {
        if (!id) return null;
        return memos.find(m => m.id === id) || null;
    }, [memos, id]);
};
