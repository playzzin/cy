import { isDevAdminSessionEnabled } from './devAdminSession';

type MenuModeKey = 'cy_current_site' | 'cy_current_position' | 'cy_site_manual' | 'cy_position_manual';

// Sample navigation must never overwrite the signed-in user's saved menu mode.
export const getMenuModeStorageKey = (key: MenuModeKey): string => (
    isDevAdminSessionEnabled() ? `cy_sample_${key}` : key
);
