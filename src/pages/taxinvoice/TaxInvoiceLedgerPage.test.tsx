import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaxInvoiceLedgerPage from './TaxInvoiceLedgerPage';
import { taxLedgerService } from '../../services/taxLedgerService';
import { downloadTaxInvoiceLedger } from './utils/taxInvoiceLedgerExport';
import type { TaxAffairsRecord } from '../tax/components/TransactionTable';

jest.mock('../../services/taxLedgerService', () => ({ taxLedgerService: { fetchRecords: jest.fn(), updateField: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/receivableService', () => ({ receivableService: {} }));
jest.mock('./utils/taxInvoiceLedgerExport', () => ({ downloadTaxInvoiceLedger: jest.fn().mockResolvedValue(undefined) }));
jest.mock('sweetalert2', () => ({ fire: jest.fn().mockResolvedValue({}) }));

const row = (id: string, partnerName: string): TaxAffairsRecord => ({ id, partnerName, date: '2026-09-01', type: '매출', description: '합성 거래', supplyAmount: 100, taxAmount: 10, totalAmount: 110 });
const mount = () => render(<MemoryRouter initialEntries={[{ pathname: '/', state: { startDate: '2026-09-01', endDate: '2026-09-30' } }]}><TaxInvoiceLedgerPage /></MemoryRouter>);
beforeEach(() => jest.clearAllMocks());

test('검색된 조회 결과만 다운로드한다', async () => {
    const keep = row('a', '검증거래처');
    (taxLedgerService.fetchRecords as jest.Mock).mockResolvedValue([keep, row('b', '다른거래처')]);
    mount();
    await screen.findByText('검증거래처');
    fireEvent.change(screen.getByPlaceholderText(/검색/), { target: { value: '검증거래처' } });
    fireEvent.click(screen.getByRole('button', { name: '조회 결과 Excel 다운로드' }));
    await waitFor(() => expect(downloadTaxInvoiceLedger).toHaveBeenCalledWith([keep], '2026-09-01', '2026-09-30'));
});

test('늦게 도착한 이전 기간 응답을 무시하고 조회 실패 시 다운로드를 막는다', async () => {
    let resolveOld!: (rows: TaxAffairsRecord[]) => void;
    (taxLedgerService.fetchRecords as jest.Mock).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
        .mockResolvedValueOnce([row('new', '새기간거래')]).mockRejectedValueOnce(new Error('synthetic failure'));
    mount();
    fireEvent.change(screen.getByLabelText('조회 시작일'), { target: { value: '2026-08-01' } });
    await screen.findByText('새기간거래');
    await act(async () => resolveOld([row('old', '이전기간거래')]));
    expect(screen.queryByText('이전기간거래')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('조회 시작일'), { target: { value: '2026-07-01' } });
    await waitFor(() => expect(screen.queryByText('새기간거래')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '조회 결과 Excel 다운로드' })).toBeDisabled();
});
