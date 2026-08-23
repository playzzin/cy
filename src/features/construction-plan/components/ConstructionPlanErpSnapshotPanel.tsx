import React from 'react';
import { Building2, Database, UsersRound } from 'lucide-react';
import type {
  ConstructionPlan,
  ConstructionPlanErpFieldProvenance,
  ConstructionPlanErpSnapshot,
} from '../types';

type ConstructionPlanErpSnapshotPanelProps = {
  plan: Pick<ConstructionPlan, 'erpSnapshot' | 'projectSnapshot' | 'organizationSnapshot'>;
  focus?: 'project' | 'organization';
};

type ErpSource = ConstructionPlanErpSnapshot['site']
  | NonNullable<ConstructionPlanErpSnapshot['clientCompany']>
  | NonNullable<ConstructionPlanErpSnapshot['responsibleTeam']>;

const sourceLabel: Record<ErpSource['source'], string> = {
  site: '현장 마스터',
  company: '회사 마스터',
  team: '팀 마스터',
};

const show = (value?: string): string => value?.trim() || '원천정보 없음';

const formatDateTime = (value?: string): string => {
  if (!value) return '수집되지 않음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
};

function SourceTrace({
  source,
  slot,
  provenance,
}: {
  source: ErpSource;
  slot: keyof Pick<ConstructionPlanErpSnapshot, 'site' | 'clientCompany' | 'contractorCompany' | 'partnerCompany' | 'responsibleTeam'>;
  provenance?: ConstructionPlanErpFieldProvenance;
}) {
  const fieldEntries = Object.entries(provenance ?? {})
    .filter(([fieldId]) => fieldId.startsWith(`${slot}.`))
    .sort(([left], [right]) => left.localeCompare(right));
  const fieldSourceCount = fieldEntries.length;
  const latestRefresh = fieldEntries
    .map(([, entry]) => entry)
    .filter((entry) => entry.captureKind === 'refresh')
    .sort((left, right) => (right.appliedAt ?? '').localeCompare(left.appliedAt ?? ''))[0];
  return (
    <>
      <dl className="cp-erp-source-trace">
        <div><dt>출처</dt><dd>{sourceLabel[source.source]}</dd></div>
        <div><dt>원천 ID</dt><dd title={source.sourceId}>{source.sourceId}</dd></div>
        <div><dt>원천 수정시각</dt><dd>{source.overridden ? '필드별 출처 참조' : formatDateTime(source.sourceUpdatedAt)}</dd></div>
        <div><dt>수집시각</dt><dd>{formatDateTime(source.capturedAt)}</dd></div>
        {source.overridden && (
          <div><dt>반영 방식</dt><dd>선택 반영 · 필드별 출처 {fieldSourceCount}건</dd></div>
        )}
        {latestRefresh && (
          <>
            <div><dt>최근 반영자</dt><dd>{latestRefresh.appliedBy}</dd></div>
            <div><dt>최근 반영시각</dt><dd>{formatDateTime(latestRefresh.appliedAt)}</dd></div>
            <div><dt>최근 반영사유</dt><dd>{latestRefresh.changeReason}</dd></div>
            <div><dt>감사 기록</dt><dd title={latestRefresh.auditEventId}>{latestRefresh.auditEventId}</dd></div>
            <div>
              <dt>원천 버전 근거</dt>
              <dd title={latestRefresh.sourceMasterHash}>
                {latestRefresh.sourceUpdatedAt
                  ? formatDateTime(latestRefresh.sourceUpdatedAt)
                  : `SHA-256 ${latestRefresh.sourceMasterHash.slice(0, 12)}…`}
              </dd>
            </div>
          </>
        )}
      </dl>
      {fieldEntries.length > 0 && (
        <details className="cp-erp-field-provenance">
          <summary>필드별 출처·버전 {fieldEntries.length}건</summary>
          <div className="cp-erp-field-provenance__list">
            {fieldEntries.map(([fieldId, entry]) => (
              <article key={fieldId} className="cp-erp-field-provenance__item">
                <strong>{fieldId}</strong>
                <span>원천 문서 {entry.source}:{entry.sourceId}</span>
                <span>수집 {formatDateTime(entry.capturedAt)}</span>
                <span title={entry.sourceMasterHash}>
                  원천 버전 {entry.sourceUpdatedAt
                    ? formatDateTime(entry.sourceUpdatedAt)
                    : `SHA-256 ${entry.sourceMasterHash.slice(0, 12)}…`}
                </span>
                {entry.captureKind === 'refresh' && (
                  <>
                    <span>반영 {entry.appliedBy} · {formatDateTime(entry.appliedAt)}</span>
                    <span>수정사유 {entry.changeReason}</span>
                    <span title={entry.auditEventId}>감사 {entry.auditEventId}</span>
                  </>
                )}
              </article>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function SiteCard({ source, provenance }: {
  source: ConstructionPlanErpSnapshot['site'];
  provenance?: ConstructionPlanErpFieldProvenance;
}) {
  const site = source.value;
  return (
    <article className="cp-erp-card" data-testid="erp-site-card">
      <div className="cp-erp-card__heading">
        <span><Building2 size={15} /></span>
        <div><small>현장 원본</small><strong>{site.name}</strong></div>
      </div>
      <dl className="cp-erp-public-fields">
        <div><dt>현장코드</dt><dd>{show(site.code)}</dd></div>
        <div><dt>주소</dt><dd>{show(site.address)}</dd></div>
        <div><dt>공사기간</dt><dd>{show(site.startDate)} ~ {show(site.endDate)}</dd></div>
        <div><dt>담당팀</dt><dd>{show(site.responsibleTeamName)}</dd></div>
      </dl>
      <SourceTrace source={source} slot="site" provenance={provenance} />
    </article>
  );
}

type CompanySource = NonNullable<ConstructionPlanErpSnapshot['clientCompany']>;

function CompanyCard({ label, slot, source, provenance }: {
  label: string;
  slot: 'clientCompany' | 'contractorCompany' | 'partnerCompany';
  source: CompanySource;
  provenance?: ConstructionPlanErpFieldProvenance;
}) {
  const company = source.value;
  return (
    <article className="cp-erp-card" data-testid={`erp-company-${label}`}>
      <div className="cp-erp-card__heading">
        <span><Building2 size={15} /></span>
        <div><small>{label}</small><strong>{company.name}</strong></div>
      </div>
      <dl className="cp-erp-public-fields">
        <div><dt>사업자번호</dt><dd>{show(company.businessNumber)}</dd></div>
        <div><dt>대표자</dt><dd>{show(company.representativeName)}</dd></div>
        <div><dt>사업장 주소</dt><dd>{show(company.address)}</dd></div>
        <div><dt>대표 연락처</dt><dd>{show(company.phone)}</dd></div>
      </dl>
      <SourceTrace source={source} slot={slot} provenance={provenance} />
    </article>
  );
}

type TeamSource = NonNullable<ConstructionPlanErpSnapshot['responsibleTeam']>;

function TeamCard({ source, provenance }: {
  source: TeamSource;
  provenance?: ConstructionPlanErpFieldProvenance;
}) {
  const team = source.value;
  return (
    <article className="cp-erp-card" data-testid="erp-team-card">
      <div className="cp-erp-card__heading">
        <span><UsersRound size={15} /></span>
        <div><small>담당 조직 원본</small><strong>{team.name}</strong></div>
      </div>
      <dl className="cp-erp-public-fields">
        <div><dt>팀 구분</dt><dd>{show(team.type)}</dd></div>
        <div><dt>책임자</dt><dd>{show(team.leaderName)}</dd></div>
        <div><dt>소속 회사</dt><dd>{show(team.companyName)}</dd></div>
        <div><dt>상위 조직</dt><dd>{show(team.parentTeamName)}</dd></div>
      </dl>
      <SourceTrace source={source} slot="responsibleTeam" provenance={provenance} />
    </article>
  );
}

function LegacyProjectSnapshot({ plan }: ConstructionPlanErpSnapshotPanelProps) {
  const project = plan.projectSnapshot;
  return (
    <section className="cp-erp-panel" aria-label="기존 계획서 현장 스냅샷">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">LEGACY SNAPSHOT</span><h3>ERP 원본 스냅샷</h3></div>
        <span className="cp-warning-chip">구형 문서</span>
      </div>
      <div className="cp-erp-legacy-notice" role="note">
        <Database size={15} />
        <div>
          <strong>이 계획서에는 ERP 원본 상세 스냅샷이 없습니다.</strong>
          <p>아래 값은 기존 projectSnapshot에 저장된 계획서 데이터이며, 원천 ID와 원천 수정시각은 확인할 수 없습니다.</p>
        </div>
      </div>
      <article className="cp-erp-card cp-erp-card--legacy">
        <div className="cp-erp-card__heading">
          <span><Building2 size={15} /></span>
          <div><small>계획서 저장값</small><strong>{show(project.siteName)}</strong></div>
        </div>
        <dl className="cp-erp-public-fields">
          <div><dt>주소</dt><dd>{show(project.address)}</dd></div>
          <div><dt>발주처</dt><dd>{show(project.clientName)}</dd></div>
          <div><dt>원도급사</dt><dd>{show(project.contractorName)}</dd></div>
          <div><dt>계획서 수집시각</dt><dd>{formatDateTime(project.capturedAt)}</dd></div>
        </dl>
      </article>
    </section>
  );
}

export function ConstructionPlanErpSnapshotPanel({
  plan,
  focus = 'project',
}: ConstructionPlanErpSnapshotPanelProps) {
  const snapshot = plan.erpSnapshot;
  if (!snapshot) return <LegacyProjectSnapshot plan={plan} focus={focus} />;
  const provenance = (snapshot as ConstructionPlanErpSnapshot & {
    fieldProvenance?: ConstructionPlanErpFieldProvenance;
  }).fieldProvenance;
  const hasMixedSources = [
    snapshot.site,
    snapshot.clientCompany,
    snapshot.contractorCompany,
    snapshot.partnerCompany,
    snapshot.responsibleTeam,
  ].some((source) => source?.overridden === true);
  const workerProvenance = plan.organizationSnapshot.workerDirectoryProvenance;

  const companyCards = (
    <>
      {snapshot.clientCompany && <CompanyCard label="발주처 회사" slot="clientCompany" source={snapshot.clientCompany} provenance={provenance} />}
      {snapshot.contractorCompany && <CompanyCard label="원도급 회사" slot="contractorCompany" source={snapshot.contractorCompany} provenance={provenance} />}
      {snapshot.partnerCompany && <CompanyCard label="협력 회사" slot="partnerCompany" source={snapshot.partnerCompany} provenance={provenance} />}
    </>
  );

  return (
    <section className="cp-erp-panel" aria-label="ERP 원본 스냅샷">
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div><span className="cp-eyebrow">CANONICAL ERP SNAPSHOT</span><h3>ERP 원본 스냅샷</h3></div>
        <span className="cp-source-chip"><Database size={11} /> 읽기 전용</span>
      </div>
      <div className="cp-erp-capture-summary">
        <strong>{hasMixedSources ? '서버 선택 반영 · 필드별 출처 보존' : '문서 생성 시 고정 수집'}</strong>
        <span>{formatDateTime(snapshot.capturedAt)}</span>
      </div>
      {focus === 'organization' && workerProvenance && (
        <dl className="cp-erp-source-trace" aria-label="작업자 명부 출처">
          <div><dt>작업자 명부 출처</dt><dd>현장 {workerProvenance.sourceSiteId}{workerProvenance.sourceTeamId ? ` · 팀 ${workerProvenance.sourceTeamId}` : ''}</dd></div>
          <div><dt>명부 수집시각</dt><dd>{formatDateTime(workerProvenance.capturedAt)}</dd></div>
          <div><dt>원천 버전 근거</dt><dd title={workerProvenance.sourceMasterHash}>SHA-256 {workerProvenance.sourceMasterHash.slice(0, 12)}…</dd></div>
          {workerProvenance.captureKind === 'refresh' && (
            <>
              <div><dt>최근 반영자</dt><dd>{workerProvenance.appliedBy}</dd></div>
              <div><dt>최근 반영사유</dt><dd>{workerProvenance.changeReason}</dd></div>
              <div><dt>감사 기록</dt><dd>{workerProvenance.auditEventId}</dd></div>
            </>
          )}
        </dl>
      )}
      <div className="cp-erp-card-list">
        {focus === 'organization' && snapshot.responsibleTeam && <TeamCard source={snapshot.responsibleTeam} provenance={provenance} />}
        <SiteCard source={snapshot.site} provenance={provenance} />
        {companyCards}
        {focus !== 'organization' && snapshot.responsibleTeam && <TeamCard source={snapshot.responsibleTeam} provenance={provenance} />}
      </div>
      <p className="cp-erp-panel__notice">회사 이메일·근로자 연락처 등 개인정보는 이 패널에 표시하지 않습니다.</p>
    </section>
  );
}

export default ConstructionPlanErpSnapshotPanel;
