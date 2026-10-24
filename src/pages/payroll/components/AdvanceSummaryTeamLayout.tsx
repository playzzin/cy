import React, { useLayoutEffect, useRef } from 'react';

export type AdvanceSummaryLayout = 'compact' | 'wide';

export default function AdvanceSummaryTeamLayout({ mode, children }: { mode: AdvanceSummaryLayout; children: React.ReactNode }) {
    const gridRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const grid = gridRef.current;
        if (!grid || mode !== 'compact' || typeof ResizeObserver === 'undefined') return;
        const cards = Array.from(grid.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        const measure = () => {
            cards.forEach(card => {
                // One-pixel tracks pack different-height tables without stretching their contents.
                const span = `span ${Math.ceil(card.getBoundingClientRect().height) + 16}`;
                if (card.style.gridRowEnd !== span) card.style.gridRowEnd = span;
            });
        };
        measure();
        grid.dataset.packed = 'true';
        const observer = new ResizeObserver(measure);
        cards.forEach(card => observer.observe(card));
        return () => {
            observer.disconnect();
            delete grid.dataset.packed;
            cards.forEach(card => { card.style.gridRowEnd = ''; });
        };
    }, [children, mode]);

    return <div ref={gridRef} className={`as-team-grid as-team-grid-${mode}`} role="group" aria-label="팀별 가불목록">{children}</div>;
}
