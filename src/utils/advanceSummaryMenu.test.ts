import { ensureAdvanceSummaryMenu, ADVANCE_SUMMARY_PATH } from './advanceSummaryMenu';
import type { MenuItem, SiteDataType } from '../types/menu';

const config = (menu: MenuItem[]): SiteDataType => ({ admin: { name: '관리자', icon: '', menu } });

test('가불 공제 그룹에 조회 메뉴를 추가하고 입력 메뉴의 접근 범위를 유지한다', () => {
    const data = config([{ text: '가불 및 공제내역', sub: [{ text: '가불등록', path: '/payroll/advance-payment?tab=register', roles: ['admin'], hide: true }] }]);
    ensureAdvanceSummaryMenu(data);
    ensureAdvanceSummaryMenu(data);
    expect(data.admin.menu[0].sub).toHaveLength(2);
    expect(data.admin.menu[0].sub?.[1]).toMatchObject({ path: ADVANCE_SUMMARY_PATH, roles: ['admin'], hide: true });
});

test('기존 단일 입력 링크 바로 뒤에 조회 링크를 넣고 다른 메뉴를 유지한다', () => {
    const data = config([{ text: '숙소관리', sub: ['숙소 관리', '가불등록', '다른 메뉴'] }]);
    ensureAdvanceSummaryMenu(data);
    expect(data.admin.menu[0].sub?.map(item => typeof item === 'string' ? item : item.text))
        .toEqual(['숙소 관리', '가불등록', '팀별 가불내역', '다른 메뉴']);
});

test('조회 메뉴가 이미 있거나 삭제·휴지통에 있으면 다시 만들지 않는다', () => {
    const data = config([{ text: '가불관리', sub: ['가불등록'] }]);
    data.admin.deletedItems = [ADVANCE_SUMMARY_PATH];
    ensureAdvanceSummaryMenu(data);
    expect(data.admin.menu[0].sub).toHaveLength(1);
    data.admin.deletedItems = [];
    data.admin.trash = [{ text: '보관된 조회', path: ADVANCE_SUMMARY_PATH }];
    ensureAdvanceSummaryMenu(data);
    expect(data.admin.menu[0].sub).toHaveLength(1);
});

test('가불 신청만 허용된 메뉴에는 재무 조회 메뉴를 추가하지 않는다', () => {
    const data = config([{ text: '가불관리', sub: ['가불신청'] }]);
    ensureAdvanceSummaryMenu(data);
    expect(data.admin.menu[0].sub).toEqual(['가불신청']);
});
