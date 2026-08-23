import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { PDFParse } from 'pdf-parse';
import {
    canonicalStringify,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';

export const CONSTRUCTION_PLAN_DRAWING_PREVIEW_SCHEMA_VERSION = 1;
export const MAX_CONSTRUCTION_PLAN_DRAWING_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_CONSTRUCTION_PLAN_DRAWING_PAGES = 50;
export const CONSTRUCTION_PLAN_DRAWING_PREVIEW_MAX_RASTER_DIMENSION = 2400;

const PLANS_COLLECTION = 'constructionPlans';
const MANIFESTS_COLLECTION = 'drawingPreviewManifests';
const SAFE_DRAWING_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,158}[A-Za-z0-9])?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const GENERATION_PATTERN = /^\d+$/;
const PDF_MIME_TYPE = 'application/pdf';
const PNG_MIME_TYPE = 'image/png';
const PREVIEW_ARTIFACT_CLASS = 'construction-plan-drawing-preview';
const SOURCE_ARTIFACT_CLASS = 'construction-plan-drawing-source';

type StorageBucket = ReturnType<ReturnType<typeof admin.storage>['bucket']>;

export type DrawingPreviewStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface PdfBox {
    left: number;
    bottom: number;
    right: number;
    top: number;
}

export interface ConstructionPlanDrawingPreviewPage {
    pageIndex: number;
    mediaBoxPt: PdfBox;
    cropBoxPt: PdfBox;
    rotation: 0 | 90 | 180 | 270;
    pageFingerprint: string;
    previewPath: string;
    previewGeneration: string;
    previewSha256: string;
}

export interface EnsureConstructionPlanDrawingPreviewRequest {
    planId: string;
    drawingId: string;
    expectedSourceStoragePath: string;
    expectedSourceSha256: string;
    expectedSourceGeneration: string;
    requestedPageIndexes?: number[];
    idempotencyKey: string;
}

export interface ConstructionPlanDrawingPreviewResult {
    siteId: string;
    planId: string;
    drawingId: string;
    sourceStoragePath: string;
    sourceSha256: string;
    sourceGeneration: string;
    previewStatus: DrawingPreviewStatus;
    pageCount: number;
    pages: ConstructionPlanDrawingPreviewPage[];
    previewPaths: string[];
    errorCode?: string;
    errorMessage?: string;
    processedAt: string;
    idempotent: boolean;
}

export interface EnsureConstructionPlanDrawingPreviewOptions {
    database: admin.firestore.Firestore;
    storageBucket: StorageBucket;
    actorId: string;
    request: EnsureConstructionPlanDrawingPreviewRequest;
    now?: () => Date;
    /** Re-run caller authorization/status/edit-lock checks in every transaction. */
    assertPlanMutationAllowed?: (plan: UnknownRecord) => void;
}

export interface VerifyConstructionPlanDrawingPreviewsOptions {
    database: admin.firestore.Firestore;
    storageBucket: StorageBucket;
    planId: string;
    plan: UnknownRecord;
}

export interface AuthoritativeDrawingPreviewVerification {
    bindingHash: string;
    pdfDrawingCount: number;
    imageDrawingCount: number;
}

export interface DrawingPreviewMutationActor {
    uid: string;
    isCentral: boolean;
}

interface DrawingBinding {
    siteId: string;
    drawing: UnknownRecord;
    drawingIndex: number;
    pageCount: number;
}

interface PdfJsPageProxy {
    view?: unknown;
    rotate?: unknown;
    getViewport?: (parameters: { scale: number }) => { width: number; height: number };
    cleanup?: () => void;
}

interface PdfJsDocumentProxy {
    getPage: (pageNumber: number) => Promise<PdfJsPageProxy>;
}

interface RenderedPage {
    pageIndex: number;
    mediaBoxPt: PdfBox;
    cropBoxPt: PdfBox;
    rotation: 0 | 90 | 180 | 270;
    png: Buffer;
}

class DrawingPreviewProcessingError extends Error {
    readonly errorCode: string;

    constructor(errorCode: string, message: string) {
        super(message);
        this.name = 'DrawingPreviewProcessingError';
        this.errorCode = errorCode;
    }
}

const invalidArgument = (message: string): never => {
    throw new functions.https.HttpsError('invalid-argument', message);
};

const failedPrecondition = (message: string, details?: unknown): never => {
    throw new functions.https.HttpsError('failed-precondition', message, details);
};

const dataLoss = (message: string, details?: unknown): never => {
    throw new functions.https.HttpsError('data-loss', message, details);
};

const normalizedSha256 = (value: string): string => value.trim().toLowerCase();

const recordStringList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(recordStringList);
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
};

export const assertConstructionPlanDrawingPreviewMutationPolicy = (
    plan: UnknownRecord,
    actor: DrawingPreviewMutationActor,
    nowMillis = Date.now(),
): void => {
    const status = readTrimmedString(plan, ['status']);
    if (status !== 'draft' && status !== 'changes_requested') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '도면 미리보기는 초안 또는 변경 요청 상태에서만 생성할 수 있습니다.',
        );
    }
    const participants = isUnknownRecord(plan.participants) ? plan.participants : {};
    const isAuthor = plan.createdBy === actor.uid
        || recordStringList(participants.authorIds).includes(actor.uid);
    if (!actor.isCentral && !isAuthor) {
        throw new functions.https.HttpsError(
            'permission-denied',
            '계획서 작성자 또는 본사 권한만 도면 미리보기를 생성할 수 있습니다.',
        );
    }
    if (isUnknownRecord(plan.editLock)) {
        const lockOwner = readTrimmedString(plan.editLock, ['userId']);
        const expiresAtEpochMs = Number(plan.editLock.expiresAtEpochMs);
        if (lockOwner && Number.isFinite(expiresAtEpochMs)
            && expiresAtEpochMs > nowMillis && lockOwner !== actor.uid) {
            throw new functions.https.HttpsError(
                'aborted',
                '다른 사용자가 편집 잠금을 보유하고 있습니다. 잠금 갱신 후 다시 시도해주세요.',
            );
        }
    }
};

const requireBoundedString = (
    record: UnknownRecord,
    key: string,
    maxLength: number,
): string => {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        invalidArgument(`${key} 값이 올바르지 않습니다.`);
    }
    return (value as string).trim();
};

const requireDocumentId = (record: UnknownRecord, key: string): string => {
    const value = requireBoundedString(record, key, 200);
    if (value.includes('/') || value === '.' || value === '..') {
        invalidArgument(`${key} 문서 ID가 올바르지 않습니다.`);
    }
    return value;
};

const assertOnlyKnownRequestFields = (record: UnknownRecord): void => {
    // Zod's default object behavior strips unknown keys on the client. The
    // server ignores unknown callable keys too, but explicitly enumerating the
    // contract here keeps the parsed value exact and prevents persistence.
    const known = new Set([
        'planId', 'drawingId', 'expectedSourceStoragePath', 'expectedSourceSha256',
        'expectedSourceGeneration', 'requestedPageIndexes', 'idempotencyKey',
    ]);
    Object.keys(record).forEach((key) => {
        if (!known.has(key)) delete record[key];
    });
};

export const parseEnsureConstructionPlanDrawingPreviewRequest = (
    value: unknown,
): EnsureConstructionPlanDrawingPreviewRequest => {
    if (!isUnknownRecord(value)) invalidArgument('요청 본문이 올바르지 않습니다.');
    const record = { ...(value as UnknownRecord) };
    assertOnlyKnownRequestFields(record);
    const planId = requireDocumentId(record, 'planId');
    const drawingId = requireBoundedString(record, 'drawingId', 160);
    if (!SAFE_DRAWING_ID_PATTERN.test(drawingId)) {
        invalidArgument('drawingId는 충돌 없는 영문자·숫자·하이픈·밑줄 형식이어야 합니다.');
    }
    const expectedSourceStoragePath = requireBoundedString(record, 'expectedSourceStoragePath', 1024);
    const expectedSourceSha256 = normalizedSha256(requireBoundedString(record, 'expectedSourceSha256', 64));
    if (!SHA256_PATTERN.test(expectedSourceSha256)) invalidArgument('expectedSourceSha256 값이 올바르지 않습니다.');
    const expectedSourceGeneration = requireBoundedString(record, 'expectedSourceGeneration', 200);
    if (!GENERATION_PATTERN.test(expectedSourceGeneration)) {
        invalidArgument('expectedSourceGeneration 값이 올바르지 않습니다.');
    }
    const idempotencyKey = requireBoundedString(record, 'idempotencyKey', 128);
    let requestedPageIndexes: number[] | undefined;
    if (record.requestedPageIndexes !== undefined) {
        if (!Array.isArray(record.requestedPageIndexes)
            || record.requestedPageIndexes.length < 1
            || record.requestedPageIndexes.length > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES
            || record.requestedPageIndexes.some((index) => (
                !Number.isInteger(index)
                || Number(index) < 0
                || Number(index) >= MAX_CONSTRUCTION_PLAN_DRAWING_PAGES
            ))) {
            invalidArgument('requestedPageIndexes 값이 올바르지 않습니다.');
        }
        requestedPageIndexes = (record.requestedPageIndexes as unknown[]).map(Number);
        if (new Set(requestedPageIndexes).size !== requestedPageIndexes.length) {
            invalidArgument('requestedPageIndexes에 중복 페이지가 있습니다.');
        }
    }
    return {
        planId,
        drawingId,
        expectedSourceStoragePath,
        expectedSourceSha256,
        expectedSourceGeneration,
        ...(requestedPageIndexes ? { requestedPageIndexes } : {}),
        idempotencyKey,
    };
};

export const canonicalConstructionPlanDrawingPageFingerprint = (
    sourceSha256: string,
    pageIndex: number,
): string => {
    if (!SHA256_PATTERN.test(sourceSha256.trim()) || !Number.isInteger(pageIndex) || pageIndex < 0) {
        throw new Error('construction-plan-drawing-preview-invalid-fingerprint-input');
    }
    return `source:${normalizedSha256(sourceSha256)}:page:${pageIndex}`;
};

export const canonicalConstructionPlanDrawingPreviewPath = (
    siteId: string,
    planId: string,
    drawingId: string,
    sourceSha256: string,
    pageIndex: number,
): string => {
    if (!siteId || siteId.includes('/') || !planId || planId.includes('/')
        || !SAFE_DRAWING_ID_PATTERN.test(drawingId)
        || !SHA256_PATTERN.test(sourceSha256.trim())
        || !Number.isInteger(pageIndex)
        || pageIndex < 0
        || pageIndex >= MAX_CONSTRUCTION_PLAN_DRAWING_PAGES) {
        throw new Error('construction-plan-drawing-preview-invalid-path-input');
    }
    return [
        'construction-plans',
        siteId,
        planId,
        'previews',
        drawingId,
        normalizedSha256(sourceSha256),
        `page-${String(pageIndex + 1).padStart(4, '0')}.png`,
    ].join('/');
};

export const normalizePdfPageRotation = (value: unknown): 0 | 90 | 180 | 270 => {
    if (value === undefined) return 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
        throw new DrawingPreviewProcessingError('PDF_PAGE_ROTATION_INVALID', 'PDF 페이지 rotation 값이 올바르지 않습니다.');
    }
    const normalized = ((value % 360) + 360) % 360;
    if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
        throw new DrawingPreviewProcessingError('PDF_PAGE_ROTATION_INVALID', 'PDF 페이지 rotation 값이 90도 단위가 아닙니다.');
    }
    return normalized;
};

export const pdfBoxFromView = (value: unknown): PdfBox => {
    if (!Array.isArray(value) || value.length < 4) {
        throw new DrawingPreviewProcessingError('PDF_PAGE_GEOMETRY_INVALID', 'PDF 페이지 CropBox를 확인할 수 없습니다.');
    }
    const coordinates = value.slice(0, 4).map(Number);
    if (coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
        throw new DrawingPreviewProcessingError('PDF_PAGE_GEOMETRY_INVALID', 'PDF 페이지 CropBox 좌표가 올바르지 않습니다.');
    }
    const left = Math.min(coordinates[0], coordinates[2]);
    const right = Math.max(coordinates[0], coordinates[2]);
    const bottom = Math.min(coordinates[1], coordinates[3]);
    const top = Math.max(coordinates[1], coordinates[3]);
    if (right <= left || top <= bottom) {
        throw new DrawingPreviewProcessingError('PDF_PAGE_GEOMETRY_INVALID', 'PDF 페이지 CropBox 크기가 올바르지 않습니다.');
    }
    return { left, bottom, right, top };
};

const parseBox = (value: unknown, field: string): PdfBox => {
    if (!isUnknownRecord(value)) dataLoss(`${field} 값이 없습니다.`);
    const record = value as UnknownRecord;
    if (typeof record.left !== 'number' || typeof record.bottom !== 'number'
        || typeof record.right !== 'number' || typeof record.top !== 'number') {
        dataLoss(`${field} 좌표 형식이 손상되었습니다.`);
    }
    const box = {
        left: record.left as number,
        bottom: record.bottom as number,
        right: record.right as number,
        top: record.top as number,
    };
    if (Object.values(box).some((coordinate) => !Number.isFinite(coordinate))
        || box.right <= box.left || box.top <= box.bottom) {
        dataLoss(`${field} 값이 손상되었습니다.`);
    }
    return box;
};

const parseResultString = (
    record: UnknownRecord,
    key: string,
    maxLength: number,
): string => {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        dataLoss(`도면 미리보기 manifest의 ${key} 값이 손상되었습니다.`);
    }
    return (value as string).trim();
};

export const parseConstructionPlanDrawingPreviewResult = (
    value: unknown,
): ConstructionPlanDrawingPreviewResult => {
    if (!isUnknownRecord(value)) dataLoss('도면 미리보기 manifest가 손상되었습니다.');
    const record = value as UnknownRecord;
    const siteId = parseResultString(record, 'siteId', 200);
    const planId = parseResultString(record, 'planId', 200);
    const drawingId = parseResultString(record, 'drawingId', 160);
    if (!SAFE_DRAWING_ID_PATTERN.test(drawingId)) dataLoss('도면 미리보기 drawingId가 손상되었습니다.');
    const sourceStoragePath = parseResultString(record, 'sourceStoragePath', 1024);
    const sourceSha256 = normalizedSha256(parseResultString(record, 'sourceSha256', 64));
    if (!SHA256_PATTERN.test(sourceSha256)) dataLoss('도면 미리보기 sourceSha256이 손상되었습니다.');
    const sourceGeneration = parseResultString(record, 'sourceGeneration', 200);
    if (!GENERATION_PATTERN.test(sourceGeneration)) dataLoss('도면 미리보기 sourceGeneration이 손상되었습니다.');
    const previewStatus = record.previewStatus;
    if (previewStatus !== 'pending' && previewStatus !== 'processing'
        && previewStatus !== 'ready' && previewStatus !== 'failed') {
        dataLoss('도면 미리보기 상태가 손상되었습니다.');
    }
    const pageCount = record.pageCount;
    if (typeof pageCount !== 'number' || !Number.isInteger(pageCount)
        || pageCount < 1 || pageCount > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES) {
        dataLoss('도면 미리보기 pageCount가 손상되었습니다.');
    }
    if (!Array.isArray(record.pages) || record.pages.length > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES
        || !Array.isArray(record.previewPaths) || record.previewPaths.length > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES) {
        dataLoss('도면 미리보기 페이지 목록이 손상되었습니다.');
    }
    const pages = (record.pages as unknown[]).map((rawPage, index): ConstructionPlanDrawingPreviewPage => {
        if (!isUnknownRecord(rawPage)) dataLoss(`도면 미리보기 ${index + 1}페이지 정보가 손상되었습니다.`);
        const pageRecord = rawPage as UnknownRecord;
        const pageIndex = pageRecord.pageIndex;
        if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex)
            || pageIndex < 0 || pageIndex >= (pageCount as number)) {
            dataLoss('도면 미리보기 pageIndex가 손상되었습니다.');
        }
        const rotation = pageRecord.rotation;
        if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) {
            dataLoss('도면 미리보기 rotation이 손상되었습니다.');
        }
        const pageFingerprint = parseResultString(pageRecord, 'pageFingerprint', 200);
        const previewPath = parseResultString(pageRecord, 'previewPath', 1024);
        const previewGeneration = parseResultString(pageRecord, 'previewGeneration', 200);
        if (!GENERATION_PATTERN.test(previewGeneration)) dataLoss('도면 미리보기 generation이 손상되었습니다.');
        const previewSha256 = normalizedSha256(parseResultString(pageRecord, 'previewSha256', 64));
        if (!SHA256_PATTERN.test(previewSha256)) dataLoss('도면 미리보기 SHA-256이 손상되었습니다.');
        return {
            pageIndex: pageIndex as number,
            mediaBoxPt: parseBox(pageRecord.mediaBoxPt, 'mediaBoxPt'),
            cropBoxPt: parseBox(pageRecord.cropBoxPt, 'cropBoxPt'),
            rotation: rotation as 0 | 90 | 180 | 270,
            pageFingerprint,
            previewPath,
            previewGeneration,
            previewSha256,
        };
    }).sort((left, right) => left.pageIndex - right.pageIndex);
    const previewPaths = (record.previewPaths as unknown[]).map((path) => {
        if (typeof path !== 'string' || !path.trim() || path.trim().length > 1024) {
            dataLoss('도면 미리보기 경로 목록이 손상되었습니다.');
        }
        return (path as string).trim();
    });
    const processedAt = parseResultString(record, 'processedAt', 100);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(processedAt)
        || !Number.isFinite(Date.parse(processedAt))) {
        dataLoss('도면 미리보기 처리 시간이 손상되었습니다.');
    }
    if (typeof record.idempotent !== 'boolean') dataLoss('도면 미리보기 멱등성 값이 손상되었습니다.');

    const indexes = pages.map((page) => page.pageIndex);
    if (new Set(indexes).size !== indexes.length
        || new Set(pages.map((page) => page.previewPath)).size !== pages.length) {
        dataLoss('도면 미리보기 페이지 또는 경로가 중복되었습니다.');
    }
    pages.forEach((page) => {
        if (page.pageFingerprint !== canonicalConstructionPlanDrawingPageFingerprint(sourceSha256, page.pageIndex)
            || page.previewPath !== canonicalConstructionPlanDrawingPreviewPath(
                siteId, planId, drawingId, sourceSha256, page.pageIndex,
            )) {
            dataLoss('도면 미리보기 페이지 바인딩이 손상되었습니다.');
        }
    });
    if (!sourceStoragePath.startsWith(`construction-plans/${siteId}/${planId}/drawings/`)) {
        dataLoss('도면 미리보기 원본 경로 바인딩이 손상되었습니다.');
    }
    if (previewStatus === 'ready') {
        if (pages.length !== pageCount
            || pages.some((page, index) => page.pageIndex !== index)
            || previewPaths.length !== pages.length
            || previewPaths.some((path, index) => path !== pages[index].previewPath)) {
            dataLoss('READY 미리보기에는 모든 물리 페이지의 정확한 경로가 필요합니다.');
        }
    } else if (pages.length > 0 || previewPaths.length > 0) {
        dataLoss('READY가 아닌 미리보기에는 페이지 산출물을 기록할 수 없습니다.');
    }
    if (typeof record.errorCode === 'string' && record.errorCode.trim().length > 120) {
        dataLoss('도면 미리보기 errorCode가 허용 길이를 초과했습니다.');
    }
    if (typeof record.errorMessage === 'string' && record.errorMessage.trim().length > 500) {
        dataLoss('도면 미리보기 errorMessage가 허용 길이를 초과했습니다.');
    }
    const errorCode = typeof record.errorCode === 'string' && record.errorCode.trim()
        ? record.errorCode.trim()
        : undefined;
    const errorMessage = typeof record.errorMessage === 'string' && record.errorMessage.trim()
        ? record.errorMessage.trim()
        : undefined;
    if (previewStatus === 'failed' && !errorCode) dataLoss('FAILED 미리보기에는 errorCode가 필요합니다.');
    return {
        siteId,
        planId,
        drawingId,
        sourceStoragePath,
        sourceSha256,
        sourceGeneration,
        previewStatus: previewStatus as DrawingPreviewStatus,
        pageCount: pageCount as number,
        pages,
        previewPaths,
        ...(errorCode ? { errorCode } : {}),
        ...(errorMessage ? { errorMessage } : {}),
        processedAt,
        idempotent: record.idempotent as boolean,
    };
};

const boundedPageCount = (drawing: UnknownRecord): number => {
    const value = drawing.pageCount;
    if (typeof value !== 'number' || !Number.isInteger(value)
        || value < 1 || value > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES) {
        failedPrecondition('도면 pageCount가 올바르지 않습니다.');
    }
    return value as number;
};

const requireSiteId = (plan: UnknownRecord): string => {
    const siteId = readTrimmedString(plan, ['siteId']);
    if (!siteId || siteId.length > 200 || siteId.includes('/') || siteId === '.' || siteId === '..') {
        failedPrecondition('계획서의 siteId가 미리보기 Storage 경로에 사용할 수 없습니다.');
    }
    return siteId;
};

const findDrawingBinding = (
    plan: UnknownRecord,
    request: EnsureConstructionPlanDrawingPreviewRequest,
): DrawingBinding => {
    const siteId = requireSiteId(plan);
    if (!Array.isArray(plan.drawings)) failedPrecondition('계획서에 도면 목록이 없습니다.');
    const matches = (plan.drawings as unknown[]).flatMap((candidate, drawingIndex) => (
        isUnknownRecord(candidate) && readTrimmedString(candidate, ['id']) === request.drawingId
            ? [{ drawing: candidate, drawingIndex }]
            : []
    ));
    if (matches.length !== 1) failedPrecondition('요청한 도면을 계획서에서 고유하게 찾을 수 없습니다.');
    const { drawing, drawingIndex } = matches[0];
    if (readTrimmedString(drawing, ['planId']) !== request.planId
        || readTrimmedString(drawing, ['storagePath']) !== request.expectedSourceStoragePath
        || normalizedSha256(readTrimmedString(drawing, ['sourceSha256']) || '') !== request.expectedSourceSha256
        || readTrimmedString(drawing, ['sourceGeneration']) !== request.expectedSourceGeneration) {
        throw new functions.https.HttpsError('aborted', '도면 원본이 변경되었습니다. 새로고침 후 다시 요청해주세요.');
    }
    if (readTrimmedString(drawing, ['mimeType']) !== PDF_MIME_TYPE) {
        invalidArgument('PDF 도면만 서버 미리보기로 변환할 수 있습니다.');
    }
    if (!request.expectedSourceStoragePath.startsWith(
        `construction-plans/${siteId}/${request.planId}/drawings/`,
    )) {
        failedPrecondition('도면 원본 Storage 경로가 계획서 범위와 일치하지 않습니다.');
    }
    return { siteId, drawing, drawingIndex, pageCount: boundedPageCount(drawing) };
};

const replaceDrawing = (
    plan: UnknownRecord,
    drawingIndex: number,
    drawing: UnknownRecord,
): UnknownRecord[] => {
    if (!Array.isArray(plan.drawings)) failedPrecondition('계획서 도면 목록이 손상되었습니다.');
    return (plan.drawings as unknown[]).map(
        (candidate, index) => index === drawingIndex ? drawing : candidate,
    ) as UnknownRecord[];
};

const withoutPreviewErrors = (drawing: UnknownRecord): UnknownRecord => {
    const next = { ...drawing };
    delete next.previewErrorCode;
    delete next.previewErrorMessage;
    return next;
};

export const projectDrawingPreviewResultToEmbeddedCache = (
    drawing: UnknownRecord,
    result: ConstructionPlanDrawingPreviewResult,
): UnknownRecord => {
    if (readTrimmedString(drawing, ['id']) !== result.drawingId
        || readTrimmedString(drawing, ['planId']) !== result.planId
        || readTrimmedString(drawing, ['storagePath']) !== result.sourceStoragePath
        || normalizedSha256(readTrimmedString(drawing, ['sourceSha256']) || '') !== result.sourceSha256
        || readTrimmedString(drawing, ['sourceGeneration']) !== result.sourceGeneration) {
        throw new Error('construction-plan-drawing-preview-stale-source');
    }
    const base = withoutPreviewErrors(drawing);
    const next: UnknownRecord = {
        ...base,
        pageCount: result.pageCount,
        previewStatus: result.previewStatus,
        previewPaths: result.previewStatus === 'ready' ? result.previewPaths : [],
        pages: result.previewStatus === 'ready' ? result.pages : [],
        previewUpdatedAt: result.processedAt,
    };
    if (result.previewStatus === 'failed') {
        next.previewErrorCode = result.errorCode;
        if (result.errorMessage) next.previewErrorMessage = result.errorMessage;
    }
    return next;
};

const requestFingerprint = (
    _actorId: string,
    request: EnsureConstructionPlanDrawingPreviewRequest,
): string => sha256Hex(canonicalStringify(request));

const manifestRecord = (
    result: ConstructionPlanDrawingPreviewResult,
    actorId: string,
    request: EnsureConstructionPlanDrawingPreviewRequest,
): UnknownRecord => ({
    ...result,
    idempotent: false,
    schemaVersion: CONSTRUCTION_PLAN_DRAWING_PREVIEW_SCHEMA_VERSION,
    authority: 'server',
    sourceMimeType: PDF_MIME_TYPE,
    requestedBy: actorId,
    idempotencyKey: request.idempotencyKey,
    requestFingerprint: requestFingerprint(actorId, request),
    updatedAt: result.processedAt,
});

const processingResult = (
    binding: DrawingBinding,
    request: EnsureConstructionPlanDrawingPreviewRequest,
    processedAt: string,
): ConstructionPlanDrawingPreviewResult => ({
    siteId: binding.siteId,
    planId: request.planId,
    drawingId: request.drawingId,
    sourceStoragePath: request.expectedSourceStoragePath,
    sourceSha256: request.expectedSourceSha256,
    sourceGeneration: request.expectedSourceGeneration,
    previewStatus: 'processing',
    pageCount: binding.pageCount,
    pages: [],
    previewPaths: [],
    processedAt,
    idempotent: false,
});

const sameSourceBinding = (
    result: ConstructionPlanDrawingPreviewResult,
    request: EnsureConstructionPlanDrawingPreviewRequest,
): boolean => result.planId === request.planId
    && result.drawingId === request.drawingId
    && result.sourceStoragePath === request.expectedSourceStoragePath
    && result.sourceSha256 === request.expectedSourceSha256
    && result.sourceGeneration === request.expectedSourceGeneration;

const claimProcessing = async (
    options: EnsureConstructionPlanDrawingPreviewOptions,
    forceReadyRepair = false,
): Promise<ConstructionPlanDrawingPreviewResult | null> => {
    const { database, actorId, request } = options;
    const planRef = database.collection(PLANS_COLLECTION).doc(request.planId);
    const manifestRef = planRef.collection(MANIFESTS_COLLECTION).doc(request.drawingId);
    const processedAt = (options.now?.() ?? new Date()).toISOString();
    return database.runTransaction(async (transaction) => {
        const [planSnapshot, manifestSnapshot] = await Promise.all([
            transaction.get(planRef),
            transaction.get(manifestRef),
        ]);
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const plan = planSnapshot.data() as UnknownRecord;
        options.assertPlanMutationAllowed?.(plan);
        const binding = findDrawingBinding(plan, request);
        if (manifestSnapshot.exists && isUnknownRecord(manifestSnapshot.data())) {
            const manifest = manifestSnapshot.data() as UnknownRecord;
            const storedKey = readTrimmedString(manifest, ['idempotencyKey']);
            const storedFingerprint = readTrimmedString(manifest, ['requestFingerprint']);
            if (storedKey === request.idempotencyKey
                && storedFingerprint
                && storedFingerprint !== requestFingerprint(actorId, request)) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    '같은 idempotencyKey가 다른 도면 미리보기 요청에 사용되었습니다.',
                );
            }
            try {
                if (manifest.authority !== 'server'
                    || manifest.schemaVersion !== CONSTRUCTION_PLAN_DRAWING_PREVIEW_SCHEMA_VERSION) {
                    throw new Error('drawing-preview-manifest-authority-invalid');
                }
                const ready = parseConstructionPlanDrawingPreviewResult(manifest);
                if (!forceReadyRepair && ready.previewStatus === 'ready' && sameSourceBinding(ready, request)) {
                    return ready;
                }
            } catch (_error) {
                // A corrupt/stale manifest is replaced only after the current
                // immutable source binding has been proven above.
            }
        }
        const processing = processingResult(binding, request, processedAt);
        transaction.set(manifestRef, manifestRecord(processing, actorId, request));
        transaction.update(planRef, {
            drawings: replaceDrawing(
                plan,
                binding.drawingIndex,
                projectDrawingPreviewResultToEmbeddedCache(binding.drawing, processing),
            ),
            drawingPreviewManifestUpdatedAt: processedAt,
        });
        return null;
    });
};

const preconditionError = (error: unknown): boolean => isUnknownRecord(error)
    && (error.code === 409 || error.code === 412 || error.code === '409' || error.code === '412');

const customMetadata = (metadata: UnknownRecord): UnknownRecord => (
    isUnknownRecord(metadata.metadata) ? metadata.metadata : {}
);

const readObject = async (
    storageBucket: StorageBucket,
    storagePath: string,
): Promise<{ bytes: Buffer; metadata: UnknownRecord }> => {
    const file = storageBucket.file(storagePath);
    const [[rawMetadata], [bytes]] = await Promise.all([file.getMetadata(), file.download()]);
    return { bytes, metadata: rawMetadata as unknown as UnknownRecord };
};

const verifySourceObject = async (
    storageBucket: StorageBucket,
    request: EnsureConstructionPlanDrawingPreviewRequest,
    drawing: UnknownRecord,
): Promise<Buffer> => {
    let object: { bytes: Buffer; metadata: UnknownRecord };
    try {
        object = await readObject(storageBucket, request.expectedSourceStoragePath);
    } catch (error) {
        functions.logger.warn('[constructionPlans] Drawing source read failed.', {
            planId: request.planId,
            drawingId: request.drawingId,
            error,
        });
        throw new DrawingPreviewProcessingError('SOURCE_NOT_FOUND', '도면 원본 PDF를 Storage에서 찾을 수 없습니다.');
    }
    const generation = String(object.metadata.generation || '');
    if (generation !== request.expectedSourceGeneration) {
        throw new DrawingPreviewProcessingError('SOURCE_GENERATION_MISMATCH', '도면 원본 Storage generation이 변경되었습니다.');
    }
    if (object.metadata.contentType !== PDF_MIME_TYPE) {
        throw new DrawingPreviewProcessingError('SOURCE_MIME_MISMATCH', '도면 원본의 Storage MIME 형식이 PDF가 아닙니다.');
    }
    const size = Number(object.metadata.size);
    const declaredDrawingSize = drawing.sizeBytes;
    if (!Number.isInteger(size) || size < 1 || size > MAX_CONSTRUCTION_PLAN_DRAWING_PDF_BYTES
        || object.bytes.length !== size
        || typeof declaredDrawingSize !== 'number'
        || !Number.isInteger(declaredDrawingSize)
        || declaredDrawingSize !== size) {
        throw new DrawingPreviewProcessingError('SOURCE_SIZE_MISMATCH', '도면 원본 크기 또는 Storage 메타데이터가 일치하지 않습니다.');
    }
    if (sha256Hex(object.bytes) !== request.expectedSourceSha256) {
        throw new DrawingPreviewProcessingError('SOURCE_SHA256_MISMATCH', '도면 원본 SHA-256이 계획서와 일치하지 않습니다.');
    }
    assertConstructionPlanDrawingPdfMagicHeader(object.bytes);
    return object.bytes;
};

export const assertConstructionPlanDrawingPdfMagicHeader = (bytes: Buffer): void => {
    if (!bytes.subarray(0, Math.min(bytes.length, 1024)).includes(Buffer.from('%PDF-', 'ascii'))) {
        throw new DrawingPreviewProcessingError('SOURCE_PDF_MAGIC_MISMATCH', '도면 원본에 PDF magic header가 없습니다.');
    }
};

export const assertConstructionPlanDrawingSourceMagic = (mimeType: string, bytes: Buffer): void => {
    if (mimeType === PDF_MIME_TYPE) {
        assertConstructionPlanDrawingPdfMagicHeader(bytes);
        return;
    }
    if (mimeType === 'image/png') {
        if (!isPng(bytes)) {
            throw new DrawingPreviewProcessingError('SOURCE_IMAGE_MAGIC_MISMATCH', 'PNG 도면 원본 magic bytes가 MIME과 일치하지 않습니다.');
        }
        return;
    }
    if (mimeType === 'image/jpeg') {
        const hasJpegMarkers = bytes.length >= 4
            && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
            && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
        if (!hasJpegMarkers) {
            throw new DrawingPreviewProcessingError('SOURCE_IMAGE_MAGIC_MISMATCH', 'JPEG 도면 원본 magic bytes가 MIME과 일치하지 않습니다.');
        }
        return;
    }
    throw new DrawingPreviewProcessingError('SOURCE_MIME_MISMATCH', '지원하지 않는 도면 원본 MIME 형식입니다.');
};

const isPng = (value: Buffer): boolean => value.length >= 8
    && value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

export const processConstructionPlanDrawingPdfPagesSequentially = async (
    pdf: Buffer,
    onPage: (page: RenderedPage, pageCount: number) => void | Promise<void>,
    onPageCount?: (pageCount: number) => void | Promise<void>,
): Promise<number> => {
    const parser = new PDFParse({ data: pdf });
    try {
        const info = await parser.getInfo({ parsePageInfo: true });
        if (!Number.isInteger(info.total) || info.total < 1) {
            throw new DrawingPreviewProcessingError('PDF_PAGE_COUNT_INVALID', 'PDF에 렌더링할 페이지가 없습니다.');
        }
        if (info.total > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES) {
            throw new DrawingPreviewProcessingError(
                'PDF_PAGE_LIMIT_EXCEEDED',
                `PDF 도면은 최대 ${MAX_CONSTRUCTION_PLAN_DRAWING_PAGES}페이지까지 지원합니다.`,
            );
        }
        await onPageCount?.(info.total);
        const documentProxy = (parser as unknown as { doc?: PdfJsDocumentProxy }).doc;
        if (!documentProxy?.getPage) {
            throw new DrawingPreviewProcessingError('PDF_PAGE_GEOMETRY_INVALID', 'PDF 페이지 geometry reader를 초기화할 수 없습니다.');
        }
        // Keep both PDF.js page access and rasterization strictly sequential to
        // cap peak memory for 50-page construction drawings. The awaited
        // callback uploads/verifies this page before the next canvas is made.
        for (let pageNumber = 1; pageNumber <= info.total; pageNumber += 1) {
            const page = await documentProxy.getPage(pageNumber);
            let cropBoxPt: PdfBox;
            let rotation: 0 | 90 | 180 | 270;
            let viewportWidth: number;
            let viewportHeight: number;
            try {
                cropBoxPt = pdfBoxFromView(page.view);
                rotation = normalizePdfPageRotation(page.rotate);
                const viewport = page.getViewport?.({ scale: 1 });
                viewportWidth = Number(viewport?.width || (cropBoxPt.right - cropBoxPt.left));
                viewportHeight = Number(viewport?.height || (cropBoxPt.top - cropBoxPt.bottom));
            } finally {
                page.cleanup?.();
            }
            if (!Number.isFinite(viewportWidth) || viewportWidth <= 0
                || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
                throw new DrawingPreviewProcessingError('PDF_PAGE_GEOMETRY_INVALID', 'PDF 페이지 viewport가 올바르지 않습니다.');
            }
            const scale = Math.min(
                2,
                CONSTRUCTION_PLAN_DRAWING_PREVIEW_MAX_RASTER_DIMENSION
                    / Math.max(viewportWidth, viewportHeight),
            );
            const screenshot = await parser.getScreenshot({
                partial: [pageNumber],
                scale: Math.max(scale, 0.1),
                imageDataUrl: false,
                imageBuffer: true,
            });
            const screenshotPage = screenshot.pages[0];
            const png = screenshotPage ? Buffer.from(screenshotPage.data) : Buffer.alloc(0);
            if (screenshot.pages.length !== 1 || screenshotPage?.pageNumber !== pageNumber || !isPng(png)) {
                throw new DrawingPreviewProcessingError('PREVIEW_RENDER_INVALID', 'PDF 페이지 PNG 렌더링 결과가 올바르지 않습니다.');
            }
            // pdf-parse/PDF.js publicly exposes the effective page `view`
            // (CropBox clipped by MediaBox), but not the raw MediaBox. Store the
            // effective view for both fields instead of inventing geometry.
            await onPage({
                pageIndex: pageNumber - 1,
                mediaBoxPt: { ...cropBoxPt },
                cropBoxPt,
                rotation,
                png,
            }, info.total);
        }
        return info.total;
    } catch (error) {
        if (error instanceof DrawingPreviewProcessingError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (/password/i.test(message)) {
            throw new DrawingPreviewProcessingError('PDF_PASSWORD_REQUIRED', '암호로 보호된 PDF 도면은 미리보기를 생성할 수 없습니다.');
        }
        throw new DrawingPreviewProcessingError('PDF_INVALID', 'PDF 도면을 해석하거나 렌더링할 수 없습니다.');
    } finally {
        await parser.destroy();
    }
};

/** Test/diagnostic collector. Production uses the sequential callback above. */
export const renderConstructionPlanDrawingPdfPages = async (
    pdf: Buffer,
): Promise<RenderedPage[]> => {
    const rendered: RenderedPage[] = [];
    await processConstructionPlanDrawingPdfPagesSequentially(pdf, (page) => {
        rendered.push(page);
    });
    return rendered;
};

export const buildConstructionPlanDrawingPreviewArtifactMetadata = (
    request: EnsureConstructionPlanDrawingPreviewRequest,
    siteId: string,
    pageCount: number,
    pageIndex: number,
    pageFingerprint: string,
    previewSha256: string,
): UnknownRecord => ({
    artifactClass: PREVIEW_ARTIFACT_CLASS,
    siteId,
    planId: request.planId,
    drawingId: request.drawingId,
    sourceStoragePath: request.expectedSourceStoragePath,
    sourceSha256: request.expectedSourceSha256,
    sourceGeneration: request.expectedSourceGeneration,
    pageCount: String(pageCount),
    pageIndex: String(pageIndex),
    pageFingerprint,
    previewSha256,
    sha256: previewSha256,
});

const verifyPreviewArtifact = async (
    storageBucket: StorageBucket,
    result: ConstructionPlanDrawingPreviewResult,
    page: ConstructionPlanDrawingPreviewPage,
): Promise<void> => {
    let object: { bytes: Buffer; metadata: UnknownRecord };
    try {
        object = await readObject(storageBucket, page.previewPath);
    } catch (error) {
        throw new DrawingPreviewProcessingError('PREVIEW_ARTIFACT_NOT_FOUND', '서버 미리보기 PNG를 Storage에서 찾을 수 없습니다.');
    }
    if (String(object.metadata.generation || '') !== page.previewGeneration
        || object.metadata.contentType !== PNG_MIME_TYPE
        || !isPng(object.bytes)
        || sha256Hex(object.bytes) !== page.previewSha256) {
        throw new DrawingPreviewProcessingError('PREVIEW_ARTIFACT_INTEGRITY_FAILED', '서버 미리보기 PNG generation/SHA-256 검증에 실패했습니다.');
    }
    const metadata = customMetadata(object.metadata);
    assertConstructionPlanDrawingPreviewArtifactMetadata(metadata, result, page);
};

export const assertConstructionPlanDrawingPreviewArtifactMetadata = (
    metadata: UnknownRecord,
    result: ConstructionPlanDrawingPreviewResult,
    page: ConstructionPlanDrawingPreviewPage,
): void => {
    const expected: Array<[string, string]> = [
        ['artifactClass', PREVIEW_ARTIFACT_CLASS],
        ['siteId', result.siteId],
        ['planId', result.planId],
        ['drawingId', result.drawingId],
        ['sourceSha256', result.sourceSha256],
        ['pageCount', String(result.pageCount)],
        ['pageIndex', String(page.pageIndex)],
        ['pageFingerprint', page.pageFingerprint],
        ['previewSha256', page.previewSha256],
        ['sha256', page.previewSha256],
    ];
    if (expected.some(([key, expectedValue]) => readTrimmedString(metadata, [key]) !== expectedValue)) {
        throw new DrawingPreviewProcessingError('PREVIEW_ARTIFACT_BINDING_FAILED', '서버 미리보기 PNG 메타데이터 바인딩이 일치하지 않습니다.');
    }
};

const ensurePreviewArtifact = async (
    storageBucket: StorageBucket,
    request: EnsureConstructionPlanDrawingPreviewRequest,
    siteId: string,
    pageCount: number,
    rendered: RenderedPage,
): Promise<ConstructionPlanDrawingPreviewPage> => {
    const pageFingerprint = canonicalConstructionPlanDrawingPageFingerprint(
        request.expectedSourceSha256,
        rendered.pageIndex,
    );
    const previewPath = canonicalConstructionPlanDrawingPreviewPath(
        siteId,
        request.planId,
        request.drawingId,
        request.expectedSourceSha256,
        rendered.pageIndex,
    );
    const previewSha256 = sha256Hex(rendered.png);
    const file = storageBucket.file(previewPath);
    try {
        await file.save(rendered.png, {
            resumable: false,
            contentType: PNG_MIME_TYPE,
            metadata: {
                contentType: PNG_MIME_TYPE,
                cacheControl: 'private,max-age=31536000,immutable',
                metadata: buildConstructionPlanDrawingPreviewArtifactMetadata(
                    request,
                    siteId,
                    pageCount,
                    rendered.pageIndex,
                    pageFingerprint,
                    previewSha256,
                ),
            },
            preconditionOpts: { ifGenerationMatch: 0 },
        });
    } catch (error) {
        if (!preconditionError(error)) throw error;
    }
    const [rawMetadata] = await file.getMetadata();
    const previewGeneration = String(rawMetadata.generation || '');
    if (!GENERATION_PATTERN.test(previewGeneration)) {
        throw new DrawingPreviewProcessingError('PREVIEW_ARTIFACT_GENERATION_MISSING', '서버 미리보기 PNG generation을 확인할 수 없습니다.');
    }
    const page: ConstructionPlanDrawingPreviewPage = {
        pageIndex: rendered.pageIndex,
        mediaBoxPt: rendered.mediaBoxPt,
        cropBoxPt: rendered.cropBoxPt,
        rotation: rendered.rotation,
        pageFingerprint,
        previewPath,
        previewGeneration,
        previewSha256,
    };
    const result: ConstructionPlanDrawingPreviewResult = {
        siteId,
        planId: request.planId,
        drawingId: request.drawingId,
        sourceStoragePath: request.expectedSourceStoragePath,
        sourceSha256: request.expectedSourceSha256,
        sourceGeneration: request.expectedSourceGeneration,
        previewStatus: 'ready',
        pageCount,
        pages: [page],
        previewPaths: [previewPath],
        processedAt: new Date().toISOString(),
        idempotent: false,
    };
    // Verify with a single-page projection, while preserving the physical
    // pageCount expected in artifact custom metadata.
    await verifyPreviewArtifact(storageBucket, result, page);
    return page;
};

const verifyReadyResultArtifacts = async (
    storageBucket: StorageBucket,
    result: ConstructionPlanDrawingPreviewResult,
): Promise<void> => {
    if (result.previewStatus !== 'ready') failedPrecondition('도면 미리보기 manifest가 READY 상태가 아닙니다.');
    for (const page of result.pages) await verifyPreviewArtifact(storageBucket, result, page);
};

const persistReadyResult = async (
    options: EnsureConstructionPlanDrawingPreviewOptions,
    result: ConstructionPlanDrawingPreviewResult,
): Promise<void> => {
    const { database, actorId, request } = options;
    const planRef = database.collection(PLANS_COLLECTION).doc(request.planId);
    const manifestRef = planRef.collection(MANIFESTS_COLLECTION).doc(request.drawingId);
    await database.runTransaction(async (transaction) => {
        const planSnapshot = await transaction.get(planRef);
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const plan = planSnapshot.data() as UnknownRecord;
        options.assertPlanMutationAllowed?.(plan);
        const binding = findDrawingBinding(plan, request);
        transaction.set(manifestRef, manifestRecord(result, actorId, request));
        transaction.update(planRef, {
            drawings: replaceDrawing(
                plan,
                binding.drawingIndex,
                projectDrawingPreviewResultToEmbeddedCache(binding.drawing, result),
            ),
            drawingPreviewManifestUpdatedAt: result.processedAt,
        });
    });
};

const classifyProcessingError = (error: unknown): DrawingPreviewProcessingError => {
    if (error instanceof DrawingPreviewProcessingError) return error;
    if (error instanceof functions.https.HttpsError) {
        return new DrawingPreviewProcessingError(
            `PREVIEW_${error.code.toUpperCase().replace(/-/g, '_')}`,
            error.message || '도면 미리보기 처리 중 오류가 발생했습니다.',
        );
    }
    return new DrawingPreviewProcessingError(
        'PREVIEW_PROCESSING_FAILED',
        error instanceof Error && error.message
            ? error.message.slice(0, 500)
            : '도면 미리보기 처리 중 오류가 발생했습니다.',
    );
};

const persistFailedResult = async (
    options: EnsureConstructionPlanDrawingPreviewOptions,
    pageCount: number,
    error: DrawingPreviewProcessingError,
): Promise<ConstructionPlanDrawingPreviewResult> => {
    const { database, actorId, request } = options;
    const planRef = database.collection(PLANS_COLLECTION).doc(request.planId);
    const manifestRef = planRef.collection(MANIFESTS_COLLECTION).doc(request.drawingId);
    const processedAt = (options.now?.() ?? new Date()).toISOString();
    return database.runTransaction(async (transaction) => {
        const [planSnapshot, manifestSnapshot] = await Promise.all([
            transaction.get(planRef),
            transaction.get(manifestRef),
        ]);
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const plan = planSnapshot.data() as UnknownRecord;
        options.assertPlanMutationAllowed?.(plan);
        const binding = findDrawingBinding(plan, request);
        if (manifestSnapshot.exists && isUnknownRecord(manifestSnapshot.data())) {
            try {
                const rawManifest = manifestSnapshot.data() as UnknownRecord;
                if (rawManifest.authority !== 'server'
                    || rawManifest.schemaVersion !== CONSTRUCTION_PLAN_DRAWING_PREVIEW_SCHEMA_VERSION) {
                    throw new Error('drawing-preview-manifest-authority-invalid');
                }
                const concurrent = parseConstructionPlanDrawingPreviewResult(rawManifest);
                if (concurrent.previewStatus === 'ready' && sameSourceBinding(concurrent, request)) {
                    return { ...concurrent, idempotent: true };
                }
            } catch (_ignored) {
                // Replace corrupt non-authoritative data with a server failure.
            }
        }
        const failed: ConstructionPlanDrawingPreviewResult = {
            siteId: binding.siteId,
            planId: request.planId,
            drawingId: request.drawingId,
            sourceStoragePath: request.expectedSourceStoragePath,
            sourceSha256: request.expectedSourceSha256,
            sourceGeneration: request.expectedSourceGeneration,
            previewStatus: 'failed',
            pageCount: Math.max(1, Math.min(MAX_CONSTRUCTION_PLAN_DRAWING_PAGES, pageCount)),
            pages: [],
            previewPaths: [],
            errorCode: error.errorCode.slice(0, 120),
            errorMessage: error.message.slice(0, 500),
            processedAt,
            idempotent: false,
        };
        transaction.set(manifestRef, manifestRecord(failed, actorId, request));
        transaction.update(planRef, {
            drawings: replaceDrawing(
                plan,
                binding.drawingIndex,
                projectDrawingPreviewResultToEmbeddedCache(binding.drawing, failed),
            ),
            drawingPreviewManifestUpdatedAt: processedAt,
        });
        return failed;
    });
};

const persistRecoveredReadyCache = async (
    options: EnsureConstructionPlanDrawingPreviewOptions,
    recovered: ConstructionPlanDrawingPreviewResult,
): Promise<void> => {
    const { database, request } = options;
    const planRef = database.collection(PLANS_COLLECTION).doc(request.planId);
    const manifestRef = planRef.collection(MANIFESTS_COLLECTION).doc(request.drawingId);
    await database.runTransaction(async (transaction) => {
        const [snapshot, manifestSnapshot] = await Promise.all([
            transaction.get(planRef),
            transaction.get(manifestRef),
        ]);
        if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        if (!manifestSnapshot.exists || !isUnknownRecord(manifestSnapshot.data())) {
            throw new functions.https.HttpsError('aborted', '복구할 권위 미리보기 manifest가 변경되었습니다.');
        }
        const rawManifest = manifestSnapshot.data() as UnknownRecord;
        if (rawManifest.authority !== 'server'
            || rawManifest.schemaVersion !== CONSTRUCTION_PLAN_DRAWING_PREVIEW_SCHEMA_VERSION) {
            throw new functions.https.HttpsError('data-loss', '권위 미리보기 manifest 표식이 손상되었습니다.');
        }
        const currentManifest = parseConstructionPlanDrawingPreviewResult(rawManifest);
        if (canonicalStringify({ ...currentManifest, idempotent: recovered.idempotent })
            !== canonicalStringify(recovered)) {
            throw new functions.https.HttpsError('aborted', '복구 중 권위 미리보기 manifest가 변경되었습니다.');
        }
        const plan = snapshot.data() as UnknownRecord;
        options.assertPlanMutationAllowed?.(plan);
        const binding = findDrawingBinding(plan, request);
        transaction.update(planRef, {
            drawings: replaceDrawing(
                plan,
                binding.drawingIndex,
                projectDrawingPreviewResultToEmbeddedCache(binding.drawing, recovered),
            ),
            drawingPreviewManifestUpdatedAt: recovered.processedAt,
        });
    });
};

export const ensureConstructionPlanDrawingPreview = async (
    options: EnsureConstructionPlanDrawingPreviewOptions,
): Promise<ConstructionPlanDrawingPreviewResult> => {
    let recovered = await claimProcessing(options);
    if (recovered) {
        try {
            const planSnapshot = await options.database.collection(PLANS_COLLECTION).doc(options.request.planId).get();
            if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
                throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
            }
            options.assertPlanMutationAllowed?.(planSnapshot.data() as UnknownRecord);
            const binding = findDrawingBinding(planSnapshot.data() as UnknownRecord, options.request);
            await verifySourceObject(options.storageBucket, options.request, binding.drawing);
            await verifyReadyResultArtifacts(options.storageBucket, recovered);
            recovered = { ...recovered, idempotent: true };
            await persistRecoveredReadyCache(options, recovered);
            return recovered;
        } catch (error) {
            functions.logger.warn('[constructionPlans] READY drawing preview recovery failed; retrying create-only render.', {
                planId: options.request.planId,
                drawingId: options.request.drawingId,
                error,
            });
            await claimProcessing(options, true);
        }
    }

    let pageCount = 1;
    try {
        const planSnapshot = await options.database.collection(PLANS_COLLECTION).doc(options.request.planId).get();
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        options.assertPlanMutationAllowed?.(planSnapshot.data() as UnknownRecord);
        const binding = findDrawingBinding(planSnapshot.data() as UnknownRecord, options.request);
        pageCount = binding.pageCount;
        const source = await verifySourceObject(options.storageBucket, options.request, binding.drawing);
        const pages: ConstructionPlanDrawingPreviewPage[] = [];
        pageCount = await processConstructionPlanDrawingPdfPagesSequentially(
            source,
            async (renderedPage, total) => {
                pages.push(await ensurePreviewArtifact(
                    options.storageBucket,
                    options.request,
                    binding.siteId,
                    total,
                    renderedPage,
                ));
            },
            (total) => {
                if (options.request.requestedPageIndexes?.some((pageIndex) => pageIndex >= total)) {
                    throw new DrawingPreviewProcessingError(
                        'REQUESTED_PAGE_OUT_OF_RANGE',
                        '요청한 복구 페이지가 PDF 물리 페이지 범위를 벗어났습니다.',
                    );
                }
            },
        );
        const processedAt = (options.now?.() ?? new Date()).toISOString();
        const ready = parseConstructionPlanDrawingPreviewResult({
            siteId: binding.siteId,
            planId: options.request.planId,
            drawingId: options.request.drawingId,
            sourceStoragePath: options.request.expectedSourceStoragePath,
            sourceSha256: options.request.expectedSourceSha256,
            sourceGeneration: options.request.expectedSourceGeneration,
            previewStatus: 'ready',
            pageCount,
            pages,
            previewPaths: pages.map((page) => page.previewPath),
            processedAt,
            idempotent: false,
        });
        await persistReadyResult(options, ready);
        return ready;
    } catch (rawError) {
        const error = classifyProcessingError(rawError);
        functions.logger.error('[constructionPlans] Drawing preview generation failed.', {
            planId: options.request.planId,
            drawingId: options.request.drawingId,
            errorCode: error.errorCode,
            error: rawError,
        });
        const failed = await persistFailedResult(options, pageCount, error);
        if (failed.previewStatus === 'ready') {
            await verifyReadyResultArtifacts(options.storageBucket, failed);
        }
        return failed;
    }
};

const sourceBindingProjection = (planId: string, plan: UnknownRecord): UnknownRecord => ({
    planId,
    siteId: readTrimmedString(plan, ['siteId']) || '',
    drawings: (Array.isArray(plan.drawings) ? plan.drawings : [])
        .filter((drawing) => isUnknownRecord(drawing) && drawing.approvalStatus !== 'superseded')
        .map((drawing) => ({
            id: readTrimmedString(drawing as UnknownRecord, ['id']) || '',
            planId: readTrimmedString(drawing as UnknownRecord, ['planId']) || '',
            approvalStatus: (drawing as UnknownRecord).approvalStatus,
            storagePath: readTrimmedString(drawing as UnknownRecord, ['storagePath']) || '',
            sourceSha256: normalizedSha256(readTrimmedString(drawing as UnknownRecord, ['sourceSha256']) || ''),
            sourceGeneration: readTrimmedString(drawing as UnknownRecord, ['sourceGeneration']) || '',
            mimeType: readTrimmedString(drawing as UnknownRecord, ['mimeType']) || '',
            sizeBytes: (drawing as UnknownRecord).sizeBytes,
            pageCount: (drawing as UnknownRecord).pageCount,
            previewStatus: (drawing as UnknownRecord).previewStatus,
            previewPaths: (drawing as UnknownRecord).previewPaths,
            pages: (drawing as UnknownRecord).pages,
            annotations: (drawing as UnknownRecord).annotations,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
});

export const constructionPlanDrawingPreviewBindingHash = (
    planId: string,
    plan: UnknownRecord,
): string => sha256Hex(canonicalStringify(sourceBindingProjection(planId, plan)));

export const assertConstructionPlanDrawingPreviewBindingHash = (
    planId: string,
    plan: UnknownRecord,
    expectedBindingHash: string,
): void => {
    if (!SHA256_PATTERN.test(expectedBindingHash)
        || constructionPlanDrawingPreviewBindingHash(planId, plan) !== normalizedSha256(expectedBindingHash)) {
        throw new functions.https.HttpsError(
            'aborted',
            '도면 원본 또는 권위 미리보기 바인딩이 검증 중 변경되었습니다.',
        );
    }
};

const requireReleaseDrawing = (
    planId: string,
    siteId: string,
    drawing: UnknownRecord,
): {
    id: string;
    storagePath: string;
    sourceSha256: string;
    sourceGeneration: string;
    mimeType: string;
    sizeBytes: number;
} => {
    const id = readTrimmedString(drawing, ['id']);
    const storagePath = readTrimmedString(drawing, ['storagePath']);
    const sourceSha256 = normalizedSha256(readTrimmedString(drawing, ['sourceSha256']) || '');
    const sourceGeneration = readTrimmedString(drawing, ['sourceGeneration']);
    const mimeType = readTrimmedString(drawing, ['mimeType']);
    const sizeBytes = drawing.sizeBytes;
    if (!id || !storagePath || !SHA256_PATTERN.test(sourceSha256)
        || !sourceGeneration || !GENERATION_PATTERN.test(sourceGeneration)
        || (mimeType !== PDF_MIME_TYPE && mimeType !== 'image/png' && mimeType !== 'image/jpeg')
        || typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes < 1
        || typeof drawing.pageCount !== 'number' || !Number.isInteger(drawing.pageCount)
        || drawing.pageCount < 1 || drawing.pageCount > MAX_CONSTRUCTION_PLAN_DRAWING_PAGES
        || readTrimmedString(drawing, ['planId']) !== planId
        || !storagePath.startsWith(`construction-plans/${siteId}/${planId}/drawings/`)) {
        failedPrecondition(`도면 ${id || '(unknown)'}의 불변 원본 바인딩이 완전하지 않습니다.`);
    }
    return { id, storagePath, sourceSha256, sourceGeneration, mimeType, sizeBytes: sizeBytes as number };
};

const verifyReleaseSource = async (
    storageBucket: StorageBucket,
    binding: ReturnType<typeof requireReleaseDrawing>,
): Promise<void> => {
    let object: { bytes: Buffer; metadata: UnknownRecord };
    try {
        object = await readObject(storageBucket, binding.storagePath);
    } catch (error) {
        failedPrecondition(`도면 ${binding.id}의 원본 객체를 찾을 수 없습니다.`);
    }
    if (String(object.metadata.generation || '') !== binding.sourceGeneration
        || object.metadata.contentType !== binding.mimeType
        || Number(object.metadata.size) !== binding.sizeBytes
        || object.bytes.length !== binding.sizeBytes
        || sha256Hex(object.bytes) !== binding.sourceSha256) {
        dataLoss(`도면 ${binding.id}의 원본 generation/SHA-256/MIME 바인딩이 일치하지 않습니다.`);
    }
    try {
        assertConstructionPlanDrawingSourceMagic(binding.mimeType, object.bytes);
    } catch (_error) {
        dataLoss(`도면 ${binding.id}의 원본 magic bytes가 MIME과 일치하지 않습니다.`);
    }
};

const drawingPageProjection = (drawing: UnknownRecord): UnknownRecord => ({
    pageCount: drawing.pageCount,
    previewStatus: drawing.previewStatus,
    previewPaths: drawing.previewPaths,
    pages: drawing.pages,
    previewErrorCode: drawing.previewErrorCode ?? null,
    previewErrorMessage: drawing.previewErrorMessage ?? null,
    previewUpdatedAt: drawing.previewUpdatedAt ?? null,
});

const manifestPageProjection = (manifest: ConstructionPlanDrawingPreviewResult): UnknownRecord => ({
    pageCount: manifest.pageCount,
    previewStatus: manifest.previewStatus,
    previewPaths: manifest.previewPaths,
    pages: manifest.pages,
    previewErrorCode: manifest.errorCode ?? null,
    previewErrorMessage: manifest.errorMessage ?? null,
    previewUpdatedAt: manifest.processedAt,
});

const verifyImageDrawingPreview = (drawing: UnknownRecord, sourcePath: string): void => {
    if (drawing.previewStatus !== 'ready'
        || drawing.pageCount !== 1
        || !Array.isArray(drawing.previewPaths)
        || drawing.previewPaths.length !== 1
        || drawing.previewPaths[0] !== sourcePath
        || (Array.isArray(drawing.pages) && drawing.pages.length > 0)) {
        failedPrecondition('이미지 도면은 검증된 단일 원본 객체를 미리보기로 사용해야 합니다.');
    }
};

const normalizedCoordinate = (value: unknown): value is number => typeof value === 'number'
    && Number.isFinite(value) && value >= 0 && value <= 1;

const positiveNormalizedExtent = (value: unknown): value is number => typeof value === 'number'
    && Number.isFinite(value) && value > 0 && value <= 1;

const normalizedPoint = (value: unknown): boolean => isUnknownRecord(value)
    && normalizedCoordinate(value.x) && normalizedCoordinate(value.y);

const validAnnotationGeometry = (value: unknown): boolean => {
    if (!isUnknownRecord(value) || typeof value.kind !== 'string') return false;
    if (value.kind === 'polygon' || value.kind === 'polyline') {
        const minimum = value.kind === 'polygon' ? 3 : 2;
        if (!Array.isArray(value.vertices)) return false;
        const vertices = value.vertices as UnknownRecord[];
        if (vertices.length < minimum || !vertices.every(normalizedPoint)) return false;
        if (value.kind === 'polyline') {
            return vertices.some((point, index) => index > 0
                && (point.x !== vertices[0].x || point.y !== vertices[0].y));
        }
        const twiceArea = vertices.reduce((sum, point, index) => {
            const next = vertices[(index + 1) % vertices.length];
            return sum + Number(point.x) * Number(next.y) - Number(next.x) * Number(point.y);
        }, 0);
        return Math.abs(twiceArea) > 1e-9;
    }
    if (value.kind === 'rect' || value.kind === 'text') {
        return normalizedCoordinate(value.x)
            && normalizedCoordinate(value.y)
            && positiveNormalizedExtent(value.w)
            && positiveNormalizedExtent(value.h)
            && Number(value.x) + Number(value.w) <= 1
            && Number(value.y) + Number(value.h) <= 1
            && (value.kind !== 'rect'
                || (typeof value.rotationDeg === 'number' && Number.isFinite(value.rotationDeg)))
            && (value.kind !== 'text'
                || value.align === 'left' || value.align === 'center' || value.align === 'right');
    }
    if (value.kind === 'ellipse') {
        return normalizedCoordinate(value.cx)
            && normalizedCoordinate(value.cy)
            && positiveNormalizedExtent(value.rx)
            && positiveNormalizedExtent(value.ry)
            && Number(value.cx) - Number(value.rx) >= 0
            && Number(value.cx) + Number(value.rx) <= 1
            && Number(value.cy) - Number(value.ry) >= 0
            && Number(value.cy) + Number(value.ry) <= 1;
    }
    if (value.kind === 'marker') {
        return normalizedCoordinate(value.x)
            && normalizedCoordinate(value.y)
            && typeof value.markerType === 'string'
            && Boolean(value.markerType.trim());
    }
    return false;
};

export const assertConstructionPlanDrawingAnnotationsBoundToPages = (
    drawing: UnknownRecord,
    pageFingerprints: readonly string[],
): void => {
    if (!Array.isArray(drawing.annotations)) {
        dataLoss(`도면 ${readTrimmedString(drawing, ['id']) || '(unknown)'}의 annotations가 손상되었습니다.`);
    }
    const ids = new Set<string>();
    for (const rawAnnotation of drawing.annotations as unknown[]) {
        if (!isUnknownRecord(rawAnnotation)) dataLoss('도면 annotation 객체가 손상되었습니다.');
        const annotation = rawAnnotation as UnknownRecord;
        const id = readTrimmedString(annotation, ['id']);
        const pageIndex = annotation.pageIndex;
        const pageFingerprint = readTrimmedString(annotation, ['pageFingerprint']);
        const allowedLayers = new Set([
            'install', 'dismantle', 'retain', 'equipment',
            'pedestrian', 'lifting', 'restricted', 'storage',
        ]);
        if (!id || ids.has(id)) dataLoss('도면 annotation ID가 없거나 중복되었습니다.');
        ids.add(id);
        if (!allowedLayers.has(readTrimmedString(annotation, ['layer']) || '')) {
            dataLoss(`도면 annotation ${id}의 layer가 손상되었습니다.`);
        }
        if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex)
            || pageIndex < 0 || pageIndex >= pageFingerprints.length) {
            dataLoss(`도면 annotation ${id}의 pageIndex가 물리 페이지 범위를 벗어났습니다.`);
        }
        if (!pageFingerprint || pageFingerprint !== pageFingerprints[pageIndex as number]) {
            dataLoss(`도면 annotation ${id}의 pageFingerprint가 권위 manifest와 일치하지 않습니다.`);
        }
        if (!validAnnotationGeometry(annotation.geometry)) {
            dataLoss(`도면 annotation ${id}의 정규화 geometry가 손상되었습니다.`);
        }
    }
};

export const assertAuthoritativeConstructionPlanDrawingPreviews = async (
    options: VerifyConstructionPlanDrawingPreviewsOptions,
): Promise<AuthoritativeDrawingPreviewVerification> => {
    const { database, storageBucket, planId, plan } = options;
    const siteId = requireSiteId(plan);
    if (!Array.isArray(plan.drawings)) failedPrecondition('계획서 도면 목록이 없습니다.');
    const activeDrawings = (plan.drawings as unknown[]).filter((drawing) => (
        isUnknownRecord(drawing) && drawing.approvalStatus !== 'superseded'
    )) as UnknownRecord[];
    const ids = activeDrawings.map((drawing) => readTrimmedString(drawing, ['id']) || '');
    if (new Set(ids).size !== ids.length || ids.some((id) => !id)) {
        dataLoss('활성 도면 ID가 없거나 중복되었습니다.');
    }
    let pdfDrawingCount = 0;
    let imageDrawingCount = 0;
    const planRef = database.collection(PLANS_COLLECTION).doc(planId);
    for (const drawing of activeDrawings) {
        const binding = requireReleaseDrawing(planId, siteId, drawing);
        await verifyReleaseSource(storageBucket, binding);
        if (binding.mimeType !== PDF_MIME_TYPE) {
            verifyImageDrawingPreview(drawing, binding.storagePath);
            assertConstructionPlanDrawingAnnotationsBoundToPages(drawing, [
                canonicalConstructionPlanDrawingPageFingerprint(binding.sourceSha256, 0),
            ]);
            imageDrawingCount += 1;
            continue;
        }
        if (!SAFE_DRAWING_ID_PATTERN.test(binding.id)) {
            failedPrecondition(`PDF 도면 ${binding.id}의 ID를 권위 미리보기 경로 형식으로 마이그레이션해야 합니다.`);
        }
        const manifestSnapshot = await planRef.collection(MANIFESTS_COLLECTION).doc(binding.id).get();
        if (!manifestSnapshot.exists || !isUnknownRecord(manifestSnapshot.data())) {
            failedPrecondition(`PDF 도면 ${binding.id}의 서버 권위 미리보기 manifest가 없습니다.`);
        }
        const rawManifest = manifestSnapshot.data() as UnknownRecord;
        if (rawManifest.authority !== 'server'
            || rawManifest.schemaVersion !== CONSTRUCTION_PLAN_DRAWING_PREVIEW_SCHEMA_VERSION) {
            dataLoss(`PDF 도면 ${binding.id}의 미리보기 manifest 권위 표식이 손상되었습니다.`);
        }
        const manifest = parseConstructionPlanDrawingPreviewResult(rawManifest);
        if (manifest.previewStatus !== 'ready'
            || manifest.siteId !== siteId
            || manifest.planId !== planId
            || manifest.drawingId !== binding.id
            || manifest.sourceStoragePath !== binding.storagePath
            || manifest.sourceSha256 !== binding.sourceSha256
            || manifest.sourceGeneration !== binding.sourceGeneration) {
            failedPrecondition(`PDF 도면 ${binding.id}의 READY manifest가 현재 원본과 일치하지 않습니다.`);
        }
        if (canonicalStringify(drawingPageProjection(drawing))
            !== canonicalStringify(manifestPageProjection(manifest))) {
            dataLoss(`PDF 도면 ${binding.id}의 embedded cache가 서버 manifest와 일치하지 않습니다.`);
        }
        assertConstructionPlanDrawingAnnotationsBoundToPages(
            drawing,
            manifest.pages.map((page) => page.pageFingerprint),
        );
        try {
            await verifyReadyResultArtifacts(storageBucket, manifest);
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            dataLoss(`PDF 도면 ${binding.id}의 미리보기 Storage 무결성 검증에 실패했습니다.`);
        }
        pdfDrawingCount += 1;
    }
    return {
        bindingHash: constructionPlanDrawingPreviewBindingHash(planId, plan),
        pdfDrawingCount,
        imageDrawingCount,
    };
};

export const DRAWING_PREVIEW_STORAGE_METADATA_CONTRACT = {
    sourceArtifactClass: SOURCE_ARTIFACT_CLASS,
    previewArtifactClass: PREVIEW_ARTIFACT_CLASS,
    previewMimeType: PNG_MIME_TYPE,
    manifestCollection: MANIFESTS_COLLECTION,
} as const;
