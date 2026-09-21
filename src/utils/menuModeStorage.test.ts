import { getMenuModeStorageKey } from './menuModeStorage';
import { isDevAdminSessionEnabled } from './devAdminSession';

jest.mock('./devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));

it('이전 계정의 dev 미리보기를 팀장 계정에 복원하지 않는다', () => {
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    const storage = new Map<string, string>();
    storage.set('cy_current_position', 'dev');
    storage.set('cy_position_manual', 'true');
    storage.set(getMenuModeStorageKey('cy_current_position', 'admin-account'), 'dev');
    storage.set(getMenuModeStorageKey('cy_position_manual', 'admin-account'), 'true');
    expect(storage.get(getMenuModeStorageKey('cy_current_position', 'leader-account'))).toBeUndefined();
    expect(storage.get(getMenuModeStorageKey('cy_position_manual', 'leader-account'))).toBeUndefined();
    expect(storage.get(getMenuModeStorageKey('cy_current_position', 'admin-account'))).toBe('dev');
});

it('사이트와 직책 선택 및 수동 모드 플래그를 모두 계정별로 분리한다', () => {
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    (['cy_current_site', 'cy_current_position', 'cy_site_manual', 'cy_position_manual'] as const).forEach(key => {
        expect(getMenuModeStorageKey(key, 'first')).not.toBe(getMenuModeStorageKey(key, 'second'));
        expect(getMenuModeStorageKey(key, 'first')).not.toBe(getMenuModeStorageKey(key));
        expect(getMenuModeStorageKey(key, 'first')).not.toBe(key);
    });
});

it('샘플 화면에서 변경한 모드가 실제 계정의 저장된 직책과 사이트를 덮어쓰지 않는다', () => {
    const storage = new Map<string, string>();
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    storage.set(getMenuModeStorageKey('cy_current_position'), 'dev');
    storage.set(getMenuModeStorageKey('cy_current_site'), 'admin');
    storage.set(getMenuModeStorageKey('cy_position_manual'), 'true');
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
    storage.set(getMenuModeStorageKey('cy_current_position'), 'full');
    storage.set(getMenuModeStorageKey('cy_current_site'), 'test');
    storage.delete(getMenuModeStorageKey('cy_position_manual'));
    storage.set(getMenuModeStorageKey('cy_site_manual'), 'true');
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    expect(storage.get(getMenuModeStorageKey('cy_current_position'))).toBe('dev');
    expect(storage.get(getMenuModeStorageKey('cy_current_site'))).toBe('admin');
    expect(storage.get(getMenuModeStorageKey('cy_position_manual'))).toBe('true');
    expect(storage.get(getMenuModeStorageKey('cy_site_manual'))).toBeUndefined();
});
