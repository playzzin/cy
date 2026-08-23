import { readFileSync } from 'fs';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import PDFDocument = require('pdfkit');
import {
    canonicalStringify,
    CONSTRUCTION_PLAN_PAGE_COUNT,
    CONSTRUCTION_PLAN_RENDERER_VERSION,
    CONSTRUCTION_PLAN_SCHEMA_VERSION,
    CONSTRUCTION_PLAN_SECTION_ORDER,
    CONSTRUCTION_PLAN_TEMPLATE_ID,
    CONSTRUCTION_PLAN_TEMPLATE_PAGES,
    CONSTRUCTION_PLAN_TEMPLATE_VERSION,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';

/**
 * Shadow renderer only. It must not be bound as a field-use issued export until
 * drawing/image composition and zero-omission page contracts are complete.
 */
export const CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION = 'server-a4-shadow-v1';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_WIDTH_PX = 1240;
const PAGE_HEIGHT_PX = 1754;
const JPEG_QUALITY = 88;
const SERVER_FONT_FAMILY = 'Construction Plan Noto Sans KR';
const BODY_LINE_LIMIT = 34;
const BODY_VALUE_LIMIT = 1_200;
const EXECUTION_FORM_PAGE_NUMBERS = new Set([13, 28, 39, 40, 41, 42]);
export const EXECUTION_FORM_EMPTY_NOTICE = '현장 실행용 빈 양식 · 발행 시점 미실시';
export const EXECUTION_FORM_EVIDENCE_NOTICE = '공란·체크박스·서명란은 승인 증적이 아님';

const FONT_ASSETS = [
    'noto-sans-kr-korean-400-normal.woff2',
    'noto-sans-kr-latin-400-normal.woff2',
    'noto-sans-kr-korean-700-normal.woff2',
    'noto-sans-kr-latin-700-normal.woff2',
] as const;

const PAGE_TITLES = [
    '시공계획서 표지',
    '문서관리 및 개정이력',
    '목차 (1/2)',
    '목차 (2/2)',
    '일반사항',
    '공사개요',
    '현장 조직도 및 업무분장',
    '자재 반입 및 보관계획',
    '장비 사용계획',
    '장비 배치 및 작업동선',
    '양중작업 계획',
    '장비 안전작업 절차',
    '장비 일상점검 기준',
    '신호체계 및 통제계획',
    '시스템동바리 개요',
    '시스템동바리 구성 부품',
    '부재 규격 및 허용범위',
    '표준 설치 순서',
    '지주 및 수평재 조립',
    '가새 설치계획',
    '상·하부 접합 상세',
    '도면목록 및 공통주의사항',
    'D-01 평면 배치도',
    'D-02 입면도',
    'D-02 단면도',
    'D-03·D-04 지지 및 보강 상세',
    'D-05·D-06 접합 및 장비간섭 상세',
    '타설 전 Hold Point',
    '구조관리 기준',
    '설치 작업계획',
    '콘크리트 타설계획',
    '해체 작업계획',
    '존치 및 재동바리 계획',
    '품질관리 계획',
    '안전관리 계획',
    '위험성평가',
    '비상조치 계획',
    '환경관리 계획',
    '설치 검측 체크리스트',
    '장비 일일점검일지',
    '현장사진대지',
    '인수인계 및 확인서',
] as const;

if (PAGE_TITLES.length !== CONSTRUCTION_PLAN_PAGE_COUNT) {
    throw new Error('construction-plan-server-renderer-page-title-count-invalid');
}

export interface VerifiedApprovedSnapshot {
    snapshotHash: string;
    envelope: UnknownRecord;
    content: UnknownRecord;
}

export interface ServerPdfPageManifest {
    pageNumber: number;
    sectionKey: string;
    title: string;
    required: boolean;
    payloadHash: string;
    payloadLineCount: number;
}

export interface ServerPdfProvenance {
    rendererVersion: typeof CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION;
    rendererTemplateBundleHash: string;
    contentManifestHash: string;
    snapshotHash: string;
}

export interface ServerPdfRenderResult extends ServerPdfProvenance {
    releaseEligible: false;
    bytes: Buffer;
    sha256: string;
    sizeBytes: number;
    pageCount: typeof CONSTRUCTION_PLAN_PAGE_COUNT;
    pageManifest: ServerPdfPageManifest[];
    fileName: string;
}

export interface ShadowRendererSnapshotValidation {
    valid: boolean;
    issues: string[];
}

let registeredFontAssetHashes: Array<{ fileName: string; sha256: string }> | null = null;
let koreanSearchFontBytes: Buffer | null = null;

const resolveFontAsset = (fileName: string): string => require.resolve(
    `@fontsource/noto-sans-kr/files/${fileName}`,
);

/** Registers an OFL-1.1 Korean font bundle and returns its content digests. */
export const ensureConstructionPlanServerFonts = (): Array<{ fileName: string; sha256: string }> => {
    if (registeredFontAssetHashes) return registeredFontAssetHashes.map((asset) => ({ ...asset }));
    const hashes: Array<{ fileName: string; sha256: string }> = [];
    FONT_ASSETS.forEach((fileName) => {
        const bytes = readFileSync(resolveFontAsset(fileName));
        const fontKey = GlobalFonts.register(bytes, SERVER_FONT_FAMILY);
        if (!fontKey && !GlobalFonts.has(SERVER_FONT_FAMILY)) {
            throw new Error(`construction-plan-server-font-register-failed:${fileName}`);
        }
        hashes.push({ fileName, sha256: sha256Hex(bytes) });
        if (fileName === 'noto-sans-kr-korean-400-normal.woff2') koreanSearchFontBytes = bytes;
    });
    if (!GlobalFonts.has(SERVER_FONT_FAMILY)) {
        throw new Error('construction-plan-server-font-family-unavailable');
    }
    registeredFontAssetHashes = hashes;
    return hashes.map((asset) => ({ ...asset }));
};

const getKoreanSearchFontBytes = (): Buffer => {
    ensureConstructionPlanServerFonts();
    if (!koreanSearchFontBytes) throw new Error('construction-plan-server-search-font-unavailable');
    return koreanSearchFontBytes;
};

const rendererLayoutContract = {
    rendererVersion: CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION,
    page: { widthPx: PAGE_WIDTH_PX, heightPx: PAGE_HEIGHT_PX, widthPt: A4_WIDTH_PT, heightPt: A4_HEIGHT_PT },
    jpegQuality: JPEG_QUALITY,
    bodyLineLimit: BODY_LINE_LIMIT,
    bodyValueLimit: BODY_VALUE_LIMIT,
    pageContracts: CONSTRUCTION_PLAN_TEMPLATE_PAGES.map((page, index) => ({
        ...page,
        title: PAGE_TITLES[index],
    })),
};

export const getConstructionPlanRendererTemplateBundleHash = (): string => sha256Hex(canonicalStringify({
    ...rendererLayoutContract,
    fontAssets: ensureConstructionPlanServerFonts(),
}));

const assertSha256 = (value: string, label: string): string => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) throw new TypeError(`${label}-invalid`);
    return normalized;
};

const samePrimitiveArray = (actual: unknown, expected: readonly unknown[]): boolean => (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
);

const expectedSectionContracts = (() => {
    const contracts = new Map<string, { order: number; pageNumbers: number[]; required: boolean }>();
    CONSTRUCTION_PLAN_TEMPLATE_PAGES.forEach((page) => {
        const current = contracts.get(page.sectionKey);
        if (current) {
            current.pageNumbers.push(page.pageNumber);
            current.required = current.required || page.required;
        } else {
            contracts.set(page.sectionKey, {
                order: page.pageNumber - 1,
                pageNumbers: [page.pageNumber],
                required: page.required,
            });
        }
    });
    return contracts;
})();

/** Strict shape gate matching the canonical renderer snapshot produced by domain.ts. */
export const validateShadowRendererSnapshotContent = (content: unknown): ShadowRendererSnapshotValidation => {
    const issues: string[] = [];
    if (!isUnknownRecord(content)) return { valid: false, issues: ['content.shape'] };
    const requiredStrings = ['planId', 'siteId', 'title', 'documentNo', 'documentDate', 'createdBy', 'createdAt'];
    requiredStrings.forEach((key) => {
        if (!readTrimmedString(content, [key])) issues.push(`content.${key}`);
    });
    if (content.tradeType !== 'system-shoring') issues.push('content.tradeType');
    if (content.templateId !== CONSTRUCTION_PLAN_TEMPLATE_ID) issues.push('content.templateId');
    if (content.templateVersion !== CONSTRUCTION_PLAN_TEMPLATE_VERSION) issues.push('content.templateVersion');
    if (content.rendererVersion !== CONSTRUCTION_PLAN_RENDERER_VERSION) issues.push('content.rendererVersion');
    if (content.schemaVersion !== CONSTRUCTION_PLAN_SCHEMA_VERSION) issues.push('content.schemaVersion');
    if (content.snapshotSchemaVersion !== 1 && content.snapshotSchemaVersion !== 2) {
        issues.push('content.snapshotSchemaVersion');
    }
    if (!Number.isInteger(content.revision) || Number(content.revision) < 0) issues.push('content.revision');

    const project = isUnknownRecord(content.projectSnapshot) ? content.projectSnapshot : null;
    if (!project
        || !readTrimmedString(project, ['capturedAt'])
        || typeof project.siteName !== 'string'
        || !Array.isArray(project.buildings)
        || !Array.isArray(project.floors)
        || !Array.isArray(project.zones)) {
        issues.push('content.projectSnapshot');
    }
    const organization = isUnknownRecord(content.organizationSnapshot) ? content.organizationSnapshot : null;
    if (!organization
        || !readTrimmedString(organization, ['capturedAt'])
        || !Array.isArray(organization.assignments)
        || !Array.isArray(organization.additionalWorkers)) {
        issues.push('content.organizationSnapshot');
    }

    if (!samePrimitiveArray(content.sectionOrder, CONSTRUCTION_PLAN_SECTION_ORDER)) {
        issues.push('content.sectionOrder');
    }
    if (!Array.isArray(content.sections) || content.sections.length !== expectedSectionContracts.size) {
        issues.push('content.sections.length');
    } else {
        const seen = new Set<string>();
        content.sections.forEach((rawSection, index) => {
            if (!isUnknownRecord(rawSection)) {
                issues.push(`content.sections[${index}].shape`);
                return;
            }
            const id = readTrimmedString(rawSection, ['id']);
            const key = readTrimmedString(rawSection, ['key']);
            const contract = key ? expectedSectionContracts.get(key) : undefined;
            if (!id || id !== key || !contract || seen.has(key || '')) {
                issues.push(`content.sections[${index}].identity`);
                return;
            }
            seen.add(key);
            if (rawSection.order !== contract.order
                || rawSection.required !== contract.required
                || !samePrimitiveArray(rawSection.pageNumbers, contract.pageNumbers)
                || !isUnknownRecord(rawSection.content)
                || !['empty', 'in_progress', 'complete', 'not_applicable'].includes(String(rawSection.status || ''))) {
                issues.push(`content.sections[${index}].manifest`);
            }
        });
        CONSTRUCTION_PLAN_SECTION_ORDER.forEach((key) => {
            if (!seen.has(key)) issues.push(`content.sections.missing:${key}`);
        });
    }

    ['drawings', 'drawingApplicability', 'engineeringValues', 'equipmentPlan', 'riskAssessments'].forEach((key) => {
        if (!Array.isArray(content[key])) issues.push(`content.${key}`);
    });
    return { valid: issues.length === 0, issues };
};

/** Verifies bytes before parsing so the renderer never reads mutable live plan content. */
export const verifyApprovedConstructionPlanSnapshot = (
    snapshotBytes: Buffer,
    expectedSnapshotHash: string,
    expectedPlanId: string,
): VerifiedApprovedSnapshot => {
    const snapshotHash = assertSha256(expectedSnapshotHash, 'construction-plan-approved-snapshot-sha256');
    if (!Buffer.isBuffer(snapshotBytes) || snapshotBytes.length === 0) {
        throw new TypeError('construction-plan-approved-snapshot-empty');
    }
    if (sha256Hex(snapshotBytes) !== snapshotHash) {
        throw new Error('construction-plan-approved-snapshot-hash-mismatch');
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(snapshotBytes.toString('utf8'));
    } catch (_error) {
        throw new Error('construction-plan-approved-snapshot-json-invalid');
    }
    if (!isUnknownRecord(parsed) || !isUnknownRecord(parsed.content)) {
        throw new Error('construction-plan-approved-snapshot-envelope-invalid');
    }
    const envelopePlanId = readTrimmedString(parsed, ['planId']);
    const contentPlanId = readTrimmedString(parsed.content, ['planId']);
    if (envelopePlanId !== expectedPlanId || contentPlanId !== expectedPlanId) {
        throw new Error('construction-plan-approved-snapshot-plan-mismatch');
    }
    if (parsed.kind !== 'review_submission'
        || (Number(parsed.snapshotSchemaVersion) !== 1 && Number(parsed.snapshotSchemaVersion) !== 2)) {
        throw new Error('construction-plan-approved-snapshot-schema-unsupported');
    }
    if (Number(parsed.snapshotSchemaVersion) !== Number(parsed.content.snapshotSchemaVersion)) {
        throw new Error('construction-plan-approved-snapshot-schema-mismatch');
    }
    const contentValidation = validateShadowRendererSnapshotContent(parsed.content);
    if (!contentValidation.valid) {
        throw new Error(`construction-plan-approved-snapshot-content-invalid:${contentValidation.issues.slice(0, 20).join(',')}`);
    }
    return { snapshotHash, envelope: parsed, content: parsed.content };
};

const stringValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value.trim() || '-';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return canonicalStringify(value) || '-';
};

const flattenPayload = (
    value: unknown,
    path = '',
    depth = 0,
    lines: Array<{ label: string; value: string }> = [],
): Array<{ label: string; value: string }> => {
    if (lines.length >= BODY_LINE_LIMIT * 2) return lines;
    if (value === null || typeof value !== 'object' || depth >= 4) {
        lines.push({ label: path || '내용', value: stringValue(value).slice(0, BODY_VALUE_LIMIT) });
        return lines;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) lines.push({ label: path || '내용', value: '(없음)' });
        value.slice(0, 24).forEach((entry, index) => flattenPayload(
            entry,
            `${path || '항목'}[${index + 1}]`,
            depth + 1,
            lines,
        ));
        if (value.length > 24) lines.push({ label: path || '항목', value: `외 ${value.length - 24}건` });
        return lines;
    }
    Object.keys(value as UnknownRecord).sort().forEach((key) => {
        const nextPath = path ? `${path}.${key}` : key;
        flattenPayload((value as UnknownRecord)[key], nextPath, depth + 1, lines);
    });
    return lines;
};

const sectionIdentifier = (value: unknown): string | undefined => {
    if (!isUnknownRecord(value)) return undefined;
    return readTrimmedString(value, ['sectionKey', 'id', 'key', 'slug']);
};

const findSection = (content: UnknownRecord, sectionKey: string): unknown => (
    Array.isArray(content.sections)
        ? content.sections.find((section) => sectionIdentifier(section) === sectionKey)
        : undefined
);

const drawingSlotForPage = (pageNumber: number): readonly string[] => {
    if (pageNumber === 23) return ['D-01'];
    if (pageNumber === 24 || pageNumber === 25) return ['D-02'];
    if (pageNumber === 26) return ['D-03', 'D-04'];
    if (pageNumber === 27) return ['D-05', 'D-06'];
    return [];
};

const filterDrawingPayload = (content: UnknownRecord, pageNumber: number): unknown => {
    const slots = drawingSlotForPage(pageNumber);
    if (slots.length === 0) return content.drawings;
    return Array.isArray(content.drawings)
        ? content.drawings.filter((drawing) => {
            if (!isUnknownRecord(drawing)) return false;
            const slot = readTrimmedString(drawing, ['slot', 'drawingNo', 'number', 'id']);
            return Boolean(slot && slots.some((expected) => slot.toUpperCase().includes(expected)));
        })
        : [];
};

const pagePayload = (content: UnknownRecord, pageNumber: number, sectionKey: string): UnknownRecord => {
    const section = findSection(content, sectionKey);
    const base: UnknownRecord = {
        documentNo: content.documentNo,
        revision: content.revision,
        documentDate: content.documentDate,
        siteId: content.siteId,
        title: content.title,
    };
    const executionFormNotice = EXECUTION_FORM_PAGE_NUMBERS.has(pageNumber)
        ? { executionFormNotice: [EXECUTION_FORM_EMPTY_NOTICE, EXECUTION_FORM_EVIDENCE_NOTICE] }
        : {};
    if (pageNumber === 1) {
        return { ...base, projectSnapshot: content.projectSnapshot, ...executionFormNotice };
    }
    if (pageNumber === 2) {
        return {
            ...base,
            revisionReason: content.revisionReason,
            revisionType: content.revisionType,
            sourceRevisionNo: content.sourceRevisionNo,
            sourceSnapshotHash: content.sourceSnapshotHash,
            templateVersion: content.templateVersion,
            schemaVersion: content.schemaVersion,
            ...executionFormNotice,
        };
    }
    if (pageNumber === 3 || pageNumber === 4) {
        const offset = pageNumber === 3 ? 0 : 21;
        return {
            ...base,
            toc: CONSTRUCTION_PLAN_TEMPLATE_PAGES.slice(offset, offset + 21).map((page, index) => ({
                pageNumber: page.pageNumber,
                sectionKey: page.sectionKey,
                title: PAGE_TITLES[offset + index],
            })),
            ...executionFormNotice,
        };
    }
    if (pageNumber === 6) return { ...base, projectSnapshot: content.projectSnapshot, section, ...executionFormNotice };
    if (pageNumber === 7) return { ...base, organizationSnapshot: content.organizationSnapshot, section, ...executionFormNotice };
    if (pageNumber >= 9 && pageNumber <= 14) return { ...base, equipmentPlan: content.equipmentPlan, section, ...executionFormNotice };
    if (pageNumber === 17 || pageNumber === 29) return { ...base, engineeringValues: content.engineeringValues, section, ...executionFormNotice };
    if (pageNumber >= 22 && pageNumber <= 27) {
        return {
            ...base,
            drawingApplicability: content.drawingApplicability,
            drawings: filterDrawingPayload(content, pageNumber),
            section,
            ...executionFormNotice,
        };
    }
    if (pageNumber === 36) return { ...base, riskAssessments: content.riskAssessments, section, ...executionFormNotice };
    return {
        ...base,
        section: section ?? { state: '스냅샷에 별도 섹션 페이로드 없음' },
        ...executionFormNotice,
    };
};

const buildPageManifests = (content: UnknownRecord): Array<{
    manifest: ServerPdfPageManifest;
    payload: UnknownRecord;
    lines: Array<{ label: string; value: string }>;
}> => CONSTRUCTION_PLAN_TEMPLATE_PAGES.map((page, index) => {
    const payload = pagePayload(content, page.pageNumber, page.sectionKey);
    const lines = flattenPayload(payload);
    return {
        payload,
        lines,
        manifest: {
            pageNumber: page.pageNumber,
            sectionKey: page.sectionKey,
            title: PAGE_TITLES[index],
            required: page.required,
            payloadHash: sha256Hex(canonicalStringify(payload)),
            payloadLineCount: lines.length,
        },
    };
});

const splitTextToWidth = (context: SKRSContext2D, value: string, maxWidth: number): string[] => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return ['-'];
    const lines: string[] = [];
    let line = '';
    for (const character of normalized) {
        const candidate = `${line}${character}`;
        if (line && context.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = character;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines;
};

const drawText = (
    context: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
): number => {
    const lines = splitTextToWidth(context, text, maxWidth).slice(0, maxLines);
    lines.forEach((line, index) => context.fillText(line, x, y + (index * lineHeight)));
    return Math.max(1, lines.length) * lineHeight;
};

const drawPage = (
    page: ServerPdfPageManifest,
    lines: Array<{ label: string; value: string }>,
    provenance: ServerPdfProvenance,
    identity: { planId: string; documentNo: string; revision: number; templateVersion: string },
): Buffer => {
    ensureConstructionPlanServerFonts();
    const canvas = createCanvas(PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);

    context.fillStyle = '#103a5c';
    context.fillRect(0, 0, PAGE_WIDTH_PX, 22);
    context.fillRect(0, PAGE_HEIGHT_PX - 22, PAGE_WIDTH_PX, 22);

    context.fillStyle = '#0f172a';
    context.font = `700 34px "${SERVER_FONT_FAMILY}"`;
    context.fillText('시스템동바리 시공계획서', 72, 92);
    context.fillStyle = '#476579';
    context.font = `400 17px "${SERVER_FONT_FAMILY}"`;
    context.fillText(`SERVER AUTHORITY · ${CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION}`, 74, 125);

    context.strokeStyle = '#9db1c0';
    context.lineWidth = 2;
    context.strokeRect(66, 154, PAGE_WIDTH_PX - 132, 118);
    context.fillStyle = '#eaf2f7';
    context.fillRect(66, 154, PAGE_WIDTH_PX - 132, 38);
    context.fillStyle = '#123c5a';
    context.font = `700 18px "${SERVER_FONT_FAMILY}"`;
    context.fillText(`문서번호  ${identity.documentNo}`, 86, 181);
    context.font = `400 17px "${SERVER_FONT_FAMILY}"`;
    context.fillText(`Rev. ${identity.revision}`, 86, 229);
    context.fillText(`Template ${identity.templateVersion}`, 290, 229);
    context.fillText(`Snapshot ${provenance.snapshotHash.slice(0, 16)}…`, 650, 229);

    context.fillStyle = '#0f172a';
    context.font = `700 31px "${SERVER_FONT_FAMILY}"`;
    context.fillText(`${String(page.pageNumber).padStart(2, '0')}. ${page.title}`, 72, 335);
    context.fillStyle = '#64748b';
    context.font = `400 16px "${SERVER_FONT_FAMILY}"`;
    context.fillText(`SECTION ${page.sectionKey} · PAYLOAD ${page.payloadHash.slice(0, 16)}…`, 74, 368);

    let y = 415;
    if (EXECUTION_FORM_PAGE_NUMBERS.has(page.pageNumber)) {
        context.fillStyle = '#fff3d6';
        context.fillRect(68, 388, PAGE_WIDTH_PX - 136, 78);
        context.strokeStyle = '#d97706';
        context.strokeRect(68, 388, PAGE_WIDTH_PX - 136, 78);
        context.fillStyle = '#92400e';
        context.font = `700 16px "${SERVER_FONT_FAMILY}"`;
        context.fillText(EXECUTION_FORM_EMPTY_NOTICE, 84, 417);
        context.font = `400 15px "${SERVER_FONT_FAMILY}"`;
        context.fillText(EXECUTION_FORM_EVIDENCE_NOTICE, 84, 448);
        y = 505;
    }
    const shownLines = lines.slice(0, BODY_LINE_LIMIT);
    shownLines.forEach((line, index) => {
        const rowHeight = 34 + (Math.min(3, Math.max(1, Math.ceil(String(line.value).length / 65))) * 24);
        if (y + rowHeight > PAGE_HEIGHT_PX - 135) return;
        context.fillStyle = index % 2 === 0 ? '#f7fafc' : '#ffffff';
        context.fillRect(68, y - 22, PAGE_WIDTH_PX - 136, rowHeight);
        context.strokeStyle = '#d7e0e6';
        context.strokeRect(68, y - 22, PAGE_WIDTH_PX - 136, rowHeight);

        context.fillStyle = '#214d69';
        context.font = `700 15px "${SERVER_FONT_FAMILY}"`;
        const label = line.label.length > 54 ? `${line.label.slice(0, 53)}…` : line.label;
        context.fillText(label, 84, y);
        context.fillStyle = '#111827';
        context.font = `400 16px "${SERVER_FONT_FAMILY}"`;
        const consumed = drawText(context, line.value, 410, y, PAGE_WIDTH_PX - 500, 24, 3);
        y += Math.max(rowHeight, consumed + 24);
    });

    if (lines.length > shownLines.length) {
        context.fillStyle = '#7c2d12';
        context.font = `700 15px "${SERVER_FONT_FAMILY}"`;
        context.fillText(`지면 제한으로 ${lines.length - shownLines.length}개 항목 생략 · 전체 payload hash로 무결성 고정`, 78, PAGE_HEIGHT_PX - 104);
    }

    context.fillStyle = '#334155';
    context.font = `400 13px "${SERVER_FONT_FAMILY}"`;
    context.fillText(
        `승인 스냅샷 ${provenance.snapshotHash.slice(0, 12)}…  ·  템플릿 번들 ${provenance.rendererTemplateBundleHash.slice(0, 12)}…  ·  콘텐츠 ${provenance.contentManifestHash.slice(0, 12)}…`,
        72,
        PAGE_HEIGHT_PX - 58,
    );
    context.textAlign = 'right';
    context.font = `700 15px "${SERVER_FONT_FAMILY}"`;
    context.fillText(`${page.pageNumber} / ${CONSTRUCTION_PLAN_PAGE_COUNT}`, PAGE_WIDTH_PX - 72, PAGE_HEIGHT_PX - 58);
    context.textAlign = 'left';

    return canvas.toBuffer('image/jpeg', JPEG_QUALITY);
};

const sanitizeAuditValue = (value: string | number, maxLength: number): string => {
    let ascii = '';
    for (const character of String(value)) {
        const codePoint = character.codePointAt(0) || 0;
        if (codePoint >= 0x20 && codePoint <= 0x7e) ascii += character;
        else if (/\s/.test(character)) ascii += ' ';
        else ascii += '_';
    }
    return ascii.replace(/\s+/g, ' ').trim().slice(0, maxLength).replace(/[|=;]/g, '_') || '-';
};

const escapePdfLiteral = (value: string): string => value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const pdfAuditText = (
    page: ServerPdfPageManifest,
    provenance: ServerPdfProvenance,
    identity: { planId: string; documentNo: string; revision: number; templateVersion: string },
): string => [
    `PLAN_ID=${sanitizeAuditValue(identity.planId, 72)}`,
    `DOCUMENT_NO=${sanitizeAuditValue(identity.documentNo, 72)}`,
    `REV=${sanitizeAuditValue(identity.revision, 24)}`,
    `TEMPLATE_VERSION=${sanitizeAuditValue(identity.templateVersion, 72)}`,
    `PAGE ${page.pageNumber}/${CONSTRUCTION_PLAN_PAGE_COUNT}`,
    `SNAPSHOT_HASH=${provenance.snapshotHash}`,
    `RENDERER_VERSION=${provenance.rendererVersion}`,
    `RENDERER_TEMPLATE_BUNDLE_HASH=${provenance.rendererTemplateBundleHash}`,
    `CONTENT_MANIFEST_HASH=${provenance.contentManifestHash}`,
    `PAGE_PAYLOAD_HASH=${page.payloadHash}`,
].join(' | ');

const encodeAscii = (value: string): Buffer => {
    if (Array.from(value).some((character) => character.charCodeAt(0) > 0x7f)) {
        throw new TypeError('construction-plan-pdf-structure-must-be-ascii');
    }
    return Buffer.from(value, 'ascii');
};

const writeRasterPdf = (
    jpegPages: Buffer[],
    manifests: ServerPdfPageManifest[],
    provenance: ServerPdfProvenance,
    identity: { planId: string; documentNo: string; revision: number; templateVersion: string },
): Buffer => {
    if (jpegPages.length !== CONSTRUCTION_PLAN_PAGE_COUNT || manifests.length !== jpegPages.length) {
        throw new RangeError('construction-plan-server-pdf-page-count-invalid');
    }
    const objectCount = 4 + (jpegPages.length * 3);
    const offsets = new Array<number>(objectCount + 1).fill(0);
    const chunks: Buffer[] = [];
    let byteLength = 0;
    const append = (value: Buffer | string): void => {
        const bytes = typeof value === 'string' ? encodeAscii(value) : value;
        chunks.push(bytes);
        byteLength += bytes.length;
    };
    const begin = (id: number): void => { offsets[id] = byteLength; append(`${id} 0 obj\n`); };
    const end = (): void => append('endobj\n');

    append('%PDF-1.7\n%');
    append(Buffer.from([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    begin(1); append('<< /Type /Catalog /Pages 2 0 R >>\n'); end();
    const pageIds = jpegPages.map((_, index) => 5 + (index * 3));
    begin(2); append(`<< /Type /Pages /Count ${jpegPages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>\n`); end();
    begin(3); append('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n'); end();
    begin(4);
    append(
        `<< /Producer (${escapePdfLiteral(CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION)}) `
        + `/RendererVersion (${escapePdfLiteral(provenance.rendererVersion)}) `
        + `/RendererTemplateBundleHash (${provenance.rendererTemplateBundleHash}) `
        + `/ContentManifestHash (${provenance.contentManifestHash}) `
        + `/ApprovedSnapshotHash (${provenance.snapshotHash}) >>\n`,
    );
    end();

    jpegPages.forEach((jpeg, index) => {
        if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9) {
            throw new TypeError(`construction-plan-server-page-jpeg-invalid:${index + 1}`);
        }
        const pageId = pageIds[index];
        const contentId = pageId + 1;
        const imageId = pageId + 2;
        const audit = pdfAuditText(manifests[index], provenance, identity);
        const stream = encodeAscii(
            `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n`
            + `BT\n/F1 2.5 Tf\n0.25 g\n4 3 Td\n(${escapePdfLiteral(audit)}) Tj\nET\n`,
        );
        begin(pageId);
        append(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] `
            + `/Resources << /ProcSet [/PDF /Text /ImageC] /Font << /F1 3 0 R >> `
            + `/XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`,
        );
        end();
        begin(contentId); append(`<< /Length ${stream.length} >>\nstream\n`); append(stream); append('endstream\n'); end();
        begin(imageId);
        append(
            `<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH_PX} /Height ${PAGE_HEIGHT_PX} `
            + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        );
        append(jpeg); append('\nendstream\n'); end();
    });
    const xrefOffset = byteLength;
    append(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= objectCount; id += 1) append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
    append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return Buffer.concat(chunks, byteLength);
};

const koreanSearchTerms = (value: string): string => (
    value.match(/[\u3131-\u318e\uac00-\ud7a3]+/g)?.join(' ') || ''
);

const writeSearchableRasterPdf = async (
    jpegPages: Buffer[],
    pageEntries: Array<{
        manifest: ServerPdfPageManifest;
        lines: Array<{ label: string; value: string }>;
    }>,
    provenance: ServerPdfProvenance,
    identity: { planId: string; documentNo: string; revision: number; templateVersion: string },
): Promise<Buffer> => new Promise<Buffer>((resolve, reject) => {
    const fixedPdfDate = new Date('2000-01-01T00:00:00.000Z');
    const document = new PDFDocument({
        autoFirstPage: false,
        compress: true,
        bufferPages: true,
        pdfVersion: '1.7',
        info: {
            Title: `${identity.documentNo} Rev.${identity.revision}`,
            Author: 'Construction Plan Server Renderer',
            Subject: '승인 스냅샷 기반 시스템 동바리 시공계획서 세도우 출력',
            Keywords: 'construction plan, system shoring, approved snapshot, shadow renderer',
            CreationDate: fixedPdfDate,
            ModDate: fixedPdfDate,
            RendererVersion: provenance.rendererVersion,
            RendererTemplateBundleHash: provenance.rendererTemplateBundleHash,
            ContentManifestHash: provenance.contentManifestHash,
            ApprovedSnapshotHash: provenance.snapshotHash,
        } as PDFKit.DocumentInfo,
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.registerFont('ConstructionPlanKoreanSearch', getKoreanSearchFontBytes());

    pageEntries.forEach((entry, index) => {
        document.addPage({ size: [A4_WIDTH_PT, A4_HEIGHT_PT], margin: 0 });
        document.image(jpegPages[index], 0, 0, { width: A4_WIDTH_PT, height: A4_HEIGHT_PT });

        const nativeKoreanText = [
            '시스템 동바리 시공계획서',
            entry.manifest.title,
            ...entry.lines.flatMap((line) => [koreanSearchTerms(line.label), koreanSearchTerms(line.value)]),
            ...(EXECUTION_FORM_PAGE_NUMBERS.has(entry.manifest.pageNumber)
                ? [EXECUTION_FORM_EMPTY_NOTICE, EXECUTION_FORM_EVIDENCE_NOTICE]
                : []),
        ].filter(Boolean).join('\n');
        // OCR-style searchable layer: the page image remains the exact visual
        // layer while embedded Noto Sans KR text enables Korean search/copy.
        document.save();
        document.fillOpacity(0);
        document.fillColor('#000000');
        document.font('ConstructionPlanKoreanSearch');
        document.fontSize(5);
        document.text(nativeKoreanText, 18, 210, {
            width: A4_WIDTH_PT - 36,
            height: A4_HEIGHT_PT - 230,
            lineGap: 0,
        });
        document.restore();

        document.save();
        document.fillOpacity(1);
        document.fillColor('#4b5563');
        document.font('Helvetica');
        document.fontSize(1.55);
        document.text(pdfAuditText(entry.manifest, provenance, identity), 4, A4_HEIGHT_PT - 7, {
            width: A4_WIDTH_PT - 8,
            lineBreak: false,
        });
        document.restore();
    });
    document.end();
});

const normalizeFileName = (documentNo: string, revision: number): string => {
    const base = `${documentNo}_REV-${String(revision).padStart(2, '0')}_ISSUED`
        .normalize('NFKC')
        .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '-')
        .replace(/_+/g, '_')
        .replace(/^[.\s_-]+|[.\s_-]+$/g, '')
        .slice(0, 120) || 'construction-plan-issued';
    return `${base}.pdf`;
};

/** Renders exactly 42 deterministic A4 raster pages from verified canonical snapshot content. */
export const renderVerifiedConstructionPlanServerPdf = async (
    verifiedSnapshot: VerifiedApprovedSnapshot,
): Promise<ServerPdfRenderResult> => {
    const content = verifiedSnapshot.content;
    const planId = readTrimmedString(content, ['planId']);
    const documentNo = readTrimmedString(content, ['documentNo']);
    const templateVersion = readTrimmedString(content, ['templateVersion']);
    const revision = Number(content.revision);
    if (!planId || !documentNo || !templateVersion || !Number.isInteger(revision) || revision < 0) {
        throw new Error('construction-plan-server-render-identity-invalid');
    }
    const pageEntries = buildPageManifests(content);
    const pageManifest = pageEntries.map((entry) => entry.manifest);
    const rendererTemplateBundleHash = getConstructionPlanRendererTemplateBundleHash();
    const contentManifestHash = sha256Hex(canonicalStringify({
        schemaVersion: 1,
        rendererVersion: CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION,
        planId,
        snapshotHash: verifiedSnapshot.snapshotHash,
        pageManifest,
    }));
    const provenance: ServerPdfProvenance = {
        rendererVersion: CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION,
        rendererTemplateBundleHash,
        contentManifestHash,
        snapshotHash: verifiedSnapshot.snapshotHash,
    };
    const identity = { planId, documentNo, revision, templateVersion };
    const jpegPages = pageEntries.map((entry) => drawPage(entry.manifest, entry.lines, provenance, identity));
    const bytes = await writeSearchableRasterPdf(jpegPages, pageEntries, provenance, identity);
    return {
        ...provenance,
        releaseEligible: false,
        bytes,
        sha256: sha256Hex(bytes),
        sizeBytes: bytes.length,
        pageCount: CONSTRUCTION_PLAN_PAGE_COUNT,
        pageManifest,
        fileName: normalizeFileName(documentNo, revision),
    };
};

/** Machine-enforced safety boundary: shadow artifacts can never become field-use exports. */
export const assertConstructionPlanServerPdfFieldUseEligible = (_result: ServerPdfRenderResult): never => {
    throw new Error('construction-plan-server-shadow-not-release-eligible');
};

const auditMarkerPresent = (text: string, label: string, value: string): boolean => (
    text.replace(/\s+/g, ' ').includes(`${label}=${value}`)
);

/** Validates renderer-specific provenance markers on every physical page text layer. */
export const validateServerRendererAuditPages = (
    pageTexts: readonly string[],
    expected: ServerPdfProvenance,
): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    if (pageTexts.length !== CONSTRUCTION_PLAN_PAGE_COUNT) {
        return { valid: false, issues: ['server-pdf-page-count-mismatch'] };
    }
    const fields: Array<[string, string]> = [
        ['SNAPSHOT_HASH', assertSha256(expected.snapshotHash, 'snapshot-hash')],
        ['RENDERER_VERSION', expected.rendererVersion],
        ['RENDERER_TEMPLATE_BUNDLE_HASH', assertSha256(expected.rendererTemplateBundleHash, 'template-bundle-hash')],
        ['CONTENT_MANIFEST_HASH', assertSha256(expected.contentManifestHash, 'content-manifest-hash')],
    ];
    pageTexts.forEach((text, index) => {
        fields.forEach(([label, value]) => {
            if (!auditMarkerPresent(text, label, value)) issues.push(`${label.toLowerCase()}-missing:page-${index + 1}`);
        });
        if (!text.replace(/\s+/g, ' ').includes(`PAGE ${index + 1}/${CONSTRUCTION_PLAN_PAGE_COUNT}`)) {
            issues.push(`page-marker-missing:page-${index + 1}`);
        }
    });
    return { valid: issues.length === 0, issues };
};

/** Pixel probe used by tests/health checks to prove distinct Hangul glyphs were rasterized. */
export const renderServerKoreanGlyphProbe = (glyph: string): { pixelHash: string; inkPixels: number } => {
    ensureConstructionPlanServerFonts();
    const canvas = createCanvas(96, 96);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 96, 96);
    context.fillStyle = '#000000';
    context.font = `700 68px "${SERVER_FONT_FAMILY}"`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, 48, 52);
    const pixels = context.getImageData(0, 0, 96, 96).data;
    let inkPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) inkPixels += 1;
    }
    return { pixelHash: sha256Hex(Buffer.from(pixels)), inkPixels };
};
