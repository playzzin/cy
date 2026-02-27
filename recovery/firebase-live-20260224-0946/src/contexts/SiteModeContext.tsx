import React, { createContext, useContext } from 'react';
import { SiteData, SiteDataType } from '../types/menu';

export interface SiteModeContextType {
    siteData: SiteDataType | null;
    currentSite: string;
    effectiveSite: string;
    currentSiteData: SiteData | null;
    changeSite: (siteKey: string) => void;
}

const SiteModeContext = createContext<SiteModeContextType | null>(null);

export function SiteModeProvider({
    children,
    siteData,
    currentSite,
    effectiveSite,
    currentSiteData,
    changeSite
}: SiteModeContextType & { children: React.ReactNode }) {
    return (
        <SiteModeContext.Provider
            value={{ siteData, currentSite, effectiveSite, currentSiteData, changeSite }}
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
