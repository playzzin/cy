import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalculator,
    faCheckCircle,
    faChevronRight,
    faClock,
    faFileExcel,
    faFloppyDisk,
    faMagnifyingGlass,
    faPaperPlane,
    faPlus,
    faPrint,
    faTimesCircle,
    faTrash
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import {
    estimateService,
    Estimate,
    EstimateItem,
    EstimateStatus
} from '../../services/estimateService';
import { companyFirestoreService } from '../../services/companyFirestoreService';
import { CompanyZod } from '../../types/zod/companySchema';
import {
    createItem,
    EstimateDraft,
    formatCurrency,
    getEmptyDraft,
    LOGO_FALLBACK,
    PRINT_STYLES
} from '../../utils/estimateUtils';
import {
    AmountBarComponent,
    InfoTableComponent,
    TitleComponent
} from '../../components/estimate/EstimateSharedComponents';
import { downloadEstimateExcel } from '../../utils/estimateExcelUtils';

type DecRateType = 'real' | 'install';
type DecPType = '2p' | '3p' | '4p';
type DetailProduct = '계단타워' | '작업발판' | '안전통로' | '브라켓';
type MeasureProduct = '' | DetailProduct;
type UnitMode = 'SET' | 'EA';

type RcRow = {
    id: string;
    section: string;
    height: number;
    volume: number;
    points: number;
    basePrice: number;
};

type DecRow = {
    id: string;
    section: string;
    type: DecRateType;
    height: number;
    pType: DecPType;
    volume: number;
};

type HebeRow = {
    id: string;
    section: string;
    itemName: MeasureProduct;
    length: number;
    height: number;
    count: number;
    unitPrice: number;
};

type RubeRow = {
    id: string;
    section: string;
    itemName: MeasureProduct;
    length: number;
    width: number;
    height: number;
    count: number;
    unitPrice: number;
};

type SetEaRow = {
    id: string;
    itemName: DetailProduct;
    unitMode: UnitMode;
    quantity: number;
    unitPrice: number;
    note: string;
};

const HEIGHT_OPTIONS = [6, 8, 10, 12, 14, 16, 18, 20, 22] as const;
const DETAIL_PRODUCTS: DetailProduct[] = ['계단타워', '작업발판', '안전통로', '브라켓'];

const HEIGHT_MULTIPLIERS: Record<number, number> = {
    6: 1.0,
    8: 1.2,
    10: 1.5,
    12: 1.8,
    14: 2.0,
    16: 2.2,
    18: 2.5,
    20: 2.8,
    22: 3.0
};

const DEC_BASE_RATES: Record<DecRateType, Record<DecPType, number>> = {
    real: { '2p': 8000, '3p': 11200, '4p': 13600 },
    install: { '2p': 8000, '3p': 7000, '4p': 6000 }
};

const STATUS_CONFIG: Record<EstimateStatus, { label: string; color: string; bg: string; icon: any }> = {
    draft: { label: '대기', color: 'text-slate-600', bg: 'bg-slate-100', icon: faClock },
    sent: { label: '발송', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: faPaperPlane },
    approved: { label: '확정', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: faCheckCircle },
    rejected: { label: '반려', color: 'text-rose-600', bg: 'bg-rose-100', icon: faTimesCircle }
};

const DEFAULT_SCOPE_NOTES = `- 본 문서는 RC/DEC, 헤베, 루베, SET/EA 상세 산출 기준 견적서입니다.
- RC/DEC 각 구간별 합계를 먼저 산출한 뒤 총액을 계산합니다.
- 헤베는 길이 × 높이 × 수량으로 m2 물량을 산출합니다.
- 루베는 길이 × 폭 × 높이 × 수량으로 m3 물량을 산출합니다.
- SET/EA는 계단타워, 작업발판, 안전통로, 브라켓 품목별 수량 × 단가로 산출합니다.
- 높이계수/기준단가/포인트/물량 변경 시 금액은 자동 계산됩니다.
- 공급가액 = RC 합계 + DEC 합계 + 헤베 합계 + 루베 합계 + SET/EA 합계
- VAT = max(공급가액 - 할인, 0) × VAT율
- 총액 = max(공급가액 - 할인, 0) + VAT`;

const createRowId = (prefix: 'rc' | 'dec' | 'hebe' | 'rube' | 'unit'): string =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const normalizeHeight = (value: unknown): number => {
    const parsed = toNumber(value, HEIGHT_OPTIONS[0]);
    return HEIGHT_OPTIONS.includes(parsed as (typeof HEIGHT_OPTIONS)[number])
        ? parsed
        : HEIGHT_OPTIONS[0];
};

const normalizeDetailProduct = (value: unknown, fallback: DetailProduct = '계단타워'): DetailProduct => {
    return DETAIL_PRODUCTS.includes(value as DetailProduct) ? (value as DetailProduct) : fallback;
};

const normalizeMeasureProduct = (value: unknown, fallback: MeasureProduct = ''): MeasureProduct => {
    if (value === '') return '';
    return DETAIL_PRODUCTS.includes(value as DetailProduct) ? (value as DetailProduct) : fallback;
};

const normalizeUnitMode = (value: unknown): UnitMode => (String(value).toUpperCase() === 'EA' ? 'EA' : 'SET');

const getDefaultRcRows = (): RcRow[] => [
    {
        id: createRowId('rc'),
        section: 'RC 1구간',
        height: 6,
        volume: 7800,
        points: 3000,
        basePrice: 13000
    }
];

const getDefaultDecRows = (): DecRow[] => [
    {
        id: createRowId('dec'),
        section: 'DEC A구간',
        type: 'real',
        height: 6,
        pType: '3p',
        volume: 1000
    }
];

const getDefaultHebeRows = (): HebeRow[] => [
    {
        id: createRowId('hebe'),
        section: '헤베 A구간',
        itemName: '',
        length: 0,
        height: 0,
        count: 1,
        unitPrice: 0
    }
];

const getDefaultRubeRows = (): RubeRow[] => [
    {
        id: createRowId('rube'),
        section: '루베 A구간',
        itemName: '',
        length: 0,
        width: 0,
        height: 0,
        count: 1,
        unitPrice: 0
    }
];

const getDefaultSetEaRows = (): SetEaRow[] =>
    DETAIL_PRODUCTS.map((itemName) => ({
        id: createRowId('unit'),
        itemName,
        unitMode: itemName === '브라켓' ? 'EA' : 'SET',
        quantity: 0,
        unitPrice: 0,
        note: ''
    }));

const getEmptyDetailedDraft = (): EstimateDraft => {
    const base = getEmptyDraft('estimate');
    return {
        ...base,
        title: '상세 견적서',
        notes: 'RC/DEC/헤베/루베/SET-EA 상세 산출',
        items: [],
        estimateMode: 'standard',
        scopeNotes: DEFAULT_SCOPE_NOTES
    };
};

const parseRowsFromItems = (
    items: EstimateItem[]
): { rcRows: RcRow[]; decRows: DecRow[]; hebeRows: HebeRow[]; rubeRows: RubeRow[]; setEaRows: SetEaRow[] } => {
    const rcRows = items
        .filter((item) => item.category === 'RC' || item.workType === 'rc')
        .map<RcRow>((item) => ({
            id: item.id || createRowId('rc'),
            section: item.section || item.label || '',
            height: normalizeHeight(item.height),
            volume: toNumber(item.quantity),
            points: toNumber(item.point),
            basePrice: toNumber(item.pointBase, 13000)
        }));

    const decRows = items
        .filter(
            (item) =>
                item.category === 'DEC' ||
                item.workType === 'real' ||
                item.workType === 'install'
        )
        .map<DecRow>((item) => {
            const pType = (item.unit || '').toLowerCase();
            return {
                id: item.id || createRowId('dec'),
                section: item.section || item.label || '',
                type: item.workType === 'install' ? 'install' : 'real',
                height: normalizeHeight(item.height),
                pType: pType === '2p' || pType === '3p' || pType === '4p' ? pType : '2p',
                volume: toNumber(item.quantity)
            };
        });

    const hebeRows = items
        .filter(
            (item) =>
                item.category === '헤베' ||
                item.workType === 'hebe' ||
                item.calculationType === 'hebe'
        )
        .map<HebeRow>((item) => ({
            id: item.id || createRowId('hebe'),
            section: item.section || '',
            itemName: normalizeMeasureProduct(item.description || item.label || item.section),
            length: toNumber(item.length),
            height: toNumber(item.height),
            count: toNumber(item.count, 1),
            unitPrice: toNumber(item.unitPrice || item.finalUnitPrice)
        }));

    const rubeRows = items
        .filter(
            (item) =>
                item.category === '루베' ||
                item.workType === 'rube' ||
                item.calculationType === 'rube'
        )
        .map<RubeRow>((item) => ({
            id: item.id || createRowId('rube'),
            section: item.section || '',
            itemName: normalizeMeasureProduct(item.description || item.label || item.section),
            length: toNumber(item.length),
            width: toNumber(item.width),
            height: toNumber(item.height),
            count: toNumber(item.count, 1),
            unitPrice: toNumber(item.unitPrice || item.finalUnitPrice)
        }));

    const setEaRows = items
        .filter(
            (item) =>
                item.category === 'SET/EA' ||
                item.workType === 'setEa' ||
                item.calculationType === 'setEa'
        )
        .map<SetEaRow>((item) => ({
            id: item.id || createRowId('unit'),
            itemName: normalizeDetailProduct(item.description || item.label || item.section),
            unitMode: normalizeUnitMode(item.unitMode || item.unit),
            quantity: toNumber(item.quantity),
            unitPrice: toNumber(item.unitPrice || item.finalUnitPrice),
            note: item.note || ''
        }));

    return {
        rcRows: rcRows.length > 0 ? rcRows : getDefaultRcRows(),
        decRows: decRows.length > 0 ? decRows : getDefaultDecRows(),
        hebeRows: hebeRows.length > 0 ? hebeRows : getDefaultHebeRows(),
        rubeRows: rubeRows.length > 0 ? rubeRows : getDefaultRubeRows(),
        setEaRows: setEaRows.length > 0 ? setEaRows : getDefaultSetEaRows()
    };
};

const DetailedEstimateManagePage: React.FC = () => {
    const [draft, setDraft] = useState<EstimateDraft>(() => getEmptyDetailedDraft());
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [myCompany, setMyCompany] = useState<CompanyZod | null>(null);
    const [rcRows, setRcRows] = useState<RcRow[]>(() => getDefaultRcRows());
    const [decRows, setDecRows] = useState<DecRow[]>(() => getDefaultDecRows());
    const [hebeRows, setHebeRows] = useState<HebeRow[]>(() => getDefaultHebeRows());
    const [rubeRows, setRubeRows] = useState<RubeRow[]>(() => getDefaultRubeRows());
    const [setEaRows, setSetEaRows] = useState<SetEaRow[]>(() => getDefaultSetEaRows());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | EstimateStatus>('all');
    const [logoUrl, setLogoUrl] = useState<string>('');

    useEffect(() => {
        setLogoUrl(LOGO_FALLBACK);
    }, []);

    const applySupplierDefaults = (target: EstimateDraft, company: CompanyZod | null): EstimateDraft => {
        if (!company) return target;
        return {
            ...target,
            supplierCompany: company.name,
            supplierBizNo: company.businessNumber || '',
            supplierName: company.ceoName || '',
            supplierAddress: company.address || '',
            supplierContact: company.phone || '',
            supplierAccount:
                company.bankName && company.accountNumber
                    ? `${company.bankName} ${company.accountNumber}`
                    : '',
            supplierFax: company.fax || '031-509-7693'
        };
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedEstimates, fetchedCompanies] = await Promise.all([
                estimateService.getEstimates(),
                companyFirestoreService.getCompanies()
            ]);

            setEstimates(
                fetchedEstimates.filter(
                    (item) => item.documentType !== 'transaction' && item.templateType === 'detailed'
                )
            );

            const mainCompany =
                fetchedCompanies.find((company) => {
                    const normalizedName = (company.name || '').replace(/\s/g, '');
                    return normalizedName.includes('청연엔지') || normalizedName.includes('청연ENG');
                }) ||
                fetchedCompanies.find((company) => company.name.includes('청연')) ||
                fetchedCompanies.find((company) => company.isMyCompany) ||
                fetchedCompanies[0] ||
                null;

            if (mainCompany) {
                setMyCompany(mainCompany);
                setDraft((previous) => {
                    if (previous.id) return previous;
                    return applySupplierDefaults(previous, mainCompany);
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const calculatedRc = useMemo(
        () =>
            rcRows.map((row) => {
                const multiplier = HEIGHT_MULTIPLIERS[row.height] || 1;
                const pointUnitPrice = row.basePrice * multiplier;
                const totalAmount = pointUnitPrice * row.points;
                const unitPricePerM3 = row.volume > 0 ? totalAmount / row.volume : 0;
                return { ...row, multiplier, pointUnitPrice, totalAmount, unitPricePerM3 };
            }),
        [rcRows]
    );

    const calculatedDec = useMemo(
        () =>
            decRows.map((row) => {
                const multiplier = HEIGHT_MULTIPLIERS[row.height] || 1;
                const basePrice = DEC_BASE_RATES[row.type][row.pType];
                const finalUnitPrice = basePrice * multiplier;
                const totalAmount = finalUnitPrice * row.volume;
                const unitPricePerM3 = row.volume > 0 ? totalAmount / row.volume : 0;
                return { ...row, multiplier, basePrice, finalUnitPrice, totalAmount, unitPricePerM3 };
            }),
        [decRows]
    );

    const calculatedHebe = useMemo(
        () =>
            hebeRows.map((row) => {
                const area = row.length * row.height * row.count;
                const totalAmount = area * row.unitPrice;
                const unitPricePerM2 = area > 0 ? totalAmount / area : 0;
                return { ...row, area, totalAmount, unitPricePerM2 };
            }),
        [hebeRows]
    );

    const calculatedRube = useMemo(
        () =>
            rubeRows.map((row) => {
                const volume = row.length * row.width * row.height * row.count;
                const totalAmount = volume * row.unitPrice;
                const unitPricePerM3 = volume > 0 ? totalAmount / volume : 0;
                return { ...row, volume, totalAmount, unitPricePerM3 };
            }),
        [rubeRows]
    );

    const calculatedSetEa = useMemo(
        () =>
            setEaRows.map((row) => {
                const totalAmount = row.quantity * row.unitPrice;
                return { ...row, totalAmount };
            }),
        [setEaRows]
    );

    const rcTotalAmount = useMemo(
        () => calculatedRc.reduce((sum, row) => sum + row.totalAmount, 0),
        [calculatedRc]
    );
    const rcTotalVolume = useMemo(
        () => calculatedRc.reduce((sum, row) => sum + row.volume, 0),
        [calculatedRc]
    );
    const rcAverageUnitPrice = rcTotalVolume > 0 ? rcTotalAmount / rcTotalVolume : 0;

    const decTotalAmount = useMemo(
        () => calculatedDec.reduce((sum, row) => sum + row.totalAmount, 0),
        [calculatedDec]
    );
    const decTotalVolume = useMemo(
        () => calculatedDec.reduce((sum, row) => sum + row.volume, 0),
        [calculatedDec]
    );
    const decAverageUnitPrice = decTotalVolume > 0 ? decTotalAmount / decTotalVolume : 0;

    const hebeTotalAmount = useMemo(
        () => calculatedHebe.reduce((sum, row) => sum + row.totalAmount, 0),
        [calculatedHebe]
    );
    const hebeTotalArea = useMemo(
        () => calculatedHebe.reduce((sum, row) => sum + row.area, 0),
        [calculatedHebe]
    );
    const hebeAverageUnitPrice = hebeTotalArea > 0 ? hebeTotalAmount / hebeTotalArea : 0;

    const rubeTotalAmount = useMemo(
        () => calculatedRube.reduce((sum, row) => sum + row.totalAmount, 0),
        [calculatedRube]
    );
    const rubeTotalVolume = useMemo(
        () => calculatedRube.reduce((sum, row) => sum + row.volume, 0),
        [calculatedRube]
    );
    const rubeAverageUnitPrice = rubeTotalVolume > 0 ? rubeTotalAmount / rubeTotalVolume : 0;

    const setEaTotalAmount = useMemo(
        () => calculatedSetEa.reduce((sum, row) => sum + row.totalAmount, 0),
        [calculatedSetEa]
    );
    const setEaTotalQuantity = useMemo(
        () => calculatedSetEa.reduce((sum, row) => sum + row.quantity, 0),
        [calculatedSetEa]
    );

    const subtotal = rcTotalAmount + decTotalAmount + hebeTotalAmount + rubeTotalAmount + setEaTotalAmount;
    const totalM3Volume = rcTotalVolume + decTotalVolume + rubeTotalVolume;
    const averageUnitPrice = totalM3Volume > 0 ? (rcTotalAmount + decTotalAmount + rubeTotalAmount) / totalM3Volume : 0;
    const taxableBase = Math.max(0, subtotal - (draft.discount || 0));
    const vatRate = draft.vatRate || 10;
    const tax = draft.includeVat ? Math.round(taxableBase * (vatRate / 100)) : 0;
    const total = taxableBase + tax;

    const itemsWithCalc = useMemo(() => {
        const rcItems = calculatedRc.map((row, index) => {
            const item = createItem({
                category: 'RC',
                section: row.section,
                label: row.section || `RC ${index + 1}`,
                unit: 'm3',
                quantity: row.volume,
                finalUnitPrice: Math.round(row.pointUnitPrice)
            });
            return {
                ...item,
                id: row.id,
                category: 'RC',
                workType: 'rc',
                height: row.height,
                point: row.points,
                pointBase: row.basePrice,
                pointUnitPrice: Math.round(row.pointUnitPrice),
                calculatedUnitPrice: Math.round(row.pointUnitPrice),
                pointAmount: Math.round(row.totalAmount),
                finalUnitPrice: Math.round(row.pointUnitPrice),
                unitPrice: Math.round(row.pointUnitPrice),
                amount: Math.round(row.totalAmount),
                note: `${row.points.toLocaleString()}P`
            } as EstimateItem;
        });

        const decItems = calculatedDec.map((row, index) => {
            const item = createItem({
                category: 'DEC',
                section: row.section,
                label: row.section || `DEC ${index + 1}`,
                unit: row.pType,
                quantity: row.volume,
                finalUnitPrice: Math.round(row.finalUnitPrice)
            });
            return {
                ...item,
                id: row.id,
                category: 'DEC',
                workType: row.type,
                height: row.height,
                finalUnitPrice: Math.round(row.finalUnitPrice),
                unitPrice: Math.round(row.finalUnitPrice),
                amount: Math.round(row.totalAmount),
                note: `${row.pType.toUpperCase()} / ${row.type === 'real' ? '실단가' : '설치물량'}`
            } as EstimateItem;
        });

        const hebeItems = calculatedHebe.map((row, index) => {
            const label = row.itemName || `헤베 ${index + 1}`;
            const item = createItem({
                category: '헤베',
                section: row.section,
                label,
                unit: 'm2',
                quantity: row.area,
                finalUnitPrice: Math.round(row.unitPrice)
            });
            return {
                ...item,
                id: row.id,
                category: '헤베',
                section: row.section,
                label,
                description: row.itemName,
                workType: 'hebe',
                calculationType: 'hebe',
                unit: 'm2',
                length: row.length,
                height: row.height,
                count: row.count,
                quantity: row.area,
                finalUnitPrice: Math.round(row.unitPrice),
                unitPrice: Math.round(row.unitPrice),
                amount: Math.round(row.totalAmount),
                note: `${formatCurrency(row.length)}m × ${formatCurrency(row.height)}m × ${formatCurrency(row.count)}`
            } as EstimateItem;
        });

        const rubeItems = calculatedRube.map((row, index) => {
            const label = row.itemName || `루베 ${index + 1}`;
            const item = createItem({
                category: '루베',
                section: row.section,
                label,
                unit: 'm3',
                quantity: row.volume,
                finalUnitPrice: Math.round(row.unitPrice)
            });
            return {
                ...item,
                id: row.id,
                category: '루베',
                section: row.section,
                label,
                description: row.itemName,
                workType: 'rube',
                calculationType: 'rube',
                unit: 'm3',
                length: row.length,
                width: row.width,
                height: row.height,
                count: row.count,
                quantity: row.volume,
                finalUnitPrice: Math.round(row.unitPrice),
                unitPrice: Math.round(row.unitPrice),
                amount: Math.round(row.totalAmount),
                note: `${formatCurrency(row.length)}m × ${formatCurrency(row.width)}m × ${formatCurrency(row.height)}m × ${formatCurrency(row.count)}`
            } as EstimateItem;
        });

        const setEaItems = calculatedSetEa.map((row) => {
            const item = createItem({
                category: 'SET/EA',
                section: row.itemName,
                label: row.itemName,
                unit: row.unitMode,
                quantity: row.quantity,
                finalUnitPrice: Math.round(row.unitPrice)
            });
            return {
                ...item,
                id: row.id,
                category: 'SET/EA',
                section: row.itemName,
                label: row.itemName,
                description: row.itemName,
                workType: 'setEa',
                calculationType: 'setEa',
                unit: row.unitMode,
                unitMode: row.unitMode,
                quantity: row.quantity,
                finalUnitPrice: Math.round(row.unitPrice),
                unitPrice: Math.round(row.unitPrice),
                amount: Math.round(row.totalAmount),
                note: row.note
            } as EstimateItem;
        });

        return [...rcItems, ...decItems, ...hebeItems, ...rubeItems, ...setEaItems];
    }, [calculatedRc, calculatedDec, calculatedHebe, calculatedRube, calculatedSetEa]);

    const updateDraft = (field: keyof EstimateDraft, value: any) => {
        setDraft((previous) => ({ ...previous, [field]: value }));
    };

    const addRcRow = () => {
        setRcRows((previous) => [
            ...previous,
            { id: createRowId('rc'), section: '', height: 6, volume: 0, points: 0, basePrice: 13000 }
        ]);
    };

    const updateRcRow = (id: string, field: keyof Omit<RcRow, 'id'>, value: string | number) => {
        setRcRows((previous) =>
            previous.map((row) => {
                if (row.id !== id) return row;
                if (field === 'section') return { ...row, section: String(value) };
                return { ...row, [field]: toNumber(value) };
            })
        );
    };

    const removeRcRow = (id: string) => {
        setRcRows((previous) => (previous.length <= 1 ? previous : previous.filter((row) => row.id !== id)));
    };

    const addDecRow = () => {
        setDecRows((previous) => [
            ...previous,
            { id: createRowId('dec'), section: '', type: 'real', height: 6, pType: '2p', volume: 0 }
        ]);
    };

    const updateDecRow = (id: string, field: keyof Omit<DecRow, 'id'>, value: string | number) => {
        setDecRows((previous) =>
            previous.map((row) => {
                if (row.id !== id) return row;
                if (field === 'section') return { ...row, section: String(value) };
                if (field === 'type') return { ...row, type: value as DecRateType };
                if (field === 'pType') return { ...row, pType: value as DecPType };
                return { ...row, [field]: toNumber(value) };
            })
        );
    };

    const removeDecRow = (id: string) => {
        setDecRows((previous) =>
            previous.length <= 1 ? previous : previous.filter((row) => row.id !== id)
        );
    };

    const addHebeRow = () => {
        setHebeRows((previous) => [
            ...previous,
            { id: createRowId('hebe'), section: '', itemName: '', length: 0, height: 0, count: 1, unitPrice: 0 }
        ]);
    };

    const updateHebeRow = (id: string, field: keyof Omit<HebeRow, 'id'>, value: string | number) => {
        setHebeRows((previous) =>
            previous.map((row) => {
                if (row.id !== id) return row;
                if (field === 'section') return { ...row, section: String(value) };
                if (field === 'itemName') return { ...row, itemName: normalizeMeasureProduct(value, row.itemName) };
                return { ...row, [field]: toNumber(value) };
            })
        );
    };

    const removeHebeRow = (id: string) => {
        setHebeRows((previous) =>
            previous.length <= 1 ? previous : previous.filter((row) => row.id !== id)
        );
    };

    const addRubeRow = () => {
        setRubeRows((previous) => [
            ...previous,
            { id: createRowId('rube'), section: '', itemName: '', length: 0, width: 0, height: 0, count: 1, unitPrice: 0 }
        ]);
    };

    const updateRubeRow = (id: string, field: keyof Omit<RubeRow, 'id'>, value: string | number) => {
        setRubeRows((previous) =>
            previous.map((row) => {
                if (row.id !== id) return row;
                if (field === 'section') return { ...row, section: String(value) };
                if (field === 'itemName') return { ...row, itemName: normalizeMeasureProduct(value, row.itemName) };
                return { ...row, [field]: toNumber(value) };
            })
        );
    };

    const removeRubeRow = (id: string) => {
        setRubeRows((previous) =>
            previous.length <= 1 ? previous : previous.filter((row) => row.id !== id)
        );
    };

    const addSetEaRow = () => {
        setSetEaRows((previous) => [
            ...previous,
            { id: createRowId('unit'), itemName: '계단타워', unitMode: 'SET', quantity: 0, unitPrice: 0, note: '' }
        ]);
    };

    const updateSetEaRow = (id: string, field: keyof Omit<SetEaRow, 'id'>, value: string | number) => {
        setSetEaRows((previous) =>
            previous.map((row) => {
                if (row.id !== id) return row;
                if (field === 'itemName') return { ...row, itemName: normalizeDetailProduct(value, row.itemName) };
                if (field === 'unitMode') return { ...row, unitMode: normalizeUnitMode(value) };
                if (field === 'note') return { ...row, note: String(value) };
                return { ...row, [field]: toNumber(value) };
            })
        );
    };

    const removeSetEaRow = (id: string) => {
        setSetEaRows((previous) =>
            previous.length <= 1 ? previous : previous.filter((row) => row.id !== id)
        );
    };

    const resetPage = () => {
        setDraft(applySupplierDefaults(getEmptyDetailedDraft(), myCompany));
        setRcRows(getDefaultRcRows());
        setDecRows(getDefaultDecRows());
        setHebeRows(getDefaultHebeRows());
        setRubeRows(getDefaultRubeRows());
        setSetEaRows(getDefaultSetEaRows());
    };

    const saveEstimate = async () => {
        if (!draft.title || !draft.clientCompany) {
            Swal.fire('알림', '필수 항목(제목, 업체명)을 입력해 주세요.', 'warning');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...draft,
                documentType: 'estimate' as const,
                templateType: 'detailed' as const,
                items: itemsWithCalc,
                subtotal,
                tax,
                total
            };

            if (draft.id) {
                await estimateService.updateEstimate(draft.id, payload);
                Swal.fire('성공', '상세 견적서가 수정되었습니다.', 'success');
            } else {
                const newId = await estimateService.addEstimate(payload);
                setDraft((previous) => ({ ...previous, id: newId }));
                Swal.fire('성공', '상세 견적서가 저장되었습니다.', 'success');
            }
            await loadData();
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '저장 중 문제가 발생했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteEstimate = async (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const result = await Swal.fire({
            title: '정말 삭제할까요?',
            text: '삭제된 데이터는 복구할 수 없습니다.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });
        if (!result.isConfirmed) return;

        try {
            await estimateService.deleteEstimate(id);
            await loadData();
            if (draft.id === id) resetPage();
            Swal.fire('삭제 완료', '상세 견적서가 삭제되었습니다.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '삭제 중 문제가 발생했습니다.', 'error');
        }
    };

    const changeStatus = async (id: string, currentStatus: EstimateStatus, event: React.MouseEvent) => {
        event.stopPropagation();
        const statuses: EstimateStatus[] = ['draft', 'sent', 'approved', 'rejected'];
        const nextStatus = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];
        try {
            await estimateService.updateEstimate(id, { status: nextStatus });
            await loadData();
            if (draft.id === id) {
                setDraft((previous) => ({ ...previous, status: nextStatus }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const selectEstimate = (item: Estimate) => {
        const parsed = parseRowsFromItems(item.items || []);
        setRcRows(parsed.rcRows);
        setDecRows(parsed.decRows);
        setHebeRows(parsed.hebeRows);
        setRubeRows(parsed.rubeRows);
        setSetEaRows(parsed.setEaRows);
        setDraft({
            ...applySupplierDefaults(getEmptyDetailedDraft(), myCompany),
            ...item,
            title: item.title || '상세 견적서',
            items: item.items || []
        });
    };

    const handleExcelDownload = async () => {
        try {
            await downloadEstimateExcel(draft, itemsWithCalc, subtotal, tax, total, 'estimate');
            Swal.fire({
                icon: 'success',
                title: '엑셀 다운로드 완료',
                text: '상세견적서 엑셀 파일이 생성되었습니다.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2800
            });
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '엑셀 파일 생성 중 문제가 발생했습니다.', 'error');
        }
    };

    const filteredEstimates = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        return estimates.filter((item) => {
            const textMatched =
                keyword === '' ||
                (item.title || '').toLowerCase().includes(keyword) ||
                (item.projectName || '').toLowerCase().includes(keyword) ||
                (item.clientCompany || '').toLowerCase().includes(keyword);

            const statusMatched = statusFilter === 'all' || item.status === statusFilter;
            return textMatched && statusMatched;
        });
    }, [estimates, searchText, statusFilter]);

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
            <style>{PRINT_STYLES}</style>

            <header className="z-30 flex flex-none items-center justify-between border-b bg-white px-6 py-4 shadow-sm print:hidden">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-700 shadow-lg">
                        <FontAwesomeIcon icon={faCalculator} className="text-lg text-white" />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-black leading-tight tracking-tight text-slate-900">
                            상세 견적서 관리
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            RC / DEC Detailed Estimate
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={resetPage}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-slate-600 transition-all hover:border-indigo-500 hover:text-indigo-600 hover:shadow-md"
                    >
                        <FontAwesomeIcon icon={faPlus} /> 새 문서
                    </button>
                    <button
                        onClick={handleExcelDownload}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-black text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white hover:shadow-md"
                    >
                        <FontAwesomeIcon icon={faFileExcel} /> 엑셀
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-slate-600 transition-all hover:border-indigo-500 hover:text-indigo-600 hover:shadow-md"
                    >
                        <FontAwesomeIcon icon={faPrint} /> 인쇄/PDF
                    </button>
                    <button
                        onClick={saveEstimate}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-[12px] font-black text-white shadow-xl transition-all hover:bg-indigo-600 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={saving ? faClock : faFloppyDisk} spin={saving} />
                        {saving ? '저장 중...' : draft.id ? '수정 저장' : '문서 저장'}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="flex w-[340px] flex-none flex-col border-r bg-white shadow-[4px_0_10px_rgba(0,0,0,0.02)] print:hidden">
                    <div className="space-y-4 border-b bg-slate-50/50 p-5">
                        <div className="group relative">
                            <FontAwesomeIcon
                                icon={faMagnifyingGlass}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 transition-colors group-focus-within:text-indigo-500"
                            />
                            <input
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="업체명/프로젝트 검색"
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-[13px] font-bold shadow-sm placeholder:text-slate-300 transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5"
                            />
                        </div>

                        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex-none rounded-xl px-3 py-1.5 text-[11px] font-black transition-all ${
                                    statusFilter === 'all'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                전체
                            </button>
                            {(['draft', 'sent', 'approved', 'rejected'] as EstimateStatus[]).map((key) => {
                                const status = STATUS_CONFIG[key];
                                const selected = statusFilter === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setStatusFilter(key)}
                                        className={`flex-none rounded-xl border px-3 py-1.5 text-[11px] font-black transition-all ${
                                            selected
                                                ? `${status.bg} ${status.color} border-transparent shadow-sm`
                                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {status.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
                        {loading ? (
                            <div className="flex h-40 flex-col items-center justify-center gap-3 text-slate-300">
                                <FontAwesomeIcon icon={faClock} spin className="text-2xl" />
                                <span className="text-[12px] font-bold">불러오는 중...</span>
                            </div>
                        ) : filteredEstimates.length === 0 ? (
                            <div className="flex h-40 flex-col items-center justify-center text-[12px] italic text-slate-300">
                                검색 결과가 없습니다.
                            </div>
                        ) : (
                            filteredEstimates.map((item) => {
                                const status = STATUS_CONFIG[item.status || 'draft'];
                                const active = draft.id === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => selectEstimate(item)}
                                        className={`group relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-lg active:scale-[0.98] ${
                                            active
                                                ? 'border-indigo-500 bg-indigo-50 shadow-indigo-100/50'
                                                : 'border-slate-50 bg-white hover:border-slate-200'
                                        }`}
                                    >
                                        <div className="mb-2 flex items-start justify-between">
                                            <h3
                                                className={`flex-1 pr-6 text-[14px] font-black leading-tight ${
                                                    active ? 'text-indigo-900' : 'text-slate-800'
                                                }`}
                                            >
                                                {item.projectName || item.title || '제목 없음'}
                                            </h3>
                                            <button
                                                onClick={(event) => deleteEstimate(item.id!, event)}
                                                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-500 opacity-0 shadow-sm transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
                                            >
                                                <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                                            </button>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="truncate text-[11px] font-bold text-slate-500">
                                                {item.clientCompany || '업체 미지정'}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-[11px] font-bold text-slate-400">
                                                    {item.issueDate || '날짜 미지정'}
                                                </div>
                                                <button
                                                    onClick={(event) =>
                                                        changeStatus(item.id!, item.status || 'draft', event)
                                                    }
                                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black shadow-sm transition-all hover:scale-105 active:scale-95 ${status.bg} ${status.color}`}
                                                >
                                                    <FontAwesomeIcon icon={status.icon} />
                                                    {status.label}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                                            <span className="text-[13px] font-black text-indigo-600">
                                                {formatCurrency(item.total)} 원
                                            </span>
                                            <FontAwesomeIcon
                                                icon={faChevronRight}
                                                className={`text-[10px] transition-transform ${
                                                    active ? 'translate-x-1 text-indigo-500' : 'text-slate-200'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                <main className="no-scrollbar flex min-w-0 flex-1 flex-col overflow-auto bg-slate-50/50 print:m-0 print:block print:overflow-visible print:bg-white print:p-0">
                    <div className="flex flex-1 flex-col items-center p-10 print:p-0">
                        <div className="mx-auto w-full max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-12 shadow-2xl shadow-slate-200/50 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none">
                            <TitleComponent text={draft.title || '상세 견적서'} logoUrl={logoUrl} />
                            <InfoTableComponent draft={draft} isEdit={true} updateDraft={updateDraft} />
                            <AmountBarComponent
                                subtotal={subtotal}
                                totalAmt={total}
                                taxAmt={tax}
                                label=""
                                isTransaction={false}
                                draft={draft}
                            />

                            <div className="mb-6 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-indigo-600">RC 합계</p>
                                    <p className="text-[22px] font-black text-indigo-900">
                                        {formatCurrency(rcTotalAmount)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-emerald-600">DEC 합계</p>
                                    <p className="text-[22px] font-black text-emerald-900">
                                        {formatCurrency(decTotalAmount)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-sky-600">헤베 합계</p>
                                    <p className="text-[22px] font-black text-sky-900">
                                        {formatCurrency(hebeTotalAmount)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-violet-600">루베 합계</p>
                                    <p className="text-[22px] font-black text-violet-900">
                                        {formatCurrency(rubeTotalAmount)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-orange-600">SET/EA 합계</p>
                                    <p className="text-[22px] font-black text-orange-900">
                                        {formatCurrency(setEaTotalAmount)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-slate-600">공급가액</p>
                                    <p className="text-[22px] font-black text-slate-900">
                                        {formatCurrency(subtotal)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-amber-700">VAT</p>
                                    <p className="text-[22px] font-black text-amber-900">
                                        {formatCurrency(tax)} 원
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-slate-300">총액</p>
                                    <p className="text-[22px] font-black text-white">{formatCurrency(total)} 원</p>
                                </div>
                            </div>

                            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-indigo-600">RC 물량</p>
                                    <p className="text-[18px] font-black text-indigo-900">
                                        {formatCurrency(rcTotalVolume)} m3
                                    </p>
                                </div>
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-emerald-600">DEC 물량</p>
                                    <p className="text-[18px] font-black text-emerald-900">
                                        {formatCurrency(decTotalVolume)} m3
                                    </p>
                                </div>
                                <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-sky-600">헤베 물량</p>
                                    <p className="text-[18px] font-black text-sky-900">
                                        {formatCurrency(hebeTotalArea)} m2
                                    </p>
                                </div>
                                <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-violet-600">루베 물량</p>
                                    <p className="text-[18px] font-black text-violet-900">
                                        {formatCurrency(rubeTotalVolume)} m3
                                    </p>
                                </div>
                                <div className="rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-orange-600">SET/EA 수량</p>
                                    <p className="text-[18px] font-black text-orange-900">
                                        {formatCurrency(setEaTotalQuantity)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">
                                    <p className="text-[11px] font-bold tracking-wide text-cyan-700">평균 m3 단가</p>
                                    <p className="text-[18px] font-black text-cyan-900">
                                        {formatCurrency(averageUnitPrice)} 원
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/60 p-4">
                                    <div>
                                        <h2 className="text-[16px] font-black text-indigo-900">RC 상세 산출</h2>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            높이 계수 + 포인트 기준으로 RC 구간 금액을 계산합니다.
                                        </p>
                                    </div>
                                    <button
                                        onClick={addRcRow}
                                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12px] font-black text-white transition-all hover:bg-indigo-700"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        RC 구간 추가
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[980px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3">구간명</th>
                                                <th className="px-4 py-3">높이(m)</th>
                                                <th className="px-4 py-3 text-right">물량(m3)</th>
                                                <th className="px-4 py-3 text-right">포인트(P)</th>
                                                <th className="px-4 py-3 text-right">기준단가</th>
                                                <th className="px-4 py-3 text-right text-indigo-600">포인트단가</th>
                                                <th className="px-4 py-3 text-right">합계금액</th>
                                                <th className="px-4 py-3 text-right text-indigo-700">m3 단가</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculatedRc.map((row) => (
                                                <tr key={row.id} className="group hover:bg-indigo-50/20">
                                                    <td className="px-4 py-2">
                                                        <input
                                                            value={row.section}
                                                            onChange={(event) =>
                                                                updateRcRow(row.id, 'section', event.target.value)
                                                            }
                                                            placeholder="구간명 입력"
                                                            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-bold outline-none transition-all group-hover:border-slate-200 focus:border-indigo-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.height}
                                                            onChange={(event) =>
                                                                updateRcRow(row.id, 'height', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] outline-none focus:border-indigo-400"
                                                        >
                                                            {HEIGHT_OPTIONS.map((height) => (
                                                                <option key={height} value={height}>
                                                                    {height}m ({HEIGHT_MULTIPLIERS[height].toFixed(1)}x)
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.volume || ''}
                                                            onChange={(event) =>
                                                                updateRcRow(row.id, 'volume', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-medium outline-none focus:border-indigo-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.points || ''}
                                                            onChange={(event) =>
                                                                updateRcRow(row.id, 'points', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-black text-indigo-600 outline-none focus:border-indigo-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.basePrice || ''}
                                                            onChange={(event) =>
                                                                updateRcRow(row.id, 'basePrice', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-indigo-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-indigo-600">
                                                        {formatCurrency(row.pointUnitPrice)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-slate-900">
                                                        {formatCurrency(row.totalAmount)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-indigo-700">
                                                        {formatCurrency(row.unitPricePerM3)}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeRcRow(row.id)}
                                                            className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-900 font-bold text-white">
                                            <tr>
                                                <td className="px-4 py-4" colSpan={2}>
                                                    RC 합계
                                                </td>
                                                <td className="px-4 py-4 text-right text-slate-300">
                                                    {formatCurrency(rcTotalVolume)} m3
                                                </td>
                                                <td className="px-4 py-4" colSpan={3} />
                                                <td className="px-4 py-4 text-right text-[18px]">
                                                    {formatCurrency(rcTotalAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-[18px] text-indigo-300">
                                                    {formatCurrency(rcAverageUnitPrice)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/60 p-4">
                                    <div>
                                        <h2 className="text-[16px] font-black text-emerald-900">DEC 상세 산출</h2>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            분류/타입별 기준단가 + 높이계수로 DEC 구간 금액을 계산합니다.
                                        </p>
                                    </div>
                                    <button
                                        onClick={addDecRow}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[12px] font-black text-white transition-all hover:bg-emerald-700"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        DEC 구간 추가
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1020px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3">구간명</th>
                                                <th className="px-4 py-3">기준분류</th>
                                                <th className="px-4 py-3 text-center">타입</th>
                                                <th className="px-4 py-3">높이(m)</th>
                                                <th className="px-4 py-3 text-right">총물량(m3)</th>
                                                <th className="px-4 py-3 text-right">적용단가</th>
                                                <th className="px-4 py-3 text-right">합계금액</th>
                                                <th className="px-4 py-3 text-right text-emerald-700">m3 단가</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculatedDec.map((row) => (
                                                <tr key={row.id} className="group hover:bg-emerald-50/20">
                                                    <td className="px-4 py-2">
                                                        <input
                                                            value={row.section}
                                                            onChange={(event) =>
                                                                updateDecRow(row.id, 'section', event.target.value)
                                                            }
                                                            placeholder="구간명 입력"
                                                            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-bold outline-none transition-all group-hover:border-slate-200 focus:border-emerald-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.type}
                                                            onChange={(event) =>
                                                                updateDecRow(row.id, 'type', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] outline-none focus:border-emerald-400"
                                                        >
                                                            <option value="real">실단가</option>
                                                            <option value="install">설치물량</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.pType}
                                                            onChange={(event) =>
                                                                updateDecRow(row.id, 'pType', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[13px] font-black outline-none focus:border-emerald-400"
                                                        >
                                                            <option value="2p">2P</option>
                                                            <option value="3p">3P</option>
                                                            <option value="4p">4P</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.height}
                                                            onChange={(event) =>
                                                                updateDecRow(row.id, 'height', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] outline-none focus:border-emerald-400"
                                                        >
                                                            {HEIGHT_OPTIONS.map((height) => (
                                                                <option key={height} value={height}>
                                                                    {height}m
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.volume || ''}
                                                            onChange={(event) =>
                                                                updateDecRow(row.id, 'volume', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-black text-emerald-600 outline-none focus:border-emerald-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-bold text-slate-700">
                                                        {formatCurrency(row.finalUnitPrice)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-slate-900">
                                                        {formatCurrency(row.totalAmount)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-emerald-700">
                                                        {formatCurrency(row.unitPricePerM3)}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeDecRow(row.id)}
                                                            className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-900 font-bold text-white">
                                            <tr>
                                                <td className="px-4 py-4" colSpan={4}>
                                                    DEC 합계
                                                </td>
                                                <td className="px-4 py-4 text-right text-slate-300">
                                                    {formatCurrency(decTotalVolume)} m3
                                                </td>
                                                <td />
                                                <td className="px-4 py-4 text-right text-[18px]">
                                                    {formatCurrency(decTotalAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-[18px] text-emerald-300">
                                                    {formatCurrency(decAverageUnitPrice)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-sky-50/70 p-4">
                                    <div>
                                        <h2 className="text-[16px] font-black text-sky-900">헤베 상세 산출</h2>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            길이 × 높이 × 수량으로 m2 물량을 산출한 뒤 단가를 적용합니다.
                                        </p>
                                    </div>
                                    <button
                                        onClick={addHebeRow}
                                        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-[12px] font-black text-white transition-all hover:bg-sky-700"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        헤베 구간 추가
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1120px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3">구간명</th>
                                                <th className="px-4 py-3">품목</th>
                                                <th className="px-4 py-3 text-right">길이(m)</th>
                                                <th className="px-4 py-3 text-right">높이(m)</th>
                                                <th className="px-4 py-3 text-right">수량</th>
                                                <th className="px-4 py-3 text-right text-sky-700">산출면적(m2)</th>
                                                <th className="px-4 py-3 text-right">단가</th>
                                                <th className="px-4 py-3 text-right">합계금액</th>
                                                <th className="px-4 py-3 text-right text-sky-700">m2 단가</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculatedHebe.map((row) => (
                                                <tr key={row.id} className="group hover:bg-sky-50/20">
                                                    <td className="px-4 py-2">
                                                        <input
                                                            value={row.section}
                                                            onChange={(event) =>
                                                                updateHebeRow(row.id, 'section', event.target.value)
                                                            }
                                                            placeholder="구간명 입력"
                                                            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-bold outline-none transition-all group-hover:border-slate-200 focus:border-sky-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.itemName}
                                                            onChange={(event) =>
                                                                updateHebeRow(row.id, 'itemName', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] font-black outline-none focus:border-sky-400"
                                                        >
                                                            <option value=""></option>
                                                            {DETAIL_PRODUCTS.map((product) => (
                                                                <option key={product} value={product}>
                                                                    {product}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={row.length || ''}
                                                            onChange={(event) =>
                                                                updateHebeRow(row.id, 'length', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-sky-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={row.height || ''}
                                                            onChange={(event) =>
                                                                updateHebeRow(row.id, 'height', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-sky-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={row.count || ''}
                                                            onChange={(event) =>
                                                                updateHebeRow(row.id, 'count', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-sky-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-sky-700">
                                                        {formatCurrency(row.area)}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.unitPrice || ''}
                                                            onChange={(event) =>
                                                                updateHebeRow(row.id, 'unitPrice', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-bold outline-none focus:border-sky-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-slate-900">
                                                        {formatCurrency(row.totalAmount)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-sky-700">
                                                        {formatCurrency(row.unitPricePerM2)}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeHebeRow(row.id)}
                                                            className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-900 font-bold text-white">
                                            <tr>
                                                <td className="px-4 py-4" colSpan={5}>
                                                    헤베 합계
                                                </td>
                                                <td className="px-4 py-4 text-right text-slate-300">
                                                    {formatCurrency(hebeTotalArea)} m2
                                                </td>
                                                <td />
                                                <td className="px-4 py-4 text-right text-[18px]">
                                                    {formatCurrency(hebeTotalAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-[18px] text-sky-300">
                                                    {formatCurrency(hebeAverageUnitPrice)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-violet-50/70 p-4">
                                    <div>
                                        <h2 className="text-[16px] font-black text-violet-900">루베 상세 산출</h2>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            길이 × 폭 × 높이 × 수량으로 m3 물량을 산출한 뒤 단가를 적용합니다.
                                        </p>
                                    </div>
                                    <button
                                        onClick={addRubeRow}
                                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[12px] font-black text-white transition-all hover:bg-violet-700"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        루베 구간 추가
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1240px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3">구간명</th>
                                                <th className="px-4 py-3">품목</th>
                                                <th className="px-4 py-3 text-right">길이(m)</th>
                                                <th className="px-4 py-3 text-right">폭(m)</th>
                                                <th className="px-4 py-3 text-right">높이(m)</th>
                                                <th className="px-4 py-3 text-right">수량</th>
                                                <th className="px-4 py-3 text-right text-violet-700">산출부피(m3)</th>
                                                <th className="px-4 py-3 text-right">단가</th>
                                                <th className="px-4 py-3 text-right">합계금액</th>
                                                <th className="px-4 py-3 text-right text-violet-700">m3 단가</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculatedRube.map((row) => (
                                                <tr key={row.id} className="group hover:bg-violet-50/20">
                                                    <td className="px-4 py-2">
                                                        <input
                                                            value={row.section}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'section', event.target.value)
                                                            }
                                                            placeholder="구간명 입력"
                                                            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-bold outline-none transition-all group-hover:border-slate-200 focus:border-violet-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.itemName}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'itemName', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] font-black outline-none focus:border-violet-400"
                                                        >
                                                            <option value=""></option>
                                                            {DETAIL_PRODUCTS.map((product) => (
                                                                <option key={product} value={product}>
                                                                    {product}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={row.length || ''}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'length', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-violet-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={row.width || ''}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'width', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-violet-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={row.height || ''}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'height', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-violet-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={row.count || ''}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'count', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] outline-none focus:border-violet-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-violet-700">
                                                        {formatCurrency(row.volume)}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.unitPrice || ''}
                                                            onChange={(event) =>
                                                                updateRubeRow(row.id, 'unitPrice', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-bold outline-none focus:border-violet-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-slate-900">
                                                        {formatCurrency(row.totalAmount)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-violet-700">
                                                        {formatCurrency(row.unitPricePerM3)}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeRubeRow(row.id)}
                                                            className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-900 font-bold text-white">
                                            <tr>
                                                <td className="px-4 py-4" colSpan={6}>
                                                    루베 합계
                                                </td>
                                                <td className="px-4 py-4 text-right text-slate-300">
                                                    {formatCurrency(rubeTotalVolume)} m3
                                                </td>
                                                <td />
                                                <td className="px-4 py-4 text-right text-[18px]">
                                                    {formatCurrency(rubeTotalAmount)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-[18px] text-violet-300">
                                                    {formatCurrency(rubeAverageUnitPrice)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-orange-50/70 p-4">
                                    <div>
                                        <h2 className="text-[16px] font-black text-orange-900">SET / EA 상세 산출</h2>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            계단타워, 작업발판, 안전통로, 브라켓 품목별 SET 또는 EA 수량으로 산출합니다.
                                        </p>
                                    </div>
                                    <button
                                        onClick={addSetEaRow}
                                        className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-[12px] font-black text-white transition-all hover:bg-orange-700"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        SET/EA 품목 추가
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[940px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-3">품목</th>
                                                <th className="px-4 py-3 text-center">단위</th>
                                                <th className="px-4 py-3 text-right">수량</th>
                                                <th className="px-4 py-3 text-right">단가</th>
                                                <th className="px-4 py-3 text-right text-orange-700">합계금액</th>
                                                <th className="px-4 py-3">비고</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculatedSetEa.map((row) => (
                                                <tr key={row.id} className="group hover:bg-orange-50/20">
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.itemName}
                                                            onChange={(event) =>
                                                                updateSetEaRow(row.id, 'itemName', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[13px] font-black outline-none focus:border-orange-400"
                                                        >
                                                            {DETAIL_PRODUCTS.map((product) => (
                                                                <option key={product} value={product}>
                                                                    {product}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={row.unitMode}
                                                            onChange={(event) =>
                                                                updateSetEaRow(row.id, 'unitMode', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[13px] font-black outline-none focus:border-orange-400"
                                                        >
                                                            <option value="SET">SET</option>
                                                            <option value="EA">EA</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={row.quantity || ''}
                                                            onChange={(event) =>
                                                                updateSetEaRow(row.id, 'quantity', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-black text-orange-600 outline-none focus:border-orange-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.unitPrice || ''}
                                                            onChange={(event) =>
                                                                updateSetEaRow(row.id, 'unitPrice', event.target.value)
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[13px] font-bold outline-none focus:border-orange-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-[13px] font-black text-orange-700">
                                                        {formatCurrency(row.totalAmount)}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            value={row.note}
                                                            onChange={(event) =>
                                                                updateSetEaRow(row.id, 'note', event.target.value)
                                                            }
                                                            placeholder="비고"
                                                            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] outline-none transition-all group-hover:border-slate-200 focus:border-orange-400"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeSetEaRow(row.id)}
                                                            className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-900 font-bold text-white">
                                            <tr>
                                                <td className="px-4 py-4" colSpan={2}>
                                                    SET/EA 합계
                                                </td>
                                                <td className="px-4 py-4 text-right text-slate-300">
                                                    {formatCurrency(setEaTotalQuantity)}
                                                </td>
                                                <td />
                                                <td className="px-4 py-4 text-right text-[18px]">
                                                    {formatCurrency(setEaTotalAmount)}
                                                </td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                                <div className="rounded-2xl bg-slate-800 p-5">
                                    <h3 className="mb-3 text-[13px] font-black text-white">높이 계수</h3>
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
                                        {HEIGHT_OPTIONS.map((height) => (
                                            <div
                                                key={height}
                                                className="rounded-xl border border-slate-600 bg-slate-700/40 p-2 text-center"
                                            >
                                                <div className="text-[10px] font-bold text-slate-400">{height}m</div>
                                                <div className="text-[15px] font-black text-indigo-300">
                                                    {HEIGHT_MULTIPLIERS[height].toFixed(1)}x
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-slate-800 p-5 lg:col-span-2">
                                    <h3 className="mb-3 text-[13px] font-black text-white">계산 공식 (상세)</h3>
                                    <div className="space-y-2 text-[12px]">
                                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/20 p-3 text-indigo-100">
                                            RC 포인트단가 = 기준단가 × 높이계수
                                        </div>
                                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/20 p-3 text-indigo-100">
                                            RC 합계금액 = RC 포인트단가 × 포인트(P), RC m3단가 = RC 합계금액 ÷ RC 물량(m3)
                                        </div>
                                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-3 text-emerald-100">
                                            DEC 적용단가 = DEC 기준단가(분류/타입) × 높이계수
                                        </div>
                                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-3 text-emerald-100">
                                            DEC 합계금액 = DEC 적용단가 × DEC 물량(m3), DEC m3단가 = DEC 합계금액 ÷ DEC 물량(m3)
                                        </div>
                                        <div className="rounded-xl border border-sky-500/30 bg-sky-900/20 p-3 text-sky-100">
                                            헤베 산출면적(m2) = 길이 × 높이 × 수량, 헤베 합계금액 = 산출면적 × 단가
                                        </div>
                                        <div className="rounded-xl border border-violet-500/30 bg-violet-900/20 p-3 text-violet-100">
                                            루베 산출부피(m3) = 길이 × 폭 × 높이 × 수량, 루베 합계금액 = 산출부피 × 단가
                                        </div>
                                        <div className="rounded-xl border border-orange-500/30 bg-orange-900/20 p-3 text-orange-100">
                                            SET/EA 합계금액 = 계단타워/작업발판/안전통로/브라켓 품목별 수량 × 단가
                                        </div>
                                        <div className="rounded-xl border border-slate-700 bg-slate-700/30 p-3 text-slate-200">
                                            공급가액 = RC + DEC + 헤베 + 루베 + SET/EA = {formatCurrency(subtotal)} 원
                                        </div>
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-3 text-amber-100">
                                            VAT = max(공급가액 - 할인, 0) × {vatRate}% = {formatCurrency(tax)} 원
                                        </div>
                                        <div className="rounded-xl border border-slate-500/40 bg-slate-900/40 p-3 text-white">
                                            총액 = max(공급가액 - 할인, 0) + VAT = {formatCurrency(total)} 원
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <label className="mb-2 block text-[13px] font-black text-slate-700">특기사항</label>
                                <textarea
                                    value={draft.scopeNotes}
                                    onChange={(event) => updateDraft('scopeNotes', event.target.value)}
                                    className="min-h-[220px] w-full resize-y rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-5 text-[14px] leading-relaxed text-slate-700 outline-none transition-all focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DetailedEstimateManagePage;
