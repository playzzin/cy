import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import LaborCostStatementGeneratorPage from './LaborCostStatementGeneratorPage';
import { manpowerService, Worker } from '../../services/manpowerService';

jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanyByName: async () => null } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: async () => [{
    date: '2026-10-01', siteId: 'test-site', siteName: '가상현장',
    workers: mockWorkers.map(worker => ({ workerId: worker.id, name: worker.name, manDay: 1, unitPrice: 100000 }))
}] } }));
jest.mock('../../components/accounts/PagePrimaryAccountCard', () => () => null);
jest.mock('../../hooks/usePagePrimaryAccount', () => ({
    usePagePrimaryAccount: () => ({ account: { bankName: '위임은행', accountHolder: '가상회사', accountNumber: 'TEST-DELEGATE' }, loading: false }),
    ensurePagePrimaryAccountReady: () => mockAccountReady,
}));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());

let mockAccountReady = true;
const mockWorkers: Worker[] = ['가상작업자A', '가상작업자B'].map((name, index) => ({
    id: `test-worker-${index}`, name, laborStatementPayType: index === 0 ? 'direct' : 'delegate',
    bankName: '기본은행', accountHolder: name + '예금주', accountNumber: `TEST-BASIC-${index}`,
    directPayBankName: '직불은행', directPayAccountHolder: name + '직불예금주', directPayAccountNumber: `TEST-DIRECT-${index}`,
}));
const bulkCheckbox = () => within(screen.getByRole('group', { name: '보기 설정' })).getByRole('checkbox', { name: '전체 위임' });
const openStatement = async (fill = true) => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/?month=2026-10']}><LaborCostStatementGeneratorPage /></MemoryRouter>);
    await screen.findByRole('option', { name: /가상작업자A/ });
    if (fill) {
        fireEvent.click(screen.getByRole('button', { name: '자동채우기' }));
        await screen.findByDisplayValue('가상작업자A');
        await waitFor(() => expect(bulkCheckbox()).toBeEnabled());
    }
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('payroll-labor-statement-defaults', JSON.stringify({ useWorkerMasterPayType: false }));
    mockAccountReady = true;
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(mockWorkers);
});

it('이름이 있는 모든 행에 위임계좌를 적용하고 빈 행·공수·금액은 보존하며 엑셀에도 반영한다', async () => {
    await openStatement();
    fireEvent.click(screen.getAllByRole('radio', { name: '직불' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: '위임' })[1]);
    fireEvent.change(screen.getAllByPlaceholderText('이름')[2], { target: { value: '가상수기작업자' } });
    fireEvent.change(screen.getAllByPlaceholderText('이름')[3], { target: { value: '   ' } });
    expect(bulkCheckbox()).not.toBeChecked();
    expect(screen.queryByRole('button', { name: '전체 위임' })).not.toBeInTheDocument();
    expect(screen.queryByText('지급구분 일괄 변경')).not.toBeInTheDocument();
    fireEvent.click(bulkCheckbox());
    expect(bulkCheckbox()).toBeChecked();
    expect(screen.getAllByDisplayValue('TEST-DELEGATE')).toHaveLength(3);
    expect(screen.getAllByRole('radio', { name: '위임' }).filter(radio => (radio as HTMLInputElement).checked)).toHaveLength(3);
    expect(screen.getAllByRole('radio', { name: '기본' })[3]).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '엑셀 저장' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject; reader.readAsArrayBuffer((saveAs as unknown as jest.Mock).mock.calls[0][0]);
    });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    const rows = workbook.worksheets[0].getSheetValues() as unknown[][];
    for (const name of ['가상작업자A', '가상작업자B', '가상수기작업자']) {
        const row = rows.find(values => values?.includes(name));
        expect(row).toBeDefined();
        expect(row).toContain('TEST-DELEGATE');
        expect(JSON.stringify(row)).toContain('위임');
    }
    for (const worker of mockWorkers) {
        const row = rows.find(values => values?.includes(worker.name));
        expect(row).toContain(1);
        expect(row).toContain(100000);
    }
    expect(JSON.stringify(rows)).not.toContain('TEST-BASIC');
    expect(JSON.stringify(rows)).not.toContain('TEST-DIRECT');
});

it('전체 위임 체크를 해제하면 수정한 직불계좌와 기본계좌를 복원한다', async () => {
    await openStatement();
    fireEvent.click(screen.getAllByRole('radio', { name: '직불' })[0]);
    fireEvent.change(screen.getByDisplayValue('TEST-DIRECT-0'), { target: { value: 'TEST-EDITED-DIRECT' } });
    fireEvent.click(bulkCheckbox());
    expect(bulkCheckbox()).toBeChecked();
    fireEvent.click(bulkCheckbox());
    expect(screen.getAllByRole('radio', { name: '직불' })[0]).toBeChecked();
    expect(screen.getByDisplayValue('TEST-EDITED-DIRECT')).toBeVisible();
    expect(screen.getAllByRole('radio', { name: '기본' })[1]).toBeChecked();
    expect(screen.getByDisplayValue('TEST-BASIC-1')).toBeVisible();
    expect(bulkCheckbox()).not.toBeChecked();
});

it('계좌 열이 숨겨져 있어도 전체 위임을 사용할 수 있고 적용 결과를 표시한다', async () => {
    await openStatement();
    fireEvent.click(screen.getByRole('checkbox', { name: '계좌/지급구분' }));
    expect(screen.queryByRole('radio', { name: '위임' })).not.toBeInTheDocument();
    fireEvent.click(bulkCheckbox());
    expect(screen.getByRole('checkbox', { name: '계좌/지급구분' })).toBeChecked();
    expect(screen.getAllByDisplayValue('TEST-DELEGATE')).toHaveLength(2);
});

it('빈 명세서는 일괄 변경할 수 없고 대표계좌 조회 실패 시 기존 지급구분을 보존한다', async () => {
    await openStatement(false);
    expect(bulkCheckbox()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '자동채우기' }));
    await screen.findByDisplayValue('가상작업자A');
    mockAccountReady = false;
    fireEvent.click(bulkCheckbox());
    expect(screen.getByDisplayValue('TEST-BASIC-0')).toBeVisible();
    expect(bulkCheckbox()).not.toBeChecked();
});

it('DB 직불여부 조회 중에는 일괄 변경을 막고 조회 완료 후에는 전체 위임을 우선 적용한다', async () => {
    await openStatement();
    let finishRefresh!: (workers: Worker[]) => void;
    (manpowerService.getWorkers as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finishRefresh = resolve; }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' }));
    expect(bulkCheckbox()).toBeDisabled();
    await act(async () => finishRefresh(mockWorkers));
    expect(bulkCheckbox()).toBeEnabled();
    fireEvent.click(bulkCheckbox());
    expect(screen.getAllByDisplayValue('TEST-DELEGATE')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).toBeChecked();
});


it('체크 해제는 기존 개별 위임을 유지하고 일괄 적용 후 수정한 단가를 보존한다', async () => {
    await openStatement();
    fireEvent.click(screen.getAllByRole('radio', { name: '위임' })[1]);
    fireEvent.click(bulkCheckbox());
    fireEvent.change(screen.getAllByDisplayValue('100,000')[0], { target: { value: '130000' } });
    fireEvent.click(bulkCheckbox());
    expect(screen.getAllByRole('radio', { name: '기본' })[0]).toBeChecked();
    expect(screen.getAllByRole('radio', { name: '위임' })[1]).toBeChecked();
    expect(screen.getByDisplayValue('130,000')).toBeVisible();
    expect(bulkCheckbox()).not.toBeChecked();
});

it('자동채우기 후 전체 위임 해제 시 이전 명세서의 지급구분을 복원하지 않는다', async () => {
    await openStatement();
    fireEvent.click(screen.getAllByRole('radio', { name: '직불' })[0]);
    fireEvent.click(bulkCheckbox());
    fireEvent.click(screen.getByRole('button', { name: '자동채우기' }));
    await screen.findByDisplayValue('TEST-BASIC-0');
    fireEvent.click(screen.getAllByRole('radio', { name: '위임' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: '위임' })[1]);
    expect(bulkCheckbox()).toBeChecked();
    fireEvent.click(bulkCheckbox());
    expect(screen.getByDisplayValue('TEST-BASIC-0')).toBeVisible();
    expect(screen.getByDisplayValue('TEST-BASIC-1')).toBeVisible();
    expect(bulkCheckbox()).not.toBeChecked();
});
