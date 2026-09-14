import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRightFromBracket,
    faBuilding,
    faClock,
    faRotateRight,
    faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
    accountLinkService,
    MyAccountLinkStatusResult,
} from '../../services/accountLinkService';
import type { UserData } from '../../services/userService';
import { ACCOUNT_TYPE_LABELS, AccountType } from '../../types/accountLink';

interface AccountApprovalStatusProps {
    profile: UserData;
    onRefresh: () => void;
    onRetry: () => void;
}

const typeLabel = (value?: AccountType | null): string =>
    value ? ACCOUNT_TYPE_LABELS[value] || value : '계정 연결';

const AccountApprovalStatus: React.FC<AccountApprovalStatusProps> = ({ profile, onRefresh, onRetry }) => {
    const { logout } = useAuth();
    const [status, setStatus] = React.useState<MyAccountLinkStatusResult | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    const load = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setStatus(await accountLinkService.getMyStatus());
        } catch (loadError) {
            console.error('[AccountApprovalStatus] Failed to load request status.', loadError);
            setError('승인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const storedStatus = status?.user.status || profile.status || 'pending';
    const currentStatus = storedStatus === 'active' && !String(profile.position || '').trim()
        ? 'pending'
        : storedStatus;
    const requests = status?.links.filter((link) => link.status !== 'inactive') || [];
    const hasPendingRequest = requests.some((link) => link.status === 'pending');
    const pending = currentStatus === 'pending';
    const rejected = currentStatus === 'rejected';
    const suspended = currentStatus === 'suspended';
    const requestedType = status?.user.requestedAccountType || profile.requestedAccountType || requests[0]?.accountType || null;

    const refreshAll = async () => {
        await load();
        onRefresh();
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <section className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <header className={`px-6 py-8 text-center ${rejected || suspended ? 'bg-rose-50' : 'bg-amber-50'}`}>
                    <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ${rejected || suspended ? 'text-rose-600' : 'text-amber-600'}`}>
                        <FontAwesomeIcon icon={rejected || suspended ? faTriangleExclamation : faClock} />
                    </span>
                    <h1 className="mt-5 text-2xl font-black text-slate-900">
                        {suspended ? '계정 이용이 정지되었습니다' : rejected ? '연결 요청이 반려되었습니다' : '관리자 승인을 기다리고 있습니다'}
                    </h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                        {pending && '승인 전에는 CY 업무 데이터와 메뉴에 접근할 수 없습니다.'}
                        {rejected && '요청 정보를 확인한 뒤 다시 신청하거나 관리자에게 문의해 주세요.'}
                        {suspended && '관리자에게 계정 상태 확인을 요청해 주세요.'}
                    </p>
                </header>

                <div className="space-y-5 p-6">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                                <FontAwesomeIcon icon={faBuilding} />
                            </span>
                            <div>
                                <p className="text-xs font-bold text-slate-400">신청 유형</p>
                                <p className="font-extrabold text-slate-800">{typeLabel(requestedType)}</p>
                            </div>
                        </div>
                        {requests.length > 0 && (
                            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                                {requests.slice(0, 5).map((request) => (
                                    <div key={request.id || `${request.entityType}-${request.entityId}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="truncate font-semibold text-slate-700">{request.entityName}</span>
                                            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${request.status === 'active' ? 'bg-emerald-100 text-emerald-700' : request.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {request.status === 'active' ? '승인됨' : request.status === 'rejected' ? '반려' : '승인 대기'}
                                            </span>
                                        </div>
                                        {request.status === 'rejected' && request.rejectionReason && (
                                            <p className="mt-2 rounded-md bg-rose-50 px-2.5 py-2 text-xs font-semibold leading-5 text-rose-700">
                                                반려 사유: {request.rejectionReason}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {!suspended && (
                            <button
                                type="button"
                                onClick={() => void refreshAll()}
                                disabled={loading}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                                <FontAwesomeIcon icon={faRotateRight} spin={loading} />
                                {loading ? '확인 중' : '승인 상태 새로고침'}
                            </button>
                        )}
                        {(rejected || (pending && !hasPendingRequest)) && (
                            <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-extrabold text-blue-700 hover:bg-blue-100">
                                {rejected ? '연결 정보 다시 신청' : '연결 정보 신청'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void logout()}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-600 hover:bg-slate-50"
                        >
                            <FontAwesomeIcon icon={faArrowRightFromBracket} />
                            로그아웃
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default AccountApprovalStatus;
