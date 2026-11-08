import './MaterialWorkspace.css';
import { useMaterialAdministration } from '../../hooks/useMaterialAdministration';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildTransactionOutboundCertificate, getOutboundCertificateGroupKey } from './materialTransactionCertificate';
import { createOutboundCertificateDraftId, saveOutboundCertificateDraft } from './materialOutboundCertificateDraftStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClipboardList,
    faSearch,
    faDownload,
    faTruck,
    faEdit,
    faTrash,
    faTimes,
    faSave,
} from '@fortawesome/free-solid-svg-icons';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { settlementTargetService } from '../../services/settlementTargetService';
import { InboundTransaction, Material, OutboundTransaction } from '../../types/materials';
import MaterialSearchSelect from './MaterialSearchSelect';
import MaterialTransactionDateList, { getMaterialTransactionRowKey as getTransactionKey, MaterialTransactionRow } from './MaterialTransactionDateList';
import './MaterialTransactionsPage.css';
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
} from './MaterialPhotoViewerModal';
import {
    getMaterialTransactionRentalCompanyLink,
    matchesMaterialTransactionRentalCompanyFilter,
} from './materialTransactionRentalCompany';
import {
    buildMaterialTransactionExcelRows,
    MATERIAL_TRANSACTION_EXCEL_HEADERS,
    MaterialTransactionExcelCellValue,
} from './materialTransactionExcel';

type Transaction = MaterialTransactionRow;

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
    const canDelete = useMaterialAdministration();
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [certificateTransactions, setCertificateTransactions] = useState<Transaction[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [rentalCompanies, setRentalCompanies] = useState<MaterialRentalCompanyOption[]>([]);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterError, setFilterError] = useState('');
    const [siteStatusFilter, setSiteStatusFilter] = useState<MaterialSiteStatusFilter>('active');
    const [siteId, setSiteId] = useState('');
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

    useEffect(() => {
        loadMasterData();
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

    const handleSearch = async (
        siteRows: Site[] = sites,
        materialRows: Material[] = materials,
        statusFilter: MaterialSiteStatusFilter = siteStatusFilter
    ) => {
        if ((startDate && !isValidDateText(startDate)) || (endDate && !isValidDateText(endDate))) {
            setFilterError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
            return;
        }
        if (startDate && endDate && startDate > endDate) {
            setFilterError('시작일은 종료일보다 늦을 수 없습니다.');
            return;
        }
        setFilterError('');
        setLoading(true);
        try {
            let fetchedInbound: InboundTransaction[] = [];
            let fetchedOutbound: OutboundTransaction[] = [];

            const filters = {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
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

            setCertificateTransactions(normalized);
            setTransactions(materialName ? normalized.filter(t => t.itemName.includes(materialName) || t.spec?.includes(materialName)) : normalized);
            setSelectedTransactionKeys(new Set());
        } catch (error) {
            console.error('Failed to search transactions:', error);
            alert('데이터를 조회하는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTransactionRows = (rows: Transaction[]) => {
        const keys = rows.map(getTransactionKey);
        setSelectedTransactionKeys(previous => {
            const next = new Set(previous);
            const allSelected = keys.length > 0 && keys.every(key => previous.has(key));
            keys.forEach(key => { if (allSelected) next.delete(key); else next.add(key); });
            return next;
        });
    };

    const handleOpenOutboundCertificate = (row: Transaction) => {
        const key = getOutboundCertificateGroupKey(row);
        const rows = certificateTransactions.filter(item => item.type === 'outbound' && getOutboundCertificateGroupKey(item) === key);
        const draft = buildTransactionOutboundCertificate(createOutboundCertificateDraftId(), rows, sites, rentalCompanies);
        saveOutboundCertificateDraft(draft);
        navigate(`/materials/outbound-certificate?draftId=${encodeURIComponent(draft.id)}`);
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
        const rentalCompany = getMaterialTransactionRentalCompanyLink(tx);
        setEditingTx(tx);
        setEditForm({
            transactionDate: tx.transactionDate,
            siteId: tx.siteId,
            vehicleNumber: tx.vehicleNumber || '',
            quantity: tx.quantity,
            counterparty: tx.type === 'inbound'
                ? trimText((tx as InboundTransaction).supplier)
                : trimText((tx as OutboundTransaction).recipient),
            rentalCompanyId: rentalCompany.id,
            rentalCompanyName: rentalCompany.name,
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
                rentalCompanyId: editForm.rentalCompanyId,
                rentalCompanyName: editForm.rentalCompanyName,
                notes: editForm.notes
            };

            if (editingTx.type === 'inbound') {
                updates.supplier = editForm.counterparty;
                await materialService.updateInboundTransaction(editingTx.id, updates);
            } else {
                updates.recipient = editForm.counterparty;
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
        const headers = MATERIAL_TRANSACTION_EXCEL_HEADERS;
        const rows: MaterialTransactionExcelCellValue[][] = [
            [...headers],
            ...buildMaterialTransactionExcelRows(visibleTransactions),
        ];

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 12 },
            { wch: 10 },
            { wch: 24 },
            { wch: 14 },
            { wch: 22 },
            { wch: 18 },
            { wch: 10 },
            { wch: 8 },
            { wch: 16 },
            { wch: 20 },
            { wch: 18 },
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
        const centerColumns = new Set([0, 1, 7, 8, 10]);
        const rightColumns = new Set([6]);
        for (let r = range.s.r; r <= range.e.r; r += 1) {
            for (let c = range.s.c; c <= range.e.c; c += 1) {
                const address = XLSX.utils.encode_cell({ r, c });
                if (!ws[address]) ws[address] = { t: 's', v: '' };
                const cell = ws[address] as XLSX.CellObject & { s?: unknown };
                const isHeader = r === 0;
                const isData = r > 0;
                const isInboundType = isData && c === 1 && cell.v === '입고';
                const isOutboundType = isData && c === 1 && cell.v === '출고';
                const isQuantity = c === 6;
                const isTextLong = c === 12;
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
        if (!rentalCompanyFilter) return true;

        const selectedCompany = rentalCompanies.find((company) => getMaterialRentalCompanyOptionId(company) === rentalCompanyFilter);
        const selectedName = trimText(selectedCompany?.name);
        return matchesMaterialTransactionRentalCompanyFilter(
            t,
            rentalCompanyFilter,
            selectedName,
            RENTAL_UNASSIGNED_FILTER
        );
    });
    const showDetachedEditRentalOption = !!(
        editingTx &&
        editForm.rentalCompanyId &&
        editForm.rentalCompanyName &&
        !rentalCompanies.some((company) => getMaterialRentalCompanyOptionId(company) === editForm.rentalCompanyId)
    );
    const visibleTransactionKeys = visibleTransactions.map(getTransactionKey);
    const selectedVisibleCount = visibleTransactionKeys.filter((key) => selectedTransactionKeys.has(key)).length;

    return (
        <div className="material-page material-page--transactions flex-1 min-h-0 flex flex-col p-3 sm:p-6 max-w-[2200px] w-full mx-auto bg-slate-50 overflow-x-hidden font-sans">
            <div className="material-page__heading flex flex-col gap-3 xl:flex-row xl:justify-between xl:items-center mb-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" />
                        자재 입출고 내역
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">날짜별 임대사·차량번호를 확인하고 펼쳐서 자재 상세 내역을 조회합니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                        선택 {selectedVisibleCount.toLocaleString('ko-KR')}건
                    </span>
                    {canDelete && (<button
                        type="button"
                        onClick={handleBulkDelete}
                        disabled={selectedVisibleCount === 0 || loading}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 shadow-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                        선택 삭제
                    </button>)}
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
            <section aria-label="입출고 조회 조건" className="material-panel material-transactions-filters bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 flex-shrink-0">
                <div className="material-transactions-filters__grid">
                    <div className="material-transactions-filters__dates">
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-500">날짜</span>
                            <button type="button" className="text-xs font-semibold text-indigo-600" onClick={() => { setStartDate(''); setEndDate(''); setFilterError(''); }}>전체 기간</button>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                            <input type="date" aria-label="시작일" value={startDate} max={endDate || undefined}
                                onChange={event => { setStartDate(event.target.value); setFilterError(''); }}
                                className="h-[38px] min-w-0 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                            <span className="text-slate-400">~</span>
                            <input type="date" aria-label="종료일" value={endDate} min={startDate || undefined}
                                onChange={event => { setEndDate(event.target.value); setFilterError(''); }}
                                className="h-[38px] min-w-0 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                        </div>
                    </div>
                    <div className="min-w-0">
                        <label htmlFor="transaction-site-status" className="block text-xs font-bold text-slate-500 mb-1">현장구분</label>
                        <select
                            id="transaction-site-status"
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
                    <div className="min-w-0">
                        <label htmlFor="transaction-site" className="block text-xs font-bold text-slate-500 mb-1">현장</label>
                        <MaterialSearchSelect id="transaction-site" label="현장" value={siteId} onChange={setSiteId}
                            options={statusFilteredSites.map(site => ({ id: site.id, name: site.name, description: [getSiteStatusLabel(site.status), site.address || site.code].filter(Boolean).join(' · '), keywords: site.code }))}
                            placeholder="전체 현장 · 검색" emptyOptionLabel="전체 현장" />
                    </div>
                    <div className="md:col-span-1">
                        <label htmlFor="transaction-type" className="block text-xs font-bold text-slate-500 mb-1">구분</label>
                        <select
                            id="transaction-type"
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
                        <label htmlFor="transaction-vehicle" className="block text-xs font-bold text-slate-500 mb-1">차량번호</label>
                        <div className="relative">
                            <input
                                id="transaction-vehicle"
                                type="text"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value)}
                                placeholder="차량번호 (예: 12가3456)"
                                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                            <FontAwesomeIcon icon={faTruck} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        </div>
                    </div>
                    <div className="min-w-0">
                        <label htmlFor="transaction-rental" className="block text-xs font-bold text-slate-500 mb-1">임대사</label>
                        <MaterialSearchSelect id="transaction-rental" label="임대사" value={rentalCompanyFilter} onChange={setRentalCompanyFilter}
                            options={[...rentalCompanies, { id: RENTAL_UNASSIGNED_FILTER, name: '임대사 미지정' }]}
                            placeholder="전체 임대사 · 검색" emptyOptionLabel="전체 임대사" />
                    </div>
                    <div className="md:col-span-1 flex gap-2">
                        <button
                            onClick={() => handleSearch()}
                            disabled={loading}
                            className="material-primary-button flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-200 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>
                {filterError && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{filterError}</p>}
            </section>

            <MaterialTransactionDateList
                rows={visibleTransactions}
                loading={loading}
                selectedKeys={selectedTransactionKeys}
                canDelete={canDelete}
                onToggleRows={toggleTransactionRows}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onOutboundCertificate={handleOpenOutboundCertificate}
                onPhotos={openPhotoViewer}
            />

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

                                {editingTx && (
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
