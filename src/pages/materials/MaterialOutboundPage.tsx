/* Force Re-build: 2025-12-26 11:45 - Fixed Split Layout */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowUp,
    faSave,
    faRotateRight,
    faFloppyDisk,
    faTrash,
    faEdit,
    faSearch,
    faFileInvoice,
    faShareNodes,
    faDownload,
    faBuilding,
    faCamera,
    faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { geminiService } from '../../services/geminiService';
import { siteService, Site } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { settlementTargetService } from '../../services/settlementTargetService';
import { Material, OutboundTransaction } from '../../types/materials';
import { useAuth } from '../../contexts/AuthContext';
import { filterCheongyeonMaterialSites } from './materialSiteFilters';
import { handleMaterialQuantityInputKeyDown } from './materialKeyboardNavigation';
import { getMaterialGroupKey, sortMaterialDisplayRows } from '../../utils/materialOrdering';
import {
    applyAnalyzedMaterialItemsToQuantities,
    buildMaterialAnalyzeContext,
    describeAnalyzedItem,
    findMatchingNamedOption,
    findMatchingSite,
    normalizeAnalyzedDate,
} from './materialPhotoAnalysisUtils';
import MaterialPhotoPicker, {
    deleteUploadedMaterialPhotos,
    MaterialPhotoAttachment,
    MaterialPhotoUpload,
    revokeMaterialPhotoAttachments,
    uploadMaterialPhotoAttachments,
} from './MaterialPhotoPicker';
import MaterialSelectionActionBar, { SelectedMaterial } from './MaterialSelectionActionBar';
import {
    createOutboundCertificateDraftId,
    saveOutboundCertificateDraft,
} from './materialOutboundCertificateDraftStore';
import {
    buildMaterialRentalCompanyOptions,
    getMaterialRentalCompanyOptionId,
    MaterialRentalCompanyOption,
} from './materialRentalCompanyOptions';

// 임시저장 데이터 타입
type OutboundTempData = {
    transactionDate: string;
    siteId: string;
    siteName: string;
    vehicleNumber: string;
    recipient: string;
    rentalCompanyId?: string;
    rentalCompanyName?: string;
    notes?: string;
    quantities: Record<string, number>;
    savedAt: number;
};

type MobileMaterialGroup = 'scaffolding' | 'dongbari' | 'other';

const ITEMS_PER_COLUMN = 10;
const QUICK_QUANTITY_STEPS = [-1, -10, -100, 1, 10, 100];

const createMaterialPhotoBatchId = (transactionType: 'inbound' | 'outbound') =>
    `matphoto_${transactionType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const getMaterialChunkGridClass = (chunkCount: number) => {
    if (chunkCount >= 7) return 'grid-cols-7 min-w-[1330px]';
    if (chunkCount === 6) return 'grid-cols-6 min-w-[1140px]';
    if (chunkCount === 5) return 'grid-cols-5 min-w-[950px]';
    if (chunkCount === 4) return 'grid-cols-4 min-w-[760px]';
    if (chunkCount === 3) return 'grid-cols-3 min-w-[570px]';
    if (chunkCount === 2) return 'grid-cols-2 min-w-[380px]';
    return 'grid-cols-1 min-w-[190px]';
};

const getQuantityAccentClasses = (colorClass: string) => {
    if (colorClass === 'slate') {
        return {
            cardActive: 'border-slate-300 bg-slate-50',
            inputActive: 'border-slate-500 text-slate-700 bg-white',
            positiveButton: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 active:bg-slate-200',
            negativeButton: 'border-rose-100 bg-white text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:bg-rose-100',
        };
    }

    return {
        cardActive: 'border-red-200 bg-red-50',
        inputActive: 'border-red-500 text-red-700 bg-white',
        positiveButton: 'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 active:bg-red-100',
        negativeButton: 'border-rose-100 bg-white text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:bg-rose-100',
    };
};

type OutboundCertificateInput = {
    transactionDate: string;
    siteName: string;
    vehicleNumber: string;
    recipient: string;
    rentalCompanyName: string;
    registeredByName: string;
    items: SelectedMaterial[];
    photos: MaterialPhotoAttachment[];
};

const sanitizeCertificateFileName = (value: unknown): string =>
    String(value ?? '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 90) || '반출증';

const formatCertificateQuantity = (value: unknown): string => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric.toLocaleString('ko-KR') : '0';
};

const fitCanvasText = (ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number): string => {
    const text = String(value ?? '').trim() || '-';
    if (ctx.measureText(text).width <= maxWidth) return text;

    let next = text;
    while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
        next = next.slice(0, -1);
    }

    return `${next}...`;
};

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

const downloadGeneratedFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const loadCertificatePhoto = (file: File): Promise<{ image: HTMLImageElement; url: string }> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => resolve({ image, url });
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('첨부사진을 반출증에 불러오지 못했습니다.'));
        };
        image.src = url;
    });

const drawContainedImage = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) => {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (sourceWidth <= 0 || sourceHeight <= 0) return;

    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = x + ((width - drawWidth) / 2);
    const drawY = y + ((height - drawHeight) / 2);
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const createOutboundCertificateImageFile = async ({
    transactionDate,
    siteName,
    vehicleNumber,
    recipient,
    rentalCompanyName,
    registeredByName,
    items,
    photos,
}: OutboundCertificateInput): Promise<File> => {
    const width = 1080;
    const padding = 56;
    const metaTop = 165;
    const metaRowHeight = 46;
    const tableTop = metaTop + (metaRowHeight * 4) + 42;
    const tableHeaderHeight = 50;
    const rowHeight = 44;
    const footerHeight = 150;
    const photoColumns = 3;
    const photoGap = 18;
    const photoCellHeight = 238;
    const photoRows = photos.length > 0 ? Math.ceil(photos.length / photoColumns) : 0;
    const photoSectionHeight = photos.length > 0 ? 72 + (photoRows * photoCellHeight) + (Math.max(0, photoRows - 1) * photoGap) + 34 : 0;
    const height = tableTop + tableHeaderHeight + (items.length * rowHeight) + photoSectionHeight + footerHeight + 42;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('반출증 이미지를 만들 수 없습니다.');

    const tableWidth = width - (padding * 2);
    const certificatePhotos = await Promise.all(photos.map((photo) => loadCertificatePhoto(photo.file)));
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const fileName = `${sanitizeCertificateFileName(`반출증_${transactionDate}_${siteName || '현장'}_${vehicleNumber || ''}`)}.jpg`;

    try {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 3;
        ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 54px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('자재 반출증', width / 2, 92);
    ctx.font = '500 24px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`발행일 ${new Date().toLocaleDateString('ko-KR')}`, width / 2, 130);

    const metaRows = [
        ['출고일자', transactionDate || '-', '현장명', siteName || '-'],
        ['임대사', rentalCompanyName || '-', '차량번호', vehicleNumber || '-'],
        ['반출자', recipient || '-', '등록자', registeredByName || '-'],
        ['총 품목', `${items.length}개`, '총 수량', formatCertificateQuantity(totalQuantity)],
    ];
    const metaWidths = [150, 390, 150, tableWidth - 150 - 390 - 150];
    let y = metaTop;
    metaRows.forEach((row) => {
        let x = padding;
        row.forEach((cell, index) => {
            const widthForCell = metaWidths[index];
            ctx.fillStyle = index % 2 === 0 ? '#f1f5f9' : '#ffffff';
            ctx.fillRect(x, y, widthForCell, metaRowHeight);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, widthForCell, metaRowHeight);
            ctx.fillStyle = index % 2 === 0 ? '#334155' : '#111827';
            ctx.font = `${index % 2 === 0 ? '700' : '600'} 22px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
            ctx.textAlign = index % 2 === 0 ? 'center' : 'left';
            const textX = index % 2 === 0 ? x + (widthForCell / 2) : x + 16;
            ctx.fillText(fitCanvasText(ctx, cell, widthForCell - 24), textX, y + 31);
            x += widthForCell;
        });
        y += metaRowHeight;
    });

    const headers = ['No', '품명', '규격', '수량', '단위'];
    const colWidths = [70, 330, 300, 150, tableWidth - 70 - 330 - 300 - 150];
    let x = padding;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(padding, tableTop, tableWidth, tableHeaderHeight);
    headers.forEach((header, index) => {
        const widthForCell = colWidths[index];
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(x, tableTop, widthForCell, tableHeaderHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 22px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(header, x + (widthForCell / 2), tableTop + 33);
        x += widthForCell;
    });

        items.forEach((item, rowIndex) => {
            const rowY = tableTop + tableHeaderHeight + (rowIndex * rowHeight);
            let rowX = padding;
            const rowValues = [
                String(rowIndex + 1),
                item.itemName,
                item.spec,
                formatCertificateQuantity(item.quantity),
                item.unit,
            ];
            rowValues.forEach((value, colIndex) => {
                const widthForCell = colWidths[colIndex];
                ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
                ctx.fillRect(rowX, rowY, widthForCell, rowHeight);
                ctx.strokeStyle = '#e2e8f0';
                ctx.strokeRect(rowX, rowY, widthForCell, rowHeight);
                ctx.fillStyle = '#0f172a';
                ctx.font = `${colIndex === 1 || colIndex === 3 ? '700' : '500'} 21px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
                ctx.textAlign = colIndex === 1 || colIndex === 2 ? 'left' : 'center';
                const textX = colIndex === 1 || colIndex === 2 ? rowX + 14 : rowX + (widthForCell / 2);
                ctx.fillText(fitCanvasText(ctx, value, widthForCell - 24), textX, rowY + 30);
                rowX += widthForCell;
            });
        });

        let footerTop = tableTop + tableHeaderHeight + (items.length * rowHeight) + 42;
        if (certificatePhotos.length > 0) {
            const photoSectionTop = footerTop;
            const photoCellWidth = (tableWidth - (photoGap * (photoColumns - 1))) / photoColumns;
            const photoImageHeight = 190;

            ctx.fillStyle = '#0f172a';
            ctx.font = '700 28px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`첨부사진 ${certificatePhotos.length}장`, padding, photoSectionTop + 30);

            ctx.fillStyle = '#64748b';
            ctx.font = '500 18px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
            ctx.fillText('자재 상차 및 반출 확인 사진', padding + 180, photoSectionTop + 30);

            certificatePhotos.forEach(({ image }, index) => {
                const row = Math.floor(index / photoColumns);
                const col = index % photoColumns;
                const cellX = padding + (col * (photoCellWidth + photoGap));
                const cellY = photoSectionTop + 56 + (row * (photoCellHeight + photoGap));

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(cellX, cellY, photoCellWidth, photoCellHeight);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.strokeRect(cellX, cellY, photoCellWidth, photoCellHeight);

                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(cellX + 10, cellY + 10, photoCellWidth - 20, photoImageHeight);
                drawContainedImage(ctx, image, cellX + 10, cellY + 10, photoCellWidth - 20, photoImageHeight);

                ctx.fillStyle = '#334155';
                ctx.font = '700 18px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`사진 ${index + 1}`, cellX + (photoCellWidth / 2), cellY + photoImageHeight + 38);
            });

            footerTop += photoSectionHeight;
        }

        ctx.fillStyle = '#334155';
        ctx.font = '600 24px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('위 자재를 반출함.', width / 2, footerTop);

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding + 80, footerTop + 70);
        ctx.lineTo(padding + 380, footerTop + 70);
        ctx.moveTo(width - padding - 380, footerTop + 70);
        ctx.lineTo(width - padding - 80, footerTop + 70);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '700 20px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        ctx.fillText('인수자 확인', padding + 230, footerTop + 102);
        ctx.fillText('담당자 확인', width - padding - 230, footerTop + 102);

        return await canvasToJpegFile(canvas, fileName);
    } finally {
        certificatePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    }
};

const MaterialOutboundPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
    const [siteId, setSiteId] = useState('');
    const [siteName, setSiteName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [recipient, setRecipient] = useState('');
    const [rentalCompanyId, setRentalCompanyId] = useState('');
    const [rentalCompanyName, setRentalCompanyName] = useState('');
    const [notes, setNotes] = useState('');
    const [searchFilter, setSearchFilter] = useState('');

    const [sites, setSites] = useState<Site[]>([]);
    const [rentalCompanies, setRentalCompanies] = useState<MaterialRentalCompanyOption[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [hasTempData, setHasTempData] = useState(false);
    const [mobileMaterialGroup, setMobileMaterialGroup] = useState<MobileMaterialGroup>('scaffolding');
    const [mobileSelectedItemName, setMobileSelectedItemName] = useState('');
    const [photoAttachments, setPhotoAttachments] = useState<MaterialPhotoAttachment[]>([]);
    const [photoUploadProgress, setPhotoUploadProgress] = useState<number | null>(null);
    const [sharingCertificate, setSharingCertificate] = useState(false);
    const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
    const photoAnalysisInputRef = React.useRef<HTMLInputElement | null>(null);

    // 임시저장 데이터 로드
    const loadTempData = () => {
        try {
            const tempDataStr = localStorage.getItem('outbound_temp');
            if (!tempDataStr) return;

            const tempData: OutboundTempData = JSON.parse(tempDataStr);

            // 24시간 이상 된 데이터는 정리
            const now = Date.now();
            if (now - tempData.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('outbound_temp');
                return;
            }

            // 데이터 복원
            setTransactionDate(tempData.transactionDate);
            setSiteId(tempData.siteId);
            setSiteName(tempData.siteName);
            setVehicleNumber(tempData.vehicleNumber);
            setRecipient(tempData.recipient);
            setRentalCompanyId(tempData.rentalCompanyId || '');
            setRentalCompanyName(tempData.rentalCompanyName || '');
            setNotes(tempData.notes || '');
            setQuantities(tempData.quantities || {});
            setHasTempData(true);

            // Ref도 즉시 동기화 (Strict Mode 대응)
            stateRef.current = {
                transactionDate: tempData.transactionDate,
                siteId: tempData.siteId,
                siteName: tempData.siteName,
                vehicleNumber: tempData.vehicleNumber,
                recipient: tempData.recipient,
                rentalCompanyId: tempData.rentalCompanyId || '',
                rentalCompanyName: tempData.rentalCompanyName || '',
                notes: tempData.notes || '',
                quantities: tempData.quantities || {}
            };

            console.log('[Outbound] 임시저장 데이터를 복원했습니다:', tempData);
        } catch (error) {
            console.error('[Outbound] 임시저장 데이터 로드 실패:', error);
            localStorage.removeItem('outbound_temp');
        }
    };

    // 임시저장 데이터 저장
    const saveTempData = () => {
        try {
            const tempData: OutboundTempData = {
                transactionDate,
                siteId,
                siteName,
                vehicleNumber,
                recipient,
                rentalCompanyId,
                rentalCompanyName,
                notes,
                quantities,
                savedAt: Date.now()
            };
            localStorage.setItem('outbound_temp', JSON.stringify(tempData));
            setHasTempData(true);
        } catch (error) {
            console.error('[Outbound] 임시저장 데이터 저장 실패:', error);
        }
    };

    // 임시저장 데이터 삭제
    const clearTempData = () => {
        localStorage.removeItem('outbound_temp');
        setHasTempData(false);
    };

    // 최신 상태를 추적하기 위한 Ref
    const stateRef = React.useRef({
        transactionDate,
        siteId,
        siteName,
        vehicleNumber,
        recipient,
        rentalCompanyId,
        rentalCompanyName,
        notes,
        quantities
    });

    // 렌더링마다 Ref 업데이트
    useEffect(() => {
        stateRef.current = {
            transactionDate,
            siteId,
            siteName,
            vehicleNumber,
            recipient,
            rentalCompanyId,
            rentalCompanyName,
            notes,
            quantities
        };
    }, [transactionDate, siteId, siteName, vehicleNumber, recipient, rentalCompanyId, rentalCompanyName, notes, quantities]);

    // 실제 저장 로직 (Ref 기준)
    const performSave = () => {
        try {
            const current = stateRef.current;
            const tempData: OutboundTempData = {
                transactionDate: current.transactionDate,
                siteId: current.siteId,
                siteName: current.siteName,
                vehicleNumber: current.vehicleNumber,
                recipient: current.recipient,
                rentalCompanyId: current.rentalCompanyId,
                rentalCompanyName: current.rentalCompanyName,
                notes: current.notes,
                quantities: current.quantities,
                savedAt: Date.now()
            };
            localStorage.setItem('outbound_temp', JSON.stringify(tempData));
            setHasTempData(true);
            console.log('[Outbound] Auto-saved data:', tempData);
        } catch (error) {
            console.error('[Outbound] Temp save failed:', error);
        }
    };

    useEffect(() => {
        loadData();
        loadTempData();

        // 브라우저 종료/새로고침 시 저장
        const handleBeforeUnload = () => {
            performSave();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // 컴포넌트 언마운트(페이지 이동) 시 저장
            performSave();
        };
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sitesData, materialsData, companiesData, settlementTargetsData] = await Promise.all([
                siteService.getSites(),
                materialService.getUniqueMaterialsForSelection(),
                companyService.getCompanies(),
                settlementTargetService.getTargets().catch(() => []),
            ]);
            setSites(filterCheongyeonMaterialSites(sitesData));
            setMaterials(materialsData);
            setRentalCompanies(buildMaterialRentalCompanyOptions(companiesData, settlementTargetsData));

            // [FIX] 기존 임시저장 수량이 로딩 시점에 사라지지 않도록 유지합니다.
            setQuantities((prev) => {
                const validIds = new Set(materialsData.map((m) => m.id));
                const filteredEntries = Object.entries(prev).filter(([id]) => validIds.has(id));
                return Object.fromEntries(filteredEntries);
            });
        } catch (error) {
            console.error('Failed to load data:', error);
            alert('데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSiteChange = (selectedSiteId: string) => {
        setSiteId(selectedSiteId);
        const site = sites.find(s => s.id === selectedSiteId);
        setSiteName(site?.name || '');
    };

    const handleRentalCompanyChange = (selectedCompanyId: string) => {
        setRentalCompanyId(selectedCompanyId);
        const company = rentalCompanies.find((row) => getMaterialRentalCompanyOptionId(row) === selectedCompanyId);
        setRentalCompanyName(company?.name || '');
    };

    useEffect(() => {
        if (!rentalCompanyId) return;

        const company = rentalCompanies.find((row) => getMaterialRentalCompanyOptionId(row) === rentalCompanyId);
        if (company?.name && company.name !== rentalCompanyName) {
            setRentalCompanyName(company.name);
        }
    }, [rentalCompanyId, rentalCompanyName, rentalCompanies]);

    const handleQuantityChange = (materialId: string, value: string) => {
        const numValue = Math.max(0, parseInt(value, 10) || 0);
        setQuantities(prev => ({
            ...prev,
            [materialId]: numValue
        }));
    };

    const handleQuantityStep = (materialId: string, step: number) => {
        setQuantities(prev => ({
            ...prev,
            [materialId]: Math.max(0, (prev[materialId] || 0) + step)
        }));
    };

    const handlePhotoAnalysisClick = () => {
        photoAnalysisInputRef.current?.click();
    };

    const handlePhotoAnalysisFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []).filter((file) =>
            file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
        );
        event.target.value = '';
        if (files.length === 0) {
            alert('분석할 이미지 파일을 선택해주세요.');
            return;
        }
        if (!geminiService.getKey()) {
            alert('Gemini API 키가 설정되지 않았습니다. /settings/ai 또는 .env.local의 REACT_APP_GOOGLE_API_KEY를 확인해주세요.');
            return;
        }

        setAnalyzingPhoto(true);
        try {
            const analysis = await geminiService.analyzeMaterialTransactionImages(
                files,
                buildMaterialAnalyzeContext({
                    transactionType: 'outbound',
                    sites,
                    materials,
                    rentalCompanies: rentalCompanies.map((company) => company.name).filter(Boolean),
                })
            );

            const analyzedDate = normalizeAnalyzedDate(analysis.transactionDate);
            if (analyzedDate) setTransactionDate(analyzedDate);

            const matchedSite = findMatchingSite(sites, analysis.siteName);
            if (matchedSite?.id) {
                setSiteId(matchedSite.id);
                setSiteName(matchedSite.name || '');
            }

            const matchedRentalCompany = findMatchingNamedOption(
                rentalCompanies,
                (company) => company.name,
                analysis.rentalCompanyName || analysis.supplier
            );
            if (matchedRentalCompany) {
                setRentalCompanyId(getMaterialRentalCompanyOptionId(matchedRentalCompany));
                setRentalCompanyName(matchedRentalCompany.name);
            } else if (analysis.rentalCompanyName?.trim()) {
                const analyzedRentalCompanyName = analysis.rentalCompanyName.trim();
                setRentalCompanyId(`analysis:${analyzedRentalCompanyName}`);
                setRentalCompanyName(analyzedRentalCompanyName);
            }

            if (analysis.vehicleNumber?.trim()) setVehicleNumber(analysis.vehicleNumber.trim());
            if (analysis.recipient?.trim()) setRecipient(analysis.recipient.trim());
            if (analysis.notes?.trim()) {
                setNotes((prev) => prev.trim() ? prev : analysis.notes!.trim());
            }

            const applied = applyAnalyzedMaterialItemsToQuantities({
                analysis,
                materials,
                currentQuantities: quantities,
            });
            setQuantities(applied.nextQuantities);
            if (applied.matchedCount > 0) setSearchFilter('');

            const unmatchedPreview = applied.unmatchedItems
                .slice(0, 5)
                .map(describeAnalyzedItem)
                .join(', ');
            const messages = [
                `사진분석 완료: ${applied.matchedCount}개 품목 적용`,
                applied.unmatchedItems.length > 0 ? `미매칭 ${applied.unmatchedItems.length}개${unmatchedPreview ? ` (${unmatchedPreview})` : ''}` : '',
                analysis.siteName && !matchedSite ? `현장명 "${analysis.siteName}"은 현장 목록에서 찾지 못했습니다.` : '',
                (analysis.rentalCompanyName || analysis.supplier) && !matchedRentalCompany ? `임대사 "${analysis.rentalCompanyName || analysis.supplier}"은 임대사 목록에서 찾지 못했습니다.` : '',
                '저장 전 수량과 현장을 확인해주세요.',
            ].filter(Boolean);
            alert(messages.join('\n'));
        } catch (error: any) {
            console.error('Failed to analyze outbound material photo:', error);
            alert(error?.message || '사진분석에 실패했습니다.');
        } finally {
            setAnalyzingPhoto(false);
        }
    };

    const handleSave = async () => {
        if (!siteId) {
            alert('현장을 선택하세요.');
            return;
        }
        if (!sites.some((site) => site.id === siteId)) {
            alert('(주)청연이엔지 소속 현장만 선택할 수 있습니다.');
            return;
        }

        const transactions: Array<Omit<OutboundTransaction, 'id' | 'createdAt' | 'updatedAt'>> = [];
        const resolvedSiteName = siteName || sites.find(s => s.id === siteId)?.name || '';

        Object.entries(quantities).forEach(([materialId, quantity]) => {
            if (quantity > 0) {
                const material = materials.find(m => m.id === materialId);
                if (material) {
                    transactions.push({
                        transactionDate,
                        siteId,
                        siteName: String(resolvedSiteName || '').trim(),
                        vehicleNumber: vehicleNumber || '',
                        rentalCompanyId: rentalCompanyId || '',
                        rentalCompanyName: rentalCompanyName || '',
                        materialId: material.id,
                        materialKey: material.materialKey,
                        category: String(material.category || '').trim(),
                        itemName: String(material.itemName || '').trim(),
                        spec: String(material.spec || '').trim(),
                        quantity,
                        unit: String(material.unit || '').trim(),
                        recipient: recipient || '',
                        deliveryStatus: 'pending',
                        notes: notes.trim(),
                        registeredBy: currentUser?.uid || '',
                        registeredByName: currentUser?.displayName || currentUser?.email || '관리자'
                    });
                }
            }
        });

        if (transactions.length === 0) {
            alert('출고할 자재를 입력하세요.');
            return;
        }

        setLoading(true);
        let uploadedPhotos: MaterialPhotoUpload[] = [];
        try {
            setPhotoUploadProgress(photoAttachments.length > 0 ? 0 : null);
            uploadedPhotos = await uploadMaterialPhotoAttachments({
                photos: photoAttachments,
                transactionType: 'outbound',
                transactionDate,
                siteId,
                onProgress: setPhotoUploadProgress,
            });
            const photoBatchId = uploadedPhotos.length > 0 ? createMaterialPhotoBatchId('outbound') : undefined;
            const photoBatch = photoBatchId
                ? {
                    id: photoBatchId,
                    transactionType: 'outbound' as const,
                    transactionDate,
                    siteId,
                    photoCount: uploadedPhotos.length,
                    photos: uploadedPhotos,
                    createdBy: currentUser?.uid || '',
                    createdByName: currentUser?.displayName || currentUser?.email || 'admin',
                }
                : undefined;
            const payload = transactions.map((transaction) => ({
                ...transaction,
                ...(photoBatch ? { photoBatchId: photoBatch.id, photoCount: photoBatch.photoCount } : {}),
            }));

            await materialService.addOutboundTransactionsBatch(payload, photoBatch);
            alert(`${transactions.length}건의 출고가 등록되었습니다.`);
            // 저장 성공 후 임시저장 데이터 삭제
            clearTempData();
            handleReset();
        } catch (error) {
            console.error('Failed to save outbound transactions:', error);
            if (uploadedPhotos.length > 0) {
                await deleteUploadedMaterialPhotos(uploadedPhotos);
            }
            alert('출고 등록에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setQuantities({});
        setVehicleNumber('');
        setRecipient('');
        setRentalCompanyId('');
        setRentalCompanyName('');
        setNotes('');
        revokeMaterialPhotoAttachments(photoAttachments);
        setPhotoAttachments([]);
        setPhotoUploadProgress(null);
        // 리셋 시 임시저장 데이터도 삭제
        clearTempData();
    };

    // 자동 저장 (Debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            performSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [transactionDate, siteId, siteName, vehicleNumber, recipient, rentalCompanyId, rentalCompanyName, notes, quantities]);

    // --- Data Processing for Layout ---
    // 1. Consolidate into Dongbari vs Scaffolding vs Others
    const dongbariList: Material[] = [];
    const scaffoldingList: Material[] = [];
    const otherList: Material[] = [];

    materials.forEach(m => {
        const cat = (m.category || '').trim();
        const itemName = (m.itemName || '').trim();
        const spec = (m.spec || '').trim();

        // 검색 필터 적용 (수량이 입력된 품목은 검색 필터와 상관없이 항상 표시)
        const hasQty = (quantities[m.id] || 0) > 0;
        const matchesSearch = !searchFilter ||
            itemName.toLowerCase().includes(searchFilter.toLowerCase()) ||
            spec.toLowerCase().includes(searchFilter.toLowerCase()) ||
            cat.toLowerCase().includes(searchFilter.toLowerCase());

        if (!hasQty && !matchesSearch) return;

        const groupKey = getMaterialGroupKey(m);

        // 1. Right Column: Scaffolding (비계)
        if (groupKey === 'scaffolding') {
            scaffoldingList.push(m);
        }
        // 2. Left Column: Dongbari (동바리) OR Support (서포트) OR System (시스템 - excluding Scaffolding)
        else if (groupKey === 'dongbari') {
            dongbariList.push(m);
        }
        // 3. Others
        else {
            otherList.push(m);
        }
    });

    const selectedItemCount = Object.values(quantities).filter(quantity => quantity > 0).length;
    const selectedQuantityTotal = Object.values(quantities).reduce(
        (sum, quantity) => sum + (quantity > 0 ? quantity : 0),
        0
    );
    const selectedMaterials: SelectedMaterial[] = sortMaterialDisplayRows(
        materials
            .map((material) => ({
                ...material,
                quantity: quantities[material.id] || 0,
            }))
            .filter((material) => material.quantity > 0)
    );
    const showDetachedRentalOption = useMemo(() => {
        if (!rentalCompanyId || !rentalCompanyName) return false;
        return !rentalCompanies.some((company) => getMaterialRentalCompanyOptionId(company) === rentalCompanyId);
    }, [rentalCompanies, rentalCompanyId, rentalCompanyName]);
    const selectionActionDetails = [
        { label: '출고일자', value: transactionDate },
        { label: '현장', value: siteName },
        { label: '임대사', value: rentalCompanyName },
        { label: '차량번호', value: vehicleNumber },
        { label: '반출자', value: recipient },
    ];

    const createCurrentOutboundCertificateFile = async (): Promise<File | null> => {
        if (!siteId) {
            alert('현장을 선택하세요.');
            return null;
        }
        if (selectedMaterials.length === 0) {
            alert('반출증에 넣을 자재 수량을 입력하세요.');
            return null;
        }

        return createOutboundCertificateImageFile({
            transactionDate,
            siteName: siteName || sites.find((site) => site.id === siteId)?.name || '',
            vehicleNumber,
            recipient,
            rentalCompanyName,
            registeredByName: currentUser?.displayName || currentUser?.email || '관리자',
            items: selectedMaterials,
            photos: photoAttachments,
        });
    };

    const handleOpenOutboundCertificatePage = () => {
        if (!siteId) {
            alert('현장을 선택하세요.');
            return;
        }
        if (selectedMaterials.length === 0) {
            alert('반출증에 넣을 자재 수량을 입력하세요.');
            return;
        }

        const draftId = createOutboundCertificateDraftId();
        saveOutboundCertificateDraft({
            id: draftId,
            transactionDate,
            siteId,
            siteName: siteName || sites.find((site) => site.id === siteId)?.name || '',
            vehicleNumber,
            recipient,
            rentalCompanyId,
            rentalCompanyName,
            registeredByName: currentUser?.displayName || currentUser?.email || '관리자',
            items: selectedMaterials,
            photos: photoAttachments.map((photo) => ({
                id: photo.id,
                file: photo.file,
                source: photo.source,
            })),
            createdAt: Date.now(),
        });

        navigate(`/materials/outbound-certificate?draftId=${encodeURIComponent(draftId)}`);
    };

    const handleDownloadOutboundCertificate = async () => {
        setSharingCertificate(true);
        try {
            const file = await createCurrentOutboundCertificateFile();
            if (!file) return;
            downloadGeneratedFile(file);
        } catch (error) {
            console.error('Failed to download outbound certificate:', error);
            alert('반출증 이미지를 만들지 못했습니다.');
        } finally {
            setSharingCertificate(false);
        }
    };

    const handleShareOutboundCertificate = async () => {
        setSharingCertificate(true);
        try {
            const certificateFile = await createCurrentOutboundCertificateFile();
            if (!certificateFile) return;

            const shareFiles = [certificateFile];
            const shareTitle = '자재 반출증';
            const shareText = `${transactionDate} ${siteName || '현장'} 자재 반출증`;
            const shareTarget = navigator as any;

            if (shareTarget.canShare?.({ files: shareFiles })) {
                await shareTarget.share({ title: shareTitle, text: shareText, files: shareFiles });
                return;
            }

            if (shareTarget.canShare?.({ files: [certificateFile] })) {
                await shareTarget.share({ title: shareTitle, text: shareText, files: [certificateFile] });
                return;
            }

            downloadGeneratedFile(certificateFile);
            alert('이 브라우저에서는 파일 공유를 지원하지 않아 반출증 이미지를 저장했습니다.');
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('Failed to share outbound certificate:', error);
                alert('반출증 공유에 실패했습니다.');
            }
        } finally {
            setSharingCertificate(false);
        }
    };

    const mobileGroupOptions = [
        { key: 'scaffolding' as const, title: '시스템 비계', items: scaffoldingList, colorClass: 'red' },
        { key: 'dongbari' as const, title: '시스템 동바리', items: dongbariList, colorClass: 'red' },
        ...(otherList.length > 0 ? [{ key: 'other' as const, title: '기타', items: otherList, colorClass: 'slate' }] : []),
    ];
    const activeMobileGroup = mobileGroupOptions.find((option) => option.key === mobileMaterialGroup && option.items.length > 0)
        || mobileGroupOptions.find((option) => option.items.length > 0);

    // Helper to render a "Section" (Card)
    const renderSection = (title: string, items: Material[], colorClass = 'red', sectionIndex = 0) => {
        if (items.length === 0) return null;

        const sortedItems = sortMaterialDisplayRows(items);

        // 10 rows per chunk lets 70 items render as 7 compact columns on one line.
        const chunks: Material[][] = [];
        for (let i = 0; i < sortedItems.length; i += ITEMS_PER_COLUMN) {
            chunks.push(sortedItems.slice(i, i + ITEMS_PER_COLUMN));
        }
        const accentClasses = getQuantityAccentClasses(colorClass);

        return (
            <div
                className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-6"
                data-material-nav-section="true"
                data-section-index={sectionIndex}
            >
                <div className={`bg-${colorClass}-50/50 px-4 py-3 border-b border-${colorClass}-100 flex justify-between items-center`}>
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <span className={`bg-${colorClass}-500 w-2 h-6 rounded-sm`}></span>
                        {title}
                    </h3>
                    <div className={`text-xs text-${colorClass}-600 font-medium bg-white px-2 py-1 rounded border border-${colorClass}-100`}>
                        {items.length} 품목
                    </div>
                </div>

                <div className="space-y-2 p-2 md:hidden">
                    {(() => {
                        const groupedItems = sortedItems.reduce<Array<{ itemName: string; materials: Material[] }>>((groups, material) => {
                            const group = groups.find((candidate) => candidate.itemName === material.itemName);
                            if (group) {
                                group.materials.push(material);
                            } else {
                                groups.push({ itemName: material.itemName, materials: [material] });
                            }
                            return groups;
                        }, []);
                        const itemGroups = groupedItems.map((group) => ({
                            ...group,
                            quantityTotal: group.materials.reduce((sum, material) => sum + (quantities[material.id] || 0), 0),
                        }));
                        const activeItemGroup = itemGroups.find((group) => group.itemName === mobileSelectedItemName)
                            || itemGroups.find((group) => group.quantityTotal > 0)
                            || itemGroups[0];

                        return (
                            <>
                                <div className="rounded-lg border border-red-100 bg-white p-1.5 shadow-sm">
                                    <div className="mb-1 flex items-center justify-between px-0.5">
                                        <div className="text-[10px] font-bold text-slate-500">품목 선택</div>
                                        <div className="text-[10px] font-bold text-red-700">{itemGroups.length}개 품목</div>
                                    </div>
                                    <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                                        {itemGroups.map((group) => {
                                            const active = activeItemGroup?.itemName === group.itemName;
                                            return (
                                                <button
                                                    key={group.itemName}
                                                    type="button"
                                                    onClick={() => setMobileSelectedItemName(group.itemName)}
                                                    className={`rounded-md border px-2 py-1.5 text-left transition ${active
                                                        ? 'border-red-500 bg-red-50 text-red-800 shadow-sm'
                                                        : group.quantityTotal > 0
                                                            ? 'border-red-200 bg-red-50/60 text-red-800'
                                                            : 'border-slate-200 bg-white text-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-bold">{group.itemName}</span>
                                                        {group.quantityTotal > 0 && (
                                                            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                                                {group.quantityTotal}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-medium text-slate-500">{group.materials.length} 규격</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {activeItemGroup && (
                                    <div className={`rounded-lg border p-2.5 shadow-sm ${activeItemGroup.quantityTotal > 0 ? accentClasses.cardActive : 'border-red-200 bg-white'}`}>
                                        <div className="mb-2 flex items-center justify-between rounded-md bg-red-50 px-2 py-2 text-red-900">
                                            <div className="truncate text-base font-bold">{activeItemGroup.itemName}</div>
                                            <div className="shrink-0 text-xs font-bold">{activeItemGroup.materials.length} 규격 / {activeItemGroup.quantityTotal}</div>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-white">
                                            <div className="grid grid-cols-[1fr_0.45fr_0.7fr] border-b border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-500">
                                                <span>규격</span>
                                                <span className="text-center">단위</span>
                                                <span className="text-center">수량</span>
                                            </div>
                                            <div className="max-h-[52vh] overflow-y-auto divide-y divide-slate-100">
                                                {activeItemGroup.materials.map((material) => {
                                                    const qty = quantities[material.id] || 0;
                                                    return (
                                                        <div key={material.id} className={`p-2 ${qty > 0 ? 'bg-red-50/70' : 'bg-white'}`}>
                                                            <div className="grid grid-cols-[1fr_0.45fr_0.7fr] items-center gap-2">
                                                                <div className="truncate text-base font-bold text-slate-800">{material.spec}</div>
                                                                <div className="text-center text-base font-bold text-slate-700">{material.unit}</div>
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={qty || ''}
                                                                    onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                                                                    onKeyDown={handleMaterialQuantityInputKeyDown}
                                                                    placeholder="0"
                                                                    className={`h-11 w-full rounded-lg border px-1 text-center text-lg font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${qty > 0
                                                                        ? accentClasses.inputActive
                                                                        : 'border-slate-200 bg-slate-50 text-slate-500 focus:border-red-500 focus:bg-white focus:text-slate-800'
                                                                        }`}
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                            </div>
                                                            <div className="mt-2 grid grid-cols-6 gap-1.5">
                                                                {QUICK_QUANTITY_STEPS.map((step) => (
                                                                    <button
                                                                        key={step}
                                                                        type="button"
                                                                        disabled={step < 0 && qty <= 0}
                                                                        onClick={() => handleQuantityStep(material.id, step)}
                                                                        className={`h-8 rounded-md border text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${step > 0 ? accentClasses.positiveButton : accentClasses.negativeButton}`}
                                                                    >
                                                                        {step > 0 ? `+${step}` : step}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className="hidden overflow-x-auto md:block">
                    <div className={`p-2 grid ${getMaterialChunkGridClass(chunks.length)} gap-1.5 items-start`}>
                        {chunks.map((chunk, chunkIndex) => (
                            <div key={chunkIndex} className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full table-fixed text-[11px] leading-tight">
                                    <colgroup>
                                        <col />
                                        <col className="w-11" />
                                        <col className="w-8" />
                                    </colgroup>
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-1.5 py-1.5 text-left font-bold text-slate-500 uppercase whitespace-nowrap">품명/규격</th>
                                            <th className="px-0.5 py-1.5 text-center font-bold text-slate-500 uppercase whitespace-nowrap">수량</th>
                                            <th className="px-0.5 py-1.5 text-center font-bold text-slate-500 uppercase whitespace-nowrap">단위</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {chunk.map((material, rowIndex) => {
                                            const qty = quantities[material.id] || 0;
                                            return (
                                                <tr key={material.id} className={`transition-colors ${qty > 0 ? `bg-${colorClass}-50` : 'hover:bg-slate-50'}`}>
                                                    <td className="px-1.5 py-1" title={`${material.itemName} ${material.spec}`}>
                                                        <div className="flex min-w-0 items-center gap-0.5 whitespace-nowrap">
                                                            <span className="min-w-0 truncate text-slate-500">{material.itemName}</span>
                                                            <span className="shrink-0 text-slate-300">/</span>
                                                            <span className="shrink-0 font-bold text-slate-700">{material.spec}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-0.5 py-0.5 text-center">
                                                        <input
                                                            type="number"
                                                            value={qty || ''}
                                                            onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                                                            onKeyDown={handleMaterialQuantityInputKeyDown}
                                                            data-material-nav="true"
                                                            data-section-index={sectionIndex}
                                                            data-column-index={chunkIndex}
                                                            data-row-index={rowIndex}
                                                            placeholder="0"
                                                            className={`h-6 w-full border rounded px-0.5 text-center font-bold text-xs transition-all outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${qty > 0
                                                                ? `border-${colorClass}-500 text-${colorClass}-700 bg-white`
                                                                : `border-slate-200 bg-slate-50 text-slate-400 focus:bg-white focus:border-${colorClass}-500 focus:text-slate-800`
                                                                }`}
                                                            onFocus={(e) => e.target.select()}
                                                        />
                                                    </td>
                                                    <td className="px-0.5 py-0.5 text-center text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                        {material.unit}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto min-h-screen w-full max-w-[calc(100vw-30px)] overflow-x-hidden bg-slate-50 p-3 sm:max-w-[2100px] sm:p-6">
            <input
                ref={photoAnalysisInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoAnalysisFileChange}
            />
            <div className="mb-3 flex items-center justify-between sm:hidden">
                <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                    <FontAwesomeIcon icon={faArrowUp} className="text-red-600" />
                    출고 등록
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-extrabold text-red-700">
                    선택 {selectedItemCount}개 · 총 {selectedQuantityTotal}
                </div>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 sm:hidden">
                <button
                    onClick={() => navigate('/materials/transactions')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={faEdit} />
                    수정
                </button>
                <MaterialSelectionActionBar
                    materials={selectedMaterials}
                    tone="red"
                    title="출고 등록 품목"
                    details={selectionActionDetails}
                />
                <button
                    type="button"
                    onClick={handlePhotoAnalysisClick}
                    disabled={loading || analyzingPhoto || materials.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <FontAwesomeIcon icon={analyzingPhoto ? faSpinner : faCamera} spin={analyzingPhoto} />
                    {analyzingPhoto ? '분석 중' : '사진분석'}
                </button>
            </div>
            <div className="mb-4 hidden gap-4 sm:mb-6 sm:flex sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowUp} className="text-red-600" />
                        출고 등록
                    </h1>
                    <p className="text-slate-500 mt-1">시스템 비계(좌) / 시스템 동바리(우) 고정 배치</p>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                    <button
                        onClick={() => navigate('/materials/transactions')}
                        className="justify-center px-3 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition flex items-center gap-2 sm:px-4"
                    >
                        <FontAwesomeIcon icon={faEdit} />
                        수정
                    </button>
                    <MaterialSelectionActionBar
                        materials={selectedMaterials}
                        tone="red"
                        title="출고 등록 품목"
                        details={selectionActionDetails}
                    />
                    <button
                        type="button"
                        onClick={handlePhotoAnalysisClick}
                        disabled={loading || analyzingPhoto || materials.length === 0}
                        className="justify-center px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold hover:bg-red-100 transition flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                    >
                        <FontAwesomeIcon icon={analyzingPhoto ? faSpinner : faCamera} spin={analyzingPhoto} />
                        {analyzingPhoto ? '분석 중...' : '사진분석'}
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="justify-center px-3 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50 sm:px-4"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="justify-center px-3 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md transition flex items-center gap-2 disabled:opacity-50 sm:px-6"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '출고 완료'}
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
                {/* 기본 정보 입력 */}
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-red-100 bg-red-50/30 p-2 md:grid-cols-2 xl:grid-cols-5 sm:mb-6 sm:gap-4 sm:bg-transparent sm:p-0 sm:border-0">
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">출고일자 *</label>
                        <input
                            type="date"
                            value={transactionDate}
                            onChange={(e) => setTransactionDate(e.target.value)}
                            className="h-10 w-full border border-slate-300 rounded-lg px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">현장명 *</label>
                        <select
                            value={siteId}
                            onChange={(e) => handleSiteChange(e.target.value)}
                            className="h-10 w-full border border-slate-300 rounded-lg bg-white px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        >
                            <option value="">현장 선택</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">임대사</label>
                        <select
                            value={rentalCompanyId}
                            onChange={(e) => handleRentalCompanyChange(e.target.value)}
                            className="h-10 w-full border border-slate-300 rounded-lg bg-white px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        >
                            <option value="">임대사 선택</option>
                            {showDetachedRentalOption && (
                                <option value={rentalCompanyId}>{rentalCompanyName}</option>
                            )}
                            {rentalCompanies.map((company) => {
                                const optionId = getMaterialRentalCompanyOptionId(company);
                                if (!optionId) return null;
                                return (
                                    <option key={optionId} value={optionId}>{company.name}</option>
                                );
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">차량번호</label>
                        <input
                            type="text"
                            value={vehicleNumber}
                            onChange={(e) => setVehicleNumber(e.target.value)}
                            placeholder="12가3456"
                            className="h-10 w-full border border-slate-300 rounded-lg px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">반출자</label>
                        <input
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder="반출자명"
                            className="h-10 w-full border border-slate-300 rounded-lg px-2 text-sm sm:h-auto sm:px-3 sm:py-2"
                        />
                    </div>
                </div>

                <MaterialPhotoPicker
                    photos={photoAttachments}
                    onPhotosChange={setPhotoAttachments}
                    tone="red"
                    disabled={loading}
                    uploadProgress={photoUploadProgress}
                />

                <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                            <FontAwesomeIcon icon={faFileInvoice} className="text-red-600" />
                            반출증
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <FontAwesomeIcon icon={faBuilding} />
                                {rentalCompanyName || '임대사 미선택'}
                            </span>
                            <span>품목 {selectedItemCount}개</span>
                            <span>사진 {photoAttachments.length}장</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                        <button
                            type="button"
                            onClick={handleOpenOutboundCertificatePage}
                            disabled={sharingCertificate || selectedMaterials.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faFileInvoice} />
                            반출증 페이지
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadOutboundCertificate}
                            disabled={sharingCertificate || selectedMaterials.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faDownload} />
                            반출증 저장
                        </button>
                        <button
                            type="button"
                            onClick={handleShareOutboundCertificate}
                            disabled={sharingCertificate || selectedMaterials.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faShareNodes} />
                            {sharingCertificate ? '준비 중...' : '카카오톡 공유'}
                        </button>
                    </div>
                </div>

                        <div className="mb-5 hidden flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between md:flex">
                            <div className="relative flex-1">
                                <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    placeholder="품명, 규격, 분류 검색"
                                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                                <div className="rounded-lg border border-red-100 bg-white px-3 py-2 text-center">
                                    <div className="text-[11px] font-bold text-slate-400">선택 품목</div>
                                    <div className="text-sm font-bold text-red-700">{selectedItemCount}개</div>
                                </div>
                                <div className="rounded-lg border border-red-100 bg-white px-3 py-2 text-center">
                                    <div className="text-[11px] font-bold text-slate-400">총 수량</div>
                                    <div className="text-sm font-bold text-red-700">{selectedQuantityTotal}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 space-y-3 md:hidden">
                            <div className="relative">
                                <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    placeholder="품명, 규격 검색"
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                />
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                                <div className="mb-2 text-[11px] font-bold text-slate-500">1단계: 분류 선택</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {mobileGroupOptions.map((option) => {
                                        const active = activeMobileGroup?.key === option.key;
                                        return (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => setMobileMaterialGroup(option.key)}
                                                className={`rounded-lg border px-3 py-2 text-left transition ${active
                                                    ? 'border-red-500 bg-white text-red-700 shadow-sm'
                                                    : 'border-slate-200 bg-white text-slate-600'
                                                    }`}
                                            >
                                                <div className="text-sm font-bold">{option.title}</div>
                                                <div className="mt-0.5 text-xs text-slate-500">{option.items.length} 품목</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="text-[11px] font-bold text-slate-500">
                                2단계: 품목 선택 후 규격별 수량 입력
                            </div>
                        </div>

                        {/* 2. Side-by-Side Layout: Scaffolding (Left) | Dongbari (Right) */}
                        {/* 2. Vertical Layout: Scaffolding (Row 1) -> Dongbari (Row 2) */}
                        <div className="mb-6 md:hidden">
                            {activeMobileGroup
                                ? renderSection(activeMobileGroup.title, activeMobileGroup.items, activeMobileGroup.colorClass, mobileGroupOptions.findIndex((option) => option.key === activeMobileGroup.key))
                                : (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                                        표시할 자재가 없습니다.
                                    </div>
                                )}
                        </div>
                        <div className="mb-6 hidden flex-col gap-6 md:flex">
                            {/* Row 1: System Scaffolding */}
                            <div className="w-full">
                                {renderSection('시스템 비계', scaffoldingList, 'red', 0)}
                            </div>

                            {/* Row 2: System Dongbari */}
                            <div className="w-full">
                                {renderSection('시스템 동바리', dongbariList, 'red', 1)}
                            </div>

                            {/* Others */}
                            {otherList.length > 0 && (
                                <div className="w-full">
                                    {renderSection('기타 및 소모품', otherList, 'slate', 2)}
                                </div>
                            )}
                        </div>
                <div className="mb-6 mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label htmlFor="outbound-notes" className="block text-sm font-bold text-slate-700">
                        비고
                    </label>
                    <textarea
                        id="outbound-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        placeholder="출고 등록에 남길 비고를 입력하세요"
                        className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                </div>
                {/* 임시저장 안내 */}
                {hasTempData && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2 sm:items-center">
                                <FontAwesomeIcon icon={faFloppyDisk} className="text-blue-600" />
                                <span className="text-blue-800 font-medium">
                                    임시저장된 데이터가 있습니다. 마지막 저장: {new Date(
                                        JSON.parse(localStorage.getItem('outbound_temp') || '{}').savedAt || Date.now()
                                    ).toLocaleString('ko-KR')}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    if (window.confirm('임시저장된 데이터를 삭제하시겠습니까?')) {
                                        clearTempData();
                                        handleReset();
                                    }
                                }}
                                className="self-end text-blue-600 hover:text-blue-800 transition-colors sm:self-auto"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    </div>
                )}

                {/* 액션 버튼 */}
                <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-6 flex gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:justify-end sm:bg-transparent sm:p-0 sm:pt-6 sm:backdrop-blur-0">
                    <button
                        onClick={() => window.history.back()}
                        className="hidden px-6 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors sm:block"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50 sm:flex-none sm:px-6"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-50 sm:flex-none sm:px-6"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '출고 완료'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialOutboundPage;
