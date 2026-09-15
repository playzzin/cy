import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SupportLedgerReview } from './SupportLedgerReview';
import { reviewSavedLedgerPosting } from '../../services/supportLedgerReviewService';
jest.mock('../../services/supportLedgerReviewService', () => ({ reviewSavedLedgerPosting: jest.fn() }));
const mocked = reviewSavedLedgerPosting as jest.Mock;
const props = { kind: 'vehicle' as const, month: '2026-09', blocked: false, revision: 'snapshot', billingRevision: 'bills', prepare: () => ({ sources: [], bills: [] }), reload: jest.fn() };
beforeEach(() => jest.clearAllMocks());
test('reports read failures instead of a successful empty comparison', async () => {
    mocked.mockRejectedValue(new Error('read failed'));
    render(<SupportLedgerReview {...props} />);
    fireEvent.click(screen.getByText('월 전체 대조하기'));
    expect(await screen.findByRole('alert')).toHaveTextContent('검사를 완료하지 못했습니다');
    expect(screen.queryByText('이 월에는 대조할 원장과 청구가 없습니다.')).not.toBeInTheDocument();
});
test('discards an in-flight result when month changes', async () => {
    let resolve!: (value: []) => void;
    mocked.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<SupportLedgerReview {...props} />);
    fireEvent.click(screen.getByText('월 전체 대조하기'));
    await waitFor(() => expect(mocked).toHaveBeenCalled());
    view.rerender(<SupportLedgerReview {...props} month="2026-08" />);
    await act(async () => { resolve([]); });
    expect(screen.queryByText(/원장 0건/)).not.toBeInTheDocument();
});
test('invalidates results after bills change and blocks unsaved inputs', async () => {
    mocked.mockResolvedValue([]);
    const view = render(<SupportLedgerReview {...props} />);
    fireEvent.click(screen.getByText('월 전체 대조하기'));
    await waitFor(() => expect(screen.getByText(/원장 0건/)).toBeInTheDocument());
    view.rerender(<SupportLedgerReview {...props} billingRevision="new" blocked />);
    expect(screen.queryByText(/원장 0건/)).not.toBeInTheDocument();
    expect(screen.getByText('월 전체 대조하기')).toBeDisabled();
});
