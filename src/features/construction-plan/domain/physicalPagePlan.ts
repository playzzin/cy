import type { ConstructionPlan, PlanSection, StructuredSectionKey } from '../types';
import { isStructuredSectionKey } from '../types';
import { requireConstructionPlanTemplateByIdentity } from './templateRegistry';
import { normalizeConstructionPlanSelectedSectionKeys } from './documentComposition';

export const CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT = 42;
export const CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT = 200;

const WORKER_ROWS_PER_PAGE = 16;
const EQUIPMENT_ROWS_PER_PAGE = 8;
const ENGINEERING_ROWS_PER_PAGE = 12;
const RISK_ROWS_PER_PAGE = 10;
const STRUCTURED_ROWS_PER_PAGE = 4;

type IndexedValue<T> = { index: number; value: T };

type WeightedChunkOptions<T> = {
  rowBudget: number;
  charactersPerRowUnit: number;
  errorPath: (entry: IndexedValue<T>) => string;
};

const STRUCTURED_REPEAT_FIELDS: Readonly<Record<StructuredSectionKey, readonly string[]>> = {
  'material-plan': ['applicableZones', 'materials'],
  'equipment-signal': [
    'applicableZones', 'signalerWorkerIds', 'signalProtocols', 'accessControlMeasures',
  ],
  'site-installation-plan': [
    'applicableZones', 'drawingReferences', 'prerequisites', 'workSequence',
    'inspectionPoints', 'weatherStopCriteria',
  ],
  'concrete-pour-plan': [
    'applicableZones', 'pourSequence', 'concentratedLoadControls', 'stopCriteria',
  ],
  'dismantling-plan': [
    'applicableZones', 'prerequisites', 'workSequence', 'temporaryStabilityMeasures',
    'exclusionZones',
  ],
  'retention-plan': [
    'applicableZones', 'retentionZones', 'changeTriggers', 'changeApprovalRoles',
  ],
  'emergency-plan': [
    'applicableZones', 'contacts', 'scenarios', 'emergencyEquipment', 'reportingChain',
  ],
  'quality-plan': [
    'applicableZones', 'inspectionItems', 'holdPoints', 'nonconformanceProcess',
  ],
  'safety-plan': [
    'applicableZones', 'supervisorWorkerIds', 'toolboxTopics', 'ppeRequirements',
    'accessControlMeasures', 'fallPreventionMeasures', 'fallingObjectPreventionMeasures',
    'stopWorkCriteria', 'permitTypes',
  ],
  'environment-plan': [
    'applicableZones', 'aspects', 'wasteSegregation', 'dustControls', 'noiseControls',
    'spillResponse',
  ],
  'work-platform-access-plan': [
    'applicableZones', 'guardrailMeasures', 'toeBoardMeasures', 'accessLocations',
    'openingControls', 'inspectionPoints',
  ],
  'inspection-maintenance-plan': [
    'applicableZones', 'inspectionItems', 'defectResponse', 'weatherStopCriteria',
    'alterationApprovalRoles', 'wallTieChecks', 'platformChecks',
  ],
};

export interface ConstructionPlanPhysicalPageManifestEntry {
  physicalPageNumber: number;
  logicalPageNumber: number;
  continuationIndex: number;
  payloadHash: string;
  coveragePaths: string[];
}

export interface ConstructionPlanPhysicalPage {
  key: string;
  plan: ConstructionPlan;
  section: PlanSection;
  manifest: ConstructionPlanPhysicalPageManifestEntry;
}

export interface ConstructionPlanPhysicalPagePlan {
  pages: ConstructionPlanPhysicalPage[];
  pageManifest: ConstructionPlanPhysicalPageManifestEntry[];
  logicalStartPhysicalPages: ReadonlyMap<number, number>;
  logicalPageCount: number;
  physicalPageCount: number;
}

type PendingPhysicalPage = Omit<ConstructionPlanPhysicalPage, 'key' | 'manifest'> & {
  logicalPageNumber: number;
  continuationIndex: number;
  coveragePaths: string[];
};

type StructuredUnit = { field: string; index: number; value: unknown };

const visualCharacterCount = (value: unknown): number => {
  if (typeof value === 'string') {
    const normalized = value.replace(/\r/g, '');
    const newlineCount = normalized.split('\n').length - 1;
    return Array.from(normalized).length + (newlineCount * 80);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length;
  if (Array.isArray(value)) return value.reduce((total, entry) => total + visualCharacterCount(entry) + 4, 0);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .reduce((total, [key, entry]) => total + key.length + visualCharacterCount(entry) + 4, 0);
  }
  return 1;
};

/**
 * Browser A4 rows are indivisible. Partition them conservatively by their
 * visible text volume so multiline controls cannot be hidden below the page
 * footer. A single row that cannot fit is rejected with its exact data path.
 */
const weightedChunks = <T,>(
  values: readonly T[],
  options: WeightedChunkOptions<T>,
): Array<Array<IndexedValue<T>>> => {
  if (!Number.isInteger(options.rowBudget) || options.rowBudget < 1
    || !Number.isInteger(options.charactersPerRowUnit) || options.charactersPerRowUnit < 1) {
    throw new Error('construction-plan-physical-page-chunk-size-invalid');
  }
  if (values.length === 0) return [[]];
  const result: Array<Array<IndexedValue<T>>> = [];
  let current: Array<IndexedValue<T>> = [];
  let currentWeight = 0;
  values.forEach((value, index) => {
    const entry = { index, value };
    const rowWeight = Math.max(1, Math.ceil(visualCharacterCount(value) / options.charactersPerRowUnit));
    if (rowWeight > options.rowBudget) {
      throw new Error(`construction-plan-physical-row-too-tall:${options.errorPath(entry)}`);
    }
    if (current.length > 0 && currentWeight + rowWeight > options.rowBudget) {
      result.push(current);
      current = [];
      currentWeight = 0;
    }
    current.push(entry);
    currentWeight += rowWeight;
  });
  if (current.length > 0) result.push(current);
  if (result.some((chunk) => chunk.length === 0)
    || result.flat().length !== values.length) {
    throw new Error('construction-plan-physical-page-empty-or-row-loss');
  }
  return result;
};

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(',')}}`;
};

const hash32 = (value: string, seed: number): string => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const stablePayloadHash = (value: unknown): string => {
  const source = canonical(value);
  return [
    2_166_136_261,
    2_166_136_261 ^ 0x9e3779b9,
    2_166_136_261 ^ 0x85ebca6b,
    2_166_136_261 ^ 0xc2b2ae35,
    2_166_136_261 ^ 0x27d4eb2f,
    2_166_136_261 ^ 0x165667b1,
    2_166_136_261 ^ 0xd3a2646c,
    2_166_136_261 ^ 0xfd7046c5,
  ].map((seed) => hash32(source, seed)).join('');
};

const missingSection = (
  logicalPageNumber: number,
  templatePage: ReturnType<typeof requireConstructionPlanTemplateByIdentity>['manifest']['pages'][number],
): PlanSection => ({
  id: `missing-${templatePage.sectionKey}`,
  key: templatePage.sectionKey,
  title: templatePage.title,
  kind: templatePage.kind,
  order: logicalPageNumber - 1,
  pageNumbers: [logicalPageNumber],
  required: templatePage.required,
  status: 'empty',
  content: {},
  placeholders: ['필수 섹션 누락'],
  containsExampleValues: false,
  standardTextModified: false,
});

const sectionForLogicalPage = (
  plan: ConstructionPlan,
  logicalPageNumber: number,
  templatePage: ReturnType<typeof requireConstructionPlanTemplateByIdentity>['manifest']['pages'][number],
): PlanSection => {
  const source = plan.sections.find((section) => section.key === templatePage.sectionKey);
  return source
    ? { ...source, pageNumbers: [logicalPageNumber] }
    : missingSection(logicalPageNumber, templatePage);
};

const continuedSection = (
  section: PlanSection,
  continuationIndex: number,
  content: Record<string, unknown> = section.content,
): PlanSection => ({
  ...section,
  title: continuationIndex > 0 ? `${section.title} (계속 ${continuationIndex})` : section.title,
  content,
});

const structuredSlices = (section: PlanSection): Array<{ section: PlanSection; coveragePaths: string[] }> => {
  if (!isStructuredSectionKey(section.key)) return [{ section, coveragePaths: [] }];
  const fields = STRUCTURED_REPEAT_FIELDS[section.key];
  const units: StructuredUnit[] = fields.flatMap((field) => {
    const values = section.content[field];
    return Array.isArray(values)
      ? values.map((value, index) => ({ field, index, value }))
      : [];
  });
  return weightedChunks(units, {
    rowBudget: STRUCTURED_ROWS_PER_PAGE,
    charactersPerRowUnit: 620,
    errorPath: (entry) => `sections.${section.id}.content.${entry.value.field}[${entry.value.index}]`,
  }).map((entries, continuationIndex) => {
    const unitChunk = entries.map((entry) => entry.value);
    const content = { ...section.content };
    fields.forEach((field) => {
      if (Array.isArray(section.content[field])) {
        content[field] = unitChunk.filter((unit) => unit.field === field).map((unit) => unit.value);
      }
    });
    return {
      section: continuedSection(section, continuationIndex, content),
      coveragePaths: unitChunk.map((unit) => `sections.${section.id}.content.${unit.field}[${unit.index}]`),
    };
  });
};

const logicalPageSlices = (
  plan: ConstructionPlan,
  section: PlanSection,
  logicalPageNumber: number,
): PendingPhysicalPage[] => {
  const create = (
    continuationIndex: number,
    renderPlan: ConstructionPlan,
    renderSection: PlanSection,
    coveragePaths: string[],
  ): PendingPhysicalPage => ({
    plan: renderPlan,
    section: continuedSection(renderSection, continuationIndex, renderSection.content),
    logicalPageNumber,
    continuationIndex,
    coveragePaths: [
      `logicalPages[${logicalPageNumber}].continuations[${continuationIndex}]`,
      ...coveragePaths,
    ],
  });

  if (logicalPageNumber === 7) {
    return weightedChunks(plan.organizationSnapshot.additionalWorkers, {
      rowBudget: WORKER_ROWS_PER_PAGE,
      charactersPerRowUnit: 240,
      errorPath: (entry) => `organizationSnapshot.additionalWorkers[${entry.index}]`,
    }).map((workerEntries, index) => {
      const workers = workerEntries.map((entry) => entry.value);
      const assignmentPaths = index === 0
        ? plan.organizationSnapshot.assignments.map((_, assignmentIndex) => (
          `organizationSnapshot.assignments[${assignmentIndex}]`
        ))
        : [];
      return create(index, {
        ...plan,
        organizationSnapshot: { ...plan.organizationSnapshot, additionalWorkers: workers },
      }, section, [
        ...assignmentPaths,
        ...workerEntries.map((entry) => `organizationSnapshot.additionalWorkers[${entry.index}]`),
      ]);
    });
  }
  if (logicalPageNumber === 9 || logicalPageNumber === 11) {
    const source = logicalPageNumber === 11
      ? plan.equipmentPlan.filter((item) => item.category === 'lifting')
      : plan.equipmentPlan;
    return weightedChunks(source, {
      rowBudget: EQUIPMENT_ROWS_PER_PAGE,
      charactersPerRowUnit: 360,
      errorPath: (entry) => `logicalPages[${logicalPageNumber}].equipmentPlan.${entry.value.id}`,
    }).map((entries, index) => {
      const items = entries.map((entry) => entry.value);
      return create(index, {
      ...plan,
      equipmentPlan: items,
      }, section, items.map((item) => `logicalPages[${logicalPageNumber}].equipmentPlan.${item.id}`));
    });
  }
  if (logicalPageNumber === 17 || logicalPageNumber === 29) {
    return weightedChunks(plan.engineeringValues, {
      rowBudget: ENGINEERING_ROWS_PER_PAGE,
      charactersPerRowUnit: 320,
      errorPath: (entry) => `logicalPages[${logicalPageNumber}].engineeringValues[${entry.index}]`,
    }).map((entries, index) => {
      const values = entries.map((entry) => entry.value);
      return create(index, {
      ...plan,
      engineeringValues: values,
      }, section, entries.map((entry) => (
        `logicalPages[${logicalPageNumber}].engineeringValues[${entry.index}]`
      )));
    });
  }
  if (logicalPageNumber === 36) {
    return weightedChunks(plan.riskAssessments, {
      rowBudget: RISK_ROWS_PER_PAGE,
      charactersPerRowUnit: 420,
      errorPath: (entry) => `riskAssessments.${entry.value.id}`,
    }).map((entries, index) => {
      const risks = entries.map((entry) => entry.value);
      return create(index, {
      ...plan,
      riskAssessments: risks,
      }, section, risks.map((risk) => `riskAssessments.${risk.id}`));
    });
  }
  if (isStructuredSectionKey(section.key)) {
    return structuredSlices(section).map((slice, index) => create(
      index,
      plan,
      slice.section,
      slice.coveragePaths,
    ));
  }
  return [create(0, plan, section, [`logicalPages[${logicalPageNumber}].sections.${section.id}`])];
};

export const planConstructionPlanPhysicalPages = (
  plan: ConstructionPlan,
): ConstructionPlanPhysicalPagePlan => {
  const manifest = requireConstructionPlanTemplateByIdentity({
    tradeType: plan.tradeType,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
  }).manifest;
  if (manifest.pages.length !== CONSTRUCTION_PLAN_MIN_PHYSICAL_PAGE_COUNT
    || manifest.pages.some((page, index) => page.pageNumber !== index + 1)) {
    throw new Error('construction-plan-logical-page-manifest-invalid');
  }

  const selectedSectionKeys = new Set(normalizeConstructionPlanSelectedSectionKeys(
    manifest,
    plan.selectedSectionKeys,
  ));
  const selectedTemplatePages = manifest.pages.filter((page) => selectedSectionKeys.has(page.sectionKey));
  const pending = selectedTemplatePages.flatMap((templatePage) => {
    const section = sectionForLogicalPage(plan, templatePage.pageNumber, templatePage);
    return logicalPageSlices(plan, section, templatePage.pageNumber);
  });
  if (pending.length < selectedTemplatePages.length
    || pending.length > CONSTRUCTION_PLAN_MAX_PHYSICAL_PAGE_COUNT) {
    throw new Error(`construction-plan-physical-page-count-invalid:${pending.length}`);
  }
  const logicalStartPhysicalPages = new Map<number, number>();
  const seenCoveragePaths = new Set<string>();
  const pages = pending.map((page, index): ConstructionPlanPhysicalPage => {
    const physicalPageNumber = index + 1;
    if (page.continuationIndex === 0) {
      if (logicalStartPhysicalPages.has(page.logicalPageNumber)) {
        throw new Error(`construction-plan-logical-page-start-duplicate:${page.logicalPageNumber}`);
      }
      logicalStartPhysicalPages.set(page.logicalPageNumber, physicalPageNumber);
    }
    if (page.coveragePaths.length === 0 || page.coveragePaths.some((path) => seenCoveragePaths.has(path))) {
      throw new Error(`construction-plan-physical-page-coverage-invalid:${physicalPageNumber}`);
    }
    page.coveragePaths.forEach((path) => seenCoveragePaths.add(path));
    const manifestEntry: ConstructionPlanPhysicalPageManifestEntry = {
      physicalPageNumber,
      logicalPageNumber: page.logicalPageNumber,
      continuationIndex: page.continuationIndex,
      payloadHash: stablePayloadHash({
        physicalPageNumber,
        logicalPageNumber: page.logicalPageNumber,
        continuationIndex: page.continuationIndex,
        coveragePaths: page.coveragePaths,
        section: page.section,
        organizationWorkers: page.logicalPageNumber === 7 ? page.plan.organizationSnapshot.additionalWorkers : undefined,
        organizationAssignments: page.logicalPageNumber === 7 ? page.plan.organizationSnapshot.assignments : undefined,
        equipmentPlan: [9, 11].includes(page.logicalPageNumber) ? page.plan.equipmentPlan : undefined,
        engineeringValues: [17, 29].includes(page.logicalPageNumber) ? page.plan.engineeringValues : undefined,
        riskAssessments: page.logicalPageNumber === 36 ? page.plan.riskAssessments : undefined,
      }),
      coveragePaths: [...page.coveragePaths],
    };
    return {
      key: `${page.section.id}-${page.logicalPageNumber}-${page.continuationIndex}`,
      plan: page.plan,
      section: page.section,
      manifest: manifestEntry,
    };
  });
  if (logicalStartPhysicalPages.size !== selectedTemplatePages.length) {
    throw new Error('construction-plan-logical-page-starts-incomplete');
  }
  return {
    pages,
    pageManifest: pages.map((page) => page.manifest),
    logicalStartPhysicalPages,
    logicalPageCount: selectedTemplatePages.length,
    physicalPageCount: pages.length,
  };
};
