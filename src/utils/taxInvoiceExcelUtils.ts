import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { TaxInvoiceIssue, STATUS_CONFIG } from '../types/taxInvoiceList';

export const exportIssuesToExcel = async (issues: TaxInvoiceIssue[], yearMonth: string) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('발행리스트');

    // 컬럼 정의
    worksheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: '신규', key: 'isNew', width: 8 },
        { header: '발행일', key: 'issueDate', width: 15 },
        { header: '공급받는자', key: 'recipient', width: 25 },
        { header: '품목', key: 'item', width: 25 },
        { header: '공급가', key: 'supplyAmount', width: 15 },
        { header: '비고', key: 'note', width: 20 },
        { header: '공수', key: 'manDays', width: 10 },
        { header: '팀', key: 'teamName', width: 15 },
        { header: '현장구분', key: 'siteType', width: 12 },
        { header: '결제구분', key: 'paymentType', width: 12 },
        { header: '발행상태', key: 'issueStatus', width: 12 },
        { header: '특이사항', key: 'remark', width: 30 },
    ];

    // 헤더 스타일링
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' } // slate-200
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // 테두리 설정
    headerRow.eachCell(cell => {
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // 데이터 추가
    issues.forEach(issue => {
        const row = worksheet.addRow({
            no: issue.no,
            isNew: typeof issue.isNew === 'boolean' ? (issue.isNew ? '입력' : '') : issue.isNew,
            issueDate: issue.issueDate,
            recipient: issue.recipient,
            item: issue.item,
            supplyAmount: issue.supplyAmount,
            note: issue.note,
            manDays: issue.manDays,
            teamName: issue.teamName || '',
            siteType: issue.siteType || '',
            paymentType: issue.paymentType || '',
            issueStatus: STATUS_CONFIG[issue.issueStatus]?.label || issue.issueStatus,
            remark: issue.remark || '',
        });

        // 숫자 포맷 및 스타일
        const supplyAmountCell = row.getCell('supplyAmount');
        supplyAmountCell.numFmt = '#,##0';
        if (issue.supplyAmount < 0) {
            supplyAmountCell.font = { color: { argb: 'FFFF0000' } };
        }

        const manDaysCell = row.getCell('manDays');
        manDaysCell.numFmt = '0.0';

        // 모든 셀 테두리 및 정렬
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            
            // 중앙 정렬이 필요한 컬럼들
            if ([1, 2, 3, 9, 10, 11, 12].includes(colNumber)) {
                cell.alignment = { horizontal: 'center' };
            }
        });
    });

    // 파일 생성 및 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `발행리스트_${yearMonth}.xlsx`);
};
