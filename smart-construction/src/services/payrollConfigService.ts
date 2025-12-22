import { db } from '../config/firebase';
import { doc, getDoc, getDocFromServer, setDoc, Timestamp } from 'firebase/firestore';

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
}

export interface PayrollConfig {
    taxRate: number; // 0.033 = 3.3%
    deductionItems: PayrollDeductionItem[];
    insuranceConfig: PayrollInsuranceConfig;
    updatedAt?: Date;
}

const COLLECTION_NAME = 'settings';
const DOC_ID = 'payroll_config_v1';

const DEFAULT_CONFIG: PayrollConfig = {
    taxRate: 0.033,
    deductionItems: [
        { id: 'prevMonthCarryover', label: '전월이월', order: 1, isActive: true },
        { id: 'accommodation', label: '숙소비', order: 2, isActive: true },
        { id: 'privateRoom', label: '개인방', order: 3, isActive: true },
        { id: 'gloves', label: '장갑', order: 4, isActive: true },
        { id: 'deposit', label: '보증금', order: 5, isActive: true },
        { id: 'fines', label: '과태료', order: 6, isActive: true },
        { id: 'electricity', label: '전기료', order: 7, isActive: true },
        { id: 'gas', label: '도시가스', order: 8, isActive: true },
        { id: 'internet', label: '인터넷', order: 9, isActive: true },
        { id: 'water', label: '수도세', order: 10, isActive: true }
    ],
    insuranceConfig: {
        thresholdDays: 8,
        pensionRate: 0.045,
        healthRate: 0.03545,
        careRateOfHealth: 0.1295,
        employmentRate: 0.009
    }
};

const toDateOrUndefined = (value: unknown): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    return undefined;
};

const sanitizeConfig = (raw: unknown): PayrollConfig => {
    if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;

    const obj = raw as Record<string, unknown>;

    const taxRateRaw = obj.taxRate;
    const taxRate = typeof taxRateRaw === 'number' && Number.isFinite(taxRateRaw) && taxRateRaw >= 0 ? taxRateRaw : DEFAULT_CONFIG.taxRate;

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

    return {
        taxRate,
        deductionItems,
        insuranceConfig: {
            thresholdDays,
            pensionRate,
            healthRate,
            careRateOfHealth,
            employmentRate
        },
        updatedAt: toDateOrUndefined(obj.updatedAt)
    };
};

export const payrollConfigService = {
    getConfig: async (): Promise<PayrollConfig> => {
        try {
            const ref = doc(db, COLLECTION_NAME, DOC_ID);
            const snapshot = await getDoc(ref);
            if (!snapshot.exists()) {
                try {
                    await setDoc(
                        ref,
                        {
                            taxRate: DEFAULT_CONFIG.taxRate,
                            deductionItems: DEFAULT_CONFIG.deductionItems,
                            insuranceConfig: DEFAULT_CONFIG.insuranceConfig,
                            updatedAt: Timestamp.now()
                        },
                        { merge: true }
                    );
                } catch (error) {
                    console.error('Failed to create default payroll config:', error);
                }

                return DEFAULT_CONFIG;
            }

            const data = snapshot.data() as Record<string, unknown>;
            const patch: Partial<Pick<PayrollConfig, 'taxRate' | 'deductionItems' | 'insuranceConfig'>> = {};

            if (data.taxRate === undefined) patch.taxRate = DEFAULT_CONFIG.taxRate;
            if (data.deductionItems === undefined) patch.deductionItems = DEFAULT_CONFIG.deductionItems;
            if (data.insuranceConfig === undefined) patch.insuranceConfig = DEFAULT_CONFIG.insuranceConfig;

            if (Object.keys(patch).length > 0) {
                try {
                    await setDoc(ref, { ...patch, updatedAt: Timestamp.now() }, { merge: true });
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
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const snapshot = await getDocFromServer(ref);
        if (!snapshot.exists()) {
            try {
                await setDoc(
                    ref,
                    {
                        taxRate: DEFAULT_CONFIG.taxRate,
                        deductionItems: DEFAULT_CONFIG.deductionItems,
                        insuranceConfig: DEFAULT_CONFIG.insuranceConfig,
                        updatedAt: Timestamp.now()
                    },
                    { merge: true }
                );
            } catch (error) {
                console.error('Failed to create default payroll config:', error);
            }

            return DEFAULT_CONFIG;
        }

        const data = snapshot.data() as Record<string, unknown>;
        const patch: Partial<Pick<PayrollConfig, 'taxRate' | 'deductionItems' | 'insuranceConfig'>> = {};

        if (data.taxRate === undefined) patch.taxRate = DEFAULT_CONFIG.taxRate;
        if (data.deductionItems === undefined) patch.deductionItems = DEFAULT_CONFIG.deductionItems;
        if (data.insuranceConfig === undefined) patch.insuranceConfig = DEFAULT_CONFIG.insuranceConfig;

        if (Object.keys(patch).length > 0) {
            try {
                await setDoc(ref, { ...patch, updatedAt: Timestamp.now() }, { merge: true });
            } catch (error) {
                console.error('Failed to backfill payroll config defaults:', error);
            }
        }

        return sanitizeConfig(data);
    },

    updateTaxRate: async (taxRate: number): Promise<void> => {
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const safe = sanitizeConfig({ taxRate });
        await setDoc(
            ref,
            {
                taxRate: safe.taxRate,
                updatedAt: Timestamp.now()
            },
            { merge: true }
        );
    },

    updateDeductionItems: async (deductionItems: PayrollDeductionItem[]): Promise<void> => {
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const safe = sanitizeConfig({ deductionItems });
        await setDoc(
            ref,
            {
                deductionItems: safe.deductionItems,
                updatedAt: Timestamp.now()
            },
            { merge: true }
        );
    },

    updateInsuranceConfig: async (insuranceConfig: PayrollInsuranceConfig): Promise<void> => {
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const safe = sanitizeConfig({ insuranceConfig });
        await setDoc(
            ref,
            {
                insuranceConfig: safe.insuranceConfig,
                updatedAt: Timestamp.now()
            },
            { merge: true }
        );
    },

    saveConfig: async (config: PayrollConfig): Promise<void> => {
        const safeConfig = sanitizeConfig(config);
        const ref = doc(db, COLLECTION_NAME, DOC_ID);

        const payload = {
            taxRate: safeConfig.taxRate,
            deductionItems: safeConfig.deductionItems,
            insuranceConfig: safeConfig.insuranceConfig,
            updatedAt: Timestamp.now()
        };

        await setDoc(ref, payload, { merge: true });
    }
};
