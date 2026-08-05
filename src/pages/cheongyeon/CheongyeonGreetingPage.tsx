import React from 'react';
import { useSiteMode } from '../../contexts/SiteModeContext';
import CeoProfileTabs from './components/CeoProfileTabs';

const CheongyeonGreetingPage: React.FC = () => {
    const { isDarkMode } = useSiteMode();

    return (
        <div className={`relative min-h-screen overflow-hidden ${
            isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        }`}>
            {isDarkMode ? (
                <div className="fixed inset-0 z-0">
                    <iframe
                        src="https://www.unicorn.studio/embed/KmzUSKuMzQYJD0VFBPSC?scale=1&dpi=1.5"
                        title="Unicorn Studio Background"
                        className="h-full w-full border-0"
                        style={{ pointerEvents: 'none' }}
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/60 to-slate-950/90" />
                </div>
            ) : (
                <div className="fixed inset-0 z-0 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60" />
            )}

            <div className="relative z-10 pb-12">
                <CeoProfileTabs isDarkMode={isDarkMode} />
            </div>
        </div>
    );
};

export default CheongyeonGreetingPage;
