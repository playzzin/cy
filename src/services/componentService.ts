import { db } from '../config/firebase';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

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

const COLLECTION_NAME = 'system_components';

class ComponentService {
    private configs: Map<string, ComponentConfig> = new Map();
    private listeners: Function[] = [];

    constructor() {
        this.initializeRegistry();
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
        const colRef = collection(db, COLLECTION_NAME);
        onSnapshot(colRef, (snapshot) => {
            snapshot.docs.forEach(doc => {
                const data = doc.data() as ComponentConfig;
                this.configs.set(data.id, data);
            });
            this.notifyListeners();
        });
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
        const ref = doc(db, COLLECTION_NAME, id);
        await setDoc(ref, { id, ...updates }, { merge: true });
    }

    public async resetToRegistry() {
        for (const comp of COMPONENT_REGISTRY) {
            await this.updateConfig(comp.id, comp);
        }
    }
}

export const componentService = new ComponentService();
