/** @jest-environment node */
import ExcelJS from 'exceljs';
import { Blob as NodeBlob } from 'buffer';
import { saveAs } from 'file-saver';
import {
    buildAccommodationLedgerWorkbook, buildAccommodationStatusWorkbook, downloadAccommodationWorkbook,
} from './accommodationExcelExport';
import { getAccommodationMonthSummary } from './accommodationMonthSummary';
import type { Accommodation, UtilityRecord } from '../types/accommodation';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
Object.defineProperty(globalThis, 'Blob', { value: NodeBlob, configurable: true });
const context = { yearMonth: '2026-07', teamName: '시험팀', searchText: '시험' };
const room = (id: string, overrides: Partial<Accommodation> = {}): Accommodation => ({
    id, name: `시험숙소 ${id}`, address: '시험주소', type: 'OneRoom', status: 'active', ownership: 'Cheongyeon',
    contract: { startDate: '2026-01-01', endDate: '', monthlyRent: 500000, deposit: 1000000 } as Accommodation['contract'],
    costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'included', maintenance: 'variable' },
    ...overrides,
});
const record = (total = 560000): UtilityRecord => ({
    id: 'record', accommodationId: 'one', accommodationName: '시험숙소 one', yearMonth: context.yearMonth,
    costs: { rent: 500000, electricity: 10000, gas: 20000, water: 30000, internet: 0, maintenance: 0, other: 0, total },
    paymentStatus: 'unpaid', memo: '월별 메모\n[과청구 자동] 이전 자동 문구',
});
const ledgerRow = (total?: number) => ({
    record: record(total), accommodation: room('one', { memo: '공통 메모' }),
    assignedTeams: ['시험팀'], assignedWorkers: ['시험인원1', '시험인원2'], billingTargets: ['시험청구팀'], exceededAmount: 0,
});

it('실제 xlsx로 저장하고 다시 읽어도 숫자, 검산 수식, 캐시 합계와 메모가 유지된다', async () => {
    const workbook = buildAccommodationLedgerWorkbook({ ...context, rows: [ledgerRow(), ledgerRow(600000)], hasUnsavedChanges: true });
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reloaded.getWorksheet('통합관리대장')!;
    expect(sheet.getCell('E2').value).toBe(500000);
    expect(sheet.getCell('I2').value).toBe(0);
    expect(sheet.getCell('M2').value).toMatchObject({ formula: 'SUM(E2:K2)', result: 560000 });
    expect(sheet.getCell('N3').value).toMatchObject({ formula: 'L3-M3', result: 40000 });
    expect(sheet.getCell('N3').font.color?.argb).toBe('FFB91C1C');
    expect(sheet.getCell('L4').value).toMatchObject({ formula: 'SUBTOTAL(109,L2:L3)', result: 1160000 });
    expect(sheet.getCell('M4').result).toBe(1120000);
    expect(sheet.getCell('N4').result).toBe(40000);
    expect(sheet.getCell('R2').value).toBe('공통 메모');
    expect(sheet.getCell('S2').value).toBe('월별 메모');
    expect(sheet.autoFilter).toBe('A1:S3');
    expect(reloaded.getWorksheet('조회조건')!.getColumn(2).values).toContain('미저장 변경사항 포함 (다운로드 시점의 화면값)');
});

it('조회 목록 합계와 선택 월 상단 카드 집계를 각 시트에서 동일한 기준으로 검증한다', () => {
    const rooms = [room('one'), room('ended', { status: 'inactive', contract: { ...room('one').contract, endDate: '2026-07-31' } }),
        room('future', { contract: { ...room('one').contract, startDate: '2026-08-01' } }), room('inactive', { status: 'inactive' })];
    const workbook = buildAccommodationStatusWorkbook({ ...context, statusLabel: '운영 중', rows: [{
        accommodation: rooms[0], rent: 500000, deposit: 1000000, assignedTeam: '시험팀', assignedWorkers: ['시험인원'],
        occupantCount: 1, billingTarget: '시험팀', billingMode: '동일',
    }], monthAccommodations: rooms, monthRecords: [record()] });
    const current = workbook.getWorksheet('배정·경비현황')!;
    expect(current.rowCount).toBe(3);
    expect(current.getCell('G3').result).toBe(500000);
    expect(current.getCell('H3').result).toBe(1000000);
    expect(current.getCell('I3').result).toBe(1);
    const month = workbook.getWorksheet('월별계약집계')!;
    const expected = getAccommodationMonthSummary(rooms, context.yearMonth, [record()]);
    expect(month.rowCount).toBe(4);
    expect(month.getCell('E4').result).toBe(expected.rent);
    expect(month.getCell('F4').result).toBe(expected.deposit);
});

it('0원 계약을 유지하고 계약 금액이 없을 때만 해당 월 대장 금액을 사용한다', () => {
    const free = room('free', { contract: { ...room('one').contract, monthlyRent: 0, deposit: 0 } });
    const missing = room('one', { contract: { startDate: '2026-01-01' } as Accommodation['contract'] });
    const workbook = buildAccommodationStatusWorkbook({ ...context, statusLabel: '전체', rows: [],
        monthAccommodations: [free, missing], monthRecords: [record(), { ...record(), yearMonth: '2026-08' }],
    });
    expect(workbook.getWorksheet('월별계약집계')!.getCell('E2').value).toBe(0);
    expect(workbook.getWorksheet('월별계약집계')!.getCell('E4').result).toBe(500000);
    expect(workbook.getWorksheet('배정·경비현황')!.getCell('G2').value).toBe(0);
});

it('빈 목록은 자기 참조 수식 없이 0원 합계를 생성하고 사용자 문자열은 수식으로 실행하지 않는다', async () => {
    const empty = buildAccommodationLedgerWorkbook({ ...context, rows: [], hasUnsavedChanges: false });
    expect(empty.getWorksheet('통합관리대장')!.getCell('L2').value).toBe(0);
    const item = ledgerRow();
    item.record.accommodationName = '=1+1';
    item.record.memo = '+SUM(A1:A3)';
    const workbook = buildAccommodationLedgerWorkbook({ ...context, rows: [item], hasUnsavedChanges: false });
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(reloaded.getWorksheet('통합관리대장')!.getCell('D2').type).toBe(ExcelJS.ValueType.String);
    expect(reloaded.getWorksheet('통합관리대장')!.getCell('S2').value).toBe('+SUM(A1:A3)');
});

it('완성된 xlsx 파일을 올바른 형식과 파일명으로 다운로드한다', async () => {
    const workbook = buildAccommodationLedgerWorkbook({ ...context, rows: [ledgerRow()], hasUnsavedChanges: false });
    await downloadAccommodationWorkbook(workbook, '숙소_통합관리대장_2026-07.xlsx');
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), '숙소_통합관리대장_2026-07.xlsx');
    expect(jest.mocked(saveAs).mock.calls[0][0]).toHaveProperty('type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
