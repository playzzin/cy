import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Render pages in the web app, including mobile browsers without an embedded PDF viewer. */
export default function OriginalPdfPreview({ url, title }: { url: string; title: string }) {
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [page, setPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [width, setWidth] = useState(320);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const host = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        let disposed = false;
        let destroy: (() => void) | undefined;
        setDocument(null); setPage(1); setZoom(1); setError('');
        void import('../../utils/pdfPreviewRuntime').then(({ openPdfDocument }) => {
            if (disposed) return;
            const task = openPdfDocument(url);
            destroy = () => { void task.destroy().catch(() => undefined); };
            return task.promise.then(pdf => { if (!disposed) setDocument(pdf); });
        }).catch(() => { if (!disposed) setError('PDF를 불러오지 못했습니다. 다시 시도해 주세요.'); });
        return () => { disposed = true; destroy?.(); };
    }, [url, revision]);
    useEffect(() => {
        const measure = () => { if (host.current?.clientWidth) setWidth(Math.max(1, host.current.clientWidth - 16)); };
        measure();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (host.current) observer?.observe(host.current);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    useEffect(() => {
        setReady(false);
        if (!document || !canvas.current) return;
        let disposed = false;
        let cancel: (() => void) | undefined;
        const target = canvas.current;
        void document.getPage(page).then(async pdfPage => {
            if (disposed) return;
            const original = pdfPage.getViewport({ scale: 1 });
            const cssWidth = Math.round(width * zoom);
            const cssHeight = Math.round(cssWidth * original.height / original.width);
            const resolution = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(cssWidth, cssHeight));
            const viewport = pdfPage.getViewport({ scale: cssWidth / original.width * resolution });
            target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
            target.style.width = `${cssWidth}px`; target.style.height = `${cssHeight}px`;
            const job = pdfPage.render({ canvas: target, viewport });
            cancel = () => job.cancel();
            await job.promise;
            if (!disposed) { setReady(true); setError(''); }
        }).catch(() => { if (!disposed) setError('이 페이지를 표시하지 못했습니다. 다시 시도해 주세요.'); });
        return () => { disposed = true; cancel?.(); };
    }, [document, page, width, zoom]);
    return <div className="original-pdf" title={title}>
        <div className="original-pdf__controls" role="group" aria-label="PDF 페이지와 확대 조절">
            <button type="button" aria-label="PDF 이전 페이지" disabled={!document || page <= 1} onClick={() => setPage(value => value - 1)}>이전</button>
            <output aria-label="PDF 페이지">{page} / {document?.numPages || '…'}쪽</output>
            <button type="button" aria-label="PDF 다음 페이지" disabled={!document || page >= document.numPages} onClick={() => setPage(value => value + 1)}>다음</button>
            <button type="button" aria-label="PDF 축소" disabled={!document || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>−</button>
            <button type="button" aria-label="PDF 화면에 맞추기" disabled={!document} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="PDF 확대" disabled={!document || zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + .5))}>+</button>
        </div>
        <div ref={host} className="original-pdf__page">
            {error ? <p role="alert" className="original-document__notice">{error} <button type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></p>
                : !ready && <p role="status" className="original-document__notice">PDF를 표시하는 중…</p>}
            <canvas key={`${url}:${page}:${width}:${zoom}:${revision}`} ref={canvas} hidden={!ready || !!error} role="img" aria-label={`${title} ${page}쪽`} />
        </div>
    </div>;
}
