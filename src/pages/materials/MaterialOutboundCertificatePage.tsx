import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
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

const sanitizeFileName = (value: unknown): string =>
    String(value ?? '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 90) || '반출증';

const canvasToJpegFile = (canvas: HTMLCanvasElement, fileName: string): Promise<File> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('반출증 이미지를 만들지 못했습니다.'));
                return;
            }
            resolve(new File([blob], fileName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    });

const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const MaterialOutboundCertificatePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const certificateRef = useRef<HTMLDivElement | null>(null);
    const [draft, setDraft] = useState<OutboundCertificateDraft | null>(null);
    const [photoUrls, setPhotoUrls] = useState<Array<{ id: string; url: string; name: string }>>([]);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const draftId = searchParams.get('draftId') || '';
        setDraft(draftId ? getOutboundCertificateDraft(draftId) : null);
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

    const totalQuantity = useMemo(
        () => draft?.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0,
        [draft]
    );

    const createCertificateFile = async (): Promise<File> => {
        if (!certificateRef.current || !draft) {
            throw new Error('반출증 페이지가 준비되지 않았습니다.');
        }

        const canvas = await html2canvas(certificateRef.current, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
        } as unknown as Parameters<typeof html2canvas>[1]);
        const fileName = `${sanitizeFileName(`반출증_${draft.transactionDate}_${draft.siteName}_${draft.vehicleNumber}`)}.jpg`;
        return canvasToJpegFile(canvas, fileName);
    };

    const handleDownload = async () => {
        setExporting(true);
        try {
            const file = await createCertificateFile();
            downloadFile(file);
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

            downloadFile(file);
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
                    onClick={() => navigate('/materials/outbound')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    출고 등록으로
                </button>
                <div className="grid grid-cols-3 gap-2 sm:flex">
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
                        이미지 저장
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
                ref={certificateRef}
                className="mx-auto max-w-5xl bg-white p-5 text-slate-900 shadow-xl ring-1 ring-slate-200 sm:p-8"
            >
                <div className="border-[3px] border-slate-900 p-5 sm:p-7">
                    <div className="text-center">
                        <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">자재 반출증</h1>
                        <div className="mt-2 text-sm font-semibold text-slate-500">
                            발행일 {new Date().toLocaleDateString('ko-KR')}
                        </div>
                    </div>

                    <div className="mt-7 grid grid-cols-1 overflow-hidden border border-slate-300 text-sm sm:grid-cols-4">
                        {[
                            ['출고일자', draft.transactionDate || '-'],
                            ['현장명', draft.siteName || '-'],
                            ['임대사', draft.rentalCompanyName || '-'],
                            ['차량번호', draft.vehicleNumber || '-'],
                            ['반출자', draft.recipient || '-'],
                            ['등록자', draft.registeredByName || '-'],
                            ['총 품목', `${draft.items.length}개`],
                            ['총 수량', numberFormatter.format(totalQuantity)],
                        ].map(([label, value]) => (
                            <React.Fragment key={label}>
                                <div className="border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-center font-black text-slate-700">
                                    {label}
                                </div>
                                <div className="border-b border-r border-slate-300 px-3 py-2 font-bold text-slate-950">
                                    {value}
                                </div>
                            </React.Fragment>
                        ))}
                    </div>

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

                    <div className="mt-8">
                        <div className="flex items-end justify-between border-b-2 border-slate-900 pb-2">
                            <div>
                                <h2 className="text-2xl font-black text-slate-950">첨부사진</h2>
                                <p className="mt-1 text-sm font-semibold text-slate-500">자재 상차 및 반출 확인 사진</p>
                            </div>
                            <div className="text-sm font-black text-slate-700">{photoUrls.length}장</div>
                        </div>

                        {photoUrls.length > 0 ? (
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {photoUrls.map((photo, index) => (
                                    <figure key={photo.id} className="break-inside-avoid overflow-hidden border border-slate-300 bg-white">
                                        <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">
                                            <img
                                                src={photo.url}
                                                alt={`반출 사진 ${index + 1}`}
                                                className="h-full w-full object-contain"
                                            />
                                        </div>
                                        <figcaption className="border-t border-slate-200 px-3 py-2 text-center text-sm font-black text-slate-700">
                                            사진 {index + 1}
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-4 border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                                첨부된 사진이 없습니다.
                            </div>
                        )}
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
        </div>
    );
};

export default MaterialOutboundCertificatePage;
