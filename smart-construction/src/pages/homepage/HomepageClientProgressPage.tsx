import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCircleCheck,
    faCircle,
    faFileInvoiceDollar,
    faListCheck,
    faClockRotateLeft,
    faCircleNotch
} from '@fortawesome/free-solid-svg-icons';
import {
    HomepageRequest,
    HomepageRequestStatus,
    homepageRequestService
} from '../../services/homepageRequestService';
import { ChecklistProgress, homepageChecklistService } from '../../services/homepageChecklistService';
import { HomepageActivity, homepageActivityService } from '../../services/homepageActivityService';
import { HomepageEstimate, homepageEstimateService } from '../../services/homepageEstimateService';

interface StatusStep {
    key: HomepageRequestStatus;
    label: string;
    description: string;
}

const STATUS_STEPS: StatusStep[] = [
    {
        key: 'requested',
        label: '요청',
        description: '의뢰가 접수된 상태입니다.'
    },
    {
        key: 'accepted',
        label: '접수',
        description: '담당자가 의뢰를 검토하고 접수했습니다.'
    },
    {
        key: 'in_progress',
        label: '진행 중',
        description: '디자인/개발 작업이 진행 중입니다.'
    },
    {
        key: 'review',
        label: '검토',
        description: '완료된 결과물을 검토/수정 중입니다.'
    },
    {
        key: 'completed',
        label: '완료',
        description: '홈페이지 제작이 최종 완료되었습니다.'
    }
];

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

const formatDate = (timestamp?: Timestamp): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
};

const getEstimateStatusLabel = (status: HomepageEstimate['status']): string => {
    if (status === 'approved') return '승인됨';
    if (status === 'sent') return '발송됨';
    if (status === 'rejected') return '반려됨';
    return '임시저장';
};

const HomepageClientProgressPage: React.FC = () => {

    const { requestId } = useParams();

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [request, setRequest] = useState<HomepageRequest | null>(null);
    const [progress, setProgress] = useState<ChecklistProgress | null>(null);
    const [activities, setActivities] = useState<HomepageActivity[]>([]);
    const [latestEstimate, setLatestEstimate] = useState<HomepageEstimate | null>(null);

    const currentStepIndex = useMemo(() => {
        if (!request) return 0;
        const index = STATUS_STEPS.findIndex((step) => step.key === request.status);
        return index === -1 ? 0 : index;
    }, [request]);

    const loadAll = async (id: string): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const [req, prog, acts, estimates] = await Promise.all([
                homepageRequestService.getRequest(id),
                homepageChecklistService.getProgress(id),
                homepageActivityService.getActivities(id),
                homepageEstimateService.listEstimatesByRequest(id)
            ]);

            if (!req) {
                setRequest(null);
                setProgress(null);
                setActivities([]);
                setLatestEstimate(null);
                setError('요청 정보를 찾을 수 없습니다. 담당자에게 문의해 주세요.');
                return;
            }

            setRequest(req);
            setProgress(prog);
            setActivities(acts);
            setLatestEstimate(estimates.length > 0 ? estimates[0] : null);
        } catch (e) {
            setError('요청 정보를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!requestId) return;
        void loadAll(requestId);
    }, [requestId]);

    const percentage = progress?.percentage ?? 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 px-6 py-5 text-white shadow-sm">
                <div className="max-w-6xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-xl">
                            <FontAwesomeIcon icon={faCircleCheck} className="text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">홈페이지 진행 현황</h1>
                            <p className="text-sm text-indigo-100">
                                현재 의뢰가 어디까지 진행되었는지 한눈에 확인할 수 있는 화면입니다.
                            </p>
                        </div>
                    </div>
                    <div className="text-xs md:text-sm text-indigo-100 flex flex-col items-start md:items-end gap-1">
                        <div>
                            요청 번호: <span className="font-semibold text-white">{requestId}</span>
                        </div>
                        {request?.createdAt && (
                            <div>
                                요청일: <span className="font-semibold text-white">{formatDate(request.createdAt)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                    {loading && (
                        <div className="flex items-center justify-center py-10 text-slate-500 text-sm gap-2">
                            <FontAwesomeIcon icon={faCircleNotch} spin />
                            <span>데이터를 불러오는 중입니다...</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <div className="flex-1">
                                <p className="font-semibold mb-1">진행 현황을 불러오지 못했습니다.</p>
                                <p>{error}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!requestId) return;
                                    void loadAll(requestId);
                                }}
                                className="ml-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                            >
                                다시 시도
                            </button>
                        </div>
                    )}

                    {!loading && !error && !request && (
                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-6 text-center text-sm text-slate-500">
                            해당 요청을 찾을 수 없습니다. URL이 정확한지 확인해 주세요.
                        </div>
                    )}

                    {request && (
                        <>
                            {/* Top: Title & Summary */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {request.type === 'build' ? '홈페이지 제작 의뢰' : '홈페이지 수정 의뢰'}
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 break-words">{request.title}</h2>
                                    <p className="text-sm text-slate-500">
                                        {request.clientCompany && <span className="font-semibold mr-1">{request.clientCompany}</span>}
                                        <span>{request.clientName} 님의 의뢰입니다.</span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-start md:items-end gap-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">우선순위</span>
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                                request.priority === 'high'
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                    : request.priority === 'medium'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                            }`}
                                        >
                                            {request.priority === 'high'
                                                ? '높음'
                                                : request.priority === 'medium'
                                                ? '보통'
                                                : '낮음'}
                                        </span>
                                    </div>
                                    {request.dueDate && (
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <span>목표 완료일</span>
                                            <span className="font-semibold text-slate-800">{formatDate(request.dueDate)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stepper */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h3 className="text-sm font-bold text-slate-800 mb-4">진행 단계</h3>
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                {STATUS_STEPS.map((step, index) => {
                                                    const isActive = index === currentStepIndex;
                                                    const isCompleted = index < currentStepIndex;
                                                    return (
                                                        <div key={step.key} className="flex-1 flex flex-col items-center">
                                                            <div className="relative flex items-center w-full">
                                                                {index > 0 && (
                                                                    <div
                                                                        className={`flex-1 h-1 rounded-full ${
                                                                            isCompleted || isActive
                                                                                ? 'bg-indigo-500'
                                                                                : 'bg-slate-200'
                                                                        }`}
                                                                    />
                                                                )}
                                                                <div className="relative flex items-center justify-center">
                                                                    <div
                                                                        className={`flex items-center justify-center rounded-full border-2 w-8 h-8 text-xs font-bold ${
                                                                            isCompleted
                                                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                                                : isActive
                                                                                ? 'bg-white border-indigo-500 text-indigo-600'
                                                                                : 'bg-white border-slate-300 text-slate-400'
                                                                        }`}
                                                                    >
                                                                        {isCompleted ? (
                                                                            <FontAwesomeIcon icon={faCircleCheck} />
                                                                        ) : (
                                                                            index + 1
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {index < STATUS_STEPS.length - 1 && (
                                                                    <div
                                                                        className={`flex-1 h-1 rounded-full ${
                                                                            index < currentStepIndex
                                                                                ? 'bg-indigo-500'
                                                                                : 'bg-slate-200'
                                                                        }`}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="mt-2 text-[11px] font-semibold text-slate-700">
                                                                {step.label}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="w-full md:w-56 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                                            <div className="font-semibold text-slate-800 mb-1">
                                                현재 단계: {STATUS_STEPS[currentStepIndex]?.label ?? ''}
                                            </div>
                                            <div>{STATUS_STEPS[currentStepIndex]?.description}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle: Progress + Estimate */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Progress */}
                                <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                <FontAwesomeIcon icon={faListCheck} className="text-indigo-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800">작업 진행률</h3>
                                                <p className="text-xs text-slate-500">
                                                    체크리스트 완료 기준으로 현재 진행 상황을 계산합니다.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
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
                                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-indigo-700 transition-all duration-500"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        세부 작업별 체크리스트는 담당자가 관리합니다. 완료된 항목이 늘어날수록 진행률이 올라갑니다.
                                    </p>
                                </div>

                                {/* Estimate Summary */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800">견적 요약</h3>
                                                <p className="text-xs text-slate-500">가장 최신 버전의 견적 정보를 표시합니다.</p>
                                            </div>
                                        </div>
                                    </div>
                                    {!latestEstimate ? (
                                        <div className="text-xs text-slate-500 mt-1">
                                            아직 등록된 견적이 없습니다. 담당자가 견적을 작성하면 이곳에 표시됩니다.
                                        </div>
                                    ) : (
                                        <div className="space-y-2 text-xs text-slate-600">
                                            <div className="flex items-center justify-between">
                                                <span>버전</span>
                                                <span className="font-semibold text-slate-900">v{latestEstimate.version}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>상태</span>
                                                <span className="font-semibold">
                                                    {getEstimateStatusLabel(latestEstimate.status)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>총액 (VAT 포함)</span>
                                                <span className="text-base font-extrabold text-emerald-600">
                                                    {latestEstimate.total.toLocaleString()} 원
                                                </span>
                                            </div>
                                            {latestEstimate.notes && (
                                                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                                    <div className="font-semibold text-slate-700 mb-1">비고</div>
                                                    <p className="whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                                                        {latestEstimate.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom: Timeline */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faClockRotateLeft} className="text-slate-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">진행 이력</h3>
                                            <p className="text-xs text-slate-500">
                                                상태 변경, 견적 작성, 체크리스트 완료 등 주요 이력을 시간순으로 보여줍니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {activities.length === 0 ? (
                                    <div className="text-xs text-slate-500 py-4 text-center">
                                        아직 기록된 활동 이력이 없습니다. 의뢰가 진행되면 이력이 자동으로 쌓입니다.
                                    </div>
                                ) : (
                                    <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                        {activities.map((activity) => (
                                            <li key={activity.id} className="flex items-start gap-3 text-xs">
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
                                                        className="text-[11px] text-indigo-500"
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
                                                        <div className="text-[11px] text-slate-400 whitespace-nowrap ml-2">
                                                            {formatDateTime(activity.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomepageClientProgressPage;
