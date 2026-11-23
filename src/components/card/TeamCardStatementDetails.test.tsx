import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeamCardStatementDetails, { selectTeamCardStatementRows } from './TeamCardStatementDetails';
import CardStatementFilesDialog from './CardStatementFilesDialog';
import { cardStatementImportService } from '../../services/cardStatementImportService';
import type { CardStatementFileDetailPayload } from '../../types/cardStatementImport';

jest.mock('../../services/cardStatementImportService', () => ({ cardStatementImportService: { getFileDetail: jest.fn() } }));
jest.mock('../../services/cardStatementAttachmentService', () => ({ getCardStatementFileName: (path: string) => path, cardStatementAttachmentService: {} }));
jest.mock('./CardStatementFilesDialog', () => ({ __esModule: true, default: jest.fn(() => null) }));
const rows = [
    { id: 'meal', date: '2026-11-05', merchant: '가상 식당', category: 'MEAL', amount: 15000, confidence: 1 },
    { id: 'fuel', date: '2026-11-06', merchant: '가상 주유소', category: 'FUEL', amount: 25000, confidence: .7 },
];
const payload = { file: { storagePath: 'source.pdf', sha256: 'same-file', status: 'completed' }, analysisStatus: 'completed', results: [
    { id: 'card-result', matchedCardId: 'card-a', status: 'matched', transactions: rows },
] } as unknown as CardStatementFileDetailPayload;
const props = { yearMonth: '2026-11', cardId: 'card-a', cardLast4: '1234', cardName: '검증카드', paths: ['source.pdf'], transactions: [], dateRanges: [{ startDate: '2026-11-01', endDate: '2026-11-10' }], onClose: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(cardStatementImportService.getFileDetail).mockResolvedValue(payload); });

test('다른 카드·다른 월·배정기간 밖의 상세와 중복 원본은 합계에서 제외한다', () => {
    const other = { ...payload, results: [...payload.results, { ...payload.results[0], id: 'other-card', matchedCardId: 'card-b' },
        { ...payload.results[0], id: 'other-dates', transactions: [{ ...rows[0], id: 'late', date: '2026-11-15' }, { ...rows[0], id: 'old', date: '2026-10-05' }] } as any] };
    const result = selectTeamCardStatementRows([{ path: 'source.pdf', payload: other }, { path: 'copy.pdf', payload: other }], 'card-a', '1234', '2026-11', props.dateRanges);
    expect(result.map(row => row.merchant)).toEqual(['가상 주유소', '가상 식당']);
    expect(result.reduce((sum, row) => sum + row.amount, 0)).toBe(40000);
    const unrelated = { ...payload, results: [{ ...payload.results[0], matchedCardId: 'card-b' }] };
    expect(selectTeamCardStatementRows([{ path: 'other.pdf', payload: unrelated }, { path: 'source.pdf', payload }], 'card-a', '1234', '2026-11', props.dateRanges)).toHaveLength(2);
});

test('저장된 사용내역을 조회하고 검색·분류 및 연결 원본 확인을 지원한다', async () => {
    render(<TeamCardStatementDetails {...props} />);
    expect(await screen.findByText('가상 식당')).toBeVisible();
    expect(screen.getByText('40,000원')).toBeVisible();
    expect(cardStatementImportService.getFileDetail).toHaveBeenCalledWith({ storagePath: 'source.pdf', yearMonth: '2026-11' });
    fireEvent.change(screen.getByLabelText('카드 상세내역 분류'), { target: { value: 'MEAL' } });
    expect(screen.queryByText('가상 주유소')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이 내역의 원본 보기' }));
    const calls = jest.mocked(CardStatementFilesDialog).mock.calls;
    expect(calls[calls.length - 1][0]).toMatchObject({ initialPath: 'source.pdf', paths: ['source.pdf'], showDetailsLink: false });
    expect(screen.queryByRole('button', { name: /분석.*저장/ })).not.toBeInTheDocument();
});

test('저장된 분석이 없으면 배정기간 안의 등록된 거래를 보여주고 취소 거래를 제외한다', async () => {
    jest.mocked(cardStatementImportService.getFileDetail).mockResolvedValueOnce({ ...payload, results: [], analysisStatus: 'not_analyzed' });
    const transaction = { id: 'saved', cardId: 'card-a', cardLabel: '검증카드', date: '2026-11-05', yearMonth: '2026-11', merchant: '등록한 식당', category: 'MEAL' as const, amount: 15000 };
    render(<TeamCardStatementDetails {...props} transactions={[
        transaction,
        { ...transaction, id: 'cancelled', merchant: '취소한 식당', status: 'CANCELLED' },
        { ...transaction, id: 'outside', merchant: '다른 기간 식당', date: '2026-11-15' },
        { ...transaction, id: 'another-card', merchant: '다른 카드 식당', cardId: 'card-b' },
    ]} />);
    expect(await screen.findByText(/저장된 분석이 완료되지 않았습니다/)).toBeVisible();
    expect(screen.getByText('등록한 식당')).toBeVisible();
    expect(screen.getByText('등록된 사용내역 · 1건')).toBeVisible();
    expect(screen.queryByText('취소한 식당')).not.toBeInTheDocument();
    expect(screen.queryByText('다른 기간 식당')).not.toBeInTheDocument();
    expect(screen.queryByText('다른 카드 식당')).not.toBeInTheDocument();
});

test('저장된 상세 조회 오류는 0원 성공으로 표시하지 않고 다시 조회한다', async () => {
    jest.mocked(cardStatementImportService.getFileDetail).mockRejectedValueOnce(new Error('denied'));
    render(<TeamCardStatementDetails {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('조회하지 못했습니다');
    expect(screen.getByText('내역 확인 필요')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    expect(await screen.findByText('가상 식당')).toBeVisible();
});
