import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDatabase,
  faLock,
  faPenToSquare,
  faShieldHalved,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
  ERP_COLLECTION_POLICIES,
  type ErpAccessRoleGroup,
  summarizeErpCollectionAccess,
} from '../../security/erpAccessPolicy';

interface SecurityPolicyRole {
  id: string;
  label: string;
  color?: string;
}

interface SecurityPolicyPanelProps {
  roles: SecurityPolicyRole[];
  selectedRole: string;
}

const GROUP_LABELS: Record<ErpAccessRoleGroup, string> = {
  admin: '관리자',
  payroll: '급여/정산',
  finance: '재무',
  office: '사무',
  site: '현장',
  support: '지원 자산',
  audit: '감사',
  user: '일반',
};

const GROUP_BADGE_CLASS: Record<ErpAccessRoleGroup, string> = {
  admin: 'bg-red-50 text-red-700 ring-red-100',
  payroll: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  finance: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  office: 'bg-sky-50 text-sky-700 ring-sky-100',
  site: 'bg-amber-50 text-amber-700 ring-amber-100',
  support: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  audit: 'bg-violet-50 text-violet-700 ring-violet-100',
  user: 'bg-slate-50 text-slate-600 ring-slate-100',
};

const CATEGORY_ORDER = [
  'ERP master data',
  'field operation data',
  'service recruiting and settlement data',
  'payroll, tax, receivable, and settlement data',
  'support asset and billing data',
  'welfare asset ledger data',
  'administrative and audit data',
];

const CATEGORY_LABELS: Record<string, string> = {
  'ERP master data': '기준정보',
  'field operation data': '현장 운영',
  'service recruiting and settlement data': '용역/소개',
  'payroll, tax, receivable, and settlement data': '급여/정산/세무',
  'support asset and billing data': '지원 자산/청구',
  'welfare asset ledger data': '복지 자산',
  'administrative and audit data': '관리/감사',
};

export const SecurityPolicyPanel: React.FC<SecurityPolicyPanelProps> = ({
  roles,
  selectedRole,
}) => {
  const selectedRoleInfo = roles.find((role) => role.id === selectedRole);
  const roleCandidates = React.useMemo(
    () => [selectedRole, selectedRoleInfo?.label].filter(Boolean),
    [selectedRole, selectedRoleInfo?.label]
  );
  const summary = React.useMemo(
    () => summarizeErpCollectionAccess(roleCandidates),
    [roleCandidates]
  );

  const categories = React.useMemo(() => {
    return CATEGORY_ORDER.map((description) => {
      const policies = ERP_COLLECTION_POLICIES.filter((policy) => policy.description === description);
      const readableCount = policies.filter((policy) => summary.readableCollections.includes(policy.collectionId)).length;
      const writableCount = policies.filter((policy) => summary.writableCollections.includes(policy.collectionId)).length;

      return {
        description,
        label: CATEGORY_LABELS[description] || description,
        totalCount: policies.length,
        readableCount,
        writableCount,
      };
    }).filter((category) => category.totalCount > 0);
  }, [summary.readableCollections, summary.writableCollections]);

  const hasServerRoleGroup = summary.roleGroups.length > 0;

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <FontAwesomeIcon icon={faShieldHalved} className="text-indigo-500" />
            서버 보안 정책
          </div>
          <p className="mt-1 text-xs text-slate-500">
            선택 직책의 메뉴 권한과 별개로 Firestore 규칙에서 허용되는 민감 컬렉션 범위입니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-bold text-slate-400">읽기</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">{summary.readableCount}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-bold text-slate-400">쓰기</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">{summary.writableCount}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-bold text-slate-400">차단</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">{summary.deniedCount}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">서버 역할 그룹</span>
        {hasServerRoleGroup ? summary.roleGroups.map((group) => (
          <span
            key={group}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${GROUP_BADGE_CLASS[group]}`}
          >
            <FontAwesomeIcon icon={faLock} className="text-[10px]" />
            {GROUP_LABELS[group]}
          </span>
        )) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 ring-1 ring-amber-100">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-[10px]" />
            서버 역할 그룹 매핑 없음
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <div key={category.description} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate text-xs font-extrabold text-slate-700">
                <FontAwesomeIcon icon={faDatabase} className="text-slate-400" />
                <span className="truncate">{category.label}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">{category.totalCount}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-white px-2 py-1.5 text-slate-600">
                읽기 <span className="font-extrabold text-slate-900">{category.readableCount}</span>
              </div>
              <div className="rounded-md bg-white px-2 py-1.5 text-slate-600">
                쓰기 <span className="font-extrabold text-slate-900">{category.writableCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!hasServerRoleGroup && (
        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <FontAwesomeIcon icon={faPenToSquare} className="mr-2" />
          이 직책은 메뉴에는 표시될 수 있지만 서버 규칙 역할 그룹과 연결되어 있지 않습니다. 커스텀 클레임 또는 사용자 직책명을 표준 역할 그룹에 맞춰야 민감 데이터 접근이 허용됩니다.
        </div>
      )}
    </section>
  );
};
