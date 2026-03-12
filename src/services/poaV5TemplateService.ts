import { listSettings, createSetting, updateSetting } from './firestoreCrudCompat';

export type PoaV5MappingDocItem = {
    schemaVersion: number;
    updatedAt: string;
    templatePath?: string;
    mappingJson: string;
};

export type PoaV5MappingsDoc = Record<string, PoaV5MappingDocItem>;

const DOC_ID = 'poa_v5_mappings_v1';
const SCHEMA_VERSION = 1;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const safeJsonParse = <T>(raw: unknown): T | null => {
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const listSettingsMap = async (): Promise<Map<string, string>> => {
    const res = await listSettings();
    const rows = (res as any)?.data?.settings ?? [];
    const map = new Map<string, string>();
    rows.forEach((r: any) => {
        const id = r?.id ? String(r.id) : '';
        const data = typeof r?.data === 'string' ? r.data : '';
        if (id) map.set(id, data);
    });
    return map;
};

const upsertSettingData = async (id: string, dataObj: any) => {
    const data = JSON.stringify(dataObj);
    try {
        await updateSetting({ id, data } as any);
        return true;
    } catch (err) {
        await createSetting({ id, data } as any);
        return true;
    }
};

const loadDoc = async (): Promise<PoaV5MappingsDoc> => {
    const settings = await listSettingsMap();
    const raw = settings.get(DOC_ID);
    const parsed = safeJsonParse<any>(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PoaV5MappingsDoc;
};

export const poaV5TemplateService = {
    getDocId: () => DOC_ID,

    loadAll: async (): Promise<PoaV5MappingsDoc> => {
        const doc = await loadDoc();
        return deepClone(doc);
    },

    loadSiteMapping: async (siteKey: string): Promise<PoaV5MappingDocItem | null> => {
        const key = String(siteKey || '').trim();
        if (!key) return null;
        const doc = await loadDoc();
        const item = (doc as any)?.[key];
        if (!item || typeof item !== 'object') return null;

        const mappingJson = typeof item.mappingJson === 'string' ? item.mappingJson : '';
        const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : '';
        const schemaVersion = typeof item.schemaVersion === 'number' ? item.schemaVersion : SCHEMA_VERSION;
        const templatePath = typeof item.templatePath === 'string' ? item.templatePath : undefined;

        return {
            schemaVersion,
            updatedAt,
            templatePath,
            mappingJson
        };
    },

    saveSiteMapping: async (siteKey: string, next: { mappingJson: string; templatePath?: string }): Promise<void> => {
        const key = String(siteKey || '').trim();
        if (!key) throw new Error('siteKey is required');

        const doc = await loadDoc();
        const prev = (doc as any)?.[key] && typeof (doc as any)[key] === 'object' ? (doc as any)[key] : {};

        const payload: PoaV5MappingDocItem = {
            schemaVersion: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            templatePath: typeof next.templatePath === 'string' ? next.templatePath : (typeof prev.templatePath === 'string' ? prev.templatePath : undefined),
            mappingJson: typeof next.mappingJson === 'string' ? next.mappingJson : (typeof prev.mappingJson === 'string' ? prev.mappingJson : '')
        };

        const updated: PoaV5MappingsDoc = {
            ...(doc as any),
            [key]: payload
        };

        await upsertSettingData(DOC_ID, updated);
    }
};

