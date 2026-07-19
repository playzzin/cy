import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bell,
  BellOff,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  confirmBankTransactionCandidate,
  ignoreBankTransactionCandidate,
  reprocessBankSmsCandidate,
  saveBankNotificationSettings,
  setNotificationDeviceEnabled,
} from './bankNotificationService';
import {
  filterBankCandidates,
  formatBankCurrency,
  formatBankDateTime,
  summarizeBankCandidates,
} from './bankNotificationUtils';
import {
  useBankNotificationAccess,
  useBankNotificationHealth,
  useBankNotificationRecipients,
  useBankNotificationSettings,
  useBankTransactionCandidates,
  useNotificationDevices,
} from './useBankNotifications';
import { useBankPushNotifications } from './useBankPushNotifications';
import {
  DEFAULT_BANK_CANDIDATE_FILTERS,
  type BankNotificationActor,
  type BankNotificationSettings,
  type BankTransactionCandidate,
  type BankTransactionDirection,
  type BankTransactionStatus,
} from './types';

const STATUS_LABELS: Record<BankTransactionStatus, string> = {
  pending: '확인 대기',
  confirmed: '확인 완료',
  ignored: '제외',
  parse_failed: '문자 분석 실패',
};

const STATUS_CLASS_NAMES: Record<BankTransactionStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ignored: 'border-slate-200 bg-slate-100 text-slate-600',
  parse_failed: 'border-rose-200 bg-rose-50 text-rose-800',
};

const DIRECTION_LABELS: Record<BankTransactionDirection, string> = {
  deposit: '입금',
  withdrawal: '출금',
  unknown: '구분 필요',
};

const DIRECTION_CLASS_NAMES: Record<BankTransactionDirection, string> = {
  deposit: 'text-blue-700',
  withdrawal: 'text-rose-700',
  unknown: 'text-slate-600',
};

const panelClassName = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const inputClassName = 'min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100';
const labelClassName = 'mb-1.5 block text-xs font-semibold text-slate-600';

const StatusBadge = ({ status }: { status: BankTransactionStatus }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS_NAMES[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

const SummaryCard = ({
  label,
  value,
  helper,
  tone,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'blue' | 'rose' | 'amber' | 'slate';
  icon: React.ReactNode;
}) => {
  const toneClassNames = {
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <article className={`${panelClassName} flex min-w-0 items-start gap-3 p-4`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClassNames[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-bold text-slate-900" title={value}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </div>
    </article>
  );
};

const CandidateListItem = ({
  candidate,
  selected,
  onSelect,
}: {
  candidate: BankTransactionCandidate;
  selected: boolean;
  onSelect: () => void;
}) => {
  const DirectionIcon = candidate.direction === 'deposit'
    ? ArrowDownLeft
    : candidate.direction === 'withdrawal'
      ? ArrowUpRight
      : TriangleAlert;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
        selected ? 'bg-blue-50/80' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <span className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          candidate.direction === 'deposit'
            ? 'bg-blue-100 text-blue-700'
            : candidate.direction === 'withdrawal'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-amber-100 text-amber-700'
        }`} aria-hidden="true">
          <DirectionIcon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className={`font-bold ${DIRECTION_CLASS_NAMES[candidate.direction]}`}>
              {DIRECTION_LABELS[candidate.direction]} {formatBankCurrency(candidate.amount)}
            </span>
            <StatusBadge status={candidate.status} />
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>{candidate.bankName}</span>
            <span aria-hidden="true">·</span>
            <span>{candidate.accountMasked}</span>
            <span aria-hidden="true">·</span>
            <time>{formatBankDateTime(candidate.transactionAt || candidate.receivedAt || candidate.createdAt)}</time>
          </span>
          {(candidate.memo || candidate.counterpartyMasked) && (
            <span className="mt-2 block truncate text-sm text-slate-600">
              {candidate.memo || candidate.counterpartyMasked}
            </span>
          )}
        </span>
      </span>
    </button>
  );
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-3 last:border-b-0">
    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-slate-800">{value || '-'}</dd>
  </div>
);

const formatActionError = (error: unknown): string => {
  const errorWithCode = error as { code?: string; message?: string };
  if (errorWithCode.message === 'candidate-already-reviewed') return '다른 사용자가 이미 이 거래를 처리했습니다.';
  if (errorWithCode.message === 'candidate-not-found') return '거래 후보를 찾을 수 없습니다.';
  if (errorWithCode.code === 'permission-denied') return '이 거래를 처리할 권한이 없습니다.';
  if (errorWithCode.code?.includes('failed-precondition')) return '암호화 원문이 보관되지 않았거나 보관 기간이 지나 다시 분석할 수 없습니다.';
  if (errorWithCode.code?.includes('permission-denied')) return '관리자만 문자 재분석을 실행할 수 있습니다.';
  return error instanceof Error ? error.message : '작업을 완료하지 못했습니다.';
};

const BankNotificationsPage = () => {
  const { currentUser } = useAuth();
  const access = useBankNotificationAccess();
  const canLoad = !access.loading && access.permissions.canView;
  const { candidates, loading: candidatesLoading, error: candidatesError } = useBankTransactionCandidates(canLoad);
  const { health, loading: healthLoading, error: healthError } = useBankNotificationHealth(canLoad);
  const { settings, loading: settingsLoading, error: settingsError } = useBankNotificationSettings(canLoad);
  const { recipients, loading: recipientsLoading, error: recipientsError } = useBankNotificationRecipients(access.permissions.canConfigure);
  const { devices, loading: devicesLoading, error: devicesError } = useNotificationDevices(
    currentUser?.uid,
    access.permissions.canManageOwnDevice,
  );
  const push = useBankPushNotifications(currentUser?.uid, access.permissions.canManageOwnDevice);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(DEFAULT_BANK_CANDIDATE_FILTERS);
  const [selectedId, setSelectedId] = useState(() => searchParams.get('candidate') || '');
  const [reviewingId, setReviewingId] = useState('');
  const [reprocessingId, setReprocessingId] = useState('');
  const [actionMessage, setActionMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<BankNotificationSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [updatingDeviceId, setUpdatingDeviceId] = useState('');

  useEffect(() => {
    setSettingsDraft({
      ...settings,
      recipientIds: [...settings.recipientIds],
      directions: [...settings.directions],
      quietHours: { ...settings.quietHours },
    });
  }, [settings]);

  useEffect(() => {
    const requestedId = searchParams.get('candidate');
    if (requestedId && candidates.some((candidate) => candidate.id === requestedId)) {
      setSelectedId(requestedId);
      return;
    }
    if (selectedId && candidates.some((candidate) => candidate.id === selectedId)) return;
    setSelectedId(candidates[0]?.id || '');
  }, [candidates, searchParams, selectedId]);

  const filteredCandidates = useMemo(
    () => filterBankCandidates(candidates, filters),
    [candidates, filters],
  );
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedId) || null;
  const summary = useMemo(() => summarizeBankCandidates(candidates), [candidates]);
  const filteredRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLocaleLowerCase('ko-KR');
    if (!query) return recipients;
    return recipients.filter((recipient) => (
      `${recipient.displayName} ${recipient.email} ${recipient.role}`.toLocaleLowerCase('ko-KR').includes(query)
    ));
  }, [recipientSearch, recipients]);

  const actor: BankNotificationActor | null = currentUser ? {
    uid: currentUser.uid,
    // Audit identity uses the verified Firebase email (or immutable UID), not
    // a mutable profile display name.
    displayName: currentUser.email || currentUser.uid,
    email: currentUser.email,
  } : null;

  const selectCandidate = (candidateId: string) => {
    setSelectedId(candidateId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('candidate', candidateId);
    setSearchParams(nextParams, { replace: true });
  };

  const reviewCandidate = async (status: 'confirmed' | 'ignored') => {
    if (!selectedCandidate || !actor || !access.permissions.canReview) return;
    if (status === 'ignored' && !window.confirm('이 거래를 알림 목록에서 제외할까요? 기록은 보존됩니다.')) return;

    setReviewingId(selectedCandidate.id);
    setActionMessage(null);
    try {
      if (status === 'confirmed') {
        await confirmBankTransactionCandidate(selectedCandidate.id, actor);
        setActionMessage({ tone: 'success', text: '거래를 확인 완료로 처리했습니다.' });
      } else {
        await ignoreBankTransactionCandidate(selectedCandidate.id, actor);
        setActionMessage({ tone: 'success', text: '거래를 제외 처리했습니다.' });
      }
    } catch (error) {
      setActionMessage({ tone: 'error', text: formatActionError(error) });
    } finally {
      setReviewingId('');
    }
  };

  const reprocessCandidate = async () => {
    if (!selectedCandidate || selectedCandidate.status !== 'parse_failed' || !access.permissions.canConfigure) return;
    setReprocessingId(selectedCandidate.id);
    setActionMessage(null);
    try {
      const result = await reprocessBankSmsCandidate(selectedCandidate.id);
      setActionMessage(result.success
        ? { tone: 'success', text: `문자를 ${result.parserVersion}로 다시 분석해 확인 대기로 복구했습니다.` }
        : { tone: 'error', text: `다시 분석했지만 아직 형식을 인식하지 못했습니다 (${result.errorCode || 'unknown'}).` });
    } catch (error) {
      setActionMessage({ tone: 'error', text: formatActionError(error) });
    } finally {
      setReprocessingId('');
    }
  };

  const toggleRecipient = (uid: string) => {
    setSettingsDraft((current) => ({
      ...current,
      recipientIds: current.recipientIds.includes(uid)
        ? current.recipientIds.filter((recipientId) => recipientId !== uid)
        : [...current.recipientIds, uid],
    }));
  };

  const toggleDirection = (direction: 'deposit' | 'withdrawal') => {
    setSettingsDraft((current) => ({
      ...current,
      directions: current.directions.includes(direction)
        ? current.directions.filter((currentDirection) => currentDirection !== direction)
        : [...current.directions, direction],
    }));
  };

  const handleSaveSettings = async () => {
    if (!actor || !access.permissions.canConfigure) return;
    setActionMessage(null);
    if (settingsDraft.enabled && settingsDraft.recipientIds.length === 0) {
      setActionMessage({ tone: 'error', text: '알림을 받을 사용자를 한 명 이상 선택해 주세요.' });
      return;
    }
    if (settingsDraft.directions.length === 0) {
      setActionMessage({ tone: 'error', text: '입금 또는 출금을 한 가지 이상 선택해 주세요.' });
      return;
    }

    setSavingSettings(true);
    try {
      await saveBankNotificationSettings(settingsDraft, actor);
      setActionMessage({ tone: 'success', text: '은행 알림 설정을 저장했습니다.' });
    } catch (error) {
      setActionMessage({ tone: 'error', text: formatActionError(error) });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeviceToggle = async (deviceId: string, enabled: boolean) => {
    setUpdatingDeviceId(deviceId);
    setActionMessage(null);
    try {
      await setNotificationDeviceEnabled(deviceId, enabled);
      setActionMessage({ tone: 'success', text: enabled ? '이 기기의 알림을 켰습니다.' : '이 기기의 알림을 껐습니다.' });
    } catch (error) {
      setActionMessage({ tone: 'error', text: formatActionError(error) });
    } finally {
      setUpdatingDeviceId('');
    }
  };

  if (access.loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-6 text-slate-600" role="status">
        <Loader2 className="mr-2 animate-spin" size={20} />
        은행 알림 권한을 확인하고 있습니다.
      </div>
    );
  }

  if (!currentUser || !access.permissions.canView) {
    return (
      <main className="mx-auto flex min-h-[520px] max-w-2xl items-center justify-center p-5">
        <section className={`${panelClassName} w-full p-7 text-center`} role="alert" aria-live="polite">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <LockKeyhole size={26} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">은행 알림 접근 권한이 없습니다</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
            은행 입출금 정보는 관리자, 재무, 급여 또는 감사 담당자만 볼 수 있습니다.
            권한 변경이 필요하면 시스템 관리자에게 요청해 주세요.
          </p>
          {access.error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{access.error}</p>}
          {access.roles.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">현재 확인된 역할: {access.roles.join(', ')}</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50/70 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              <ShieldCheck size={15} aria-hidden="true" />
              금융정보 보호 화면
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">은행 입출금 알림</h1>
            <p className="mt-1 text-sm text-slate-600">국민은행 문자에서 감지된 거래를 검토하고 웹·앱 알림을 관리합니다.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${candidatesError ? 'bg-rose-500' : 'bg-emerald-500'}`} aria-hidden="true" />
            {candidatesError ? '데이터 연결 확인 필요' : '실시간 연결 중'}
          </div>
        </header>

        {(actionMessage || candidatesError || settingsError) && (
          <div
            role="alert"
            className={`rounded-xl border px-4 py-3 text-sm ${
              actionMessage?.tone === 'success' && !candidatesError && !settingsError
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {candidatesError || settingsError || actionMessage?.text}
          </div>
        )}

        {push.lastMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">
            <Bell className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <span>
              <strong>{push.lastMessage.notification?.title || '새 은행 알림'}</strong>
              <span className="mt-0.5 block text-blue-700">{push.lastMessage.notification?.body || '새 거래를 확인해 주세요.'}</span>
            </span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="은행 거래 요약">
          <SummaryCard
            label="오늘 입금"
            value={formatBankCurrency(summary.todayDepositTotal)}
            helper="제외·분석 실패 건 제외"
            tone="blue"
            icon={<ArrowDownLeft size={20} />}
          />
          <SummaryCard
            label="오늘 출금"
            value={formatBankCurrency(summary.todayWithdrawalTotal)}
            helper="제외·분석 실패 건 제외"
            tone="rose"
            icon={<ArrowUpRight size={20} />}
          />
          <SummaryCard
            label="확인 대기"
            value={`${summary.pendingCount.toLocaleString('ko-KR')}건`}
            helper="담당자 검토 필요"
            tone="amber"
            icon={<Clock3 size={20} />}
          />
          <SummaryCard
            label="문자 분석 실패"
            value={`${summary.parseFailedCount.toLocaleString('ko-KR')}건`}
            helper="문자 형식 확인 필요"
            tone="slate"
            icon={<TriangleAlert size={20} />}
          />
        </section>

        <section className={`${panelClassName} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`} aria-labelledby="bridge-health-title">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              health.state === 'healthy'
                ? 'bg-emerald-50 text-emerald-700'
                : health.state === 'unconfigured'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-amber-50 text-amber-700'
            }`} aria-hidden="true">
              {health.state === 'healthy' ? <Wifi size={20} /> : <WifiOff size={20} />}
            </span>
            <div>
              <h2 id="bridge-health-title" className="text-sm font-bold text-slate-900">문자 연결 상태</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {healthLoading
                  ? '연결 상태를 확인하는 중입니다.'
                  : health.state === 'healthy'
                    ? '문자 수신 장치가 정상적으로 연결되어 있습니다.'
                    : health.state === 'stale'
                      ? '최근 문자 수신이 없어 장치 상태를 확인해야 합니다.'
                      : health.state === 'error'
                        ? '문자 전달 중 오류가 감지되었습니다.'
                        : '문자 수신 장치가 아직 등록되지 않았습니다.'}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-slate-400">최근 수신</dt>
              <dd className="mt-0.5 font-semibold text-slate-700">{formatBankDateTime(health.lastEventAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">수신 장치</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-700">{health.lastDeviceIdMasked}</dd>
            </div>
            {(health.lastErrorCode || healthError) && (
              <div>
                <dt className="text-slate-400">오류 코드</dt>
                <dd className="mt-0.5 max-w-40 truncate font-semibold text-rose-700" title={health.lastErrorCode || healthError}>
                  {health.lastErrorCode || 'health-read-failed'}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className={`${panelClassName} p-4`} aria-labelledby="bank-filter-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="bank-filter-title" className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Filter size={16} aria-hidden="true" />
              거래 검색
            </h2>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_BANK_CANDIDATE_FILTERS)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <RefreshCcw size={14} aria-hidden="true" />
              초기화
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-2">
              <span className={labelClassName}>검색어</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
                <input
                  className={`${inputClassName} pl-9`}
                  value={filters.query}
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="적요, 은행, 마스킹 계좌"
                />
              </span>
            </label>
            <label>
              <span className={labelClassName}>처리 상태</span>
              <select
                className={inputClassName}
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as BankTransactionStatus | 'all' }))}
              >
                <option value="all">전체 상태</option>
                <option value="pending">확인 대기</option>
                <option value="confirmed">확인 완료</option>
                <option value="ignored">제외</option>
                <option value="parse_failed">문자 분석 실패</option>
              </select>
            </label>
            <label>
              <span className={labelClassName}>입출금</span>
              <select
                className={inputClassName}
                value={filters.direction}
                onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value as BankTransactionDirection | 'all' }))}
              >
                <option value="all">입출금 전체</option>
                <option value="deposit">입금</option>
                <option value="withdrawal">출금</option>
                <option value="unknown">구분 필요</option>
              </select>
            </label>
            <label>
              <span className={labelClassName}>시작일</span>
              <input
                type="date"
                className={inputClassName}
                value={filters.startDate}
                onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label>
              <span className={labelClassName}>종료일</span>
              <input
                type="date"
                className={inputClassName}
                value={filters.endDate}
                onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
          </div>
          <label className="mt-3 block max-w-xs">
            <span className={labelClassName}>최소 금액</span>
            <input
              type="number"
              min="0"
              step="10000"
              inputMode="numeric"
              className={inputClassName}
              value={filters.minimumAmount ?? ''}
              onChange={(event) => setFilters((current) => ({
                ...current,
                minimumAmount: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0),
              }))}
              placeholder="제한 없음"
            />
          </label>
        </section>

        <section className="grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]" aria-label="거래 후보 검토">
          <div className={`${panelClassName} min-w-0 overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-900">거래 후보</h2>
              <span className="text-xs text-slate-500">{filteredCandidates.length.toLocaleString('ko-KR')}건</span>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
              {candidatesLoading ? (
                <div className="flex min-h-52 items-center justify-center text-sm text-slate-500" role="status">
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  거래를 불러오는 중입니다.
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center text-sm text-slate-500">
                  <Banknote className="mb-3 text-slate-300" size={34} aria-hidden="true" />
                  조건에 맞는 거래가 없습니다.
                </div>
              ) : filteredCandidates.map((candidate) => (
                <CandidateListItem
                  key={candidate.id}
                  candidate={candidate}
                  selected={selectedId === candidate.id}
                  onSelect={() => selectCandidate(candidate.id)}
                />
              ))}
            </div>
          </div>

          <aside className={`${panelClassName} min-w-0 self-start overflow-hidden xl:sticky xl:top-4`} aria-label="거래 상세">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">거래 상세</h2>
              <p className="mt-0.5 text-xs text-slate-500">원문에 포함된 계좌와 발신정보는 마스킹되어 표시됩니다.</p>
            </div>
            {!selectedCandidate ? (
              <div className="flex min-h-72 items-center justify-center px-5 text-center text-sm text-slate-500">
                왼쪽 목록에서 확인할 거래를 선택해 주세요.
              </div>
            ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className={`text-sm font-bold ${DIRECTION_CLASS_NAMES[selectedCandidate.direction]}`}>
                      {DIRECTION_LABELS[selectedCandidate.direction]}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{formatBankCurrency(selectedCandidate.amount)}</p>
                  </div>
                  <StatusBadge status={selectedCandidate.status} />
                </div>

                {selectedCandidate.status === 'parse_failed' && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
                    <strong className="block">문자를 자동으로 해석하지 못했습니다.</strong>
                    <span className="mt-1 block break-words text-xs">{selectedCandidate.parseError || '분석 오류 사유가 기록되지 않았습니다.'}</span>
                  </div>
                )}

                <dl className="mt-2">
                  <DetailRow label="거래 시각" value={formatBankDateTime(selectedCandidate.transactionAt || selectedCandidate.receivedAt || selectedCandidate.createdAt)} />
                  <DetailRow label="은행" value={selectedCandidate.bankName} />
                  <DetailRow label="계좌" value={<span className="font-mono">{selectedCandidate.accountMasked}</span>} />
                  <DetailRow label="문자 발신" value={selectedCandidate.sourceMasked} />
                  <DetailRow label="거래 상대" value={selectedCandidate.counterpartyMasked} />
                  <DetailRow label="적요" value={selectedCandidate.memo} />
                  {selectedCandidate.balance !== null && (
                    <DetailRow label="거래 후 잔액" value={formatBankCurrency(selectedCandidate.balance)} />
                  )}
                  {selectedCandidate.messagePreview && (
                    <DetailRow label="문자 미리보기" value={<span className="whitespace-pre-wrap text-xs leading-5 text-slate-600">{selectedCandidate.messagePreview}</span>} />
                  )}
                  {selectedCandidate.reviewedById && (
                    <DetailRow
                      label="처리 정보"
                      value={`${selectedCandidate.reviewedByName || selectedCandidate.reviewedById} · ${formatBankDateTime(selectedCandidate.reviewedAt)}`}
                    />
                  )}
                </dl>

                {(selectedCandidate.status === 'pending' || selectedCandidate.status === 'parse_failed') && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    {access.permissions.canReview ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {selectedCandidate.status === 'parse_failed' && access.permissions.canConfigure && (
                          <button
                            type="button"
                            onClick={() => void reprocessCandidate()}
                            disabled={reprocessingId === selectedCandidate.id}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-800 transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                          >
                            <RefreshCcw className={reprocessingId === selectedCandidate.id ? 'animate-spin' : ''} size={17} />
                            암호화 원문 다시 분석
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void reviewCandidate('confirmed')}
                          disabled={reviewingId === selectedCandidate.id || selectedCandidate.status !== 'pending'}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {reviewingId === selectedCandidate.id ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                          확인 완료
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewCandidate('ignored')}
                          disabled={reviewingId === selectedCandidate.id}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <XCircle size={17} />
                          제외
                        </button>
                      </div>
                    ) : (
                      <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
                        이 계정은 조회만 가능하며 거래를 처리할 수 없습니다.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        </section>

        <section className={`${panelClassName} p-5`} aria-labelledby="push-settings-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="push-settings-title" className="flex items-center gap-2 font-bold text-slate-900">
                <Smartphone size={18} aria-hidden="true" />
                내 기기 푸시 알림
              </h2>
              <p className="mt-1 text-sm text-slate-500">앱이나 브라우저가 닫혀 있어도 이 기기에서 알림을 받습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void push.enablePush()}
                disabled={push.busy || push.supported === false || push.permission === 'denied'}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {push.busy ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} />}
                이 기기 알림 켜기
              </button>
              <button
                type="button"
                onClick={() => void push.disablePush()}
                disabled={push.busy || push.supported === false}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BellOff size={16} />
                이 기기 알림 끄기
              </button>
            </div>
          </div>

          {push.permission === 'denied' && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              <strong>브라우저에서 알림이 차단되어 있습니다.</strong>
              <span className="mt-1 block text-xs leading-5">주소창 옆 사이트 설정에서 알림을 ‘허용’으로 변경한 뒤 새로고침해 주세요.</span>
            </div>
          )}
          {push.supported === false && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
              이 브라우저는 웹 푸시 알림을 지원하지 않습니다. 최신 Chrome, Edge 또는 설치형 앱을 사용해 주세요.
            </div>
          )}
          {push.error && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              <span>{push.error}</span>
              <button type="button" onClick={push.clearError} className="shrink-0 font-bold" aria-label="오류 메시지 닫기">×</button>
            </div>
          )}
          {devicesError && <p className="mt-4 text-sm text-rose-700" role="alert">{devicesError}</p>}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {devicesLoading ? (
              <p className="col-span-full flex items-center py-4 text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={16} />기기 목록을 불러오는 중입니다.</p>
            ) : devices.length === 0 ? (
              <p className="col-span-full rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">등록된 알림 기기가 없습니다.</p>
            ) : devices.map((device) => (
              <article key={device.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{device.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      최근 확인 {formatBankDateTime(device.lastSeenAt || device.updatedAt || device.createdAt)}
                    </p>
                    {push.currentDeviceId === device.id && <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">현재 기기</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeviceToggle(device.id, !device.enabled)}
                    disabled={updatingDeviceId === device.id}
                    aria-pressed={device.enabled}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 ${device.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                    aria-label={`${device.label} 알림 ${device.enabled ? '끄기' : '켜기'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${device.enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {access.permissions.canConfigure && (
          <details className={`${panelClassName} overflow-hidden`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
              <span>
                <span className="flex items-center gap-2 font-bold text-slate-900"><Settings size={18} aria-hidden="true" />전체 알림 운영 설정</span>
                <span className="mt-1 block text-sm text-slate-500">수신자, 최소 금액, 입출금 종류와 방해금지 시간을 관리합니다.</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-blue-700">관리자 전용</span>
            </summary>
            <div className="border-t border-slate-200 p-5">
              {settingsLoading ? (
                <p className="flex items-center py-6 text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={16} />설정을 불러오는 중입니다.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="space-y-5">
                    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                      <span>
                        <strong className="block text-sm text-slate-900">은행 알림 사용</strong>
                        <small className="mt-1 block text-xs leading-5 text-slate-500">끄면 문자 수집 기록은 남지만 사용자 푸시는 발송하지 않습니다.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={settingsDraft.enabled}
                        onChange={(event) => setSettingsDraft((current) => ({ ...current, enabled: event.target.checked }))}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    <label>
                      <span className={labelClassName}>알림 최소 금액</span>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        inputMode="numeric"
                        className={inputClassName}
                        value={settingsDraft.minimumAmount}
                        onChange={(event) => setSettingsDraft((current) => ({
                          ...current,
                          minimumAmount: Math.max(0, Number(event.target.value) || 0),
                        }))}
                      />
                      <span className="mt-1.5 block text-xs text-slate-500">현재 기준: {formatBankCurrency(settingsDraft.minimumAmount)} 이상</span>
                    </label>

                    <fieldset>
                      <legend className={labelClassName}>알림 종류</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {(['deposit', 'withdrawal'] as const).map((direction) => (
                          <label key={direction} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                            settingsDraft.directions.includes(direction)
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}>
                            <input
                              type="checkbox"
                              checked={settingsDraft.directions.includes(direction)}
                              onChange={() => toggleDirection(direction)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            {DIRECTION_LABELS[direction]}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={settingsDraft.notifyOnParseFailure}
                        onChange={(event) => setSettingsDraft((current) => ({ ...current, notifyOnParseFailure: event.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <strong className="block text-sm text-slate-800">문자 분석 실패 알림</strong>
                        <small className="mt-0.5 block text-xs text-slate-500">은행 문자 형식이 바뀌었을 때 즉시 알려줍니다.</small>
                      </span>
                    </label>

                    <fieldset className="rounded-xl border border-slate-200 p-4">
                      <legend className="px-1 text-sm font-bold text-slate-800">방해금지 시간</legend>
                      <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={settingsDraft.quietHours.enabled}
                          onChange={(event) => setSettingsDraft((current) => ({
                            ...current,
                            quietHours: { ...current.quietHours, enabled: event.target.checked },
                          }))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        지정 시간에는 기기 푸시를 보내지 않고 알림센터에만 기록합니다.
                      </label>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label>
                          <span className={labelClassName}>시작</span>
                          <input
                            type="time"
                            className={inputClassName}
                            value={settingsDraft.quietHours.start}
                            disabled={!settingsDraft.quietHours.enabled}
                            onChange={(event) => setSettingsDraft((current) => ({
                              ...current,
                              quietHours: { ...current.quietHours, start: event.target.value },
                            }))}
                          />
                        </label>
                        <label>
                          <span className={labelClassName}>종료</span>
                          <input
                            type="time"
                            className={inputClassName}
                            value={settingsDraft.quietHours.end}
                            disabled={!settingsDraft.quietHours.enabled}
                            onChange={(event) => setSettingsDraft((current) => ({
                              ...current,
                              quietHours: { ...current.quietHours, end: event.target.value },
                            }))}
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">대한민국 표준시(Asia/Seoul) 기준이며, 해당 시간의 푸시는 나중에 다시 보내지 않습니다.</p>
                    </fieldset>
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <label className="min-w-0 flex-1">
                        <span className={labelClassName}>알림 수신자 검색</span>
                        <input
                          className={inputClassName}
                          value={recipientSearch}
                          onChange={(event) => setRecipientSearch(event.target.value)}
                          placeholder="이름, 이메일, 역할"
                        />
                      </label>
                      <span className="pb-2 text-xs font-semibold text-blue-700">{settingsDraft.recipientIds.length}명 선택</span>
                    </div>
                    {recipientsError && <p className="mt-3 text-sm text-rose-700" role="alert">{recipientsError}</p>}
                    <div className="mt-3 max-h-[470px] overflow-y-auto rounded-xl border border-slate-200">
                      {recipientsLoading ? (
                        <p className="flex items-center px-4 py-6 text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={16} />사용자를 불러오는 중입니다.</p>
                      ) : filteredRecipients.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500">검색 결과가 없습니다.</p>
                      ) : filteredRecipients.map((recipient) => {
                        const selected = settingsDraft.recipientIds.includes(recipient.uid);
                        return (
                          <label key={recipient.uid} className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRecipient(recipient.uid)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="min-w-0">
                              <strong className="block truncate text-sm text-slate-800">{recipient.displayName}</strong>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">{[recipient.email, recipient.role].filter(Boolean).join(' · ') || '사용자 정보 없음'}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSaveSettings()}
                  disabled={savingSettings || settingsLoading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingSettings ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                  설정 저장
                </button>
              </div>
            </div>
          </details>
        )}
      </div>
    </main>
  );
};

export default BankNotificationsPage;
