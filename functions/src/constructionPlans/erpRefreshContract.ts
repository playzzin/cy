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
export type ConstructionPlanErpRefreshFieldId = string;

export const CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS = new Set<string>(
    Object.entries(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS)
        .flatMap(([slot, fields]) => fields.map((field) => `${slot}.${field}`)),
);

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

export const isConstructionPlanErpRefreshFieldId = (value: unknown): value is string =>
    typeof value === 'string' && CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS.has(value);
