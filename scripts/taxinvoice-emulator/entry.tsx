import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Page from '../../src/pages/taxinvoice/TaxInvoiceIssueListPage';
createRoot(document.getElementById('root')!).render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Page /></MemoryRouter>);
