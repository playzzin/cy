import React, { useLayoutEffect, useRef } from 'react';
import './MaterialInventoryTable.css';

interface MaterialInventoryTableProps {
    variant: 'all' | 'site';
    label: string;
    children: React.ReactNode;
}

const MaterialInventoryTable: React.FC<MaterialInventoryTableProps> = ({ variant, label, children }) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const header = tableRef.current?.tHead;
        if (!viewport || !header) return;
        const measure = () => {
            // Use layout pixels so browser zoom and larger text keep the group row aligned.
            const headerHeight = `${header.offsetHeight}px`;
            if (viewport.style.getPropertyValue('--inventory-header-height') !== headerHeight) {
                viewport.style.setProperty('--inventory-header-height', headerHeight);
            }
            if (variant === 'all') {
                const height = `${Math.max(200, window.innerHeight - viewport.getBoundingClientRect().top - 80)}px`;
                if (viewport.style.getPropertyValue('--inventory-scroll-height') !== height) {
                    viewport.style.setProperty('--inventory-scroll-height', height);
                }
            }
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(header);
        const page = viewport.closest('[data-inventory-page]');
        if (page) observer?.observe(page);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, [variant]);

    return <div className={`material-inventory-grid material-inventory-grid--${variant}`}>
        <div ref={viewportRef} className="material-inventory-grid__scroll" role="region" aria-label={label} tabIndex={0}>
            <table ref={tableRef} className="material-inventory-table text-sm" aria-label={label}>
                <colgroup>
                    <col style={{ width: 'var(--inventory-col-1)' }} />
                    <col style={{ width: 'var(--inventory-col-2)' }} />
                    {variant === 'all' && <>
                        <col style={{ width: 'var(--inventory-col-3)' }} />
                        <col style={{ width: 'var(--inventory-col-4)' }} />
                    </>}
                    <col span={variant === 'all' ? 5 : 4} />
                </colgroup>
                {children}
            </table>
        </div>
    </div>;
};

export default MaterialInventoryTable;
