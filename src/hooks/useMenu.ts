import { useState, useCallback } from 'react';

export interface MenuItem {
    text: string;
    icon?: string;
    sub?: (string | MenuItem)[];
}

export interface MenuState {
    isSidebarCollapsed: boolean;
    isMobileOpen: boolean;
    activeMenuItems: { [key: string]: boolean };
    submenuData: { title: string; items: (string | MenuItem)[] } | null;
    isRightPanelOpen: boolean;
    isBottomPanelOpen: boolean;
    isAdminPanelOpen: boolean;
}

export interface MenuActions {
    toggleSidebar: () => void;
    togglePanel: (type: 'right' | 'bottom' | 'admin') => void;
    toggleSubmenu: (itemId: string) => void;
    handleMenuItemClick: (item: MenuItem, isMobile: boolean) => void;
    handleSubMenuClick: (subItem: string, menuPaths: { [key: string]: string }, navigate: (path: string) => void) => void;
    closeAll: () => void;
    closePanels: () => void;
    closeSubmenuPanel: () => void;
    handleLogoClick: (navigate: (path: string) => void) => void;
}

export const useMenu = (initialState: Partial<MenuState> = {}): [MenuState, MenuActions] => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialState.isSidebarCollapsed ?? false);
    const [isMobileOpen, setIsMobileOpen] = useState(initialState.isMobileOpen ?? false);
    const [activeMenuItems, setActiveMenuItems] = useState<{ [key: string]: boolean }>(initialState.activeMenuItems ?? {});
    const [submenuData, setSubmenuData] = useState<{ title: string; items: (string | MenuItem)[] } | null>(initialState.submenuData ?? null);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(initialState.isRightPanelOpen ?? false);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(initialState.isBottomPanelOpen ?? false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(initialState.isAdminPanelOpen ?? false);

    const toggleSidebar = useCallback(() => {
        closePanels();
        closeSubmenuPanel();
        setIsMobileOpen(prev => !prev);
        setIsSidebarCollapsed(prev => !prev);
    }, []);

    const togglePanel = useCallback((type: 'right' | 'bottom' | 'admin') => {
        if (type === 'right') {
            setIsRightPanelOpen(prev => !prev);
            setIsBottomPanelOpen(false);
            setIsAdminPanelOpen(false);
        } else if (type === 'bottom') {
            setIsBottomPanelOpen(prev => !prev);
            setIsRightPanelOpen(false);
            setIsAdminPanelOpen(false);
        } else if (type === 'admin') {
            setIsAdminPanelOpen(prev => !prev);
            setIsRightPanelOpen(false);
            setIsBottomPanelOpen(false);
        }
    }, []);

    const toggleSubmenu = useCallback((itemId: string) => {
        setActiveMenuItems(prev => {
            const newState = { ...prev };
            Object.keys(newState).forEach(key => {
                if (key !== itemId) newState[key] = false;
            });
            newState[itemId] = !newState[itemId];
            return newState;
        });
    }, []);

    const handleMenuItemClick = useCallback((item: MenuItem, isMobile: boolean) => {
        if (isSidebarCollapsed && !isMobile) {
            if (item.sub && item.sub.length > 0) {
                setSubmenuData({
                    title: item.text,
                    items: item.sub
                });
                closePanels();
            } else {
                setSubmenuData(null);
                closePanels();
            }
        } else {
            if (item.sub && item.sub.length > 0) {
                // This would need the menu data - we'll handle this differently
                const itemId = `menu-${item.text}`;
                toggleSubmenu(itemId);
            } else {
                setActiveMenuItems({});
            }
        }
    }, [isSidebarCollapsed, toggleSubmenu]);

    const handleSubMenuClick = useCallback((subItem: string, menuPaths: { [key: string]: string }, navigate: (path: string) => void) => {
        const path = menuPaths[subItem];
        if (path) {
            navigate(path);
            if (isMobileOpen) {
                closeAll();
            }
        }
    }, [isMobileOpen]);

    const closeSubmenuPanel = useCallback(() => {
        setSubmenuData(null);
        if (isMobileOpen) {
            setIsMobileOpen(false);
        }
    }, [isMobileOpen]);

    const closePanels = useCallback(() => {
        setIsRightPanelOpen(false);
        setIsBottomPanelOpen(false);
        setIsAdminPanelOpen(false);
    }, []);

    const closeAll = useCallback(() => {
        setIsMobileOpen(false);
        closePanels();
        closeSubmenuPanel();
        if (!isMobileOpen) {
            setIsSidebarCollapsed(true);
        }
    }, [isMobileOpen, closePanels, closeSubmenuPanel]);

    const handleLogoClick = useCallback((navigate: (path: string) => void) => {
        setActiveMenuItems({});
        navigate('/dashboard');
    }, []);

    const state: MenuState = {
        isSidebarCollapsed,
        isMobileOpen,
        activeMenuItems,
        submenuData,
        isRightPanelOpen,
        isBottomPanelOpen,
        isAdminPanelOpen,
    };

    const actions: MenuActions = {
        toggleSidebar,
        togglePanel,
        toggleSubmenu,
        handleMenuItemClick,
        handleSubMenuClick,
        closeAll,
        closePanels,
        closeSubmenuPanel,
        handleLogoClick,
    };

    return [state, actions];
};
