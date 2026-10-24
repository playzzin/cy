/** @jest-environment node */
import ExcelJS from 'exceljs';
import { Blob as NodeBlob } from 'buffer';
import { saveAs } from 'file-saver';
import { buildVehicleStatusWorkbook, buildCardStatusWorkbook, buildVehicleLedgerWorkbook, buildCardLedgerWorkbook, downloadSupportResourceWorkbook } from './supportResourceExcelExport';
import type { VehicleLedgerExportRow, CardLedgerExportRow } from './supportResourceExcelExport';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
Object.defineProperty(globalThis, 'Blob', { value: NodeBlob, configurable: true });
const context = { yearMonth: '2026-09', teamName: '시험팀', searchText: '시험', hasUnsavedChanges: true };
const vehicleRow: VehicleLedgerExportRow = {
    vehicle: { id: 'vehicle', licensePlate: 'TEST-001', model: '시험차량', type: 'RENT', status: 'ASSIGNED',
        contract: { type: 'RENT', startDate: '2026-01-01', endDate: '2026-12-31', deposit: 100000, monthlyFee: 1000, paymentDay: 1, financeCompany: { name: '', contact: '' } } },
    segment: { startDate: '2026-09-01', endDate: '2026-09-15', overlapDays: 15 },
    assignedTeams: ['시험팀'], assignedWorkers: ['시험운전자'], billingTargets: ['시험청구팀'],
    rentFee: 500, leaseFee: 0, amounts: { FUEL: 100, REPAIR: 200, TOLL: 300, FINE: 400, OTHER: 0 }, total: 1500,
    fineTarget: '운전자 · 시험운전자', note: '시험 메모',
};
const cardRow: CardLedgerExportRow = {
    card: { id: 'card', name: '시험카드', issuer: '시험발급사', cardType: 'CREDIT', last4: '0123', maskedNumber: '1111222233330123', status: 'ASSIGNED' },
    segment: { startDate: '2026-09-01', endDate: '2026-09-15', overlapDays: 15 },
    assignedTeams: ['시험팀'], assignedWorkers: ['시험인원'], billingTargets: ['시험청구팀'],
    amounts: { FUEL: 1000, TOLL: 2000, MEAL: 3000, MATERIAL: 4000, OTHER: -500 }, total: 9500, memo: '=1+1',
};

it('차량 분할 행의 배분 금액을 유지하고 실제 파일에서도 검산 수식과 합계가 일치한다', async () => {
    const second = { ...vehicleRow, segment: { startDate: '2026-09-16', endDate: '2026-09-30', overlapDays: 15 }, total: 1600 };
    const workbook = buildVehicleLedgerWorkbook(context, [vehicleRow, second]);
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reloaded.getWorksheet('차량 통합관리대장')!;
    expect(sheet.getCell('I4').result).toBe(1000);
    expect(sheet.getCell('F3').value).toBe('2026-09-16');
    expect(sheet.getCell('Q2').value).toMatchObject({ formula: 'SUM(I2:O2)', result: 1500 });
    expect(sheet.getCell('R3').value).toMatchObject({ formula: 'P3-Q3', result: 100 });
    expect(sheet.getCell('R3').font.color?.argb).toBe('FFB91C1C');
    expect(sheet.getCell('P4').value).toMatchObject({ formula: 'SUBTOTAL(109,P2:P3)', result: 3100 });
    expect(sheet.autoFilter).toBe('A1:T3');
    expect(reloaded.getWorksheet('조회조건')!.getColumn(2).values).toContain('미저장 변경사항 포함 (다운로드 시점의 화면값)');
});

it('카드 음수 환불, 항목별 금액, 분할 기간과 마스킹 번호를 보존한다', async () => {
    const workbook = buildCardLedgerWorkbook(context, [cardRow, { ...cardRow, segment: { ...cardRow.segment, startDate: '2026-09-16' } }]);
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reloaded.getWorksheet('카드 통합관리대장')!;
    expect(sheet.getCell('N2').value).toBe(-500);
    expect(sheet.getCell('P2').result).toBe(9500);
    expect(sheet.getCell('O4').result).toBe(19000);
    expect(sheet.getCell('E2').value).toBe('****-****-****-0123');
    expect(sheet.getCell('R2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('R2').value).toBe('=1+1');
    expect(sheet.getCell('G3').value).toBe('2026-09-16');
});

it('현황은 전달받은 조회 목록만 내보내고 차량 고정비 합계를 계산한다', () => {
    const sheet = buildVehicleStatusWorkbook({ statusLabel: '현재 관리' }, [{ vehicle: vehicleRow.vehicle, billingTarget: '시험청구팀', billingMode: '동일', fineTarget: '청구대상' }]).worksheets[0];
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell('I3').result).toBe(1000);
    expect(sheet.getCell('J3').result).toBe(100000);
    const card = buildCardStatusWorkbook({}, [{ card: cardRow.card, effectiveStatus: 'AVAILABLE', billingTarget: '', billingMode: '미지정' }]).worksheets[0];
    expect(card.getCell('E2').value).toBe('보관중');
    expect(card.getCell('B2').value).toBe('****-****-****-0123');
});

it('0원과 빈 목록에 순환 수식을 만들지 않으며 원문 카드번호를 노출하지 않는다', () => {
    expect(buildVehicleLedgerWorkbook(context, []).worksheets[0].getCell('P2').value).toBe(0);
    expect(buildCardLedgerWorkbook(context, []).worksheets[0].getCell('O2').value).toBe(0);
    const unsafe = { ...cardRow, card: { ...cardRow.card, last4: '', maskedNumber: '1111222233334444' } };
    expect(buildCardLedgerWorkbook(context, [unsafe]).worksheets[0].getCell('E2').value).toBe('');
});

it('실제 xlsx 파일 형식과 파일명으로 내려받는다', async () => {
    await downloadSupportResourceWorkbook(buildCardLedgerWorkbook(context, [cardRow]), '카드_통합관리대장_2026-09.xlsx');
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), '카드_통합관리대장_2026-09.xlsx');
    expect(jest.mocked(saveAs).mock.calls[0][0]).toHaveProperty('type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
