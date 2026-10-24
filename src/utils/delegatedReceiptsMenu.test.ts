import { ensureDelegatedReceiptsMenu, DELEGATED_RECEIPTS_MENU } from './delegatedReceiptsMenu';
import { MENU_PATHS } from '../constants/menuPaths';
import type { SiteDataType } from '../types/menu';

it('기존 CEO/재무 메뉴에 연결하고 중복이나 일반 작업자 노출을 만들지 않는다', () => {
    const config: SiteDataType = {
        pos_ceo: { name: 'CEO', icon: '', menu: [{ text: '급여 관리', sub: ['기존 항목'] }] },
        pos_finance: { name: '회계', icon: '', menu: [{ text: '급여관리', sub: [] }] },
        pos_worker: { name: '작업자', icon: '', menu: [{ text: '급여관리', sub: [] }] },
    };
    ensureDelegatedReceiptsMenu(config);
    ensureDelegatedReceiptsMenu(config);
    expect(config.pos_ceo.menu[0].sub).toEqual(['기존 항목', DELEGATED_RECEIPTS_MENU]);
    expect(config.pos_finance.menu[0].sub).toEqual([DELEGATED_RECEIPTS_MENU]);
    expect(config.pos_worker.menu[0].sub).toEqual([]);
    expect(MENU_PATHS[DELEGATED_RECEIPTS_MENU.text]).toBe(DELEGATED_RECEIPTS_MENU.path);
});

it('사용자가 숨기거나 삭제한 메뉴와 이름을 바꾼 기존 경로를 보존한다', () => {
    const config: SiteDataType = {
        admin: { name: '관리자', icon: '', menu: [], deletedItems: [DELEGATED_RECEIPTS_MENU.text] },
        pos_ceo: { name: 'CEO', icon: '', menu: [{ text: '수금관리', path: DELEGATED_RECEIPTS_MENU.path, hide: true }] },
        pos_finance: { name: '회계', icon: '', menu: [], trash: [{ ...DELEGATED_RECEIPTS_MENU }] },
    };
    const before = JSON.stringify(config);
    ensureDelegatedReceiptsMenu(config);
    expect(JSON.stringify(config)).toBe(before);
});

it('기존 문자열·중첩 메뉴의 표시명만 바꾸고 식별자·권한·숨김·사용자 지정 이름을 보존한다', () => {
    const legacy = '위임금 입금 확인';
    const original = { text: legacy, id: 'saved-id', path: `${DELEGATED_RECEIPTS_MENU.path}?view=excel`, hide: true, roles: ['finance'] };
    const config: SiteDataType = {
        pos_ceo: { name: 'CEO', icon: '', menu: [{ text: '급여관리', sub: [original] }] },
        pos_finance: { name: '회계', icon: '', menu: [{ text: '급여관리', sub: [legacy] }] },
        pos_worker: { name: '작업자', icon: '', menu: [{ text: legacy, path: DELEGATED_RECEIPTS_MENU.path }], headerActions: [{ text: legacy }] },
        admin: { name: '관리자', icon: '', menu: [{ text: '급여관리', sub: [] }], trash: [{ text: legacy }] },
        custom: { name: '회계', icon: '', menu: [{ text: '급여관리', sub: [{ text: '내 수금 관리', path: DELEGATED_RECEIPTS_MENU.path }] }] },
    };
    ensureDelegatedReceiptsMenu(config);
    ensureDelegatedReceiptsMenu(config);
    expect(config.pos_ceo.menu[0].sub).toEqual([{ ...original, text: DELEGATED_RECEIPTS_MENU.text }]);
    expect(config.pos_finance.menu[0].sub).toEqual([DELEGATED_RECEIPTS_MENU.text]);
    expect(config.pos_worker.menu[0].text).toBe(DELEGATED_RECEIPTS_MENU.text);
    expect(config.pos_worker.headerActions?.[0].text).toBe(DELEGATED_RECEIPTS_MENU.text);
    expect(config.admin.trash?.[0].text).toBe(DELEGATED_RECEIPTS_MENU.text);
    expect(config.admin.menu[0].sub).toEqual([]);
    expect(config.custom.menu[0].sub).toEqual([{ text: '내 수금 관리', path: DELEGATED_RECEIPTS_MENU.path }]);
    expect(MENU_PATHS[legacy]).toBe(DELEGATED_RECEIPTS_MENU.path);
});

it.each(['위임금 입금 확인', '노무 입금 확인', '/payroll/delegated-receipts'])('%s로 삭제한 메뉴를 다시 만들지 않는다', deleted => {
    const config: SiteDataType = { pos_ceo: { name: 'CEO', icon: '', menu: [{ text: '급여관리', sub: [] }], deletedItems: [deleted] } };
    ensureDelegatedReceiptsMenu(config);
    expect(config.pos_ceo.menu[0].sub).toEqual([]);
    expect(config.pos_ceo.deletedItems).toEqual([deleted]);
});
