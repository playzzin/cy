import React from 'react';
import { createRoot } from 'react-dom/client';
import EmploymentCertificatePage from '../../src/pages/hr/EmploymentCertificatePage';
import TerminationCertificatePage from '../../src/pages/hr/TerminationCertificatePage';

createRoot(document.getElementById('root')!).render(window.location.pathname.includes('termination')
    ? <TerminationCertificatePage /> : <EmploymentCertificatePage />);
