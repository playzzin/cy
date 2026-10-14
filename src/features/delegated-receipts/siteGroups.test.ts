import type { DelegatedClaim } from './model';
import { groupClaimsBySite } from './siteGroups';
import type { ReceiptDirectory } from './teamDirectory';

const base: DelegatedClaim = { id: 'c1', month: '2026-10', siteName: '가상 현장', workerName: '작업자 나', delegationType: 'delegate', paymentMethod: 'transfer', grossAmount: 1000, expectedAmount: 900, receipts: [], sourceStatus: '', sourceLabel: '', memo: '', updatedAt: '' };
const directory: ReceiptDirectory = { sites: [{ id: 's1', name: '가상 현장', responsibleTeamId: 't1' }], teams: [{ id: 't1', name: '가상팀', color: '#336699' }, { id: 't2', name: '다른팀', color: '#774488' }] };

it('식별자가 있는 등록과 현장명이 유일한 엑셀 내역을 함께 묶고 원본 행을 모두 보존한다', () => {
    const rows = [base, { ...base, id: 'c2', siteId: 's1', workerName: '작업자 가' }, { ...base, id: 'c3', siteName: '가상현장', workerName: '작업자 가' }];
    const grouped = groupClaimsBySite(rows, directory);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ name: '가상 현장', color: '#336699', teamName: '가상팀' });
    expect(grouped[0].claims.map(row => row.id)).toEqual(['c2', 'c3', 'c1']);
    expect(rows.map(row => row.id)).toEqual(['c1', 'c2', 'c3']);
});
it('이름이 같은 다른 현장 ID, 모호한 엑셀 현장, 다른 귀속월을 합치지 않는다', () => {
    const ambiguous = { ...directory, sites: [...directory.sites, { id: 's2', name: '가상 현장', responsibleTeamId: 't2' }] };
    const grouped = groupClaimsBySite([{ ...base, siteId: 's1' }, { ...base, id: 'c2', siteId: 's2' }, { ...base, id: 'c3' }, { ...base, id: 'c4', month: '2026-11', siteId: 's1' }], ambiguous);
    expect(grouped).toHaveLength(4);
    expect(grouped.flatMap(group => group.claims)).toHaveLength(4);
});
it('서로 충돌하는 팀 연결은 특정 팀 색으로 추정하지 않는다', () => {
    const grouped = groupClaimsBySite([base, { ...base, id: 'c2', assignedTeamId: 't2' }], directory);
    expect(grouped[0].color).toBe('#94a3b8');
    expect(grouped[0].teamName).toBeUndefined();
});
