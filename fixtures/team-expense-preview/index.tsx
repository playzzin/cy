import React from 'react';
import { createRoot } from 'react-dom/client';
import TeamExpenseRequestPage from '../../src/pages/support/TeamExpenseRequestPage';
import './preview.css';

createRoot(document.getElementById('root')!).render(<>
  <div className="fixture-banner">모바일 경비 등록 검증 · 가상 데이터만 사용</div>
  <TeamExpenseRequestPage />
</>);
