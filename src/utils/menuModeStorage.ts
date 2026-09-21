import { isDevAdminSessionEnabled } from './devAdminSession';

type MenuModeKey = 'cy_current_site' | 'cy_current_position' | 'cy_site_manual' | 'cy_position_manual';

// Sample navigation must never overwrite the signed-in user's saved menu mode.
export const getMenuModeStorageKey = (key: MenuModeKey, uid?: string): string => (
    isDevAdminSessionEnabled() ? `cy_sample_${key}` : `cy_user_${encodeURIComponent(uid || 'anonymous')}_${key}`
);
