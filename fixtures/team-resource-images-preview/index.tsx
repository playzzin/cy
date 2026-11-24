import React from 'react';
import { createRoot } from 'react-dom/client';
import { TeamMobileProvider } from '../../src/components/team-mobile/TeamMobileUI';
import TeamResourceDetailPage from '../../src/pages/support/TeamResourceDetailPage';
import { useTeamLeaderTypography } from '../../src/hooks/useTeamLeaderTypography';
import '../../src/components/common/WorkflowTheme.css';
function Preview() {
    useTeamLeaderTypography(true);
    return <TeamMobileProvider enabled><main id="main-content" style={{ maxWidth: 1300, margin: 'auto' }}><TeamResourceDetailPage /></main></TeamMobileProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
