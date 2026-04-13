import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, type NavigateOptions } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MessageManager } from '../../constants/messages';
// ROLE_SITE_MAP removed - now fully dynamic
import './DashboardLayout.css';

import Header from './Header';
import Sidebar from './Sidebar';
// import RightPanel from './RightPanel';

import BottomPanel from './LayoutBottomPanel';
import AdminPanel from './AdminPanel';

// 타입 인터페이스 정의
import SidebarSkeleton from './SidebarSkeleton';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { SiteData, SiteDataType, MenuItem } from '../../types/menu';
import { MENU_PATHS } from '../../constants/menuPaths';
import { ErrorBoundary } from 'react-error-boundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { SiteModeProvider } from '../../contexts/SiteModeContext';

// Removed hardcoded siteData in favor of dynamic loading

interface DashboardLayoutProps {
    children: React.ReactNode;
}

// Error Fallback Component for UI Stability
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50 rounded-lg border border-slate-200 m-4">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 text-3xl mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">일시적인 오류 발생</h3>
            <p className="text-slate-500 text-sm mb-4">화면을 불러오는 중 문제가 발생했습니다.</p>
            <pre className="text-xs text-red-400 bg-red-50 p-2 rounded mb-4 max-w-xs overflow-auto">
                {error.message}
            </pre>
            <button
                onClick={resetErrorBoundary}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
            >
                <FontAwesomeIcon icon={faRotateRight} />
                다시 시도
            </button>
        </div>
    );
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
    const [isPositionPanelOpen, setIsPositionPanelOpen] = useState(false);
    // 사이트 모드를 localStorage에서 복원하여 수동 변경 시 유지되도록 함
    const [currentSite, setCurrentSite] = useState(() => {
        const saved = localStorage.getItem('cy_current_site');
        return saved || 'admin';
    });
    const [currentPosition, setCurrentPosition] = useState('full');
    const [userManuallyChangedSite, setUserManuallyChangedSite] = useState(() => {
        return localStorage.getItem('cy_site_manual') === 'true';
    });
    const [activeMenuItems, setActiveMenuItems] = useState<{ [key: string]: boolean }>({});
    const [activeNestedMenuItems, setActiveNestedMenuItems] = useState<{ [key: string]: boolean }>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        return localStorage.getItem('cy-cheongyeon-theme') !== 'light';
    });

    // Dynamic Menu State
    const [siteData, setSiteData] = useState<SiteDataType | null>(null);

    const didRunMenuMigrationsRef = useRef(false);

    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const navigateSync = useCallback((to: string, options?: NavigateOptions) => {
        navigate(to, {
            ...options,
            flushSync: true,
        });
    }, [navigate]);

    // Fetch Menu Config
    useEffect(() => {
        // Initial fetch logic omitted as subscribe handles init
        // Subscribe to real-time updates from menuServiceV11
        const unsubscribe = menuServiceV11.subscribe((newConfig) => {
            console.log('[DashboardLayout] Received new menu config update.', { siteKeys: Object.keys(newConfig) });
            setSiteData(newConfig);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Update MessageManager context on route change or user change
    useEffect(() => {
        MessageManager.setContext({
            uid: currentUser?.uid,
            page: location.pathname
        });
    }, [currentUser, location]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeAll();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 청연사이트 모드일 때 /dashboard 접근 시 /dashboard2로 리다이렉트
    useEffect(() => {
        if (currentSite === 'test' && location.pathname === '/dashboard') {
            navigateSync('/dashboard2', { replace: true });
        }
    }, [currentSite, location.pathname, navigateSync]);

    useEffect(() => {
        const setupAdminListener = async () => {
            if (currentUser && siteData) { // Wait for siteData to be loaded
                try {
                    const { userService } = await import('../../services/userService');

                    let cancelled = false;
                    const applyRole = (roleRaw: any) => {
                        const role = roleRaw ? String(roleRaw) : '';
                        const adminRoles = ['admin', '관리자', '사장', '실장'];
                        const isAdminRole = adminRoles.includes(role);
                        setIsAdmin(isAdminRole);

                        if (isAdminRole && !didRunMenuMigrationsRef.current) {
                            didRunMenuMigrationsRef.current = true;
                            menuServiceV11.runOneTimeMigrations().catch((err) => {
                                console.error('[MenuService] One-time migration failed:', err);
                            });
                        }

                        let targetSite = '';
                        if (role === 'admin' || role === '관리자') targetSite = 'admin';

                        if (siteData) {
                            const positions = siteData.admin?.positionConfig || [];
                            const matchedPos = positions.find((p: any) => p.name === role || p.id === role);
                            if (matchedPos) {
                                if (matchedPos.id === 'full') {
                                    targetSite = 'admin';
                                } else {
                                    targetSite = matchedPos.id.startsWith('pos_') ? matchedPos.id : `pos_${matchedPos.id}`;
                                }
                            }
                        }

                        // 사용자가 수동으로 사이트를 변경하지 않은 경우에만 자동 설정
                        // 최초 로그인 시에만 역할 기반 사이트 설정 적용
                        if (targetSite && (siteData as any)?.[targetSite] && !userManuallyChangedSite) {
                            setCurrentSite((prevSite) => (prevSite === targetSite ? prevSite : targetSite));
                        }

                        MessageManager.setContext({ role });
                    };

                    const loadAndApply = async () => {
                        if (!currentUser) return;
                        const u = await userService.getUser(currentUser.uid);
                        if (cancelled) return;
                        applyRole(u?.role);
                    };

                    await loadAndApply();
                    const timer = setInterval(loadAndApply, 600000); // 10분 폴링 (비용 최적화)

                    return () => {
                        cancelled = true;
                        clearInterval(timer);
                    };
                } catch (error) {
                    console.error("Failed to setup admin listener", error);
                }
            } else {
                setIsAdmin(false);
            }
        };

        let cleanup: void | (() => void);
        (async () => {
            cleanup = await setupAdminListener();
        })();

        return () => {
            if (typeof cleanup === 'function') cleanup();
        };
    }, [currentUser, siteData]); // Re-run when siteData is loaded

    // Real-time System Config Listener (ERP/SITE logo & favicon)
    const [systemConfig, setSystemConfig] = useState<{
        logoUrl?: string;
        faviconUrl?: string;
        erpLogoUrl?: string;
        siteLogoUrl?: string;
        erpFaviconUrl?: string;
        siteFaviconUrl?: string;
    }>({});

    useEffect(() => {
        const setupConfigListener = async () => {
            const { db } = await import('../../config/firebase');
            const { doc, onSnapshot } = await import('firebase/firestore');

            const unsubscribe = onSnapshot(doc(db, 'settings', 'system_config'), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSystemConfig({
                        logoUrl: data.logoUrl,
                        faviconUrl: data.faviconUrl,
                        erpLogoUrl: data.erpLogoUrl,
                        siteLogoUrl: data.siteLogoUrl,
                        erpFaviconUrl: data.erpFaviconUrl,
                        siteFaviconUrl: data.siteFaviconUrl,
                    });
                }
            });

            return unsubscribe;
        };

        let unsubscribe: (() => void) | undefined;
        setupConfigListener().then(unsub => {
            unsubscribe = unsub;
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const activeLogoUrl = currentSite === 'test'
        ? (systemConfig.siteLogoUrl || systemConfig.logoUrl)
        : (systemConfig.erpLogoUrl || systemConfig.logoUrl);

    useEffect(() => {
        const faviconUrl = currentSite === 'test'
            ? (systemConfig.siteFaviconUrl || systemConfig.faviconUrl)
            : (systemConfig.erpFaviconUrl || systemConfig.faviconUrl);

        if (!faviconUrl) return;

        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = faviconUrl;
        } else {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = faviconUrl;
            document.head.appendChild(newLink);
        }
    }, [currentSite, systemConfig.siteFaviconUrl, systemConfig.erpFaviconUrl, systemConfig.faviconUrl]);

    const toggleSidebar = () => {
        closePanels();
        if (isMobile) {
            setIsMobileOpen(!isMobileOpen);
        } else {
            setIsSidebarCollapsed(!isSidebarCollapsed);
        }
    };

    const togglePanel = (type: 'bottom' | 'admin' | 'position') => {
        if (type === 'bottom') {
            setIsBottomPanelOpen(!isBottomPanelOpen);
            setIsAdminPanelOpen(false);
            setIsPositionPanelOpen(false);
        } else if (type === 'admin') {
            setIsAdminPanelOpen(!isAdminPanelOpen);
            setIsBottomPanelOpen(false);
            setIsPositionPanelOpen(false);
        } else if (type === 'position') {
            setIsPositionPanelOpen(!isPositionPanelOpen);
            setIsBottomPanelOpen(false);
            setIsAdminPanelOpen(false);
        }
    };

    const toggleSubmenu = (itemId: string) => {
        setActiveMenuItems(prev => {
            const newState = { ...prev };
            Object.keys(newState).forEach(key => {
                if (key !== itemId) newState[key] = false;
            });
            newState[itemId] = !newState[itemId];
            return newState;
        });
    };

    const toggleNestedSubmenu = (nestedItemId: string) => {
        setActiveNestedMenuItems(prev => {
            const newState = { ...prev };
            Object.keys(newState).forEach(key => {
                if (key !== nestedItemId) newState[key] = false;
            });
            newState[nestedItemId] = !newState[nestedItemId];
            return newState;
        });
    };

    const handleLogoClick = () => {
        setActiveMenuItems({});
        // 청연사이트 모드이면 /dashboard2로, 아니면 /dashboard로 이동
        navigateSync(currentSite === 'test' ? '/dashboard2' : '/dashboard');
    };

    // Position to Site mapping - 직책별로 전용 메뉴 사용
    // 'full' = 현재 사이트(보통 admin) 전체 메뉴 표시
    // Dynamic Position Config extraction
    const positions = (siteData?.['admin']?.positionConfig || []).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Fallback if no config (shouldn't happen due to auto-migration, but safe fallback)
    // We don't need a hardcoded fallback here if we trust the service migration.

    // Position to Site mapping - 직책별로 전용 메뉴 사용
    // 'full' = 현재 사이트(보통 admin) 전체 메뉴 표시
    const getPositionSiteMap = () => {
        const map: { [key: string]: string } = { 'full': '' };
        if (positions.length > 0) {
            positions.forEach(pos => {
                if (pos.id !== 'full') {
                    // Convention: pos_ + id if id doesn't already start with pos_
                    // Actually, the keys in siteData are 'pos_ceo', 'pos_manager1' etc.
                    // The position IDs in config are 'ceo', 'manager1'.
                    // So we map id -> 'pos_' + id.
                    // But if the ID itself is 'pos_ceo', we handle that.
                    const siteKey = pos.id.startsWith('pos_') ? pos.id : `pos_${pos.id}`;
                    map[pos.id] = siteKey;
                }
            });
        }
        return map;
    };

    const POSITION_SITE_MAP = getPositionSiteMap();

    // Use position-based site for left menu
    // 'full' position uses currentSite (full admin menu)
    const positionSite = POSITION_SITE_MAP[currentPosition];
    const effectiveSite = (currentPosition === 'full' || !positionSite)
        ? currentSite
        : (siteData?.[positionSite] ? positionSite : currentSite);
    const currentSiteData = siteData ? siteData[effectiveSite] : null;

    const handleMenuItemClick = (item: MenuItem, position?: number) => {
        if (!currentSiteData) return;

        // 1. Direct Path (Priority)
        if (item.path) {
            navigateSync(item.path);
            if (isMobile) {
                closeAll();
                setActiveMenuItems({});
            } else {
                // 상위 메뉴(Top Level) 클릭 시에만 다른 메뉴 닫기 (= Accordion 효과)
                // 하위 메뉴(Level 2 등) 클릭 시에는 현재 펼쳐진 상태 유지
                const isTopLevel = currentSiteData.menu.some(topItem => topItem.text === item.text);
                if (isTopLevel) {
                    setActiveMenuItems({});
                }
            }
            return;
        }

        // 2. Folder / Group (has children)
        if (item.sub && item.sub.length > 0) {
            const itemId = `menu-${currentSiteData.menu.findIndex((i: MenuItem) => i.text === item.text)}`;
            toggleSubmenu(itemId);
            return;
        }

        // 3. Empty folder or unlinked item (no path, no children) -> do nothing
        // NOTE: We intentionally do NOT fallback to MENU_PATHS[item.text] here.
        // Path resolution must be done in menuServiceV11 normalization.
        setActiveMenuItems({});
        return;
    };

    const closePanels = () => {
        setIsBottomPanelOpen(false);
        setIsAdminPanelOpen(false);
        setIsPositionPanelOpen(false);
    };

    const closeAll = () => {
        setIsMobileOpen(false);
        closePanels();
        // if (!isMobile) {
        //     setIsSidebarCollapsed(true); // Auto-collapse sidebar on PC - REMOVED to prevent layout thrashing
        // }
    };

    const changeSite = (siteKey: string) => {
        setCurrentSite(siteKey);
        setActiveMenuItems({});
        // 사용자가 수동으로 사이트를 변경했음을 기록
        setUserManuallyChangedSite(true);
        localStorage.setItem('cy_current_site', siteKey);
        localStorage.setItem('cy_site_manual', 'true');

        // 청연사이트(test)로 전환 시 /dashboard2로 이동
        if (siteKey === 'test') {
            navigateSync('/dashboard2');
        } else if (location.pathname === '/dashboard2') {
            // 다른 사이트로 전환 시 /dashboard2에 있으면 /dashboard로 이동
            navigateSync('/dashboard');
        }
    };

    const changePosition = (positionId: string) => {
        setCurrentPosition(positionId);
        setActiveMenuItems({});
        // TODO: Load position-specific menu when implemented
        console.log('Position changed to:', positionId);
    };

    const menuPaths = MENU_PATHS;

    const toggleDarkMode = () => {
        setIsDarkMode(prev => {
            const next = !prev;
            localStorage.setItem('cy-cheongyeon-theme', next ? 'dark' : 'light');
            return next;
        });
    };

    const shouldOpenInNewTab = (path: string | undefined): boolean => {
        if (!path) return false;
        const [, search] = path.split('?');
        if (!search) return false;
        const params = new URLSearchParams(search);
        return params.get('newTab') === '1' || params.get('newTab') === 'true';
    };

    const handleSubMenuClick = (subItem: string) => {
        const path = menuPaths[subItem];
        if (path) {
            if (shouldOpenInNewTab(path)) {
                window.open(path, '_blank', 'noopener,noreferrer');
                if (isMobile) closeAll();
                return;
            }
            navigateSync(path);
            if (isMobile) closeAll();
        }
    };

    const siteModeValue = {
        siteData,
        currentSite,
        effectiveSite,
        currentSiteData: (currentSiteData as SiteData | null),
        changeSite,
        isDarkMode,
        toggleDarkMode
    };

    if (!siteData) {
        return (
            <SiteModeProvider {...siteModeValue}>
                <div className="app">
                    <SidebarSkeleton />
                    <main id="main-content" style={{ marginLeft: '250px' }}>
                        {children}
                    </main>
                </div>
            </SiteModeProvider>
        );
    }

    // Layout Variant for Cheongyeon SITE (test) - Same structure as Admin ERP with video background
    if (currentSite === 'test' && currentSiteData) {
        return (
            <SiteModeProvider {...siteModeValue}>
                <div className={`app cheongyeon-mode ${isDarkMode ? '' : 'cy-light'} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                    <div className="backdrop" id="backdrop" onClick={closeAll}></div>

                    {/* Same Header as Admin ERP */}
                    <Header
                        toggleSidebar={toggleSidebar}
                        togglePanel={togglePanel}
                        currentSiteData={currentSiteData}
                        isAdmin={isAdmin}
                        isPositionPanelOpen={isPositionPanelOpen}
                        currentPosition={currentPosition}
                        changePosition={changePosition}
                        positions={positions}
                        siteData={siteData}
                        currentSite={currentSite}
                        changeSite={changeSite}
                        menuPaths={menuPaths}
                        logoUrl={activeLogoUrl}
                        isDarkMode={isDarkMode}
                        toggleDarkMode={toggleDarkMode}
                    />

                    {/* Same Sidebar as Admin ERP (Left Side) */}
                    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                        <Sidebar
                            currentSite={effectiveSite}
                            currentSiteData={currentSiteData}
                            closeAll={closeAll}
                            activeMenuItems={activeMenuItems}
                            activeNestedMenuItems={activeNestedMenuItems}
                            toggleSubmenu={toggleSubmenu}
                            toggleNestedSubmenu={toggleNestedSubmenu}
                            handleMenuItemClick={handleMenuItemClick}
                            handleSubMenuClick={handleSubMenuClick}
                            handleLogoClick={handleLogoClick}
                            menuPaths={menuPaths}
                            isSidebarCollapsed={isSidebarCollapsed}
                            isMobile={isMobile}
                            openMobileSidebar={() => setIsMobileOpen(true)}
                            toggleSidebar={toggleSidebar}
                            logoUrl={activeLogoUrl}
                        />
                    </ErrorBoundary>


                    {/* Bottom Panel */}
                    <BottomPanel
                        isOpen={isBottomPanelOpen}
                        togglePanel={togglePanel}
                        currentSite={currentSite}
                        changeSite={changeSite}
                    />

                    {/* Admin Panel */}
                    <AdminPanel
                        isOpen={isAdminPanelOpen}
                        togglePanel={togglePanel}
                        siteData={siteData}
                        menuPaths={menuPaths}
                    />



                    {/* Main Content with Video Background for Dashboard2 */}
                    <main id="main-content" className={location.pathname === '/dashboard2' ? 'cheongyeon-main' : ''} onClick={() => {
                        if (isBottomPanelOpen || isAdminPanelOpen || isPositionPanelOpen || isMobileOpen || !isSidebarCollapsed) {
                            closeAll();
                        }
                    }}>
                        <ErrorBoundary
                            FallbackComponent={ErrorFallback}
                            onReset={() => window.location.reload()}
                            resetKeys={[location.pathname, location.search]}
                        >
                            {children}
                        </ErrorBoundary>
                    </main>
                </div>
            </SiteModeProvider>
        );
    }

    return (
        <SiteModeProvider {...siteModeValue}>
            <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                <div className="backdrop" id="backdrop" onClick={closeAll}></div>

                <Header
                    toggleSidebar={toggleSidebar}
                    togglePanel={togglePanel}
                    currentSiteData={currentSiteData}
                    isAdmin={isAdmin}
                    isPositionPanelOpen={isPositionPanelOpen}
                    currentPosition={currentPosition}
                    changePosition={changePosition}
                    positions={positions}
                    siteData={siteData}
                    currentSite={currentSite}
                    changeSite={changeSite}
                    menuPaths={menuPaths}
                    logoUrl={activeLogoUrl}
                />

                <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                    <Sidebar
                        currentSite={effectiveSite}
                        currentSiteData={currentSiteData}
                        closeAll={closeAll}
                        activeMenuItems={activeMenuItems}
                        activeNestedMenuItems={activeNestedMenuItems}
                        toggleSubmenu={toggleSubmenu}
                        toggleNestedSubmenu={toggleNestedSubmenu}
                        handleMenuItemClick={handleMenuItemClick}
                        handleSubMenuClick={handleSubMenuClick}
                        handleLogoClick={handleLogoClick}
                        menuPaths={menuPaths}
                        isSidebarCollapsed={isSidebarCollapsed}
                        isMobile={isMobile}
                        openMobileSidebar={() => setIsMobileOpen(true)}
                        toggleSidebar={toggleSidebar}
                        logoUrl={activeLogoUrl}
                    />
                </ErrorBoundary>


                <BottomPanel
                    isOpen={isBottomPanelOpen}
                    togglePanel={togglePanel}
                    currentSite={currentSite}
                    changeSite={changeSite}
                />

                <AdminPanel
                    isOpen={isAdminPanelOpen}
                    togglePanel={togglePanel}
                    siteData={siteData}
                    menuPaths={menuPaths}
                />



                <main id="main-content" onClick={() => {
                    if (isBottomPanelOpen || isAdminPanelOpen || isPositionPanelOpen || isMobileOpen || !isSidebarCollapsed) {
                        closeAll();
                    }
                }}>
                    <ErrorBoundary
                        FallbackComponent={ErrorFallback}
                        onReset={() => window.location.reload()}
                        resetKeys={[location.pathname, location.search]}
                    >
                        {children}
                    </ErrorBoundary>
                </main>
            </div>
        </SiteModeProvider>
    );
};

export default DashboardLayout;
