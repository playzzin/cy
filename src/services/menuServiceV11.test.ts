import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import {
  MENU_DOCUMENT_ID,
  menuServiceV11,
  removePositionReferencesInMenuConfig,
} from './menuServiceV11';
import { permissionAuditService } from './permissionAuditService';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import {
  DEV_MENU_STORAGE_KEY,
  getDevMenuConfig,
  reloadDevMenuConfigFromStorage
} from '../utils/devAdminFixtures';

jest.mock('../config/firebase', () => ({ db: {} }));

jest.mock('../utils/devAdminSession', () => ({
  isDevAdminSessionEnabled: jest.fn(() => false)
}));

jest.mock('../utils/devAdminFixtures', () => ({
  DEV_MENU_STORAGE_KEY: 'cy_dev_menu_config_v11',
  getDevMenuConfig: jest.fn(),
  reloadDevMenuConfigFromStorage: jest.fn(),
  setDevMenuConfig: jest.fn()
}));

jest.mock('./permissionAuditService', () => ({
  permissionAuditService: {
    logMenuAccessChanges: jest.fn()
  }
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, collectionName: string, id: string) => ({ collectionName, id })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn()
}));

const mockedDoc = doc as unknown as jest.Mock;
const mockedGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockedSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockedAudit = permissionAuditService.logMenuAccessChanges as jest.MockedFunction<
  typeof permissionAuditService.logMenuAccessChanges
>;
const mockedIsDevAdminSessionEnabled = isDevAdminSessionEnabled as jest.MockedFunction<
  typeof isDevAdminSessionEnabled
>;
const mockedGetDevMenuConfig = getDevMenuConfig as jest.MockedFunction<typeof getDevMenuConfig>;
const mockedReloadDevMenuConfig = reloadDevMenuConfigFromStorage as jest.MockedFunction<
  typeof reloadDevMenuConfigFromStorage
>;

const existingDoc = (data: unknown) => ({
  exists: () => true,
  data: () => data
});

const missingDoc = () => ({
  exists: () => false,
  data: () => undefined
});

describe('menuServiceV11 canonical Firestore document', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsDevAdminSessionEnabled.mockReturnValue(false);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    menuServiceV11.clearCache();
    mockedDoc.mockImplementation((_db: unknown, collectionName: string, id: string) => ({
      collectionName,
      id
    }));
    mockedSetDoc.mockResolvedValue(undefined as any);
    mockedAudit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('reads only settings/menus_v12', async () => {
    mockedGetDoc.mockResolvedValue(existingDoc(DEFAULT_MENU_CONFIG) as any);

    await expect(menuServiceV11.getMenuConfig()).resolves.toBeTruthy();

    expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), 'settings', MENU_DOCUMENT_ID);
    expect(mockedDoc).not.toHaveBeenCalledWith(expect.anything(), 'settings', 'menus_v11');
    expect(mockedDoc).not.toHaveBeenCalledWith(expect.anything(), 'settings', 'menus_v10');
    expect(mockedGetDoc).toHaveBeenCalledTimes(1);
  });

  it('adds identity history to existing nested log folders without duplicating or replacing other logs', async () => {
    const legacy = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    legacy.admin.menu = [{ text: '설정', sub: [{ text: '로그관리', sub: ['로그인 로그', { text: '기존 로그', path: '/custom-log' }] }] }];
    mockedGetDoc.mockResolvedValue(existingDoc(legacy) as any);
    const config = await menuServiceV11.getMenuConfig();
    const folder = (config!.admin.menu[0] as any).sub[0];
    expect(folder.sub).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: '로그인 로그' }), expect.objectContaining({ path: '/custom-log' }),
      expect.objectContaining({ text: '신분증 로그', path: '/database/identity-logs' }),
    ]));
    mockedGetDoc.mockResolvedValue(existingDoc(config) as any);
    const again = await menuServiceV11.getMenuConfig();
    expect((again!.admin.menu[0] as any).sub[0].sub.filter((item: any) => item.path === '/database/identity-logs')).toHaveLength(1);
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it('migrates a legacy item named 바이백 to the standalone buyback page', async () => {
    const legacyConfig = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    legacyConfig.pos_ceo.menu = [
      {
        id: 'legacy-buyback',
        text: '바이백',
        path: '/payroll/progress-claims?tab=buyback'
      }
    ];
    mockedGetDoc.mockResolvedValue(existingDoc(legacyConfig) as any);

    const config = await menuServiceV11.getMenuConfig();

    expect(config?.pos_ceo.menu).toEqual([
      expect.objectContaining({
        text: '바이백',
        path: '/payroll/field-buyback'
      })
    ]);
  });

  it('writes only settings/menus_v12 and does not fall back on permission errors', async () => {
    const permissionError = Object.assign(new Error('denied'), { code: 'permission-denied' });
    mockedSetDoc.mockRejectedValue(permissionError);

    await expect(menuServiceV11.saveMenuConfig(DEFAULT_MENU_CONFIG)).rejects.toBe(permissionError);

    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), 'settings', MENU_DOCUMENT_ID);
    expect(mockedDoc).not.toHaveBeenCalledWith(expect.anything(), 'settings', 'menus_v11');
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('serializes distinct full-document saves so an older write cannot overwrite a newer menu edit', async () => {
    const firstConfig = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    const secondConfig = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    firstConfig.pos_ceo.menu = [
      ...(firstConfig.pos_ceo.menu || []),
      { id: 'queue-first', text: 'Queue first', path: '/queue-first' }
    ];
    secondConfig.pos_ceo.menu = [
      ...(secondConfig.pos_ceo.menu || []),
      { id: 'queue-second', text: 'Queue second', path: '/queue-second' }
    ];

    let releaseFirstWrite: (() => void) | undefined;
    mockedSetDoc
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        releaseFirstWrite = resolve;
      }) as any)
      .mockResolvedValueOnce(undefined as any);

    const firstSave = menuServiceV11.saveMenuConfig(firstConfig);
    const secondSave = menuServiceV11.saveMenuConfig(secondConfig);

    await Promise.resolve();
    await Promise.resolve();

    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(releaseFirstWrite).toBeDefined();

    releaseFirstWrite?.();
    await firstSave;
    await secondSave;

    expect(mockedSetDoc).toHaveBeenCalledTimes(2);
    expect((mockedSetDoc.mock.calls[0][1] as any).pos_ceo.menu).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'queue-first' })])
    );
    expect((mockedSetDoc.mock.calls[1][1] as any).pos_ceo.menu).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'queue-second' })])
    );
  });

  it('checks the existence of menus_v12 without initializing a fallback document', async () => {
    mockedGetDoc.mockResolvedValue(missingDoc() as any);

    await expect(menuServiceV11.checkMenusV12Exists()).resolves.toBe(false);

    expect(mockedGetDoc).toHaveBeenCalledTimes(1);
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it('refreshes the dev menu when another browser tab changes local menu storage', () => {
    const updatedConfig = JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG));
    updatedConfig.pos_ceo.menu = [
      ...(updatedConfig.pos_ceo.menu || []),
      {
        id: 'menu-cross-tab-test',
        text: '바이백 페이지',
        path: '/payroll/field-buyback'
      }
    ];

    mockedIsDevAdminSessionEnabled.mockReturnValue(true);
    mockedGetDevMenuConfig.mockReturnValue(DEFAULT_MENU_CONFIG);
    mockedReloadDevMenuConfig.mockReturnValue(updatedConfig);

    const listener = jest.fn();
    const unsubscribe = menuServiceV11.subscribe(listener);

    window.dispatchEvent(new StorageEvent('storage', { key: DEV_MENU_STORAGE_KEY }));

    expect(mockedReloadDevMenuConfig).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].pos_ceo.menu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/payroll/field-buyback' })
      ])
    );

    unsubscribe();
  });
});

describe('removePositionReferencesInMenuConfig', () => {
  it('removes deleted position roles, configuration rows, and its position site', () => {
    const config: any = {
      admin: {
        name: '관리자',
        positionConfig: [
          { id: 'position-team-lead', name: '팀장' },
          { id: 'full', name: '전체' },
        ],
        menu: [
          {
            id: 'root',
            text: '루트',
            roles: ['팀장', '일반'],
            sub: [{ id: 'child', text: '하위', roles: ['팀장'] }],
          },
        ],
      },
      'pos_position-team-lead': {
        name: '팀장',
        menu: [{ id: 'position-only', text: '직책 메뉴', roles: ['팀장'] }],
      },
    };

    const result = removePositionReferencesInMenuConfig(config, '팀장', 'position-team-lead');

    expect(result.changed).toBe(true);
    expect(result.roleReferences).toBe(3);
    expect(result.positionConfigs).toBe(1);
    expect(result.siteLabels).toBe(1);
    expect(config.admin.positionConfig).toEqual([{ id: 'full', name: '전체' }]);
    expect(config.admin.menu[0].roles).toEqual(['일반']);
    expect(config.admin.menu[0].sub[0].roles).toEqual([]);
    expect(config['pos_position-team-lead']).toBeUndefined();
  });
});
