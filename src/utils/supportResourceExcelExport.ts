import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Vehicle, VehicleExpenseType } from '../types/vehicle';
import type { Card, CardTransactionCategory } from '../types/card';

export interface SupportExportContext {
    yearMonth?: string;
    teamName?: string;
    searchText?: string;
    statusLabel?: string;
    hasUnsavedChanges?: boolean;
}

interface StatusDetails {
    billingTarget: string;
    billingMode: string;
}
interface LedgerDetails {
    assignedTeams: string[];
    assignedWorkers: string[];
    billingTargets: string[];
    segment: { startDate: string; endDate: string; overlapDays: number };
    total: number;
}
export interface VehicleLedgerExportRow extends LedgerDetails {
    vehicle: Vehicle;
    rentFee: number;
    leaseFee: number;
    amounts: Record<VehicleExpenseType, number>;
    fineTarget: string;
    note: string;
}
export interface CardLedgerExportRow extends LedgerDetails {
    card: Card;
    amounts: Record<CardTransactionCategory, number>;
    memo: string;
}

const amount = (value: unknown): number => {
    const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const vehicleType = (type: Vehicle['type']) => ({ RENT: '렌트', LEASE: '리스', OWNED: '자가' })[type] || type;
const vehicleStatus = (status: Vehicle['status']) => ({ ASSIGNED: '배정됨', AVAILABLE: '대기중', MAINTENANCE: '정비중', DISPOSED: '보관/완료' })[status] || '대기중';
const cardStatus = (status: Card['status']) => ({ ASSIGNED: '배정됨', AVAILABLE: '보관중', SUSPENDED: '분실/정지', CLOSED: '해지됨' })[status];
// Only the display-safe card number is exported; never include an unmasked legacy value.
const maskedCardNumber = (card: Card) => card.last4 ? `****-****-****-${card.last4.slice(-4)}`
    : /[*•●]/.test(card.maskedNumber || '') ? card.maskedNumber : '';

function buildWorkbook(
    title: string, context: SupportExportContext, headers: string[], rows: ExcelJS.CellValue[][],
    numericColumns: number[], notes: string[],
    verification?: { firstAmount: number; lastAmount: number; total: number; calculated: number; difference: number },
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '차량·카드 통합관리';
    workbook.calcProperties.fullCalcOnLoad = true;
    const sheet = workbook.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = headers.map((header, index) => ({ header,
        width: /메모|비고/.test(header) ? 44 : numericColumns.includes(index + 1) ? 20 : 24,
    }));
    rows.forEach(values => {
        const row = sheet.addRow(values);
        if (verification) {
            const v = verification;
            const calculated = values.slice(v.firstAmount - 1, v.lastAmount).reduce<number>((sum, value) => sum + amount(value), 0);
            const difference = amount(values[v.total - 1]) - calculated;
            row.getCell(v.calculated).value = {
                formula: `SUM(${sheet.getColumn(v.firstAmount).letter}${row.number}:${sheet.getColumn(v.lastAmount).letter}${row.number})`, result: calculated,
            };
            row.getCell(v.difference).value = {
                formula: `${sheet.getColumn(v.total).letter}${row.number}-${sheet.getColumn(v.calculated).letter}${row.number}`, result: difference,
            };
            if (difference !== 0) {
                row.getCell(v.difference).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                row.getCell(v.difference).font = { bold: true, color: { argb: 'FFB91C1C' } };
            }
        }
    });
    const last = sheet.rowCount;
    if (rows.length) sheet.autoFilter = { from: 'A1', to: { row: last, column: headers.length } };
    const total = sheet.addRow(['합계']);
    numericColumns.forEach(column => {
        const letter = sheet.getColumn(column).letter;
        let result = 0;
        for (let row = 2; row <= last; row += 1) {
            const cell = sheet.getCell(row, column);
            result += amount(cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value);
        }
        total.getCell(column).value = rows.length ? { formula: `SUBTOTAL(109,${letter}2:${letter}${last})`, result } : 0;
        sheet.getColumn(column).numFmt = '#,##0;[Red]-#,##0;0';
    });
    total.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    });
    const metadata = workbook.addWorksheet('조회조건');
    metadata.columns = [{ header: '항목', width: 24 }, { header: '내용', width: 110 }];
    metadata.addRows([
        ['조회월', context.yearMonth || '현재 현황'], ['팀', context.teamName || '전체'],
        ['검색어', context.searchText || '없음'], ['상태 필터', context.statusLabel || '화면 조회 목록'],
        ['조회 행 수', rows.length], ['금액 단위', '원'],
        ['저장 상태', context.hasUnsavedChanges ? '미저장 변경사항 포함 (다운로드 시점의 화면값)' : '조회된 화면값'],
        ['합계 기준', '화면과 같은 조회 목록 및 정렬입니다. 엑셀 필터 변경 시 합계도 표시된 행 기준으로 다시 계산됩니다.'],
        ...notes.map(note => ['확인 사항', note]),
    ]);
    workbook.worksheets.forEach(worksheet => {
        worksheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
        worksheet.getRow(1).height = 32;
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        });
    });
    return workbook;
}

export function buildVehicleStatusWorkbook(context: SupportExportContext, rows: Array<StatusDetails & { vehicle: Vehicle; fineTarget: string }>) {
    return buildWorkbook('차량 배정·정비현황', context,
        ['차량번호', '차종/모델', '구분', '상태', '운전자/배정자', '청구대상', '청구방식', '과태료 대상', '월 고정비용', '보증금', '결제일', '계약시작', '계약만료', '렌트사(금융사)', '메모'],
        rows.map(({ vehicle: v, billingTarget, billingMode, fineTarget }) => [
            v.licensePlate, v.model, vehicleType(v.type), vehicleStatus(v.status), v.currentAssigneeName || '', billingTarget, billingMode, fineTarget,
            amount(v.contract?.monthlyFee), amount(v.contract?.deposit), v.contract?.paymentDay || '', v.contract?.startDate || '', v.contract?.endDate || '',
            v.contract?.financeCompany?.name || v.insurance?.company || '', v.memo || '',
        ]), [9, 10], ['월 고정비용은 계약 금액이며, 상태 필터가 적용된 현재 목록의 합계입니다. 월별 대장의 기간별 배분 금액과 구분됩니다.']);
}

export function buildCardStatusWorkbook(context: SupportExportContext, rows: Array<StatusDetails & { card: Card; effectiveStatus: Card['status'] }>) {
    return buildWorkbook('카드 배정현황', context,
        ['카드명', '카드번호', '발급사', '구분', '상태', '배정자', '청구대상', '청구방식', '유효기간', '메모'],
        rows.map(({ card, effectiveStatus, billingTarget, billingMode }) => [
            card.name, maskedCardNumber(card), card.issuer, card.cardType === 'CREDIT' ? '신용' : '체크', cardStatus(effectiveStatus),
            card.currentAssigneeName || '', billingTarget, billingMode, card.expiry || '', card.memo || '',
        ]), [], ['카드번호는 마스킹한 정보만 포함합니다. 이용 금액은 통합관리대장에서 조회 월을 선택해 다운로드하세요.']);
}

export function buildVehicleLedgerWorkbook(context: SupportExportContext, rows: VehicleLedgerExportRow[]) {
    return buildWorkbook('차량 통합관리대장', context,
        ['배정팀', '운전자', '청구대상', '차량번호', '차종/모델', '기간 시작', '기간 종료', '일수',
            '렌트비', '리스비', '유류비', '수리비', '통행료', '과태료', '기타', '대장 합계', '항목 재계산 합계', '차이 (대장-재계산)', '과태료 대상', '메모'],
        rows.map(row => [row.assignedTeams.join('\n'), row.assignedWorkers.join('\n'), row.billingTargets.join('\n'), row.vehicle.licensePlate,
            row.vehicle.model, row.segment.startDate, row.segment.endDate, row.segment.overlapDays,
            ...[row.rentFee, row.leaseFee, row.amounts.FUEL, row.amounts.REPAIR, row.amounts.TOLL, row.amounts.FINE, row.amounts.OTHER, row.total].map(amount),
            0, 0, row.fineTarget, row.note,
        ]), [9, 10, 11, 12, 13, 14, 15, 16, 17, 18], [
            '월중 청구대상 변경은 화면의 기간별 행과 이미 배분된 렌트비·리스비를 그대로 사용합니다.',
            '과태료는 대장 금액에 포함되며 실제 청구받는 대상은 과태료 대상 열을 확인하세요.',
            '차이 = 대장 합계 - 항목 재계산 합계. 0이 아니면 원본 금액을 확인하세요.',
        ], { firstAmount: 9, lastAmount: 15, total: 16, calculated: 17, difference: 18 });
}

export function buildCardLedgerWorkbook(context: SupportExportContext, rows: CardLedgerExportRow[]) {
    return buildWorkbook('카드 통합관리대장', context,
        ['배정팀', '배정 인원', '청구대상', '카드명', '카드번호', '발급사', '기간 시작', '기간 종료', '일수',
            '유류비', '통행료', '식대', '자재비', '기타', '대장 합계', '항목 재계산 합계', '차이 (대장-재계산)', '월별 메모'],
        rows.map(row => [row.assignedTeams.join('\n'), row.assignedWorkers.join('\n'), row.billingTargets.join('\n'), row.card.name,
            maskedCardNumber(row.card), row.card.issuer, row.segment.startDate, row.segment.endDate, row.segment.overlapDays,
            ...[row.amounts.FUEL, row.amounts.TOLL, row.amounts.MEAL, row.amounts.MATERIAL, row.amounts.OTHER, row.total].map(amount), 0, 0, row.memo,
        ]), [10, 11, 12, 13, 14, 15, 16, 17], [
            '월중 청구대상 변경은 화면의 기간별 행을 유지합니다. 원본 거래를 다시 합산하지 않고 화면에서 중복 제외·분류한 금액을 사용합니다.',
            '차이 = 대장 합계 - 항목 재계산 합계. 0이 아니면 원본 금액을 확인하세요.',
            '카드번호는 마스킹한 정보만 포함합니다.',
        ], { firstAmount: 10, lastAmount: 14, total: 15, calculated: 16, difference: 17 });
}

export async function downloadSupportResourceWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
