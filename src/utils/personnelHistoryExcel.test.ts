import * as XLSX from 'xlsx-js-style';
import { buildPersonnelHistoryWorkbook, PersonnelHistoryRow } from './personnelHistoryExcel';

const makeRow = (overrides: Partial<PersonnelHistoryRow> = {}): PersonnelHistoryRow => ({
    workerId: 'test-worker', name: '테스트작업자', idNumber: '0000003000000',
    salaryModel: '월급제', teamId: 'test-team', teamName: '검증팀',
    laborManDay: 1.25, invoiceManDay: 0.5, totalManDay: 1.75,
    unitPrice: 200000,
    unitPriceBreakdown: [{ unitPrice: 200000, manDay: 1.75, amount: 350000 }],
    laborAmount: 250000, invoiceAmount: 100000, totalAmount: 350000,
    ...overrides,
});

const roundTripSheet = (rows: PersonnelHistoryRow[]) => {
    const buffer = XLSX.write(buildPersonnelHistoryWorkbook(rows), { type: 'buffer', bookType: 'xlsx' });
    return XLSX.read(buffer, { type: 'buffer', cellStyles: true, cellNF: true }).Sheets['인원전체내역'];
};

test('xlsx 파일에도 화면의 12개 열, 병합 머리글, 주민번호 전체, 숫자 형식과 전체 합계가 유지된다', () => {
    const sheet = roundTripSheet([makeRow(), makeRow({ name: '추가작업자' })]);
    expect(sheet['!ref']).toBe('A1:L5');
    expect(sheet['!merges']).toEqual(expect.arrayContaining([
        XLSX.utils.decode_range('A1:A2'), XLSX.utils.decode_range('I1:I2'),
        XLSX.utils.decode_range('F1:H1'), XLSX.utils.decode_range('J1:L1'), XLSX.utils.decode_range('A5:E5'),
    ]));
    expect(sheet.B3.v).toBe('테스트작업자');
    expect(sheet.C3.v).toBe('검증팀');
    expect(sheet.D3).toMatchObject({ t: 's', v: '000000-3000000' });
    expect(sheet.E3.v).toBe('월급제');
    expect(sheet.F3).toMatchObject({ t: 'n', v: 1.25, w: '1.25' });
    expect(sheet.I3).toMatchObject({ t: 'n', v: 200000, w: '200,000원' });
    expect(sheet.J3).toMatchObject({ t: 'n', v: 250000, w: '250,000' });
    expect(sheet.L3).toMatchObject({ t: 'n', v: 350000, w: '350,000원' });
    expect(sheet.A5.v).toBe('전체 합계');
    expect(sheet.F5).toMatchObject({ t: 'n', v: 2.5, w: '2.50' });
    expect(sheet.G5.v).toBe(1);
    expect(sheet.H5.v).toBe(3.5);
    expect(sheet.J5.v).toBe(500000);
    expect(sheet.K5.v).toBe(200000);
    expect(sheet.L5).toMatchObject({ t: 'n', v: 700000, w: '700,000 원' });
});

test('단가 변동은 단가별 공수·금액을 줄바꿈으로 모두 내보낸다', () => {
    const sheet = roundTripSheet([makeRow({ unitPriceBreakdown: [
        { unitPrice: 100000, manDay: 1, amount: 100000 },
        { unitPrice: 200000, manDay: 1.25, amount: 250000 },
    ] })]);
    expect(sheet.I3.v).toBe('단가 변동\n100,000원 × 1.00일 = 100,000원\n200,000원 × 1.25일 = 250,000원');
    expect(sheet['!rows']?.[2].hpt).toBeGreaterThanOrEqual(56);
});

test('0·음수·빈 값 표시를 화면과 맞추고 문자열을 수식으로 바꾸지 않는다', () => {
    const sheet = roundTripSheet([makeRow({
        name: '=1+1', teamName: '', idNumber: '', unitPrice: 0, unitPriceBreakdown: [],
        laborManDay: 0, invoiceManDay: -1, totalManDay: -1,
        laborAmount: 0, invoiceAmount: -100.5, totalAmount: -100.5,
    }), makeRow({
        unitPrice: 0, unitPriceBreakdown: [], laborManDay: 0, invoiceManDay: 0, totalManDay: 0,
        laborAmount: 0, invoiceAmount: 0, totalAmount: 0,
    })]);
    expect(sheet.B3).toMatchObject({ t: 's', v: '=1+1' });
    expect(sheet.B3.f).toBeUndefined();
    for (const address of ['C3', 'D3', 'F3', 'G3', 'I3', 'J3', 'K3']) expect(sheet[address].v).toBe('-');
    expect(sheet.H3.w).toBe('-1.00');
    expect(sheet.L3.w).toBe('-100.5원');
    expect(sheet.H4.w).toBe('0.00');
    expect(sheet.L4.w).toBe('0');
    expect(sheet.J5.w).toBe('0');
    expect(sheet.L5.w).toBe('-100.5 원');
});
