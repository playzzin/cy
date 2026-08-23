import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { buildConstructionPlanDraft } from '../domain';
import type { ConstructionPlan } from '../types';
import ConstructionPlanA4Preview from './ConstructionPlanA4Preview';
import ConstructionPlanErpSnapshotPanel from './ConstructionPlanErpSnapshotPanel';

const capturedAt = '2026-08-22T01:02:03.000Z';

const makePlan = (withErpSnapshot = true): ConstructionPlan => {
  const plan = buildConstructionPlanDraft('erp-ui-plan', {
    siteId: 'site-erp-001',
    siteName: '기존 저장 현장명',
    createdBy: 'author-1',
  }, capturedAt);

  return {
    ...plan,
    projectSnapshot: {
      ...plan.projectSnapshot,
      address: '서울시 기존 저장 주소',
      clientName: '기존 발주처명',
      contractorName: '기존 원도급사명',
    },
    ...(withErpSnapshot ? {
      erpSnapshot: {
        schemaVersion: 1 as const,
        capturedAt,
        site: {
          source: 'site' as const,
          sourceId: 'site-erp-001',
          sourceUpdatedAt: '2026-08-21T10:00:00.000Z',
          capturedAt,
          value: {
            id: 'site-erp-001',
            name: 'ERP 원본 현장',
            code: 'SITE-001',
            address: '서울시 ERP 원본 주소',
            startDate: '2026-08-01',
            endDate: '2027-03-31',
            responsibleTeamId: 'team-001',
            responsibleTeamName: '시스템동바리팀',
          },
        },
        clientCompany: {
          source: 'company' as const,
          sourceId: 'company-client',
          sourceUpdatedAt: '2026-08-20T09:00:00.000Z',
          capturedAt,
          value: {
            id: 'company-client',
            name: '청연 발주 주식회사',
            businessNumber: '123-45-67890',
            representativeName: '김대표',
            address: '서울시 발주처 주소',
            phone: '02-1111-2222',
            email: 'private-client@example.com',
          },
        },
        contractorCompany: {
          source: 'company' as const,
          sourceId: 'company-contractor',
          capturedAt,
          value: {
            id: 'company-contractor',
            name: '대한 원도급 건설',
            businessNumber: '987-65-43210',
            representativeName: '이대표',
            address: '서울시 원도급사 주소',
            phone: '02-3333-4444',
          },
        },
        responsibleTeam: {
          source: 'team' as const,
          sourceId: 'team-001',
          sourceUpdatedAt: '2026-08-21T11:00:00.000Z',
          capturedAt,
          value: {
            id: 'team-001',
            name: '시스템동바리팀',
            type: '현장 시공팀',
            leaderWorkerId: 'worker-leader',
            leaderName: '박책임',
            companyId: 'company-contractor',
            companyName: '대한 원도급 건설',
          },
        },
      },
    } : {}),
  };
};

describe('ConstructionPlanErpSnapshotPanel', () => {
  it('shows canonical site, public company/team fields, and source trace metadata', () => {
    render(<ConstructionPlanErpSnapshotPanel plan={makePlan()} />);

    expect(screen.getByText('CANONICAL ERP SNAPSHOT')).toBeInTheDocument();
    expect(screen.getByText('ERP 원본 현장')).toBeInTheDocument();
    expect(screen.getByText('site-erp-001')).toBeInTheDocument();

    const clientCard = screen.getByTestId('erp-company-발주처 회사');
    expect(within(clientCard).getByText('청연 발주 주식회사')).toBeInTheDocument();
    expect(within(clientCard).getByText('123-45-67890')).toBeInTheDocument();
    expect(within(clientCard).getByText('김대표')).toBeInTheDocument();
    expect(within(clientCard).getByText('02-1111-2222')).toBeInTheDocument();

    const teamCard = screen.getByTestId('erp-team-card');
    expect(within(teamCard).getByText('시스템동바리팀')).toBeInTheDocument();
    expect(within(teamCard).getByText('박책임')).toBeInTheDocument();
    expect(screen.getAllByText('원천 수정시각').length).toBeGreaterThan(0);
    expect(screen.getAllByText('수집시각').length).toBeGreaterThan(0);
    expect(screen.queryByText('private-client@example.com')).not.toBeInTheDocument();
  });

  it('labels legacy projectSnapshot fallback without inventing unavailable source metadata', () => {
    render(<ConstructionPlanErpSnapshotPanel plan={makePlan(false)} />);

    expect(screen.getByText('LEGACY SNAPSHOT')).toBeInTheDocument();
    expect(screen.getByText('이 계획서에는 ERP 원본 상세 스냅샷이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('기존 저장 현장명')).toBeInTheDocument();
    expect(screen.getByText('서울시 기존 저장 주소')).toBeInTheDocument();
    expect(screen.getByText(/원천 ID와 원천 수정시각은 확인할 수 없습니다/)).toBeInTheDocument();
  });

  it('labels a selectively refreshed envelope as mixed and points to field-level provenance', () => {
    const refreshed = makePlan();
    const snapshot = refreshed.erpSnapshot!;
    refreshed.erpSnapshot = {
      ...snapshot,
      site: {
        ...snapshot.site,
        value: {
          id: snapshot.site.value.id,
          name: snapshot.site.value.name,
          address: snapshot.site.value.address,
        },
        overridden: true,
        sourceUpdatedAt: undefined,
      },
      fieldProvenance: {
        'site.name': {
          source: 'site', sourceId: 'site-erp-001', capturedAt,
          captureKind: 'initial', sourceMasterHash: 'a'.repeat(64),
        },
        'site.address': {
          source: 'site', sourceId: 'site-erp-001', capturedAt,
          captureKind: 'refresh', sourceMasterHash: 'b'.repeat(64),
          appliedBy: 'author-1', appliedAt: capturedAt,
          changeReason: 'ERP 주소 변경 선택 반영', auditEventId: 'audit-refresh-1',
        },
      },
    } as typeof snapshot;

    render(<ConstructionPlanErpSnapshotPanel plan={refreshed} />);

    expect(screen.getByText('서버 선택 반영 · 필드별 출처 보존')).toBeInTheDocument();
    expect(screen.getByText('필드별 출처 참조')).toBeInTheDocument();
    expect(screen.getByText('선택 반영 · 필드별 출처 2건')).toBeInTheDocument();
    expect(screen.getByText('최근 반영사유')).toBeInTheDocument();
    expect(screen.getAllByText('ERP 주소 변경 선택 반영').length).toBeGreaterThan(0);
    expect(screen.getAllByText('audit-refresh-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SHA-256 b{12}/).length).toBeGreaterThan(0);
    expect(screen.getByText('필드별 출처·버전 2건')).toBeInTheDocument();
    expect(screen.getByText('site.address')).toBeInTheDocument();
    expect(screen.getAllByText('원천 문서 site:site-erp-001')).toHaveLength(2);
    expect(screen.getByText('수정사유 ERP 주소 변경 선택 반영')).toBeInTheDocument();
  });

  it('prints canonical company and team public information on the project overview A4 page', () => {
    const plan = makePlan();
    const section = plan.sections.find((candidate) => candidate.key === 'project-overview');
    if (!section) throw new Error('project-overview fixture missing');

    const { container } = render(<ConstructionPlanA4Preview plan={plan} section={section} zoom={1} />);

    expect(container).toHaveTextContent('ERP 회사·조직 원본');
    expect(container).toHaveTextContent('청연 발주 주식회사');
    expect(container).toHaveTextContent('123-45-67890');
    expect(container).toHaveTextContent('대한 원도급 건설');
    expect(container).toHaveTextContent('시스템동바리팀');
    expect(container).toHaveTextContent('박책임');
    expect(container).toHaveTextContent('ID site-erp-001');
    expect(container).not.toHaveTextContent('private-client@example.com');
  });

  it('shows audit-only worker directory provenance in organization focus', () => {
    const refreshed = makePlan();
    refreshed.organizationSnapshot = {
      ...refreshed.organizationSnapshot,
      workerDirectoryProvenance: {
        captureKind: 'refresh', sourceSiteId: 'site-erp-001', sourceTeamId: 'team-001',
        capturedAt, sourceMasterHash: 'c'.repeat(64), sourceWorkerIds: ['worker-1'],
        appliedBy: 'author-1', appliedAt: capturedAt,
        changeReason: '담당팀 작업자 명부 변경 반영', auditEventId: 'audit-worker-1',
      },
    };

    render(<ConstructionPlanErpSnapshotPanel plan={refreshed} focus="organization" />);

    expect(screen.getByLabelText('작업자 명부 출처')).toHaveTextContent('현장 site-erp-001 · 팀 team-001');
    expect(screen.getByText('담당팀 작업자 명부 변경 반영')).toBeInTheDocument();
    expect(screen.getByText('audit-worker-1')).toBeInTheDocument();
  });
});
