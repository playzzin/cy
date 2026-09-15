import { normalizeLooseDateString } from '../../utils/dateNormalization';
import { normalizePayType } from '../../utils/payType';

export const MASTER_TYPES = ['Company', 'Team', 'Site', 'Worker', 'OfficeStaff', 'SettlementTarget'] as const;
export type MasterType = typeof MASTER_TYPES[number];
export type ImportRecord = Record<string, any>;
export type MasterSnapshot = Record<MasterType, ImportRecord[]>;
export type ImportField = {
    label: string;
    key: string;
    aliases: string[];
    example: string;
    description: string;
    required?: boolean;
    allowedValues?: string[];
    kind?: 'number' | 'boolean' | 'date' | 'email' | 'color' | 'list' | 'percent';
    values?: Record<string, string>;
};
type Reference = { type: MasterType; id: string; name: string; many?: boolean };
type MasterDefinition = { sheetName: string; keywords: string[]; fields: ImportField[]; defaults: ImportRecord; references: Reference[] };

const field = (label: string, key: string, aliases: string[] = [], options: Partial<ImportField> = {}): ImportField => ({
    label, key, aliases: [...new Set([key, ...aliases])], example: '', description: `${label} (빈칸은 기존 값 유지)`, ...options,
});
const requiredName = (label: string, aliases: string[] = []) => field(label, 'name', aliases, { required: true, description: '필수. 동명이인은 ID 또는 식별정보로 구분합니다.' });
const identity = (label: string) => field(label, 'id', [], { description: '기존 DB ID (선택). 신규 등록은 비워두세요. 이름 변경 또는 동명이인 수정 시 입력합니다.' });
const choice = (label: string, key: string, values: Record<string, string>, aliases: string[] = []) => field(label, key, aliases, { values, allowedValues: Object.keys(values) });
const choices = (label: string, key: string, values: string[], aliases: string[] = []) => choice(label, key, Object.fromEntries(values.map(v => [v, v])), aliases);
const amount = (label: string, key: string, aliases: string[] = []) => field(label, key, aliases, { kind: 'number', description: '0 이상 숫자. 쉼표와 원 표기 가능. 0도 저장됩니다.' });
const bankFields = () => [field('은행명', 'bankName', ['은행', 'bank']), field('계좌번호', 'accountNumber', ['계좌', 'account', 'accountNo', 'account_number', '계좌번호(숫자)'], { description: '텍스트 형식으로 입력. 선행 0을 유지합니다. 마스킹된 값은 등록할 수 없습니다.' }), field('예금주', 'accountHolder', ['예금주명', '계좌주', 'holder'])];
const colorFields = () => [field('색상', 'color', ['표시색상', '팀색상', '회사색상'], { kind: 'color', description: '#RRGGBB 형식 (예: #0f766e)' }), field('아이콘', 'iconKey', ['icon'])];
const personFields = () => [field('주민번호', 'idNumber', ['주민등록번호', 'residentNumber']), field('연락처', 'contact', ['휴대폰', '전화번호', '휴대전화']), field('이메일', 'email', [], { kind: 'email' }), field('주소', 'address')];
const salaryValues = ['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'];
const companyRef = { type: 'Company' as const, id: 'companyId', name: 'companyName' };
const companyFields = () => [field('회사명', 'companyName', ['소속회사'], { description: 'DB 회사명. 회사 소속이 없는 지원팀/작업자는 외부팀으로 입력할 수 있습니다.' }), field('회사ID', 'companyId', ['소속회사ID'])];

/** One field contract drives templates, validation, change detection and persisted payloads. */
export const MASTER_DEFINITIONS: Record<MasterType, MasterDefinition> = {
    Company: {
        sheetName: '회사', keywords: ['회사', 'Company', 'Companies'], defaults: { type: '미지정', status: 'active', code: '' }, references: [],
        fields: [requiredName('회사명', ['상호', '업체명']), identity('회사ID'), field('회사코드', 'code'),
            choice('구분', 'type', { 미지정: '미지정', 시공사: '시공사', 발주사: '건설사', 발주처: '건설사', 건설사: '건설사', 협력사: '협력사', 임대사: '임대사', 기타: '기타' }, ['회사구분']),
            field('대표자', 'ceoName', ['대표자명']), field('사업자번호', 'businessNumber', ['사업자등록번호']), field('법인번호', 'corpNum', ['법인등록번호']),
            field('대표자주민번호', 'ceoResidentNumber', ['대표자주민등록번호', 'idNumber']), field('주소', 'address'), field('연락처', 'phone', ['전화번호', '대표전화']),
            field('팩스', 'fax'), field('이메일', 'email', [], { kind: 'email' }), ...bankFields(),
            choice('상태', 'status', { 사용: 'active', 활성: 'active', 미사용: 'inactive', 비활성: 'inactive', 보관: 'archived' }),
            field('우리회사', 'isMyCompany', ['자사여부'], { kind: 'boolean' }), ...colorFields()],
    },
    Team: {
        sheetName: '팀', keywords: ['팀', 'Team', 'Teams'], defaults: { type: '시공팀', status: 'active', role: '기타' },
        references: [companyRef, { type: 'Worker', id: 'leaderId', name: 'leaderName' }, { type: 'Team', id: 'parentTeamId', name: 'parentTeamName' }, { type: 'Site', id: 'siteIds', name: 'siteNames', many: true }],
        fields: [requiredName('팀명'), identity('팀ID'), ...companyFields(), field('팀장명', 'leaderName', ['팀장']), field('팀장ID', 'leaderId'), field('직종', 'role'),
            field('팀구분', 'type', ['팀유형', '구분']), choice('상태', 'status', { 협업중: 'active', 운영중: 'active', 대기: 'waiting', 폐업: 'closed' }),
            field('상위팀', 'parentTeamName', ['상위팀명']), field('상위팀ID', 'parentTeamId'),
            field('담당현장', 'siteNames', ['현장명', '배정현장', 'assignedSiteName'], { kind: 'list', description: '여러 현장은 세미콜론(;) 또는 줄바꿈으로 구분합니다. 순서대로 첫 현장을 대표 현장으로 저장합니다.' }),
            field('담당현장ID', 'siteIds', ['assignedSiteId'], { kind: 'list' }), choices('기본급여방식', 'defaultSalaryModel', salaryValues, ['기본지급구분', '기본급여모델']),
            amount('지원단가', 'supportRate'), choice('지원정산방식', 'supportModel', { 공수: 'man_day', 고정: 'fixed' }), field('지원설명', 'supportDescription'),
            amount('용역단가', 'serviceRate'), choice('용역정산방식', 'serviceModel', { 공수: 'man_day', 고정: 'fixed' }), field('용역설명', 'serviceDescription'), ...bankFields(), ...colorFields()],
    },
    Site: {
        sheetName: '현장', keywords: ['현장', 'Site', 'Sites'], defaults: { code: '', address: '', status: 'active' },
        references: [{ type: 'Company', id: 'clientCompanyId', name: 'clientCompanyName' }, { type: 'Company', id: 'companyId', name: 'companyName' }, { type: 'Company', id: 'partnerId', name: 'partnerName' }, { type: 'Team', id: 'responsibleTeamId', name: 'responsibleTeamName' }, { type: 'Worker', id: 'siteManagerId', name: 'siteManagerName' }],
        fields: [requiredName('현장명', ['현장', '공사명']), identity('현장ID'), field('현장코드', 'code'),
            field('발주사', 'clientCompanyName', ['발주처']), field('발주사ID', 'clientCompanyId', ['발주처ID']),
            field('시공사', 'companyName', ['건설사', '회사명', 'constructorCompanyName']), field('시공사ID', 'companyId', ['constructorCompanyId']),
            field('협력사', 'partnerName', ['협력업체', '파트너']), field('협력사ID', 'partnerId'),
            field('해당팀', 'responsibleTeamName', ['현장담당', '담당팀', '현장담당팀']), field('해당팀ID', 'responsibleTeamId', ['담당팀ID']),
            field('현장책임자', 'siteManagerName', ['현장소장']), field('현장책임자ID', 'siteManagerId'),
            field('발주사연락처', 'clientPhone', ['발주처연락처', '발주사전화번호', '발주처전화번호', '발주사대표전화', '발주처대표전화']),
            field('시공사연락처', 'constructorPhone', ['회사연락처', '건설사연락처', '시공사전화번호', '건설사전화번호', '회사전화번호', '시공사대표전화', '건설사대표전화', '회사대표전화']),
            field('협력사연락처', 'partnerPhone', ['협력업체연락처', '파트너연락처', '협력사전화번호', '협력업체전화번호', '파트너전화번호', '협력사대표전화', '협력업체대표전화', '파트너대표전화']),
            field('주소', 'address'), field('착공일', 'startDate', [], { kind: 'date' }), field('준공일', 'endDate', [], { kind: 'date' }),
            choice('상태', 'status', { 진행중: 'active', 예정: 'planned', 완료: 'completed', 종료: 'completed' }), choices('현장구분', 'siteType', ['도급', '직영', '지원'], ['구분', '현장유형']),
            choices('결제구분', 'paymentMethod', ['계산서', '노무'], ['결제방식', 'paymentType']),
            field('동목록', 'buildings', ['buildingNames', 'buildingList'], { kind: 'list' }), field('층목록', 'floors', ['floorNames', 'floorList'], { kind: 'list' }), field('구역목록', 'zones', ['zoneNames', 'workZones'], { kind: 'list' }),
            field('색상', 'color', [], { kind: 'color' })],
    },
    Worker: {
        sheetName: '작업자', keywords: ['작업자', '근로자', 'Worker', 'Workers'], defaults: { status: '재직', isActive: true, unitPrice: 0, payType: '일급제', salaryModel: '일급제', teamType: '일용직', role: '작업자' },
        references: [companyRef, { type: 'Team', id: 'teamId', name: 'teamName' }, { type: 'Site', id: 'siteId', name: 'siteName' }],
        fields: [requiredName('이름', ['성명', '작업자명']), identity('작업자ID'), ...companyFields(), field('소속팀', 'teamName', ['팀명', '팀']), field('소속팀ID', 'teamId', ['팀ID']),
            field('배정현장', 'siteName', ['현장명']), field('배정현장ID', 'siteId', ['현장ID']), field('직종', 'role', ['역할']), ...personFields(),
            amount('단가', 'unitPrice', ['일당', '임금', '급여']), choices('급여방식', 'payType', salaryValues, ['구분', '급여구분', '급여형태', '급여모델', 'salaryModel']),
            ...bankFields(), field('팀구분', 'teamType'), choice('상태', 'status', { 재직: '재직', 퇴사: '퇴사', 휴직: '휴직', 미배정: '미배정', active: '재직', inactive: '퇴사' }, ['재직상태']),
            field('고용형태', 'employmentType', ['고용구분']), field('직급', 'rank'), field('팀장명', 'leaderName'), choice('혈액형', 'bloodType', { A: 'A', B: 'B', O: 'O', AB: 'AB', A형: 'A', B형: 'B', O형: 'O', AB형: 'AB', 기타: '기타' }),
            choice('노무명세서지급구분', 'laborStatementPayType', { 직불: 'direct', 직접지급: 'direct', 위임: 'delegate', 대리수령: 'delegate' }, ['노무지급구분']),
            field('활성여부', 'isActive', [], { kind: 'boolean' }), ...colorFields()],
    },
    OfficeStaff: {
        sheetName: '사무실직원', keywords: ['사무실직원', '사무직', 'OfficeStaff'], defaults: { status: '재직', employmentType: '정규직', salaryModel: '월급제', payType: '월급제', unitPrice: 0, isActive: true }, references: [],
        fields: [requiredName('이름', ['성명', '직원명']), identity('직원ID'), ...personFields(), field('부서', 'department'), field('직책', 'role', ['직위']), choices('고용형태', 'employmentType', ['정규직', '프리랜서', '기타']),
            choices('상태', 'status', ['재직', '퇴사'], ['재직상태']), choices('급여방식', 'salaryModel', ['월급제', '일급제', '고정급', '기타'], ['payType']), amount('급여', 'unitPrice', ['단가']),
            ...bankFields(), field('입사일', 'joinDate', [], { kind: 'date' }), field('메모', 'memo', ['비고'])],
    },
    SettlementTarget: {
        sheetName: '정산대상자', keywords: ['정산대상자', '바이백대상자', 'SettlementTarget'], defaults: { targetType: 'client_contact', defaultProcessType: 'payable', defaultAfterTaxRate: 0.75, buybackEnabled: false, evidenceRequired: false, status: 'active' }, references: [companyRef],
        fields: [requiredName('이름', ['성명', '대상자명']), identity('대상자ID'), choice('대상유형', 'targetType', { 영업사원: 'salesperson', 관계자: 'client_contact', 발주사: 'client_company', 임대사: 'rental_company', '사무실직원': 'office_staff', 기타: 'other' }),
            field('직책', 'positionTitle'), ...companyFields(), field('연락처', 'contact', ['전화번호']), ...bankFields(),
            field('세후지급률', 'defaultAfterTaxRate', [], { kind: 'percent', description: '0~100%. 예: 75% 또는 75 또는 0.75 → 75%' }), field('바이백사용', 'buybackEnabled', [], { kind: 'boolean' }),
            field('증빙필요', 'evidenceRequired', [], { kind: 'boolean' }), choice('상태', 'status', { 사용: 'active', 미사용: 'inactive' }), field('메모', 'memo', ['비고'])],
    },
};

export const emptyMasterSnapshot = (): MasterSnapshot => ({ Company: [], Team: [], Site: [], Worker: [], OfficeStaff: [], SettlementTarget: [] });
export const importText = (value: unknown): string => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
export const importHeaderKey = (value: unknown): string => importText(value).replace(/\s+/g, '').toLowerCase();
const nameKey = (value: unknown) => importText(value).replace(/\s+/g, ' ');
const digits = (value: unknown) => importText(value).replace(/[\s-]/g, '');
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(importText).filter(Boolean) : importText(value).split(/[;\n]+/).map(importText).filter(Boolean);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export function canonicalizeImportRow(fields: Array<Pick<ImportField, 'label' | 'aliases'>>, source: ImportRecord): { row: ImportRecord; errors: string[] } {
    const aliases = new Map(fields.flatMap(f => [f.label, ...f.aliases].map(a => [importHeaderKey(a), f.label] as const)));
    const row: ImportRecord = {};
    const errors: string[] = [];
    Object.entries(source).forEach(([header, value]) => {
        const label = aliases.get(importHeaderKey(header));
        if (!label) {
            if (importText(value)) errors.push(`인식하지 못한 열: ${header || '(빈 제목)'}`);
            row[header] = value;
            return;
        }
        if (own(row, label) && importText(row[label]) && importText(value) && importText(row[label]) !== importText(value)) errors.push(`${label}: 같은 항목의 여러 열에 서로 다른 값이 있습니다.`);
        if (!own(row, label) || !importText(row[label])) row[label] = value;
    });
    return { row, errors };
}

export function parseMasterRow(type: MasterType, source: ImportRecord): { row: ImportRecord; values: ImportRecord; errors: string[] } {
    const { row, errors } = canonicalizeImportRow(MASTER_DEFINITIONS[type].fields, source);
    const values: ImportRecord = {};
    MASTER_DEFINITIONS[type].fields.forEach(f => {
        const raw = row[f.label];
        let text = importText(raw);
        if (!text) {
            if (f.required) errors.push(`${f.label} 누락`);
            return;
        }
        let value: any = text;
        if (['payType', 'salaryModel', 'defaultSalaryModel'].includes(f.key)) value = text = normalizePayType(text);
        if (f.values) {
            value = f.values[text] ?? (Object.values(f.values).includes(text) ? text : undefined);
            if (value === undefined) errors.push(`${f.label}: 허용값을 확인하세요 (${f.allowedValues?.join(', ')})`);
        } else if (f.kind === 'number' || f.kind === 'percent') {
            value = Number(text.replace(/[,원%\s]/g, ''));
            if (!/[0-9]/.test(text) || !Number.isFinite(value) || value < 0) errors.push(`${f.label}: 0 이상 숫자를 입력하세요.`);
            if (f.kind === 'percent') {
                if (text.includes('%') || value > 1) value /= 100;
                if (value > 1) errors.push(`${f.label}: 0~100% 범위를 입력하세요.`);
            }
        } else if (f.kind === 'boolean') {
            const key = text.toLowerCase();
            if (['true', '1', '예', '네', '사용', '활성', 'y', 'yes'].includes(key)) value = true;
            else if (['false', '0', '아니오', '아니요', '미사용', '비활성', 'n', 'no'].includes(key)) value = false;
            else errors.push(`${f.label}: 예/아니오 또는 true/false를 입력하세요.`);
        } else if (f.kind === 'date') {
            value = normalizeLooseDateString(/^\d{5}(\.\d+)?$/.test(text) ? Number(text) : raw);
            if (!value) errors.push(`${f.label}: 실제 날짜를 입력하세요 (YYYY-MM-DD).`);
        } else if (f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors.push(`${f.label}: 이메일 형식이 올바르지 않습니다.`);
        else if (f.kind === 'color' && !/^#[\da-f]{6}$/i.test(text)) errors.push(`${f.label}: #RRGGBB 형식을 입력하세요.`);
        else if (f.kind === 'list') value = list(raw);
        if (['accountNumber', 'idNumber', 'ceoResidentNumber', 'businessNumber', 'corpNum', 'contact', 'phone'].includes(f.key) && /[*•●]|\d[eE][+-]?\d|[xX]{2,}/.test(text)) errors.push(`${f.label}: 마스킹 또는 지수 표기 값은 원문을 텍스트로 다시 입력하세요.`);
        if (value !== undefined && value !== null) values[f.key] = value;
    });
    if (values.startDate && values.endDate && values.startDate > values.endDate) errors.push('준공일은 착공일보다 빠를 수 없습니다.');
    if (type === 'Worker' && ['지원팀', '용역팀'].includes(values.teamType) && values.payType && values.teamType !== values.payType) errors.push('팀구분과 급여방식이 다릅니다. 지원팀/용역팀 구분을 일치시켜 주세요.');
    return { row, values, errors };
}

export interface MasterPlanRow {
    type: MasterType;
    index: number;
    row: ImportRecord;
    values: ImportRecord;
    payload: ImportRecord;
    existingData?: ImportRecord;
    status: 'NEW' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT';
    action: 'CREATE' | 'UPDATE' | 'SKIP';
    changes: string[];
    key: string;
    previewId: string;
}

function findExisting(type: MasterType, values: ImportRecord, records: ImportRecord[]): { record?: ImportRecord; error?: string } {
    if (values.id) {
        const found = records.filter(r => r.id === values.id || r.legacyId === values.id);
        return found.length === 1 ? { record: found[0] } : { error: 'ID가 DB에 없거나 중복됩니다. 신규 등록은 ID를 비워주세요.' };
    }
    let found = records.filter(r => nameKey(r.name) === nameKey(values.name));
    if (['Worker', 'OfficeStaff'].includes(type)) {
        if (values.idNumber) {
            const exact = records.filter(r => digits(r.idNumber) === digits(values.idNumber));
            if (exact.length === 1) return { record: exact[0] };
            if (exact.length > 1) return { error: '주민번호가 같은 DB 항목이 여러 개입니다. ID로 지정하세요.' };
            found = found.filter(r => !importText(r.idNumber));
        }
        const ambiguous = found.length > 1;
        if (found.length > 1 && values.contact) found = found.filter(r => digits(r.contact) === digits(values.contact));
        if (found.length > 1 && (values.teamId || values.teamName)) found = found.filter(r => values.teamId ? r.teamId === values.teamId : nameKey(r.teamName) === nameKey(values.teamName));
        if (ambiguous && found.length !== 1) return { error: '동명이인을 구분할 수 없습니다. ID로 지정하거나 신규 작업자의 식별정보를 확인하세요.' };
    }
    return found.length > 1 ? { error: '동명이인 또는 같은 이름의 DB 항목이 여러 개입니다. ID로 지정하세요.' } : { record: found[0] };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const refKeys = (type: MasterType) => new Set(MASTER_DEFINITIONS[type].references.flatMap(r => [r.id, r.name]));

export function resolveMasterPayload(type: MasterType, values: ImportRecord, records: MasterSnapshot, existing?: ImportRecord): { payload: ImportRecord; errors: string[] } {
    const errors: string[] = [];
    const keys = refKeys(type);
    const payload = Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'id' && !keys.has(key) && !['clientPhone', 'constructorPhone', 'partnerPhone'].includes(key)));
    for (const reference of MASTER_DEFINITIONS[type].references) {
        if (!own(values, reference.id) && !own(values, reference.name)) continue;
        const ids = list(values[reference.id]);
        const names = list(values[reference.name]);
        if (['Team', 'Worker'].includes(type) && reference.id === 'companyId' && !ids.length && names[0] === '외부팀') {
            payload.companyId = '';
            payload.companyName = '외부팀';
            continue;
        }
        const length = reference.many ? Math.max(ids.length, names.length) : 1;
        const matches: ImportRecord[] = [];
        if (ids.length && names.length && ids.length !== names.length) errors.push(`${reference.name}: ID와 이름의 개수가 다릅니다.`);
        for (let i = 0; i < length; i++) {
            let candidates = records[reference.type].filter(r => ids[i] ? [r.id, r.legacyId].includes(ids[i]) : nameKey(r.name) === nameKey(names[i]));
            // A team leader/site manager with the same name must belong to the selected team.
            if (!ids[i] && candidates.length > 1 && reference.type === 'Worker') {
                const teamName = type === 'Team' ? values.name : (values.responsibleTeamName || existing?.responsibleTeamName);
                if (teamName) candidates = candidates.filter(r => nameKey(r.teamName) === nameKey(teamName));
            }
            const label = MASTER_DEFINITIONS[type].fields.find(f => f.key === reference.name)?.label || reference.name;
            if (candidates.length !== 1) { errors.push(`${label}: ${candidates.length ? '같은 이름이 여러 개입니다. ID를 지정하세요.' : '연결 대상이 없습니다. 해당 시트 또는 DB에 등록하세요.'}`); continue; }
            const target = candidates[0];
            if (ids[i] && names[i] && nameKey(target.name) !== nameKey(names[i])) { errors.push(`${label}: ID와 이름이 서로 다릅니다.`); continue; }
            matches.push(target);
        }
        if (matches.length === length) {
            payload[reference.id] = reference.many ? matches.map(r => r.id) : matches[0].id;
            payload[reference.name] = reference.many ? matches.map(r => r.name) : matches[0].name;
        }
    }
    if (type === 'Worker') {
        const team = records.Team.find(t => t.id === payload.teamId);
        const company = team && records.Company.find(c => [c.id, c.legacyId].includes(team.companyId) || (team.companyName && nameKey(c.name) === nameKey(team.companyName)));
        if (!values.companyId && !values.companyName && company) { payload.companyId = company.id; payload.companyName = company.name; }
        if (!values.companyId && !values.companyName && team && !team.companyId && team.companyName === '외부팀') { payload.companyId = ''; payload.companyName = '외부팀'; }
        if (company && payload.companyId && company.id !== payload.companyId) errors.push('소속팀의 회사와 작업자의 회사가 다릅니다.');
        const teamType = payload.teamType ?? existing?.teamType;
        if (values.payType && ['지원팀', '용역팀'].includes(teamType) && values.payType !== teamType) errors.push('기존 팀구분과 급여방식이 다릅니다. 팀구분도 함께 확인하세요.');
        if (payload.payType || ['지원팀', '용역팀'].includes(teamType)) {
            payload.payType = ['지원팀', '용역팀'].includes(teamType) ? teamType : payload.payType;
            payload.salaryModel = payload.payType;
        }
        if (own(payload, 'status') && !own(payload, 'isActive')) payload.isActive = payload.status !== '퇴사';
    }
    if (type === 'OfficeStaff' && payload.salaryModel) payload.payType = payload.salaryModel;
    if (type === 'Site' && payload.companyId) { payload.constructorCompanyId = payload.companyId; payload.constructorCompanyName = payload.companyName; }
    if (type === 'Team' && payload.siteIds) { payload.assignedSiteId = payload.siteIds[0] || ''; payload.assignedSiteName = payload.siteNames[0] || ''; }
    if (type === 'Team' && payload.parentTeamId && [existing?.id, values.id].includes(payload.parentTeamId)) errors.push('자기 팀을 상위팀으로 지정할 수 없습니다.');
    for (const [phoneKey, companyKey] of [['clientPhone', 'clientCompanyId'], ['constructorPhone', 'companyId'], ['partnerPhone', 'partnerId']]) {
        if (values[phoneKey] && !payload[companyKey] && !existing?.[companyKey]) errors.push('회사 연락처를 저장할 연결 회사를 지정하세요.');
    }
    return { payload, errors };
}

export function planMasterImport(data: MasterSnapshot, snapshot: MasterSnapshot): Record<MasterType, MasterPlanRow[]> {
    const plan = Object.fromEntries(MASTER_TYPES.map(type => [type, data[type].map((source, index): MasterPlanRow => {
        const { row, values, errors } = parseMasterRow(type, source);
        const match = findExisting(type, values, snapshot[type]);
        if (match.error) errors.push(match.error);
        const previewId = match.record?.id || `__import_${type}_${index}`;
        return { type, index, row, values, payload: {}, existingData: match.record, status: errors.length ? 'CONFLICT' : match.record ? 'UPDATE' : 'NEW', action: errors.length ? 'SKIP' : match.record ? 'UPDATE' : 'CREATE', changes: errors, key: importText(values.name), previewId };
    })])) as Record<MasterType, MasterPlanRow[]>;
    const conflict = (row: MasterPlanRow, reason: string) => { row.status = 'CONFLICT'; row.action = 'SKIP'; if (!row.changes.includes(reason)) row.changes.push(reason); };
    for (const type of MASTER_TYPES) {
        const grouped = new Map<string, MasterPlanRow[]>();
        plan[type].forEach(row => {
            const key = row.existingData ? row.previewId : row.values.idNumber ? `identity:${digits(row.values.idNumber)}` : nameKey(row.values.name);
            grouped.set(key, [...(grouped.get(key) || []), row]);
        });
        grouped.forEach(rows => { if (rows.length > 1) rows.forEach(r => conflict(r, '파일 내 같은 등록 대상이 여러 행에 있습니다. 한 행으로 합쳐주세요.')); });
    }
    const projected = (): MasterSnapshot => Object.fromEntries(MASTER_TYPES.map(type => {
        const current = new Map(snapshot[type].map(r => [r.id, { ...r }]));
        plan[type].filter(r => r.status !== 'CONFLICT').forEach(r => current.set(r.previewId, { ...r.existingData, ...r.values, ...r.payload, id: r.previewId }));
        return [type, [...current.values()]];
    })) as MasterSnapshot;
    // Resolve forward links (including team -> worker -> team) before marking unchanged rows.
    const maxPasses = MASTER_TYPES.reduce((total, type) => total + plan[type].length, 1);
    for (let pass = 0; pass <= maxPasses; pass++) {
        const records = projected();
        let rejected = false;
        for (const type of MASTER_TYPES) for (const row of plan[type]) {
            if (row.status === 'CONFLICT') continue;
            const resolved = resolveMasterPayload(type, row.values, records, row.existingData);
            row.payload = resolved.payload;
            if (resolved.errors.length) { resolved.errors.forEach(error => conflict(row, error)); rejected = true; }
            if (type === 'Team' && resolved.payload.parentTeamId) {
                const seen = new Set([row.previewId]);
                let parentId = resolved.payload.parentTeamId;
                while (parentId) {
                    if (seen.has(parentId)) { conflict(row, '상위팀 연결이 자기 팀으로 돌아옵니다. 순환 연결을 해제하세요.'); rejected = true; break; }
                    seen.add(parentId);
                    const currentParentId = parentId;
                    parentId = records.Team.find(team => team.id === currentParentId)?.parentTeamId;
                }
            }
        }
        if (pass > 0 && !rejected) break;
    }
    for (const type of MASTER_TYPES) for (const row of plan[type]) {
        if (row.status === 'CONFLICT') continue;
        const changedKeys = Object.keys(row.payload).filter(key => !same(row.existingData?.[key], row.payload[key]));
        const derivedLabels: Record<string, string> = { salaryModel: '급여방식', constructorCompanyId: '시공사ID', constructorCompanyName: '시공사', assignedSiteId: '대표현장ID', assignedSiteName: '대표현장' };
        row.changes = changedKeys.map(key => `${MASTER_DEFINITIONS[type].fields.find(f => f.key === key)?.label || derivedLabels[key] || key} ${row.existingData ? '변경' : '등록'}`);
        if (type === 'Site' && [['clientPhone', 'clientCompanyId'], ['constructorPhone', 'companyId'], ['partnerPhone', 'partnerId']].some(([phone, key]) => {
            const company = snapshot.Company.find(c => c.id === (row.payload[key] || row.existingData?.[key]));
            return row.values[phone] && row.values[phone] !== company?.phone;
        })) row.changes.push('연결 회사 연락처 반영');
        if (row.existingData && !row.changes.length) { row.status = 'UNCHANGED'; row.action = 'SKIP'; }
    }
    return plan;
}

export type MasterWriter = {
    create: (type: MasterType, data: ImportRecord) => Promise<string>;
    update: (type: MasterType, id: string, data: ImportRecord) => Promise<void>;
};

/** All creates obtain real IDs before forward/circular references are written. No placeholder ID reaches storage. */
export async function executeMasterImport(plan: Record<MasterType, MasterPlanRow[]>, snapshot: MasterSnapshot, writer: MasterWriter, progress?: (type: MasterType, done: number, total: number) => void): Promise<MasterSnapshot> {
    if (MASTER_TYPES.some(type => plan[type].some(row => row.status === 'CONFLICT'))) throw new Error('오류 행을 수정한 뒤 등록하세요.');
    const records = Object.fromEntries(MASTER_TYPES.map(type => [type, snapshot[type].map(r => ({ ...r }))])) as MasterSnapshot;
    const resolvedIds = new Map<MasterPlanRow, string>();
    for (const type of MASTER_TYPES) for (const row of plan[type]) {
        if (row.existingData?.id) { resolvedIds.set(row, row.existingData.id); continue; }
        const referenceKeys = refKeys(type);
        const scalar = Object.fromEntries(Object.entries(row.payload).filter(([key]) => !referenceKeys.has(key) && !['constructorCompanyId', 'constructorCompanyName', 'assignedSiteId', 'assignedSiteName'].includes(key)));
        const values = { ...MASTER_DEFINITIONS[type].defaults, ...scalar };
        const id = await writer.create(type, values);
        resolvedIds.set(row, id);
        records[type].push({ ...values, id });
    }
    // Project all incoming names/scalars so references to renamed or newly created rows resolve consistently.
    const lookup = Object.fromEntries(MASTER_TYPES.map(type => [type, records[type].map(record => {
        const row = plan[type].find(r => resolvedIds.get(r) === record.id);
        return row ? { ...record, ...row.values, id: record.id } : record;
    })])) as MasterSnapshot;
    for (const type of MASTER_TYPES) {
        let done = 0;
        for (const row of plan[type]) {
            const id = resolvedIds.get(row)!;
            const existing = records[type].find(record => record.id === id)!;
            const resolved = resolveMasterPayload(type, row.values, lookup, row.existingData);
            if (resolved.errors.length) throw new Error(`${MASTER_DEFINITIONS[type].sheetName} ${row.index + 1}행: 연결 실패. 저장된 항목을 확인하고 다시 업로드하세요.`);
            const patch = Object.fromEntries(Object.entries(resolved.payload).filter(([key, value]) => !same(existing[key], value)));
            if (Object.keys(patch).length) await writer.update(type, id, patch);
            Object.assign(existing, resolved.payload);
            Object.assign(lookup[type].find(record => record.id === id)!, resolved.payload);
            // Site creation happens before circular references are linked. Keep the client-company
            // site list in sync just as siteService.addSite does when it receives a client ID.
            if (type === 'Site' && existing.clientCompanyId) {
                const client = records.Company.find(company => company.id === existing.clientCompanyId);
                if (client) {
                    const siteIds: string[] = [...(client.siteIds || [])];
                    const siteNames: string[] = [...(client.siteNames || [])];
                    const index = siteIds.indexOf(id);
                    if (index < 0) { siteIds.push(id); siteNames.push(existing.name); }
                    else siteNames[index] = existing.name;
                    if (!same(client.siteIds, siteIds) || !same(client.siteNames, siteNames)) {
                        await writer.update('Company', client.id, { siteIds, siteNames });
                        Object.assign(client, { siteIds, siteNames });
                    }
                }
            }
            if (type === 'Site') for (const [phoneKey, companyKey] of [['clientPhone', 'clientCompanyId'], ['constructorPhone', 'companyId'], ['partnerPhone', 'partnerId']]) {
                const phone = row.values[phoneKey];
                const company = records.Company.find(c => c.id === existing[companyKey]);
                if (phone && company && company.phone !== phone) { await writer.update('Company', company.id, { phone }); company.phone = phone; }
            }
            progress?.(type, ++done, plan[type].length);
        }
        if (!plan[type].length) progress?.(type, 0, 0);
    }
    return records;
}
