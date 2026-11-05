import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NationwideRecruitmentPage from './NationwideRecruitmentPage';

it.each<[string, string, number, string]>([
    ['일반 180,000원', '기본 8시간 · 1공수', 1, '180,000원'],
    ['일반 180,000원', '2시간 잔업 · 1.5공수', 1, '270,000원'],
    ['일반 180,000원', '4시간 잔업 · 2.0공수', 1, '360,000원'],
    ['익일지급 170,000원', '2시간 잔업 · 1.5공수', 1, '255,000원'],
    ['익일지급 170,000원', '4시간 잔업 · 2.0공수', 3, '1,020,000원'],
])('%s에서 %s로 %i일 근무하면 %s로 계산한다', (payment, shift, days, total) => {
    render(<NationwideRecruitmentPage />);
    userEvent.selectOptions(screen.getByRole('combobox', { name: '기본 일당' }), screen.getByRole('option', { name: payment }));
    userEvent.selectOptions(screen.getByRole('combobox', { name: '하루 공수' }), screen.getByRole('option', { name: shift }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: String(days) } });
    expect(screen.getByLabelText('예상 총 급여액')).toHaveTextContent(total);
});
