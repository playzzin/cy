import { ensureTeamPersonnelMenu, TEAM_PERSONNEL_MENU_ITEMS } from './teamPersonnelMenu';
import type { SiteDataType } from '../types/menu';

const makeConfig = (): SiteDataType => ({
    admin: { name: '관리자', icon: '', menu: [], positionConfig: [{ id: 'dynamic', name: '팀장', icon: '', color: '', order: 0 }] },
    pos_dynamic: { name: '사용자 지정 표시명', icon: '', menu: [{ id: 'people', text: '인원관리', sub: [
        { id: 'workers', text: '인원현황', path: '/manpower/team-worker-detail', roles: ['팀장'], iconColor: '#123456' },
        { id: 'register', text: '신규 작업자 등록', path: '/manpower/team-worker-requests' },
    ] }] },
    pos_office: { name: '사무실', icon: '', menu: [{ text: '인원관리', path: '/office/workers' }] },
});

test('동적 팀장 직책의 기존 메뉴를 요청 순서대로 나누고 ID, 권한, 다른 직책을 보존한다', () => {
    const config = makeConfig();
    const office = JSON.stringify(config.pos_office);
    ensureTeamPersonnelMenu(config);
    const menu = config.pos_dynamic.menu[0];
    expect(menu.sub?.map(item => typeof item === 'string' ? item : item.text)).toEqual(TEAM_PERSONNEL_MENU_ITEMS.map(item => item.text));
    expect(menu.sub?.[0]).toMatchObject({ id: 'workers', iconColor: '#123456', roles: ['팀장'] });
    expect(menu.sub?.[1]).toMatchObject({ path: '/manpower/team-worker-payslip', roles: ['팀장'] });
    expect(menu.sub?.[2]).toMatchObject({ id: 'register', path: '/manpower/team-worker-requests' });
    expect(JSON.stringify(config.pos_office)).toBe(office);
    const first = JSON.stringify(config);
    ensureTeamPersonnelMenu(config);
    expect(JSON.stringify(config)).toBe(first);
});

test('팀장 이름 기반의 단일 인원관리 링크와 문자열 하위 메뉴도 처리한다', () => {
    const config: SiteDataType = { pos_custom: { name: '팀장', icon: '', menu: [
        { text: '인원관리', path: '/manpower/team-worker-detail', sub: ['신규 작업자 등록'] },
    ] } };
    ensureTeamPersonnelMenu(config);
    expect(config.pos_custom.menu[0].path).toBeUndefined();
    expect(config.pos_custom.menu[0].sub).toHaveLength(3);
});

test('숨김 설정과 관련 없는 사용자 지정 메뉴를 보존한다', () => {
    const config = makeConfig();
    config.pos_dynamic.menu[0].sub!.push({ text: '별도 업무', path: '/custom' });
    (config.pos_dynamic.menu[0].sub![0] as { hide?: boolean }).hide = true;
    ensureTeamPersonnelMenu(config);
    expect(config.pos_dynamic.menu[0].sub?.[1]).toMatchObject({ hide: true });
    expect(config.pos_dynamic.menu[0].sub?.[3]).toEqual({ text: '별도 업무', path: '/custom' });
});
