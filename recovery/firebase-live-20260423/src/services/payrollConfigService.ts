import { createSetting, listAllSettings as listSettings, updateSetting } from './firestoreCrudCompat';

export interface PayrollDeductionItem {
    id: string;
    label: string;
    order: number;
    isActive: boolean;
}

export interface PayrollInsuranceConfig {
    thresholdDays: number;
    pensionRate: number;
    healthRate: number;
    careRateOfHealth: number;
    employmentRate: number;
    dailyWorkerFeePerManDay?: number;
    withholdingBaseDeduction?: number;
    withholdingIncomeBaseMultiplier?: number;
    withholdingIncomeTaxRate?: number;
    withholdingResidentTaxRate?: number;
    withholdingApplyAllLabor?: boolean;
    employmentApplyBelowThreshold?: boolean;
}

export interface DailyWageStatementPeriodConfig {
    startDay: number;
    endDay: number;
}

export const ADVANCE_ITEM_LABEL_KEYS = [
    'corporateAdvance1',
    'corporateAdvance2',
    'corporateAdvance3',
    'corporateAdvance4',
    'laborAdvance1',
    'laborAdvance2',
    'laborAdvance3',
    'laborAdvance4'
] as const;

export type AdvanceItemLabelKey = (typeof ADVANCE_ITEM_LABEL_KEYS)[number];

export type AdvanceItemLabelsConfig = Record<AdvanceItemLabelKey, string>;

export const DEFAULT_ADVANCE_ITEM_LABELS: AdvanceItemLabelsConfig = {
    corporateAdvance1: '법인가불1',
    corporateAdvance2: '법인가불2',
    corporateAdvance3: '법인가불3',
    corporateAdvance4: '법인가불4',
    laborAdvance1: '노무가불1',
    laborAdvance2: '노무가불2',
    laborAdvance3: '노무가불3',
    laborAdvance4: '노무가불4'
};

const sanitizeAdvanceItemLabels = (raw: unknown): AdvanceItemLabelsConfig => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const next = { ...DEFAULT_ADVANCE_ITEM_LABELS };

    ADVANCE_ITEM_LABEL_KEYS.forEach((key) => {
        const value = obj[key];
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        next[key] = trimmed;
    });

    return next;
};

export interface PayrollConfig {
    taxRate: number; // 0.033 = 3.3%
    incomeTaxRate: number; // 0.03 = 3%
    residentTaxRate: number; // 0.003 = 0.3%
    deductionItems: PayrollDeductionItem[];
    advanceItemLabels: AdvanceItemLabelsConfig;
    insuranceConfig: PayrollInsuranceConfig;
    dailyWageStatementPeriod: DailyWageStatementPeriodConfig;
    updatedAt?: Date;
}

const DOC_ID = 'payroll_config_v1';

const DEFAULT_CONFIG: PayrollConfig = {
    taxRate: 0.033,
    incomeTaxRate: 0.03,
    residentTaxRate: 0.003,
    deductionItems: [
        { id: 'prevMonthCarryover', label: '\uc804\uc6d4\uc774\uc6d4', order: 1, isActive: true },
        { id: 'accommodation', label: '\uc219\uc18c\ube44', order: 2, isActive: true },
        { id: 'privateRoom', label: '\uac1c\uc778\ubc29', order: 3, isActive: true },
        { id: 'gloves', label: '\uc7a5\uac11', order: 4, isActive: true },
        { id: 'deposit', label: '\ubcf4\uc99d\uae08', order: 5, isActive: true },
        { id: 'fines', label: '\uacfc\ud0dc\ub8cc', order: 6, isActive: true },
        { id: 'electricity', label: '\uc804\uae30\ub8cc', order: 7, isActive: true },
        { id: 'gas', label: '\ub3c4\uc2dc\uac00\uc2a4', order: 8, isActive: true },
        { id: 'internet', label: '\uc778\ud130\ub137', order: 9, isActive: true },
        { id: 'water', label: '\uc218\ub3c4\uc138', order: 10, isActive: true }
    ],
    advanceItemLabels: DEFAULT_ADVANCE_ITEM_LABELS,
    insuranceConfig: {
        thresholdDays: 8,
        pensionRate: 0.045,
        healthRate: 0.03545,
        careRateOfHealth: 0.1295,
        employmentRate: 0.009,
        dailyWorkerFeePerManDay: 0,
        withholdingBaseDeduction: 150000,
        withholdingIncomeBaseMultiplier: 0.55,
        withholdingIncomeTaxRate: 0.06,
        withholdingResidentTaxRate: 0.1,
        withholdingApplyAllLabor: true,
        employmentApplyBelowThreshold: true
    },
    dailyWageStatementPeriod: {
        startDay: 1,
        endDay: 31
    }
};


const nowIso = (): string => new Date().toISOString();

const parseSettingData = (raw: unknown): Record<string, unknown> | null => {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return null;
};

const findPayrollSettingRow = async (): Promise<any | null> => {
    const res = await listSettings();
    const rows = (res as any)?.data?.settings ?? [];
    const found = Array.isArray(rows) ? rows.find((r: any) => String(r?.id) === DOC_ID) : null;
    return found ?? null;
};

const ensurePayrollSettingExists = async (): Promise<void> => {
    const existing = await findPayrollSettingRow();
    if (existing) return;
    await createSetting( {
        id: DOC_ID,
        data: JSON.stringify({
            taxRate: DEFAULT_CONFIG.taxRate,
            incomeTaxRate: DEFAULT_CONFIG.incomeTaxRate,
            residentTaxRate: DEFAULT_CONFIG.residentTaxRate,
            deductionItems: DEFAULT_CONFIG.deductionItems,
            advanceItemLabels: DEFAULT_CONFIG.advanceItemLabels,
            insuranceConfig: DEFAULT_CONFIG.insuranceConfig,
            dailyWageStatementPeriod: DEFAULT_CONFIG.dailyWageStatementPeriod,
            updatedAt: nowIso()
        })
    } as any);
};

const toDateOrUndefined = (value: unknown): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof value === 'object') {
        const obj = value as any;
        const seconds = obj?._seconds ?? obj?.seconds;
        const nanos = obj?._nanoseconds ?? obj?.nanoseconds ?? 0;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return new Date(seconds * 1000 + Math.floor((typeof nanos === 'number' ? nanos : 0) / 1_000_000));
        }
    }
    return undefined;
};

const sanitizeConfig = (raw: unknown): PayrollConfig => {
    if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;

    const obj = raw as Record<string, unknown>;

    const taxRateRaw = obj.taxRate;
    const taxRate = typeof taxRateRaw === 'number' && Number.isFinite(taxRateRaw) && taxRateRaw >= 0 ? taxRateRaw : DEFAULT_CONFIG.taxRate;

    const incomeTaxRateRaw = obj.incomeTaxRate;
    const residentTaxRateRaw = obj.residentTaxRate;

    const derivedIncome = taxRate > 0 ? taxRate / 1.1 : DEFAULT_CONFIG.incomeTaxRate;
    const derivedResident = Math.max(0, taxRate - derivedIncome);

    const incomeTaxRate =
        typeof incomeTaxRateRaw === 'number' && Number.isFinite(incomeTaxRateRaw) && incomeTaxRateRaw >= 0
            ? incomeTaxRateRaw
            : derivedIncome;

    const residentTaxRate =
        typeof residentTaxRateRaw === 'number' && Number.isFinite(residentTaxRateRaw) && residentTaxRateRaw >= 0
            ? residentTaxRateRaw
            : derivedResident;

    const itemsRaw = obj.deductionItems;
    const deductionItems: PayrollDeductionItem[] = Array.isArray(itemsRaw)
        ? itemsRaw
            .map((item): PayrollDeductionItem | null => {
                if (!item || typeof item !== 'object') return null;
                const it = item as Record<string, unknown>;
                const id = typeof it.id === 'string' ? it.id.trim() : '';
                const label = typeof it.label === 'string' ? it.label.trim() : '';
                const order = typeof it.order === 'number' && Number.isFinite(it.order) ? it.order : 0;
                const isActive = typeof it.isActive === 'boolean' ? it.isActive : true;

                if (!id || !label) return null;
                return { id, label, order, isActive };
            })
            .filter((item): item is PayrollDeductionItem => item !== null)
        : DEFAULT_CONFIG.deductionItems;

    const advanceItemLabels = sanitizeAdvanceItemLabels(obj.advanceItemLabels);

    const insuranceRaw = obj.insuranceConfig;
    const insuranceObj = insuranceRaw && typeof insuranceRaw === 'object' ? (insuranceRaw as Record<string, unknown>) : {};

    const thresholdDaysRaw = insuranceObj.thresholdDays;
    const thresholdDays =
        typeof thresholdDaysRaw === 'number' && Number.isFinite(thresholdDaysRaw) && thresholdDaysRaw > 0
            ? Math.floor(thresholdDaysRaw)
            : DEFAULT_CONFIG.insuranceConfig.thresholdDays;

    const pensionRateRaw = insuranceObj.pensionRate;
    const pensionRate =
        typeof pensionRateRaw === 'number' && Number.isFinite(pensionRateRaw) && pensionRateRaw >= 0
            ? pensionRateRaw
            : DEFAULT_CONFIG.insuranceConfig.pensionRate;

    const healthRateRaw = insuranceObj.healthRate;
    const healthRate =
        typeof healthRateRaw === 'number' && Number.isFinite(healthRateRaw) && healthRateRaw >= 0
            ? healthRateRaw
            : DEFAULT_CONFIG.insuranceConfig.healthRate;

    const careRateRaw = insuranceObj.careRateOfHealth;
    const careRateOfHealth =
        typeof careRateRaw === 'number' && Number.isFinite(careRateRaw) && careRateRaw >= 0
            ? careRateRaw
            : DEFAULT_CONFIG.insuranceConfig.careRateOfHealth;

    const employmentRateRaw = insuranceObj.employmentRate;
    const employmentRate =
        typeof employmentRateRaw === 'number' && Number.isFinite(employmentRateRaw) && employmentRateRaw >= 0
            ? employmentRateRaw
            : DEFAULT_CONFIG.insuranceConfig.employmentRate;

    const dailyWorkerFeePerManDayRaw = insuranceObj.dailyWorkerFeePerManDay;
    const dailyWorkerFeePerManDay =
        typeof dailyWorkerFeePerManDayRaw === 'number' && Number.isFinite(dailyWorkerFeePerManDayRaw) && dailyWorkerFeePerManDayRaw >= 0
            ? Math.floor(dailyWorkerFeePerManDayRaw)
            : Math.floor(DEFAULT_CONFIG.insuranceConfig.dailyWorkerFeePerManDay ?? 0);

    const withholdingBaseDeductionRaw = insuranceObj.withholdingBaseDeduction;
    const withholdingBaseDeduction =
        typeof withholdingBaseDeductionRaw === 'number' && Number.isFinite(withholdingBaseDeductionRaw) && withholdingBaseDeductionRaw >= 0
            ? Math.floor(withholdingBaseDeductionRaw)
            : DEFAULT_CONFIG.insuranceConfig.withholdingBaseDeduction;

    const withholdingIncomeBaseMultiplierRaw = insuranceObj.withholdingIncomeBaseMultiplier;
    const withholdingIncomeBaseMultiplier =
        typeof withholdingIncomeBaseMultiplierRaw === 'number' && Number.isFinite(withholdingIncomeBaseMultiplierRaw) && withholdingIncomeBaseMultiplierRaw >= 0
            ? withholdingIncomeBaseMultiplierRaw
            : DEFAULT_CONFIG.insuranceConfig.withholdingIncomeBaseMultiplier;

    const withholdingIncomeTaxRateRaw = insuranceObj.withholdingIncomeTaxRate;
    const withholdingIncomeTaxRate =
        typeof withholdingIncomeTaxRateRaw === 'number' && Number.isFinite(withholdingIncomeTaxRateRaw) && withholdingIncomeTaxRateRaw >= 0
            ? withholdingIncomeTaxRateRaw
            : DEFAULT_CONFIG.insuranceConfig.withholdingIncomeTaxRate;

    const withholdingResidentTaxRateRaw = insuranceObj.withholdingResidentTaxRate;
    const withholdingResidentTaxRate =
        typeof withholdingResidentTaxRateRaw === 'number' && Number.isFinite(withholdingResidentTaxRateRaw) && withholdingResidentTaxRateRaw >= 0
            ? withholdingResidentTaxRateRaw
            : DEFAULT_CONFIG.insuranceConfig.withholdingResidentTaxRate;

    const withholdingApplyAllLaborRaw = insuranceObj.withholdingApplyAllLabor;
    const withholdingApplyAllLabor =
        typeof withholdingApplyAllLaborRaw === 'boolean'
            ? withholdingApplyAllLaborRaw
            : DEFAULT_CONFIG.insuranceConfig.withholdingApplyAllLabor;

    const employmentApplyBelowThresholdRaw = insuranceObj.employmentApplyBelowThreshold;
    const employmentApplyBelowThreshold =
        typeof employmentApplyBelowThresholdRaw === 'boolean'
            ? employmentApplyBelowThresholdRaw
            : DEFAULT_CONFIG.insuranceConfig.employmentApplyBelowThreshold;

    const dailyWageStatementPeriodRaw = obj.dailyWageStatementPeriod;
    const dailyWageStatementPeriodObj =
        dailyWageStatementPeriodRaw && typeof dailyWageStatementPeriodRaw === 'object'
            ? (dailyWageStatementPeriodRaw as Record<string, unknown>)
            : {};

    const startDayRaw = dailyWageStatementPeriodObj.startDay;
    const endDayRaw = dailyWageStatementPeriodObj.endDay;

    const dailyWageStatementPeriod: DailyWageStatementPeriodConfig = {
        startDay:
            typeof startDayRaw === 'number' && Number.isFinite(startDayRaw) && startDayRaw >= 1 && startDayRaw <= 31
                ? Math.floor(startDayRaw)
                : DEFAULT_CONFIG.dailyWageStatementPeriod.startDay,
        endDay:
            typeof endDayRaw === 'number' && Number.isFinite(endDayRaw) && endDayRaw >= 1 && endDayRaw <= 31
                ? Math.floor(endDayRaw)
                : DEFAULT_CONFIG.dailyWageStatementPeriod.endDay
    };

    return {
        taxRate,
        incomeTaxRate,
        residentTaxRate,
        deductionItems,
        advanceItemLabels,
        insuranceConfig: {
            thresholdDays,
            pensionRate,
            healthRate,
            careRateOfHealth,
            employmentRate,
            dailyWorkerFeePerManDay,
            withholdingBaseDeduction,
            withholdingIncomeBaseMultiplier,
            withholdingIncomeTaxRate,
            withholdingResidentTaxRate,
            withholdingApplyAllLabor,
            employmentApplyBelowThreshold
        },
        dailyWageStatementPeriod,
        updatedAt: toDateOrUndefined(obj.updatedAt)
    };
};

export const payrollConfigService = {
    getConfig: async (): Promise<PayrollConfig> => {
        try {
            const row = await findPayrollSettingRow();
            if (!row) {
                try {
                    await ensurePayrollSettingExists();
                } catch (error) {
                    console.error('Failed to create default payroll config:', error);
                }
                return DEFAULT_CONFIG;
            }

            const data = parseSettingData((row as any)?.data) ?? {};
            const patch: Partial<
                Pick<PayrollConfig, 'taxRate' | 'incomeTaxRate' | 'residentTaxRate' | 'deductionItems' | 'advanceItemLabels' | 'insuranceConfig' | 'dailyWageStatementPeriod'>
            > = {};

            if (data.taxRate === undefined) patch.taxRate = DEFAULT_CONFIG.taxRate;
            if ((data as any).incomeTaxRate === undefined) patch.incomeTaxRate = DEFAULT_CONFIG.incomeTaxRate;
            if ((data as any).residentTaxRate === undefined) patch.residentTaxRate = DEFAULT_CONFIG.residentTaxRate;
            if (data.deductionItems === undefined) patch.deductionItems = DEFAULT_CONFIG.deductionItems;
            if ((data as any).advanceItemLabels === undefined) patch.advanceItemLabels = DEFAULT_CONFIG.advanceItemLabels;
            if (data.insuranceConfig === undefined) patch.insuranceConfig = DEFAULT_CONFIG.insuranceConfig;
            if ((data as any).dailyWageStatementPeriod === undefined) patch.dailyWageStatementPeriod = DEFAULT_CONFIG.dailyWageStatementPeriod;

            if (Object.keys(patch).length > 0) {
                try {
                    await updateSetting( {
                        id: DOC_ID,
                        data: JSON.stringify({ ...data, ...patch, updatedAt: nowIso() })
                    } as any);
                } catch (error) {
                    console.error('Failed to backfill payroll config defaults:', error);
                }
            }

            return sanitizeConfig(data);
        } catch (error) {
            console.error('Failed to load payroll config:', error);
            return DEFAULT_CONFIG;
        }
    },

    getConfigFromServer: async (): Promise<PayrollConfig> => {
        return payrollConfigService.getConfig();
    },

    updateTaxRate: async (taxRate: number): Promise<void> => {
        const safe = sanitizeConfig({ taxRate });
        await ensurePayrollSettingExists();
        const row = await findPayrollSettingRow();
        const existing = row ? (parseSettingData((row as any)?.data) ?? {}) : {};
        const derivedIncomeTaxRate = safe.taxRate > 0 ? safe.taxRate / 1.1 : DEFAULT_CONFIG.incomeTaxRate;
        const derivedResidentTaxRate = Math.max(0, safe.taxRate - derivedIncomeTaxRate);

        await updateSetting( {
            id: DOC_ID,
            data: JSON.stringify({
                ...existing,
                taxRate: safe.taxRate,
                incomeTaxRate: derivedIncomeTaxRate,
                residentTaxRate: derivedResidentTaxRate,
                updatedAt: nowIso()
            })
        } as any);
    },

    updateDeductionItems: async (deductionItems: PayrollDeductionItem[]): Promise<void> => {
        const safe = sanitizeConfig({ deductionItems });
        await ensurePayrollSettingExists();
        const row = await findPayrollSettingRow();
        const existing = row ? (parseSettingData((row as any)?.data) ?? {}) : {};
        await updateSetting( {
            id: DOC_ID,
            data: JSON.stringify({ ...existing, deductionItems: safe.deductionItems, updatedAt: nowIso() })
        } as any);
    },

    updateAdvanceItemLabels: async (advanceItemLabels: Partial<AdvanceItemLabelsConfig>): Promise<void> => {
        const safe = sanitizeAdvanceItemLabels(advanceItemLabels);
        await ensurePayrollSettingExists();
        const row = await findPayrollSettingRow();
        const existing = row ? (parseSettingData((row as any)?.data) ?? {}) : {};
        await updateSetting( {
            id: DOC_ID,
            data: JSON.stringify({ ...existing, advanceItemLabels: safe, updatedAt: nowIso() })
        } as any);
    },

    updateInsuranceConfig: async (insuranceConfig: PayrollInsuranceConfig): Promise<void> => {
        const safe = sanitizeConfig({ insuranceConfig });
        await ensurePayrollSettingExists();
        const row = await findPayrollSettingRow();
        const existing = row ? (parseSettingData((row as any)?.data) ?? {}) : {};
        await updateSetting( {
            id: DOC_ID,
            data: JSON.stringify({ ...existing, insuranceConfig: safe.insuranceConfig, updatedAt: nowIso() })
        } as any);
    },

    updateDailyWageStatementPeriod: async (dailyWageStatementPeriod: DailyWageStatementPeriodConfig): Promise<void> => {
        const safe = sanitizeConfig({ dailyWageStatementPeriod });
        await ensurePayrollSettingExists();
        const row = await findPayrollSettingRow();
        const existing = row ? (parseSettingData((row as any)?.data) ?? {}) : {};
        await updateSetting( {
            id: DOC_ID,
            data: JSON.stringify({ ...existing, dailyWageStatementPeriod: safe.dailyWageStatementPeriod, updatedAt: nowIso() })
        } as any);
    },

    saveConfig: async (config: PayrollConfig): Promise<void> => {
        const safeConfig = sanitizeConfig(config);
        const payload = {
            taxRate: safeConfig.taxRate,
            incomeTaxRate: safeConfig.incomeTaxRate,
            residentTaxRate: safeConfig.residentTaxRate,
            deductionItems: safeConfig.deductionItems,
            advanceItemLabels: safeConfig.advanceItemLabels,
            insuranceConfig: safeConfig.insuranceConfig,
            dailyWageStatementPeriod: safeConfig.dailyWageStatementPeriod,
            updatedAt: nowIso()
        };

        await ensurePayrollSettingExists();
        const row = await findPayrollSettingRow();
        if (row) {
            await updateSetting( { id: DOC_ID, data: JSON.stringify(payload) } as any);
        } else {
            await createSetting( { id: DOC_ID, data: JSON.stringify(payload) } as any);
        }
    }
};
