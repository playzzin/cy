import React, { useEffect, useMemo, useState } from 'react';
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
    faChevronLeft,
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
    faUpRightFromSquare,
    faCircle
} from '@fortawesome/free-solid-svg-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { userMenuPositionService } from '../../services/userMenuPositionService';
import { rolePermissionService } from '../../services/rolePermissionService';
import { SiteDataType, MenuItem } from '../../types/menu';
import { isRunningAsStandaloneApp } from '../../pwaInstallPrompt';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { devUsers } from '../../utils/devAdminFixtures';
import { buildMenuAccessRoles } from '../../utils/menuAccess';
import { isOperationManagementMenuPath, isOperationManagementMenuText } from '../../utils/operationMenuAccess';

import { resolveIcon } from '../../constants/iconMap';
import SidebarMenuSearch from './SidebarMenuSearch';
import MenuDivider from './MenuDivider';
import { isMenuDivider } from '../../utils/menuDivider';
import { getLinkedMenuRef } from '../../utils/linkedPositionMenus';
import SidebarMenuBranch from './SidebarMenuBranch';

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
    toggleSidebar?: () => void;
    logoUrl?: string;
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
    '복지 자산 관리': 'welfare-assets',
    '캐시/포인트 관리': 'welfare-assets',
    '포인트 게임 관리': 'welfare-assets',
    '스마트 메모': 'smart-memo',
    'Smart Memo': 'smart-memo',
    // Add mappings for parent menus if needed, or handle logic to show parent if any child is visible
};

const PATH_PERMISSION_MAP: { [key: string]: string } = {
    '/memos': 'smart-memo',
    '/admin/welfare-assets': 'welfare-assets',
};

const normalizeRole = (role: unknown): string => String(role || '').trim();
const normalizeRoleKey = (role: unknown): string => normalizeRole(role).toLowerCase();

const toRoleList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map(normalizeRole).filter(Boolean);
    }
    const normalized = normalizeRole(value);
    return normalized ? [normalized] : [];
};

const uniqueRoles = (roles: unknown[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    roles.flatMap(toRoleList).forEach((role) => {
        const key = normalizeRoleKey(role);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(role);
    });

    return result;
};

const roleListIncludes = (actualRoles: string[], allowedRoles: string[]): boolean => {
    const actualKeys = new Set(actualRoles.map(normalizeRoleKey));
    return allowedRoles.some((role) => actualKeys.has(normalizeRoleKey(role)));
};

const ADMIN_ROLE_KEYS = [
    'admin',
    'super_admin',
    'administrator',
    'owner',
    'dev',
    'developer',
    'system_admin',
    'jhl2vtnk9v3c4eiz4qqi',
    'pos_jhl2vtnk9v3c4eiz4qqi',
    '관리자',
    '사장',
    '실장',
    '개발',
    '개발자',
    '시스템관리자',
];

const isAdminRole = (role: unknown): boolean => {
    return ADMIN_ROLE_KEYS.includes(normalizeRoleKey(role));
};

const getPermissionId = (itemText: string, itemPath?: string): string | undefined => {
    const textPermission = MENU_PERMISSION_MAP[itemText];
    if (textPermission) return textPermission;

    const normalizedPath = typeof itemPath === 'string' ? itemPath.split('?')[0] : '';
    return normalizedPath ? PATH_PERMISSION_MAP[normalizedPath] : undefined;
};

const DEFAULT_SUBMENU_ICON = 'fa-circle';

const getMenuDisplayText = (text: string): string => {
    return text === '일보목록v2' ? '일보목록' : text;
};

const inferMenuIconName = (text: string, path?: string, explicitIcon?: string): string => {
    const icon = typeof explicitIcon === 'string' ? explicitIcon.trim() : '';
    if (icon) return icon;

    const normalizedPath = typeof path === 'string' ? path.split('?')[0] : '';
    if (normalizedPath.startsWith('/payroll/taxinvoice')) return 'fa-file-invoice-dollar';
    if (normalizedPath.startsWith('/payroll')) return 'fa-money-bill-wave';
    if (normalizedPath.startsWith('/reports') || normalizedPath.startsWith('/report')) return 'fa-clipboard-list';
    if (normalizedPath.startsWith('/database')) return 'fa-database';
    if (normalizedPath.startsWith('/materials')) return 'fa-boxes-stacked';
    if (normalizedPath.startsWith('/support/vehicles')) return 'fa-truck-front';
    if (normalizedPath.startsWith('/support/cards')) return 'fa-credit-card';
    if (normalizedPath.startsWith('/support')) return 'fa-hand-holding-dollar';
    if (normalizedPath.startsWith('/assignment')) return 'fa-list-check';
    if (normalizedPath.startsWith('/manpower')) return 'fa-users';
    if (normalizedPath.startsWith('/hr')) return 'fa-user-tag';
    if (normalizedPath.startsWith('/settings') || normalizedPath.startsWith('/admin')) return 'fa-gears';
    if (normalizedPath.startsWith('/storage')) return 'fa-hard-drive';
    if (normalizedPath.startsWith('/gallery')) return 'fa-photo-film';
    if (normalizedPath.startsWith('/company')) return 'fa-building';
    if (normalizedPath.startsWith('/site')) return 'fa-helmet-safety';
    if (normalizedPath.startsWith('/estimate') || normalizedPath.startsWith('/transaction')) return 'fa-file-contract';
    if (normalizedPath.startsWith('/cheongyeon')) return 'fa-building';
    if (normalizedPath === '/memos') return 'fa-sticky-note';
    if (normalizedPath === '/todo') return 'fa-list-check';

    const compactText = text.replace(/\s+/g, '');
    if (/급여|일급|월급|지급|정산|가불|세금|계좌|명세/.test(compactText)) return 'fa-money-bill-wave';
    if (/일보|출력|통계|보고/.test(compactText)) return 'fa-clipboard-list';
    if (/DB|데이터|조회|콘솔/.test(compactText)) return 'fa-database';
    if (/자재|입고|출고|재고/.test(compactText)) return 'fa-boxes-stacked';
    if (/차량/.test(compactText)) return 'fa-truck-front';
    if (/카드/.test(compactText)) return 'fa-credit-card';
    if (/지원|경비/.test(compactText)) return 'fa-hand-holding-dollar';
    if (/현장|배정/.test(compactText)) return 'fa-helmet-safety';
    if (/작업자|근로자|인력|팀/.test(compactText)) return 'fa-users';
    if (/설정|관리|권한|메뉴/.test(compactText)) return 'fa-gears';
    if (/서명|위임/.test(compactText)) return 'fa-pen-nib';
    if (/회사|업체|사무실/.test(compactText)) return 'fa-building';
    if (/이미지|갤러리|프로젝트/.test(compactText)) return 'fa-photo-film';

    return DEFAULT_SUBMENU_ICON;
};

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
    openMobileSidebar,
    toggleSidebar,
    logoUrl
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const devAdminMode = isDevAdminSessionEnabled();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [additionalMenuPositions, setAdditionalMenuPositions] = useState<string[]>([]);
    const [linkedEntityRoles, setLinkedEntityRoles] = useState<string[]>([]);
    const [permissions, setPermissions] = useState<any>(null);
    const userAccessRoles = useMemo(() => {
        const basePositionRoles = linkedEntityRoles.length > 0 ? linkedEntityRoles : userProfile?.position;
        return buildMenuAccessRoles(
            basePositionRoles,
            userProfile?.role,
            userProfile?.systemRole,
            userProfile?.accountType,
            userProfile?.additionalPositions,
            additionalMenuPositions,
            'user'
        );
    }, [userProfile, linkedEntityRoles, additionalMenuPositions]);
    const safeCurrentSiteData = currentSiteData || {
        name: '청연ENG ERP',
        icon: 'fa-shield-halved',
        menu: []
    };

    useEffect(() => {
        let cancelled = false;
        let userUnsubscribe: () => void;
        let positionUnsubscribe: () => void;

        if (currentUser) {
            setLinkedEntityRoles([]);
            if (devAdminMode) {
                setUserProfile(devUsers.find((user) => user.uid === currentUser.uid) || {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    role: 'admin',
                    position: '사장'
                });
            } else {
                // Listen to user role changes in real-time
                userUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap: any) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserProfile(data || null);
                        console.log("Sidebar: User access profile updated", {
                            role: data?.role,
                            position: data?.position
                        });
                    } else {
                        setUserProfile(null);
                    }
                });
            }

            positionUnsubscribe = userMenuPositionService.subscribe((map) => {
                setAdditionalMenuPositions(map[currentUser.uid] || []);
            });

            void (async () => {
                try {
                    const [{ manpowerService }, { officeStaffService }] = await Promise.all([
                        import('../../services/manpowerService'),
                        import('../../services/officeStaffService')
                    ]);
                    const [linkedWorker, linkedOfficeStaff] = await Promise.all([
                        manpowerService.getWorkerByUid(currentUser.uid).catch(() => null),
                        officeStaffService.getOfficeStaffByUid(currentUser.uid).catch(() => null)
                    ]);
                    if (cancelled) return;
                    setLinkedEntityRoles(uniqueRoles([linkedWorker?.role, linkedOfficeStaff?.role]));
                } catch (error) {
                    console.error('[Sidebar] Failed to load linked entity roles:', error);
                    if (!cancelled) setLinkedEntityRoles([]);
                }
            })();
        } else {
            setUserProfile(null);
            setAdditionalMenuPositions([]);
            setLinkedEntityRoles([]);
        }

        const unsubscribe = rolePermissionService.subscribe((perms) => {
            setPermissions(perms);
        });

        // Initial fetch
        rolePermissionService.getPermissions().then(setPermissions);

        return () => {
            cancelled = true;
            unsubscribe();
            if (userUnsubscribe) userUnsubscribe();
            if (positionUnsubscribe) positionUnsubscribe();
        };
    }, [currentUser, devAdminMode]);

    const hasPermission = (itemText: string, itemRoles?: string[], itemPath?: string): boolean => {
        if (userAccessRoles.some(isAdminRole)) return true;
        if (isOperationManagementMenuPath(itemPath) || isOperationManagementMenuText(itemText)) return true;

        // 1. Dynamic Check (Priority 1)
        if (itemRoles && itemRoles.length > 0) {
            return roleListIncludes(userAccessRoles, itemRoles);
        }

        // 2. Legacy Check (Priority 2)
        const permissionId = getPermissionId(itemText, itemPath);
        if (!permissionId) return true;

        return userAccessRoles.some((role) => rolePermissionService.hasAccess(role, permissionId));
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

    const isMenuEntryActive = (entry: string | MenuItem): boolean => {
        if (typeof entry === 'string') {
            return isActiveCheck(menuPaths[entry]);
        }

        const directPath = entry.path || menuPaths[entry.text];
        return isActiveCheck(directPath) || Boolean(entry.sub?.some(isMenuEntryActive));
    };

    const isParentActive = (item: MenuItem): boolean => Boolean(item.sub?.some(isMenuEntryActive));

    // Filter menu items based on permissions
    const filterMenuEntry = (entry: string | MenuItem): string | MenuItem | null => {
        if (typeof entry === 'object' && entry.hide) return null;
        if (isMenuDivider(entry)) return typeof entry === 'object' && entry.hide ? null : entry;
        if (typeof entry === 'string') {
            return hasPermission(entry, undefined, menuPaths[entry]) ? entry : null;
        }

        const directPath = entry.path || menuPaths[entry.text];
        const hasOriginalChildren = Array.isArray(entry.sub) && entry.sub.length > 0;
        const filteredSub = hasOriginalChildren
            ? (entry.sub || [])
                .map(filterMenuEntry)
                .filter((child): child is string | MenuItem => Boolean(child))
            : undefined;

        if (filteredSub && filteredSub.length > 0) {
            return { ...entry, sub: filteredSub };
        }

        if (getLinkedMenuRef(entry.id)?.itemId === undefined && getLinkedMenuRef(entry.id)) return { ...entry, sub: filteredSub || [] };
        if (hasOriginalChildren && !directPath) return null;

        return hasPermission(entry.text, entry.roles, directPath) ? { ...entry, sub: filteredSub } : null;
    };

    const filteredMenu = safeCurrentSiteData.menu
        .map((item: MenuItem) => filterMenuEntry(item))
        .filter((item: string | MenuItem | null): item is MenuItem => Boolean(item) && typeof item !== 'string');

    const finalMenu = [...filteredMenu];

    // State for hover menu in collapsed mode
    const [hoveredMenuItem, setHoveredMenuItem] = useState<MenuItem | null>(null);
    const liveHoveredMenuItem = hoveredMenuItem
        ? finalMenu.find(item => item.id ? item.id === hoveredMenuItem.id : item === hoveredMenuItem) || null
        : null;
    const [hoveredItemTop, setHoveredItemTop] = useState<number>(0);
    const [isPanelHovered, setIsPanelHovered] = useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleItemMouseEnter = (item: MenuItem, e: React.MouseEvent<HTMLLIElement>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (isSidebarCollapsed && !isMobile && item.sub) {
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
    const isCheongyeon = currentSite === 'test';
    const sidebarStyle = isCheongyeon ? { backgroundColor: '#0f172a', color: '#e2e8f0' } : {};

    const [logoType, setLogoType] = useState<'image' | 'video'>('image');

    useEffect(() => {
        if (logoUrl) {
            const isVideo = logoUrl.toLowerCase().includes('.mp4') || 
                          logoUrl.toLowerCase().includes('.webm') ||
                          logoUrl.toLowerCase().includes('video');
            setLogoType(isVideo ? 'video' : 'image');
        }
    }, [logoUrl]);

    const shouldShowLogoText = !isSidebarCollapsed && !isRunningAsStandaloneApp();

    return (
        <>
            <nav id="sidebar" onMouseLeave={handleMouseLeaveNav} style={sidebarStyle} className={isCheongyeon ? 'cheongyeon-sidebar' : ''}>
                <div className="sidebar-header">
                    <div className="logo-group" onClick={toggleSidebar ? toggleSidebar : handleLogoClick} title="메뉴 토글" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', flex: isSidebarCollapsed ? '0 0 100%' : '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                        {logoUrl ? (
                            logoType === 'video' ? (
                                <video 
                                    src={logoUrl} 
                                    autoPlay 
                                    loop 
                                    muted 
                                    playsInline
                                    style={{ height: '32px', width: 'auto', marginRight: '0', borderRadius: '4px' }}
                                />
                            ) : (
                                <img 
                                    src={logoUrl} 
                                    alt="Logo" 
                                    style={{ height: '32px', width: 'auto', marginRight: '0', objectFit: 'contain' }}
                                />
                            )
                        ) : (
                            <FontAwesomeIcon
                                icon={resolveIcon(safeCurrentSiteData.icon, faShieldHalved)}
                                id="sidebar-logo-icon"
                                style={{ color: '#1abc9c', fontSize: '24px', marginRight: '0' }}
                            />
                        )}
                        {shouldShowLogoText && (
                            <span className="logo-text" title={safeCurrentSiteData.name}>
                                {safeCurrentSiteData.name}
                            </span>
                        )}
                    </div>
                    {/* PC 전용: 접기 버튼 (펼쳐진 상태일 때만 표시) */}
                    {!isMobile && !isSidebarCollapsed && toggleSidebar && (
                        <button
                            className="sidebar-pc-toggle-btn"
                            onClick={toggleSidebar}
                            title="메뉴 접기"
                            aria-label="메뉴 접기"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                    )}
                    <button id="mobile-close-btn" onClick={closeAll} aria-label="메뉴 닫기" title="메뉴 닫기" style={isCheongyeon ? { color: 'white' } : {}}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <SidebarMenuSearch
                    key={`${currentSite}-${safeCurrentSiteData.sidebarSearchEnabled === true}`}
                    enabled={safeCurrentSiteData.sidebarSearchEnabled === true}
                    collapsed={isSidebarCollapsed && !isMobile}
                    items={filteredMenu}
                    menuPaths={menuPaths}
                    displayText={getMenuDisplayText}
                    isActive={isActiveCheck}
                    onNavigate={openMenuPath}
                    onExpand={toggleSidebar}
                >
                <div className="menu-list-wrapper">
                    <ul className="menu-list" style={{ paddingBottom: '20px' }}>
                        {finalMenu.map((item: MenuItem, index: number) => {
                            if (isMenuDivider(item)) return <li key={`divider-${item.id || index}`}><MenuDivider item={item} /></li>;
                            const hasSub = Boolean(item.sub?.length) || Boolean(getLinkedMenuRef(item.id) && getLinkedMenuRef(item.id)?.itemId === undefined);
                            const uniqueKey = item.id || `menu-${index}`;
                            const itemId = uniqueKey;
                            const isExpanded = activeMenuItems[itemId];
                            const isChildActive = isParentActive(item);

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
                                    key={`root-${uniqueKey}-${index}`}
                                    className={`menu-item ${isExpanded ? 'active' : ''}`}
                                    onMouseEnter={(e) => handleItemMouseEnter(item, e)}
                                >
                                    {hasSub ? (
                                        <button
                                            className="menu-btn"
                                            aria-label={getMenuDisplayText(item.text)}
                                            aria-expanded={isSidebarCollapsed && !isMobile ? liveHoveredMenuItem === item : Boolean(isExpanded)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isMobile) {
                                                    openMobileSidebar();
                                                    toggleSubmenu(itemId);
                                                } else if (isSidebarCollapsed) {
                                                    e.preventDefault();
                                                    setHoveredMenuItem(item);
                                                    setHoveredItemTop(e.currentTarget.getBoundingClientRect().top);
                                                } else {
                                                    toggleSubmenu(itemId);
                                                }
                                            }}
                                            data-tooltip={getMenuDisplayText(item.text)}
                                            style={effectiveTextStyle}
                                        >
                                            <FontAwesomeIcon
                                                icon={resolveIcon(item.icon)}
                                                className="menu-icon"
                                                style={{ color: effectiveIconColor }}
                                            />
                                            <span className="menu-text">{getMenuDisplayText(item.text)}</span>
                                            <FontAwesomeIcon
                                                icon={faChevronRight}
                                                className={`arrow-icon ${isExpanded ? 'rotated' : ''}`}
                                            />
                                        </button>
                                    ) : (
                                        <a
                                            href={item.path || menuPaths[item.text] || '/'}
                                            className="menu-link"
                                            aria-label={getMenuDisplayText(item.text)}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const directPath = item.path || menuPaths[item.text] || '';
                                                if (directPath && shouldOpenInNewTab(directPath)) {
                                                    openMenuPath(directPath);
                                                    return;
                                                }
                                                handleMenuItemClick(item);
                                            }}
                                            onMouseEnter={() => isSidebarCollapsed && setHoveredMenuItem(null)}
                                            data-tooltip={getMenuDisplayText(item.text)}
                                            style={isActiveCheck(item.path || menuPaths[item.text]) ? { color: activeColor, fontWeight: 'bold' } : {}}
                                        >
                                            <FontAwesomeIcon
                                                icon={resolveIcon(item.icon)}
                                                className="menu-icon"
                                                style={{
                                                    color: isActiveCheck(item.path || menuPaths[item.text]) ? activeColor : (item.iconColor || undefined)
                                                }}
                                            />
                                            <span className="menu-text">{getMenuDisplayText(item.text)}</span>
                                            {!isSidebarCollapsed && (
                                                <button
                                                    className="menu-open-new-btn"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const path = item.path || menuPaths[item.text] || '';
                                                        if (path) window.open(path, '_blank');
                                                    }}
                                                    title="새 창에서 열기"
                                                    aria-label={`${getMenuDisplayText(item.text)} 새 창에서 열기`}
                                                >
                                                    <FontAwesomeIcon icon={faUpRightFromSquare} size="xs" />
                                                </button>
                                            )}
                                        </a>
                                    )}
                                    {hasSub && isExpanded && (!isSidebarCollapsed || isMobile) && (
                                        <ul className="submenu-list" style={{ maxHeight: isExpanded ? 'none' : 0 }}>
                                            <SidebarMenuBranch items={item.sub || []} parentId={itemId}
                                                expanded={activeNestedMenuItems} onToggle={toggleNestedSubmenu}
                                                menuPaths={menuPaths} onNavigate={openMenuPath} isActive={isActiveCheck}
                                                displayText={getMenuDisplayText} iconName={inferMenuIconName} />
                                            {!item.sub?.length && <li className="px-5 py-3 text-xs text-slate-400">등록된 메뉴가 없습니다.</li>}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                </SidebarMenuSearch>
            </nav>

            {/* Hover Submenu Panel for Collapsed Mode (Portal to body) */}
            {isSidebarCollapsed && !isMobile && liveHoveredMenuItem && createPortal(
                <div
                    className={`submenu-panel ${liveHoveredMenuItem ? 'open' : ''}`}
                    onMouseEnter={handlePanelMouseEnter}
                    onMouseLeave={handlePanelMouseLeave}
                    style={{
                        position: 'fixed',
                        zIndex: 9999,
                        top: Math.min(hoveredItemTop, window.innerHeight - 300) + 'px',
                        left: '60px',
                        transformOrigin: 'left top',
                        borderColor: liveHoveredMenuItem.activeColor // Optional border color?
                    }}
                >
                    <div className="submenu-panel-header" style={liveHoveredMenuItem.activeColor ? { borderBottomColor: liveHoveredMenuItem.activeColor } : {}}>
                        <span className="submenu-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: liveHoveredMenuItem.activeColor || '#1abc9c' }}>
                            <FontAwesomeIcon
                                icon={resolveIcon(liveHoveredMenuItem.icon, faChartPie)}
                                style={{ color: liveHoveredMenuItem.activeColor || liveHoveredMenuItem.iconColor || '#1abc9c' }}
                            />
                            {getMenuDisplayText(liveHoveredMenuItem.text)}
                        </span>
                        <button className="submenu-close-btn" onClick={() => setHoveredMenuItem(null)} aria-label="하위 메뉴 닫기" title="하위 메뉴 닫기">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                    <div className="submenu-panel-content">
                        <ul>
                            <SidebarMenuBranch key={liveHoveredMenuItem.id || liveHoveredMenuItem.text} items={liveHoveredMenuItem.sub || []} parentId={liveHoveredMenuItem.id || 'panel'}
                                expanded={activeNestedMenuItems} onToggle={toggleNestedSubmenu} panel
                                menuPaths={menuPaths} onNavigate={path => { openMenuPath(path); setHoveredMenuItem(null); }}
                                isActive={isActiveCheck} displayText={getMenuDisplayText} iconName={inferMenuIconName} />
                            {!liveHoveredMenuItem.sub?.length && <li className="px-5 py-3 text-xs text-slate-400">등록된 메뉴가 없습니다.</li>}
                        </ul>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Sidebar;
