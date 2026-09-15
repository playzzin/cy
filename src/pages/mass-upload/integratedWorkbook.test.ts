import * as XLSX from 'xlsx';
import { MASTER_DEFINITIONS, MASTER_TYPES, MasterType } from './masterDataImport';
import { readIntegratedWorkbook, WorkbookSection } from './integratedWorkbook';

const sections = Object.fromEntries(MASTER_TYPES.map(type => [type, { name: MASTER_DEFINITIONS[type].sheetName, ...MASTER_DEFINITIONS[type] }])) as unknown as Record<MasterType, WorkbookSection>;
const workbook = (sheets: Record<string, unknown[][]>) => {
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name));
    return wb;
};

test('reads every sheet including repeated entity types and preserves text account numbers', () => {
    const result = readIntegratedWorkbook(workbook({ 작업자: [['이름', '계좌번호'], ['예시1', '000123456789012345']], '작업자_추가': [['성명'], ['예시2']], Teams: [['팀명'], ['예시팀']] }), sections);
    expect(result.issues).toEqual([]);
    expect(result.data.Worker).toHaveLength(2);
    expect(result.data.Worker[0].계좌번호).toBe('000123456789012345');
    expect(result.summaries.map(s => s.rows)).toEqual([1, 1, 1]);
    expect(result.sources.get(result.data.Worker[1])).toBe('작업자_추가 2행');
});

test('does not silently discard unknown sheets, columns, unnamed columns or duplicate headers', () => {
    const result = readIntegratedWorkbook(workbook({ 메모데이터: [['이름'], ['예시']], 작업자: [['이름', '이름', '오타', ''], ['예시', '다른값', '값', '값']] }), sections);
    expect(result.issues.join(' ')).toMatch(/분류하지 못/);
    expect(result.issues.join(' ')).toMatch(/중복 열 제목/);
    expect(result.issues.join(' ')).toMatch(/인식하지 못한 열: 오타/);
    expect(result.issues.join(' ')).toMatch(/제목없는열/);
});

test('guide and empty template sheets are not imported', () => {
    const result = readIntegratedWorkbook(workbook({ 가이드: [['항목'], ['이름']], 작업자: [['이름']] }), sections);
    expect(result.data.Worker).toHaveLength(0);
    expect(result.issues).toEqual(['등록할 데이터가 없습니다. 양식의 시트명과 첫 행의 열 제목을 확인하세요.']);
});

test('rejects lossy numeric identifiers and captures source row', () => {
    const result = readIntegratedWorkbook(workbook({ 작업자: [['이름', '계좌번호'], ['예시', 12345678901234560]] }), sections);
    expect(result.issues[0]).toMatch(/작업자 2행.*정밀도/);
});

test('recognizes distinct team, worker and office staff sheet names', () => {
    const result = readIntegratedWorkbook(workbook({ 팀: [['팀명'], ['예시팀']], 작업자: [['이름'], ['예시']], 사무실직원: [['이름'], ['직원']], 정산대상자: [['이름'], ['대상자']] }), sections);
    expect(result.issues).toEqual([]);
    expect(result.data.Team).toHaveLength(1);
    expect(result.data.Worker).toHaveLength(1);
    expect(result.data.OfficeStaff).toHaveLength(1);
    expect(result.data.SettlementTarget).toHaveLength(1);
});
