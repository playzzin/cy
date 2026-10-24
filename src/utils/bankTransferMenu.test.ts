import { ensureBankTransferMenu } from './bankTransferMenu';
import type { SiteDataType } from '../types/menu';

it('기존 급여 접근 범위를 유지하고 다시 정규화해도 중복 메뉴를 만들지 않는다', () => {
    const config: SiteDataType = { admin: { name: '검증', icon: '', menu: [{ text: '급여관리', sub: [{ text: '월급제', path: '/payroll/monthly-wage', roles: ['급여담당'], hide: true }] }] } };
    ensureBankTransferMenu(config); ensureBankTransferMenu(config);
    const parent = config.admin.menu[0] as Exclude<typeof config.admin.menu[number], string>;
    expect(parent.sub).toHaveLength(2);
    expect(parent.sub?.[1]).toMatchObject({ path: '/payroll/bank-transfer', roles: ['급여담당'], hide: true });
});

it('사용자가 삭제한 메뉴나 급여 접근이 없는 메뉴에 송금 항목을 추가하지 않는다', () => {
    const config: SiteDataType = {
        admin: { name: '검증', icon: '', menu: [{ text: '월급제', path: '/payroll/monthly-wage' }], deletedItems: ['국민은행 송금'] },
        worker: { name: '작업자', icon: '', menu: [{ text: '출력일보', path: '/reports/daily' }] },
    };
    ensureBankTransferMenu(config);
    expect(config.admin.menu).toHaveLength(1); expect(config.worker.menu).toHaveLength(1);
});
