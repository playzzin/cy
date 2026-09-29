import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';

const mockGetEntries = jest.fn();
const mockAddEntries = jest.fn();
const mockFire = jest.fn();
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-user' } }) }));
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: (...args: unknown[]) => mockFire(...args) } }));
jest.mock('../../services/companyService', () => ({ companyService: { getActiveCompanies: async () => [{ name: '검증 거래처' }] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [{ name: '검증 현장' }] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [{ name: '검증 팀' }] } }));
jest.mock('../../services/accountDirectoryService', () => ({ accountDirectoryService: { getEntriesByCategory: async () => [] } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/quarterVatPaymentService', () => ({ createQuarterVatPaymentService: () => ({ getPayments: async () => [] }) }));
jest.mock('../../services/taxInvoiceBulkImportService', () => ({ createTaxInvoiceDuplicateFingerprint: () => '' }));
jest.mock('./components/TaxInvoiceBulkImportModal', () => () => null);
jest.mock('../../components/common/AppIntroScreen', () => () => <div>조회 중</div>);
jest.mock('../../services/workbookLedgerService', () => {
    const actual = jest.requireActual('../../services/workbookLedgerService');
    const service = {
        getEntries: (...args: unknown[]) => mockGetEntries(...args),
        addEntries: (...args: unknown[]) => mockAddEntries(...args),
        invalidateCache: () => undefined,
        createEntryId: () => 'generated-test-id',
    };
    return { ...actual, createWorkbookLedgerService: () => service };
});
jest.mock('./components/WorkbookInputHotTable', () => {
    const React = jest.requireActual('react');
    function MockWorkbookInputHotTable(props: any) {
        React.useImperativeHandle(props.hotRef, () => ({ hotInstance: {
            getSourceData: () => props.data,
            setSourceDataAtCell: (row: number, field: string, value: unknown) => { props.data[row][field] = value; },
            loadData: () => undefined,
        } }));
        return <div data-testid="input-grid" data-readonly={String(props.readOnly)}>
            <span>{props.columns[2].source.join(',')}</span>
            <button onClick={() => {
                Object.assign(props.data[0], { transactionType: '매출', date: '2026-09-01', partnerName: '검증 거래처', supplyAmount: 100000 });
                props.afterChange([[0, 'supplyAmount', null, 100000]], 'edit');
            }}>검증용 입력 채우기</button>
        </div>;
    }
    return { __esModule: true, default: MockWorkbookInputHotTable };
});

const { default: WorkbookLedgerPage } = require('./WorkbookLedgerPage') as typeof import('./WorkbookLedgerPage');
const { WorkbookLedgerBatchError } = require('../../services/workbookLedgerService') as typeof import('../../services/workbookLedgerService');
const invoice: WorkbookLedgerEntry = { id: 'invoice', transactionType: '매출', date: '2026-09-01', partnerName: '검증 거래처', siteName: '', description: '', supplyAmount: 100000, taxAmount: 10000, totalAmount: 110000, paymentAmount: 0 };
const mount = () => render(<MemoryRouter><WorkbookLedgerPage /></MemoryRouter>);

describe('workbook loading and retry safety', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        mockGetEntries.mockReset().mockResolvedValue([]);
        mockAddEntries.mockReset().mockResolvedValue([]);
        mockFire.mockReset().mockResolvedValue({ isConfirmed: true });
    });

    it('fills autocomplete catalogs on the initial input tab without loading ledger entries', async () => {
        mount();
        expect(await screen.findByText('검증 거래처')).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByRole('option', { hidden: true }).some(option => option.getAttribute('value') === '검증 팀')).toBe(true));
        expect(mockGetEntries).not.toHaveBeenCalled();
    });

    it('clears an unverified preview and blocks exports after verification failure, then permits retry', async () => {
        window.sessionStorage.setItem('workbook-ledger:cheongyeon:active-tab', 'summary');
        mockGetEntries.mockImplementation(async (options) => {
            if (options.startDate) return [invoice];
            throw new Error('synthetic verification failure');
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('조회 결과를 사용할 수 없습니다');
        expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '화면 복사' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '인쇄' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: /^입금$/ })).not.toBeInTheDocument();
        mockGetEntries.mockResolvedValue([invoice]);
        fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        await waitFor(() => expect(screen.getByRole('button', { name: '인쇄' })).toBeEnabled());
        errorSpy.mockRestore();
    });

    it('locks editing after a partial save and retries only the pending payload with its existing ID', async () => {
        const pending = [{ ...invoice, id: 'stable-pending-id' }];
        mockAddEntries.mockRejectedValueOnce(new WorkbookLedgerBatchError([invoice], pending)).mockResolvedValueOnce(pending);
        mount();
        fireEvent.click(await screen.findByRole('button', { name: '검증용 입력 채우기' }));
        fireEvent.click(screen.getByRole('button', { name: /^DB 등록$/ }));
        const retry = await screen.findByRole('button', { name: '남은 1건 재시도' });
        expect(screen.getByTestId('input-grid')).toHaveAttribute('data-readonly', 'true');
        fireEvent.click(retry);
        await waitFor(() => expect(mockAddEntries).toHaveBeenCalledTimes(2));
        expect(mockAddEntries.mock.calls[1][0]).toEqual(pending);
        await waitFor(() => expect(screen.getByTestId('input-grid')).toHaveAttribute('data-readonly', 'false'));
    });
});
