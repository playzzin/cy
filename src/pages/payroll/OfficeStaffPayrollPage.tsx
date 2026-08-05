import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Calculator,
    Download,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Settings2,
    ShieldCheck,
    Trash2,
    UserRound,
    WalletCards,
} from 'lucide-react';
import { officeStaffService, OfficeStaff } from '../../services/officeStaffService';

type RowSource = 'staff' | 'manual';
type StatusFilter = 'active' | 'all';
type PayBasis = 'gross' | 'net';
type InsuranceBurdenMode = 'shared' | 'employer';

interface InsuranceSettings {
    pensionEnabled: boolean;
    healthEnabled: boolean;
    careEnabled: boolean;
    employmentEnabled: boolean;
    industrialAccidentEnabled: boolean;
    pensionEmployeeRate: number;
    pensionEmployerRate: number;
    pensionMinBase: number;
    pensionMaxBase: number;
    healthEmployeeRate: number;
    healthEmployerRate: number;
    careEmployeeRateOfHealth: number;
    careEmployerRateOfHealth: number;
    employmentEmployeeRate: number;
    employmentEmployerRate: number;
    industrialAccidentEmployeeRate: number;
    industrialAccidentEmployerRate: number;
}

interface PayrollInputState {
    baseSalary?: number;
    bonus?: number;
    deduction?: number;
    payBasis?: PayBasis;
    insuranceApplied?: boolean;
    insuranceBurdenMode?: InsuranceBurdenMode;
    memo?: string;
}

interface ManualPayrollRow extends PayrollInputState {
    id: string;
    name: string;
    department?: string;
    role?: string;
}

interface PayrollDisplayRow {
    id: string;
    source: RowSource;
    name: string;
    department: string;
    role: string;
    salaryModel: string;
    status: string;
    baseSalary: number;
    bonus: number;
    deduction: number;
    payBasis: PayBasis;
    insuranceApplied: boolean;
    insuranceBurdenMode: InsuranceBurdenMode;
    memo: string;
}

interface PayrollCalculation {
    grossPay: number;
    pension: number;
    health: number;
    care: number;
    employment: number;
    industrialAccident: number;
    employeeInsurance: number;
    extraDeduction: number;
    totalDeduction: number;
    netPay: number;
    employerPension: number;
    employerHealth: number;
    employerCare: number;
    employerEmployment: number;
    employerIndustrialAccident: number;
    companyPaidEmployeeInsurance: number;
    employerInsurance: number;
    companyCost: number;
}

interface InsuranceBreakdown {
    pension: number;
    health: number;
    care: number;
    employment: number;
    industrialAccident: number;
    employeeInsurance: number;
    employerPension: number;
    employerHealth: number;
    employerCare: number;
    employerEmployment: number;
    employerIndustrialAccident: number;
    companyPaidEmployeeInsurance: number;
    employerInsurance: number;
}

interface StoredMonthData {
    rowInputs?: Record<string, PayrollInputState>;
    manualRows?: ManualPayrollRow[];
    settings?: Partial<InsuranceSettings>;
}

type StoredPayrollData = Record<string, StoredMonthData>;

const STORAGE_KEY = 'cy-office-staff-payroll-v1';

const DEFAULT_INSURANCE_SETTINGS: InsuranceSettings = {
    pensionEnabled: true,
    healthEnabled: true,
    careEnabled: true,
    employmentEnabled: true,
    industrialAccidentEnabled: true,
    pensionEmployeeRate: 4.75,
    pensionEmployerRate: 4.75,
    pensionMinBase: 400000,
    pensionMaxBase: 6370000,
    healthEmployeeRate: 3.595,
    healthEmployerRate: 3.595,
    careEmployeeRateOfHealth: 13.14,
    careEmployerRateOfHealth: 13.14,
    employmentEmployeeRate: 0.9,
    employmentEmployerRate: 1.15,
    industrialAccidentEmployeeRate: 0,
    industrialAccidentEmployerRate: 0.8,
};

const inputClassName =
    'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const numberInputClassName =
    'h-10 w-full min-w-[112px] rounded-md border border-slate-300 bg-white px-3 text-right text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const buttonClassName =
    'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClassName =
    'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700';

const currencyFormatter = new Intl.NumberFormat('ko-KR');

const getCurrentMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const isYearMonth = (value: unknown): value is string => {
    const matched = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!matched) return false;
    const month = Number(matched[2]);
    return Number.isFinite(month) && month >= 1 && month <= 12;
};

const getMonthFromSearchParams = (params: URLSearchParams): string | null => {
    const value = params.get('yearMonth') || params.get('month');
    return isYearMonth(value) ? value : null;
};

const getStatusFilterFromSearchParams = (params: URLSearchParams): StatusFilter => {
    const value = params.get('status');
    return value === 'all' || value === 'active' ? value : 'active';
};

const getSearchFromSearchParams = (params: URLSearchParams): string =>
    (params.get('q') || params.get('search') || '').trim();

const toNumber = (value: unknown): number => {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const toText = (value: unknown): string => String(value ?? '').trim();

const formatCurrency = (value: number): string => currencyFormatter.format(Math.round(value));

const roundWon = (value: number): number => Math.round(Number.isFinite(value) ? value : 0);

const getStaffRowId = (staff: OfficeStaff, index: number): string => {
    const key = staff.id || staff.legacyId || `${staff.name}-${index}`;
    return `staff:${key}`;
};

type LegacyInsuranceSettings = Partial<InsuranceSettings> & {
    careRateOfHealth?: number;
};

const normalizeStoredSettings = (settings?: LegacyInsuranceSettings): InsuranceSettings => {
    const legacyCareRate = settings?.careRateOfHealth;
    return {
        ...DEFAULT_INSURANCE_SETTINGS,
        ...(settings || {}),
        careEmployeeRateOfHealth:
            settings?.careEmployeeRateOfHealth ?? legacyCareRate ?? DEFAULT_INSURANCE_SETTINGS.careEmployeeRateOfHealth,
        careEmployerRateOfHealth:
            settings?.careEmployerRateOfHealth ?? legacyCareRate ?? DEFAULT_INSURANCE_SETTINGS.careEmployerRateOfHealth,
        industrialAccidentEmployeeRate:
            settings?.industrialAccidentEmployeeRate ?? DEFAULT_INSURANCE_SETTINGS.industrialAccidentEmployeeRate,
    };
};

const readStoredPayrollData = (): StoredPayrollData => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeStoredPayrollData = (data: StoredPayrollData) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const normalizeRate = (rate: number): number => Math.max(0, toNumber(rate)) / 100;

const clampPensionBase = (grossPay: number, settings: InsuranceSettings): number => {
    if (grossPay <= 0) return 0;
    const minBase = Math.max(0, settings.pensionMinBase);
    const maxBase = Math.max(minBase, settings.pensionMaxBase);
    return Math.min(Math.max(grossPay, minBase), maxBase);
};

const calculateInsuranceBreakdown = (
    grossPay: number,
    row: Pick<PayrollDisplayRow, 'insuranceApplied' | 'insuranceBurdenMode'>,
    settings: InsuranceSettings
): InsuranceBreakdown => {
    const pensionBase = clampPensionBase(grossPay, settings);
    const insuranceApplied = row.insuranceApplied !== false;
    const companyPaysAll = insuranceApplied && row.insuranceBurdenMode === 'employer';

    const employeePensionShare = insuranceApplied && settings.pensionEnabled
        ? roundWon(pensionBase * normalizeRate(settings.pensionEmployeeRate))
        : 0;
    const employerPensionShare = insuranceApplied && settings.pensionEnabled
        ? roundWon(pensionBase * normalizeRate(settings.pensionEmployerRate))
        : 0;

    const employeeHealthShare = insuranceApplied && settings.healthEnabled
        ? roundWon(grossPay * normalizeRate(settings.healthEmployeeRate))
        : 0;
    const employerHealthShare = insuranceApplied && settings.healthEnabled
        ? roundWon(grossPay * normalizeRate(settings.healthEmployerRate))
        : 0;

    const employeeCareShare = insuranceApplied && settings.healthEnabled && settings.careEnabled
        ? roundWon(employeeHealthShare * normalizeRate(settings.careEmployeeRateOfHealth))
        : 0;
    const employerCareShare = insuranceApplied && settings.healthEnabled && settings.careEnabled
        ? roundWon(employerHealthShare * normalizeRate(settings.careEmployerRateOfHealth))
        : 0;

    const employeeEmploymentShare = insuranceApplied && settings.employmentEnabled
        ? roundWon(grossPay * normalizeRate(settings.employmentEmployeeRate))
        : 0;
    const employerEmploymentShare = insuranceApplied && settings.employmentEnabled
        ? roundWon(grossPay * normalizeRate(settings.employmentEmployerRate))
        : 0;

    const employeeIndustrialAccidentShare = insuranceApplied && settings.industrialAccidentEnabled
        ? roundWon(grossPay * normalizeRate(settings.industrialAccidentEmployeeRate))
        : 0;
    const employerIndustrialAccidentShare = insuranceApplied && settings.industrialAccidentEnabled
        ? roundWon(grossPay * normalizeRate(settings.industrialAccidentEmployerRate))
        : 0;

    const companyPaidEmployeeInsurance = companyPaysAll
        ? employeePensionShare +
            employeeHealthShare +
            employeeCareShare +
            employeeEmploymentShare +
            employeeIndustrialAccidentShare
        : 0;
    const pension = companyPaysAll ? 0 : employeePensionShare;
    const health = companyPaysAll ? 0 : employeeHealthShare;
    const care = companyPaysAll ? 0 : employeeCareShare;
    const employment = companyPaysAll ? 0 : employeeEmploymentShare;
    const industrialAccident = companyPaysAll ? 0 : employeeIndustrialAccidentShare;
    const employerPension = employerPensionShare + (companyPaysAll ? employeePensionShare : 0);
    const employerHealth = employerHealthShare + (companyPaysAll ? employeeHealthShare : 0);
    const employerCare = employerCareShare + (companyPaysAll ? employeeCareShare : 0);
    const employerEmployment = employerEmploymentShare + (companyPaysAll ? employeeEmploymentShare : 0);
    const employerIndustrialAccident =
        employerIndustrialAccidentShare + (companyPaysAll ? employeeIndustrialAccidentShare : 0);
    const employeeInsurance = pension + health + care + employment + industrialAccident;
    const employerInsurance =
        employerPension +
        employerHealth +
        employerCare +
        employerEmployment +
        employerIndustrialAccident;

    return {
        pension,
        health,
        care,
        employment,
        industrialAccident,
        employeeInsurance,
        employerPension,
        employerHealth,
        employerCare,
        employerEmployment,
        employerIndustrialAccident,
        companyPaidEmployeeInsurance,
        employerInsurance,
    };
};

const resolveGrossPayForTargetNet = (
    targetNetPay: number,
    row: Pick<PayrollDisplayRow, 'insuranceApplied' | 'insuranceBurdenMode'>,
    settings: InsuranceSettings
): number => {
    const target = Math.max(0, toNumber(targetNetPay));
    if (target <= 0) return 0;

    const netBeforeExtraDeduction = (grossPay: number): number => {
        const insurance = calculateInsuranceBreakdown(grossPay, row, settings);
        return grossPay - insurance.employeeInsurance;
    };

    let low = target;
    let high = Math.max(target + 100000, Math.ceil(target * 1.35));
    let guard = 0;

    while (netBeforeExtraDeduction(high) < target && guard < 24) {
        low = high;
        high = Math.ceil(high * 1.5 + 100000);
        guard += 1;
    }

    if (guard >= 24 && netBeforeExtraDeduction(high) < target) {
        return roundWon(high);
    }

    for (let index = 0; index < 36; index += 1) {
        const mid = (low + high) / 2;
        if (netBeforeExtraDeduction(mid) >= target) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return roundWon(high);
};

const calculatePayroll = (
    row: Pick<PayrollDisplayRow, 'baseSalary' | 'bonus' | 'deduction' | 'payBasis' | 'insuranceApplied' | 'insuranceBurdenMode'>,
    settings: InsuranceSettings
): PayrollCalculation => {
    const inputPay = Math.max(0, toNumber(row.baseSalary) + toNumber(row.bonus));
    const grossPay = row.payBasis === 'net'
        ? resolveGrossPayForTargetNet(inputPay, row, settings)
        : inputPay;
    const insurance = calculateInsuranceBreakdown(grossPay, row, settings);
    const extraDeduction = Math.max(0, toNumber(row.deduction));
    const totalDeduction = insurance.employeeInsurance + extraDeduction;
    const netPay = grossPay - totalDeduction;

    return {
        grossPay,
        pension: insurance.pension,
        health: insurance.health,
        care: insurance.care,
        employment: insurance.employment,
        industrialAccident: insurance.industrialAccident,
        employeeInsurance: insurance.employeeInsurance,
        extraDeduction,
        totalDeduction,
        netPay,
        employerPension: insurance.employerPension,
        employerHealth: insurance.employerHealth,
        employerCare: insurance.employerCare,
        employerEmployment: insurance.employerEmployment,
        employerIndustrialAccident: insurance.employerIndustrialAccident,
        companyPaidEmployeeInsurance: insurance.companyPaidEmployeeInsurance,
        employerInsurance: insurance.employerInsurance,
        companyCost: grossPay + insurance.employerInsurance,
    };
};

const isActiveOfficeStaff = (staff: OfficeStaff): boolean => {
    const status = toText(staff.status);
    if (staff.isActive === false) return false;
    return !status.includes('퇴사') && !status.toLowerCase().includes('inactive');
};

const isInsuranceExcludedStaff = (staff: OfficeStaff): boolean => {
    const searchable = [
        staff.employmentType,
        staff.salaryModel,
        staff.payType,
        staff.role,
        staff.department,
        staff.memo,
    ].map(toText).join(' ').toLowerCase();

    return /외부|프리랜서|freelance|contractor|용역/.test(searchable);
};

const inferPayBasis = (staff: OfficeStaff): PayBasis => {
    const searchable = [
        staff.salaryModel,
        staff.payType,
        staff.employmentType,
        staff.memo,
    ].map(toText).join(' ').toLowerCase();

    return /세후|실수령|실지급|net/.test(searchable) ? 'net' : 'gross';
};

const buildStaffDisplayRow = (
    staff: OfficeStaff,
    index: number,
    input: PayrollInputState | undefined
): PayrollDisplayRow => ({
    id: getStaffRowId(staff, index),
    source: 'staff',
    name: toText(staff.name) || '이름 없음',
    department: toText(staff.department) || '사무실',
    role: toText(staff.role) || '-',
    salaryModel: toText(staff.salaryModel || staff.payType) || '월급제',
    status: toText(staff.status) || '재직',
    baseSalary: input?.baseSalary ?? toNumber(staff.unitPrice),
    bonus: input?.bonus ?? 0,
    deduction: input?.deduction ?? 0,
    payBasis: input?.payBasis ?? inferPayBasis(staff),
    insuranceApplied: input?.insuranceApplied ?? !isInsuranceExcludedStaff(staff),
    insuranceBurdenMode: input?.insuranceBurdenMode ?? 'shared',
    memo: input?.memo ?? '',
});

const buildManualDisplayRow = (row: ManualPayrollRow): PayrollDisplayRow => ({
    id: row.id,
    source: 'manual',
    name: row.name || '임시 직원',
    department: row.department || '사무실',
    role: row.role || '-',
    salaryModel: '직접입력',
    status: '수동',
    baseSalary: row.baseSalary ?? 0,
    bonus: row.bonus ?? 0,
    deduction: row.deduction ?? 0,
    payBasis: row.payBasis ?? 'gross',
    insuranceApplied: row.insuranceApplied ?? false,
    insuranceBurdenMode: row.insuranceBurdenMode ?? 'shared',
    memo: row.memo ?? '',
});

const getCsvValue = (value: unknown): string => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
};

const OfficeStaffPayrollPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedMonth, setSelectedMonth] = useState(() => getMonthFromSearchParams(searchParams) ?? getCurrentMonth());
    const [staffRows, setStaffRows] = useState<OfficeStaff[]>([]);
    const [rowInputs, setRowInputs] = useState<Record<string, PayrollInputState>>({});
    const [manualRows, setManualRows] = useState<ManualPayrollRow[]>([]);
    const [settings, setSettings] = useState<InsuranceSettings>(DEFAULT_INSURANCE_SETTINGS);
    const [searchTerm, setSearchTerm] = useState(() => getSearchFromSearchParams(searchParams));
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => getStatusFilterFromSearchParams(searchParams));
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [periodReady, setPeriodReady] = useState(false);
    const isHydratingPeriodRef = useRef(false);

    const fetchStaff = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const rows = await officeStaffService.getOfficeStaff(true);
            setStaffRows(rows);
        } catch (error) {
            console.error('[OfficeStaffPayrollPage] Failed to load office staff:', error);
            setLoadError('사무실 직원 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchStaff();
    }, []);

    useEffect(() => {
        const nextMonth = getMonthFromSearchParams(searchParams) ?? getCurrentMonth();
        const nextStatus = getStatusFilterFromSearchParams(searchParams);
        const nextSearch = getSearchFromSearchParams(searchParams);

        setSelectedMonth((prev) => (prev === nextMonth ? prev : nextMonth));
        setStatusFilter((prev) => (prev === nextStatus ? prev : nextStatus));
        setSearchTerm((prev) => (prev === nextSearch ? prev : nextSearch));
    }, [searchParams]);

    useEffect(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            const shouldKeepMonth =
                selectedMonth !== getCurrentMonth() || prev.has('yearMonth') || prev.has('month');

            if (shouldKeepMonth) {
                next.set('yearMonth', selectedMonth);
            } else {
                next.delete('yearMonth');
            }
            next.delete('month');

            if (statusFilter !== 'active' || prev.has('status')) {
                next.set('status', statusFilter);
            } else {
                next.delete('status');
            }

            const trimmedSearch = searchTerm.trim();
            if (trimmedSearch) {
                next.set('q', trimmedSearch);
            } else {
                next.delete('q');
            }
            next.delete('search');

            return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
    }, [searchTerm, selectedMonth, setSearchParams, statusFilter]);

    useEffect(() => {
        isHydratingPeriodRef.current = true;
        const stored = readStoredPayrollData();
        const monthData = stored[selectedMonth] || {};
        setRowInputs(monthData.rowInputs || {});
        setManualRows(monthData.manualRows || []);
        setSettings(normalizeStoredSettings(monthData.settings));
        setPeriodReady(true);
    }, [selectedMonth]);

    useEffect(() => {
        if (!periodReady) return;
        if (isHydratingPeriodRef.current) {
            isHydratingPeriodRef.current = false;
            return;
        }
        const stored = readStoredPayrollData();
        stored[selectedMonth] = {
            rowInputs,
            manualRows,
            settings,
        };
        writeStoredPayrollData(stored);
    }, [manualRows, periodReady, rowInputs, selectedMonth, settings]);

    const allRows = useMemo(() => {
        const staffDisplayRows = staffRows
            .filter((staff) => statusFilter === 'all' || isActiveOfficeStaff(staff))
            .map((staff, index) => {
                const rowId = getStaffRowId(staff, index);
                return buildStaffDisplayRow(staff, index, rowInputs[rowId]);
            });

        return staffDisplayRows.concat(manualRows.map(buildManualDisplayRow));
    }, [manualRows, rowInputs, staffRows, statusFilter]);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return allRows;

        return allRows.filter((row) => {
            const target = [
                row.name,
                row.department,
                row.role,
                row.salaryModel,
                row.payBasis === 'net' ? '세후' : '세전',
                row.memo,
            ].join(' ').toLowerCase();
            return target.includes(term);
        });
    }, [allRows, searchTerm]);

    const calculatedRows = useMemo(
        () => filteredRows.map((row) => ({ row, calculation: calculatePayroll(row, settings) })),
        [filteredRows, settings]
    );

    const totals = useMemo(() => {
        return calculatedRows.reduce(
            (sum, item) => ({
                baseSalary: sum.baseSalary + item.row.baseSalary,
                grossPay: sum.grossPay + item.calculation.grossPay,
                bonus: sum.bonus + item.row.bonus,
                employeeInsurance: sum.employeeInsurance + item.calculation.employeeInsurance,
                extraDeduction: sum.extraDeduction + item.calculation.extraDeduction,
                totalDeduction: sum.totalDeduction + item.calculation.totalDeduction,
                netPay: sum.netPay + item.calculation.netPay,
                companyPaidEmployeeInsurance:
                    sum.companyPaidEmployeeInsurance + item.calculation.companyPaidEmployeeInsurance,
                employerInsurance: sum.employerInsurance + item.calculation.employerInsurance,
                companyCost: sum.companyCost + item.calculation.companyCost,
            }),
            {
                baseSalary: 0,
                grossPay: 0,
                bonus: 0,
                employeeInsurance: 0,
                extraDeduction: 0,
                totalDeduction: 0,
                netPay: 0,
                companyPaidEmployeeInsurance: 0,
                employerInsurance: 0,
                companyCost: 0,
            }
        );
    }, [calculatedRows]);

    const updateStaffInput = (row: PayrollDisplayRow, patch: PayrollInputState) => {
        setRowInputs((prev) => ({
            ...prev,
            [row.id]: {
                baseSalary: row.baseSalary,
                bonus: row.bonus,
                deduction: row.deduction,
                payBasis: row.payBasis,
                insuranceApplied: row.insuranceApplied,
                insuranceBurdenMode: row.insuranceBurdenMode,
                memo: row.memo,
                ...(prev[row.id] || {}),
                ...patch,
            },
        }));
    };

    const updateManualRow = (rowId: string, patch: Partial<ManualPayrollRow>) => {
        setManualRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    };

    const updateRow = (row: PayrollDisplayRow, patch: PayrollInputState) => {
        if (row.source === 'manual') {
            updateManualRow(row.id, patch);
            return;
        }
        updateStaffInput(row, patch);
    };

    const updateSettings = <K extends keyof InsuranceSettings>(key: K, value: InsuranceSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const addManualRow = () => {
        const id = `manual:${Date.now()}`;
        setManualRows((prev) => [
            ...prev,
            {
                id,
                name: '임시 직원',
                department: '사무실',
                role: '',
                baseSalary: 0,
                bonus: 0,
                deduction: 0,
                payBasis: 'gross',
                insuranceApplied: false,
                insuranceBurdenMode: 'shared',
                memo: '',
            },
        ]);
    };

    const removeManualRow = (rowId: string) => {
        setManualRows((prev) => prev.filter((row) => row.id !== rowId));
    };

    const resetCurrentMonth = () => {
        if (!window.confirm(`${selectedMonth} 급여 입력값을 초기화하시겠습니까?`)) return;
        setRowInputs({});
        setManualRows([]);
        setSettings(DEFAULT_INSURANCE_SETTINGS);
    };

    const exportCsv = () => {
        const header = [
            '지급월',
            '구분',
            '이름',
            '부서',
            '직책',
            '4대보험 적용',
            '4대보험 부담',
            '급여 기준',
            '기본급',
            '성과금',
            '총세전지급액',
            '국민연금',
            '건강보험',
            '장기요양',
            '고용보험',
            '산재보험',
            '기타차감',
            '공제합계',
            '실수령액',
            '사업주부담',
            '회사총비용',
            '메모',
        ];
        const body = calculatedRows.map(({ row, calculation }) => [
            selectedMonth,
            row.source === 'staff' ? '사무실직원' : '수동입력',
            row.name,
            row.department,
            row.role,
            row.insuranceApplied ? '적용' : '미적용',
            row.insuranceApplied
                ? row.insuranceBurdenMode === 'employer'
                    ? '회사 100%'
                    : '직원/회사 분담'
                : '-',
            row.payBasis === 'net' ? '세후' : '세전',
            row.baseSalary,
            row.bonus,
            calculation.grossPay,
            calculation.pension,
            calculation.health,
            calculation.care,
            calculation.employment,
            calculation.industrialAccident,
            calculation.extraDeduction,
            calculation.totalDeduction,
            calculation.netPay,
            calculation.employerInsurance,
            calculation.companyCost,
            row.memo,
        ]);

        const csv = [header, ...body].map((line) => line.map(getCsvValue).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `사무실_직원급여_${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-slate-50 text-slate-900">
            <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                            <WalletCards size={23} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">사무실 직원 급여 계산</h1>
                            <p className="mt-1 text-sm text-slate-500">세전/세후 기준, 4대보험, 성과금, 차감금액 기준 실수령액 산정</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonth())}
                            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            aria-label="지급월"
                        />
                        <button
                            type="button"
                            onClick={fetchStaff}
                            disabled={loading}
                            aria-label="사무실 직원 목록 새로고침"
                            className={buttonClassName}
                        >
                            <RefreshCw size={16} />
                            새로고침
                        </button>
                        <button type="button" onClick={exportCsv} aria-label="현재 필터 조건 CSV 다운로드" className={buttonClassName}>
                            <Download size={16} />
                            CSV
                        </button>
                    </div>
                </div>
            </div>

            <main className="min-w-0 space-y-5 px-4 py-5 sm:px-6">
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                            <UserRound size={16} />
                            인원
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{calculatedRows.length}명</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-500">총 세전 지급액</div>
                        <div className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(totals.grossPay)}원</div>
                        <div className="mt-1 text-xs text-slate-500">성과금 {formatCurrency(totals.bonus)}원 포함</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-500">4대보험 공제</div>
                        <div className="mt-2 text-2xl font-bold text-amber-700">{formatCurrency(totals.employeeInsurance)}원</div>
                        <div className="mt-1 text-xs text-slate-500">기타 차감 {formatCurrency(totals.extraDeduction)}원</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-500">실수령액</div>
                        <div className="mt-2 text-2xl font-bold text-blue-700">{formatCurrency(totals.netPay)}원</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-500">회사 부담 합계</div>
                        <div className="mt-2 text-2xl font-bold text-violet-700">{formatCurrency(totals.companyCost)}원</div>
                        <div className="mt-1 text-xs text-slate-500">사업주 보험 {formatCurrency(totals.employerInsurance)}원</div>
                        {totals.companyPaidEmployeeInsurance > 0 && (
                            <div className="mt-1 text-xs font-semibold text-violet-600">
                                직원분 회사부담 {formatCurrency(totals.companyPaidEmployeeInsurance)}원
                            </div>
                        )}
                    </div>
                </section>

                <section className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-emerald-600" size={20} />
                            <h2 className="text-lg font-bold text-slate-900">4대보험 설정</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSettings(DEFAULT_INSURANCE_SETTINGS)}
                                className={buttonClassName}
                            >
                                <RotateCcw size={16} />
                                기본요율
                            </button>
                            <button type="button" onClick={resetCurrentMonth} className={buttonClassName}>
                                <Trash2 size={16} />
                                월 입력 초기화
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                                <span className="text-sm font-semibold text-slate-700">국민연금 적용</span>
                                <input
                                    type="checkbox"
                                    checked={settings.pensionEnabled}
                                    onChange={(event) => updateSettings('pensionEnabled', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                                <span className="text-sm font-semibold text-slate-700">건강보험 적용</span>
                                <input
                                    type="checkbox"
                                    checked={settings.healthEnabled}
                                    onChange={(event) => updateSettings('healthEnabled', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                                <span className="text-sm font-semibold text-slate-700">장기요양 적용</span>
                                <input
                                    type="checkbox"
                                    checked={settings.careEnabled}
                                    onChange={(event) => updateSettings('careEnabled', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                                <span className="text-sm font-semibold text-slate-700">고용보험 적용</span>
                                <input
                                    type="checkbox"
                                    checked={settings.employmentEnabled}
                                    onChange={(event) => updateSettings('employmentEnabled', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 md:col-span-2">
                                <span className="text-sm font-semibold text-slate-700">산재보험 회사부담 표시</span>
                                <input
                                    type="checkbox"
                                    checked={settings.industrialAccidentEnabled}
                                    onChange={(event) => updateSettings('industrialAccidentEnabled', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                            </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="text-sm font-semibold text-slate-600">
                                국민연금 근로자 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.pensionEmployeeRate}
                                    onChange={(event) => updateSettings('pensionEmployeeRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                국민연금 회사 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.pensionEmployerRate}
                                    onChange={(event) => updateSettings('pensionEmployerRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                건강보험 근로자 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.healthEmployeeRate}
                                    onChange={(event) => updateSettings('healthEmployeeRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                건강보험 회사 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.healthEmployerRate}
                                    onChange={(event) => updateSettings('healthEmployerRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                장기요양 근로자 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.careEmployeeRateOfHealth}
                                    onChange={(event) => updateSettings('careEmployeeRateOfHealth', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                장기요양 회사 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.careEmployerRateOfHealth}
                                    onChange={(event) => updateSettings('careEmployerRateOfHealth', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                고용보험 근로자 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.employmentEmployeeRate}
                                    onChange={(event) => updateSettings('employmentEmployeeRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                고용보험 회사 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.employmentEmployerRate}
                                    onChange={(event) => updateSettings('employmentEmployerRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                산재보험 근로자 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.industrialAccidentEmployeeRate}
                                    onChange={(event) => updateSettings('industrialAccidentEmployeeRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                산재보험 회사 %
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={settings.industrialAccidentEmployerRate}
                                    onChange={(event) => updateSettings('industrialAccidentEmployerRate', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                연금 하한
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={settings.pensionMinBase}
                                    onChange={(event) => updateSettings('pensionMinBase', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-slate-600">
                                연금 상한
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={settings.pensionMaxBase}
                                    onChange={(event) => updateSettings('pensionMaxBase', toNumber(event.target.value))}
                                    className={`${inputClassName} mt-1`}
                                />
                            </label>
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs font-medium leading-5 text-emerald-900">
                                기본값은 2026년 직장가입자 기준이며 사업장 조건에 따라 조정하세요.
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="text-blue-600" size={20} />
                            <h2 className="text-lg font-bold text-slate-900">직원별 계산</h2>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative min-w-[240px]">
                                <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    aria-label="직원 검색"
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                    placeholder="직원, 부서, 직책 검색"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                aria-label="직원 상태"
                            >
                                <option value="active">재직자</option>
                                <option value="all">전체</option>
                            </select>
                            <button type="button" onClick={addManualRow} className={primaryButtonClassName}>
                                <Plus size={16} />
                                직접 추가
                            </button>
                        </div>
                    </div>

                    {loadError && (
                        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {loadError}
                        </div>
                    )}

                    <div className="w-full max-w-full overflow-x-auto" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
                        <table className="w-full min-w-[1660px] text-sm">
                            <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">직원</th>
                                    <th className="px-4 py-3 text-left">부서/직책</th>
                                    <th className="px-4 py-3 text-center">4대보험</th>
                                    <th className="px-4 py-3 text-center">급여 기준</th>
                                    <th className="px-4 py-3 text-right">기본급</th>
                                    <th className="px-4 py-3 text-right">성과금</th>
                                    <th className="px-4 py-3 text-right">총 세전</th>
                                    <th className="px-4 py-3 text-right">국민연금</th>
                                    <th className="px-4 py-3 text-right">건강</th>
                                    <th className="px-4 py-3 text-right">장기요양</th>
                                    <th className="px-4 py-3 text-right">고용</th>
                                    <th className="px-4 py-3 text-right">산재</th>
                                    <th className="px-4 py-3 text-right">차감</th>
                                    <th className="px-4 py-3 text-right">실수령액</th>
                                    <th className="px-4 py-3 text-right">회사부담</th>
                                    <th className="px-4 py-3 text-left">메모</th>
                                    <th className="px-4 py-3 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={17} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                                            사무실 직원 정보를 불러오는 중입니다.
                                        </td>
                                    </tr>
                                ) : calculatedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={17} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                                            계산할 직원이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    calculatedRows.map(({ row, calculation }) => (
                                        <tr key={row.id} className="bg-white hover:bg-slate-50">
                                            <td className="px-4 py-3 align-top">
                                                {row.source === 'manual' ? (
                                                    <input
                                                        value={row.name}
                                                        onChange={(event) => updateManualRow(row.id, { name: event.target.value })}
                                                        className={inputClassName}
                                                        aria-label="직원명"
                                                    />
                                                ) : (
                                                    <div>
                                                        <div className="font-bold text-slate-900">{row.name}</div>
                                                        <div className="mt-1 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                            {row.status}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                {row.source === 'manual' ? (
                                                    <div className="grid gap-2">
                                                        <input
                                                            value={row.department}
                                                            onChange={(event) => updateManualRow(row.id, { department: event.target.value })}
                                                            className={inputClassName}
                                                            aria-label="부서"
                                                        />
                                                        <input
                                                            value={row.role === '-' ? '' : row.role}
                                                            onChange={(event) => updateManualRow(row.id, { role: event.target.value })}
                                                            className={inputClassName}
                                                            aria-label="직책"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{row.department}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{row.role} · {row.salaryModel}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center align-top">
                                                <button
                                                    type="button"
                                                    onClick={() => updateRow(row, { insuranceApplied: !row.insuranceApplied })}
                                                    className={`inline-flex h-9 min-w-[74px] items-center justify-center rounded-md border px-3 text-xs font-bold transition ${
                                                        row.insuranceApplied
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                    aria-label={`${row.name} 4대보험 적용 여부`}
                                                >
                                                    {row.insuranceApplied ? '적용' : '미적용'}
                                                </button>
                                                {row.insuranceApplied ? (
                                                    <div className="mx-auto mt-2 grid w-[74px] overflow-hidden rounded-md border border-slate-200 bg-white text-[11px] font-bold">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateRow(row, { insuranceBurdenMode: 'shared' })}
                                                            className={`h-7 whitespace-nowrap px-1 transition ${
                                                                row.insuranceBurdenMode === 'shared'
                                                                    ? 'bg-slate-800 text-white'
                                                                    : 'text-slate-500 hover:bg-slate-50'
                                                            }`}
                                                            aria-label={`${row.name} 직원 회사 분담`}
                                                        >
                                                            분담
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateRow(row, { insuranceBurdenMode: 'employer' })}
                                                            className={`h-7 whitespace-nowrap border-t border-slate-200 px-1 transition ${
                                                                row.insuranceBurdenMode === 'employer'
                                                                    ? 'bg-violet-600 text-white'
                                                                    : 'text-slate-500 hover:bg-slate-50'
                                                            }`}
                                                            aria-label={`${row.name} 회사 100% 부담`}
                                                        >
                                                            회사100
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 text-[11px] font-semibold text-slate-400">외부/제외</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center align-top">
                                                <div className="mx-auto grid w-[74px] overflow-hidden rounded-md border border-slate-200 bg-white text-[11px] font-bold">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRow(row, { payBasis: 'gross' })}
                                                        className={`h-7 whitespace-nowrap px-1 transition ${
                                                            row.payBasis === 'gross'
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'text-slate-500 hover:bg-slate-50'
                                                        }`}
                                                        aria-label={`${row.name} 세전 급여 기준`}
                                                    >
                                                        세전
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRow(row, { payBasis: 'net' })}
                                                        className={`h-7 whitespace-nowrap border-t border-slate-200 px-1 transition ${
                                                            row.payBasis === 'net'
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-slate-500 hover:bg-slate-50'
                                                        }`}
                                                        aria-label={`${row.name} 세후 급여 기준`}
                                                    >
                                                        세후
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="10000"
                                                    value={row.baseSalary}
                                                    onChange={(event) => updateRow(row, { baseSalary: toNumber(event.target.value) })}
                                                    className={numberInputClassName}
                                                    aria-label={`${row.name} 기본급`}
                                                />
                                                <div className="mt-1 text-right text-[11px] font-semibold text-slate-400">
                                                    {row.payBasis === 'net' ? '세후 입력' : '세전 입력'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="10000"
                                                    value={row.bonus}
                                                    onChange={(event) => updateRow(row, { bonus: toNumber(event.target.value) })}
                                                    className={numberInputClassName}
                                                    aria-label={`${row.name} 성과금`}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right align-top font-bold text-slate-900">
                                                {formatCurrency(calculation.grossPay)}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top text-slate-700">
                                                {formatCurrency(calculation.pension)}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top text-slate-700">
                                                {formatCurrency(calculation.health)}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top text-slate-700">
                                                {formatCurrency(calculation.care)}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top text-slate-700">
                                                {formatCurrency(calculation.employment)}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top text-slate-700">
                                                {formatCurrency(calculation.industrialAccident)}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="10000"
                                                    value={row.deduction}
                                                    onChange={(event) => updateRow(row, { deduction: toNumber(event.target.value) })}
                                                    className={numberInputClassName}
                                                    aria-label={`${row.name} 차감금액`}
                                                />
                                                <div className="mt-1 text-right text-xs font-semibold text-rose-600">
                                                    공제 {formatCurrency(calculation.totalDeduction)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <div className="text-base font-bold text-blue-700">{formatCurrency(calculation.netPay)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <div className="font-bold text-violet-700">{formatCurrency(calculation.employerInsurance)}</div>
                                                {calculation.companyPaidEmployeeInsurance > 0 && (
                                                    <div className="mt-1 text-xs font-semibold text-violet-600">
                                                        직원분 {formatCurrency(calculation.companyPaidEmployeeInsurance)}
                                                    </div>
                                                )}
                                                <div className="mt-1 text-xs text-slate-500">총 {formatCurrency(calculation.companyCost)}</div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <input
                                                    value={row.memo}
                                                    onChange={(event) => updateRow(row, { memo: event.target.value })}
                                                    className={`${inputClassName} min-w-[160px]`}
                                                    aria-label={`${row.name} 메모`}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center align-top">
                                                {row.source === 'manual' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeManualRow(row.id)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                                                        aria-label="직접 추가 행 삭제"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex h-9 items-center rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-500">
                                                        DB
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {calculatedRows.length > 0 && (
                                <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-bold text-slate-800">
                                    <tr>
                                        <td className="px-4 py-3" colSpan={4}>합계</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totals.baseSalary)}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totals.bonus)}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totals.grossPay)}</td>
                                        <td className="px-4 py-3 text-right" colSpan={5}>
                                            {formatCurrency(totals.employeeInsurance)}
                                        </td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totals.extraDeduction)}</td>
                                        <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(totals.netPay)}</td>
                                        <td className="px-4 py-3 text-right text-violet-700">{formatCurrency(totals.employerInsurance)}</td>
                                        <td className="px-4 py-3" colSpan={2}>
                                            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                                                <Save size={14} />
                                                월별 자동 저장
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Settings2 size={17} className="text-slate-500" />
                            적용 기준
                        </div>
                        <div className="grid gap-2 text-xs font-medium text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                            <span>국민연금 직원 {settings.pensionEmployeeRate}% / 회사 {settings.pensionEmployerRate}%</span>
                            <span>건강보험 직원 {settings.healthEmployeeRate}% / 회사 {settings.healthEmployerRate}%</span>
                            <span>장기요양 직원 {settings.careEmployeeRateOfHealth}% / 회사 {settings.careEmployerRateOfHealth}%</span>
                            <span>고용보험 직원 {settings.employmentEmployeeRate}% / 회사 {settings.employmentEmployerRate}%</span>
                            <span>산재보험 직원 {settings.industrialAccidentEmployeeRate}% / 회사 {settings.industrialAccidentEmployerRate}%</span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default OfficeStaffPayrollPage;
