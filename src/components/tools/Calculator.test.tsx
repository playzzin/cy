import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Calculator from './Calculator';

const memoryStorageKey = 'quickCalculator.memoryValues.v1';

const getDisplay = () => screen.getByTestId('calculator-display');
const getEquation = () => screen.getByTestId('calculator-equation');
const getLastCalculation = () => screen.getByTestId('calculator-last-calculation');

describe('Calculator memory', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('stores a calculated result and pastes it into a later calculation', () => {
        render(<Calculator />);

        fireEvent.click(screen.getByRole('button', { name: '1' }));
        fireEvent.click(screen.getByRole('button', { name: '+' }));
        fireEvent.click(screen.getByRole('button', { name: '2' }));

        expect(getEquation().textContent).toBe('1 + 2');
        expect(screen.queryByText(/Target:/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '=' }));

        expect(getDisplay().textContent).toBe('3');
        expect(getLastCalculation().textContent).toBe('1 + 2 = 3');

        fireEvent.click(screen.getByRole('button', { name: /결과 저장/ }));

        const savedValues = JSON.parse(window.localStorage.getItem(memoryStorageKey) || '[]');
        expect(savedValues[0].value).toBe('3');

        fireEvent.click(screen.getByRole('button', { name: 'C' }));
        fireEvent.click(screen.getByRole('button', { name: '4' }));
        fireEvent.click(screen.getByRole('button', { name: '+' }));
        fireEvent.click(screen.getByRole('button', { name: '붙여넣기' }));
        fireEvent.click(screen.getByRole('button', { name: '=' }));

        expect(getDisplay().textContent).toBe('7');
    });
});
