import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteModeProvider } from '../../src/contexts/SiteModeContext';
import SiteResponsibleDetailPage from '../../src/pages/manpower/SiteResponsibleDetailPage';

function Preview() {
    const [teamMenu, setTeamMenu] = useState(true);
    return <>
        <button onClick={() => setTeamMenu(value => !value)}>검증용 메뉴 전환</button>
        <SiteModeProvider siteData={null} currentSite="admin" effectiveSite={teamMenu ? 'pos_leader' : 'admin'}
            currentSiteData={teamMenu ? { name: '팀장', icon: '', menu: [] } : null}
            currentPosition={teamMenu ? 'leader' : 'full'} currentPositionData={null} positions={[]}
            changeSite={() => undefined} changePosition={() => undefined} isDarkMode={false} toggleDarkMode={() => undefined}>
            <SiteResponsibleDetailPage />
        </SiteModeProvider>
    </>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
