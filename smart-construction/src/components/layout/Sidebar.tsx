import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faShieldHalved,
    faChartPie,
    faClipboardList,
    faFileInvoiceDollar,
    faDatabase,
    faBuilding,
    faPhotoFilm,
    faCartShopping,
    faPenNib,
    faFlask,
    faChevronRight,
    faUserGear,
    faHardDrive,
    faUserTie,
    faUsers,
    faUserTag,
    faWrench,
    faPersonDigging,
    faUserPlus,
    faListCheck,
    faFileImport,
    faUserGroup,
    faHandHoldingDollar,
    faTruckFront,
    faHelmetSafety,
    faSitemap,
    faBookOpen,
    faList,
    faClockRotateLeft,
    faMoneyBillWave,
    faChartSimple,
    faBook
} from '@fortawesome/free-solid-svg-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { rolePermissionService } from '../../services/rolePermissionService';
import { UserRole } from '../../types/roles';
import { SiteDataType, MenuItem } from '../../types/menu';

import { iconMap } from '../../constants/iconMap';

interface SidebarProps {
    currentSiteData: any;
    closeAll: () => void;
    activeMenuItems: { [key: string]: boolean };
    activeNestedMenuItems: { [key: string]: boolean };
    toggleSubmenu: (itemId: string) => void;
    toggleNestedSubmenu: (nestedItemId: string) => void;
    handleMenuItemClick: (item: MenuItem, position?: number) => void;
    handleSubMenuClick: (subItem: string) => void;
    handleLogoClick: () => void;
    menuPaths: { [key: string]: string };
    isSidebarCollapsed: boolean;
    isMobile: boolean;
    openMobileSidebar: () => void;
}

// Map menu text/path to permission IDs
const MENU_PERMISSION_MAP: { [key: string]: string } = {
    '통합 대시보드': 'dashboard',
    '통합 현황판 (전국)': 'status-board',
    '근로자 등록/수정': 'manpower-input',
    '팀 배정 관리': 'assignment',
    '일보 작성 (Input)': 'daily-report-input',
    '일보 목록/승인': 'daily-report-list',
    '급여 지급 관리': 'payroll-payment',
    '명세서 조회': 'payroll-payslip',
    '시스템 설정': 'system-config',
    // Add mappings for parent menus if needed, or handle logic to show parent if any child is visible
};

const Sidebar: React.FC<SidebarProps> = ({
    currentSiteData,
    closeAll,
    activeMenuItems,
    activeNestedMenuItems,
    toggleSubmenu,
    toggleNestedSubmenu,
    handleMenuItemClick,
    handleSubMenuClick,
    handleLogoClick,
    menuPaths,
    isSidebarCollapsed,
    isMobile,
    openMobileSidebar
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [userRole, setUserRole] = useState<string>('user');
    const [permissions, setPermissions] = useState<any>(null);

    useEffect(() => {
        let userUnsubscribe: () => void;

        if (currentUser) {
            // Listen to user role changes in real-time
            userUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap: any) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data?.role) {
                        setUserRole(data.role);
                        console.log("Sidebar: User role updated to", data.role);
                    }
                }
            });
        }

        const unsubscribe = rolePermissionService.subscribe((perms) => {
            setPermissions(perms);
        });

        // Initial fetch
        rolePermissionService.getPermissions().then(setPermissions);

        return () => {
            unsubscribe();
            if (userUnsubscribe) userUnsubscribe();
        };
    }, [currentUser]);

    const hasPermission = (itemText: string, itemRoles?: string[]): boolean => {
        // 1. Dynamic Check (Priority 1)
        if (itemRoles && itemRoles.length > 0) {
            // Admin bypass (optional)
            if (userRole === 'admin') return true;
            return itemRoles.includes(userRole);
        }

        // 2. Legacy Check (Priority 2)
        const permissionId = MENU_PERMISSION_MAP[itemText];
        if (!permissionId) return true;

        return rolePermissionService.hasAccess(userRole, permissionId);
    };

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

    const shouldOpenInNewTab = (path: string | undefined): boolean => {
        if (!path) return false;
        const [, search] = path.split('?');
        if (!search) return false;
        const params = new URLSearchParams(search);
        return params.get('newTab') === '1' || params.get('newTab') === 'true';
    };

    const openMenuPath = (path: string) => {
        if (shouldOpenInNewTab(path)) {
            window.open(path, '_blank', 'noopener,noreferrer');
            if (isMobile) closeAll();
            return;
        }
        navigate(path);
        if (isMobile) closeAll();
    };

    const isParentActive = (item: MenuItem): boolean => {
        if (!item.sub) return false;
        return item.sub.some(subItem => {
            if (typeof subItem === 'string') {
                return isActiveCheck(menuPaths[subItem]);
            } else {
                return subItem.sub?.some(nestedItem =>
                    typeof nestedItem === 'string' && isActiveCheck(menuPaths[nestedItem])
                );
            }
        });
    };

    // Filter menu items based on permissions
    const filteredMenu = currentSiteData.menu.map((item: MenuItem) => {
        // Check if parent has sub-items
        if (item.sub) {
            // Filter sub-items
            const filteredSub = item.sub.filter((subItem: string | MenuItem) => {
                if (typeof subItem === 'string') {
                    return hasPermission(subItem);
                } else {
                    // Object Item
                    const menuItem = subItem as MenuItem;

                    // If it has children, treat as Nested Group
                    if (menuItem.sub && menuItem.sub.length > 0) {
                        const filteredNested = menuItem.sub.filter((nested: string | MenuItem) => {
                            if (typeof nested === 'string') {
                                return hasPermission(nested);
                            } else {
                                // Nested Object Item
                                return hasPermission(nested.text, nested.roles);
                            }
                        });
                        // If children exist, check if any remain
                        return filteredNested.length > 0;
                    }

                    // If no children (or empty array), treat as Leaf Link (Object format)
                    return hasPermission(menuItem.text, menuItem.roles);
                }
            });

            // If no sub-items remain, we still return the item if it was originally an empty folder (manual creation),
            // BUT if it became empty because of permissions, maybe we should hide it?
            // "Exactly the same" implies we should show what is structurally there.
            // If the user created a folder "New Folder" and it has no children, it should show up.
            // However, distinguishing "Empty by Permission" vs "Empty by Structure" is hard here without checking original.
            // For Admin (who sees all), this distinction doesn't matter.
            // For now, let's SHOW it. Logic: If filteredSub is empty, we return item with empty sub.
            // But wait, if we return item with empty sub, `hasSub` (item.sub.length > 0) becomes false.
            // It will render as a Link. If it has no path, it does nothing. This is visually compliant.

            return { ...item, sub: filteredSub };
        }

        // Single item
        return hasPermission(item.text, item.roles) ? item : null;
    }).filter(Boolean);

    const finalMenu = [...filteredMenu];

    // State for hover menu in collapsed mode
    const [hoveredMenuItem, setHoveredMenuItem] = useState<MenuItem | null>(null);
    const [hoveredItemTop, setHoveredItemTop] = useState<number>(0);
    const [isPanelHovered, setIsPanelHovered] = useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleItemMouseEnter = (item: MenuItem, e: React.MouseEvent<HTMLLIElement>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (isSidebarCollapsed && item.sub) {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoveredMenuItem(item);
            setHoveredItemTop(rect.top);
        }
    };

    const handleMouseLeaveNav = () => {
        timeoutRef.current = setTimeout(() => {
            setHoveredMenuItem(null);
        }, 100); // 100ms grace period
    };

    const handlePanelMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsPanelHovered(true);
    };

    const handlePanelMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setHoveredMenuItem(null);
            setIsPanelHovered(false);
        }, 300); // Increased delay
    };

    return (
        <>
            <nav id="sidebar" onMouseLeave={handleMouseLeaveNav}>
                <div className="sidebar-header">
                    <div className="logo-group" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
                        <FontAwesomeIcon
                            icon={iconMap[currentSiteData.icon] || faShieldHalved}
                            id="sidebar-logo-icon"
                            style={{ color: '#1abc9c', fontSize: '24px', marginRight: '10px' }}
                        />
                        <span id="sidebar-logo-text" className="logo-text">{currentSiteData.name}</span>
                    </div>
                    <button id="mobile-close-btn" onClick={closeAll}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div className="menu-list-wrapper">
                    <ul className="menu-list" style={{ paddingBottom: '20px' }}>
                        {finalMenu.map((item: MenuItem, index: number) => {
                            const hasSub = item.sub && item.sub.length > 0;
                            // Use ID for key if available, fallback to index for legacy compatibility
                            const uniqueKey = item.id || `menu-${index}`;
                            const itemId = uniqueKey;
                            const isExpanded = activeMenuItems[itemId]; // This might break if itemId format changes? 
                            // Wait, toggleSubmenu uses itemId. If we change itemId schema, we reset state. That is fine.

                            const isChildActive = isParentActive(item);
                            const showColor = isExpanded || isChildActive;

                            return (
                                <li
                                    key={uniqueKey}
                                    className={`menu-item ${isExpanded ? 'active' : ''}`}
                                    onMouseEnter={(e) => handleItemMouseEnter(item, e)}
                                >
                                    {hasSub ? (
                                        <button
                                            className="menu-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isMobile) {
                                                    openMobileSidebar();
                                                    toggleSubmenu(itemId);
                                                } else if (isSidebarCollapsed) {
                                                    e.preventDefault();
                                                } else {
                                                    toggleSubmenu(itemId);
                                                }
                                            }}
                                            data-tooltip={item.text}
                                        >
                                            <FontAwesomeIcon
                                                icon={iconMap[item.icon || 'fa-chart-pie'] || faChartPie}
                                                className="menu-icon"
                                                style={showColor ? { color: '#1abc9c' } : {}}
                                            />
                                            <span className="menu-text">{item.text}</span>
                                            <FontAwesomeIcon
                                                icon={faChevronRight}
                                                className={`arrow-icon ${isExpanded ? 'rotated' : ''}`}
                                            />
                                        </button>
                                    ) : (
                                        <a
                                            href="#"
                                            className="menu-link"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const directPath = item.path || menuPaths[item.text] || '';
                                                if (directPath && shouldOpenInNewTab(directPath)) {
                                                    openMenuPath(directPath);
                                                    return;
                                                }
                                                handleMenuItemClick(item);
                                            }}
                                            onMouseEnter={() => isSidebarCollapsed && setHoveredMenuItem(null)} // Close panel if hovering non-sub item
                                            data-tooltip={item.text}
                                        >
                                            <FontAwesomeIcon
                                                icon={iconMap[item.icon || 'fa-chart-pie'] || faChartPie}
                                                className="menu-icon"
                                                style={showColor ? { color: '#1abc9c' } : {}}
                                            />
                                            <span className="menu-text">{item.text}</span>
                                        </a>
                                    )}
                                    {hasSub && (
                                        <ul className="submenu-list">
                                            {item.sub?.map((subItem: string | MenuItem, subIndex: number) => {
                                                // Determine if it's a Leaf Node (Link) or Nested Group
                                                let isLeaf = false;
                                                let linkText = '';
                                                let linkPath = '';
                                                let subUniqueKey = `sub-${uniqueKey}-${subIndex}`;

                                                if (typeof subItem === 'string') {
                                                    isLeaf = true;
                                                    linkText = subItem;
                                                    linkPath = menuPaths[subItem] || '';
                                                    subUniqueKey = `sub-${linkText}`; // Stable key for strings
                                                } else {
                                                    const menuItem = subItem as MenuItem;
                                                    subUniqueKey = menuItem.id || `sub-${uniqueKey}-${subIndex}`;
                                                    if (!menuItem.sub || menuItem.sub.length === 0) {
                                                        isLeaf = true;
                                                        linkText = menuItem.text;
                                                        linkPath = menuItem.path || menuPaths[menuItem.text] || '';
                                                    }
                                                }

                                                if (isLeaf) {
                                                    const isSubActive = isActiveCheck(linkPath);
                                                    return (
                                                        <li key={subUniqueKey}>
                                                            <a
                                                                href="#"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    if (linkPath) {
                                                                        if (shouldOpenInNewTab(linkPath)) {
                                                                            openMenuPath(linkPath);
                                                                            return;
                                                                        }
                                                                        if (typeof subItem !== 'string' && (subItem as MenuItem).path) {
                                                                            handleMenuItemClick(subItem as MenuItem);
                                                                            return;
                                                                        }
                                                                        handleSubMenuClick(linkText);
                                                                    }
                                                                }}
                                                                className={isSubActive ? 'active' : ''}
                                                                style={isSubActive ? { color: '#1abc9c', fontWeight: 'bold' } : {}}
                                                            >
                                                                {linkText}
                                                            </a>
                                                        </li>
                                                    );
                                                } else {
                                                    const menuItem = subItem as MenuItem;
                                                    const nestedItemId = menuItem.id || `nested-${index}-${subIndex}`;
                                                    const isNestedActive = activeNestedMenuItems[nestedItemId];

                                                    return (
                                                        <li key={subUniqueKey} className="nested-submenu">
                                                            <button
                                                                className="submenu-header-btn"
                                                                onClick={(e) => {
                                                                    toggleNestedSubmenu(nestedItemId);
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                    <FontAwesomeIcon
                                                                        icon={iconMap[menuItem.icon || 'fa-circle'] || faChartPie}
                                                                        style={{ marginRight: '8px', fontSize: '12px', color: isNestedActive ? '#1abc9c' : 'inherit' }}
                                                                    />
                                                                    {menuItem.text}
                                                                </div>
                                                                <FontAwesomeIcon
                                                                    icon={faChevronRight}
                                                                    className={`arrow-icon ${isNestedActive ? 'rotated' : ''}`}
                                                                    style={{ fontSize: '10px', transition: 'transform 0.3s' }}
                                                                />
                                                            </button>
                                                            {isNestedActive && (
                                                                <ul className="nested-submenu-list" style={{ paddingLeft: '15px' }}>
                                                                    {menuItem.sub?.map((nestedItem: string | MenuItem, nestedIndex: number) => {
                                                                        let nestedUniqueKey = `nested-${subUniqueKey}-${nestedIndex}`;
                                                                        if (typeof nestedItem === 'string') {
                                                                            nestedUniqueKey = `nested-leaf-${nestedItem}`;
                                                                            const path = menuPaths[nestedItem];
                                                                            const isSubActive = isActiveCheck(path);
                                                                            if (!hasPermission(nestedItem)) return null;

                                                                            return (
                                                                                <li key={nestedUniqueKey}>
                                                                                    <a
                                                                                        href="#"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            if (path) {
                                                                                                openMenuPath(path);
                                                                                                return;
                                                                                            }
                                                                                            handleSubMenuClick(nestedItem as string);
                                                                                        }}
                                                                                        className={isSubActive ? 'active' : ''}
                                                                                        style={isSubActive ? { color: '#1abc9c', fontWeight: 'bold' } : {}}
                                                                                    >
                                                                                        {nestedItem}
                                                                                    </a>
                                                                                </li>
                                                                            );
                                                                        } else {
                                                                            const nestedObj = nestedItem as MenuItem;
                                                                            nestedUniqueKey = nestedObj.id || nestedUniqueKey;
                                                                            if (!nestedObj.sub || nestedObj.sub.length === 0) {
                                                                                const linkPath = nestedObj.path || menuPaths[nestedObj.text];
                                                                                const isSubActive = isActiveCheck(linkPath);
                                                                                if (!hasPermission(nestedObj.text)) return null;
                                                                                return (
                                                                                    <li key={nestedUniqueKey}>
                                                                                        <a
                                                                                            href="#"
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                const directPath = nestedObj.path || linkPath;
                                                                                                if (directPath && shouldOpenInNewTab(directPath)) {
                                                                                                    openMenuPath(directPath);
                                                                                                    return;
                                                                                                }
                                                                                                if (nestedObj.path) handleMenuItemClick(nestedObj);
                                                                                                else handleSubMenuClick(nestedObj.text);
                                                                                            }}
                                                                                            className={isSubActive ? 'active' : ''}
                                                                                            style={isSubActive ? { color: '#1abc9c', fontWeight: 'bold' } : {}}
                                                                                        >
                                                                                            {nestedObj.text}
                                                                                        </a>
                                                                                    </li>
                                                                                )
                                                                            }
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
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </nav>

            {/* Hover Submenu Panel for Collapsed Mode (Portal to body) */}
            {/* Hover Submenu Panel for Collapsed Mode (Portal to body) */}
            {isSidebarCollapsed && hoveredMenuItem && createPortal(
                <div
                    className={`submenu-panel ${hoveredMenuItem ? 'open' : ''}`}
                    onMouseEnter={handlePanelMouseEnter}
                    onMouseLeave={handlePanelMouseLeave}
                    style={{
                        position: 'fixed', // Ensure fixed positioning relative to viewport
                        zIndex: 9999, // Ensure it's on top
                        top: Math.min(hoveredItemTop, window.innerHeight - 300) + 'px', // Prevent going off-screen
                        left: '60px', // Explicitly set left position
                        transformOrigin: 'left top'
                    }}
                >
                    <div className="submenu-panel-header">
                        <span className="submenu-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FontAwesomeIcon icon={iconMap[hoveredMenuItem.icon || 'fa-chart-pie'] || faChartPie} style={{ color: '#1abc9c' }} />
                            {hoveredMenuItem.text}
                        </span>
                        <button className="submenu-close-btn" onClick={() => setHoveredMenuItem(null)}>
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                    <div className="submenu-panel-content">
                        {hoveredMenuItem.sub?.map((subItem: string | MenuItem, idx: number) => {
                            // Determine if this is a Leaf Node (clickable) or a Group (header for nested items)
                            let isLeaf = false;
                            let itemText = '';
                            let itemPath = '';
                            let itemIcon = '';

                            if (typeof subItem === 'string') {
                                isLeaf = true;
                                itemText = subItem;
                                itemPath = menuPaths[subItem];
                            } else {
                                const mi = subItem as MenuItem;
                                if (!mi.sub || mi.sub.length === 0) {
                                    isLeaf = true;
                                    itemText = mi.text;
                                    itemPath = mi.path || menuPaths[mi.text];
                                    itemIcon = mi.icon || '';
                                } else {
                                    isLeaf = false; // It's a group
                                    itemText = mi.text;
                                    itemIcon = mi.icon || '';
                                }
                            }

                            if (isLeaf) {
                                // RENDER LEAF NODE (Button)
                                const isSubActive = isActiveCheck(itemPath);
                                return (
                                    <button
                                        key={idx}
                                        className={`submenu-item ${isSubActive ? 'active' : ''}`}
                                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'left', width: '100%' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (itemPath) {
                                                openMenuPath(itemPath);
                                            } else {
                                                alert(`경로를 찾을 수 없습니다: ${itemText}`);
                                            }
                                            setHoveredMenuItem(null);
                                        }}
                                    >
                                        {/* Optional Icon for leaf if available */}
                                        {itemIcon && (
                                            <FontAwesomeIcon
                                                icon={iconMap[itemIcon] || faChartPie}
                                                style={{ marginRight: '8px', fontSize: '10px', width: '12px' }}
                                            />
                                        )}
                                        <span>{itemText}</span>
                                    </button>
                                );
                            } else {
                                // RENDER GROUP (Header + Nested Children)
                                const menuItem = subItem as MenuItem;
                                return (
                                    <div key={idx}>
                                        <div className="submenu-item nested-header" style={{ userSelect: 'none' }}>
                                            <span>
                                                <FontAwesomeIcon
                                                    icon={iconMap[menuItem.icon || 'fa-circle'] || faChartPie}
                                                    style={{ marginRight: '8px', fontSize: '10px' }}
                                                />
                                                {menuItem.text}
                                            </span>
                                        </div>
                                        {menuItem.sub?.map((nested: string | MenuItem, nIdx: number) => {
                                            // 1. Resolve Item Data (Text & Path)
                                            let deepText = '';
                                            let deepPath = '';
                                            let deepPermission = '';

                                            if (typeof nested === 'string') {
                                                deepText = nested;
                                                deepPath = menuPaths[nested];
                                                deepPermission = nested;
                                            } else {
                                                deepText = nested.text;
                                                deepPath = nested.path || menuPaths[nested.text];
                                                deepPermission = nested.text;
                                                if (nested.roles) {
                                                    // Role check placeholder
                                                }
                                            }

                                            // 2. Permission Check
                                            if (!hasPermission(deepPermission)) return null;

                                            // 3. Render Button
                                            const isNestedActive = isActiveCheck(deepPath);

                                            return (
                                                <button
                                                    key={`${idx}-${nIdx}`}
                                                    className={`submenu-item nested-item ${isNestedActive ? 'active' : ''}`}
                                                    style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'left', width: '100%' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent bubbling
                                                        if (deepPath) {
                                                            openMenuPath(deepPath);
                                                        } else {
                                                            console.warn("No deepPath found, falling back to handleSubMenuClick");
                                                            alert(`이 메뉴에는 연결된 경로가 없습니다: ${deepText}\n메뉴 관리에서 경로를 설정해주세요.`);
                                                            handleSubMenuClick(deepText);
                                                        }
                                                        setHoveredMenuItem(null);
                                                    }}
                                                >
                                                    {deepText}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Sidebar;
