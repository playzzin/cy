import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import {
    addUniquePlanParticipant,
    applyConstructionPlanReviewCommentTransition,
    assertConstructionPlanApprovalEvidenceBinding,
    assertConstructionPlanReviewCommentTransition,
    buildApprovedSnapshotContent,
    buildConstructionPlanApprovedSnapshotReference,
    canAddressConstructionPlanReviewComment,
    buildCanonicalConstructionPlanDraftContext,
    buildConstructionPlanWorkerDirectoryBinding,
    buildConstructionPlanCloneDocument,
    buildConstructionPlanDraftDocument,
    buildConstructionPlanFallbackPageFingerprint,
    buildConstructionPlanMutationClaimId,
    buildConstructionPlanRevisionDocument,
    buildConstructionPlanReviewSnapshotContent,
    buildConstructionPlanSeriesIdentity,
    buildIssuedPdfCandidatePath,
    canonicalStringify,
    classifyConstructionPlanDrawingReviewAnchor,
    classifyConstructionPlanRoleAccess,
    CONSTRUCTION_PLAN_SECTION_ORDER,
    CONSTRUCTION_PLAN_RENDERER_VERSION,
    CONSTRUCTION_PLAN_MAX_SAFE_WORKERS,
    CONSTRUCTION_PLAN_TEMPLATE_ID,
    CONSTRUCTION_PLAN_TEMPLATE_PAGES,
    CONSTRUCTION_PLAN_TEMPLATE_VERSION,
    createServerDefaultPlanSections,
    decideConstructionPlanIssueSeriesTransition,
    decideConstructionPlanRevisionSeriesTransition,
    findLegacyConstructionPlanDocumentNoCollisions,
    formatSeoulCalendarDate,
    hasStableConstructionPlanReviewJsonPointer,
    isAllowedConstructionPlanPdfSourcePath,
    isUnknownRecord,
    isConstructionPlanParticipant,
    isConstructionPlanRequiredCommentVisibilityAllowed,
    isNormalizedConstructionPlanReviewCoordinate,
    normalizeConstructionPlanDocumentNoKey,
    projectConstructionPlanCompanyMasterSnapshot,
    projectConstructionPlanSiteMasterSnapshot,
    projectSafeWorkerDirectoryEntry,
    projectConstructionPlanTeamMasterSnapshot,
    resolveConstructionPlanMutationClaim,
    resolveConstructionPlanReviewMutationClaim,
    sha256Hex,
    sanitizeConstructionPlanErpSnapshot,
    sanitizeConstructionPlanProjectSnapshot,
    sanitizeConstructionPlanOrganizationSnapshot,
    resolveConstructionPlanErpVisibleProjectFields,
    summarizeConstructionPlanReviewDiff,
    transitionConstructionPlanReviewStatus,
    type UnknownRecord,
    validateConstructionPlanForRelease,
    validatePdfAuditPages,
    validatePdfAuditText,
    validatePdfEnvelope,
} from './domain';
import { SYSTEM_SCAFFOLD_SERVER_TEMPLATE } from './templateContracts';
import { canonicalConstructionPlanDrawingAnnotationStyle } from './drawingAnnotationContract';

const bindReadyTemplate = (plan: UnknownRecord): UnknownRecord => {
    const tradeType = String(plan.tradeType);
    const templateId = String(plan.templateId);
    const templateVersion = String(plan.templateVersion);
    const binding: UnknownRecord = {
        schemaVersion: 1,
        templateRecordId: `${tradeType}-${templateId}-${templateVersion}`,
        templateKey: `${tradeType}:${templateId}@${templateVersion}`,
        tradeType,
        templateId,
        templateVersion,
        rendererVersion: plan.rendererVersion,
        logicalPageCount: 42,
        manifestHash: 'a'.repeat(64),
        templateBundleHash: 'b'.repeat(64),
        templateHash: 'c'.repeat(64),
        lifecycleVersionAtCapture: 1,
        publishedAt: '2026-08-20T00:00:00.000Z',
        capturedAt: '2026-08-21T00:00:00.000Z',
    };
    return {
        ...plan,
        templateBinding: binding,
        templateHash: binding.templateHash,
        manifestHash: binding.manifestHash,
        templateBundleHash: binding.templateBundleHash,
        templateBindingHash: sha256Hex(canonicalStringify(binding)),
    };
};

const structuredSectionContent = (key: string): UnknownRecord | undefined => {
    const base = { structuredDataVersion: 1, applicableZones: ['A구간'] };
    const sequence = [{ id: 'sequence-1', sequence: 1, activity: '승인 순서에 따른 작업', responsibleRole: '공사담당', workZones: ['A구간'], prerequisites: ['작업구역 통제'], acceptanceCriteria: ['검측 완료'] }];
    const contents: Record<string, UnknownRecord> = {
        'material-plan': { ...base, materials: [{ id: 'material-1', materialName: '수직재', specification: '승인 규격', approvalReference: 'MAT-APP-1', plannedQuantity: '100', unit: 'EA', deliveryPeriod: '2026-09', inspectionCriteria: ['변형·부식 없음'], storageLocation: 'A 적치장', storageControls: ['전도·침수 방지'] }], deliveryRoute: '동문 반입로', unloadingMethod: '지게차 하역', responsibleWorkerId: 'worker-1' },
        'equipment-signal': { ...base, signalerWorkerIds: ['worker-2'], signalMethod: 'combined', communicationChannel: '무전 1번', signalProtocols: [{ id: 'signal-1', situation: '양중 시작', signal: '시작 수신호', issuerRole: '신호수', receiverRole: '운전원' }], accessControlMeasures: ['회전반경 출입통제'], emergencyStopSignal: '양팔 교차 후 정지 무전' },
        'site-installation-plan': { ...base, drawingReferences: ['D-01 Rev.A'], prerequisites: ['기초상태 확인'], workSequence: sequence, inspectionPoints: ['수직도·간격 확인'], weatherStopCriteria: ['강풍·호우 시 중지'] },
        'concrete-pour-plan': { ...base, designStrength: '24 MPa', pourMethod: 'pump', plannedPourDate: '2026-09-20', pourRate: '20㎥/h', pourSequence: [{ id: 'pour-1', sequence: 1, zone: 'A구간', volume: '40㎥', pumpPosition: '동측', monitoringItems: ['침하·변형'] }], concentratedLoadControls: ['편중 타설 금지'], monitoringFrequency: '30분', stopCriteria: ['침하·이상음 발생'] },
        'dismantling-plan': { ...base, strengthEvidenceReference: '압축강도 시험성적서', approvalReference: 'DIS-APP-1', prerequisites: ['해체 승인 완료'], workSequence: sequence, temporaryStabilityMeasures: ['가새 선행 제거 금지'], exclusionZones: ['A구간 하부'], materialLoweringMethod: '인양장비로 하강', responsibleWorkerId: 'worker-1' },
        'retention-plan': { ...base, retentionZones: [{ id: 'retain-1', zone: 'A구간', retainUntilCondition: '설계강도 충족', releaseEvidence: '압축강도 시험성적서', reshoringRequired: false, reshoringSpecification: '' }], inspectionFrequency: '매일', markingMethod: '보라색 표지', changeTriggers: ['공법·하중 변경'], changeApprovalRoles: ['구조기술자'], drawingRevisionRequired: true, engineeringReviewRequired: true },
        'emergency-plan': { ...base, contacts: [{ id: 'contact-1', organization: '현장 비상대응반', name: '안전담당', phone: '02-0000-0000', role: '초동지휘' }], scenarios: [{ id: 'scenario-1', scenario: '붕괴 징후', initialActions: ['작업중지·대피'], evacuationRoute: '동측 비상통로', assemblyPoint: '정문 집결지', responsibleRole: '현장책임자' }], alarmMethod: '비상방송·무전', nearestHospital: '인근 종합병원', emergencyEquipment: ['구급함'], reportingChain: ['작업자→현장책임자→본사'] },
        'quality-plan': { ...base, inspectionItems: [{ id: 'inspection-1', stage: '설치', item: '수직도', criterion: '승인도면', method: '레벨 측정', frequency: '구간별', responsibleRole: '품질담당', recordForm: '설치 검측표' }], holdPoints: [{ id: 'hold-1', stage: '타설 전', evidence: '검측표·사진', responsibleRole: '현장책임자', completionCondition: '검측 전 항목 적합', decisionStatus: 'approved', decisionAt: '2026-01-02T01:00:00.000Z', decisionComment: '계획상 타설 전 조건 충족 확인' }], nonconformanceProcess: ['식별→격리→재검사'], recordsRetentionMethod: '문서번호·Rev.별 보존' },
        'safety-plan': { ...base, supervisorWorkerIds: ['worker-3'], toolboxTopics: ['붕괴·추락 예방'], ppeRequirements: [{ id: 'ppe-1', workStage: '설치', item: '안전대', standard: '2중 걸이' }], accessControlMeasures: ['관계자 외 출입금지'], fallPreventionMeasures: ['작업발판·안전난간'], fallingObjectPreventionMeasures: ['낙하물 방지망'], stopWorkCriteria: ['방호 미설치'], permitTypes: ['고소작업허가'] },
        'environment-plan': { ...base, aspects: [{ id: 'aspect-1', activity: '자재 하역', impact: '소음·분진', controlMeasure: '살수·저속운행', monitoringMethod: '일일 점검', responsibleRole: '환경담당' }], wasteSegregation: ['종류별 분리'], dustControls: ['살수'], noiseControls: ['작업시간 준수'], spillResponse: ['흡착포 회수·보고'], complaintContact: '현장 환경담당', monitoringFrequency: '매일' },
        'work-platform-access-plan': { ...base, platformWidth: '400mm 이상', platformMaterial: '승인 강재발판', platformLoadLimit: '400kg 이하', guardrailMeasures: ['상·중간난간 연속 설치'], toeBoardMeasures: ['발끝막이판 연속 설치'], accessType: 'stair', accessLocations: ['A구간 동측'], openingControls: ['출입구 자동폐쇄'], inspectionPoints: ['고정·틈새·단차 확인'], responsibleWorkerId: 'worker-1' },
        'inspection-maintenance-plan': { ...base, inspectionFrequency: '작업 전 및 강풍 후', inspectionItems: ['기초·수직도·체결'], defectResponse: ['사용중지·보수·재검측'], weatherStopCriteria: ['강풍·호우 후 재점검'], alterationApprovalRoles: ['현장책임자·안전담당'], wallTieChecks: ['앵커·클램프 이완'], platformChecks: ['고정·파손·틈새'], recordsRetentionMethod: '일일점검표 보존', responsibleWorkerId: 'worker-1' },
    };
    return contents[key];
};

const makeReadyPlan = (): UnknownRecord => {
    const sectionMap = new Map<string, UnknownRecord>();
    CONSTRUCTION_PLAN_TEMPLATE_PAGES.forEach((page) => {
        const current = sectionMap.get(page.sectionKey);
        if (current) {
            (current.pageNumbers as number[]).push(page.pageNumber);
            return;
        }
        sectionMap.set(page.sectionKey, {
            id: page.sectionKey,
            key: page.sectionKey,
            title: page.sectionKey,
            kind: 'static-content',
            order: page.pageNumber - 1,
            pageNumbers: [page.pageNumber],
            required: page.required,
            status: 'complete',
            content: structuredSectionContent(page.sectionKey) || { confirmed: true },
            placeholders: [],
            containsExampleValues: false,
        });
    });
    const drawing = {
        id: 'drawing-1',
        approvalStatus: 'approved',
        approvalReference: 'APP-2026-001',
        previewStatus: 'ready',
        drawingNo: 'D-01',
        revision: 'R1',
        applicableZones: ['A구간'],
        annotations: [
            {
                id: 'annotation-install', layer: 'install', zoneCode: 'A-01', sequence: 1,
                geometry: { kind: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.2, rotationDeg: 0 },
                style: canonicalConstructionPlanDrawingAnnotationStyle('install'),
            },
            {
                id: 'annotation-dismantle', layer: 'dismantle', zoneCode: 'A-01', sequence: 1,
                startDate: '2026-09-30',
                geometry: { kind: 'polygon', vertices: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.7, y: 0.8 }] },
                style: canonicalConstructionPlanDrawingAnnotationStyle('dismantle'),
            },
        ],
    };
    const readyAssignments = ['site_manager', 'construction_manager', 'safety_manager']
        .map((role, index) => ({
            id: `assignment-${index + 1}`,
            role,
            label: `담당 역할 ${index + 1}`,
            required: true,
            worker: { id: `worker-${index + 1}`, name: `담당자 ${index + 1}`, status: 'active' },
            responsibilities: [`${role} 업무`],
            order: index,
        }));
    const readyDirectory = buildConstructionPlanWorkerDirectoryBinding(
        readyAssignments.map((assignment) => assignment.worker),
    );
    return bindReadyTemplate({
        id: 'plan-1',
        siteId: 'site-1',
        title: '시스템동바리 시공계획서',
        tradeType: 'system-shoring',
        documentNo: 'CP-2026-001',
        documentDate: '2026-08-21',
        revision: 5,
        status: 'review_completed',
        templateId: CONSTRUCTION_PLAN_TEMPLATE_ID,
        templateVersion: CONSTRUCTION_PLAN_TEMPLATE_VERSION,
        rendererVersion: CONSTRUCTION_PLAN_RENDERER_VERSION,
        schemaVersion: 1,
        projectSnapshot: {
            capturedAt: '2026-08-21T00:00:00.000Z',
            siteName: '검증 현장',
            buildings: ['101동'],
            floors: ['지상 1층'],
            zones: ['A구간'],
            sitePhotos: [],
            emergencyContactsComplete: true,
            differsFromMaster: false,
        },
        organizationSnapshot: {
            capturedAt: '2026-08-21T00:00:00.000Z',
            sourceSiteId: 'site-1',
            assignments: readyAssignments,
            additionalWorkers: [],
            workerDirectoryProvenance: {
                captureKind: 'initial',
                sourceSiteId: 'site-1',
                capturedAt: '2026-08-21T00:00:00.000Z',
                sourceMasterHash: readyDirectory.sourceMasterHash,
                sourceWorkerIds: readyDirectory.sourceWorkerIds,
            },
        },
        sections: CONSTRUCTION_PLAN_SECTION_ORDER.map((key) => sectionMap.get(key)),
        sectionOrder: [...CONSTRUCTION_PLAN_SECTION_ORDER],
        drawings: [drawing],
        drawingApplicability: ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'].map((drawingSlot) => ({
            drawingSlot,
            decision: 'applicable',
            drawingId: drawing.id,
            reason: '',
        })),
        engineeringValues: [{
            key: '허용하중',
            value: 10,
            sourceDocumentId: 'STRUCT-001',
            sourceRevision: 'R1',
            applicableZones: ['A구간'],
            verificationStatus: 'reviewed',
        }],
        equipmentPlan: [{
            id: 'equipment-1',
            category: 'lifting',
            equipmentName: '이동식 크레인',
            model: 'CR-25',
            ratedCapacity: '25t',
            workRadius: '10m',
            inspectionValidUntil: '2099-12-31',
            workZones: ['A구간'],
            plannedStages: ['자재 반입', '설치'],
            controlMeasures: ['출입통제', '신호수 배치'],
        }],
        riskAssessments: [{
            id: 'risk-1',
            assessmentMethodVersion: 2,
            workStage: '설치',
            hazard: '부재 낙하',
            initialProbability: 4,
            initialSeverity: 4,
            initialRiskLevel: 'high',
            mitigationMeasures: ['출입통제 및 신호수 배치'],
            responsibleWorkerId: 'worker-1',
            residualProbability: 2,
            residualSeverity: 2,
            residualRiskLevel: 'low',
            methodReference: '청연이엔지 시스템동바리 5×5 위험성평가 기준 v2',
            reviewTrigger: '공법 또는 설치·해체 순서 변경',
            verifiedBy: 'reviewer-1',
        }],
        participants: { authorIds: ['author-1'], reviewerIds: [], approverIds: [] },
        createdBy: 'author-1',
    });
};

const makeReadyScaffoldPlan = (): UnknownRecord => {
    const plan = makeReadyPlan();
    const shoringSections = plan.sections as UnknownRecord[];
    const shoringByPage = new Map<number, UnknownRecord>();
    shoringSections.forEach((section) => (section.pageNumbers as number[])
        .forEach((pageNumber) => shoringByPage.set(pageNumber, section)));
    const scaffoldSections: UnknownRecord[] = createServerDefaultPlanSections(SYSTEM_SCAFFOLD_SERVER_TEMPLATE)
        .map((section): UnknownRecord => {
            const pageNumber = (section.pageNumbers as number[])[0];
            const source = shoringByPage.get(pageNumber) as UnknownRecord;
            return {
                ...section,
                status: 'complete',
                content: structuredSectionContent(String(section.key))
                    || (isUnknownRecord(source?.content) ? source.content : { confirmed: true }),
            };
        });
    return bindReadyTemplate({
        ...plan,
        title: '시스템비계 시공계획서',
        tradeType: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.tradeType,
        templateId: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.templateId,
        templateVersion: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.templateVersion,
        rendererVersion: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.rendererVersion,
        schemaVersion: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.schemaVersion,
        riskAssessments: (plan.riskAssessments as UnknownRecord[]).map((risk) => ({
            ...risk,
            methodReference: SYSTEM_SCAFFOLD_SERVER_TEMPLATE.riskAssessmentPolicy.methodReference,
        })),
        sections: scaffoldSections,
        sectionOrder: scaffoldSections.map((section) => section.key),
    });
};

const testDrawingReuseProjection = (
    source: UnknownRecord,
    targetPlanId: string,
): { drawings: UnknownRecord[]; sections: UnknownRecord[]; drawingApplicability: UnknownRecord[] } => {
    const sourceDrawings = Array.isArray(source.drawings) ? source.drawings : [];
    const drawings = sourceDrawings.map((rawDrawing, index): UnknownRecord => {
        const drawing = isUnknownRecord(rawDrawing) ? rawDrawing : {};
        const id = typeof drawing.id === 'string' ? drawing.id : `drawing-${index + 1}`;
        const storagePath = `construction-plans/${String(source.siteId)}/${targetPlanId}`
            + `/drawings/${id}/rev-1/source.png`;
        return {
            id,
            planId: targetPlanId,
            storagePath,
            sourceSha256: 'f'.repeat(64),
            sourceGeneration: String(9_001 + index),
            originalFileName: typeof drawing.originalFileName === 'string'
                ? drawing.originalFileName
                : `${id}.png`,
            mimeType: 'image/png',
            sizeBytes: 128,
            pageCount: 1,
            drawingNo: typeof drawing.drawingNo === 'string' ? drawing.drawingNo : '',
            title: typeof drawing.title === 'string' ? drawing.title : '',
            revision: typeof drawing.revision === 'string' ? drawing.revision : '',
            approvalStatus: 'draft',
            applicableZones: Array.isArray(drawing.applicableZones) ? drawing.applicableZones : [],
            previewStatus: 'ready',
            previewPaths: [storagePath],
            pages: [],
            annotations: Array.isArray(drawing.annotations)
                ? drawing.annotations.map((annotation) => (
                    isUnknownRecord(annotation) ? { ...annotation, locked: false } : annotation
                ))
                : [],
            uploadedBy: 'server-copy-actor',
            uploadedAt: '2026-08-22T00:00:00.000Z',
        };
    });
    const ids = new Set(drawings.map((drawing) => String(drawing.id)));
    const sections = (Array.isArray(source.sections) ? source.sections : []).map((section) => (
        isUnknownRecord(section) ? { ...section, content: isUnknownRecord(section.content) ? { ...section.content } : {} } : section
    )) as UnknownRecord[];
    const drawingApplicability = (Array.isArray(source.drawingApplicability)
        ? source.drawingApplicability
        : []).flatMap((decision): UnknownRecord[] => {
        if (!isUnknownRecord(decision)) return [];
        const drawingId = typeof decision.drawingId === 'string' && ids.has(decision.drawingId)
            ? decision.drawingId
            : undefined;
        return [{
            drawingSlot: decision.drawingSlot,
            decision: decision.decision,
            ...(drawingId ? { drawingId } : {}),
            reason: '재사용 도면의 현장 적용성 및 승인근거 재검토 필요',
        }];
    });
    return { drawings, sections, drawingApplicability };
};

describe('construction-plan series and derived draft builders', () => {
    it('creates scaffold drafts and preserves exact template identity through revision and clone', () => {
        const draft = buildConstructionPlanDraftDocument({
            id: 'scaffold-draft', seriesId: 'scaffold-series', siteId: 'site-1',
            title: '시스템비계 시공계획서', documentNo: 'CP-SC-001',
            tradeType: 'system-scaffold', templateId: 'system-scaffold-standard', templateVersion: '1.0.0',
            actorId: 'author-1', timestamp: '2026-08-22T00:00:00.000Z',
        });
        assert.equal(draft.tradeType, 'system-scaffold');
        assert.ok((draft.sectionOrder as string[]).includes('work-platform-access-plan'));
        assert.ok(!(draft.sectionOrder as string[]).includes('concrete-pour-plan'));
        const source = makeReadyScaffoldPlan();
        source.seriesId = 'scaffold-series';
        source.approvedSnapshotHash = 'a'.repeat(64);
        const revision = buildConstructionPlanRevisionDocument(source, {
            id: 'scaffold-revision', seriesId: 'scaffold-series', revision: 6,
            revisionReason: '비계 설치구간 변경 반영', revisionType: 'site_condition',
            sourceSnapshotHash: 'a'.repeat(64), copyDrawings: true,
            drawingReuseProjection: testDrawingReuseProjection(source, 'scaffold-revision'),
            actorId: 'author-2', timestamp: '2026-08-22T01:00:00.000Z',
        });
        const clone = buildConstructionPlanCloneDocument(source, {
            id: 'scaffold-clone', seriesId: 'scaffold-clone-series', documentNo: 'CP-SC-002',
            copyDrawings: false, actorId: 'author-2', timestamp: '2026-08-22T02:00:00.000Z',
        });
        [revision, clone].forEach((derived) => {
            assert.equal(derived.tradeType, 'system-scaffold');
            assert.equal(derived.templateId, 'system-scaffold-standard');
            assert.ok((derived.sectionOrder as string[]).includes('inspection-maintenance-plan'));
        });
    });

    it('uses the Asia/Seoul calendar day for every derived document date boundary', () => {
        const boundary = new Date('2026-08-21T15:30:00.000Z');
        assert.equal(formatSeoulCalendarDate(boundary), '2026-08-22');
        const timestamp = boundary.toISOString();
        const draft = buildConstructionPlanDraftDocument({
            id: 'kst-draft',
            seriesId: 'kst-series',
            siteId: 'kst-site',
            title: '서울 현장 시공계획서',
            documentNo: 'KST-001',
            actorId: 'author-1',
            timestamp,
        });
        const explicitDraft = buildConstructionPlanDraftDocument({
            id: 'kst-explicit-draft',
            seriesId: 'kst-explicit-series',
            siteId: 'kst-site',
            title: '명시 작성일 시공계획서',
            documentNo: 'KST-EXPLICIT-001',
            documentDate: '2026-08-20',
            actorId: 'author-1',
            timestamp,
        });
        const source = makeReadyPlan();
        source.seriesId = 'kst-series';
        source.lineageRootPlanId = source.id;
        source.approvedSnapshotHash = 'e'.repeat(64);
        const revision = buildConstructionPlanRevisionDocument(source, {
            id: 'kst-revision',
            seriesId: 'kst-series',
            revision: 6,
            revisionReason: '한국 달력일 경계 반영',
            revisionType: 'other',
            sourceSnapshotHash: 'e'.repeat(64),
            copyDrawings: true,
            drawingReuseProjection: testDrawingReuseProjection(source, 'kst-revision'),
            actorId: 'author-2',
            timestamp,
        });
        const clone = buildConstructionPlanCloneDocument(source, {
            id: 'kst-clone',
            seriesId: 'kst-clone-series',
            documentNo: 'KST-COPY-001',
            copyDrawings: false,
            actorId: 'author-2',
            timestamp,
        });

        assert.equal(draft.documentDate, '2026-08-22');
        assert.equal(explicitDraft.documentDate, '2026-08-20');
        assert.equal(revision.documentDate, '2026-08-22');
        assert.equal(clone.documentDate, '2026-08-22');
    });

    it('detects collisions from identity-only projected rows while allowing the bootstrap source', () => {
        const identity = buildConstructionPlanSeriesIdentity('site-1', ' CP-2026-001 ');
        const legacyPlans = [
            { id: 'legacy-source', siteId: 'site-1', documentNo: 'cp-2026-001', status: 'issued' },
            { id: 'legacy-duplicate', siteId: 'site-1', documentNo: 'CP-2026-001', status: 'draft' },
            { id: 'managed-plan', siteId: 'site-1', documentNo: 'CP-2026-001', seriesId: identity.seriesId },
            { id: 'other-site', siteId: 'site-2', documentNo: 'CP-2026-001' },
        ];

        assert.deepEqual(
            findLegacyConstructionPlanDocumentNoCollisions(legacyPlans, 'site-1', identity),
            ['legacy-source', 'legacy-duplicate'],
        );
        assert.deepEqual(
            findLegacyConstructionPlanDocumentNoCollisions(
                legacyPlans,
                'site-1',
                identity,
                ['legacy-source'],
            ),
            ['legacy-duplicate'],
        );
    });

    it('derives a deterministic site/document series key after Unicode and whitespace normalization', () => {
        const first = buildConstructionPlanSeriesIdentity('site-1', ' ＣＰ - 2026 - 001 ');
        const second = buildConstructionPlanSeriesIdentity('site-1', 'CP-2026-001');
        assert.equal(normalizeConstructionPlanDocumentNoKey(' ＣＰ - 2026 - 001 '), 'CP-2026-001');
        assert.equal(first.seriesId, second.seriesId);
        assert.equal(first.documentNoKey, second.documentNoKey);
        assert.notEqual(first.seriesId, buildConstructionPlanSeriesIdentity('site-2', 'CP-2026-001').seriesId);
    });

    it('routes the same actor/operation/idempotency retry to one private claim id', () => {
        const first = buildConstructionPlanMutationClaimId('actor-1', 'create_revision', 'request-123');
        const retry = buildConstructionPlanMutationClaimId('actor-1', 'create_revision', 'request-123');
        assert.equal(first, retry);
        assert.notEqual(first, buildConstructionPlanMutationClaimId('actor-2', 'create_revision', 'request-123'));
        assert.notEqual(first, buildConstructionPlanMutationClaimId('actor-1', 'clone_plan', 'request-123'));
        assert.notEqual(
            buildConstructionPlanMutationClaimId('actor-1', 'create_revision', 'request 123'),
            buildConstructionPlanMutationClaimId('actor-1', 'create_revision', 'request  123'),
        );
        assert.equal(first.includes('request-123'), false);
    });

    it('resolves a completed claim independently of later source state changes', () => {
        const requestFingerprint = 'f'.repeat(64);
        const claim = {
            operation: 'create_revision',
            requestFingerprint,
            response: {
                planId: 'plan-r2',
                seriesId: 'series-1',
                revisionNo: 2,
                documentNo: 'CP-VOID',
                idempotent: false,
            },
        };
        assert.deepEqual(
            resolveConstructionPlanMutationClaim(claim, 'create_revision', requestFingerprint),
            {
                planId: 'plan-r2',
                seriesId: 'series-1',
                revisionNo: 2,
                documentNo: 'CP-VOID',
                idempotent: true,
            },
        );
        assert.throws(
            () => resolveConstructionPlanMutationClaim(claim, 'create_revision', '0'.repeat(64)),
            /construction-plan-mutation-claim-conflict/,
        );
    });

    it('serializes a revision claim and rejects a concurrent stale source after the series advances', () => {
        const identity = buildConstructionPlanSeriesIdentity('site-1', 'CP-001');
        const source: UnknownRecord = {
            id: 'plan-5',
            siteId: 'site-1',
            documentNo: 'CP-001',
            revision: 5,
            status: 'issued',
            seriesId: identity.seriesId,
        };
        const currentSeries = {
            siteId: 'site-1',
            documentNo: 'CP-001',
            documentNoKey: identity.documentNoKey,
            tradeType: 'system-shoring',
            latestRevisionNo: 5,
            latestPlanId: 'plan-5',
            latestIssuedPlanId: 'plan-5',
        };
        assert.deepEqual(
            decideConstructionPlanRevisionSeriesTransition(currentSeries, identity, source),
            { kind: 'advance', nextRevision: 6 },
        );
        const advancedByConcurrentRequest = {
            ...currentSeries,
            latestRevisionNo: 6,
            latestPlanId: 'plan-6',
        };
        assert.throws(
            () => decideConstructionPlanRevisionSeriesTransition(
                advancedByConcurrentRequest,
                identity,
                source,
                {
                    id: 'plan-6',
                    seriesId: identity.seriesId,
                    siteId: 'site-1',
                    documentNo: 'CP-001',
                    revision: 6,
                    status: 'draft',
                    supersedesPlanId: 'plan-5',
                },
            ),
            /construction-plan-revision-latest-plan-not-void/,
        );
    });

    it('skips a voided R1 claim and creates R2 from the still-current R0 issued source', () => {
        const identity = buildConstructionPlanSeriesIdentity('site-1', 'CP-VOID');
        const sourceR0: UnknownRecord = {
            id: 'plan-r0',
            siteId: 'site-1',
            documentNo: 'CP-VOID',
            revision: 0,
            status: 'issued',
            seriesId: identity.seriesId,
            lineageRootPlanId: 'plan-r0',
        };
        const series = {
            siteId: 'site-1',
            documentNo: 'CP-VOID',
            documentNoKey: identity.documentNoKey,
            tradeType: 'system-shoring',
            latestRevisionNo: 1,
            latestPlanId: 'plan-r1',
            latestIssuedPlanId: 'plan-r0',
        };
        const voidR1 = {
            id: 'plan-r1',
            seriesId: identity.seriesId,
            siteId: 'site-1',
            documentNo: 'CP-VOID',
            revision: 1,
            status: 'void',
            supersedesPlanId: 'plan-r0',
        };
        assert.deepEqual(
            decideConstructionPlanRevisionSeriesTransition(series, identity, sourceR0, voidR1),
            { kind: 'advance', nextRevision: 2 },
        );

        const sourcePlan = makeReadyPlan();
        Object.assign(sourcePlan, sourceR0, { approvedSnapshotHash: 'e'.repeat(64) });
        const revisionR2 = buildConstructionPlanRevisionDocument(sourcePlan, {
            id: 'plan-r2',
            seriesId: identity.seriesId,
            revision: 2,
            revisionReason: '폐기된 개정본 이후 재작성',
            revisionType: 'method_change',
            sourceSnapshotHash: 'e'.repeat(64),
            copyDrawings: false,
            actorId: 'author-2',
            timestamp: '2026-08-21T05:00:00.000Z',
        });
        assert.equal(revisionR2.revision, 2);
        assert.equal(revisionR2.supersedesPlanId, 'plan-r0');
        assert.equal(revisionR2.sourceRevisionNo, 0);
        assert.equal(revisionR2.lineageRootPlanId, 'plan-r0');
    });

    it('allows R2 issue to supersede R0 without requiring an adjacent source revision', () => {
        const identity = buildConstructionPlanSeriesIdentity('site-1', 'CP-VOID');
        const planR2: UnknownRecord = {
            id: 'plan-r2',
            seriesId: identity.seriesId,
            siteId: 'site-1',
            documentNo: 'CP-VOID',
            revision: 2,
            status: 'approved_pending_issue',
            supersedesPlanId: 'plan-r0',
            sourceRevisionNo: 0,
        };
        const sourceR0: UnknownRecord = {
            id: 'plan-r0',
            seriesId: identity.seriesId,
            siteId: 'site-1',
            documentNo: 'CP-VOID',
            revision: 0,
            status: 'issued',
        };
        const series = {
            siteId: 'site-1',
            documentNo: 'CP-VOID',
            documentNoKey: identity.documentNoKey,
            tradeType: 'system-shoring',
            latestRevisionNo: 2,
            latestPlanId: 'plan-r2',
            latestIssuedPlanId: 'plan-r0',
        };
        assert.deepEqual(
            decideConstructionPlanIssueSeriesTransition(series, identity, planR2, sourceR0),
            { supersedeSource: true, sourceRevision: 0 },
        );
        assert.throws(
            () => decideConstructionPlanIssueSeriesTransition(
                { ...series, latestIssuedPlanId: 'some-other-plan' },
                identity,
                planR2,
                sourceR0,
            ),
            /construction-plan-issue-source-lineage-invalid/,
        );
    });

    it('bootstraps a legacy issued source once but rejects any superseded source as unprovably stale', () => {
        const identity = buildConstructionPlanSeriesIdentity('site-1', 'CP-LEGACY');
        const legacy: UnknownRecord = {
            id: 'legacy-3',
            siteId: 'site-1',
            documentNo: 'CP-LEGACY',
            revision: 3,
            status: 'issued',
        };
        assert.deepEqual(
            decideConstructionPlanRevisionSeriesTransition(null, identity, legacy),
            { kind: 'bootstrap', nextRevision: 4 },
        );
        assert.throws(
            () => decideConstructionPlanRevisionSeriesTransition(null, identity, {
                ...legacy,
                status: 'superseded',
            }),
            /construction-plan-legacy-revision-source-invalid/,
        );
    });

    it('builds a server-owned canonical draft and projects organization workers to safe fields', () => {
        const draft = buildConstructionPlanDraftDocument({
            id: 'plan-new',
            seriesId: 'series-new',
            siteId: 'site-1',
            siteName: '한빛 현장',
            title: '시스템동바리 시공계획서',
            documentNo: 'CP-001',
            documentDate: '2026-08-21',
            projectSnapshot: {
                buildings: ['101동'],
                floors: ['1층'],
                zones: ['A구간'],
                internalSecret: 'drop-me',
            },
            erpSnapshot: {
                schemaVersion: 1,
                capturedAt: '2026-08-21T01:02:03.000Z',
                site: {
                    value: {
                        id: 'site-1',
                        name: '한빛 현장',
                        code: 'SITE-1',
                        privateMemo: 'drop-me',
                    },
                    source: 'site',
                    sourceId: 'site-1',
                    capturedAt: '2026-08-21T01:02:03.000Z',
                },
            },
            organizationSnapshot: {
                assignments: [{
                    id: 'site-manager',
                    role: 'site_manager',
                    label: '현장책임자',
                    required: true,
                    responsibilities: ['현장 총괄'],
                    order: 0,
                    worker: {
                        id: 'worker-1',
                        name: '이안전',
                        status: 'active',
                        role: '안전관리자',
                        phone: '010-0000-0000',
                        bankAccount: 'secret',
                    },
                }],
                additionalWorkers: [],
            },
            participants: { authorIds: ['co-author'], reviewerIds: ['reviewer-1'] },
            actorId: 'author-1',
            actorName: '작성자',
            timestamp: '2026-08-21T01:02:03.000Z',
        });
        assert.equal(draft.status, 'draft');
        assert.equal(draft.revision, 0);
        assert.equal(draft.createdBy, 'author-1');
        assert.equal(draft.lineageRootPlanId, 'plan-new');
        assert.equal(Object.prototype.hasOwnProperty.call(draft, 'approvedSnapshotHash'), false);
        const sections = draft.sections as UnknownRecord[];
        assert.equal(sections.length, createServerDefaultPlanSections().length);
        assert.deepEqual(draft.sectionOrder, CONSTRUCTION_PLAN_SECTION_ORDER);
        const project = draft.projectSnapshot as UnknownRecord;
        assert.equal(Object.prototype.hasOwnProperty.call(project, 'internalSecret'), false);
        const erp = draft.erpSnapshot as UnknownRecord;
        const erpSite = (erp.site as UnknownRecord).value as UnknownRecord;
        assert.deepEqual(erpSite, { id: 'site-1', name: '한빛 현장', code: 'SITE-1' });
        assert.equal(Object.prototype.hasOwnProperty.call(erpSite, 'privateMemo'), false);
        const organization = draft.organizationSnapshot as UnknownRecord;
        const worker = ((organization.assignments as UnknownRecord[])[0].worker) as UnknownRecord;
        assert.deepEqual(worker, {
            id: 'worker-1',
            name: '이안전',
            status: 'active',
            role: '안전관리자',
        });
        assert.equal(Object.prototype.hasOwnProperty.call(worker, 'phone'), false);
        assert.deepEqual((draft.participants as UnknownRecord).authorIds, ['author-1', 'co-author']);
    });

    it('creates a revision with lineage while invalidating copied drawing and technical approvals', () => {
        const source = makeReadyPlan();
        source.seriesId = 'series-1';
        source.lineageRootPlanId = 'plan-root';
        source.approvedSnapshotHash = 'a'.repeat(64);
        source.releaseReadiness = {
            requiredReviewsComplete: true,
            snapshotHashMatches: true,
            pdfVisualCheckPassed: true,
            pdfTextCheckPassed: true,
        };
        const drawings = source.drawings as UnknownRecord[];
        drawings[0] = {
            ...drawings[0],
            planId: 'plan-1',
            sourceGeneration: '1700000000001234',
            approvalStatus: 'approved',
            approvalReference: 'APP-1',
            drawingPreviewManifestAuthority: 'client-forged',
            annotations: [{ id: 'annotation-install', layer: 'install', locked: true }],
        };
        source.drawingApplicability = [{
            drawingSlot: 'D-01',
            decision: 'replacement',
            drawingId: 'drawing-1',
            reason: '교체',
            reviewedBy: 'reviewer-1',
            technicalReviewReference: 'TECH-1',
        }];
        source.engineeringValues = [{
            key: '허용하중',
            value: 10,
            sourceDocumentId: 'STRUCT-1',
            sourceRevision: 'R1',
            applicableZones: ['A'],
            verificationStatus: 'approved',
            verifiedBy: 'reviewer-1',
            verifiedAt: '2026-08-20T00:00:00.000Z',
        }];
        source.riskAssessments = [{ ...((source.riskAssessments as UnknownRecord[])[0]), verifiedBy: 'reviewer-1' }];

        const revision = buildConstructionPlanRevisionDocument(source, {
            id: 'plan-2',
            seriesId: 'series-1',
            revision: 6,
            revisionReason: '현장 조건 변경 반영',
            revisionType: 'site_condition',
            sourceSnapshotHash: 'a'.repeat(64),
            copyDrawings: true,
            drawingReuseProjection: testDrawingReuseProjection(source, 'plan-2'),
            actorId: 'author-2',
            timestamp: '2026-08-21T03:00:00.000Z',
        });
        assert.equal(revision.supersedesPlanId, 'plan-1');
        assert.equal(revision.lineageRootPlanId, 'plan-root');
        assert.equal(revision.revision, 6);
        assert.equal(revision.sourceSnapshotHash, 'a'.repeat(64));
        assert.equal(revision.sourceRevisionNo, 5);
        const copiedDrawing = (revision.drawings as UnknownRecord[])[0];
        assert.equal(copiedDrawing.planId, 'plan-2');
        assert.equal(copiedDrawing.sourceGeneration, '9001');
        assert.equal(copiedDrawing.storagePath, 'construction-plans/site-1/plan-2/drawings/drawing-1/rev-1/source.png');
        assert.equal(copiedDrawing.approvalStatus, 'draft');
        assert.equal(Object.prototype.hasOwnProperty.call(copiedDrawing, 'approvalReference'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(copiedDrawing, 'drawingPreviewManifestAuthority'), false);
        assert.equal(((copiedDrawing.annotations as UnknownRecord[])[0]).locked, false);
        const applicability = (revision.drawingApplicability as UnknownRecord[])[0];
        assert.equal(Object.prototype.hasOwnProperty.call(applicability, 'reviewedBy'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(applicability, 'technicalReviewReference'), false);
        const engineering = (revision.engineeringValues as UnknownRecord[])[0];
        assert.equal(engineering.verificationStatus, 'unverified');
        assert.equal(Object.prototype.hasOwnProperty.call(engineering, 'verifiedBy'), false);
        const risk = (revision.riskAssessments as UnknownRecord[])[0];
        assert.equal(Object.prototype.hasOwnProperty.call(risk, 'verifiedBy'), false);
        assert.equal((revision.releaseReadiness as UnknownRecord).snapshotHashMatches, false);
        assert.deepEqual((revision.participants as UnknownRecord).reviewerIds, []);
    });

    it('keeps a legacy creator in revision access when the issued source has no participants field', () => {
        const source = makeReadyPlan();
        source.createdBy = 'legacy-creator';
        source.seriesId = 'series-legacy';
        source.lineageRootPlanId = 'legacy-issued';
        source.approvedSnapshotHash = 'd'.repeat(64);
        delete source.participants;

        const revision = buildConstructionPlanRevisionDocument(source, {
            id: 'legacy-revision-1',
            seriesId: 'series-legacy',
            revision: 6,
            revisionReason: '기존 발행본 계보 참여자 보강',
            revisionType: 'other',
            sourceSnapshotHash: 'd'.repeat(64),
            copyDrawings: true,
            drawingReuseProjection: testDrawingReuseProjection(source, 'legacy-revision-1'),
            actorId: 'office-reviser',
            timestamp: '2026-08-21T03:30:00.000Z',
        });

        assert.deepEqual((revision.participants as UnknownRecord).authorIds, [
            'legacy-creator',
            'office-reviser',
        ]);
    });

    it('clones into a new root series without drawings or inherited worker assignments by default', () => {
        const source = makeReadyPlan();
        source.approvedSnapshotHash = 'b'.repeat(64);
        const sections = source.sections as UnknownRecord[];
        sections[0] = { ...sections[0], kind: 'drawing-page', status: 'complete', content: { drawingId: 'drawing-1', note: '유지' } };
        const clone = buildConstructionPlanCloneDocument(source, {
            id: 'clone-1',
            seriesId: 'series-clone',
            documentNo: 'CP-2026-001-COPY',
            copyDrawings: false,
            actorId: 'author-2',
            timestamp: '2026-08-21T04:00:00.000Z',
        });
        assert.equal(clone.clonedFromPlanId, 'plan-1');
        assert.equal(clone.lineageRootPlanId, 'clone-1');
        assert.equal(clone.revision, 0);
        assert.deepEqual(clone.drawings, []);
        assert.deepEqual(clone.drawingApplicability, []);
        const clonedOrganization = clone.organizationSnapshot as UnknownRecord;
        assert.equal((clonedOrganization.assignments as UnknownRecord[]).every((assignment) => assignment.worker === undefined), true);
        const clonedSection = (clone.sections as UnknownRecord[])[0];
        assert.equal((clonedSection.content as UnknownRecord).drawingId, undefined);
        assert.equal((clonedSection.content as UnknownRecord).note, '유지');
        assert.equal(clonedSection.status, 'empty');
    });
});

describe('server construction-plan release validation', () => {
    it('accepts scaffold only with its independent exact 42-page section contract', () => {
        const scaffold = makeReadyScaffoldPlan();
        const accepted = validateConstructionPlanForRelease(scaffold);
        assert.equal(accepted.valid, true, JSON.stringify(accepted.issues));

        const reinterpreted = makeReadyPlan();
        reinterpreted.tradeType = 'system-scaffold';
        reinterpreted.templateId = 'system-scaffold-standard';
        const rejected = validateConstructionPlanForRelease(reinterpreted);
        assert.equal(rejected.valid, false);
        assert.ok(rejected.issues.some((issue) => ['sections.order', 'section.missing'].includes(issue.code)));
    });

    it('binds standard text to the server catalog and rejects forged catalog or unreviewed overrides', () => {
        const catalogForgery = makeReadyPlan();
        const catalog = (catalogForgery.sections as UnknownRecord[]).find((section) => section.key === 'system-overview') as UnknownRecord;
        catalog.content = { standardTextVersion: 'forged', standardTextCurrent: '임의 변경' };
        catalog.standardTextModified = true;
        const catalogResult = validateConstructionPlanForRelease(catalogForgery);
        assert.ok(catalogResult.issues.some((issue) => issue.code === 'standard_text.catalog_locked'));

        const override = makeReadyScaffoldPlan();
        const general = (override.sections as UnknownRecord[]).find((section) => section.key === 'general') as UnknownRecord;
        general.content = {
            standardTextVersion: 'system-scaffold-standard@1.0.0:standard-copy-v1',
            standardTextCurrent: '현장 승인 변경문구',
        };
        general.standardTextModified = true;
        const overrideResult = validateConstructionPlanForRelease(override);
        assert.ok(overrideResult.issues.some((issue) => issue.code === 'standard_text.reason'));
        general.standardTextModificationReason = '현장 외벽 조건에 따른 승인 변경';
        general.updatedBy = 'author-1';
        general.updatedAt = '2026-08-22T03:00:00.000Z';
        assert.equal(validateConstructionPlanForRelease(override).valid, true);
    });

    it('accepts the exact 42-page manifest and release-ready drawing evidence', () => {
        const result = validateConstructionPlanForRelease(makeReadyPlan());
        assert.equal(result.valid, true, JSON.stringify(result.issues));
        assert.equal(result.issues.length, 0);
    });

    it('binds every PDF-visible project identity field exactly to the canonical ERP resolver', () => {
        const canonical = buildCanonicalConstructionPlanDraftContext({
            siteId: 'site-1',
            site: {
                id: 'site-1', name: 'ERP 검증 현장', address: '서울시 검증로 1',
                startDate: '2026-01-01', endDate: '2026-12-31',
                clientCompanyId: 'client-1', contractorCompanyId: 'contractor-1',
            },
            clientCompany: { id: 'client-1', name: 'ERP 발주처' },
            contractorCompany: { id: 'contractor-1', name: 'ERP 시공사' },
            requestedProjectSnapshot: { buildings: ['101동'], floors: ['1층'], zones: ['A구간'] },
            safeWorkers: [], actorId: 'author-1', capturedAt: '2026-08-22T00:00:00.000Z',
        });
        const plan = makeReadyPlan();
        plan.projectSnapshot = canonical.projectSnapshot;
        plan.erpSnapshot = canonical.erpSnapshot;
        assert.equal(validateConstructionPlanForRelease(plan).valid, true);

        const tamperCases: Array<[string, (project: UnknownRecord) => void]> = [
            ['siteName', (project) => { project.siteName = '위조 현장'; }],
            ['address', (project) => { project.address = '위조 주소'; }],
            ['clientName', (project) => { project.clientName = '위조 발주처'; }],
            ['contractorName', (project) => { project.contractorName = '위조 시공사'; }],
            ['constructionPeriod.startDate', (project) => {
                project.constructionPeriod = { ...(project.constructionPeriod as UnknownRecord), startDate: '2099-01-01' };
            }],
        ];
        tamperCases.forEach(([path, mutate]) => {
            const tampered = structuredClone(plan);
            mutate(tampered.projectSnapshot as UnknownRecord);
            const validation = validateConstructionPlanForRelease(tampered);
            assert.ok(validation.issues.some((issue) => (
                issue.code === 'erp_snapshot.project_binding'
                && issue.path === `projectSnapshot.${path}`
            )), path);
        });

        const tokenLeak = structuredClone(plan);
        ((tokenLeak.erpSnapshot as UnknownRecord).site as UnknownRecord).value = {
            ...((((tokenLeak.erpSnapshot as UnknownRecord).site as UnknownRecord).value as UnknownRecord)),
            imageUrl: 'https://storage.invalid/site.jpg?token=private-token',
            photos: ['https://storage.invalid/site.jpg?token=private-token'],
        };
        const tokenValidation = validateConstructionPlanForRelease(tokenLeak);
        assert.ok(tokenValidation.issues.some((issue) => issue.code === 'erp_snapshot.noncanonical'));
    });

    it('requires per-role reasons for multi-role workers and an explicit reason for cross-site workers', () => {
        const base = makeReadyPlan();
        const organization = base.organizationSnapshot as UnknownRecord;
        const assignments = organization.assignments as UnknownRecord[];
        assignments.push({
            ...assignments[0],
            id: 'assignment-multi-role',
            role: 'equipment_manager',
            label: '장비담당 겸임',
            required: false,
            order: assignments.length,
        });
        const missingDuplicateReasons = validateConstructionPlanForRelease(base);
        assert.equal(missingDuplicateReasons.valid, false);
        assert.equal(missingDuplicateReasons.issues.filter((issue) => (
            issue.code === 'organization.duplicate_assignment_reason'
        )).length, 2);
        assignments.filter((assignment) => (
            isUnknownRecord(assignment.worker)
            && assignment.worker.id === (assignments[0].worker as UnknownRecord).id
        )).forEach((assignment) => {
            assignment.exceptionReason = '현장 운영계획에 따라 승인된 한시 겸임';
        });
        assert.equal(validateConstructionPlanForRelease(base).valid, true);

        const external = structuredClone(makeReadyPlan());
        const externalOrganization = external.organizationSnapshot as UnknownRecord;
        const externalAssignments = externalOrganization.assignments as UnknownRecord[];
        externalAssignments[0].worker = {
            ...(externalAssignments[0].worker as UnknownRecord),
            siteId: 'site-2',
        };
        let externalValidation = validateConstructionPlanForRelease(external);
        assert.ok(externalValidation.issues.some((issue) => issue.code === 'organization.external_assignment_flag'));
        assert.ok(externalValidation.issues.some((issue) => issue.code === 'organization.external_assignment_reason'));
        externalAssignments[0].externalAssignment = true;
        externalAssignments[0].exceptionReason = '타 현장 책임자 승인 지원 배정';
        const externalWorkers = [
            ...externalAssignments.flatMap((assignment) => isUnknownRecord(assignment.worker) ? [assignment.worker] : []),
            ...(externalOrganization.additionalWorkers as UnknownRecord[]),
        ];
        const externalBinding = buildConstructionPlanWorkerDirectoryBinding(externalWorkers);
        (externalOrganization.workerDirectoryProvenance as UnknownRecord).sourceWorkerIds = externalBinding.sourceWorkerIds;
        (externalOrganization.workerDirectoryProvenance as UnknownRecord).sourceMasterHash = externalBinding.sourceMasterHash;
        externalValidation = validateConstructionPlanForRelease(external);
        assert.equal(externalValidation.valid, true, JSON.stringify(externalValidation.issues));

        const duplicateAdditional = structuredClone(base);
        (duplicateAdditional.organizationSnapshot as UnknownRecord).additionalWorkers = [
            ((duplicateAdditional.organizationSnapshot as UnknownRecord).assignments as UnknownRecord[])[0].worker,
        ];
        assert.ok(validateConstructionPlanForRelease(duplicateAdditional).issues.some((issue) => (
            issue.code === 'organization.worker_directory_noncanonical'
        )));

        const forged = structuredClone(base);
        const forgedOrganization = forged.organizationSnapshot as UnknownRecord;
        const forgedAssignments = forgedOrganization.assignments as UnknownRecord[];
        forgedAssignments[0].worker = { ...(forgedAssignments[0].worker as UnknownRecord), name: '위조 이름' };
        assert.ok(validateConstructionPlanForRelease(forged).issues.some((issue) => (
            ['organization.worker_directory_binding', 'organization.worker_directory_invalid'].includes(issue.code)
        )));

        const missing = structuredClone(base);
        const missingProvenance = (missing.organizationSnapshot as UnknownRecord)
            .workerDirectoryProvenance as UnknownRecord;
        missingProvenance.sourceWorkerIds = (missingProvenance.sourceWorkerIds as string[]).slice(1);
        assert.ok(validateConstructionPlanForRelease(missing).issues.some((issue) => (
            issue.code === 'organization.worker_directory_binding'
        )));

        const inactive = structuredClone(base);
        const inactiveAssignments = ((inactive.organizationSnapshot as UnknownRecord).assignments as UnknownRecord[]);
        inactiveAssignments[0].worker = { ...(inactiveAssignments[0].worker as UnknownRecord), status: 'inactive' };
        assert.ok(validateConstructionPlanForRelease(inactive).issues.some((issue) => (
            issue.code === 'organization.worker_directory_invalid'
        )));
    });

    it('accepts the full 500-worker canonical organization directory without truncation', () => {
        const plan = makeReadyPlan();
        const organization = plan.organizationSnapshot as UnknownRecord;
        const assigned = (organization.assignments as UnknownRecord[])
            .flatMap((assignment) => isUnknownRecord(assignment.worker) ? [assignment.worker] : []);
        const additional = Array.from({ length: 497 }, (_, index) => ({
            id: `worker-extra-${String(index + 1).padStart(3, '0')}`,
            name: `추가 작업자 ${String(index + 1).padStart(3, '0')}`,
            status: 'active',
        }));
        const directory = buildConstructionPlanWorkerDirectoryBinding([...assigned, ...additional]);
        const assignedIds = new Set(assigned.map((worker) => String(worker.id)));
        organization.additionalWorkers = directory.workers.filter((worker) => !assignedIds.has(worker.id));
        organization.workerDirectoryProvenance = {
            captureKind: 'initial', sourceSiteId: 'site-1', capturedAt: '2026-08-21T00:00:00.000Z',
            sourceMasterHash: directory.sourceMasterHash, sourceWorkerIds: directory.sourceWorkerIds,
        };
        const validation = validateConstructionPlanForRelease(plan);
        assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    });

    it('fails closed when any of the ten structured section contracts is incomplete', () => {
        const plan = makeReadyPlan();
        const structuredKeys = [
            'material-plan', 'equipment-signal', 'site-installation-plan', 'concrete-pour-plan',
            'dismantling-plan', 'retention-plan', 'emergency-plan', 'quality-plan',
            'safety-plan', 'environment-plan',
        ];
        (plan.sections as UnknownRecord[]).forEach((section) => {
            if (structuredKeys.includes(String(section.key))) section.content = { structuredDataVersion: 1, applicableZones: [] };
        });
        const result = validateConstructionPlanForRelease(plan);
        assert.equal(result.valid, false);
        structuredKeys.forEach((key) => {
            assert.ok(result.issues.some((issue) => issue.path.startsWith(`sections.${key}.content`)), key);
        });
        assert.ok(result.issues.every((issue) => !issue.path.includes('.content.body')));
    });

    it('requires an explicit structured Hold Point decision independent of plan approval or execution records', () => {
        const legacy = makeReadyPlan();
        const quality = (legacy.sections as UnknownRecord[]).find((section) => section.key === 'quality-plan') as UnknownRecord;
        const content = quality.content as UnknownRecord;
        content.holdPoints = [{
            id: 'hold-legacy', stage: '타설 전', evidence: '검측표', approverRole: '현장책임자',
        }];
        const legacyResult = validateConstructionPlanForRelease(legacy);
        ['responsibleRole', 'completionCondition', 'decisionStatus', 'decisionAt', 'decisionComment']
            .forEach((field) => assert.ok(legacyResult.issues.some((issue) => issue.path.endsWith(`.${field}`)), field));

        const pending = makeReadyPlan();
        const pendingQuality = (pending.sections as UnknownRecord[]).find((section) => section.key === 'quality-plan') as UnknownRecord;
        const pendingContent = pendingQuality.content as UnknownRecord;
        const holdPoint = (pendingContent.holdPoints as UnknownRecord[])[0];
        holdPoint.decisionStatus = 'pending';
        assert.ok(validateConstructionPlanForRelease(pending).issues.some((issue) => (
            issue.path.endsWith('.decisionStatus')
        )));

        const rejected = makeReadyPlan();
        const rejectedQuality = (rejected.sections as UnknownRecord[]).find((section) => section.key === 'quality-plan') as UnknownRecord;
        const rejectedHoldPoint = ((rejectedQuality.content as UnknownRecord).holdPoints as UnknownRecord[])[0];
        rejectedHoldPoint.decisionStatus = 'rejected';
        assert.ok(validateConstructionPlanForRelease(rejected).issues.some((issue) => (
            issue.path.endsWith('.decisionStatus')
        )));

        const conditional = makeReadyPlan();
        const conditionalQuality = (conditional.sections as UnknownRecord[]).find((section) => section.key === 'quality-plan') as UnknownRecord;
        const conditionalHoldPoint = ((conditionalQuality.content as UnknownRecord).holdPoints as UnknownRecord[])[0];
        conditionalHoldPoint.decisionStatus = 'conditional';
        conditionalHoldPoint.decisionComment = '보강 후';
        assert.ok(validateConstructionPlanForRelease(conditional).issues.some((issue) => (
            issue.path.endsWith('.decisionComment')
        )));
        conditionalHoldPoint.decisionComment = 'A구간 가새 보강 및 재검측 완료 후 작업 재개';
        assert.equal(validateConstructionPlanForRelease(conditional).valid, true);
    });

    it('validates all five equipment categories and requires reusable stage and control data', () => {
        const plan = makeReadyPlan();
        plan.equipmentPlan = ['lifting', 'transport', 'work-at-height', 'assembly', 'measurement'].map((category, index) => ({
            id: `equipment-${index + 1}`,
            category,
            equipmentName: `장비 ${index + 1}`,
            model: 'MODEL-A',
            ratedCapacity: '10t',
            workRadius: '8m',
            inspectionValidUntil: '2099-12-31',
            workZones: ['A구간'],
            plannedStages: ['설치'],
            controlMeasures: ['출입통제'],
        }));
        assert.equal(validateConstructionPlanForRelease(plan).valid, true);
        (plan.equipmentPlan as UnknownRecord[])[2].controlMeasures = [];
        const invalid = validateConstructionPlanForRelease(plan);
        assert.ok(invalid.issues.some((issue) => issue.code === 'equipment.incomplete' && issue.path === 'equipmentPlan[2]'));
    });

    it('enforces the selected template five-by-five risk policy and rejects legacy qualitative rows', () => {
        const plan = makeReadyPlan();
        plan.riskAssessments = [{
            id: 'risk-v2', assessmentMethodVersion: 2, workStage: '설치', hazard: '붕괴',
            initialProbability: 4, initialSeverity: 5, initialRiskLevel: 'critical',
            mitigationMeasures: ['가새 설치·출입통제'], responsibleWorkerId: 'worker-1',
            residualProbability: 2, residualSeverity: 2, residualRiskLevel: 'low',
            methodReference: '청연이엔지 시스템동바리 5×5 위험성평가 기준 v2', reviewTrigger: '공법 또는 설치·해체 순서 변경',
            verifiedBy: 'reviewer-1',
        }];
        assert.equal(validateConstructionPlanForRelease(plan).valid, true);
        (plan.riskAssessments as UnknownRecord[])[0].residualRiskLevel = 'high';
        (plan.riskAssessments as UnknownRecord[])[0].residualProbability = 5;
        (plan.riskAssessments as UnknownRecord[])[0].residualSeverity = 4;
        const invalid = validateConstructionPlanForRelease(plan);
        assert.ok(invalid.issues.some((issue) => issue.code === 'risk.residual_not_reduced'));
        assert.ok(invalid.issues.some((issue) => issue.code === 'risk.matrix_level_mismatch'));
        const legacy = makeReadyPlan();
        delete (legacy.riskAssessments as UnknownRecord[])[0].assessmentMethodVersion;
        delete (legacy.riskAssessments as UnknownRecord[])[0].initialProbability;
        delete (legacy.riskAssessments as UnknownRecord[])[0].initialSeverity;
        assert.ok(validateConstructionPlanForRelease(legacy).issues.some((issue) => issue.code === 'risk.template_policy_mismatch'));
    });

    it('blocks changed template/renderer versions and duplicate/mutated page contract', () => {
        const plan = makeReadyPlan();
        plan.templateVersion = 'client-newer-version';
        plan.rendererVersion = 'mvp-1';
        const sections = plan.sections as UnknownRecord[];
        sections[2] = { ...sections[2], pageNumbers: [3, 3] };
        const result = validateConstructionPlanForRelease(plan);
        assert.equal(result.valid, false);
        assert.ok(result.issues.some((issue) => issue.code === 'template.version'));
        assert.ok(result.issues.some((issue) => issue.code === 'renderer.version'));
        assert.ok(result.issues.some((issue) => issue.code === 'section.pages'));
        assert.ok(result.issues.some((issue) => issue.code === 'template.pages'));
    });

    it('blocks placeholders, example flags, and a drawing without approval', () => {
        const plan = makeReadyPlan();
        const sections = plan.sections as UnknownRecord[];
        sections[4] = {
            ...sections[4],
            content: { note: '{{현장명 입력}}' },
            containsExampleValues: true,
        };
        const drawings = plan.drawings as UnknownRecord[];
        drawings[0] = { ...drawings[0], approvalStatus: 'draft', approvalReference: '' };
        const result = validateConstructionPlanForRelease(plan);
        assert.equal(result.valid, false);
        assert.ok(result.issues.some((issue) => issue.code === 'content.draft_marker'));
        assert.ok(result.issues.some((issue) => issue.code === 'section.example_values'));
        assert.ok(result.issues.some((issue) => issue.code === 'drawing.not_approved'));
    });

    it('blocks incomplete risk confirmation without rejecting workers that continue onto later A4 pages', () => {
        const plan = makeReadyPlan();
        plan.riskAssessments = [{ id: 'risk-incomplete', workStage: '해체' }];
        const organization = plan.organizationSnapshot as UnknownRecord;
        organization.additionalWorkers = Array.from({ length: 17 }, (_, index) => ({
            id: `worker-${index}`,
            name: `작업자 ${index}`,
            status: 'active',
        }));
        const result = validateConstructionPlanForRelease(plan);
        assert.equal(result.valid, false);
        assert.ok(result.issues.some((issue) => issue.code === 'risk.incomplete'));
        assert.equal(result.issues.some((issue) => issue.code === 'a4.capacity'), false);
    });

    it('blocks an incomplete server revision lineage before review or release', () => {
        const plan = makeReadyPlan();
        plan.seriesId = 'series-1';
        plan.lineageRootPlanId = 'plan-root';
        plan.supersedesPlanId = 'plan-0';
        plan.sourceSnapshotHash = 'd'.repeat(64);
        const result = validateConstructionPlanForRelease(plan);
        assert.equal(result.valid, false);
        assert.ok(result.issues.some((issue) => issue.code === 'lineage.revision'));
    });
});

describe('construction-plan privacy and authorization helpers', () => {
    it('removes site-master media URLs and tokens from every canonical and legacy snapshot path', () => {
        const privateUrl = 'https://storage.example/site.jpg?alt=media&token=private-download-token';
        const projectedSite = projectConstructionPlanSiteMasterSnapshot({
            id: 'site-media',
            name: '미디어 격리 현장',
            imageUrl: privateUrl,
            photos: [privateUrl],
        });
        assert.deepEqual(projectedSite, { id: 'site-media', name: '미디어 격리 현장' });

        const canonical = buildCanonicalConstructionPlanDraftContext({
            siteId: 'site-media',
            site: {
                id: 'site-media', name: '미디어 격리 현장', imageUrl: privateUrl, photos: [privateUrl],
                buildings: ['101동'], floors: ['1층'], zones: ['A구간'],
            },
            requestedProjectSnapshot: { sitePhotos: [privateUrl] },
            safeWorkers: [],
            actorId: 'author-1',
            capturedAt: '2026-08-22T00:00:00.000Z',
        });
        assert.deepEqual(canonical.projectSnapshot.sitePhotos, []);
        assert.equal(JSON.stringify(canonical).includes('private-download-token'), false);

        const legacyProject = sanitizeConstructionPlanProjectSnapshot({
            siteName: '기존 현장', sitePhotos: [privateUrl],
        }, '2026-08-22T00:00:00.000Z');
        assert.deepEqual(legacyProject.sitePhotos, []);
        const legacyErp = sanitizeConstructionPlanErpSnapshot({
            schemaVersion: 1,
            capturedAt: '2026-08-22T00:00:00.000Z',
            site: {
                source: 'site', sourceId: 'site-media', capturedAt: '2026-08-22T00:00:00.000Z',
                value: { id: 'site-media', name: '미디어 격리 현장', imageUrl: privateUrl, photos: [privateUrl] },
            },
        }, '2026-08-22T00:00:00.000Z');
        assert.equal(JSON.stringify(legacyErp).includes('private-download-token'), false);
    });

    it('canonicalizes the active worker directory by name and id and rejects conflicting or inactive identities', () => {
        const first = { id: 'worker-b', name: '가 작업자', status: 'active' as const, teamId: 'team-1' };
        const second = { id: 'worker-a', name: '가 작업자', status: 'active' as const, teamId: 'team-1' };
        const binding = buildConstructionPlanWorkerDirectoryBinding([first, second, first]);
        assert.deepEqual(binding.workers.map((entry) => entry.id), ['worker-a', 'worker-b']);
        assert.deepEqual(binding.sourceWorkerIds, ['worker-a', 'worker-b']);
        assert.equal(binding.sourceMasterHash, sha256Hex(canonicalStringify(binding.workers)));
        assert.throws(() => buildConstructionPlanWorkerDirectoryBinding([
            first,
            { ...first, name: '위조 이름' },
        ]), /worker-conflict/);
        assert.throws(() => buildConstructionPlanWorkerDirectoryBinding([
            { id: 'worker-inactive', name: '비활성', status: 'inactive' },
        ]), /worker-not-active/);
    });

    it('projects only directory-safe worker fields', () => {
        const projected = projectSafeWorkerDirectoryEntry({
            id: 'worker-1',
            name: '이안전',
            role: '안전관리자',
            rank: '대리',
            teamId: 'team-1',
            teamName: '현장팀',
            siteId: 'site-2',
            profileImageUrl: 'https://example.test/photo.png',
            phone: '010-0000-0000',
            residentNumber: 'secret',
            bankAccount: 'secret',
            unitPrice: 500000,
            isActive: true,
        });
        assert.deepEqual(projected, {
            id: 'worker-1',
            name: '이안전',
            status: 'active',
            role: '안전관리자',
            position: '대리',
            teamId: 'team-1',
            teamName: '현장팀',
            siteId: 'site-2',
        });
        assert.equal(Object.prototype.hasOwnProperty.call(projected, 'phone'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(projected, 'photoUrl'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(projected, 'bankAccount'), false);
    });

    it('canonicalizes cross-site assignment flags while preserving bounded role-specific reasons', () => {
        const timestamp = '2026-08-22T01:02:03.000Z';
        const sanitized = sanitizeConstructionPlanOrganizationSnapshot({
            capturedAt: timestamp,
            sourceSiteId: 'site-1',
            assignments: [{
                id: 'assignment-external', role: 'safety_manager', label: '안전담당',
                required: true, responsibilities: ['안전 관리'], order: 0,
                externalAssignment: false,
                exceptionReason: '타 현장 안전관리자 승인 지원 배정',
                forgedReasonApproval: true,
                worker: {
                    id: 'worker-external', name: '이외부', status: 'active', siteId: 'site-2',
                    phone: '010-0000-0000', bankAccount: 'secret',
                },
            }, {
                id: 'assignment-legacy', role: 'construction_manager', label: '공사담당',
                required: true, responsibilities: ['공사 관리'], order: 1,
                worker: { id: 'worker-legacy', name: '박레거시', status: 'active' },
            }],
            additionalWorkers: [],
        }, timestamp, 'site-1', true);
        const assignments = sanitized.assignments as UnknownRecord[];
        assert.equal(assignments[0].externalAssignment, true);
        assert.equal(assignments[0].exceptionReason, '타 현장 안전관리자 승인 지원 배정');
        assert.equal(Object.prototype.hasOwnProperty.call(assignments[0], 'forgedReasonApproval'), false);
        assert.equal((assignments[0].worker as UnknownRecord).siteId, 'site-2');
        assert.equal(Object.prototype.hasOwnProperty.call(assignments[0].worker, 'phone'), false);
        assert.equal(assignments[1].externalAssignment, false, 'legacy worker without siteId must stay local-neutral');

        assert.throws(() => sanitizeConstructionPlanOrganizationSnapshot({
            assignments: [{
                id: 'assignment-short', role: 'safety_manager', label: '안전담당',
                required: true, responsibilities: [], order: 0,
                externalAssignment: true, exceptionReason: '짧음',
                worker: { id: 'worker-short', name: '김단문', status: 'active', siteId: 'site-2' },
            }],
            additionalWorkers: [],
        }, timestamp, 'site-1', true), /construction-plan-organization-exception-reason-invalid/);
    });

    it('preserves the full 500-entry safe worker directory snapshot and rejects entry 501', () => {
        const safeWorkers = Array.from({ length: CONSTRUCTION_PLAN_MAX_SAFE_WORKERS }, (_, index) => ({
            id: `worker-${String(index + 1).padStart(3, '0')}`,
            name: `시스템 작업자 ${String(index + 1).padStart(3, '0')}`,
            status: 'active' as const,
            role: '시스템 설치공',
            teamId: 'team-1',
            teamName: '시스템 시공팀',
        }));
        const canonical = buildCanonicalConstructionPlanDraftContext({
            siteId: 'site-500-workers',
            site: { id: 'site-500-workers', siteName: '500명 조직도 현장' },
            requestedProjectSnapshot: {},
            safeWorkers,
            actorId: 'author-1',
            capturedAt: '2026-08-22T01:02:03.000Z',
        });
        const organization = canonical.organizationSnapshot;
        assert.equal((organization.additionalWorkers as UnknownRecord[]).length, 500);
        const sanitized = sanitizeConstructionPlanOrganizationSnapshot(
            organization,
            '2026-08-22T01:02:03.000Z',
            'site-500-workers',
        );
        assert.equal((sanitized.additionalWorkers as UnknownRecord[]).length, 500);
        assert.throws(
            () => sanitizeConstructionPlanOrganizationSnapshot({
                ...organization,
                additionalWorkers: [...safeWorkers, {
                    id: 'worker-501', name: '시스템 작업자 501', status: 'active',
                }],
            }, '2026-08-22T01:02:03.000Z', 'site-500-workers'),
            /construction-plan-organization-additional-workers-invalid/,
        );
    });

    it('limits site roles to review submission and reserves approval/issue for office/admin', () => {
        const site = classifyConstructionPlanRoleAccess(['site_manager']);
        const office = classifyConstructionPlanRoleAccess([['office_staff']]);
        assert.equal(site.canSubmitReview, true);
        assert.equal(site.canReviewApproveIssue, false);
        assert.equal(office.canReviewApproveIssue, true);
    });

    it('honors profile-only admin IDs even when an authentication token still has a site role', () => {
        const profileOnly = classifyConstructionPlanRoleAccess([
            undefined,
            'jhl2VTnk9V3C4EiZ4QQI',
        ]);
        const staleTokenWithProfilePosition = classifyConstructionPlanRoleAccess([
            'site_manager',
            'pos_jhl2VTnk9V3C4EiZ4QQI',
        ]);
        assert.equal(profileOnly.isAdmin, true);
        assert.equal(profileOnly.canReviewApproveIssue, true);
        assert.equal(staleTokenWithProfilePosition.isAdmin, true);
        assert.equal(staleTokenWithProfilePosition.canReviewApproveIssue, true);
    });

    it('recognizes only explicit plan creators and workflow participants', () => {
        const plan = {
            createdBy: 'author-1',
            participants: {
                authorIds: ['author-2'],
                reviewerIds: ['reviewer-1'],
                approverIds: ['approver-1'],
            },
        };
        assert.equal(isConstructionPlanParticipant(plan, 'author-1'), true);
        assert.equal(isConstructionPlanParticipant(plan, 'reviewer-1'), true);
        assert.equal(isConstructionPlanParticipant(plan, 'site-peer'), false);
    });

    it('builds the initial site and organization snapshot only from server-trusted sources', () => {
        const safetyWorker = projectSafeWorkerDirectoryEntry({
            id: 'worker-safety',
            name: '안전 담당자',
            role: '안전관리자',
            teamId: 'team-1',
            siteId: 'site-2',
            phone: '010-should-never-cross',
            bankAccount: 'secret',
            status: 'active',
        });
        const siteManager = projectSafeWorkerDirectoryEntry({
            id: 'worker-manager',
            name: '현장 소장',
            position: '차장',
            teamId: 'team-1',
            status: 'active',
        });
        assert.ok(safetyWorker);
        assert.ok(siteManager);

        const canonical = buildCanonicalConstructionPlanDraftContext({
            siteId: 'site-1',
            site: {
                id: 'site-1',
                siteName: '서버 현장명',
                address: '서울시 서버로 1',
                clientCompanyId: 'company-client',
                clientCompanyName: '오래된 발주처명',
                companyId: 'company-contractor',
                companyName: '오래된 시공사명',
                partnerId: 'company-partner',
                partnerName: '오래된 협력사명',
                responsibleTeamId: 'team-1',
                responsibleTeamName: '오래된 담당팀명',
                buildings: ['101동'],
                floors: ['1층'],
                zones: ['전체'],
                updatedAt: '2026-08-20T00:00:00.000Z',
            },
            clientCompany: {
                id: 'company-client',
                name: '서버 발주처',
                businessNumber: '111-22-33333',
                bankName: '절대 저장 금지',
                accountNumber: '111-secret',
                updatedAt: '2026-08-19T00:00:00.000Z',
            },
            contractorCompany: {
                id: 'company-contractor',
                name: '서버 시공사',
                ceoName: '대표자',
                ceoResidentNumber: 'secret-resident-number',
                updatedAt: '2026-08-18T00:00:00.000Z',
            },
            partnerCompany: {
                id: 'company-partner',
                name: '서버 협력사',
                phone: '02-1234-5678',
                accountNumber: 'secret-partner-account',
            },
            responsibleTeam: {
                id: 'team-1',
                name: '서버 담당팀',
                leaderId: 'worker-manager',
                leaderName: '현장 소장',
                memberNames: ['저장하면 안 되는 전체 명단'],
                bankName: '저장 금지',
                updatedAt: '2026-08-17T00:00:00.000Z',
            },
            requestedProjectSnapshot: {
                siteName: '위조 현장명',
                address: '위조 주소',
                buildings: ['102동'],
                floors: ['3층'],
                zones: ['A구간'],
            },
            safeWorkers: [safetyWorker, siteManager],
            preferredSiteManagerWorkerIds: ['worker-manager'],
            actorId: 'author-1',
            capturedAt: '2026-08-21T01:02:03.000Z',
        });

        assert.deepEqual(canonical.projectSnapshot, {
            siteName: '서버 현장명',
            address: '서울시 서버로 1',
            clientName: '서버 발주처',
            contractorName: '서버 시공사',
            buildings: ['102동'],
            floors: ['3층'],
            zones: ['A구간'],
            sitePhotos: [],
            emergencyContactsComplete: false,
            differsFromMaster: false,
        });
        const erp = canonical.erpSnapshot;
        assert.equal(erp.schemaVersion, 1);
        assert.equal(erp.capturedAt, '2026-08-21T01:02:03.000Z');
        assert.deepEqual(erp.clientCompany, {
            value: {
                id: 'company-client',
                name: '서버 발주처',
                businessNumber: '111-22-33333',
            },
            source: 'company',
            sourceId: 'company-client',
            sourceUpdatedAt: '2026-08-19T00:00:00.000Z',
            capturedAt: '2026-08-21T01:02:03.000Z',
            overridden: false,
        });
        const teamSnapshot = (erp.responsibleTeam as UnknownRecord).value as UnknownRecord;
        assert.deepEqual(teamSnapshot, {
            id: 'team-1',
            name: '서버 담당팀',
            leaderWorkerId: 'worker-manager',
            leaderName: '현장 소장',
        });
        const sanitizedErp = sanitizeConstructionPlanErpSnapshot(
            canonical.erpSnapshot,
            '2026-08-21T01:02:03.000Z',
        );
        assert.deepEqual(sanitizedErp, canonical.erpSnapshot);
        const serializedErp = JSON.stringify(canonical.erpSnapshot);
        assert.equal(serializedErp.includes('secret'), false);
        assert.equal(serializedErp.includes('전체 명단'), false);
        assert.equal(serializedErp.includes('저장 금지'), false);
        const organization = canonical.organizationSnapshot;
        assert.ok(Array.isArray(organization.assignments));
        const assignments = organization.assignments as UnknownRecord[];
        assert.equal((assignments.find((value) => value.role === 'site_manager')?.worker as UnknownRecord)?.id, 'worker-manager');
        const safetyAssignment = assignments.find((value) => value.role === 'safety_manager') as UnknownRecord;
        assert.equal((safetyAssignment.worker as UnknownRecord)?.id, 'worker-safety');
        assert.equal(safetyAssignment.externalAssignment, true);
        assert.equal(JSON.stringify(organization).includes('010-should-never-cross'), false);
        assert.equal(JSON.stringify(organization).includes('secret'), false);
        assert.deepEqual(canonical.participants, {
            authorIds: ['author-1'],
            reviewerIds: [],
            approverIds: [],
        });
    });

    it('projects company and team masters with explicit public-work allowlists', () => {
        assert.deepEqual(projectConstructionPlanCompanyMasterSnapshot({
            id: 'company-1',
            name: '청연이엔지',
            code: 'CY',
            businessNumber: '123-45-67890',
            ceoName: '대표자',
            address: '서울시',
            phone: '02-0000-0000',
            fax: '02-0000-0001',
            email: 'office@example.test',
            type: '시공사',
            status: 'active',
            ceoResidentNumber: 'secret',
            bankName: 'secret',
            accountNumber: 'secret',
            assignedClientCompanyIds: ['secret'],
        }), {
            id: 'company-1',
            name: '청연이엔지',
            code: 'CY',
            businessNumber: '123-45-67890',
            representativeName: '대표자',
            address: '서울시',
            phone: '02-0000-0000',
            fax: '02-0000-0001',
            email: 'office@example.test',
            type: '시공사',
            status: 'active',
        });
        assert.deepEqual(projectConstructionPlanTeamMasterSnapshot({
            id: 'team-1',
            name: '시공1팀',
            type: '직영',
            leaderId: 'worker-1',
            leaderName: '팀장',
            companyId: 'company-1',
            companyName: '청연이엔지',
            parentTeamId: 'team-root',
            parentTeamName: '시공본부',
            status: 'active',
            memberIds: ['private-worker'],
            memberNames: ['private-name'],
            bankName: 'secret',
            accountNumber: 'secret',
            supportRate: 123456,
        }), {
            id: 'team-1',
            name: '시공1팀',
            type: '직영',
            leaderWorkerId: 'worker-1',
            leaderName: '팀장',
            companyId: 'company-1',
            companyName: '청연이엔지',
            parentTeamId: 'team-root',
            parentTeamName: '시공본부',
            status: 'active',
        });
    });

    it('never binds an unrelated company master and keeps a missing master explicit', () => {
        const base = {
            siteId: 'site-1',
            site: {
                id: 'site-1',
                name: '현장',
                clientCompanyId: 'company-client',
                clientCompanyName: '현장에 저장된 발주사명',
            },
            requestedProjectSnapshot: {
                buildings: ['101동'],
                floors: ['1층'],
                zones: ['A구간'],
            },
            safeWorkers: [],
            actorId: 'author-1',
            capturedAt: '2026-08-21T01:02:03.000Z',
        } as const;
        const missing = buildCanonicalConstructionPlanDraftContext(base);
        assert.equal(missing.projectSnapshot.clientName, '현장에 저장된 발주사명');
        assert.equal(Object.prototype.hasOwnProperty.call(missing.erpSnapshot, 'clientCompany'), false);
        assert.throws(
            () => buildCanonicalConstructionPlanDraftContext({
                ...base,
                clientCompany: { id: 'company-other', name: '다른 회사' },
            }),
            /construction-plan-canonical-company-binding-invalid/,
        );
    });

    it('resolves PDF-visible project fields from partial and mixed ERP sources', () => {
        const canonical = buildCanonicalConstructionPlanDraftContext({
            siteId: 'site-1',
            site: {
                id: 'site-1', name: 'ERP 현장', address: '서울시 ERP로 1',
                startDate: '2026-01-01', endDate: '2026-12-31',
                clientCompanyName: '현장 발주처', contractorCompanyName: '현장 시공사',
            },
            clientCompany: undefined,
            safeWorkers: [],
            actorId: 'author-1',
            capturedAt: '2026-08-22T00:00:00.000Z',
        });
        const siteEnvelope = canonical.erpSnapshot.site as UnknownRecord;
        siteEnvelope.overridden = true;
        const resolved = resolveConstructionPlanErpVisibleProjectFields(
            canonical.erpSnapshot,
            '2026-08-22T00:00:00.000Z',
        );
        assert.deepEqual(resolved, {
            siteName: 'ERP 현장',
            address: '서울시 ERP로 1',
            clientName: '현장 발주처',
            contractorName: '현장 시공사',
            constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
            sitePhotos: [],
        });

        const missingOptional = buildCanonicalConstructionPlanDraftContext({
            siteId: 'site-2',
            site: {
                id: 'site-2',
                name: '선택 원천 없음',
                // These legacy aliases are intentionally outside the stored
                // site-master projection and must not become PDF authority.
                clientName: '로컬 별칭 발주처',
                contractorName: '로컬 별칭 시공사',
                constructionPeriod: { startDate: '2027-01-01', endDate: '2027-12-31' },
            },
            requestedProjectSnapshot: {
                constructionPeriod: { startDate: '2099-01-01', endDate: '2099-12-31' },
            },
            safeWorkers: [], actorId: 'author-1', capturedAt: '2026-08-22T00:00:00.000Z',
        });
        const missingResolved = resolveConstructionPlanErpVisibleProjectFields(
            missingOptional.erpSnapshot,
            '2026-08-22T00:00:00.000Z',
        );
        assert.deepEqual(missingResolved, { siteName: '선택 원천 없음', sitePhotos: [] });
        assert.deepEqual(missingOptional.projectSnapshot, {
            ...missingResolved,
            buildings: [],
            floors: [],
            zones: [],
            emergencyContactsComplete: false,
            differsFromMaster: false,
        });
    });

    it('records reviewer and approver ids once without dropping the other participant arrays', () => {
        const reviewed = addUniquePlanParticipant({
            authorIds: ['author-1'],
            reviewerIds: ['reviewer-1'],
            approverIds: [],
        }, 'reviewerIds', 'reviewer-1');
        const approved = addUniquePlanParticipant(reviewed, 'approverIds', 'approver-1');
        assert.deepEqual(approved, {
            authorIds: ['author-1'],
            reviewerIds: ['reviewer-1'],
            approverIds: ['approver-1'],
        });
    });
});

describe('canonical snapshot and issued PDF helpers', () => {
    it('carries only canonical ERP provenance into the immutable approval snapshot', () => {
        const plan = makeReadyPlan();
        plan.createdAt = '2026-08-21T00:00:00.000Z';
        plan.erpSnapshot = {
            schemaVersion: 1,
            capturedAt: '2026-08-21T00:00:00.000Z',
            site: {
                value: { id: 'site-1', name: '검증현장', code: 'SITE-1', privateMemo: 'drop-me' },
                source: 'site', sourceId: 'site-1', capturedAt: '2026-08-21T00:00:00.000Z', overridden: false,
                hiddenToken: 'drop-me',
            },
        };
        const validation = validateConstructionPlanForRelease(plan);
        assert.ok(validation.issues.some((issue) => issue.code === 'erp_snapshot.noncanonical'));
        const content = buildApprovedSnapshotContent('plan-1', plan);
        const serialized = canonicalStringify(content.erpSnapshot);
        assert.match(serialized, /"sourceId":"site-1"/);
        assert.equal(serialized.includes('privateMemo'), false);
        assert.equal(serialized.includes('hiddenToken'), false);
        assert.equal(serialized.includes('drop-me'), false);
    });

    it('canonicalizes object keys and excludes volatile workflow fields from the approved content', () => {
        assert.equal(canonicalStringify({ z: 1, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"z":1}');
        const first = makeReadyPlan();
        const sections = first.sections as UnknownRecord[];
        sections[0] = {
            ...sections[0],
            content: {
                ...((sections[0].content as UnknownRecord) || {}),
                summary: '현장 적용 요약',
                drawingStudio: {
                    schemaVersion: 1,
                    background: { storagePath: 'construction-plans/site/plan/drawings/source.pdf' },
                    objects: [{ id: 'stale-ui-cache' }],
                },
            },
        };
        const second = { ...first, updatedAt: 'later', editLock: { userId: 'other' }, lockVersion: 99 };
        const firstContent = buildApprovedSnapshotContent('plan-1', first);
        const secondContent = buildApprovedSnapshotContent('plan-1', second);
        assert.equal(sha256Hex(canonicalStringify(firstContent)), sha256Hex(canonicalStringify(secondContent)));
        assert.equal(firstContent.snapshotSchemaVersion, 2);
        const snapshotSections = firstContent.sections as UnknownRecord[];
        const snapshotSectionContent = snapshotSections[0].content as UnknownRecord;
        assert.equal(snapshotSectionContent.summary, '현장 적용 요약');
        assert.equal(Object.prototype.hasOwnProperty.call(snapshotSectionContent, 'drawingStudio'), false);
    });

    it('keeps review content hashes stable across lock rounds and ACL workflow changes', () => {
        const first = makeReadyPlan();
        const firstEnvelope = buildConstructionPlanReviewSnapshotContent('plan-1', first, 5);
        const secondEnvelope = buildConstructionPlanReviewSnapshotContent('plan-1', {
            ...first,
            status: 'review_completed',
            lockVersion: 7,
            participants: {
                authorIds: ['author-1'],
                reviewerIds: ['reviewer-1'],
                approverIds: ['approver-1'],
            },
            releaseReadiness: { requiredReviewsComplete: true },
        }, 7);
        assert.equal(
            sha256Hex(canonicalStringify(firstEnvelope)),
            sha256Hex(canonicalStringify(secondEnvelope)),
        );
        assert.equal(firstEnvelope.kind, 'review_submission');
        assert.equal(firstEnvelope.planId, 'plan-1');
        const content = firstEnvelope.content as UnknownRecord;
        assert.equal(content.createdBy, 'author-1');
        assert.equal(Object.prototype.hasOwnProperty.call(content, 'participants'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(firstEnvelope, 'planLockVersion'), false);
    });

    it('promotes the active content snapshot without binding a reused blob to the first round lock', () => {
        const hash = 'a'.repeat(64);
        const plan = {
            activeReviewSnapshotId: 'content-a',
            activeReviewSnapshotHash: hash,
            activeReviewSnapshotStoragePath: `construction-plans/site/plan/snapshots/${hash}.json`,
            activeReviewSnapshotLockVersion: 7,
            activeReviewPackageId: 'package-r2',
            activeReviewCycleId: 'cycle-r1',
        };
        const snapshot = {
            id: 'content-a',
            contentHash: hash,
            storagePath: plan.activeReviewSnapshotStoragePath,
            firstSubmittedPlanLockVersion: 5,
            immutable: true,
        };
        const reviewPackage = {
            id: 'package-r2',
            reviewDecision: 'completed',
            reviewSnapshotId: 'content-a',
            reviewSnapshotHash: hash,
            reviewSnapshotStoragePath: plan.activeReviewSnapshotStoragePath,
            reviewSnapshotLockVersion: 7,
        };
        const cycle = {
            id: 'cycle-r1',
            activePackageId: 'package-r2',
            frozen: false,
            commentSummary: {
                totalOpen: 0,
                totalAddressed: 0,
                totalResolved: 1,
                requiredOpen: 0,
                requiredAddressed: 0,
                requiredResolved: 1,
                unresolvedRequired: 0,
            },
        };
        assert.deepEqual(buildConstructionPlanApprovedSnapshotReference(plan, snapshot, reviewPackage, cycle), {
            approvedSnapshotId: 'content-a',
            approvedSnapshotHash: hash,
            approvedSnapshotStoragePath: plan.activeReviewSnapshotStoragePath,
        });
        assert.throws(
            () => buildConstructionPlanApprovedSnapshotReference(
                plan,
                snapshot,
                reviewPackage,
                { ...cycle, frozen: true },
            ),
            /package-binding-invalid/,
        );
        assert.throws(
            () => buildConstructionPlanApprovedSnapshotReference(
                plan,
                snapshot,
                reviewPackage,
                {
                    ...cycle,
                    commentSummary: {
                        ...(cycle.commentSummary as UnknownRecord),
                        totalAddressed: 1,
                        requiredAddressed: 1,
                        unresolvedRequired: 1,
                    },
                },
            ),
            /comments-unresolved/,
        );
    });

    it('carries required addressed comments as blocking until an authorized resolution', () => {
        const opened = applyConstructionPlanReviewCommentTransition({}, null, 'open', true);
        assert.equal(opened.unresolvedRequired, 1);
        const addressed = applyConstructionPlanReviewCommentTransition(opened, 'open', 'addressed', true);
        assert.equal(addressed.requiredOpen, 0);
        assert.equal(addressed.requiredAddressed, 1);
        assert.equal(addressed.unresolvedRequired, 1);
        const resolved = applyConstructionPlanReviewCommentTransition(addressed, 'addressed', 'resolved', true);
        assert.equal(resolved.unresolvedRequired, 0);
        const reopened = applyConstructionPlanReviewCommentTransition(resolved, 'resolved', 'open', true);
        assert.equal(reopened.unresolvedRequired, 1);
        assert.equal(assertConstructionPlanReviewCommentTransition('open', 'address'), 'addressed');
        assert.throws(
            () => assertConstructionPlanReviewCommentTransition('addressed', 'reopen'),
            /transition-invalid/,
        );
    });

    it('allows review-completed change requests and requires an author reply before addressed', () => {
        assert.equal(
            transitionConstructionPlanReviewStatus('review_completed', 'request_changes'),
            'changes_requested',
        );
        assert.throws(
            () => transitionConstructionPlanReviewStatus('approved_pending_issue', 'request_changes'),
            /transition-invalid/,
        );
        const base = {
            planCreatedBy: 'author-1',
            authorIds: ['author-1'],
            actorId: 'author-1',
            isCentral: false,
            planStatus: 'changes_requested',
            commentStatus: 'open',
        } as const;
        assert.equal(canAddressConstructionPlanReviewComment({ ...base, authorReplyCount: 0 }), false);
        assert.equal(canAddressConstructionPlanReviewComment({ ...base, authorReplyCount: 1 }), true);
        assert.equal(canAddressConstructionPlanReviewComment({
            ...base,
            actorId: 'reviewer-1',
            authorReplyCount: 1,
        }), false);
        assert.equal(canAddressConstructionPlanReviewComment({
            ...base,
            actorId: 'central-1',
            isCentral: true,
            authorReplyCount: 0,
        }), false);
        assert.equal(canAddressConstructionPlanReviewComment({
            ...base,
            actorId: 'central-1',
            isCentral: true,
            authorReplyCount: 1,
        }), true);
    });

    it('recovers identical review mutation retries and rejects key reuse with a changed payload', () => {
        const response = { planId: 'plan-1', status: 'in_review', lockVersion: 6 };
        const claim = {
            operation: 'submit_review',
            requestFingerprint: 'fingerprint-1',
            response,
        };
        assert.deepEqual(
            resolveConstructionPlanReviewMutationClaim(claim, 'submit_review', 'fingerprint-1'),
            response,
        );
        assert.throws(
            () => resolveConstructionPlanReviewMutationClaim(claim, 'submit_review', 'different'),
            /claim-conflict/,
        );
    });

    it('hash-binds immutable approval evidence to package, cycle and content snapshot', () => {
        const evidenceContent = {
            evidenceSchemaVersion: 1,
            kind: 'construction_plan_approval',
            planId: 'plan-1',
            reviewCycleId: 'cycle-1',
            reviewPackageId: 'package-2',
            snapshotId: 'content-1',
            contentHash: 'b'.repeat(64),
            storagePath: `construction-plans/site-1/plan-1/snapshots/${'b'.repeat(64)}.json`,
            reviewDecision: 'completed',
            approverId: 'approver-1',
            completedByName: '박검토',
            completedAt: '2026-08-21T23:00:00.000Z',
            approverName: '이승인',
            approvedAt: '2026-08-22T00:00:00.000Z',
            templateHash: 'c'.repeat(64),
            manifestHash: 'd'.repeat(64),
            templateBundleHash: 'e'.repeat(64),
            templateBindingHash: 'f'.repeat(64),
        };
        const evidenceHash = sha256Hex(canonicalStringify(evidenceContent));
        const evidence = { ...evidenceContent, evidenceHash, immutable: true };
        const expected = {
            planId: 'plan-1',
            evidenceHash,
            snapshotId: 'content-1',
            contentHash: 'b'.repeat(64),
            storagePath: evidenceContent.storagePath,
            reviewPackageId: 'package-2',
            reviewCycleId: 'cycle-1',
            templateHash: evidenceContent.templateHash,
            manifestHash: evidenceContent.manifestHash,
            templateBundleHash: evidenceContent.templateBundleHash,
            templateBindingHash: evidenceContent.templateBindingHash,
        };
        assert.doesNotThrow(() => assertConstructionPlanApprovalEvidenceBinding(evidence, expected));
        assert.throws(
            () => assertConstructionPlanApprovalEvidenceBinding(
                { ...evidence, reviewPackageId: 'package-forged' },
                expected,
            ),
            /binding-invalid/,
        );
        assert.throws(
            () => assertConstructionPlanApprovalEvidenceBinding(
                { ...evidence, approverName: '위조 승인자' },
                expected,
            ),
            /hash-invalid/,
        );
    });

    it('rejects hidden required comments and array-index field pointers', () => {
        assert.equal(isConstructionPlanRequiredCommentVisibilityAllowed(true, 'participants'), true);
        assert.equal(isConstructionPlanRequiredCommentVisibilityAllowed(true, 'central_only'), false);
        assert.equal(hasStableConstructionPlanReviewJsonPointer({ value: 1 }, '/value'), true);
        assert.equal(hasStableConstructionPlanReviewJsonPointer({ values: [{ value: 1 }] }, '/values/0/value'), false);
        assert.equal(hasStableConstructionPlanReviewJsonPointer({ value: 1 }, '/__proto__/value'), false);
        assert.equal(
            buildConstructionPlanFallbackPageFingerprint('ABCDEF', 0),
            'source:abcdef:page:0',
        );
        assert.notEqual(
            buildConstructionPlanFallbackPageFingerprint('ABCDEF', 0),
            buildConstructionPlanFallbackPageFingerprint('123456', 0),
        );
        const fallbackAnchor = {
            kind: 'drawing',
            drawingId: 'drawing-1',
            pageIndex: 0,
            pageFingerprint: buildConstructionPlanFallbackPageFingerprint('ABCDEF', 0),
        };
        assert.equal(classifyConstructionPlanDrawingReviewAnchor({
            id: 'drawing-1',
            sourceSha256: 'ABCDEF',
            pageCount: 1,
            pages: [],
            annotations: [],
        }, fallbackAnchor), 'valid');
        assert.equal(classifyConstructionPlanDrawingReviewAnchor({
            id: 'drawing-1',
            sourceSha256: '123456',
            pageCount: 1,
            pages: [],
            annotations: [],
        }, fallbackAnchor), 'stale');
        assert.equal(classifyConstructionPlanDrawingReviewAnchor(undefined, fallbackAnchor), 'orphaned');
    });

    it('rejects non-finite and out-of-range drawing comment coordinates', () => {
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(0), true);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(0.5), true);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(1), true);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(Number.NaN), false);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(Number.POSITIVE_INFINITY), false);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(-0.001), false);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate(1.001), false);
        assert.equal(isNormalizedConstructionPlanReviewCoordinate('0.5'), false);
    });

    it('summarizes renderer-level field, section and drawing changes without workflow noise', () => {
        const previous = {
            content: {
                title: 'A',
                sections: [{ id: 's1', content: { value: 1 } }],
                drawings: [{ id: 'd1', revision: 'A' }, { id: 'd-old' }],
            },
        };
        const current = {
            content: {
                title: 'B',
                sections: [{ id: 's1', content: { value: 2 } }],
                drawings: [{ id: 'd1', revision: 'B' }, { id: 'd-new' }],
            },
        };
        const summary = summarizeConstructionPlanReviewDiff(previous, current);
        assert.equal(summary.summaryVersion, 2);
        assert.equal(summary.baselineKind, 'previous_submission');
        assert.deepEqual(summary.changedTopLevelFields, ['title']);
        assert.deepEqual(summary.changedSectionIds, ['s1']);
        assert.deepEqual(summary.changedDrawingIds, ['d1']);
        assert.deepEqual(summary.addedDrawingIds, ['d-new']);
        assert.deepEqual(summary.removedDrawingIds, ['d-old']);
        assert.equal(summary.fieldChanges.length, 2);
        assert.equal(summary.drawingChanges.length, 3);
        assert.equal(summary.changeCount, 5);
        const { summaryHash, ...summaryBody } = summary;
        assert.equal(summaryHash, sha256Hex(canonicalStringify(summaryBody)));
    });

    it('builds deterministic redacted inline text, structured field and annotation detail without omitting changes', () => {
        const style = { strokeToken: 'danger', fillToken: 'danger-fill', strokeWidthPt: 1, opacity: 0.5, dash: 'solid' };
        const annotation = (id: string, label: string, x: number): UnknownRecord => ({
            id,
            pageIndex: 0,
            pageFingerprint: 'page-fingerprint-secret',
            layer: 'restricted',
            geometry: { kind: 'rect', x, y: 0.2, w: 0.3, h: 0.4, rotationDeg: 0 },
            style,
            label,
            releaseCondition: '검토자 승인 후 해제',
            equipmentType: '타워크레인',
            equipmentId: 'equipment-old',
            entrance: '동문',
            destination: 'A동',
            radius: 10,
            responsibleWorkerId: 'worker-sensitive-old',
            responsibleRole: '유도자',
            materialType: '시스템동바리',
        });
        const previous = { content: {
            title: '시공계획서 A',
            projectSnapshot: { address: '서울시 중구 1', clientName: '발주사 A' },
            sections: [{
                id: 'method', title: '시공 방법', pageNumbers: [12, 13],
                content: {
                    standardTextCurrent: '설치 전 https://private.example/token?token=abc 를 확인하고 old@example.com 으로 나중에 보고한다.',
                    spacing: 900,
                },
            }],
            drawings: [{
                id: 'drawing-1', drawingNo: 'D-01', title: '설치 평면도', revision: 'A', approvalStatus: 'draft', pageCount: 1,
                pages: [{ pageIndex: 0, pageFingerprint: 'page-fingerprint-secret' }],
                annotations: [annotation('annotation-changed', '기존 통제구간', 0.1), annotation('annotation-deleted', '삭제 구간', 0.2)],
            }],
        } };
        const current = { content: {
            title: '시공계획서 B',
            projectSnapshot: { address: '서울시 중구 2', clientName: '발주사 B' },
            sections: [{
                id: 'method', title: '시공 방법', pageNumbers: [12, 13],
                content: {
                    standardTextCurrent: '설치 전 https://private.example/new?token=xyz 를 확인하고 new@example.com 으로 즉시 보고한다.',
                    spacing: 600,
                },
            }],
            drawings: [{
                id: 'drawing-1', drawingNo: 'D-01', title: '설치 평면도', revision: 'B', approvalStatus: 'reviewed', pageCount: 1,
                pages: [{ pageIndex: 0, pageFingerprint: 'page-fingerprint-secret' }],
                annotations: [
                    {
                        ...annotation('annotation-changed', '변경 통제구간', 0.15),
                        style: { ...style, strokeWidthPt: 2 },
                        releaseCondition: 'https://private.example/release 확인 후 해제',
                        equipmentType: '이동식크레인',
                        equipmentId: 'equipment-new',
                        entrance: '서문',
                        destination: 'B동',
                        radius: 12,
                        responsibleWorkerId: 'worker-sensitive-new',
                        responsibleRole: '신호수',
                        materialType: '시스템비계',
                    },
                    annotation('annotation-added', '추가 위험구간', 0.4),
                ],
            }],
        } };

        const first = summarizeConstructionPlanReviewDiff(previous, current, {
            baselineKind: 'prior_issued', baselineContentHash: 'a'.repeat(64), currentContentHash: 'b'.repeat(64),
        });
        const second = summarizeConstructionPlanReviewDiff(previous, current, {
            baselineKind: 'prior_issued', baselineContentHash: 'a'.repeat(64), currentContentHash: 'b'.repeat(64),
        });
        assert.deepEqual(first, second);
        assert.equal(first.baselineKind, 'prior_issued');
        assert.equal(first.textChanges.length, 1);
        assert.equal(first.textChanges[0].sectionId, 'method');
        assert.deepEqual(first.textChanges[0].pageNumbers, [12, 13]);
        assert.ok(first.textChanges[0].segments.some((segment) => segment.kind === 'removed'));
        assert.ok(first.textChanges[0].segments.some((segment) => segment.kind === 'added'));
        assert.ok(first.fieldChanges.some((change) => change.path.endsWith('/spacing') && change.before === '900' && change.after === '600'));
        assert.ok(first.fieldChanges.some((change) => change.path.endsWith('/address') && change.before === '[보호 정보]'));
        assert.deepEqual(first.annotationChanges.map((change) => change.changeType).sort(), ['added', 'changed', 'deleted']);
        const changedAnnotation = first.annotationChanges.find((change) => change.annotationId === 'annotation-changed');
        assert.ok(changedAnnotation?.changedParts.includes('geometry'));
        assert.ok(changedAnnotation?.changedParts.includes('style'));
        assert.ok(changedAnnotation?.changedParts.includes('equipment'));
        assert.ok(changedAnnotation?.changedParts.includes('route'));
        assert.ok(changedAnnotation?.changedParts.includes('responsibility'));
        assert.ok(changedAnnotation?.changedParts.includes('material'));
        assert.ok(changedAnnotation?.changedParts.includes('release'));
        assert.match(changedAnnotation?.geometryAfter || '', /사각형/);
        assert.match(changedAnnotation?.styleAfter || '', /두께 2pt/);
        assert.match(changedAnnotation?.metadataAfter || '', /장비종류 이동식크레인/);
        assert.match(changedAnnotation?.metadataAfter || '', /담당자 지정됨/);
        assert.equal(changedAnnotation?.metadataAfter?.includes('worker-sensitive-new'), false);
        assert.equal(changedAnnotation?.metadataAfter?.includes('private.example'), false);
        assert.match(changedAnnotation?.pageId || '', /^page-1-[a-f0-9]{12}$/);
        const serialized = canonicalStringify(first);
        assert.equal(serialized.includes('private.example'), false);
        assert.equal(serialized.includes('old@example.com'), false);
        assert.equal(serialized.includes('new@example.com'), false);
        assert.equal(first.changeCount, first.textChanges.length + first.fieldChanges.length + first.drawingChanges.length + first.annotationChanges.length);
    });

    it('fails closed when a review summary exceeds the bounded change contract', () => {
        const fields = Object.fromEntries(Array.from({ length: 801 }, (_entry, index) => [`field${index}`, index]));
        assert.throws(
            () => summarizeConstructionPlanReviewDiff({ content: {} }, { content: fields }),
            /diff-too-many-changes/,
        );
    });

    it('checks PDF magic, SHA-256 and bounded 42 through 200 physical pages', () => {
        const buffer = Buffer.from('%PDF-1.7\nserver-test');
        const hash = sha256Hex(buffer);
        assert.equal(validatePdfEnvelope(buffer, 42, hash).valid, true);
        assert.equal(validatePdfEnvelope(buffer, 57, hash).valid, true);
        const invalid = validatePdfEnvelope(Buffer.from('not-pdf'), 41, hash);
        assert.equal(invalid.valid, false);
        assert.deepEqual(invalid.issues.map((issue) => issue.code), ['pdf.magic', 'pdf.page_count', 'pdf.sha256']);
    });

    it('requires document identity and every ASCII page audit marker', () => {
        const pageMarkers = Array.from({ length: 42 }, (_, index) => `PAGE ${index + 1}/42`).join(' | ');
        const snapshotHash = 'b'.repeat(64);
        const text = `PLAN_ID=plan-1 | DOCUMENT_NO=CP-2026-001 | REV=5 | TEMPLATE_VERSION=1.0.0 | SNAPSHOT_HASH=${snapshotHash} | ${pageMarkers}`;
        const expected = {
            planId: 'plan-1',
            documentNo: 'CP-2026-001',
            revision: 5,
            templateVersion: '1.0.0',
            snapshotHash,
        };
        assert.equal(validatePdfAuditText(text, expected).valid, true);
        const invalid = validatePdfAuditText(text.replace('DOCUMENT_NO=CP-2026-001', 'DOCUMENT_NO=OTHER'), expected);
        assert.equal(invalid.valid, false);
        assert.ok(invalid.issues.some((issue) => issue.code === 'pdf.audit.document_no'));
    });

    it('binds every physical page to its own marker and mirrors renderer ASCII sanitization', () => {
        const snapshotHash = 'c'.repeat(64);
        const expected = {
            planId: 'plan-1',
            documentNo: '한글-CP=001',
            revision: 5,
            templateVersion: '1.0.0',
            snapshotHash,
        };
        const base = `PLAN_ID=plan-1 | DOCUMENT_NO=__-CP_001 | REV=5 | TEMPLATE_VERSION=1.0.0 | SNAPSHOT_HASH=${snapshotHash}`;
        const pages = Array.from({ length: 42 }, (_, index) => `${base} | PAGE ${index + 1}/42`);
        assert.equal(validatePdfAuditPages(pages, expected).valid, true);
        pages[4] = `${base} | PAGE 6/42`;
        const invalid = validatePdfAuditPages(pages, expected);
        assert.equal(invalid.valid, false);
        assert.ok(invalid.issues.some((issue) => issue.code === 'pdf.audit.page_marker'));

        const continuedExpected = { ...expected, physicalPageCount: 57 };
        const continuedPages = Array.from({ length: 57 }, (_, index) => `${base} | PAGE ${index + 1}/57`);
        assert.equal(validatePdfAuditPages(continuedPages, continuedExpected).valid, true);
        assert.equal(validatePdfAuditText(continuedPages.join(' | '), continuedExpected).valid, true);
    });

    it('accepts only the client content-addressed export path for the plan scope', () => {
        const hash = 'a'.repeat(64);
        const path = buildIssuedPdfCandidatePath('site 1', 'plan-1', 5, hash);
        assert.equal(path, `construction-plans/site-1/plan-1/exports/rev-05/${hash}.pdf`);
        assert.equal(isAllowedConstructionPlanPdfSourcePath(path, 'site 1', 'plan-1'), true);
        assert.equal(isAllowedConstructionPlanPdfSourcePath(`construction-plans/site-2/plan-1/exports/${hash}.pdf`, 'site 1', 'plan-1'), false);
    });
});
