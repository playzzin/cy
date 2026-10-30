import React, { useLayoutEffect, useRef } from 'react';

/** Fit the complete table without clipping values or wrapping its cells. */
export default function AdvanceSummaryFitTable({ label, children }: { label: string; children: React.ReactNode }) {
    const frameRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        const content = contentRef.current;
        if (!frame || !content) return;
        let pendingFrame = 0;
        const fit = () => {
            // Measure at natural size so a narrower filter can grow back to full size.
            content.style.setProperty('zoom', '1');
            const available = frame.clientWidth;
            const natural = content.getBoundingClientRect().width;
            if (available > 0 && natural > 0) {
                let scale = Math.min(1, available / natural);
                content.style.setProperty('zoom', String(scale));
                // Native select borders can round differently after zoom. Fit the rendered width too.
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    const rendered = content.getBoundingClientRect().width;
                    if (rendered <= available) break;
                    scale *= (available - 1) / rendered;
                    content.style.setProperty('zoom', String(scale));
                }
            }
        };
        const scheduleFit = () => {
            cancelAnimationFrame(pendingFrame);
            pendingFrame = requestAnimationFrame(fit);
        };
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleFit);
        observer?.observe(frame);
        observer?.observe(content);
        window.addEventListener('resize', scheduleFit);
        let active = true;
        void document.fonts?.ready.then(() => { if (active) scheduleFit(); });
        fit();
        return () => {
            active = false;
            observer?.disconnect();
            cancelAnimationFrame(pendingFrame);
            window.removeEventListener('resize', scheduleFit);
        };
    }, [children]);

    return <div ref={frameRef} className="as-table-scroll" role="region" aria-label={label} tabIndex={0}>
        <div ref={contentRef} className="as-table-fit">{children}</div>
    </div>;
}
