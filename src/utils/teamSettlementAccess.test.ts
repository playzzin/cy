import { canWriteTeamSettlement, TEAM_SETTLEMENT_WRITER_ROLES } from './teamSettlementAccess';

test.each(TEAM_SETTLEMENT_WRITER_ROLES)('%s 직책은 활성 계정에서만 쓰기를 허용한다', role => {
  for (const profile of [{ role }, { position: role }, { systemRole: role }, { roles: [role] }, { additionalPositions: [role] }]) {
    expect(canWriteTeamSettlement(profile)).toBe(true);
    expect(canWriteTeamSettlement({ ...profile, status: 'active' })).toBe(true);
    for (const status of ['pending', 'rejected', 'suspended']) {
      expect(canWriteTeamSettlement({ ...profile, status })).toBe(false);
    }
  }
});

test.each(['admin', '관리자', '실장', 'owner', 'jhl2VTnk9V3C4EiZ4QQI', 'PAYROLL_MANAGER', 'finance', 'office', '팀장', 'site_manager', 'user', ''])('%s만으로 쓰기를 허용하지 않는다', role => {
  expect(canWriteTeamSettlement({ role, position: role, additionalPositions: [role] })).toBe(false);
});

test('미확인 프로필은 차단하고 추가 매니저 직책은 허용한다', () => {
  expect(canWriteTeamSettlement(null)).toBe(false);
  expect(canWriteTeamSettlement(undefined)).toBe(false);
  expect(canWriteTeamSettlement({ role: 'user', additionalPositions: ['manager'] })).toBe(true);
});
