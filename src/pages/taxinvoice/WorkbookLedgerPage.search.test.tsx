import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';

const mockGetEntries = jest.fn();
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn() } }));
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'search-test' } }) }));
jest.mock('../../services/companyService', () => ({ companyService: { getActiveCompanies: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/accountDirectoryService', () => ({ accountDirectoryService: { getEntriesByCategory: async () => [] } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/quarterVatPaymentService', () => ({ createQuarterVatPaymentService: () => ({ getPayments: async () => [] }) }));
jest.mock('../../services/taxInvoiceBulkImportService', () => ({ createTaxInvoiceDuplicateFingerprint: () => '' }));
jest.mock('./components/TaxInvoiceBulkImportModal', () => () => null);
jest.mock('../../components/common/AppIntroScreen', () => () => <div>조회 중</div>);
jest.mock('../../services/workbookLedgerService', () => {
    const service = { getEntries: (...args: unknown[]) => mockGetEntries(...args) };
    return { ...jest.requireActual('../../services/workbookLedgerService'), createWorkbookLedgerService: () => service };
});

const { default: WorkbookLedgerPage } = require('./WorkbookLedgerPage') as typeof import('./WorkbookLedgerPage');
const makeInvoice = (id: string, partnerName: string, siteName: string, teamName: string): WorkbookLedgerEntry => ({
    id, partnerName, siteName, teamName, transactionType: '매출', date: '2026-09-01', description: id,
    supplyAmount: 100000, taxAmount: 10000, totalAmount: 110000, paymentAmount: 0,
});
const entries = [
    makeInvoice('a-gwangmyeong', '테스트건설 A', '광명 현장', '검증 1팀'),
    makeInvoice('a-seoul', '테스트건설 A', '서울 현장', '검증 2팀'),
    makeInvoice('b-gwangmyeong', '테스트건설 B', '광명 현장', '검증 1팀'),
    makeInvoice('a-gwangmyeong-team2', '테스트건설 A', '광명 현장', '검증 2팀'),
];

const setSearch = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: '조회' }));
const resultCells = (value: string) => within(screen.getByRole('table')).queryAllByRole('cell', { name: value });

describe.each(['ledger', 'summary'] as const)('%s combined search', (tab) => {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.sessionStorage.setItem('workbook-ledger:cheongyeon:active-tab', tab);
        mockGetEntries.mockReset().mockResolvedValue(entries);
    });

    const mount = async () => {
        render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WorkbookLedgerPage /></MemoryRouter>);
        setSearch('검색시작일', '2026-09-01');
        setSearch('검색종료일', '2026-09-30');
        submit();
        await waitFor(() => expect(resultCells('광명 현장')).toHaveLength(3));
    };

    it('keeps the partner when narrowing, changing, and clearing the site', async () => {
        await mount();
        setSearch('거래처 검색', '테스트건설 A');
        submit();
        expect(resultCells('테스트건설 A')).toHaveLength(3);
        expect(resultCells('테스트건설 B')).toHaveLength(0);

        setSearch('현장명 검색', '광명');
        submit();
        expect(resultCells('광명 현장')).toHaveLength(2);
        expect(resultCells('서울 현장')).toHaveLength(0);
        expect(resultCells('테스트건설 B')).toHaveLength(0);

        setSearch('현장명 검색', '서울');
        fireEvent.keyDown(screen.getByRole('textbox', { name: '현장명 검색' }), { key: 'Enter' });
        expect(screen.getByRole('textbox', { name: '거래처 검색' })).toHaveValue('테스트건설 A');
        expect(resultCells('서울 현장')).toHaveLength(1);
        expect(resultCells('광명 현장')).toHaveLength(0);

        setSearch('현장명 검색', '');
        submit();
        expect(resultCells('테스트건설 A')).toHaveLength(3);
        expect(resultCells('테스트건설 B')).toHaveLength(0);
    });

    it('combines all three fields and permits a site-only search', async () => {
        await mount();
        setSearch('거래처 검색', '테스트건설 A');
        setSearch('현장명 검색', '광명');
        setSearch('팀명 검색', '검증 2팀');
        fireEvent.keyDown(screen.getByRole('textbox', { name: '팀명 검색' }), { key: 'Enter' });
        expect(resultCells('테스트건설 A')).toHaveLength(1);
        expect(resultCells('검증 2팀')).toHaveLength(1);
        expect(resultCells('테스트건설 B')).toHaveLength(0);

        setSearch('거래처 검색', '');
        setSearch('팀명 검색', '');
        submit();
        expect(resultCells('광명 현장')).toHaveLength(3);
        expect(resultCells('테스트건설 B')).toHaveLength(1);
        expect(resultCells('서울 현장')).toHaveLength(0);
    });

    it('preserves combined filters in monthly searches and when moving between months', async () => {
        await mount();
        setSearch('거래처 검색', '테스트건설 A');
        setSearch('현장명 검색', '광명');
        fireEvent.click(screen.getByRole('tab', { name: '월별' }));
        fireEvent.change(screen.getByLabelText(tab === 'ledger' ? '거래장 조회월' : '전체조회 조회월'), { target: { value: '2026-09' } });
        submit();
        await waitFor(() => expect(resultCells('광명 현장')).toHaveLength(2));
        expect(resultCells('테스트건설 B')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: '다음 달 조회' }));
        await waitFor(() => expect(resultCells('광명 현장')).toHaveLength(0));
        expect(screen.getByRole('textbox', { name: '거래처 검색' })).toHaveValue('테스트건설 A');
        expect(screen.getByRole('textbox', { name: '현장명 검색' })).toHaveValue('광명');
        fireEvent.click(screen.getByRole('button', { name: '이전 달 조회' }));
        await waitFor(() => expect(resultCells('광명 현장')).toHaveLength(2));
    });

    it('does not submit incomplete Korean composition and shows no rows for an unmatched combination', async () => {
        await mount();
        setSearch('거래처 검색', '테스트건설 B');
        setSearch('현장명 검색', '서울');
        fireEvent.keyDown(screen.getByRole('textbox', { name: '현장명 검색' }), { key: 'Enter', isComposing: true });
        expect(resultCells('광명 현장')).toHaveLength(3);
        fireEvent.keyDown(screen.getByRole('textbox', { name: '현장명 검색' }), { key: 'Enter' });
        expect(resultCells('테스트건설 A')).toHaveLength(0);
        expect(resultCells('테스트건설 B')).toHaveLength(0);
        expect(screen.getByText('조회 결과가 없습니다.')).toBeInTheDocument();
    });
});

describe.each(['cheongyeon', 'dawon'] as const)('%s ledger transaction type switch', (tenantKey) => {
    const purchaseEntries = entries.map((entry) => ({
        ...entry,
        id: `purchase-${entry.id}`,
        description: `purchase-${entry.id}`,
        transactionType: '매입' as const,
        supplyAmount: 200000,
        taxAmount: 20000,
        totalAmount: 220000,
    }));
    const paymentEntries = [entries[0], purchaseEntries[0]].map((entry) => ({
        ...entry,
        id: `payment-${entry.id}`,
        description: `payment-${entry.id}`,
        date: '2026-09-02',
        supplyAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        paymentAmount: entry.transactionType === '매출' ? 20000 : 40000,
        matchedEntryId: entry.id,
    }));

    beforeEach(() => {
        window.sessionStorage.clear();
        window.sessionStorage.setItem(`workbook-ledger:${tenantKey}:active-tab`, 'ledger');
        mockGetEntries.mockReset().mockImplementation(async (options) => (
            [...entries, ...purchaseEntries, ...paymentEntries].filter((entry) => (
                entry.transactionType === options.transactionType
                && entry.date >= options.startDate
                && entry.date <= options.endDate
            ))
        ));
    });

    it.each(['기간별', '월별'])('immediately switches rows, amounts, and query type while preserving %s filters', async (dateMode) => {
        render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <WorkbookLedgerPage tenantKey={tenantKey} />
        </MemoryRouter>);
        setSearch('검색시작일', '2026-09-01');
        setSearch('검색종료일', '2026-09-30');
        setSearch('거래처 검색', '테스트건설 A');
        setSearch('현장명 검색', '광명');
        setSearch('팀명 검색', '검증 1팀');
        if (dateMode === '월별') {
            fireEvent.click(screen.getByRole('tab', { name: '월별' }));
            setSearch('거래장 조회월', '2026-09');
        }
        submit();
        await waitFor(() => expect(resultCells('a-gwangmyeong')).toHaveLength(1));

        // Unsubmitted text remains a draft; switching type preserves the displayed search.
        setSearch('현장명 검색', '서울');
        const typeButtons = within(screen.getByRole('group', { name: '조회 구분' }));
        for (const transactionType of ['매입', '매출'] as const) {
            mockGetEntries.mockClear();
            fireEvent.click(typeButtons.getByRole('button', { name: transactionType }));
            await waitFor(() => expect(mockGetEntries).toHaveBeenLastCalledWith(expect.objectContaining({
                startDate: '2026-09-01', endDate: '2026-09-30', transactionType,
            })));

            const isPurchase = transactionType === '매입';
            const description = isPurchase ? 'purchase-a-gwangmyeong' : 'a-gwangmyeong';
            await waitFor(() => expect(resultCells(description)).toHaveLength(1));
            expect(resultCells(isPurchase ? 'a-gwangmyeong' : 'purchase-a-gwangmyeong')).toHaveLength(0);
            expect(resultCells('광명 현장')).toHaveLength(2);
            expect(resultCells('서울 현장')).toHaveLength(0);
            expect(resultCells('테스트건설 B')).toHaveLength(0);
            expect(resultCells('검증 2팀')).toHaveLength(0);
            expect(screen.getByRole('columnheader', { name: `${transactionType}금액` })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: isPurchase ? '지급금액' : '입금금액' })).toBeInTheDocument();
            const totals = within(screen.getByRole('row', { name: /합계/ }));
            expect(totals.getByRole('cell', { name: isPurchase ? '220,000' : '110,000' })).toBeInTheDocument();
            expect(totals.getByRole('cell', { name: isPurchase ? '40,000' : '20,000' })).toBeInTheDocument();
            expect(totals.getByRole('cell', { name: isPurchase ? '180,000' : '90,000' })).toBeInTheDocument();
            expect(typeButtons.getByRole('button', { name: transactionType })).toHaveAttribute('aria-pressed', 'true');
            expect(typeButtons.getByRole('button', { name: isPurchase ? '매출' : '매입' })).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByLabelText('거래처 검색')).toHaveValue('테스트건설 A');
            expect(screen.getByLabelText('현장명 검색')).toHaveValue('서울');
            expect(screen.getByLabelText('팀명 검색')).toHaveValue('검증 1팀');
        }
    });
});
