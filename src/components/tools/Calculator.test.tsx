import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Calculator from './Calculator';

const memoryStorageKey = 'quickCalculator.memoryValues.v1';

const getDisplay = () => screen.getByTestId('calculator-display');
const getEquation = () => screen.getByTestId('calculator-equation');
const getLastCalculation = () => screen.getByTestId('calculator-last-calculation');
const getCalculatorButton = (name: string) => screen.getByRole('button', { name: `계산기 ${name}` });

describe('Calculator memory', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('stores a calculated result and pastes it into a later calculation', () => {
        render(<Calculator />);

        fireEvent.click(getCalculatorButton('1'));
        fireEvent.click(getCalculatorButton('+'));
        fireEvent.click(getCalculatorButton('2'));

        expect(getEquation().textContent).toBe('1 + 2');
        expect(screen.queryByText(/Target:/)).toBeNull();

        fireEvent.click(getCalculatorButton('='));

        expect(getDisplay().textContent).toBe('3');
        expect(getLastCalculation().textContent).toBe('1 + 2 = 3');

        fireEvent.click(screen.getByRole('button', { name: /결과 저장/ }));

        const savedValues = JSON.parse(window.localStorage.getItem(memoryStorageKey) || '[]');
        expect(savedValues[0].value).toBe('3');

        fireEvent.click(getCalculatorButton('C'));
        fireEvent.click(getCalculatorButton('4'));
        fireEvent.click(getCalculatorButton('+'));
        fireEvent.click(screen.getByRole('button', { name: '붙여넣기' }));
        fireEvent.click(getCalculatorButton('='));

        expect(getDisplay().textContent).toBe('7');
    });
});
