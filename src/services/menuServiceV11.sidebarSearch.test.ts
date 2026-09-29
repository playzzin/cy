import { getDoc, setDoc } from 'firebase/firestore';
import { menuServiceV11 } from './menuServiceV11';
import { SiteDataType } from '../types/menu';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({ DEV_MENU_STORAGE_KEY: 'test-menu' }));
jest.mock('./permissionAuditService', () => ({ permissionAuditService: { logMenuAccessChanges: jest.fn() } }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), onSnapshot: jest.fn()
}));

it('검색 사용/미사용 값을 저장 검증 과정에서 유지하고 재조회한다', async () => {
    const config: SiteDataType = {
        admin: { name: '전체', icon: 'fa-list', menu: [], sidebarSearchEnabled: true },
        pos_leader: { name: '팀장', icon: 'fa-user', menu: [], sidebarSearchEnabled: false },
        custom: { name: '기존 사이트', icon: 'fa-list', menu: [] }
    };
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    const saved = await menuServiceV11.saveMenuConfig(config);
    const persisted = (setDoc as jest.Mock).mock.calls[0][1];
    expect(persisted.admin.sidebarSearchEnabled).toBe(true);
    expect(persisted.pos_leader.sidebarSearchEnabled).toBe(false);
    expect(persisted.custom.sidebarSearchEnabled).toBeUndefined();
    expect(saved.admin.sidebarSearchEnabled).toBe(true);
    menuServiceV11.clearCache();
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => persisted });
    const reloaded = await menuServiceV11.getMenuConfig();
    expect(reloaded?.admin.sidebarSearchEnabled).toBe(true);
    expect(reloaded?.pos_leader.sidebarSearchEnabled).toBe(false);
});
