import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSetting, listSettings, updateSetting } from '../dataconnect-generated';

export interface ComponentConfig {
    id: string;
    name: string;
    description?: string;
    category: 'WIDGET' | 'FEATURE' | 'PAGE_SECTION';
    isEnabled: boolean;
    allowedRoles?: string[]; // If empty, all roles allowed (unless restricted by isEnabled)
}

// Initial Registry of Components to Manage
export const COMPONENT_REGISTRY: ComponentConfig[] = [
    { id: 'weather-widget', name: 'Weather Widget', category: 'WIDGET', isEnabled: true, description: 'Dashboard weather display' },
    { id: 'worker-table', name: 'Manpower Table', category: 'PAGE_SECTION', isEnabled: true, description: 'Main worker list table' },
    { id: 'bulk-upload-btn', name: 'Bulk Upload Button', category: 'FEATURE', isEnabled: true, description: 'Button to upload Excel/Images' },
    { id: 'ai-analysis', name: 'AI Analysis', category: 'FEATURE', isEnabled: true, description: 'Gemini AI integration features' },
];

const dc = getDataConnect(app, connectorConfig);
const SETTING_ID = 'system_components';

const safeJsonParse = (value: unknown): any => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
};

const safeJsonStringify = (value: any): string => {
    try {
        return JSON.stringify(value ?? {});
    } catch {
        return '{}';
    }
};

class ComponentService {
    private configs: Map<string, ComponentConfig> = new Map();
    private listeners: Function[] = [];
    private pollHandle: number | null = null;

    constructor() {
        this.initializeRegistry();
        void this.refreshFromDataConnect();
        this.subscribeToUpdates();
    }

    // Ensure all registry items exist in DB
    private async initializeRegistry() {
        // We don't await this to avoid blocking app init, but in real app we might
        // Check if exists, if not create
        // To save reads, we could just setMerge, but we want to respect DB state over Registry default
        // usually.
        // For now, let's just listen. If missing in DB, we use Registry default.
    }

    private subscribeToUpdates() {
        if (typeof window === 'undefined') return;
        if (this.pollHandle != null) return;
        this.pollHandle = window.setInterval(() => {
            void this.refreshFromDataConnect();
        }, 10000);
    }

    private async refreshFromDataConnect(): Promise<void> {
        try {
            const response = await listSettings(dc);
            const rows = (response as any)?.data?.settings ?? [];
            const row = Array.isArray(rows)
                ? rows.find((r: any) => String(r?.id ?? '') === SETTING_ID)
                : null;

            const parsed = safeJsonParse(row?.data);
            const configs: ComponentConfig[] = Array.isArray(parsed?.configs) ? parsed.configs : [];

            this.configs.clear();
            for (const cfg of configs) {
                if (!cfg?.id) continue;
                this.configs.set(String(cfg.id), cfg as ComponentConfig);
            }
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to refresh component configs:', error);
        }
    }

    public subscribe(listener: Function) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.configs));
    }

    public getConfig(id: string): ComponentConfig | undefined {
        return this.configs.get(id) || COMPONENT_REGISTRY.find(c => c.id === id);
    }

    public isEnabled(id: string): boolean {
        const config = this.getConfig(id);
        return config ? config.isEnabled : true; // Default true if unknown
    }

    // Admin: Update Config
    public async updateConfig(id: string, updates: Partial<ComponentConfig>) {
        const current = this.getConfig(id) ?? (COMPONENT_REGISTRY.find(c => c.id === id) as ComponentConfig | undefined);
        const next: ComponentConfig = {
            id,
            name: current?.name ?? updates.name ?? id,
            category: (updates.category ?? current?.category ?? 'FEATURE') as ComponentConfig['category'],
            isEnabled: (typeof updates.isEnabled === 'boolean' ? updates.isEnabled : (current?.isEnabled ?? true)) as boolean,
            description: updates.description ?? current?.description,
            allowedRoles: updates.allowedRoles ?? current?.allowedRoles
        };

        const all = new Map<string, ComponentConfig>();
        for (const reg of COMPONENT_REGISTRY) all.set(reg.id, reg);
        for (const [key, cfg] of this.configs.entries()) all.set(key, cfg);
        all.set(id, next);

        const payload = safeJsonStringify({ configs: Array.from(all.values()) });
        try {
            const updated = await updateSetting(dc, { id: SETTING_ID, data: payload } as any);
            const didUpdate = (updated as any)?.data?.setting_update != null;
            if (!didUpdate) {
                await createSetting(dc, { id: SETTING_ID, data: payload } as any);
            }
        } catch {
            try {
                await createSetting(dc, { id: SETTING_ID, data: payload } as any);
            } catch {
                await updateSetting(dc, { id: SETTING_ID, data: payload } as any);
            }
        }

        this.configs.set(id, next);
        this.notifyListeners();
    }

    public async resetToRegistry() {
        for (const comp of COMPONENT_REGISTRY) {
            await this.updateConfig(comp.id, comp);
        }
    }
}

export const componentService = new ComponentService();
