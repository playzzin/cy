import React from 'react';
import { createRoot } from 'react-dom/client';
// Include the same reset as the app: its block images affect html2canvas font metrics.
import 'tailwindcss/lib/css/preflight.css';
import EmploymentCertificatePage from '../../src/pages/hr/EmploymentCertificatePage';
import TerminationCertificatePage from '../../src/pages/hr/TerminationCertificatePage';

createRoot(document.getElementById('root')!).render(window.location.pathname.includes('termination')
    ? <TerminationCertificatePage /> : <EmploymentCertificatePage />);
