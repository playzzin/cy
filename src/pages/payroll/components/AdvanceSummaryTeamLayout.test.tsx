import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AdvanceSummaryTeamLayout from './AdvanceSummaryTeamLayout';

test('엑셀형과 넓게 보기 전환에도 팀 순서와 편집 중인 입력을 유지한다', () => {
    const cards = [
        <section key="long" aria-label="긴 팀">긴 팀<input aria-label="편집 중인 비고" defaultValue="" /></section>,
        <section key="short" aria-label="짧은 팀">짧은 팀</section>,
        <section key="next" aria-label="다음 팀">다음 팀</section>,
    ];
    const { rerender } = render(<AdvanceSummaryTeamLayout mode="compact">{cards}</AdvanceSummaryTeamLayout>);
    const input = screen.getByRole('textbox', { name: '편집 중인 비고' });
    fireEvent.change(input, { target: { value: '저장 전 초안' } });
    rerender(<AdvanceSummaryTeamLayout mode="wide">{cards}</AdvanceSummaryTeamLayout>);
    expect(screen.getByRole('textbox', { name: '편집 중인 비고' })).toBe(input);
    expect(input).toHaveValue('저장 전 초안');
    expect(within(screen.getByRole('group', { name: '팀별 가불목록' })).getAllByRole('region').map(card => card.textContent))
        .toEqual(['긴 팀', '짧은 팀', '다음 팀']);
    rerender(<AdvanceSummaryTeamLayout mode="compact">{cards}</AdvanceSummaryTeamLayout>);
    expect(input).toHaveValue('저장 전 초안');
    expect(screen.getByRole('region', { name: '팀별 가불목록 가로 보기' })).toHaveAttribute('tabindex', '0');
});
