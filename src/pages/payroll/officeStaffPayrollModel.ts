import type { OfficeStaff } from '../../services/officeStaffService';

export type RowSource = 'staff' | 'manual';
export type StatusFilter = 'active' | 'all';
export type PayBasis = 'gross' | 'net';
export type InsuranceBurdenMode = 'shared' | 'employer';

export interface InsuranceSettings {
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

export interface PayrollInputState {
    baseSalary?: number;
    bonus?: number;
    deduction?: number;
    payBasis?: PayBasis;
    insuranceApplied?: boolean;
    insuranceBurdenMode?: InsuranceBurdenMode;
    memo?: string;
}

export interface ManualPayrollRow extends PayrollInputState {
    id: string;
    name: string;
    department?: string;
    role?: string;
}

export interface PayrollDisplayRow {
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

export interface PayrollCalculation {
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

export interface InsuranceBreakdown {
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

export interface StoredMonthData {
    rowInputs?: Record<string, PayrollInputState>;
    manualRows?: ManualPayrollRow[];
    settings?: Partial<InsuranceSettings>;
    grossPaySnapshot?: Array<{ id: string; name: string; grossPay: number; baseSalary: number; bonus: number; payBasis: PayBasis }>;
    staffSnapshot?: PayrollDisplayRow[];
}

export type StoredPayrollData = Record<string, StoredMonthData>;

export const STORAGE_KEY = 'cy-office-staff-payroll-v1';

export const DEFAULT_INSURANCE_SETTINGS: InsuranceSettings = {
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

export const inputClassName =
    'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
export const numberInputClassName =
    'h-10 w-full min-w-[112px] rounded-md border border-slate-300 bg-white px-3 text-right text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
export const buttonClassName =
    'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
export const primaryButtonClassName =
    'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700';

export const currencyFormatter = new Intl.NumberFormat('ko-KR');

export const getCurrentMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const isYearMonth = (value: unknown): value is string => {
    const matched = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!matched) return false;
    const month = Number(matched[2]);
    return Number.isFinite(month) && month >= 1 && month <= 12;
};

export const getMonthFromSearchParams = (params: URLSearchParams): string | null => {
    const value = params.get('yearMonth') || params.get('month');
    return isYearMonth(value) ? value : null;
};

export const getStatusFilterFromSearchParams = (params: URLSearchParams): StatusFilter => {
    const value = params.get('status');
    return value === 'all' || value === 'active' ? value : 'active';
};

export const getSearchFromSearchParams = (params: URLSearchParams): string =>
    (params.get('q') || params.get('search') || '').trim();

export const toNumber = (value: unknown): number => {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

export const toText = (value: unknown): string => String(value ?? '').trim();

export const formatCurrency = (value: number): string => currencyFormatter.format(Math.round(value));

export const roundWon = (value: number): number => Math.round(Number.isFinite(value) ? value : 0);

export const getStaffRowId = (staff: OfficeStaff, index: number): string => {
    const key = staff.id || staff.legacyId || `${staff.name}-${index}`;
    return `staff:${key}`;
};

export type LegacyInsuranceSettings = Partial<InsuranceSettings> & {
    careRateOfHealth?: number;
};

export const normalizeStoredSettings = (settings?: LegacyInsuranceSettings): InsuranceSettings => {
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

export const readStoredPayrollData = (): StoredPayrollData => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

export const writeStoredPayrollData = (data: StoredPayrollData) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const normalizeRate = (rate: number): number => Math.max(0, toNumber(rate)) / 100;

export const clampPensionBase = (grossPay: number, settings: InsuranceSettings): number => {
    if (grossPay <= 0) return 0;
    const minBase = Math.max(0, settings.pensionMinBase);
    const maxBase = Math.max(minBase, settings.pensionMaxBase);
    return Math.min(Math.max(grossPay, minBase), maxBase);
};

export const calculateInsuranceBreakdown = (
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

export const resolveGrossPayForTargetNet = (
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

export const calculatePayroll = (
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

export const isActiveOfficeStaff = (staff: OfficeStaff): boolean => {
    const status = toText(staff.status);
    if (staff.isActive === false) return false;
    return !status.includes('퇴사') && !status.toLowerCase().includes('inactive');
};

export const isInsuranceExcludedStaff = (staff: OfficeStaff): boolean => {
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

export const inferPayBasis = (staff: OfficeStaff): PayBasis => {
    const searchable = [
        staff.salaryModel,
        staff.payType,
        staff.employmentType,
        staff.memo,
    ].map(toText).join(' ').toLowerCase();

    return /세후|실수령|실지급|net/.test(searchable) ? 'net' : 'gross';
};

export const buildStaffDisplayRow = (
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

export const buildManualDisplayRow = (row: ManualPayrollRow): PayrollDisplayRow => ({
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

export const getCsvValue = (value: unknown): string => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
};

