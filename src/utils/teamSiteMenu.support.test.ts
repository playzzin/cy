import { ensureTeamPersonnelMenu } from './teamPersonnelMenu';
import { hideTeamWorkflowLink } from './teamWorkflowPolicy';

test('팀장 현장관리에서 현장정보와 지원 공수 출력일보를 연결한다', () => {
    const config: any = { admin: { positionConfig: [{ id: 'lead', name: '팀장' }] }, pos_lead: { name: '팀장', menu: [] } };
    ensureTeamPersonnelMenu(config);
    ensureTeamPersonnelMenu(config);
    const groups = config.pos_lead.menu.filter((item: any) => item.text === '현장관리');
    expect(groups).toHaveLength(1);
    expect(groups[0].sub.map((item: any) => item.path)).toEqual(['/manpower/site-responsible-detail', '/manpower/site-daily-report']);
    expect(hideTeamWorkflowLink(groups[0].sub[1])).toBe(false);
    expect(hideTeamWorkflowLink({ text: '출력일보', path: '/reports/daily' })).toBe(true);
});
