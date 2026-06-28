export interface RecruitingExcelSheet {
  name: string;
  rows: Record<string, unknown>[];
}

const currencyPattern = /금액|입금|지급|미수|수익|수수료|차액|합계|amount|income|payment|deposit|receivable|profit|fee/i;
const numberPattern = /일수|횟수|건수|인원|율|count|days|rate/i;
const datePattern = /일자|날짜|등록일|확정일|지급일|입금일|date|at$/i;
const noTotalPattern = /상태|메모|사유|비고|이름|성명|소개자|작업자|현장|팀|status|memo|name|reason/i;

const isCurrencyHeader = (header: string): boolean => currencyPattern.test(header);
const isNumericHeader = (header: string): boolean => isCurrencyHeader(header) || numberPattern.test(header);
const isDateHeader = (header: string): boolean => datePattern.test(header);
const shouldTotalHeader = (header: string): boolean => isNumericHeader(header) && !noTotalPattern.test(header);

export const recruitingExcelService = {
  async download(fileName: string, sheets: RecruitingExcelSheet[]): Promise<void> {
    const XLSX = await import('xlsx-js-style');
    const workbook = XLSX.utils.book_new();

    sheets.forEach((sheet) => {
      const rows = sheet.rows.length ? sheet.rows : [{ 내용: '데이터 없음' }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;

      if (range) {
        const headers: string[] = [];
        for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
          const address = XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex });
          const cell = worksheet[address];
          headers[columnIndex] = String(cell?.v ?? '');
          if (cell) {
            cell.s = {
              font: { bold: true, color: { rgb: '0F172A' } },
              fill: { fgColor: { rgb: 'E2E8F0' } },
              alignment: { horizontal: 'center' },
            };
          }
        }

        for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
          for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
            const cell = worksheet[address];
            if (!cell) continue;
            const header = headers[columnIndex] || '';
            if (cell.t === 'n') {
              cell.z = isCurrencyHeader(header) ? '#,##0"원"' : '#,##0.##';
              cell.s = { alignment: { horizontal: 'right' } };
            } else if (cell.t === 's' && isDateHeader(header) && /^\d{4}-\d{2}-\d{2}/.test(String(cell.v))) {
              cell.z = 'yyyy-mm-dd';
            }
          }
        }

        if (sheet.rows.length > 0) {
          const totalRowIndex = range.e.r + 1;
          worksheet[XLSX.utils.encode_cell({ r: totalRowIndex, c: range.s.c })] = {
            t: 's',
            v: '합계',
            s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } },
          };

          for (let columnIndex = range.s.c + 1; columnIndex <= range.e.c; columnIndex += 1) {
            const header = headers[columnIndex] || '';
            if (!shouldTotalHeader(header)) continue;
            const hasNumber = sheet.rows.some((row) => typeof row[header] === 'number' && Number.isFinite(row[header] as number));
            if (!hasNumber) continue;
            const columnLetter = XLSX.utils.encode_col(columnIndex);
            worksheet[XLSX.utils.encode_cell({ r: totalRowIndex, c: columnIndex })] = {
              t: 'n',
              f: `SUM(${columnLetter}${range.s.r + 2}:${columnLetter}${range.e.r + 1})`,
              z: isCurrencyHeader(header) ? '#,##0"원"' : '#,##0.##',
              s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } }, alignment: { horizontal: 'right' } },
            };
          }

          worksheet['!ref'] = XLSX.utils.encode_range({
            s: range.s,
            e: { r: totalRowIndex, c: range.e.c },
          });
        }

        worksheet['!cols'] = headers.map((header) => ({
          wch: Math.min(Math.max(header.length + 8, 14), 32),
        }));
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
    });

    XLSX.writeFile(workbook, fileName);
  },
};
