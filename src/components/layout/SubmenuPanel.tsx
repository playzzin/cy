import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router-dom';

interface MenuItem {
    text: string;
    icon?: string;
    sub?: (string | MenuItem)[];
}

interface SubmenuPanelProps {
    isOpen: boolean;
    title: string;
    items: (string | MenuItem)[];
    onClose: () => void;
    onItemClick: (item: string) => void;
    menuPaths: { [key: string]: string };
    top?: number;
}

const SubmenuPanel: React.FC<SubmenuPanelProps> = ({ isOpen, title, items, onClose, onItemClick, menuPaths, top }) => {
    const [activeNestedItems, setActiveNestedItems] = useState<{ [key: string]: boolean }>({});
    const location = useLocation();

    const isActiveCheck = (path: string | undefined) => {
        if (!path) return false;

        const [targetPathname, targetSearch] = path.split('?');

        const currentPathname = location.pathname.endsWith('/') && location.pathname.length > 1
            ? location.pathname.slice(0, -1)
            : location.pathname;
        const normalizedTargetPathname = targetPathname.endsWith('/') && targetPathname.length > 1
            ? targetPathname.slice(0, -1)
            : targetPathname;

        if (currentPathname !== normalizedTargetPathname) return false;

        if (!targetSearch) return true;

        const currentParams = new URLSearchParams(location.search);
        const targetParams = new URLSearchParams(targetSearch);

        let isMatch = true;
        targetParams.forEach((value, key) => {
            if (currentParams.get(key) !== value) isMatch = false;
        });
        if (!isMatch) return false;

        return true;
    };

    const toggleNestedItem = (nestedItemId: string) => {
        setActiveNestedItems(prev => {
            const newState = { ...prev };
            Object.keys(newState).forEach(key => {
                if (key !== nestedItemId) newState[key] = false;
            });
            newState[nestedItemId] = !newState[nestedItemId];
            return newState;
        });
    };

    return (
        <div
            className={`submenu-panel ${isOpen ? 'open' : ''}`}
            onClick={(e) => e.stopPropagation()}
            style={top !== undefined ? {
                top: `${top}px`,
                maxHeight: `calc(100vh - ${top}px - 20px)`
            } : {}}
        >
            <div className="submenu-panel-header">
                <span className="submenu-title">{title}</span>
                <button onClick={onClose} className="submenu-close-btn">
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="submenu-panel-content">
                <ul className="submenu-items-list">
                    {items.map((item, index) => {
                        if (typeof item === 'string') {
                            const path = menuPaths[item];
                            const isActive = isActiveCheck(path);
                            return (
                                <li key={index}>
                                    <button
                                        onClick={() => onItemClick(item)}
                                        className={`submenu-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span>{item}</span>
                                        <FontAwesomeIcon icon={faChevronRight} className="submenu-arrow" />
                                    </button>
                                </li>
                            );
                        } else {
                            // Render nested menu item with accordion in SubmenuPanel
                            const menuItem = item as MenuItem;
                            const nestedItemId = `panel-nested-${index}`;
                            const isNestedActive = activeNestedItems[nestedItemId];

                            return (
                                <li key={index}>
                                    <button
                                        onClick={() => toggleNestedItem(nestedItemId)}
                                        className={`submenu-item nested-header ${isNestedActive ? 'expanded' : ''}`}
                                    >
                                        <span>{menuItem.text}</span>
                                        <FontAwesomeIcon
                                            icon={faChevronRight}
                                            className={`arrow-icon ${isNestedActive ? 'rotated' : ''}`}
                                        />
                                    </button>
                                    {isNestedActive && (
                                        <ul className="nested-items-list">
                                            {menuItem.sub?.map((subItem: string | MenuItem, subIndex: number) => {
                                                if (typeof subItem === 'string') {
                                                    const path = menuPaths[subItem];
                                                    const isSubActive = isActiveCheck(path);
                                                    return (
                                                        <li key={subIndex}>
                                                            <button
                                                                onClick={() => onItemClick(subItem)}
                                                                className={`submenu-item nested-item ${isSubActive ? 'active' : ''}`}
                                                            >
                                                                <span>{subItem}</span>
                                                                <FontAwesomeIcon icon={faChevronRight} className="submenu-arrow" />
                                                            </button>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        }
                    })}
                </ul>
            </div>
        </div>
    );
};

export default SubmenuPanel;
