import React, { useRef, useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUserGear,
    faGear,
    faUserShield,
    faUser,
    faRightFromBracket,
    faShieldHalved,
    faIdBadge,
    faSun,
    faMoon,
    faCalculator,
    faCamera,
    faEnvelope
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { resolveIcon } from '../../constants/iconMap';
import { DEFAULT_HEADER_ACTIONS } from '../../constants/headerActions';
import { manpowerService } from '../../services/manpowerService';
import { userService, type UserData } from '../../services/userService';
import { userMenuPositionService } from '../../services/userMenuPositionService';
import MessageIndicator from '../messages/MessageIndicator';
import PositionPanel from './PositionPanel';
import { PositionItem, SiteDataType, MenuItem } from '../../types/menu';

interface CheongyeonNavChild {
    label: string;
    path: string;
    sourceGroup?: string;
}

interface CheongyeonNavSection {
    key: string;
    label: string;
    path: string;
    children: CheongyeonNavChild[];
}

interface HeaderProps {
    toggleSidebar: () => void;
    togglePanel: (type: 'bottom' | 'admin' | 'position') => void;
    openQuickTool: (tool: QuickTool) => void;
    activeQuickTool: QuickTool;
    isQuickPanelOpen: boolean;
    currentSiteData: any;
    isAdmin: boolean;
    isPositionPanelOpen: boolean;
    currentPosition: string;
    changePosition: (positionId: string) => void;
    positions: PositionItem[];
    siteData: SiteDataType | null;
    currentSite: string;
    changeSite: (siteKey: string) => void;
    menuPaths: { [key: string]: string };
    logoUrl?: string;
    isDarkMode?: boolean;
    toggleDarkMode?: () => void;
}

type QuickTool = 'calculator' | 'camera';

const normalizeAccessRole = (role: unknown): string => String(role || '').trim();
const normalizeAccessRoleKey = (role: unknown): string => normalizeAccessRole(role).toLowerCase();

const toRoleList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map(normalizeAccessRole).filter(Boolean);
    }
    const normalized = normalizeAccessRole(value);
    return normalized ? [normalized] : [];
};

const uniqueRoles = (roles: unknown[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    roles.flatMap(toRoleList).forEach((role) => {
        const key = normalizeAccessRoleKey(role);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(role);
    });

    return result;
};

const roleListIncludes = (actualRoles: string[], allowedRoles: string[]): boolean => {
    const actualKeys = new Set(actualRoles.map(normalizeAccessRoleKey));
    return allowedRoles.some((role) => actualKeys.has(normalizeAccessRoleKey(role)));
};

const isPrivilegedRole = (role: unknown): boolean => {
    const normalized = normalizeAccessRoleKey(role);
    return ['admin', 'super_admin', 'administrator', 'owner'].includes(normalized)
        || ['관리자', '사장', '실장'].includes(normalizeAccessRole(role));
};

const isQuickToolAction = (action: string): action is QuickTool =>
    action === 'calculator' || action === 'camera';

const getMenuDisplayText = (text: string): string => {
    return text === '일보목록v2' ? '일보목록' : text;
};

const normalizePositionValue = (value: unknown): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^pos[\s_-]*/i, '')
        .replace(/[\s_-]/g, '');

const resolveSystemRoleLabel = (role: string): string => {
    const key = role.trim().toLowerCase();
    if (key === 'admin' || key === 'administrator') return '관리자';
    if (key === 'manager') return '매니저';
    if (key === 'user' || key === 'general') return '일반';
    return role;
};

const resolvePositionLabel = (value: unknown, positions: PositionItem[]): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const key = normalizePositionValue(raw);
    const matched = positions.find((position) => {
        const id = String(position.id || '').trim();
        return [id, `pos_${id}`, position.name].some((candidate) => normalizePositionValue(candidate) === key);
    });

    return matched?.name || resolveSystemRoleLabel(raw);
};

const resolveUserPositionLabel = (
    userProfile: UserData | null,
    linkedWorkerRole: string,
    positions: PositionItem[]
): string => {
    const candidates = [userProfile?.position, linkedWorkerRole, userProfile?.role];

    for (const candidate of candidates) {
        const label = resolvePositionLabel(candidate, positions);
        if (label) return label;
    }

    return '';
};

const Header: React.FC<HeaderProps> = ({
    toggleSidebar,
    togglePanel,
    openQuickTool,
    activeQuickTool,
    isQuickPanelOpen,
    currentSiteData,
    isAdmin,
    isPositionPanelOpen,
    currentPosition,
    changePosition,
    positions,
    siteData,
    currentSite,
    changeSite,
    menuPaths,
    logoUrl,
    isDarkMode = true,
    toggleDarkMode
}) => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activeTopNavKey, setActiveTopNavKey] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [linkedWorkerRole, setLinkedWorkerRole] = useState('');
    const [additionalMenuPositions, setAdditionalMenuPositions] = useState<string[]>([]);
    const topNavCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const positionPanelRef = useRef<HTMLDivElement>(null);
    const safeCurrentSiteData = currentSiteData || {
        name: '청연ENG ERP',
        icon: 'fa-shield-halved',
        menu: [],
        headerActions: DEFAULT_HEADER_ACTIONS
    };
    const userPositionLabel = resolveUserPositionLabel(userProfile, linkedWorkerRole, positions);
    const userAccessRoles = useMemo(() => uniqueRoles([
        userProfile?.position,
        linkedWorkerRole,
        userProfile?.role,
        additionalMenuPositions,
        isAdmin ? 'admin' : '',
        'user'
    ]), [userProfile, linkedWorkerRole, additionalMenuPositions, isAdmin]);

    const clearTopNavCloseTimer = () => {
        if (topNavCloseTimerRef.current) {
            clearTimeout(topNavCloseTimerRef.current);
            topNavCloseTimerRef.current = null;
        }
    };

    const scheduleTopNavClose = () => {
        clearTopNavCloseTimer();
        topNavCloseTimerRef.current = setTimeout(() => {
            setActiveTopNavKey(null);
        }, 280);
    };

    const handleTopNavMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Element) {
            if (
                nextTarget.closest('.cheongyeon-top-nav') ||
                nextTarget.closest('.cheongyeon-top-nav-dropdown')
            ) {
                clearTopNavCloseTimer();
                return;
            }
        }
        scheduleTopNavClose();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
            // Close position panel if click is outside
            if (positionPanelRef.current && !positionPanelRef.current.contains(event.target as Node)) {
                if (isPositionPanelOpen) {
                    togglePanel('position');
                }
            }

            const navContainer = document.querySelector('.cheongyeon-top-nav');
            if (navContainer && !navContainer.contains(event.target as Node)) {
                setActiveTopNavKey(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            clearTopNavCloseTimer();
        };
    }, [isPositionPanelOpen, togglePanel]);

    useEffect(() => {
        if (!currentUser?.uid) {
            setUserProfile(null);
            setLinkedWorkerRole('');
            return;
        }

        const uid = currentUser.uid;
        let cancelled = false;

        const loadLinkedWorkerRole = async () => {
            try {
                const linkedWorker = await manpowerService.getWorkerByUid(uid);
                if (!cancelled) {
                    setLinkedWorkerRole(String(linkedWorker?.role || '').trim());
                }
            } catch (error) {
                console.error('[Header] Failed to load linked worker role:', error);
                if (!cancelled) setLinkedWorkerRole('');
            }
        };

        const loadUserProfileFallback = async () => {
            try {
                const profile = await userService.getUser(uid);
                if (!cancelled) setUserProfile(profile);
            } catch (error) {
                console.error('[Header] Failed to load user profile:', error);
                if (!cancelled) setUserProfile(null);
            }
        };

        loadLinkedWorkerRole();

        const unsubscribe = onSnapshot(
            doc(db, 'users', uid),
            (docSnap) => {
                if (cancelled) return;
                setUserProfile(docSnap.exists() ? ({ ...(docSnap.data() as UserData), uid }) : null);
                loadLinkedWorkerRole();
            },
            (error) => {
                console.error('[Header] Failed to subscribe user profile:', error);
                loadUserProfileFallback();
            }
        );

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [currentUser?.uid]);

    useEffect(() => {
        if (!currentUser?.uid) {
            setAdditionalMenuPositions([]);
            return;
        }

        return userMenuPositionService.subscribe((map) => {
            setAdditionalMenuPositions(map[currentUser.uid] || []);
        });
    }, [currentUser?.uid]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const handleAdminToggle = async () => {
        if (!currentUser) return;
        try {
            await userService.updateUserRole(currentUser.uid, isAdmin ? 'user' : 'admin');
            alert(`관리자 권한이 ${isAdmin ? '해제' : '부여'}되었습니다. 새로고침하세요.`);
            window.location.reload();
        } catch (e: any) {
            console.error(e);
            alert(`변경 실패: ${e?.message || JSON.stringify(e)}`);
        }
    };

    // `test` and `nation` share the SITE-style top navigation shell.
    const isSiteLayerMode = currentSite === 'test' || currentSite === 'nation';
    const siteLandingPath = currentSite === 'nation' ? '/dashboard3' : '/dashboard2';
    const headerStyle = isSiteLayerMode
        ? isDarkMode
            ? { backgroundColor: '#0f172a', color: '#e2e8f0', borderBottom: '1px solid #1e293b' }
            : { backgroundColor: '#ffffff', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }
        : {};

    const shouldOpenInNewTab = (path: string | undefined): boolean => {
        if (!path) return false;
        const [, search] = path.split('?');
        if (!search) return false;
        const params = new URLSearchParams(search);
        return params.get('newTab') === '1' || params.get('newTab') === 'true';
    };

    const resolvePath = (menuItem?: MenuItem | null): string => {
        if (!menuItem) return '';
        return menuItem.path || menuPaths[menuItem.text] || '';
    };

    const collectChildLinks = (children: (string | MenuItem)[] = [], parentText?: string): CheongyeonNavChild[] => {
        const result: CheongyeonNavChild[] = [];

        children.forEach((child) => {
            if (typeof child === 'string') {
                const path = menuPaths[child] || '';
                if (!path) return;
                result.push({ label: getMenuDisplayText(child), path, sourceGroup: parentText });
                return;
            }

            const directPath = resolvePath(child);
            if (directPath) {
                result.push({ label: getMenuDisplayText(child.text), path: directPath, sourceGroup: parentText });
            }

            if (child.sub && child.sub.length > 0) {
                result.push(...collectChildLinks(child.sub, child.text));
            }
        });

        const dedup = new Map<string, CheongyeonNavChild>();
        result.forEach((item) => {
            const key = `${item.label}|${item.path}`;
            if (!dedup.has(key)) dedup.set(key, item);
        });

        return Array.from(dedup.values());
    };

    const cheongyeonTopNav: CheongyeonNavSection[] = Array.isArray(safeCurrentSiteData.menu)
        ? safeCurrentSiteData.menu
            .filter((item: MenuItem) => !item.hide)
            .map((item: MenuItem, index: number) => {
                const children = collectChildLinks(item.sub || [], item.text);
                const path = resolvePath(item) || children[0]?.path || '';
                return {
                    key: `${item.id || item.text || index}`,
                    label: getMenuDisplayText(item.text),
                    path,
                    children,
                };
            })
            .filter((item: CheongyeonNavSection) => !!item.path || item.children.length > 0)
        : [];

    const handleTopNavRoute = (path: string) => {
        if (!path) return;
        setActiveTopNavKey(null);
        if (shouldOpenInNewTab(path)) {
            window.open(path, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(path);
    };

    const isTopNavActive = (section: CheongyeonNavSection) => {
        if (section.path && location.pathname === section.path) return true;
        return section.children.some((child) => location.pathname.startsWith(child.path));
    };

    const baseConfiguredHeaderActions: MenuItem[] = Array.isArray(safeCurrentSiteData.headerActions)
        ? safeCurrentSiteData.headerActions
        : DEFAULT_HEADER_ACTIONS;
    const isPrivilegedHeaderUser = userAccessRoles.some(isPrivilegedRole);

    const configuredHeaderActions: MenuItem[] = React.useMemo(() => {
        const actions = [...baseConfiguredHeaderActions];
        if (!isPrivilegedHeaderUser) return actions;

        const ensureDefaultAction = (actionName: string) => {
            const hasAction = actions.some((item) => String(item.action || '').trim() === actionName);
            if (hasAction) return;

            const defaultAction = DEFAULT_HEADER_ACTIONS.find((item) => item.action === actionName);
            if (!defaultAction) return;

            const messageIndex = actions.findIndex((item) => String(item.action || '').trim() === 'messages');
            if (messageIndex >= 0) {
                actions.splice(messageIndex, 0, defaultAction);
                return;
            }

            actions.push(defaultAction);
        };

        ensureDefaultAction('position');
        ensureDefaultAction('admin');

        return actions;
    }, [baseConfiguredHeaderActions, isPrivilegedHeaderUser]);

    const hasHeaderActionAccess = (item: MenuItem): boolean => {
        if (item.hide) return false;
        if (isPrivilegedHeaderUser) return true;

        const allowedRoles = Array.isArray(item.roles)
            ? item.roles.map(normalizeAccessRole).filter(Boolean)
            : [];

        return allowedRoles.length === 0 || roleListIncludes(userAccessRoles, allowedRoles);
    };

    const getHeaderActionFallbackIcon = (action: string) => {
        if (action === 'position') return faIdBadge;
        if (action === 'admin') return faUserShield;
        if (action === 'messages') return faEnvelope;
        if (action === 'camera') return faCamera;
        if (action === 'calculator') return faCalculator;
        if (action === 'theme') return isDarkMode ? faSun : faMoon;
        return faGear;
    };

    const handleHeaderActionRoute = (path: string) => {
        if (!path) return;
        if (shouldOpenInNewTab(path)) {
            window.open(path, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(path);
    };

    const renderHeaderAction = (item: MenuItem, index: number): React.ReactNode => {
        const action = String(item.action || '').trim();
        const key = item.id || item.action || item.path || `${item.text}-${index}`;
        const label = item.text || action || '상단 아이콘';
        const iconStyle = item.iconColor ? { color: item.iconColor } : undefined;

        if (action === 'theme') {
            if (!isSiteLayerMode || !toggleDarkMode) return null;
            return (
                <button
                    key={key}
                    className="header-btn header-tool-btn cheongyeon-theme-toggle"
                    onClick={toggleDarkMode}
                    title={label}
                    aria-label={label}
                    style={{ color: item.iconColor || (isDarkMode ? '#fbbf24' : '#64748b') }}
                >
                    <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} />
                </button>
            );
        }

        if (isQuickToolAction(action)) {
            return (
                <button
                    key={key}
                    type="button"
                    className={`header-btn header-tool-btn ${isQuickPanelOpen && activeQuickTool === action ? 'active' : ''}`}
                    onClick={() => openQuickTool(action)}
                    title={label}
                    aria-label={`${label} 열기`}
                    aria-pressed={isQuickPanelOpen && activeQuickTool === action}
                >
                    <FontAwesomeIcon icon={resolveIcon(item.icon, getHeaderActionFallbackIcon(action))} style={iconStyle} />
                </button>
            );
        }

        if (action === 'position') {
            return (
                <div key={key} className="relative" ref={positionPanelRef}>
                    <button className="header-btn header-tool-btn text-indigo-400 hover:bg-white/10" onClick={() => togglePanel('position')} title={label} aria-label={`${label} 열기`}>
                        <FontAwesomeIcon icon={resolveIcon(item.icon, faIdBadge)} style={iconStyle} />
                    </button>
                    {isPositionPanelOpen && (
                        <PositionPanel
                            isOpen={isPositionPanelOpen}
                            togglePanel={togglePanel}
                            currentPosition={currentPosition}
                            changePosition={changePosition}
                            positions={positions}
                            siteData={siteData}
                            currentSite={currentSite}
                            changeSite={changeSite}
                        />
                    )}
                </div>
            );
        }

        if (action === 'admin') {
            return (
                <button key={key} className="header-btn header-tool-btn text-red-400 hover:bg-white/10" onClick={() => togglePanel('admin')} title={label} aria-label={`${label} 열기`}>
                    <FontAwesomeIcon icon={resolveIcon(item.icon, faUserShield)} style={iconStyle} />
                </button>
            );
        }

        if (action === 'messages') {
            return <MessageIndicator key={key} />;
        }

        const path = item.path || '';
        if (!path) return null;

        return (
            <button
                key={key}
                type="button"
                className="header-btn header-tool-btn"
                onClick={() => handleHeaderActionRoute(path)}
                title={label}
                aria-label={`${label} 열기`}
            >
                <FontAwesomeIcon icon={resolveIcon(item.icon, getHeaderActionFallbackIcon(action))} style={iconStyle} />
            </button>
        );
    };

    const renderedHeaderActions = configuredHeaderActions
        .filter(hasHeaderActionAccess)
        .map(renderHeaderAction)
        .filter(Boolean);

    return (
        <header id="main-header" style={headerStyle} className={isSiteLayerMode ? 'cheongyeon-header' : ''}>
            <div className="header-left-group">
                <button
                    type="button"
                    className={`app-menu-logo-button ${isSiteLayerMode ? 'cheongyeon-header-logo' : ''}`}
                    id="sidebar-toggle"
                    onClick={toggleSidebar}
                    aria-label="메뉴 토글"
                    title="메뉴 토글"
                >
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt="Logo"
                            className={isSiteLayerMode ? 'cheongyeon-header-logo-image' : 'app-menu-logo-image'}
                        />
                    ) : (
                        <FontAwesomeIcon
                            icon={resolveIcon(safeCurrentSiteData.icon, faShieldHalved)}
                            className={isSiteLayerMode ? 'cheongyeon-header-logo-icon' : 'app-menu-logo-icon'}
                        />
                    )}
                </button>

                {isSiteLayerMode && (
                    <button
                        type="button"
                        className="cheongyeon-header-logo cheongyeon-header-home-logo"
                        onClick={() => navigate(siteLandingPath)}
                        aria-label="청연 메인으로 이동"
                    >
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="청연 로고"
                                className="cheongyeon-header-logo-image"
                            />
                        ) : (
                            <FontAwesomeIcon
                                icon={resolveIcon(safeCurrentSiteData.icon, faShieldHalved)}
                                className="cheongyeon-header-logo-icon"
                            />
                        )}
                    </button>
                )}
            </div>

            {isSiteLayerMode && (
                <nav
                    className="cheongyeon-top-nav"
                    onMouseEnter={clearTopNavCloseTimer}
                    onMouseLeave={handleTopNavMouseLeave}
                >
                    {cheongyeonTopNav.map((section) => (
                        <div
                            key={section.key}
                            className="cheongyeon-top-nav-item"
                            onMouseLeave={handleTopNavMouseLeave}
                            onMouseEnter={() => {
                                clearTopNavCloseTimer();
                                setActiveTopNavKey(section.key);
                            }}
                        >
                            <button
                                type="button"
                                className={`cheongyeon-top-nav-link ${isTopNavActive(section) ? 'active' : ''}`}
                                onClick={() => handleTopNavRoute(section.path)}
                            >
                                {section.label}
                            </button>

                            {activeTopNavKey === section.key && section.children.length > 0 && (
                                <div className="cheongyeon-top-nav-dropdown" onMouseEnter={clearTopNavCloseTimer} onMouseLeave={handleTopNavMouseLeave}>
                                    <div className="cheongyeon-top-nav-dropdown-grid">
                                        {section.children.map((child) => (
                                            <button
                                                key={`${child.label}|${child.path}`}
                                                type="button"
                                                className={`cheongyeon-top-nav-sub-item ${location.pathname.startsWith(child.path) ? 'active' : ''}`}
                                                onClick={() => handleTopNavRoute(child.path)}
                                            >
                                                <span className="cheongyeon-top-nav-sub-title">{child.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            )}

            <div className="header-right-group">
                {renderedHeaderActions.length > 0 && (
                    <div className="header-quick-tool-group" role="group" aria-label="상단 아이콘 메뉴">
                        {renderedHeaderActions}
                    </div>
                )}

                <div className="profile-menu-container" ref={profileRef}>
                    <button
                        className="header-btn profile-btn"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        title="프로필"
                        aria-label="프로필 메뉴 열기"
                    >
                        {currentUser?.photoURL ? (
                            <img
                                src={currentUser.photoURL}
                                alt="Profile"
                                className="header-profile-img"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const icon = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                    if (icon) icon.style.display = 'block';
                                }}
                            />
                        ) : (
                            <FontAwesomeIcon icon={faUser} />
                        )}
                        {currentUser?.photoURL && (
                            <FontAwesomeIcon icon={faUser} className="fallback-icon" style={{ display: 'none' }} />
                        )}
                        {userPositionLabel && (
                            <span className="header-profile-position">{userPositionLabel}</span>
                        )}
                    </button>

                    {isProfileOpen && (
                        <div className="profile-dropdown">
                            <div className="profile-info">
                                <div className="profile-name">{currentUser?.displayName || '사용자'}</div>
                                {userPositionLabel && (
                                    <div className="profile-position">직책: {userPositionLabel}</div>
                                )}
                                <div className="profile-email">{currentUser?.email}</div>
                            </div>
                            <button className="dropdown-item logout-btn" onClick={() => {
                                setIsProfileOpen(false);
                                navigate('/messages');
                            }} style={{ color: '#0f766e' }}>
                                <FontAwesomeIcon icon={faEnvelope} />
                                <span>메시지함</span>
                            </button>
                            <button className="dropdown-item logout-btn" onClick={() => {
                                setIsProfileOpen(false);
                                navigate('/profile');
                            }}>
                                <FontAwesomeIcon icon={faUserGear} />
                                <span>프로필 설정</span>
                            </button>
                            <button className="dropdown-item logout-btn" onClick={handleLogout}>
                                <FontAwesomeIcon icon={faRightFromBracket} />
                                <span>로그아웃</span>
                            </button>
                            <button className="dropdown-item logout-btn" onClick={handleAdminToggle} style={{ marginTop: '10px', color: '#3b82f6', borderTop: '1px solid #eee' }}>
                                <FontAwesomeIcon icon={faUserShield} />
                                <span>{isAdmin ? '관리자 해제' : '관리자 권한 부여 (임시)'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
