import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowUpRightFromSquare,
    faImages,
    faSpinner,
    faTriangleExclamation,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';

export interface MaterialPhotoReference {
    photoBatchId?: string;
    photoCount?: number;
    photoUrls?: string[];
}

type MaterialPhotoBatchLoader = (photoBatchId: string) => Promise<string[]>;

export interface MaterialPhotoUrlResolver {
    resolve: (reference: MaterialPhotoReference) => Promise<string[]>;
    clear: (photoBatchId?: string) => void;
}

const normalizePhotoUrls = (values?: string[]): string[] => Array.from(new Set(
    (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
));

export const hasMaterialPhotoReference = (reference: MaterialPhotoReference): boolean =>
    Boolean(String(reference.photoBatchId || '').trim()) || normalizePhotoUrls(reference.photoUrls).length > 0;

export const getMaterialPhotoDisplayCount = (reference: MaterialPhotoReference): number | null => {
    const legacyCount = normalizePhotoUrls(reference.photoUrls).length;
    const declaredCount = Number(reference.photoCount);

    if (Number.isFinite(declaredCount) && declaredCount > 0) {
        return Math.max(Math.floor(declaredCount), legacyCount);
    }
    if (legacyCount > 0) return legacyCount;
    return String(reference.photoBatchId || '').trim() ? null : 0;
};

/**
 * Resolves batch-backed photo URLs only when requested and caches both completed
 * and in-flight requests. Legacy URLs remain available without a network call.
 */
export const createMaterialPhotoUrlResolver = (
    loadBatchUrls: MaterialPhotoBatchLoader
): MaterialPhotoUrlResolver => {
    const cache = new Map<string, string[]>();
    const pending = new Map<string, Promise<string[]>>();

    const getBatchUrls = async (photoBatchId: string): Promise<string[]> => {
        const cached = cache.get(photoBatchId);
        if (cached) return cached;

        const pendingRequest = pending.get(photoBatchId);
        if (pendingRequest) return pendingRequest;

        const request = Promise.resolve()
            .then(() => loadBatchUrls(photoBatchId))
            .then((urls) => {
                const normalized = normalizePhotoUrls(urls);
                cache.set(photoBatchId, normalized);
                return normalized;
            })
            .finally(() => {
                pending.delete(photoBatchId);
            });

        pending.set(photoBatchId, request);
        return request;
    };

    return {
        resolve: async (reference) => {
            const legacyUrls = normalizePhotoUrls(reference.photoUrls);
            const photoBatchId = String(reference.photoBatchId || '').trim();
            if (!photoBatchId) return legacyUrls;

            try {
                const batchUrls = await getBatchUrls(photoBatchId);
                return normalizePhotoUrls([...batchUrls, ...legacyUrls]);
            } catch (error) {
                // A legacy URL is still useful if a partially migrated batch can no longer be read.
                if (legacyUrls.length > 0) return legacyUrls;
                throw error;
            }
        },
        clear: (photoBatchId) => {
            if (photoBatchId) {
                cache.delete(photoBatchId);
                pending.delete(photoBatchId);
                return;
            }
            cache.clear();
            pending.clear();
        },
    };
};

interface MaterialPhotoViewerModalProps {
    isOpen: boolean;
    title: string;
    expectedCount: number | null;
    urls: string[];
    loading: boolean;
    error: string;
    onClose: () => void;
}

const MaterialPhotoViewerModal: React.FC<MaterialPhotoViewerModalProps> = ({
    isOpen,
    title,
    expectedCount,
    urls,
    loading,
    error,
    onClose,
}) => {
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const countLabel = loading
        ? (expectedCount ? `${expectedCount}장 불러오는 중` : '사진 불러오는 중')
        : `${urls.length}장`;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
            style={{ zIndex: 70 }}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="material-photo-viewer-title"
                className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                style={{ maxHeight: '92vh' }}
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <FontAwesomeIcon icon={faImages} />
                            <span className="text-xs font-black uppercase tracking-wide">입출고 첨부사진</span>
                        </div>
                        <h2 id="material-photo-viewer-title" className="mt-1 truncate text-lg font-black text-slate-900">
                            {title}
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500" aria-live="polite">
                            {countLabel}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label="사진 창 닫기"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6" style={{ minHeight: 280 }}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center text-slate-500" style={{ minHeight: 260 }} role="status">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-500" />
                            <p className="mt-4 font-bold">사진을 불러오는 중입니다...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 260 }} role="alert">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-xl text-rose-600">
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </div>
                            <p className="mt-4 font-black text-slate-900">사진을 불러오지 못했습니다.</p>
                            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{error}</p>
                        </div>
                    ) : urls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center text-slate-500" style={{ minHeight: 260 }} role="status">
                            <FontAwesomeIcon icon={faImages} className="text-4xl text-slate-300" />
                            <p className="mt-4 font-black text-slate-700">저장된 사진을 찾을 수 없습니다.</p>
                            <p className="mt-2 text-sm">사진 정보가 삭제되었거나 저장이 완료되지 않았을 수 있습니다.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {urls.map((url, index) => (
                                <article key={`${url}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block overflow-hidden bg-slate-100"
                                        style={{ aspectRatio: '4 / 3' }}
                                        aria-label={`사진 ${index + 1} 원본 보기`}
                                    >
                                        <img
                                            src={url}
                                            alt={`입출고 첨부사진 ${index + 1}`}
                                            loading="lazy"
                                            className="h-full w-full object-contain transition duration-200 hover:scale-105"
                                        />
                                    </a>
                                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                                        <span className="text-sm font-black text-slate-700">사진 {index + 1}</span>
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800"
                                        >
                                            원본 보기
                                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                                        </a>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default MaterialPhotoViewerModal;
