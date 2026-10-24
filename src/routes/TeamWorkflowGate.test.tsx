import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import TeamWorkflowGate from './TeamWorkflowGate';
const mockListeners = new Map<string, (snapshot: any) => void>();
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../services/teamScopedReadService', () => ({ invalidateTeamScopedCache: jest.fn() }));
jest.mock('firebase/firestore', () => ({ doc: (_: unknown, collection: string, id: string) => `${collection}/${id}`, onSnapshot: (path: string, next: (snapshot: any) => void) => { mockListeners.set(path, next); next({ data: () => path.startsWith('settings/') ? {} : { role: '팀장', teamId: 'a', status: '재직' } }); return () => mockListeners.delete(path); } }));
const profile = { uid: 'leader', role: 'user', position: '팀장', linkedWorkerIds: ['anchor'], status: 'active' } as any;
function Location() { return <p>{useLocation().pathname}{useLocation().search}</p>; }
test('일보 쿼리 진입을 차단하고 옛 달력 주소는 근무내역으로 연결한다', async () => {
    const view = render(<MemoryRouter initialEntries={['/reports/daily?tab=board-input']}><TeamWorkflowGate profile={profile}><p>일보 입력</p></TeamWorkflowGate></MemoryRouter>);
    await screen.findByText('팀장 조회 메뉴를 이용해 주세요');
    expect(screen.queryByText('일보 입력')).not.toBeInTheDocument();
    view.unmount();
    render(<MemoryRouter initialEntries={['/reports/daily-worker-calendar']}><TeamWorkflowGate profile={profile}><Location /></TeamWorkflowGate></MemoryRouter>);
    await screen.findByText('/manpower/team-worker-history');
});
test.each(['/manpower/team-worker-detail?section=work', '/manpower/team-worker-daily-report', '/manpower/team-worker-history', '/manpower/site-daily-report'])('분리된 화면과 기존 링크를 올바르게 연결한다: %s', async path => {
    render(<MemoryRouter initialEntries={[path]}><TeamWorkflowGate profile={profile}><Location /></TeamWorkflowGate></MemoryRouter>);
    await screen.findByText(path === '/manpower/site-daily-report' ? path : '/manpower/team-worker-history');
});
test('소속 변경 시 열린 자식 화면을 재생성하고 사무실은 입력 화면을 유지한다', async () => {
    const mounts = jest.fn();
    function Child() { React.useEffect(() => { mounts(); }, []); return <p>업무 화면</p>; }
    const view = render(<MemoryRouter><TeamWorkflowGate profile={profile}><Child /></TeamWorkflowGate></MemoryRouter>);
    await screen.findByText('업무 화면'); expect(mounts).toHaveBeenCalledTimes(1);
    act(() => mockListeners.get('workers/anchor')!({ data: () => ({ role: '팀장', teamId: 'b', status: '재직' }) }));
    expect(mounts).toHaveBeenCalledTimes(2);
    view.unmount();
    render(<MemoryRouter initialEntries={['/reports/daily?tab=input']}><TeamWorkflowGate profile={{ ...profile, accountType: 'office' }}><p>사무실 일보 입력</p></TeamWorkflowGate></MemoryRouter>);
    await screen.findByText('사무실 일보 입력');
});
