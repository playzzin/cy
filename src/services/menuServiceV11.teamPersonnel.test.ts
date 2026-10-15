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

test('저장된 두 메뉴를 조회할 때 네 메뉴로 표시하며 서버 설정은 쓰지 않는다', async () => {
    menuServiceV11.clearCache();
    jest.clearAllMocks();
    const stored: SiteDataType = { pos_leader: { name: '팀장', icon: '', menu: [{ text: '인원관리', sub: [
        { text: '인원현황', path: '/manpower/team-worker-detail' },
        { text: '신규 작업자 등록', path: '/manpower/team-worker-requests' },
    ] }] } };
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => stored });
    const config = await menuServiceV11.getMenuConfig();
    expect(config?.pos_leader.menu[0].sub).toEqual([
        expect.objectContaining({ text: '작업자정보', path: '/manpower/team-worker-detail' }),
        expect.objectContaining({ text: '급여명세서', path: '/manpower/team-worker-payslip' }),
        expect.objectContaining({ text: '출력일보', path: '/manpower/team-worker-daily-report' }),
        expect.objectContaining({ text: '신규작업자등록', path: '/manpower/team-worker-requests' }),
    ]);
    expect(stored.pos_leader.menu[0].sub).toHaveLength(2);
    expect(setDoc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
});
