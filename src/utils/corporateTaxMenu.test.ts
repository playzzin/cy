import { ensureCorporateTaxMenu, CORPORATE_TAX_PATH } from './corporateTaxMenu';
import type { SiteDataType } from '../types/menu';

it('세무관리 하위에 등록하고 기존 장부 권한/숨김을 유지하며 중복 등록하지 않는다', () => {
    const config: SiteDataType = { admin: { name: '검증', icon: '', menu: [{ text: '세무 관리', sub: [{ text: '매입매출관리', path: '/payroll/workbook-ledger', roles: ['세무담당'], hide: true }] }] } };
    ensureCorporateTaxMenu(config); ensureCorporateTaxMenu(config);
    expect(config.admin.menu[0].sub).toHaveLength(2);
    expect(config.admin.menu[0].sub?.[1]).toMatchObject({ text: '법인세 관리', path: CORPORATE_TAX_PATH, roles: ['세무담당'], hide: true });
});
it('세무 접근이 없거나 사용자가 삭제한 메뉴는 추가하지 않는다', () => {
    const config: SiteDataType = { worker: { name: '작업자', icon: '', menu: [{ text: '출력일보' }] },
        admin: { name: '관리자', icon: '', menu: [{ text: '세무관리', sub: [] }], deletedItems: [CORPORATE_TAX_PATH] } };
    ensureCorporateTaxMenu(config);
    expect(config.worker.menu).toHaveLength(1); expect(config.admin.menu[0].sub).toHaveLength(0);
});
it('기존 메뉴의 경로와 설정을 유지하고 이름을 변경한다', () => {
    const config: SiteDataType = { admin: { name: '검증', icon: '', menu: [{ text: '세무관리', sub: [{ id: 'saved-menu', text: '법인세', path: CORPORATE_TAX_PATH, roles: ['세무담당'], hide: true }] }] } };
    ensureCorporateTaxMenu(config); ensureCorporateTaxMenu(config);
    expect(config.admin.menu[0].sub).toEqual([{ id: 'saved-menu', text: '법인세 관리', path: CORPORATE_TAX_PATH, roles: ['세무담당'], hide: true }]);
});
