import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link } from 'react-router-dom';
import ActivityCenterPage from '../../src/features/activity-center/ActivityCenterPage';
import { consolidateActivityMenus } from '../../src/features/activity-center/activityMenu';

const menu = consolidateActivityMenus([
  { text: '로그 관리', sub: [{ text: '접속 로그', path: '/admin/login-logs' }, { text: '권한 변경', path: '/admin/permission-change-logs' }] },
  { text: '일보 로그', path: '/reports/daily-logs' },
  { text: '자재 로그', path: '/materials/logs' },
], {});
createRoot(document.getElementById('root')!).render(<BrowserRouter>
  <nav style={{ padding: '12px 28px', background: '#172b4d', color: 'white' }}>{menu.map(item => <Link style={{ color: 'white' }} key={item.text} to={item.path!}>{item.text}</Link>)}<span style={{ marginLeft: 24, fontSize: 12 }}>가상 데이터 미리보기</span></nav>
  <ActivityCenterPage />
</BrowserRouter>);
