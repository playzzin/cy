import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import type { PaymentData } from '../types/payroll';
import {
    appendPayslipWorkbooksToZip,
    buildPayslipWorkbook,
} from './payslipWorkbook';

const paymentData: PaymentData = {
    id: '2026-07__worker-1__월급제',
    workerId: 'worker-1',
    workerName: '홍길동',
    idNumber: '900101-1234567',
    teamId: 'team-1',
    teamName: '테스트팀',
    companyId: 'company-1',
    companyName: '기존 시공사',
    month: '2026-07',
    unitPrice: 200000,
    totalManDay: 2.5,
    grossAmount: 500000,
    totalDeduction: 80000,
    totalAmount: 420000,
    invoiceManDay: 0,
    invoiceGrossAmount: 0,
    invoiceNetAmount: 0,
    laborManDay: 2.5,
    laborGrossAmount: 500000,
    laborNetAmount: 420000,
    workEntries: [
        { date: '2026-07-01', siteName: '서울 현장', paymentMethod: '노무', manDay: 1, unitPrice: 200000, amount: 200000 },
        { date: '2026-07-02', siteName: '인천 현장', paymentMethod: '노무', manDay: 1.5, unitPrice: 200000, amount: 300000 },
    ],
    deductionBreakdown: {
        standardLines: [{ label: '가불', amount: 50000 }],
        additionalLines: [],
        total: 50000,
        hasData: true,
    },
    taxBreakdown: {
        standardLines: [{ label: '[세금] 소득세', amount: 30000 }],
        additionalLines: [],
        total: 30000,
        hasData: true,
    },
    taxRateSnapshot: {
        pensionRate: 0,
        healthRate: 0,
        longtermRate: 0,
        employmentRate: 0,
        incomeTaxRate: 0,
        residentTaxRate: 0,
    },
    displayContent: '',
    bankCode: '011',
    bankName: '농협',
    accountNumber: '1234567890',
    accountHolder: '홍길동',
    isValid: true,
    errors: {},
};

describe('buildPayslipWorkbook', () => {
    it('미리보기형 A:H 인쇄영역과 계산식을 포함한 엑셀을 만든다', () => {
        const result = buildPayslipWorkbook(paymentData, '(주)청연이엔지');
        const sheet = result.workbook.Sheets[result.sheetName];
        const { workSummaryRow, footerValueRow, lastRow } = result.layout;

        expect(sheet.A1.v).toBe('2026-07 노임명세서');
        expect(sheet.A1.s.fill.fgColor.rgb).toBe('6D28D9');
        expect(sheet[`F${workSummaryRow + 1}`].f).toContain('SUM(F');
        expect(sheet[`E${footerValueRow + 1}`].f).toBe(`F${workSummaryRow + 1}+H${workSummaryRow + 1}`);
        expect(sheet[`E${footerValueRow + 1}`].s.fill.fgColor.rgb).toBe('D1FAE5');
        expect(result.printArea).toBe(`A1:H${lastRow + 1}`);
        expect((sheet as any)['!pageSetup']).toMatchObject({ orientation: 'landscape', fitToWidth: 1 });
        expect((result.workbook as any).Workbook.Names[0].Ref).toContain(`$A$1:$H$${lastRow + 1}`);

        const bytes = XLSX.write(result.workbook, { type: 'array', bookType: 'xlsx', cellStyles: true });
        expect(bytes.byteLength).toBeGreaterThan(1000);

        const roundTrip = XLSX.read(bytes, { type: 'array', cellStyles: true });
        const roundTripSheet = roundTrip.Sheets[result.sheetName];
        expect(roundTripSheet.A1.v).toBe('2026-07 노임명세서');
        expect((roundTrip as any).Workbook.Names[0].Ref).toContain(`$A$1:$H$${lastRow + 1}`);
        expect(roundTripSheet[`A${result.layout.detailStartRow + 6}`]?.v).toBe('');
    });

    it('일괄 다운로드 ZIP에 작업자별 개별 Excel 파일을 넣는다', async () => {
        const zip = new JSZip();
        const secondWorker = {
            ...paymentData,
            id: '2026-07__worker-2__월급제',
            workerId: 'worker-2',
            workerName: '김철수',
        };
        const { fileNames } = appendPayslipWorkbooksToZip(
            zip,
            [paymentData, secondWorker],
            '(주)청연이엔지'
        );

        expect(fileNames).toEqual([
            '노임명세서_홍길동_2026-07.xlsx',
            '노임명세서_김철수_2026-07.xlsx',
        ]);

        const archiveBytes = await zip.generateAsync({ type: 'uint8array' });
        const archive = await JSZip.loadAsync(archiveBytes);
        expect(Object.keys(archive.files).sort()).toEqual([...fileNames].sort());

        const firstWorkbookBytes = await archive.file(fileNames[0])!.async('uint8array');
        const firstWorkbook = XLSX.read(firstWorkbookBytes, { type: 'array', cellStyles: true });
        expect(firstWorkbook.Sheets['노임명세서'].A1.v).toBe('2026-07 노임명세서');
    });
});
