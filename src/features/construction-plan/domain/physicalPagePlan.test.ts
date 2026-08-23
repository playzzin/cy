import type { ConstructionPlan, ConstructionPlanTradeType, EquipmentPlanItem } from '../types';
import { buildConstructionPlanDraft } from './drafts';
import {
  CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT,
  planConstructionPlanPhysicalPages,
} from './physicalPagePlan';

const makePlan = (tradeType: ConstructionPlanTradeType = 'system-shoring'): ConstructionPlan =>
  buildConstructionPlanDraft(`physical-${tradeType}`, {
    siteId: 'site-physical',
    siteName: '물리 페이지 검증 현장',
    createdBy: 'author-1',
    tradeType,
    templateId: tradeType === 'system-scaffold' ? 'system-scaffold-standard' : 'system-shoring-standard',
    templateVersion: '1.0.0',
  }, '2026-08-22T00:00:00.000Z');

const worker = (index: number) => ({
  id: `worker-${index}`,
  name: `작업자 ${index}`,
  role: '설치공',
  teamName: '시스템 시공팀',
  status: 'active' as const,
});

const equipment = (
  index: number,
  category: EquipmentPlanItem['category'],
  controlMeasures: string[] = ['작업 전 점검', '통제원 배치'],
): EquipmentPlanItem => ({
  id: `equipment-${category}-${index}`,
  category,
  equipmentName: `${category} 장비 ${index}`,
  model: `MODEL-${index}`,
  registrationNo: `REG-${index}`,
  workZones: ['A구간'],
  plannedStages: ['반입', '설치', '해체'],
  controlMeasures,
});

describe('planConstructionPlanPhysicalPages', () => {
  it.each(['system-shoring', 'system-scaffold'] as const)(
    'keeps a small %s document at exactly 42 physical pages',
    (tradeType) => {
      const result = planConstructionPlanPhysicalPages(makePlan(tradeType));
      expect(result.logicalPageCount).toBe(42);
      expect(result.physicalPageCount).toBe(42);
      expect(result.pageManifest).toHaveLength(42);
      expect(result.pageManifest.map((page) => page.logicalPageNumber)).toEqual(
        Array.from({ length: 42 }, (_, index) => index + 1),
      );
    },
  );

  it('renders only the explicitly selected TOC sections while preserving logical page identities', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      selectedSectionKeys: [
        'cover', 'document-control', 'toc', 'project-overview', 'equipment-plan', 'safety-plan',
      ],
    };
    const result = planConstructionPlanPhysicalPages(plan);

    expect(result.logicalPageCount).toBe(7);
    expect(result.physicalPageCount).toBe(7);
    expect(result.pageManifest.map((page) => page.logicalPageNumber)).toEqual([1, 2, 3, 4, 6, 9, 35]);
    expect(result.pages.map((page) => page.section.key)).toEqual([
      'cover', 'document-control', 'toc', 'toc', 'project-overview', 'equipment-plan', 'safety-plan',
    ]);
  });

  it('continues 17+ workers without omitting assignments or worker coverage', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      organizationSnapshot: {
        ...base.organizationSnapshot,
        additionalWorkers: Array.from({ length: 33 }, (_, index) => worker(index)),
      },
    };
    const result = planConstructionPlanPhysicalPages(plan);
    const organizationPages = result.pages.filter((page) => page.manifest.logicalPageNumber === 7);

    expect(organizationPages).toHaveLength(3);
    expect(organizationPages.map((page) => page.manifest.continuationIndex)).toEqual([0, 1, 2]);
    expect(organizationPages.flatMap((page) => page.plan.organizationSnapshot.additionalWorkers))
      .toEqual(plan.organizationSnapshot.additionalWorkers);
    plan.organizationSnapshot.assignments.forEach((_, index) => {
      expect(organizationPages.flatMap((page) => page.manifest.coveragePaths))
        .toContain(`organizationSnapshot.assignments[${index}]`);
    });
    plan.organizationSnapshot.additionalWorkers.forEach((_, index) => {
      expect(organizationPages.flatMap((page) => page.manifest.coveragePaths))
        .toContain(`organizationSnapshot.additionalWorkers[${index}]`);
    });
    expect(new Set(organizationPages.map((page) => page.manifest.payloadHash)).size).toBe(3);
  });

  it('keeps all 500 safe-directory workers within the bounded physical page contract', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      organizationSnapshot: {
        ...base.organizationSnapshot,
        additionalWorkers: Array.from({ length: 500 }, (_, index) => worker(index)),
      },
    };
    const result = planConstructionPlanPhysicalPages(plan);
    const organizationPages = result.pages.filter((page) => page.manifest.logicalPageNumber === 7);
    expect(result.physicalPageCount).toBe(73);
    expect(result.physicalPageCount).toBeLessThanOrEqual(CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT);
    expect(organizationPages).toHaveLength(32);
    expect(organizationPages.flatMap((page) => page.plan.organizationSnapshot.additionalWorkers))
      .toEqual(plan.organizationSnapshot.additionalWorkers);
    expect(organizationPages.flatMap((page) => page.manifest.coveragePaths)
      .filter((path) => path.startsWith('organizationSnapshot.additionalWorkers[')))
      .toHaveLength(500);
  });

  it('uses visible length and multiline weight for equipment and structured rows', () => {
    const base = makePlan();
    const multilineControl = `${'통제구역 확인 및 유도자 배치 '.repeat(80)}\n${'비상정지 신호 확인 '.repeat(50)}`;
    const longStructured = `${'검측 기준과 조치 결과를 기록한다 '.repeat(28)}\n${'재검측 후 승인 '.repeat(18)}`;
    const material = base.sections.find((section) => section.key === 'material-plan');
    if (!material) throw new Error('material-plan fixture missing');
    const plan: ConstructionPlan = {
      ...base,
      equipmentPlan: [
        equipment(1, 'transport', [multilineControl]),
        equipment(2, 'transport', [multilineControl]),
      ],
      sections: base.sections.map((section) => section.id === material.id ? {
        ...section,
        content: {
          ...section.content,
          materials: [0, 1].map((index) => ({
            id: `material-${index}`,
            materialName: `수직재 ${index}`,
            specification: 'Ø60.5 × 2.3t',
            approvalReference: `MAT-${index}`,
            plannedQuantity: '100',
            unit: '본',
            deliveryPeriod: '2026-09-01',
            inspectionCriteria: [longStructured],
            storageLocation: 'A구간 적치장',
            storageControls: [longStructured],
          })),
        },
      } : section),
    };
    const result = planConstructionPlanPhysicalPages(plan);
    const equipmentPages = result.pages.filter((page) => page.manifest.logicalPageNumber === 9);
    const materialPages = result.pages.filter((page) => page.section.id === material.id);

    expect(equipmentPages.length).toBeGreaterThan(1);
    expect(materialPages.length).toBeGreaterThan(1);
    expect(equipmentPages.flatMap((page) => page.plan.equipmentPlan.map((item) => item.id)))
      .toEqual(plan.equipmentPlan.map((item) => item.id));
    expect(materialPages.flatMap((page) => page.manifest.coveragePaths))
      .toEqual(expect.arrayContaining([
        `sections.${material.id}.content.materials[0]`,
        `sections.${material.id}.content.materials[1]`,
      ]));
  });

  it('partitions every visible structured text-list exactly once instead of duplicating it', () => {
    const base = makePlan();
    const safety = base.sections.find((section) => section.key === 'safety-plan');
    if (!safety) throw new Error('safety-plan fixture missing');
    const longMeasure = (label: string) => `${label} ${'통제기준 확인 및 조치결과 기록 '.repeat(12)}`;
    const content = {
      ...safety.content,
      applicableZones: Array.from({ length: 8 }, (_, index) => longMeasure(`적용구간-${index}`)),
      supervisorWorkerIds: Array.from({ length: 8 }, (_, index) => `supervisor-${index}`),
      toolboxTopics: Array.from({ length: 8 }, (_, index) => longMeasure(`TBM-${index}`)),
      ppeRequirements: Array.from({ length: 8 }, (_, index) => ({
        id: `ppe-${index}`,
        workStage: longMeasure(`단계-${index}`),
        item: '안전대 및 안전모',
        standard: longMeasure(`기준-${index}`),
      })),
      accessControlMeasures: Array.from({ length: 8 }, (_, index) => longMeasure(`출입-${index}`)),
      fallPreventionMeasures: Array.from({ length: 8 }, (_, index) => longMeasure(`추락-${index}`)),
      fallingObjectPreventionMeasures: Array.from({ length: 8 }, (_, index) => longMeasure(`낙하-${index}`)),
      stopWorkCriteria: Array.from({ length: 8 }, (_, index) => longMeasure(`중지-${index}`)),
      permitTypes: Array.from({ length: 8 }, (_, index) => longMeasure(`허가-${index}`)),
    };
    const plan: ConstructionPlan = {
      ...base,
      sections: base.sections.map((section) => section.id === safety.id
        ? { ...section, content }
        : section),
    };
    const result = planConstructionPlanPhysicalPages(plan);
    const safetyPages = result.pages.filter((page) => page.section.id === safety.id);

    expect(safetyPages.length).toBeGreaterThan(1);
    Object.entries(content).forEach(([field, value]) => {
      if (!Array.isArray(value)) return;
      value.forEach((_, index) => {
        const path = `sections.${safety.id}.content.${field}[${index}]`;
        expect(safetyPages.flatMap((page) => page.manifest.coveragePaths)
          .filter((candidate) => candidate === path)).toHaveLength(1);
      });
    });
    const renderedValues = safetyPages.flatMap((page) => (
      Object.entries(page.section.content).flatMap(([field, value]) => (
        Array.isArray(value) ? value.map((entry) => [field, entry]) : []
      ))
    ));
    const originalValues = Object.entries(content).flatMap(([field, value]) => (
      Array.isArray(value) ? value.map((entry) => [field, entry]) : []
    ));
    expect(renderedValues).toEqual(originalValues);
  });

  it('rejects an indivisible row that is taller than the A4 body with its exact path', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      equipmentPlan: [equipment(1, 'transport', ['가'.repeat(4_000)])],
    };
    expect(() => planConstructionPlanPhysicalPages(plan)).toThrow(
      'construction-plan-physical-row-too-tall:logicalPages[9].equipmentPlan.equipment-transport-1',
    );
  });

  it('fails closed when continuations would exceed the 200-page physical ceiling', () => {
    const base = makePlan();
    const plan: ConstructionPlan = {
      ...base,
      organizationSnapshot: {
        ...base.organizationSnapshot,
        additionalWorkers: Array.from({ length: 3_000 }, (_, index) => worker(index)),
      },
    };
    expect(() => planConstructionPlanPhysicalPages(plan)).toThrow(
      `construction-plan-physical-page-count-invalid:${CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT + 29}`,
    );
  });
});
