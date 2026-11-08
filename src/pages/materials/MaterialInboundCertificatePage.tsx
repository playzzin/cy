import MaterialCertificateHeading from './MaterialCertificateHeading';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createInboundCertificateImageFile, createInboundPhotosPdfFile, downloadInboundFile, getInboundCertificateDetails, getInboundPhotoPageLayouts } from './materialInboundCertificateExport';
import './MaterialCertificatePage.css';
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

const numberFormatter = new Intl.NumberFormat('ko-KR');

const MaterialInboundCertificatePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [draft, setDraft] = useState<InboundCertificateDraft | null>(null);
    const [photoUrls, setPhotoUrls] = useState<Array<{ id: string; url: string; name: string }>>([]);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const draftId = searchParams.get('draftId') || '';
        setDraft(draftId ? getInboundCertificateDraft(draftId) : null);
    }, [searchParams]);

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
            <style>
                {`
                @media print {
                    body * { visibility: hidden; }
                    #inbound-certificate-print, #inbound-certificate-print * { visibility: visible; }
                    #inbound-certificate-print {
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
                    onClick={() => navigate('/materials/inbound')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    입고 등록으로
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

            <div
                id="inbound-certificate-print"
                className="material-certificate-paper"
            >
                <div className="material-certificate-frame">
                    <MaterialCertificateHeading kind="inbound" />

                    <dl className="material-certificate-details">
                        {getInboundCertificateDetails(draft).map(field => <div key={field.label} className={field.wide ? 'material-certificate-details__wide' : ''}>
                            <dt>{field.label}</dt><dd>{field.value || '-'}</dd>
                        </div>)}
                    </dl>

                    <div className="material-certificate-table">
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

                    <div className="material-certificate-confirmation">위 자재를 입고함.</div>
                    <div className="material-certificate-signatures">
                        <div>
                            <div className="border-t-2 border-slate-400 pt-3">입고 확인</div>
                        </div>
                        <div>
                            <div className="border-t-2 border-slate-400 pt-3">담당자 확인</div>
                        </div>
                    </div>
                </div>
            </div>
            <section className="no-print material-certificate-photo-preview mx-auto mt-6 max-w-5xl" aria-label="첨부사진 미리보기">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-xl font-bold">첨부사진 {photoUrls.length}장</h2><p className="mt-1 text-sm text-slate-500">입고증과 별도 파일로 저장됩니다. 최대 40장 · A4 최대 2페이지</p></div>
                    <button type="button" onClick={handleDownloadPhotos} disabled={exporting || !draft.photos.length} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50">첨부사진 PDF 다운로드</button>
                </div>
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
