import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Responsive as RGLResponsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useResizeDetector } from 'react-resize-detector';
import { Memo } from '../types/memo';
import { useMemoStore } from '../store/useMemoStore';
import { MemoCard } from './MemoCard';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

// Type assertion to bypass strict typing issues with RGL
const ResponsiveGridLayout = RGLResponsive as any;

const DEFAULT_W = 4;
const DEFAULT_H = 4;
const GRID_ROW_HEIGHT = 50;
const MARGIN_X = 20;
const MARGIN_Y = 20;
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

interface GridMemoViewProps {
    memos: Memo[];
    justCreatedMemoId?: string | null;
}

export const GridMemoView: React.FC<GridMemoViewProps> = ({ memos, justCreatedMemoId }) => {
    const { width, ref } = useResizeDetector();
    const updateMemoLayouts = useMemoStore(state => state.updateMemoLayouts);
    const updateMemo = useMemoStore(state => state.updateMemo);
    const deleteMemo = useMemoStore(state => state.deleteMemo);

    const [isDragging, setIsDragging] = useState(false);
    const lastLayoutsRef = useRef<Record<string, any[]>>({});

    const isAllCollapsed = useMemo(() => memos.length > 0 && memos.every(m => m.isCollapsed), [memos]);

    const handleLayoutSave = useCallback((layout: any) => {
        if (!Array.isArray(layout)) return;
        const updates = layout.map((l: any) => ({
            i: l.i,
            x: l.x,
            y: l.y,
            w: l.w,
            h: l.h
        }));
        void updateMemoLayouts(updates).catch(() => { });
    }, [updateMemoLayouts]);

    const handleMemoSizeChange = useCallback((id: string, size: { height: number }) => {
        if (isDragging) return;
        const memo = useMemoStore.getState().memos.find(m => m.id === id);
        if (!memo || memo.isCollapsed) return;

        const neededH = Math.ceil((size.height + MARGIN_Y) / (GRID_ROW_HEIGHT + MARGIN_Y));
        const finalH = Math.max(2, neededH);

        if (finalH !== memo.h) {
            void updateMemo(id, { h: finalH }).catch(() => { });
        }
    }, [memos, updateMemo, isDragging]);

    const layouts = useMemo(() => {
        if (isDragging && Object.keys(lastLayoutsRef.current).length > 0) {
            return lastLayoutsRef.current;
        }

        const breakpoints = Object.keys(COLS) as Array<keyof typeof COLS>;
        const result = breakpoints.reduce((acc, bp) => {
            const cols = COLS[bp];
            acc[bp] = memos.map(m => {
                const rawW = m.w ?? DEFAULT_W;
                const w = Math.min(Math.max(2, rawW), cols);
                const rawX = m.x ?? 0;
                const x = Math.max(0, Math.min(rawX, cols - w));

                return {
                    i: m.id,
                    x,
                    y: (typeof m.y === 'number' && Number.isFinite(m.y)) ? m.y : 0,
                    w,
                    h: m.isCollapsed ? 1 : (m.h ?? DEFAULT_H)
                };
            });
            return acc;
        }, {} as Record<string, any[]>);

        lastLayoutsRef.current = result;
        return result;
    }, [memos, isDragging]);

    if (!memos.length) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                <p>메모가 없습니다. 새 메모를 추가하세요.</p>
            </div>
        );
    }

    return (
        <div ref={ref} className="relative w-full min-h-[500px]">
            {width ? (
                <ResponsiveGridLayout
                    className="layout"
                    layouts={layouts}
                    breakpoints={BREAKPOINTS}
                    cols={COLS}
                    rowHeight={GRID_ROW_HEIGHT}
                    width={width}
                    margin={[MARGIN_X, MARGIN_Y]}
                    containerPadding={[0, 0]}
                    isDraggable={true}
                    isResizable={true}
                    draggableHandle=".grid-drag-handle"
                    resizeHandles={['e', 's', 'se']}
                    onDragStart={() => setIsDragging(true)}
                    onDragStop={(layout: any) => {
                        setIsDragging(false);
                        handleLayoutSave(layout);
                    }}
                    onResizeStart={() => setIsDragging(true)}
                    onResizeStop={(layout: any) => {
                        setIsDragging(false);
                        handleLayoutSave(layout);
                    }}
                    compactType={isAllCollapsed ? 'horizontal' : null}
                    preventCollision={false}
                >
                    {memos.map(memo => {
                        const isCollapsed = memo.isCollapsed;
                        return (
                            <div
                                key={memo.id}
                                className={cn(
                                    "relative group transition-all duration-200",
                                    isCollapsed ? "z-0" : "z-10",
                                    justCreatedMemoId === memo.id ? "ring-2 ring-blue-500 ring-offset-2" : ""
                                )}
                                data-grid={{
                                    x: memo.x, y: memo.y,
                                    w: memo.w,
                                    h: isCollapsed ? 1 : memo.h,
                                    isDraggable: !isCollapsed && !memo.isPinned,
                                    isResizable: !memo.isCollapsed && !memo.isPinned
                                }}
                            >
                                <MemoCard
                                    memo={memo}
                                    onDelete={() => deleteMemo(memo.id)}
                                    showDragHandle={true}
                                    className="h-full w-full"
                                    onContentSizeChange={(size) => handleMemoSizeChange(memo.id, size)}
                                />
                            </div>
                        );
                    })}
                </ResponsiveGridLayout>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-slate-300" />
                </div>
            )}
        </div>
    );
};
