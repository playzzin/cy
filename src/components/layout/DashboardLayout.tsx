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
import AppIntroScreen from '../common/AppIntroScreen';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { SiteData, SiteDataType, MenuItem, PositionItem } from '../../types/menu';
import { findBusinessPartnerPositionDefinition } from '../../constants/businessPartnerPositions';
import { MENU_PATHS } from '../../constants/menuPaths';
import { matchesMenuPosition } from '../../utils/menuPosition';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { SiteModeProvider } from '../../contexts/SiteModeContext';
import {
    applyDocumentTheme,
    getStoredDarkModePreference,
    persistDarkModePreference,
} from '../../utils/themeMode';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';

// Removed hardcoded siteData in favor of dynamic loading

interface DashboardLayoutProps {
    children: React.ReactNode;
}

type QuickTool = 'calculator' | 'camera';

// Error Fallback Component for UI Stability
const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
    const message = error instanceof Error ? error.message : String(error ?? '');

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50 rounded-lg border border-slate-200 m-4">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 text-3xl mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">일시적인 오류 발생</h3>
            <p className="text-slate-500 text-sm mb-4">화면을 불러오는 중 문제가 발생했습니다.</p>
            <pre className="text-xs text-red-400 bg-red-50 p-2 rounded mb-4 max-w-xs overflow-auto">
                {message}
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

const normalizePositionKey = (value: unknown): string =>
    String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');

const getPositionSiteKey = (positionId: string): string =>
    positionId.startsWith('pos_') ? positionId : `pos_${positionId}`;

const findMatchingPosition = (positions: PositionItem[], value: unknown): PositionItem | undefined => {
    const key = normalizePositionKey(value);
    if (!key) return undefined;

    const partnerDefinition = findBusinessPartnerPositionDefinition(String(value || ''), String(value || ''));
    if (partnerDefinition) {
        const matchedPartnerPosition = positions.find(
            (position) => normalizePositionKey(position.id) === normalizePositionKey(partnerDefinition.id)
        );
        if (matchedPartnerPosition) return matchedPartnerPosition;
    }

    return positions.find((position) => {
        return matchesMenuPosition(position.id, position.name, value);
    });
};

const findFirstPositionById = (positions: PositionItem[], ids: string[]): PositionItem | undefined => {
    const wanted = ids.map(normalizePositionKey);
    return positions.find((position) => wanted.includes(normalizePositionKey(position.id)));
};

const resolveUserMenuPositionId = (
    positions: PositionItem[],
    userProfile: { position?: unknown; role?: unknown; accountType?: unknown; systemRole?: unknown } | null | undefined,
    linkedEntityRoles?: unknown | unknown[]
): string | undefined => {
    const linkedRoles = Array.isArray(linkedEntityRoles) ? linkedEntityRoles : [linkedEntityRoles];
    const candidates = [...linkedRoles, userProfile?.position, userProfile?.role, userProfile?.systemRole, userProfile?.accountType];

    for (const candidate of candidates) {
        const matched = findMatchingPosition(positions, candidate);
        if (matched?.id) return matched.id;
    }

    const roleKey = normalizePositionKey(userProfile?.role);
    if (['admin', 'administrator', 'superadmin', 'owner', '\uad00\ub9ac\uc790', '\uc0ac\uc7a5', '\uc2e4\uc7a5'].includes(roleKey)) {
        return findFirstPositionById(positions, ['full'])?.id || 'full';
    }
    if (roleKey.startsWith('manager') || roleKey.startsWith('\ub9e4\ub2c8\uc800') || roleKey.startsWith('\uba54\ub2c8\uc800')) {
        return findFirstPositionById(positions, ['manager1', 'manager', 'teamLead'])?.id;
    }
    if (['user', 'general', '\uc77c\ubc18'].includes(roleKey)) {
        return findFirstPositionById(positions, ['general'])?.id;
    }

    return undefined;
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
    const [activeQuickTool, setActiveQuickTool] = useState<QuickTool>('calculator');
    const [isPositionPanelOpen, setIsPositionPanelOpen] = useState(false);
    // 사이트 모드를 localStorage에서 복원하여 수동 변경 시 유지되도록 함
    const [currentSite, setCurrentSite] = useState(() => {
        const saved = localStorage.getItem('cy_current_site');
        return saved || 'admin';
    });
    const [currentPosition, setCurrentPosition] = useState(() => {
        return localStorage.getItem('cy_current_position') || 'full';
    });
    const [userManuallyChangedSite, setUserManuallyChangedSite] = useState(() => {
        return localStorage.getItem('cy_site_manual') === 'true';
    });
    const [userManuallyChangedPosition, setUserManuallyChangedPosition] = useState(() => {
        return localStorage.getItem('cy_position_manual') === 'true';
    });
    const [activeMenuItems, setActiveMenuItems] = useState<{ [key: string]: boolean }>({});
    const [activeNestedMenuItems, setActiveNestedMenuItems] = useState<{ [key: string]: boolean }>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getStoredDarkModePreference(localStorage, true));

    // Dynamic Menu State
    const [siteData, setSiteData] = useState<SiteDataType | null>(null);

    const autoAppliedPositionForUserRef = useRef('');

    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const siteModeDashboards: Record<string, string> = {
        test: '/dashboard2',
        nation: '/dashboard3',
    };
    const siteModeDashboardPath = siteData?.[currentSite]?.menu ? siteModeDashboards[currentSite] : undefined;
    const isSiteLayerMode = Boolean(siteModeDashboardPath);
    const usesSiteBranding = isSiteLayerMode;
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

    // Update MessageManager context only when the routed page changes.
    useEffect(() => {
        MessageManager.setContext({
            uid: currentUser?.uid,
            page: location.pathname
        });
    }, [currentUser?.uid, location.pathname]);

    useEffect(() => {
        applyDocumentTheme(isDarkMode);
    }, [isDarkMode]);

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
        if (siteModeDashboardPath && location.pathname === '/dashboard') {
            navigateSync(siteModeDashboardPath, { replace: true });
        }
    }, [siteModeDashboardPath, location.pathname, navigateSync]);

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
        nationLogoUrl?: string;
        nationFaviconUrl?: string;
    }>({});

    useEffect(() => {
        if (isDevAdminSessionEnabled()) return;

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
                        nationLogoUrl: data.nationLogoUrl,
                        nationFaviconUrl: data.nationFaviconUrl,
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

    // 전국시스템인력(nation)만 별도 로고/파비콘 우선 적용
    const activeLogoUrl = currentSite === 'nation'
        ? (systemConfig.nationLogoUrl || systemConfig.siteLogoUrl || systemConfig.logoUrl)
        : usesSiteBranding
            ? (systemConfig.siteLogoUrl || systemConfig.logoUrl)
            : (systemConfig.erpLogoUrl || systemConfig.logoUrl);

    useEffect(() => {
        let faviconUrl: string = '';
        if (currentSite === 'nation') {
            faviconUrl = systemConfig.nationFaviconUrl ?? systemConfig.siteFaviconUrl ?? systemConfig.faviconUrl ?? '';
        } else if (usesSiteBranding) {
            faviconUrl = systemConfig.siteFaviconUrl ?? systemConfig.faviconUrl ?? '';
        } else {
            faviconUrl = systemConfig.erpFaviconUrl ?? systemConfig.faviconUrl ?? '';
        }

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
    }, [currentSite, usesSiteBranding, systemConfig.nationFaviconUrl, systemConfig.siteFaviconUrl, systemConfig.erpFaviconUrl, systemConfig.faviconUrl]);

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

    const openQuickTool = (tool: QuickTool) => {
        const shouldClose = isBottomPanelOpen && activeQuickTool === tool;
        setActiveQuickTool(tool);
        setIsBottomPanelOpen(!shouldClose);
        setIsAdminPanelOpen(false);
        setIsPositionPanelOpen(false);
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
        navigateSync(siteModeDashboardPath || '/dashboard');
    };

    // Position to Site mapping - 직책별로 전용 메뉴 사용
    // 'full' = 현재 사이트(보통 admin) 전체 메뉴 표시
    // Dynamic Position Config extraction
    const positions = React.useMemo(
        () => [...(siteData?.['admin']?.positionConfig || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
        [siteData]
    );

    useEffect(() => {
        if (
            !currentUser?.uid
            || !siteData
            || positions.length === 0
            || userManuallyChangedSite
            || userManuallyChangedPosition
        ) return;

        let cancelled = false;

        const applyUserPositionMode = async () => {
            try {
                const [{ userService }, { manpowerService }, { officeStaffService }] = await Promise.all([
                    import('../../services/userService'),
                    import('../../services/manpowerService'),
                    import('../../services/officeStaffService')
                ]);

                const [profile, linkedWorker, linkedOfficeStaff] = await Promise.all([
                    userService.getUser(currentUser.uid),
                    manpowerService.getWorkerByUid(currentUser.uid).catch(() => null),
                    officeStaffService.getOfficeStaffByUid(currentUser.uid).catch(() => null)
                ]);

                if (cancelled) return;

                const resolvedPositionId = resolveUserMenuPositionId(positions, profile, [
                    linkedWorker?.role,
                    linkedOfficeStaff?.role
                ]);
                if (!resolvedPositionId) return;

                const applyKey = `${currentUser.uid}:${resolvedPositionId}`;
                if (autoAppliedPositionForUserRef.current === applyKey) return;
                autoAppliedPositionForUserRef.current = applyKey;

                localStorage.setItem('cy_current_position', resolvedPositionId);
                setCurrentPosition((prev) => (prev === resolvedPositionId ? prev : resolvedPositionId));
            } catch (error) {
                console.error('[DashboardLayout] Failed to apply user position menu:', error);
            }
        };

        void applyUserPositionMode();

        return () => {
            cancelled = true;
        };
    }, [currentUser?.uid, siteData, positions, userManuallyChangedSite, userManuallyChangedPosition]);

    // Fallback if no config (shouldn't happen due to auto-migration, but safe fallback)
    // We don't need a hardcoded fallback here if we trust the service migration.

    // Position to Site mapping - 직책별로 전용 메뉴 사용
    // 'full' = 현재 사이트(보통 admin) 전체 메뉴 표시
    const getPositionSiteMap = () => {
        const map: { [key: string]: string } = {
            full: '',
        };
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
    const availableSiteKeys = siteData
        ? Object.keys(siteData).filter((siteKey) => Boolean(siteData[siteKey]?.menu))
        : [];
    const fallbackSite = siteData?.admin?.menu
        ? 'admin'
        : (availableSiteKeys[0] || currentSite);
    const baseSite = siteData?.[currentSite]?.menu ? currentSite : fallbackSite;
    const positionSite = POSITION_SITE_MAP[currentPosition];
    const effectiveSite = (isSiteLayerMode || currentPosition === 'full' || !positionSite)
        ? baseSite
        : (siteData?.[positionSite]?.menu ? positionSite : baseSite);
    const currentSiteData = siteData
        ? (siteData[effectiveSite] || siteData[fallbackSite] || null)
        : null;

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
        setCurrentPosition('full');
        setActiveMenuItems({});
        // Site mode and position mode are mutually exclusive. A previously
        // selected position must not override the selected site's sidebar.
        localStorage.setItem('cy_current_position', 'full');
        setUserManuallyChangedPosition(false);
        localStorage.removeItem('cy_position_manual');
        // 사용자가 수동으로 사이트를 변경했음을 기록
        setUserManuallyChangedSite(true);
        localStorage.setItem('cy_current_site', siteKey);
        localStorage.setItem('cy_site_manual', 'true');

        // 청연사이트(test)로 전환 시 /dashboard2로 이동
        const nextDashboardPath = siteModeDashboards[siteKey];
        if (nextDashboardPath) {
            setIsPositionPanelOpen(false);
            navigateSync(nextDashboardPath);
        } else if (location.pathname === '/dashboard2' || location.pathname === '/dashboard3') {
            // 다른 사이트로 전환 시 /dashboard2에 있으면 /dashboard로 이동
            navigateSync('/dashboard');
        }
    };

    const changePosition = (positionId: string) => {
        setCurrentPosition(positionId);
        setActiveMenuItems({});
        localStorage.setItem('cy_current_position', positionId);
        setUserManuallyChangedPosition(true);
        localStorage.setItem('cy_position_manual', 'true');

        // A position chosen from the preview panel is an explicit user choice.
        // Keep it ahead of the profile-based automatic position resolver.
        setUserManuallyChangedSite(false);
        localStorage.removeItem('cy_site_manual');

        // Site mode and position mode are mutually exclusive. Position preview
        // always reads the corresponding pos_* configuration under admin.
        if (currentSite !== 'admin') {
            setCurrentSite('admin');
            localStorage.setItem('cy_current_site', 'admin');

            if (location.pathname === '/dashboard2' || location.pathname === '/dashboard3') {
                navigateSync('/dashboard');
            }
        }

        console.log('Position changed to:', positionId);
    };

    const menuPaths = MENU_PATHS;

    const toggleDarkMode = () => {
        setIsDarkMode(prev => {
            const next = !prev;
            persistDarkModePreference(next, localStorage);
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
        currentPosition,
        currentPositionData: positions.find(pos => pos.id === currentPosition) || null,
        positions,
        changeSite,
        changePosition,
        isDarkMode,
        toggleDarkMode
    };
    const isMemoFullBleedPage = location.pathname === '/memos';
    const isWorkbookLedgerFullBleedPage = [
        '/payroll/workbook-ledger',
        '/payroll/workbook-ledger-dawon',
    ].includes(location.pathname);
    const mainContentClassName = [
        location.pathname === siteModeDashboardPath ? 'cheongyeon-main' : '',
        isMemoFullBleedPage || isWorkbookLedgerFullBleedPage ? 'page-full-bleed' : ''
    ].filter(Boolean).join(' ');

    if (!siteData) {
        return (
            <SiteModeProvider {...siteModeValue}>
                <AppIntroScreen message="메뉴 정보를 불러오는 중" />
            </SiteModeProvider>
        );
    }

    // Layout Variant for Cheongyeon SITE (test) - Same structure as Admin ERP with video background
    if (isSiteLayerMode && siteData?.[currentSite]?.menu && currentSiteData) {
        const isNation = currentSite === 'nation';
        return (
            <SiteModeProvider {...siteModeValue}>
                <div className={`app cheongyeon-mode ${isNation ? 'nation-mode' : ''} ${isDarkMode ? '' : 'cy-light'} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                    <div className="backdrop" id="backdrop" onClick={closeAll}></div>

                    {/* Same Header as Admin ERP */}
                    <Header
                        toggleSidebar={toggleSidebar}
                        togglePanel={togglePanel}
                        openQuickTool={openQuickTool}
                        activeQuickTool={activeQuickTool}
                        isQuickPanelOpen={isBottomPanelOpen}
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
                        activeTool={activeQuickTool}
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
                    <main id="main-content" className={mainContentClassName} onClick={() => {
                        if (isBottomPanelOpen || isAdminPanelOpen || isPositionPanelOpen || isMobileOpen || !isSidebarCollapsed) {
                            closeAll();
                        }
                    }}>
                        <ErrorBoundary
                            FallbackComponent={ErrorFallback}
                            onReset={() => window.location.reload()}
                            resetKeys={[location.pathname]}
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
                    openQuickTool={openQuickTool}
                    activeQuickTool={activeQuickTool}
                    isQuickPanelOpen={isBottomPanelOpen}
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
                    activeTool={activeQuickTool}
                    currentSite={currentSite}
                    changeSite={changeSite}
                />

                <AdminPanel
                    isOpen={isAdminPanelOpen}
                    togglePanel={togglePanel}
                    siteData={siteData}
                    menuPaths={menuPaths}
                />



                <main id="main-content" className={mainContentClassName} onClick={() => {
                    if (isBottomPanelOpen || isAdminPanelOpen || isPositionPanelOpen || isMobileOpen || !isSidebarCollapsed) {
                        closeAll();
                    }
                }}>
                    <ErrorBoundary
                        FallbackComponent={ErrorFallback}
                        onReset={() => window.location.reload()}
                        resetKeys={[location.pathname]}
                    >
                        {children}
                    </ErrorBoundary>
                </main>
            </div>
        </SiteModeProvider>
    );
};

export default DashboardLayout;
