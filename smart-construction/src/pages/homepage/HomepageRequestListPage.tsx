import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faFilter, faListUl } from '@fortawesome/free-solid-svg-icons';
import {
    HomepageRequest,
    HomepageRequestPriority,
    HomepageRequestStatus,
    HomepageRequestType,
    homepageRequestService
} from '../../services/homepageRequestService';

const formatDate = (timestamp?: Timestamp): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
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

const HomepageRequestListPage: React.FC = () => {
    const navigate = useNavigate();

    const [requests, setRequests] = useState<HomepageRequest[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<HomepageRequestStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<HomepageRequestType | 'all'>('all');

    const loadRequests = async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const options: {
                status?: HomepageRequestStatus;
                type?: HomepageRequestType;
            } = {};

            if (statusFilter !== 'all') {
                options.status = statusFilter;
            }
            if (typeFilter !== 'all') {
                options.type = typeFilter;
            }

            const data = await homepageRequestService.listRequests(options);
            setRequests(data);
        } catch (e) {
            setError('요청 목록을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadRequests();
    }, [statusFilter, typeFilter]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faListUl} className="text-indigo-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">홈페이지 요청 관리</h1>
                        <p className="text-sm text-slate-500">
                            의뢰된 홈페이지 제작/수정 요청을 상태별로 확인하고 상세 화면으로 이동합니다.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/homepage/requests/new')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                    새 요청
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
                    {/* Filters */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <FontAwesomeIcon icon={faFilter} className="text-slate-400" />
                            <span>필터</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">상태</span>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as HomepageRequestStatus | 'all')}
                                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                                >
                                    <option value="all">전체</option>
                                    <option value="requested">요청</option>
                                    <option value="accepted">접수</option>
                                    <option value="in_progress">진행 중</option>
                                    <option value="review">검토</option>
                                    <option value="completed">완료</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">유형</span>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value as HomepageRequestType | 'all')}
                                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                                >
                                    <option value="all">전체</option>
                                    <option value="build">제작 의뢰</option>
                                    <option value="modify">수정 의뢰</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        {loading && (
                            <div className="py-8 text-center text-sm text-slate-500">로딩 중...</div>
                        )}
                        {!loading && error && (
                            <div className="py-8 text-center text-sm text-rose-600">{error}</div>
                        )}
                        {!loading && !error && requests.length === 0 && (
                            <div className="py-8 text-center text-sm text-slate-500">
                                조건에 맞는 요청이 없습니다.
                            </div>
                        )}
                        {!loading && !error && requests.length > 0 && (
                            <div className="divide-y divide-slate-100">
                                {requests.map((req) => (
                                    <button
                                        key={req.id}
                                        type="button"
                                        onClick={() => {
                                            if (!req.id) return;
                                            navigate(`/homepage/requests/${req.id}`);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start justify-between gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900 truncate max-w-[280px]">
                                                    {req.title}
                                                </span>
                                                <span
                                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                                                >
                                                    {getTypeLabel(req.type)}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${getPriorityClass(
                                                        req.priority
                                                    )}`}
                                                >
                                                    {getPriorityLabel(req.priority)}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-2">
                                                {req.clientCompany && <span className="font-semibold">{req.clientCompany}</span>}
                                                <span>{req.clientName}</span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-slate-400 flex flex-wrap gap-3">
                                                {req.createdAt && (
                                                    <span>
                                                        요청일: <span className="font-medium text-slate-500">{formatDate(req.createdAt)}</span>
                                                    </span>
                                                )}
                                                {req.dueDate && (
                                                    <span>
                                                        목표 완료일: <span className="font-medium text-slate-500">{formatDate(req.dueDate)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusClass(
                                                    req.status
                                                )}`}
                                            >
                                                {getStatusLabel(req.status)}
                                            </span>
                                            <FontAwesomeIcon icon={faChevronRight} className="text-slate-300 text-xs" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomepageRequestListPage;
