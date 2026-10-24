import { DelegatedClaim, getClaimTotals } from './model';
import { getDelegation, getDepositState, getDisplayRemaining, interpretSource } from './depositState';
import { getSiteTeam, getWorkerColor, getWorkerTeam, getRecipientLabels, getBulkRecipientLabels, recipientDetail, validTeamColor, ReceiptDirectory } from './teamDirectory';
const claim = (changes: Partial<DelegatedClaim> = {}): DelegatedClaim => ({ id: 'test', month: '2026-09', siteName: '가상 현장', workerName: '가상 작업자', delegationType: 'unknown', paymentMethod: 'unknown', grossAmount: 100000, expectedAmount: null, receipts: [], sourceStatus: '', sourceLabel: '', memo: '', updatedAt: '', ...changes });

it('작업자의 팀 ID를 우선하고 이름만 있는 기존 자료는 하나의 팀과 일치할 때만 연결한다', () => {
  const directory = { sites: [], teams: [{ id: 't1', name: '가상 팀' }, { id: 't2', name: '다른 팀' }] };
  expect(getWorkerTeam({ id: 'w', name: '가상', teamId: 't2', teamName: '가상 팀' }, directory)?.id).toBe('t2');
  expect(getWorkerTeam({ id: 'w', name: '가상', teamName: ' 가상팀 ' }, directory)?.id).toBe('t1');
  expect(getWorkerTeam({ id: 'w', name: '가상', teamId: 'removed', teamName: '가상 팀' }, directory)).toBeUndefined();
  expect(getWorkerTeam({ id: 'w', name: '가상', teamName: '가상 팀' }, { ...directory, teams: [...directory.teams, { id: 't3', name: '가상팀' }] })).toBeUndefined();
});

it('기존 병합 표시도 완료·계좌·위임을 해석하며 입금액과 잔액은 만들지 않는다', () => {
  const row = claim({ sourceStatus: '그룹 표시 G11:G15: 이재욱 위임 입금 완료 (개별 확인 필요)' });
  expect(getDepositState(row)).toMatchObject({ status: 'complete', recipient: 'jaewook_leader', basis: '엑셀 공동 표시' });
  expect(getDelegation(row)).toBe('delegate');
  expect(getClaimTotals(row)).toMatchObject({ received: 0, remaining: null });
  expect(getDisplayRemaining({ ...row, expectedAmount: 100000 })).toBeNull();
});
it.each(['미입금', '위임 입금 전', '입금 예정'])('%s는 미수 상태로 해석한다', value => expect(interpretSource(value).status).toBe('pending'));
it.each(['입금완료?', '입금완료 취소', '입금완료 아님', '입금 여부 확인 필요', '개인 통장', '', '미완료', '입금완료 예정'])('%s를 완료로 추측하지 않는다', value => expect(interpretSource(value).status).toBe('unknown'));
it('입금 구분이나 계좌 정보만으로 입금완료를 만들지 않는다', () => {
  expect(interpretSource('개인 통장')).toMatchObject({ recipient: 'personal', status: 'unknown' });
  expect(interpretSource('가상팀장 위임 입금 완료')).toMatchObject({ recipient: 'site_leader', status: 'complete' });
  expect(interpretSource('위임 입금 완료').recipient).toBe('unknown');
  expect(interpretSource('직불 통장').delegation).toBe('direct');
});
it('직접 확인한 수정 상태를 원본보다 우선하고 금액 기록은 유지한다', () => {
  const row = claim({ sourceStatus: '입금완료', confirmation: { id: 'confirm', status: 'pending', recipient: 'personal', recordedAt: '2026-10-12T00:00:00Z', note: '표시 정정' } });
  expect(getDepositState(row)).toMatchObject({ status: 'pending', recipient: 'personal', basis: '직접 확인' });
  expect(row.sourceStatus).toBe('입금완료');
});
it('원본 상태가 없으면 실제 기록과 기준액으로 분할·완료를 구분한다', () => {
  const row = claim({ expectedAmount: 100, receipts: [{ id: 'r', amount: 100, date: '2026-10-11', method: 'transfer', memo: '', createdAt: '' }] });
  expect(getDepositState(row).status).toBe('complete');
  expect(getDepositState({ ...row, expectedAmount: 200 }).status).toBe('partial');
  expect(getDepositState(claim({ expectedAmount: 0 })).status).toBe('unknown');
});
const directory: ReceiptDirectory = { teams: [{ id: 'a', name: '가상 팀', color: '#ff0000', leaderName: '가상 팀장' }, { id: 'b', name: '이재욱팀', color: '#00ff00', leaderName: '이재욱' }], sites: [{ id: 's', name: '가상현장', responsibleTeamId: 'a' }] };
it('현장 담당 팀에 맞춰 계좌명을 표시하고 다른 현장을 함께 고르면 각 현장 기준으로 안내한다', () => {
  expect(getRecipientLabels(claim(), directory)).toMatchObject({ personal: '개인통장', site_leader: '가상 팀 팀장계좌', jaewook_leader: '이재욱 위임' });
  expect(getRecipientLabels(claim({ assignedTeamId: 'b' }), directory).site_leader).toBe('이재욱팀 팀장계좌');
  expect(getRecipientLabels(claim({ siteName: '미연결 현장' }), directory).site_leader).toBe('현장 담당 팀장계좌');
  expect(getBulkRecipientLabels([claim(), claim({ id: 'two' })], directory).site_leader).toBe('가상 팀 팀장계좌');
  expect(getBulkRecipientLabels([claim(), claim({ assignedTeamId: 'b' })], directory).site_leader).toBe('각 현장 담당 팀장계좌');
});
it('정확히 연결된 현장 팀의 색상과 계좌 주체를 사용하고 수동 연결을 우선한다', () => {
  expect(getSiteTeam(claim(), directory)?.color).toBe('#ff0000');
  expect(getSiteTeam(claim({ assignedTeamId: 'b' }), directory)?.color).toBe('#00ff00');
  expect(recipientDetail(claim(), 'site_leader', directory)).toBe('가상 팀 · 가상 팀장');
  expect(recipientDetail(claim(), 'jaewook_leader', directory)).toBe('이재욱팀 · 이재욱');
  expect(getSiteTeam(claim({ siteName: '비슷한 가상 현장' }), directory)).toBeUndefined();
  expect(getSiteTeam(claim(), { ...directory, sites: [...directory.sites, { ...directory.sites[0], id: 's2' }] })).toBeUndefined();
  expect(validTeamColor('url(unsafe)')).toBe('#94a3b8');
});

it('작업자 개인 색상은 현장 담당 팀이나 수동 팀 연결의 색상과 독립적이다', () => {
  const people = { ...directory, workers: [{ id: 'worker-a', name: '가상작업자', color: '#123456' }] };
  expect(getWorkerColor(claim(), people)).toBe('#123456');
  expect(getWorkerColor(claim({ assignedTeamId: 'b' }), people)).toBe('#123456');
  expect(getSiteTeam(claim(), people)?.color).toBe('#ff0000');
});

it('동명이인·미등록·색상 미설정 작업자는 현장 팀의 색상을 빌리지 않는다', () => {
  const people = { ...directory, workers: [{ id: 'a', name: '가상 작업자', color: '#123456' }, { id: 'b', name: '가상작업자', color: '#654321' }] };
  expect(getWorkerColor(claim(), people)).toBe('#94a3b8');
  expect(getWorkerColor(claim(), directory)).toBe('#94a3b8');
  expect(getWorkerColor(claim(), { ...directory, workers: [{ id: 'a', name: '가상 작업자' }] })).toBe('#94a3b8');
  expect(getWorkerColor(claim(), { ...directory, workers: [{ id: 'a', name: '가상 작업자', color: 'url(unsafe)' }] })).toBe('#94a3b8');
});

it('직접 선택한 ID는 동명이인·같은 현장명이 있어도 정확한 색상을 연결한다', () => {
  const directory = { teams: [{ id: 't1', name: '팀 1', color: '#112233' }, { id: 't2', name: '팀 2', color: '#445566' }], sites: [{ id: 's1', name: '동일 현장', responsibleTeamId: 't1' }, { id: 's2', name: '동일 현장', responsibleTeamId: 't2' }], workers: [{ id: 'w1', name: '동명이인', color: '#123456' }, { id: 'w2', name: '동명이인', color: '#654321' }] };
  const claim = { id: 'manual', month: '2026-10', siteId: 's2', workerId: 'w2', siteName: '동일 현장', workerName: '동명이인' } as DelegatedClaim;
  expect(getWorkerColor(claim, directory)).toBe('#654321');
  expect(getSiteTeam(claim, directory)?.id).toBe('t2');
});
