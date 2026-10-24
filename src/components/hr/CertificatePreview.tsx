import React, { useLayoutEffect, useRef, useState } from 'react';
import { Download, Copy, Share2, ZoomIn, Minimize2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import { captureCertificateImage, certificateImageFilename } from '../../utils/certificateImage';
import './CertificatePreview.css';

export const CertificateMobileTabs = ({ preview, onChange }: { preview: boolean; onChange: (preview: boolean) => void }) => (
    <div className="certificate-mobile-tabs" aria-label="증명서 화면 선택">
        <button type="button" aria-pressed={!preview} onClick={() => onChange(false)}>발급 설정</button>
        <button type="button" aria-pressed={preview} onClick={() => onChange(true)}>미리보기 · 공유</button>
    </div>
);

interface Props {
    children: React.ReactNode;
    targetRef: React.RefObject<HTMLDivElement>;
    documentKey: string;
    title: string;
    disabled: boolean;
}

const canShareFile = (file: File) => {
    try { return !!navigator.share && !!navigator.canShare?.({ files: [file] }); }
    catch { return false; }
};

export default function CertificatePreview({ children, targetRef, documentKey, title, disabled }: Props) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const paperRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 794, height: 1123, available: 0 });
    const [actualSize, setActualSize] = useState(false);
    const [prepared, setPrepared] = useState<{ file: File; url: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const generation = useRef(0);
    const busyRef = useRef(false);

    useLayoutEffect(() => {
        const measure = () => {
            const paper = paperRef.current;
            const viewport = viewportRef.current;
            if (!paper || !viewport || !viewport.clientWidth) return;
            const next = { width: paper.offsetWidth, height: paper.offsetHeight, available: Math.max(1, viewport.clientWidth - 24) };
            setSize(old => old.width === next.width && old.height === next.height && old.available === next.available ? old : next);
        };
        measure();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (paperRef.current) observer?.observe(paperRef.current);
        if (viewportRef.current) observer?.observe(viewportRef.current);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, []);

    useLayoutEffect(() => {
        const invalidate = () => {
            generation.current += 1;
            busyRef.current = false;
            setPrepared(null);
            setBusy(false);
            setError('');
            setMessage('');
        };
        invalidate();
        // Also invalidate when a stamp finishes loading or changes asynchronously.
        const observer = new MutationObserver(invalidate);
        if (targetRef.current) observer.observe(targetRef.current, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['src'] });
        return () => { observer.disconnect(); generation.current += 1; };
    }, [documentKey, disabled, targetRef]);

    useLayoutEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);

    const prepare = async () => {
        if (disabled || busyRef.current || !targetRef.current) return;
        const request = ++generation.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('공유할 증명서 이미지를 만드는 중입니다.');
        try {
            const blob = await captureCertificateImage(targetRef.current);
            if (request !== generation.current) return;
            const file = new File([blob], certificateImageFilename(title), { type: 'image/png' });
            setPrepared({ file, url: URL.createObjectURL(file) });
            setMessage('이미지가 준비되었습니다. 카카오톡 공유 또는 이미지 저장을 선택하세요.');
        } catch {
            if (request === generation.current) {
                setMessage('');
                setError('증명서 또는 도장 이미지를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
            }
        } finally {
            if (request === generation.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const send = async (action: 'share' | 'copy') => {
        if (!prepared || disabled || busyRef.current) return;
        const request = generation.current;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            if (action === 'share') {
                // Prepared in a separate click so mobile user activation is preserved.
                await navigator.share({ files: [prepared.file], title });
            } else {
                if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': prepared.file })]);
            }
            if (request === generation.current) setMessage(action === 'share'
                ? '공유창 처리를 마쳤습니다. 전송 여부는 카카오톡에서 확인해 주세요.'
                : '이미지를 복사했습니다. 카카오톡 채팅방에 붙여넣어 보내세요.');
        } catch (failure) {
            if (request === generation.current) {
                if ((failure as DOMException)?.name === 'AbortError') setMessage('공유를 취소했습니다. 다시 공유할 수 있습니다.');
                else setError('공유 또는 복사를 사용할 수 없습니다. 이미지를 저장한 뒤 카카오톡에 첨부해 주세요.');
            }
        } finally {
            if (request === generation.current) { busyRef.current = false; setBusy(false); }
        }
    };

    const scale = actualSize ? 1 : Math.min(1, (size.available || size.width) / size.width);
    return <section className="certificate-preview" aria-label="증명서 미리보기">
        <div className="certificate-preview__toolbar">
            <div><strong>증명서 미리보기</strong><span>A4 · {Math.round(scale * 100)}%</span></div>
            <button type="button" onClick={() => setActualSize(value => !value)} aria-pressed={actualSize}>
                {actualSize ? <Minimize2 size={17} /> : <ZoomIn size={17} />}{actualSize ? '화면에 맞추기' : '원본 크기'}
            </button>
        </div>
        <div className="certificate-preview__actions">
            {!prepared ? <button type="button" className="certificate-preview__share" disabled={disabled || busy} onClick={() => void prepare()}>
                <Share2 size={18} />{busy ? '이미지 준비 중…' : '카카오톡 공유 · 이미지 준비'}
            </button> : <>
                {canShareFile(prepared.file) && <button type="button" className="certificate-preview__share" disabled={busy || disabled} onClick={() => void send('share')}><Share2 size={18} />카카오톡 공유</button>}
                <button type="button" disabled={busy || disabled} onClick={() => void send('copy')}><Copy size={17} />이미지 복사</button>
                <button type="button" disabled={busy || disabled} onClick={() => { saveAs(prepared.file, prepared.file.name); setMessage('이미지 저장을 요청했습니다. 저장된 파일을 카카오톡에 첨부하세요.'); }}><Download size={17} />이미지 저장</button>
            </>}
        </div>
        <p className="certificate-preview__hint">{disabled ? '발급 회사와 근로자를 선택하면 공유할 수 있습니다.' : prepared && !canShareFile(prepared.file)
            ? '이 브라우저는 파일 공유를 지원하지 않습니다. 이미지를 저장하거나 복사해 카카오톡에 첨부하세요.'
            : '이미지를 준비한 뒤 공유창에서 카카오톡과 받을 사람을 선택하세요.'}</p>
        <p className="certificate-preview__status" role="status" aria-live="polite">{message}</p>
        {error && <p className="certificate-preview__error" role="alert">{error}</p>}
        {prepared && <details className="certificate-preview__prepared"><summary>공유할 이미지 확인</summary><img src={prepared.url} alt="공유할 증명서 이미지" /></details>}
        <div className="certificate-preview__viewport" ref={viewportRef} tabIndex={0} aria-label="증명서 확대 및 스크롤 영역">
            <div className="certificate-preview__stage" style={{ width: size.width * scale, height: size.height * scale }}>
                <div className="certificate-preview__paper" ref={paperRef} style={{ transform: `scale(${scale})` }}>{children}</div>
            </div>
        </div>
    </section>;
}
