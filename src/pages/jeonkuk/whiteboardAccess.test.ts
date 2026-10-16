import type { DailyReport } from '../../services/dailyReportService';
import { getTeamScopedRows } from '../../services/teamScopedReadService';
import { loadWhiteboardTeamAccess, scopeWhiteboardReports, WhiteboardTeamAccess } from './whiteboardAccess';

jest.mock('../../services/teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));

const access = {
    teams: [{ id: 'own', legacyId: 'old-team', name: '내 팀' }],
    sites: [],
    workers: [{ id: 'worker', legacyId: 'old-worker', teamId: 'old-team', name: '내 팀원' }],
} as unknown as WhiteboardTeamAccess;
const report = (overrides: object) => ({
    id: 'report', date: '2026-10-01', siteId: 'support-site', siteName: '지원 현장',
    responsibleTeamId: 'other', responsibleTeamName: '담당팀', teamId: 'other',
    totalManDay: 999, totalAmount: 999999, workers: [], ...overrides,
} as DailyReport);

test('소속 작업자의 지원 현장 공수는 기존 ID로도 집계하고 다른 작업자의 금액은 제외한다', () => {
    const rows = scopeWhiteboardReports([report({ workers: [
        { workerId: 'old-worker', teamId: 'other', name: '내 팀원', manDay: 2, unitPrice: 100 },
        { workerId: 'stranger', teamId: 'own', name: '타 팀원', manDay: 97, unitPrice: 900 },
    ] })], access);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ siteId: 'support-site', responsibleTeamId: 'other',
        responsibleTeamName: '담당팀', teamId: '', totalManDay: 2, totalAmount: 200 });
    expect(rows[0].workers).toEqual([expect.objectContaining({ workerId: 'old-worker', teamId: 'own', workerTeamName: '내 팀' })]);
});

test('팀 이름이나 담당 현장이 맞더라도 소속 작업자가 없는 합계는 공개하지 않는다', () => {
    expect(scopeWhiteboardReports([
        report({ teamId: 'own', workers: [] }),
        report({ responsibleTeamId: 'own', workers: [{ workerId: 'stranger', teamId: 'own', manDay: 9 }] }),
    ], access)).toEqual([]);
});

test('서버가 허용한 배정 현장은 담당팀이 달라도 유지하고 타 팀 작업자는 제외한다', async () => {
    const assignedSite = { id: 'assigned', assignedTeamId: 'own', responsibleTeamId: 'other' };
    (getTeamScopedRows as jest.Mock).mockImplementation(async collection => ({
        teams: access.teams, sites: [assignedSite],
        workers: [...access.workers, { id: 'stranger', teamId: 'other' }],
    }[collection as string]));
    const result = await loadWhiteboardTeamAccess();
    expect(result?.sites).toEqual([assignedSite]);
    expect(result?.workers).toEqual(access.workers);
});
