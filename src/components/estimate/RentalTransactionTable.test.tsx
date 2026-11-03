import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { createItem } from '../../utils/estimateUtils';
import { RentalTransactionTable } from './RentalTransactionTable';

describe('RentalTransactionTable', () => {
    it('distributes whole-won VAT across rows so their totals match the document', () => {
        const items = [16, 0, 16].map(amount => createItem({ section: '수직재', quantity: 1, finalUnitPrice: amount }));
        render(<RentalTransactionTable draft={{ includeVat: true, vatRate: 10 }} itemsWithCalc={items} isEdit={false} />);
        const rows = screen.getAllByRole('row').slice(1, 4);
        // 32원에 대한 부가세 3원을 앞 행에 2원, 마지막 행에 1원으로 배분한다.
        expect(rows.map(row => within(row).getAllByRole('cell')[8].textContent)).toEqual(['2', '', '1']);
        expect(rows.map(row => within(row).getAllByRole('cell')[9].textContent)).toEqual(['18', '', '17']);
    });

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
        const table = screen.getByRole('table');
        expect(table).toHaveStyle({ width: '100%', minWidth: '1320px', margin: '0 auto' });
        expect(noteHeader).toHaveStyle({ position: 'sticky', right: '55px', textAlign: 'center' });

        const noteInput = screen.getByDisplayValue('중앙 비고');
        expect(noteInput).toHaveStyle({ textAlign: 'center' });
        const noteCell = screen.getAllByRole('cell').find(cell => within(cell).queryByDisplayValue('중앙 비고'));
        expect(noteCell).toHaveStyle({ position: 'sticky', right: '55px', textAlign: 'center', overflow: 'hidden' });
    });
});
