import React from 'react';
import { createRoot } from 'react-dom/client';
import WorkerAdvanceRequestPage from '../../src/pages/payroll/WorkerAdvanceRequestPage';
import '../client-mobile-preview/tailwind.css';

createRoot(document.getElementById('root')!).render(<WorkerAdvanceRequestPage />);
