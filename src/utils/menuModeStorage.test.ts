import { getMenuModeStorageKey } from './menuModeStorage';
import { isDevAdminSessionEnabled } from './devAdminSession';

jest.mock('./devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));

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
