export type AiModelScope = 'textModel' | 'analyticsModel' | 'imageModel' | 'server';

export interface AiModelSettings {
    textModel: string;
    analyticsModel: string;
    imageModel: string;
}

export interface AiManagedPage {
    id: string;
    name: string;
    description: string;
    paths: string[];
    modelScope: AiModelScope;
}

export interface AiSettingsState {
    models: AiModelSettings;
    pageEnabledById: Record<string, boolean>;
    updatedAt: string;
}

type AiSettingsPatch = {
    models?: Partial<AiModelSettings>;
    pageEnabledById?: Record<string, boolean>;
    updatedAt?: string;
};

export interface AiModelBinding {
    id: string;
    service: string;
    model: string;
    source: AiModelScope;
    note: string;
}

const AI_SETTINGS_STORAGE_KEY = 'cy_ai_settings_v1';
const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';

const getEnvironmentApiKey = (): string => {
    return String(
        process.env.REACT_APP_GEMINI_API_KEY ||
        process.env.REACT_APP_GOOGLE_API_KEY ||
        ''
    ).trim();
};

const DEPRECATED_GEMINI_MODEL_REPLACEMENTS: Record<string, string> = {
    'gemini-2.0-flash': 'gemini-2.5-flash',
    'gemini-2.0-flash-001': 'gemini-2.5-flash',
    'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite-001': 'gemini-2.5-flash-lite',
    'gemini-2.0-flash-preview-image-generation': 'gemini-2.5-flash-image',
    'gemini-2.0-flash-lite-preview': 'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite-preview-02-05': 'gemini-2.5-flash-lite',
    'gemini-2.5-flash-preview-05-20': 'gemini-2.5-flash',
    'gemini-2.5-flash-preview-09-25': 'gemini-2.5-flash',
    'gemini-2.5-flash-lite-preview-09-2025': 'gemini-2.5-flash-lite',
    'gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image'
};

export const normalizeGeminiModelName = (model: string | null | undefined, fallback = 'gemini-2.5-flash'): string => {
    const trimmed = String(model || fallback).trim().replace(/^models\//, '');
    return DEPRECATED_GEMINI_MODEL_REPLACEMENTS[trimmed] || trimmed || fallback;
};

export const AI_TEXT_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (권장)' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }
];

export const AI_IMAGE_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (권장)' }
];

export const AI_MANAGED_PAGES: AiManagedPage[] = [
    {
        id: 'reports-daily',
        name: '일보 관리',
        description: '카카오 텍스트/이미지 기반 일보 자동 분석',
        paths: ['/reports/daily'],
        modelScope: 'textModel'
    },
    {
        id: 'reports-daily-v2',
        name: '일보 V2',
        description: '카카오 이미지 일보 분석',
        paths: ['/reports/daily-v2'],
        modelScope: 'textModel'
    },
    {
        id: 'report-excel',
        name: '일보 스마트 입력(엑셀)',
        description: '텍스트 기반 일보 구조화 분석',
        paths: ['/report/excel'],
        modelScope: 'textModel'
    },
    {
        id: 'manpower-bulk',
        name: '작업자 그리드 등록',
        description: '작업자 등록 텍스트 분석',
        paths: ['/manpower/smart-registration-grid'],
        modelScope: 'textModel'
    },
    {
        id: 'worker-registration',
        name: '근로자 등록/관리',
        description: '신분증/통장 OCR 분석',
        paths: ['/jeonkuk/worker-registration', '/manpower/smart-registration', '/database/manpower-db'],
        modelScope: 'textModel'
    },
    {
        id: 'reports-statistics',
        name: '일보 통계 AI 분석',
        description: '자연어 기반 통계 질의/인사이트 생성',
        paths: ['/reports/statistics'],
        modelScope: 'analyticsModel'
    },
    {
        id: 'gallery-ai-images',
        name: 'AI 이미지 스튜디오',
        description: 'Gemini 이미지 생성',
        paths: ['/gallery/ai-images'],
        modelScope: 'imageModel'
    },
    {
        id: 'kakao-message-center',
        name: '카카오 메시지 센터',
        description: '친구톡 AI 이미지 생성',
        paths: ['/payroll/kakao-message-center'],
        modelScope: 'imageModel'
    },
    {
        id: 'estimate-drawing-ai',
        name: '도면 AI 견적',
        description: 'PDF/이미지 도면 Gemini 분석 및 시스템동바리/시스템비계 산출',
        paths: ['/estimate/drawing-ai'],
        modelScope: 'textModel'
    },
    {
        id: 'support-card-billing',
        name: '법인카드 청구관리',
        description: '첨부 문서 Gemini 분석(Cloud Function)',
        paths: ['/support/cards'],
        modelScope: 'server'
    },
    {
        id: 'admin-agent',
        name: '관리자 에이전트 도구',
        description: '에이전트 대화형 보조 분석',
        paths: ['/admin/agent-dashboard', '/admin/agent-playground'],
        modelScope: 'textModel'
    }
];

const DEFAULT_MODELS: AiModelSettings = {
    textModel: 'gemini-2.5-flash',
    analyticsModel: 'gemini-2.5-flash',
    imageModel: 'gemini-2.5-flash-image'
};

const normalizeModels = (models?: Partial<AiModelSettings> | null): AiModelSettings => ({
    textModel: normalizeGeminiModelName(models?.textModel, DEFAULT_MODELS.textModel),
    analyticsModel: normalizeGeminiModelName(models?.analyticsModel, DEFAULT_MODELS.analyticsModel),
    imageModel: normalizeGeminiModelName(models?.imageModel, DEFAULT_MODELS.imageModel)
});

const buildDefaultPageEnabledById = (): Record<string, boolean> => {
    return AI_MANAGED_PAGES.reduce<Record<string, boolean>>((acc, page) => {
        acc[page.id] = true;
        return acc;
    }, {});
};

const normalizePathname = (path: string): string => {
    const raw = String(path || '/').split('?')[0].split('#')[0];
    if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1);
    return raw || '/';
};

const mergeSettings = (raw?: Partial<AiSettingsState> | null): AiSettingsState => {
    const defaults: AiSettingsState = {
        models: DEFAULT_MODELS,
        pageEnabledById: buildDefaultPageEnabledById(),
        updatedAt: new Date().toISOString()
    };

    if (!raw) return defaults;

    return {
        models: normalizeModels(raw.models),
        pageEnabledById: {
            ...defaults.pageEnabledById,
            ...(raw.pageEnabledById || {})
        },
        updatedAt: raw.updatedAt || defaults.updatedAt
    };
};

const readSettings = (): AiSettingsState => {
    try {
        const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
        if (!raw) return mergeSettings();
        return mergeSettings(JSON.parse(raw) as Partial<AiSettingsState>);
    } catch {
        return mergeSettings();
    }
};

const writeSettings = (settings: AiSettingsState): void => {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

const findManagedPageByPath = (pathname: string): AiManagedPage | undefined => {
    const normalized = normalizePathname(pathname);
    let found: AiManagedPage | undefined;
    let bestLength = -1;

    AI_MANAGED_PAGES.forEach((page) => {
        page.paths.forEach((pathPattern) => {
            const normalizedPattern = normalizePathname(pathPattern);
            const isExact = normalized === normalizedPattern;
            const isChild = normalized.startsWith(`${normalizedPattern}/`);
            if (!(isExact || isChild)) return;
            if (normalizedPattern.length <= bestLength) return;
            bestLength = normalizedPattern.length;
            found = page;
        });
    });

    return found;
};

const getModelByScope = (models: AiModelSettings, scope: AiModelScope): string => {
    if (scope === 'textModel') return normalizeGeminiModelName(models.textModel, DEFAULT_MODELS.textModel);
    if (scope === 'analyticsModel') return normalizeGeminiModelName(models.analyticsModel, DEFAULT_MODELS.analyticsModel);
    if (scope === 'imageModel') return normalizeGeminiModelName(models.imageModel, DEFAULT_MODELS.imageModel);
    return 'server-managed';
};

export const aiSettingsService = {
    getManagedPages(): AiManagedPage[] {
        return [...AI_MANAGED_PAGES];
    },

    getSettings(): AiSettingsState {
        return readSettings();
    },

    saveSettings(next: AiSettingsPatch): AiSettingsState {
        const current = readSettings();
        const merged = mergeSettings({
            ...current,
            ...next,
            models: {
                ...current.models,
                ...(next.models || {})
            },
            pageEnabledById: {
                ...current.pageEnabledById,
                ...(next.pageEnabledById || {})
            },
            updatedAt: new Date().toISOString()
        });
        writeSettings(merged);
        return merged;
    },

    getModels(): AiModelSettings {
        return readSettings().models;
    },

    setModels(models: Partial<AiModelSettings>): AiModelSettings {
        const next = this.saveSettings({ models }).models;
        return next;
    },

    getApiKey(): string {
        const storedKey = String(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '').trim();
        return storedKey || getEnvironmentApiKey();
    },

    setApiKey(key: string): void {
        const trimmed = String(key || '').trim();
        if (!trimmed) {
            localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
            return;
        }
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    },

    getPageEnabledById(): Record<string, boolean> {
        return { ...readSettings().pageEnabledById };
    },

    setPageEnabledById(map: Record<string, boolean>): Record<string, boolean> {
        return this.saveSettings({ pageEnabledById: map }).pageEnabledById;
    },

    setPageEnabled(pageId: string, enabled: boolean): Record<string, boolean> {
        return this.saveSettings({ pageEnabledById: { [pageId]: enabled } }).pageEnabledById;
    },

    isPageEnabled(pageId: string): boolean {
        const enabledMap = readSettings().pageEnabledById;
        return enabledMap[pageId] !== false;
    },

    getPageByPath(pathname: string): AiManagedPage | undefined {
        return findManagedPageByPath(pathname);
    },

    isPathEnabled(pathname: string): boolean {
        const page = findManagedPageByPath(pathname);
        if (!page) return true;
        return this.isPageEnabled(page.id);
    },

    assertPathEnabled(pathname: string, featureLabel = 'AI 기능'): void {
        const page = findManagedPageByPath(pathname);
        if (!page) return;
        if (this.isPageEnabled(page.id)) return;
        throw new Error(`${page.name} 페이지의 ${featureLabel}이(가) 비활성화되어 있습니다. /settings/ai 에서 활성화하세요.`);
    },

    assertCurrentPageEnabled(featureLabel = 'AI 기능'): void {
        if (typeof window === 'undefined') return;
        this.assertPathEnabled(window.location.pathname, featureLabel);
    },

    getCurrentModelBindings(): AiModelBinding[] {
        const models = this.getModels();
        return [
            {
                id: 'binding-gemini-service',
                service: 'geminiService (문서/텍스트/이미지 분석)',
                model: models.textModel,
                source: 'textModel',
                note: '일보/신분증/통장/작업자 등록 분석에 사용'
            },
            {
                id: 'binding-analytics-agent',
                service: 'analyticsAgent + agentOrchestrator',
                model: models.textModel,
                source: 'textModel',
                note: '관리자 에이전트 일반 대화/인사이트 생성에 사용'
            },
            {
                id: 'binding-gemini-analytics',
                service: 'geminiAnalyticsService',
                model: models.analyticsModel,
                source: 'analyticsModel',
                note: '일보 통계 질의 파싱/인사이트 생성'
            },
            {
                id: 'binding-gemini-image',
                service: 'geminiImageService',
                model: models.imageModel,
                source: 'imageModel',
                note: 'AI 이미지 스튜디오/카카오 메시지용 이미지 생성'
            },
            {
                id: 'binding-card-billing',
                service: 'CardBillingManager (Cloud Function)',
                model: 'server-managed',
                source: 'server',
                note: '서버 함수 내부 모델 정책 사용'
            }
        ];
    },

    resolveModelForPage(page: AiManagedPage): string {
        const models = this.getModels();
        return getModelByScope(models, page.modelScope);
    }
};
