import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';
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
        'hides the position choices for %s even for an administrator, keeping the app installer available',
        (currentPosition) => {
            render(<DashboardHeader {...props} currentPosition={currentPosition} />);

            expect(screen.queryByLabelText('대시보드 직책 모드')).toBeNull();
            expect(screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' })).not.toBeNull();
            expect(screen.getByRole('link', { name: '청연ENG ERP APK 설치' })).not.toBeNull();
            expect(screen.queryByRole('link', { name: /SMS/ })).toBeNull();
        }
    );

    it('recognizes the DEV position id before the configured positions finish loading', () => {
        render(<DashboardHeader {...props} positions={[]} currentPosition="dev" />);
        expect(screen.getByLabelText('대시보드 직책 모드')).not.toBeNull();
    });
});
