/**
 * User Menu Position Service
 * 
 * 유저별 추가 직책을 관리합니다.
 * 직책별 메뉴 권한(MenuItem.roles[])과 연동하여
 * 개별 유저에게 추가 메뉴 접근 권한을 부여합니다.
 * 
 * 저장: SystemConfig 테이블 (doc_id: 'user_menu_positions')
 * 구조: { [uid: string]: string[] }  (uid → 추가 직책명 배열)
 */

import { dc } from '../config/firebase';
import { createSystemConfig, listSystemConfigs, listAllSystemConfigs, updateSystemConfig } from '@dataconnect/generated';

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
                const response = await listSystemConfigs(dc);
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
                    const response = await listAllSystemConfigs(dc, { limit: 1000, offset } as any);
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
            const updated = await updateSystemConfig(dc, { id: DOC_ID, data: payload } as any);
            const didUpdate = (updated as any)?.data?.systemConfig_update != null;
            if (!didUpdate) {
                try {
                    await createSystemConfig(dc, { id: DOC_ID, data: payload } as any);
                } catch {
                    await updateSystemConfig(dc, { id: DOC_ID, data: payload } as any);
                }
            }
        } catch {
            try {
                await createSystemConfig(dc, { id: DOC_ID, data: payload } as any);
            } catch {
                await updateSystemConfig(dc, { id: DOC_ID, data: payload } as any);
            }
        }
        this.notifyListeners();
    }

    /** 특정 유저의 추가 직책 목록 조회 */
    public getPositions(uid: string): string[] {
        return this.data[uid] || [];
    }

    /** 전체 매핑 조회 */
    public getAll(): UserMenuPositionMap {
        return { ...this.data };
    }

    /** 특정 유저의 추가 직책 설정 */
    public async setPositions(uid: string, positions: string[]): Promise<void> {
        const filtered = positions.filter(Boolean);
        if (filtered.length === 0) {
            delete this.data[uid];
        } else {
            this.data[uid] = filtered;
        }
        await this.save();
    }

    /** 특정 유저에 직책 1개 추가 */
    public async addPosition(uid: string, position: string): Promise<void> {
        const current = this.data[uid] || [];
        if (current.includes(position)) return;
        this.data[uid] = [...current, position];
        await this.save();
    }

    /** 특정 유저에서 직책 1개 제거 */
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

    /** 변경 구독 */
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

    /** 강제 새로고침 */
    public async refresh(): Promise<void> {
        await this.load();
    }

    public isLoaded(): boolean {
        return this.loaded;
    }
}

export const userMenuPositionService = new UserMenuPositionService();
