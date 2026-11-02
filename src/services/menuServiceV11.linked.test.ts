import { getDoc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { menuServiceV11 } from './menuServiceV11';
import { permissionAuditService } from './permissionAuditService';
import type { SiteDataType } from '../types/menu';
import { getPositionMenuView, setPositionMenuView, LINKED_POSITION_DIVIDER_ID } from '../utils/linkedPositionMenus';
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({ DEV_MENU_STORAGE_KEY: 'test' }));
jest.mock('./permissionAuditService', () => ({ permissionAuditService: { logMenuAccessChanges: jest.fn() } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); menuServiceV11.clearCache(); });

it('기본 메뉴를 한 번만 등록하고 이름·경로·빈 폴더·직책 삭제를 다음 조회에도 유지한다', async () => {
    let remote: SiteDataType = {
        pos_ceo: { name: 'CEO', icon: 'fa-list', menu: [] },
        pos_leader: { name: '팀장', icon: 'fa-list', menu: [],
            trash: [{ text: '스마트 메모', path: '/memos' }], deletedItems: ['엔진오일 주기'] },
        pos_office: { name: '사무실', icon: 'fa-list', menu: [
            { id: 'custom', text: '일정 / 배정 관리', path: '/custom', roles: ['사무'], fontPreset: 'suit' }
        ] }
    };
    const snapshot = () => ({ exists: () => true, data: () => remote });
    (getDoc as jest.Mock).mockImplementation(async () => snapshot());
    const write = jest.fn((_ref, data) => { remote = data; });
    (runTransaction as jest.Mock).mockImplementation(async (_db, work) => work({ get: snapshot, set: write }));
    const initial = (await menuServiceV11.getMenuConfig())!;
    expect(menuServiceV11.isMenuRegistrationPending()).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(initial.pos_ceo.menu.map(item => item.text)).toEqual(expect.arrayContaining(['로그관리', '활동 내역']));
    expect(initial.pos_leader.menu.map(item => item.text)).toContain('인원관리');
    expect(initial.pos_leader.menu.map(item => item.text)).not.toContain('스마트 메모');
    expect(initial.pos_leader.menu.map(item => item.text)).not.toContain('엔진오일 주기');
    expect(initial.pos_office.menu[0]).toMatchObject({ id: 'custom', path: '/custom', fontPreset: 'suit' });
    const edited = JSON.parse(JSON.stringify(initial)) as SiteDataType;
    edited.pos_ceo.menu = [];
    edited.pos_leader.menu = [
        { ...initial.pos_leader.menu.find(item => item.text === '인원관리')!, text: '현장관리', sub: [] },
        { id: 'new', text: '바이백', path: '/custom-route' },
        { id: 'clear', text: '매입매출 관리' },
    ];
    delete edited.pos_rental;
    remote.pos_office.sidebarAccentColor = '#abcdef';
    const saved = await menuServiceV11.saveMenuConfig(edited, initial);
    expect(menuServiceV11.isMenuRegistrationPending()).toBe(false);
    expect(remote.pos_office.sidebarAccentColor).toBe('#abcdef');
    expect(saved.pos_leader.menu).toEqual(edited.pos_leader.menu);
    expect(remote.pos_ceo.menu).toEqual([]);
    expect(remote.pos_rental).toBeUndefined();
    menuServiceV11.clearCache();
    const reloaded = (await menuServiceV11.getMenuConfig())!;
    expect(reloaded).toEqual(saved);
    await menuServiceV11.runOneTimeMigrations();
    expect(write).toHaveBeenCalledTimes(1);
    expect(setDoc).not.toHaveBeenCalled();
    const empty = { ...reloaded, pos_leader: { ...reloaded.pos_leader, menu: [] } };
    await menuServiceV11.saveMenuConfig(empty, reloaded);
    expect((await menuServiceV11.getMenuConfig())!.pos_leader.menu).toEqual([]);
});

it('이름이 같은 이전 메뉴를 각각 편집할 수 있도록 서로 다른 고정 ID를 등록한다', async () => {
    const legacy = { storefront: { name: '현장', icon: 'fa-list', menu: [
        { text: '현황', path: '/a' }, { text: '현황', path: '/b' }
    ] } };
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => legacy });
    const first = (await menuServiceV11.getMenuConfig())!;
    const ids = first.storefront.menu.map(item => item.id);
    expect(new Set(ids).size).toBe(2);
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => first });
    expect((await menuServiceV11.getMenuConfig())!.storefront.menu.map(item => item.id)).toEqual(ids);
});

it('설정 문서가 없어도 조회는 쓰지 않으며 최초 등록 버튼의 트랜잭션으로만 생성한다', async () => {
    let remote: SiteDataType | null = null;
    const snapshot = () => ({ exists: () => remote !== null, data: () => remote });
    (getDoc as jest.Mock).mockImplementation(async () => snapshot());
    const write = jest.fn((_ref, data) => { remote = data; });
    (runTransaction as jest.Mock).mockImplementation(async (_db, work) => work({ get: snapshot, set: write }));
    const base = (await menuServiceV11.getMenuConfig())!;
    expect(setDoc).not.toHaveBeenCalled();
    expect(menuServiceV11.isMenuRegistrationPending()).toBe(true);
    const registered = await menuServiceV11.saveMenuConfig(base, base);
    expect(write).toHaveBeenCalledTimes(1);
    expect(menuServiceV11.isMenuRegistrationPending()).toBe(false);
    expect(await menuServiceV11.getMenuConfig()).toEqual(registered);
});

it('자동 추가된 급여 메뉴의 ID를 유지하며 통합 구분선 제목을 저장하고 다시 불러온다', async () => {
    let remote: SiteDataType = {
        admin: { name: '전체', icon: 'fa-list', menu: [], positionConfig: [
            { id: 'dev', name: 'DEV', icon: 'fa-code', color: '#000' },
            { id: 'manager', name: '매니저', icon: 'fa-user', color: '#000' },
        ] },
        pos_dev: { name: 'DEV', icon: 'fa-code', menu: [] },
        pos_manager: { name: '매니저', icon: 'fa-user', menu: [
            { id: 'payroll', text: '급여 관리', sub: [{ id: 'monthly', text: '월급제', path: '/payroll/monthly-wage' }] },
        ] },
    };
    (getDoc as jest.Mock).mockImplementation(async () => ({ exists: () => true, data: () => remote }));
    const write = jest.fn((_ref, data) => { remote = data; });
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback({
        get: async () => ({ exists: () => true, data: () => remote }), set: write,
    }));
    const base = (await menuServiceV11.getMenuConfig())!;
    const next = JSON.parse(JSON.stringify(base));
    const items = getPositionMenuView(next, 'pos_dev');
    items.find(item => item.id === LINKED_POSITION_DIVIDER_ID)!.dividerTitle = '직책별 메뉴';
    setPositionMenuView(next, 'pos_dev', items);
    // A title edit must not modify the generated child IDs in linked source menus.
    expect(next.pos_manager.menu).toEqual(base.pos_manager.menu);
    const saved = await menuServiceV11.saveMenuConfig(next, base);
    expect(saved.pos_dev.linkedPositionDivider?.dividerTitle).toBe('직책별 메뉴');
    expect(saved.pos_manager.menu).toEqual(base.pos_manager.menu);
    expect(write).toHaveBeenCalledTimes(1);
    menuServiceV11.clearCache();
    const reloaded = (await menuServiceV11.getMenuConfig())!;
    expect(reloaded).toEqual(saved);
    expect(getPositionMenuView(reloaded, 'pos_dev').find(item => item.id === LINKED_POSITION_DIVIDER_ID)?.dividerTitle).toBe('직책별 메뉴');
});

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
