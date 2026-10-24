/** @jest-environment node */
import ExcelJS from 'exceljs';
import { Blob as NodeBlob } from 'buffer';
import { saveAs } from 'file-saver';
import {
    buildAccommodationLedgerWorkbook, buildAccommodationStatusWorkbook, downloadAccommodationWorkbook,
} from './accommodationExcelExport';
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
const statusRow = (accommodation: Accommodation, rent = 500000, deposit = 1000000) => ({
    accommodation, rent, deposit, assignedTeam: '시험팀', assignedWorkers: ['시험인원'],
    occupantCount: 1, billingTarget: '시험팀', billingMode: '동일',
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

it('xlsx로 저장 후에도 두 시트가 조회 목록의 순서·숙소·계약 금액·합계를 공유한다', async () => {
    const workbook = buildAccommodationStatusWorkbook({ ...context, statusLabel: '운영 중',
        rows: [statusRow(room('one')), statusRow(room('two'), 450000, 5000000)],
    });
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const current = reloaded.getWorksheet('배정·경비현황')!;
    const month = reloaded.getWorksheet('월별계약집계')!;
    expect(current.rowCount).toBe(4);
    expect(month.rowCount).toBe(current.rowCount);
    expect(month.getColumn(1).values).toEqual(current.getColumn(1).values);
    expect(current.getCell('G4').result).toBe(950000);
    expect(current.getCell('H4').result).toBe(6000000);
    expect(current.getCell('I4').result).toBe(2);
    expect(month.getCell('E4').value).toMatchObject({ formula: 'SUBTOTAL(109,E2:E3)', result: 950000 });
    expect(month.getCell('F4').result).toBe(6000000);
    for (const row of [2, 3]) {
        expect(month.getCell(`E${row}`).value).toBe(current.getCell(`G${row}`).value);
        expect(month.getCell(`F${row}`).value).toBe(current.getCell(`H${row}`).value);
    }
    const notes = reloaded.getWorksheet('조회조건')!.getColumn(2).values;
    expect(notes).toContain('배정·경비현황과 동일한 조회월·팀·상태·검색 조건의 숙소와 계약 금액을 사용합니다. 두 시트의 월세·보증금 합계는 같습니다. 엑셀에서 시트별 필터를 변경하면 표시 합계는 달라질 수 있습니다.');
});

it('보관/종료 조회에서 선택한 숙소도 두 시트에 동일하게 포함한다', () => {
    const workbook = buildAccommodationStatusWorkbook({ ...context, statusLabel: '보관/종료',
        rows: [statusRow(room('ended', { status: 'inactive' }), 650000, 5000000)],
    });
    const current = workbook.getWorksheet('배정·경비현황')!;
    const month = workbook.getWorksheet('월별계약집계')!;
    expect(current.rowCount).toBe(3);
    expect(month.rowCount).toBe(3);
    expect(current.getCell('E2').value).toBe('사용 종료');
    expect(month.getCell('A2').value).toBe(current.getCell('A2').value);
    expect(current.getCell('G3').result).toBe(650000);
    expect(month.getCell('E3').result).toBe(650000);
    expect(month.getCell('F3').result).toBe(5000000);
});

it('화면에서 확정한 0원과 대장 보완 금액을 두 시트에 그대로 유지한다', () => {
    const free = room('free', { contract: { ...room('one').contract, monthlyRent: 0, deposit: 0 } });
    const missing = room('one', { contract: { startDate: '2026-01-01' } as Accommodation['contract'] });
    const workbook = buildAccommodationStatusWorkbook({ ...context, statusLabel: '전체',
        rows: [statusRow(free, 0, 0), statusRow(missing, 500000, 0)],
    });
    expect(workbook.getWorksheet('월별계약집계')!.getCell('E2').value).toBe(0);
    expect(workbook.getWorksheet('월별계약집계')!.getCell('E4').result).toBe(500000);
    expect(workbook.getWorksheet('배정·경비현황')!.getCell('G2').value).toBe(0);
    expect(workbook.getWorksheet('배정·경비현황')!.getCell('G4').result).toBe(500000);
    expect(workbook.getWorksheet('배정·경비현황')!.getCell('H4').result).toBe(0);
    expect(workbook.getWorksheet('월별계약집계')!.getCell('F4').result).toBe(0);
});

it('조회 결과가 비어 있으면 두 현황 시트 모두 숙소 없이 0원 합계를 만든다', () => {
    const workbook = buildAccommodationStatusWorkbook({ ...context, statusLabel: '운영 중', rows: [] });
    const current = workbook.getWorksheet('배정·경비현황')!;
    const month = workbook.getWorksheet('월별계약집계')!;
    expect(current.rowCount).toBe(2);
    expect(month.rowCount).toBe(2);
    expect(current.getCell('G2').value).toBe(0);
    expect(current.getCell('H2').value).toBe(0);
    expect(month.getCell('E2').value).toBe(0);
    expect(month.getCell('F2').value).toBe(0);
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
