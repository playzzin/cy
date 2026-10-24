import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CorporateTaxPage from '../../src/pages/tax/CorporateTaxPage';
import OfficeStaffPayrollPage from '../../src/pages/payroll/OfficeStaffPayrollPage';

createRoot(document.getElementById('root')!).render(<BrowserRouter><div style={{ padding: '8px 28px', fontSize: 12, background: '#234b3b', color: 'white' }}>로컬 검증용 가상 자료 · 실제 장부와 연결되지 않습니다</div>{window.location.pathname.includes('office-staff') ? <OfficeStaffPayrollPage /> : <CorporateTaxPage />}</BrowserRouter>);
