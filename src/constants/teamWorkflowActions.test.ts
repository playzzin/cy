import { TEAM_HISTORY_PATH, TEAM_REQUESTS_PATH, TEAM_SITE_PATH, TEAM_REQUEST_ACTIONS } from './teamWorkflowActions';
import { ensureTeamPersonnelMenu } from '../utils/teamPersonnelMenu';
import { previewMenuAllowsPath } from '../components/developer/DevPreviewRouteGuard';
import { teamWorkflowDestination } from '../utils/teamWorkflowPolicy';
import type { SiteDataType } from '../types/menu';

test('팀장 요청함을 기존 메뉴에 한 번만 등록하고 조회 시점에서도 허용한다', () => {
    const config: SiteDataType = {
        pos_teamleader: { name: '팀장', icon: '', menu: [] },
        pos_office: { name: '사무실', icon: '', menu: [] },
    };
    ensureTeamPersonnelMenu(config);
    const first = JSON.stringify(config);
    ensureTeamPersonnelMenu(config);
    expect(JSON.stringify(config)).toBe(first);
    for (const path of [TEAM_HISTORY_PATH, TEAM_SITE_PATH, TEAM_REQUESTS_PATH]) {
        expect(previewMenuAllowsPath(config.pos_teamleader.menu, path)).toBe(true);
    }
    expect(previewMenuAllowsPath(config.pos_office.menu, TEAM_REQUESTS_PATH)).toBe(false);
    for (const action of TEAM_REQUEST_ACTIONS) expect(teamWorkflowDestination(action.path)).toBeNull();
    expect(TEAM_REQUEST_ACTIONS.map(action => action.path)).toEqual([
        '/manpower/team-worker-requests', '/support/team-expense-requests', '/payroll/advance-request',
    ]);
});

test('기존 등록 메뉴도 허용된 신청 화면이 있으면 요청함을 열 수 있다', () => {
    const menu = [{ text: '경비입력', path: '/support/team-expense-requests' }];
    expect(previewMenuAllowsPath(menu, TEAM_REQUESTS_PATH)).toBe(true);
    expect(previewMenuAllowsPath(menu, '/payroll/advance-payment')).toBe(false);
    expect(previewMenuAllowsPath([], TEAM_REQUESTS_PATH)).toBe(false);
    expect(previewMenuAllowsPath([{ ...menu[0], hide: true }], TEAM_REQUESTS_PATH)).toBe(false);
});
