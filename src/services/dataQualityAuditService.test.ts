import { analyzeErpDataQuality } from './dataQualityAuditService';

describe('analyzeErpDataQuality', () => {
  it('detects broken master references across workers and reports', () => {
    const result = analyzeErpDataQuality({
      today: new Date('2026-06-30T00:00:00.000Z'),
      workers: [
        { id: 'w1', name: '김작업', status: '재직', teamId: 'missing-team', companyId: 'c1' },
      ],
      teams: [{ id: 't1', name: '시공팀', companyId: 'missing-company' }],
      sites: [{ id: 's1', name: 'A현장', status: 'active', responsibleTeamId: 't1' }],
      companies: [{ id: 'c1', name: '청연' }],
      reports: [
        { id: 'r1', date: '2026-06-30', siteId: 'missing-site', teamId: 't1', workers: [{ workerId: 'missing-worker' }], totalManDay: 1 },
      ],
      tasks: [],
    });

    expect(result.critical).toBeGreaterThanOrEqual(2);
    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        'worker-team-missing:w1:missing-team',
        'report-site-missing:r1:missing-site',
        'report-worker-missing:r1:missing-worker:0',
      ])
    );
  });

  it('flags overdue open tasks and unassigned active workers', () => {
    const result = analyzeErpDataQuality({
      today: new Date('2026-06-30T00:00:00.000Z'),
      workers: [{ id: 'w1', name: '박작업', status: '재직' }],
      teams: [],
      sites: [],
      companies: [],
      reports: [],
      tasks: [{ id: 'task1', title: '정산 확인', assignee: '', status: '진행', dueDate: '2026-06-29' }],
    });

    expect(result.warning).toBeGreaterThanOrEqual(3);
    expect(result.issues.map((issue) => issue.title)).toEqual(
      expect.arrayContaining(['재직 작업자 소속 미지정', '업무 담당자 미지정', '업무 SLA 지연'])
    );
  });
});
