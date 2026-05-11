import React, { createContext, useContext } from 'react';
import { PositionItem, SiteData, SiteDataType } from '../types/menu';

export interface SiteModeContextType {
    siteData: SiteDataType | null;
    currentSite: string;
    effectiveSite: string;
    currentSiteData: SiteData | null;
    currentPosition: string;
    currentPositionData: PositionItem | null;
    positions: PositionItem[];
    changeSite: (siteKey: string) => void;
    changePosition: (positionId: string) => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const SiteModeContext = createContext<SiteModeContextType | null>(null);

export function SiteModeProvider({
    children,
    siteData,
    currentSite,
    effectiveSite,
    currentSiteData,
    currentPosition,
    currentPositionData,
    positions,
    changeSite,
    changePosition,
    isDarkMode,
    toggleDarkMode
}: SiteModeContextType & { children: React.ReactNode }) {
    return (
        <SiteModeContext.Provider
            value={{
                siteData,
                currentSite,
                effectiveSite,
                currentSiteData,
                currentPosition,
                currentPositionData,
                positions,
                changeSite,
                changePosition,
                isDarkMode,
                toggleDarkMode
            }}
        >
            {children}
        </SiteModeContext.Provider>
    );
}

export function useSiteMode() {
    const context = useContext(SiteModeContext);
    if (!context) {
        throw new Error('useSiteMode must be used within a SiteModeProvider');
    }
    return context;
}
