import type { ConstructionPlanErpSnapshot } from '../types';
import {
  CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
  CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS,
  isConstructionPlanErpRefreshFieldId,
  type ConstructionPlanErpRefreshSlot as ConstructionPlanErpSnapshotSlot,
} from '../types/erpRefresh';

export {
  CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS,
  isConstructionPlanErpRefreshFieldId,
} from '../types/erpRefresh';

export type { ConstructionPlanErpSnapshotSlot };

export type ConstructionPlanErpSnapshotFieldChange = {
  id: string;
  slot: ConstructionPlanErpSnapshotSlot;
  slotLabel: string;
  field: string;
  fieldLabel: string;
  before?: string | string[];
  after?: string | string[];
  sourceId?: string;
  sourceUpdatedAt?: string;
};

type ComparableValue = string | string[] | undefined;

const SLOT_LABELS: Record<ConstructionPlanErpSnapshotSlot, string> = {
  site: '현장',
  clientCompany: '발주처',
  contractorCompany: '원도급사',
  partnerCompany: '협력사',
  responsibleTeam: '담당팀',
};

const SITE_FIELDS = {
  name: '현장명',
  code: '현장코드',
  address: '주소',
  startDate: '착공일',
  endDate: '준공일',
  status: '현장상태',
  responsibleTeamId: '담당팀 ID',
  responsibleTeamName: '담당팀명',
  clientCompanyId: '발주처 ID',
  clientCompanyName: '발주처명',
  contractorCompanyId: '원도급사 ID',
  contractorCompanyName: '원도급사명',
  partnerCompanyId: '협력사 ID',
  partnerCompanyName: '협력사명',
  siteType: '현장유형',
} as const;

const COMPANY_FIELDS = {
  name: '회사명',
  code: '회사코드',
  businessNumber: '사업자등록번호',
  representativeName: '대표자',
  address: '주소',
  phone: '대표전화',
  type: '회사유형',
  status: '상태',
} as const;

const TEAM_FIELDS = {
  name: '팀명',
  type: '팀유형',
  leaderWorkerId: '책임자 ID',
  leaderName: '책임자',
  companyId: '소속회사 ID',
  companyName: '소속회사',
  parentTeamId: '상위팀 ID',
  parentTeamName: '상위팀',
  status: '상태',
} as const;

const comparable = (value: unknown): ComparableValue => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
};

const isEqual = (left: ComparableValue, right: ComparableValue): boolean => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  }
  return left === right;
};

const appendSlotChanges = (
  changes: ConstructionPlanErpSnapshotFieldChange[],
  slot: ConstructionPlanErpSnapshotSlot,
  beforeSource: ConstructionPlanErpSnapshot[ConstructionPlanErpSnapshotSlot],
  afterSource: ConstructionPlanErpSnapshot[ConstructionPlanErpSnapshotSlot],
  fields: Readonly<Record<string, string>>,
): void => {
  const beforeValue = beforeSource?.value as Record<string, unknown> | undefined;
  const afterValue = afterSource?.value as Record<string, unknown> | undefined;
  const sourceChanged = beforeSource?.sourceId !== afterSource?.sourceId;

  Object.entries(fields).forEach(([field, fieldLabel]) => {
    const before = comparable(beforeValue?.[field]);
    const after = comparable(afterValue?.[field]);
    if (isEqual(before, after) && !(sourceChanged && field === 'name')) return;
    changes.push({
      id: `${slot}.${field}`,
      slot,
      slotLabel: SLOT_LABELS[slot],
      field,
      fieldLabel,
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
      ...(afterSource?.sourceId ? { sourceId: afterSource.sourceId } : {}),
      ...(afterSource?.sourceUpdatedAt ? { sourceUpdatedAt: afterSource.sourceUpdatedAt } : {}),
    });
  });
};

/**
 * Compares only business-safe ERP fields that may be projected into a plan.
 * Photos, personal contact data and arbitrary master fields are intentionally
 * excluded so a diff response cannot become a second sensitive-data channel.
 */
export const diffConstructionPlanErpSnapshots = (
  before: ConstructionPlanErpSnapshot,
  after: ConstructionPlanErpSnapshot,
): ConstructionPlanErpSnapshotFieldChange[] => {
  const changes: ConstructionPlanErpSnapshotFieldChange[] = [];
  // The label maps and the shared mutation contract must stay exact.
  if (CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS.length !== Object.values(
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
  ).reduce((total, fields) => total + fields.length, 0)) {
    throw new Error('construction-plan-erp-refresh-field-contract-invalid');
  }
  appendSlotChanges(changes, 'site', before.site, after.site, SITE_FIELDS);
  appendSlotChanges(changes, 'clientCompany', before.clientCompany, after.clientCompany, COMPANY_FIELDS);
  appendSlotChanges(changes, 'contractorCompany', before.contractorCompany, after.contractorCompany, COMPANY_FIELDS);
  appendSlotChanges(changes, 'partnerCompany', before.partnerCompany, after.partnerCompany, COMPANY_FIELDS);
  appendSlotChanges(changes, 'responsibleTeam', before.responsibleTeam, after.responsibleTeam, TEAM_FIELDS);
  return changes;
};

export const hasConstructionPlanErpSnapshotChanges = (
  before: ConstructionPlanErpSnapshot,
  after: ConstructionPlanErpSnapshot,
): boolean => diffConstructionPlanErpSnapshots(before, after).length > 0;
