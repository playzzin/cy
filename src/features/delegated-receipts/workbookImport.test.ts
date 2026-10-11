import * as XLSX from 'xlsx';
import { mergeImportedClaims } from './model';
import { parseDelegatedWorkbook } from './workbookImport';

const makeWorkbook = (sheets: Record<string, XLSX.WorkSheet>): XLSX.WorkBook => ({ SheetNames: Object.keys(sheets), Sheets: sheets });

function blockSheet(): XLSX.WorkSheet {
    const sheet: XLSX.WorkSheet = { '!ref': 'A1:K36' };
    const values: Record<string, string | number> = {
        E8: '2025년 01월 가상 현장 A', E10: '이 름', F10: '세전 금액', G10: '입금 여부',
        E11: '가상 작업자 1', F11: 1000000, G11: '위임 입금완료',
        E12: '가상 작업자 2', F12: '2,000,000원', G12: '직불 통장',
        E13: '가상 작업자 3', F13: 0,
        E28: '세금 안내', E29: '합 계', F29: 3000000,
        I8: '2025년 1월 [가상 현장 B]', I10: '성명', J10: '세전금액', K10: '입금여부',
        I11: '가상 작업자 1', J11: 500000, K11: '현금 위임',
        I29: '합계', J29: 500000,
        E31: '2025년 02월 가상 현장 A', E33: '이름', F33: '세전 금액', G33: '입금 여부',
        E34: '가상 작업자 1', F34: 1000000, G34: '입금 완료', E36: '합계', F36: 1000000,
    };
    for (const [address, value] of Object.entries(values)) sheet[address] = { t: typeof value === 'number' ? 'n' : 's', v: value };
    return sheet;
}

describe('노무 처리 원본 블록 가져오기', () => {
    it('가로·세로 반복 블록의 월과 현장을 분리하고 머리글·세금안내·합계를 제외한다', () => {
        const result = parseDelegatedWorkbook(makeWorkbook({ '2025년': blockSheet() }));
        expect(result.claims).toHaveLength(5);
        expect(result.claims.map(claim => [claim.month, claim.siteName, claim.grossAmount])).toEqual([
            ['2025-01', '가상 현장 A', 1000000], ['2025-01', '가상 현장 A', 2000000], ['2025-01', '가상 현장 A', 0],
            ['2025-01', '가상 현장 B', 500000], ['2025-02', '가상 현장 A', 1000000],
        ]);
        expect(result.claims[0]).toMatchObject({ delegationType: 'delegate', sourceStatus: '위임 입금완료', sourceLabel: '2025년!E11' });
        expect(result.claims[1]).toMatchObject({ delegationType: 'direct', paymentMethod: 'transfer' });
        expect(result.claims[3]).toMatchObject({ delegationType: 'delegate', paymentMethod: 'cash' });
    });

    it('세전액·완료 문구·셀 색상으로 확정액이나 입금기록을 자동 생성하지 않는다', () => {
        const sheet = blockSheet();
        sheet.G13 = { t: 's', v: '', s: { fill: { fgColor: { rgb: '00FF00' } } } };
        const result = parseDelegatedWorkbook(makeWorkbook({ '2025': sheet }));
        for (const claim of result.claims) expect(claim).toMatchObject({ expectedAmount: null, taxRate: null, taxAmount: null, receipts: [] });
        expect(result.claims[2].delegationType).toBe('unknown');
        expect(result.warnings.join(' ')).toContain('실제 입금액은 따로');
    });

    it('병합 입금완료 문구는 그룹 원문으로 보존하고 개별 행에 위임·수단·완료 판정을 퍼뜨리지 않는다', () => {
        const sheet = blockSheet();
        sheet['!merges'] = [XLSX.utils.decode_range('G11:G13')];
        delete sheet.G12;
        const result = parseDelegatedWorkbook(makeWorkbook({ '2025': sheet }));
        for (const claim of result.claims.slice(0, 3)) {
            expect(claim).toMatchObject({ delegationType: 'unknown', paymentMethod: 'unknown', receipts: [] });
            expect(claim.sourceStatus).toContain('그룹 표시 G11:G13');
            expect(claim.sourceStatus).toContain('위임 입금완료');
        }
        expect(result.warnings.join(' ')).toContain('병합된 입금 표시 3건');
    });

    it('금액이 비거나 잘못된 행은 null로 남기며 실제 0원은 구분한다', () => {
        const sheet = blockSheet();
        sheet.F11 = { t: 'e', v: 7, w: '#DIV/0!' };
        sheet.F12 = { t: 's', v: '확인 필요' };
        delete sheet.J11;
        const result = parseDelegatedWorkbook(makeWorkbook({ '2025': sheet }));
        expect(result.claims.map(claim => claim.grossAmount)).toEqual([null, null, 0, null, 1000000]);
        expect(result.warnings.join(' ')).toContain('세전 금액을 확인할 수 없는 3건');
    });

    it('빈 서식·월현장 없는 블록을 연도 시트명으로 추정하지 않고 경고한다', () => {
        const sheet = blockSheet();
        delete sheet.E8;
        delete sheet.I8;
        delete sheet.E31;
        const result = parseDelegatedWorkbook(makeWorkbook({ '2026': sheet, '빈 시트': { '!ref': 'A1' } }));
        expect(result.claims).toEqual([]);
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('2026: 월·현장을 확인할 수 없는 5개 행'),
            expect.stringContaining('빈 시트: 가져올 작업자 행이 없는 시트'),
        ]));
    });

    it('제목의 월이 유효하지 않으면 원문을 확인 대기로 보관한다', () => {
        const sheet = blockSheet();
        sheet.E8.v = '2025년 13월 가상 현장 A';
        const result = parseDelegatedWorkbook(makeWorkbook({ '2025': sheet }));
        expect(result.claims).toHaveLength(2);
        expect(result.unclassifiedRows).toHaveLength(3);
        expect(result.warnings.join(' ')).toContain('3개 행은 원문과 함께 확인 대기');
    });

    it('같은 달현장의 동명이인 행은 구분하고 재가져오기·파일명·상태·금액 변경에도 ID를 유지한다', () => {
        const sheet = blockSheet();
        sheet.E12.v = '가상 작업자 1';
        const original = parseDelegatedWorkbook(makeWorkbook({ '원본 시트': sheet })).claims;
        expect(new Set(original.map(claim => claim.id)).size).toBe(5);
        sheet.F11.v = 1200000;
        sheet.G11.v = '입금 완료';
        const repeated = parseDelegatedWorkbook(makeWorkbook({ '이름 변경 시트': sheet })).claims;
        expect(repeated.map(claim => claim.id)).toEqual(original.map(claim => claim.id));
        const saved = original.map(claim => ({ ...claim, expectedAmount: 800000, memo: '확인한 기록' }));
        expect(mergeImportedClaims(saved, repeated)).toEqual({ claims: saved, added: 0, skipped: 5 });
    });

    it('다음 블록에 이전 월현장 제목을 이어 붙이지 않는다', () => {
        const sheet = blockSheet();
        delete sheet.E31;
        const result = parseDelegatedWorkbook(makeWorkbook({ '2025': sheet }));
        expect(result.claims).toHaveLength(4);
        expect(result.unclassifiedRows).toHaveLength(1);
        expect(result.warnings.join(' ')).toContain('1개 행은 원문과 함께 확인 대기');
    });

    it.each(['미위임', '위임 안함', '위임 X', '위임 여부 확인 필요', '직불 아님', '위임 / 직불'])('모호하거나 부정적인 원문 %s를 확정 분류하지 않는다', status => {
        const sheet = blockSheet();
        sheet.G11.v = status;
        expect(parseDelegatedWorkbook(makeWorkbook({ '2025': sheet })).claims[0].delegationType).toBe('unknown');
    });

    it('같은 월현장작업자가 반복되면 개별 검토 경고를 제공한다', () => {
        const sheet = blockSheet();
        sheet.E12.v = sheet.E11.v;
        expect(parseDelegatedWorkbook(makeWorkbook({ '2025': sheet })).warnings.join(' ')).toContain('같은 월·현장·이름이 반복된 1개 행');
    });
});

describe('빠짐없는 원본 보관', () => {
    it('월 없는 원문 제목과 작업자·금액·상태의 값, 수식, 표시문자, 메모를 보존한다', () => {
        const sheet = blockSheet();
        sheet.E8.v = '2025년   가상 현장 A';
        sheet.F11 = { t: 'n', v: 1000, f: '500+500', w: '1,000원', c: [{ a: '작성자', t: '가상 확인 메모' }] };
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(result.unclassifiedRows).toHaveLength(3);
        const row = result.unclassifiedRows[0];
        expect(row).toMatchObject({ sourceLabel: '자료!E11', sourceTitle: '2025년   가상 현장 A', workerName: '가상 작업자 1', grossAmount: 1000, reason: '월·현장 제목 확인 필요' });
        expect(row.id).toMatch(/^review-[0-9a-f]{16}$/);
        expect(row.rawCells).toEqual(expect.arrayContaining([
            { address: 'E8', value: '2025년   가상 현장 A' },
            { address: 'E11', value: '가상 작업자 1' },
            { address: 'F10', value: '세전 금액' },
            { address: 'F11', value: 1000, formula: '500+500', formattedText: '1,000원', comment: '가상 확인 메모' },
            { address: 'G11', value: '위임 입금완료' },
        ]));
        expect(result.claims.every(claim => claim.month !== '2025-01' || claim.siteName !== '가상 현장 A')).toBe(true);
    });

    it('세후 머리글이 명확하면 세후액을 받을 금액으로 보존하고 0원도 유지한다', () => {
        const sheet = blockSheet();
        sheet.F10.v = '세후 금액';
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        const net = result.claims.filter(claim => claim.id.startsWith('net-'));
        expect(net).toHaveLength(3);
        expect(net.map(claim => claim.expectedAmount)).toEqual([1000000, 2000000, 0]);
        for (const claim of net) {
            expect(claim).toMatchObject({ grossAmount: null, taxRate: null, taxAmount: null, receipts: [] });
            expect(claim.memo).toContain('원본 금액 구분: 세후 금액');
        }
        expect(result.unclassifiedRows).toHaveLength(0);
    });

    it('세후 내역만 있는 시트에 제목 없음이나 가져오기 없음 경고를 표시하지 않는다', () => {
        const sheet = blockSheet();
        sheet.F10.v = '세후 금액';
        sheet.J10.v = '세후 금액';
        sheet.F33.v = '세후 금액';
        const result = parseDelegatedWorkbook(makeWorkbook({ '세후 자료': sheet }));
        expect(result.claims).toHaveLength(5);
        expect(result.warnings.join(' ')).not.toMatch(/가져오지|작업자 행이 없|제목을 확인할 수 없/);
        expect(result.sheetSummaries[0].claimCount).toBe(5);
    });

    it('세후 블록 추가가 기존 세전 행과 다음 시트의 ID를 바꾸지 않는다', () => {
        const sheet = blockSheet();
        const nextSheet = blockSheet();
        const before = parseDelegatedWorkbook(makeWorkbook({ '첫 자료': sheet, '다음 자료': nextSheet }));
        sheet.M8 = { t: 's', v: '2025년 01월 가상 현장 A' };
        sheet.M10 = { t: 's', v: '이름' };
        sheet.N10 = { t: 's', v: '세후금액' };
        sheet.O10 = { t: 's', v: '입금여부' };
        sheet.M11 = { t: 's', v: '가상 작업자 1' };
        sheet.N11 = { t: 'n', v: 100 };
        sheet.M29 = { t: 's', v: '합계' };
        const after = parseDelegatedWorkbook(makeWorkbook({ '첫 자료': sheet, '다음 자료': nextSheet }));
        expect(after.claims.filter(claim => claim.id.startsWith('import-')).map(claim => [claim.id, claim.sourceLabel]))
            .toEqual(before.claims.map(claim => [claim.id, claim.sourceLabel]));
        expect(after.claims.filter(claim => claim.id.startsWith('net-'))).toHaveLength(1);
    });

    it('이름 누락, 잘못된 금액, 의미가 다른 금액 머리글을 확인 대기로 보존한다', () => {
        const sheet = blockSheet();
        sheet.F10.v = '세후 금액';
        delete sheet.E11;
        sheet.F12 = { t: 'e', v: 7, w: '#DIV/0!' };
        sheet.J10.v = '별도 금액';
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(result.unclassifiedRows.map(row => row.sourceLabel)).toEqual(['자료!E11', '자료!E12', '자료!I11']);
        expect(result.unclassifiedRows[0]).toMatchObject({ workerName: '', grossAmount: null, reason: '작업자 이름 확인 필요' });
        expect(result.unclassifiedRows[1].rawCells).toContainEqual({ address: 'F12', value: 7, formattedText: '#DIV/0!' });
        expect(result.unclassifiedRows[2]).toMatchObject({ grossAmount: null, reason: '금액 머리글의 의미 확인 필요' });
    });

    it('중간 합계 뒤의 추가 내역과 이름만 있는 행을 버리지 않는다', () => {
        const sheet = blockSheet();
        sheet.E14 = { t: 's', v: '합계' };
        sheet.F14 = { t: 'n', v: 3000000 };
        sheet.E17 = { t: 's', v: '가상 추가 작업자' };
        sheet.F17 = { t: 'n', v: 0 };
        sheet.E18 = { t: 's', v: '가상 금액 미입력' };
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(result.unclassifiedRows.map(row => [row.sourceLabel, row.grossAmount])).toEqual([['자료!E17', 0], ['자료!E18', null]]);
        expect(result.unclassifiedRows.every(row => row.reason.includes('중간 합계'))).toBe(true);
        expect(result.unclassifiedRows.some(row => row.sourceLabel === '자료!E14')).toBe(false);
    });

    it('표 밖의 숫자·수식·메모를 입금으로 해석하지 않고 별도 보존한다', () => {
        const sheet = blockSheet();
        sheet.M11 = { t: 'n', v: 0, w: '0' };
        sheet.M12 = { t: 'n', v: 42, f: '40+2' };
        sheet.M13 = { t: 's', v: '가상 보충 메모' };
        sheet.A11 = { t: 's', v: '2025년 01월' };
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(result.unclassifiedRows.map(row => row.sourceLabel)).toEqual(['자료!M11', '자료!M12', '자료!M13']);
        expect(result.unclassifiedRows.every(row => row.reason.includes('표 밖') && row.grossAmount === null)).toBe(true);
        expect(result.claims.every(claim => claim.receipts.length === 0)).toBe(true);
    });

    it('제목 병합은 있으나 머리글이 지워진 블록도 원문 확인 대기로 보존한다', () => {
        const sheet = blockSheet();
        sheet['!merges'] = [XLSX.utils.decode_range('E8:G9'), XLSX.utils.decode_range('E31:G32')];
        delete sheet.E33;
        delete sheet.F33;
        delete sheet.G33;
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(result.unclassifiedRows).toHaveLength(1);
        expect(result.unclassifiedRows[0].sourceLabel).toBe('자료!E34');
        expect(result.unclassifiedRows[0].reason).toContain('머리글');
    });

    it('정규화 내역과 확인 대기의 후보 주소 집합에 누락과 중복이 없다', () => {
        const sheet = blockSheet();
        delete sheet.E8;
        sheet.J10.v = '세후 금액';
        sheet.G14 = { t: 's', v: '원문 표시만 남음' };
        sheet.M11 = { t: 'n', v: 123 };
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        const sourceLabels = [...result.claims, ...result.unclassifiedRows].map(row => row.sourceLabel);
        expect(sourceLabels.sort()).toEqual(['자료!E11', '자료!E12', '자료!E13', '자료!E14', '자료!E34', '자료!I11', '자료!M11'].sort());
        expect(new Set(sourceLabels).size).toBe(sourceLabels.length);
    });

    it('확인 대기 ID는 반복 파싱과 원본값 수정에도 같은 주소에 대해 유지된다', () => {
        const sheet = blockSheet();
        delete sheet.E8;
        const first = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        sheet.F11.v = 20;
        sheet.G11.v = '가상 새 표시';
        const second = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(second.unclassifiedRows.map(row => row.id)).toEqual(first.unclassifiedRows.map(row => row.id));
    });

    it('병합된 확인 대기행은 앵커의 원문 셀과 그룹 범위를 함께 보존한다', () => {
        const sheet = blockSheet();
        delete sheet.E8;
        sheet['!merges'] = [XLSX.utils.decode_range('G11:G13')];
        delete sheet.G12;
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet }));
        expect(result.unclassifiedRows[1].sourceStatus).toContain('그룹 표시 G11:G13: 위임 입금완료');
        expect(result.unclassifiedRows[1].rawCells).toContainEqual({ address: 'G11', value: '위임 입금완료' });
    });

    it('모든 시트의 실제 값·수식 셀 수와 저장할 내역 수를 집계한다', () => {
        const sheet: XLSX.WorkSheet = {
            E8: { t: 's', v: '2025년 01월 가상 현장' }, E10: { t: 's', v: '이름' }, F10: { t: 's', v: '세전금액' }, G10: { t: 's', v: '입금여부' },
            E11: { t: 's', v: '가상 작업자' }, F11: { t: 'n', v: 0 }, E12: { t: 's', v: '합계' }, F12: { t: 'n', v: 0, f: 'SUM(F11)' },
            '!ref': 'E8:G12',
        };
        const result = parseDelegatedWorkbook(makeWorkbook({ '자료': sheet, '빈 서식': { '!ref': 'A1' } }));
        expect(result.sheetSummaries).toEqual([
            { name: '자료', populatedCells: 8, claimCount: 1, reviewRowCount: 0 },
            { name: '빈 서식', populatedCells: 0, claimCount: 0, reviewRowCount: 0 },
        ]);
    });
});
