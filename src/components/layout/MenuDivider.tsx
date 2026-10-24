import React from 'react';
import type { MenuItem } from '../../types/menu';
import { getDividerAppearance } from '../../utils/menuDivider';

interface MenuDividerProps {
    item?: MenuItem | string;
    inset?: number;
}

/** Shared by the sidebar, flyout and editor preview; never a navigation target. */
const MenuDivider: React.FC<MenuDividerProps> = ({ item, inset = 16 }) => {
    const { gap, lineStyle } = getDividerAppearance(item);
    if (typeof item === 'object' && item.hide) return null;

    return (
        <div
            role="separator"
            aria-label="메뉴 구분선"
            aria-orientation="horizontal"
            style={{ padding: `${gap}px ${inset}px`, flexShrink: 0 }}
        >
            <div style={{ borderTop: `1px ${lineStyle} #64748b`, opacity: 0.6 }} />
        </div>
    );
};

export default MenuDivider;
