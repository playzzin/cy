import React from 'react';
import { createRoot } from 'react-dom/client';
import TeamWorkerDetailPage from '../../src/pages/manpower/TeamWorkerDetailPage';
import SiteResponsibleDetailPage from '../../src/pages/manpower/SiteResponsibleDetailPage';

const site = new URLSearchParams(window.location.search).get('view') === 'site';
createRoot(document.getElementById('root')!).render(site ? <SiteResponsibleDetailPage view="siteInfo" /> : <TeamWorkerDetailPage view="profile" />);
