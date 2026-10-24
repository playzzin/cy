import { ensureTeamPersonnelMenu, TEAM_PERSONNEL_MENU_ITEMS, TEAM_SITE_MENU_ITEMS } from './teamPersonnelMenu';
import { filterTeamWorkflowMenu } from './teamWorkflowPolicy';
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
    expect(menu.sub?.[1]).toMatchObject({ path: '/manpower/team-worker-history', roles: ['팀장'] });
    expect(menu.sub?.[2]).toMatchObject({ path: '/manpower/team-worker-payslip', roles: ['팀장'] });
    expect(menu.sub?.[3]).toMatchObject({ id: 'register', path: '/manpower/team-worker-requests' });
    expect(JSON.stringify(config.pos_office)).toBe(office);
    expect(menu.sub).toContainEqual(expect.objectContaining({ path: '/manpower/summary' }));
    expect(config.pos_dynamic.menu).toContainEqual(expect.objectContaining({ path: '/support/vehicles/oil-cycle' }));
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
    expect(config.pos_custom.menu[0].sub).toHaveLength(6);
});

test('숨김 설정과 관련 없는 사용자 지정 메뉴를 보존한다', () => {
    const config = makeConfig();
    config.pos_dynamic.menu[0].sub!.push({ text: '별도 업무', path: '/custom' });
    (config.pos_dynamic.menu[0].sub![0] as { hide?: boolean }).hide = true;
    ensureTeamPersonnelMenu(config);
    expect(config.pos_dynamic.menu[0].sub?.[1]).toMatchObject({ hide: true });
    expect(config.pos_dynamic.menu[0].sub?.[6]).toEqual({ text: '별도 업무', path: '/custom' });
});

test('기존 현장 링크를 하위 메뉴로 나누고 저장된 ID·권한과 사용자 링크를 보존한다', () => {
    const config = makeConfig();
    config.pos_dynamic.menu.unshift({ id: 'site', text: '현장 관리', path: '/manpower/site-responsible-detail', roles: ['팀장'], sub: [{ id: 'custom', text: '별도 현장 업무', path: '/custom-site' }] });
    config.pos_dynamic.menu[1].sub!.push({ id: 'people-1', text: '급여명세서', path: '/manpower/team-worker-payslip' });
    ensureTeamPersonnelMenu(config);
    const [sites, people] = filterTeamWorkflowMenu(config.pos_dynamic.menu);
    expect(sites).toMatchObject({ id: 'site', text: '현장관리', roles: ['팀장'] });
    expect(sites.path).toBeUndefined();
    expect(sites.sub?.slice(0, 2).map(item => (item as {path:string}).path)).toEqual(TEAM_SITE_MENU_ITEMS.map(item => item.path));
    expect(sites.sub?.[2]).toMatchObject({ id: 'custom' });
    expect(sites.sub?.[1]).toMatchObject({ text: '출력일보', roles: ['팀장'] });
    const ids = people.sub!.map(item => (item as {id:string}).id);
    expect(new Set(ids).size).toBe(ids.length);
    const first = JSON.stringify(config);
    ensureTeamPersonnelMenu(config);
    expect(JSON.stringify(config)).toBe(first);
});
