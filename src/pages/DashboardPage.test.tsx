import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from './DashboardPage';
import { TeamMobileProvider } from '../components/team-mobile/TeamMobileUI';
import { teamService } from '../services/teamService';

jest.mock('../contexts/SiteModeContext', () => ({
    useSiteMode: () => ({ currentPosition: 'full', positions: [], changePosition: jest.fn() }),
}));
jest.mock('../hooks/useLinkedWorker', () => ({
    useLinkedWorker: () => ({ loading: false, linkedWorker: { id: 'worker', teamId: 'old-team-id', color: '#111111' } }),
}));
jest.mock('../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../components/dashboard/TeamLeadDashboardView', () => () => <section>팀 운영 지표</section>);
jest.mock('../components/messages/DashboardMessageWidget', () => ({ DashboardMessageWidget: () => null }));
jest.mock('../components/dashboard/widgets/TomorrowScheduleWidget', () => ({ TomorrowScheduleWidget: () => null }));

test('전체가 기본 직책이어도 팀장 메뉴에서는 공용 로고와 소속팀의 최신 이름·색상을 표시한다', async () => {
    const media = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'other', name: '다른팀', color: '#001144' },
        { id: 'current', legacyId: 'old-team-id', name: '시공1팀', color: '#ffec72' },
    ]);
    try {
        const { container } = render(<TeamMobileProvider enabled><DashboardPage /></TeamMobileProvider>);
        const header = screen.getByRole('banner');
        expect(within(header).getByRole('heading', { name: '우리 팀 현황' })).toBeVisible();
        expect(within(header).getByRole('img', { name: '청연ENG ERP 로고' }).querySelector('video')).toBeInTheDocument();
        expect(await within(header).findByText('시공1팀')).toBeVisible();
        expect(container.querySelector<HTMLElement>('.tm-dashboard')?.style.getPropertyValue('--tm-dashboard-accent')).toBe('#ffec72');
        expect(container.querySelector<HTMLElement>('.tm-dashboard')?.style.getPropertyValue('--tm-dashboard-heading-text')).toBe('#0f172a');
        await waitFor(() => expect(screen.getByText('팀 운영 지표')).toBeVisible());
    } finally { window.matchMedia = media; }
});
