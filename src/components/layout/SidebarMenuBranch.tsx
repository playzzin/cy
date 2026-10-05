import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faCircle, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import type { MenuItem } from '../../types/menu';
import { resolveIcon } from '../../constants/iconMap';
import { isMenuDivider } from '../../utils/menuDivider';
import MenuDivider from './MenuDivider';

interface Props {
    items: (MenuItem | string)[];
    parentId: string;
    expanded: Record<string, boolean>;
    onToggle: (id: string) => void;
    menuPaths: Record<string, string>;
    onNavigate: (path: string) => void;
    isActive: (path: string | undefined) => boolean;
    displayText: (text: string) => string;
    iconName: (text: string, path?: string, icon?: string) => string;
    panel?: boolean;
    depth?: number;
}

const SidebarMenuBranch: React.FC<Props> = props => {
    const [closedPanelItems, setClosedPanelItems] = React.useState<Record<string, boolean>>({});
    const { items, parentId, expanded, onToggle, menuPaths, onNavigate, isActive, displayText, iconName, panel = false, depth = 0 } = props;
    const hasActive = (entry: MenuItem | string): boolean => typeof entry === 'string'
        ? isActive(menuPaths[entry])
        : isActive(entry.path || menuPaths[entry.text]) || Boolean(entry.sub?.some(hasActive));
    return <>
        {items.map((entry, index) => {
            const item = typeof entry === 'string' ? { text: entry } : entry;
            const id = item.id || `${parentId}/${index}/${item.text}`;
            if (isMenuDivider(item)) return <li key={id}><MenuDivider item={item} /></li>;
            if (item.hide) return null;
            const path = item.path || menuPaths[item.text];
            const hasChildren = Boolean(item.sub?.length);
            const open = panel ? !closedPanelItems[id] : Boolean(expanded[id]);
            const active = hasActive(item);
            const color = item.activeColor || '#1abc9c';
            const label = displayText(item.text);
            const style: React.CSSProperties = {
                paddingLeft: panel ? 12 + depth * 14 : 38 + depth * 14,
                color: active ? color : undefined,
                fontWeight: active ? 'bold' : undefined,
            };
            const content = <span className="submenu-link-main">
                <FontAwesomeIcon icon={resolveIcon(iconName(item.text, path, item.icon), faCircle)} className="submenu-leaf-icon" style={{ color: active ? color : item.iconColor }} />
                <span>{label}</span>
            </span>;
            if (hasChildren) return <li key={id} className="nested-submenu">
                <button type="button" className="submenu-header-btn" aria-expanded={open} style={style} onClick={() => {
                    if (panel) setClosedPanelItems(previous => ({ ...previous, [id]: !previous[id] }));
                    else onToggle(id);
                }}>
                    {content}<FontAwesomeIcon icon={faChevronRight} className={`arrow-icon ${open ? 'rotated' : ''}`} />
                </button>
                {open && <ul className="nested-submenu-list">
                    <SidebarMenuBranch {...props} items={item.sub!} parentId={id} depth={depth + 1} />
                </ul>}
            </li>;
            return <li key={id} className="submenu-leaf-item has-open-btn">
                <a href={path || '#'} className={`submenu-leaf-link ${active ? 'active' : ''}`} style={style}
                    onClick={event => { event.preventDefault(); if (path) onNavigate(path); }}>
                    {content}
                </a>
                {path && <button type="button" className="submenu-open-new-btn" title="새 창에서 열기" aria-label={`${label} 새 창에서 열기`}
                    onClick={() => window.open(path, '_blank', 'noopener,noreferrer')}>
                    <FontAwesomeIcon icon={faUpRightFromSquare} size="xs" />
                </button>}
            </li>;
        })}
    </>;
};

export default SidebarMenuBranch;
