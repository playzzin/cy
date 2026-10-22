import React from 'react';
import { createRoot } from 'react-dom/client';
import FreelancerPage from '../../src/pages/manpower/FreelancerPage';

createRoot(document.getElementById('root')!).render(<>
    <div style={{ padding: 8, background: '#234b3b', color: 'white' }}>가상 자료를 사용하는 로컬 검증 화면</div>
    <FreelancerPage />
</>);
