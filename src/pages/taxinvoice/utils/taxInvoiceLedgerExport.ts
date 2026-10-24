import ExcelJS from 'exceljs';
import type { TaxAffairsRecord } from '../../tax/components/TransactionTable';

export function buildTaxInvoiceLedgerWorkbook(records: TaxAffairsRecord[]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('세금계산서 거래원장');
    sheet.columns = [
        { header: '거래일', key: 'date', width: 14 }, { header: '구분', key: 'type', width: 10 },
        { header: '거래처', key: 'partnerName', width: 24 }, { header: '현장', key: 'siteName', width: 22 },
        { header: '팀', key: 'teamName', width: 18 }, { header: '내용', key: 'description', width: 35 },
        { header: '공급가액', key: 'supplyAmount', width: 18 }, { header: '세액', key: 'taxAmount', width: 16 },
        { header: '합계', key: 'totalAmount', width: 18 }, { header: '계산서 번호', key: 'invoiceNum', width: 26 },
        { header: '메모', key: 'memo', width: 35 },
    ];
    const sums = { supplyAmount: 0, taxAmount: 0, totalAmount: 0 };
    records.forEach(record => {
        for (const key of Object.keys(sums) as Array<keyof typeof sums>) {
            if (!Number.isFinite(record[key])) throw new Error('금액이 올바르지 않은 행이 있습니다. 원장을 확인해 주세요.');
            sums[key] += record[key];
        }
        sheet.addRow(record);
    });
    sheet.addRow({ partnerName: '합계', ...sums }).font = { bold: true };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    for (const key of Object.keys(sums)) sheet.getColumn(key).numFmt = '#,##0;[Red]-#,##0';
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'K1' };
    return workbook;
}

export async function downloadTaxInvoiceLedger(records: TaxAffairsRecord[], start: string, end: string) {
    const { saveAs } = await import('file-saver');
    const buffer = await buildTaxInvoiceLedgerWorkbook(records).xlsx.writeBuffer();
    const period = `${start}_${end}`.replace(/[^0-9_-]/g, '');
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `세금계산서_거래원장_${period}.xlsx`);
}
