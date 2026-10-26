import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AccountManagementPage from '../../src/pages/database/AccountManagementPage';
import WorkerDatabase from '../../src/pages/database/WorkerDatabase';
import WorkerSummaryPage from '../../src/pages/manpower/WorkerSummaryPage';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/database/account-management?tab=workers']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {window.location.pathname === '/summary' ? <WorkerSummaryPage /> : window.location.pathname === '/workers' ? <WorkerDatabase hideHeader /> : <AccountManagementPage />}
</MemoryRouter>);
