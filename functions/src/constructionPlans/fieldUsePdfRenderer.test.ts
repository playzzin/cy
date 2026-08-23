import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFParse } from 'pdf-parse';
import PDFDocument = require('pdfkit');
import {
    buildConstructionPlanDraftDocument,
    buildConstructionPlanReviewSnapshotContent,
    canonicalStringify,
    isUnknownRecord,
    sha256Hex,
} from './domain';
import { verifyApprovedConstructionPlanSnapshot } from './serverPdfRenderer';
import {
    assertConstructionPlanFieldUseReleaseEligible,
    constructionPlanOrganizationRowsForFieldUsePdf,
    CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE,
    getConstructionPlanFieldUseTemplateBundleHash,
    renderConstructionPlanFieldUsePdf,
    validateConstructionPlanFieldUseAuditPages,
    type ConstructionPlanFieldUseDrawingSource,
    type ConstructionPlanFieldUseDrawingSourceRef,
    type ConstructionPlanFieldUsePdfResult,
} from './fieldUsePdfRenderer';
import { SYSTEM_SCAFFOLD_SERVER_TEMPLATE, SYSTEM_SHORING_SERVER_TEMPLATE } from './templateContracts';
import {
    buildConstructionPlanTemplateBinding,
    constructionPlanTemplateBindingProjection,
} from './templateBinding';
import {
    constructionPlanTemplatePublishedFingerprint,
    getKnownConstructionPlanTemplateDefinitions,
    type ConstructionPlanTemplateLifecycleRecord,
} from './templateLifecycle';
import {
    canonicalConstructionPlanDrawingAnnotationStyle,
    type ConstructionPlanDrawingLayer,
} from './drawingAnnotationContract';

const TIMESTAMP = '2026-08-22T00:00:00.000Z';
const PLAN_ID = 'plan-field-use-1';

test('field-use organization rows expose canonical duplicate/external keys and their visible reasons', () => {
    const sharedWorker = {
        id: 'worker-shared', name: '김겸임', status: 'active', siteId: 'site-2',
        position: '안전관리자', teamName: '지원팀',
    };
    const rows = constructionPlanOrganizationRowsForFieldUsePdf({
        organizationSnapshot: {
            capturedAt: TIMESTAMP,
            sourceSiteId: 'site-1',
            assignments: [{
                id: 'assignment-site', role: 'site_manager', label: '현장책임자', required: true,
                worker: sharedWorker, responsibilities: ['현장 총괄'], order: 0,
                externalAssignment: true, exceptionReason: '현장책임자 역할 승인 겸임 사유',
            }, {
                id: 'assignment-safety', role: 'safety_manager', label: '안전담당', required: true,
                worker: sharedWorker, responsibilities: ['안전 관리'], order: 1,
                externalAssignment: true, exceptionReason: '안전담당 역할 승인 겸임 사유',
            }, {
                id: 'assignment-legacy', role: 'quality_manager', label: '품질담당', required: false,
                worker: { id: 'worker-legacy', name: '박레거시', status: 'active' },
                responsibilities: ['품질 관리'], order: 2, externalAssignment: false,
            }],
            additionalWorkers: [],
        },
    });
    const visibleText = rows.map((row) => `${row.label} ${row.value}`).join('\n');
    assert.match(visibleText, /현장책임자.*구분 겸임·현장 외 배정.*현장책임자 역할 승인 겸임 사유/);
    assert.match(visibleText, /안전담당.*구분 겸임·현장 외 배정.*안전담당 역할 승인 겸임 사유/);
    const legacyRow = rows.find((row) => row.label.includes('품질담당'));
    assert.ok(legacyRow);
    assert.equal(legacyRow.value.includes('현장 외 배정'), false);
});

const bindPublishedTemplate = (
    content: Record<string, unknown>,
    tradeType: 'system-shoring' | 'system-scaffold',
): void => {
    const definition = getKnownConstructionPlanTemplateDefinitions(
        getConstructionPlanFieldUseTemplateBundleHash(),
    ).find((candidate) => candidate.tradeType === tradeType);
    if (!definition) throw new Error(`missing-template-definition:${tradeType}`);
    const base = {
        schemaVersion: 1 as const,
        ...definition,
        lifecycle: 'published' as const,
        lifecycleVersion: 1,
        isLatest: true,
        createdAt: TIMESTAMP,
        createdBy: 'template-admin',
        updatedAt: TIMESTAMP,
        updatedBy: 'template-admin',
        publishedAt: TIMESTAMP,
        publishedBy: 'template-admin',
        publishedReason: '테스트 게시',
        lastTransitionReason: '테스트 게시',
    };
    const record: ConstructionPlanTemplateLifecycleRecord = {
        ...base,
        publishedFingerprint: constructionPlanTemplatePublishedFingerprint(base),
    };
    const binding = buildConstructionPlanTemplateBinding(record, TIMESTAMP);
    Object.assign(content, {
        templateBinding: binding,
        ...constructionPlanTemplateBindingProjection(binding),
    });
};

const imageBytes = (format: 'png' | 'jpeg', label: string): Buffer => {
    const canvas = createCanvas(800, 600);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 800, 600);
    context.fillStyle = '#e2e8f0';
    for (let x = 40; x < 800; x += 80) context.fillRect(x, 0, 2, 600);
    for (let y = 40; y < 600; y += 80) context.fillRect(0, y, 800, 2);
    context.strokeStyle = '#0f172a'; context.lineWidth = 5; context.strokeRect(50, 50, 700, 500);
    context.fillStyle = '#0f172a'; context.font = 'bold 42px sans-serif'; context.fillText(label, 90, 120);
    return format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', 92);
};

const pdfBytes = async (): Promise<Buffer> => new Promise((resolve, reject) => {
    const document = new PDFDocument({ autoFirstPage: false, compress: true, info: {
        Title: 'D-02 source', CreationDate: new Date('2000-01-01T00:00:00.000Z'), ModDate: new Date('2000-01-01T00:00:00.000Z'),
    } });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    [1, 2].forEach((page) => {
        document.addPage({ size: [595.28, 841.89], margin: 0 });
        if (page === 2) {
            const pageDictionary = (document.page as unknown as { dictionary: { data: Record<string, unknown> } }).dictionary.data;
            pageDictionary.CropBox = [40, 60, 555.28, 780];
            pageDictionary.Rotate = 90;
        }
        document.rect(30, 30, 535.28, 781.89).stroke('#111827');
        document.font('Helvetica-Bold').fontSize(32).fillColor('#111827').text(`D-02 SOURCE PAGE ${page}`, 70, 100);
        document.moveTo(70, 180).lineTo(520, 700).stroke('#64748b');
    });
    document.end();
});

type Geometry = Record<string, unknown>;

const annotation = (
    drawingId: string,
    index: number,
    pageIndex: number,
    fingerprint: string,
    layer: string,
    geometry: Geometry,
) => ({
    id: `${drawingId}-annotation-${index}`,
    pageIndex,
    pageFingerprint: fingerprint,
    layer,
    geometry,
    style: canonicalConstructionPlanDrawingAnnotationStyle(layer as ConstructionPlanDrawingLayer),
    label: `${drawingId} 한글 구간 ${index}`,
    zoneCode: `A-${index}`,
    sequence: index,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    reason: '승인된 공정구간 표시',
    ...(layer === 'retain' ? { releaseCondition: '승인 구조강도 확인 후 해제' } : {}),
    ...(layer === 'equipment' ? { equipmentType: '이동식 크레인', equipmentId: `equipment-${index}` } : {}),
    ...(layer === 'pedestrian' ? { entrance: '동문', destination: 'A동 작업층' } : {}),
    ...(layer === 'lifting' ? { equipmentId: `lifting-${index}`, radius: 12 + index } : {}),
    ...(layer === 'restricted' ? {
        responsibleWorkerId: `restricted-worker-private-${index}`,
        responsibleRole: '통제담당',
    } : {}),
    ...(layer === 'storage' ? { materialType: '시스템동바리 수직재' } : {}),
    styleVersion: 1,
    locked: true,
    createdBy: 'author-1',
    createdAt: TIMESTAMP,
    updatedBy: 'author-1',
    updatedAt: TIMESTAMP,
});

interface StressFixture {
    verifiedSnapshot: ReturnType<typeof verifyApprovedConstructionPlanSnapshot>;
    sources: Map<string, ConstructionPlanFieldUseDrawingSource>;
}

const approvalBinding = (
    verifiedSnapshot: ReturnType<typeof verifyApprovedConstructionPlanSnapshot>,
): { approvalEvidence: UnknownRecord; approvalEvidenceHash: string } => {
    const approvalEvidence: UnknownRecord = {
        evidenceSchemaVersion: 1,
        kind: 'construction_plan_approval',
        planId: verifiedSnapshot.content.planId,
        reviewCycleId: 'review-cycle-1',
        reviewPackageId: 'review-package-1',
        snapshotId: 'review-snapshot-1',
        contentHash: verifiedSnapshot.snapshotHash,
        storagePath: `construction-plans/${PLAN_ID}/review-snapshots/${verifiedSnapshot.snapshotHash}.json`,
        reviewDecision: 'completed',
        approverId: 'approver-1',
        completedByName: '박검토',
        completedAt: '2026-08-22T01:00:00.000Z',
        approverName: '이승인',
        approvedAt: '2026-08-22T02:00:00.000Z',
        templateHash: verifiedSnapshot.content.templateHash,
        manifestHash: verifiedSnapshot.content.manifestHash,
        templateBundleHash: verifiedSnapshot.content.templateBundleHash,
        templateBindingHash: verifiedSnapshot.content.templateBindingHash,
    };
    return {
        approvalEvidence,
        approvalEvidenceHash: sha256Hex(canonicalStringify(approvalEvidence)),
    };
};

const structuredSectionContent = (key: string): UnknownRecord | undefined => {
    const base = { structuredDataVersion: 1, applicableZones: ['A동 12F'] };
    const sequence = [{ id: 'sequence-1', sequence: 1, activity: '승인 순서 작업', responsibleRole: '공사담당', workZones: ['A동 12F'], prerequisites: ['출입통제'], acceptanceCriteria: ['검측 완료'] }];
    const contents: Record<string, UnknownRecord> = {
        'material-plan': { ...base, materials: [{ id: 'material-1', materialName: '수직재', specification: '승인규격 A', approvalReference: 'MAT-APP-001', plannedQuantity: '100', unit: 'EA', deliveryPeriod: '2026-09', inspectionCriteria: ['변형·부식 없음'], storageLocation: '동측 적치장', storageControls: ['전도·침수 방지'] }], deliveryRoute: '동문 반입로', unloadingMethod: '지게차 하역', responsibleWorkerId: 'worker-1', body: 'LEGACY-BODY-SHOULD-NOT-PRINT' },
        'equipment-signal': { ...base, signalerWorkerIds: ['worker-2'], signalMethod: 'combined', communicationChannel: '무전 1번', signalProtocols: [{ id: 'signal-1', situation: '양중 시작', signal: '시작 수신호', issuerRole: '신호수', receiverRole: '운전원' }], accessControlMeasures: ['회전반경 출입통제'], emergencyStopSignal: '양팔 교차·정지 무전' },
        'site-installation-plan': { ...base, drawingReferences: ['D-01 Rev.A'], prerequisites: ['기초상태 확인'], workSequence: sequence, inspectionPoints: ['수직도·간격'], weatherStopCriteria: ['강풍·호우 시 중지'] },
        'concrete-pour-plan': { ...base, designStrength: '24 MPa', pourMethod: 'pump', plannedPourDate: '2026-09-20', pourRate: '20㎥/h', pourSequence: [{ id: 'pour-1', sequence: 1, zone: 'A동 12F', volume: '40㎥', pumpPosition: '동측', monitoringItems: ['침하·변형'] }], concentratedLoadControls: ['편중 타설 금지'], monitoringFrequency: '30분', stopCriteria: ['침하·이상음'] },
        'dismantling-plan': { ...base, strengthEvidenceReference: '압축강도 성적서', approvalReference: 'DIS-APP-001', prerequisites: ['해체 승인'], workSequence: sequence, temporaryStabilityMeasures: ['가새 선행제거 금지'], exclusionZones: ['A동 하부'], materialLoweringMethod: '인양장비 하강', responsibleWorkerId: 'worker-1' },
        'retention-plan': { ...base, retentionZones: [{ id: 'retain-1', zone: 'A동 12F', retainUntilCondition: '설계강도 충족', releaseEvidence: '압축강도 성적서', reshoringRequired: false, reshoringSpecification: '' }], inspectionFrequency: '매일', markingMethod: '보라색 표지', changeTriggers: ['공법·하중 변경'], changeApprovalRoles: ['구조기술자'], drawingRevisionRequired: true, engineeringReviewRequired: true },
        'emergency-plan': { ...base, contacts: [{ id: 'contact-1', organization: '현장 비상대응반', name: '안전담당', phone: '02-0000-0000', role: '초동지휘' }], scenarios: [{ id: 'scenario-1', scenario: '붕괴 징후', initialActions: ['작업중지·대피'], evacuationRoute: '동측 통로', assemblyPoint: '정문 집결지', responsibleRole: '현장책임자' }], alarmMethod: '비상방송·무전', nearestHospital: '인근 종합병원', emergencyEquipment: ['구급함'], reportingChain: ['작업자→현장책임자→본사'] },
        'quality-plan': { ...base, inspectionItems: [{ id: 'inspection-1', stage: '설치', item: '수직도', criterion: '승인도면', method: '레벨', frequency: '구간별', responsibleRole: '품질담당', recordForm: '설치 검측표' }], holdPoints: [{ id: 'hold-1', stage: '타설 전', evidence: '검측표·사진', responsibleRole: '현장책임자', completionCondition: '검측 전 항목 적합', decisionStatus: 'approved', decisionAt: '2026-01-02T01:00:00.000Z', decisionComment: '계획상 타설 전 조건 충족 확인' }], nonconformanceProcess: ['식별→격리→재검사'], recordsRetentionMethod: '문서번호·Rev.별 보존' },
        'safety-plan': { ...base, supervisorWorkerIds: ['worker-3'], toolboxTopics: ['붕괴·추락 예방'], ppeRequirements: [{ id: 'ppe-1', workStage: '설치', item: '안전대', standard: '2중 걸이' }], accessControlMeasures: ['관계자 외 출입금지'], fallPreventionMeasures: ['안전난간'], fallingObjectPreventionMeasures: ['낙하물 방지망'], stopWorkCriteria: ['방호 미설치'], permitTypes: ['고소작업허가'] },
        'environment-plan': { ...base, aspects: [{ id: 'aspect-1', activity: '자재 하역', impact: '소음·분진', controlMeasure: '살수·저속운행', monitoringMethod: '일일점검', responsibleRole: '환경담당' }], wasteSegregation: ['종류별 분리'], dustControls: ['살수'], noiseControls: ['작업시간 준수'], spillResponse: ['흡착포 회수·보고'], complaintContact: '현장 환경담당', monitoringFrequency: '매일' },
    };
    return contents[key];
};

const buildStressFixture = async (): Promise<StressFixture> => {
    const sourceBytes = new Map<string, Buffer>([
        ['drawing-D01', imageBytes('png', 'D-01 PLAN')],
        ['drawing-D02', await pdfBytes()],
        ['drawing-D03', imageBytes('jpeg', 'D-03 SUPPORT')],
        ['drawing-D04', imageBytes('png', 'D-04 BRACE')],
        ['drawing-D05', imageBytes('jpeg', 'D-05 CONNECTION')],
        ['drawing-D06', imageBytes('png', 'D-06 EQUIPMENT')],
    ]);
    const base = buildConstructionPlanDraftDocument({
        id: PLAN_ID,
        seriesId: 'series-field-use-1',
        siteId: 'site-seoul-1',
        siteName: '청연 최대용량 검증현장',
        title: 'A동 시스템동바리 시공계획서',
        documentNo: 'CP-SH-FIELD-001',
        documentDate: '2026-08-22',
        projectSnapshot: {
            siteName: '청연 최대용량 검증현장', address: '서울특별시 중구 안전로 1', clientName: '청연 발주처', contractorName: '청연건설',
            constructionPeriod: { startDate: '2026-09-01', endDate: '2027-03-31' },
            buildings: ['A동'], floors: ['12F'], zones: ['1~4열', '5~8열'], sitePhotos: [], emergencyContactsComplete: true, differsFromMaster: false,
        },
        erpSnapshot: {
            schemaVersion: 1,
            capturedAt: TIMESTAMP,
            site: { value: { id: 'site-seoul-1', name: '청연 최대용량 검증현장', code: 'SITE-SEOUL-1', address: '서울특별시 중구 안전로 1', responsibleTeamId: 'team-1', responsibleTeamName: '동바리팀', clientCompanyId: 'company-client', clientCompanyName: '청연 발주처', contractorCompanyId: 'company-contractor', contractorCompanyName: '청연건설' }, source: 'site', sourceId: 'site-seoul-1', capturedAt: TIMESTAMP, overridden: false },
            clientCompany: { value: { id: 'company-client', name: '청연 발주처', businessNumber: '101-81-00001', representativeName: '김대표', address: '서울 중구', phone: '02-1111-2222', email: 'not-for-pdf@example.invalid', status: 'active' }, source: 'company', sourceId: 'company-client', capturedAt: TIMESTAMP, overridden: false },
            contractorCompany: { value: { id: 'company-contractor', name: '청연건설', businessNumber: '101-81-00002', representativeName: '이대표', address: '서울 종로구', phone: '02-3333-4444', status: 'active' }, source: 'company', sourceId: 'company-contractor', capturedAt: TIMESTAMP, overridden: false },
            responsibleTeam: { value: { id: 'team-1', name: '동바리팀', leaderWorkerId: 'role-worker-1', leaderName: '역할담당자1', companyId: 'company-contractor', companyName: '청연건설', status: 'active' }, source: 'team', sourceId: 'team-1', capturedAt: TIMESTAMP, overridden: false },
        },
        organizationSnapshot: {
            sourceSiteId: 'site-seoul-1',
            assignments: [
                ['site-manager', 'site_manager', '현장책임자'],
                ['construction-manager', 'construction_manager', '공사담당'],
                ['safety-manager', 'safety_manager', '안전담당'],
                ['quality-manager', 'quality_manager', '품질담당'],
                ['equipment-manager', 'equipment_manager', '장비담당'],
                ['team-leader', 'team_leader', '작업반장'],
                ['crew-lead', 'crew_member', '선임작업자'],
                ['crew-support', 'crew_member', '보조작업자'],
            ].map(([id, role, label], index) => ({
                id, role, label, required: index < 3,
                worker: { id: `role-worker-${index + 1}`, name: `역할담당자${index + 1}`, role, position: label, teamId: 'team-1', teamName: '동바리팀', status: 'active' },
                responsibilities: [
                    `${label} 업무 총괄`,
                    index === 0
                        ? '승인도면·구조검토·작업구간·장비동선·위험성평가의 일치 여부를 작업 전 확인하고 변경 또는 이상 발견 시 즉시 작업중지와 재승인 절차를 지휘한다.'
                        : '변경사항 확인',
                ], order: index,
            })),
            additionalWorkers: Array.from({ length: 16 }, (_, index) => ({
                id: `worker-${index + 1}`, name: `추가작업자${String(index + 1).padStart(2, '0')}`, role: 'crew_member',
                position: index === 15 ? '최종 작업자' : '시스템동바리공', teamId: 'team-1', teamName: '동바리팀', status: 'active',
            })),
        },
        participants: { authorIds: ['author-1'], reviewerIds: ['reviewer-1'], approverIds: ['approver-1'] },
        actorId: 'author-1', actorName: '김작성', timestamp: TIMESTAMP,
    });

    const fingerprints = new Map<string, string>();
    sourceBytes.forEach((bytes, id) => fingerprints.set(id, `source:${sha256Hex(bytes)}:page:0`));
    const box = { left: 0, bottom: 0, right: 595.28, top: 841.89 };
    const rotatedOffsetBox = { left: 40, bottom: 60, right: 555.28, top: 780 };
    const imageBox = { left: 0, bottom: 0, right: 800, top: 600 };
    const makeDrawing = (slot: string, mimeType: 'application/pdf' | 'image/png' | 'image/jpeg', annotations: unknown[]) => {
        const id = `drawing-${slot.replace('-', '')}`;
        const bytes = sourceBytes.get(id) as Buffer;
        const sourceSha256 = sha256Hex(bytes);
        const pageCount = mimeType === 'application/pdf' ? 2 : 1;
        return {
            id, planId: PLAN_ID,
            storagePath: `construction-plans/site-seoul-1/${PLAN_ID}/drawings/${id}.${mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'}`,
            sourceSha256, sourceGeneration: String(1700000000000000 + Number(slot.slice(-1))),
            originalFileName: `${slot}-승인도면.${mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'}`,
            mimeType, sizeBytes: bytes.length, pageCount, drawingNo: slot, title: `${slot} 현장 승인도면`, revision: 'A',
            approvalStatus: 'approved', approvalReference: `APP-${slot}`, building: 'A동', floor: '12F', zone: '1~8열',
            applicableZones: ['A동 12F 1~8열'], scaleText: '승인도면 참조', previewStatus: 'ready',
            previewPaths: Array.from({ length: pageCount }, (_, pageIndex) => `construction-plans/site-seoul-1/${PLAN_ID}/previews/${id}/page-${pageIndex + 1}.png`),
            pages: Array.from({ length: pageCount }, (_, pageIndex) => ({
                pageIndex, mediaBoxPt: mimeType === 'application/pdf' ? box : imageBox,
                cropBoxPt: mimeType === 'application/pdf' && pageIndex === 1 ? rotatedOffsetBox : mimeType === 'application/pdf' ? box : imageBox,
                rotation: mimeType === 'application/pdf' && pageIndex === 1 ? 90 : 0,
                pageFingerprint: `source:${sourceSha256}:page:${pageIndex}`,
                previewPath: `construction-plans/site-seoul-1/${PLAN_ID}/previews/${id}/page-${pageIndex + 1}.png`,
                previewGeneration: String(1800000000000000 + pageIndex), previewSha256: String(pageIndex + 1).repeat(64).slice(0, 64),
            })),
            annotations, uploadedBy: 'author-1', uploadedAt: TIMESTAMP,
        };
    };

    const sha = (slot: string) => sha256Hex(sourceBytes.get(`drawing-${slot.replace('-', '')}`) as Buffer);
    const fp = (slot: string, page = 0) => `source:${sha(slot)}:page:${page}`;
    const drawings = [
        makeDrawing('D-01', 'image/png', [
            annotation('D-01', 1, 0, fp('D-01'), 'install', { kind: 'rect', x: 0.08, y: 0.1, w: 0.34, h: 0.25, rotationDeg: 0 }),
            annotation('D-01', 2, 0, fp('D-01'), 'install', { kind: 'rect', x: 0.52, y: 0.2, w: 0.22, h: 0.2, rotationDeg: 0 }),
        ]),
        makeDrawing('D-02', 'application/pdf', [
            annotation('D-02', 1, 0, fp('D-02', 0), 'dismantle', { kind: 'polygon', vertices: [{ x: 0.12, y: 0.12 }, { x: 0.7, y: 0.18 }, { x: 0.55, y: 0.55 }] }),
            annotation('D-02', 2, 1, fp('D-02', 1), 'dismantle', { kind: 'polygon', vertices: [{ x: 0.15, y: 0.75 }, { x: 0.8, y: 0.28 }, { x: 0.7, y: 0.72 }] }),
            annotation('D-02', 3, 1, fp('D-02', 1), 'dismantle', { kind: 'rect', x: 0.12, y: 0.12, w: 0.2, h: 0.18, rotationDeg: 0 }),
        ]),
        makeDrawing('D-03', 'image/jpeg', [
            annotation('D-03', 1, 0, fp('D-03'), 'retain', { kind: 'rect', x: 0.22, y: 0.26, w: 0.4, h: 0.32, rotationDeg: 0 }),
            annotation('D-03', 2, 0, fp('D-03'), 'retain', { kind: 'polygon', vertices: [{ x: 0.55, y: 0.62 }, { x: 0.85, y: 0.62 }, { x: 0.72, y: 0.78 }] }),
        ]),
        makeDrawing('D-04', 'image/png', [
            annotation('D-04', 1, 0, fp('D-04'), 'equipment', { kind: 'polyline', vertices: [{ x: 0.1, y: 0.65 }, { x: 0.42, y: 0.55 }], arrowStart: false, arrowEnd: true }),
            annotation('D-04', 2, 0, fp('D-04'), 'equipment', { kind: 'polyline', vertices: [{ x: 0.5, y: 0.2 }, { x: 0.82, y: 0.58 }], arrowStart: false, arrowEnd: true }),
        ]),
        makeDrawing('D-05', 'image/jpeg', [
            annotation('D-05', 1, 0, fp('D-05'), 'lifting', { kind: 'ellipse', cx: 0.28, cy: 0.28, rx: 0.16, ry: 0.14 }),
            annotation('D-05', 2, 0, fp('D-05'), 'lifting', { kind: 'ellipse', cx: 0.62, cy: 0.55, rx: 0.2, ry: 0.18 }),
        ]),
        makeDrawing('D-06', 'image/png', [
            annotation('D-06', 1, 0, fp('D-06'), 'restricted', { kind: 'rect', x: 0.25, y: 0.27, w: 0.5, h: 0.36, rotationDeg: 0 }),
            annotation('D-06', 2, 0, fp('D-06'), 'restricted', { kind: 'polygon', vertices: [{ x: 0.15, y: 0.72 }, { x: 0.65, y: 0.72 }, { x: 0.58, y: 0.86 }] }),
        ]),
    ];

    const sectionContent: Record<string, Record<string, unknown>> = {
        'equipment-layout': { summary: '장비 배치와 작업동선을 D-06 승인도면으로 확인한다.', drawingId: 'drawing-D06', drawingPageIndex: 0 },
        'connection-details': { summary: '접합 상세와 구조값을 D-05 승인도면으로 확인한다.', drawingId: 'drawing-D05', drawingPageIndex: 0 },
        'drawing-d01': { summary: '평면 설치구간', drawingId: 'drawing-D01', drawingPageIndex: 0 },
        'drawing-d02-elevation': { summary: '입면 해체구간', drawingId: 'drawing-D02', drawingPageIndex: 0 },
        'drawing-d02-section': { summary: '단면 해체구간', drawingId: 'drawing-D02', drawingPageIndex: 1 },
        'drawing-d03-d04': { summary: '지지·보강 상세', drawingPageIndexes: { 'D-03': 0, 'D-04': 0 } },
        'drawing-d05-d06': { summary: '접합·장비간섭 상세', drawingPageIndexes: { 'D-05': 0, 'D-06': 0 } },
    };
    const releasePlan = {
        ...base,
        lineageRootPlanId: 'root-plan-distinct-from-rendered-plan',
        sections: (base.sections as UnknownRecord[]).map((section) => ({
            ...section,
            status: 'complete',
            content: sectionContent[String(section.key)] || structuredSectionContent(String(section.key)) || { summary: `${section.title} 현장 적용계획`, note: '승인조건과 현장 작업절차에 따라 시행한다.' },
        })),
        drawings,
        drawingApplicability: ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'].map((slot) => ({
            drawingSlot: slot, decision: 'applicable', drawingId: `drawing-${slot.replace('-', '')}`, reason: '', reviewedBy: 'reviewer-1',
        })),
        engineeringValues: Array.from({ length: 12 }, (_, index) => ({
            key: `구조기준-${index + 1}`, value: 100 + index, unit: 'mm', sourceDocumentId: `STRUCT-${String(index + 1).padStart(2, '0')}`,
            sourceRevision: 'A', sourcePageOrSection: `S-${101 + index}`, applicableZones: ['A동 12F'],
            verificationStatus: index % 2 ? 'reviewed' : 'approved', verifiedBy: `검토자-${index + 1}`, verifiedAt: TIMESTAMP,
        })),
        equipmentPlan: Array.from({ length: 8 }, (_, index) => ({
            id: `equipment-${index + 1}`, category: ['lifting', 'lifting', 'lifting', 'lifting', 'transport', 'work-at-height', 'assembly', 'measurement'][index],
            equipmentName: `현장장비-${index + 1}`, model: `MODEL-${index + 1}`, registrationNo: `REG-${index + 1}`,
            ratedCapacity: `${10 + index}t`, workRadius: `${5 + index}m`, inspectionValidUntil: '2099-12-31',
            operatorWorkerId: `worker-${index + 1}`, signalerWorkerId: `worker-${index + 2}`,
            workZones: ['A동 12F'], plannedStages: ['반입', '설치'], controlMeasures: ['출입통제', '신호수 배치'],
        })),
        riskAssessments: Array.from({ length: 10 }, (_, index) => ({
            id: `risk-${index + 1}`, workStage: `작업단계-${index + 1}`, hazard: `위험요인-${index + 1}`,
            assessmentMethodVersion: 2, initialProbability: 4, initialSeverity: 5, initialRiskLevel: 'critical',
            residualProbability: 2, residualSeverity: 2, residualRiskLevel: 'low',
            methodReference: '청연이엔지 시스템동바리 5×5 위험성평가 기준 v2',
            reviewTrigger: '공법 또는 설치·해체 순서 변경',
            mitigationMeasures: ['작업구역 통제', '보호구 확인'],
            responsibleWorkerId: `worker-${index + 1}`, verifiedBy: `안전검토자-${index + 1}`,
        })),
    };
    bindPublishedTemplate(releasePlan, 'system-shoring');
    const envelope = buildConstructionPlanReviewSnapshotContent(PLAN_ID, releasePlan, 0);
    const snapshotBytes = Buffer.from(canonicalStringify(envelope), 'utf8');
    const sources = new Map<string, ConstructionPlanFieldUseDrawingSource>();
    drawings.forEach((drawing) => sources.set(drawing.id, {
        bytes: sourceBytes.get(drawing.id) as Buffer,
        storagePath: drawing.storagePath,
        sourceGeneration: drawing.sourceGeneration,
        mimeType: drawing.mimeType,
    }));
    return {
        verifiedSnapshot: verifyApprovedConstructionPlanSnapshot(snapshotBytes, sha256Hex(snapshotBytes), PLAN_ID),
        sources,
    };
};

type UnknownRecord = Record<string, unknown>;

const sourceLoader = (sources: Map<string, ConstructionPlanFieldUseDrawingSource>) => async (
    ref: ConstructionPlanFieldUseDrawingSourceRef,
): Promise<ConstructionPlanFieldUseDrawingSource> => {
    const source = sources.get(ref.drawingId);
    if (!source) throw new Error(`missing-test-source:${ref.drawingId}`);
    return source;
};

const scaffoldFixtureFrom = (fixture: StressFixture): StressFixture => {
    const verifiedSnapshot = JSON.parse(JSON.stringify(fixture.verifiedSnapshot)) as StressFixture['verifiedSnapshot'];
    const content = verifiedSnapshot.content;
    const sourceSections = content.sections as UnknownRecord[];
    const sourceByKey = new Map(sourceSections.map((section) => [String(section.key), section]));
    const grouped = new Map<string, UnknownRecord>();
    SYSTEM_SCAFFOLD_SERVER_TEMPLATE.pages.forEach((page, index) => {
        const sourceKey = SYSTEM_SHORING_SERVER_TEMPLATE.pages[index].sectionKey;
        const source = sourceByKey.get(sourceKey) as UnknownRecord;
        const current = grouped.get(page.sectionKey);
        if (current) {
            (current.pageNumbers as number[]).push(page.pageNumber);
            return;
        }
        let sectionContent = JSON.parse(JSON.stringify(source.content || {})) as UnknownRecord;
        if (page.sectionKey === 'wall-tie-anchorage') {
            sectionContent = { summary: '벽이음·앵커 접합은 D-04 승인도면으로 확인한다.', drawingId: 'drawing-D04', drawingPageIndex: 0 };
        } else if (page.sectionKey === 'work-platform-access-plan') {
            sectionContent = {
                structuredDataVersion: 1, applicableZones: ['A동 12F'], platformWidth: '400mm 이상',
                platformMaterial: '승인 강재발판', platformLoadLimit: '400kg 이하',
                guardrailMeasures: ['상·중간난간 연속 설치'], toeBoardMeasures: ['발끝막이판 연속 설치'],
                accessType: 'stair', accessLocations: ['A동 동측'], openingControls: ['출입구 자동폐쇄'],
                inspectionPoints: ['고정·틈새·단차 확인'], responsibleWorkerId: 'worker-1',
            };
        } else if (page.sectionKey === 'inspection-maintenance-plan') {
            sectionContent = {
                structuredDataVersion: 1, applicableZones: ['A동 12F'], inspectionFrequency: '작업 전 및 강풍 후',
                inspectionItems: ['기초·수직도·체결'], defectResponse: ['사용중지·보수·재검측'],
                weatherStopCriteria: ['강풍·호우 후 재점검'], alterationApprovalRoles: ['현장책임자·안전담당'],
                wallTieChecks: ['앵커·클램프 이완'], platformChecks: ['고정·파손·틈새'],
                recordsRetentionMethod: '일일점검표 보존', responsibleWorkerId: 'worker-1',
            };
        }
        grouped.set(page.sectionKey, {
            ...source,
            id: page.sectionKey,
            key: page.sectionKey,
            title: page.title.replace(/\s*\(\d\/\d\)$/, ''),
            order: page.pageNumber - 1,
            pageNumbers: [page.pageNumber],
            required: page.required,
            status: 'complete',
            content: sectionContent,
        });
    });
    const sections = Array.from(grouped.values());
    Object.assign(content, {
        title: 'A동 시스템비계 시공계획서',
        tradeType: 'system-scaffold',
        templateId: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.templateId,
        templateVersion: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.templateVersion,
        rendererVersion: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.rendererVersion,
        schemaVersion: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.schemaVersion,
        sections,
        sectionOrder: sections.map((section) => section.key),
    });
    bindPublishedTemplate(content, 'system-scaffold');
    verifiedSnapshot.envelope.content = content;
    verifiedSnapshot.snapshotHash = sha256Hex(canonicalStringify(verifiedSnapshot.envelope));
    return { verifiedSnapshot, sources: fixture.sources };
};

const parseAndValidate = async (result: ConstructionPlanFieldUsePdfResult): Promise<string[]> => {
    const raw = result.bytes.toString('latin1');
    assert.equal((raw.match(/\/MediaBox\s*\[\s*0\s+0\s+595\.28(?:0*)?\s+841\.89(?:0*)?\s*\]/g) || []).length, result.pageCount);
    ['/Encrypt', '/JavaScript', '/EmbeddedFile', '/Filespec', '/OpenAction'].forEach((feature) => assert.equal(raw.includes(feature), false, feature));
    const parser = new PDFParse({ data: result.bytes });
    try {
        const info = await parser.getInfo({ parsePageInfo: true });
        const text = await parser.getText();
        assert.equal(info.total, result.pageCount);
        assert.equal(text.total, result.pageCount);
        const outline = info.outline || [];
        assert.deepEqual(outline.map((node) => node.title), [
            '표지', '문서관리', '목차',
            '제1장 일반사항', '제2장 공사개요', '제3장 현장조직 및 업무분장', '제4장 자재계획',
            '제5장 장비계획', '제6장 공종 및 설치기준', '제7장 승인도면', '제8장 구조관리',
            '제9장 현장 작업계획', '제10장 품질·안전·환경관리', '제11장 검측·기록·인수인계',
        ]);
        const outlinePages = outline.flatMap((node) => node.items);
        assert.equal(outlinePages.length, result.pageCount);
        assert.deepEqual(
            outlinePages.map((node) => node.title.slice(0, 2)),
            result.pageManifest.map((page) => String(page.logicalPageNumber).padStart(2, '0')),
        );
        [...outline, ...outlinePages].forEach((node) => assert.notEqual(node.dest, null));
        const pageTexts = text.pages.map((page) => page.text);
        const audit = validateConstructionPlanFieldUseAuditPages(pageTexts, result);
        assert.equal(audit.valid, true, JSON.stringify(audit.issues));
        return pageTexts;
    } finally {
        await parser.destroy();
    }
};

const manifestPage = (
    result: ConstructionPlanFieldUsePdfResult,
    logicalPageNumber: number,
) => result.pageManifest.find((page) => page.logicalPageNumber === logicalPageNumber && page.continuationIndex === 0) as ConstructionPlanFieldUsePdfResult['pageManifest'][number];

const logicalPageText = (
    result: ConstructionPlanFieldUsePdfResult,
    pageTexts: readonly string[],
    logicalPageNumber: number,
): string => result.pageManifest
    .flatMap((page, index) => page.logicalPageNumber === logicalPageNumber ? [pageTexts[index]] : [])
    .join('\n');

const writeDynamicQaArtifacts = async (
    qaDirectory: string,
    prefix: string,
    candidate: ConstructionPlanFieldUsePdfResult,
    issued: ConstructionPlanFieldUsePdfResult,
): Promise<void> => {
    mkdirSync(qaDirectory, { recursive: true });
    writeFileSync(join(qaDirectory, `${prefix}-candidate.pdf`), candidate.bytes);
    writeFileSync(join(qaDirectory, `${prefix}-issued.pdf`), issued.bytes);
    const lastPhysicalForLogical = (logicalPageNumber: number): number => {
        const pages = issued.pageManifest.filter((page) => page.logicalPageNumber === logicalPageNumber);
        assert.ok(pages.length > 0, `missing logical page ${logicalPageNumber}`);
        return pages[pages.length - 1].physicalPageNumber;
    };
    const selectedPages = [...new Set([
        1,
        manifestPage(issued, 7).physicalPageNumber,
        lastPhysicalForLogical(7),
        lastPhysicalForLogical(9),
        lastPhysicalForLogical(31),
        lastPhysicalForLogical(36),
        issued.pageCount,
    ])].sort((left, right) => left - right);
    const parser = new PDFParse({ data: issued.bytes });
    try {
        const thumbnails = await parser.getScreenshot({
            partial: selectedPages,
            desiredWidth: 300,
            imageBuffer: true,
            imageDataUrl: false,
        });
        const contact = createCanvas(900, Math.ceil(selectedPages.length / 3) * 430);
        const context = contact.getContext('2d');
        context.fillStyle = '#dbe4ea';
        context.fillRect(0, 0, contact.width, contact.height);
        for (let index = 0; index < thumbnails.pages.length; index += 1) {
            const image = await loadImage(Buffer.from(thumbnails.pages[index].data));
            const column = index % 3;
            const row = Math.floor(index / 3);
            context.drawImage(image, (column * 300) + 8, (row * 430) + 8, 284, 402);
        }
        writeFileSync(join(qaDirectory, `${prefix}-contact-sheet.png`), contact.toBuffer('image/png'));
        const highResolution = await parser.getScreenshot({
            partial: selectedPages,
            desiredWidth: 1200,
            imageBuffer: true,
            imageDataUrl: false,
        });
        highResolution.pages.forEach((page, index) => {
            const manifest = issued.pageManifest[selectedPages[index] - 1];
            writeFileSync(join(
                qaDirectory,
                `${prefix}-physical-${String(selectedPages[index]).padStart(3, '0')}`
                    + `-logical-${String(manifest.logicalPageNumber).padStart(2, '0')}`
                    + `-continuation-${manifest.continuationIndex}-1200.png`,
            ), Buffer.from(page.data));
        });
    } finally {
        await parser.destroy();
    }
};

const assertRotatedOffsetDrawingAnnotationQuadrant = async (result: ConstructionPlanFieldUsePdfResult): Promise<void> => {
    const parser = new PDFParse({ data: result.bytes });
    try {
        const physicalPage = manifestPage(result, 25).physicalPageNumber;
        const screenshot = await parser.getScreenshot({ partial: [physicalPage], desiredWidth: 1240, imageBuffer: true, imageDataUrl: false });
        assert.equal(screenshot.pages.length, 1);
        const image = await loadImage(Buffer.from(screenshot.pages[0].data));
        const canvas = createCanvas(1240, 1754);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, 1240, 1754);
        const pixels = context.getImageData(245, 590, 150, 190).data;
        let dismantleOrangePixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index]; const green = pixels[index + 1]; const blue = pixels[index + 2]; const alpha = pixels[index + 3];
            if (alpha > 180 && red > 220 && green > 110 && green < 230 && blue < 205
                && red > green + 25 && green > blue + 12) dismantleOrangePixels += 1;
        }
        assert.ok(
            dismantleOrangePixels > 20,
            `rotated normalized top-left dismantle annotation missing: ${dismantleOrangePixels}`,
        );
    } finally {
        await parser.destroy();
    }
};

test('field-use renderer keeps the existing bounded fixture at exactly 42 physical A4 pages', async () => {
    const fixture = await buildStressFixture();
    const loadDrawingSource = sourceLoader(fixture.sources);
    const candidate = await renderConstructionPlanFieldUsePdf({
        profile: 'candidate', verifiedSnapshot: fixture.verifiedSnapshot, ...approvalBinding(fixture.verifiedSnapshot), loadDrawingSource,
    });
    const issued = await renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: fixture.verifiedSnapshot, ...approvalBinding(fixture.verifiedSnapshot), loadDrawingSource,
    });
    assert.equal(candidate.releaseEligible, false);
    assert.equal(issued.releaseEligible, true);
    assertConstructionPlanFieldUseReleaseEligible(issued);
    assert.equal(issued.drawingRenderMode, CONSTRUCTION_PLAN_FIELD_USE_DRAWING_RENDER_MODE);
    assert.match(issued.bytes.toString('latin1'), /\/Subtype\s*\/Form/);
    ['contentManifestHash', 'drawingBindingHash', 'rendererTemplateBundleHash', 'rendererBuildHash', 'zeroOmissionCoverageHash']
        .forEach((field) => assert.equal(candidate[field as keyof typeof candidate], issued[field as keyof typeof issued], field));
    assert.notEqual(candidate.renderInputHash, issued.renderInputHash);
    assert.notEqual(candidate.sha256, issued.sha256);
    assert.equal(issued.pageCount, 42);
    assert.deepEqual(issued.pageManifest.map((page) => page.pageNumber), Array.from({ length: issued.pageCount }, (_, index) => index + 1));
    assert.deepEqual(candidate.pageManifest, issued.pageManifest);
    assert.deepEqual(manifestPage(issued, 10).drawingBindings.map((binding) => binding.slot), ['D-06']);
    assert.deepEqual(manifestPage(issued, 21).drawingBindings.map((binding) => binding.slot), ['D-05']);
    assert.deepEqual(manifestPage(issued, 26).drawingBindings.map((binding) => binding.slot), ['D-03', 'D-04']);
    assert.deepEqual(manifestPage(issued, 27).drawingBindings.map((binding) => binding.slot), ['D-05', 'D-06']);
    assert.equal(manifestPage(issued, 24).drawingBindings[0].pageIndex, 0);
    assert.equal(manifestPage(issued, 25).drawingBindings[0].pageIndex, 1);
    assert.deepEqual(manifestPage(issued, 25).drawingBindings[0].cropBoxPt, { left: 40, bottom: 60, right: 555.28, top: 780 });
    assert.equal(manifestPage(issued, 25).drawingBindings[0].rotation, 90);
    assert.equal(issued.coverageLedger.some((entry) => entry.disposition === 'rejected'), false);
    assert.equal(new Set(issued.coverageLedger.map((entry) => entry.path)).size, issued.coverageLedger.length);
    assert.ok(issued.coverageLedger.some((entry) => entry.path.endsWith('.sourceGeneration') && entry.disposition === 'audit'));
    assert.ok(issued.coverageLedger.some((entry) => entry.path.includes('.previewPaths') && entry.disposition === 'control'));
    assert.ok(issued.coverageLedger.some((entry) => entry.path.endsWith('.content.body') && entry.disposition === 'audit'));
    assert.ok(issued.coverageLedger.some((entry) => entry.path.endsWith('.value.email') && entry.disposition === 'audit'));

    const [candidateText, issuedText] = await Promise.all([parseAndValidate(candidate), parseAndValidate(issued)]);
    const logicalText = (pageNumber: number) => logicalPageText(issued, issuedText, pageNumber);
    assert.match(candidateText[0], /발행 후보/);
    assert.match(issuedText[0], /현장사용 발행본/);
    assert.match(issuedText[0], /계획서 ID/);
    assert.match(issuedText[0], new RegExp(PLAN_ID));
    assert.match(issuedText[0], /공종\s*시스템동바리/);
    assert.equal(issuedText[0].includes('system-shoring'), false);
    assert.match(issuedText[0], /결재 · 작성/);
    assert.match(issuedText[0], /김작성/);
    assert.match(issuedText[0], /박검토/);
    assert.match(issuedText[0], /이승인/);
    assert.match(logicalText(2), /작성자/);
    assert.match(logicalText(2), /검토자/);
    assert.match(logicalText(2), /승인자/);
    assert.equal(issuedText[0].includes('author-1'), false);
    assert.equal(logicalText(2).includes('author-1'), false);
    assert.match(logicalText(2), /root-plan-distinct-from-rendered-plan/);
    assert.match(logicalText(7), /추가작업자16/);
    assert.match(logicalText(7), /재승인 절차를 지휘한다/);
    assert.match(logicalText(6), /ERP 발주사 원천/);
    assert.match(logicalText(6), /101-81-00001/);
    assert.match(logicalText(6), /02-1111-2222/);
    assert.match(logicalText(8), /자재 1 · 수직재/);
    assert.match(logicalText(8), /반입동선·하역방법/);
    assert.match(logicalText(9), /현장장비-8/);
    assert.match(logicalText(9), /측정·검측장비/);
    assert.match(logicalText(11), /양중장비 전용 작업계획/);
    assert.match(logicalText(17), /구조기준-12/);
    assert.match(logicalText(21), /도면 페이지\s+1쪽/);
    assert.match(logicalText(22), /D-06/);
    assert.match(logicalText(22), /D-06-승인도면\.png/);
    assert.match(logicalText(22), /A동 \/ 12F \/ 1~8열/);
    assert.match(logicalText(10), /responsibleWorkerId 지정됨/);
    assert.match(logicalText(10), /담당역할 통제담당/);
    assert.match(logicalText(24), /도면 페이지\s+1쪽/);
    assert.match(logicalText(25), /도면 페이지\s+2쪽/);
    assert.match(logicalText(24), /D-02 SOURCE PAGE 1/);
    assert.match(logicalText(25), /D-02 SOURCE PAGE 2/);
    const standardStyleText = /선색 파랑 · 채움 연파랑 · 굵기 2pt · 불투\s*명도 1 · 선형 실선 · 해치 없음/;
    assert.match(logicalText(26), standardStyleText);
    assert.match(logicalPageText(candidate, candidateText, 26), standardStyleText);
    assert.match(logicalText(26), /원본 SHA-256 [a-f0-9]{16}… · 원본 버전 1700000000000003/);
    assert.match(logicalText(26), /해제조건 승인 구조강도 확인 후 해제/);
    assert.match(logicalText(26), /장비종류 이동식 크레인/);
    assert.match(logicalText(26), /장비 식별 equipment-1/);
    assert.match(logicalText(26), /선색 빨강 · 채움 연빨강 .* 해치 사선/);
    assert.match(logicalText(36), /위험요인-10/);
    assert.match(logicalText(36), /5×5 v2/);
    assert.match(logicalText(36), /4×5=20점\(매우 높음\)/);
    assert.match(logicalText(30), /설치 순서 1/);
    assert.match(logicalText(31), /강도·타설방법/);
    assert.match(logicalText(32), /강도확인·해체 승인근거/);
    assert.match(logicalText(33), /존치구간 1/);
    assert.match(logicalText(34), /품질 검측 1/);
    assert.match(logicalText(34), /완료조건 검측 전 항목 적합/);
    assert.match(logicalText(34), /계획상 결정 승인/);
    assert.match(logicalText(34), /결정시각 2026-01-02T01:00:00.000Z/);
    assert.match(logicalText(35), /보호구 1/);
    assert.match(logicalText(37), /비상상황 1/);
    assert.match(logicalText(38), /환경항목 1/);
    assert.match(logicalText(15), /하중전달/);
    assert.match(logicalText(34), /ITP/);
    assert.match(logicalText(38), /5S/);
    assert.match(logicalText(36), /템플릿 위험성평가 계산식/);
    assert.match(logicalText(36), /잔여 위험 허용기준/);
    assert.match(logicalText(36), /재검토 트리거/);
    assert.match(logicalText(36), /1~4점 낮음/);
    assert.equal(issuedText.join('\n').includes('CORE_VALUE='), false);
    assert.equal(issuedText.join('\n').includes('CORE_PATH='), false);
    assert.equal(issuedText.join('\n').includes('construction-plans/site-seoul-1'), false);
    assert.equal(issuedText.join('\n').includes('LEGACY-BODY-SHOULD-NOT-PRINT'), false);
    assert.equal(issuedText.join('\n').includes('not-for-pdf@example.invalid'), false);
    assert.equal(issuedText.join('\n').includes('restricted-worker-private-'), false);
    assert.equal(issued.bytes.toString('latin1').includes('restricted-worker-private-'), false);
    assert.equal(issuedText.join('\n').includes('structuredDataVersion'), false);
    assert.equal(issuedText.join('\n').includes('material-plan'), false);
    assert.equal(issuedText.join('\n').includes('"materials"'), false);
    assert.ok(issuedText.join('\n').length < 120_000, `search text unexpectedly large: ${issuedText.join('\n').length}`);
    assert.match(logicalText(28), /Hold Point 결정 기록/);
    assert.match(logicalText(28), /조건부 승인/);
    assert.match(logicalText(42), /인수인계 서명 및 미결사항 기록/);
    assert.match(logicalText(42), /안전관리자 성명·소속·일시·서명/);
    await assertRotatedOffsetDrawingAnnotationQuadrant(issued);

    const retry = await renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: fixture.verifiedSnapshot, ...approvalBinding(fixture.verifiedSnapshot), loadDrawingSource,
    });
    assert.equal(retry.sha256, issued.sha256);
    assert.deepEqual(retry.bytes, issued.bytes);

    const qaDirectory = process.env.CONSTRUCTION_PLAN_FIELD_USE_QA_DIR;
    if (qaDirectory) {
        mkdirSync(qaDirectory, { recursive: true });
        writeFileSync(join(qaDirectory, 'construction-plan-field-use-candidate.pdf'), candidate.bytes);
        writeFileSync(join(qaDirectory, 'construction-plan-field-use-issued.pdf'), issued.bytes);
        const selectedPages = [1, 2, 6, 7, 9, 10, 11, 17, 21, 22, 23, 24, 25, 26, 27, 28, 36, 39, 40, 41, 42];
        const parser = new PDFParse({ data: issued.bytes });
        try {
            const screenshots = await parser.getScreenshot({ partial: selectedPages, desiredWidth: 300, imageBuffer: true, imageDataUrl: false });
            const contact = createCanvas(1200, Math.ceil(selectedPages.length / 4) * 430);
            const context = contact.getContext('2d');
            context.fillStyle = '#dbe4ea'; context.fillRect(0, 0, contact.width, contact.height);
            for (let index = 0; index < screenshots.pages.length; index += 1) {
                const page = screenshots.pages[index];
                const bytes = Buffer.from(page.data);
                writeFileSync(join(qaDirectory, `issued-page-${String(selectedPages[index]).padStart(2, '0')}.png`), bytes);
                const image = await loadImage(bytes);
                const column = index % 4; const row = Math.floor(index / 4);
                context.drawImage(image, (column * 300) + 8, (row * 430) + 8, 284, 402);
            }
            writeFileSync(join(qaDirectory, 'construction-plan-field-use-contact-sheet.png'), contact.toBuffer('image/png'));
            const highResolutionPages = [1, 2, 7, 9, 17, 21, 22, 26, 27, 28, 36, 39, 41, 42];
            const highResolution = await parser.getScreenshot({ partial: highResolutionPages, desiredWidth: 1200, imageBuffer: true, imageDataUrl: false });
            highResolution.pages.forEach((page, index) => {
                writeFileSync(join(qaDirectory, `issued-page-${String(highResolutionPages[index]).padStart(2, '0')}-1200.png`), Buffer.from(page.data));
            });
        } finally {
            await parser.destroy();
        }
    }
});

const expandRepeatedRows = (fixture: StressFixture): StressFixture => {
    const verifiedSnapshot = JSON.parse(JSON.stringify(fixture.verifiedSnapshot)) as StressFixture['verifiedSnapshot'];
    const content = verifiedSnapshot.content;
    const organization = content.organizationSnapshot as UnknownRecord;
    const workerSource = (organization.additionalWorkers as UnknownRecord[])[0];
    organization.additionalWorkers = Array.from({ length: 48 }, (_, index) => ({
        ...workerSource,
        id: `overflow-worker-${index + 1}`,
        name: `대용량작업자${String(index + 1).padStart(2, '0')}`,
        position: index === 47 ? '연속페이지 최종 작업자' : '시스템동바리공',
    }));

    const engineeringSource = (content.engineeringValues as UnknownRecord[])[0];
    content.engineeringValues = Array.from({ length: 40 }, (_, index) => ({
        ...engineeringSource,
        key: `대용량구조기준-${index + 1}`,
        value: 200 + index,
        sourceDocumentId: `STRUCT-OVERFLOW-${String(index + 1).padStart(2, '0')}`,
        sourcePageOrSection: `S-${index + 1}`,
    }));

    const equipmentSource = content.equipmentPlan as UnknownRecord[];
    const categories = ['lifting', 'transport', 'work-at-height', 'assembly', 'measurement'];
    content.equipmentPlan = Array.from({ length: 25 }, (_, index) => ({
        ...equipmentSource[index % equipmentSource.length],
        id: `overflow-equipment-${index + 1}`,
        category: categories[index % categories.length],
        equipmentName: `대용량장비-${index + 1}`,
        model: `OVERFLOW-MODEL-${index + 1}`,
        registrationNo: `OVERFLOW-REG-${index + 1}`,
    }));

    const riskSource = content.riskAssessments as UnknownRecord[];
    content.riskAssessments = Array.from({ length: 30 }, (_, index) => ({
        ...riskSource[index % riskSource.length],
        id: `overflow-risk-${index + 1}`,
        workStage: `대용량작업단계-${index + 1}`,
        hazard: `대용량위험요인-${index + 1}`,
    }));

    const repeatedRowKeys = [
        'materials', 'signalProtocols', 'workSequence', 'pourSequence', 'retentionZones',
        'contacts', 'scenarios', 'inspectionItems', 'holdPoints', 'ppeRequirements', 'aspects',
    ];
    (content.sections as UnknownRecord[]).forEach((section) => {
        if (!isUnknownRecord(section.content)) return;
        const sectionContent = section.content as UnknownRecord;
        repeatedRowKeys.forEach((key) => {
            const sourceRows = sectionContent[key];
            if (!Array.isArray(sourceRows) || sourceRows.length === 0) return;
            if (!sourceRows.every((source) => isUnknownRecord(source))) return;
            sectionContent[key] = Array.from({ length: 18 }, (_, index) => {
                const source = sourceRows[index % sourceRows.length] as UnknownRecord;
                return {
                    ...source,
                    ...(typeof source.id === 'string' ? { id: `${key}-overflow-${index + 1}` } : {}),
                    ...(source.sequence !== undefined ? { sequence: index + 1 } : {}),
                };
            });
        });
    });
    verifiedSnapshot.envelope.content = content;
    verifiedSnapshot.snapshotHash = sha256Hex(canonicalStringify(verifiedSnapshot.envelope));
    return { verifiedSnapshot, sources: fixture.sources };
};

test('field-use renderer partitions large repeated rows into a shared candidate/issued physical manifest without omission', async () => {
    const fixture = expandRepeatedRows(await buildStressFixture());
    const loadDrawingSource = sourceLoader(fixture.sources);
    const candidate = await renderConstructionPlanFieldUsePdf({
        profile: 'candidate',
        verifiedSnapshot: fixture.verifiedSnapshot,
        ...approvalBinding(fixture.verifiedSnapshot),
        loadDrawingSource,
    });
    const issued = await renderConstructionPlanFieldUsePdf({
        profile: 'issued',
        verifiedSnapshot: fixture.verifiedSnapshot,
        ...approvalBinding(fixture.verifiedSnapshot),
        loadDrawingSource,
    });
    assert.ok(issued.pageCount > 42 && issued.pageCount <= 200, String(issued.pageCount));
    assert.equal(candidate.pageCount, issued.pageCount);
    assert.deepEqual(candidate.pageManifest, issued.pageManifest);
    assert.equal(candidate.contentManifestHash, issued.contentManifestHash);
    assert.ok(issued.pageManifest.some((page) => page.continuationIndex > 0));
    assert.deepEqual(
        issued.pageManifest.map((page) => page.physicalPageNumber),
        Array.from({ length: issued.pageCount }, (_, index) => index + 1),
    );
    assert.equal(new Set(issued.pageManifest.map((page) => page.logicalPageNumber)).size, 42);
    const manifestCoverage = issued.pageManifest.flatMap((page) => page.coveragePaths);
    assert.equal(new Set(manifestCoverage).size, manifestCoverage.length);
    assert.deepEqual(
        [...manifestCoverage].sort(),
        issued.coverageLedger.map((entry) => entry.path).sort(),
    );

    const pageTexts = await parseAndValidate(issued);
    const logicalText = (pageNumber: number) => logicalPageText(issued, pageTexts, pageNumber);
    assert.match(logicalText(7), /대용량작업자48/);
    assert.match(logicalText(9), /대용량장비-25/);
    assert.match(logicalText(17), /대용량구조기준-40/);
    assert.match(logicalText(36), /대용량위험요인-30/);
    assert.match(logicalText(8), /자재 18/);
    assert.ok(issued.pageManifest
        .filter((page) => page.continuationIndex > 0)
        .every((page) => pageTexts[page.physicalPageNumber - 1].includes(`계속 ${page.continuationIndex}`)));
    assert.ok(issued.pageManifest
        .filter((page) => page.logicalPageNumber === 36 && page.continuationIndex > 0)
        .every((page) => /대용량위험요인-\d+/.test(pageTexts[page.physicalPageNumber - 1])));
    const page8Start = manifestPage(issued, 8).physicalPageNumber;
    assert.match(`${logicalText(3)}\n${logicalText(4)}`, new RegExp(`${page8Start}쪽`));
    const qaDirectory = process.env.CONSTRUCTION_PLAN_FIELD_USE_QA_DIR;
    if (qaDirectory) {
        await writeDynamicQaArtifacts(qaDirectory, 'construction-plan-dynamic-shoring', candidate, issued);
    }
});

test('field-use renderer keeps scaffold stress candidate/issued continuations identical without shoring reinterpretation', async () => {
    const fixture = expandRepeatedRows(scaffoldFixtureFrom(await buildStressFixture()));
    const loadDrawingSource = sourceLoader(fixture.sources);
    const candidate = await renderConstructionPlanFieldUsePdf({
        profile: 'candidate',
        verifiedSnapshot: fixture.verifiedSnapshot,
        ...approvalBinding(fixture.verifiedSnapshot),
        loadDrawingSource,
    });
    const issued = await renderConstructionPlanFieldUsePdf({
        profile: 'issued',
        verifiedSnapshot: fixture.verifiedSnapshot,
        ...approvalBinding(fixture.verifiedSnapshot),
        loadDrawingSource,
    });
    assert.ok(issued.pageCount > 42 && issued.pageCount <= 200, String(issued.pageCount));
    assert.equal(candidate.pageCount, issued.pageCount);
    assert.deepEqual(candidate.pageManifest, issued.pageManifest);
    assert.equal(candidate.contentManifestHash, issued.contentManifestHash);
    assert.equal(new Set(issued.pageManifest.map((page) => page.logicalPageNumber)).size, 42);
    const coverage = issued.pageManifest.flatMap((page) => page.coveragePaths);
    assert.equal(new Set(coverage).size, coverage.length);
    const pageTexts = await parseAndValidate(issued);
    assert.match(logicalPageText(issued, pageTexts, 7), /대용량작업자48/);
    assert.match(logicalPageText(issued, pageTexts, 9), /대용량장비-25/);
    assert.match(logicalPageText(issued, pageTexts, 17), /대용량구조기준-40/);
    assert.match(logicalPageText(issued, pageTexts, 31), /작업발판 규격/);
    assert.match(logicalPageText(issued, pageTexts, 33), /벽이음 점검항목/);
    assert.equal(logicalPageText(issued, pageTexts, 31).includes('콘크리트 타설계획'), false);
    assert.equal(logicalPageText(issued, pageTexts, 33).includes('존치 및 재동바리 계획'), false);
    const qaDirectory = process.env.CONSTRUCTION_PLAN_FIELD_USE_QA_DIR;
    if (qaDirectory) {
        await writeDynamicQaArtifacts(qaDirectory, 'construction-plan-dynamic-scaffold', candidate, issued);
    }
});

test('field-use renderer rejects an indivisible multiline equipment row with an actionable source path', async () => {
    const fixture = await buildStressFixture();
    const content = fixture.verifiedSnapshot.envelope.content as UnknownRecord;
    const equipment = (content.equipmentPlan as UnknownRecord[])[0];
    equipment.controlMeasures = [
        Array.from({ length: 140 }, (_, index) => `통제대책 ${index + 1} · 작업반경 확인 · 유도자 배치`).join('\n'),
    ];
    fixture.verifiedSnapshot.snapshotHash = sha256Hex(canonicalStringify(fixture.verifiedSnapshot.envelope));

    await assert.rejects(
        () => renderConstructionPlanFieldUsePdf({
            profile: 'candidate',
            verifiedSnapshot: fixture.verifiedSnapshot,
            ...approvalBinding(fixture.verifiedSnapshot),
            loadDrawingSource: sourceLoader(fixture.sources),
        }),
        /construction-plan-field-use-continuation-row-too-tall:logical-page-9:equipmentPlan\[0\]/,
    );
});

test('field-use renderer rejects a maximum-volume structured record instead of clipping it', async () => {
    const fixture = await buildStressFixture();
    const content = fixture.verifiedSnapshot.envelope.content as UnknownRecord;
    const materialSection = (content.sections as UnknownRecord[])
        .find((section) => section.key === 'material-plan');
    assert.ok(materialSection && isUnknownRecord(materialSection.content));
    const materialContent = materialSection.content as UnknownRecord;
    materialContent.materials = [{
        id: 'M'.repeat(240),
        materialName: '자'.repeat(240),
        specification: '규'.repeat(240),
        approvalReference: '승'.repeat(240),
        plannedQuantity: '1'.repeat(240),
        unit: '단'.repeat(240),
        deliveryPeriod: '기'.repeat(240),
        inspectionCriteria: Array.from({ length: 8 }, (_, index) => `${index}${'검'.repeat(159)}`),
        storageLocation: '적'.repeat(240),
        storageControls: Array.from({ length: 8 }, (_, index) => `${index}${'통'.repeat(159)}`),
    }];
    fixture.verifiedSnapshot.snapshotHash = sha256Hex(canonicalStringify(fixture.verifiedSnapshot.envelope));

    await assert.rejects(
        () => renderConstructionPlanFieldUsePdf({
            profile: 'candidate',
            verifiedSnapshot: fixture.verifiedSnapshot,
            ...approvalBinding(fixture.verifiedSnapshot),
            loadDrawingSource: sourceLoader(fixture.sources),
        }),
        /construction-plan-field-use-continuation-row-too-tall:logical-page-8:sections\.material-plan\.structuredRows\[/,
    );
});

test('field-use renderer composes the independent scaffold logical contract and D-04 wall-tie page', async () => {
    const fixture = scaffoldFixtureFrom(await buildStressFixture());
    const result = await renderConstructionPlanFieldUsePdf({
        profile: 'issued',
        verifiedSnapshot: fixture.verifiedSnapshot,
        ...approvalBinding(fixture.verifiedSnapshot),
        loadDrawingSource: sourceLoader(fixture.sources),
    });
    const pageTexts = await parseAndValidate(result);
    const logicalText = (pageNumber: number) => logicalPageText(result, pageTexts, pageNumber);
    assert.equal(result.pageManifest.length, result.pageCount);
    assert.equal(manifestPage(result, 21).sectionKey, 'wall-tie-anchorage');
    assert.deepEqual(manifestPage(result, 21).drawingBindings.map((binding) => binding.slot), ['D-04']);
    assert.equal(manifestPage(result, 31).sectionKey, 'work-platform-access-plan');
    assert.equal(manifestPage(result, 33).sectionKey, 'inspection-maintenance-plan');
    assert.equal(manifestPage(result, 40).sectionKey, 'scaffold-daily-log');
    assert.match(pageTexts[0], /시스템비계 시공계획서/);
    assert.match(pageTexts[0], /공종\s*시스템비계/);
    assert.equal(pageTexts[0].includes('system-scaffold'), false);
    assert.match(logicalText(3), /시스템비계 개요/);
    assert.match(logicalText(21), /벽이음·앵커 접합/);
    assert.match(logicalText(21), /D-04/);
    assert.match(logicalText(31), /작업발판 규격/);
    assert.match(logicalText(31), /승강통로 형식·위치/);
    assert.match(logicalText(33), /벽이음 점검항목/);
    assert.match(logicalText(40), /기초·받침 침하 여부/);
    assert.equal(logicalText(31).includes('콘크리트 타설계획'), false);
    assert.equal(logicalText(33).includes('존치 및 재동바리 계획'), false);

    const qaDirectory = process.env.CONSTRUCTION_PLAN_FIELD_USE_QA_DIR;
    if (qaDirectory) {
        mkdirSync(qaDirectory, { recursive: true });
        writeFileSync(join(qaDirectory, 'construction-plan-scaffold-issued.pdf'), result.bytes);
        const selectedPages = [1, 21, 31, 33, 40];
        const parser = new PDFParse({ data: result.bytes });
        try {
            const screenshots = await parser.getScreenshot({
                partial: selectedPages,
                desiredWidth: 1200,
                imageBuffer: true,
                imageDataUrl: false,
            });
            screenshots.pages.forEach((page, index) => {
                writeFileSync(
                    join(qaDirectory, `scaffold-page-${String(selectedPages[index]).padStart(2, '0')}-1200.png`),
                    Buffer.from(page.data),
                );
            });
        } finally {
            await parser.destroy();
        }
    }
});

test('field-use renderer hides approval account ids when legacy evidence has no display names', async () => {
    const fixture = await buildStressFixture();
    const binding = approvalBinding(fixture.verifiedSnapshot);
    delete binding.approvalEvidence.completedByName;
    delete binding.approvalEvidence.completedAt;
    delete binding.approvalEvidence.approverName;
    binding.approvalEvidenceHash = sha256Hex(canonicalStringify(binding.approvalEvidence));
    const result = await renderConstructionPlanFieldUsePdf({
        profile: 'issued',
        verifiedSnapshot: fixture.verifiedSnapshot,
        ...binding,
        loadDrawingSource: sourceLoader(fixture.sources),
    });
    const pageTexts = await parseAndValidate(result);
    assert.match(logicalPageText(result, pageTexts, 1), /결재 · 검토\s+기록 없음/);
    assert.match(logicalPageText(result, pageTexts, 1), /결재 · 승인\s+기록 없음/);
    assert.match(logicalPageText(result, pageTexts, 2), /검토자\s+기록 없음/);
    assert.match(logicalPageText(result, pageTexts, 2), /승인자\s+기록 없음/);
    assert.equal(logicalPageText(result, pageTexts, 1).includes('approver-1'), false);
    assert.equal(logicalPageText(result, pageTexts, 2).includes('reviewer-1'), false);
});

test('field-use renderer fails closed for unknown section data, mutable photos, and unreferenced annotation drawings', async () => {
    const fixture = await buildStressFixture();
    const clone = (): ReturnType<typeof verifyApprovedConstructionPlanSnapshot> => JSON.parse(JSON.stringify(fixture.verifiedSnapshot));
    const rebind = (verified: ReturnType<typeof verifyApprovedConstructionPlanSnapshot>) => {
        verified.envelope.content = verified.content;
        verified.snapshotHash = sha256Hex(canonicalStringify(verified.envelope));
        return verified;
    };
    const unknown = clone();
    (unknown.content.sections as UnknownRecord[])[4].content = { unsupported: 'silent loss' };
    rebind(unknown);
    await assert.rejects(() => renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: unknown, ...approvalBinding(unknown), loadDrawingSource: sourceLoader(fixture.sources),
    }), /section-content-unknown/);

    const structuredPrivacyBypass = clone();
    const emergencySection = (structuredPrivacyBypass.content.sections as UnknownRecord[])
        .find((section) => section.key === 'emergency-plan') as UnknownRecord;
    const emergencyContent = emergencySection.content as UnknownRecord;
    (emergencyContent.contacts as UnknownRecord[])[0].residentRegistrationNumber = 'not-allowed';
    rebind(structuredPrivacyBypass);
    await assert.rejects(() => renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: structuredPrivacyBypass, ...approvalBinding(structuredPrivacyBypass), loadDrawingSource: sourceLoader(fixture.sources),
    }), /structured-section-invalid:emergency-plan:shape:contacts\.0\.residentRegistrationNumber/);

    const unknownEntityLeaf = clone();
    (unknownEntityLeaf.content.engineeringValues as UnknownRecord[])[0].unclassified = 'must fail';
    rebind(unknownEntityLeaf);
    await assert.rejects(() => renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: unknownEntityLeaf, ...approvalBinding(unknownEntityLeaf), loadDrawingSource: sourceLoader(fixture.sources),
    }), /record-field-unknown:engineeringValues\[0\]:unclassified/);

    const photos = clone();
    (photos.content.projectSnapshot as UnknownRecord).sitePhotos = ['https://mutable.invalid/photo.jpg'];
    rebind(photos);
    await assert.rejects(() => renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: photos, ...approvalBinding(photos), loadDrawingSource: sourceLoader(fixture.sources),
    }), /immutable-photo-artifact-required/);

    const unreferenced = clone();
    const firstDrawing = (unreferenced.content.drawings as UnknownRecord[])[0];
    (unreferenced.content.drawings as UnknownRecord[]).push({ ...firstDrawing, id: 'orphan-drawing', annotations: firstDrawing.annotations });
    rebind(unreferenced);
    await assert.rejects(() => renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: unreferenced, ...approvalBinding(unreferenced), loadDrawingSource: sourceLoader(fixture.sources),
    }), /unreferenced-annotation-drawing/);

    const annotationCases: Array<[string, (annotationValue: UnknownRecord, verified: ReturnType<typeof verifyApprovedConstructionPlanSnapshot>) => void, RegExp]> = [
        ['unknown top-level field', (value) => { value.unclassified = true; }, /annotation-field-unknown/],
        ['unknown style field', (value) => { (value.style as UnknownRecord).unclassified = true; }, /annotation-style-unknown/],
        ['oversized font', (value) => { (value.style as UnknownRecord).fontSizePt = 10_000; }, /annotation-style-invalid/],
        ['timestamp without offset', (value) => { value.createdAt = '2026-08-22T00:00:00'; }, /annotation-provenance-invalid/],
        ['non-positive sequence', (value) => { value.sequence = 0; }, /annotation-sequence-invalid/],
        ['numeric-string vertex', (_value, verified) => {
            const drawing = (verified.content.drawings as UnknownRecord[])[1];
            const polygon = (drawing.annotations as UnknownRecord[])[0];
            (((polygon.geometry as UnknownRecord).vertices as UnknownRecord[])[0]).x = '0.12';
        }, /annotation-point-invalid/],
    ];
    for (const [label, mutate, pattern] of annotationCases) {
        const invalid = clone();
        const drawing = (invalid.content.drawings as UnknownRecord[])[0];
        const firstAnnotation = (drawing.annotations as UnknownRecord[])[0];
        mutate(firstAnnotation, invalid);
        rebind(invalid);
        await assert.rejects(() => renderConstructionPlanFieldUsePdf({
            profile: 'issued', verifiedSnapshot: invalid, ...approvalBinding(invalid), loadDrawingSource: sourceLoader(fixture.sources),
        }), pattern, label);
    }
});

test('field-use renderer rejects a source whose immutable SHA binding no longer matches', async () => {
    const fixture = await buildStressFixture();
    await assert.rejects(() => renderConstructionPlanFieldUsePdf({
        profile: 'issued', verifiedSnapshot: fixture.verifiedSnapshot, ...approvalBinding(fixture.verifiedSnapshot),
        loadDrawingSource: async (ref) => ({ ...(await sourceLoader(fixture.sources)(ref)), bytes: Buffer.from('tampered') }),
    }), /source-integrity-failed/);
});
