import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createOutboundCertificateImageFile, createOutboundPhotosPdfFile, downloadOutboundFile, getOutboundCertificateDetails, getOutboundPhotoPageLayouts } from './materialOutboundCertificateExport';
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
    getOutboundCertificateDraft,
    OutboundCertificateDraft,
} from './materialOutboundCertificateDraftStore';

const numberFormatter = new Intl.NumberFormat('ko-KR');

const MaterialOutboundCertificatePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [draft, setDraft] = useState<OutboundCertificateDraft | null>(null);
    const [photoUrls, setPhotoUrls] = useState<Array<{ id: string; url: string; name: string }>>([]);
    const [exporting, setExporting] = useState(false);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [photoRetry, setPhotoRetry] = useState(0);

    useEffect(() => {
        const draftId = searchParams.get('draftId') || '';
        setDraft(draftId ? getOutboundCertificateDraft(draftId) : null);
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
                const photos: OutboundCertificateDraft['photos'] = [];
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
        if (!draft) throw new Error('반출증 페이지가 준비되지 않았습니다.');
        return createOutboundCertificateImageFile(draft);
    };

    const handleDownloadPhotos = async () => {
        if (!draft) return;
        setExporting(true);
        try { downloadOutboundFile(await createOutboundPhotosPdfFile(draft)); }
        catch (error) {
            console.error('Failed to download outbound photos:', error);
            alert(error instanceof Error ? error.message : '첨부사진을 저장하지 못했습니다.');
        } finally { setExporting(false); }
    };

    const handleDownload = async () => {
        setExporting(true);
        try {
            const file = await createCertificateFile();
            downloadOutboundFile(file);
        } catch (error) {
            console.error('Failed to download outbound certificate page:', error);
            alert('반출증 이미지를 저장하지 못했습니다.');
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
                    title: '자재 반출증',
                    text: `${draft?.transactionDate || ''} ${draft?.siteName || ''} 자재 반출증`,
                    files: [file],
                });
                return;
            }

            downloadOutboundFile(file);
            alert('이 브라우저에서는 파일 공유를 지원하지 않아 반출증 이미지를 저장했습니다.');
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('Failed to share outbound certificate page:', error);
                alert('반출증 공유에 실패했습니다.');
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
                        반출증 데이터를 찾을 수 없습니다
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                        출고 등록 화면에서 자재와 사진을 선택한 뒤 반출증 페이지를 다시 열어 주세요.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/materials/outbound')}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        출고 등록으로 이동
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
            <style>
                {`
                @media print {
                    body * { visibility: hidden; }
                    #outbound-certificate-print, #outbound-certificate-print * { visibility: visible; }
                    #outbound-certificate-print {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        box-shadow: none !important;
                        border: 0 !important;
                    }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 12mm; }
                }
                `}
            </style>

            <div className="no-print mx-auto mb-4 flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => draft.returnTo ? navigate(-1) : navigate('/materials/outbound')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    {draft.returnTo ? '입출고 내역으로 돌아가기' : '출고 등록으로'}
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
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        반출증 저장
                    </button>
                    <button type="button" onClick={handleDownloadPhotos} disabled={exporting || draft.photos.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                        <FontAwesomeIcon icon={faDownload} /> 사진 PDF 저장
                    </button>
                    <button
                        type="button"
                        onClick={handleShare}
                        disabled={exporting}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faShareNodes} />
                        공유
                    </button>
                </div>
            </div>

            <div
                id="outbound-certificate-print"
                className="mx-auto max-w-5xl bg-white p-5 text-slate-900 shadow-xl ring-1 ring-slate-200 sm:p-8"
            >
                <div className="border-[3px] border-slate-900 p-5 sm:p-7">
                    <div className="text-center">
                        <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">자재 반출증</h1>
                    </div>

                    <dl className="material-certificate-details">
                        {getOutboundCertificateDetails(draft).map(field => <div key={field.label} className={field.wide ? 'material-certificate-details__wide' : ''}>
                            <dt>{field.label}</dt><dd>{field.value || '-'}</dd>
                        </div>)}
                    </dl>

                    <div className="mt-7 overflow-hidden border border-slate-300">
                        <table className="w-full table-fixed text-sm">
                            <thead className="bg-slate-800 text-white">
                                <tr>
                                    <th className="w-14 px-2 py-3 text-center font-black">No</th>
                                    <th className="px-3 py-3 text-left font-black">품명</th>
                                    <th className="px-3 py-3 text-left font-black">규격</th>
                                    <th className="w-24 px-3 py-3 text-right font-black">수량</th>
                                    <th className="w-20 px-3 py-3 text-center font-black">단위</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {draft.items.map((item, index) => (
                                    <tr key={`${item.id}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td className="px-2 py-2 text-center font-bold">{index + 1}</td>
                                        <td className="px-3 py-2 font-bold">{item.itemName}</td>
                                        <td className="px-3 py-2 font-semibold text-slate-600">{item.spec || '-'}</td>
                                        <td className="px-3 py-2 text-right font-black">{numberFormatter.format(item.quantity || 0)}</td>
                                        <td className="px-3 py-2 text-center font-semibold text-slate-600">{item.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-10 text-center text-lg font-bold text-slate-700">위 자재를 반출함.</div>
                    <div className="mt-12 grid grid-cols-2 gap-16 px-10 text-center text-sm font-black text-slate-600">
                        <div>
                            <div className="border-t-2 border-slate-400 pt-3">인수자 확인</div>
                        </div>
                        <div>
                            <div className="border-t-2 border-slate-400 pt-3">담당자 확인</div>
                        </div>
                    </div>
                </div>
            </div>
            <section className="no-print material-certificate-photo-preview mx-auto mt-6 max-w-5xl" aria-label="첨부사진 미리보기">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-xl font-bold">첨부사진 {photoUrls.length}장</h2><p className="mt-1 text-sm text-slate-500">반출증과 별도 파일로 저장됩니다. 최대 40장 · A4 최대 2페이지</p></div>
                    <button type="button" onClick={handleDownloadPhotos} disabled={exporting || !draft.photos.length} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50">첨부사진 PDF 다운로드</button>
                </div>
                {loadingPhotos && <p role="status">첨부사진을 불러오는 중입니다...</p>}
                {photoError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">{photoError} <button type="button" onClick={() => setPhotoRetry(value => value + 1)} disabled={loadingPhotos} className="font-bold underline">다시 시도</button></div>}
                {photoUrls.length ? getOutboundPhotoPageLayouts(photoUrls.length).map((layout, pageIndex, pages) => <div key={pageIndex} className="material-certificate-photo-sheet">
                    <header><strong>자재 반출 첨부사진</strong><span>{draft.transactionDate} · {draft.siteName} · {draft.vehicleNumber}</span></header>
                    <div className="material-certificate-photo-sheet__grid" style={{ gridTemplateColumns: 'repeat(' + layout.columns + ', minmax(0, 1fr))', gridTemplateRows: 'repeat(' + layout.rows + ', minmax(0, 1fr))' }}>
                        {photoUrls.slice(layout.start, layout.start + layout.count).map((photo, index) => <figure key={photo.id}><img src={photo.url} alt={'반출 사진 ' + (layout.start + index + 1)} /><figcaption>사진 {layout.start + index + 1}</figcaption></figure>)}
                    </div>
                    <footer>{pageIndex + 1} / {pages.length} · 전체 {photoUrls.length}장</footer>
                </div>) : !loadingPhotos && !photoError && <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">첨부된 사진이 없습니다.</p>}
            </section>
        </div>
    );
};

export default MaterialOutboundCertificatePage;
