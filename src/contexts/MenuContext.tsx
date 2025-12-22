import React, { createContext, useContext, ReactNode } from 'react';
import { useMenu, MenuState, MenuActions, MenuItem } from '../hooks/useMenu';

interface MenuContextType {
    state: MenuState;
    actions: MenuActions;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

interface MenuProviderProps {
    children: ReactNode;
    initialState?: Partial<MenuState>;
}

export const MenuProvider: React.FC<MenuProviderProps> = ({ children, initialState }) => {
    const [state, actions] = useMenu(initialState);

    return (
        <MenuContext.Provider value={{ state, actions }}>
            {children}
        </MenuContext.Provider>
    );
};

export const useMenuContext = (): MenuContextType => {
    const context = useContext(MenuContext);
    if (context === undefined) {
        throw new Error('useMenuContext must be used within a MenuProvider');
    }
    return context;
};

// Export types for convenience
export type { MenuItem, MenuState, MenuActions };
