import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import WorkbookLedgerPage from '../../src/pages/taxinvoice/WorkbookLedgerPage';

sessionStorage.setItem('workbook-ledger:cheongyeon:active-tab', 'vat');
createRoot(document.getElementById('root')!).render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div style={{ padding: 12, background: '#1e3a8a', color: 'white' }}>로컬 검증용 합성 자료 · 운영 장부와 연결되지 않습니다</div>
        <WorkbookLedgerPage />
    </BrowserRouter>,
);
