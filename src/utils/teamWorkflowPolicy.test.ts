import { isRestrictedTeamLeader, teamWorkflowDestination, hideTeamWorkflowLink } from './teamWorkflowPolicy';
import { ensureTeamPersonnelMenu } from './teamPersonnelMenu';
import type { SiteDataType } from '../types/menu';
test('현재 역할과 동적 직책을 판정하고 사무실 겸직 권한은 보존한다', () => {
    expect(isRestrictedTeamLeader({ role: 'user', position: 'pos_dynamic' }, [{ id: 'dynamic', name: '팀장' }])).toBe(true);
    expect(isRestrictedTeamLeader({ role: 'user', position: '팀장', accountType: 'office' })).toBe(false);
    expect(isRestrictedTeamLeader({ role: 'admin', position: '팀장' })).toBe(false);
    expect(isRestrictedTeamLeader({ role: 'user', position: '일반' })).toBe(false);
});
test('쿼리로 입력 탭을 우회하지 못하고 기존 조회는 근무내역으로 안내한다', () => {
    for (const path of ['/reports/daily?tab=input', '/reports/daily?tab=list-v2', '/reports/daily?tab=board-input', '/assignment/off-duty-request/', '/database/manpower-db?tab=workers']) expect(teamWorkflowDestination(path)).toBe('blocked');
    expect(teamWorkflowDestination('/manpower/team-worker-daily-report')).toBe('work');
    expect(teamWorkflowDestination('/reports/daily-worker-calendar')).toBe('work');
    for (const path of ['/payroll/advance-request', '/manpower/team-worker-payslip', '/manpower/team-worker-requests', '/manpower/team-account-approvals']) expect(teamWorkflowDestination(path)).toBeNull();
    expect(hideTeamWorkflowLink({ text: '보드입력' })).toBe(true);
});
test('문자열·별칭·저장된 링크를 팀장 메뉴에서만 제거하고 재보정해도 복원하지 않는다', () => {
    const config: SiteDataType = {
        pos_teamleader: { name: '팀장', icon: '', menu: [{ text: '인원관리', sub: ['출력일보', '개인달력', { text: '별칭', path: '/reports/daily?tab=input' }, { text: '작업자정보', path: '/manpower/team-worker-detail' }] }, { text: '휴무신청' }] },
        pos_office: { name: '사무실', icon: '', menu: [{ text: '일보작성', path: '/reports/daily?tab=input' }] },
    };
    ensureTeamPersonnelMenu(config); const first = JSON.stringify(config); ensureTeamPersonnelMenu(config);
    expect(JSON.stringify(config)).toBe(first);
    expect(JSON.stringify(config.pos_teamleader)).not.toMatch(/출력일보|개인달력|휴무신청|tab=input/);
    expect(config.pos_office.menu[0].text).toBe('일보작성');
});
