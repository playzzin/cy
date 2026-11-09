import MaterialCertificateDocument from './MaterialCertificateDocument';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createInboundCertificateImageFile, createInboundPhotosPdfFile, downloadInboundFile, getInboundCertificateDetails, getInboundPhotoPageLayouts } from './materialInboundCertificateExport';
import './MaterialCertificatePage.css';
import { createMaterialPhotoUrlResolver, hasMaterialPhotoReference } from './MaterialPhotoViewerModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faDownload,
    faPrint,
    faShareNodes,
    faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
    getInboundCertificateDraft,
    InboundCertificateDraft,
} from './materialInboundCertificateDraftStore';


const MaterialInboundCertificatePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [draft, setDraft] = useState<InboundCertificateDraft | null>(null);
    const [photoUrls, setPhotoUrls] = useState<Array<{ id: string; url: string; name: string }>>([]);
    const [exporting, setExporting] = useState(false);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [photoRetry, setPhotoRetry] = useState(0);

    useEffect(() => {
        const draftId = searchParams.get('draftId') || '';
        setDraft(draftId ? getInboundCertificateDraft(draftId) : null);
    }, [searchParams]);

    useEffect(() => {
        const references = draft?.photoReferences?.filter(hasMaterialPhotoReference);
        if (!draft || !references?.length) return;
        const controller = new AbortController();
        setLoadingPhotos(true);
        setPhotoError('');
        void (async () => {
            try {
                const { default: service } = await import('../../services/materialService');
                const resolver = createMaterialPhotoUrlResolver(id => service.getMaterialPhotoDownloadUrls(id));
                const urls = [...new Set((await Promise.all(references.map(reference => resolver.resolve(reference)))).flat())];
                if (!urls.length) throw new Error('등록된 첨부사진을 찾을 수 없습니다.');
                if (urls.length > 40) throw new Error('이 날짜·현장·임대사·차량의 사진이 40장을 초과합니다. 입출고 내역의 사진 보기에서 확인해 주세요.');
                const photos: InboundCertificateDraft['photos'] = [];
                for (let index = 0; index < urls.length; index += 4) {
                    const batch = await Promise.all(urls.slice(index, index + 4).map(async (url, offset) => {
                        const response = await fetch(url, { signal: controller.signal });
                        if (!response.ok) throw new Error('첨부사진을 불러오지 못했습니다.');
                        const blob = await response.blob();
                        return { id: `saved-${index + offset}`, source: 'gallery' as const,
                            file: new File([blob], `사진_${index + offset + 1}`, { type: blob.type || 'image/jpeg' }) };
                    }));
                    photos.push(...batch);
                }
                if (!controller.signal.aborted) setDraft(current => current?.id === draft.id ? { ...current, photos, photoReferences: undefined } : current);
            } catch (error) {
                if (!controller.signal.aborted) setPhotoError(error instanceof Error ? error.message : '첨부사진을 불러오지 못했습니다.');
            } finally {
                if (!controller.signal.aborted) setLoadingPhotos(false);
            }
        })();
        return () => controller.abort();
    }, [draft?.id, draft?.photoReferences, photoRetry]);

    useEffect(() => {
        if (!draft) {
            setPhotoUrls([]);
            return undefined;
        }

        const nextUrls = draft.photos.map((photo, index) => ({
            id: photo.id,
            url: URL.createObjectURL(photo.file),
            name: photo.file.name || `사진 ${index + 1}`,
        }));
        setPhotoUrls(nextUrls);

        return () => {
            nextUrls.forEach((photo) => URL.revokeObjectURL(photo.url));
        };
    }, [draft]);

    const createCertificateFile = async (): Promise<File> => {
        if (!draft) throw new Error('입고증 페이지가 준비되지 않았습니다.');
        return createInboundCertificateImageFile(draft);
    };

    const handleDownloadPhotos = async () => {
        if (!draft) return;
        setExporting(true);
        try { downloadInboundFile(await createInboundPhotosPdfFile(draft)); }
        catch (error) {
            console.error('Failed to download inbound photos:', error);
            alert(error instanceof Error ? error.message : '첨부사진을 저장하지 못했습니다.');
        } finally { setExporting(false); }
    };

    const handleDownload = async () => {
        setExporting(true);
        try {
            const file = await createCertificateFile();
            downloadInboundFile(file);
        } catch (error) {
            console.error('Failed to download inbound certificate page:', error);
            alert('입고증 이미지를 저장하지 못했습니다.');
        } finally {
            setExporting(false);
        }
    };

    const handleShare = async () => {
        setExporting(true);
        try {
            const file = await createCertificateFile();
            const shareTarget = navigator as any;
            if (shareTarget.canShare?.({ files: [file] })) {
                await shareTarget.share({
                    title: '자재 입고증',
                    text: `${draft?.transactionDate || ''} ${draft?.siteName || ''} 자재 입고증`,
                    files: [file],
                });
                return;
            }

            downloadInboundFile(file);
            alert('이 브라우저에서는 파일 공유를 지원하지 않아 입고증 이미지를 저장했습니다.');
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('Failed to share inbound certificate page:', error);
                alert('입고증 공유에 실패했습니다.');
            }
        } finally {
            setExporting(false);
        }
    };

    if (!draft) {
        return (
            <div className="mx-auto max-w-3xl p-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <div className="flex items-center gap-2 text-lg font-extrabold">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        입고증 데이터를 찾을 수 없습니다
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                        입고 등록 화면에서 자재와 사진을 선택한 뒤 입고증 페이지를 다시 열어 주세요.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/materials/inbound')}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        입고 등록으로 이동
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
            <style>{`@media print { @page { size: A4; margin: 0; } }`}</style>

            <div className="no-print mx-auto mb-4 flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => draft.returnTo ? navigate(-1) : navigate('/materials/inbound')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    {draft.returnTo ? '입출고 내역으로 돌아가기' : '입고 등록으로'}
                </button>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faPrint} />
                        인쇄
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={exporting}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        입고증 저장
                    </button>
                    <button type="button" onClick={handleDownloadPhotos} disabled={exporting || draft.photos.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                        <FontAwesomeIcon icon={faDownload} /> 사진 PDF 저장
                    </button>
                    <button
                        type="button"
                        onClick={handleShare}
                        disabled={exporting}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faShareNodes} />
                        공유
                    </button>
                </div>
            </div>

            <MaterialCertificateDocument kind="inbound" items={draft.items} details={getInboundCertificateDetails(draft)} />
            <section className="no-print material-certificate-photo-preview mx-auto mt-6 max-w-5xl" aria-label="첨부사진 미리보기">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-xl font-bold">첨부사진 {photoUrls.length}장</h2><p className="mt-1 text-sm text-slate-500">입고증과 별도 파일로 저장됩니다. 최대 40장 · A4 최대 2페이지</p></div>
                    <button type="button" onClick={handleDownloadPhotos} disabled={exporting || !draft.photos.length} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50">첨부사진 PDF 다운로드</button>
                </div>
                {loadingPhotos && <p role="status">첨부사진을 불러오는 중입니다...</p>}
                {photoError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">{photoError} <button type="button" onClick={() => setPhotoRetry(value => value + 1)} disabled={loadingPhotos} className="font-bold underline">다시 시도</button></div>}
                {photoUrls.length ? getInboundPhotoPageLayouts(photoUrls.length).map((layout, pageIndex, pages) => <div key={pageIndex} className="material-certificate-photo-sheet">
                    <header><strong>자재 입고 첨부사진</strong><span>{draft.transactionDate} · {draft.siteName} · {draft.vehicleNumber}</span></header>
                    <div className="material-certificate-photo-sheet__grid" style={{ gridTemplateColumns: 'repeat(' + layout.columns + ', minmax(0, 1fr))', gridTemplateRows: 'repeat(' + layout.rows + ', minmax(0, 1fr))' }}>
                        {photoUrls.slice(layout.start, layout.start + layout.count).map((photo, index) => <figure key={photo.id}><img src={photo.url} alt={'입고 사진 ' + (layout.start + index + 1)} /><figcaption>사진 {layout.start + index + 1}</figcaption></figure>)}
                    </div>
                    <footer>{pageIndex + 1} / {pages.length} · 전체 {photoUrls.length}장</footer>
                </div>) : <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">첨부된 사진이 없습니다.</p>}
            </section>
        </div>
    );
};

export default MaterialInboundCertificatePage;
