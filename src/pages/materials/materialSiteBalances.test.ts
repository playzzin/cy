import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import type { Site } from '../../services/siteService';
import { buildMaterialBalanceExcelRows, buildMaterialBalanceHistory, buildMaterialDailyExcelRows, buildMaterialSiteBalances, flattenMaterialBalanceGroups, groupMaterialBalances, groupMaterialBalanceTransactionsByDate } from './materialBalanceSummary';

const companies: MaterialRentalCompanyOption[] = [{ id: 'r1', name: '가설 A', source: 'company' }, { id: 'r2', name: '가설 B', source: 'company' }];
const siteFixture = (id: string, clientCompanyId: string, clientCompanyName: string): Site => ({
    id, name: `현장 ${id}`, code: id, status: 'active', companyName: '청연이엔지', clientCompanyId, clientCompanyName,
});
const tx = (id: string, quantity: number, overrides: Partial<MaterialTransactionRow> = {}): MaterialTransactionRow => ({
    id, type: 'inbound', transactionDate: '2026-10-01', siteId: 's1', siteName: '현장 A',
    materialId: 'm1', materialKey: '수직재::2m', category: '동바리', itemName: '수직재', spec: '2m', unit: 'EA',
    rentalCompanyId: 'r1', rentalCompanyName: '가설 A', quantity, registeredBy: 'fixture', registeredByName: '검증', ...overrides,
} as MaterialTransactionRow);

it('날짜별로 입출고를 묶으면서 자재·단위별 거래 후 잔량과 0 잔량 기록을 보존한다', () => {
    const rows = buildMaterialSiteBalances([
        tx('a', 10), tx('b', 3, { transactionDate: '2026-10-02' }),
        tx('c', 13, { type: 'outbound', transactionDate: '2026-10-02' }),
        tx('set', 2, { unit: 'SET', transactionDate: '2026-10-02' }),
        tx('other', 20, { materialKey: '수평재::1m', itemName: '수평재', spec: '1m', transactionDate: '2026-10-02' }),
    ], companies, '2026-11-09');
    const days = groupMaterialBalanceTransactionsByDate(rows);
    expect(days.map(day => day.date)).toEqual(['2026-10-02', '2026-10-01']);
    expect(days[0]).toMatchObject({ inboundCount: 3, outboundCount: 1 });
    expect(Object.fromEntries(days[0].entries.map(entry => [entry.transaction.id, entry.balance])))
        .toEqual({ b: 13, c: 0, set: 2, other: 20 });
    expect(days[1].entries[0].balance).toBe(10);
    expect(groupMaterialBalanceTransactionsByDate([])).toEqual([]);
});

it('현장·임대사 전환 시 동일 거래를 한 번씩 내보내며 각 묶음에서 날짜 내림차순을 유지한다', () => {
    const rows = buildMaterialSiteBalances([
        tx('a', 10), tx('b', 4, { type: 'outbound', transactionDate: '2026-10-02', vehicleNumber: '검증차량' }),
        tx('c', 7, { siteId: 's2', siteName: '현장 B' }),
        tx('d', 2, { rentalCompanyId: '', rentalCompanyName: '' }),
    ], companies, '2026-11-09');
    const bySite = buildMaterialDailyExcelRows(groupMaterialBalances(rows, 'site'));
    const byRental = buildMaterialDailyExcelRows(groupMaterialBalances(rows, 'rental'));
    expect(bySite).toHaveLength(4);
    expect(byRental).toHaveLength(4);
    expect(byRental.map(row => JSON.stringify(row)).sort()).toEqual(bySite.map(row => JSON.stringify(row)).sort());
    const companyRows = bySite.filter(row => row[1] === '현장 A' && row[2] === '가설 A');
    expect(companyRows.map(row => row[3])).toEqual(['2026-10-02', '2026-10-01']);
    expect(companyRows[0]).toEqual(['건설사 미지정', '현장 A', '가설 A', '2026-10-02', '출고', '동바리', '수직재', '2m', 'EA', '', 4, 6, '검증차량', '']);
});

it('현장·임대사·자재·단위별로 누적 잔량을 구분하며 기준일 이후 기록을 제외한다', () => {
    const rows = buildMaterialSiteBalances([
        tx('a', 1000), tx('b', 700, { type: 'outbound', transactionDate: '2026-11-09' }),
        tx('future', 300, { type: 'outbound', transactionDate: '2026-11-10' }),
        tx('r2-in', 500, { rentalCompanyId: 'r2', rentalCompanyName: '가설 B' }),
        tx('r2-out', 100, { type: 'outbound', rentalCompanyId: 'r2', rentalCompanyName: '가설 B' }),
        tx('s2', 200, { siteId: 's2', siteName: '현장 B' }), tx('set', 2, { unit: 'SET' }),
        tx('spec', 10, { materialKey: '수직재::3m', spec: '3m' }),
    ], companies, '2026-11-09');
    expect(rows).toHaveLength(5);
    expect(rows.find(row => row.siteId === 's1' && row.rentalKey === 'id:r1' && row.unit === 'EA' && row.spec === '2m')).toMatchObject({ inbound: 1000, outbound: 700, balance: 300 });
    expect(rows.find(row => row.rentalKey === 'id:r2')?.balance).toBe(400);
    expect(rows.find(row => row.siteId === 's2')?.balance).toBe(200);
    expect(rows.find(row => row.unit === 'SET')?.balance).toBe(2);
});

it('이름만 있는 과거 거래는 유일한 임대사에 연결하고 미지정은 별도로 남긴다', () => {
    const rows = buildMaterialSiteBalances([
        tx('in', 10), tx('legacy', 3, { type: 'outbound', rentalCompanyId: '', rentalCompanyName: '가설A' }),
        tx('none', 2, { rentalCompanyId: '', rentalCompanyName: '' }),
        tx('unknown', 4, { rentalCompanyId: '', rentalCompanyName: '과거 업체' }),
    ], companies, '2026-11-09');
    expect(rows.find(row => row.rentalKey === 'id:r1')).toMatchObject({ balance: 7, rentalNeedsReview: false });
    expect(rows.find(row => row.rentalKey === 'unassigned')).toMatchObject({ balance: 2, rentalNeedsReview: true });
    expect(rows.find(row => row.rentalKey === 'name:과거업체')).toMatchObject({ balance: 4, rentalNeedsReview: true });
});

it('이름이 같은 서로 다른 회사 ID와 모호한 이름만 있는 기록을 합치지 않는다', () => {
    const rows = buildMaterialSiteBalances([
        tx('a', 10), tx('b', 3, { type: 'outbound', rentalCompanyId: 'r2', rentalCompanyName: '가설 A' }),
        tx('legacy', 2, { rentalCompanyId: '', rentalCompanyName: '가설 A' }),
    ], [{ ...companies[0] }, { ...companies[1], name: '가설 A' }], '2026-11-09');
    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.balance).sort((a, b) => a - b)).toEqual([-3, 2, 10]);
});

it('현재 목록에서 빠진 임대사도 거래 ID로 집계하고 이름 변경을 같은 회사로 처리한다', () => {
    const rows = buildMaterialSiteBalances([tx('a', 10), tx('b', 4, { type: 'outbound', rentalCompanyName: '변경 전 이름' })], [], '2026-11-09');
    expect(rows).toHaveLength(1);
    expect(rows[0].balance).toBe(6);
});

it('소수 수량의 0 잔량, 음수 잔량 및 날짜순 누계와 엑셀 수치를 보존한다', () => {
    const rows = buildMaterialSiteBalances([
        tx('out', .3, { type: 'outbound', transactionDate: '2026-10-03' }),
        tx('in2', .2, { transactionDate: '2026-10-02' }), tx('in1', .1),
        tx('negative', 5, { type: 'outbound', rentalCompanyId: 'r2', rentalCompanyName: '가설 B' }),
    ], companies, '2026-11-09');
    const zero = rows.find(row => row.rentalKey === 'id:r1')!;
    expect(zero.balance).toBe(0);
    expect(buildMaterialBalanceHistory(zero).map(row => row.balance)).toEqual([.1, .3, 0]);
    const negative = rows.find(row => row.rentalKey === 'id:r2')!;
    expect(negative.balance).toBe(-5);
    expect(buildMaterialBalanceExcelRows([negative], '2026-11-09')[0]).toEqual([
        '2026-11-09', '건설사 미지정', '현장 A', '가설 B', '동바리', '수직재', '2m', 'EA', 0, 5, -5, '출고 초과',
    ]);
});

it('건설사→현장→임대사와 임대사→건설사→현장 계층에 모든 거래를 한 번씩 배치한다', () => {
    const rows = buildMaterialSiteBalances([
        tx('a', 10), tx('b', 3, { rentalCompanyId: 'r2', rentalCompanyName: '가설 B' }),
        tx('c', 7, { siteId: 's2', siteName: '현장 B' }), tx('unit', 2, { unit: 'SET' }),
        tx('negative', 4, { type: 'outbound', siteId: 's3', siteName: '현장 C' }),
    ], companies, '2026-11-09', [siteFixture('s1', 'c1', '건설 A'), siteFixture('s2', 'c1', '건설 A'), siteFixture('s3', 'c2', '건설 B')]);
    const site = groupMaterialBalances(rows, 'site');
    const rental = groupMaterialBalances(rows, 'rental');
    expect(site.map(group => [group.name, group.children.map(child => child.name), group.itemCount])).toEqual([
        ['건설 A', ['현장 A', '현장 B'], 4], ['건설 B', ['현장 C'], 1],
    ]);
    expect(rental.map(group => [group.name, group.children.map(child => child.name), group.itemCount])).toEqual([
        ['가설 A', ['건설 A', '건설 B'], 4], ['가설 B', ['건설 A'], 1],
    ]);
    for (const groups of [site, rental]) {
        const displayed = flattenMaterialBalanceGroups(groups);
        expect(displayed).toHaveLength(rows.length);
        expect(new Set(displayed)).toEqual(new Set(rows));
        expect(displayed.find(row => row.siteId === 's3')?.balance).toBe(-4);
    }
    expect(site[0].children[0].children.map(child => child.name)).toEqual(['가설 A', '가설 B']);
    expect(rental[0].children[0].children.map(child => child.name)).toEqual(['현장 A', '현장 B']);
});

it('동일한 이름이라도 현장 ID와 임대사 ID가 다르면 묶음을 구분하고 미지정도 유지한다', () => {
    const rows = buildMaterialSiteBalances([
        tx('a', 10), tx('b', 3, { rentalCompanyId: 'r2', rentalCompanyName: '가설 A' }),
        tx('c', 7, { siteId: 's2', siteName: '현장 A' }),
        tx('unassigned', 2, { rentalCompanyId: '', rentalCompanyName: '' }),
    ], [], '2026-11-09');
    const site = groupMaterialBalances(rows, 'site');
    expect(site).toHaveLength(1);
    expect(site[0].name).toBe('건설사 미지정');
    expect(new Set(site[0].children.map(group => group.key)).size).toBe(2);
    const rental = groupMaterialBalances(rows, 'rental');
    expect(rental).toHaveLength(3);
    expect(rental.filter(group => group.name === '가설 A')).toHaveLength(2);
    expect(rental.find(group => group.name === '임대사 미지정')?.children[0].children[0].rows[0].balance).toBe(2);
    expect(groupMaterialBalances([], 'rental')).toEqual([]);
});

it('건설사 ID가 다른 동명 업체는 분리하고 이름만 있는 현장은 유일한 연결일 때만 합친다', () => {
    const sourceSites = [siteFixture('s1', 'c1', '동명건설'), siteFixture('s2', 'c2', '동명건설'),
        siteFixture('s3', '', '동명건설'), siteFixture('s4', '', ''),
        siteFixture('s5', 'c3', '유일건설'), siteFixture('s6', '', '유일 건설')];
    const rows = buildMaterialSiteBalances(sourceSites.map((site, i) => tx(String(i), 1, { siteId: site.id!, siteName: site.name })), companies, '2026-11-09', sourceSites);
    expect(rows.map(row => row.constructionKey)).toEqual(['id:c1', 'id:c2', 'name:동명건설', 'unassigned', 'id:c3', 'id:c3']);
    const groups = groupMaterialBalances(rows, 'site');
    expect(groups).toHaveLength(5);
    expect(groups.filter(group => group.name === '동명건설')).toHaveLength(3);
    expect(groups.find(group => group.name === '유일건설')?.children).toHaveLength(2);
    expect(groups.some(group => group.name === '청연이엔지')).toBe(false);
});
