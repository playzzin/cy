import { readFileSync } from 'node:fs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import PDFDocument = require('pdfkit');
import {
    canonicalStringify,
    isUnknownRecord,
    readTrimmedString,
    sanitizeConstructionPlanStorageSegment,
    sha256Hex,
    type UnknownRecord,
} from './domain';
import {
    CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    getConstructionPlanBrandLogoPng,
} from './brandAssets';
import {
    buildConstructionPlanRecordCatalog,
    type ConstructionPlanRecordQuestion,
    type ConstructionPlanRecordPhoto,
    type ConstructionPlanRecordResponse,
    type ConstructionPlanRecordType,
} from './executionRecordDomain';

export const CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION = 'execution-record-a4-v1';
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const LEFT = 44;
const RIGHT = 44;
const TOP = 86;
const BOTTOM = 66;
const CONTENT_WIDTH = A4_WIDTH - LEFT - RIGHT;
const CONTENT_BOTTOM = A4_HEIGHT - BOTTOM;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const KOREAN_FONT_FILE = 'noto-sans-kr-korean-400-normal.woff';
const KOREAN_BOLD_FONT_FILE = 'noto-sans-kr-korean-700-normal.woff';

const RECORD_TYPE_LABELS: Record<ConstructionPlanRecordType, string> = {
    equipment_daily_inspection: '장비 일일점검',
    material_receiving_inspection: '자재 반입검수',
    installation_inspection: '설치 검측',
    pre_pour_inspection: '타설·사용 전 최종검측',
    pre_dismantling_inspection: '해체 전 점검',
    daily_safety_log: '일일 안전점검일지',
    photo_sheet: '현장 사진대지',
    final_handover: '최종 인수인계',
};

const PLAN_TRADE_LABELS: Readonly<Record<string, string>> = {
    'system-shoring': '시스템동바리',
    'system-scaffold': '시스템비계',
};

export interface ExecutionRecordPdfArtifact {
    bytes: Buffer;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
    fileName: string;
    rendererVersion: typeof CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION;
    rendererBuildHash: string;
    sourceRecordHash: string;
    renderInputHash: string;
}

export interface StoredExecutionRecordPdfArtifact extends Omit<ExecutionRecordPdfArtifact, 'bytes'> {
    storagePath: string;
    storageGeneration: string;
}

type StorageBucket = ReturnType<ReturnType<typeof admin.storage>['bucket']>;

const fontBytes = (fileName: string): Buffer => readFileSync(require.resolve(
    `@fontsource/noto-sans-kr/files/${fileName}`,
));

export const getExecutionRecordPdfRendererBuildHash = (): string => sha256Hex(canonicalStringify({
    rendererVersion: CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION,
    source: sha256Hex(readFileSync(__filename)),
    logo: CONSTRUCTION_PLAN_BRAND_LOGO_SHA256,
    fonts: [KOREAN_FONT_FILE, KOREAN_BOLD_FONT_FILE].map((fileName) => ({
        fileName,
        sha256: sha256Hex(fontBytes(fileName)),
    })),
    page: { width: A4_WIDTH, height: A4_HEIGHT, left: LEFT, right: RIGHT, top: TOP, bottom: BOTTOM },
}));

const pdfSafeText = (value: string): string => value
    .replace(/[→⇒➜]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\u00a0/g, ' ');

const asText = (value: unknown, fallback = '-'): string => {
    if (typeof value === 'string' && value.trim()) return pdfSafeText(value.trim());
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback;
};

const planTradeLabel = (value: unknown): string => {
    const tradeType = asText(value);
    return PLAN_TRADE_LABELS[tradeType] || tradeType;
};

const planBinding = (record: UnknownRecord): UnknownRecord => (
    isUnknownRecord(record.planBinding) ? record.planBinding : {}
);

const collectPdf = (document: PDFKit.PDFDocument): Promise<Buffer> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
});

export const renderConfirmedConstructionPlanRecordPdf = async (
    record: UnknownRecord,
    photoBytesById: ReadonlyMap<string, Buffer> = new Map(),
): Promise<ExecutionRecordPdfArtifact> => {
    if (record.status !== 'confirmed') {
        throw new functions.https.HttpsError('failed-precondition', '확인 완료된 실행기록만 부록 PDF로 만들 수 있습니다.');
    }
    const sourceRecordHash = readTrimmedString(record, ['confirmationHash']);
    const recordType = record.recordType;
    const binding = planBinding(record);
    if (!sourceRecordHash || !/^[a-f0-9]{64}$/.test(sourceRecordHash)
        || !CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION
        || typeof recordType !== 'string'
        || !(recordType in RECORD_TYPE_LABELS)) {
        throw new functions.https.HttpsError('data-loss', '실행기록 PDF 원천 바인딩이 올바르지 않습니다.');
    }
    const storedQuestions = Array.isArray(record.questions)
        ? record.questions as ConstructionPlanRecordQuestion[]
        : [];
    const catalog = buildConstructionPlanRecordCatalog(
        binding.tradeType as 'system-shoring' | 'system-scaffold',
        recordType as ConstructionPlanRecordType,
        asText(record.catalogVersion),
        storedQuestions,
    );
    if (record.catalogHash !== catalog.hash || record.catalogVersion !== catalog.version) {
        throw new functions.https.HttpsError('data-loss', '실행기록 문항 계약이 현재 서버 catalog와 일치하지 않습니다.');
    }
    const rendererBuildHash = getExecutionRecordPdfRendererBuildHash();
    const photos = (Array.isArray(record.photos) ? record.photos : []) as ConstructionPlanRecordPhoto[];
    const renderInputHash = sha256Hex(canonicalStringify({
        sourceRecordHash,
        rendererBuildHash,
        photoBindings: photos.map((photo) => ({
            id: photo.id, storagePath: photo.storagePath, storageGeneration: photo.storageGeneration,
            sha256: photo.sha256, caption: photo.caption, takenAt: photo.takenAt, zone: photo.zone,
        })),
    }));
    const fixedDate = new Date(asText(record.confirmedAt, '2000-01-01T00:00:00.000Z'));
    const document = new PDFDocument({
        autoFirstPage: false,
        size: [A4_WIDTH, A4_HEIGHT],
        margins: { top: TOP, bottom: BOTTOM, left: LEFT, right: RIGHT },
        bufferPages: true,
        compress: false,
        info: {
            Title: `${asText(binding.documentNo)} ${RECORD_TYPE_LABELS[recordType as ConstructionPlanRecordType]}`,
            Author: '청연이엔지',
            Subject: '시공계획서 현장 실행기록 부록',
            Keywords: '시공계획서, 실행기록, 점검, 확인',
            CreationDate: Number.isNaN(fixedDate.getTime()) ? new Date('2000-01-01T00:00:00.000Z') : fixedDate,
            ModDate: Number.isNaN(fixedDate.getTime()) ? new Date('2000-01-01T00:00:00.000Z') : fixedDate,
        },
    });
    document.registerFont('RecordKorean', fontBytes(KOREAN_FONT_FILE));
    document.registerFont('RecordKoreanBold', fontBytes(KOREAN_BOLD_FONT_FILE));
    const output = collectPdf(document);

    let pageNo = 0;
    const addPage = () => {
        document.addPage({ size: [A4_WIDTH, A4_HEIGHT], margins: { top: TOP, bottom: BOTTOM, left: LEFT, right: RIGHT } });
        pageNo += 1;
        document.x = LEFT;
        document.y = TOP;
    };
    const ensureSpace = (height: number) => {
        if (document.y + height > CONTENT_BOTTOM) addPage();
    };
    const rule = (color = '#cbd5e1') => {
        document.save().strokeColor(color).lineWidth(0.7)
            .moveTo(LEFT, document.y).lineTo(A4_WIDTH - RIGHT, document.y).stroke().restore();
        document.moveDown(0.6);
    };
    const sectionTitle = (title: string, continued = false) => {
        ensureSpace(32);
        document.font('RecordKoreanBold').fontSize(13).fillColor('#0f4c5c')
            .text(`${pdfSafeText(title)}${continued ? ' (계속)' : ''}`, LEFT, document.y, { width: CONTENT_WIDTH });
        document.moveDown(0.45);
        rule('#7fb3bf');
    };
    const writeParagraph = (label: string, value: string, color = '#111827') => {
        let remaining = pdfSafeText(value || '-');
        let continuation = false;
        while (remaining.length > 0) {
            ensureSpace(36);
            const available = CONTENT_BOTTOM - document.y;
            document.font('RecordKoreanBold').fontSize(9).fillColor('#475569')
                .text(`${pdfSafeText(label)}${continuation ? ' (계속)' : ''}`, LEFT, document.y, { width: CONTENT_WIDTH });
            document.moveDown(0.18);
            const startY = document.y;
            let take = remaining.length;
            while (take > 1 && document.heightOfString(remaining.slice(0, take), {
                width: CONTENT_WIDTH,
                lineGap: 2,
            }) > available - 18) take = Math.max(1, Math.floor(take * 0.78));
            const fragment = remaining.slice(0, take);
            document.font('RecordKorean').fontSize(9.5).fillColor(color)
                .text(fragment, LEFT, startY, { width: CONTENT_WIDTH, lineGap: 2 });
            document.moveDown(0.45);
            remaining = remaining.slice(take);
            continuation = true;
            if (remaining) addPage();
        }
    };
    const infoRow = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) => {
        ensureSpace(36);
        const y = document.y;
        const half = CONTENT_WIDTH / 2;
        document.save().rect(LEFT, y, CONTENT_WIDTH, 30).fillAndStroke('#f8fafc', '#cbd5e1').restore();
        document.font('RecordKoreanBold').fontSize(8).fillColor('#475569')
            .text(pdfSafeText(leftLabel), LEFT + 8, y + 6, { width: 65 })
            .text(pdfSafeText(rightLabel), LEFT + half + 8, y + 6, { width: 65 });
        document.font('RecordKorean').fontSize(9).fillColor('#111827')
            .text(pdfSafeText(leftValue), LEFT + 75, y + 6, { width: half - 82, height: 18 })
            .text(pdfSafeText(rightValue), LEFT + half + 75, y + 6, { width: half - 82, height: 18 });
        document.y = y + 37;
    };

    addPage();
    document.image(getConstructionPlanBrandLogoPng(), LEFT, 88, { fit: [86, 42] });
    document.font('RecordKoreanBold').fontSize(10).fillColor('#0f4c5c')
        .text('CHEONGYEON ENG · FIELD EXECUTION RECORD', 145, 90, { width: 406, align: 'right' });
    document.font('RecordKoreanBold').fontSize(22).fillColor('#0f172a')
        .text(RECORD_TYPE_LABELS[recordType as ConstructionPlanRecordType], LEFT, 150, { width: CONTENT_WIDTH });
    document.font('RecordKorean').fontSize(10).fillColor('#475569')
        .text('발행 시공계획서와 분리된 실제 현장 실행·확인 기록', LEFT, 182, { width: CONTENT_WIDTH });
    document.y = 218;
    infoRow('현장', asText(binding.siteName), '문서번호', asText(binding.documentNo));
    infoRow('계획서', `REV.${String(binding.revision ?? 0).padStart(2, '0')} · ${planTradeLabel(binding.tradeType)}`, '발행본 SHA', asText(binding.issuedExportSha256).slice(0, 18));
    infoRow('실행일', asText(record.workDate), '적용구간', `${asText(record.building)} · ${asText(record.floor)} · ${asText(record.zone)}`);
    infoRow('기록 Rev.', `R${String(record.recordRevision ?? 0).padStart(2, '0')}`, '상태', '확인 완료');
    infoRow('확인자', asText(record.confirmedByName), '확인시각', asText(record.confirmedAt));
    document.moveDown(1);
    sectionTitle('불변 바인딩');
    writeParagraph('계획서 발행본', `${asText(binding.planId)} · ${asText(binding.issuedExportId)} · SHA-256 ${asText(binding.issuedExportSha256)}`);
    writeParagraph('실행기록', `${asText(record.id)} · catalog ${asText(record.catalogVersion)} · source ${sourceRecordHash}`);
    if (Number(record.recordRevision) > 0 && isUnknownRecord(record.correctionLineage)) {
        const lineage = record.correctionLineage;
        writeParagraph(
            '정정 계보',
            `${asText(lineage.supersedesRecordId)} · 원본 ${asText(lineage.sourceConfirmationHash)} · ${asText(lineage.actorName, asText(lineage.actorId))} · ${asText(lineage.createdAt)}`,
        );
        writeParagraph('정정 사유', asText(lineage.reason));
    }

    sectionTitle('실제 참여자·장비');
    const workers = Array.isArray(record.actualWorkers) ? record.actualWorkers : [];
    writeParagraph('실제 작업자', workers.map((worker) => isUnknownRecord(worker)
        ? [asText(worker.name), asText(worker.role, ''), worker.workerId ? `ID ${asText(worker.workerId)}` : '직접 입력'].filter(Boolean).join(' / ')
        : '-').join(' · ') || '-');
    const equipment = Array.isArray(record.actualEquipment) ? record.actualEquipment : [];
    writeParagraph('실제 장비', equipment.map((item) => isUnknownRecord(item)
        ? [asText(item.name), asText(item.model, ''), asText(item.registrationNo, ''), asText(item.operatorName, ''), item.equipmentId ? `ID ${asText(item.equipmentId)}` : '직접 입력'].filter(Boolean).join(' / ')
        : '-').join(' · ') || '해당 없음');

    const responses = (Array.isArray(record.responses) ? record.responses : []) as ConstructionPlanRecordResponse[];
    const byQuestion = new Map(responses.map((response) => [response.questionId, response]));
    sectionTitle('체크리스트 판정·조치');
    catalog.questions.forEach((question, index) => {
        const response = byQuestion.get(question.id);
        ensureSpace(54);
        const resultLabel = response?.result === 'pass' ? '적합'
            : response?.result === 'fail' ? '부적합' : '해당없음';
        const resultColor = response?.result === 'pass' ? '#166534'
            : response?.result === 'fail' ? '#b91c1c' : '#475569';
        document.font('RecordKoreanBold').fontSize(9.5).fillColor('#0f172a')
            .text(pdfSafeText(`${index + 1}. [${question.category}] ${question.text}`), LEFT, document.y, { width: CONTENT_WIDTH - 72 });
        document.font('RecordKoreanBold').fontSize(9).fillColor(resultColor)
            .text(resultLabel, A4_WIDTH - RIGHT - 64, document.y - 12, { width: 64, align: 'right' });
        document.moveDown(0.3);
        if (response?.measuredValue) writeParagraph('측정값', response.measuredValue);
        if (response?.note) writeParagraph('판정 근거', response.note, resultColor);
        if (response?.action) {
            writeParagraph(
                '조치',
                `${response.action.description} · 담당 ${response.action.owner} · 기한 ${response.action.due} · ${response.action.status === 'resolved' ? `완료 (${response.action.resolution})` : '미결'}`,
                response.action.status === 'resolved' ? '#166534' : '#b91c1c',
            );
        }
        rule('#e2e8f0');
    });

    if (photos.length) {
        photos.forEach((photo, index) => {
            addPage();
            sectionTitle(`현장사진 ${index + 1}/${photos.length}`);
            const bytes = photoBytesById.get(photo.id);
            if (!bytes || sha256Hex(bytes) !== photo.sha256) {
                throw new functions.https.HttpsError('data-loss', `현장사진 ${photo.id} SHA-256이 일치하지 않습니다.`);
            }
            const imageY = document.y;
            try {
                document.image(bytes, LEFT, imageY, { fit: [CONTENT_WIDTH, 560], align: 'center', valign: 'center' });
            } catch {
                throw new functions.https.HttpsError('data-loss', `현장사진 ${photo.id}를 PDF에 삽입할 수 없습니다.`);
            }
            document.y = imageY + 570;
            writeParagraph('캡션', photo.caption);
            writeParagraph('촬영정보', `${photo.takenAt} · ${photo.zone} · SHA-256 ${photo.sha256}`);
        });
    }

    sectionTitle('확인 선언');
    writeParagraph('확인자', `${asText(record.confirmedByName)} · ${asText(record.confirmedAt)}`);
    writeParagraph('확인내용', '본 기록은 계획서의 빈 양식이나 승인상태를 자동 합격으로 간주하지 않고, 해당 일자·구간의 실제 점검결과와 조치를 별도로 확인한 기록입니다.');

    const range = document.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        document.switchToPage(index);
        document.save();
        document.strokeColor('#0f4c5c').lineWidth(1).moveTo(LEFT, 64).lineTo(A4_WIDTH - RIGHT, 64).stroke();
        document.font('RecordKoreanBold').fontSize(8).fillColor('#0f4c5c')
            .text('청연이엔지 · 시공계획서 현장 실행기록', LEFT, 45, {
                width: CONTENT_WIDTH - 120,
                height: 12,
                lineBreak: false,
            });
        document.font('RecordKorean').fontSize(7.5).fillColor('#64748b')
            .text(`${asText(binding.documentNo)} · Record R${String(record.recordRevision ?? 0).padStart(2, '0')}`, LEFT, A4_HEIGHT - 45, {
                width: CONTENT_WIDTH - 120,
                height: 12,
                lineBreak: false,
            });
        document.text(`${index + 1} / ${range.count}`, A4_WIDTH - RIGHT - 100, A4_HEIGHT - 45, {
            width: 100,
            height: 12,
            align: 'right',
            lineBreak: false,
        });
        document.restore();
    }
    document.end();
    const bytes = await output;
    if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-'
        || bytes.length > MAX_PDF_BYTES) {
        throw new functions.https.HttpsError('internal', '실행기록 부록 PDF 바이트가 올바르지 않습니다.');
    }
    const sha256 = sha256Hex(bytes);
    const fileName = `${sanitizeConstructionPlanStorageSegment(asText(binding.documentNo), 'construction-plan')}_record_R${String(record.recordRevision ?? 0).padStart(2, '0')}_${recordType}.pdf`;
    return {
        bytes,
        sha256,
        sizeBytes: bytes.length,
        pageCount: range.count,
        fileName,
        rendererVersion: CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION,
        rendererBuildHash,
        sourceRecordHash,
        renderInputHash,
    };
};

const storagePathForArtifact = (
    record: UnknownRecord,
    artifact: ExecutionRecordPdfArtifact,
): string => {
    const binding = planBinding(record);
    return [
        'construction-plan-records',
        sanitizeConstructionPlanStorageSegment(asText(binding.siteId), 'unknown-site'),
        sanitizeConstructionPlanStorageSegment(asText(binding.planId), 'unknown-plan'),
        sanitizeConstructionPlanStorageSegment(asText(record.id), 'unknown-record'),
        'appendices',
        `rev-${String(record.recordRevision ?? 0).padStart(2, '0')}`,
        artifact.sourceRecordHash,
        `${artifact.sha256}.pdf`,
    ].join('/');
};

const preconditionFailure = (error: unknown): boolean => isUnknownRecord(error)
    && [409, 412, '409', '412'].includes(error.code as string | number);

export const storeImmutableExecutionRecordPdf = async (
    bucket: StorageBucket,
    record: UnknownRecord,
    artifact: ExecutionRecordPdfArtifact,
): Promise<StoredExecutionRecordPdfArtifact> => {
    if (sha256Hex(artifact.bytes) !== artifact.sha256 || artifact.sizeBytes !== artifact.bytes.length) {
        throw new TypeError('execution-record-pdf-envelope-invalid');
    }
    const binding = planBinding(record);
    const storagePath = storagePathForArtifact(record, artifact);
    const metadata: Record<string, string> = {
        artifactClass: 'construction-plan-execution-record-appendix',
        recordId: asText(record.id),
        rootRecordId: asText(record.rootRecordId),
        recordRevision: String(record.recordRevision ?? 0),
        planId: asText(binding.planId),
        siteId: asText(binding.siteId),
        issuedExportId: asText(binding.issuedExportId),
        issuedExportSha256: asText(binding.issuedExportSha256),
        sourceRecordHash: artifact.sourceRecordHash,
        renderInputHash: artifact.renderInputHash,
        rendererVersion: artifact.rendererVersion,
        rendererBuildHash: artifact.rendererBuildHash,
        sha256: artifact.sha256,
        sizeBytes: String(artifact.sizeBytes),
        pageCount: String(artifact.pageCount),
        fileName: artifact.fileName,
    };
    const file = bucket.file(storagePath);
    try {
        await file.save(artifact.bytes, {
            resumable: false,
            contentType: 'application/pdf',
            metadata: { contentType: 'application/pdf', cacheControl: 'private,max-age=31536000,immutable', metadata },
            preconditionOpts: { ifGenerationMatch: 0 },
        });
    } catch (error) {
        if (!preconditionFailure(error)) throw error;
    }
    const [[storedBytes], [storedMetadata]] = await Promise.all([file.download(), file.getMetadata()]);
    const custom = isUnknownRecord(storedMetadata.metadata) ? storedMetadata.metadata : {};
    if (sha256Hex(storedBytes) !== artifact.sha256
        || storedBytes.length !== artifact.sizeBytes
        || storedMetadata.contentType !== 'application/pdf'
        || Object.keys(custom).sort().join('|') !== Object.keys(metadata).sort().join('|')
        || Object.entries(metadata).some(([key, value]) => custom[key] !== value)) {
        throw new functions.https.HttpsError('data-loss', '실행기록 부록 PDF 불변 객체가 손상되었습니다.');
    }
    const generation = String(storedMetadata.generation || '');
    if (!/^\d+$/.test(generation)) throw new functions.https.HttpsError('data-loss', '부록 PDF generation이 없습니다.');
    return {
        storagePath,
        storageGeneration: generation,
        sha256: artifact.sha256,
        sizeBytes: artifact.sizeBytes,
        pageCount: artifact.pageCount,
        fileName: artifact.fileName,
        rendererVersion: artifact.rendererVersion,
        rendererBuildHash: artifact.rendererBuildHash,
        sourceRecordHash: artifact.sourceRecordHash,
        renderInputHash: artifact.renderInputHash,
    };
};
