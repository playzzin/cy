/**
 * User Menu Position Service
 * 
 * ?좎?蹂?異붽? 吏곸콉??愿由ы빀?덈떎.
 * 吏곸콉蹂?硫붾돱 沅뚰븳(MenuItem.roles[])怨??곕룞?섏뿬
 * 媛쒕퀎 ?좎??먭쾶 異붽? 硫붾돱 ?묎렐 沅뚰븳??遺?ы빀?덈떎.
 * 
 * ??? SystemConfig ?뚯씠釉?(doc_id: 'user_menu_positions')
 * 援ъ“: { [uid: string]: string[] }  (uid ??異붽? 吏곸콉紐?諛곗뿴)
 */

import { createSystemConfig, listSystemConfigs, listAllSystemConfigs, updateSystemConfig } from './firestoreCrudCompat';

const DOC_ID = 'user_menu_positions';

export interface UserMenuPositionMap {
    [uid: string]: string[];
}

class UserMenuPositionService {
    private data: UserMenuPositionMap = {};
    private listeners: ((data: UserMenuPositionMap) => void)[] = [];
    private loaded = false;

    constructor() {
        void this.load();
    }

    private async load(): Promise<void> {
        try {
            const findRow = (rows: any[]): any | null => {
                if (!Array.isArray(rows)) return null;
                return rows.find((r: any) => String(r?.id ?? '') === DOC_ID) ?? null;
            };

            let row: any = null;
            try {
                const response = await listSystemConfigs();
                const rows = (response as any)?.data?.systemConfigs ?? [];
                row = findRow(rows);
            } catch {
                row = null;
            }

            if (!row) {
                let offset = 0;
                let safety = 0;
                while (safety < 50) {
                    safety++;
                    const response = await listAllSystemConfigs({ limit: 1000, offset } as any);
                    const rows = (response as any)?.data?.systemConfigs ?? [];
                    const page = Array.isArray(rows) ? rows : [];
                    if (page.length === 0) break;
                    row = findRow(page);
                    if (row) break;
                    if (page.length < 1000) break;
                    offset += 1000;
                }
            }

            if (row?.data) {
                this.data = JSON.parse(String(row.data)) as UserMenuPositionMap;
            } else {
                this.data = {};
            }

            this.loaded = true;
            this.notifyListeners();
        } catch (error) {
            console.error('[UserMenuPositionService] Load error:', error);
            this.data = {};
            this.loaded = true;
        }
    }

    private async save(): Promise<void> {
        const payload = JSON.stringify(this.data);
        try {
            const updated = await updateSystemConfig({ id: DOC_ID, data: payload } as any);
            const didUpdate = (updated as any)?.data?.systemConfig_update != null;
            if (!didUpdate) {
                try {
                    await createSystemConfig({ id: DOC_ID, data: payload } as any);
                } catch {
                    await updateSystemConfig({ id: DOC_ID, data: payload } as any);
                }
            }
        } catch {
            try {
                await createSystemConfig({ id: DOC_ID, data: payload } as any);
            } catch {
                await updateSystemConfig({ id: DOC_ID, data: payload } as any);
            }
        }
        this.notifyListeners();
    }

    /** ?뱀젙 ?좎???異붽? 吏곸콉 紐⑸줉 議고쉶 */
    public getPositions(uid: string): string[] {
        return this.data[uid] || [];
    }

    /** ?꾩껜 留ㅽ븨 議고쉶 */
    public getAll(): UserMenuPositionMap {
        return { ...this.data };
    }

    /** ?뱀젙 ?좎???異붽? 吏곸콉 ?ㅼ젙 */
    public async setPositions(uid: string, positions: string[]): Promise<void> {
        const filtered = positions.filter(Boolean);
        if (filtered.length === 0) {
            delete this.data[uid];
        } else {
            this.data[uid] = filtered;
        }
        await this.save();
    }

    /** ?뱀젙 ?좎???吏곸콉 1媛?異붽? */
    public async addPosition(uid: string, position: string): Promise<void> {
        const current = this.data[uid] || [];
        if (current.includes(position)) return;
        this.data[uid] = [...current, position];
        await this.save();
    }

    /** ?뱀젙 ?좎??먯꽌 吏곸콉 1媛??쒓굅 */
    public async removePosition(uid: string, position: string): Promise<void> {
        const current = this.data[uid] || [];
        const next = current.filter(p => p !== position);
        if (next.length === 0) {
            delete this.data[uid];
        } else {
            this.data[uid] = next;
        }
        await this.save();
    }

    /** 蹂寃?援щ룆 */
    public subscribe(listener: (data: UserMenuPositionMap) => void): () => void {
        this.listeners.push(listener);
        if (this.loaded) listener(this.data);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach(l => l(this.data));
    }

    /** 媛뺤젣 ?덈줈怨좎묠 */
    public async refresh(): Promise<void> {
        await this.load();
    }

    public isLoaded(): boolean {
        return this.loaded;
    }
}

export const userMenuPositionService = new UserMenuPositionService();

