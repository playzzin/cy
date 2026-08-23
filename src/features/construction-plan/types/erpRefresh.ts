import { z } from 'zod';

export const CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS = {
  site: [
    'name', 'code', 'address', 'startDate', 'endDate', 'status',
    'responsibleTeamId', 'responsibleTeamName',
    'clientCompanyId', 'clientCompanyName',
    'contractorCompanyId', 'contractorCompanyName',
    'partnerCompanyId', 'partnerCompanyName', 'siteType',
  ],
  clientCompany: [
    'name', 'code', 'businessNumber', 'representativeName', 'address', 'phone', 'type', 'status',
  ],
  contractorCompany: [
    'name', 'code', 'businessNumber', 'representativeName', 'address', 'phone', 'type', 'status',
  ],
  partnerCompany: [
    'name', 'code', 'businessNumber', 'representativeName', 'address', 'phone', 'type', 'status',
  ],
  responsibleTeam: [
    'name', 'type', 'leaderWorkerId', 'leaderName', 'companyId', 'companyName',
    'parentTeamId', 'parentTeamName', 'status',
  ],
} as const;

export type ConstructionPlanErpRefreshSlot = keyof typeof CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS;

export const CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE: Record<
  ConstructionPlanErpRefreshSlot,
  'site' | 'company' | 'team'
> = {
  site: 'site',
  clientCompany: 'company',
  contractorCompany: 'company',
  partnerCompany: 'company',
  responsibleTeam: 'team',
};

export const CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS: readonly string[] = Object.freeze(
  Object.entries(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS)
    .flatMap(([slot, fields]) => fields.map((field) => `${slot}.${field}`)),
);

const FIELD_ID_SET = new Set(CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS);

export const isConstructionPlanErpRefreshFieldId = (value: unknown): value is string =>
  typeof value === 'string' && FIELD_ID_SET.has(value);

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const ConstructionPlanErpFieldProvenanceEntrySchema = z.object({
  source: z.enum(['site', 'company', 'team']),
  sourceId: z.string().min(1),
  sourceUpdatedAt: IsoDateTimeSchema.optional(),
  capturedAt: IsoDateTimeSchema,
  captureKind: z.enum(['initial', 'refresh']),
  sourceMasterHash: z.string().regex(/^[a-f0-9]{64}$/),
  appliedBy: z.string().min(1).max(200).optional(),
  appliedAt: IsoDateTimeSchema.optional(),
  changeReason: z.string().min(5).max(500).optional(),
  auditEventId: z.string().min(1).max(200).optional(),
}).strict().superRefine((entry, context) => {
  const evidence = [entry.appliedBy, entry.appliedAt, entry.changeReason, entry.auditEventId];
  if (entry.captureKind === 'refresh' && evidence.some((value) => !value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Refreshed ERP provenance requires actor, time, reason, and audit evidence.',
    });
  }
  if (entry.captureKind === 'initial' && evidence.some((value) => value !== undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Initial ERP provenance cannot claim refresh evidence.',
    });
  }
});

export const ConstructionPlanErpFieldProvenanceSchema = z.record(
  ConstructionPlanErpFieldProvenanceEntrySchema,
).superRefine((value, context) => {
  Object.entries(value).forEach(([fieldId, entry]) => {
    if (!isConstructionPlanErpRefreshFieldId(fieldId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldId],
        message: 'Unsupported construction-plan ERP provenance field.',
      });
      return;
    }
    const slot = fieldId.split('.')[0] as ConstructionPlanErpRefreshSlot;
    if (entry.source !== CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE[slot]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldId, 'source'],
        message: 'ERP provenance source is not bound to its field slot.',
      });
    }
  });
});

export type ConstructionPlanErpFieldProvenanceEntry = z.infer<
  typeof ConstructionPlanErpFieldProvenanceEntrySchema
>;
export type ConstructionPlanErpFieldProvenance = z.infer<
  typeof ConstructionPlanErpFieldProvenanceSchema
>;
