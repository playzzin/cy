import { z } from 'zod';

export const ConstructionPlanTradeTypeSchema = z.enum([
  'system-shoring',
  'system-scaffold',
]);

export const SectionKindSchema = z.enum([
  'cover',
  'document-control',
  'toc',
  'static-content',
  'structured-form',
  'organization-chart',
  'equipment-plan',
  'drawing-register',
  'drawing-page',
  'risk-assessment',
  'checklist-template',
  'photo-sheet',
  'approval-sheet',
]);

export const SectionDataStrategySchema = z.enum([
  'project-and-document',
  'revision-and-approval',
  'generated-toc',
  'template-with-override',
  'project-snapshot',
  'organization-snapshot',
  'structured-input',
  'equipment-and-drawing',
  'template-catalog',
  'drawing-register',
  'approved-drawing',
  'hold-point',
  'engineering-reference',
  'risk-register',
  'blank-record-template',
]);

export const TemplatePageSchema = z.object({
  pageNumber: z.number().int().min(1),
  sectionKey: z.string().min(1),
  chapter: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  kind: SectionKindSchema,
  dataStrategy: SectionDataStrategySchema,
  required: z.boolean(),
  editable: z.boolean(),
  drawingSlot: z.enum(['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']).optional(),
  drawingSlots: z.array(z.enum(['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'])).default([]),
});

export const ConstructionPlanRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ConstructionPlanRiskThresholdSchema = z.object({
  minScore: z.number().int().min(1).max(25),
  maxScore: z.number().int().min(1).max(25),
  level: ConstructionPlanRiskLevelSchema,
  label: z.string().min(1),
  action: z.string().min(1),
});

/**
 * Versioned risk policy owned by the immutable template manifest. Keeping the
 * calculation and acceptance contract here prevents a published plan from
 * silently changing when a global UI constant is edited later.
 */
export const ConstructionPlanRiskAssessmentPolicySchema = z.object({
  methodVersion: z.literal(2),
  methodReference: z.string().min(1),
  formula: z.literal('probability * severity'),
  probabilityMin: z.literal(1),
  probabilityMax: z.literal(5),
  severityMin: z.literal(1),
  severityMax: z.literal(5),
  thresholds: z.array(ConstructionPlanRiskThresholdSchema).length(4),
  acceptance: z.object({
    maxResidualScore: z.number().int().min(1).max(25),
    requireResidualReduction: z.boolean(),
    blockedResidualLevels: z.array(ConstructionPlanRiskLevelSchema).min(1),
  }),
  reviewTriggers: z.array(z.string().min(1)).min(1),
}).superRefine((policy, context) => {
  const levels = new Set<string>();
  let nextScore = policy.probabilityMin * policy.severityMin;
  policy.thresholds.forEach((threshold, index) => {
    if (threshold.minScore !== nextScore || threshold.maxScore < threshold.minScore) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['thresholds', index],
        message: 'Risk thresholds must be ordered and contiguous from score 1 through 25.',
      });
    }
    nextScore = threshold.maxScore + 1;
    if (levels.has(threshold.level)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['thresholds', index, 'level'],
        message: 'Each risk level must appear exactly once.',
      });
    }
    levels.add(threshold.level);
  });
  if (nextScore !== (policy.probabilityMax * policy.severityMax) + 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['thresholds'],
      message: 'Risk thresholds must cover every possible matrix score.',
    });
  }
  if (new Set(policy.reviewTriggers).size !== policy.reviewTriggers.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reviewTriggers'],
      message: 'Risk review triggers must be unique.',
    });
  }
});

export const ConstructionPlanTemplateManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tradeType: ConstructionPlanTradeTypeSchema,
  version: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  rendererVersion: z.string().min(1),
  pageSize: z.object({
    name: z.literal('A4'),
    widthPt: z.literal(595.28),
    heightPt: z.literal(841.89),
    orientation: z.literal('portrait'),
  }),
  sourceReference: z.object({
    title: z.string().min(1),
    revision: z.string().min(1),
    pageCount: z.literal(42),
  }),
  riskAssessmentPolicy: ConstructionPlanRiskAssessmentPolicySchema,
  pages: z.array(TemplatePageSchema).length(42),
}).superRefine((manifest, context) => {
  const pageNumbers = manifest.pages.map((page) => page.pageNumber);
  const expected = Array.from({ length: 42 }, (_, index) => index + 1);
  if (pageNumbers.some((pageNumber, index) => pageNumber !== expected[index])) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pages'],
      message: 'Template pages must be ordered consecutively from 1 through 42.',
    });
  }
});

export type SectionKind = z.infer<typeof SectionKindSchema>;
export type SectionDataStrategy = z.infer<typeof SectionDataStrategySchema>;
export type TemplatePage = z.infer<typeof TemplatePageSchema>;
export type ConstructionPlanTradeType = z.infer<typeof ConstructionPlanTradeTypeSchema>;
export type ConstructionPlanRiskLevel = z.infer<typeof ConstructionPlanRiskLevelSchema>;
export type ConstructionPlanRiskThreshold = z.infer<typeof ConstructionPlanRiskThresholdSchema>;
export type ConstructionPlanRiskAssessmentPolicy = z.infer<typeof ConstructionPlanRiskAssessmentPolicySchema>;
export type ConstructionPlanTemplateManifest = z.infer<typeof ConstructionPlanTemplateManifestSchema>;
