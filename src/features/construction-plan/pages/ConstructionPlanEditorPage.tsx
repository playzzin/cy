import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    ChevronDown,
    Download,
    Eye,
    FileImage,
    FileCheck2,
    FileText,
    Loader2,
    Lock,
    PanelLeftClose,
    PanelRightClose,
    RefreshCw,
    Save,
    ShieldCheck,
    SlidersHorizontal,
    Unlock,
    WifiOff,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { storageService } from '../../../services/storageService';
import type {
    ConstructionPlan,
    DrawingApplicabilityDecision,
    OrganizationRole,
    OrganizationRoleAssignment,
    OrganizationSnapshot,
    PlanDrawing,
    PlanSection,
    SafeWorkerDirectoryEntry,
    ConstructionPlanSummary,
    UpdateConstructionPlanInput,
} from '../types';
import { isStructuredSectionKey } from '../types';
import {
    acquireConstructionPlanLock,
    getConstructionPlan,
    heartbeatConstructionPlanLock,
    releaseConstructionPlanLock,
    updateConstructionPlan,
} from '../services/constructionPlanService';
import { listSafeWorkerDirectoryEntries } from '../services/safeWorkerDirectoryService';
import {
    applyConstructionPlanTechnicalReviewInvalidation,
    applyDrawingPreviewResult,
    planConstructionPlanPhysicalPages,
    resolveDrawingPreviewPage,
    validateConstructionPlan,
    type ValidationIssue,
} from '../domain';
import { getConstructionPlanTemplateByIdentity } from '../domain/templateRegistry';
import { resolveConstructionPlanValidationFocusTarget } from '../domain/validationFocus';
import { isConstructionPlanEditingAccessRevoked } from '../domain/accessRevocation';
import {
    constructionPlanStatusAllowsEditing,
    readConstructionPlanEditorPosition,
    resolveConstructionPlanEditorCenterScrollTop,
    resolveConstructionPlanEditorMode,
    resolveConstructionPlanEditorSectionId,
    withConstructionPlanEditorModeSearchParams,
    writeConstructionPlanEditorPosition,
    type ConstructionPlanEditorMode,
} from '../domain/editorPosition';
import { ensureConstructionPlanDrawingPreviewServer } from '../services/constructionPlanDrawingPreviewService';
import ConstructionPlanStatusBadge from '../components/ConstructionPlanStatusBadge';
import PlanSectionNavigator from '../components/PlanSectionNavigator';
import ConstructionPlanA4Preview, {
    type ConstructionPlanPreviewFieldTarget,
} from '../components/ConstructionPlanA4Preview';
import ConstructionPlanErpSnapshotPanel from '../components/ConstructionPlanErpSnapshotPanel';
import ConstructionPlanErpRefreshWorkspace from '../components/ConstructionPlanErpRefreshWorkspace';
import ConstructionPlanEditorModeSwitch from '../components/ConstructionPlanEditorModeSwitch';
import ConstructionPlanOrganizationEditor from '../components/ConstructionPlanOrganizationEditor';
import ConstructionPlanDrawingPanel from '../components/ConstructionPlanDrawingPanel';
import ConstructionPlanDrawingLibraryDialog from '../components/ConstructionPlanDrawingLibraryDialog';
import ConstructionPlanDrawingUploadProgress, {
    type ConstructionPlanDrawingUploadViewState,
} from '../components/ConstructionPlanDrawingUploadProgress';
import ConstructionPlanDrawingApplicabilityPanel from '../components/ConstructionPlanDrawingApplicabilityPanel';
import ConstructionPlanPrintDocument from '../components/ConstructionPlanPrintDocument';
import ConstructionPlanRiskAssessmentPanel from '../components/ConstructionPlanRiskAssessmentPanel';
import ConstructionPlanStandardTextPanel from '../components/ConstructionPlanStandardTextPanel';
import ConstructionPlanStructuredSectionPanel from '../components/ConstructionPlanStructuredSectionPanel';
import ConstructionPlanWorkflowActions, {
    isConstructionPlanChangeRequestAvailable,
    type ConstructionPlanWorkflowProgress,
} from '../components/ConstructionPlanWorkflowActions';
import ConstructionPlanDeriveDialog, {
    type ConstructionPlanDeriveMode,
    type ConstructionPlanDeriveSubmission,
} from '../components/ConstructionPlanDeriveDialog';
import ConstructionPlanHistoryPanel from '../components/ConstructionPlanHistoryPanel';
import ConstructionPlanReviewWorkspacePanel from '../components/ConstructionPlanReviewWorkspacePanel';
import { findActiveRevisionSuccessor } from '../components/ConstructionPlanRowActions';
import {
    ConstructionPlanEngineeringPanel,
    ConstructionPlanEquipmentPanel,
} from '../components/ConstructionPlanTechnicalDataPanel';
import ConstructionPlanValidationPanel, { ConstructionPlanValidationIssue } from '../components/ConstructionPlanValidationPanel';
import ConstructionPlanLifecycleControlPanel from '../components/ConstructionPlanLifecycleControlPanel';
import ConstructionPlanImmediateSaveBoundary from '../components/ConstructionPlanImmediateSaveBoundary';
import ConstructionPlanSaveRecovery, {
    mergeConstructionPlanFailedSavePatch,
    type ConstructionPlanFailedSaveSnapshot,
} from '../components/ConstructionPlanSaveRecovery';
import {
    ConstructionPlanOnboardingChecklist,
    type ConstructionPlanOnboardingTarget,
} from '../components/ConstructionPlanOnboarding';
import {
    DrawingStudio,
    parseDrawingStudioValue,
    projectPlanDrawingToStudio,
    syncPlanDrawingFromStudio,
    toPersistedDrawingStudioValue,
    type DrawingBackground,
    type DrawingStudioValue,
} from '../components/drawings';
import {
    createConstructionPlanDrawingUploadOperation,
    createConstructionPlanDrawingUploadIdempotencyKey,
    getConstructionPlanDrawingUploadErrorMessage,
    isConstructionPlanDrawingUploadCanceledError,
    type ConstructionPlanDrawingUploadCancelHandle,
    type ConstructionPlanDrawingUploadProgress as DrawingUploadProgress,
} from '../services/constructionPlanDrawingUploadService';
import {
    getConstructionPlanDerivationDrawingReuseStatus,
    type ImportConstructionPlanDrawingResponse,
} from '../services/constructionPlanDrawingLibraryService';
import {
    downloadConstructionPlanPdf,
    generateConstructionPlanPdf,
    type ConstructionPlanPdfResult,
} from '../services/constructionPlanPdfService';
import { downloadConstructionPlanExcel } from '../services/constructionPlanExcelService';
import {
    cloneConstructionPlanServer,
    createConstructionPlanRevisionServer,
    getConstructionPlanLineage,
    getConstructionPlanWorkflowErrorMessage,
    isConstructionPlanIssuedPdfProvenanceCompatible,
    issueConstructionPlanServer,
    migrateConstructionPlanTemplateBindingServer,
    prepareConstructionPlanIssuedPdfServer,
    readVerifiedConstructionPlanServerPdf,
    reviewConstructionPlanServer,
    type ConstructionPlanPdfProvenance,
    type PrepareConstructionPlanIssuedPdfResponse,
} from '../services/constructionPlanWorkflowApi';
import { fetchAuditedIssuedConstructionPlanPdf } from '../services/constructionPlanIssuedDownloadService';
import {
    constructionPlanReviewUiAdapter,
    resolveConstructionPlanReviewAnchorSectionId,
    resolveConstructionPlanReviewDrawingPage,
    type ConstructionPlanReviewCommentView,
    type ConstructionPlanReviewWorkspaceView,
} from '../services/constructionPlanReviewUiAdapter';
import { getStandardTextSectionCatalogEntry } from '../domain/standardTextCatalog';
import '../components/ConstructionPlanUI.css';

type SaveState = 'idle' | 'queued' | 'saving' | 'saved' | 'error' | 'offline';
type RightTab = 'data' | 'validation' | 'review' | 'history';

const splitScopeValues = (value: string): string[] => Array.from(new Set(
    value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
));

const VALIDATION_FIELD_LABEL_HINTS: Record<string, string> = {
    key: '항목명',
    value: '값',
    sourceDocumentId: '출처 문서',
    sourceRevision: '출처 Rev.',
    sourcePageOrSection: '페이지/절',
    applicableZones: '적용구간',
    verificationStatus: '검토 상태',
    category: '장비 분류',
    equipmentName: '장비명',
    model: '모델',
    registrationNo: '등록번호',
    ratedCapacity: '정격능력',
    workRadius: '작업반경',
    inspectionValidUntil: '검사·인증 유효기간',
    workZones: '작업구간',
    plannedStages: '예정 작업단계',
    controlMeasures: '장비 통제대책',
    operatorWorkerId: '운전원',
    signalerWorkerId: '신호수·유도자',
};
type IssuedPdfArtifact = {
    blob?: Blob;
    fileName: string;
    storagePath: string;
    storageGeneration?: string;
    sha256?: string;
    sizeBytes?: number;
    pageCount?: number;
    provenance?: ConstructionPlanPdfProvenance;
};
type PendingIssuedPdf = PrepareConstructionPlanIssuedPdfResponse & {
    blob: Blob;
    approvedSnapshotId: string;
    approvedSnapshotStoragePath: string;
};
type DrawingUploadState = {
    sectionId?: string;
    uploading: boolean;
    error?: string;
    canceled?: boolean;
    cancelRequested?: boolean;
    progress?: DrawingUploadProgress;
    completed?: { storagePath: string; sourceRevision: number };
};

const ORGANIZATION_ROLES: Array<{ role: OrganizationRole; label: string; required: boolean; responsibilities: string[] }> = [
    { role: 'site_manager', label: '현장책임자', required: true, responsibilities: ['현장 총괄', '작업 승인'] },
    { role: 'construction_manager', label: '공사담당', required: true, responsibilities: ['공정 관리', '시공상태 확인'] },
    { role: 'safety_manager', label: '안전담당', required: true, responsibilities: ['위험요인 확인', '통제구역 관리'] },
    { role: 'quality_manager', label: '품질/검측', required: true, responsibilities: ['설치 검측', '품질기록 관리'] },
    { role: 'team_leader', label: '작업반장', required: true, responsibilities: ['작업지휘', '작업자 확인'] },
    { role: 'equipment_manager', label: '장비운전/신호', required: false, responsibilities: ['장비 점검', '신호 및 유도'] },
];

const createOrganizationSnapshot = (plan: ConstructionPlan): OrganizationSnapshot => ({
    capturedAt: new Date().toISOString(),
    sourceSiteId: plan.siteId,
    assignments: ORGANIZATION_ROLES.map((item, order): OrganizationRoleAssignment => ({
        id: `${item.role}-${order + 1}`,
        role: item.role,
        label: item.label,
        required: item.required,
        responsibilities: item.responsibilities,
        order,
        externalAssignment: false,
    })),
    additionalWorkers: [],
});

const formatSavedTime = (value?: string): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date);
};

const waitForPaint = (): Promise<void> => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
});

const issuedArtifactSessionKey = (planId: string): string =>
    `construction-plan-issued-artifact:${planId}`;

const pdfFileName = (plan: ConstructionPlan, suffix: string): string =>
    `${plan.projectSnapshot.siteName}_${plan.title}_REV-${String(plan.revision).padStart(2, '0')}_${suffix}.pdf`;

const getDrawingValue = (
    section: PlanSection,
    runtimeSourceUrl?: string,
    drawing?: PlanDrawing,
): DrawingStudioValue => {
    const stored = parseDrawingStudioValue(section.content.drawingStudio);
    return projectPlanDrawingToStudio({
        studio: stored,
        drawing,
        pageIndex: getDrawingPageIndex(section),
        runtimePreviewUrl: runtimeSourceUrl,
    });
};

const isDrawingSection = (section?: PlanSection): boolean =>
    Boolean(section && (section.kind === 'drawing-register' || section.kind === 'drawing-page'));

const isEngineeringSection = (section?: PlanSection): boolean =>
    Boolean(section && ['member-specifications', 'connection-details', 'structural-control'].includes(section.key));

const getDrawingId = (section: PlanSection): string =>
    typeof section.content.drawingId === 'string' ? section.content.drawingId : '';

const getSectionDrawing = (plan: ConstructionPlan, section: PlanSection): PlanDrawing | undefined => {
    const drawingId = getDrawingId(section);
    return drawingId ? plan.drawings.find((drawing) => drawing.id === drawingId) : undefined;
};

const getDrawingPageIndex = (section: PlanSection): number => {
    const value = section.content.drawingPageIndex;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
};

const getDrawingPreviewStoragePath = (plan: ConstructionPlan, section: PlanSection): string | undefined => {
    const drawing = getSectionDrawing(plan, section);
    if (drawing) {
        const resolution = resolveDrawingPreviewPage(drawing, getDrawingPageIndex(section));
        if (resolution.ready) return resolution.storagePath;
        return undefined;
    }
    const studio = parseDrawingStudioValue(section.content.drawingStudio);
    if (studio.background?.kind !== 'image') return undefined;
    return studio.background.storagePath;
};

const buildValidationIssues = (plan: ConstructionPlan): ConstructionPlanValidationIssue[] => {
    const issues: ConstructionPlanValidationIssue[] = [];
    if (!plan.title.trim()) issues.push({ id: 'title', severity: 'error', title: '문서 제목이 비어 있습니다', description: '표지에 출력할 문서 제목을 입력하세요.', field: '문서 제목', path: 'title' });
    if (!plan.documentNo.trim()) issues.push({ id: 'document-no', severity: 'error', title: '문서번호가 없습니다', description: '회사 문서번호 규칙에 맞는 번호가 필요합니다.', field: '문서번호', path: 'documentNo' });
    if (!plan.projectSnapshot.address) issues.push({ id: 'site-address', severity: 'warning', title: '현장 주소가 미등록 상태입니다', description: '원천 현장정보 또는 계획서 스냅샷에서 보완하세요.', field: '현장 주소', path: 'projectSnapshot.address' });
    if (!plan.projectSnapshot.buildings.length || !plan.projectSnapshot.floors.length || !plan.projectSnapshot.zones.length) {
        const path = !plan.projectSnapshot.buildings.length
            ? 'projectSnapshot.buildings'
            : !plan.projectSnapshot.floors.length
                ? 'projectSnapshot.floors'
                : 'projectSnapshot.zones';
        issues.push({ id: 'scope', severity: 'error', title: '적용구간이 완전하지 않습니다', description: '동·층·구간을 모두 지정해야 검토를 요청할 수 있습니다.', field: '적용 범위', path });
    }
    plan.organizationSnapshot.assignments.filter((assignment) => assignment.required && !assignment.worker).forEach((assignment) => {
        issues.push({ id: `role-${assignment.id}`, severity: 'error', title: `${assignment.label} 역할이 비어 있습니다`, description: '활성 작업자 후보 중 담당자를 배정하세요.', sectionId: plan.sections.find((section) => section.kind === 'organization-chart')?.id, field: assignment.label, path: 'organizationSnapshot.assignments.worker', relatedId: assignment.id });
    });
    plan.sections.forEach((section) => {
        if (section.required && section.status === 'empty') issues.push({ id: `section-${section.id}`, severity: 'error', title: `${section.title} 섹션이 미완료입니다`, description: '필수 입력값을 채우고 완료 상태로 변경하세요.', sectionId: section.id, field: section.title, path: 'sections.status', relatedId: section.id });
        if (section.status === 'not_applicable' && !section.notApplicableReason?.trim()) issues.push({ id: `na-${section.id}`, severity: 'error', title: `${section.title}의 해당없음 사유가 없습니다`, description: '해당없음 결정의 근거와 검토자를 기록하세요.', sectionId: section.id, field: '해당없음 사유', path: 'sections.notApplicableReason', relatedId: section.id });
        if (section.placeholders.length) issues.push({ id: `placeholder-${section.id}`, severity: 'error', title: `${section.title}에 미입력 표시가 남아 있습니다`, description: `${section.placeholders.join(', ')} 값을 실제 현장정보로 교체하세요.`, sectionId: section.id });
        if (section.containsExampleValues) issues.push({ id: `example-${section.id}`, severity: 'error', title: `${section.title}에 예시값이 포함되어 있습니다`, description: '예시 수치와 예시도는 발행본에 포함할 수 없습니다.', sectionId: section.id });
    });
    if (!plan.drawings.length) issues.push({ id: 'drawings', severity: 'warning', title: '승인도면이 아직 연결되지 않았습니다', description: '도면 섹션에서 PDF·PNG·JPG 원본과 승인근거를 등록하세요.', sectionId: plan.sections.find((section) => isDrawingSection(section))?.id });
    else if (!plan.drawings.some((drawing) => drawing.approvalStatus === 'approved')) issues.push({ id: 'drawing-approval', severity: 'error', title: '승인 상태인 도면이 없습니다', description: '최소 한 개 도면에 승인근거와 Rev.를 기록하세요.', sectionId: plan.sections.find((section) => isDrawingSection(section))?.id });
    return issues;
};

const domainIssueSectionId = (plan: ConstructionPlan, issue: ValidationIssue): string | undefined => {
    if (issue.relatedId && plan.sections.some((section) => section.id === issue.relatedId)) return issue.relatedId;
    if (issue.relatedId) {
        const drawingSection = plan.sections.find((section) => section.content.drawingId === issue.relatedId);
        if (drawingSection) return drawingSection.id;
        const annotationDrawing = plan.drawings.find((drawing) => drawing.annotations.some(
            (annotation) => annotation.id === issue.relatedId,
        ));
        if (annotationDrawing) {
            return plan.sections.find((section) => section.content.drawingId === annotationDrawing.id)?.id;
        }
    }
    if (issue.path.startsWith('projectSnapshot')) {
        return plan.sections.find((section) => section.key === 'project-overview')?.id;
    }
    if (issue.path.startsWith('organizationSnapshot')) {
        return plan.sections.find((section) => section.kind === 'organization-chart')?.id;
    }
    if (issue.path.startsWith('drawingApplicability')) {
        return plan.sections.find((section) => section.kind === 'drawing-register')?.id;
    }
    if (issue.path.startsWith('drawings')) {
        return plan.sections.find((section) => isDrawingSection(section))?.id;
    }
    if (issue.path.startsWith('equipmentPlan')) {
        return plan.sections.find((section) => section.kind === 'equipment-plan')?.id;
    }
    if (issue.path.startsWith('engineeringValues')) {
        return plan.sections.find((section) => isEngineeringSection(section))?.id;
    }
    if (issue.path.startsWith('riskAssessments')) {
        return plan.sections.find((section) => section.kind === 'risk-assessment')?.id;
    }
    return undefined;
};

const domainIssueResponsibleRole = (issue: ValidationIssue): string => {
    if (issue.path.startsWith('organizationSnapshot')) return '현장책임자';
    if (issue.path.startsWith('drawings') || issue.path.startsWith('drawingApplicability')
        || issue.path.startsWith('engineeringValues') || issue.path.startsWith('equipmentPlan')) {
        return '공사담당자';
    }
    if (issue.path.startsWith('riskAssessments') || issue.code.includes('RISK')
        || issue.code.includes('EMERGENCY') || issue.code.includes('SAFETY')) {
        return '안전관리자';
    }
    if (issue.stage === 'issue' || issue.code.includes('APPROVAL')
        || issue.code.includes('REVIEW') || issue.code.includes('SNAPSHOT')) {
        return '검토·승인자';
    }
    return '작성자';
};

const domainIssueFieldLabel = (issue: ValidationIssue): string => {
    const area = issue.path.startsWith('projectSnapshot') ? '현장정보'
        : issue.path.startsWith('organizationSnapshot') ? '현장 조직도'
            : issue.path.startsWith('drawings') || issue.path.startsWith('drawingApplicability') ? '도면'
                : issue.path.startsWith('equipmentPlan') ? '장비계획'
                    : issue.path.startsWith('riskAssessments') ? '위험성평가'
                        : issue.path.startsWith('sections') ? '문서 섹션'
                            : '문서 설정';
    return issue.pageNumber ? `${issue.pageNumber}쪽 · ${area}` : `${area} · ${issue.path}`;
};

const buildDomainValidationIssues = (plan: ConstructionPlan): ConstructionPlanValidationIssue[] => {
    const result = validateConstructionPlan(plan);
    const stageDescriptions: Record<ValidationIssue['stage'], string> = {
        authoring: '작성 단계 필수조건입니다.',
        review: '검토 요청 전에 확인해야 합니다.',
        issue: '현장사용 발행 전 서버 검증 대상입니다.',
    };
    return result.issues.map((issue, index) => ({
        id: `${issue.code}-${issue.relatedId ?? issue.path}-${index}`,
        severity: issue.severity,
        title: issue.message,
        description: stageDescriptions[issue.stage],
        sectionId: domainIssueSectionId(plan, issue),
        field: domainIssueFieldLabel(issue),
        responsibleRole: domainIssueResponsibleRole(issue),
        path: issue.path,
        relatedId: issue.relatedId,
    }));
};

function EditorLoading() {
    return <main className="cp-editor-feedback"><Loader2 size={30} className="cp-spin" /><strong>시공계획서를 여는 중입니다</strong><span>문서 상태와 최신 저장본을 확인하고 있습니다.</span></main>;
}

export function ConstructionPlanEditorPage() {
    const { planId = '', drawingId, snapshotId } = useParams<{ planId: string; drawingId?: string; snapshotId?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const quickPreviewRoute = /\/preview\/?$/.test(location.pathname);
    const quickDownloadRequested = quickPreviewRoute && searchParams.get('download') === 'draft';
    const requestedMode = quickPreviewRoute ? 'preview' : searchParams.get('mode');
    const { currentUser } = useAuth();
    const [plan, setPlan] = useState<ConstructionPlan | null>(null);
    const [workers, setWorkers] = useState<SafeWorkerDirectoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [lockAcquired, setLockAcquired] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [lastSavedAt, setLastSavedAt] = useState('');
    const [failedSaveSnapshot, setFailedSaveSnapshot] = useState<ConstructionPlanFailedSaveSnapshot>();
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [rightTab, setRightTab] = useState<RightTab>('data');
    const [editorMode, setEditorMode] = useState<ConstructionPlanEditorMode>('edit');
    const [modeSwitching, setModeSwitching] = useState(false);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const [zoom, setZoom] = useState(0.78);
    const [drawingWorkspace, setDrawingWorkspace] = useState(false);
    const [actionError, setActionError] = useState('');
    const [drawingUpload, setDrawingUpload] = useState<DrawingUploadState>({ uploading: false });
    const [drawingLibrarySectionId, setDrawingLibrarySectionId] = useState<string>();
    const [drawingPreviewUrls, setDrawingPreviewUrls] = useState<Record<string, string>>({});
    const [workflowBusy, setWorkflowBusy] = useState<ConstructionPlanWorkflowProgress>();
    const [pendingIssuePdf, setPendingIssuePdf] = useState<PendingIssuedPdf>();
    const [printPlan, setPrintPlan] = useState<ConstructionPlan | null>(null);
    const [issuePreviewOpened, setIssuePreviewOpened] = useState(false);
    const [visualCheckConfirmed, setVisualCheckConfirmed] = useState(false);
    const [issuedArtifact, setIssuedArtifact] = useState<IssuedPdfArtifact>();
    const [showChangesRequest, setShowChangesRequest] = useState(false);
    const [changesRequestReason, setChangesRequestReason] = useState('');
    const [templateBindingMigrationReason, setTemplateBindingMigrationReason] = useState('');
    const [deriveMode, setDeriveMode] = useState<ConstructionPlanDeriveMode>();
    const [activeRevision, setActiveRevision] = useState<ConstructionPlanSummary>();
    const [revisionLookupReady, setRevisionLookupReady] = useState(false);
    const [reviewWorkspace, setReviewWorkspace] = useState<ConstructionPlanReviewWorkspaceView>({ available: false, comments: [] });
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [reviewMutationId, setReviewMutationId] = useState<string>();
    const [validationFocus, setValidationFocus] = useState<{
        requestKey: number;
        path?: string;
        relatedId?: string;
        objectId?: string;
    }>({ requestKey: 0 });
    const pendingPatchRef = useRef<Partial<UpdateConstructionPlanInput>>({});
    const saveTimerRef = useRef<number>();
    const saveInFlightRef = useRef<Promise<boolean> | null>(null);
    const planRef = useRef<ConstructionPlan | null>(null);
    const drawingPreviewUrlsRef = useRef<Record<string, string>>({});
    const drawingPreviewRequestsRef = useRef<Map<string, Promise<string>>>(new Map());
    const automaticDrawingPreviewRef = useRef<string>();
    const drawingUploadCancelRef = useRef<ConstructionPlanDrawingUploadCancelHandle>();
    const drawingUploadRunningRef = useRef(false);
    const centerScrollElementRef = useRef<HTMLDivElement | null>(null);
    const centerScrollTopBySectionRef = useRef<Record<string, number>>({});
    const editorPositionWriteTimerRef = useRef<number>();
    const restoringCenterScrollRef = useRef(false);
    const printDocumentRef = useRef<HTMLElement | null>(null);
    const changesRequestAttemptRef = useRef<{ planId: string; lockVersion: number; reason: string; idempotencyKey: string }>();
    const templateBindingMigrationAttemptRef = useRef<{
        planId: string;
        lockVersion: number;
        reason: string;
        idempotencyKey: string;
    }>();
    const persistedModeRef = useRef<ConstructionPlanEditorMode>();
    const quickDownloadStartedRef = useRef(false);
    const routeIntentRef = useRef({ requestedMode, requestedTab, snapshotDeepLink: Boolean(snapshotId) });
    const editLayoutRef = useRef({ leftCollapsed: false, rightCollapsed: false, drawingWorkspace: false, rightTab: 'data' as RightTab });
    const editorPositionUiRef = useRef({
        userId: currentUser?.uid,
        selectedSectionId: '',
        drawingWorkspace: false,
        rightTab: 'data' as RightTab,
        mode: 'edit' as ConstructionPlanEditorMode,
        loading: true,
    });
    const physicalPagePlanResult = useMemo(() => {
        if (!plan) return { physicalPlan: undefined, error: '' };
        try {
            return { physicalPlan: planConstructionPlanPhysicalPages(plan), error: '' };
        } catch (error) {
            return {
                physicalPlan: undefined,
                error: error instanceof Error ? error.message : 'A4 물리 페이지 구성을 계산하지 못했습니다.',
            };
        }
    }, [plan]);
    const riskAssessmentPolicy = useMemo(() => plan
        ? getConstructionPlanTemplateByIdentity({
            tradeType: plan.tradeType,
            templateId: plan.templateId,
            templateVersion: plan.templateVersion,
        })?.manifest.riskAssessmentPolicy
        : undefined, [plan]);

    routeIntentRef.current = { requestedMode, requestedTab, snapshotDeepLink: Boolean(snapshotId) };
    editorPositionUiRef.current = {
        userId: currentUser?.uid,
        selectedSectionId,
        drawingWorkspace,
        rightTab,
        mode: editorMode,
        loading,
    };

    useEffect(() => { planRef.current = plan; }, [plan]);

    useEffect(() => {
        quickDownloadStartedRef.current = false;
        setPendingIssuePdf(undefined);
        setIssuePreviewOpened(false);
        setVisualCheckConfirmed(false);
    }, [planId]);

    useEffect(() => {
        if (requestedTab === 'history' || requestedTab === 'review' || snapshotId) {
            setRightTab(snapshotId || requestedTab === 'review' ? 'review' : 'history');
            setRightCollapsed(false);
        }
    }, [requestedTab, snapshotId]);

    useEffect(() => {
        if (!validationFocus.requestKey || rightTab !== 'data' || drawingWorkspace) return undefined;
        const timeout = window.setTimeout(() => {
            const pathParts = validationFocus.path?.split(/\.|\[|\]/).filter(Boolean) ?? [];
            const finalPathPart = pathParts.at(-1);
            const labelHint = finalPathPart ? VALIDATION_FIELD_LABEL_HINTS[finalPathPart] : undefined;
            const { target, control } = resolveConstructionPlanValidationFocusTarget({
                path: validationFocus.path,
                relatedId: validationFocus.relatedId,
                labelHint,
            });
            target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            control?.focus({ preventScroll: true });
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [drawingWorkspace, rightTab, selectedSectionId, validationFocus]);

    useEffect(() => {
        if (!planId) return;
        if (plan?.issuedExportStoragePath) {
            setIssuedArtifact((current) => ({
                ...(current?.storagePath === plan.issuedExportStoragePath ? current : {}),
                storagePath: plan.issuedExportStoragePath!,
                fileName: plan.issuedExportFileName || pdfFileName(plan, 'ISSUED'),
                ...(plan.issuedExportPageCount ? { pageCount: plan.issuedExportPageCount } : {}),
            }));
            return;
        }
        try {
            const value = window.sessionStorage.getItem(issuedArtifactSessionKey(planId));
            const parsed: unknown = value ? JSON.parse(value) : null;
            if (parsed && typeof parsed === 'object'
                && typeof (parsed as IssuedPdfArtifact).storagePath === 'string'
                && (parsed as IssuedPdfArtifact).storagePath.startsWith('construction-plans/')
                && typeof (parsed as IssuedPdfArtifact).fileName === 'string') {
                setIssuedArtifact(parsed as IssuedPdfArtifact);
            }
        } catch {
            window.sessionStorage.removeItem(issuedArtifactSessionKey(planId));
        }
    }, [plan?.issuedExportFileName, plan?.issuedExportPageCount, plan?.issuedExportStoragePath, planId]);

    const userId = currentUser?.uid || 'unknown-user';
    const userName = currentUser?.displayName || currentUser?.email || '작성자';

    const replaceDrawingPreviewUrls = useCallback((next: Record<string, string>) => {
        const nextUrls = new Set(Object.values(next));
        Array.from(new Set(Object.values(drawingPreviewUrlsRef.current))).forEach((url) => {
            if (!nextUrls.has(url) && url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
        drawingPreviewUrlsRef.current = next;
        setDrawingPreviewUrls(next);
    }, []);

    useEffect(() => () => {
        Object.values(drawingPreviewUrlsRef.current).forEach((url) => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
        drawingPreviewUrlsRef.current = {};
        drawingPreviewRequestsRef.current.clear();
    }, []);

    const loadEditor = useCallback(async () => {
        if (!planId) return;
        setLoading(true);
        setLoadError('');
        try {
            const loadedPlan = await getConstructionPlan(planId);
            if (!loadedPlan) throw new Error('not-found');
            const safeWorkers = await listSafeWorkerDirectoryEntries({ siteId: loadedPlan.siteId });
            const persistedPosition = currentUser?.uid
                ? readConstructionPlanEditorPosition(planId, currentUser.uid)
                : undefined;
            const routeIntent = routeIntentRef.current;
            const nextEditorMode = resolveConstructionPlanEditorMode({
                planStatus: loadedPlan.status,
                requestedMode: routeIntent.requestedMode,
                persistedMode: persistedPosition?.mode,
                requestedTab: routeIntent.requestedTab,
                snapshotDeepLink: routeIntent.snapshotDeepLink,
            });
            let nextPlan = loadedPlan;
            const mayEdit = loadedPlan.status === 'draft' || loadedPlan.status === 'changes_requested';
            // Preview and review are read-only entry points. Acquiring a write
            // lock here can both block the actual editor and make a harmless
            // preview fail when Firestore correctly rejects a stale lock write.
            if (mayEdit && currentUser?.uid && nextEditorMode === 'edit') {
                const result = await acquireConstructionPlanLock(planId, { id: userId, name: userName });
                nextPlan = result.plan;
                setLockAcquired(result.acquired);
            } else {
                setLockAcquired(false);
            }
            if (!nextPlan.organizationSnapshot.assignments.length) {
                nextPlan = { ...nextPlan, organizationSnapshot: createOrganizationSnapshot(nextPlan) };
            }
            nextPlan = {
                ...nextPlan,
                sections: nextPlan.sections.map((section) => (
                    Object.prototype.hasOwnProperty.call(section.content, 'drawingStudio')
                        ? {
                            ...section,
                            content: {
                                ...section.content,
                                drawingStudio: toPersistedDrawingStudioValue(
                                    parseDrawingStudioValue(section.content.drawingStudio),
                                ),
                            },
                        }
                        : section
                )),
            };
            setWorkers(safeWorkers);
            setPlan(nextPlan);
            pendingPatchRef.current = {};
            setFailedSaveSnapshot(undefined);
            setSaveState('saved');
            centerScrollTopBySectionRef.current = {
                ...(persistedPosition?.centerScrollTopBySection ?? {}),
            };
            persistedModeRef.current = persistedPosition?.mode;
            setEditorMode(nextEditorMode);
            const nextSectionId = resolveConstructionPlanEditorSectionId(nextPlan, {
                ...(drawingId ? { drawingId } : {}),
                ...(persistedPosition?.sectionId ? { persistedSectionId: persistedPosition.sectionId } : {}),
            });
            setSelectedSectionId(nextSectionId);
            const nextSection = nextPlan.sections.find((section) => section.id === nextSectionId);
            const nextDrawingWorkspace = Boolean(
                nextEditorMode === 'edit'
                && nextSection?.kind === 'drawing-page'
                && (drawingId || persistedPosition?.drawingWorkspace)
            );
            setDrawingWorkspace(nextDrawingWorkspace);
            if (nextEditorMode === 'preview') {
                setLeftCollapsed(true);
                setRightCollapsed(true);
            } else if (nextEditorMode === 'review') {
                setLeftCollapsed(true);
                setRightCollapsed(false);
                setRightTab('review');
            } else {
                setLeftCollapsed(false);
                setRightCollapsed(false);
            }
            editLayoutRef.current = {
                leftCollapsed: false,
                rightCollapsed: false,
                drawingWorkspace: nextDrawingWorkspace,
                rightTab: persistedPosition?.rightTab ?? 'data',
            };
            if (nextEditorMode === 'edit' && !routeIntent.requestedTab && !snapshotId && persistedPosition?.rightTab) {
                setRightTab(persistedPosition.rightTab);
            }
            setLastSavedAt(nextPlan.updatedAt);
            // Drawing previews are private, potentially large blobs. Load only the
            // selected section; export hydration is sequential and short-lived.
            replaceDrawingPreviewUrls({});
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Failed to load editor', error);
            setLoadError(error instanceof Error && error.message === 'not-found' ? '요청한 계획서를 찾을 수 없습니다.' : '계획서를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid, drawingId, planId, replaceDrawingPreviewUrls, snapshotId, userId, userName]);

    useEffect(() => { void loadEditor(); }, [loadEditor]);

    const persistEditorPosition = useCallback(() => {
        const currentPlan = planRef.current;
        const ui = editorPositionUiRef.current;
        if (!currentPlan || !ui.userId || !ui.selectedSectionId || ui.loading) return;
        writeConstructionPlanEditorPosition({
            planId: currentPlan.id,
            userId: ui.userId,
            sectionId: ui.selectedSectionId,
            drawingWorkspace: ui.drawingWorkspace,
            rightTab: ui.rightTab,
            mode: ui.mode,
            centerScrollTopBySection: { ...centerScrollTopBySectionRef.current },
        });
        persistedModeRef.current = ui.mode;
    }, []);

    const scheduleEditorPositionWrite = useCallback((delayMs: number) => {
        if (editorPositionWriteTimerRef.current) window.clearTimeout(editorPositionWriteTimerRef.current);
        editorPositionWriteTimerRef.current = window.setTimeout(() => {
            editorPositionWriteTimerRef.current = undefined;
            persistEditorPosition();
        }, delayMs);
    }, [persistEditorPosition]);

    const handleCenterScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (restoringCenterScrollRef.current) return;
        const sectionId = editorPositionUiRef.current.selectedSectionId;
        if (!sectionId) return;
        centerScrollTopBySectionRef.current = {
            ...centerScrollTopBySectionRef.current,
            [sectionId]: Math.max(0, Math.round(event.currentTarget.scrollTop)),
        };
        scheduleEditorPositionWrite(250);
    }, [scheduleEditorPositionWrite]);

    useEffect(() => {
        if (!plan || !currentUser?.uid || !selectedSectionId || loading) return;
        scheduleEditorPositionWrite(0);
    }, [currentUser?.uid, drawingWorkspace, editorMode, loading, plan?.id, rightTab, scheduleEditorPositionWrite, selectedSectionId]);

    useLayoutEffect(() => {
        const element = centerScrollElementRef.current;
        if (!element || loading || !selectedSectionId) return undefined;
        restoringCenterScrollRef.current = true;
        element.scrollTop = resolveConstructionPlanEditorCenterScrollTop(
            { centerScrollTopBySection: centerScrollTopBySectionRef.current },
            selectedSectionId,
        );
        const timer = window.setTimeout(() => { restoringCenterScrollRef.current = false; }, 0);
        return () => {
            window.clearTimeout(timer);
            restoringCenterScrollRef.current = false;
        };
    }, [drawingWorkspace, editorMode, loading, selectedSectionId]);

    useEffect(() => {
        const flushPosition = () => {
            if (editorPositionWriteTimerRef.current) {
                window.clearTimeout(editorPositionWriteTimerRef.current);
                editorPositionWriteTimerRef.current = undefined;
            }
            persistEditorPosition();
        };
        window.addEventListener('pagehide', flushPosition);
        return () => {
            window.removeEventListener('pagehide', flushPosition);
            flushPosition();
        };
    }, [persistEditorPosition]);

    const loadReviewWorkspace = useCallback(async () => {
        if (!planId) return;
        setReviewLoading(true);
        setReviewError('');
        try {
            setReviewWorkspace(await constructionPlanReviewUiAdapter.loadWorkspace(planId, {
                ...(snapshotId ? { reviewPackageId: snapshotId } : {}),
            }));
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review workspace load failed', error);
            setReviewError('검토댓글과 고정 검토 패키지를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
        } finally {
            setReviewLoading(false);
        }
    }, [planId, snapshotId]);

    useEffect(() => {
        if (rightTab === 'review') void loadReviewWorkspace();
    }, [loadReviewWorkspace, rightTab]);

    useEffect(() => {
        const current = planRef.current;
        if (!current || current.status !== 'issued') {
            setActiveRevision(undefined);
            setRevisionLookupReady(true);
            return undefined;
        }

        let active = true;
        setActiveRevision(undefined);
        setRevisionLookupReady(false);
        void getConstructionPlanLineage(current.id).then((lineage) => {
            if (!active) return;
            const source = lineage.plans.find((candidate) => candidate.id === current.id) ?? current;
            setActiveRevision(findActiveRevisionSuccessor(lineage.plans, source));
            setRevisionLookupReady(true);
        }).catch((error) => {
            if (!active) return;
            console.warn('[ConstructionPlanEditorPage] Revision lineage lookup failed', error);
            // Failing closed prevents a stale issued Rev. from creating another
            // branch while the server lineage cannot be confirmed.
            setActiveRevision(undefined);
            setRevisionLookupReady(false);
        });
        return () => { active = false; };
    }, [plan?.id, plan?.revision, plan?.seriesId, plan?.status]);

    const loadPrivateDrawingPreview = useCallback((storagePath: string): Promise<string> => {
        const inFlight = drawingPreviewRequestsRef.current.get(storagePath);
        if (inFlight) return inFlight;
        const request = storageService.getAuthorizedObjectUrl(storagePath);
        drawingPreviewRequestsRef.current.set(storagePath, request);
        void request.finally(() => {
            if (drawingPreviewRequestsRef.current.get(storagePath) === request) {
                drawingPreviewRequestsRef.current.delete(storagePath);
            }
        });
        return request;
    }, []);

    const loadDrawingPreviewPageUrl = useCallback((sectionId: string, pageIndex: number): Promise<string> => {
        const currentPlan = planRef.current;
        const section = currentPlan?.sections.find((candidate) => candidate.id === sectionId);
        const drawing = currentPlan && section ? getSectionDrawing(currentPlan, section) : undefined;
        if (!drawing) return Promise.reject(new Error('construction-plan-drawing-thumbnail-not-found'));
        const page = resolveDrawingPreviewPage(drawing, pageIndex);
        if (!page.ready) {
            return Promise.reject(new Error(`construction-plan-drawing-thumbnail-${page.reason}`));
        }
        return loadPrivateDrawingPreview(page.storagePath);
    }, [loadPrivateDrawingPreview]);

    useEffect(() => {
        if (!plan || !selectedSectionId || workflowBusy) return undefined;
        const section = plan.sections.find((candidate) => candidate.id === selectedSectionId);
        const storagePath = section ? getDrawingPreviewStoragePath(plan, section) : undefined;
        const currentUrl = drawingPreviewUrlsRef.current[selectedSectionId];
        if (storagePath && currentUrl) return undefined;

        replaceDrawingPreviewUrls({});
        if (!section || !storagePath) return undefined;
        let active = true;
        void loadPrivateDrawingPreview(storagePath).then((url) => {
            if (active) {
                replaceDrawingPreviewUrls({ [section.id]: url });
                return;
            }
            window.setTimeout(() => {
                if (!Object.values(drawingPreviewUrlsRef.current).includes(url) && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            }, 0);
        }).catch((error) => {
            if (active) console.warn('[ConstructionPlanEditorPage] Private drawing preview unavailable', { sectionId: section.id, error });
        });
        return () => { active = false; };
    }, [loadPrivateDrawingPreview, plan, replaceDrawingPreviewUrls, selectedSectionId, workflowBusy]);

    useEffect(() => {
        if (!lockAcquired || !planId || !currentUser?.uid) return undefined;
        const timer = window.setInterval(async () => {
            try {
                const result = await heartbeatConstructionPlanLock(planId, userId);
                if (!result.acquired) {
                    setLockAcquired(false);
                    const unsavedPatch = pendingPatchRef.current;
                    if (Object.keys(unsavedPatch).length) {
                        setFailedSaveSnapshot({
                            failedAt: new Date().toISOString(),
                            reason: 'lock_lost',
                            patch: { ...unsavedPatch },
                        });
                        setSaveState('error');
                    }
                    const recoveryHint = Object.keys(unsavedPatch).length
                        ? ' 미저장 변경내용은 복사해 보관할 수 있습니다.'
                        : ' 마지막 서버 저장본을 조회합니다.';
                    setActionError(result.lock
                        ? `${result.lock.userName}님에게 편집 잠금이 이동되어 조회전용으로 전환했습니다.${recoveryHint}`
                        : `편집 잠금이 만료되거나 회수되어 조회전용으로 전환했습니다.${recoveryHint}`);
                }
                setPlan((current) => current ? { ...current, editLock: result.lock, lockVersion: result.plan.lockVersion } : current);
            } catch (error) {
                console.warn('[ConstructionPlanEditorPage] Lock heartbeat failed', error);
                if (isConstructionPlanEditingAccessRevoked(error)) {
                    setLockAcquired(false);
                    const unsavedPatch = pendingPatchRef.current;
                    if (Object.keys(unsavedPatch).length) {
                        setFailedSaveSnapshot({
                            failedAt: new Date().toISOString(),
                            reason: 'lock_lost',
                            patch: { ...unsavedPatch },
                        });
                        setSaveState('error');
                    }
                    setActionError(Object.keys(unsavedPatch).length
                        ? '편집 권한이 회수되어 조회전용으로 전환했습니다. 미저장 변경내용은 복사해 보관할 수 있습니다.'
                        : '편집 권한이 회수되어 조회전용으로 전환했습니다. 마지막 서버 저장본을 조회합니다.');
                }
            }
        }, 45_000);
        return () => window.clearInterval(timer);
    }, [currentUser?.uid, lockAcquired, planId, userId]);

    useEffect(() => () => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        drawingUploadCancelRef.current?.cancel();
        if (lockAcquired && planId && currentUser?.uid) void releaseConstructionPlanLock(planId, userId);
    }, [currentUser?.uid, lockAcquired, planId, userId]);

    const flushSave = useCallback(async () => {
        if (saveInFlightRef.current) {
            const inFlightSucceeded = await saveInFlightRef.current;
            if (!inFlightSucceeded) return false;
        }
        const currentPlan = planRef.current;
        if (!currentPlan || !planId || !lockAcquired || !Object.keys(pendingPatchRef.current).length) return true;
        if (!navigator.onLine) {
            setFailedSaveSnapshot({
                failedAt: new Date().toISOString(),
                reason: 'offline',
                patch: { ...pendingPatchRef.current },
            });
            setSaveState('offline');
            return false;
        }
        const patch = pendingPatchRef.current;
        pendingPatchRef.current = {};
        const saveOperation = (async (): Promise<boolean> => {
            setSaveState('saving');
            try {
                const updated = await updateConstructionPlan(planId, {
                    ...patch,
                    updatedBy: userId,
                    expectedLockVersion: currentPlan.lockVersion,
                });
                const queuedWhileSaving = pendingPatchRef.current;
                const mergedPlan = Object.keys(queuedWhileSaving).length
                    ? ({ ...updated, ...queuedWhileSaving } as ConstructionPlan)
                    : updated;
                planRef.current = mergedPlan;
                setPlan(mergedPlan);
                setLastSavedAt(updated.updatedAt);
                setFailedSaveSnapshot(undefined);
                setSaveState(Object.keys(queuedWhileSaving).length ? 'queued' : 'saved');
                return true;
            } catch (error) {
                console.error('[ConstructionPlanEditorPage] Autosave failed', error);
                const failedPatch = mergeConstructionPlanFailedSavePatch(patch, pendingPatchRef.current);
                pendingPatchRef.current = failedPatch;
                const accessRevoked = isConstructionPlanEditingAccessRevoked(error);
                setFailedSaveSnapshot({
                    failedAt: new Date().toISOString(),
                    reason: accessRevoked ? 'lock_lost' : 'request_failed',
                    patch: { ...failedPatch },
                });
                if (accessRevoked) {
                    setLockAcquired(false);
                    setActionError('저장 권한 또는 편집 잠금이 회수되어 조회전용으로 전환했습니다. 변경내용을 복사해 안전하게 보관하세요.');
                }
                setSaveState('error');
                return false;
            }
        })();
        saveInFlightRef.current = saveOperation;
        try {
            return await saveOperation;
        } finally {
            if (saveInFlightRef.current === saveOperation) saveInFlightRef.current = null;
        }
    }, [lockAcquired, planId, userId]);

    useEffect(() => {
        const online = () => {
            setSaveState((state) => state === 'offline' ? 'queued' : state);
            if (Object.keys(pendingPatchRef.current).length) void flushSave();
        };
        const offline = () => {
            if (Object.keys(pendingPatchRef.current).length) {
                setFailedSaveSnapshot({
                    failedAt: new Date().toISOString(),
                    reason: 'offline',
                    patch: { ...pendingPatchRef.current },
                });
            }
            setSaveState('offline');
        };
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
    }, [flushSave]);

    const retryFailedSave = useCallback(async () => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        setActionError('');
        const firstSaveSucceeded = await flushSave();
        const finalSaveSucceeded = firstSaveSucceeded && Object.keys(pendingPatchRef.current).length
            ? await flushSave()
            : firstSaveSucceeded;
        if (!finalSaveSucceeded || Object.keys(pendingPatchRef.current).length) {
            setActionError(navigator.onLine
                ? '변경사항을 다시 저장하지 못했습니다. 편집 잠금과 연결 상태를 확인하거나 변경내용을 복사해 보관하세요.'
                : '오프라인 상태입니다. 연결이 복구되면 자동으로 다시 저장하며, 필요하면 변경내용을 복사해 보관하세요.');
        }
    }, [flushSave]);

    const syncEditorModeRoute = useCallback((mode: ConstructionPlanEditorMode) => {
        setSearchParams(withConstructionPlanEditorModeSearchParams(searchParams, mode), { replace: true });
    }, [searchParams, setSearchParams]);

    const changeEditorMode = useCallback(async (
        nextMode: ConstructionPlanEditorMode,
        options: { syncRoute?: boolean } = {},
    ) => {
        const currentPlan = planRef.current;
        if (!currentPlan || modeSwitching) return;
        if (drawingUploadRunningRef.current) {
            setActionError('도면 업로드·검증을 마친 뒤 작업 모드를 전환하세요. 취소하려면 도면 패널의 취소 버튼을 사용하세요.');
            if (options.syncRoute !== false) syncEditorModeRoute(editorMode);
            return;
        }
        if (nextMode === 'edit' && !constructionPlanStatusAllowsEditing(currentPlan.status)) {
            setActionError('발행·종료·대체된 문서는 작성 모드로 전환할 수 없습니다. A4 미리보기 또는 검토 모드를 사용하세요.');
            if (options.syncRoute !== false) syncEditorModeRoute(editorMode);
            return;
        }
        if (snapshotId && nextMode !== 'review') {
            setActionError('고정 검토 패키지 링크에서는 검토 모드가 우선됩니다. 일반 문서 경로에서 미리보기를 여세요.');
            syncEditorModeRoute('review');
            return;
        }
        if (nextMode === editorMode) {
            if (options.syncRoute !== false && requestedMode !== nextMode) syncEditorModeRoute(nextMode);
            return;
        }

        setModeSwitching(true);
        setActionError('');
        try {
            if (nextMode === 'edit' && !lockAcquired) {
                try {
                    const result = await acquireConstructionPlanLock(currentPlan.id, { id: userId, name: userName });
                    planRef.current = result.plan;
                    setPlan(result.plan);
                    setLockAcquired(result.acquired);
                    if (!result.acquired) {
                        setActionError(result.lock
                            ? `${result.lock.userName}님이 편집 중입니다. 잠금이 해제된 뒤 다시 시도하세요.`
                            : '편집 잠금을 획득하지 못했습니다. 잠시 후 다시 시도하세요.');
                        if (options.syncRoute !== false) syncEditorModeRoute(editorMode);
                        return;
                    }
                } catch (error) {
                    console.error('[ConstructionPlanEditorPage] Failed to acquire edit lock', error);
                    setActionError('편집 잠금을 획득하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.');
                    if (options.syncRoute !== false) syncEditorModeRoute(editorMode);
                    return;
                }
            }
            if (editorMode === 'edit' && nextMode !== 'edit') {
                editLayoutRef.current = { leftCollapsed, rightCollapsed, drawingWorkspace, rightTab };
                if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                const firstSaveSucceeded = await flushSave();
                const finalSaveSucceeded = firstSaveSucceeded && Object.keys(pendingPatchRef.current).length
                    ? await flushSave()
                    : firstSaveSucceeded;
                if (!finalSaveSucceeded || Object.keys(pendingPatchRef.current).length) {
                    setActionError('저장되지 않은 변경이 있어 조회 모드로 전환하지 않았습니다. 네트워크와 편집 잠금을 확인한 뒤 다시 시도하세요.');
                    syncEditorModeRoute('edit');
                    return;
                }
            }

            setDrawingWorkspace(false);
            if (nextMode === 'preview') {
                setLeftCollapsed(true);
                setRightCollapsed(true);
            } else if (nextMode === 'review') {
                setLeftCollapsed(true);
                setRightCollapsed(false);
                setRightTab('review');
            } else {
                setLeftCollapsed(editLayoutRef.current.leftCollapsed);
                setRightCollapsed(editLayoutRef.current.rightCollapsed);
                setDrawingWorkspace(editLayoutRef.current.drawingWorkspace);
                setRightTab(editLayoutRef.current.rightTab);
            }
            setEditorMode(nextMode);
            persistedModeRef.current = nextMode;
            if (options.syncRoute !== false) syncEditorModeRoute(nextMode);
        } finally {
            setModeSwitching(false);
        }
    }, [drawingWorkspace, editorMode, flushSave, leftCollapsed, lockAcquired, modeSwitching, requestedMode, rightCollapsed, rightTab, snapshotId, syncEditorModeRoute, userId, userName]);

    useEffect(() => {
        if (!plan || loading || modeSwitching) return;
        const resolved = resolveConstructionPlanEditorMode({
            planStatus: plan.status,
            requestedMode,
            persistedMode: persistedModeRef.current,
            requestedTab,
            snapshotDeepLink: Boolean(snapshotId),
        });
        if (resolved !== editorMode) {
            void changeEditorMode(resolved);
            return;
        }
        if (requestedMode !== resolved) syncEditorModeRoute(resolved);
    }, [changeEditorMode, editorMode, loading, modeSwitching, plan, requestedMode, requestedTab, snapshotId, syncEditorModeRoute]);

    const queuePatch = useCallback((patch: Partial<UpdateConstructionPlanInput>, nextPlan: ConstructionPlan) => {
        const safeguardedPlan = planRef.current
            ? applyConstructionPlanTechnicalReviewInvalidation(planRef.current, nextPlan)
            : nextPlan;
        const invalidatedEngineeringValues = safeguardedPlan.engineeringValues !== nextPlan.engineeringValues;
        planRef.current = safeguardedPlan;
        setPlan(safeguardedPlan);
        pendingPatchRef.current = {
            ...pendingPatchRef.current,
            ...patch,
            ...(invalidatedEngineeringValues ? { engineeringValues: safeguardedPlan.engineeringValues } : {}),
        };
        setSaveState((current) => navigator.onLine
            ? (current === 'error' ? 'error' : 'queued')
            : 'offline');
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => { void flushSave(); }, 1000);
    }, [flushSave]);

    const updateSection = (nextSection: PlanSection, immediate = false) => {
        if (!plan) return;
        const sections = plan.sections.map((section) => section.id === nextSection.id ? nextSection : section);
        queuePatch({ sections }, { ...plan, sections });
        if (immediate) window.setTimeout(() => void flushSave(), 0);
    };

    const updateOrganization = (organizationSnapshot: OrganizationSnapshot) => {
        if (!plan) return;
        queuePatch({ organizationSnapshot }, { ...plan, organizationSnapshot });
    };

    const updateProjectScope = (projectScope: Pick<ConstructionPlan['projectSnapshot'], 'buildings' | 'floors' | 'zones' | 'emergencyContactsComplete'>) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        const projectSnapshot = { ...currentPlan.projectSnapshot, ...projectScope };
        queuePatch({ projectSnapshot: projectScope }, { ...currentPlan, projectSnapshot });
    };

    const prepareErpRefreshApply = useCallback(async (): Promise<ConstructionPlan | undefined> => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        const firstSaveSucceeded = await flushSave();
        const finalSaveSucceeded = firstSaveSucceeded && Object.keys(pendingPatchRef.current).length
            ? await flushSave()
            : firstSaveSucceeded;
        if (!finalSaveSucceeded || Object.keys(pendingPatchRef.current).length) return undefined;
        return planRef.current ?? undefined;
    }, [flushSave]);

    const applyCanonicalErpRefreshPlan = useCallback((nextPlan: ConstructionPlan): void => {
        pendingPatchRef.current = {};
        planRef.current = nextPlan;
        setPlan(nextPlan);
        setLastSavedAt(nextPlan.updatedAt);
        setFailedSaveSnapshot(undefined);
        setSaveState('saved');
        const safeWorkersById = new Map<string, SafeWorkerDirectoryEntry>();
        nextPlan.organizationSnapshot.assignments.forEach((assignment) => {
            if (assignment.worker) safeWorkersById.set(assignment.worker.id, assignment.worker);
        });
        nextPlan.organizationSnapshot.additionalWorkers.forEach((worker) => {
            if (!safeWorkersById.has(worker.id)) safeWorkersById.set(worker.id, worker);
        });
        setWorkers(Array.from(safeWorkersById.values())
            .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR')));
    }, []);

    const updateDrawingApplicability = (drawingApplicability: DrawingApplicabilityDecision[]) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        queuePatch({ drawingApplicability }, { ...currentPlan, drawingApplicability });
    };

    const updateEngineeringValues = (engineeringValues: ConstructionPlan['engineeringValues']) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        queuePatch({ engineeringValues }, { ...currentPlan, engineeringValues });
    };

    const updateEquipmentPlan = (equipmentPlan: ConstructionPlan['equipmentPlan']) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        queuePatch({ equipmentPlan }, { ...currentPlan, equipmentPlan });
    };

    const updateRiskAssessments = (riskAssessments: ConstructionPlan['riskAssessments']) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        queuePatch({ riskAssessments }, { ...currentPlan, riskAssessments });
    };

    const updateDrawingStudio = (section: PlanSection, studio: DrawingStudioValue) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        const persistedStudio = toPersistedDrawingStudioValue(studio);
        const currentSection = currentPlan.sections.find((candidate) => candidate.id === section.id) ?? section;
        const currentDrawing = getSectionDrawing(currentPlan, currentSection);
        const nextSection: PlanSection = {
            ...currentSection,
            content: { ...currentSection.content, drawingStudio: persistedStudio },
            status: persistedStudio.background || persistedStudio.objects.length ? 'in_progress' : currentSection.status,
        };
        const sections = currentPlan.sections.map((candidate) => candidate.id === nextSection.id ? nextSection : candidate);
        const drawings = currentDrawing
            ? currentPlan.drawings.map((drawing) => drawing.id === currentDrawing.id
                ? syncPlanDrawingFromStudio(
                    drawing,
                    persistedStudio,
                    userId,
                    new Date().toISOString(),
                    getDrawingPageIndex(currentSection),
                )
                : drawing)
            : currentPlan.drawings;
        queuePatch({ sections, ...(currentDrawing ? { drawings } : {}) }, { ...currentPlan, sections, drawings });
    };

    const updateDrawingMetadata = (section: PlanSection, nextDrawing: PlanDrawing) => {
        const currentPlan = planRef.current;
        if (!currentPlan) return;
        const drawings = currentPlan.drawings.map((drawing) => drawing.id === nextDrawing.id ? nextDrawing : drawing);
        queuePatch({ drawings }, { ...currentPlan, drawings });
        if (nextDrawing.approvalStatus === 'approved' && nextDrawing.revision.trim() && nextDrawing.approvalReference?.trim()) {
            const currentSection = currentPlan.sections.find((candidate) => candidate.id === section.id);
            if (currentSection && currentSection.status !== 'complete') {
                const sections = currentPlan.sections.map((candidate) => candidate.id === section.id
                    ? { ...candidate, status: 'complete' as const }
                    : candidate);
                queuePatch({ sections, drawings }, { ...currentPlan, sections, drawings });
            }
        }
    };

    const ensureDrawingPreview = async (
        section: PlanSection,
        drawing: PlanDrawing,
        explicitRetry = false,
    ): Promise<void> => {
        if (drawing.mimeType !== 'application/pdf') return;
        if (!drawing.sourceGeneration) {
            setDrawingUpload({
                sectionId: section.id,
                uploading: false,
                error: '원본 Storage generation을 확인할 수 없어 PDF 미리보기를 생성하지 못했습니다.',
            });
            return;
        }
        setDrawingUpload({ sectionId: section.id, uploading: true });
        try {
            const saved = await flushSave();
            if (!saved || Object.keys(pendingPatchRef.current).length) {
                throw new Error('construction-plan-drawing-preview-source-not-saved');
            }

            const beforeRequest = planRef.current;
            if (beforeRequest) {
                const drawings = beforeRequest.drawings.map((candidate) => candidate.id === drawing.id
                    ? {
                        ...candidate,
                        previewStatus: 'processing' as const,
                        previewPaths: [],
                        pages: [],
                        previewErrorCode: undefined,
                        previewErrorMessage: undefined,
                    }
                    : candidate);
                const processingPlan = { ...beforeRequest, drawings };
                planRef.current = processingPlan;
                setPlan(processingPlan);
            }

            const response = await ensureConstructionPlanDrawingPreviewServer({
                planId: drawing.planId,
                drawingId: drawing.id,
                expectedSourceStoragePath: drawing.storagePath,
                expectedSourceSha256: drawing.sourceSha256,
                expectedSourceGeneration: drawing.sourceGeneration,
                idempotencyKey: (
                    explicitRetry
                        ? `cp-preview-retry-${drawing.id}-${drawing.sourceGeneration}-${Date.now()}`
                        : `cp-preview-${drawing.id}-${drawing.sourceGeneration}-${drawing.sourceSha256}`
                ).slice(0, 128),
            });

            const currentPlan = planRef.current;
            const currentDrawing = currentPlan?.drawings.find((candidate) => candidate.id === drawing.id);
            if (!currentPlan || !currentDrawing) throw new Error('construction-plan-drawing-preview-source-removed');
            const appliedDrawing = applyDrawingPreviewResult(currentDrawing, response);
            // The callable owns persistence of the authoritative manifest and
            // embedded UI cache. This local projection is intentionally not
            // queued as a client Firestore patch.
            const drawings = currentPlan.drawings.map((candidate) => candidate.id === drawing.id
                ? appliedDrawing
                : candidate);
            const nextPlan = { ...currentPlan, drawings };
            planRef.current = nextPlan;
            setPlan(nextPlan);
            replaceDrawingPreviewUrls({});
            setDrawingUpload({
                sectionId: section.id,
                uploading: false,
                ...(response.previewStatus === 'failed'
                    ? { error: response.errorMessage || 'PDF 미리보기 생성에 실패했습니다. 다시 시도해주세요.' }
                    : {}),
            });
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] PDF drawing preview failed', error);
            const currentPlan = planRef.current;
            if (currentPlan) {
                const drawings = currentPlan.drawings.map((candidate) => candidate.id === drawing.id
                    && candidate.storagePath === drawing.storagePath
                    && candidate.sourceSha256.toLowerCase() === drawing.sourceSha256.toLowerCase()
                    ? {
                        ...candidate,
                        previewStatus: 'failed' as const,
                        previewPaths: [],
                        pages: [],
                        previewErrorCode: 'PREVIEW_REQUEST_FAILED',
                        previewErrorMessage: '서버 미리보기 요청을 완료하지 못했습니다.',
                        previewUpdatedAt: new Date().toISOString(),
                    }
                    : candidate);
                const failedPlan = { ...currentPlan, drawings };
                planRef.current = failedPlan;
                setPlan(failedPlan);
            }
            setDrawingUpload({
                sectionId: section.id,
                uploading: false,
                error: 'PDF 미리보기를 생성하지 못했습니다. 원본은 보존되었으며 다시 시도할 수 있습니다.',
            });
        }
    };

    useEffect(() => {
        const current = planRef.current;
        if (!current
            || !lockAcquired
            || editorMode !== 'edit'
            || workflowBusy
            || drawingUpload.uploading
            || drawingUploadRunningRef.current
            || !['draft', 'changes_requested'].includes(current.status)) return;
        const drawing = current.drawings.find((candidate) => (
            candidate.mimeType === 'application/pdf'
            && candidate.previewStatus === 'pending'
            && Boolean(candidate.sourceGeneration)
        ));
        if (!drawing) return;
        const section = current.sections.find((candidate) => getDrawingId(candidate) === drawing.id);
        if (!section) return;
        const requestKey = `${current.id}:${drawing.id}:${drawing.sourceGeneration}:${drawing.sourceSha256}`;
        if (automaticDrawingPreviewRef.current === requestKey) return;
        automaticDrawingPreviewRef.current = requestKey;
        void ensureDrawingPreview(section, drawing).finally(() => {
            if (automaticDrawingPreviewRef.current === requestKey) {
                automaticDrawingPreviewRef.current = undefined;
            }
        });
    }, [drawingUpload.uploading, editorMode, lockAcquired, plan, workflowBusy]);

    const cancelDrawingUpload = useCallback(() => {
        const handle = drawingUploadCancelRef.current;
        if (!handle?.cancel()) return;
        setDrawingUpload((current) => current.uploading
            ? { ...current, cancelRequested: true }
            : current);
    }, []);

    const uploadDrawingBackground = async (
        section: PlanSection,
        file: File,
        metadata: DrawingBackground,
    ) => {
        const currentPlan = planRef.current;
        if (!currentPlan
            || drawingUploadRunningRef.current
            || !lockAcquired
            || !['draft', 'changes_requested'].includes(currentPlan.status)) return;
        const currentSection = currentPlan.sections.find((candidate) => candidate.id === section.id) ?? section;
        const currentDrawing = getSectionDrawing(currentPlan, currentSection);
        if (currentDrawing?.mimeType === 'application/pdf' && metadata.kind === 'image') {
            setDrawingUpload({
                sectionId: section.id,
                uploading: false,
                error: 'PDF 미리보기 이미지는 서버가 자동 생성합니다. 원본 PDF를 PNG/JPG로 덮어쓸 수 없습니다.',
            });
            return;
        }
        if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
            setDrawingUpload({ sectionId: section.id, uploading: false, error: '도면 원본은 50MB 이하만 등록할 수 있습니다.' });
            return;
        }
        drawingUploadRunningRef.current = true;
        let activeCancelHandle: ConstructionPlanDrawingUploadCancelHandle | undefined;
        try {
            const saved = await flushSave();
            if (!saved || Object.keys(pendingPatchRef.current).length) {
                throw new Error('construction-plan-drawing-upload-source-not-saved');
            }
            setDrawingUpload({
                sectionId: section.id,
                uploading: true,
                progress: { stage: 'hashing', percent: 0 },
            });
            setRightCollapsed(false);
            setRightTab('data');
            const latestPlan = planRef.current ?? currentPlan;
            const latestSection = latestPlan.sections.find((candidate) => candidate.id === section.id) ?? section;
            const drawingId = getDrawingId(latestSection) || `drawing-${latestSection.id}`;
            const operation = createConstructionPlanDrawingUploadOperation({
                planId: latestPlan.id,
                sectionId: latestSection.id,
                drawingId,
                file,
                expectedLockVersion: latestPlan.lockVersion,
                idempotencyKey: createConstructionPlanDrawingUploadIdempotencyKey(),
                onProgress: (progress) => setDrawingUpload((current) => ({
                    sectionId: section.id,
                    uploading: progress.stage !== 'completed',
                    progress,
                    ...(current.cancelRequested ? { cancelRequested: true } : {}),
                })),
            });
            activeCancelHandle = operation.cancelHandle;
            drawingUploadCancelRef.current = activeCancelHandle;
            const finalized = await operation.result;

            const beforeApply = planRef.current ?? latestPlan;
            const sections = beforeApply.sections.map((candidate) => candidate.id === finalized.section.id
                ? finalized.section
                : candidate);
            const priorDrawingExists = beforeApply.drawings.some((drawing) => drawing.id === finalized.drawing.id);
            const drawings = priorDrawingExists
                ? beforeApply.drawings.map((drawing) => drawing.id === finalized.drawing.id ? finalized.drawing : drawing)
                : [...beforeApply.drawings, finalized.drawing];
            const nextPlan: ConstructionPlan = {
                ...beforeApply,
                sections,
                drawings,
                drawingApplicability: finalized.drawingApplicability,
                lockVersion: finalized.lockVersion,
                updatedAt: finalized.updatedAt,
                updatedBy: userId,
            };
            planRef.current = nextPlan;
            setPlan(nextPlan);
            setLastSavedAt(finalized.updatedAt);
            setFailedSaveSnapshot(undefined);
            setSaveState('saved');

            if (finalized.mimeType !== 'application/pdf') {
                const runtimeSourceUrl = URL.createObjectURL(file);
                replaceDrawingPreviewUrls({
                    ...drawingPreviewUrlsRef.current,
                    [section.id]: runtimeSourceUrl,
                });
            }
            if (finalized.mimeType === 'application/pdf') {
                await ensureDrawingPreview(finalized.section, finalized.drawing);
            } else {
                setDrawingUpload({
                    sectionId: section.id,
                    uploading: false,
                    progress: { stage: 'completed', percent: 100 },
                    completed: {
                        storagePath: finalized.storagePath,
                        sourceRevision: finalized.sourceRevision,
                    },
                });
            }
        } catch (error) {
            if (isConstructionPlanDrawingUploadCanceledError(error)) {
                setDrawingUpload({
                    sectionId: section.id,
                    uploading: false,
                    canceled: true,
                });
            } else {
                console.error('[ConstructionPlanEditorPage] Drawing upload failed', error);
                setDrawingUpload({
                    sectionId: section.id,
                    uploading: false,
                    error: getConstructionPlanDrawingUploadErrorMessage(error),
                });
            }
        } finally {
            drawingUploadRunningRef.current = false;
            if (drawingUploadCancelRef.current === activeCancelHandle) {
                drawingUploadCancelRef.current = undefined;
            }
        }
    };

    const updateDrawingPreviewPage = (section: PlanSection, pageIndex: number) => {
        const currentPlan = planRef.current;
        if (!currentPlan || !Number.isInteger(pageIndex) || pageIndex < 0) return;
        const drawing = getSectionDrawing(currentPlan, section);
        if (!drawing || !resolveDrawingPreviewPage(drawing, pageIndex).ready) return;
        const sections = currentPlan.sections.map((candidate) => candidate.id === section.id
            ? { ...candidate, content: { ...candidate.content, drawingPageIndex: pageIndex } }
            : candidate);
        replaceDrawingPreviewUrls({});
        queuePatch({ sections }, { ...currentPlan, sections });
    };

    const withExportDrawingPreviews = useCallback(async <T,>(
        sourcePlan: ConstructionPlan,
        task: () => Promise<T>,
    ): Promise<T> => {
        const previousUrls = { ...drawingPreviewUrlsRef.current };
        const exportUrls = { ...previousUrls };
        const urlsByStoragePath = new Map<string, string>();
        const temporaryUrls = new Set<string>();
        let exportUrlsApplied = false;
        Object.entries(previousUrls).forEach(([sectionId, url]) => {
            const section = sourcePlan.sections.find((candidate) => candidate.id === sectionId);
            const path = section ? getDrawingPreviewStoragePath(sourcePlan, section) : undefined;
            if (path) urlsByStoragePath.set(path, url);
        });

        try {
            for (const section of sourcePlan.sections) {
                const storagePath = getDrawingPreviewStoragePath(sourcePlan, section);
                if (!storagePath || exportUrls[section.id]) continue;
                let url = urlsByStoragePath.get(storagePath);
                if (!url) {
                    url = await loadPrivateDrawingPreview(storagePath);
                    urlsByStoragePath.set(storagePath, url);
                    temporaryUrls.add(url);
                }
                exportUrls[section.id] = url;
            }
            replaceDrawingPreviewUrls(exportUrls);
            exportUrlsApplied = true;
            await waitForPaint();
            return await task();
        } finally {
            replaceDrawingPreviewUrls(previousUrls);
            if (!exportUrlsApplied) {
                const retained = new Set(Object.values(previousUrls));
                temporaryUrls.forEach((url) => {
                    if (!retained.has(url) && url.startsWith('blob:')) URL.revokeObjectURL(url);
                });
            }
        }
    }, [loadPrivateDrawingPreview, replaceDrawingPreviewUrls]);

    const renderDraftPlanPdf = async (
        sourcePlan: ConstructionPlan,
    ): Promise<ConstructionPlanPdfResult> => {
        if (!printDocumentRef.current) throw new Error('A4 출력 문서를 준비하지 못했습니다.');
        setPrintPlan(sourcePlan);
        await waitForPaint();
        try {
            return await withExportDrawingPreviews(sourcePlan, () => generateConstructionPlanPdf({
                container: printDocumentRef.current!,
                profile: 'draft',
                fileName: pdfFileName(sourcePlan, 'DRAFT'),
                audit: {
                    planId: sourcePlan.id,
                    documentNo: sourcePlan.documentNo,
                    revision: sourcePlan.revision,
                    templateVersion: sourcePlan.templateVersion,
                    ...(sourcePlan.approvedSnapshotHash ? { snapshotHash: sourcePlan.approvedSnapshotHash } : {}),
                },
                onProgress: (progress) => setWorkflowBusy({ label: progress.message, percent: progress.percent }),
            }));
        } finally {
            setPrintPlan(null);
        }
    };

    const refreshAfterReviewAction = async (
        response: Awaited<ReturnType<typeof reviewConstructionPlanServer>>,
    ): Promise<void> => {
        const loaded = await getConstructionPlan(response.planId);
        const current = planRef.current;
        const next = loaded ?? (current ? {
            ...current,
            status: response.status,
            lockVersion: response.lockVersion,
            ...(response.approvedSnapshotId ? { approvedSnapshotId: response.approvedSnapshotId } : {}),
            ...(response.approvedSnapshotHash ? { approvedSnapshotHash: response.approvedSnapshotHash } : {}),
            ...(response.approvedSnapshotStoragePath ? { approvedSnapshotStoragePath: response.approvedSnapshotStoragePath } : {}),
        } : null);
        if (!next) throw new Error('construction-plan-workflow-plan-refresh-failed');
        planRef.current = next;
        setPlan(next);
        setLastSavedAt(next.updatedAt);
    };

    const requestReview = async () => {
        const current = planRef.current;
        if (!current || workflowBusy) return;
        setWorkflowBusy({ label: '미저장 변경사항을 확인하고 있습니다.' });
        const firstSaveSucceeded = await flushSave();
        const secondSaveSucceeded = Object.keys(pendingPatchRef.current).length
            ? await flushSave()
            : true;
        if (!firstSaveSucceeded || !secondSaveSucceeded || Object.keys(pendingPatchRef.current).length) {
            setWorkflowBusy(undefined);
            setActionError('미저장 변경사항이 남아 있어 검토를 요청할 수 없습니다. 저장 상태를 확인한 뒤 다시 시도해주세요.');
            return;
        }
        const latestPlan = planRef.current ?? current;
        const validation = validateConstructionPlan(latestPlan);
        const blocking = validation.errors.filter((issue) => issue.stage !== 'issue');
        if (!validation.canSubmitForReview) {
            setWorkflowBusy(undefined);
            setRightTab('validation');
            setRightCollapsed(false);
            setActionError(`오류 ${blocking.length}건을 해결한 뒤 검토를 요청할 수 있습니다.`);
            return;
        }
        setActionError('');
        setWorkflowBusy({ label: '검토 요청을 서버 감사이력에 기록하고 있습니다.' });
        try {
            const response = await reviewConstructionPlanServer({
                planId: latestPlan.id,
                action: 'submit_review',
                expectedLockVersion: latestPlan.lockVersion,
                idempotencyKey: `cp-review-submit_review-${latestPlan.id.slice(0, 40)}-${latestPlan.lockVersion}`,
            });
            await refreshAfterReviewAction(response);
            setLockAcquired(false);
            await releaseConstructionPlanLock(latestPlan.id, userId).catch(() => undefined);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review request failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const runReviewAction = async (action: 'complete_review' | 'approve') => {
        const current = planRef.current;
        if (!current || workflowBusy) return;
        setActionError('');
        setWorkflowBusy({ label: action === 'approve' ? '승인 스냅샷을 확정하고 있습니다.' : '검토 완료를 기록하고 있습니다.' });
        try {
            const response = await reviewConstructionPlanServer({
                planId: current.id,
                action,
                expectedLockVersion: current.lockVersion,
                idempotencyKey: `cp-review-${action}-${current.id.slice(0, 40)}-${current.lockVersion}`,
            });
            await refreshAfterReviewAction(response);
            setPendingIssuePdf(undefined);
            setIssuePreviewOpened(false);
            setVisualCheckConfirmed(false);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review workflow failed', { action, error });
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const requestPlanChanges = async () => {
        const current = planRef.current;
        const typedReason = changesRequestReason.trim();
        if (!current || workflowBusy) return;
        if (typedReason.length < 5) {
            setActionError('수정 요청 사유를 5자 이상 구체적으로 입력해주세요.');
            return;
        }
        const previousAttempt = changesRequestAttemptRef.current;
        const attempt = previousAttempt
            && previousAttempt.planId === current.id
            && previousAttempt.lockVersion === current.lockVersion
            ? previousAttempt
            : {
                planId: current.id,
                lockVersion: current.lockVersion,
                reason: typedReason,
                idempotencyKey: `cp-review-request_changes-${current.id.slice(0, 40)}-${current.lockVersion}`,
            };
        changesRequestAttemptRef.current = attempt;
        if (attempt.reason !== typedReason) setChangesRequestReason(attempt.reason);
        setActionError('');
        setWorkflowBusy({ label: '수정 요청 사유를 감사이력에 기록하고 있습니다.' });
        try {
            const response = await reviewConstructionPlanServer({
                planId: current.id,
                action: 'request_changes',
                reason: attempt.reason,
                expectedLockVersion: current.lockVersion,
                idempotencyKey: attempt.idempotencyKey,
            });
            await refreshAfterReviewAction(response);
            changesRequestAttemptRef.current = undefined;
            setShowChangesRequest(false);
            setChangesRequestReason('');
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Request changes failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const createDraftPdf = useCallback(async () => {
        const current = planRef.current;
        if (!current || workflowBusy) return;
        setActionError('');
        setWorkflowBusy({ label: 'DRAFT PDF를 준비하고 있습니다.', percent: 0 });
        try {
            const saved = await flushSave();
            if (!saved || Object.keys(pendingPatchRef.current).length) {
                throw new Error('미저장 변경사항이 남아 PDF를 만들 수 없습니다.');
            }
            const latest = planRef.current ?? current;
            const result = await renderDraftPlanPdf(latest);
            downloadConstructionPlanPdf(result.blob, result.fileName);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Draft PDF failed', error);
            setActionError(error instanceof Error ? error.message : 'DRAFT PDF를 생성하지 못했습니다.');
        } finally {
            setWorkflowBusy(undefined);
        }
    }, [flushSave, workflowBusy]);

    const createExcelDownload = useCallback(async () => {
        const current = planRef.current;
        if (!current || workflowBusy) return;
        setActionError('');
        setWorkflowBusy({ label: '시공계획서 Excel 파일을 구성하고 있습니다.' });
        try {
            if (constructionPlanStatusAllowsEditing(current.status) && lockAcquired) {
                const saved = await flushSave();
                if (!saved || Object.keys(pendingPatchRef.current).length) {
                    throw new Error('미저장 변경사항이 남아 Excel 파일을 만들 수 없습니다.');
                }
            }
            await downloadConstructionPlanExcel(planRef.current ?? current);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Excel download failed', error);
            setActionError(error instanceof Error ? error.message : 'Excel 파일을 생성하지 못했습니다.');
        } finally {
            setWorkflowBusy(undefined);
        }
    }, [flushSave, lockAcquired, workflowBusy]);

    useEffect(() => {
        if (!quickDownloadRequested || loading || !plan || workflowBusy || quickDownloadStartedRef.current) return;
        quickDownloadStartedRef.current = true;
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete('download');
        setSearchParams(nextSearchParams, { replace: true });
        void createDraftPdf();
    }, [createDraftPdf, loading, plan, quickDownloadRequested, searchParams, setSearchParams, workflowBusy]);

    const prepareIssuedPdf = async () => {
        const current = planRef.current;
        if (!current || workflowBusy) return;
        if (!current.approvedSnapshotId || !current.approvedSnapshotHash || !current.approvedSnapshotStoragePath) {
            setActionError('승인 스냅샷 ID·hash·저장경로가 모두 확인되어야 발행 후보를 만들 수 있습니다. 승인 상태를 새로고침해주세요.');
            return;
        }
        setActionError('');
        setPendingIssuePdf(undefined);
        setIssuePreviewOpened(false);
        setVisualCheckConfirmed(false);
        setWorkflowBusy({ label: '서버가 승인 스냅샷으로 42~200쪽 발행 후보를 만들고 있습니다.', percent: 0 });
        try {
            const result = await prepareConstructionPlanIssuedPdfServer({
                planId: current.id,
                approvedSnapshotHash: current.approvedSnapshotHash,
            });
            setWorkflowBusy({ label: '서버 후보의 세대·메타데이터·SHA-256을 검증하고 있습니다.', percent: 90 });
            const blob = await readVerifiedConstructionPlanServerPdf(result.candidate);
            setPendingIssuePdf({
                ...result,
                blob,
                approvedSnapshotId: current.approvedSnapshotId,
                approvedSnapshotStoragePath: current.approvedSnapshotStoragePath,
            });
            setIssuePreviewOpened(false);
            setVisualCheckConfirmed(false);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Issued candidate PDF failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const previewIssuedPdf = () => {
        if (!pendingIssuePdf) return;
        downloadConstructionPlanPdf(
            pendingIssuePdf.blob,
            pendingIssuePdf.candidate.fileName.replace(/\.pdf$/i, '_ISSUE-CANDIDATE-NOT-ISSUED.pdf'),
        );
        setIssuePreviewOpened(true);
    };

    const confirmIssue = async () => {
        const current = planRef.current;
        if (!current || !pendingIssuePdf || !issuePreviewOpened || !visualCheckConfirmed || workflowBusy) return;
        if (!current.approvedSnapshotHash
            || current.approvedSnapshotHash !== pendingIssuePdf.approvedSnapshotHash
            || current.approvedSnapshotId !== pendingIssuePdf.approvedSnapshotId
            || current.approvedSnapshotStoragePath !== pendingIssuePdf.approvedSnapshotStoragePath) {
            setPendingIssuePdf(undefined);
            setIssuePreviewOpened(false);
            setVisualCheckConfirmed(false);
            setActionError('발행 후보 생성 후 승인 스냅샷 참조가 변경되었습니다. 최신 승인본으로 후보를 다시 생성해주세요.');
            return;
        }
        setActionError('');
        setWorkflowBusy({ label: '승인 스냅샷 참조를 서버 저장본과 다시 대조하고 있습니다.', percent: 0 });
        try {
            const latest = await getConstructionPlan(current.id);
            if (!latest
                || latest.status !== 'approved_pending_issue'
                || latest.approvedSnapshotHash !== pendingIssuePdf.approvedSnapshotHash
                || latest.approvedSnapshotId !== pendingIssuePdf.approvedSnapshotId
                || latest.approvedSnapshotStoragePath !== pendingIssuePdf.approvedSnapshotStoragePath) {
                if (latest) {
                    planRef.current = latest;
                    setPlan(latest);
                }
                setPendingIssuePdf(undefined);
                setIssuePreviewOpened(false);
                setVisualCheckConfirmed(false);
                setActionError('승인 스냅샷 참조가 변경되었습니다. 최신 승인본으로 서버 후보를 다시 생성해주세요.');
                return;
            }
            setWorkflowBusy({ label: '서버가 확인된 후보를 불변 현장사용 발행본으로 확정하고 있습니다.', percent: 55 });
            const issued = await issueConstructionPlanServer({
                planId: current.id,
                jobId: pendingIssuePdf.jobId,
                expectedCandidateSha256: pendingIssuePdf.candidate.sha256,
                approvedSnapshotHash: pendingIssuePdf.approvedSnapshotHash,
                visualCheckConfirmed: true,
            });
            if (!isConstructionPlanIssuedPdfProvenanceCompatible(
                pendingIssuePdf.provenance,
                issued.provenance,
            )) {
                throw new Error('construction-plan-issued-provenance-mismatch');
            }
            const finalFileName = issued.fileName || pdfFileName(current, 'ISSUED');
            const artifact: IssuedPdfArtifact = {
                fileName: finalFileName,
                storagePath: issued.storagePath,
                storageGeneration: issued.storageGeneration,
                sha256: issued.sha256,
                sizeBytes: issued.sizeBytes,
                pageCount: issued.pageCount,
                provenance: issued.provenance,
            };
            setIssuedArtifact(artifact);
            window.sessionStorage.setItem(issuedArtifactSessionKey(current.id), JSON.stringify(artifact));
            const loaded = await getConstructionPlan(current.id).catch((refreshError) => {
                console.warn('[ConstructionPlanEditorPage] Issued plan refresh deferred', refreshError);
                return undefined;
            });
            const next = loaded ?? {
                ...current,
                status: issued.status,
                issuedExportId: issued.issuedExportId,
                issuedExportStoragePath: issued.storagePath,
                issuedExportSha256: issued.sha256,
                issuedExportFileName: finalFileName,
            };
            planRef.current = next;
            setPlan(next);
            setPendingIssuePdf(undefined);
            setIssuePreviewOpened(false);
            setVisualCheckConfirmed(false);
            setWorkflowBusy({ label: '최종 서버 발행본을 다시 내려받아 세대·SHA-256을 검증하고 있습니다.', percent: 90 });
            const finalDownload = await fetchAuditedIssuedConstructionPlanPdf({
                planId: current.id,
                expectedSha256: issued.sha256,
            });
            const finalBlob = finalDownload.blob;
            setIssuedArtifact({ ...artifact, blob: finalBlob });
            downloadConstructionPlanPdf(finalBlob, finalDownload.fileName || finalFileName);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Issue failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const downloadIssuedPdf = async () => {
        const current = planRef.current;
        const storagePath = current?.issuedExportStoragePath || issuedArtifact?.storagePath;
        if (!current || !storagePath || workflowBusy) {
            setActionError('발행 PDF의 검증된 저장 경로를 확인할 수 없습니다. 문서를 새로고침해주세요.');
            return;
        }
        setActionError('');
        setWorkflowBusy({ label: '발행 PDF를 안전하게 내려받고 있습니다.' });
        try {
            const expectedSha256 = current.issuedExportSha256 || issuedArtifact?.sha256;
            if (!expectedSha256) throw new Error('construction-plan-issued-pdf-sha256-required');
            const downloaded = await fetchAuditedIssuedConstructionPlanPdf({ planId: current.id, expectedSha256 });
            const blob = downloaded.blob;
            const fileName = downloaded.fileName || current.issuedExportFileName || issuedArtifact?.fileName || pdfFileName(current, 'ISSUED');
            setIssuedArtifact((artifact) => ({ ...artifact, blob, storagePath, fileName }));
            downloadConstructionPlanPdf(blob, fileName);
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Issued PDF download failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const derivePlan = async (submission: ConstructionPlanDeriveSubmission) => {
        const currentPlan = planRef.current;
        if (submission.mode === 'clone' && currentPlan && ['draft', 'changes_requested'].includes(currentPlan.status)) {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
            const firstSaveSucceeded = await flushSave();
            const secondSaveSucceeded = Object.keys(pendingPatchRef.current).length
                ? await flushSave()
                : true;
            if (!firstSaveSucceeded || !secondSaveSucceeded || Object.keys(pendingPatchRef.current).length) {
                throw new Error('미저장 변경사항을 서버에 반영하지 못해 복제를 중단했습니다. 저장 상태를 확인한 뒤 다시 시도해주세요.');
            }
        }
        let result;
        try {
            result = submission.mode === 'revision'
                ? await createConstructionPlanRevisionServer({
                    sourcePlanId: submission.sourcePlanId,
                    revisionReason: submission.revisionReason,
                    revisionType: submission.revisionType,
                    copyDrawings: submission.copyDrawings,
                    idempotencyKey: submission.idempotencyKey,
                    ...(submission.targetTemplate ? { targetTemplate: submission.targetTemplate } : {}),
                })
                : await cloneConstructionPlanServer({
                    sourcePlanId: submission.sourcePlanId,
                    title: submission.title,
                    documentNo: submission.documentNo,
                    copyDrawings: submission.copyDrawings,
                    idempotencyKey: submission.idempotencyKey,
                });
        } catch (error) {
            const code = typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code?: unknown }).code ?? '')
                : '';
            const ambiguous = submission.copyDrawings && (
                code.includes('unavailable')
                || code.includes('deadline-exceeded')
                || code.includes('internal')
                || code.includes('unknown')
                || error instanceof TypeError
            );
            if (!ambiguous) throw error;

            for (let attempt = 0; attempt < 24 && !result; attempt += 1) {
                if (attempt > 0) {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(1_500, 500 + attempt * 100)));
                }
                try {
                    const status = await getConstructionPlanDerivationDrawingReuseStatus({
                        operation: submission.mode,
                        idempotencyKey: submission.idempotencyKey,
                    });
                    if (status.status === 'completed') {
                        result = status.result;
                        break;
                    }
                    if (status.status === 'failed') {
                        throw new Error(`서버 도면 복사 작업이 실패했습니다${status.errorCode ? ` (${status.errorCode})` : ''}. 같은 요청으로 다시 시도해주세요.`);
                    }
                    if (status.status === 'not_started' && attempt >= 2) throw error;
                } catch (statusError) {
                    const statusCode = typeof statusError === 'object' && statusError !== null && 'code' in statusError
                        ? String((statusError as { code?: unknown }).code ?? '')
                        : '';
                    const statusUnavailable = statusCode.includes('unavailable')
                        || statusCode.includes('deadline-exceeded')
                        || statusCode.includes('internal')
                        || statusCode.includes('unknown')
                        || statusError instanceof TypeError;
                    if (!statusUnavailable) throw statusError;
                }
            }
            if (!result) throw error;
        }
        setDeriveMode(undefined);
        navigate(`/construction-plans/${result.planId}`);
    };

    const openDrawingLibrary = async (sectionId: string) => {
        if (drawingUploadRunningRef.current) {
            setActionError('도면 업로드를 완료하거나 취소한 뒤 현장 도면 라이브러리를 여세요.');
            return;
        }
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        const firstSaveSucceeded = await flushSave();
        const secondSaveSucceeded = Object.keys(pendingPatchRef.current).length
            ? await flushSave()
            : true;
        if (!firstSaveSucceeded || !secondSaveSucceeded || Object.keys(pendingPatchRef.current).length) {
            setActionError('미저장 변경사항을 먼저 저장하지 못해 도면 라이브러리를 열 수 없습니다.');
            return;
        }
        setActionError('');
        setDrawingLibrarySectionId(sectionId);
    };

    const applyImportedDrawing = async (result: ImportConstructionPlanDrawingResponse) => {
        pendingPatchRef.current = {};
        planRef.current = result.plan;
        setPlan(result.plan);
        setSelectedSectionId(result.section.id);
        setDrawingWorkspace(true);
        setLastSavedAt(result.plan.updatedAt);
        setFailedSaveSnapshot(undefined);
        setSaveState('saved');
        replaceDrawingPreviewUrls({});
        if (result.drawing.mimeType === 'application/pdf') {
            await ensureDrawingPreview(result.section, result.drawing);
        } else {
            setDrawingUpload({
                sectionId: result.section.id,
                uploading: false,
                completed: {
                    storagePath: result.drawing.storagePath,
                    sourceRevision: result.drawing.sourceRevision,
                },
            });
        }
    };

    const migrateLegacyTemplateBinding = async () => {
        const reason = templateBindingMigrationReason.trim();
        const current = planRef.current;
        if (!current || current.templateBinding || reason.length < 10 || workflowBusy) return;
        if (!['draft', 'changes_requested'].includes(current.status)) {
            setActionError('legacy 템플릿 바인딩은 작성 중 또는 수정 요청 문서에서만 복원할 수 있습니다.');
            return;
        }
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        const firstSaveSucceeded = await flushSave();
        const secondSaveSucceeded = Object.keys(pendingPatchRef.current).length
            ? await flushSave()
            : true;
        const latest = planRef.current;
        if (!firstSaveSucceeded || !secondSaveSucceeded || !latest
            || Object.keys(pendingPatchRef.current).length) {
            setActionError('미저장 변경사항을 먼저 저장하지 못해 템플릿 마이그레이션을 중단했습니다.');
            return;
        }
        const previousAttempt = templateBindingMigrationAttemptRef.current;
        const attempt = previousAttempt
            && previousAttempt.planId === latest.id
            && previousAttempt.lockVersion === latest.lockVersion
            && previousAttempt.reason === reason
            ? previousAttempt
            : {
                planId: latest.id,
                lockVersion: latest.lockVersion,
                reason,
                idempotencyKey: `cp-template-bind-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`.slice(0, 128),
            };
        templateBindingMigrationAttemptRef.current = attempt;
        setWorkflowBusy({ label: '게시 템플릿 해시 바인딩 중', percent: 55 });
        setActionError('');
        try {
            await migrateConstructionPlanTemplateBindingServer({
                planId: attempt.planId,
                idempotencyKey: attempt.idempotencyKey,
                reason: attempt.reason,
                expectedLockVersion: attempt.lockVersion,
            });
            templateBindingMigrationAttemptRef.current = undefined;
            setTemplateBindingMigrationReason('');
            await loadEditor();
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Template binding migration failed', error);
            setActionError(getConstructionPlanWorkflowErrorMessage(error));
        } finally {
            setWorkflowBusy(undefined);
        }
    };

    const replaceReviewComment = (updated: ConstructionPlanReviewCommentView) => {
        setReviewWorkspace((current) => ({
            ...current,
            comments: current.comments.some((comment) => comment.id === updated.id)
                ? current.comments.map((comment) => comment.id === updated.id ? updated : comment)
                : [updated, ...current.comments],
        }));
    };

    const setReviewCommentResolution = async (comment: ConstructionPlanReviewCommentView, resolved: boolean, reason?: string) => {
        if (!planId || reviewMutationId) return;
        setReviewMutationId(comment.id);
        setActionError('');
        try {
            replaceReviewComment(await constructionPlanReviewUiAdapter.setCommentResolved({ planId, commentId: comment.id, expectedVersion: comment.version, resolved, reason }));
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review comment resolution failed', error);
            setActionError('댓글 상태를 변경하지 못했습니다. 검토 패키지가 최신인지 확인한 뒤 다시 시도해주세요.');
        } finally {
            setReviewMutationId(undefined);
        }
    };

    const replyReviewComment = async (comment: ConstructionPlanReviewCommentView, body: string, requestId: string) => {
        if (!planId || reviewMutationId) return;
        setReviewMutationId(comment.id);
        setActionError('');
        try {
            replaceReviewComment(await constructionPlanReviewUiAdapter.replyComment({ planId, commentId: comment.id, body, requestId }));
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review comment reply failed', error);
            setActionError('댓글 답변을 저장하지 못했습니다. 다시 시도해주세요.');
            throw error;
        } finally {
            setReviewMutationId(undefined);
        }
    };

    const markReviewCommentAddressed = async (comment: ConstructionPlanReviewCommentView) => {
        if (!planId || reviewMutationId) return;
        setReviewMutationId(comment.id);
        setActionError('');
        try {
            replaceReviewComment(await constructionPlanReviewUiAdapter.markCommentAddressed({ planId, commentId: comment.id, expectedVersion: comment.version }));
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review comment addressed update failed', error);
            setActionError('댓글을 처리표시하지 못했습니다. 답변 저장상태를 확인해주세요.');
        } finally {
            setReviewMutationId(undefined);
        }
    };

    const createReviewComment = async (input: Parameters<NonNullable<React.ComponentProps<typeof ConstructionPlanReviewWorkspacePanel>['onCreateComment']>>[0]) => {
        if (!planId || reviewMutationId) return;
        setReviewMutationId('new-comment');
        setActionError('');
        try {
            replaceReviewComment(await constructionPlanReviewUiAdapter.createComment({
                planId,
                reviewPackageId: reviewWorkspace.comparison?.reviewPackageId,
                ...input,
            }));
        } catch (error) {
            console.error('[ConstructionPlanEditorPage] Review comment creation failed', error);
            setActionError('검토 의견을 저장하지 못했습니다. 현재 검토 패키지를 다시 확인해주세요.');
            throw error;
        } finally {
            setReviewMutationId(undefined);
        }
    };

    if (loading) return <EditorLoading />;
    if (loadError || !plan) return <main className="cp-editor-feedback cp-editor-feedback--error"><AlertCircle size={30} /><strong>{loadError || '계획서를 찾을 수 없습니다.'}</strong><span>목록으로 돌아가거나 다시 불러와주세요.</span><div><button type="button" className="cp-button cp-button--ghost" onClick={() => navigate('/construction-plans/manage')}><ArrowLeft size={16} /> 목록</button><button type="button" className="cp-button cp-button--secondary" onClick={() => void loadEditor()}><RefreshCw size={16} /> 다시 시도</button></div></main>;

    const selectedSection = plan.sections.find((section) => section.id === selectedSectionId) || plan.sections[0];
    const selectedPhysicalPages = physicalPagePlanResult.physicalPlan?.pages
        .filter((page) => page.section.id === selectedSection.id) ?? [];
    const selectedStandardTextEntry = getStandardTextSectionCatalogEntry({
        tradeType: plan.tradeType,
        sectionKey: selectedSection.key,
        templateId: plan.templateId,
        templateVersion: plan.templateVersion,
    });
    const validationResult = validateConstructionPlan(plan);
    const validationIssues = buildDomainValidationIssues(plan);
    const errors = validationResult.errors.filter((issue) => issue.stage !== 'issue').length;
    const lifecycleAllowsEditing = constructionPlanStatusAllowsEditing(plan.status);
    const readOnly = editorMode !== 'edit' || !lockAcquired || !lifecycleAllowsEditing || drawingUpload.uploading;
    const drawingSelected = selectedSection.kind === 'drawing-page';
    const drawingRegisterSelected = selectedSection.kind === 'drawing-register';
    const selectedDrawing = drawingSelected ? getSectionDrawing(plan, selectedSection) : undefined;
    const selectedDrawingUploadViewState: ConstructionPlanDrawingUploadViewState =
        drawingUpload.sectionId !== selectedSection.id
            ? { status: 'idle' }
            : drawingUpload.error
                ? { status: 'error', message: drawingUpload.error }
                : drawingUpload.canceled
                    ? {
                        status: 'canceled',
                        message: '격리 저장된 조각은 서버가 자동 정리합니다. 도면 작업공간에서 파일을 다시 선택하세요.',
                    }
                : drawingUpload.completed
                    ? { status: 'completed', ...drawingUpload.completed }
                    : drawingUpload.progress
                        ? { status: 'working', progress: drawingUpload.progress }
                        : { status: 'idle' };
    const selectedDrawingPage = resolveConstructionPlanReviewDrawingPage(selectedDrawing);
    const reviewCurrentAnchor = drawingSelected && selectedDrawing && selectedDrawingPage
        ? {
            kind: 'drawing' as const,
            drawingId: selectedDrawing.id,
            pageIndex: selectedDrawingPage.pageIndex,
            pageFingerprint: selectedDrawingPage.pageFingerprint,
            label: `${selectedDrawing.title || selectedDrawing.drawingNo || selectedSection.title} · ${selectedDrawingPage.pageIndex + 1}쪽`,
        }
        : {
            kind: 'section' as const,
            sectionId: selectedSection.id,
            label: selectedSection.title,
        };

    const navigateReviewAnchor = (comment: ConstructionPlanReviewCommentView) => {
        const target = comment.currentAnchorMapping?.anchor ?? comment.anchor;
        const targetSectionId = resolveConstructionPlanReviewAnchorSectionId(plan, target);
        if (targetSectionId) {
            setSelectedSectionId(targetSectionId);
            setDrawingWorkspace(target.kind === 'drawing');
        }
        setRightCollapsed(false);
    };

    const selectIssue = (issue: ConstructionPlanValidationIssue) => {
        if (issue.sectionId) setSelectedSectionId(issue.sectionId);
        const objectId = issue.relatedId && plan.drawings.some((drawing) => (
            drawing.annotations.some((annotation) => annotation.id === issue.relatedId)
        )) ? issue.relatedId : undefined;
        setRightCollapsed(false);
        setRightTab('data');
        setDrawingWorkspace(Boolean(objectId));
        setValidationFocus((current) => ({
            requestKey: current.requestKey + 1,
            ...(issue.path ? { path: issue.path } : {}),
            ...(issue.relatedId ? { relatedId: issue.relatedId } : {}),
            ...(objectId ? { objectId } : {}),
        }));
    };

    const selectPreviewField = (sectionId: string, target: ConstructionPlanPreviewFieldTarget) => {
        setSelectedSectionId(sectionId);
        setRightCollapsed(false);
        setRightTab('data');
        setDrawingWorkspace(Boolean(target.objectId));
        setValidationFocus((current) => ({
            requestKey: current.requestKey + 1,
            path: target.path,
            ...(target.relatedId ? { relatedId: target.relatedId } : {}),
            ...(target.objectId ? { objectId: target.objectId } : {}),
        }));
    };

    const lastSavedTimeLabel = formatSavedTime(lastSavedAt);
    const saveLabel = saveState === 'saving'
        ? '저장 중'
        : saveState === 'queued'
            ? '저장 대기'
            : saveState === 'error'
                ? `저장 실패${lastSavedTimeLabel ? ` · 마지막 성공 ${lastSavedTimeLabel}` : ''}`
                : saveState === 'offline'
                    ? `오프라인 · 미저장${lastSavedTimeLabel ? ` · 마지막 성공 ${lastSavedTimeLabel}` : ''}`
                    : `저장됨 ${lastSavedTimeLabel}`;
    const openReviewCount = reviewWorkspace.comments.filter((comment) => comment.status !== 'resolved').length;
    const onboardingSiteConnected = Boolean(
        plan.siteId.trim()
        && plan.projectSnapshot.siteName.trim()
        && plan.erpSnapshot?.site.sourceId === plan.siteId,
    );
    const onboardingOrganizationConfirmed = Boolean(
        plan.organizationSnapshot.sourceSiteId === plan.siteId
        && plan.organizationSnapshot.assignments
            .filter((assignment) => assignment.required)
            .every((assignment) => Boolean(assignment.worker))
        && !validationResult.errors.some((issue) => issue.path?.startsWith('organizationSnapshot')),
    );
    const onboardingDrawingMarked = plan.drawings.some((drawing) => drawing.annotations.length > 0);

    const navigateOnboarding = (target: ConstructionPlanOnboardingTarget) => {
        const section = target === 'project-overview'
            ? plan.sections.find((candidate) => candidate.key === 'project-overview')
            : target === 'organization'
                ? plan.sections.find((candidate) => candidate.kind === 'organization-chart')
                : plan.sections.find((candidate) => candidate.kind === 'drawing-page')
                    ?? plan.sections.find((candidate) => candidate.kind === 'drawing-register');
        if (!section) return;
        setSelectedSectionId(section.id);
        setDrawingWorkspace(target === 'drawing-register' && section.kind === 'drawing-page');
        setRightTab('data');
        setRightCollapsed(false);
    };

    return (
        <main className={`cp-editor-page cp-editor-page--mode-${editorMode}${quickPreviewRoute ? ' cp-editor-page--quick-preview' : ''}`}>
            <header className="cp-editor-header">
                <div className="cp-editor-header__left">
                    <button type="button" className="cp-editor-back" onClick={() => navigate('/construction-plans/manage')}><ArrowLeft size={18} /><span>목록</span></button>
                    <div className="cp-editor-divider" />
                    <div className="cp-editor-document"><span>{plan.projectSnapshot.siteName}</span><div><strong>{plan.title}</strong><small>{plan.documentNo} · REV.{String(plan.revision).padStart(2, '0')}</small></div></div>
                    <ConstructionPlanStatusBadge status={plan.status} compact />
                </div>
                <ConstructionPlanEditorModeSwitch
                    mode={editorMode}
                    canEditMode={lifecycleAllowsEditing}
                    reviewRouteLocked={Boolean(snapshotId)}
                    switching={modeSwitching}
                    disabled={drawingUpload.uploading}
                    saveLabel={saveLabel}
                    blockingErrorCount={errors}
                    pdfReady={errors === 0}
                    openReviewCount={openReviewCount}
                    reviewPackageAvailable={reviewWorkspace.available && Boolean(reviewWorkspace.comparison)}
                    onChange={changeEditorMode}
                />
                <div className="cp-editor-header__right">
                    <span className={`cp-lock-state${lockAcquired ? ' is-owned' : ' is-readonly'}`}>{lockAcquired ? <Unlock size={14} /> : <Lock size={14} />}{lockAcquired ? `${userName} 편집 중` : plan.editLock ? `${plan.editLock.userName} 편집 중 · 조회전용` : '조회전용'}</span>
                    <span className={`cp-save-state cp-save-state--${saveState}`}>{saveState === 'saving' ? <Loader2 size={14} className="cp-spin" /> : saveState === 'offline' ? <WifiOff size={14} /> : saveState === 'error' ? <AlertCircle size={14} /> : <Save size={14} />}{saveLabel}</span>
                </div>
            </header>

            {failedSaveSnapshot && (
                <ConstructionPlanSaveRecovery
                    snapshot={failedSaveSnapshot}
                    lastSuccessfulSaveAt={lastSavedAt}
                    retrying={saveState === 'saving'}
                    offline={saveState === 'offline'}
                    onRetry={retryFailedSave}
                />
            )}

            {actionError && <div className="cp-editor-alert" role="alert"><AlertCircle size={15} />{actionError}<button type="button" onClick={() => setActionError('')}>닫기</button></div>}

            {quickPreviewRoute && (
                <section className="cp-quick-preview-bar" aria-label="빠른 PDF 다운로드">
                    <span className="cp-quick-preview-bar__icon">{workflowBusy ? <Loader2 size={18} className="cp-spin" /> : <FileCheck2 size={18} />}</span>
                    <div><strong>{workflowBusy ? 'A4 PDF를 생성하고 있습니다' : 'A4 미리보기와 PDF가 준비되었습니다'}</strong><span>{workflowBusy?.label ?? '다운로드가 시작되지 않았다면 PDF 다운로드를 다시 눌러주세요.'}</span></div>
                    <button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={() => navigate('/construction-plans/manage')}><FileText size={14} /> 문서 관리</button>
                    <button type="button" className="cp-button cp-button--secondary cp-button--small" onClick={() => navigate(`/construction-plans/${plan.id}?mode=edit`)}><SlidersHorizontal size={14} /> 상세 편집</button>
                    <button type="button" className="cp-button cp-button--primary cp-button--small" disabled={Boolean(workflowBusy)} onClick={() => void createDraftPdf()}>{workflowBusy ? <Loader2 size={14} className="cp-spin" /> : <Download size={14} />} PDF 다운로드</button>
                </section>
            )}

            {!quickPreviewRoute && <ConstructionPlanLifecycleControlPanel
                plan={plan}
                disabled={Boolean(workflowBusy) || drawingUpload.uploading}
                onChanged={loadEditor}
                onError={setActionError}
            />}

            {!quickPreviewRoute && editorMode === 'edit' && lifecycleAllowsEditing && (
                <ConstructionPlanOnboardingChecklist
                    planId={plan.id}
                    siteConnected={onboardingSiteConnected}
                    organizationConfirmed={onboardingOrganizationConfirmed}
                    drawingMarked={onboardingDrawingMarked}
                    onNavigate={navigateOnboarding}
                />
            )}

            {!plan.templateBinding && (plan.status === 'draft' || plan.status === 'changes_requested') && (
                <section className="cp-changes-request" aria-label="legacy 템플릿 바인딩 복원">
                    <div>
                        <strong>게시 템플릿 해시 바인딩 필요</strong>
                        <span>이 legacy 초안은 검토·승인·발행이 차단됩니다. 현재 exact 게시본을 서버에서 검증해 바인딩하면 기존 검토 포인터는 초기화되고 처음부터 재검토합니다.</span>
                    </div>
                    <textarea
                        maxLength={500}
                        value={templateBindingMigrationReason}
                        onChange={(event) => setTemplateBindingMigrationReason(event.target.value)}
                        placeholder="legacy 문서를 현재 게시 템플릿 계약으로 복원하는 사유를 10자 이상 입력하세요."
                    />
                    <small>{templateBindingMigrationReason.trim().length}/500</small>
                    <button
                        type="button"
                        className="cp-button cp-button--secondary cp-button--small"
                        disabled={!lockAcquired || templateBindingMigrationReason.trim().length < 10 || Boolean(workflowBusy)}
                        onClick={() => void migrateLegacyTemplateBinding()}
                    >
                        <ShieldCheck size={14} /> 게시 해시 바인딩 후 재검토 준비
                    </button>
                </section>
            )}

            {!quickPreviewRoute && <ConstructionPlanWorkflowActions
                status={plan.status}
                blockingErrorCount={errors}
                busy={workflowBusy}
                actionDisabled={drawingUpload.uploading || ((plan.status === 'draft' || plan.status === 'changes_requested') && !lockAcquired)}
                issuedDownloadAvailable={Boolean(plan.issuedExportStoragePath || issuedArtifact?.storagePath)}
                activeRevision={activeRevision}
                onOpenActiveRevision={activeRevision ? () => navigate(`/construction-plans/${activeRevision.id}`) : undefined}
                onDraftPdf={() => void createDraftPdf()}
                onRequestReview={() => void requestReview()}
                onCompleteReview={() => void runReviewAction('complete_review')}
                onOpenRequestChanges={() => setShowChangesRequest(true)}
                onApprove={() => void runReviewAction('approve')}
                onIssue={() => void prepareIssuedPdf()}
                onDownloadIssued={() => void downloadIssuedPdf()}
                onExcelDownload={() => void createExcelDownload()}
                onCreateRevision={plan.status !== 'issued' || revisionLookupReady ? () => setDeriveMode('revision') : undefined}
                onClone={() => setDeriveMode('clone')}
            />}

            {showChangesRequest && isConstructionPlanChangeRequestAvailable(plan.status) && (
                <section className="cp-changes-request" aria-label="수정 요청 사유">
                    <div><strong>작성자에게 수정 요청</strong><span>사유는 서버 감사이력에 보존되며 작성 상태로 되돌아갑니다.</span></div>
                    <textarea autoFocus maxLength={1000} value={changesRequestReason} onChange={(event) => setChangesRequestReason(event.target.value)} placeholder="수정할 페이지·항목과 기대 결과를 구체적으로 입력하세요. (필수)" />
                    <small>{changesRequestReason.trim().length}/1000</small>
                    <button type="button" className="cp-button cp-button--ghost cp-button--small" disabled={Boolean(workflowBusy)} onClick={() => { setShowChangesRequest(false); setChangesRequestReason(''); changesRequestAttemptRef.current = undefined; }}>취소</button>
                    <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={changesRequestReason.trim().length < 5 || Boolean(workflowBusy)} onClick={() => void requestPlanChanges()}>수정 요청 확정</button>
                </section>
            )}

            {pendingIssuePdf && plan.status === 'approved_pending_issue' && (
                <section className="cp-issue-confirm" aria-label="발행 후보 시각 확인">
                    <span className="cp-issue-confirm__icon"><FileCheck2 size={17} /></span>
                    <div className="cp-issue-confirm__copy">
                        <strong>서버 권위 {pendingIssuePdf.candidate.pageCount}쪽 발행 후보 준비 완료</strong>
                        <span>SHA-256 {pendingIssuePdf.candidate.sha256.slice(0, 16)}… · {(pendingIssuePdf.candidate.sizeBytes / 1024 / 1024).toFixed(1)}MB · GEN {pendingIssuePdf.candidate.storageGeneration}</span>
                        <span>{pendingIssuePdf.provenance.rendererVersion} · {pendingIssuePdf.provenance.drawingRenderMode}</span>
                    </div>
                    <button type="button" className="cp-button cp-button--secondary cp-button--small" disabled={Boolean(workflowBusy)} onClick={previewIssuedPdf}>
                        <Eye size={14} /> 후보 PDF 내려받아 확인
                    </button>
                    <label className={!issuePreviewOpened ? 'is-disabled' : undefined}>
                        <input type="checkbox" disabled={!issuePreviewOpened || Boolean(workflowBusy)} checked={visualCheckConfirmed} onChange={(event) => setVisualCheckConfirmed(event.target.checked)} />
                        {pendingIssuePdf.candidate.pageCount}쪽 레이아웃·도면·표를 확인했습니다
                    </label>
                    <button type="button" className="cp-button cp-button--primary cp-button--small" disabled={!issuePreviewOpened || !visualCheckConfirmed || Boolean(workflowBusy)} onClick={() => void confirmIssue()}>
                        <Download size={14} /> 발행 확정 및 다운로드
                    </button>
                </section>
            )}

            <div id="construction-plan-editor-workspace" role="tabpanel" aria-label={`${editorMode === 'edit' ? '작성' : editorMode === 'preview' ? 'A4 미리보기' : '검토'} 작업공간`} className={`cp-editor-shell is-mode-${editorMode}${leftCollapsed ? ' is-left-collapsed' : ''}${rightCollapsed ? ' is-right-collapsed' : ''}${drawingWorkspace && drawingSelected ? ' is-drawing-workspace' : ''}`}>
                <aside className="cp-editor-left">
                    <div className="cp-editor-panel-bar"><span>계획서 구성</span><button type="button" onClick={() => setLeftCollapsed(true)} aria-label="목차 접기"><PanelLeftClose size={17} /></button></div>
                    <PlanSectionNavigator sections={plan.sections} selectedSectionId={selectedSection.id} disabled={drawingUpload.uploading} onSelect={(sectionId) => { setSelectedSectionId(sectionId); setDrawingWorkspace(false); }} />
                    <div className="cp-editor-left__foot"><ShieldCheck size={14} /><span>필수 섹션은 삭제할 수 없습니다.</span></div>
                </aside>

                {leftCollapsed && <button type="button" className="cp-collapse-handle cp-collapse-handle--left" onClick={() => setLeftCollapsed(false)}><FileText size={16} /><span>목차</span></button>}

                <section className="cp-editor-canvas">
                    <div className="cp-preview-toolbar">
                        <div><span className="cp-preview-toolbar__crumb">{selectedSection.title}{selectedPhysicalPages.length > 1 ? ` · 물리 ${selectedPhysicalPages.length}쪽` : ''}</span>{editorMode === 'edit' && drawingSelected && <button type="button" disabled={drawingUpload.uploading} className={`cp-workspace-toggle${drawingWorkspace ? ' is-active' : ''}`} onClick={() => setDrawingWorkspace((value) => !value)}><FileImage size={14} />{drawingWorkspace ? 'A4 미리보기' : '도면 작업공간'}</button>}</div>
                        {!drawingWorkspace && <div className="cp-zoom-controls"><button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} aria-label="축소"><ZoomOut size={16} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.1, value + 0.1))} aria-label="확대"><ZoomIn size={16} /></button></div>}
                    </div>
                    {drawingWorkspace && drawingSelected ? (
                        <div className="cp-drawing-workspace" ref={centerScrollElementRef} onScroll={handleCenterScroll}><DrawingStudio
                            value={getDrawingValue(selectedSection, drawingPreviewUrls[selectedSection.id], selectedDrawing)}
                            readOnly={readOnly}
                            onChange={(value) => updateDrawingStudio(selectedSection, value)}
                            onBackgroundFileChange={(file, metadata) => { void uploadDrawingBackground(selectedSection, file, metadata); }}
                            onPreviewPageChange={(pageIndex) => updateDrawingPreviewPage(selectedSection, pageIndex)}
                            resolvePreviewPageUrl={(pageIndex) => loadDrawingPreviewPageUrl(selectedSection.id, pageIndex)}
                            onRetryPreview={selectedDrawing?.mimeType === 'application/pdf'
                                ? () => { void ensureDrawingPreview(selectedSection, selectedDrawing, true); }
                                : undefined}
                            showFirstUsePractice={!onboardingDrawingMarked}
                            firstUsePracticeStorageKey={`construction-plan:drawing-polygon-practice:${userId}:v1`}
                            focusObjectId={validationFocus.objectId}
                            focusRequestKey={validationFocus.requestKey}
                            aria-label={`${selectedSection.title} 구간 편집`}
                        /></div>
                    ) : physicalPagePlanResult.physicalPlan ? (
                        <div
                            className="cp-preview-stage cp-preview-stage--continuations"
                            ref={centerScrollElementRef}
                            onScroll={handleCenterScroll}
                            style={{ '--cp-preview-zoom': zoom } as React.CSSProperties}
                        >
                            {selectedPhysicalPages.map((page) => <ConstructionPlanA4Preview
                                embedded
                                key={page.key}
                                plan={page.plan}
                                section={page.section}
                                zoom={zoom}
                                drawingPreviewUrl={drawingPreviewUrls[selectedSection.id]}
                                physicalPageNumber={page.manifest.physicalPageNumber}
                                physicalPageCount={physicalPagePlanResult.physicalPlan!.physicalPageCount}
                                continuationIndex={page.manifest.continuationIndex}
                                logicalStartPhysicalPages={physicalPagePlanResult.physicalPlan!.logicalStartPhysicalPages}
                                onSelectField={(target) => selectPreviewField(page.section.id, target)}
                            />)}
                        </div>
                    ) : (
                        <div className="cp-preview-stage cp-preview-stage--error" ref={centerScrollElementRef} onScroll={handleCenterScroll}>
                            <div className="cp-editor-alert" role="alert"><AlertCircle size={15} />A4 페이지 구성 실패: {physicalPagePlanResult.error}</div>
                        </div>
                    )}
                </section>

                <aside className="cp-editor-right">
                    <div className="cp-editor-panel-bar"><div className="cp-editor-tabs"><button type="button" disabled={drawingUpload.uploading} className={rightTab === 'data' ? 'is-active' : ''} onClick={() => setRightTab('data')}>섹션 데이터</button><button type="button" disabled={drawingUpload.uploading} className={rightTab === 'validation' ? 'is-active' : ''} onClick={() => setRightTab('validation')}>검증 <em>{validationIssues.length}</em></button><button type="button" disabled={drawingUpload.uploading} className={rightTab === 'review' ? 'is-active' : ''} onClick={() => setRightTab('review')}>검토 <em>{reviewWorkspace.comments.filter((comment) => comment.status !== 'resolved').length}</em></button><button type="button" disabled={drawingUpload.uploading} className={rightTab === 'history' ? 'is-active' : ''} onClick={() => setRightTab('history')}>이력</button></div><button type="button" disabled={drawingUpload.uploading} onClick={() => setRightCollapsed(true)} aria-label="데이터 패널 접기"><PanelRightClose size={17} /></button></div>
                    <ConstructionPlanImmediateSaveBoundary
                        className="cp-editor-right__scroll"
                        enabled={rightTab === 'data' && !readOnly}
                        onImmediateSave={() => {
                            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                            void flushSave();
                        }}
                    >
                        {rightTab === 'validation' ? <ConstructionPlanValidationPanel issues={validationIssues} onSelectIssue={selectIssue} /> : rightTab === 'review' ? (
                            <ConstructionPlanReviewWorkspacePanel
                                comments={reviewWorkspace.comments}
                                comparison={reviewWorkspace.comparison}
                                loading={reviewLoading}
                                error={reviewError}
                                available={reviewWorkspace.available}
                                unavailableReason={reviewWorkspace.unavailableReason}
                                resolvingCommentId={reviewMutationId}
                                canCreateComment={Boolean(reviewWorkspace.permissions?.canCreateComment)}
                                currentAnchor={reviewCurrentAnchor}
                                onRetry={() => void loadReviewWorkspace()}
                                onNavigateAnchor={navigateReviewAnchor}
                                onNavigateChange={(sectionId) => { setSelectedSectionId(sectionId); setDrawingWorkspace(false); }}
                                onCreateComment={createReviewComment}
                                onReplyComment={replyReviewComment}
                                onMarkCommentAddressed={(comment) => { void markReviewCommentAddressed(comment); }}
                                onSetCommentResolved={setReviewCommentResolution}
                                onLoadMessages={(comment) => constructionPlanReviewUiAdapter.listMessages({ planId, commentId: comment.id })}
                            />
                        ) : rightTab === 'history' ? (
                            <ConstructionPlanHistoryPanel
                                planId={plan.id}
                                onNavigatePlan={(targetPlanId) => navigate(`/construction-plans/${targetPlanId}?tab=history`)}
                            />
                        ) : drawingRegisterSelected ? (
                            <ConstructionPlanDrawingApplicabilityPanel
                                decisions={plan.drawingApplicability}
                                drawings={plan.drawings}
                                reviewedBy={userName}
                                readOnly={readOnly}
                                onChange={updateDrawingApplicability}
                            />
                        ) : drawingSelected ? (
                            <>
                                <ConstructionPlanDrawingUploadProgress
                                    state={selectedDrawingUploadViewState}
                                    onCancel={drawingUpload.uploading ? cancelDrawingUpload : undefined}
                                    canceling={drawingUpload.cancelRequested}
                                />
                                <ConstructionPlanDrawingPanel
                                    section={selectedSection}
                                    drawing={selectedDrawing}
                                    projectZones={plan.projectSnapshot.zones}
                                    readOnly={readOnly}
                                    uploading={drawingUpload.sectionId === selectedSection.id && drawingUpload.uploading}
                                    onOpenLibrary={readOnly ? undefined : () => { void openDrawingLibrary(selectedSection.id); }}
                                    onChange={(drawing) => updateDrawingMetadata(selectedSection, drawing)}
                                />
                            </>
                        ) : isEngineeringSection(selectedSection) ? (
                            <ConstructionPlanEngineeringPanel
                                values={plan.engineeringValues}
                                zones={plan.projectSnapshot.zones}
                                reviewerName={userName}
                                readOnly={readOnly}
                                onChange={updateEngineeringValues}
                            />
                        ) : selectedSection.kind === 'equipment-plan' ? (
                            <ConstructionPlanEquipmentPanel
                                items={plan.equipmentPlan}
                                zones={plan.projectSnapshot.zones}
                                workers={workers}
                                readOnly={readOnly}
                                onChange={updateEquipmentPlan}
                            />
                        ) : selectedSection.kind === 'risk-assessment' && riskAssessmentPolicy ? (
                            <ConstructionPlanRiskAssessmentPanel
                                items={plan.riskAssessments}
                                workers={workers}
                                reviewerName={userName}
                                policy={riskAssessmentPolicy}
                                readOnly={readOnly}
                                onChange={updateRiskAssessments}
                            />
                        ) : selectedSection.kind === 'risk-assessment' ? (
                            <div className="cp-structured-missing" role="alert"><AlertCircle size={15} /><div><strong>위험성평가 템플릿 계약을 확인할 수 없습니다.</strong><p>선택된 템플릿 ID와 버전을 복구한 뒤 다시 작성하세요.</p></div></div>
                        ) : selectedSection.key === 'project-overview' ? (
                            <div className="cp-editor-data-stack">
                                <ConstructionPlanErpSnapshotPanel plan={plan} focus="project" />
                                <ConstructionPlanErpRefreshWorkspace
                                    plan={plan}
                                    readOnly={readOnly}
                                    onPrepareApply={prepareErpRefreshApply}
                                    onPlanApplied={applyCanonicalErpRefreshPlan}
                                />
                                <ConstructionPlanProjectScopePanel
                                    value={plan.projectSnapshot}
                                    readOnly={readOnly}
                                    onChange={updateProjectScope}
                                />
                                <SectionDataPanel section={selectedSection} templateVersion={plan.templateVersion} readOnly={readOnly} onChange={updateSection} />
                            </div>
                        ) : selectedSection.kind === 'organization-chart' ? (
                            <div className="cp-editor-data-stack">
                                <ConstructionPlanErpSnapshotPanel plan={plan} focus="organization" />
                                <ConstructionPlanErpRefreshWorkspace
                                    plan={plan}
                                    readOnly={readOnly}
                                    onPrepareApply={prepareErpRefreshApply}
                                    onPlanApplied={applyCanonicalErpRefreshPlan}
                                />
                                <ConstructionPlanOrganizationEditor value={plan.organizationSnapshot} candidates={workers} disabled={readOnly} onChange={updateOrganization} />
                            </div>
                        ) : isStructuredSectionKey(selectedSection.key) ? (
                            <ConstructionPlanStructuredSectionPanel
                                section={selectedSection}
                                zones={plan.projectSnapshot.zones}
                                workers={workers}
                                readOnly={readOnly}
                                onChange={updateSection}
                            />
                        ) : selectedStandardTextEntry ? (
                            <ConstructionPlanStandardTextPanel
                                section={selectedSection}
                                entry={selectedStandardTextEntry}
                                readOnly={readOnly}
                                updatedBy={userName}
                                onChange={updateSection}
                            />
                        ) : (
                            <SectionDataPanel section={selectedSection} templateVersion={plan.templateVersion} readOnly={readOnly} onChange={updateSection} />
                        )}
                    </ConstructionPlanImmediateSaveBoundary>
                </aside>
                {rightCollapsed && <button type="button" className="cp-collapse-handle cp-collapse-handle--right" onClick={() => setRightCollapsed(false)}><SlidersHorizontal size={16} /><span>데이터</span></button>}
            </div>
            <ConstructionPlanPrintDocument containerRef={printDocumentRef} plan={printPlan ?? plan} drawingPreviewUrls={drawingPreviewUrls} />
            {deriveMode && (
                <ConstructionPlanDeriveDialog
                    open
                    mode={deriveMode}
                    sourcePlan={plan}
                    onClose={() => setDeriveMode(undefined)}
                    onSubmit={derivePlan}
                />
            )}
            {drawingLibrarySectionId && (
                <ConstructionPlanDrawingLibraryDialog
                    open
                    targetPlanId={plan.id}
                    targetSectionId={drawingLibrarySectionId}
                    expectedLockVersion={plan.lockVersion}
                    onClose={() => setDrawingLibrarySectionId(undefined)}
                    onImported={applyImportedDrawing}
                />
            )}
        </main>
    );
}

type ConstructionPlanProjectScopePanelProps = {
    value: ConstructionPlan['projectSnapshot'];
    readOnly: boolean;
    onChange: (value: Pick<ConstructionPlan['projectSnapshot'], 'buildings' | 'floors' | 'zones' | 'emergencyContactsComplete'>) => void;
};

function ConstructionPlanProjectScopePanel({ value, readOnly, onChange }: ConstructionPlanProjectScopePanelProps) {
    const updateList = (field: 'buildings' | 'floors' | 'zones', raw: string) => onChange({
        buildings: value.buildings,
        floors: value.floors,
        zones: value.zones,
        emergencyContactsComplete: value.emergencyContactsComplete,
        [field]: splitScopeValues(raw),
    });
    return (
        <section className="cp-section-data" data-validation-record-id="projectSnapshot">
            <div className="cp-panel-heading cp-panel-heading--bordered"><div><span className="cp-eyebrow">Plan scope</span><h3>계획서 적용 범위</h3></div></div>
            <div className="cp-form-grid cp-form-grid--3">
                <label><span>동 *</span><input data-validation-field="buildings" value={value.buildings.join(', ')} disabled={readOnly} onChange={(event) => updateList('buildings', event.target.value)} /></label>
                <label><span>층 *</span><input data-validation-field="floors" value={value.floors.join(', ')} disabled={readOnly} onChange={(event) => updateList('floors', event.target.value)} /></label>
                <label><span>구간 *</span><input data-validation-field="zones" value={value.zones.join(', ')} disabled={readOnly} onChange={(event) => updateList('zones', event.target.value)} /></label>
            </div>
            <label className="cp-inline-check"><input data-validation-field="emergencyContactsComplete" type="checkbox" checked={value.emergencyContactsComplete} disabled={readOnly} onChange={(event) => onChange({ buildings: value.buildings, floors: value.floors, zones: value.zones, emergencyContactsComplete: event.target.checked })} /><span>비상연락망 필수정보 확인 완료</span></label>
        </section>
    );
}

type SectionDataPanelProps = { section: PlanSection; templateVersion: string; readOnly: boolean; onChange: (section: PlanSection, immediate?: boolean) => void };

function SectionDataPanel({ section, templateVersion, readOnly, onChange }: SectionDataPanelProps) {
    const setContent = (key: string, value: string) => onChange({ ...section, content: { ...section.content, [key]: value }, status: value.trim() ? 'in_progress' : section.status });
    return (
        <section className="cp-section-data" data-validation-record-id={section.id}>
            <div className="cp-panel-heading cp-panel-heading--bordered"><div><span className="cp-eyebrow">Section {String(section.order + 1).padStart(2, '0')}</span><h3>{section.title}</h3></div><span className={`cp-completion-chip cp-completion-chip--${section.status}`}>{section.status === 'complete' ? '완료' : section.status === 'not_applicable' ? '해당없음' : section.status === 'in_progress' ? '작성 중' : '미작성'}</span></div>
            <div className="cp-source-callout"><SparkleIcon /><div><strong>데이터 출처</strong><p>현장 스냅샷 + 표준 템플릿 {templateVersion}</p></div></div>
            <div className="cp-data-form">
                <label><span>섹션 상태</span><div className="cp-select-wrap"><select data-validation-field="status" value={section.status} disabled={readOnly} onChange={(event) => onChange({ ...section, status: event.target.value as PlanSection['status'] }, true)}><option value="empty">미작성</option><option value="in_progress">작성 중</option><option value="complete">완료</option>{!section.required && <option value="not_applicable">해당없음</option>}</select><ChevronDown size={15} /></div></label>
                {section.status === 'not_applicable' && <label><span>해당없음 사유 *</span><textarea data-validation-field="notApplicableReason" value={section.notApplicableReason || ''} disabled={readOnly} onChange={(event) => onChange({ ...section, notApplicableReason: event.target.value })} onBlur={() => onChange(section, true)} placeholder="해당 구간에 적용되지 않는 이유와 확인자를 기록하세요." /></label>}
                <label><span>적용 대상 / 범위</span><input data-validation-field="scope" value={String(section.content.scope ?? '')} disabled={readOnly} onChange={(event) => setContent('scope', event.target.value)} onBlur={() => onChange(section, true)} placeholder="예: 101동 지하 2층 A구간" /></label>
                <label><span>섹션 요약</span><textarea data-validation-field="summary" value={String(section.content.summary ?? '')} disabled={readOnly} onChange={(event) => setContent('summary', event.target.value)} onBlur={() => onChange(section, true)} placeholder="이 절의 현장 적용 내용을 간단히 작성하세요." /></label>
                <label><span>현장별 시공 내용</span><textarea data-validation-field="body" className="is-tall" value={String(section.content.body ?? '')} disabled={readOnly} onChange={(event) => setContent('body', event.target.value)} onBlur={() => onChange(section, true)} placeholder="표준 절차와 다른 현장 조건, 작업 순서, 통제 방법을 작성하세요." /></label>
            </div>
            {section.standardTextModified && <div className="cp-standard-warning"><AlertCircle size={15} /><div><strong>표준 문구가 수정되었습니다</strong><p>{section.standardTextModificationReason || '변경 사유를 입력하고 검토자 확인을 받아야 합니다.'}</p></div></div>}
            {readOnly && <div className="cp-readonly-notice"><Lock size={14} /> 현재 문서는 조회전용입니다. 발행본은 수정할 수 없습니다.</div>}
        </section>
    );
}

function SparkleIcon() { return <span className="cp-source-callout__icon"><Check size={14} /></span>; }

export default ConstructionPlanEditorPage;
