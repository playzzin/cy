import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, ZoomIn, ZoomOut } from 'lucide-react';
import type { Worker } from '../../services/manpowerService';

export type DocumentWorker = Pick<Worker, 'id' | 'name' | 'fileNameSaved' | 'bankPhotoId' | 'directPayBankPhotoId'>;
export type PreparedImage = { worker: DocumentWorker; file: File; url: string };
export type FailedPhoto = { worker: DocumentWorker; reason: string };

export function IdentityPreparation({ index, workers }: { index: number; workers: DocumentWorker[] }) {
    return <section className="id-review id-preparation" aria-label="신분증 준비 진행">
        <div className="id-review__heading"><div>
            <span className="id-review__caption">원본 불러오는 중</span>
            <h3>{workers[index]?.name}</h3>
        </div><span className="id-review__count">{index + 1} <span>/ {workers.length}명</span></span></div>
        <progress aria-label="준비를 마친 작업자 수" value={index} max={workers.length} />
        <p aria-live="polite">전체 {workers.length}명 중 {index + 1}번째 작업자를 준비하고 있습니다.</p>
    </section>;
}

function IdentityPhoto({ image }: { image: PreparedImage }) {
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [zoom, setZoom] = useState(false);
    return <div className="id-review__photo">
        <div className={`id-review__viewport${zoom ? ' is-zoomed' : ''}`} tabIndex={zoom ? 0 : undefined}
            aria-label={zoom ? '확대 사진 스크롤 영역' : undefined}>
            {state !== 'error' && <img src={image.url} alt={`${image.worker.name} 신분증 공유 미리보기`}
                onLoad={() => setState('ready')} onError={() => setState('error')} />}
        </div>
        {state !== 'ready' && <div className="id-review__overlay" aria-live="polite">
            {state === 'loading' ? '사진을 표시하는 중…' : '이 원본은 미리보기로 표시할 수 없습니다.'}
        </div>}
        {state === 'ready' && <button className="id-review__zoom" type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
            {zoom ? <ZoomOut size={15} /> : <ZoomIn size={15} />}{zoom ? '축소' : '확대'}
        </button>}
    </div>;
}

export function WorkerIdentityReview({ workers, images, failed, actions }: {
    workers: DocumentWorker[];
    images: PreparedImage[];
    failed: FailedPhoto[];
    actions: (image: PreparedImage) => React.ReactNode;
}) {
    const [index, setIndex] = useState(0);
    const worker = workers[index];
    const image = images.find(item => item.worker === worker);
    const issue = failed.find(item => item.worker === worker);
    return <section className="id-review" aria-label="신분증 확인">
        <div className="id-review__heading" aria-live="polite" aria-atomic="true">
            <div><span className="id-review__caption">현재 확인 중</span><h3>{worker.name}</h3></div>
            <span className="id-review__count" aria-label={`선택한 ${workers.length}명 중 ${index + 1}번째`}>
                {index + 1} <span>/ {workers.length}명</span>
            </span>
        </div>
        {image ? <IdentityPhoto key={image.url} image={image} /> :
            <div className="id-review__empty"><ImageOff size={24} aria-hidden="true" />
                <strong>{issue ? '사진을 불러오지 못했습니다' : '신분증 미등록'}</strong>
                <span>{issue ? issue.reason : '이 작업자에게 등록된 신분증 사진이 없습니다.'}</span></div>}
        <div className="id-review__nav">
            <button type="button" aria-label="이전 작업자" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                <ChevronLeft size={16} />이전
            </button>
            <select aria-label="확인할 작업자 선택" value={index} onChange={e => setIndex(Number(e.target.value))}>
                {workers.map((item, i) => <option key={item.id ?? i} value={i}>{i + 1}번째 · {item.name}</option>)}
            </select>
            <button type="button" aria-label="다음 작업자" disabled={index === workers.length - 1} onClick={() => setIndex(index + 1)}>
                다음<ChevronRight size={16} />
            </button>
        </div>
        {image && actions(image)}
    </section>;
}
