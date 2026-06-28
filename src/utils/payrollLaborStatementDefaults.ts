export type SharedLaborStatementPayType = 'direct' | 'delegate';
export type StatementIssueOptionPreset = 'beforeIssue' | 'afterIssue';

export const STATEMENT_ISSUE_OPTION_PRESETS: Array<{ value: StatementIssueOptionPreset; label: string }> = [
    { value: 'beforeIssue', label: '발행전' },
    { value: 'afterIssue', label: '발행후' },
];

export const DEFAULT_STATEMENT_ISSUE_OPTION_PRESET: StatementIssueOptionPreset = 'beforeIssue';

export interface SharedLaborStatementDefaults {
    showBankColumn: boolean;
    showBillingColumns: boolean;
    isSplitView: boolean;
    showBankUnderAddress: boolean;
    showTeamUnderName: boolean;
    unitPriceOverride: number;
    defaultPayType: SharedLaborStatementPayType;
    useWorkerMasterPayType: boolean;
    workerPayTypes: Record<string, SharedLaborStatementPayType>;
    delegateBankName: string;
    delegateAccountHolder: string;
    delegateAccountNumber: string;
}

export interface SharedLaborStatementWorkerIdentity {
    workerId?: unknown;
    workerName?: unknown;
}

export interface SharedLaborStatementWorkerPayTypeSource extends SharedLaborStatementWorkerIdentity {
    laborStatementPayType?: unknown;
    workerLaborStatementPayType?: unknown;
    laborPayType?: unknown;
    paymentDelegationType?: unknown;
}

const STORAGE_KEY = 'payroll-labor-statement-defaults';
const ISSUE_PRESET_STORAGE_PREFIX = 'payroll-labor-statement-issue-presets-v1';
const SELECTED_ISSUE_PRESET_STORAGE_KEY = 'payroll-statement-selected-issue-preset';

export const DEFAULT_LABOR_STATEMENT_DEFAULTS: SharedLaborStatementDefaults = {
    showBankColumn: true,
    showBillingColumns: true,
    isSplitView: true,
    showBankUnderAddress: false,
    showTeamUnderName: false,
    unitPriceOverride: 0,
    defaultPayType: 'direct',
    useWorkerMasterPayType: true,
    workerPayTypes: {},
    delegateBankName: '',
    delegateAccountHolder: '',
    delegateAccountNumber: '',
};

const cleanString = (value: unknown): string => String(value ?? '').trim();

const cleanMoney = (value: unknown): number => {
    const parsed = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

export const normalizeLaborStatementPayType = (value: unknown): SharedLaborStatementPayType | undefined => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return undefined;
    if (raw === 'delegate' || raw === 'delegated' || raw.includes('위임')) return 'delegate';
    if (raw === 'direct' || raw.includes('직불')) return 'direct';
    return undefined;
};

const cleanPayType = (value: unknown): SharedLaborStatementPayType =>
    normalizeLaborStatementPayType(value) ?? 'direct';

const normalizeIdentityValue = (value: unknown): string =>
    String(value ?? '').replace(/\s+/g, '').trim().toLocaleLowerCase('ko-KR');

export const getLaborStatementWorkerIdentityKeys = (
    worker: SharedLaborStatementWorkerIdentity
): string[] => {
    const keys: string[] = [];
    const workerId = String(worker.workerId ?? '').trim();
    const workerName = normalizeIdentityValue(worker.workerName);
    if (workerId) keys.push(`worker-id:${workerId}`);
    if (workerName) keys.push(`worker-name:${workerName}`);
    return keys;
};

const cleanWorkerPayTypes = (value: unknown): Record<string, SharedLaborStatementPayType> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
        Object.entries(value)
            .map(([key, payType]) => [cleanString(key), cleanPayType(payType)])
            .filter(([key]) => key)
    );
};

export const getLaborStatementWorkerPayType = (
    workerPayTypes: Record<string, SharedLaborStatementPayType>,
    worker: SharedLaborStatementWorkerIdentity
): SharedLaborStatementPayType | undefined => {
    const keys = getLaborStatementWorkerIdentityKeys(worker);
    return keys.map((key) => workerPayTypes[key]).find(Boolean);
};

export const getWorkerMasterLaborStatementPayType = (
    worker?: SharedLaborStatementWorkerPayTypeSource | null
): SharedLaborStatementPayType | undefined => {
    if (!worker) return undefined;
    return normalizeLaborStatementPayType(
        worker.laborStatementPayType ??
        worker.workerLaborStatementPayType ??
        worker.laborPayType ??
        worker.paymentDelegationType
    );
};

export const buildLaborStatementWorkerPayTypePatch = (
    workers: SharedLaborStatementWorkerIdentity[],
    payType: SharedLaborStatementPayType
): Record<string, SharedLaborStatementPayType> =>
    workers.reduce<Record<string, SharedLaborStatementPayType>>((acc, worker) => {
        getLaborStatementWorkerIdentityKeys(worker).forEach((key) => {
            acc[key] = payType;
        });
        return acc;
    }, {});

const normalizeDefaults = (value: unknown): SharedLaborStatementDefaults => {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<SharedLaborStatementDefaults>
        : {};

    return {
        showBankColumn: typeof raw.showBankColumn === 'boolean' ? raw.showBankColumn : DEFAULT_LABOR_STATEMENT_DEFAULTS.showBankColumn,
        showBillingColumns: typeof raw.showBillingColumns === 'boolean' ? raw.showBillingColumns : DEFAULT_LABOR_STATEMENT_DEFAULTS.showBillingColumns,
        isSplitView: typeof raw.isSplitView === 'boolean' ? raw.isSplitView : DEFAULT_LABOR_STATEMENT_DEFAULTS.isSplitView,
        showBankUnderAddress: typeof raw.showBankUnderAddress === 'boolean' ? raw.showBankUnderAddress : DEFAULT_LABOR_STATEMENT_DEFAULTS.showBankUnderAddress,
        showTeamUnderName: typeof raw.showTeamUnderName === 'boolean' ? raw.showTeamUnderName : DEFAULT_LABOR_STATEMENT_DEFAULTS.showTeamUnderName,
        unitPriceOverride: cleanMoney(raw.unitPriceOverride),
        defaultPayType: cleanPayType(raw.defaultPayType),
        useWorkerMasterPayType: typeof raw.useWorkerMasterPayType === 'boolean' ? raw.useWorkerMasterPayType : DEFAULT_LABOR_STATEMENT_DEFAULTS.useWorkerMasterPayType,
        workerPayTypes: cleanWorkerPayTypes(raw.workerPayTypes),
        delegateBankName: cleanString(raw.delegateBankName),
        delegateAccountHolder: cleanString(raw.delegateAccountHolder),
        delegateAccountNumber: cleanString(raw.delegateAccountNumber),
    };
};

export const loadLaborStatementDefaults = (): SharedLaborStatementDefaults => {
    if (typeof window === 'undefined') return DEFAULT_LABOR_STATEMENT_DEFAULTS;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? normalizeDefaults(JSON.parse(raw)) : DEFAULT_LABOR_STATEMENT_DEFAULTS;
    } catch (error) {
        console.warn('[LaborStatementDefaults] load failed:', error);
        return DEFAULT_LABOR_STATEMENT_DEFAULTS;
    }
};

export const saveLaborStatementDefaults = (nextDefaults: Partial<SharedLaborStatementDefaults>): void => {
    if (typeof window === 'undefined') return;

    try {
        const current = loadLaborStatementDefaults();
        const merged = normalizeDefaults({
            ...current,
            ...nextDefaults,
            workerPayTypes: {
                ...current.workerPayTypes,
                ...nextDefaults.workerPayTypes,
            },
        });
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (error) {
        console.warn('[LaborStatementDefaults] save failed:', error);
    }
};

const isStatementIssueOptionPreset = (value: unknown): value is StatementIssueOptionPreset =>
    value === 'beforeIssue' || value === 'afterIssue';

const getIssuePresetStorageKey = (preset: StatementIssueOptionPreset): string =>
    `${ISSUE_PRESET_STORAGE_PREFIX}:${preset}`;

const getLaborStatementPresetBaseDefaults = (
    preset: StatementIssueOptionPreset
): SharedLaborStatementDefaults => ({
    ...DEFAULT_LABOR_STATEMENT_DEFAULTS,
    showBankColumn: preset === 'afterIssue',
    showBillingColumns: preset === 'afterIssue',
    isSplitView: true,
    showBankUnderAddress: false,
    showTeamUnderName: false,
    useWorkerMasterPayType: false,
});

export const loadStatementIssueOptionPreset = (): StatementIssueOptionPreset => {
    if (typeof window === 'undefined') return DEFAULT_STATEMENT_ISSUE_OPTION_PRESET;

    try {
        const raw = window.localStorage.getItem(SELECTED_ISSUE_PRESET_STORAGE_KEY);
        return isStatementIssueOptionPreset(raw) ? raw : DEFAULT_STATEMENT_ISSUE_OPTION_PRESET;
    } catch (error) {
        console.warn('[LaborStatementDefaults] selected issue preset load failed:', error);
        return DEFAULT_STATEMENT_ISSUE_OPTION_PRESET;
    }
};

export const saveStatementIssueOptionPreset = (preset: StatementIssueOptionPreset): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(SELECTED_ISSUE_PRESET_STORAGE_KEY, preset);
    } catch (error) {
        console.warn('[LaborStatementDefaults] selected issue preset save failed:', error);
    }
};

export const loadLaborStatementPresetDefaults = (
    preset: StatementIssueOptionPreset = loadStatementIssueOptionPreset()
): SharedLaborStatementDefaults => {
    const baseDefaults = getLaborStatementPresetBaseDefaults(preset);
    if (typeof window === 'undefined') return baseDefaults;

    try {
        const raw = window.localStorage.getItem(getIssuePresetStorageKey(preset));
        return raw ? normalizeDefaults({ ...baseDefaults, ...JSON.parse(raw) }) : baseDefaults;
    } catch (error) {
        console.warn('[LaborStatementDefaults] issue preset load failed:', error);
        return baseDefaults;
    }
};

export const saveLaborStatementPresetDefaults = (
    preset: StatementIssueOptionPreset,
    nextDefaults: Partial<SharedLaborStatementDefaults>
): void => {
    if (typeof window === 'undefined') return;

    try {
        const current = loadLaborStatementPresetDefaults(preset);
        const merged = normalizeDefaults({
            ...current,
            ...nextDefaults,
            workerPayTypes: {
                ...current.workerPayTypes,
                ...nextDefaults.workerPayTypes,
            },
        });
        window.localStorage.setItem(getIssuePresetStorageKey(preset), JSON.stringify(merged));
        saveStatementIssueOptionPreset(preset);
    } catch (error) {
        console.warn('[LaborStatementDefaults] issue preset save failed:', error);
    }
};
