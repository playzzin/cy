interface DailyReportImageContext {
    period: string;
    filters: string[];
    rangeLabel: string;
}

export const captureDailyReportListImage = async (
    source: HTMLDivElement,
    context: DailyReportImageContext,
): Promise<Blob> => {
    // Snapshot synchronously: filtering or changing pages during rendering must not
    // mix the clicked result with a later result. Only already-visible rows are cloned.
    const root = document.createElement('div');
    root.className = 'daily-report-v2-image';
    root.setAttribute('aria-hidden', 'true');
    const table = source.querySelector<HTMLTableElement>('table');
    const width = Math.ceil(Math.max(source.getBoundingClientRect().width, table?.scrollWidth ?? 0, 320));
    Object.assign(root.style, { position: 'fixed', left: '-100000px', top: '0', width: `${width}px`, pointerEvents: 'none' });
    const heading = document.createElement('header');
    heading.className = 'daily-report-v2-image-heading';
    const title = document.createElement('h2');
    title.textContent = '일보목록';
    heading.appendChild(title);
    for (const text of [context.period, context.filters.join(' · '), `${context.rangeLabel} · 요약은 전체 조회 결과 기준`]) {
        if (!text) continue;
        const line = document.createElement('p');
        line.textContent = text;
        heading.appendChild(line);
    }
    const snapshot = source.cloneNode(true) as HTMLDivElement;
    snapshot.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    snapshot.querySelectorAll('button, [role="dialog"], [data-html2canvas-ignore], .daily-report-v2-mobile-view-switch').forEach(element => element.remove());
    root.append(heading, snapshot);
    document.body.appendChild(root);

    // Tailwind's global block image rule otherwise shifts html2canvas's font probe.
    const fontMetricsStyle = document.createElement('style');
    fontMetricsStyle.textContent = 'body > div[style*="visibility: hidden"] > img[width="1"][height="1"] { display: inline-block !important; }';
    document.head.appendChild(fontMetricsStyle);
    try {
        await document.fonts?.ready;
        const { default: html2canvas } = await import('html2canvas');
        const height = Math.ceil(root.scrollHeight);
        const maxPixels = window.innerWidth < 768 ? 4_000_000 : 16_000_000;
        const scale = Math.min(2, Math.sqrt(maxPixels / (width * height)), 16000 / height, 16000 / width);
        if (!height || scale < 1) throw new Error('조회 범위를 줄여 화면을 복사해 주세요.');
        const canvas = await html2canvas(root, {
            backgroundColor: '#ffffff', scale, logging: false, useCORS: true,
            width, height, scrollX: 0, scrollY: 0,
            // Keep the current breakpoint so mobile cards retain their screen layout.
            windowWidth: window.innerWidth,
            onclone: (_document, clonedRoot) => {
                Object.assign(clonedRoot.style, { position: 'absolute', left: '0', top: '0' });
            },
        });
        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('목록 이미지 생성 실패')), 'image/png');
        });
    } finally {
        root.remove();
        fontMetricsStyle.remove();
    }
};
