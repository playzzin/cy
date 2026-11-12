import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AccommodationForm from './AccommodationForm';
import { SupportCancellationModal } from '../support/SupportCancellationModal';
import type { Accommodation } from '../../types/accommodation';

it('숙소 종료 처리에서 처리일과 별도로 비용 종료월을 제출한다', () => {
    const onSubmit = jest.fn();
    render(<SupportCancellationModal isOpen resourceType="accommodation" resourceLabel="검증숙소" onClose={() => undefined} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('처리일'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('비용 종료월'), { target: { value: '2026-10' } });
    fireEvent.change(screen.getByLabelText('처리 내역'), { target: { value: '10월까지 사용' } });
    fireEvent.click(screen.getByRole('button', { name: '처리 완료' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ processedDate: '2026-11-12', billingEndYearMonth: '2026-10' }));
});

it('기존 종료 숙소의 비용 종료월을 편집해도 계약 만기일은 유지한다', () => {
    const onSubmit = jest.fn();
    const initialData = { id: 'room', name: '검증숙소', address: '검증주소', type: 'OneRoom', status: 'inactive',
        ownership: 'Cheongyeon', endedDate: '2026-11-12', billingEndYearMonth: '2026-11',
        contract: { startDate: '2026-01-01', endDate: '2026-11-10', monthlyRent: 500000, deposit: 1000000, paymentDay: 1 } } as Accommodation;
    render(<AccommodationForm initialData={initialData} onCancel={() => undefined} onSubmit={onSubmit} />);
    expect(screen.getByLabelText('비용 종료월')).toHaveValue('2026-11');
    fireEvent.change(screen.getByLabelText('비용 종료월'), { target: { value: '2026-10' } });
    fireEvent.click(screen.getByRole('button', { name: '저장하기' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ billingEndYearMonth: '2026-10', contract: expect.objectContaining({ endDate: '2026-11-10' }) }));
});

it.each(['vehicle', 'card'] as const)('%s 처리에는 숙소 비용 종료월 입력을 추가하지 않는다', resourceType => {
    render(<SupportCancellationModal isOpen resourceType={resourceType} resourceLabel="검증대상" onClose={() => undefined} onSubmit={() => undefined} />);
    expect(screen.queryByLabelText('비용 종료월')).not.toBeInTheDocument();
});
