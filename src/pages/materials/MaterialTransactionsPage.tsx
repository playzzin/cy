import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClipboardList,
    faSearch,
    faDownload,
    faTruck,
    faArrowRight,
    faArrowLeft,
    faFilter,
    faEdit,
    faTrash,
    faTimes,
    faSave,
    faImages,
} from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { settlementTargetService } from '../../services/settlementTargetService';
import { InboundTransaction, Material, OutboundTransaction } from '../../types/materials';
import * as XLSX from 'xlsx-js-style';
import {
    createSiteIdSet,
    filterCheongyeonMaterialSites,
    filterSitesByMaterialStatus,
    getSiteStatusLabel,
    MaterialSiteStatusFilter
} from './materialSiteFilters';
import {
    buildMaterialRentalCompanyOptions,
    getMaterialRentalCompanyOptionId,
    MaterialRentalCompanyOption,
} from './materialRentalCompanyOptions';
import MaterialPhotoViewerModal, {
    createMaterialPhotoUrlResolver,
    getMaterialPhotoDisplayCount,
    hasMaterialPhotoReference,
} from './MaterialPhotoViewerModal';

type Transaction = (InboundTransaction | OutboundTransaction) & {
    type: 'inbound' | 'outbound';
    siteStatus?: Site['status'];
    siteStatusLabel?: string;
};

type ExcelCellValue = string | number;

interface PhotoViewerState {
    isOpen: boolean;
    title: string;
    expectedCount: number | null;
    urls: string[];
    loading: boolean;
    error: string;
}

const CLOSED_PHOTO_VIEWER_STATE: PhotoViewerState = {
    isOpen: false,
    title: '',
    expectedCount: null,
    urls: [],
    loading: false,
    error: '',
};

const RENTAL_UNASSIGNED_FILTER = '__rental_unassigned__';

const excelRgb = (color: string): string => color.replace('#', '').toUpperCase();

const excelFill = (color: string) => ({
    fgColor: { rgb: excelRgb(color) },
    patternType: 'solid' as const,
});

const excelBorder = {
    top: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
    left: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
    right: { style: 'thin' as const, color: { rgb: 'CBD5E1' } },
};

const sanitizeExcelFileName = (value: string): string => (
    value
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
);

const MaterialTransactionsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [rentalCompanies, setRentalCompanies] = useState<MaterialRentalCompanyOption[]>([]);

    // Filters
    const [siteStatusFilter, setSiteStatusFilter] = useState<MaterialSiteStatusFilter>('active');
    const [siteId, setSiteId] = useState('');
    const [siteKeyword, setSiteKeyword] = useState('');
    const [transactionType, setTransactionType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [materialName, setMaterialName] = useState('');
    const [rentalCompanyFilter, setRentalCompanyFilter] = useState('');

    // Edit State
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTransactionKeys, setSelectedTransactionKeys] = useState<Set<string>>(new Set());
    const [photoViewer, setPhotoViewer] = useState<PhotoViewerState>(CLOSED_PHOTO_VIEWER_STATE);
    const photoRequestIdRef = React.useRef(0);
    const photoUrlResolverRef = React.useRef(createMaterialPhotoUrlResolver(
        (photoBatchId) => materialService.getMaterialPhotoDownloadUrls(photoBatchId)
    ));

    // Edit Form State
    const [editForm, setEditForm] = useState({
        transactionDate: '',
        siteId: '',
        vehicleNumber: '',
        quantity: 0,
        counterparty: '',
        rentalCompanyId: '',
        rentalCompanyName: '',
        notes: ''
    });

    const normalizeDateInput = (value: string): string => {
        const digits = String(value ?? '').replace(/[^\d]/g, '').slice(0, 8);
        if (digits.length <= 4) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    };

    const isValidDateText = (value: string): boolean => {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim());
    };

    const trimText = (value: unknown): string => String(value ?? '').trim();
    const normalizeSearchText = (value: unknown): string => trimText(value).replace(/\s+/g, '').toLowerCase();
    const getTransactionKey = (tx: Transaction): string => `${tx.type}:${tx.id}`;

    useEffect(() => {
        loadMasterData();
    }, []);

    // Lock main content scroll
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);

    const loadMasterData = async () => {
        try {
            const [siteRows, materialRows, companyRows, settlementTargetRows] = await Promise.all([
                siteService.getSites(),
                materialService.getUniqueMaterialsForSelection(),
                companyService.getCompanies(),
                settlementTargetService.getTargets().catch(() => []),
            ]);
            const cheongyeonSites = filterCheongyeonMaterialSites(siteRows, 'all');
            setSites(cheongyeonSites);
            setMaterials(materialRows);
            setRentalCompanies(buildMaterialRentalCompanyOptions(companyRows, settlementTargetRows));
            await handleSearch(cheongyeonSites, materialRows, siteStatusFilter);
        } catch (error) {
            console.error('Failed to load transaction master data:', error);
        }
    };

    const statusFilteredSites = filterSitesByMaterialStatus(sites, siteStatusFilter);
    const filteredSites = sites.filter((site) => {
        if (!statusFilteredSites.some((row) => row.id === site.id)) return false;
        if (!siteKeyword.trim()) return true;
        return normalizeSearchText(site.name).includes(normalizeSearchText(siteKeyword));
    });

    const handleSearch = async (
        siteRows: Site[] = sites,
        materialRows: Material[] = materials,
        statusFilter: MaterialSiteStatusFilter = siteStatusFilter
    ) => {
        setLoading(true);
        try {
            let fetchedInbound: InboundTransaction[] = [];
            let fetchedOutbound: OutboundTransaction[] = [];

            const filters = {
                siteId: siteId || undefined,
                vehicleNumber: vehicleNumber || undefined,
            };

            if (transactionType === 'all' || transactionType === 'inbound') {
                fetchedInbound = await materialService.getInboundTransactions(filters);
            }
            if (transactionType === 'all' || transactionType === 'outbound') {
                fetchedOutbound = await materialService.getOutboundTransactions(filters);
            }

            // Merge and Tag
            const labeledInbound = fetchedInbound.map(t => ({ ...t, type: 'inbound' as const }));
            const labeledOutbound = fetchedOutbound.map(t => ({ ...t, type: 'outbound' as const }));

            const allowedSites = filterSitesByMaterialStatus(siteRows, statusFilter);
            const allowedSiteIds = createSiteIdSet(allowedSites);
            const siteById = new Map(allowedSites.map((site) => [site.id, site]));
            let all = [...labeledInbound, ...labeledOutbound].filter((tx) => allowedSiteIds.has(tx.siteId));

            // Client-side filtering for Material Name
            if (materialName) {
                all = all.filter(t => t.itemName.includes(materialName) || t.spec?.includes(materialName));
            }

            // Sort by Date DESC
            all.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

            const materialById = new Map(
                materialRows.flatMap((m) => [
                    [m.id, m],
                    ...(m.materialKey ? [[m.materialKey, m] as const] : []),
                ])
            );
            const normalized = all.map((t) => {
                const master = materialById.get(t.materialId) || materialById.get(t.materialKey || '');
                const site = siteById.get(t.siteId);
                return {
                    ...t,
                    materialKey: t.materialKey || master?.materialKey,
                    siteStatus: site?.status,
                    siteStatusLabel: getSiteStatusLabel(site?.status),
                    category: trimText(master?.category) || trimText(t.category),
                    itemName: trimText(master?.itemName) || trimText(t.itemName),
                    spec: trimText(master?.spec) || trimText(t.spec),
                    unit: trimText(master?.unit) || trimText(t.unit),
                };
            });

            setTransactions(normalized);
            setSelectedTransactionKeys(new Set());
        } catch (error) {
            console.error('Failed to search transactions:', error);
            alert('데이터를 조회하는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTransactionSelection = (tx: Transaction) => {
        const key = getTransactionKey(tx);
        setSelectedTransactionKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllVisibleTransactions = () => {
        const visibleKeys = visibleTransactions.map(getTransactionKey);
        const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedTransactionKeys.has(key));
        setSelectedTransactionKeys((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                visibleKeys.forEach((key) => next.delete(key));
            } else {
                visibleKeys.forEach((key) => next.add(key));
            }
            return next;
        });
    };

    const handleDelete = async (tx: Transaction) => {
        if (!window.confirm(`${tx.transactionDate} ${tx.itemName} 내역을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            if (tx.type === 'inbound') {
                await materialService.deleteInboundTransaction(tx.id);
            } else {
                await materialService.deleteOutboundTransaction(tx.id);
            }
            alert('삭제되었습니다.');
            await handleSearch(); // Refresh list
        } catch (error) {
            console.error('Deletion failed:', error);
            alert('삭제에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const selectedRows = visibleTransactions.filter((tx) => selectedTransactionKeys.has(getTransactionKey(tx)));
        if (selectedRows.length === 0) {
            alert('삭제할 내역을 선택해주세요.');
            return;
        }

        if (!window.confirm(`선택한 입출고 내역 ${selectedRows.length}건을 삭제하시겠습니까?`)) return;

        setLoading(true);
        try {
            for (const tx of selectedRows) {
                if (tx.type === 'inbound') {
                    await materialService.deleteInboundTransaction(tx.id);
                } else {
                    await materialService.deleteOutboundTransaction(tx.id);
                }
            }
            setSelectedTransactionKeys(new Set());
            alert('선택한 내역이 삭제되었습니다.');
            await handleSearch();
        } catch (error) {
            console.error('Bulk deletion failed:', error);
            alert('선택 삭제에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (tx: Transaction) => {
        setEditingTx(tx);
        setEditForm({
            transactionDate: tx.transactionDate,
            siteId: tx.siteId,
            vehicleNumber: tx.vehicleNumber || '',
            quantity: tx.quantity,
            counterparty: tx.type === 'inbound'
                ? trimText((tx as InboundTransaction).supplier)
                : trimText((tx as OutboundTransaction).recipient),
            rentalCompanyId: tx.type === 'outbound' ? trimText((tx as OutboundTransaction).rentalCompanyId) : '',
            rentalCompanyName: tx.type === 'outbound' ? trimText((tx as OutboundTransaction).rentalCompanyName) : '',
            notes: tx.notes || ''
        });
        setIsEditModalOpen(true);
    };

    const closePhotoViewer = () => {
        photoRequestIdRef.current += 1;
        setPhotoViewer(CLOSED_PHOTO_VIEWER_STATE);
    };

    const openPhotoViewer = async (tx: Transaction) => {
        const requestId = photoRequestIdRef.current + 1;
        photoRequestIdRef.current = requestId;
        const expectedCount = getMaterialPhotoDisplayCount(tx);

        setPhotoViewer({
            isOpen: true,
            title: `${tx.transactionDate} · ${tx.siteName || '현장 미지정'} · ${tx.itemName || '자재'}`,
            expectedCount,
            urls: [],
            loading: true,
            error: '',
        });

        try {
            const urls = await photoUrlResolverRef.current.resolve(tx);
            if (photoRequestIdRef.current !== requestId) return;

            setPhotoViewer((current) => ({
                ...current,
                urls,
                loading: false,
                error: '',
            }));
        } catch (error) {
            if (photoRequestIdRef.current !== requestId) return;

            const errorCode = typeof error === 'object' && error && 'code' in error
                ? String((error as { code?: unknown }).code || '')
                : '';
            const permissionDenied = /unauthorized|permission-denied/i.test(errorCode);
            setPhotoViewer((current) => ({
                ...current,
                urls: [],
                loading: false,
                error: permissionDenied
                    ? '저장된 사진을 볼 권한이 없습니다. 관리자에게 저장소 접근 권한을 확인해 주세요.'
                    : '저장소 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            }));
        }
    };

    const handleEditRentalCompanyChange = (selectedCompanyId: string) => {
        const company = rentalCompanies.find((row) => getMaterialRentalCompanyOptionId(row) === selectedCompanyId);
        setEditForm((prev) => ({
            ...prev,
            rentalCompanyId: selectedCompanyId,
            rentalCompanyName: company?.name || '',
        }));
    };

    const handleUpdate = async () => {
        if (!editingTx) return;
        if (!isValidDateText(editForm.transactionDate)) {
            alert('일자는 YYYY-MM-DD 형식으로 입력해 주세요.');
            return;
        }

        setLoading(true);
        try {
            const updates: any = {
                transactionDate: editForm.transactionDate,
                siteId: editForm.siteId,
                siteName: sites.find(s => s.id === editForm.siteId)?.name || '',
                vehicleNumber: editForm.vehicleNumber,
                quantity: Number(editForm.quantity),
                notes: editForm.notes
            };

            if (editingTx.type === 'inbound') {
                updates.supplier = editForm.counterparty;
                await materialService.updateInboundTransaction(editingTx.id, updates);
            } else {
                updates.recipient = editForm.counterparty;
                updates.rentalCompanyId = editForm.rentalCompanyId;
                updates.rentalCompanyName = editForm.rentalCompanyName;
                await materialService.updateOutboundTransaction(editingTx.id, updates);
            }

            alert('수정되었습니다.');
            setIsEditModalOpen(false);
            setEditingTx(null);
            await handleSearch(); // Refresh list
        } catch (error) {
            console.error('Update failed:', error);
            alert('수정에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = () => {
        const headers = [
            '일자',
            '구분',
            '현장',
            '품명',
            '규격',
            '수량',
            '단위',
            '차량번호',
            '입고처/출고자',
            '임대사',
            '비고',
        ];
        const toExcelQuantity = (value: unknown): number => {
            const quantity = Number(value || 0);
            return Number.isFinite(quantity) ? Math.round(quantity) : 0;
        };
        const rows: ExcelCellValue[][] = [
            headers,
            ...visibleTransactions.map((t) => [
                t.transactionDate,
                t.type === 'inbound' ? '입고' : '출고',
                t.siteName,
                t.itemName,
                t.spec,
                toExcelQuantity(t.quantity),
                t.unit,
                t.vehicleNumber || '',
                t.type === 'inbound'
                    ? ((t as InboundTransaction).supplier || '')
                    : ((t as OutboundTransaction).recipient || ''),
                t.type === 'outbound' ? ((t as OutboundTransaction).rentalCompanyName || '') : '',
                t.notes || '',
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 12 },
            { wch: 10 },
            { wch: 24 },
            { wch: 22 },
            { wch: 18 },
            { wch: 10 },
            { wch: 8 },
            { wch: 16 },
            { wch: 20 },
            { wch: 20 },
            { wch: 34 },
        ];
        ws['!rows'] = rows.map((_, index) => ({
            hpt: index === 0 ? 24 : 21,
        }));
        ws['!autofilter'] = {
            ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(rows.length, 1)}`,
        };

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const centerColumns = new Set([0, 1, 6, 7]);
        const rightColumns = new Set([5]);
        for (let r = range.s.r; r <= range.e.r; r += 1) {
            for (let c = range.s.c; c <= range.e.c; c += 1) {
                const address = XLSX.utils.encode_cell({ r, c });
                if (!ws[address]) ws[address] = { t: 's', v: '' };
                const cell = ws[address] as XLSX.CellObject & { s?: unknown };
                const isHeader = r === 0;
                const isData = r > 0;
                const isInboundType = isData && c === 1 && cell.v === '입고';
                const isOutboundType = isData && c === 1 && cell.v === '출고';
                const isQuantity = c === 5;
                const isTextLong = c === 10;
                const isAltRow = isData && r % 2 === 0;

                cell.s = {
                    fill: isHeader
                        ? excelFill('#1E293B')
                        : isInboundType
                            ? excelFill('#ECFDF5')
                            : isOutboundType
                                ? excelFill('#FFF7ED')
                                : isAltRow
                                    ? excelFill('#F8FAFC')
                                    : undefined,
                    font: {
                        name: '맑은 고딕',
                        sz: isHeader ? 10 : 9,
                        bold: isHeader || isInboundType || isOutboundType,
                        color: isHeader
                            ? { rgb: 'FFFFFF' }
                            : isInboundType
                                ? { rgb: '047857' }
                                : isOutboundType
                                    ? { rgb: 'C2410C' }
                                    : undefined,
                    },
                    alignment: {
                        horizontal: rightColumns.has(c)
                            ? 'right'
                            : centerColumns.has(c) || isHeader
                                ? 'center'
                                : 'left',
                        vertical: 'center',
                        wrapText: isTextLong,
                    },
                    border: excelBorder,
                    numFmt: isQuantity ? '0' : undefined,
                };
                if (typeof cell.v === 'number') {
                    cell.t = 'n';
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '입출고내역');
        XLSX.writeFile(wb, `${sanitizeExcelFileName(`자재입출고내역_${new Date().toISOString().slice(0, 10)}`)}.xlsx`);
    };

    const visibleTransactions = transactions.filter((t) => {
        if (siteKeyword.trim() && !normalizeSearchText(t.siteName).includes(normalizeSearchText(siteKeyword))) {
            return false;
        }

        if (!rentalCompanyFilter) return true;
        if (t.type !== 'outbound') return false;

        const outbound = t as OutboundTransaction;
        const rentalCompanyId = trimText(outbound.rentalCompanyId);
        const rentalCompanyName = trimText(outbound.rentalCompanyName);

        if (rentalCompanyFilter === RENTAL_UNASSIGNED_FILTER) {
            return !rentalCompanyId && !rentalCompanyName;
        }

        const selectedCompany = rentalCompanies.find((company) => getMaterialRentalCompanyOptionId(company) === rentalCompanyFilter);
        const selectedName = trimText(selectedCompany?.name);

        return (
            rentalCompanyId === rentalCompanyFilter ||
            (!!selectedName && normalizeSearchText(rentalCompanyName) === normalizeSearchText(selectedName)) ||
            normalizeSearchText(rentalCompanyName).includes(normalizeSearchText(rentalCompanyFilter))
        );
    });
    const showDetachedEditRentalOption = !!(
        editingTx?.type === 'outbound' &&
        editForm.rentalCompanyId &&
        editForm.rentalCompanyName &&
        !rentalCompanies.some((company) => getMaterialRentalCompanyOptionId(company) === editForm.rentalCompanyId)
    );
    const visibleTransactionKeys = visibleTransactions.map(getTransactionKey);
    const selectedVisibleCount = visibleTransactionKeys.filter((key) => selectedTransactionKeys.has(key)).length;
    const allVisibleSelected = visibleTransactionKeys.length > 0 && selectedVisibleCount === visibleTransactionKeys.length;

    return (
        <div className="flex-1 min-h-0 flex flex-col p-6 max-w-[2200px] w-full mx-auto bg-slate-50 overflow-hidden font-sans">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" />
                        자재 입출고 내역
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">차량별, 현장별 자재 이동 내역을 조회합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/materials/transactions-by-site-date')}
                        className="bg-white text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition flex items-center gap-2 shadow-sm font-medium border border-slate-200"
                    >
                        <FontAwesomeIcon icon={faClipboardList} />
                        현장·날짜별 보기
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                        선택 {selectedVisibleCount.toLocaleString('ko-KR')}건
                    </span>
                    <button
                        type="button"
                        onClick={handleBulkDelete}
                        disabled={selectedVisibleCount === 0 || loading}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 shadow-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                        선택 삭제
                    </button>
                    <button
                        onClick={handleDownloadExcel}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm font-medium"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        Excel 다운로드
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex-shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">현장구분</label>
                        <select
                            value={siteStatusFilter}
                            onChange={(e) => {
                                setSiteStatusFilter(e.target.value as MaterialSiteStatusFilter);
                                setSiteId('');
                            }}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            <option value="active">진행현장</option>
                            <option value="completed">마감현장</option>
                            <option value="all">전체현장</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">현장</label>
                        <select
                            value={siteId}
                            onChange={(e) => setSiteId(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            <option value="">전체 현장</option>
                            {filteredSites.map(site => (
                                <option key={site.id} value={site.id}>[{getSiteStatusLabel(site.status)}] {site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">현장명 검색</label>
                        <input
                            type="text"
                            value={siteKeyword}
                            onChange={(e) => setSiteKeyword(e.target.value)}
                            placeholder="현장명 포함 검색"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">구분</label>
                        <select
                            value={transactionType}
                            onChange={(e) => setTransactionType(e.target.value as any)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            <option value="all">전체</option>
                            <option value="inbound">입고 (In)</option>
                            <option value="outbound">출고 (Out)</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">차량번호</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value)}
                                placeholder="차량번호 (예: 12가3456)"
                                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                            <FontAwesomeIcon icon={faTruck} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">임대사</label>
                        <select
                            value={rentalCompanyFilter}
                            onChange={(e) => setRentalCompanyFilter(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        >
                            <option value="">전체 임대사</option>
                            {rentalCompanies.map((company) => {
                                const optionId = getMaterialRentalCompanyOptionId(company);
                                if (!optionId) return null;
                                return (
                                    <option key={optionId} value={optionId}>{company.name}</option>
                                );
                            })}
                            <option value={RENTAL_UNASSIGNED_FILTER}>임대사 미지정</option>
                        </select>
                    </div>
                    <div className="md:col-span-1 flex gap-2">
                        <button
                            onClick={() => handleSearch()}
                            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto min-h-[780px] max-h-[calc(100vh-220px)]">
                    <table className="w-full text-sm" style={{ minWidth: 2110 }}>
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 text-center font-bold text-slate-600 w-12 sticky left-0 z-30 bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleAllVisibleTransactions}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 w-32 sticky left-[48px] z-20 bg-slate-50">일자</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-600 w-24 sticky left-[176px] z-20 bg-slate-50">구분</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[220px] sticky left-[272px] z-20 bg-slate-50">현장</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[220px] sticky left-[492px] z-20 bg-slate-50">품명</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[160px]">규격</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-600 w-24">수량</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 w-20">단위</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[150px]">차량번호</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[160px]">입고처/출고자</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[160px]">임대사</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-600 min-w-[140px]">사진</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-600 min-w-[220px]">비고</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-600 w-24">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={14} className="p-20 text-center text-slate-400">
                                        <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"></div>
                                        <p>데이터를 불러오는 중입니다...</p>
                                    </td>
                                </tr>
                            ) : visibleTransactions.length > 0 ? (
                                visibleTransactions.map((t, index) => {
                                    const isSelected = selectedTransactionKeys.has(getTransactionKey(t));
                                    const stickyBgClass = isSelected ? 'bg-indigo-50' : 'bg-white';
                                    const hasPhotos = hasMaterialPhotoReference(t);
                                    const photoCount = getMaterialPhotoDisplayCount(t);
                                    return (
                                    <tr key={`${getTransactionKey(t)}-${index}`} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}>
                                        <td className={`px-3 py-2.5 text-center sticky left-0 z-20 ${stickyBgClass}`}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleTransactionSelection(t)}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className={`px-4 py-2.5 text-slate-600 sticky left-[48px] z-10 ${stickyBgClass}`}>{t.transactionDate}</td>
                                        <td className={`px-4 py-2.5 text-center sticky left-[176px] z-10 ${stickyBgClass}`}>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5
                                                ${t.type === 'inbound'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : 'bg-orange-50 text-orange-700 border border-orange-100'
                                                }`}
                                            >
                                                <FontAwesomeIcon icon={t.type === 'inbound' ? faArrowRight : faArrowLeft} />
                                                {t.type === 'inbound' ? '입고' : '출고'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-2.5 font-medium text-slate-800 sticky left-[272px] z-10 ${stickyBgClass}`}>
                                            <div>{t.siteName}</div>
                                            <div className="text-[11px] font-semibold text-slate-400">{t.siteStatusLabel}</div>
                                        </td>
                                        <td className={`px-4 py-2.5 font-medium text-slate-800 sticky left-[492px] z-10 ${stickyBgClass}`}>{t.itemName}</td>
                                        <td className="px-4 py-2.5 text-slate-500">{t.spec}</td>
                                        <td className={`px-4 py-2.5 text-right font-bold ${t.type === 'inbound' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                            {t.quantity.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-500">{t.unit}</td>
                                        <td className="px-4 py-2.5 text-slate-600">
                                            {(t.vehicleNumber != null && String(t.vehicleNumber).trim()) ? (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">
                                                    {String(t.vehicleNumber).trim()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 text-xs">
                                            {t.type === 'inbound'
                                                ? ((t as InboundTransaction).supplier || '-')
                                                : ((t as OutboundTransaction).recipient || '-')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 text-xs">
                                            {t.type === 'outbound' ? ((t as OutboundTransaction).rentalCompanyName || '-') : '-'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            {hasPhotos ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openPhotoViewer(t)}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
                                                    title="첨부사진 보기"
                                                >
                                                    <FontAwesomeIcon icon={faImages} />
                                                    {photoCount === null ? '사진 확인' : `사진 ${photoCount}장`}
                                                </button>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-500 whitespace-pre-wrap break-words">{t.notes || '-'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition"
                                                    title="수정"
                                                >
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(t)}
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition"
                                                    title="삭제"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={14} className="p-24 text-center text-slate-400">
                                        <div className="bg-slate-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                            <FontAwesomeIcon icon={faFilter} className="text-3xl text-slate-300" />
                                        </div>
                                        <p className="text-lg font-medium text-slate-600 mb-1">조회된 내역이 없습니다</p>
                                        <p className="text-sm">검색 조건을 변경하여 다시 조회해보세요.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 text-xs text-slate-400 flex justify-end">
                    Total {visibleTransactions.length} records found
                </div>
            </div>

            <MaterialPhotoViewerModal
                isOpen={photoViewer.isOpen}
                title={photoViewer.title}
                expectedCount={photoViewer.expectedCount}
                urls={photoViewer.urls}
                loading={photoViewer.loading}
                error={photoViewer.error}
                onClose={closePhotoViewer}
            />

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FontAwesomeIcon icon={faEdit} />
                                {editingTx?.type === 'inbound' ? '입고 내역 수정' : '출고 내역 수정'}
                            </h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-white/80 hover:text-white transition"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                                    <p className="text-sm text-slate-500 mb-1">수정 대상 자재</p>
                                    <p className="font-bold text-slate-800">{editingTx?.itemName}</p>
                                    <p className="text-xs text-slate-500">{editingTx?.spec} ({editingTx?.unit})</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">일자</label>
                                        <input
                                            type="text"
                                            value={editForm.transactionDate}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, transactionDate: normalizeDateInput(e.target.value) }))}
                                            onBlur={(e) => setEditForm(prev => ({ ...prev, transactionDate: normalizeDateInput(e.target.value) }))}
                                            placeholder="YYYY-MM-DD"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">수량</label>
                                        <input
                                            type="number"
                                            value={editForm.quantity}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">현장</label>
                                    <select
                                        value={editForm.siteId}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, siteId: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    >
                                        {sites.map(site => (
                                            <option key={site.id} value={site.id}>{site.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">차량번호</label>
                                    <input
                                        type="text"
                                        value={editForm.vehicleNumber}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                                        placeholder="차량번호 입력"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        {editingTx?.type === 'inbound' ? '공급업체(입고처)' : '출고자'}
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.counterparty}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, counterparty: e.target.value }))}
                                        placeholder={editingTx?.type === 'inbound' ? '공급업체 입력' : '출고자 입력'}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>

                                {editingTx?.type === 'outbound' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">임대사</label>
                                        <select
                                            value={editForm.rentalCompanyId}
                                            onChange={(e) => handleEditRentalCompanyChange(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                        >
                                            <option value="">임대사 선택</option>
                                            {showDetachedEditRentalOption && (
                                                <option value={editForm.rentalCompanyId}>{editForm.rentalCompanyName}</option>
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
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">비고</label>
                                    <input
                                        type="text"
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="비고 입력"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialTransactionsPage;
