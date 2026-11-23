import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import './OriginalDocumentThumbnail.css';

export interface OriginalThumbnailSource {
    url: string;
    kind: 'image' | 'pdf' | 'file';
    release: () => void;
}

function PdfThumbnail({ url, label }: { url: string; label: string }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    useEffect(() => {
        let disposed = false;
        let destroy: (() => void) | undefined;
        void import('../../utils/pdfPreviewRuntime').then(({ renderPdfThumbnail }) => {
            if (disposed || !canvas.current) return;
            const job = renderPdfThumbnail(url, canvas.current);
            destroy = job.destroy;
            return job.promise.then(() => { if (!disposed) setStatus('ready'); });
        }).catch(() => { if (!disposed) setStatus('error'); });
        return () => { disposed = true; destroy?.(); };
    }, [url]);
    return <>
        <canvas ref={canvas} role="img" aria-label={`${label} PDF 첫 페이지`} hidden={status !== 'ready'} />
        {status !== 'ready' && <span className="original-thumbnail__placeholder"><FileText size={26} />{status === 'error' ? 'PDF 원본으로 확인' : 'PDF 미리보기 준비 중…'}</span>}
        <span className="original-thumbnail__badge">PDF · 1쪽</span>
    </>;
}

/** Only resolve originals near the viewport; release private blob URLs on scope changes. */
export function OriginalDocumentThumbnail({ load, label }: { load: () => Promise<OriginalThumbnailSource>; label: string }) {
    const host = useRef<HTMLSpanElement>(null);
    const [visible, setVisible] = useState(false);
    const [source, setSource] = useState<OriginalThumbnailSource | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        if (!host.current) return;
        if (!window.IntersectionObserver) { setVisible(true); return; }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: '120px' });
        observer.observe(host.current);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (!visible) return;
        let disposed = false;
        let release: (() => void) | undefined;
        setSource(null); setError(false);
        load().then(next => {
            if (disposed) { next.release(); return; }
            release = next.release; setSource(next);
        }).catch(() => { if (!disposed) setError(true); });
        return () => { disposed = true; release?.(); };
    }, [visible, load]);
    return <span ref={host} className="original-thumbnail">
        {source && !error ? source.kind === 'image' ? <img src={source.url} alt={`${label} 미리보기`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setError(true)} />
            : source.kind === 'pdf' ? <PdfThumbnail key={source.url} url={source.url} label={label} />
                : <span className="original-thumbnail__placeholder"><FileText size={26} />원본 파일 열기</span>
            : <span className="original-thumbnail__placeholder"><FileText size={26} />{error ? '미리보기 불가 · 원본 확인' : '원본 미리보기 준비 중…'}</span>}
        <span className="original-thumbnail__expand">눌러서 크게 보기</span>
    </span>;
}

export function CardStatementThumbnail({ path, label }: { path: string; label: string }) {
    const load = useCallback(async (): Promise<OriginalThumbnailSource> => {
        const { cardStatementAttachmentService, getCardStatementFileName } = await import('../../services/cardStatementAttachmentService');
        const link = await cardStatementAttachmentService.resolve(path);
        const name = getCardStatementFileName(path);
        return { ...link, kind: /\.pdf$/i.test(name) ? 'pdf' : /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(name) ? 'image' : 'file' };
    }, [path]);
    return <OriginalDocumentThumbnail key={path} load={load} label={label} />;
}

export function VehicleFineThumbnail({ expenseId, attachmentExpenseId, label }: { expenseId: string; attachmentExpenseId?: string; label: string }) {
    const load = useCallback(async (): Promise<OriginalThumbnailSource> => {
        const { vehicleFineImportService } = await import('../../services/vehicleFineImportService');
        const file = await vehicleFineImportService.getAttachment(expenseId, attachmentExpenseId);
        const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
        return { url, release: () => URL.revokeObjectURL(url), kind: file.mimeType === 'application/pdf' ? 'pdf' : file.mimeType.startsWith('image/') ? 'image' : 'file' };
    }, [expenseId, attachmentExpenseId]);
    return <OriginalDocumentThumbnail key={`${expenseId}:${attachmentExpenseId || ''}`} load={load} label={label} />;
}
