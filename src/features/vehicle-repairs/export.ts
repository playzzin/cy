import { RepairRecord, repairAmounts } from './model';

export function buildRepairCsv(rows: RepairRecord[]): string {
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const data = [['정비일', '차량번호', '배정팀', '정비내용', '운전자', '정비업체', '개인', '법인', 'VAT', '합계', '비고', '확인사항', '원본 시트', '원본 위치'],
    ...rows.map(row => {
      const amounts = repairAmounts(row);
      return [row.date || row.originalDate, row.vehiclePlate, row.teamName, row.description, row.driver, row.vendor,
        amounts.personal, amounts.corporate, amounts.vat, amounts.total, row.memo, row.issues.join(' / '), row.source?.sheet, row.source?.cell];
    })];
  return '\uFEFF' + data.map(row => row.map(escape).join(',')).join('\r\n');
}
