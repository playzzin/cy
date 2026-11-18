import React from 'react';
import { createRoot } from 'react-dom/client';
import { TeamSettlementPage } from '../../src/pages/payroll/TeamSettlementPage';
import '../../src/index.css';

const shell = new URLSearchParams(window.location.search).has('shell');
createRoot(document.getElementById('root')!).render(shell ? <>
  <style>{`#main-content { margin-top: 60px; margin-left: 240px; width: calc(100% - 240px); } @media(max-width: 640px) { #main-content { margin-left: 0; width: 100%; } }`}</style>
  <main id="main-content"><TeamSettlementPage /></main>
</> : <TeamSettlementPage />);
