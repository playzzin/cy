import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SidebarSubmenu } from './SidebarSubmenu';
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
    faBook,
    faUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { rolePermissionService } from '../../services/rolePermissionService';
import { SiteDataType, MenuItem } from '../../types/menu';

import * as AllIcons from '@fortawesome/free-solid-svg-icons';
import { iconMap, resolveIcon } from '../../constants/iconMap';
import { getCurrentLogoUrl } from '../../services/geminiImageService';
import { userMenuPositionService } from '../../services/userMenuPositionService';

interface SidebarProps {
    currentSite: string;
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
    '스마트 메모': 'smart-memo',
    'Smart Memo': 'smart-memo',
    // Add mappings for parent menus if needed, or handle logic to show parent if any child is visible
};

const ENABLE_MENU_PERMISSION_FILTER = process.env.REACT_APP_ENABLE_MENU_PERMISSION_FILTER === 'true';

const Sidebar: React.FC<SidebarProps> = ({
    currentSite,
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
    const [userPosition, setUserPosition] = useState<string>(() => {
        try {
            return localStorage.getItem('cy_user_position') || '';
        } catch {
            return '';
        }
    });
    const [isUserPositionLoaded, setIsUserPositionLoaded] = useState<boolean>(false);
    const [, setPermissions] = useState<any>(null);
    const [siteLogoUrl, setSiteLogoUrl] = useState<string | null>(null);
    const [additionalPositions, setAdditionalPositions] = useState<string[]>([]);

    useEffect(() => {
        let timer: any;
        let cancelled = false;

        const loadPosition = async () => {
            if (!currentUser) {
                setUserPosition('');
                setIsUserPositionLoaded(true);
                return;
            }
            try {
                const u = await userService.getUser(currentUser.uid);
                if (cancelled) return;
                const position = (u?.position ? String(u.position) : '');
                setUserPosition(position);
                setIsUserPositionLoaded(true);
                try {
                    localStorage.setItem('cy_user_position', position);
                } catch {
                    // ignore
                }
            } catch {
                if (!cancelled) {
                    setUserPosition('');
                    setIsUserPositionLoaded(true);
                }
            }
        };

        loadPosition();
        timer = setInterval(loadPosition, 30000);

        const unsubscribe = rolePermissionService.subscribe((perms) => {
            setPermissions(perms);
        });

        // Initial fetch
        rolePermissionService.getPermissions().then(setPermissions);

        return () => {
            unsubscribe();
            cancelled = true;
            if (timer) clearInterval(timer);
        };
    }, [currentUser]);

    useEffect(() => {
        getCurrentLogoUrl().then(setSiteLogoUrl).catch(() => setSiteLogoUrl(null));
    }, []);

    // 유저별 추가 직책 로드
    useEffect(() => {
        if (!currentUser) { setAdditionalPositions([]); return; }
        const unsub = userMenuPositionService.subscribe((data) => {
            setAdditionalPositions(data[currentUser.uid] || []);
        });
        return unsub;
    }, [currentUser]);

    const getUserPositionAliases = (rawPosition: string): Set<string> => {
        const aliases = new Set<string>();
        const normalized = typeof rawPosition === 'string' ? rawPosition.trim() : '';

        const effective = normalized || '일반';
        aliases.add(effective);

        if (effective === '사장' || effective === '실장' || effective === '관리자') {
            ['사장', '실장', '관리자', 'admin'].forEach((v) => aliases.add(v));
        }

        if (effective.startsWith('매니저') || effective.startsWith('메니저')) {
            ['매니저', '메니저', 'manager', '매니저1', '매니저2', '매니저3', '메니저 1', '메니저 2', '메니저 3'].forEach((v) => aliases.add(v));
        }

        if (effective === '신규자' || effective === '신규') {
            ['신규자', '신규', 'newbie'].forEach((v) => aliases.add(v));
        }

        if (effective === '일반') {
            ['일반', 'general', 'user'].forEach((v) => aliases.add(v));
        }

        return aliases;
    };

    const expandLegacyMenuRoleToPositions = (role: string): string[] => {
        const raw = typeof role === 'string' ? role.trim() : '';
        if (!raw) return [];

        if (raw === 'admin') return ['사장'];
        if (raw === 'manager') return ['매니저1', '매니저2', '매니저3'];
        if (raw === 'user' || raw === 'general') return ['일반'];
        if (raw === 'newbie') return ['신규자'];

        return [raw];
    };

    // 유저의 모든 직책 별칭을 합산 (기본직책 + 추가직책)
    const getAllUserAliases = (): Set<string> => {
        const aliases = getUserPositionAliases(userPosition);
        additionalPositions.forEach(pos => {
            getUserPositionAliases(pos).forEach(a => aliases.add(a));
        });
        return aliases;
    };

    const hasPermission = (itemText: string, itemRoles?: string[]): boolean => {
        if (!ENABLE_MENU_PERMISSION_FILTER) return true;

        // Simulation Mode Bypass: If viewing a specific position's menu, show everything configured for it
        if (currentSite.startsWith('pos_')) return true;

        // 1. Dynamic Check (Priority 1): MenuItem.roles[] 기반 (직책 + 추가직책 통합 판단)
        if (itemRoles && itemRoles.length > 0) {
            if (!isUserPositionLoaded) return true;
            const allAliases = getAllUserAliases();
            return itemRoles
                .flatMap((r) => expandLegacyMenuRoleToPositions(r))
                .some((r) => allAliases.has(r));
        }

        // 2. Legacy Check (Priority 2)
        const permissionId = MENU_PERMISSION_MAP[itemText];
        if (!permissionId) return true;

        if (!isUserPositionLoaded) return true;

        const effectivePosition = userPosition || '일반';
        return rolePermissionService.hasAccess(effectivePosition, permissionId);
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

    const openMenuPathInNewWindow = (path: string) => {
        if (!path) return;
        window.open(path, '_blank', 'noopener,noreferrer');
        if (isMobile) closeAll();
    };

    const resolveMenuPrimaryPath = (item: MenuItem): string => {
        if (item.path) return item.path;
        if (!item.sub || item.sub.length === 0) return '';

        for (const subItem of item.sub) {
            if (typeof subItem === 'string') {
                const path = menuPaths[subItem];
                if (path) return path;
                continue;
            }

            const nestedPath = resolveMenuPrimaryPath(subItem);
            if (nestedPath) return nestedPath;
        }

        return '';
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

            if (filteredSub.length === 0) {
                return null;
            }

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

    // Cheongyeon Style Check
    const isCheongyeon = currentSite === 'cheongyeon';
    const sidebarStyle = isCheongyeon ? { backgroundColor: '#0f172a', color: '#e2e8f0' } : {};
    const logoStyle = isCheongyeon ? { color: '#ffffff' } : {};

    return (
        <>
            <nav id="sidebar" onMouseLeave={handleMouseLeaveNav} style={sidebarStyle} className={isCheongyeon ? 'cheongyeon-sidebar' : ''}>
                <div className="sidebar-header">
                    <div className="logo-group" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
                        {siteLogoUrl ? (
                            <img
                                src={siteLogoUrl}
                                alt="Site Logo"
                                id="sidebar-logo-icon"
                                style={{ width: '28px', height: '28px', marginRight: '10px', borderRadius: '6px', objectFit: 'cover' }}
                            />
                        ) : (
                            <FontAwesomeIcon
                                icon={resolveIcon(currentSiteData.icon, faShieldHalved)}
                                id="sidebar-logo-icon"
                                style={{ color: '#1abc9c', fontSize: '24px', marginRight: '10px' }}
                            />
                        )}
                        <span id="sidebar-logo-text" className="logo-text" style={logoStyle}>{currentSiteData.name}</span>
                    </div>
                    <button id="mobile-close-btn" onClick={closeAll} style={isCheongyeon ? { color: 'white' } : {}}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div className="menu-list-wrapper">
                    <ul className="menu-list" style={{ paddingBottom: '20px' }}>
                        {finalMenu.map((item: MenuItem, index: number) => {
                            const hasSub = item.sub && item.sub.length > 0;
                            const uniqueKey = item.id || `menu-${index}`;
                            const itemId = uniqueKey;
                            const isExpanded = activeMenuItems[itemId];
                            const isChildActive = isParentActive(item);
                            const topLevelPath = hasSub ? '' : resolveMenuPrimaryPath(item);

                            // Determine Active Color (Default: #1abc9c)
                            const activeColor = item.activeColor || '#1abc9c';
                            // Determine Icon Color (Default: inherit or specific logic)
                            // If active/expanded, we might want to force activeColor or keep iconColor?
                            // Usually active state overrides icon color to activeColor.
                            // Let's use iconColor if set, UNLESS active/expanded where we might want high contrast or activeColor.
                            // Current design: Active item text/icon becomes activeColor (green #1abc9c).

                            const isItemActive = isExpanded || isChildActive;
                            const effectiveIconColor = isItemActive ? activeColor : (item.iconColor || undefined);
                            const effectiveTextStyle = isItemActive ? { color: activeColor, fontWeight: 'bold' } : {};

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
                                            style={effectiveTextStyle}
                                        >
                                            <FontAwesomeIcon
                                                icon={resolveIcon(item.icon)}
                                                className="menu-icon"
                                                style={{ color: effectiveIconColor }}
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
                                            className={`menu-link ${topLevelPath ? 'has-open-btn' : ''}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const directPath = item.path || '';
                                                if (directPath && shouldOpenInNewTab(directPath)) {
                                                    openMenuPath(directPath);
                                                    return;
                                                }
                                                handleMenuItemClick(item);
                                            }}
                                            onMouseEnter={() => isSidebarCollapsed && setHoveredMenuItem(null)}
                                            data-tooltip={item.text}
                                            style={isActiveCheck(item.path) ? { color: activeColor, fontWeight: 'bold' } : {}}
                                        >
                                            <FontAwesomeIcon
                                                icon={resolveIcon(item.icon)}
                                                className="menu-icon"
                                                style={{
                                                    color: isActiveCheck(item.path) ? activeColor : (item.iconColor || undefined)
                                                }}
                                            />
                                            <span className="menu-text">{item.text}</span>
                                            {topLevelPath && (
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    className="menu-open-new-btn"
                                                    title={`${item.text} 새창 열기`}
                                                    aria-label={`${item.text} 새창 열기`}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        openMenuPathInNewWindow(topLevelPath);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openMenuPathInNewWindow(topLevelPath);
                                                        }
                                                    }}
                                                >
                                                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                                                </span>
                                            )}
                                        </a>
                                    )}
                                    {hasSub && (
                                        <ul className="submenu-list">
                                            {item.sub?.map((subItem: string | MenuItem, subIndex: number) => {
                                                let isLeaf = false;
                                                let linkText = '';
                                                let linkPath = '';
                                                let subUniqueKey = `sub-${uniqueKey}-${subIndex}`;
                                                let subItemIconColor = undefined;
                                                let subItemActiveColor = '#1abc9c';

                                                if (typeof subItem === 'string') {
                                                    isLeaf = true;
                                                    linkText = subItem;
                                                    linkPath = menuPaths[subItem] || '';
                                                    subUniqueKey = `sub-${linkText}`;
                                                } else {
                                                    const menuItem = subItem as MenuItem;
                                                    subUniqueKey = menuItem.id || `sub-${uniqueKey}-${subIndex}`;
                                                    subItemIconColor = menuItem.iconColor;
                                                    subItemActiveColor = menuItem.activeColor || '#1abc9c';

                                                    if (!menuItem.sub || menuItem.sub.length === 0) {
                                                        isLeaf = true;
                                                        linkText = menuItem.text;
                                                        linkPath = menuItem.path || '';
                                                    }
                                                }

                                                if (isLeaf) {
                                                    const isSubActive = isActiveCheck(linkPath);
                                                    const leafPathForNewWindow = linkPath || menuPaths[linkText] || '';
                                                    return (
                                                        <li
                                                            key={subUniqueKey}
                                                            className={`submenu-leaf-item ${leafPathForNewWindow ? 'has-open-btn' : ''}`}
                                                        >
                                                            <a
                                                                href="#"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    if (linkPath) {
                                                                        openMenuPath(linkPath);
                                                                        return;
                                                                    }

                                                                    handleSubMenuClick(linkText);
                                                                }}
                                                                className={isSubActive ? 'active' : ''}
                                                                style={{
                                                                    color: isSubActive ? subItemActiveColor : undefined,
                                                                    fontWeight: isSubActive ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                {/* Optional Icon for Subitems if needed, typically text only on this level in this design, but if desired: */}
                                                                {/* {item has iconColor logic?} */}
                                                                {linkText}
                                                            </a>
                                                            {leafPathForNewWindow && (
                                                                <button
                                                                    type="button"
                                                                    className="submenu-open-new-btn"
                                                                    title={`${linkText} 새창 열기`}
                                                                    aria-label={`${linkText} 새창 열기`}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        openMenuPathInNewWindow(leafPathForNewWindow);
                                                                    }}
                                                                >
                                                                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                                                                </button>
                                                            )}
                                                        </li>
                                                    );
                                                } else {
                                                    const menuItem = subItem as MenuItem;
                                                    const nestedItemId = menuItem.id || `nested-${index}-${subIndex}`;
                                                    const isNestedActive = activeNestedMenuItems[nestedItemId];
                                                    const nestedActiveColor = menuItem.activeColor || '#1abc9c';
                                                    const nestedIconColor = menuItem.iconColor;

                                                    return (
                                                        <li key={subUniqueKey} className="nested-submenu">
                                                            <button
                                                                className="submenu-header-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleNestedSubmenu(nestedItemId);
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                    <FontAwesomeIcon
                                                                        icon={resolveIcon(menuItem.icon, faChartPie)}
                                                                        style={{
                                                                            marginRight: '8px',
                                                                            fontSize: '12px',
                                                                            color: isNestedActive ? nestedActiveColor : (nestedIconColor || 'inherit')
                                                                        }}
                                                                    />
                                                                    <span style={isNestedActive ? { color: nestedActiveColor } : {}}>
                                                                        {menuItem.text}
                                                                    </span>
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
                                                                        let nestedDeepActiveColor = '#1abc9c';

                                                                        if (typeof nestedItem === 'string') {
                                                                            nestedUniqueKey = `nested-leaf-${nestedItem}`;
                                                                            const path = menuPaths[nestedItem];
                                                                            const isSubActive = isActiveCheck(path);
                                                                            const nestedLeafPathForNewWindow = path || '';
                                                                            if (!hasPermission(nestedItem)) return null;

                                                                            return (
                                                                                <li
                                                                                    key={nestedUniqueKey}
                                                                                    className={`nested-leaf-item ${nestedLeafPathForNewWindow ? 'has-open-btn' : ''}`}
                                                                                >
                                                                                    <a
                                                                                        href="#"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            e.preventDefault();
                                                                                            if (path) {
                                                                                                openMenuPath(path);
                                                                                                return;
                                                                                            }
                                                                                            handleSubMenuClick(nestedItem as string);
                                                                                        }}
                                                                                        className={isSubActive ? 'active' : ''}
                                                                                        style={isSubActive ? { color: nestedDeepActiveColor, fontWeight: 'bold' } : {}}
                                                                                    >
                                                                                        {nestedItem}
                                                                                    </a>
                                                                                    {nestedLeafPathForNewWindow && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="submenu-open-new-btn"
                                                                                            title={`${nestedItem} 새창 열기`}
                                                                                            aria-label={`${nestedItem} 새창 열기`}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                openMenuPathInNewWindow(nestedLeafPathForNewWindow);
                                                                                            }}
                                                                                        >
                                                                                            <FontAwesomeIcon icon={faUpRightFromSquare} />
                                                                                        </button>
                                                                                    )}
                                                                                </li>
                                                                            );
                                                                        } else {
                                                                            const nestedObj = nestedItem as MenuItem;
                                                                            nestedUniqueKey = nestedObj.id || nestedUniqueKey;
                                                                            nestedDeepActiveColor = nestedObj.activeColor || '#f59e0b';

                                                                            if (!nestedObj.sub || nestedObj.sub.length === 0) {
                                                                                const linkPath = nestedObj.path || menuPaths[nestedObj.text];
                                                                                const isSubActive = isActiveCheck(linkPath);
                                                                                if (!hasPermission(nestedObj.text)) return null;
                                                                                const nestedObjPathForNewWindow = (nestedObj.path || linkPath || '');
                                                                                return (
                                                                                    <li
                                                                                        key={nestedUniqueKey}
                                                                                        className={`nested-leaf-item ${nestedObjPathForNewWindow ? 'has-open-btn' : ''}`}
                                                                                    >
                                                                                        <a
                                                                                            href="#"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                e.preventDefault();
                                                                                                const directPath = nestedObj.path || linkPath;
                                                                                                if (directPath) {
                                                                                                    openMenuPath(directPath);
                                                                                                    return;
                                                                                                }

                                                                                                handleSubMenuClick(nestedObj.text);
                                                                                            }}
                                                                                            className={isSubActive ? 'active' : ''}
                                                                                            style={isSubActive ? { color: nestedDeepActiveColor, fontWeight: 'bold' } : {}}
                                                                                        >
                                                                                            {nestedObj.text}
                                                                                        </a>
                                                                                        {nestedObjPathForNewWindow && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="submenu-open-new-btn"
                                                                                                title={`${nestedObj.text} 새창 열기`}
                                                                                                aria-label={`${nestedObj.text} 새창 열기`}
                                                                                                onClick={(e) => {
                                                                                                    e.preventDefault();
                                                                                                    e.stopPropagation();
                                                                                                    openMenuPathInNewWindow(nestedObjPathForNewWindow);
                                                                                                }}
                                                                                            >
                                                                                                <FontAwesomeIcon icon={faUpRightFromSquare} />
                                                                                            </button>
                                                                                        )}
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
            {isSidebarCollapsed && hoveredMenuItem && (
                <SidebarSubmenu
                    item={hoveredMenuItem}
                    top={hoveredItemTop}
                    menuPaths={menuPaths}
                    onClose={() => setHoveredMenuItem(null)}
                    onMouseEnter={handlePanelMouseEnter}
                    onMouseLeave={handlePanelMouseLeave}
                    onItemClick={(path: string | undefined) => {
                        if (path) {
                            openMenuPath(path);
                        }
                        setHoveredMenuItem(null);
                    }}
                    onOpenInNewWindow={(path: string | undefined) => {
                        if (path) {
                            openMenuPathInNewWindow(path);
                        }
                        setHoveredMenuItem(null);
                    }}
                    isActiveCheck={isActiveCheck}
                />
            )}
        </>
    );
};

export default Sidebar;
