import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faCircleCheck,
    faCircle,
    faFileInvoiceDollar,
    faListCheck,
    faClockRotateLeft,
    faExternalLinkAlt,
    faPlus
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
    HomepageRequest,
    HomepageRequestPriority,
    HomepageRequestStatus,
    HomepageRequestType,
    homepageRequestService
} from '../../services/homepageRequestService';
import {
    ChecklistProgress,
    HomepageChecklistItem,
    HomepageChecklistStatus,
    homepageChecklistService
} from '../../services/homepageChecklistService';
import { HomepageActivity, homepageActivityService } from '../../services/homepageActivityService';
import { HomepageEstimate, homepageEstimateService } from '../../services/homepageEstimateService';

const formatDate = (timestamp?: Timestamp): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
};

const formatDateTime = (timestamp?: Timestamp): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
};

const getStatusLabel = (status: HomepageRequestStatus): string => {
    switch (status) {
        case 'requested':
            return '요청';
        case 'accepted':
            return '접수';
        case 'in_progress':
            return '진행 중';
        case 'review':
            return '검토';
        case 'completed':
            return '완료';
        default:
            return status;
    }
};

const getStatusClass = (status: HomepageRequestStatus): string => {
    switch (status) {
        case 'requested':
            return 'bg-slate-50 text-slate-700 border-slate-200';
        case 'accepted':
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'in_progress':
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'review':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'completed':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200';
    }
};

const getTypeLabel = (type: HomepageRequestType): string => {
    return type === 'build' ? '제작' : '수정';
};

const getPriorityLabel = (priority: HomepageRequestPriority): string => {
    if (priority === 'high') return '높음';
    if (priority === 'medium') return '보통';
    return '낮음';
};

const getPriorityClass = (priority: HomepageRequestPriority): string => {
    if (priority === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (priority === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getChecklistStatusLabel = (status: HomepageChecklistStatus): string => {
    if (status === 'todo') return '대기';
    if (status === 'doing') return '진행 중';
    return '완료';
};

const getEstimateStatusLabel = (status: HomepageEstimate['status']): string => {
    if (status === 'approved') return '승인됨';
    if (status === 'sent') return '발송됨';
    if (status === 'rejected') return '반려됨';
    return '임시저장';
};

type TabKey = 'overview' | 'checklist' | 'estimates' | 'activities';

const HomepageRequestDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { requestId } = useParams();
    const { currentUser } = useAuth();

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [request, setRequest] = useState<HomepageRequest | null>(null);
    const [progress, setProgress] = useState<ChecklistProgress | null>(null);
    const [checklist, setChecklist] = useState<HomepageChecklistItem[]>([]);
    const [estimates, setEstimates] = useState<HomepageEstimate[]>([]);
    const [activities, setActivities] = useState<HomepageActivity[]>([]);

    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [newChecklistTitle, setNewChecklistTitle] = useState<string>('');

    const [estimateEditingId, setEstimateEditingId] = useState<string | null>(null);
    const [estimateLabelInput, setEstimateLabelInput] = useState<string>('홈페이지 제작 패키지');
    const [estimateUnitPriceInput, setEstimateUnitPriceInput] = useState<number>(0);
    const [estimateQuantityInput, setEstimateQuantityInput] = useState<number>(1);
    const [estimateStatusInput, setEstimateStatusInput] = useState<HomepageEstimate['status']>('draft');
    const [estimateDiscountInput, setEstimateDiscountInput] = useState<number>(0);
    const [estimateTaxInput, setEstimateTaxInput] = useState<number>(0);
    const [estimateNotesInput, setEstimateNotesInput] = useState<string>('');

    const actor = useMemo(
        () => ({
            id: currentUser?.uid ?? 'system',
            name: currentUser?.displayName ?? currentUser?.email ?? '시스템'
        }),
        [currentUser]
    );

    const loadAll = async (id: string): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const [req, prog, checklistItems, acts, ests] = await Promise.all([
                homepageRequestService.getRequest(id),
                homepageChecklistService.getProgress(id),
                homepageChecklistService.listItems(id),
                homepageActivityService.getActivities(id),
                homepageEstimateService.listEstimatesByRequest(id)
            ]);

            if (!req) {
                setRequest(null);
                setProgress(null);
                setChecklist([]);
                setActivities([]);
                setEstimates([]);
                setError('요청 정보를 찾을 수 없습니다.');
                return;
            }

            setRequest(req);
            setProgress(prog);
            setChecklist(checklistItems);
            setActivities(acts);
            setEstimates(ests);
        } catch (e) {
            setError('요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!requestId) return;
        void loadAll(requestId);
    }, [requestId]);

    const handleStatusChange = async (status: HomepageRequestStatus): Promise<void> => {
        if (!request || !request.id) return;
        try {
            await homepageRequestService.updateStatus(request.id, status, actor);
            setRequest({ ...request, status });
            if (requestId) {
                const [prog, acts] = await Promise.all([
                    homepageChecklistService.getProgress(requestId),
                    homepageActivityService.getActivities(requestId)
                ]);
                setProgress(prog);
                setActivities(acts);
            }
        } catch (e) {
            setError('상태를 변경하는 중 오류가 발생했습니다.');
        }
    };

    const handlePriorityChange = async (priority: HomepageRequestPriority): Promise<void> => {
        if (!request || !request.id) return;
        try {
            await homepageRequestService.updateRequest(request.id, { priority });
            setRequest({ ...request, priority });
        } catch (e) {
            setError('우선순위를 변경하는 중 오류가 발생했습니다.');
        }
    };

    const handleAddChecklistItem = async (): Promise<void> => {
        if (!requestId || newChecklistTitle.trim().length === 0) return;
        try {
            await homepageChecklistService.addItem(
                requestId,
                {
                    title: newChecklistTitle.trim()
                },
                actor
            );
            setNewChecklistTitle('');
            const [prog, items, acts] = await Promise.all([
                homepageChecklistService.getProgress(requestId),
                homepageChecklistService.listItems(requestId),
                homepageActivityService.getActivities(requestId)
            ]);
            setProgress(prog);
            setChecklist(items);
            setActivities(acts);
        } catch (e) {
            setError('체크리스트 항목을 추가하는 중 오류가 발생했습니다.');
        }
    };

    const handleChecklistStatusChange = async (
        item: HomepageChecklistItem,
        status: HomepageChecklistStatus
    ): Promise<void> => {
        if (!requestId || !item.id) return;
        try {
            await homepageChecklistService.updateItem(
                requestId,
                item.id,
                {
                    status
                },
                actor
            );
            const [prog, items, acts] = await Promise.all([
                homepageChecklistService.getProgress(requestId),
                homepageChecklistService.listItems(requestId),
                homepageActivityService.getActivities(requestId)
            ]);
            setProgress(prog);
            setChecklist(items);
            setActivities(acts);
        } catch (e) {
            setError('체크리스트 상태를 변경하는 중 오류가 발생했습니다.');
        }
    };

    const percentage = progress?.percentage ?? 0;

    const estimateSubtotal = useMemo(
        () => (estimateUnitPriceInput || 0) * (estimateQuantityInput || 0),
        [estimateUnitPriceInput, estimateQuantityInput]
    );

    const estimateTotal = useMemo(
        () => estimateSubtotal - (estimateDiscountInput || 0) + (estimateTaxInput || 0),
        [estimateSubtotal, estimateDiscountInput, estimateTaxInput]
    );

    const handleOpenClientView = (): void => {
        if (!requestId) return;
        window.open(`/homepage/client/${requestId}`, '_blank', 'noopener,noreferrer');
    };

    const resetEstimateForm = (): void => {
        setEstimateEditingId(null);
        setEstimateLabelInput('홈페이지 제작 패키지');
        setEstimateUnitPriceInput(0);
        setEstimateQuantityInput(1);
        setEstimateStatusInput('draft');
        setEstimateDiscountInput(0);
        setEstimateTaxInput(0);
        setEstimateNotesInput('');
    };

    const handleSelectEstimateForEdit = (estimate: HomepageEstimate): void => {
        const firstItem = estimate.items[0];
        setEstimateEditingId(estimate.id ?? null);
        setEstimateLabelInput(firstItem?.label ?? '홈페이지 제작 패키지');
        setEstimateUnitPriceInput(firstItem?.unitPrice ?? estimate.subtotal ?? 0);
        setEstimateQuantityInput(firstItem?.quantity ?? 1);
        setEstimateStatusInput(estimate.status);
        setEstimateDiscountInput(estimate.discount ?? 0);
        setEstimateTaxInput(estimate.tax ?? 0);
        setEstimateNotesInput(estimate.notes ?? '');
        setActiveTab('estimates');
    };

    const handleSaveEstimate = async (): Promise<void> => {
        if (!requestId) return;

        const unitPrice = Number.isNaN(estimateUnitPriceInput) ? 0 : estimateUnitPriceInput;
        const quantity =
            Number.isNaN(estimateQuantityInput) || estimateQuantityInput <= 0
                ? 1
                : estimateQuantityInput;
        const discount = Number.isNaN(estimateDiscountInput) ? 0 : estimateDiscountInput;
        const tax = Number.isNaN(estimateTaxInput) ? 0 : estimateTaxInput;

        const itemInput = {
            label: estimateLabelInput.trim() || '홈페이지 제작 패키지',
            description: '',
            category: '',
            unitPrice,
            quantity
        };

        try {
            if (estimateEditingId) {
                await homepageEstimateService.updateEstimate(
                    estimateEditingId,
                    {
                        status: estimateStatusInput,
                        items: [itemInput],
                        discount,
                        tax,
                        notes: estimateNotesInput.trim()
                    },
                    actor
                );
            } else {
                await homepageEstimateService.createEstimate(
                    {
                        requestId,
                        status: estimateStatusInput,
                        items: [itemInput],
                        discount,
                        tax,
                        notes: estimateNotesInput.trim()
                    },
                    actor
                );
            }

            const [ests, acts] = await Promise.all([
                homepageEstimateService.listEstimatesByRequest(requestId),
                homepageActivityService.getActivities(requestId)
            ]);
            setEstimates(ests);
            setActivities(acts);
            resetEstimateForm();
        } catch (e) {
            setError('견적을 저장하는 중 오류가 발생했습니다.');
        }
    };

    const handleNewEstimateClick = (): void => {
        resetEstimateForm();
        setActiveTab('estimates');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/homepage/requests')}
                        className="mr-1 inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faCircleCheck} className="text-indigo-600 text-xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">홈페이지 요청 상세</h1>
                            <p className="text-xs text-slate-500">
                                내부 담당자를 위한 상세 관리 화면입니다. 상태, 우선순위, 체크리스트, 견적, 이력을 한 번에 확인합니다.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button
                        type="button"
                        onClick={handleOpenClientView}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[11px]" />
                        의뢰인용 진행 화면 열기
                    </button>
                    <div className="text-[11px] text-slate-400">요청 ID: {requestId}</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
                    {loading && (
                        <div className="py-10 text-center text-sm text-slate-500">데이터를 불러오는 중입니다...</div>
                    )}
                    {!loading && error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}
                    {!loading && !error && !request && (
                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-6 text-center text-sm text-slate-500">
                            해당 요청을 찾을 수 없습니다.
                        </div>
                    )}

                    {request && (
                        <>
                            {/* Overview */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            {getTypeLabel(request.type)} 의뢰
                                        </div>
                                        <h2 className="text-lg font-bold text-slate-900 break-words">{request.title}</h2>
                                        <p className="text-sm text-slate-500">
                                            {request.clientCompany && (
                                                <span className="font-semibold mr-1">{request.clientCompany}</span>
                                            )}
                                            <span>{request.clientName} 님</span>
                                        </p>
                                        {request.description && (
                                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap break-words">
                                                {request.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="w-full md:w-64 flex flex-col gap-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">상태</span>
                                            <select
                                                value={request.status}
                                                onChange={(e) =>
                                                    void handleStatusChange(e.target.value as HomepageRequestStatus)
                                                }
                                                className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                                            >
                                                <option value="requested">요청</option>
                                                <option value="accepted">접수</option>
                                                <option value="in_progress">진행 중</option>
                                                <option value="review">검토</option>
                                                <option value="completed">완료</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">우선순위</span>
                                            <select
                                                value={request.priority}
                                                onChange={(e) =>
                                                    void handlePriorityChange(e.target.value as HomepageRequestPriority)
                                                }
                                                className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                                            >
                                                <option value="high">높음</option>
                                                <option value="medium">보통</option>
                                                <option value="low">낮음</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500">
                                            <span>요청일</span>
                                            <span className="font-semibold text-slate-800">
                                                {request.createdAt ? formatDate(request.createdAt) : '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-500">
                                            <span>목표 완료일</span>
                                            <span className="font-semibold text-slate-800">
                                                {request.dueDate ? formatDate(request.dueDate) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress summary */}
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                    <FontAwesomeIcon
                                                        icon={faListCheck}
                                                        className="text-indigo-500 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800">
                                                        체크리스트 진행률
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        완료 항목 기준으로 진행률이 계산됩니다.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right text-[11px] text-slate-500">
                                                <div>
                                                    완료율{' '}
                                                    <span className="font-semibold text-slate-900">{percentage}%</span>
                                                </div>
                                                {progress && (
                                                    <div>
                                                        ({progress.done} / {progress.total} 개 완료)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-white overflow-hidden border border-slate-200">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-indigo-700 transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-center gap-1 text-xs text-slate-600">
                                        <div className="flex items-center justify-between">
                                            <span>총 견적 버전 수</span>
                                            <span className="font-semibold text-slate-900">{estimates.length}</span>
                                        </div>
                                        {estimates[0] && (
                                            <>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span>최신 견적 버전</span>
                                                    <span className="font-semibold text-slate-900">
                                                        v{estimates[0].version}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>최신 견적 총액</span>
                                                    <span className="font-extrabold text-emerald-600">
                                                        {estimates[0].total.toLocaleString()} 원
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="bg-white border border-slate-200 rounded-2xl">
                                <div className="border-b border-slate-200 px-4 pt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('overview')}
                                        className={`px-3 py-2 rounded-t-lg border-b-2 -mb-px ${
                                            activeTab === 'overview'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent hover:text-slate-800'
                                        }`}
                                    >
                                        기본 정보
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('checklist')}
                                        className={`px-3 py-2 rounded-t-lg border-b-2 -mb-px ${
                                            activeTab === 'checklist'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent hover:text-slate-800'
                                        }`}
                                    >
                                        체크리스트
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('estimates')}
                                        className={`px-3 py-2 rounded-t-lg border-b-2 -mb-px ${
                                            activeTab === 'estimates'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent hover:text-slate-800'
                                        }`}
                                    >
                                        견적
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('activities')}
                                        className={`px-3 py-2 rounded-t-lg border-b-2 -mb-px ${
                                            activeTab === 'activities'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent hover:text-slate-800'
                                        }`}
                                    >
                                        활동 이력
                                    </button>
                                </div>

                                <div className="p-4">
                                    {activeTab === 'overview' && (
                                        <div className="space-y-3 text-xs text-slate-600">
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500 mb-1">
                                                    참고 URL
                                                </div>
                                                <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-xs break-all">
                                                    {request.referenceUrl && request.referenceUrl.trim().length > 0
                                                        ? request.referenceUrl
                                                        : '등록된 URL이 없습니다.'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold text-slate-500 mb-1">
                                                    참고/요청 사항 메모
                                                </div>
                                                <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-xs whitespace-pre-wrap break-words min-h-[60px]">
                                                    {request.referenceNote && request.referenceNote.trim().length > 0
                                                        ? request.referenceNote
                                                        : '등록된 메모가 없습니다.'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'checklist' && (
                                        <div className="space-y-4 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                        <FontAwesomeIcon
                                                            icon={faListCheck}
                                                            className="text-indigo-500 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">체크리스트</div>
                                                        <div className="text-[11px] text-slate-500">
                                                            세부 작업 목록을 관리하고 상태를 업데이트합니다.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newChecklistTitle}
                                                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="새 체크리스트 항목 제목"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleAddChecklistItem();
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                                >
                                                    <FontAwesomeIcon icon={faPlus} />
                                                    추가
                                                </button>
                                            </div>

                                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                {checklist.length === 0 ? (
                                                    <div className="py-6 text-center text-slate-500 text-xs">
                                                        아직 등록된 체크리스트 항목이 없습니다.
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-[11px]">
                                                        <thead className="bg-slate-50">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-10">
                                                                    #
                                                                </th>
                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600">
                                                                    항목명
                                                                </th>
                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-28">
                                                                    상태
                                                                </th>
                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-28">
                                                                    마감일
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {checklist.map((item, index) => (
                                                                <tr key={item.id ?? index} className="border-t border-slate-100">
                                                                    <td className="px-3 py-2 text-slate-400">
                                                                        {index + 1}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-800">
                                                                        {item.title}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <select
                                                                            value={item.status}
                                                                            onChange={(e) =>
                                                                                void handleChecklistStatusChange(
                                                                                    item,
                                                                                    e.target
                                                                                        .value as HomepageChecklistStatus
                                                                                )
                                                                            }
                                                                            className="border border-slate-300 rounded-lg px-2 py-1 text-[11px] bg-white"
                                                                        >
                                                                            <option value="todo">대기</option>
                                                                            <option value="doing">진행 중</option>
                                                                            <option value="done">완료</option>
                                                                        </select>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-500">
                                                                        {item.dueDate ? formatDate(item.dueDate) : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'estimates' && (
                                        <div className="space-y-4 text-xs">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                        <FontAwesomeIcon
                                                            icon={faFileInvoiceDollar}
                                                            className="text-emerald-500 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">견적 관리</div>
                                                        <div className="text-[11px] text-slate-500">
                                                            단일 패키지 기준으로 빠르게 견적 버전을 생성하고 수정할 수 있습니다.
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleNewEstimateClick}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                                >
                                                    새 견적 버전
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Estimate Form */}
                                                <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                                    <div className="text-xs font-semibold text-slate-700 mb-1">
                                                        {estimateEditingId ? '견적 수정' : '새 견적 작성'}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                상태
                                                            </label>
                                                            <select
                                                                value={estimateStatusInput}
                                                                onChange={(e) =>
                                                                    setEstimateStatusInput(
                                                                        e.target
                                                                            .value as HomepageEstimate['status']
                                                                    )
                                                                }
                                                                className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] bg-white"
                                                            >
                                                                <option value="draft">임시저장</option>
                                                                <option value="sent">발송됨</option>
                                                                <option value="approved">승인됨</option>
                                                                <option value="rejected">반려됨</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                패키지 항목명
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={estimateLabelInput}
                                                                onChange={(e) =>
                                                                    setEstimateLabelInput(e.target.value)
                                                                }
                                                                className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px]"
                                                                placeholder="예: 홈페이지 제작 패키지"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[11px] font-semibold text-slate-600">
                                                                    단가(원)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={estimateUnitPriceInput}
                                                                    onChange={(e) =>
                                                                        setEstimateUnitPriceInput(
                                                                            Number(e.target.value) || 0
                                                                        )
                                                                    }
                                                                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] text-right"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <label className="text-[11px] font-semibold text-slate-600">
                                                                    수량
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={estimateQuantityInput}
                                                                    onChange={(e) =>
                                                                        setEstimateQuantityInput(
                                                                            Number(e.target.value) || 1
                                                                        )
                                                                    }
                                                                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] text-right"
                                                                    min={1}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                할인(원)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={estimateDiscountInput}
                                                                onChange={(e) =>
                                                                    setEstimateDiscountInput(
                                                                        Number(e.target.value) || 0
                                                                    )
                                                                }
                                                                className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] text-right"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                세금(원)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={estimateTaxInput}
                                                                onChange={(e) =>
                                                                    setEstimateTaxInput(
                                                                        Number(e.target.value) || 0
                                                                    )
                                                                }
                                                                className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] text-right"
                                                            />
                                                        </div>

                                                        <div className="border-t border-slate-200 pt-2 mt-1 space-y-1 text-[11px]">
                                                            <div className="flex items-center justify-between text-slate-600">
                                                                <span>소계</span>
                                                                <span className="font-semibold text-slate-800">
                                                                    {estimateSubtotal.toLocaleString()} 원
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-slate-600">
                                                                <span>총액(예상)</span>
                                                                <span className="font-extrabold text-emerald-600">
                                                                    {estimateTotal.toLocaleString()} 원
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">
                                                                비고
                                                            </label>
                                                            <textarea
                                                                value={estimateNotesInput}
                                                                onChange={(e) =>
                                                                    setEstimateNotesInput(e.target.value)
                                                                }
                                                                className="border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] min-h-[60px]"
                                                                placeholder="결제 조건, 포함/제외 항목 등을 메모하세요."
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={resetEstimateForm}
                                                            className="px-3 py-1.5 text-[11px] rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
                                                        >
                                                            초기화
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                void handleSaveEstimate();
                                                            }}
                                                            className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                                        >
                                                            {estimateEditingId ? '견적 수정 저장' : '새 견적 저장'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Estimate List */}
                                                <div className="md:col-span-2 border border-slate-200 rounded-xl overflow-hidden">
                                                    {estimates.length === 0 ? (
                                                        <div className="py-6 text-center text-slate-500 text-xs">
                                                            아직 등록된 견적이 없습니다.
                                                        </div>
                                                    ) : (
                                                        <table className="w-full text-[11px]">
                                                            <thead className="bg-slate-50">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">
                                                                        버전
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-24">
                                                                        상태
                                                                    </th>
                                                                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-32">
                                                                        총액
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">
                                                                        생성일
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">
                                                                        비고
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {estimates.map((estimate) => (
                                                                    <tr
                                                                        key={estimate.id}
                                                                        className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                                                                        onClick={() => handleSelectEstimateForEdit(estimate)}
                                                                    >
                                                                        <td className="px-3 py-2 font-semibold text-slate-800">
                                                                            v{estimate.version}
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                                                                                {getEstimateStatusLabel(
                                                                                    estimate.status
                                                                                )}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                                                                            {estimate.total.toLocaleString()} 원
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-500">
                                                                            {estimate.createdAt
                                                                                ? formatDate(estimate.createdAt)
                                                                                : '-'}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-500 truncate max-w-[260px]">
                                                                            {estimate.notes &&
                                                                            estimate.notes.trim().length > 0
                                                                                ? estimate.notes
                                                                                : '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'activities' && (
                                        <div className="space-y-3 text-xs">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                                                    <FontAwesomeIcon
                                                        icon={faClockRotateLeft}
                                                        className="text-slate-500 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">활동 이력</div>
                                                    <div className="text-[11px] text-slate-500">
                                                        상태 변경, 견적 작성, 체크리스트 변경 등 주요 이력을 시간 순으로 확인합니다.
                                                    </div>
                                                </div>
                                            </div>

                                            {activities.length === 0 ? (
                                                <div className="py-6 text-center text-slate-500 text-xs">
                                                    아직 기록된 활동 이력이 없습니다.
                                                </div>
                                            ) : (
                                                <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                                    {activities.map((activity) => (
                                                        <li
                                                            key={activity.id}
                                                            className="flex items-start gap-3 text-[11px]"
                                                        >
                                                            <div className="mt-1">
                                                                <FontAwesomeIcon
                                                                    icon={
                                                                        activity.type === 'status_change'
                                                                            ? faCircleCheck
                                                                            : activity.type === 'estimate'
                                                                            ? faFileInvoiceDollar
                                                                            : activity.type === 'checklist'
                                                                            ? faListCheck
                                                                            : faCircle
                                                                    }
                                                                    className="text-indigo-500"
                                                                />
                                                            </div>
                                                            <div className="flex-1 border-b border-dashed border-slate-100 pb-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-slate-800">
                                                                        <span className="font-semibold">
                                                                            {activity.createdByName || '시스템'}
                                                                        </span>
                                                                        <span className="mx-1 text-slate-400">·</span>
                                                                        <span>{activity.message}</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                                        {formatDateTime(activity.createdAt)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomepageRequestDetailPage;
