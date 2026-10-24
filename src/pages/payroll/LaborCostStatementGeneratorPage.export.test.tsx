import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import LaborCostStatementGeneratorPage from './LaborCostStatementGeneratorPage';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { primaryAccountService, PrimaryAccountSetting } from '../../services/primaryAccountService';

// Validate actual table cells and the serialized workbook together.
/* eslint-disable testing-library/no-node-access */

const mockUser = { getIdTokenResult: async () => ({ claims: { role: 'admin' } }) };
let mockAccountReceiver: (account: PrimaryAccountSetting | null) => void;
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));

jest.mock('../../services/manpowerService', () => ({manpowerService:{getWorkers:jest.fn().mockResolvedValue([])}}));
jest.mock('../../services/siteService', () => ({siteService:{getSites:jest.fn().mockResolvedValue([])}}));
jest.mock('../../services/dailyReportService', () => ({dailyReportService:{getReportsByRange:jest.fn().mockResolvedValue([])}}));
jest.mock('../../services/companyService', () => ({companyService:{getCompanyByName:jest.fn().mockResolvedValue(null)}}));
jest.mock('../../services/primaryAccountService', () => ({
    PRIMARY_ACCOUNT_PAGES: [{ id: 'labor-cost-statement-generator', label: '노무비 지급명세서 생성기', useCommon: true }],
    primaryAccountService: { subscribe: jest.fn(), setPrimaryAccount: jest.fn() },
}));
jest.mock('file-saver', () => ({saveAs:jest.fn()}));
jest.mock('html2canvas', () => jest.fn());

beforeEach(() => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (siteService.getSites as jest.Mock).mockResolvedValue([]);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([]);
    (companyService.getCompanyByName as jest.Mock).mockResolvedValue(null);
    (primaryAccountService.subscribe as jest.Mock).mockImplementation((receive, _fail, scope) => {
        if (scope === 'labor-cost-statement-generator') mockAccountReceiver = receive;
        receive(null);
        return jest.fn();
    });
});

it.each([
    ['2026-02', 28], ['2028-02', 29], ['2026-09', 30], ['2026-10', 31],
] as const)('%s 화면과 엑셀에서 15일 다음 줄에 16일부터 말일까지 보존한다', async (month, lastDay) => {
    jest.clearAllMocks();
    render(<MemoryRouter initialEntries={[`/payroll/labor-cost-statement-generator?month=${month}`]}><LaborCostStatementGeneratorPage /></MemoryRouter>);
    const name = (await screen.findAllByPlaceholderText('이름'))[0];
    fireEvent.change(name, { target: { value: '날짜검증' } });
    const row = name.closest('tr')!;
    const table = row.closest('table')!;
    const headerRows = table.querySelectorAll('thead tr');
    const dateLabels = (element: Element) => Array.from(element.querySelectorAll('th')).map(cell => cell.textContent).filter(text => /^\d{2}$/.test(text || ''));
    expect(dateLabels(headerRows[0])).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0')));
    expect(dateLabels(headerRows[1])).toEqual(Array.from({ length: lastDay - 15 }, (_, i) => String(i + 16).padStart(2, '0')));
    const secondRow = row.nextElementSibling!;
    fireEvent.change(row.children[18].querySelector('input')!, { target: { value: '1.25' } });
    fireEvent.change(secondRow.children[0].querySelector('input')!, { target: { value: '0.5' } });
    fireEvent.change(secondRow.children[lastDay - 16].querySelector('input')!, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '엑셀 저장' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer((saveAs as unknown as jest.Mock).mock.calls[0][0]);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('노무내역서')!;
    const dayColumns = Math.max(15, lastDay - 15);
    const summaryColumn = 5 + dayColumns;
    expect(sheet.getCell(4, 19).text).toMatch(/^15\n/);
    expect(sheet.getCell(5, 5).text).toMatch(/^16\n/);
    expect(sheet.getCell(5, 5 + lastDay - 16).text).toMatch(new RegExp(`^${lastDay}\\n`));
    expect(sheet.getCell(4, summaryColumn).value).toBe('공수');
    expect(sheet.getCell(6, 19).value).toBe(1.25);
    expect(sheet.getCell(7, 5).value).toBe(0.5);
    expect(sheet.getCell(7, 5 + lastDay - 16).value).toBe(2);
    expect(sheet.getCell(6, summaryColumn).result).toBe(3.75);
    expect(sheet.getCell(6, summaryColumn).formula).toBe(`SUM(E6:${lastDay === 31 ? 'T' : 'S'}6,E7:${lastDay === 31 ? 'T' : 'S'}7)`);
    expect(sheet.getCell(sheet.rowCount, 5 + lastDay - 16).result).toBe(2);
    expect(sheet.getCell(sheet.rowCount - 1, summaryColumn).result).toBe(3.75);
    expect(sheet.getCell('T4').text).toBe(lastDay === 31 ? '' : '공수');
    expect(sheet.getCell('T6').value).toEqual(lastDay === 31 ? '' : expect.objectContaining({ result: 3.75 }));
});

it('계좌 관리에서 변경한 페이지 계좌를 위임 행과 실제 엑셀에 반영한다', async () => {
    jest.clearAllMocks();
    render(<MemoryRouter><LaborCostStatementGeneratorPage /></MemoryRouter>);
    const name = (await screen.findAllByPlaceholderText('이름'))[0];
    fireEvent.change(name, { target: { value: '샘플작업자' } });
    // eslint-disable-next-line testing-library/no-node-access
    const row = name.closest('tr')!;
    fireEvent.click(within(row).getByRole('radio', { name: '위임' }));
    act(() => mockAccountReceiver({ sourceType: 'custom', sourceId: '', sourceName: '샘플', bankName: '검증은행', accountHolder: '샘플예금주', accountNumber: 'SAMPLE-PAGE-NEW' }));
    expect(within(row).getByPlaceholderText('계좌번호')).toHaveValue('SAMPLE-PAGE-NEW');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 저장' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const blob = (saveAs as unknown as jest.Mock).mock.calls[0][0] as Blob;
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject; reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    const values = JSON.stringify(workbook.getWorksheet('노무내역서')!.getSheetValues());
    expect(values).toContain('SAMPLE-PAGE-NEW');
    expect(values).toContain('샘플예금주');
});

it.each([false, true])('실제 엑셀 저장에서 날짜 합계 0을 빈칸 표시하고 양수·수식은 유지한다 (두 줄: %s)', async split => {
    jest.clearAllMocks();
    render(<MemoryRouter initialEntries={['/payroll/labor-cost-statement-generator?month=2026-08']}><LaborCostStatementGeneratorPage /></MemoryRouter>);
    const name = (await screen.findAllByPlaceholderText('이름'))[0];
    fireEvent.change(name,{target:{value:'검증작업자'}});
    const splitInput = screen.getByLabelText(/2줄 보기/) as HTMLInputElement;
    if (splitInput.checked !== split) fireEvent.click(splitInput);
    // The exported day column follows the four identity columns in this sheet.
    // eslint-disable-next-line testing-library/no-node-access
    const row = name.closest('tr')!;
    // eslint-disable-next-line testing-library/no-node-access
    const firstDay = row.children[4].querySelector('input')!;
    fireEvent.change(firstDay,{target:{value:'1.25'}});
    fireEvent.click(screen.getByRole('button',{name:'엑셀 저장'}));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const blob = (saveAs as unknown as jest.Mock).mock.calls[0][0] as Blob;
    const bytes = await new Promise<ArrayBuffer>((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('노무내역서')!;
    const footer = sheet.getRow(sheet.rowCount - (split ? 1 : 0));
    const first = footer.getCell(5);
    const zero = footer.getCell(6);
    expect(first.result).toBe(1.25);
    expect(zero.result).toBe(0);
    expect(zero.formula).toContain('SUM');
    expect(first.numFmt.split(';')[2]).toBe('');
    expect(zero.numFmt.split(';')[2]).toBe('');
    expect(sheet.getRow(sheet.rowCount).getCell(5).numFmt.split(';')[2]).toBe('');
});
