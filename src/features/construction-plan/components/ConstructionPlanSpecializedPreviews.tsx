import React from 'react';
import type { ConstructionPlan, PlanSection } from '../types';
import { riskLevelLabel, riskScore } from '../domain/riskMatrix';
import { requireConstructionPlanTemplateByIdentity } from '../domain/templateRegistry';
import { normalizeConstructionPlanSelectedSectionKeys } from '../domain/documentComposition';

type PreviewProps = { plan: ConstructionPlan; section: PlanSection };
type TocPreviewProps = PreviewProps & { logicalStartPhysicalPages?: ReadonlyMap<number, number> };

function PreviewTitle({ section, eyebrow }: { section: PlanSection; eyebrow: string }) {
  const pageNo = section.pageNumbers[0] ?? section.order + 1;
  return <div className="cp-a4__section-title"><span>{String(pageNo).padStart(2, '0')}</span><div><small>{eyebrow}</small><h2>{section.title}</h2></div></div>;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const dateTime = (value?: string, fallback = '수집되지 않음'): string => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
};

const revisionTypeLabel: Record<NonNullable<ConstructionPlan['revisionType']>, string> = {
  design_change: '설계 변경',
  site_condition: '현장 조건 변경',
  method_change: '시공 방법 변경',
  schedule_change: '공정 변경',
  safety_improvement: '안전 개선',
  other: '기타',
};

export function DocumentControlPreview({ plan, section }: PreviewProps) {
  const sourceRevision = plan.sourceRevisionNo !== undefined
    ? `REV. ${String(plan.sourceRevisionNo).padStart(2, '0')}`
    : plan.revision > 0 && plan.supersedesPlanId
      ? `REV. ${String(plan.revision - 1).padStart(2, '0')}`
      : plan.clonedFromPlanId
        ? '독립 복제 원본'
        : '-';
  const changeType = plan.revisionType
    ? revisionTypeLabel[plan.revisionType]
    : plan.revision === 0 ? '최초 작성' : '개정';
  const changeDescription = plan.revisionReason
    || (plan.clonedFromPlanId ? '기존 계획서에서 독립 복제' : '현재 계획서 스냅샷');
  return <div className="cp-a4__section-content cp-a4__data-page">
    <PreviewTitle section={section} eyebrow="DOCUMENT CONTROL" />
    <p className="cp-a4__lead">문서 식별자, 템플릿·렌더러 버전 및 현재 승인상태를 한 곳에서 확인한다.</p>
    <table className="cp-a4__table cp-a4__data-table"><tbody>
      <tr><th>문서번호</th><td>{plan.documentNo || '미등록'}</td><th>작성일</th><td>{plan.documentDate || '미등록'}</td></tr>
      <tr><th>개정번호</th><td>REV. {String(plan.revision).padStart(2, '0')}</td><th>현재 상태</th><td><span className="cp-a4__live-workflow-value">{plan.status}</span><span className="cp-a4__issued-candidate-value">승인 · 발행후보</span></td></tr>
      <tr><th>템플릿</th><td>{plan.templateId}@{plan.templateVersion}</td><th>렌더러</th><td>{plan.rendererVersion}</td></tr>
      <tr><th>작성자</th><td>{plan.createdByName || '기록 없음'}</td><th>최근 수정</th><td>{new Date(plan.updatedAt).toLocaleString('ko-KR')}</td></tr>
      <tr><th>검토 스냅샷</th><td>{plan.activeReviewSnapshotId || '미생성'}</td><th>승인 스냅샷</th><td>{plan.approvedSnapshotId || '미생성'}</td></tr>
      <tr><th>현장사용본</th><td colSpan={3}><span className="cp-a4__live-workflow-value">{plan.issuedExportId || '미발행 · DRAFT'}</span><span className="cp-a4__issued-candidate-value">승인 스냅샷 일치 · 서버 발행기록과 함께 유효</span></td></tr>
    </tbody></table>
    <div className="cp-a4__table-title">개정 및 승인 기록</div>
    <table className="cp-a4__table cp-a4__data-table cp-a4__revision-table"><thead><tr><th>Rev.</th><th>기준 Rev.</th><th>기준일</th><th>변경유형 · 사유</th><th>작성</th><th>검토</th><th>승인</th></tr></thead><tbody>
      <tr><td>{String(plan.revision).padStart(2, '0')}</td><td>{sourceRevision}</td><td>{plan.documentDate}</td><td className="is-left"><strong>{changeType}</strong><br />{changeDescription}</td><td>{plan.createdByName || '기록 없음'}</td><td>기록 없음</td><td>{plan.approverName || '기록 없음'}{plan.approvedAt && <small>{dateTime(plan.approvedAt)}</small>}</td></tr>
    </tbody></table>
    {plan.sourceSnapshotHash && <div className="cp-a4__data-note">기준 승인 스냅샷: {plan.sourceSnapshotHash.slice(0, 16)}…</div>}
    <div className="cp-a4__data-note">※ 승인·발행 식별자는 서버 검증이 완료된 경우에만 생성되며, 발행 후 본문은 직접 수정하지 않는다.</div>
  </div>;
}

export function TableOfContentsPreview({ plan, section, logicalStartPhysicalPages }: TocPreviewProps) {
  const pageNo = section.pageNumbers[0] ?? 3;
  const manifest = requireConstructionPlanTemplateByIdentity({
    tradeType: plan.tradeType,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
  }).manifest;
  const selectedSectionKeys = new Set(normalizeConstructionPlanSelectedSectionKeys(
    manifest,
    plan.selectedSectionKeys,
  ));
  const contentPages = manifest.pages.filter((page) => (
    page.pageNumber >= 5 && selectedSectionKeys.has(page.sectionKey)
  ));
  const half = Math.ceil(contentPages.length / 2);
  const rows = pageNo <= 3 ? contentPages.slice(0, half) : contentPages.slice(half);
  return <div className="cp-a4__section-content cp-a4__data-page cp-a4__toc-page">
    <PreviewTitle section={section} eyebrow="TABLE OF CONTENTS" />
    <table className="cp-a4__table cp-a4__data-table"><thead><tr><th>장</th><th>수록 내용</th><th>상태</th><th>쪽</th></tr></thead><tbody>
      {rows.map((page) => {
        const source = plan.sections.find((candidate) => candidate.key === page.sectionKey);
        return <tr key={page.pageNumber}><td className="is-left">{page.chapter}</td><td className="is-left">{page.title}</td><td>{source?.status === 'complete' ? '완료' : source?.status === 'not_applicable' ? '해당없음' : '작성중'}</td><td>{logicalStartPhysicalPages?.get(page.pageNumber) ?? page.pageNumber}</td></tr>;
      })}
    </tbody></table>
  </div>;
}

export function ProjectOverviewPreview({ plan, section }: PreviewProps) {
  const project = plan.projectSnapshot;
  const erp = plan.erpSnapshot;
  const client = erp?.clientCompany?.value;
  const contractor = erp?.contractorCompany?.value;
  const partner = erp?.partnerCompany?.value;
  const team = erp?.responsibleTeam?.value;
  return <div className="cp-a4__section-content cp-a4__data-page">
    <PreviewTitle section={section} eyebrow="PROJECT OVERVIEW" />
    <div className="cp-a4__table-title">공사 및 계약 개요</div>
    <table className="cp-a4__table cp-a4__data-table"><tbody>
      <tr><th>현장명</th><td colSpan={3} className="is-left">{project.siteName || '미등록'}</td></tr>
      <tr><th>주소</th><td colSpan={3} className="is-left">{project.address || '미등록'}</td></tr>
      <tr><th>발주처</th><td>{project.clientName || '미등록'}</td><th>원도급사</th><td>{project.contractorName || '미등록'}</td></tr>
      <tr><th>공사기간</th><td>{project.constructionPeriod?.startDate || '미정'} ~ {project.constructionPeriod?.endDate || '미정'}</td><th>담당팀</th><td>{text(section.content.responsibleTeamName, '현장 원천정보 참조')}</td></tr>
      <tr><th>적용 동</th><td data-preview-edit-path="projectSnapshot.buildings">{project.buildings.join(', ') || '미등록'}</td><th>적용 층</th><td data-preview-edit-path="projectSnapshot.floors">{project.floors.join(', ') || '미등록'}</td></tr>
      <tr><th>적용 구간</th><td colSpan={3} className="is-left" data-preview-edit-path="projectSnapshot.zones">{project.zones.join(', ') || '미등록'}</td></tr>
      <tr><th>스냅샷 시점</th><td>{dateTime(project.capturedAt)}</td><th>비상연락망</th><td data-preview-edit-path="projectSnapshot.emergencyContactsComplete">{project.emergencyContactsComplete ? '확인 완료' : '확인 필요'}</td></tr>
    </tbody></table>
    {erp ? <>
      <div className="cp-a4__table-title">ERP 회사·조직 원본</div>
      <table className="cp-a4__table cp-a4__data-table cp-a4__erp-table"><tbody>
        <tr><th>현장 원천</th><td className="is-left"><strong>{erp.site.value.name}</strong><small>ID {erp.site.sourceId} · 수정 {dateTime(erp.site.sourceUpdatedAt)}</small></td><th>수집시각</th><td>{dateTime(erp.capturedAt)}</td></tr>
        <tr><th>발주처</th><td className="is-left"><strong>{client?.name || '원천정보 없음'}</strong><small>사업자 {client?.businessNumber || '-'} · 대표 {client?.representativeName || '-'}</small></td><th>대표 연락처</th><td>{client?.phone || '-'}</td></tr>
        <tr><th>원도급사</th><td className="is-left"><strong>{contractor?.name || '원천정보 없음'}</strong><small>사업자 {contractor?.businessNumber || '-'} · 대표 {contractor?.representativeName || '-'}</small></td><th>대표 연락처</th><td>{contractor?.phone || '-'}</td></tr>
        {partner && <tr><th>협력사</th><td className="is-left"><strong>{partner.name}</strong><small>사업자 {partner.businessNumber || '-'} · 대표 {partner.representativeName || '-'}</small></td><th>대표 연락처</th><td>{partner.phone || '-'}</td></tr>}
        <tr><th>담당팀</th><td className="is-left"><strong>{team?.name || erp.site.value.responsibleTeamName || '원천정보 없음'}</strong><small>{team ? `ID ${erp.responsibleTeam?.sourceId} · ${team.companyName || '소속회사 미수집'}` : '팀 상세 원천 미수집'}</small></td><th>책임자</th><td>{team?.leaderName || '-'}</td></tr>
        <tr><th>사업장 주소</th><td colSpan={3} className="is-left">발주처 {client?.address || '-'} / 원도급사 {contractor?.address || '-'}</td></tr>
      </tbody></table>
      <div className="cp-a4__data-note">※ ERP 원본 ID·수정시각·수집시각과 회사·팀 공개정보를 문서 생성 시점에 고정한 값이다. 회사 이메일과 근로자 연락처는 표시하지 않는다.</div>
    </> : <div className="cp-a4__data-note cp-a4__data-note--legacy">※ 이 구형 계획서에는 ERP 원본 상세 스냅샷이 없어 위 공사개요는 projectSnapshot 저장값을 표시한다. 원천 ID와 원천 수정시각은 확인할 수 없다.</div>}
  </div>;
}

export function RiskAssessmentPreview({ plan, section }: PreviewProps) {
  const policy = requireConstructionPlanTemplateByIdentity({
    tradeType: plan.tradeType,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
  }).manifest.riskAssessmentPolicy;
  const workers = [
    ...plan.organizationSnapshot.assignments.flatMap((assignment) => assignment.worker ? [assignment.worker] : []),
    ...plan.organizationSnapshot.additionalWorkers,
  ];
  const workerName = (id?: string) => id ? workers.find((worker) => worker.id === id)?.name || id : '-';
  return <div className="cp-a4__section-content cp-a4__data-page">
    <PreviewTitle section={section} eyebrow="RISK ASSESSMENT" />
    <p className="cp-a4__lead">설치·타설·해체 단계의 위험요인을 식별하고, 저감대책 이행 후 잔여 위험도를 확인한다.</p>
    <table className={`cp-a4__table cp-a4__data-table${plan.riskAssessments.length > 7 ? ' is-dense' : ''}`}><thead><tr><th>No.</th><th>작업단계</th><th>위험요인</th><th>최초 P×S</th><th>저감대책</th><th>담당</th><th>저감 후 P×S</th><th>확인·재검토</th></tr></thead><tbody>
      {plan.riskAssessments.map((risk, index) => {
        const initialScore = riskScore(risk.initialProbability, risk.initialSeverity, policy);
        const residualScore = riskScore(risk.residualProbability, risk.residualSeverity, policy);
        return <tr key={risk.id} className={!risk.residualRiskLevel || !risk.verifiedBy ? 'is-incomplete' : undefined} data-preview-edit-path={`riskAssessments.${index}.workStage`} data-preview-related-id={risk.id}><td>{index + 1}</td><td data-preview-edit-path={`riskAssessments.${index}.workStage`} data-preview-related-id={risk.id}>{risk.workStage || '-'}</td><td className="is-left" data-preview-edit-path={`riskAssessments.${index}.hazard`} data-preview-related-id={risk.id}>{risk.hazard || '-'}{risk.methodReference && <small>기준 {risk.methodReference}</small>}</td><td data-preview-edit-path={`riskAssessments.${index}.initialProbability`} data-preview-related-id={risk.id}>{initialScore ? <><strong>{risk.initialProbability}×{risk.initialSeverity}={initialScore}</strong><small>{riskLevelLabel(risk.initialRiskLevel, policy)}</small></> : riskLevelLabel(risk.initialRiskLevel, policy)}</td><td className="is-left" data-preview-edit-path={`riskAssessments.${index}.mitigationMeasures`} data-preview-related-id={risk.id}>{risk.mitigationMeasures.join(' · ') || '미등록'}</td><td data-preview-edit-path={`riskAssessments.${index}.responsibleWorkerId`} data-preview-related-id={risk.id}>{workerName(risk.responsibleWorkerId)}</td><td data-preview-edit-path={`riskAssessments.${index}.residualProbability`} data-preview-related-id={risk.id}>{residualScore ? <><strong>{risk.residualProbability}×{risk.residualSeverity}={residualScore}</strong><small>{risk.residualRiskLevel ? riskLevelLabel(risk.residualRiskLevel, policy) : '미평가'}</small></> : risk.residualRiskLevel ? riskLevelLabel(risk.residualRiskLevel, policy) : '미평가'}</td><td data-preview-edit-path={`riskAssessments.${index}.reviewTrigger`} data-preview-related-id={risk.id}>{risk.verifiedBy || '-'}{risk.reviewTrigger && <small>{risk.reviewTrigger}</small>}</td></tr>;
      })}
      {plan.riskAssessments.length === 0 && <tr className="is-incomplete"><td colSpan={8}>등록된 위험성평가가 없습니다.</td></tr>}
    </tbody></table>
    <div className="cp-a4__data-note">※ {policy.methodReference}: 가능성({policy.probabilityMin}~{policy.probabilityMax}) × 중대성({policy.severityMin}~{policy.severityMax}). {policy.thresholds.map((threshold) => `${threshold.minScore}~${threshold.maxScore} ${threshold.label}(${threshold.action})`).join(' / ')}. 허용기준은 잔여 {policy.acceptance.maxResidualScore}점 이하이며 재검토 트리거는 {policy.reviewTriggers.join(' / ')}이다.</div>
  </div>;
}

const CHECKLISTS: Record<string, string[]> = {
  'equipment-inspection': ['외관·구조부 손상', '안전장치 작동', '와이어·후크 상태', '제동·조향장치', '아웃트리거·지반상태', '검사 유효기간', '운전원 자격', '신호수 배치'],
  'installation-inspection': ['지반 및 받침상태', '지주 간격·수직도', '수평재·가새 설치', '상·하부 잭 체결', '연결부 이탈방지', '개구부·단차 보강', '존치·해체금지 표시', '타설 전 최종 Hold Point'],
  'equipment-daily-log': ['작업 전 외관점검', '누유·이상소음', '안전장치·경보', '작업반경 통제', '운전원·신호수 확인', '일일 작업 종료점검'],
};

function ExecutionTemplateNotice() {
  return <div className="cp-a4__execution-template-notice" role="note">
    <strong>현장 실행용 빈 양식 · 발행 시점 미실시</strong>
    <span>아래 공란·체크박스·서명란은 승인 증적이 아니며 실제 작업일에 별도 기록·확인해야 한다.</span>
  </div>;
}

export function ChecklistTemplatePreview({ plan, section }: PreviewProps) {
  const rows = CHECKLISTS[section.key] || ['점검항목 1', '점검항목 2', '점검항목 3', '점검항목 4', '점검항목 5', '점검항목 6'];
  return <div className="cp-a4__section-content cp-a4__data-page">
    <PreviewTitle section={section} eyebrow="FIELD CHECKLIST" />
    <ExecutionTemplateNotice />
    <div className="cp-a4__info-grid"><dl><dt>현장명</dt><dd>{plan.projectSnapshot.siteName}</dd></dl><dl><dt>동·층·구간</dt><dd>{[...plan.projectSnapshot.buildings, ...plan.projectSnapshot.floors, ...plan.projectSnapshot.zones].join(' · ') || '-'}</dd></dl><dl><dt>점검일</dt><dd>　　　년　　월　　일</dd></dl><dl><dt>점검자</dt><dd>　　　　　　　　　(서명)</dd></dl></div>
    <table className="cp-a4__table cp-a4__data-table"><thead><tr><th>No.</th><th>점검항목</th><th>적합</th><th>부적합</th><th>해당없음</th><th>조치·확인사항</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row}><td>{index + 1}</td><td className="is-left">{row}</td><td>□</td><td>□</td><td>□</td><td>　</td></tr>)}</tbody></table>
    <div className="cp-a4__data-note">점검결과 이상 시 작업을 중지하고 조치 완료 후 현장책임자의 재확인을 받는다.</div>
  </div>;
}

export function PhotoSheetPreview({ plan, section }: PreviewProps) {
  const photos = plan.projectSnapshot.sitePhotos.slice(0, 4);
  return <div className="cp-a4__section-content cp-a4__data-page">
    <PreviewTitle section={section} eyebrow="SITE PHOTO RECORD" />
    <ExecutionTemplateNotice />
    <div className="cp-a4__photo-grid">{Array.from({ length: 4 }, (_, index) => {
      const photo = photos[index];
      const renderable = photo && /^(blob:|data:|https?:)/i.test(photo);
      return <div className="cp-a4__photo-slot" key={index}>{renderable ? <img src={photo} alt={`현장사진 ${index + 1}`} /> : <div>사진 {index + 1}<small>{photo ? text(photo) : '첨부 위치'}</small></div>}<p>촬영일:　　　　　　위치:　　　　　　내용:</p></div>;
    })}</div>
  </div>;
}

const APPROVAL_ROWS: Record<string, string[]> = {
  'pre-pour-hold-point': ['승인도면·구조검토 조건 일치', '지주·수평재·가새 설치 완료', '상·하부 잭 및 연결부 체결', '개구부·단부 보강', '존치·해체금지 구간 표시', '타설순서·속도·장비동선 확인'],
  handover: ['계획서·승인도면 최신본 인계', '설치·존치·해체구간 현장표시', '미결사항 및 금지구역 전달', '장비·자재·점검기록 인계', '비상연락망·책임자 확인'],
};

export function ApprovalSheetPreview({ plan, section }: PreviewProps) {
  const rows = APPROVAL_ROWS[section.key] || ['확인사항 1', '확인사항 2', '확인사항 3', '확인사항 4'];
  return <div className="cp-a4__section-content cp-a4__data-page">
    <PreviewTitle section={section} eyebrow="HOLD POINT & SIGN-OFF" />
    <ExecutionTemplateNotice />
    <div className="cp-a4__info-grid"><dl><dt>현장명</dt><dd>{plan.projectSnapshot.siteName}</dd></dl><dl><dt>적용구간</dt><dd>{plan.projectSnapshot.zones.join(', ') || '-'}</dd></dl></div>
    <table className="cp-a4__table cp-a4__data-table"><thead><tr><th>No.</th><th>확인사항</th><th>결과</th><th>조치·특이사항</th><th>확인자</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row}><td>{index + 1}</td><td className="is-left">{row}</td><td>□ 적합　□ 부적합</td><td>　</td><td>　　　　(서명)</td></tr>)}</tbody></table>
    <div className="cp-a4__approval-grid"><span>작성</span><span>공사 검토</span><span>안전 검토</span><span>최종 확인</span><strong /><strong /><strong /><strong /></div>
  </div>;
}
