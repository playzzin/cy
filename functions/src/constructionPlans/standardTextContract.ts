import type { UnknownRecord } from './domain';
import type { ConstructionPlanServerTemplateContract } from './templateContracts';

export interface ConstructionPlanServerStandardTextRow { label: string; value: string }
export type ConstructionPlanServerStandardTextStrategy = 'template-catalog' | 'template-with-override';
export interface ConstructionPlanServerStandardTextEntry {
    pageNumber: number;
    sectionKey: string;
    strategy: ConstructionPlanServerStandardTextStrategy;
    standardTextVersion: string;
    rows: readonly ConstructionPlanServerStandardTextRow[];
    originalText: string;
}

const SHORING_ROWS: Readonly<Record<number, readonly ConstructionPlanServerStandardTextRow[]>> = {
    5: [
        { label: '적용범위', value: '본 계획서는 승인된 현장·동·층·구간의 시스템동바리 설치, 사용, 존치 및 해체 작업에 적용한다.' },
        { label: '우선 기준', value: '승인도면과 승인된 구조검토 문서를 우선 적용하고 상충 시 작업을 중지하여 기술검토를 요청한다.' },
        { label: '변경관리', value: '현장조건·공법·부재·장비·구간이 변경되면 변경내용을 기록하고 승인 절차를 다시 거친다.' },
    ],
    12: [
        { label: '작업 전', value: '작업바닥, 추락방호, 비상정지장치, 장비 상태와 작업구간 출입통제를 확인한다.' },
        { label: '작업 중', value: '구조물·가설재·전선·다른 장비와의 간섭을 감시하고 정해진 신호에 따라 운전한다.' },
        { label: '중지조건', value: '지반 침하, 장비 이상, 통제구역 침입, 신호 두절 또는 시야 불량 시 즉시 작업을 중지한다.' },
    ],
    15: [
        { label: '하중전달', value: '상부 하중은 받침·잭·수직재·기초로 연속 전달되도록 설치하고 편심과 국부집중을 방지한다.' },
        { label: '부재 역할', value: '수평재와 가새는 수직재의 좌굴과 변형을 억제하도록 승인도면의 배치에 맞춰 체결한다.' },
        { label: '현장 적용값', value: '실제 부재 간격, 잭 조정범위와 보강조건은 본 문서의 승인 구조값 및 승인도면을 참조한다.' },
    ],
    16: [
        { label: '수직재·수평재', value: '수직하중 전달과 골조 구속 역할을 하며 변형·손상·부식 여부를 반입 및 설치 전에 확인한다.' },
        { label: '가새·연결부', value: '수평 안정성과 접합 연속성을 확보하며 핀·쐐기·볼트의 체결과 이탈방지 상태를 확인한다.' },
        { label: '잭·받침', value: '상·하부 지지와 높이 조정을 담당하며 나사부, 받침면, 편심 및 지지상태를 확인한다.' },
    ],
    18: [
        { label: '1단계', value: '작업구간 통제, 기초상태 확인, 기준선 표시 후 하부 받침과 수직재를 배치한다.' },
        { label: '2단계', value: '수평재와 가새를 순차 체결하고 수직도·간격·연결상태를 확인한다.' },
        { label: '3단계', value: '상부 지지부를 설치하고 승인도면·구조값과 대조한 뒤 검측을 요청한다.' },
    ],
    19: [
        { label: '조립원칙', value: '수직재를 안정시킨 뒤 수평재를 폐합하고 연결핀·쐐기·볼트를 완전 체결한다.' },
        { label: '진행관리', value: '조립 높이에 따라 작업발판과 추락방호를 선행하고 미완성 골조에는 임시 안정조치를 둔다.' },
        { label: '검측', value: '수직도, 간격, 체결, 받침 및 변형을 구간별로 확인하고 부적합은 다음 공정 전에 조치한다.' },
    ],
    20: [
        { label: '가새 설치', value: '승인도면의 방향·구간·연속성에 맞춰 가새를 설치하고 양단 접합을 확실히 체결한다.' },
        { label: '상부 지지', value: '상부 받침면을 밀착시키고 편심·들뜸·국부하중이 발생하지 않도록 조정한다.' },
        { label: '해체 원칙', value: '해체 승인 후 설치의 역순으로 진행하며 안정에 필요한 가새와 지지는 선행 제거하지 않는다.' },
    ],
    34: [
        { label: 'ITP', value: '반입·설치·타설 전·존치·해체 단계별 검사 및 시험계획과 확인 책임자를 운영한다.' },
        { label: '부적합', value: '부적합을 식별·격리하고 원인·조치·재검사 결과를 기록한 뒤 다음 공정을 진행한다.' },
        { label: '기록관리', value: '승인도면, 구조값, 검측표, 사진과 변경기록을 문서번호·개정번호로 추적 관리한다.' },
    ],
    35: [
        { label: '중점 위험', value: '붕괴·추락·낙하·끼임 위험을 작업단계별로 확인하고 방호·통제·신호 조치를 시행한다.' },
        { label: '작업중지', value: '승인조건 불일치, 구조 이상, 방호 미설치 또는 통제 실패 시 누구든 작업중지를 요청할 수 있다.' },
        { label: '재개조건', value: '위험요인 조치와 책임자 재확인이 완료된 뒤 작업자에게 변경내용을 공유하고 재개한다.' },
    ],
    38: [
        { label: '5S', value: '정리·정돈·청소·청결·습관화를 통해 자재와 작업공간을 상시 관리한다.' },
        { label: '현장관리', value: '적치·폐기·통로·조도·분진·소음을 관리하고 비상통로와 소방시설 접근을 확보한다.' },
        { label: '인수인계', value: '작업 종료 시 잔재·폐기물·통로·조명 상태와 미결 환경조치를 다음 작업조에 인계한다.' },
    ],
};

const SCAFFOLD_ROWS: Readonly<Record<number, readonly ConstructionPlanServerStandardTextRow[]>> = {
    ...SHORING_ROWS,
    5: [
        { label: '적용범위', value: '본 계획서는 승인된 현장·동·층·구간의 시스템비계 설치, 사용, 점검, 변경 및 해체 작업에 적용한다.' },
        { label: '우선 기준', value: '승인도면과 승인된 구조검토 문서를 우선 적용하고 상충 시 사용을 중지하여 기술검토를 요청한다.' },
        { label: '변경관리', value: '벽이음·작업발판·승강로·방호구조 또는 설치구간을 변경하면 변경내용을 기록하고 승인 절차를 다시 거친다.' },
    ],
    15: [
        { label: '구조 원칙', value: '수직하중과 풍하중이 받침철물·수직재·벽이음·기초로 안전하게 전달되도록 연속적으로 설치한다.' },
        { label: '부재 역할', value: '수평재·가새·벽이음은 비계틀의 변형과 전도를 억제하도록 승인도면의 간격과 배치에 맞춰 체결한다.' },
        { label: '현장 적용값', value: '실제 틀 간격, 벽이음 간격, 작업발판 폭과 보강조건은 승인 구조값 및 승인도면을 참조한다.' },
    ],
    16: [
        { label: '수직재·수평재', value: '비계틀의 골조를 구성하며 변형·손상·부식 여부와 연결부 체결상태를 반입 및 설치 전에 확인한다.' },
        { label: '가새·벽이음', value: '수평 안정성과 전도 방지를 담당하며 앵커, 클램프 및 양단 접합의 이탈방지 상태를 확인한다.' },
        { label: '발판·방호구조', value: '작업발판, 안전난간, 발끝막이, 낙하물방지망과 승강로의 손상·고정·연속성을 확인한다.' },
    ],
    18: [
        { label: '1단계', value: '작업구간 통제, 지반·기초 확인, 기준선 표시 후 받침철물과 수직재를 배치한다.' },
        { label: '2단계', value: '수평재·가새·벽이음을 순차 체결하고 수직도·간격·접합상태를 확인한다.' },
        { label: '3단계', value: '작업발판·승강로·난간·발끝막이·낙하방지망을 설치하고 사용 전 검측을 요청한다.' },
    ],
    19: [
        { label: '조립원칙', value: '받침철물을 평탄하게 고정하고 수직재를 세운 뒤 수평재를 폐합하여 비계틀을 안정시킨다.' },
        { label: '진행관리', value: '조립 높이에 따라 작업발판과 추락방호를 선행하고 미완성 비계틀에는 임시 안정조치를 둔다.' },
        { label: '검측', value: '받침, 수직도, 틀 간격, 체결과 변형을 구간별로 확인하고 부적합은 다음 조립 전에 조치한다.' },
    ],
    20: [
        { label: '가새 설치', value: '승인도면의 방향·구간·연속성에 맞춰 가새를 설치하고 양단 접합을 확실히 체결한다.' },
        { label: '벽이음 설치', value: '승인된 수직·수평 간격으로 벽이음을 구조물에 연결하고 앵커·클램프·접합부를 점검한다.' },
        { label: '해체 원칙', value: '해체 승인 후 설치의 역순으로 진행하며 안정에 필요한 가새와 벽이음은 선행 제거하지 않는다.' },
    ],
    34: [
        { label: 'ITP', value: '반입·설치·사용 전·사용 중·변경·해체 단계별 검사계획과 확인 책임자를 운영한다.' },
        ...SHORING_ROWS[34].slice(1),
    ],
};

const CATALOG_PAGES = new Set([15, 16]);
const OVERRIDE_PAGES = new Set([5, 12, 18, 19, 20, 34, 35, 38]);
const normalize = (value: string): string => value.replace(/\r\n?/g, '\n').trim();
const serialize = (rows: readonly ConstructionPlanServerStandardTextRow[]): string => rows
    .map((row) => `${row.label}\n${row.value}`).join('\n\n');

export const resolveConstructionPlanServerStandardText = (
    contract: ConstructionPlanServerTemplateContract,
    sectionKey: string,
): ConstructionPlanServerStandardTextEntry | undefined => {
    const page = contract.pages.find((candidate) => candidate.sectionKey === sectionKey);
    if (!page || (!CATALOG_PAGES.has(page.pageNumber) && !OVERRIDE_PAGES.has(page.pageNumber))) return undefined;
    const rows = (contract.tradeType === 'system-scaffold' ? SCAFFOLD_ROWS : SHORING_ROWS)[page.pageNumber];
    if (!rows) throw new Error(`construction-plan-standard-text-catalog-missing:${contract.tradeType}:${page.pageNumber}`);
    return {
        pageNumber: page.pageNumber,
        sectionKey,
        strategy: CATALOG_PAGES.has(page.pageNumber) ? 'template-catalog' : 'template-with-override',
        standardTextVersion: `${contract.templateId}@${contract.templateVersion}:standard-copy-v1`,
        rows,
        originalText: serialize(rows),
    };
};

export interface ConstructionPlanServerStandardTextIssue { code: string; path: string; message: string }

export const validateConstructionPlanServerStandardText = (
    contract: ConstructionPlanServerTemplateContract,
    section: UnknownRecord,
): ConstructionPlanServerStandardTextIssue[] => {
    const issues: ConstructionPlanServerStandardTextIssue[] = [];
    const key = typeof section.key === 'string' ? section.key : '';
    const entry = resolveConstructionPlanServerStandardText(contract, key);
    const content = typeof section.content === 'object' && section.content !== null && !Array.isArray(section.content)
        ? section.content as UnknownRecord : {};
    const version = typeof content.standardTextVersion === 'string' ? content.standardTextVersion.trim() : undefined;
    const current = typeof content.standardTextCurrent === 'string' ? normalize(content.standardTextCurrent) : undefined;
    const hasStored = version !== undefined || current !== undefined;
    if (!entry) {
        if (hasStored) issues.push({ code: 'unexpected', path: 'content.standardTextVersion', message: 'This section has no server standard-text contract.' });
        return issues;
    }
    const original = normalize(entry.originalText);
    const modified = current !== undefined && current !== original;
    if (hasStored && (version !== entry.standardTextVersion || !current || current.length > 6000)) {
        issues.push({ code: 'binding', path: 'content.standardTextVersion', message: 'Standard text version and current text must bind to the server catalog.' });
    }
    if (entry.strategy === 'template-catalog') {
        if (modified || section.standardTextModified === true || section.standardTextModificationReason !== undefined) {
            issues.push({ code: 'catalog_locked', path: 'content.standardTextCurrent', message: 'Template-catalog text cannot be overridden.' });
        }
        return issues;
    }
    if (!hasStored && section.standardTextModified !== true) return issues; // Historical shoring snapshots.
    if (section.standardTextModified !== modified) {
        issues.push({ code: 'modified_flag', path: 'standardTextModified', message: 'Standard-text modified flag must match the server original.' });
    }
    if (modified) {
        const reason = typeof section.standardTextModificationReason === 'string' ? section.standardTextModificationReason.trim() : '';
        const updatedBy = typeof section.updatedBy === 'string' ? section.updatedBy.trim() : '';
        const updatedAt = typeof section.updatedAt === 'string' ? section.updatedAt.trim() : '';
        if (reason.length < 5 || reason.length > 500) issues.push({ code: 'reason', path: 'standardTextModificationReason', message: 'A 5–500 character change reason is required.' });
        if (!updatedBy || updatedBy.length > 200) issues.push({ code: 'updated_by', path: 'updatedBy', message: 'Standard-text modifier is required.' });
        if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) issues.push({ code: 'updated_at', path: 'updatedAt', message: 'Standard-text modification timestamp is required.' });
    } else if (section.standardTextModificationReason !== undefined) {
        issues.push({ code: 'stale_reason', path: 'standardTextModificationReason', message: 'Unmodified standard text cannot retain a change reason.' });
    }
    return issues;
};

export const constructionPlanServerStandardTextRowsForRender = (
    contract: ConstructionPlanServerTemplateContract,
    section: UnknownRecord,
): readonly ConstructionPlanServerStandardTextRow[] => {
    const entry = resolveConstructionPlanServerStandardText(contract, String(section.key || ''));
    if (!entry) return [];
    const issues = validateConstructionPlanServerStandardText(contract, section);
    if (issues.length) throw new Error(`construction-plan-standard-text-invalid:${section.key}:${issues[0].code}`);
    const content = section.content as UnknownRecord;
    const current = typeof content.standardTextCurrent === 'string' ? normalize(content.standardTextCurrent) : '';
    if (entry.strategy === 'template-with-override' && current && current !== normalize(entry.originalText)) {
        return [{ label: '승인된 표준문구 변경본', value: current }];
    }
    return entry.rows;
};

export const listConstructionPlanServerStandardTextEntries = (
    contract: ConstructionPlanServerTemplateContract,
): readonly ConstructionPlanServerStandardTextEntry[] => contract.pages.flatMap((page) => {
    const entry = resolveConstructionPlanServerStandardText(contract, page.sectionKey);
    return entry ? [entry] : [];
});
