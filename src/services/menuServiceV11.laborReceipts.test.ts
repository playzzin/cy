import { getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { menuServiceV11 } from './menuServiceV11';
import { MENU_PATHS } from '../constants/menuPaths';
import type { MenuItem, SiteDataType } from '../types/menu';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({ DEV_MENU_STORAGE_KEY: 'test' }));
jest.mock('./permissionAuditService', () => ({ permissionAuditService: { logMenuAccessChanges: jest.fn() } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn() }));

it('기존 노무 메뉴 이름만 변경하고 식별자·권한·숨김·사용자 지정 이름·원본 데이터를 보존한다', async () => {
  menuServiceV11.clearCache();
  jest.clearAllMocks();
  const legacy = '위임금 입금 확인';
  const current = '노무 입금 확인';
  const route = '/payroll/delegated-receipts';
  const stored: SiteDataType = { pos_ceo: { name: '대표', icon: '', menu: [
    { text: '급여관리', sub: [
      { id: 'saved-receipts', text: legacy, path: `${route}?view=excel`, hide: true, roles: ['finance'] },
      { text: '자료', sub: [legacy] },
      { id: 'custom-receipts', text: '내 수금 관리', path: route },
    ] },
  ], headerActions: [{ id: 'receipt-shortcut', text: legacy, path: route }], trash: [{ id: 'trashed-receipts', text: legacy, path: route }], deletedItems: [legacy] } };
  const before = JSON.stringify(stored);
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => stored });
  const config = await menuServiceV11.getMenuConfig();
  const menu = config!.pos_ceo.menu.find(item => item.text === '급여관리')!.sub as MenuItem[];
  expect(menu[0]).toMatchObject({ id: 'saved-receipts', text: current, path: `${route}?view=excel`, hide: true, roles: ['finance'] });
  expect(menu[1].sub).toEqual([expect.objectContaining({ text: current, path: route })]);
  expect(menu[2]).toMatchObject({ id: 'custom-receipts', text: '내 수금 관리', path: route });
  expect(config!.pos_ceo.headerActions).toEqual([expect.objectContaining({ id: 'receipt-shortcut', text: current })]);
  expect(config!.pos_ceo.trash).toEqual([expect.objectContaining({ id: 'trashed-receipts', text: current })]);
  expect(config!.pos_ceo.deletedItems).toContain(legacy);
  expect(MENU_PATHS[legacy]).toBe(route);
  expect(MENU_PATHS[current]).toBe(route);
  expect(JSON.stringify(stored)).toBe(before);
  expect(setDoc).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
  expect(runTransaction).not.toHaveBeenCalled();
});
