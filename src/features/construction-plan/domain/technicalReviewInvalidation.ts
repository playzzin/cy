import type {
  ConstructionPlan,
  PlanSection,
  VerifiedEngineeringValue,
} from '../types';

const ENGINEERING_IMPACT_FIELDS = [
  'key',
  'value',
  'unit',
  'sourceDocumentId',
  'sourceRevision',
  'sourcePageOrSection',
  'applicableZones',
  'manualInputReason',
] as const satisfies readonly (keyof VerifiedEngineeringValue)[];

/**
 * Narrative/engineering-reference sections whose editable content describes a
 * load-bearing assembly. Any content change requires a new technical decision.
 */
const CRITICAL_ENGINEERING_SECTION_KEYS = new Set([
  'member-specifications',
  'installation-sequence',
  'post-ledger-assembly',
  'brace-installation',
  'connection-details',
  'structural-control',
  'base-standard-assembly',
  'brace-tie-installation',
  'wall-tie-anchorage',
]);

/**
 * Structured fields that can change the reviewed structural assumptions. The
 * mapping deliberately excludes schedule/assignee-only fields.
 */
const CRITICAL_STRUCTURED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'site-installation-plan': [
    'applicableZones',
    'drawingReferences',
    'prerequisites',
    'workSequence',
    'inspectionPoints',
  ],
  'concrete-pour-plan': [
    'applicableZones',
    'designStrength',
    'pourMethod',
    'pourRate',
    'pourSequence',
    'concentratedLoadControls',
    'monitoringFrequency',
    'stopCriteria',
  ],
  'dismantling-plan': [
    'applicableZones',
    'strengthEvidenceReference',
    'approvalReference',
    'prerequisites',
    'workSequence',
    'temporaryStabilityMeasures',
    'exclusionZones',
    'materialLoweringMethod',
  ],
  'retention-plan': [
    'applicableZones',
    'retentionZones',
    'changeTriggers',
    'drawingRevisionRequired',
    'engineeringReviewRequired',
  ],
  // Scaffold-specific structural/install controls.
  'work-platform-access-plan': [
    'applicableZones',
    'platformWidth',
    'platformMaterial',
    'platformLoadLimit',
    'guardrailMeasures',
    'toeBoardMeasures',
    'accessLocations',
    'openingControls',
    'inspectionPoints',
  ],
  'inspection-maintenance-plan': [
    'applicableZones',
    'defectResponse',
    'alterationApprovalRoles',
    'wallTieChecks',
    'platformChecks',
  ],
};

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const equivalent = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => equivalent(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && equivalent(left[key], right[key]));
};

const withoutReviewDecision = (
  value: VerifiedEngineeringValue,
): VerifiedEngineeringValue => {
  const {
    verifiedBy: _verifiedBy,
    verifiedAt: _verifiedAt,
    ...unverified
  } = value;
  return { ...unverified, verificationStatus: 'unverified' };
};

const normalizedZones = (zones: readonly string[]): string[] => [...zones].sort();

const engineeringImpactProjection = (value: VerifiedEngineeringValue): Record<string, unknown> => ({
  key: value.key,
  value: value.value,
  unit: value.unit,
  sourceDocumentId: value.sourceDocumentId,
  sourceRevision: value.sourceRevision,
  sourcePageOrSection: value.sourcePageOrSection,
  applicableZones: normalizedZones(value.applicableZones),
  manualInputReason: value.manualInputReason,
});

const engineeringSetImpactProjection = (
  values: readonly VerifiedEngineeringValue[],
): string[] => values
  .map((value) => JSON.stringify(engineeringImpactProjection(value)))
  .sort();

const sectionImpactProjection = (section: PlanSection): unknown => {
  if (CRITICAL_ENGINEERING_SECTION_KEYS.has(section.key)) return section.content;
  const fields = CRITICAL_STRUCTURED_FIELDS[section.key];
  if (!fields) return undefined;
  return Object.fromEntries(fields.map((field) => [field, section.content[field]]));
};

const sectionsImpactProjection = (sections: readonly PlanSection[]): Array<[string, unknown]> =>
  sections
    .map((section): [string, unknown] => [section.key, sectionImpactProjection(section)])
    .filter((entry) => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

const drawingsImpactProjection = (drawings: ConstructionPlan['drawings']) => drawings
  .map((drawing) => ({
    id: drawing.id,
    drawingNo: drawing.drawingNo,
    revision: drawing.revision,
    sourceRevision: drawing.sourceRevision,
    sourceSha256: drawing.sourceSha256,
    building: drawing.building,
    floor: drawing.floor,
    zone: drawing.zone,
    applicableZones: normalizedZones(drawing.applicableZones),
  }))
  .sort((left, right) => left.id.localeCompare(right.id));

export const updateEngineeringValueWithReviewInvalidation = (
  current: VerifiedEngineeringValue,
  patch: Partial<VerifiedEngineeringValue>,
): VerifiedEngineeringValue => {
  const next = { ...current, ...patch };
  const impactChanged = ENGINEERING_IMPACT_FIELDS.some((field) =>
    hasOwn(patch, field) && !equivalent(current[field], next[field]));

  if (impactChanged || patch.verificationStatus === 'unverified') {
    return withoutReviewDecision(next);
  }
  return next;
};

export const invalidateEngineeringReviewDecisions = (
  values: readonly VerifiedEngineeringValue[],
): VerifiedEngineeringValue[] => {
  let changed = false;
  const invalidated = values.map((value) => {
    if (value.verificationStatus === 'unverified' && !value.verifiedBy && !value.verifiedAt) return value;
    changed = true;
    return withoutReviewDecision(value);
  });
  return changed ? invalidated : values as VerifiedEngineeringValue[];
};

export const hasConstructionPlanTechnicalReviewImpact = (
  previous: ConstructionPlan,
  next: ConstructionPlan,
): boolean => !equivalent(
  engineeringSetImpactProjection(previous.engineeringValues),
  engineeringSetImpactProjection(next.engineeringValues),
) || !equivalent(
  sectionsImpactProjection(previous.sections),
  sectionsImpactProjection(next.sections),
) || !equivalent(
  drawingsImpactProjection(previous.drawings),
  drawingsImpactProjection(next.drawings),
) || !equivalent(
  {
    buildings: normalizedZones(previous.projectSnapshot.buildings),
    floors: normalizedZones(previous.projectSnapshot.floors),
    zones: normalizedZones(previous.projectSnapshot.zones),
  },
  {
    buildings: normalizedZones(next.projectSnapshot.buildings),
    floors: normalizedZones(next.projectSnapshot.floors),
    zones: normalizedZones(next.projectSnapshot.zones),
  },
);

/**
 * Applies PRD 34.2 at the plan boundary. This is intentionally usable both by
 * the optimistic editor queue and by the persisted update transaction.
 */
export const applyConstructionPlanTechnicalReviewInvalidation = (
  previous: ConstructionPlan,
  next: ConstructionPlan,
): ConstructionPlan => {
  if (!hasConstructionPlanTechnicalReviewImpact(previous, next)) return next;
  const engineeringValues = invalidateEngineeringReviewDecisions(next.engineeringValues);
  const readinessChanged = next.releaseReadiness.requiredReviewsComplete
    || next.releaseReadiness.snapshotHashMatches;
  if (engineeringValues === next.engineeringValues && !readinessChanged) return next;
  return {
    ...next,
    engineeringValues,
    releaseReadiness: {
      ...next.releaseReadiness,
      requiredReviewsComplete: false,
      snapshotHashMatches: false,
    },
  };
};
