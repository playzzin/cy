import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useMemoStore } from '../store/useMemoStore';
import { MemoCard } from '../components/MemoCard';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import {
    LayoutDashboard,
    Plus,
    Search,
    Settings,
    ArrowDownWideNarrow,
    Palette,
    GripHorizontal,
    MoreHorizontal,
    Globe,
    Inbox
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CategoryManagerDialog } from '../components/CategoryManagerDialog';

const DEFAULT_W = 4;
const DEFAULT_H = 4;
const GRID_ROW_HEIGHT = 50; // Adjusted for better density
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const MARGIN_X = 20;
const MARGIN_Y = 20;

const isFiniteNumber = (val: unknown): val is number => typeof val === 'number' && Number.isFinite(val);

export const MemoPage = () => {
    const { width, ref } = useResizeDetector();
    const { currentUser } = useAuth();

    const memos = useMemoStore(state => state.memos);
    const subscribeMemos = useMemoStore(state => state.subscribeMemos);
    const addMemo = useMemoStore(state => state.addMemo);
    const deleteMemo = useMemoStore(state => state.deleteMemo);
    const updateMemo = useMemoStore(state => state.updateMemo);
    const updateMemoLayouts = useMemoStore(state => state.updateMemoLayouts);
    const repackMemos = useMemoStore(state => state.repackMemos);
    const loadingState = useMemoStore(state => state.isLoading);
    const errorState = useMemoStore(state => state.error);
    const addCategory = useMemoStore(state => state.addCategory);
    const categories = useMemoStore(state => state.categories);

    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [isLocalLoading, setIsLocalLoading] = useState(true);
    const [currentCols, setCurrentCols] = useState<number>(COLS.lg);
    const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

    // 1. Stable Subscription
    useEffect(() => {
        if (!currentUser?.uid) {
            setIsLocalLoading(false);
            return;
        }

        setIsLocalLoading(true);
        const unsubscribe = subscribeMemos(currentUser.uid);

        // Safety timeout
        const timer = setTimeout(() => setIsLocalLoading(false), 2000);

        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.uid]);

    // 2. Sync Global Loading
    useEffect(() => {
        if (!loadingState) setIsLocalLoading(false);
    }, [loadingState]);

    const handleCreate = async () => {
        if (!currentUser?.uid) return;
        try {
            await addMemo({
                title: 'New Memo',
                content: '',
                categoryId: selectedCategoryId === 'all' ? null : selectedCategoryId,
                w: DEFAULT_W,
                h: DEFAULT_H,
                x: 0,
                y: 0,
                color: 'white',
                isCollapsed: false,
                isPinned: false,
                type: 'text',
                order: 0
            }, currentUser.uid);
        } catch (error) {
            console.error("Failed to create memo:", error);
        }
    };

    // 3. Stable Persistence
    const handleLayoutSave = useCallback((layout: any) => {
        if (!Array.isArray(layout)) return;

        const updates = layout.map((l) => ({
            i: l.i,
            x: l.x,
            y: l.y,
            w: l.w,
            h: l.h
        }));

        updateMemoLayouts(updates);
    }, [updateMemoLayouts]);

    const [isSortOpen, setIsSortOpen] = useState(false);

    const layoutVersion = useMemoStore(state => state.layoutVersion);
    const searchQuery = useMemoStore(state => state.searchQuery);
    const setSearchQuery = useMemoStore(state => state.setSearchQuery);

    const categoryScopedMemos = useMemo(() => {
        return memos.filter(memo => {
            if (selectedCategoryId === 'all') return true;
            if (selectedCategoryId === 'uncategorized') return !memo.categoryId;
            return memo.categoryId === selectedCategoryId;
        });
    }, [memos, selectedCategoryId]);

    const sortScopeIds = useMemo(() => categoryScopedMemos.map(m => m.id), [categoryScopedMemos]);

    const filteredMemos = useMemo(() => {
        return categoryScopedMemos.filter(memo => {
            if (!searchQuery) return true;
            return (
                memo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                memo.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                memo.checklistItems?.some(item => item.text.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        });
    }, [categoryScopedMemos, searchQuery]);

    // 4. Robust Layout Generation
    const [isDragging, setIsDragging] = useState(false);
    const lastLayoutsRef = useRef<any>({});

    const handleMemoSizeChange = useCallback((id: string, size: { height: number }) => {
        // Prevent updates during drag to avoid fighting
        if (isDragging) return;

        const memo = memos.find(m => m.id === id);
        if (!memo || memo.isCollapsed) return;

        const neededH = Math.ceil((size.height + MARGIN_Y) / (GRID_ROW_HEIGHT + MARGIN_Y));
        const finalH = Math.max(2, neededH); // Min 2 rows

        if (finalH !== memo.h) {
            updateMemo(id, { h: finalH });
        }
    }, [memos, updateMemo, isDragging]);

    const layouts = useMemo(() => {
        // Stability: Return stale layout during dragging
        if (isDragging && Object.keys(lastLayoutsRef.current).length > 0) {
            return lastLayoutsRef.current;
        }

        const breakpoints = Object.keys(COLS) as Array<keyof typeof COLS>;
        const result = breakpoints.reduce<Record<string, Array<{ i: string; x: number; y: number; w: number; h: number }>>>((acc, bp) => {
            const cols = COLS[bp];
            acc[bp] = filteredMemos.map(m => {
                const rawW = m.w ?? DEFAULT_W;
                const w = Math.min(Math.max(1, rawW), cols);
                const rawX = m.x ?? 0;
                // Clamp X to fit in columns
                const x = Math.max(0, Math.min(rawX, Math.max(0, cols - w)));

                return {
                    i: m.id,
                    x,
                    y: isFiniteNumber(m.y) ? m.y : 0, // Trust store, default to 0
                    w,
                    h: m.isCollapsed ? 1 : (m.h ?? DEFAULT_H)
                };
            });
            return acc;
        }, {});

        lastLayoutsRef.current = result;
        return result;
    }, [filteredMemos, isDragging]);

    // Close sort menu on click outside
    useEffect(() => {
        const closeSort = () => setIsSortOpen(false);
        if (isSortOpen) document.addEventListener('click', closeSort);
        return () => document.removeEventListener('click', closeSort);
    }, [isSortOpen]);

    if (errorState) return <div className="p-8 text-red-500">Error: {errorState}</div>;

    return (
        <div className="flex flex-col h-full bg-[#f8f9fc] relative overflow-hidden min-h-screen">
            {/* Trendy Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 z-20 bg-white/50 backdrop-blur-md border-b border-black/5 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                        Smart Memo
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="bg-white/80 border border-slate-200 rounded-full pl-9 pr-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all w-32 focus:w-48 shadow-sm"
                        />
                    </div>

                    {/* Auto Sort Dropdown */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm"
                            title="Auto Arrange"
                        >
                            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                            <span>Sort</span>
                        </button>

                        {isSortOpen && (
                            <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                    onClick={() => { repackMemos('date-desc', { gridCols: currentCols, scopeIds: sortScopeIds }); setIsSortOpen(false); }}>
                                    최신순 (Newest)
                                </button>
                                <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                    onClick={() => { repackMemos('date-asc', { gridCols: currentCols, scopeIds: sortScopeIds }); setIsSortOpen(false); }}>
                                    오래된순 (Oldest)
                                </button>
                                <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                    onClick={() => { repackMemos('title', { gridCols: currentCols, scopeIds: sortScopeIds }); setIsSortOpen(false); }}>
                                    가나다순 (Title)
                                </button>
                            </div>
                        )}
                    </div>

                    {/* New Memo Button */}
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all text-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Memo</span>
                    </button>

                    {/* Manage Categories Button */}
                    <button
                        onClick={() => setIsCategoryManagerOpen(true)}
                        className="p-2 rounded-full hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Manage Categories"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="sticky top-[72px] z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center gap-4 overflow-x-auto no-scrollbar shadow-sm shrink-0">
                <button
                    onClick={() => setSelectedCategoryId('all')}
                    className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                        selectedCategoryId === 'all'
                            ? "bg-slate-900 text-white shadow-md bg-gradient-to-r from-slate-800 to-slate-900"
                            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    )}
                >
                    <Inbox className="w-3.5 h-3.5" />
                    All
                </button>
                <button
                    onClick={() => setSelectedCategoryId('public')}
                    className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                        selectedCategoryId === 'public'
                            ? "bg-blue-600 text-white shadow-md bg-gradient-to-r from-blue-500 to-blue-700"
                            : "bg-white text-blue-600 hover:bg-blue-50 border border-blue-200"
                    )}
                >
                    <Globe className="w-3.5 h-3.5" />
                    Public
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                            selectedCategoryId === cat.id
                                ? "bg-slate-900 text-white shadow-md bg-gradient-to-r from-slate-800 to-slate-900"
                                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        )}
                    >
                        {cat.name}
                    </button>
                ))}

                {/* Manager Trigger */}
                <button
                    onClick={() => setIsCategoryManagerOpen(true)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
                    title="Edit Categories"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>

            {/* Grid Area */}
            <div ref={ref} className="flex-1 overflow-auto relative p-4 custom-scrollbar">
                {isLocalLoading || loadingState ? (
                    <div className="flex items-center justify-center w-full h-full">
                        <div className="w-8 h-8 ease-linear rounded-full border-4 border-t-4 border-t-amber-500 border-gray-200 animate-spin"></div>
                    </div>
                ) : (
                    <ResponsiveGridLayout
                        key={`rgl-${layoutVersion}`}
                        className="layout w-full min-h-[500px]"
                        layouts={layouts}
                        breakpoints={BREAKPOINTS}
                        cols={COLS}
                        rowHeight={GRID_ROW_HEIGHT}
                        width={width ?? 1200}
                        margin={[20, 20]}
                        onBreakpointChange={(breakpoint, cols) => {
                            setCurrentBreakpoint(breakpoint);
                            setCurrentCols(cols);
                        }}

                        // Layout Behavior: Free movement, No gravity, Push items
                        {...({ compactType: null } as any)}
                        preventCollision={false}
                        allowOverlap={false}

                        isDraggable={true}
                        isResizable={true}
                        draggableHandle=".grid-drag-handle"
                        draggableCancel=".no-drag"
                        resizeHandles={['e']} // Only allow Width resize to support Auto-Height

                        // Event Handlers
                        onDragStart={() => setIsDragging(true)}
                        onDragStop={(layout) => {
                            setIsDragging(false);
                            handleLayoutSave(layout);
                        }}
                        onResizeStart={() => setIsDragging(true)}
                        onResizeStop={(layout) => {
                            setIsDragging(false);
                            handleLayoutSave(layout);
                        }}
                        onLayoutChange={() => { }}
                    >
                        {filteredMemos.map((memo) => {
                            const safeY = isFiniteNumber(memo.y) ? memo.y : 0;
                            const isCollapsed = memo.isCollapsed;

                            // Allow resize/drag ONLY if NOT collapsed
                            // User strict rule: "Collapsed memos cannot be dragged or resized"

                            return (
                                <div
                                    key={memo.id}
                                    data-grid={{
                                        x: memo.x ?? 0,
                                        y: safeY,
                                        w: memo.w ?? DEFAULT_W,
                                        h: memo.isCollapsed ? 1 : (memo.h ?? DEFAULT_H),
                                        isDraggable: !isCollapsed && !memo.isPinned,
                                        isResizable: !memo.isPinned,
                                        minW: 2,
                                        minH: isCollapsed ? 1 : 2,
                                        maxH: isCollapsed ? 1 : undefined
                                    }}
                                    className={cn(
                                        "relative group transition-all duration-200",
                                        isCollapsed ? "z-0" : "z-10"
                                    )}
                                >
                                    <MemoCard
                                        memo={memo}
                                        onDelete={() => deleteMemo(memo.id)}
                                        className="h-full w-full"
                                        onContentSizeChange={(size) => handleMemoSizeChange(memo.id, size)}
                                    />
                                </div>
                            );
                        })}
                    </ResponsiveGridLayout>
                )}
            </div>

            {/* Global Loading Overlay if needed */}
            {
                isLocalLoading && (
                    <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-sm">
                        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
                    </div>
                )
            }
            {/* Category Manager Modal */}
            <CategoryManagerDialog
                open={isCategoryManagerOpen}
                onOpenChange={setIsCategoryManagerOpen}
            />
        </div >
    );
};
