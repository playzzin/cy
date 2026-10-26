import { getDocs, setDoc } from 'firebase/firestore';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { positionService } from '../services/positionService';
import { UserRole } from '../types/roles';
import { createDevAdminUser } from './devAdminSession';
import { buildDevClaimSyncResult, devOfficeStaff, devUsers, getDevMenuConfig, DEV_MENU_STORAGE_KEY, reloadDevMenuConfigFromStorage } from './devAdminFixtures';
import { matchesMenuPosition } from './menuPosition';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./devPreviewRuntime', () => ({ isDevPreviewFrame: false }));
jest.mock('firebase/firestore', () => ({
    ...jest.requireActual('firebase/firestore'),
    collection: jest.fn(), query: jest.fn(), orderBy: jest.fn(), doc: jest.fn(),
    getDocs: jest.fn(), setDoc: jest.fn(async () => undefined),
}));

const originalEnv = process.env;

beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    window.history.replaceState({}, '', '/?devAdmin=1');
    window.localStorage.clear();
    reloadDevMenuConfigFromStorage();
});

afterEach(() => {
    process.env = originalEnv;
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
});

it('connects the local CEO login, profile, staff, positions and menu with the same title', async () => {
    const user = createDevAdminUser();
    expect(user).not.toBeNull();
    const claims = (await user!.getIdTokenResult()).claims;
    const profile = devUsers.find(row => row.uid === user!.uid)!;
    const staff = devOfficeStaff.find(row => row.uid === user!.uid)!;
    const positions = await positionService.getPositions(true);
    const menu = getDevMenuConfig();

    expect(claims.position).toBe('CEO');
    expect(profile.position).toBe(claims.position);
    expect(staff.role).toBe(claims.position);
    expect(positions.find(row => row.name === claims.position)?.systemRole).toBe(UserRole.ADMIN);
    expect(menu.pos_ceo.name).toBe(claims.position);
    expect(DEFAULT_MENU_CONFIG.admin.positionConfig?.find(row => row.id === 'ceo')?.name).toBe(claims.position);
    expect(matchesMenuPosition('ceo', menu.pos_ceo.name, profile.position)).toBe(true);
    expect(buildDevClaimSyncResult(user!.uid)).toMatchObject({
        position: 'CEO', role: 'admin', systemRole: UserRole.ADMIN, erpRoleGroups: ['admin'],
        roles: expect.arrayContaining(['CEO']),
    });
    expect(positions.map(row => row.name)).not.toEqual(expect.arrayContaining(['대표']));
    expect(positions.map(row => row.name)).not.toEqual(expect.arrayContaining(['사장']));
    expect(getDocs).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
});

it('keeps the local CEO login disabled in production', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    expect(createDevAdminUser()).toBeNull();
});

it.each(['대표', '사장'])('updates the retired %s title only in the saved local CEO menu', title => {
    const saved = {
        admin: { name: '관리자', icon: '', menu: [], positionConfig: [{ id: 'ceo', name: title, icon: '', color: '' }] },
        pos_ceo: { name: title, icon: '', menu: [{ text: '내 메뉴', path: '/custom' }] },
        pos_custom: { name: '사용자 직책', icon: '', menu: [] },
    };
    const serialized = JSON.stringify(saved);
    window.localStorage.setItem(DEV_MENU_STORAGE_KEY, serialized);
    const menu = reloadDevMenuConfigFromStorage();
    expect(menu.pos_ceo).toEqual({ ...saved.pos_ceo, name: 'CEO' });
    expect(menu.admin.positionConfig?.[0].name).toBe('CEO');
    expect(menu.pos_custom).toEqual(saved.pos_custom);
    expect(window.localStorage.getItem(DEV_MENU_STORAGE_KEY)).toBe(serialized);
    expect(setDoc).not.toHaveBeenCalled();
});

it('does not restore a deleted CEO menu or overwrite a custom title', () => {
    window.localStorage.setItem(DEV_MENU_STORAGE_KEY, JSON.stringify({
        admin: { name: '관리자', icon: '', menu: [], positionConfig: [] },
    }));
    expect(reloadDevMenuConfigFromStorage()).not.toHaveProperty('pos_ceo');
    window.localStorage.setItem(DEV_MENU_STORAGE_KEY, JSON.stringify({
        pos_ceo: { name: '경영', icon: '', menu: [] },
    }));
    expect(reloadDevMenuConfigFromStorage().pos_ceo.name).toBe('경영');
});

it('does not recreate retired titles or duplicate a saved lowercase ceo when initializing defaults', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    (getDocs as jest.Mock).mockResolvedValue({ docs: [{ data: () => ({ name: 'ceo' }) }] });
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
        await positionService.initializeDefaults();
        expect(getDocs).toHaveBeenCalledTimes(1);
        expect(setDoc).toHaveBeenCalled();
        const createdNames = (setDoc as jest.Mock).mock.calls.map(([, data]) => data.name);
        expect(createdNames.filter(name => name === '매니저')).toHaveLength(1);
        expect(createdNames).not.toEqual(expect.arrayContaining(['매니저1', '매니저2', '매니저3']));
        expect(createdNames).not.toEqual(expect.arrayContaining(['대표']));
        expect(createdNames).not.toEqual(expect.arrayContaining(['사장']));
        expect(createdNames).not.toEqual(expect.arrayContaining(['CEO']));
    } finally {
        log.mockRestore();
    }
});
