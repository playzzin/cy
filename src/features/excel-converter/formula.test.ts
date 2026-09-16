import fs from 'fs';
import JSZip from 'jszip';
import { evaluateCellFormula, UnsupportedFormula } from './formula';
import { recalculateSheet } from './formulaRecalculation';
import { Scalar } from './types';
import { elements, xml } from './workbook';
const calculate = (formula: string, cells: Record<string, Scalar> = {}) => evaluateCellFormula(formula, { lookup: a => cells[a] ?? null, today: new Date(2026, 8, 16) });
const sheet = (body: string) => xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${body}</row></sheetData></worksheet>`);
const formula = (address: string, expression: string, cached = '999') => `<c r="${address}"><f>${expression.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</f><v>${cached}</v></c>`;
test.each([
    ['IF(2>1,1350,1/0)', 1350], ['IF(FALSE,1/0,"대기")', '대기'], ['IFERROR(1/0,"")', ''],
    ['IFERROR(VALUE("not a number"),0)', 0], ['IFERROR(2000+"","blank")', 'blank'], ['ISNUMBER("1")', false], ['ISNUMBER(1/0)', false],
    ['AND(TRUE,"TRUE")', true], ['IFERROR(AND(TRUE,"text"),"invalid")', 'invalid'], ['ROUND(12.35,1.2)', 12.4],
    ['IF(200000*1>150000,ROUNDDOWN((200000*1-150000)*6%*45%,0),0)', 1350],
    ['ROUNDDOWN(1359,-1)', 1350], ['ROUNDDOWN(-1359,-1)', -1350], ['ROUND(-1.005,2)', -1.01],
    ['ROUNDUP(-1.001,2)', -1.01], ['ROUNDDOWN(2230000*4.75%,-1)', 105920], ['MOD(-3,2)', 1], ['INT(-1.5)', -2], ['2^3^2', 64],
    ['"a B"&" "&"He said ""Hi"""', 'a B He said "Hi"'],
    ['LEFT("홍길동",2)&RIGHT("000123",3)', '홍길123'], ['MID("001234",2,3)', '012'],
    ['SUBSTITUTE("a-b-c","-","",2)', 'a-bc'], ['LEN("가나다")', 3], ['FIND("b","abc")', 2],
    ['SEARCH("A?C","xxabc")', 3], ['SEARCH("a*c","a___cabc")', 1], ['SEARCH("~*","a*b")', 2],
    ['COUNT(1,"2",TRUE,"a")', 3], ['DAY(DATE(2026,9,0))', 31], ['MONTH(DATE(2026,13,1))', 1],
    ['YEAR(DATE(2026,13,1))', 2027], ['DAY(DATE(1900,2,29))', 29], ['DAY(DATE(1900,3,0))', 29],
    ['DATEDIF(DATE(1990,9,17),TODAY(),"Y")', 35], ['DATEDIF(DATE(1990,9,16),TODAY(),"Y")', 36],
    ['DATEDIF(DATE(2024,2,29),DATE(2025,2,28),"Y")', 0], ['A1', 0],
])('%s produces the specified Excel result', (expression, expected) => expect(calculate(expression as string)).toBe(expected));
test('two-row totals, text references and COUNTIF use values rather than old caches', () => {
    const cells = { A1: 1, A2: 20, A3: 3, A4: 40, B1: '2', B2: '', B3: null, B4: true };
    expect(calculate('SUMPRODUCT((MOD(ROW(A1:A4),2)=0)*A1:A4)', cells)).toBe(60);
    expect(calculate('SUMPRODUCT(A1:A4,A1:A4)', cells)).toBe(2010);
    expect(calculate('SUM(A1:B4)', cells)).toBe(64);
    expect(calculate('COUNT(A1:B4)', cells)).toBe(4);
    expect(calculate('COUNTA(A1:B4)', cells)).toBe(7);
    expect(calculate('COUNTIF(A1:B4,">2")', cells)).toBe(3);
    expect(calculate('COUNTIF(A1:B4,"*")', cells)).toBe(2);
    expect(calculate('COUNTIF(A1:B4,"")', cells)).toBe(2);
    expect(calculate('COLUMNS(A1:D4)', cells)).toBe(4);
    expect(() => calculate('SUMPRODUCT(A1:A4,A1:A3)', cells)).toThrow();
});
test('1904 dates, literal strings and unsupported expressions stay distinct', () => {
    expect(evaluateCellFormula('DATE(1904,1,1)', { lookup: () => null, date1904: true })).toBe(0);
    expect(evaluateCellFormula('YEAR(0)', { lookup: () => null, date1904: true })).toBe(1904);
    for (const expression of ['IFERROR(WEBSERVICE("https://example.invalid"),0)', 'IF(TRUE,1,UNKNOWN())', 'Sheet2!A1', '[book.xlsx]Sheet1!A1', 'A1:A30001', 'ZZ1', 'SUM(' + '('.repeat(70) + '1' + ')'.repeat(70) + ')'])
        expect(() => calculate(expression)).toThrow(UnsupportedFormula);
    expect(() => calculate('IFERROR(SEARCH("' + 'a*'.repeat(300) + '","' + 'a'.repeat(3000) + '"),0)')).toThrow(UnsupportedFormula);
    expect(() => calculate('SUMPRODUCT(A1:A4,A1:A3)')).toThrow();
    expect(() => evaluateCellFormula('IFERROR(SUM(A1:A100),0)', { lookup: () => 1, budget: { remaining: 10 } })).toThrow(UnsupportedFormula);
});
test('typed caches, shared references and failures preserve all formula definitions', () => {
    const doc = sheet('<c r="A1" t="s"><v>0</v></c><c r="A2" t="inlineStr"><is><t>001234</t></is></c>' + formula('B1', 'LEFT(A1,2)') + formula('B2', 'MID(A2,2,3)') + formula('C1', 'B1="가상"') + formula('D1', 'IFERROR(1/0,"")') + formula('E1', 'IFERROR(UNKNOWN(),0)') + formula('F1', 'IFERROR(F1,0)') + formula('G1', 'E1+1') + '<c r="H1"><f t="shared" si="0" ref="H1:H2">IF(A1="A1",$J$1,ROW()+$J1)</f><v>999</v></c><c r="H2"><f t="shared" si="0"/><v>999</v></c><c r="J1"><v>10</v></c><c r="J2"><v>20</v></c>');
    const before = elements(doc, 'f').map(f => f.outerHTML);
    expect(recalculateSheet(doc, { sharedStrings: ['가상근로자'] })).toEqual({ calculated: 6, unresolved: 3 });
    expect(elements(doc, 'f').map(f => f.outerHTML)).toEqual(before);
    const cell = (a: string) => elements(doc, 'c').find(c => c.getAttribute('r') === a)!;
    expect(cell('B1').getAttribute('t')).toBe('str');
    expect(elements(cell('B1'), 'v')[0].textContent).toBe('가상');
    expect(elements(cell('B2'), 'v')[0].textContent).toBe('012');
    expect(cell('C1').getAttribute('t')).toBe('b');
    expect(elements(cell('C1'), 'v')[0].textContent).toBe('1');
    expect(elements(cell('D1'), 'v')[0].textContent).toBe('');
    for (const a of ['E1', 'F1', 'G1'])
        expect(elements(cell(a), 'v')).toHaveLength(0);
    expect(elements(cell('H1'), 'v')[0].textContent).toBe('11');
    expect(elements(cell('H2'), 'v')[0].textContent).toBe('22');
});
// Read-only opt-in oracle: an existing workbook saved and recalculated by Microsoft Excel.
// Reports coordinates/counts only. No private cell values or workbooks are committed.
const goldenTest = process.env.EXCEL_FORMULA_GOLDEN ? test : test.skip;
goldenTest('all formula caches agree with the existing native Excel result', async () => {
    const zip = await JSZip.loadAsync(fs.readFileSync(process.env.EXCEL_FORMULA_GOLDEN!));
    const sst = zip.file('xl/sharedStrings.xml');
    const sharedStrings = sst ? elements(xml(await sst.async('string')), 'si').map(si => elements(si, 't').map(t => t.textContent || '').join('')) : [];
    const workbook = xml(await zip.file('xl/workbook.xml')!.async('string'));
    const date1904 = ['1', 'true'].includes(elements(workbook, 'workbookPr')[0]?.getAttribute('date1904') || '');
    const differences: string[] = [];
    let calculated = 0, unresolved = 0, total = 0;
    for (const entry of Object.values(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name))) {
        const doc = xml(await entry.async('string'));
        const caches = new Map(elements(doc, 'c').filter(c => elements(c, 'f').length).map(c => [c.getAttribute('r')!, { type: c.getAttribute('t') || 'n', value: elements(c, 'v')[0]?.textContent ?? null }]));
        const result = recalculateSheet(doc, { sharedStrings, date1904, today: new Date(2026, 8, 16) });
        calculated += result.calculated;
        unresolved += result.unresolved;
        total += caches.size;
        for (const cell of elements(doc, 'c')) {
            const address = cell.getAttribute('r')!, before = caches.get(address);
            if (!before)
                continue;
            const after = { type: cell.getAttribute('t') || 'n', value: elements(cell, 'v')[0]?.textContent ?? null };
            const same = before.type === after.type && (before.value === after.value || (before.type === 'n' && before.value !== null && after.value !== null && Math.abs(Number(before.value) - Number(after.value)) <= Math.max(1e-8, Math.abs(Number(before.value)) * 1e-12)));
            if (!same)
                differences.push(`${entry.name}!${address}`);
        }
    }
    const report = { total, calculated, unresolved, differences };
    fs.mkdirSync('.codex-artifacts/excel-converter', { recursive: true });
    fs.writeFileSync('.codex-artifacts/excel-converter/formula-golden-verification.json', JSON.stringify(report, null, 2));
    expect({ total, calculated, unresolved, differences }).toEqual({ total: 4577, calculated: 4577, unresolved: 0, differences: [] });
}, 180000);
