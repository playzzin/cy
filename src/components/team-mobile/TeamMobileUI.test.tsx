import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TeamMobileProvider, TeamRequestTabs, useTeamRequestTabs } from './TeamMobileUI';

let narrow = true;
const listeners = new Set<() => void>();
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
    narrow = true;
    listeners.clear();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => ({
        get matches() { return narrow; },
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    })) });
    window.history.replaceState(null, '', '/');
});
afterEach(() => Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia }));

function Request({ reviewer = false, owner = 'leader' }: { reviewer?: boolean; owner?: string }) {
    const tabs = useTeamRequestTabs('request-history', !reviewer, owner);
    const [amount, setAmount] = useState('');
    return <><TeamRequestTabs tabs={tabs} />
        <section id={`${tabs.id}-entry`} {...tabs.panel('entry')}><label>신청 금액<input value={amount} onChange={e => setAmount(e.target.value)} /></label><input aria-label="영수증 첨부" type="file" /></section>
        <section id="request-history" {...tabs.panel('history')}>신청 기록</section>
    </>;
}

test('팀장 모바일에서만 입력/내역을 나누고 데스크톱·다른 역할·승인 화면은 함께 표시한다', () => {
    const view = render(<TeamMobileProvider enabled={false}><Request /></TeamMobileProvider>);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    view.rerender(<TeamMobileProvider enabled><Request /></TeamMobileProvider>);
    expect(screen.getByRole('tab', { name: '신청하기' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('신청 기록')).not.toBeVisible();
    act(() => { narrow = false; listeners.forEach(listener => listener()); });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('신청 기록')).toBeVisible();
    act(() => { narrow = true; listeners.forEach(listener => listener()); });
    view.rerender(<TeamMobileProvider enabled><Request reviewer /></TeamMobileProvider>);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByLabelText('신청 금액')).toBeVisible();
    expect(screen.getByText('신청 기록')).toBeVisible();
});

test('탭 왕복과 화면 폭 변경에도 입력값과 선택한 파일 요소를 보존한다', () => {
    render(<TeamMobileProvider enabled><Request /></TeamMobileProvider>);
    const input = screen.getByLabelText('신청 금액');
    const receipt = screen.getByLabelText('영수증 첨부') as HTMLInputElement;
    const file = new File(['synthetic'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(input, { target: { value: '15000' } });
    fireEvent.change(receipt, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('tab', { name: '신청 내역' }));
    expect(input).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: '신청하기' }));
    expect(screen.getByLabelText('신청 금액')).toBe(input);
    expect(input).toHaveValue('15000');
    expect(receipt.files?.[0]).toBe(file);
    act(() => { narrow = false; listeners.forEach(listener => listener()); });
    expect(screen.getByLabelText('영수증 첨부')).toBe(receipt);
});

test('기존 신청 내역 앵커와 키보드 탭 이동을 지원한다', () => {
    window.history.replaceState(null, '', '/#request-history');
    render(<TeamMobileProvider enabled><Request /></TeamMobileProvider>);
    const historyTab = screen.getByRole('tab', { name: '신청 내역' });
    expect(historyTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(historyTab, { key: 'Home' });
    expect(screen.getByRole('tab', { name: '신청하기' })).toHaveFocus();
    expect(screen.getByLabelText('신청 금액')).toBeVisible();
    fireEvent.keyDown(screen.getByRole('tab', { name: '신청하기' }), { key: 'ArrowRight' });
    expect(historyTab).toHaveFocus();
    expect(screen.getByText('신청 기록')).toBeVisible();
});

test('팀장 모드에서 나가면 문서의 모바일 스타일 범위를 해제한다', () => {
    const view = render(<TeamMobileProvider enabled><Request /></TeamMobileProvider>);
    expect(document.documentElement).toHaveAttribute('data-team-mobile', 'true');
    view.rerender(<TeamMobileProvider enabled={false}><Request /></TeamMobileProvider>);
    expect(document.documentElement).not.toHaveAttribute('data-team-mobile');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});

test('인쇄에는 기존 전체 화면을 표시하고 종료 후 입력과 선택한 탭을 복원한다', () => {
    render(<TeamMobileProvider enabled><Request /></TeamMobileProvider>);
    fireEvent.change(screen.getByLabelText('신청 금액'), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('tab', { name: '신청 내역' }));
    fireEvent(window, new Event('beforeprint'));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByLabelText('신청 금액')).toBeVisible();
    expect(screen.getByText('신청 기록')).toBeVisible();
    fireEvent(window, new Event('afterprint'));
    expect(screen.getByRole('tab', { name: '신청 내역' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: '신청하기' }));
    expect(screen.getByLabelText('신청 금액')).toHaveValue('15000');
});
