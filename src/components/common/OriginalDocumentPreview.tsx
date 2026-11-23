import React, { useState } from 'react';
import { ExternalLink, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import './OriginalDocumentPreview.css';

interface Props {
    url: string;
    fileName: string;
    kind: 'image' | 'pdf' | 'file';
    imageAlt: string;
    pdfTitle: string;
    downloadable?: boolean;
}

/** Mount with the source as its key so a new original always starts fitted. */
export default function OriginalDocumentPreview({ url, fileName, kind, imageAlt, pdfTitle, downloadable }: Props) {
    const [zoom, setZoom] = useState(1);
    const [imageError, setImageError] = useState(false);
    return <div className="original-document">
        {kind === 'image' && !imageError && <div className="original-document__zoom" role="group" aria-label="원본 확대 조절">
            <button type="button" aria-label="축소" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))}><ZoomOut size={18} /></button>
            <output aria-label="확대 배율">{Math.round(zoom * 100)}%</output>
            <button type="button" aria-label="확대" disabled={zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + 0.5))}><ZoomIn size={18} /></button>
            <button type="button" onClick={() => setZoom(1)}><Maximize size={16} />화면에 맞추기</button>
            <span>확대한 사진은 밀어서 볼 수 있어요</span>
        </div>}
        <div className="original-document__canvas" role="region" aria-label="원본 미리보기" tabIndex={0}>
            {kind === 'image' && !imageError && <div className="original-document__paper" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
                <img src={url} alt={imageAlt} referrerPolicy="no-referrer" onError={() => setImageError(true)} />
            </div>}
            {kind === 'image' && imageError && <p role="status" className="original-document__notice">사진 미리보기를 불러오지 못했습니다. 아래 원본 열기 버튼으로 확인해 주세요.</p>}
            {kind === 'pdf' && <iframe title={pdfTitle} src={url} referrerPolicy="no-referrer" />}
            {kind === 'file' && <p className="original-document__notice">이 파일은 아래 원본 열기 버튼으로 확인해 주세요.</p>}
        </div>
        <footer className="original-document__actions">
            <a href={url} target="_blank" rel="noopener noreferrer" className="original-document__primary"><ExternalLink size={17} />새 탭에서 원본 열기</a>
            {downloadable ? <a href={url} download={fileName}>원본 다운로드</a>
                : <a href={url} target="_self" referrerPolicy="no-referrer">현재 탭에서 열기</a>}
        </footer>
    </div>;
}
