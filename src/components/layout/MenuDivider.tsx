import React from 'react';
import type { MenuItem } from '../../types/menu';
import { getDividerAppearance } from '../../utils/menuDivider';

interface MenuDividerProps {
    item?: MenuItem | string;
    inset?: number;
    collapsed?: boolean;
}

/** Shared by the sidebar, flyout and editor preview; never a navigation target. */
const MenuDivider: React.FC<MenuDividerProps> = ({ item, inset = 16, collapsed = false }) => {
    const { gap, lineStyle, title } = getDividerAppearance(item);
    if (typeof item === 'object' && item.hide) return null;
    const line: React.CSSProperties = { borderTop: `1px ${lineStyle} #64748b`, opacity: 0.6, flex: '1 1 0', minWidth: 12 };

    return (
        <div
            role="separator"
            aria-label={title ? `${title} 구분선` : '메뉴 구분선'}
            aria-orientation="horizontal"
            title={title || undefined}
            style={{ padding: `${gap}px ${inset}px`, flexShrink: 0, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8 }}
        >
            <span aria-hidden="true" style={line} />
            {title && !collapsed && <>
                <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400, lineHeight: '16px', minWidth: 0, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                <span aria-hidden="true" style={line} />
            </>}
        </div>
    );
};

export default MenuDivider;
