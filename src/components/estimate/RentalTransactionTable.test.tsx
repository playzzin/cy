import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { createItem } from '../../utils/estimateUtils';
import { RentalTransactionTable } from './RentalTransactionTable';

describe('RentalTransactionTable', () => {
    it('fits the editable table inside the document and centers the note column', () => {
        const item = createItem({
            section: '수직재 1900',
            unit: 'EA',
            quantity: 2,
            finalUnitPrice: 1000,
            rentalUnitPrice: 100,
            period: 10,
            note: '중앙 비고'
        });

        render(
            <RentalTransactionTable
                draft={{ includeVat: true, vatRate: 10, items: [item] }}
                itemsWithCalc={[{ ...item, amount: 4000 }]}
                isEdit={true}
                updateItem={jest.fn()}
                setDraft={jest.fn()}
            />
        );

        const noteHeader = screen.getByRole('columnheader', { name: '비고' });
        const table = noteHeader.closest('table');
        expect(table).toHaveStyle({ width: '100%', minWidth: '1320px', margin: '0 auto' });
        expect(noteHeader).toHaveStyle({ position: 'sticky', right: '55px', textAlign: 'center' });

        const noteInput = screen.getByDisplayValue('중앙 비고');
        expect(noteInput).toHaveStyle({ textAlign: 'center' });
        expect(noteInput.closest('td')).toHaveStyle({ position: 'sticky', right: '55px', textAlign: 'center', overflow: 'hidden' });
    });
});
