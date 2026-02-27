import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MessageManager } from '../../constants/messages';
import { ROLE_SITE_MAP } from '../../utils/roleMapping';
import './DashboardLayout.css';

import Header from './Header';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import PositionPanel from './PositionPanel';

import BottomPanel from './BottomPanel';
import AdminPanel from './AdminPanel';
import CheongyeonHeader from '../cheongyeon/CheongyeonHeader';
import RichRightDrawer from '../cheongyeon/RichRightDrawer';
import CheongyeonHome from '../../pages/cheongyeon/CheongyeonHome';

// 타입 인터페이스 정의
import SidebarSkeleton from './SidebarSkeleton';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { SiteDataType, MenuItem } from '../../types/menu';
import { MENU_PATHS } from '../../constants/menuPaths';
import { ErrorBoundary } from 'react-error-boundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';

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

const ENABLE_ROLE_SITE_REDIRECT = process.env.REACT_APP_ENABLE_ROLE_SITE_REDIRECT === 'true';
const ENABLE_POSITION_SITE_MENUS = true; // process.env.REACT_APP_ENABLE_POSITION_SITE_MENUS === 'true';

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }: DashboardLayoutProps) => {
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
    const [isPositionPanelOpen, setIsPositionPanelOpen] = useState(false);
    const [currentSite, setCurrentSite] = useState('admin');
    const [currentPosition, setCurrentPosition] = useState('full');
    const [activeMenuItems, setActiveMenuItems] = useState<{ [key: string]: boolean }>({});
    const [activeNestedMenuItems, setActiveNestedMenuItems] = useState<{ [key: string]: boolean }>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    // Dynamic Menu State
    const [siteData, setSiteData] = useState<SiteDataType | null>(null);

    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Fetch Menu Config
    useEffect(() => {
        // Initial fetch logic omitted as subscribe handles init
        // Subscribe to real-time updates from menuServiceV11
        const unsubscribe = menuServiceV11.subscribe((newConfig) => {
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

    // Handle body overflow for Site Mode (test)
    // Standard Dashboard uses internal scroll (.app #main-content), so body is hidden.
    // Site Mode uses window scroll, so body must be auto.
    useEffect(() => {
        if (currentSite === 'test') {
            document.body.style.overflow = 'auto';
        } else {
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.overflow = 'hidden';
        };
    }, [currentSite]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        const handleScroll = () => {
            const isScrolled = window.scrollY > 50;
            setScrolled(isScrolled);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll);
        };
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

    useEffect(() => {
        let unsubscribe: () => void;

        const setupAdminListener = async () => {
            if (currentUser && siteData) { // Wait for siteData to be loaded
                try {
                    const { doc, onSnapshot } = await import('firebase/firestore');
                    const { db } = await import('../../config/firebase');

                    unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (docSnapshot) => {
                        const userData = docSnapshot.data();
                        const role = userData?.role || '';

                        // 기존 로직: 관리자 권한 확인
                        const adminRoles = ['admin', '사장', '실장', '관리자'];
                        setIsAdmin(adminRoles.includes(role));

                        // 1. Role-Based Site Redirection
                        // 역할에 맞는 사이트가 있는지 확인하고, 현재 사이트와 다르면 이동
                        if (ENABLE_ROLE_SITE_REDIRECT) {
                            const targetSite = ROLE_SITE_MAP[role];
                            if (targetSite && siteData[targetSite]) { // siteData에 존재하는지 안전장치
                                setCurrentSite(prevSite => {
                                    // 이미 같은 사이트면 변경하지 않음
                                    if (prevSite === targetSite) return prevSite;
                                    return targetSite;
                                });
                            }
                        }

                        // Update MessageManager context with role
                        MessageManager.setContext({ role });
                    });
                } catch (error) {
                    console.error("Failed to setup admin listener", error);
                }
            } else {
                setIsAdmin(false);
            }
        };

        setupAdminListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser, siteData]); // Re-run when siteData is loaded

    // Dynamic Favicon Loader
    useEffect(() => {
        const loadFavicon = async () => {
            try {
                // Determine if we are in environment that supports dynamic favicon loading
                // We'll just try to fetch 'settings/favicon'
                const { storage } = await import('../../config/firebase');
                const { ref, getDownloadURL } = await import('firebase/storage');

                const faviconUrl = await getDownloadURL(ref(storage, 'settings/favicon'));

                const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                if (link) {
                    link.href = faviconUrl;
                } else {
                    const newLink = document.createElement('link');
                    newLink.rel = 'icon';
                    newLink.href = faviconUrl;
                    document.head.appendChild(newLink);
                }
            } catch (error) {
                // No custom favicon found, stick to default
                // console.log("Using default favicon");
            }
        };
        loadFavicon();
    }, []);

    const toggleSidebar = () => {
        closePanels();
        if (isMobile) {
            setIsMobileOpen(!isMobileOpen);
        } else {
            setIsSidebarCollapsed(!isSidebarCollapsed);
        }
    };

    const togglePanel = (type: 'right' | 'bottom' | 'admin' | 'position') => {
        if (type === 'right') {
            setIsRightPanelOpen(!isRightPanelOpen);
            setIsBottomPanelOpen(false);
            setIsAdminPanelOpen(false);
            setIsPositionPanelOpen(false);
        } else if (type === 'bottom') {
            setIsBottomPanelOpen(!isBottomPanelOpen);
            setIsRightPanelOpen(false);
            setIsAdminPanelOpen(false);
            setIsPositionPanelOpen(false);
        } else if (type === 'admin') {
            setIsAdminPanelOpen(!isAdminPanelOpen);
            setIsRightPanelOpen(false);
            setIsBottomPanelOpen(false);
            setIsPositionPanelOpen(false);
        } else if (type === 'position') {
            setIsPositionPanelOpen(!isPositionPanelOpen);
            setIsRightPanelOpen(false);
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
        // Keep accordion open: do NOT reset activeMenuItems
        navigate('/dashboard');
    };

    // Use position-based site for left menu
    // Dynamic mapping: if currentPosition is not 'full', try 'pos_' + currentPosition
    const positionSite = currentPosition === 'full'
        ? ''
        : (currentPosition.startsWith('pos_') ? currentPosition : `pos_${currentPosition}`);

    // Check if the dynamic site key exists in siteData
    const isValidPositionSite = siteData && positionSite && siteData[positionSite];

    const effectiveSite = !ENABLE_POSITION_SITE_MENUS
        ? currentSite
        : (currentPosition === 'full' || !isValidPositionSite)
            ? currentSite
            : positionSite;
    const currentSiteData = siteData ? siteData[effectiveSite] : null;

    const handleMenuItemClick = (item: MenuItem, position?: number) => {
        if (!currentSiteData) return;

        // 1. Direct Path (Priority)
        if (item.path) {
            navigate(item.path);
            if (isMobile) closeAll();
            // Keep accordion open: do NOT reset activeMenuItems
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
        // Keep accordion open: do NOT reset activeMenuItems
        return;
    };

    const closePanels = () => {
        setIsRightPanelOpen(false);
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
        // Do NOT reset activeMenuItems to keep accordion open
    };

    const changeSite = (siteKey: string) => {
        setCurrentSite(siteKey);
        navigate('/dashboard');
        // Keep accordion open: do NOT reset activeMenuItems
    };

    const changePosition = (positionId: string) => {
        setCurrentPosition(positionId);
        // Keep accordion open: do NOT reset activeMenuItems
        // TODO: Load position-specific menu when implemented
        console.log('Position changed to:', positionId);
    };

    const menuPaths = MENU_PATHS;

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
            navigate(path);
            if (isMobile) closeAll();
        }
    };

    // --- Render Logic ---

    // 1. Cinematic Layout for 'test' site
    if (currentSite === 'test' && currentSiteData) {
        return (
            <div className="relative min-h-screen bg-slate-900 font-sans overflow-x-hidden selection:bg-amber-500 selection:text-white" key="test-layout">
                <CheongyeonHeader
                    currentSiteData={currentSiteData}
                    onMenuClick={() => setIsRightPanelOpen(true)}
                    scrolled={scrolled}
                />

                <RichRightDrawer
                    isOpen={isRightPanelOpen}
                    onClose={() => setIsRightPanelOpen(false)}
                    currentSiteData={currentSiteData}
                    menuPaths={MENU_PATHS}
                    changeSite={changeSite}
                    scrolled={scrolled}
                />

                <main className="">
                    {location.pathname === '/dashboard' ? (
                        <CheongyeonHome />
                    ) : (
                        <div className="pt-[90px] min-h-screen bg-slate-50">
                            <div className="w-full">
                                {children}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        );
    }

    // 2. Standard Dashboard Layout (Default)
    return (
        <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`} key="dashboard-layout">
            {/* Backdrop for mobile */}
            <div className="backdrop" id="backdrop" onClick={closeAll}></div>

            <Header
                toggleSidebar={toggleSidebar}
                togglePanel={togglePanel}
                currentSiteData={currentSiteData}
                isAdmin={isAdmin}
            />

            {!siteData ? (
                <SidebarSkeleton />
            ) : (
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
                    />
                </ErrorBoundary>
            )}

            <RightPanel
                isOpen={isRightPanelOpen}
                togglePanel={togglePanel}
                siteData={siteData}
                currentSite={currentSite}
                changeSite={changeSite}
                menuPaths={menuPaths}
            />

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

            <PositionPanel
                isOpen={isPositionPanelOpen}
                togglePanel={togglePanel}
                currentPosition={currentPosition}
                changePosition={changePosition}
                positions={siteData?.['admin']?.positionConfig || []}
                siteData={siteData}
                currentSite={currentSite}
                changeSite={changeSite}
            />

            {/* 메인 콘텐츠 영역 */}
            <main
                id="main-content"
                style={!siteData ? { marginLeft: '250px' } : undefined}
                onClick={() => {
                    // Always close panels/sidebar when clicking main content
                    if (isRightPanelOpen || isBottomPanelOpen || isAdminPanelOpen || isPositionPanelOpen || isMobileOpen || !isSidebarCollapsed) {
                        closeAll();
                    }
                }}
            >
                <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                    {children}
                </ErrorBoundary>
            </main>
        </div>
    );
};

export default DashboardLayout;
