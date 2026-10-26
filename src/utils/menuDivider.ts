import type { MenuItem } from '../types/menu';

export const isMenuDivider = (item: MenuItem | string): boolean =>
    (typeof item === 'string' ? item : item.text).trim() === '-';

export const DIVIDER_SPACING = { compact: 8, normal: 14, relaxed: 22 } as const;

export const getDividerAppearance = (item?: MenuItem | string) => {
    const settings = typeof item === 'object' ? item : undefined;
    const spacing = settings?.dividerSpacing || 'normal';
    return {
        title: settings?.dividerTitle?.trim() || '',
        spacing,
        gap: DIVIDER_SPACING[spacing] ?? DIVIDER_SPACING.normal,
        lineStyle: settings?.dividerStyle === 'dashed' ? 'dashed' as const : 'solid' as const
    };
};

export const createMenuDivider = (id: string): MenuItem => ({
    id,
    text: '-',
    dividerStyle: 'solid',
    dividerSpacing: 'normal'
});
