import { getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { menuServiceV11 } from './menuServiceV11';
import type { SiteDataType } from '../types/menu';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({ DEV_MENU_STORAGE_KEY: 'test' }));
jest.mock('./permissionAuditService', () => ({ permissionAuditService: { logMenuAccessChanges: jest.fn() } }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn(),
}));

it('기존 운영 메뉴 조회 결과에만 위임금 메뉴를 추가하고 서버에 쓰지 않는다', async () => {
    menuServiceV11.clearCache();
    jest.clearAllMocks();
    const stored: SiteDataType = {
        pos_ceo: { name: 'CEO', icon: 'fa-crown', menu: [{ text: '급여관리', sub: ['일급제'] }] },
    };
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => stored });
    const config = await menuServiceV11.getMenuConfig();
    expect(config?.pos_ceo.menu.find(item => item.text === '급여관리')?.sub).toEqual([
        expect.objectContaining({ text: '일급제' }),
        expect.objectContaining({ text: '노무 입금 확인', path: '/payroll/delegated-receipts' }),
    ]);
    expect(stored.pos_ceo.menu[0].sub).toEqual(['일급제']);
    expect(setDoc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
});

it('저장된 위임금 메뉴를 노무 입금 확인으로 표시하며 원본 데이터에는 쓰지 않는다', async () => {
    menuServiceV11.clearCache();
    jest.clearAllMocks();
    const stored: SiteDataType = { pos_ceo: { name: 'CEO', icon: '', menu: [{ text: '급여관리', sub: [{ id: 'existing-receipts', text: '위임금 입금 확인', path: '/payroll/delegated-receipts' }] }] } };
    const before = JSON.stringify(stored);
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => stored });
    const config = await menuServiceV11.getMenuConfig();
    expect(config?.pos_ceo.menu.find(item => item.text === '급여관리')?.sub).toEqual([
        expect.objectContaining({ id: 'existing-receipts', text: '노무 입금 확인', path: '/payroll/delegated-receipts' }),
    ]);
    expect(JSON.stringify(stored)).toBe(before);
    expect(setDoc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
});
