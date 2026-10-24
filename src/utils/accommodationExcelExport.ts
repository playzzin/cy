import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Accommodation, UtilityRecord } from '../types/accommodation';
import { stripAccommodationOverchargeMemo } from './accommodationOvercharge';

interface ExportContext {
    yearMonth: string;
    teamName: string;
    searchText: string;
}

export interface AccommodationStatusExportRow {
    accommodation: Accommodation;
    rent: number;
    deposit: number;
    assignedTeam: string;
    assignedWorkers: string[];
    occupantCount: number;
    billingTarget: string;
    billingMode: string;
}

export interface AccommodationLedgerExportRow {
    record: UtilityRecord;
    accommodation?: Accommodation;
    assignedTeams: string[];
    assignedWorkers: string[];
    billingTargets: string[];
    exceededAmount: number;
}

const ownershipLabel = (value: Accommodation['ownership']) => (
    ({ Cheongyeon: '청연', Dawon: '다원', Individual: '개인(사모님)' })[value] || '청연'
);
const typeLabel = (value: Accommodation['type']) => (
    ({ OneRoom: '원룸', TwoRoom: '투룸', ThreeRoom: '쓰리룸', Apartment: '아파트' })[value] || value
);
const amount = (value: unknown): number => {
    const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

function createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '숙소 통합관리';
    workbook.calcProperties.fullCalcOnLoad = true;
    return workbook;
}

function createSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], widths: number[]) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = headers.map((header, index) => ({ header, width: widths[index] || 18 }));
    sheet.getRow(1).height = 30;
    sheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
    });
    return sheet;
}

function finishSheet(sheet: ExcelJS.Worksheet, numericColumns: number[]) {
    const lastDataRow = sheet.rowCount;
    if (lastDataRow > 1) sheet.autoFilter = { from: 'A1', to: { row: lastDataRow, column: sheet.columnCount } };
    sheet.eachRow((row, rowIndex) => {
        if (rowIndex === 1) return;
        row.eachCell(cell => { cell.alignment = { vertical: 'top', wrapText: true }; });
    });
    const total = sheet.addRow(['합계']);
    numericColumns.forEach(column => {
        const letter = sheet.getColumn(column).letter;
        let result = 0;
        for (let row = 2; row <= lastDataRow; row += 1) {
            const cell = sheet.getCell(row, column);
            result += amount(cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value);
        }
        total.getCell(column).value = lastDataRow > 1
            ? { formula: `SUBTOTAL(109,${letter}2:${letter}${lastDataRow})`, result }
            : 0;
        sheet.getColumn(column).numFmt = '#,##0;[Red]-#,##0;0';
    });
    total.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    });
}

function addContext(workbook: ExcelJS.Workbook, context: ExportContext, notes: string[][]) {
    const sheet = createSheet(workbook, '조회조건', ['항목', '내용'], [26, 110]);
    sheet.addRows([
        ['조회월', context.yearMonth], ['팀', context.teamName || '전체'],
        ['검색어', context.searchText || '없음'], ['금액 단위', '원'],
        ...notes,
        ['엑셀 합계', '숫자 셀과 합계 수식이 포함됩니다. 엑셀 필터를 변경하면 합계도 표시된 행 기준으로 다시 계산됩니다.'],
    ]);
    sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
}

export function buildAccommodationStatusWorkbook(options: ExportContext & {
    statusLabel: string;
    rows: AccommodationStatusExportRow[];
}): ExcelJS.Workbook {
    const workbook = createWorkbook();
    const sheet = createSheet(workbook, '배정·경비현황', [
        '숙소명', '주소', '유형', '배정팀', '상태', '명의', '월세', '보증금', '배정인원 수',
        '배정인원', '청구대상', '청구방식', '계약시작', '계약만료', '월세일', '메모',
    ], [24, 48, 12, 24, 12, 18, 18, 18, 14, 32, 32, 12, 16, 16, 12, 48]);
    options.rows.forEach(row => {
        const room = row.accommodation;
        sheet.addRow([
            room.name, room.address, typeLabel(room.type), row.assignedTeam,
            room.status === 'active' ? '운영 중' : '사용 종료', ownershipLabel(room.ownership),
            amount(row.rent), amount(row.deposit), row.occupantCount, row.assignedWorkers.join('\n'),
            row.billingTarget, row.billingMode, room.contract?.startDate || '', room.contract?.endDate || '',
            room.contract?.rentPayDate || room.contract?.paymentDay || '', room.memo || '',
        ]);
    });
    finishSheet(sheet, [7, 8, 9]);

    const monthSheet = createSheet(workbook, '월별계약집계', [
        '숙소명', '명의', '계약시작', '계약만료', '월세', '보증금',
    ], [28, 20, 18, 18, 20, 20]);
    // Both sheets use the screen's selected month, filters and resolved amounts.
    options.rows.forEach(({ accommodation: room, rent, deposit }) => {
        monthSheet.addRow([room.name, ownershipLabel(room.ownership), room.contract?.startDate || '',
            room.contract?.endDate || '', amount(rent), amount(deposit)]);
    });
    finishSheet(monthSheet, [5, 6]);
    addContext(workbook, options, [
        ['상태 필터', options.statusLabel], ['조회 숙소 수', String(options.rows.length)],
        ['배정·경비현황 기준', '선택 월의 계약기간과 팀·상태·검색 조건을 적용한 목록입니다. 상단 카드와 하단 명의별 요약의 월세·보증금 합계는 이 목록의 계약 금액 기준입니다. 상태 필터는 현재 등록 상태를 사용합니다.'],
        ['계약 시작일 미입력', `${options.rows.filter(row => !row.accommodation.contract?.startDate?.trim()).length}곳 (시작일이 없어 이전 월에도 포함됩니다. 정확한 월별 집계를 위해 계약 시작일을 확인해 주세요.)`],
        ['월별계약집계 기준', '배정·경비현황과 동일한 조회월·팀·상태·검색 조건의 숙소와 계약 금액을 사용합니다. 두 시트의 월세·보증금 합계는 같습니다. 엑셀에서 시트별 필터를 변경하면 표시 합계는 달라질 수 있습니다.'],
    ]);
    return workbook;
}

export function buildAccommodationLedgerWorkbook(options: ExportContext & {
    rows: AccommodationLedgerExportRow[];
    hasUnsavedChanges: boolean;
}): ExcelJS.Workbook {
    const workbook = createWorkbook();
    const sheet = createSheet(workbook, '통합관리대장', [
        '배정팀', '배정인원', '청구대상', '숙소명', '월세', '전기세', '가스비', '수도세', '인터넷',
        '관리비', '기타', '대장 합계', '항목 재계산 합계', '차이 (대장-재계산)', '초과액',
        '납부상태', '납부일', '숙소 공통 메모', '월별 메모',
    ], [24, 32, 28, 28, 18, 18, 18, 18, 18, 18, 18, 20, 20, 22, 18, 14, 16, 48, 48]);
    options.rows.forEach(({ record, accommodation, assignedTeams, assignedWorkers, billingTargets, exceededAmount }) => {
        const costs = record.costs;
        const values = [costs.rent, costs.electricity, costs.gas, costs.water, costs.internet, costs.maintenance, costs.other].map(amount);
        const recalculated = values.reduce((sum, value) => sum + value, 0);
        const difference = amount(costs.total) - recalculated;
        const rowNumber = sheet.rowCount + 1;
        const row = sheet.addRow([
            assignedTeams.join('\n'), assignedWorkers.join('\n'), billingTargets.join('\n'), record.accommodationName,
            ...values, amount(costs.total),
            { formula: `SUM(E${rowNumber}:K${rowNumber})`, result: recalculated },
            { formula: `L${rowNumber}-M${rowNumber}`, result: difference },
            exceededAmount, ({ paid: '완납', unpaid: '미납', pending: '대기' })[record.paymentStatus],
            record.paymentDate || '', accommodation?.memo || '', stripAccommodationOverchargeMemo(record.memo),
        ]);
        if (difference !== 0) {
            row.getCell(14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            row.getCell(14).font = { bold: true, color: { argb: 'FFB91C1C' } };
        }
    });
    finishSheet(sheet, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    addContext(workbook, options, [
        ['조회 숙소 수', String(options.rows.length)],
        ['저장 상태', options.hasUnsavedChanges ? '미저장 변경사항 포함 (다운로드 시점의 화면값)' : '조회된 대장값'],
        ['대장 기준', '선택 월·팀·검색 조건과 화면 정렬을 적용한 숙소별 금액입니다. 분할 청구 숙소도 대장에 표시된 숙소 전체 금액입니다.'],
        ['검산', '항목 재계산 합계 = 월세+전기세+가스비+수도세+인터넷+관리비+기타. 차이가 0이 아니면 원본 금액을 확인하세요.'],
        ['포함 항목', '계약상 포함으로 표시되는 항목도 대장에 숫자가 남아 있으면 그대로 내보냅니다.'],
    ]);
    return workbook;
}

export async function downloadAccommodationWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
