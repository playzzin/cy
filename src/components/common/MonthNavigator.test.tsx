import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import MonthNavigator, { shiftYearMonth } from './MonthNavigator';

describe('MonthNavigator', () => {
    it('moves across year boundaries', () => {
        expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    });

    it('allows moving to the next month without a future-month limit', () => {
        const onChange = jest.fn();
        render(<MonthNavigator value="2026-08" onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: '다음 달' }));

        expect(onChange).toHaveBeenCalledWith('2026-09');
    });
});
