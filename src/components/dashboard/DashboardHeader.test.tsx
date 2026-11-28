import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DashboardHeader, DashboardLogo } from './DashboardHeader';
import { DASHBOARD_MODES } from './roleDashboardConfig';
import type { PositionItem } from '../../types/menu';

const positions: PositionItem[] = [
    { id: 'full', name: '전체 메뉴', icon: 'fa-list', color: 'slate' },
    { id: 'ceo', name: 'CEO', icon: 'fa-crown', color: 'purple' },
    { id: 'configured-dev-position', name: 'DEV', icon: 'fa-code', color: 'blue' },
    { id: 'worker', name: '작업자', icon: 'fa-user', color: 'green' },
];

const props = {
    user: { name: '테스트 관리자', role: '관리자' },
    modeConfig: DASHBOARD_MODES[0],
    positions,
    onPositionChange: jest.fn(),
};

describe('DashboardHeader position switcher', () => {
    it('shows all position choices in the configured DEV position and lets the user switch', () => {
        const onPositionChange = jest.fn();
        const { rerender } = render(
            <DashboardHeader {...props} currentPosition="configured-dev-position" onPositionChange={onPositionChange} />
        );

        const switcher = screen.getByLabelText('대시보드 직책 모드');
        expect(within(switcher).getAllByRole('button')).toHaveLength(positions.length);
        fireEvent.click(within(switcher).getByRole('button', { name: '작업자' }));
        expect(onPositionChange).toHaveBeenCalledWith('worker');

        rerender(<DashboardHeader {...props} currentPosition="worker" onPositionChange={onPositionChange} />);
        expect(screen.queryByLabelText('대시보드 직책 모드')).toBeNull();
    });

    it.each(['full', 'ceo', 'worker', 'unknown'])(
        'hides the position choices and installation actions for %s even for an administrator',
        (currentPosition) => {
            render(<DashboardHeader {...props} currentPosition={currentPosition} />);

            expect(screen.queryByLabelText('대시보드 직책 모드')).toBeNull();
            expect(screen.queryByRole('button', { name: '청연ENG ERP 바탕화면에 추가' })).toBeNull();
            expect(screen.queryByRole('link', { name: '청연ENG ERP APK 설치' })).toBeNull();
            expect(screen.queryByRole('link', { name: /SMS/ })).toBeNull();
        }
    );

    it('recognizes the DEV position id before the configured positions finish loading', () => {
        render(<DashboardHeader {...props} positions={[]} currentPosition="dev" />);
        expect(screen.getByLabelText('대시보드 직책 모드')).not.toBeNull();
    });
});

it('shows the dashboard logo before the team status title and identifies the selected team', () => {
    render(<DashboardHeader {...props} currentPosition="teamLead" teamName="검증팀" teamColor="#ffec72" />);
    const logo = screen.getByRole('img', { name: '청연ENG ERP 로고' });
    const heading = screen.getByRole('heading', { name: '우리 팀 현황' });
    expect(logo.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('검증팀')).toBeTruthy();
});

it('reuses the dashboard logo video in the compact header and falls back to the poster', () => {
    render(<DashboardLogo compact />);

    const logo = screen.getByRole('img', { name: '청연ENG ERP 로고' });
    const video = logo.querySelector('video');
    expect(video?.getAttribute('src')).toContain('logo_cy.mp4');
    expect(video?.hasAttribute('playsinline')).toBe(true);

    fireEvent.error(video!);
    expect(logo.querySelector('video')).toBeNull();
    expect(logo.querySelector('img')?.getAttribute('src')).toContain('/icons/icon-192.png');
});
