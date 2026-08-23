import React from 'react';
import { FileImage } from 'lucide-react';
import type { ConstructionPlan, PlanSection, StructuredSectionKey } from '../types';
import { isStructuredSectionKey } from '../types';
import { resolveDrawingPreviewPage } from '../domain/drawingPreview';
import { getStandardTextSectionCatalogEntry } from '../domain/standardTextCatalog';
import {
    boundsFromPoints,
    DRAWING_LAYERS,
    drawingLayerStyleColor,
    drawingAnnotationsToStudioObjects,
    parseDrawingStudioValue,
    toSvgPoints,
    type DrawingObject,
} from './drawings';
import {
    ApprovalSheetPreview,
    ChecklistTemplatePreview,
    DocumentControlPreview,
    PhotoSheetPreview,
    ProjectOverviewPreview,
    RiskAssessmentPreview,
    TableOfContentsPreview,
} from './ConstructionPlanSpecializedPreviews';
import ConstructionPlanStructuredSectionPreview from './ConstructionPlanStructuredSectionPreview';

type PreviewPlan = ConstructionPlan;

export type ConstructionPlanPreviewFieldTarget = {
    path: string;
    relatedId?: string;
    objectId?: string;
};

type ConstructionPlanA4PreviewProps = {
    plan: PreviewPlan;
    section: PlanSection;
    zoom?: number;
    drawingPreviewUrl?: string;
    scrollContainerRef?: React.Ref<HTMLDivElement>;
    onScroll?: React.UIEventHandler<HTMLDivElement>;
    physicalPageNumber?: number;
    physicalPageCount?: number;
    continuationIndex?: number;
    logicalStartPhysicalPages?: ReadonlyMap<number, number>;
    embedded?: boolean;
    onSelectField?: (target: ConstructionPlanPreviewFieldTarget) => void;
};

const contentText = (content: Record<string, unknown>, key: string, fallback = '미등록'): string => {
    const value = content[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
    return fallback;
};

const organizationRoles = (plan: PreviewPlan) =>
    plan.organizationSnapshot.assignments.filter((assignment) => assignment.role !== 'crew_member');

const DRAWING_SLOTS = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06'] as const;

const pageNumberOf = (section: PlanSection): number => section.pageNumbers[0] ?? section.order + 1;

function SectionTitle({ section, eyebrow }: { section: PlanSection; eyebrow: string }) {
    return (
        <div className="cp-a4__section-title">
            <span>{String(pageNumberOf(section)).padStart(2, '0')}</span>
            <div><small>{eyebrow}</small><h2>{section.title}</h2></div>
        </div>
    );
}

function CoverPreview({ plan }: { plan: PreviewPlan }) {
    const project = plan.projectSnapshot;
    const isScaffold = plan.tradeType === 'system-scaffold';
    const erpContractor = plan.erpSnapshot?.contractorCompany?.value;
    const contractorName = erpContractor?.name || project.contractorName || '시공사 미등록';
    return (
        <div className="cp-a4__cover">
            <div className="cp-a4__brand"><img src="/assets/estimate/cheongyeon-logo.png" alt="청연이엔지" /></div>
            <div className="cp-a4__cover-kicker">{isScaffold ? 'SYSTEM SCAFFOLD' : 'SYSTEM SHORING'} · CONSTRUCTION PLAN</div>
            <div className="cp-a4__cover-line" />
            <div className="cp-a4__cover-title">
                <span>{project.siteName || '현장명 미등록'}</span>
                <h2>{isScaffold ? '시스템비계' : '시스템동바리'} 시공계획서</h2>
                <p>{isScaffold ? '설치 · 사용 · 점검 · 해체 작업계획' : '설치 · 존치 · 해체 작업계획'}</p>
            </div>
            <div className="cp-a4__cover-meta">
                <dl><dt>문서번호</dt><dd>{plan.documentNo || '미등록'}</dd></dl>
                <dl><dt>개정번호</dt><dd>REV. {String(plan.revision).padStart(2, '0')}</dd></dl>
                <dl><dt>적용구간</dt><dd>{[...project.buildings, ...project.floors, ...project.zones].join(' · ') || '미등록'}</dd></dl>
                <dl><dt>공사기간</dt><dd>{project.constructionPeriod?.startDate || '미정'} ~ {project.constructionPeriod?.endDate || '미정'}</dd></dl>
            </div>
            <div className="cp-a4__approval-grid">
                <span>작성</span><span>공사 검토</span><span>안전 검토</span><span>최종 승인</span>
                <strong>{plan.createdByName || '작성자'}</strong><strong /><strong /><strong />
            </div>
            <div className="cp-a4__company">
                <img src="/assets/estimate/cheongyeon-logo.png" alt="" aria-hidden="true" />
                <div><strong>{contractorName}</strong><span>{erpContractor?.address || project.address || '현장 주소 미등록'}</span></div>
            </div>
        </div>
    );
}

function OrganizationPreview({ plan, section }: { plan: PreviewPlan; section: PlanSection }) {
    const assignments = organizationRoles(plan);
    const primary = assignments[0];
    const rest = assignments.slice(1);
    const roleCounts = plan.organizationSnapshot.assignments.reduce<Map<string, number>>((counts, assignment) => {
        if (assignment.worker?.id) counts.set(assignment.worker.id, (counts.get(assignment.worker.id) ?? 0) + 1);
        return counts;
    }, new Map());
    const exceptionText = (assignment: typeof assignments[number] | undefined): string | undefined => {
        if (!assignment?.worker) return undefined;
        const duplicate = (roleCounts.get(assignment.worker.id) ?? 0) > 1;
        const crossSite = Boolean(
            assignment.worker.siteId
            && plan.organizationSnapshot.sourceSiteId
            && assignment.worker.siteId !== plan.organizationSnapshot.sourceSiteId,
        );
        const labels = [
            duplicate ? '겸임' : '',
            assignment.externalAssignment || crossSite ? '현장 외' : '',
        ].filter(Boolean);
        return labels.length > 0
            ? `${labels.join('·')} · ${assignment.exceptionReason || '사유 미등록'}`
            : undefined;
    };
    return (
        <div className="cp-a4__section-content cp-a4__organization">
            <SectionTitle section={section} eyebrow="PROJECT ORGANIZATION" />
            <p className="cp-a4__lead">안전하고 일관된 시공을 위해 현장 책임체계와 역할별 업무를 다음과 같이 정한다.</p>
            <div className="cp-org-chart-preview">
                <div
                    className={`cp-org-node cp-org-node--primary${primary?.worker ? '' : ' is-empty'}`}
                    data-preview-edit-path="organizationSnapshot.assignments.worker"
                    data-preview-related-id={primary?.id}
                >
                    <small>{primary?.label || '현장책임자'}</small>
                    <strong>{primary?.worker?.name || '담당자 미지정'}</strong>
                    <span>{primary?.worker?.position || primary?.worker?.teamName || '필수 역할'}</span>
                    {exceptionText(primary) && <em>{exceptionText(primary)}</em>}
                </div>
                <div className="cp-org-chart-preview__line" />
                <div className="cp-org-chart-preview__grid">
                    {rest.map((assignment) => (
                        <div
                            className={`cp-org-node${assignment.worker ? '' : ' is-empty'}`}
                            key={assignment.id}
                            data-preview-edit-path="organizationSnapshot.assignments.worker"
                            data-preview-related-id={assignment.id}
                        >
                            <small>{assignment.label}</small>
                            <strong>{assignment.worker?.name || '미지정'}</strong>
                            <span>{assignment.worker?.position || assignment.worker?.teamName || (assignment.required ? '필수 역할' : '선택 역할')}</span>
                            {exceptionText(assignment) && <em>{exceptionText(assignment)}</em>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="cp-a4__table-title">작업반 편성</div>
            <table className="cp-a4__table">
                <thead><tr><th>구분</th><th>성명</th><th>직책/역할</th><th>소속</th></tr></thead>
                <tbody>
                    {plan.organizationSnapshot.additionalWorkers.map((worker, index) => (
                        <tr key={worker.id}><td>작업자 {index + 1}</td><td>{worker.name}</td><td>{worker.position || worker.role || '-'}</td><td>{worker.teamName || '-'}</td></tr>
                    ))}
                    {plan.organizationSnapshot.additionalWorkers.length === 0 && <tr><td colSpan={4}>배정된 작업자가 없습니다.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

const sectionDrawingValue = (section: PlanSection) => parseDrawingStudioValue(section.content.drawingStudio);

const sectionDrawingPageIndex = (section: PlanSection): number => {
    const value = section.content.drawingPageIndex;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
};

function PreviewDrawingObject({
    object,
    width,
    height,
    editPath,
}: {
    object: DrawingObject;
    width: number;
    height: number;
    editPath: string;
}) {
    const layer = DRAWING_LAYERS[object.layer];
    const strokeColor = drawingLayerStyleColor(object.style?.strokeToken, layer.color);
    const fillColor = drawingLayerStyleColor(object.style?.fillToken, layer.color);
    const safeObjectId = object.id.replace(/[^A-Za-z0-9_-]/g, '-');
    const patternId = `cp-a4-pattern-${safeObjectId}`;
    const arrowId = `cp-a4-arrow-object-${safeObjectId}`;
    const hatch = object.style?.hatch ?? 'none';
    const areaFill = hatch === 'none' ? fillColor : `url(#${patternId})`;
    const common = {
        stroke: strokeColor,
        strokeWidth: Math.max(2, (object.style?.strokeWidthPt ?? 2) * 2),
        strokeDasharray: object.style?.dash === 'dash' ? '12 8' : object.style?.dash === 'dot' ? '3 7' : layer.dashArray,
        opacity: object.style?.opacity ?? 1,
        vectorEffect: 'non-scaling-stroke' as const,
    };
    const label = [object.zoneCode, object.label].filter(Boolean).join(' · ');
    const bounds = boundsFromPoints(object.points);
    const labelX = (bounds.x + bounds.width / 2) * width;
    const labelY = (bounds.y + bounds.height / 2) * height;
    const points = toSvgPoints(object.kind === 'arrow' ? object.points.slice(0, 2) : object.points, width, height);
    const textX = object.textAlign === 'right'
        ? (bounds.x + bounds.width) * width
        : object.textAlign === 'center' ? labelX : bounds.x * width;
    return <g data-preview-edit-path={editPath} data-preview-related-id={object.id} data-preview-object-id={object.id}>
        <defs>
            <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
                <rect width="14" height="14" fill={fillColor} fillOpacity={layer.fillOpacity} />
                <path d={hatch === 'cross' ? 'M-3 14 L14 -3 M4 17 L17 4 M-3 -3 L17 17' : 'M-3 14 L14 -3 M4 17 L17 4'} stroke={strokeColor} strokeWidth="1.8" />
            </pattern>
            <marker id={arrowId} markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill={strokeColor} /></marker>
        </defs>
        {object.kind === 'rectangle' && object.points.length >= 2
            ? <rect {...common} x={bounds.x * width} y={bounds.y * height} width={bounds.width * width} height={bounds.height * height} fill={areaFill} fillOpacity={hatch === 'none' ? layer.fillOpacity : 1} transform={object.rotationDeg ? `rotate(${object.rotationDeg} ${labelX} ${labelY})` : undefined} />
            : object.kind === 'polygon' && object.points.length >= 3
                ? <polygon {...common} points={points} fill={areaFill} fillOpacity={hatch === 'none' ? layer.fillOpacity : 1} />
                : object.kind === 'ellipse' && object.points.length >= 2
                    ? <ellipse {...common} cx={labelX} cy={labelY} rx={(bounds.width / 2) * width} ry={(bounds.height / 2) * height} fill={areaFill} fillOpacity={hatch === 'none' ? layer.fillOpacity : 1} />
                    : object.kind === 'marker' && object.points.length === 1
                        ? <g {...common} fill="white"><circle cx={object.points[0].x * width} cy={object.points[0].y * height} r="15" /><path d={`M${object.points[0].x * width - 22},${object.points[0].y * height} H${object.points[0].x * width + 22} M${object.points[0].x * width},${object.points[0].y * height - 22} V${object.points[0].y * height + 22}`} fill="none" /></g>
                        : object.kind === 'text' && object.points.length >= 2
                            ? <g><rect {...common} x={bounds.x * width} y={bounds.y * height} width={bounds.width * width} height={bounds.height * height} fill={object.style?.fillToken ? fillColor : 'rgba(255,255,255,.84)'} fillOpacity={object.style?.fillToken ? 0.24 : 1} /><text x={textX} y={labelY} textAnchor={object.textAlign === 'right' ? 'end' : object.textAlign === 'center' ? 'middle' : 'start'} dominantBaseline="central" fill={strokeColor} fontSize={Math.max(12, (object.style?.fontSizePt ?? 10) * 2)}>{object.label || '텍스트'}</text></g>
                            : (object.kind === 'arrow' || object.kind === 'polyline') && object.points.length >= 2
                                ? <polyline {...common} points={points} fill="none" markerStart={object.arrowStart ? `url(#${arrowId})` : undefined} markerEnd={object.arrowEnd !== false ? `url(#${arrowId})` : undefined} />
                                : null}
        {label && object.kind !== 'text' && <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central" fill="#111827" stroke="#fff" strokeWidth="6" paintOrder="stroke" fontSize="18" fontWeight="700">{label}</text>}
    </g>;
}

function DrawingPreview({ plan, section, drawingPreviewUrl }: { plan: PreviewPlan; section: PlanSection; drawingPreviewUrl?: string }) {
    const studio = sectionDrawingValue(section);
    const drawingId = typeof section.content.drawingId === 'string' ? section.content.drawingId : '';
    const drawing = plan.drawings.find((candidate) => candidate.id === drawingId);
    const drawingPageIndex = sectionDrawingPageIndex(section);
    const pageResolution = drawing ? resolveDrawingPreviewPage(drawing, drawingPageIndex) : undefined;
    const backgroundUrl = drawingPreviewUrl ?? studio.background?.sourceUrl;
    const pageMetadata = pageResolution?.ready ? pageResolution.metadata : undefined;
    const rawWidth = pageMetadata ? pageMetadata.cropBoxPt.right - pageMetadata.cropBoxPt.left : 1000;
    const rawHeight = pageMetadata ? pageMetadata.cropBoxPt.top - pageMetadata.cropBoxPt.bottom : 700;
    const rotated = pageMetadata?.rotation === 90 || pageMetadata?.rotation === 270;
    const drawingWidth = 1000;
    const drawingHeight = Math.max(300, Math.round(1000 * (rotated ? rawWidth / rawHeight : rawHeight / rawWidth)));
    const drawingObjects = drawing ? drawingAnnotationsToStudioObjects(
        drawing.annotations,
        drawingPageIndex,
        pageResolution?.ready ? pageResolution.pageFingerprint : undefined,
    ) : [];
    const drawingIndex = drawing ? plan.drawings.findIndex((candidate) => candidate.id === drawing.id) : -1;
    const layers = Array.from(new Set(drawingObjects.map((object) => object.layer)));
    return (
        <div className="cp-a4__section-content">
            <SectionTitle section={section} eyebrow="APPROVED DRAWINGS" />
            {drawing && <div className="cp-a4__drawing-meta" data-preview-edit-path={`drawings.${Math.max(0, drawingIndex)}.drawingNo`} data-preview-related-id={drawing.id}><strong>{drawing.drawingNo || '도면번호 미등록'} · {drawing.title}</strong><span>REV. {drawing.revision || '-'} · {drawing.approvalStatus === 'approved' ? '승인본' : '승인 전'} · PDF {drawingPageIndex + 1}/{drawing.pageCount} · {drawing.approvalReference || '승인근거 미등록'}</span></div>}
            {backgroundUrl ? <div className="cp-a4__drawing-sheet" role="img" aria-label={`${section.title} 구간 표시 도면`}><img src={backgroundUrl} alt="" aria-hidden="true" /><svg viewBox={`0 0 ${drawingWidth} ${drawingHeight}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>{Object.entries(DRAWING_LAYERS).map(([key, config]) => <marker key={key} id={`cp-a4-arrow-${key}`} markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill={config.color} /></marker>)}</defs>{drawingObjects.map((object) => {
                const annotationIndex = drawing?.annotations.findIndex((annotation) => annotation.id === object.id) ?? -1;
                return <PreviewDrawingObject
                    key={object.id}
                    object={object}
                    width={drawingWidth}
                    height={drawingHeight}
                    editPath={annotationIndex >= 0 && drawingIndex >= 0
                        ? `drawings.${drawingIndex}.annotations.${annotationIndex}`
                        : 'drawings.annotations'}
                />;
            })}</svg></div> : <div className="cp-a4__drawing-placeholder">
                <FileImage size={38} strokeWidth={1.4} />
                <strong>{studio.background?.kind === 'pdf' ? 'PDF 페이지 이미지 생성 대기' : drawing ? '도면 미리보기 이미지가 없습니다' : '승인도면을 연결해주세요'}</strong>
                <span>{studio.background?.fileName || '설치 · 해체 · 존치 구간 레이어가 이 위치에 합성됩니다.'}</span>
                <div className="cp-a4__drawing-grid" />
            </div>}
            <div className="cp-a4__drawing-legend">{layers.length ? layers.map((layer) => <span key={layer} style={{ '--drawing-color': DRAWING_LAYERS[layer].color, '--drawing-dash': DRAWING_LAYERS[layer].dashArray ? 'dashed' : 'solid' } as React.CSSProperties}>{DRAWING_LAYERS[layer].label}</span>) : <><span className="is-install">설치구간</span><span className="is-remove">해체구간</span><span className="is-hold">존치/해체금지</span></>}</div>
        </div>
    );
}

const drawingDecisionLabel = (decision?: PreviewPlan['drawingApplicability'][number]): string => {
    if (!decision) return '미결정';
    if (decision.decision === 'applicable') return '현장 적용';
    if (decision.decision === 'replacement') return '대체도면';
    return '해당없음';
};

const drawingApprovalLabel = (status?: PreviewPlan['drawings'][number]['approvalStatus']): string => {
    if (!status) return '도면 미연결';
    if (status === 'approved') return '승인';
    if (status === 'reviewed') return '검토완료';
    if (status === 'superseded') return '대체됨';
    if (status === 'example') return '예시도';
    return '승인 전';
};

function DrawingApplicabilityPreview({ plan, section }: { plan: PreviewPlan; section: PlanSection }) {
    const rows = DRAWING_SLOTS.map((slot) => {
        const decision = plan.drawingApplicability.find((candidate) => candidate.drawingSlot === slot);
        const drawing = decision?.drawingId
            ? plan.drawings.find((candidate) => candidate.id === decision.drawingId)
            : undefined;
        return { slot, decision, drawing };
    });
    const decisionsComplete = rows.filter(({ decision }) => Boolean(decision)).length;
    const approved = rows.filter(({ decision, drawing }) => {
        if (!decision) return false;
        if (decision.decision === 'not_applicable') {
            return Boolean(decision.reason.trim() && decision.reviewedBy?.trim());
        }
        if (decision.decision === 'replacement' && !decision.technicalReviewReference?.trim()) return false;
        return drawing?.approvalStatus === 'approved';
    }).length;

    return (
        <div className="cp-a4__section-content cp-a4__data-page">
            <SectionTitle section={section} eyebrow="DRAWING APPLICABILITY & REGISTER" />
            <p className="cp-a4__lead">표준 도면 D-01~D-06의 현장 적용 여부와 연결 승인도면, 대체·해당없음 근거를 확인한다.</p>
            <div className="cp-a4__data-summary">
                <dl><dt>결정 완료</dt><dd>{decisionsComplete} / 6</dd></dl>
                <dl><dt>승인·해당없음</dt><dd>{approved} / 6</dd></dl>
                <dl><dt>등록 도면</dt><dd>{plan.drawings.length}건</dd></dl>
            </div>
            <div className="cp-a4__table-title">도면 적용성 및 승인근거</div>
            <table className="cp-a4__table cp-a4__data-table cp-a4__applicability-table">
                <thead><tr><th>도면</th><th>적용 결정</th><th>연결 도면 / 사유</th><th>Rev.·승인상태</th><th>승인·기술검토 참조</th><th>확인자</th></tr></thead>
                <tbody>
                    {rows.map(({ slot, decision, drawing }, index) => (
                        <tr key={slot} className={!decision ? 'is-incomplete' : undefined} data-preview-edit-path={`drawingApplicability.${index}.decision`} data-preview-related-id={slot}>
                            <td><strong>{slot}</strong></td>
                            <td data-preview-edit-path={`drawingApplicability.${index}.decision`} data-preview-related-id={slot}><span className={`cp-a4__decision cp-a4__decision--${decision?.decision ?? 'missing'}`}>{drawingDecisionLabel(decision)}</span></td>
                            <td className="is-left" data-preview-edit-path={`drawingApplicability.${index}.${decision?.decision === 'not_applicable' ? 'reason' : 'drawingId'}`} data-preview-related-id={slot}>
                                {decision?.decision === 'not_applicable'
                                    ? (decision.reason || '해당없음 사유 미등록')
                                    : drawing
                                        ? <><strong>{drawing.drawingNo || drawing.originalFileName}</strong><small>{drawing.title || '도면명 미등록'}</small></>
                                        : '연결 도면 없음'}
                            </td>
                            <td>{drawing ? <><strong>REV. {drawing.revision || '-'}</strong><small>{drawingApprovalLabel(drawing.approvalStatus)}</small></> : '-'}</td>
                            <td className="is-left" data-preview-edit-path={`drawingApplicability.${index}.${decision?.decision === 'replacement' ? 'technicalReviewReference' : decision?.decision === 'not_applicable' ? 'reason' : 'drawingId'}`} data-preview-related-id={slot}>{decision?.technicalReviewReference || drawing?.approvalReference || (decision?.decision === 'not_applicable' ? decision.reason : '참조 미등록')}</td>
                            <td>{decision?.reviewedBy || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="cp-a4__data-note">※ 대체도면은 기술검토 참조가, 해당없음은 구체적 사유와 확인자가 기록되어야 한다. 예시도·승인 전 도면은 현장사용 발행본으로 인정하지 않는다.</div>
        </div>
    );
}

const engineeringStatusLabel = (status: PreviewPlan['engineeringValues'][number]['verificationStatus']): string => {
    if (status === 'approved') return '승인';
    if (status === 'reviewed') return '검토완료';
    return '미검토';
};

function EngineeringValuesPreview({ plan, section }: { plan: PreviewPlan; section: PlanSection }) {
    const values = plan.engineeringValues;
    return (
        <div className="cp-a4__section-content cp-a4__data-page">
            <SectionTitle section={section} eyebrow="VERIFIED ENGINEERING VALUES" />
            <p className="cp-a4__lead">구조검토 문서에서 확인한 주요 시공값을 값·단위·출처·Rev.·적용구간과 함께 관리한다.</p>
            <div className="cp-a4__data-summary">
                <dl><dt>기준값</dt><dd>{values.length}건</dd></dl>
                <dl><dt>승인</dt><dd>{values.filter((value) => value.verificationStatus === 'approved').length}건</dd></dl>
                <dl><dt>미검토</dt><dd>{values.filter((value) => value.verificationStatus === 'unverified').length}건</dd></dl>
            </div>
            <div className="cp-a4__table-title">구조기준 출처 추적표</div>
            <table className={`cp-a4__table cp-a4__data-table cp-a4__engineering-table${values.length > 12 ? ' is-dense' : ''}`}>
                <thead><tr><th>항목</th><th>기준값</th><th>적용구간</th><th>출처 문서</th><th>Rev. / 페이지·절</th><th>검증</th></tr></thead>
                <tbody>
                    {values.map((value, index) => (
                        <tr key={`${value.key}-${index}`} className={value.verificationStatus === 'unverified' ? 'is-incomplete' : undefined} data-preview-edit-path={`engineeringValues.${index}.key`} data-preview-related-id={value.key || String(index)}>
                            <td className="is-left" data-preview-edit-path={`engineeringValues.${index}.key`} data-preview-related-id={value.key || String(index)}><strong>{value.key || '항목명 미등록'}</strong>{value.manualInputReason && <small>직접입력: {value.manualInputReason}</small>}</td>
                            <td data-preview-edit-path={`engineeringValues.${index}.value`} data-preview-related-id={value.key || String(index)}><strong>{String(value.value ?? '-')} {value.unit || ''}</strong></td>
                            <td className="is-left" data-preview-edit-path={`engineeringValues.${index}.applicableZones`} data-preview-related-id={value.key || String(index)}>{value.applicableZones.join(', ') || '적용구간 미등록'}</td>
                            <td className="is-left" data-preview-edit-path={`engineeringValues.${index}.sourceDocumentId`} data-preview-related-id={value.key || String(index)}>{value.sourceDocumentId || '출처 미등록'}</td>
                            <td data-preview-edit-path={`engineeringValues.${index}.sourceRevision`} data-preview-related-id={value.key || String(index)}><strong>{value.sourceRevision || 'Rev. 미등록'}</strong><small>{value.sourcePageOrSection || '페이지·절 미등록'}</small></td>
                            <td data-preview-edit-path={`engineeringValues.${index}.verificationStatus`} data-preview-related-id={value.key || String(index)}><span className={`cp-a4__verification cp-a4__verification--${value.verificationStatus}`}>{engineeringStatusLabel(value.verificationStatus)}</span><small>{value.verifiedBy || '-'}</small></td>
                        </tr>
                    ))}
                    {values.length === 0 && <tr className="is-incomplete"><td colSpan={6}>등록된 구조 기준값이 없습니다. 구조검토서의 현장 적용값과 출처를 입력해야 합니다.</td></tr>}
                </tbody>
            </table>
            <div className="cp-a4__data-note">※ 본 표의 값은 구조 안전 자동판정 결과가 아니며, 승인된 구조검토 문서와 현장 적용구간을 담당자가 확인한 기록이다.</div>
        </div>
    );
}

const equipmentCategoryLabel: Record<PreviewPlan['equipmentPlan'][number]['category'], string> = {
    lifting: '양중',
    transport: '운반',
    'work-at-height': '고소작업',
    assembly: '조립',
    measurement: '측정',
};

function EquipmentPlanPreview({ plan, section }: { plan: PreviewPlan; section: PlanSection }) {
    const allItems = plan.equipmentPlan;
    const items = section.key === 'lifting-plan'
        ? allItems.filter((item) => item.category === 'lifting')
        : allItems;
    const workers = [
        ...plan.organizationSnapshot.assignments.flatMap((assignment) => assignment.worker ? [assignment.worker] : []),
        ...plan.organizationSnapshot.additionalWorkers,
    ];
    const workerName = (workerId?: string): string => workerId
        ? workers.find((worker) => worker.id === workerId)?.name || workerId
        : '-';

    return (
        <div className="cp-a4__section-content cp-a4__data-page">
            <SectionTitle section={section} eyebrow={section.key === 'lifting-plan' ? 'LIFTING OPERATION PLAN' : 'EQUIPMENT USE PLAN'} />
            <p className="cp-a4__lead">투입 장비의 제원·검사 유효기간·작업구간과 운전원·신호수 및 통제조치를 사전에 확정한다.</p>
            <div className="cp-a4__data-summary">
                <dl><dt>표시 장비</dt><dd>{items.length}대</dd></dl>
                <dl><dt>양중장비</dt><dd>{items.filter((item) => item.category === 'lifting').length}대</dd></dl>
                <dl><dt>신호수 배정</dt><dd>{items.filter((item) => item.signalerWorkerId).length}대</dd></dl>
            </div>
            <div className="cp-a4__table-title">장비 제원 및 작업계획</div>
            <table className={`cp-a4__table cp-a4__data-table cp-a4__equipment-table${items.length > 8 ? ' is-dense' : ''}`}>
                <thead><tr><th>구분</th><th>장비·모델 / 등록번호</th><th>정격능력·작업반경</th><th>작업구간·단계</th><th>검사 유효기간</th><th>운전원 / 신호수</th><th>통제조치</th></tr></thead>
                <tbody>
                    {items.map((item) => {
                        const itemIndex = Math.max(0, plan.equipmentPlan.findIndex((candidate) => candidate.id === item.id));
                        return (
                            <tr key={item.id} className={!item.equipmentName || !item.inspectionValidUntil ? 'is-incomplete' : undefined} data-preview-edit-path={`equipmentPlan.${itemIndex}.equipmentName`} data-preview-related-id={item.id}>
                                <td data-preview-edit-path={`equipmentPlan.${itemIndex}.category`} data-preview-related-id={item.id}><strong>{equipmentCategoryLabel[item.category]}</strong></td>
                                <td className="is-left" data-preview-edit-path={`equipmentPlan.${itemIndex}.equipmentName`} data-preview-related-id={item.id}><strong>{item.equipmentName || '장비명 미등록'}</strong><small>{[item.model, item.registrationNo].filter(Boolean).join(' / ') || '모델·등록번호 미등록'}</small></td>
                                <td data-preview-edit-path={`equipmentPlan.${itemIndex}.ratedCapacity`} data-preview-related-id={item.id}><strong>{item.ratedCapacity || '-'}</strong><small>반경 {item.workRadius || '-'}</small></td>
                                <td className="is-left" data-preview-edit-path={`equipmentPlan.${itemIndex}.workZones`} data-preview-related-id={item.id}><strong>{item.workZones.join(', ') || '구간 미등록'}</strong><small>{item.plannedStages.join(', ') || '작업단계 미등록'}</small></td>
                                <td data-preview-edit-path={`equipmentPlan.${itemIndex}.inspectionValidUntil`} data-preview-related-id={item.id}>{item.inspectionValidUntil || '미등록'}</td>
                                <td data-preview-edit-path={`equipmentPlan.${itemIndex}.operatorWorkerId`} data-preview-related-id={item.id}><strong>{workerName(item.operatorWorkerId)}</strong><small>신호수 {workerName(item.signalerWorkerId)}</small></td>
                                <td className="is-left" data-preview-edit-path={`equipmentPlan.${itemIndex}.controlMeasures`} data-preview-related-id={item.id}>{item.controlMeasures.join(' · ') || '통제조치 미등록'}</td>
                            </tr>
                        );
                    })}
                    {items.length === 0 && <tr className="is-incomplete"><td colSpan={7}>{section.key === 'lifting-plan' ? '등록된 양중장비가 없습니다.' : '등록된 장비 사용계획이 없습니다.'}</td></tr>}
                </tbody>
            </table>
            <div className="cp-a4__data-note">※ 장비 배치·작업동선은 D-06 도면과 대조하고, 검사 유효기간·작업반경·운전원·신호수 변경 시 계획을 재확인한다.</div>
        </div>
    );
}

function StandardSectionPreview({ plan, section }: { plan: PreviewPlan; section: PlanSection }) {
    const standardEntry = getStandardTextSectionCatalogEntry({
        tradeType: plan.tradeType,
        templateId: plan.templateId,
        templateVersion: plan.templateVersion,
        sectionKey: section.key,
    });
    const storedStandardText = typeof section.content.standardTextCurrent === 'string'
        ? section.content.standardTextCurrent.trim()
        : '';
    const standardText = storedStandardText || standardEntry?.originalText;
    const tradeLabel = plan.tradeType === 'system-scaffold' ? '시스템비계' : '시스템동바리';
    const sectionIndex = Math.max(0, plan.sections.findIndex((candidate) => candidate.id === section.id));
    return (
        <div className="cp-a4__section-content">
            <SectionTitle section={section} eyebrow="CONSTRUCTION METHOD" />
            <p className="cp-a4__lead" data-preview-edit-path={`sections.${sectionIndex}.content.summary`} data-preview-related-id={section.id}>{contentText(section.content, 'summary', `본 절은 ${tradeLabel} 작업의 적용기준과 현장별 실행방법을 규정한다.`)}</p>
            <div className="cp-a4__info-grid">
                <dl data-preview-edit-path={`sections.${sectionIndex}.content.scope`} data-preview-related-id={section.id}><dt>적용 대상</dt><dd>{contentText(section.content, 'scope')}</dd></dl>
                <dl><dt>작업 책임</dt><dd>{contentText(section.content, 'owner', '현장책임자 및 작업반장')}</dd></dl>
                <dl><dt>선행 조건</dt><dd>{contentText(section.content, 'precondition', '승인도면 및 자재검수 확인')}</dd></dl>
                <dl><dt>검측 시점</dt><dd>{contentText(section.content, 'inspection', '설치 완료 후 타설 전')}</dd></dl>
            </div>
            <div className="cp-a4__article" data-preview-edit-path={`sections.${sectionIndex}.content.${standardEntry?.editable ? 'standardTextCurrent' : 'body'}`} data-preview-related-id={section.id}>
                {standardText ? <><h3>표준 시공기준</h3><p className="cp-a4__standard-copy">{standardText}</p></> : <>
                    <h3>1. 작업 기본원칙</h3>
                    <p>{contentText(section.content, 'body', '작업 전 승인도면과 구조검토 조건을 확인하고, 동·층·구간별 설치 순서에 따라 작업한다. 현장 조건이 승인 내용과 다른 경우 작업을 중지하고 담당자의 확인을 받는다.')}</p>
                    <h3>2. 중점 확인사항</h3>
                    <ul>
                        <li>부재 규격, 설치 간격 및 수직도 확인</li>
                        <li>가새·접합부·지지부의 설치상태 확인</li>
                        <li>개구부·단차·가장자리 보강 및 출입통제 확인</li>
                        <li>해체 조건과 작업금지구간의 명확한 표시</li>
                    </ul>
                </>}
            </div>
            {section.standardTextModified && <div className="cp-a4__revision-note" data-preview-edit-path={`sections.${sectionIndex}.standardTextModificationReason`} data-preview-related-id={section.id}>표준 문구 수정본 · 변경사유와 검토이력 확인 필요</div>}
        </div>
    );
}

export function ConstructionPlanA4Preview({
    plan,
    section,
    zoom = 0.78,
    drawingPreviewUrl,
    scrollContainerRef,
    onScroll,
    physicalPageNumber,
    physicalPageCount,
    continuationIndex = 0,
    logicalStartPhysicalPages,
    embedded = false,
    onSelectField,
}: ConstructionPlanA4PreviewProps) {
    const documentTradeLabel = plan.tradeType === 'system-scaffold' ? '시스템비계' : '시스템동바리';
    const isCover = section.key === 'cover' || section.order === 0;
    const isOrganization = section.key.includes('organization') || section.kind === 'organization-chart';
    const isDrawingRegister = section.kind === 'drawing-register';
    const isDrawing = section.kind === 'drawing-page';
    const isEngineering = ['member-specifications', 'connection-details', 'structural-control'].includes(section.key);
    const isEquipment = section.kind === 'equipment-plan';
    const isDocumentControl = section.kind === 'document-control';
    const isTableOfContents = section.kind === 'toc';
    const isProjectOverview = section.key === 'project-overview';
    const isRiskAssessment = section.kind === 'risk-assessment';
    const isChecklist = section.kind === 'checklist-template';
    const isPhotoSheet = section.kind === 'photo-sheet';
    const isApprovalSheet = section.kind === 'approval-sheet';
    const isStructuredSection = isStructuredSectionKey(section.key);
    const pageNo = section.pageNumbers[0] ?? section.order + 1;
    const renderedPhysicalPageNumber = physicalPageNumber ?? pageNo;
    const renderedPhysicalPageCount = physicalPageCount ?? 42;
    const sectionIndex = Math.max(0, plan.sections.findIndex((candidate) => candidate.id === section.id));
    const sectionDrawingId = typeof section.content.drawingId === 'string' ? section.content.drawingId : undefined;
    const defaultEditTarget: ConstructionPlanPreviewFieldTarget = isEngineering
        ? { path: 'engineeringValues' }
        : isEquipment
            ? { path: 'equipmentPlan' }
            : isRiskAssessment
                ? { path: 'riskAssessments' }
                : isOrganization
                    ? { path: 'organizationSnapshot.assignments.worker', relatedId: plan.organizationSnapshot.assignments[0]?.id }
                    : isProjectOverview
                        ? { path: 'projectSnapshot.buildings' }
                        : isDrawingRegister
                            ? { path: 'drawingApplicability', relatedId: DRAWING_SLOTS[0] }
                            : isDrawing && sectionDrawingId
                                ? { path: 'drawings.drawingNo', relatedId: sectionDrawingId }
                                : { path: `sections.${sectionIndex}.status`, relatedId: section.id };
    const selectPreviewField = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
        if (!onSelectField) return;
        if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
        const eventElement = event.target instanceof Element ? event.target : undefined;
        const fieldElement = eventElement?.closest<HTMLElement>('[data-preview-edit-path]');
        if (!fieldElement || !event.currentTarget.contains(fieldElement)) return;
        if ('key' in event) event.preventDefault();
        const path = fieldElement.dataset.previewEditPath;
        if (!path) return;
        onSelectField({
            path,
            ...(fieldElement.dataset.previewRelatedId ? { relatedId: fieldElement.dataset.previewRelatedId } : {}),
            ...(fieldElement.dataset.previewObjectId ? { objectId: fieldElement.dataset.previewObjectId } : {}),
        });
    };

    return (
        <div
            className={embedded ? 'cp-preview-continuation-item' : 'cp-preview-stage'}
            ref={embedded ? undefined : scrollContainerRef}
            onScroll={embedded ? undefined : onScroll}
            style={embedded ? undefined : { '--cp-preview-zoom': zoom } as React.CSSProperties}
        >
            <article
                className={`cp-a4${isCover ? ' cp-a4--cover' : ''}${onSelectField ? ' cp-a4--interactive' : ''}`}
                aria-label={`${section.title} A4 미리보기`}
                data-logical-page={pageNo}
                data-continuation-index={continuationIndex}
                data-preview-edit-path={onSelectField ? defaultEditTarget.path : undefined}
                data-preview-related-id={onSelectField ? defaultEditTarget.relatedId : undefined}
                tabIndex={onSelectField ? 0 : undefined}
                onClick={onSelectField ? selectPreviewField : undefined}
                onKeyDown={onSelectField ? selectPreviewField : undefined}
            >
                {!isCover && (
                    <header className="cp-a4__header">
                        <span>{plan.projectSnapshot.siteName}</span>
                        <strong>{documentTradeLabel} 시공계획서</strong>
                        <span>{plan.documentNo} · REV.{String(plan.revision).padStart(2, '0')}</span>
                    </header>
                )}
                <div className="cp-a4__body">
                    {isCover ? <CoverPreview plan={plan} />
                        : isDocumentControl ? <DocumentControlPreview plan={plan} section={section} />
                            : isTableOfContents ? <TableOfContentsPreview plan={plan} section={section} logicalStartPhysicalPages={logicalStartPhysicalPages} />
                                : isProjectOverview ? <ProjectOverviewPreview plan={plan} section={section} />
                                    : isOrganization ? <OrganizationPreview plan={plan} section={section} />
                                        : isStructuredSection ? <div className="cp-a4__section-content cp-a4__data-page"><SectionTitle section={section} eyebrow="STRUCTURED SITE PLAN" /><ConstructionPlanStructuredSectionPreview section={section} sectionKey={section.key as StructuredSectionKey} /></div>
                                        : isDrawingRegister ? <DrawingApplicabilityPreview plan={plan} section={section} />
                                            : isEngineering ? <EngineeringValuesPreview plan={plan} section={section} />
                                                : isEquipment ? <EquipmentPlanPreview plan={plan} section={section} />
                                                    : isRiskAssessment ? <RiskAssessmentPreview plan={plan} section={section} />
                                                        : isChecklist ? <ChecklistTemplatePreview plan={plan} section={section} />
                                                            : isPhotoSheet ? <PhotoSheetPreview plan={plan} section={section} />
                                                                : isApprovalSheet ? <ApprovalSheetPreview plan={plan} section={section} />
                                                                    : isDrawing ? <DrawingPreview plan={plan} section={section} drawingPreviewUrl={drawingPreviewUrl} />
                                                                        : <StandardSectionPreview plan={plan} section={section} />}
                </div>
                <div className="cp-a4__draft" aria-hidden="true">DRAFT</div>
                {isCover && <div className="cp-a4__issuance-notice">SERVER ISSUANCE RECORD REQUIRED</div>}
                <footer className="cp-a4__footer"><span>검토 전 초안 · 현장사용 금지</span><strong>{renderedPhysicalPageNumber} / {renderedPhysicalPageCount}</strong><span>논리 {pageNo}쪽{continuationIndex > 0 ? ` · 계속 ${continuationIndex}` : ''} · {plan.templateVersion || 'Template 1.0.0'}</span></footer>
            </article>
        </div>
    );
}

export default ConstructionPlanA4Preview;
