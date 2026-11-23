import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import UserManagementPage from '../../src/pages/admin/UserManagementPage';
import './preview.css';
createRoot(document.getElementById('root')!).render(<BrowserRouter><main style={{ padding: 16 }}><UserManagementPage /></main></BrowserRouter>);
