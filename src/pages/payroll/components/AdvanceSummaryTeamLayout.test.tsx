import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import AdvanceSummaryTeamLayout from './AdvanceSummaryTeamLayout';

const originalObserver = global.ResizeObserver;
let resize: () => void;
let disconnect: jest.Mock;
beforeEach(() => {
    disconnect = jest.fn();
    global.ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) { resize = () => callback([], this as unknown as ResizeObserver); }
        observe() {}
        unobserve() {}
        disconnect = disconnect;
    } as unknown as typeof ResizeObserver;
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return { height: Number(this.dataset.height || 0) } as DOMRect;
    });
});
afterEach(() => { global.ResizeObserver = originalObserver; jest.restoreAllMocks(); });

const cards = <><section aria-label="긴 팀" data-height="500">긴 팀</section><section aria-label="짧은 팀" data-height="100">짧은 팀</section><section aria-label="다음 팀" data-height="150">다음 팀</section></>;

test('서로 다른 표 높이와 변경된 비고 높이를 반영하면서 문서 순서는 유지한다', () => {
    render(<AdvanceSummaryTeamLayout mode="compact">{cards}</AdvanceSummaryTeamLayout>);
    const grid = screen.getByRole('group', { name: '팀별 가불목록' });
    expect(grid).toHaveAttribute('data-packed', 'true');
    expect(within(grid).getAllByRole('region').map(child => child.textContent)).toEqual(['긴 팀', '짧은 팀', '다음 팀']);
    expect(screen.getByText('긴 팀')).toHaveStyle({ gridRowEnd: 'span 516' });
    expect(screen.getByText('짧은 팀')).toHaveStyle({ gridRowEnd: 'span 116' });
    screen.getByText('짧은 팀').dataset.height = '300';
    act(() => resize());
    expect(screen.getByText('짧은 팀')).toHaveStyle({ gridRowEnd: 'span 316' });
});

test('넓게 보기 전환 시 배치와 관찰을 정리하고 내용을 제거하지 않는다', () => {
    const { rerender } = render(<AdvanceSummaryTeamLayout mode="compact">{cards}</AdvanceSummaryTeamLayout>);
    rerender(<AdvanceSummaryTeamLayout mode="wide">{cards}</AdvanceSummaryTeamLayout>);
    expect(screen.getByRole('group', { name: '팀별 가불목록' })).not.toHaveAttribute('data-packed');
    expect(screen.getByRole('group', { name: '팀별 가불목록' })).toHaveClass('as-team-grid-wide');
    expect(screen.getByText('긴 팀').style.gridRowEnd).toBe('');
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('다음 팀')).toBeInTheDocument();
});

test('크기 관찰을 지원하지 않는 환경은 일반 표 배치로 표시한다', () => {
    global.ResizeObserver = undefined as unknown as typeof ResizeObserver;
    render(<AdvanceSummaryTeamLayout mode="compact">{cards}</AdvanceSummaryTeamLayout>);
    expect(screen.getByRole('group', { name: '팀별 가불목록' })).not.toHaveAttribute('data-packed');
    expect(screen.getByText('긴 팀')).toBeInTheDocument();
});
