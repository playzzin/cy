import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildConstructionPlanDraft } from '../domain';
import { SYSTEM_SHORING_TEMPLATE_MANIFEST } from '../domain/templateManifest';
import type { ConstructionPlan, DrawingApplicabilityDecision, PlanDrawing, SafeWorkerDto } from '../types';
import ConstructionPlanA4Preview from './ConstructionPlanA4Preview';
import ConstructionPlanPrintDocument from './ConstructionPlanPrintDocument';

const operator: SafeWorkerDto = { id: 'worker-operator', name: '김운전', role: '운전원', status: 'active' };
const signaler: SafeWorkerDto = { id: 'worker-signal', name: '이신호', role: '신호수', status: 'active' };

const drawing = {
  id: 'drawing-1',
  drawingNo: 'D-01-A',
  title: '101동 시스템동바리 평면도',
  revision: 'R5',
  approvalStatus: 'approved',
  approvalReference: '승인공문-2026-101',
  originalFileName: 'D-01-A.png',
  annotations: [{
    id: 'domain-install-zone',
    pageIndex: 0,
    layer: 'install',
    geometry: { kind: 'rect', x: 0.1, y: 0.15, w: 0.3, h: 0.25, rotationDeg: 0 },
    style: { strokeToken: 'construction-plan.install.stroke', fillToken: 'construction-plan.install.fill', strokeWidthPt: 2, opacity: 0.42, dash: 'solid', hatch: 'none' },
    label: '권위 설치구간',
    zoneCode: 'A구간',
    sequence: 1,
    styleVersion: 1,
    locked: false,
    createdBy: 'author-1',
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedBy: 'author-1',
    updatedAt: '2026-08-21T00:00:00.000Z',
  }],
} as PlanDrawing;

const decisions: DrawingApplicabilityDecision[] = [
  { drawingSlot: 'D-01', decision: 'applicable', drawingId: drawing.id, reason: '', reviewedBy: '박검토' },
  { drawingSlot: 'D-02', decision: 'replacement', drawingId: drawing.id, reason: '', reviewedBy: '박검토', technicalReviewReference: '구조검토-2026-02' },
  ...(['D-03', 'D-04', 'D-05', 'D-06'] as const).map((drawingSlot) => ({
    drawingSlot,
    decision: 'not_applicable' as const,
    reason: `${drawingSlot} 현장 조건상 적용하지 않음`,
    reviewedBy: '박검토',
  })),
];

const makePlan = (): ConstructionPlan => {
  const draft = buildConstructionPlanDraft('plan-print', {
    siteId: 'site-1',
    siteName: '인쇄 검증 현장',
    createdBy: 'author-1',
  }, '2026-08-21T00:00:00.000Z');
  return {
    ...draft,
    projectSnapshot: { ...draft.projectSnapshot, zones: ['A구간'] },
    organizationSnapshot: { ...draft.organizationSnapshot, additionalWorkers: [operator, signaler] },
    drawings: [drawing],
    drawingApplicability: decisions,
    engineeringValues: [{
      key: '지주 X방향 간격',
      value: 900,
      unit: 'mm',
      sourceDocumentId: '구조검토서-101',
      sourceRevision: 'REV.3',
      sourcePageOrSection: 'p.12 / 3.2절',
      applicableZones: ['A구간'],
      verificationStatus: 'approved',
      verifiedBy: '정구조',
      verifiedAt: '2026-08-20T00:00:00.000Z',
    }],
    equipmentPlan: [{
      id: 'crane-1',
      category: 'lifting',
      equipmentName: '이동식 크레인',
      model: 'CR-25',
      registrationNo: '서울 01-1234',
      ratedCapacity: '25t',
      workRadius: '12m',
      inspectionValidUntil: '2027-08-20',
      operatorWorkerId: operator.id,
      signalerWorkerId: signaler.id,
      workZones: ['A구간'],
      plannedStages: ['자재 반입', '인양'],
      controlMeasures: ['작업반경 출입통제', '신호수 배치'],
    }],
  };
};

describe('ConstructionPlanPrintDocument', () => {
  it('renders 42 A4 pages and materializes drawing, engineering, and equipment data', () => {
    const plan = makePlan();
    const { container } = render(<ConstructionPlanPrintDocument plan={plan} />);

    expect(container.querySelectorAll('.cp-a4')).toHaveLength(42);
    expect(screen.getByText('도면 적용성 및 승인근거')).toBeInTheDocument();
    expect(screen.getByText('승인공문-2026-101')).toBeInTheDocument();
    expect(screen.getAllByText('지주 X방향 간격').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('구조검토서-101').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('REV.3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('이동식 크레인').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('김운전').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('신호수 이신호').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('현장 실행용 빈 양식 · 발행 시점 미실시')).toHaveLength(6);
    expect(screen.getAllByText(/승인 증적이 아니며 실제 작업일에 별도 기록/)).toHaveLength(6);
  });

  it('maps an A4 table-cell click to the canonical right-panel field target', () => {
    const plan = makePlan();
    const engineeringSection = plan.sections.find((section) => ['member-specifications', 'connection-details', 'structural-control'].includes(section.key));
    if (!engineeringSection) throw new Error('engineering fixture missing');
    const onSelectField = jest.fn();
    render(<ConstructionPlanA4Preview plan={plan} section={engineeringSection} onSelectField={onSelectField} />);

    fireEvent.click(screen.getByText('구조검토서-101'));

    expect(onSelectField).toHaveBeenCalledWith({
      path: 'engineeringValues.0.sourceDocumentId',
      relatedId: '지주 X방향 간격',
    });
  });

  it('maps an A4 drawing-object click to the persisted annotation workspace target', () => {
    const plan = makePlan();
    const drawingSection = plan.sections.find((section) => section.key === 'drawing-d01');
    if (!drawingSection) throw new Error('drawing fixture missing');
    const section = { ...drawingSection, content: { ...drawingSection.content, drawingId: drawing.id } };
    const onSelectField = jest.fn();
    const { container } = render(
      <ConstructionPlanA4Preview
        plan={plan}
        section={section}
        drawingPreviewUrl="blob:drawing"
        onSelectField={onSelectField}
      />,
    );

    const object = container.querySelector('[data-preview-object-id="domain-install-zone"]');
    expect(object).toBeInTheDocument();
    fireEvent.click(object!);

    expect(onSelectField).toHaveBeenCalledWith({
      path: 'drawings.0.annotations.0',
      relatedId: 'domain-install-zone',
      objectId: 'domain-install-zone',
    });
  });

  it('renders worker continuations as separate A4 pages and points the TOC to physical starts', () => {
    const base = makePlan();
    const additionalWorkers = Array.from({ length: 17 }, (_, index): SafeWorkerDto => ({
      id: `dynamic-worker-${index}`,
      name: `연속 작업자 ${index}`,
      role: '설치공',
      status: 'active',
    }));
    const plan: ConstructionPlan = {
      ...base,
      organizationSnapshot: { ...base.organizationSnapshot, additionalWorkers },
    };
    const { container } = render(<ConstructionPlanPrintDocument plan={plan} />);
    const pages = Array.from(container.querySelectorAll<HTMLElement>('.cp-a4'));
    const organizationPages = pages.filter((page) => page.dataset.logicalPage === '7');

    expect(pages).toHaveLength(43);
    expect(organizationPages).toHaveLength(2);
    expect(organizationPages.map((page) => page.dataset.continuationIndex)).toEqual(['0', '1']);
    additionalWorkers.forEach((worker) => {
      expect(screen.getAllByText(worker.name)).toHaveLength(1);
    });
    expect(pages[42]).toHaveTextContent('43 / 43');
    const tocPage = pages[2];
    const logicalPageEightRow = Array.from(tocPage.querySelectorAll('tbody tr'))
      .find((row) => row.textContent?.includes('자재 반입 및 보관계획'));
    expect(logicalPageEightRow?.querySelector('td:last-child')).toHaveTextContent('9');
  });

  it('prints each duplicate and cross-site role reason on the A4 organization page', () => {
    const plan = makePlan();
    const sharedWorker: SafeWorkerDto = {
      id: 'worker-shared', name: '김겸임', status: 'active', siteId: 'site-2', position: '안전관리자',
    };
    plan.organizationSnapshot.assignments[0] = {
      ...plan.organizationSnapshot.assignments[0],
      worker: sharedWorker,
      externalAssignment: true,
      exceptionReason: '현장책임자 역할 승인 겸임 사유',
    };
    plan.organizationSnapshot.assignments[1] = {
      ...plan.organizationSnapshot.assignments[1],
      worker: sharedWorker,
      externalAssignment: true,
      exceptionReason: '공사담당 역할 승인 겸임 사유',
    };
    const organizationSection = plan.sections.find((section) => section.key === 'organization');
    if (!organizationSection) throw new Error('organization fixture missing');

    const { container } = render(<ConstructionPlanA4Preview plan={plan} section={organizationSection} />);
    expect(container).toHaveTextContent('겸임·현장 외 · 현장책임자 역할 승인 겸임 사유');
    expect(container).toHaveTextContent('겸임·현장 외 · 공사담당 역할 승인 겸임 사유');
  });

  it('renders the company logo and selected scaffold identity on the cover', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      tradeType: 'system-scaffold',
      templateId: 'system-scaffold-standard',
      title: '시스템비계 시공계획서',
    };
    const cover = plan.sections.find((section) => section.key === 'cover');
    if (!cover) throw new Error('cover fixture missing');

    const { container } = render(<ConstructionPlanA4Preview plan={plan} section={cover} />);
    expect(screen.getByRole('img', { name: '청연이엔지' })).toHaveAttribute(
      'src',
      '/assets/estimate/cheongyeon-logo.png',
    );
    expect(container).toHaveTextContent('시스템비계 시공계획서');
    expect(container).toHaveTextContent('설치 · 사용 · 점검 · 해체 작업계획');
  });

  it('uses the exact scaffold manifest for all 42 print and TOC pages', () => {
    const scaffoldPlan = buildConstructionPlanDraft('plan-scaffold-print', {
      siteId: 'site-1',
      siteName: '비계 인쇄 검증 현장',
      createdBy: 'author-1',
      tradeType: 'system-scaffold',
      templateId: 'system-scaffold-standard',
      templateVersion: '1.0.0',
    }, '2026-08-21T00:00:00.000Z');

    const { container } = render(<ConstructionPlanPrintDocument plan={scaffoldPlan} />);
    const pages = container.querySelectorAll('.cp-a4');
    expect(pages).toHaveLength(42);
    expect(pages[14]).toHaveTextContent('시스템비계 개요');
    expect(pages[20]).toHaveTextContent('벽이음·앵커 접합 상세');
    expect(pages[30]).toHaveTextContent('작업발판·승강통로 계획');
    expect(pages[32]).toHaveTextContent('사용 중 점검·보수 및 변경관리');
    expect(pages[39]).toHaveTextContent('시스템비계 일일점검일지');
    expect(pages[2]).toHaveTextContent('시스템비계 개요');
    expect(pages[3]).toHaveTextContent('작업발판·승강통로 계획');
    expect(pages[3]).toHaveTextContent('사용 중 점검·보수 및 변경관리');
    expect(container.textContent).not.toContain('콘크리트 타설계획');
    expect(container.textContent).not.toContain('존치 및 재동바리 계획');
  });

  it('uses the versioned trade-specific standard copy in A4 preview', () => {
    const base = makePlan();
    const shoringSection = base.sections.find((section) => section.key === 'system-overview');
    if (!shoringSection) throw new Error('system-overview fixture missing');
    const { rerender } = render(<ConstructionPlanA4Preview plan={base} section={shoringSection} />);
    expect(screen.getByText(/상부 하중은 받침·잭·수직재·기초로 연속 전달/)).toBeInTheDocument();

    const scaffoldPlan: ConstructionPlan = {
      ...base,
      tradeType: 'system-scaffold',
      templateId: 'system-scaffold-standard',
      title: '시스템비계 시공계획서',
    };
    rerender(<ConstructionPlanA4Preview plan={scaffoldPlan} section={shoringSection} />);
    expect(screen.getByText(/수직하중과 풍하중이 받침철물·수직재·벽이음·기초/)).toBeInTheDocument();
    expect(screen.queryByText(/상부 하중은 받침·잭·수직재·기초로 연속 전달/)).not.toBeInTheDocument();
  });

  it('renders structured site data as localized reusable rows instead of generic free text', () => {
    const plan = makePlan();
    const material = plan.sections.find((section) => section.key === 'material-plan');
    if (!material) throw new Error('material-plan fixture missing');
    const section = {
      ...material,
      content: {
        structuredDataVersion: 1,
        applicableZones: ['101동 A구간'],
        deliveryRoute: '동문 → 자재하역장',
        unloadingMethod: '지게차 하역',
        responsibleWorkerId: 'worker-material',
        materials: [{
          id: 'material-1',
          materialName: '수직재',
          specification: 'Ø60.5 × 2.3t',
          approvalReference: '자재승인서 MAT-101',
          plannedQuantity: '240',
          unit: '본',
          deliveryPeriod: '2026-08-25',
          inspectionCriteria: ['변형 없음', '부식 없음'],
          storageLocation: 'A구간 적치장',
          storageControls: ['받침목 설치', '전도방지 결속'],
        }],
      },
    };

    const { container } = render(<ConstructionPlanA4Preview plan={plan} section={section} />);
    expect(container).toHaveTextContent('자재별 승인·검수·반입·적치·보관 조건');
    expect(container).toHaveTextContent('동문 → 자재하역장 / 지게차 하역');
    expect(container).toHaveTextContent('수직재');
    expect(container).toHaveTextContent('자재승인서 MAT-101');
    expect(container).toHaveTextContent('받침목 설치 · 전도방지 결속');
    expect(container).not.toHaveTextContent('본 절은 시스템동바리 작업의 적용기준');
  });

  it('prints the quantitative 5x5 risk calculation, method and review trigger', () => {
    const base = makePlan();
    const section = base.sections.find((candidate) => candidate.key === 'risk-assessment');
    if (!section) throw new Error('risk-assessment fixture missing');
    const plan: ConstructionPlan = {
      ...base,
      riskAssessments: [{
        id: 'risk-1',
        workStage: '수직재 설치',
        hazard: '부재 전도 및 작업자 충돌',
        initialRiskLevel: 'high',
        initialProbability: 4,
        initialSeverity: 4,
        mitigationMeasures: ['임시가새 선행 설치', '통제구역 설정'],
        residualRiskLevel: 'low',
        residualProbability: 2,
        residualSeverity: 2,
        assessmentMethodVersion: 2,
        methodReference: SYSTEM_SHORING_TEMPLATE_MANIFEST.riskAssessmentPolicy.methodReference,
        reviewTrigger: SYSTEM_SHORING_TEMPLATE_MANIFEST.riskAssessmentPolicy.reviewTriggers[0],
        verifiedBy: '안전관리자',
      }],
    };
    const { container } = render(<ConstructionPlanA4Preview plan={plan} section={section} />);
    expect(container).toHaveTextContent('4×4=16');
    expect(container).toHaveTextContent('2×2=4');
    expect(container).toHaveTextContent(SYSTEM_SHORING_TEMPLATE_MANIFEST.riskAssessmentPolicy.methodReference);
    expect(container).toHaveTextContent(SYSTEM_SHORING_TEMPLATE_MANIFEST.riskAssessmentPolicy.reviewTriggers[0]);
    expect(container).toHaveTextContent('가능성(1~5) × 중대성(1~5)');
    expect(container).toHaveTextContent('허용기준은 잔여 9점 이하');
    expect(container).toHaveTextContent('10~16 높음');
  });

  it('prefers the short-lived runtime drawing preview URL over a stored URL', () => {
    const plan = makePlan();
    const section = plan.sections.find((candidate) => candidate.key === 'drawing-d01');
    if (!section) throw new Error('drawing-d01 fixture missing');
    const drawingSection = {
      ...section,
      content: {
        drawingId: drawing.id,
        drawingStudio: {
          schemaVersion: 1,
          background: { fileName: 'D-01.png', mimeType: 'image/png', sizeBytes: 1024, kind: 'image', sourceUrl: 'https://stored.invalid/preview.png' },
          objects: [{ id: 'stale-object', kind: 'rectangle', layer: 'dismantle', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], label: '오래된 Studio 표시', zoneCode: '' }],
        },
      },
    };
    const { container } = render(
      <ConstructionPlanA4Preview
        plan={plan}
        section={drawingSection}
        drawingPreviewUrl="blob:https://runtime.invalid/signed-preview"
      />,
    );

    expect(container.querySelector('.cp-a4__drawing-sheet > img'))
      .toHaveAttribute('src', 'blob:https://runtime.invalid/signed-preview');
    expect(container).toHaveTextContent('권위 설치구간');
    expect(container).not.toHaveTextContent('오래된 Studio 표시');
  });

  it('prints annotations from the exact persisted PDF page selection', () => {
    const sourceSha256 = 'd'.repeat(64);
    const pagePath = (pageIndex: number) =>
      `construction-plans/site-1/plan-print/previews/drawing-1/${sourceSha256}/page-${String(pageIndex + 1).padStart(4, '0')}.png`;
    const plan = makePlan();
    const drawingSection = plan.sections.find((candidate) => candidate.key === 'drawing-d01');
    if (!drawingSection) throw new Error('drawing-d01 fixture missing');
    const pdfDrawing: PlanDrawing = {
      ...drawing,
      planId: plan.id,
      storagePath: 'construction-plans/site-1/plan-print/drawings/drawing-1/source.pdf',
      sourceSha256,
      sourceGeneration: '10',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      pageCount: 2,
      previewStatus: 'ready',
      previewPaths: [pagePath(0), pagePath(1)],
      pages: [0, 1].map((pageIndex) => ({
        pageIndex,
        mediaBoxPt: { left: 0, bottom: 0, right: 612, top: 792 },
        cropBoxPt: { left: 0, bottom: 0, right: 612, top: 792 },
        rotation: pageIndex === 1 ? 90 : 0,
        pageFingerprint: `source:${sourceSha256}:page:${pageIndex}`,
        previewPath: pagePath(pageIndex),
        previewGeneration: String(20 + pageIndex),
        previewSha256: String(pageIndex + 1).repeat(64),
      })),
      annotations: [
        { ...drawing.annotations[0], pageFingerprint: `source:${sourceSha256}:page:0`, label: '첫 페이지 표시' },
        { ...drawing.annotations[0], id: 'page-two-mark', pageIndex: 1, pageFingerprint: `source:${sourceSha256}:page:1`, label: '둘째 페이지 표시' },
      ],
      previewUpdatedAt: '2026-08-22T00:00:00.000Z',
      uploadedBy: 'author-1',
      uploadedAt: '2026-08-21T00:00:00.000Z',
      applicableZones: ['A구간'],
      previewErrorCode: undefined,
      previewErrorMessage: undefined,
    };
    const selectedSection = {
      ...drawingSection,
      content: {
        ...drawingSection.content,
        drawingId: pdfDrawing.id,
        drawingPageIndex: 1,
      },
    };

    const { container } = render(<ConstructionPlanA4Preview
      plan={{ ...plan, drawings: [pdfDrawing] }}
      section={selectedSection}
      drawingPreviewUrl="blob:page-two"
    />);

    expect(container.querySelector('.cp-a4__drawing-sheet > img')).toHaveAttribute('src', 'blob:page-two');
    expect(container.querySelector('.cp-a4__drawing-sheet svg')).toHaveAttribute('viewBox', '0 0 1000 773');
    expect(container).toHaveTextContent('PDF 2/2');
    expect(container).toHaveTextContent('둘째 페이지 표시');
    expect(container).not.toHaveTextContent('첫 페이지 표시');
  });

  it('materializes rich ellipse, marker, text and polyline annotations without downgrading them', () => {
    const plan = makePlan();
    const drawingSection = plan.sections.find((candidate) => candidate.key === 'drawing-d01');
    if (!drawingSection) throw new Error('drawing-d01 fixture missing');
    const baseAnnotation = drawing.annotations[0];
    const richDrawing: PlanDrawing = {
      ...drawing,
      annotations: [
        { ...baseAnnotation, id: 'ellipse', geometry: { kind: 'ellipse', cx: 0.3, cy: 0.3, rx: 0.12, ry: 0.08 }, label: '타원 구간' },
        { ...baseAnnotation, id: 'marker', geometry: { kind: 'marker', x: 0.5, y: 0.45, markerType: 'pin' }, label: '검측점' },
        { ...baseAnnotation, id: 'text', geometry: { kind: 'text', x: 0.55, y: 0.5, w: 0.25, h: 0.08, align: 'center' }, label: '현장 주의문구' },
        { ...baseAnnotation, id: 'polyline', geometry: { kind: 'polyline', vertices: [{ x: 0.1, y: 0.8 }, { x: 0.5, y: 0.7 }, { x: 0.8, y: 0.82 }], arrowStart: true, arrowEnd: true }, label: '장비 동선' },
      ],
    };
    const section = { ...drawingSection, content: { ...drawingSection.content, drawingId: richDrawing.id } };
    const { container } = render(<ConstructionPlanA4Preview
      plan={{ ...plan, drawings: [richDrawing] }}
      section={section}
      drawingPreviewUrl="blob:rich-drawing"
    />);

    expect(container.querySelector('.cp-a4__drawing-sheet ellipse')).toBeInTheDocument();
    expect(container.querySelectorAll('.cp-a4__drawing-sheet circle').length).toBeGreaterThanOrEqual(1);
    expect(container).toHaveTextContent('현장 주의문구');
    expect(container.querySelector('.cp-a4__drawing-sheet polyline')).toHaveAttribute('marker-start');
    expect(container).toHaveTextContent('장비 동선');
  });

  it('ignores legacy custom styles and uses the exact layer standards in the A4 preview', () => {
    const plan = makePlan();
    const drawingSection = plan.sections.find((candidate) => candidate.key === 'drawing-d01');
    if (!drawingSection) throw new Error('drawing-d01 fixture missing');
    const styledDrawing: PlanDrawing = {
      ...drawing,
      annotations: [{
        ...drawing.annotations[0],
        layer: 'dismantle',
        startDate: '2026-09-01',
        style: {
          ...drawing.annotations[0].style,
          strokeToken: 'red',
          fillToken: 'teal',
          opacity: 0.55,
          dash: 'dot',
          hatch: 'cross',
        },
      }, {
        ...drawing.annotations[0],
        id: 'styled-retain-zone',
        layer: 'retain',
        reason: '구조검토 조건 유지',
        releaseCondition: '승인강도 확인 후 해제',
        geometry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.3, h: 0.08, rotationDeg: 0 },
        style: {
          ...drawing.annotations[0].style,
          strokeToken: 'purple',
          fillToken: 'gray',
          fontSizePt: 18,
        },
        label: '존치 스타일 검증',
      }],
    };
    const section = { ...drawingSection, content: { ...drawingSection.content, drawingId: styledDrawing.id } };
    const { container } = render(<ConstructionPlanA4Preview
      plan={{ ...plan, drawings: [styledDrawing] }}
      section={section}
      drawingPreviewUrl="blob:styled-drawing"
    />);

    const dismantle = container.querySelector('rect[stroke="#f97316"]');
    expect(dismantle).toHaveAttribute('fill', '#fdba74');
    expect(dismantle).toHaveAttribute('opacity', '0.42');
    expect(dismantle).toHaveAttribute('stroke-dasharray', '3 7');
    const retain = container.querySelector('rect[stroke="#dc2626"]');
    expect(retain).toHaveAttribute('fill', 'url(#cp-a4-pattern-styled-retain-zone)');
    expect(retain).toHaveAttribute('opacity', '0.42');
    expect(container.querySelector('pattern rect[fill="#fecaca"]')).toBeInTheDocument();
  });

  it('prints the revision reason, type, source revision, and source snapshot hash', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      revision: 3,
      sourceRevisionNo: 1,
      revisionReason: '현장 조건 변경에 따른 배치 보완',
      revisionType: 'site_condition',
      supersedesPlanId: 'plan-print-rev-00',
      sourceSnapshotHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    };
    const section = plan.sections.find((candidate) => candidate.kind === 'document-control');
    if (!section) throw new Error('document-control fixture missing');

    render(<ConstructionPlanA4Preview plan={plan} section={section} />);
    expect(screen.getByText('현장 조건 변경')).toBeInTheDocument();
    expect(screen.getByText('현장 조건 변경에 따른 배치 보완')).toBeInTheDocument();
    expect(screen.getByText(/REV\.\s*01/)).toBeInTheDocument();
    expect(screen.getByText(/기준 승인 스냅샷: abcdef1234567890/)).toBeInTheDocument();
  });
});
