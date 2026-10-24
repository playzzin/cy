import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import WagePaymentPage from './WagePaymentPage';
jest.mock('./DailyWagePaymentPage', () => () => <div>일급 처리 화면</div>);
jest.mock('./MonthlyWageDraftPage', () => () => <div>월급 처리 화면</div>);
const Location = () => <output data-testid="url">{useLocation().search}</output>;
test('월급 링크에서 실제 처리 화면을 열고 탭 선택을 주소에 보존한다', async () => {
    render(<MemoryRouter initialEntries={['/?tab=monthly&month=2026-09']}><WagePaymentPage /><Location /></MemoryRouter>);
    expect(screen.queryByText('일급 처리 화면')).not.toBeInTheDocument();
    expect(await screen.findByText('월급 처리 화면')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '월급제' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '일급제' }));
    expect(screen.getByText('일급 처리 화면')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('?tab=daily&month=2026-09');
});
