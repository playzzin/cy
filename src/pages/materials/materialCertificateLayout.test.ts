import {
    CERTIFICATE_TABLE_BOTTOM, CERTIFICATE_TABLE_HEADER_HEIGHT,
    getMaterialCertificateLayout, wrapCertificateText,
} from './materialCertificateLayout';

const measure = (text: string, fontSize: number) => Array.from(text).reduce((sum, character) => sum + (character.charCodeAt(0) > 255 ? 1 : .65), 0) * fontSize;
const items = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: String(index), category: '동바리', itemName: index % 7 ? '수직재' : '현장별 상세 규격을 함께 확인하는 긴 품명의 자재',
    spec: index % 5 ? `P${index + 1}` : '1,200 × 1,800 × 2,400 mm', unit: 'EA', quantity: 1000 + index, isActive: true,
}));
const details = [
    { label: '입고일자', value: '2026-11-09' }, { label: '차량번호', value: '12가3456' },
    { label: '현장명', value: '검증 현장' }, { label: '임대사', value: '검증 임대사' },
    { label: '현장주소', value: '서울특별시 검증로 123, 검증아파트 101동 지하 2층 자재 하역장', wide: true },
    { label: '임대사 주소', value: '부산광역시 검증대로 456, 자재보관장', wide: true },
    { label: '총품목', value: '40개' }, { label: '총수량', value: '40,780' },
];

it.each([1, 20, 40, 41, 80])('%i품목은 페이지당 40개 이하로 누락 없이 A4 표 영역에 들어간다', count => {
    const layout = getMaterialCertificateLayout(items(count), details, measure);
    expect(layout.pages).toHaveLength(Math.ceil(count / 40));
    expect(layout.pages.flatMap(page => page.tables.flatMap(table => table.rows.map(row => Number(row.cells[0][0]))))).toEqual(Array.from({ length: count }, (_, index) => index + 1));
    layout.pages.forEach(page => {
        expect(page.tables.flatMap(table => table.rows).length).toBeLessThanOrEqual(40);
        expect(page.fontSize).toBeGreaterThanOrEqual(16);
        page.tables.forEach(table => {
            expect(layout.tableTop + CERTIFICATE_TABLE_HEADER_HEIGHT + table.rows.reduce((sum, row) => sum + row.height, 0)).toBeLessThanOrEqual(CERTIFICATE_TABLE_BOTTOM + .01);
            table.rows.forEach(row => row.cells.forEach((lines, column) => lines.forEach(line => {
                expect(measure(line, page.fontSize)).toBeLessThanOrEqual(table.columns[column] - 20 + .01);
            })));
        });
    });
});

it('긴 문장과 줄바꿈은 생략하지 않고 줄을 나눈다', () => {
    const text = '긴 품명과 규격을 빠짐없이 표시합니다';
    expect(wrapCertificateText(text, 80, 20, measure).join('')).toBe(text);
    expect(wrapCertificateText('첫째\n둘째', 300, 20, measure)).toEqual(['첫째', '둘째']);
    expect(wrapCertificateText('1,200 × 1,800 mm', 90, 20, measure).some(line => line.includes('1,800'))).toBe(true);
});

it('많은 품목은 간격을 줄이고 적은 품목은 읽기 편한 크기를 유지한다', () => {
    const sparse = getMaterialCertificateLayout(items(2), details, measure).pages[0];
    const dense = getMaterialCertificateLayout(items(40), details, measure).pages[0];
    expect(sparse.tables).toHaveLength(1);
    expect(sparse.fontSize).toBeGreaterThanOrEqual(dense.fontSize);
    expect(dense.fontSize).toBeGreaterThanOrEqual(16);
});

it('짧은 40품목은 한 표로 유지하고 긴 품목으로 작아질 때만 두 표를 사용한다', () => {
    const simple = items(40).map(item => ({ ...item, itemName: '수직재', spec: 'P17' }));
    expect(getMaterialCertificateLayout(simple, details, measure).pages[0].tables).toHaveLength(1);
    expect(getMaterialCertificateLayout(items(40), details, measure).pages[0].tables).toHaveLength(2);
});
