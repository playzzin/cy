// Keep these stored position aliases in sync with teamSettlementWriterRoles in firestore.rules.
export const TEAM_SETTLEMENT_WRITER_ROLES = [
  'ceo', 'CEO', 'Ceo', 'pos_ceo', '대표', '대표이사', '사장',
  'dev', 'DEV', 'Dev', 'developer', 'DEVELOPER', 'Developer', 'pos_dev', '개발', '개발자',
  'manager', 'MANAGER', 'Manager', 'pos_manager', '매니저', '메니저',
  'manager1', 'manager2', 'manager3', 'MANAGER1', 'MANAGER2', 'MANAGER3',
  'pos_manager1', 'pos_manager2', 'pos_manager3',
  '매니저1', '매니저2', '매니저3', '메니저1', '메니저2', '메니저3',
];

type SettlementProfile = {
  status?: string;
  role?: string;
  position?: string;
  systemRole?: string;
  roles?: string[];
  additionalPositions?: string[];
};

export function canWriteTeamSettlement(profile: SettlementProfile | null | undefined): boolean {
  if (!profile || (profile.status !== undefined && profile.status !== 'active')) return false;
  return [profile.role, profile.position, profile.systemRole,
    ...(Array.isArray(profile.roles) ? profile.roles : []),
    ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : []),
  ].some(role => typeof role === 'string' && TEAM_SETTLEMENT_WRITER_ROLES.includes(role));
}
