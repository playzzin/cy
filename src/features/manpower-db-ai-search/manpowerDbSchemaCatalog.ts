import { ManpowerDbEntity } from './manpowerDbSearchTypes';

export type ManpowerDbMaskPolicy = 'none' | 'phone' | 'account' | 'hidden';

export interface ManpowerDbFieldMetadata {
    field: string;
    label: string;
    searchable: boolean;
    display: boolean;
    join?: boolean;
    sensitive?: boolean;
    mask?: ManpowerDbMaskPolicy;
}

export interface ManpowerDbEntitySchema {
    entity: ManpowerDbEntity;
    label: string;
    fields: ManpowerDbFieldMetadata[];
}

export const MANPOWER_DB_SCHEMA_CATALOG: ManpowerDbEntitySchema[] = [
    {
        entity: 'worker',
        label: '작업자',
        fields: [
            { field: 'id', label: '작업자 ID', searchable: false, display: false, join: true },
            { field: 'name', label: '이름', searchable: true, display: true },
            { field: 'role', label: '직종', searchable: true, display: true },
            { field: 'status', label: '상태', searchable: true, display: true },
            { field: 'teamId', label: '팀 ID', searchable: false, display: false, join: true },
            { field: 'teamName', label: '소속팀', searchable: true, display: true },
            { field: 'siteId', label: '현장 ID', searchable: false, display: false, join: true },
            { field: 'siteName', label: '현장', searchable: true, display: true },
            { field: 'companyId', label: '회사 ID', searchable: false, display: false, join: true },
            { field: 'companyName', label: '회사', searchable: true, display: true },
            { field: 'contact', label: '연락처', searchable: false, display: true, sensitive: true, mask: 'phone' },
            { field: 'accountNumber', label: '계좌번호', searchable: false, display: true, sensitive: true, mask: 'account' },
            { field: 'bankName', label: '은행', searchable: false, display: true },
            { field: 'accountHolder', label: '예금주', searchable: false, display: true },
            { field: 'idNumber', label: '신분번호', searchable: false, display: false, sensitive: true, mask: 'hidden' },
        ],
    },
    {
        entity: 'team',
        label: '팀',
        fields: [
            { field: 'id', label: '팀 ID', searchable: false, display: false, join: true },
            { field: 'name', label: '팀명', searchable: true, display: true },
            { field: 'type', label: '팀 유형', searchable: true, display: true },
            { field: 'leaderName', label: '팀장', searchable: true, display: true },
            { field: 'companyId', label: '회사 ID', searchable: false, display: false, join: true },
            { field: 'companyName', label: '회사', searchable: true, display: true },
            { field: 'memberIds', label: '작업자 ID 목록', searchable: false, display: false, join: true },
            { field: 'memberNames', label: '작업자 목록', searchable: true, display: true },
            { field: 'siteIds', label: '현장 ID 목록', searchable: false, display: false, join: true },
            { field: 'siteNames', label: '담당 현장', searchable: true, display: true },
            { field: 'accountNumber', label: '계좌번호', searchable: false, display: true, sensitive: true, mask: 'account' },
        ],
    },
    {
        entity: 'site',
        label: '현장',
        fields: [
            { field: 'id', label: '현장 ID', searchable: false, display: false, join: true },
            { field: 'name', label: '현장명', searchable: true, display: true },
            { field: 'code', label: '현장 코드', searchable: true, display: true },
            { field: 'status', label: '상태', searchable: true, display: true },
            { field: 'responsibleTeamId', label: '담당팀 ID', searchable: false, display: false, join: true },
            { field: 'responsibleTeamName', label: '담당팀', searchable: true, display: true },
            { field: 'companyId', label: '회사 ID', searchable: false, display: false, join: true },
            { field: 'companyName', label: '회사', searchable: true, display: true },
            { field: 'constructorCompanyName', label: '시공사', searchable: true, display: true },
            { field: 'clientCompanyName', label: '발주처', searchable: true, display: true },
            { field: 'partnerName', label: '협력사', searchable: true, display: true },
        ],
    },
    {
        entity: 'company',
        label: '회사',
        fields: [
            { field: 'id', label: '회사 ID', searchable: false, display: false, join: true },
            { field: 'name', label: '회사명', searchable: true, display: true },
            { field: 'code', label: '회사 코드', searchable: true, display: true },
            { field: 'type', label: '회사 유형', searchable: true, display: true },
            { field: 'phone', label: '연락처', searchable: false, display: true, sensitive: true, mask: 'phone' },
            { field: 'accountNumber', label: '계좌번호', searchable: false, display: true, sensitive: true, mask: 'account' },
            { field: 'businessNumber', label: '사업자번호', searchable: false, display: false, sensitive: true, mask: 'hidden' },
            { field: 'ceoResidentNumber', label: '대표 주민번호', searchable: false, display: false, sensitive: true, mask: 'hidden' },
            { field: 'idNumber', label: '신분번호', searchable: false, display: false, sensitive: true, mask: 'hidden' },
            { field: 'siteIds', label: '현장 ID 목록', searchable: false, display: false, join: true },
            { field: 'siteNames', label: '담당 현장', searchable: true, display: true },
        ],
    },
    {
        entity: 'integrity',
        label: '무결성',
        fields: [
            { field: 'missingFields', label: '누락 필드', searchable: true, display: true },
            { field: 'dateRange', label: '기간', searchable: true, display: true },
            { field: 'status', label: '상태', searchable: true, display: true },
        ],
    },
    {
        entity: 'support',
        label: '지원 흐름',
        fields: [
            { field: 'direction', label: '지원방향', searchable: true, display: true },
            { field: 'supportScope', label: '외부/내부', searchable: true, display: true },
            { field: 'flowType', label: '온곳/간곳', searchable: true, display: true },
            { field: 'supportOutTeamName', label: '지원간 팀', searchable: true, display: true },
            { field: 'supportInTeamName', label: '지원온 팀', searchable: true, display: true },
            { field: 'siteName', label: '현장', searchable: true, display: true },
            { field: 'workerName', label: '작업자', searchable: true, display: true },
            { field: 'counterpartyName', label: '상대', searchable: true, display: true },
            { field: 'totalManDay', label: '공수', searchable: false, display: true },
            { field: 'totalAmount', label: '금액', searchable: false, display: true },
        ],
    },
    {
        entity: 'account',
        label: '계좌',
        fields: [
            { field: 'accountNumber', label: '계좌번호', searchable: false, display: true, sensitive: true, mask: 'account' },
            { field: 'bankName', label: '은행', searchable: true, display: true },
            { field: 'accountHolder', label: '예금주', searchable: true, display: true },
        ],
    },
    {
        entity: 'mixed',
        label: '통합',
        fields: [],
    },
];

export const getEntitySchema = (entity: ManpowerDbEntity): ManpowerDbEntitySchema | undefined =>
    MANPOWER_DB_SCHEMA_CATALOG.find((schema) => schema.entity === entity);

export const getFieldMetadata = (
    entity: ManpowerDbEntity,
    field: string
): ManpowerDbFieldMetadata | undefined => getEntitySchema(entity)?.fields.find((item) => item.field === field);

export const isSensitiveField = (entity: ManpowerDbEntity, field: string): boolean =>
    Boolean(getFieldMetadata(entity, field)?.sensitive);

export const getSearchableFields = (entity: ManpowerDbEntity): ManpowerDbFieldMetadata[] =>
    getEntitySchema(entity)?.fields.filter((field) => field.searchable) ?? [];

export const getDisplayFields = (entity: ManpowerDbEntity): ManpowerDbFieldMetadata[] =>
    getEntitySchema(entity)?.fields.filter((field) => field.display) ?? [];

export const sanitizeForAiPrompt = (
    entity: ManpowerDbEntity,
    record: Record<string, unknown>
): Record<string, unknown> => {
    const schema = getEntitySchema(entity);
    if (!schema) return {};

    return schema.fields.reduce<Record<string, unknown>>((acc, field) => {
        if (!field.display || field.mask === 'hidden') return acc;
        if (field.sensitive) {
            acc[field.field] = `[${field.mask || 'masked'}]`;
        } else {
            acc[field.field] = record[field.field];
        }
        return acc;
    }, {});
};
