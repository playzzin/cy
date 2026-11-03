import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { RentalCatalogEntry } from '../../services/rentalCatalogService';
import RentalCatalogSettings from './RentalCatalogSettings';

const shoring: RentalCatalogEntry = {
    materialId: 'a', workType: 'shoring', category: '시스템동바리', itemName: '수평재', spec: 'H-18',
    unit: 'EA', quantity: 1, baseFee: 230, dailyFee: 6, maxQuantity: 5000, active: true,
};
const scaffold: RentalCatalogEntry = { ...shoring, materialId: 'b', workType: 'scaffold', category: '시스템비계' };
const rates = [shoring, scaffold];

describe('RentalCatalogSettings', () => {
    it('keeps drafts across work types and only inserts the saved row', async () => {
        const onInsert = jest.fn();
        const onSave = jest.fn().mockResolvedValue(undefined);
        const props = { rates, onInsert, onSave };
        const view = render(<RentalCatalogSettings {...props} workType="shoring" />);
        fireEvent.change(screen.getByRole('spinbutton', { name: '기본 수량' }), { target: { value: '3' } });
        expect(screen.getByRole('button', { name: '거래표에 넣기' })).toBeDisabled();
        view.rerender(<RentalCatalogSettings {...props} workType="scaffold" />);
        expect(screen.getByRole('spinbutton', { name: '기본 수량' })).toHaveValue(1);
        fireEvent.change(screen.getByRole('spinbutton', { name: '일단가' }), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
        const saved = [{ ...shoring, quantity: 3 }, { ...scaffold, dailyFee: 10, dailyFeeMissing: false }];
        expect(onSave).toHaveBeenCalledWith(saved);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장했습니다'));
        view.rerender(<RentalCatalogSettings {...props} rates={saved} workType="shoring" />);
        fireEvent.click(screen.getByRole('button', { name: '거래표에 넣기' }));
        expect(onInsert).toHaveBeenCalledWith(saved[0]);
    });

    it('filters and adds a row to the selected work type, then cancels it', () => {
        const onSave = jest.fn();
        render(<RentalCatalogSettings rates={rates} onSave={onSave} onInsert={jest.fn()} workType="scaffold" />);
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없음' } });
        expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '품목 추가' }));
        expect(screen.getByRole('searchbox')).toHaveValue('');
        const newRow = within(screen.getAllByRole('row')[1]);
        fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('시스템비계 새 품목');
        fireEvent.change(newRow.getByRole('textbox', { name: '품목' }), { target: { value: '발판' } });
        fireEvent.click(screen.getByRole('button', { name: '변경 취소' }));
        expect(screen.queryByDisplayValue('발판')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '설정 저장' })).toBeDisabled();
    });

    it('distinguishes an omitted daily fee from an explicit zero', async () => {
        const pin = { ...shoring, dailyFee: 0, dailyFeeMissing: true, active: false };
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(<RentalCatalogSettings rates={[pin]} onSave={onSave} onInsert={jest.fn()} workType="shoring" />);
        expect(screen.getByRole('spinbutton', { name: '일단가' })).toHaveValue(null);
        expect(screen.getByRole('checkbox', { name: '사용' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '거래표에 넣기' })).toBeDisabled();
        fireEvent.change(screen.getByRole('spinbutton', { name: '일단가' }), { target: { value: '0' } });
        fireEvent.click(screen.getByRole('checkbox', { name: '사용' }));
        fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
        expect(onSave).toHaveBeenCalledWith([{ ...pin, active: true, dailyFeeMissing: false }]);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장했습니다'));
    });

    it('saves a new material to the selected work type with its quantity and fees', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        render(<RentalCatalogSettings rates={rates} onSave={onSave} onInsert={jest.fn()} workType="scaffold" />);
        fireEvent.click(screen.getByRole('button', { name: '품목 추가' }));
        const row = within(screen.getAllByRole('row')[1]);
        fireEvent.change(row.getByRole('textbox', { name: '품목' }), { target: { value: '발판' } });
        fireEvent.change(row.getByRole('textbox', { name: '규격' }), { target: { value: '400*1800' } });
        fireEvent.change(row.getByRole('textbox', { name: '단위' }), { target: { value: '개' } });
        fireEvent.change(row.getByRole('spinbutton', { name: '기본 수량' }), { target: { value: '2' } });
        fireEvent.change(row.getByRole('spinbutton', { name: '기본료' }), { target: { value: '450' } });
        fireEvent.change(row.getByRole('spinbutton', { name: '일단가' }), { target: { value: '8' } });
        fireEvent.change(row.getByRole('spinbutton', { name: '자동생성 최대수량' }), { target: { value: '100' } });
        fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
        expect(onSave).toHaveBeenCalledWith([expect.objectContaining({ workType: 'scaffold', itemName: '발판', spec: '400*1800', unit: '개', quantity: 2, baseFee: 450, dailyFee: 8, maxQuantity: 100 }), ...rates]);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장했습니다'));
    });

    it('allows first registration without edits and keeps failed edits available for retry', async () => {
        const onSave = jest.fn().mockRejectedValueOnce(new Error('저장할 권한이 없습니다.')).mockResolvedValueOnce(undefined);
        render(<RentalCatalogSettings rates={rates} onSave={onSave} onInsert={jest.fn()} workType="shoring" needsRegistration />);
        const register = screen.getByRole('button', { name: '견적 품목 DB 등록' });
        expect(register).toBeEnabled();
        expect(screen.getByRole('button', { name: '거래표에 넣기' })).toBeDisabled();
        fireEvent.change(screen.getByRole('spinbutton', { name: '기본료' }), { target: { value: '400' } });
        fireEvent.click(register);
        expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
        expect(await screen.findByRole('alert')).toHaveTextContent('저장할 권한이 없습니다.');
        expect(screen.getByRole('spinbutton', { name: '기본료' })).toHaveValue(400);
        fireEvent.click(register);
        expect(onSave).toHaveBeenLastCalledWith([{ ...shoring, baseFee: 400 }, scaffold]);
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
});
