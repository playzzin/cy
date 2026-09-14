import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { createItem } from '../../utils/estimateUtils';
import { EstimateTable } from './EstimateTable';

describe('EstimateTable', () => {
    it('shows separate labor and rental totals for a rental estimate', () => {
        const shoringItem = {
            ...createItem({ category: '시스템 동바리', quantity: 2 }),
            laborAmount: 2000,
            rentalAmount: 1000,
            amount: 3000
        };
        const scaffoldItem = {
            ...createItem({ category: '시스템 비계', quantity: 1 }),
            laborAmount: 3000,
            rentalAmount: 2000,
            amount: 5000
        };

        render(
            <EstimateTable
                draft={{ estimateMode: 'rental' }}
                itemsWithCalc={[shoringItem, scaffoldItem]}
                subtotal={8000}
                isEdit={false}
                updateItem={jest.fn()}
                setDraft={jest.fn()}
            />
        );

        const rows = screen.getAllByRole('row');
        const grandTotalRow = rows[rows.length - 1];
        expect(within(grandTotalRow).getByText('5,000')).toBeInTheDocument();
        expect(within(grandTotalRow).getByText('3,000')).toBeInTheDocument();
        expect(within(grandTotalRow).queryByText('8,000')).not.toBeInTheDocument();
    });
});
