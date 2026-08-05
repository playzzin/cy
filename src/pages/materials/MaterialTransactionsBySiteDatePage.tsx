import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
    faBuilding,
    faCalendar,
    faChevronDown,
    faChevronRight,
    faClipboardList,
    faDownload,
    faFilter,
    faImages,
    faRotate,
    faSearch,
    faTruck,
    faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import materialService from '../../services/materialService';
import { siteService, Site } from '../../services/siteService';
import { InboundTransaction, OutboundTransaction, TransactionFilters } from '../../types/materials';
import { useCompanyDataScope } from '../../hooks/useCompanyDataScope';
import {
    companyDataScopeMatchesClientSite,
    companyDataScopeMatchesMaterialTransaction,
} from '../../utils/companyDataScope';
import {
    createSiteIdSet,
    filterCheongyeonMaterialSites,
    filterSitesByMaterialStatus,
    getSiteStatusLabel,
    MaterialSiteStatusFilter,
} from './materialSiteFilters';
import { compareMaterialDisplayRows } from '../../utils/materialOrdering';
import MaterialPhotoViewerModal, {
    createMaterialPhotoUrlResolver,
    getMaterialPhotoDisplayCount,
    hasMaterialPhotoReference,
} from './MaterialPhotoViewerModal';

type TransactionTypeFilter = 'all' | 'inbound' | 'outbound';

type MaterialTransaction = (InboundTransaction | OutboundTransaction) & {
    type: 'inbound' | 'outbound';
    siteStatus?: Site['status'];
    siteStatusLabel?: string;
};

type DateGroup = {
    key: string;
    date: string;
    rows: MaterialTransaction[];
    inboundQuantity: number;
    outboundQuantity: number;
    count: number;
};

type SiteGroup = {
    key: string;
    siteId: string;
    siteName: string;
    siteStatusLabel: string;
    dateGroups: DateGroup[];
    inboundQuantity: number;
    outboundQuantity: number;
    count: number;
};

type RentalCompanyGroup = {
    key: string;
    rentalCompanyName: string;
    siteGroups: SiteGroup[];
    inboundQuantity: number;
    outboundQuantity: number;
    count: number;
};

type MutableSiteGroup = Omit<SiteGroup, 'dateGroups'> & {
    dateMap: Map<string, DateGroup>;
};

type MutableRentalCompanyGroup = Omit<RentalCompanyGroup, 'siteGroups'> & {
    siteMap: Map<string, MutableSiteGroup>;
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

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR');
const COLLATOR = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
const UNASSIGNED_RENTAL_COMPANY = '임대사 미지정';

const trimText = (value: unknown): string => String(value ?? '').trim();

const normalizeSearchText = (value: unknown): string =>
    trimText(value).replace(/\s+/g, '').toLowerCase();

const toQuantity = (value: unknown): number => {
    const quantity = Number(value || 0);
    return Number.isFinite(quantity) ? quantity : 0;
};

const formatQuantity = (value: unknown): string => NUMBER_FORMATTER.format(toQuantity(value));

const padTwo = (value: number): string => String(value).padStart(2, '0');

const toDateInputText = (date: Date): string =>
    `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;

const getTodayText = (): string => toDateInputText(new Date());

const getMonthStartText = (): string => {
    const today = new Date();
    return toDateInputText(new Date(today.getFullYear(), today.getMonth(), 1));
};

const sanitizeExcelFileName = (value: string): string => (
    value
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
);

const getCounterparty = (tx: MaterialTransaction): string =>
    tx.type === 'inbound'
        ? trimText((tx as InboundTransaction).supplier)
        : trimText((tx as OutboundTransaction).recipient);

const getRentalCompanyName = (tx: MaterialTransaction): string =>
    trimText(
        tx.type === 'outbound'
            ? (tx as OutboundTransaction).rentalCompanyName
            : (tx as InboundTransaction).rentalCompanyName
    );

const getRentalGroupName = (tx: MaterialTransaction): string => {
    const rentalCompanyName = getRentalCompanyName(tx);
    if (rentalCompanyName) return rentalCompanyName;

    if (tx.type === 'inbound') {
        return getCounterparty(tx) || UNASSIGNED_RENTAL_COMPANY;
    }

    return UNASSIGNED_RENTAL_COMPANY;
};

const buildRentalScopeSites = (transactions: MaterialTransaction[]): Site[] => {
    const sitesById = new Map<string, Site>();
    transactions.forEach((transaction) => {
        const id = trimText(transaction.siteId);
        if (!id || sitesById.has(id)) return;
        sitesById.set(id, {
            id,
            code: id,
            name: trimText(transaction.siteName) || '미지정 현장',
            status: 'active',
        } as Site);
    });
    return Array.from(sitesById.values());
};

const getRentalRowText = (tx: MaterialTransaction): string => {
    const rentalCompanyName = getRentalCompanyName(tx);
    if (rentalCompanyName) return rentalCompanyName;
    if (tx.type === 'inbound') return getCounterparty(tx) || '-';
    return '-';
};

const compareRentalCompanyNames = (a: string, b: string): number => {
    const aUnassigned = a === UNASSIGNED_RENTAL_COMPANY;
    const bUnassigned = b === UNASSIGNED_RENTAL_COMPANY;
    if (aUnassigned !== bUnassigned) return aUnassigned ? 1 : -1;
    return COLLATOR.compare(a, b);
};

const transactionCompare = (a: MaterialTransaction, b: MaterialTransaction): number => {
    const rentalCompare = compareRentalCompanyNames(getRentalGroupName(a), getRentalGroupName(b));
    if (rentalCompare !== 0) return rentalCompare;

    const siteCompare = COLLATOR.compare(trimText(a.siteName), trimText(b.siteName));
    if (siteCompare !== 0) return siteCompare;

    const dateCompare = trimText(b.transactionDate).localeCompare(trimText(a.transactionDate));
    if (dateCompare !== 0) return dateCompare;

    if (a.type !== b.type) return a.type === 'inbound' ? -1 : 1;

    return compareMaterialDisplayRows(a, b);
};

const getDateGroupKey = (siteGroupKey: string, date: string): string =>
    `${siteGroupKey}::date::${date}`;

const buildGroupedTransactions = (rows: MaterialTransaction[]): RentalCompanyGroup[] => {
    const rentalMap = new Map<string, MutableRentalCompanyGroup>();

    rows.forEach((tx) => {
        const rentalCompanyName = getRentalGroupName(tx);
        const rentalKey = `rental::${normalizeSearchText(rentalCompanyName) || 'unassigned'}`;
        const siteId = trimText(tx.siteId) || 'unknown';
        const siteName = trimText(tx.siteName) || '미지정 현장';
        const siteKey = `${rentalKey}::site::${siteId}::${siteName}`;
        const transactionDate = trimText(tx.transactionDate) || '날짜 없음';
        const dateKey = getDateGroupKey(siteKey, transactionDate);
        const quantity = toQuantity(tx.quantity);

        if (!rentalMap.has(rentalKey)) {
            rentalMap.set(rentalKey, {
                key: rentalKey,
                rentalCompanyName,
                siteMap: new Map<string, MutableSiteGroup>(),
                inboundQuantity: 0,
                outboundQuantity: 0,
                count: 0,
            });
        }

        const rentalGroup = rentalMap.get(rentalKey)!;
        if (!rentalGroup.siteMap.has(siteKey)) {
            rentalGroup.siteMap.set(siteKey, {
                key: siteKey,
                siteId,
                siteName,
                siteStatusLabel: tx.siteStatusLabel || getSiteStatusLabel(tx.siteStatus),
                dateMap: new Map<string, DateGroup>(),
                inboundQuantity: 0,
                outboundQuantity: 0,
                count: 0,
            });
        }

        const siteGroup = rentalGroup.siteMap.get(siteKey)!;
        if (!siteGroup.dateMap.has(dateKey)) {
            siteGroup.dateMap.set(dateKey, {
                key: dateKey,
                date: transactionDate,
                rows: [],
                inboundQuantity: 0,
                outboundQuantity: 0,
                count: 0,
            });
        }

        const dateGroup = siteGroup.dateMap.get(dateKey)!;
        dateGroup.rows.push(tx);
        dateGroup.count += 1;
        siteGroup.count += 1;
        rentalGroup.count += 1;

        if (tx.type === 'inbound') {
            dateGroup.inboundQuantity += quantity;
            siteGroup.inboundQuantity += quantity;
            rentalGroup.inboundQuantity += quantity;
        } else {
            dateGroup.outboundQuantity += quantity;
            siteGroup.outboundQuantity += quantity;
            rentalGroup.outboundQuantity += quantity;
        }
    });

    return Array.from(rentalMap.values())
        .map((rentalGroup) => ({
            key: rentalGroup.key,
            rentalCompanyName: rentalGroup.rentalCompanyName,
            inboundQuantity: rentalGroup.inboundQuantity,
            outboundQuantity: rentalGroup.outboundQuantity,
            count: rentalGroup.count,
            siteGroups: Array.from(rentalGroup.siteMap.values())
                .map((siteGroup) => ({
                    key: siteGroup.key,
                    siteId: siteGroup.siteId,
                    siteName: siteGroup.siteName,
                    siteStatusLabel: siteGroup.siteStatusLabel,
                    inboundQuantity: siteGroup.inboundQuantity,
                    outboundQuantity: siteGroup.outboundQuantity,
                    count: siteGroup.count,
                    dateGroups: Array.from(siteGroup.dateMap.values())
                        .map((dateGroup) => ({
                            ...dateGroup,
                            rows: [...dateGroup.rows].sort(transactionCompare),
                        }))
                        .sort((a, b) => b.date.localeCompare(a.date)),
                }))
                .sort((a, b) => COLLATOR.compare(a.siteName, b.siteName)),
        }))
        .sort((a, b) => compareRentalCompanyNames(a.rentalCompanyName, b.rentalCompanyName));
};

const StatCard: React.FC<{
    label: string;
    value: string;
    icon: any;
    tone: string;
}> = ({ label, value, icon, tone }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                <div className="text-xs font-bold text-slate-400">{label}</div>
                <div className="mt-1 truncate text-2xl font-black text-slate-900">{value}</div>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <FontAwesomeIcon icon={icon} />
            </div>
        </div>
    </div>
);

const GroupSummary: React.FC<{
    count: number;
    inboundQuantity: number;
    outboundQuantity: number;
}> = ({ count, inboundQuantity, outboundQuantity }) => (
    <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
        <span>{NUMBER_FORMATTER.format(count)}건</span>
        <span className="text-emerald-700">입고 {formatQuantity(inboundQuantity)}</span>
        <span className="text-orange-700">출고 {formatQuantity(outboundQuantity)}</span>
    </div>
);

const MaterialTransactionsBySiteDatePage: React.FC = () => {
    const navigate = useNavigate();
    const companyAccessScope = useCompanyDataScope();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [transactions, setTransactions] = useState<MaterialTransaction[]>([]);

    const [siteStatusFilter, setSiteStatusFilter] = useState<MaterialSiteStatusFilter>('active');
    const [siteId, setSiteId] = useState('');
    const [rentalKeyword, setRentalKeyword] = useState('');
    const [siteKeyword, setSiteKeyword] = useState('');
    const [startDate, setStartDate] = useState(getMonthStartText);
    const [endDate, setEndDate] = useState(getTodayText);
    const [transactionType, setTransactionType] = useState<TransactionTypeFilter>('all');
    const [materialKeyword, setMaterialKeyword] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [expandedRentalKey, setExpandedRentalKey] = useState<string | null>(null);
    const [expandedSiteKey, setExpandedSiteKey] = useState<string | null>(null);
    const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
    const [photoViewer, setPhotoViewer] = useState<PhotoViewerState>(CLOSED_PHOTO_VIEWER_STATE);
    const photoRequestIdRef = React.useRef(0);
    const photoUrlResolverRef = React.useRef(createMaterialPhotoUrlResolver(
        (photoBatchId) => materialService.getMaterialPhotoDownloadUrls(photoBatchId)
    ));

    useEffect(() => {
        if (!companyAccessScope.loading) {
            void loadInitialData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyAccessScope.loading, companyAccessScope.mode, companyAccessScope.companyIds.join('|')]);

    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return undefined;

        const originalOverflow = mainContent.style.overflow;
        mainContent.style.overflow = 'hidden';
        return () => {
            mainContent.style.overflow = originalOverflow;
        };
    }, []);

    const statusFilteredSites = useMemo(
        () => filterSitesByMaterialStatus(sites, siteStatusFilter),
        [sites, siteStatusFilter]
    );

    const loadInitialData = async () => {
        setLoading(true);
        try {
            if (companyAccessScope.mode === 'blocked') {
                setSites([]);
                setTransactions([]);
                setSiteId('');
                return;
            }
            if (companyAccessScope.mode === 'rental-company') {
                setSites([]);
                await loadTransactions([]);
                return;
            }
            const siteRows = companyAccessScope.mode === 'construction-company'
                ? await siteService.getSitesByClientCompanyIds(companyAccessScope.companyIds)
                : await siteService.getSites();
            const cheongyeonSites = filterCheongyeonMaterialSites(siteRows, 'all');
            const scopedSites = companyAccessScope.mode === 'construction-company'
                ? cheongyeonSites.filter((site) => companyDataScopeMatchesClientSite(companyAccessScope, site))
                : cheongyeonSites;
            setSites(scopedSites);
            await loadTransactions(scopedSites);
        } catch (err) {
            console.error('Failed to load material rental-site-date transactions:', err);
            setError('현장 및 입출고 내역을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async (siteRows: Site[] = sites) => {
        if (startDate && endDate && startDate > endDate) {
            alert('시작일은 종료일보다 늦을 수 없습니다.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            if (companyAccessScope.mode === 'blocked') {
                setSites([]);
                setTransactions([]);
                setSiteId('');
                return;
            }
            const filters: TransactionFilters = {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                siteId: siteId || undefined,
                rentalCompanyIds: companyAccessScope.mode === 'rental-company'
                    ? companyAccessScope.companyIds
                    : undefined,
                siteIds: companyAccessScope.mode === 'construction-company'
                    ? siteRows
                        .map((site) => site.id)
                        .filter((siteId): siteId is string => Boolean(siteId))
                    : undefined,
            };

            const [inboundRows, outboundRows] = await Promise.all([
                materialService.getInboundTransactions(filters),
                materialService.getOutboundTransactions(filters),
            ]);

            const scopedTransactions = [
                ...inboundRows.map((row) => ({ ...row, type: 'inbound' as const })),
                ...outboundRows.map((row) => ({ ...row, type: 'outbound' as const })),
            ].filter((tx) => companyDataScopeMatchesMaterialTransaction(companyAccessScope, tx));

            const visibleScopeSites = companyAccessScope.mode === 'rental-company'
                ? buildRentalScopeSites(scopedTransactions)
                : siteRows;
            if (companyAccessScope.mode === 'rental-company') {
                setSites(visibleScopeSites);
                if (siteId && !visibleScopeSites.some((site) => site.id === siteId)) setSiteId('');
            }

            const allowedSites = filterSitesByMaterialStatus(visibleScopeSites, siteStatusFilter);
            const allowedSiteIds = createSiteIdSet(allowedSites);
            const siteById = new Map(visibleScopeSites.map((site) => [site.id, site]));

            const nextRows = scopedTransactions
                .filter((tx) => allowedSiteIds.has(tx.siteId))
                .map((tx) => {
                    const site = siteById.get(tx.siteId);
                    return {
                        ...tx,
                        siteName: trimText(tx.siteName) || trimText(site?.name) || '미지정 현장',
                        siteStatus: site?.status,
                        siteStatusLabel: getSiteStatusLabel(site?.status),
                        quantity: toQuantity(tx.quantity),
                    };
                })
                .sort(transactionCompare);

            setTransactions(nextRows);
        } catch (err) {
            console.error('Failed to search material rental-site-date transactions:', err);
            setError('입출고 내역을 조회하는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const visibleTransactions = useMemo(() => {
        const rentalKeywordText = normalizeSearchText(rentalKeyword);
        const siteKeywordText = normalizeSearchText(siteKeyword);
        const materialKeywordText = normalizeSearchText(materialKeyword);
        const vehicleKeywordText = normalizeSearchText(vehicleNumber);

        return transactions
            .filter((tx) => {
                if (transactionType !== 'all' && tx.type !== transactionType) return false;
                if (siteId && tx.siteId !== siteId) return false;
                if (rentalKeywordText && !normalizeSearchText(getRentalGroupName(tx)).includes(rentalKeywordText)) return false;
                if (siteKeywordText && !normalizeSearchText(tx.siteName).includes(siteKeywordText)) return false;
                if (vehicleKeywordText && !normalizeSearchText(tx.vehicleNumber).includes(vehicleKeywordText)) return false;

                if (materialKeywordText) {
                    const searchText = [
                        tx.category,
                        tx.itemName,
                        tx.spec,
                        tx.notes,
                        getCounterparty(tx),
                        getRentalGroupName(tx),
                    ].map(normalizeSearchText).join(' ');
                    if (!searchText.includes(materialKeywordText)) return false;
                }

                return true;
            })
            .sort(transactionCompare);
    }, [materialKeyword, rentalKeyword, siteId, siteKeyword, transactionType, transactions, vehicleNumber]);

    const groupedTransactions = useMemo(
        () => buildGroupedTransactions(visibleTransactions),
        [visibleTransactions]
    );

    useEffect(() => {
        const rentalKeys = new Set(groupedTransactions.map((group) => group.key));
        const siteKeys = new Set(groupedTransactions.flatMap((group) => group.siteGroups.map((siteGroup) => siteGroup.key)));
        const dateKeys = new Set(groupedTransactions.flatMap((group) =>
            group.siteGroups.flatMap((siteGroup) => siteGroup.dateGroups.map((dateGroup) => dateGroup.key))
        ));

        setExpandedRentalKey((current) => current && rentalKeys.has(current) ? current : null);
        setExpandedSiteKey((current) => current && siteKeys.has(current) ? current : null);
        setExpandedDateKey((current) => current && dateKeys.has(current) ? current : null);
    }, [groupedTransactions]);

    const stats = useMemo(() => {
        const rentalKeys = new Set<string>();
        const siteKeys = new Set<string>();
        const dates = new Set<string>();
        let inboundQuantity = 0;
        let outboundQuantity = 0;

        visibleTransactions.forEach((tx) => {
            rentalKeys.add(getRentalGroupName(tx));
            siteKeys.add(trimText(tx.siteId) || trimText(tx.siteName));
            dates.add(trimText(tx.transactionDate));
            if (tx.type === 'inbound') inboundQuantity += toQuantity(tx.quantity);
            else outboundQuantity += toQuantity(tx.quantity);
        });

        return {
            count: visibleTransactions.length,
            rentalCount: rentalKeys.size,
            siteCount: siteKeys.size,
            dateCount: dates.size,
            inboundQuantity,
            outboundQuantity,
        };
    }, [visibleTransactions]);

    const toggleRentalGroup = (key: string) => {
        setExpandedRentalKey((current) => current === key ? null : key);
        setExpandedSiteKey(null);
        setExpandedDateKey(null);
    };

    const toggleSiteGroup = (key: string) => {
        setExpandedSiteKey((current) => current === key ? null : key);
        setExpandedDateKey(null);
    };

    const toggleDateGroup = (key: string) => {
        setExpandedDateKey((current) => current === key ? null : key);
    };

    const collapseAll = () => {
        setExpandedRentalKey(null);
        setExpandedSiteKey(null);
        setExpandedDateKey(null);
    };

    const closePhotoViewer = () => {
        photoRequestIdRef.current += 1;
        setPhotoViewer(CLOSED_PHOTO_VIEWER_STATE);
    };

    const openPhotoViewer = async (tx: MaterialTransaction) => {
        const requestId = photoRequestIdRef.current + 1;
        photoRequestIdRef.current = requestId;

        setPhotoViewer({
            isOpen: true,
            title: `${tx.transactionDate} · ${tx.siteName || '미지정 현장'} · ${tx.itemName || '자재'}`,
            expectedCount: getMaterialPhotoDisplayCount(tx),
            urls: [],
            loading: true,
            error: '',
        });

        try {
            const urls = await photoUrlResolverRef.current.resolve(tx);
            if (photoRequestIdRef.current !== requestId) return;

            setPhotoViewer((current) => ({ ...current, urls, loading: false }));
        } catch (error) {
            if (photoRequestIdRef.current !== requestId) return;

            const errorCode = typeof error === 'object' && error && 'code' in error
                ? String((error as { code?: unknown }).code || '')
                : '';
            const permissionDenied = /unauthorized|permission-denied/i.test(errorCode);
            setPhotoViewer((current) => ({
                ...current,
                loading: false,
                error: permissionDenied
                    ? '첨부 사진을 볼 권한이 없습니다. 관리자에게 Firebase Storage 읽기 권한을 확인해 달라고 요청해 주세요.'
                    : '사진을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
            }));
        }
    };

    const handleDownloadExcel = () => {
        if (visibleTransactions.length === 0) {
            alert('다운로드할 입출고 내역이 없습니다.');
            return;
        }

        const headers = [
            '임대사',
            '현장',
            '현장구분',
            '일자',
            '구분',
            '분류',
            '품명',
            '규격',
            '입고',
            '출고',
            '단위',
            '차량번호',
            '입고처/출고자',
            '비고',
        ];

        const rows: ExcelCellValue[][] = [
            headers,
            ...groupedTransactions.flatMap((rentalGroup) =>
                rentalGroup.siteGroups.flatMap((siteGroup) =>
                    siteGroup.dateGroups.flatMap((dateGroup) =>
                        dateGroup.rows.map((tx) => [
                            rentalGroup.rentalCompanyName,
                            siteGroup.siteName,
                            siteGroup.siteStatusLabel,
                            dateGroup.date,
                            tx.type === 'inbound' ? '입고' : '출고',
                            tx.category || '',
                            tx.itemName || '',
                            tx.spec || '',
                            tx.type === 'inbound' ? toQuantity(tx.quantity) : '',
                            tx.type === 'outbound' ? toQuantity(tx.quantity) : '',
                            tx.unit || '',
                            tx.vehicleNumber || '',
                            getCounterparty(tx),
                            tx.notes || '',
                        ])
                    )
                )
            ),
        ];

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 24 },
            { wch: 26 },
            { wch: 10 },
            { wch: 12 },
            { wch: 8 },
            { wch: 16 },
            { wch: 22 },
            { wch: 18 },
            { wch: 10 },
            { wch: 10 },
            { wch: 8 },
            { wch: 16 },
            { wch: 20 },
            { wch: 34 },
        ];
        ws['!autofilter'] = {
            ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(rows.length, 1)}`,
        };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '임대사현장일자별입출고');
        XLSX.writeFile(
            wb,
            `${sanitizeExcelFileName(`임대사현장일자별입출고_${startDate || '전체'}_${endDate || '전체'}`)}.xlsx`
        );
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col p-6 max-w-[2200px] w-full mx-auto bg-slate-50 overflow-hidden font-sans">
            <div className="mb-6 flex flex-col gap-4 flex-shrink-0 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                        <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" />
                        임대사·현장·날짜별 입출고 내역
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {companyAccessScope.mode !== 'all' && (
                            <span className={`mr-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-bold ${companyAccessScope.mode === 'blocked'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
                                <FontAwesomeIcon icon={faFilter} />
                                데이터 범위: {companyAccessScope.label}
                            </span>
                        )}
                        임대사별로 먼저 묶고, 현장과 거래일자 순서로 입고와 출고 흐름을 확인합니다.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {companyAccessScope.mode === 'all' && (
                    <button
                        type="button"
                        onClick={() => navigate('/materials/transactions')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faClipboardList} />
                        전체 내역
                    </button>
                    )}
                    <button
                        type="button"
                        onClick={() => loadTransactions()}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faRotate} spin={loading} />
                        새로고침
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        Excel 다운로드
                    </button>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 flex-shrink-0 sm:grid-cols-2 xl:grid-cols-6">
                <StatCard label="조회 건수" value={`${NUMBER_FORMATTER.format(stats.count)}건`} icon={faClipboardList} tone="bg-slate-100 text-slate-700" />
                <StatCard label="임대사 수" value={`${NUMBER_FORMATTER.format(stats.rentalCount)}곳`} icon={faWarehouse} tone="bg-violet-50 text-violet-700" />
                <StatCard label="현장 수" value={`${NUMBER_FORMATTER.format(stats.siteCount)}곳`} icon={faBuilding} tone="bg-indigo-50 text-indigo-700" />
                <StatCard label="거래일 수" value={`${NUMBER_FORMATTER.format(stats.dateCount)}일`} icon={faCalendar} tone="bg-cyan-50 text-cyan-700" />
                <StatCard label="입고 수량" value={formatQuantity(stats.inboundQuantity)} icon={faArrowDown} tone="bg-emerald-50 text-emerald-700" />
                <StatCard label="출고 수량" value={formatQuantity(stats.outboundQuantity)} icon={faArrowUp} tone="bg-orange-50 text-orange-700" />
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex-shrink-0">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-10">
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">현장구분</label>
                        <select
                            value={siteStatusFilter}
                            onChange={(event) => {
                                setSiteStatusFilter(event.target.value as MaterialSiteStatusFilter);
                                setSiteId('');
                                setTransactions([]);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="active">진행현장</option>
                            <option value="completed">마감현장</option>
                            <option value="all">전체현장</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">현장</label>
                        <select
                            value={siteId}
                            onChange={(event) => setSiteId(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">전체 현장</option>
                            {statusFilteredSites.map((site) => (
                                <option key={site.id} value={site.id}>[{getSiteStatusLabel(site.status)}] {site.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">시작일</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">종료일</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">구분</label>
                        <select
                            value={transactionType}
                            onChange={(event) => setTransactionType(event.target.value as TransactionTypeFilter)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="all">전체</option>
                            <option value="inbound">입고</option>
                            <option value="outbound">출고</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">임대사 검색</label>
                        <input
                            type="text"
                            value={rentalKeyword}
                            onChange={(event) => setRentalKeyword(event.target.value)}
                            disabled={companyAccessScope.mode === 'rental-company' || companyAccessScope.mode === 'blocked'}
                            placeholder="임대사"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">현장명 검색</label>
                        <input
                            type="text"
                            value={siteKeyword}
                            onChange={(event) => setSiteKeyword(event.target.value)}
                            placeholder="현장명"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">자재 검색</label>
                        <input
                            type="text"
                            value={materialKeyword}
                            onChange={(event) => setMaterialKeyword(event.target.value)}
                            placeholder="품명/규격"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">차량번호</label>
                        <input
                            type="text"
                            value={vehicleNumber}
                            onChange={(event) => setVehicleNumber(event.target.value)}
                            placeholder="차량번호"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() => loadTransactions()}
                            disabled={loading}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            {loading ? '조회 중...' : '조회'}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {error}
                </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                            <FontAwesomeIcon icon={faWarehouse} className="text-indigo-500" />
                            임대사별 거래 묶음
                        </div>
                        <div className="mt-0.5 text-xs font-bold text-slate-500">
                            {startDate || '전체'} ~ {endDate || '전체'} · 임대사 → 현장 → 날짜 순
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                            모두 접기
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-1 items-center justify-center p-20 text-center text-slate-500">
                        <div>
                            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                            <p className="font-semibold">입출고 내역을 불러오는 중입니다.</p>
                        </div>
                    </div>
                ) : visibleTransactions.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center p-20 text-center text-slate-500">
                        <div>
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                                <FontAwesomeIcon icon={faFilter} className="text-3xl text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">조회된 입출고 내역이 없습니다</h3>
                            <p className="mt-1 text-sm text-slate-500">기간, 임대사, 현장, 자재 조건을 조정해서 다시 조회해 주세요.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-4 min-h-[760px] max-h-[calc(100vh-320px)]">
                        <div className="space-y-3">
                            {groupedTransactions.map((rentalGroup) => {
                                const rentalExpanded = expandedRentalKey === rentalGroup.key;
                                const dateCount = rentalGroup.siteGroups.reduce((sum, siteGroup) => sum + siteGroup.dateGroups.length, 0);
                                return (
                                    <section key={rentalGroup.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                        <button
                                            type="button"
                                            onClick={() => toggleRentalGroup(rentalGroup.key)}
                                            className="flex w-full items-center justify-between gap-4 bg-indigo-50 px-4 py-3 text-left hover:bg-indigo-100"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <FontAwesomeIcon icon={rentalExpanded ? faChevronDown : faChevronRight} className="shrink-0 text-indigo-600" />
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600">
                                                    <FontAwesomeIcon icon={faWarehouse} />
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="truncate text-base font-black text-indigo-950">{rentalGroup.rentalCompanyName}</div>
                                                    <div className="mt-0.5 text-xs font-bold text-indigo-700">
                                                        현장 {NUMBER_FORMATTER.format(rentalGroup.siteGroups.length)}곳 · 날짜 {NUMBER_FORMATTER.format(dateCount)}일
                                                    </div>
                                                </div>
                                            </div>
                                            <GroupSummary
                                                count={rentalGroup.count}
                                                inboundQuantity={rentalGroup.inboundQuantity}
                                                outboundQuantity={rentalGroup.outboundQuantity}
                                            />
                                        </button>

                                        {rentalExpanded && (
                                            <div className="space-y-3 border-t border-indigo-100 p-3">
                                                {rentalGroup.siteGroups.map((siteGroup) => {
                                                    const siteExpanded = expandedSiteKey === siteGroup.key;
                                                    return (
                                                        <section key={siteGroup.key} className="overflow-hidden rounded-lg border border-slate-200">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSiteGroup(siteGroup.key)}
                                                                className="flex w-full items-center justify-between gap-4 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                                                            >
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <FontAwesomeIcon icon={siteExpanded ? faChevronDown : faChevronRight} className="shrink-0 text-slate-500" />
                                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600">
                                                                        <FontAwesomeIcon icon={faBuilding} />
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <div className="flex min-w-0 items-center gap-2">
                                                                            <span className="truncate font-black text-slate-900">{siteGroup.siteName}</span>
                                                                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                                                                                {siteGroup.siteStatusLabel}
                                                                            </span>
                                                                        </div>
                                                                        <div className="mt-0.5 text-xs font-bold text-slate-500">
                                                                            날짜 {NUMBER_FORMATTER.format(siteGroup.dateGroups.length)}일
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <GroupSummary
                                                                    count={siteGroup.count}
                                                                    inboundQuantity={siteGroup.inboundQuantity}
                                                                    outboundQuantity={siteGroup.outboundQuantity}
                                                                />
                                                            </button>

                                                            {siteExpanded && (
                                                                <div className="space-y-2 border-t border-slate-200 bg-white p-3">
                                                                    {siteGroup.dateGroups.map((dateGroup) => {
                                                                        const dateExpanded = expandedDateKey === dateGroup.key;
                                                                        return (
                                                                            <section key={dateGroup.key} className="overflow-hidden rounded-lg border border-slate-100">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleDateGroup(dateGroup.key)}
                                                                                    className="flex w-full items-center justify-between gap-4 bg-white px-4 py-2.5 text-left hover:bg-slate-50"
                                                                                >
                                                                                    <div className="flex min-w-0 items-center gap-3">
                                                                                        <FontAwesomeIcon icon={dateExpanded ? faChevronDown : faChevronRight} className="shrink-0 text-slate-400" />
                                                                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
                                                                                            <FontAwesomeIcon icon={faCalendar} />
                                                                                        </span>
                                                                                        <span className="font-black text-slate-800">{dateGroup.date}</span>
                                                                                    </div>
                                                                                    <GroupSummary
                                                                                        count={dateGroup.count}
                                                                                        inboundQuantity={dateGroup.inboundQuantity}
                                                                                        outboundQuantity={dateGroup.outboundQuantity}
                                                                                    />
                                                                                </button>

                                                                                {dateExpanded && (
                                                                                    <div className="overflow-auto border-t border-slate-100">
                                                                                        <table className="w-full min-w-[1480px] text-sm">
                                                                                            <thead className="bg-slate-50 text-xs font-black text-slate-500">
                                                                                                <tr>
                                                                                                    <th className="px-4 py-3 text-center">구분</th>
                                                                                                    <th className="px-4 py-3 text-left">품명</th>
                                                                                                    <th className="px-4 py-3 text-left">규격</th>
                                                                                                    <th className="px-4 py-3 text-right">입고</th>
                                                                                                    <th className="px-4 py-3 text-right">출고</th>
                                                                                                    <th className="px-4 py-3 text-center">단위</th>
                                                                                                    <th className="px-4 py-3 text-left">차량번호</th>
                                                                                                    <th className="px-4 py-3 text-left">입고처/출고자</th>
                                                                                                    <th className="px-4 py-3 text-left">임대사</th>
                                                                                                    <th className="px-4 py-3 text-center">사진</th>
                                                                                                    <th className="px-4 py-3 text-left">비고</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-slate-100">
                                                                                                {dateGroup.rows.map((tx) => (
                                                                                                    <tr key={`${tx.type}-${tx.id}`} className="hover:bg-slate-50">
                                                                                                        <td className="px-4 py-2.5 text-center">
                                                                                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${
                                                                                                                tx.type === 'inbound'
                                                                                                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                                                                                                    : 'border-orange-100 bg-orange-50 text-orange-700'
                                                                                                            }`}>
                                                                                                                <FontAwesomeIcon icon={tx.type === 'inbound' ? faArrowDown : faArrowUp} />
                                                                                                                {tx.type === 'inbound' ? '입고' : '출고'}
                                                                                                            </span>
                                                                                                        </td>
                                                                                                        <td className="px-4 py-2.5 font-bold text-slate-900">{tx.itemName || '-'}</td>
                                                                                                        <td className="px-4 py-2.5 text-slate-600">{tx.spec || '-'}</td>
                                                                                                        <td className="px-4 py-2.5 text-right font-black text-emerald-700">
                                                                                                            {tx.type === 'inbound' ? formatQuantity(tx.quantity) : '-'}
                                                                                                        </td>
                                                                                                        <td className="px-4 py-2.5 text-right font-black text-orange-700">
                                                                                                            {tx.type === 'outbound' ? formatQuantity(tx.quantity) : '-'}
                                                                                                        </td>
                                                                                                        <td className="px-4 py-2.5 text-center text-slate-500">{tx.unit || '-'}</td>
                                                                                                        <td className="px-4 py-2.5 text-slate-600">
                                                                                                            {trimText(tx.vehicleNumber) ? (
                                                                                                                <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-600">
                                                                                                                    <FontAwesomeIcon icon={faTruck} className="text-slate-400" />
                                                                                                                    {trimText(tx.vehicleNumber)}
                                                                                                                </span>
                                                                                                            ) : (
                                                                                                                <span className="text-slate-300">-</span>
                                                                                                            )}
                                                                                                        </td>
                                                                                                        <td className="px-4 py-2.5 text-slate-600">{getCounterparty(tx) || '-'}</td>
                                                                                                        <td className="px-4 py-2.5 text-slate-600">{getRentalRowText(tx)}</td>
                                                                                                        <td className="px-4 py-2.5 text-center">
                                                                                                            {hasMaterialPhotoReference(tx) ? (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={() => openPhotoViewer(tx)}
                                                                                                                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
                                                                                                                    title="첨부 사진 보기"
                                                                                                                >
                                                                                                                    <FontAwesomeIcon icon={faImages} />
                                                                                                                    {getMaterialPhotoDisplayCount(tx) === null
                                                                                                                        ? '사진 확인'
                                                                                                                        : `사진 ${getMaterialPhotoDisplayCount(tx)}장`}
                                                                                                                </button>
                                                                                                            ) : (
                                                                                                                <span className="text-slate-300">-</span>
                                                                                                            )}
                                                                                                        </td>
                                                                                                        <td className="max-w-md whitespace-pre-wrap break-words px-4 py-2.5 text-slate-500">
                                                                                                            {tx.notes || '-'}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                )}
                                                                            </section>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </section>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-right text-xs font-bold text-slate-500">
                    Total {NUMBER_FORMATTER.format(visibleTransactions.length)} records
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
        </div>
    );
};

export default MaterialTransactionsBySiteDatePage;
