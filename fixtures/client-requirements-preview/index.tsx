import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TeamWorkerDetailPage from '../../src/pages/manpower/TeamWorkerDetailPage';
import LaborCheckPage from '../../src/pages/report/LaborCheckPage';

createRoot(document.getElementById('root')!).render(<BrowserRouter>
    <Routes>
        <Route path="/workers" element={<TeamWorkerDetailPage view="profile" />} />
        <Route path="/history" element={<TeamWorkerDetailPage view="workHistory" />} />
        <Route path="/labor" element={<LaborCheckPage />} />
    </Routes>
</BrowserRouter>);
