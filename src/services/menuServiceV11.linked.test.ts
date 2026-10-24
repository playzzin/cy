import { getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { menuServiceV11 } from './menuServiceV11';
import { permissionAuditService } from './permissionAuditService';
import type { SiteDataType } from '../types/menu';
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({ DEV_MENU_STORAGE_KEY: 'test' }));
jest.mock('./permissionAuditService', () => ({ permissionAuditService: { logMenuAccessChanges: jest.fn() } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); menuServiceV11.clearCache(); });

it('실제 저장 경로에서 다른 직책 변경을 보존하고 같은 직책 메뉴 충돌 시 쓰지 않는다', async () => {
    const data: SiteDataType = {
        admin: { name: '전체', icon: 'fa-list', menu: [] },
        pos_dev: { name: 'DEV', icon: 'fa-list', menu: [], linkedPositionMenusEnabled: true },
        pos_leader: { name: '팀장', icon: 'fa-list', menu: [{ id: 'report', text: '기존 메뉴', path: '/test' }] },
        pos_support: { name: '지원', icon: 'fa-list', menu: [] },
    };
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => data });
    const base = (await menuServiceV11.getMenuConfig())!;
    const desired = JSON.parse(JSON.stringify(base));
    desired.pos_leader.menu[0].text = 'DEV에서 수정';
    const remote = JSON.parse(JSON.stringify(base));
    remote.pos_support.menu.push({ id: 'remote', text: '다른 창 추가', path: '/remote' });
    const write = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback({
        get: async () => ({ exists: () => true, data: () => remote }), set: write,
    }));
    const saved = await menuServiceV11.saveMenuConfig(desired, base);
    expect(saved.pos_leader.menu[0].text).toBe('DEV에서 수정');
    expect(saved.pos_support.menu[0].text).toBe('다른 창 추가');
    expect(saved.pos_dev.linkedPositionMenusEnabled).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    write.mockClear();
    remote.pos_leader.menu[0].text = '충돌 수정';
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(menuServiceV11.saveMenuConfig(desired, base)).rejects.toThrow('다른 창에서 같은 메뉴');
    expect(write).not.toHaveBeenCalled();
    log.mockRestore();
});

it('구독 오류를 편집기에 알리고 다시 조회하면 실시간 연결을 복구한다', async () => {
    let reportError!: (error: Error) => void;
    const stop = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_doc, _callback, onError) => { reportError = onError; return stop; });
    const error = new Error('연결 끊김');
    const handleError = jest.fn();
    const unsubscribe = menuServiceV11.subscribe(jest.fn(), { onError: handleError });
    // Allow subscription setup and its finally handler to settle.
    await new Promise(resolve => setTimeout(resolve, 0));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    reportError(error);
    expect(handleError).toHaveBeenCalledWith(error);
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ admin: { name: '전체', icon: '', menu: [] } }) });
    await menuServiceV11.getMenuConfig();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    unsubscribe();
    expect(stop).toHaveBeenCalledTimes(1);
    log.mockRestore();
});

it('감사 기록 중 새 스냅샷을 받아도 저장 응답은 해당 요청이 확정한 값이다', async () => {
    let publish!: (snapshot: unknown) => void;
    (onSnapshot as jest.Mock).mockImplementation((_doc, callback) => { publish = callback; return jest.fn(); });
    const receive = jest.fn();
    const unsubscribe = menuServiceV11.subscribe(receive);
    await new Promise(resolve => setTimeout(resolve, 0));
    const data = { admin: { name: '전체', icon: '', menu: [{ id: 'a', text: '저장한 값', path: '/test' }] } };
    (permissionAuditService.logMenuAccessChanges as jest.Mock).mockImplementationOnce(async () => {
        publish({ exists: () => true, data: () => ({ admin: { ...data.admin, menu: [{ ...data.admin.menu[0], text: '이후 외부 변경' }] } }) });
    });
    const saved = await menuServiceV11.saveMenuConfig(data);
    expect(saved.admin.menu[0].text).toBe('저장한 값');
    expect(receive.mock.calls[receive.mock.calls.length - 1][0].admin.menu[0].text).toBe('이후 외부 변경');
    unsubscribe();
});
