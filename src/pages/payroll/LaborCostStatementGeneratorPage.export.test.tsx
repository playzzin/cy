import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import LaborCostStatementGeneratorPage from './LaborCostStatementGeneratorPage';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { primaryAccountService } from '../../services/primaryAccountService';

jest.mock('../../services/manpowerService', () => ({manpowerService:{getWorkers:jest.fn().mockResolvedValue([])}}));
jest.mock('../../services/siteService', () => ({siteService:{getSites:jest.fn().mockResolvedValue([])}}));
jest.mock('../../services/dailyReportService', () => ({dailyReportService:{getReportsByRange:jest.fn().mockResolvedValue([])}}));
jest.mock('../../services/companyService', () => ({companyService:{getCompanyByName:jest.fn().mockResolvedValue(null)}}));
jest.mock('../../services/primaryAccountService', () => ({primaryAccountService:{getPrimaryAccount:jest.fn().mockResolvedValue(null)}}));
jest.mock('file-saver', () => ({saveAs:jest.fn()}));
jest.mock('html2canvas', () => jest.fn());

beforeEach(() => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (siteService.getSites as jest.Mock).mockResolvedValue([]);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([]);
    (companyService.getCompanyByName as jest.Mock).mockResolvedValue(null);
    (primaryAccountService.getPrimaryAccount as jest.Mock).mockResolvedValue(null);
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
