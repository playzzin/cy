import { getContainedPhotoRect, getOutboundPhotoPageLayouts } from './materialOutboundCertificateExport';
import { buildMaterialRentalCompanyOptions } from './materialRentalCompanyOptions';

it('1~40장의 사진이 빠짐없이 최대 두 페이지, 페이지당 20장 이하로 배치된다', () => {
    expect(getOutboundPhotoPageLayouts(0)).toEqual([]);
    for (let count = 1; count <= 40; count += 1) {
        const pages = getOutboundPhotoPageLayouts(count);
        expect(pages.length).toBeLessThanOrEqual(2);
        expect(pages.flatMap(page => Array.from({ length: page.count }, (_, index) => page.start + index))).toEqual(Array.from({ length: count }, (_, index) => index));
        pages.forEach(page => {
            expect(page.count).toBeLessThanOrEqual(20);
            expect(page.columns * page.rows).toBeGreaterThanOrEqual(page.count);
        });
    }
    expect(getOutboundPhotoPageLayouts(40).map(page => page.count)).toEqual([20, 20]);
    expect(() => getOutboundPhotoPageLayouts(41)).toThrow('최대 40장');
});

it.each([[1600, 900], [900, 1600], [1200, 1200]])('사진 %s×%s는 잘리거나 늘어나지 않고 셀 중앙에 들어간다', (width, height) => {
    const rect = getContainedPhotoRect(width, height, 240, 270);
    expect(rect.width / rect.height).toBeCloseTo(width / height);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(240);
    expect(rect.y + rect.height).toBeLessThanOrEqual(270);
    expect(rect.x * 2 + rect.width).toBeCloseTo(240);
    expect(rect.y * 2 + rect.height).toBeCloseTo(270);
});

it('임대사 주소는 회사 원본 또는 정산 대상에 연결된 회사에서 가져온다', () => {
    const options = buildMaterialRentalCompanyOptions([
        { id: 'rental', code: 'R1', name: '가 임대사', type: '임대사', address: ' 서울시 검증로 1 ' },
        { id: 'linked', code: 'C1', name: '연결 회사', type: '협력사', address: '부산시 검증로 2' },
    ], [{ id: 'target', name: '나 임대사', companyId: 'linked', targetType: 'rental_company' }]);
    expect(options).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'rental', address: '서울시 검증로 1' }),
        expect.objectContaining({ id: 'settlementTarget:target', address: '부산시 검증로 2' }),
    ]));
});
