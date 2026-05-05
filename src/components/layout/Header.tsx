import React, { useRef, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBars,
    faUserGear,
    faGear,
    faUserShield,
    faUser,
    faRightFromBracket,
    faShieldHalved,
    faIdBadge,
    faSun,
    faMoon
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveIcon } from '../../constants/iconMap';
import { userService } from '../../services/userService';
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

const Header: React.FC<HeaderProps> = ({
    toggleSidebar,
    togglePanel,
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
    const topNavCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const positionPanelRef = useRef<HTMLDivElement>(null);

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
                result.push({ label: child, path, sourceGroup: parentText });
                return;
            }

            const directPath = resolvePath(child);
            if (directPath) {
                result.push({ label: child.text, path: directPath, sourceGroup: parentText });
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

    const cheongyeonTopNav: CheongyeonNavSection[] = Array.isArray(currentSiteData?.menu)
        ? currentSiteData.menu
            .filter((item: MenuItem) => !item.hide)
            .map((item: MenuItem, index: number) => {
                const children = collectChildLinks(item.sub || [], item.text);
                const path = resolvePath(item) || children[0]?.path || '';
                return {
                    key: `${item.id || item.text || index}`,
                    label: item.text,
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

    return (
        <header id="main-header" style={headerStyle} className={isSiteLayerMode ? 'cheongyeon-header' : ''}>
            <div className="header-left-group">
                <button className="header-btn" id="sidebar-toggle" onClick={toggleSidebar} aria-label="메뉴 토글">
                    <FontAwesomeIcon icon={faBars} />
                </button>

                {isSiteLayerMode && (
                    <button
                        type="button"
                        className="cheongyeon-header-logo"
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
                                icon={resolveIcon(currentSiteData.icon, faShieldHalved)}
                                className="cheongyeon-header-logo-icon"
                            />
                        )}
                    </button>
                )}

                <div className="mobile-logo-area">
                    {logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt="Logo" 
                            style={{ height: '24px', width: 'auto', marginRight: '8px', objectFit: 'contain' }}
                        />
                    ) : (
                        <FontAwesomeIcon icon={resolveIcon(currentSiteData.icon, faShieldHalved)} style={{ marginRight: '8px', color: '#3498db' }} />
                    )}
                    <span>{currentSiteData.name}</span>
                </div>
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
                {isSiteLayerMode && toggleDarkMode && (
                    <button
                        className="header-btn cheongyeon-theme-toggle"
                        onClick={toggleDarkMode}
                        title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
                        style={{ color: isDarkMode ? '#fbbf24' : '#64748b' }}
                    >
                        <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} />
                    </button>
                )}
                <button className="header-btn" onClick={() => togglePanel('bottom')} title="빠른 실행">
                    <FontAwesomeIcon icon={faUserGear} />
                </button>

                {isAdmin && (
                    <div className="relative" ref={positionPanelRef}>
                        <button className="header-btn text-indigo-400 hover:bg-white/10" onClick={() => togglePanel('position')} title="모드 선택">
                            <FontAwesomeIcon icon={faIdBadge} />
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
                )}

                {isAdmin && (
                    <button className="header-btn text-red-400 hover:bg-white/10" onClick={() => togglePanel('admin')} title="관리자 메뉴">
                        <FontAwesomeIcon icon={faUserShield} />
                    </button>
                )}

                <div className="profile-menu-container" ref={profileRef}>
                    <button
                        className="header-btn profile-btn"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        title="프로필"
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
                    </button>

                    {isProfileOpen && (
                        <div className="profile-dropdown">
                            <div className="profile-info">
                                <div className="profile-name">{currentUser?.displayName || '사용자'}</div>
                                <div className="profile-email">{currentUser?.email}</div>
                            </div>
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
