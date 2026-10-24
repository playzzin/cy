import SecureExpenseReceipt from '../../components/SecureExpenseReceipt';
import { useUnsavedRequestGuard } from '../../hooks/useUnsavedRequestGuard';
import TeamRequestDraftMaintenance from '../../components/TeamRequestDraftMaintenance';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle2, ClipboardCheck, Clock3, FileText, Loader2, Plus, ReceiptText, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../constants/iconMap';
import { useAuth } from '../../contexts/AuthContext';
import { teamExpenseRequestService, validateRequestReceiptFiles } from '../../services/teamExpenseRequestService';
import type { TeamExpenseRequest, TeamExpenseRequestData } from '../../types/teamExpenseRequest';
import { prepareExpenseReceipt } from '../../utils/expenseReceiptPreparation';
import ExpenseTeamSelect from './ExpenseTeamSelect';
import './TeamExpenseRequestPage.css';

const ExpenseReceiptCamera = lazy(() => import('./ExpenseReceiptCamera'));
const ExpenseReceiptAnalysis = lazy(() => import('./ExpenseReceiptAnalysis'));
const ExpenseReceiptDocument = lazy(() => import('./ExpenseReceiptAnalysis').then(module => ({ default: module.ExpenseReceiptDocument })));

const today = () => new Date().toLocaleDateString('sv-SE');
const createId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
const money = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const labels = { pending: '승인 대기', approved: '승인 · 반영 완료', rejected: '반려' };
const emptyForm = () => ({ teamId: '', chargeToTeamId: '', date: today(), category: '', description: '', amount: '', paymentMethod: '', paymentCardId: '', memo: '' });
const searchKey = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');

const TeamTag = ({ name, color, icon }: { name: string; color?: string; icon?: string }) => {
  const safeColor = /^#[\da-f]{6}$/i.test(color || '') ? color! : '#64748b';
  return <span className="expense-team-tag" style={{ borderColor: safeColor, backgroundColor: `${safeColor}14` }}><span className="expense-team-icon" style={{ backgroundColor: safeColor }}><FontAwesomeIcon icon={resolveIcon(icon || 'fa-users', faUsers)} aria-label={`${name} 팀 아이콘`} /></span>{name}</span>;
};
const RequestTeams = ({ row, teams = [] }: { row: TeamExpenseRequest; teams?: TeamExpenseRequestData['teams'] }) => <div className="expense-team-route"><span>사용팀 <TeamTag name={row.teamName} color={row.teamColor} icon={row.teamIcon || teams.find(team => team.id === row.teamId)?.icon} /></span><span>청구팀 <TeamTag name={row.chargeToTeamName || row.teamName} color={row.chargeToTeamColor || row.teamColor} icon={row.chargeToTeamIcon || teams.find(team => team.id === (row.chargeToTeamId || row.teamId))?.icon} /></span></div>;
type Receipt = { id: string; file: File; preview: string };
const ExpensePortal = ({ children }: { children: React.ReactNode }) => createPortal(<div className="team-expense-request expense-portal-root">{children}</div>, document.body);

const ReceiptToolLoading = ({ onClose }: { onClose: () => void }) => <div className="expense-request-modal" role="dialog" aria-modal="true" aria-label="영수증 도구 준비" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}><div><p role="status" className="expense-request-loading"><Loader2 className="animate-spin" size={18} />영수증 도구를 준비하고 있습니다.</p><button type="button" autoFocus onClick={onClose}>닫기</button></div></div>;
const ExpenseRequestSkeleton = () => <div className="expense-request-skeleton" aria-hidden="true"><div className="expense-skeleton-panel"><span className="expense-skeleton-line short" /><span className="expense-skeleton-line" /><div className="expense-skeleton-fields">{Array.from({ length: 4 }, (_, index) => <span key={index} className="expense-skeleton-field" />)}</div><span className="expense-skeleton-block" /></div><div className="expense-skeleton-panel"><span className="expense-skeleton-line short" /><span className="expense-skeleton-field" />{Array.from({ length: 3 }, (_, index) => <span key={index} className="expense-skeleton-block" />)}</div></div>;

export default function TeamExpenseRequestPage() {
  const { currentUser } = useAuth();
  const [yearMonth, setYearMonth] = useState(() => today().slice(0, 7));
  const [data, setData] = useState<TeamExpenseRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAfterSaveMonth = useRef<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const preparation = useRef(0);
  const preparingLock = useRef(false);
  const uploadedReceipts = useRef({ key: '', ids: new Set<string>() });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const moreLock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [filter, setFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [historyTeamSearch, setHistoryTeamSearch] = useState('');
  const [review, setReview] = useState<{ row: TeamExpenseRequest; decision: 'approved' | 'rejected' } | null>(null);
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(createId);
  const fileInput = useRef<HTMLInputElement>(null);
  const deviceCameraInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [analysisReceipt, setAnalysisReceipt] = useState<Receipt | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saveLock = useRef(false);
  const dragDepth = useRef(0);
  const receiptsRef = useRef(receipts);
  const generation = useRef(0);
  const activeUid = useRef(currentUser?.uid);
  activeUid.current = currentUser?.uid;
  receiptsRef.current = receipts;

  useUnsavedRequestGuard(preparing || receipts.length > 0 || Boolean(form.description || form.amount || form.memo));
  useEffect(() => {
    preparation.current++; preparingLock.current = false; setPreparing(false);
    refreshAfterSaveMonth.current = null;
    uploadedReceipts.current = { key: '', ids: new Set() };
    receiptsRef.current.forEach(receipt => URL.revokeObjectURL(receipt.preview));
    setReceipts([]); setForm(emptyForm()); setData(null); setReview(null); setNotice(''); setRequestId(createId()); setCameraOpen(false); setAnalysisReceipt(null); setConfirmOpen(false);
    setHistoryTeamSearch(''); setTeamFilter('all');
  }, [currentUser?.uid]);

  const load = useCallback(async (forceReload = false, background = false) => {
    const sequence = ++generation.current;
    setLoading(!background); setRefreshing(background);
    setError('');
    try {
      const next = await teamExpenseRequestService.list(yearMonth, undefined, forceReload ? { forceReload: true } : undefined);
      if (sequence !== generation.current) return;
      if (!next.canReview) setReview(null);
      setData(next);
      setForm(previous => {
        const teamId = next.payerTeams.some(team => team.id === previous.teamId) ? previous.teamId : next.payerTeams.length === 1 ? next.payerTeams[0].id : '';
        const card = next.paymentCards?.find(option => option.id === previous.paymentCardId && option.teamId === teamId);
        return { ...previous, teamId,
        paymentCardId: card?.id || '',
        paymentMethod: card?.label || '',
        chargeToTeamId: next.teams.some(team => team.id === previous.chargeToTeamId) ? previous.chargeToTeamId : next.teams.length === 1 ? next.teams[0].id : '',
        category: next.categories.some(category => category.id === previous.category) ? previous.category : next.categories[0]?.id || '' };
      });
    } catch (cause) {
      if (sequence === generation.current) {
        const code = String((cause as { code?: string })?.code || '');
        if (!background || /permission-denied|unauthenticated/.test(code)) setData(null);
        setError(background ? '승인 요청은 접수되었습니다. 내역을 새로 불러오지 못했으니 새로고침해 주세요.' : cause instanceof Error ? cause.message : '경비 신청을 불러오지 못했습니다.');
      }
    } finally { if (sequence === generation.current) { setLoading(false); setRefreshing(false); } }
  }, [yearMonth]);
  useEffect(() => {
    const afterSave = refreshAfterSaveMonth.current === yearMonth;
    refreshAfterSaveMonth.current = null;
    void load(afterSave, afterSave);
    return () => { generation.current++; };
  }, [load, yearMonth, currentUser?.uid]);
  const loadMore = async () => {
    if (!data?.nextCursor || moreLock.current || loading || refreshing) return;
    moreLock.current = true; setLoadingMore(true); setError('');
    const sequence = generation.current;
    try {
      const next = await teamExpenseRequestService.list(yearMonth, data.nextCursor);
      if (sequence !== generation.current) return;
      if (!next.canReview) setReview(null);
      setData(previous => previous ? { ...next, requests: [...new Map([...previous.requests.filter(row => next.canReview || row.ownerUid === activeUid.current), ...next.requests].map(row => [row.id, row])).values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) } : previous);
    } catch (cause) { if (sequence === generation.current) setError(cause instanceof Error ? cause.message : '추가 내역을 불러오지 못했습니다.'); }
    finally { moreLock.current = false; setLoadingMore(false); }
  };
  useEffect(() => () => { preparation.current++; receiptsRef.current.forEach(receipt => URL.revokeObjectURL(receipt.preview)); }, []);
  useEffect(() => {
    if (!preparing && !receipts.length && !form.description && !form.amount && !form.memo) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [preparing, receipts.length, form.description, form.amount, form.memo]);

  const change = (field: keyof typeof form, value: string) => {
    setForm(previous => ({ ...previous, [field]: value, ...(field === 'teamId' && value !== previous.teamId && previous.paymentCardId ? { paymentCardId: '', paymentMethod: '' } : {}) }));
    setRequestId(createId());
    setNotice('');
  };
  const changePayment = (value: string) => {
    const card = data?.paymentCards?.find(option => `card:${option.id}` === value && option.teamId === form.teamId);
    setForm(previous => ({ ...previous, paymentMethod: card?.label || '', paymentCardId: card?.id || '' }));
    setRequestId(createId()); setNotice('');
  };
  const addFiles = async (files: File[]) => {
    if (saving || loading || preparingLock.current || !files.length || !form.teamId) return;
    const sequence = ++preparation.current;
    const uid = activeUid.current;
    preparingLock.current = true; setPreparing(true); setError('');
    try {
      if (receipts.length + files.length > 5) throw new Error('영수증은 최대 5개까지 첨부할 수 있습니다.');
      if (files.some(file => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))) throw new Error('JPG, PNG, WEBP 이미지 또는 PDF만 첨부할 수 있습니다.');
      if (files.some(file => !file.size || file.size > (file.type === 'application/pdf' ? 5 : 25) * 1024 * 1024)) throw new Error('사진은 25MB, PDF는 5MB 이하로 첨부해 주세요.');
      // Process one photo at a time to keep decoded image memory bounded on phones.
      const prepared: File[] = [];
      for (const file of files) {
        prepared.push(await prepareExpenseReceipt(file));
        if (sequence !== preparation.current || activeUid.current !== uid) return;
      }
      validateRequestReceiptFiles([...receipts.map(receipt => receipt.file), ...prepared]);
      const added = prepared.map(file => ({ id: createId(), file, preview: URL.createObjectURL(file) }));
      setReceipts(previous => [...previous, ...added]);
      setRequestId(createId());
    } catch (cause) { if (sequence === preparation.current && activeUid.current === uid) setError((cause as Error).message); }
    finally {
      if (sequence === preparation.current) {
        preparingLock.current = false; setPreparing(false);
        if (fileInput.current) fileInput.current.value = '';
        if (deviceCameraInput.current) deviceCameraInput.current.value = '';
      }
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || preparingLock.current) return;
    setError('');
    try {
      validateRequestReceiptFiles(receipts.map(receipt => receipt.file));
      if (!form.teamId || !form.chargeToTeamId || !form.category || !form.description.trim() || !form.date) throw new Error('팀과 경비 항목을 모두 입력해 주세요.');
      if (!Number.isSafeInteger(Number(form.amount)) || Number(form.amount) <= 0 || Number(form.amount) > 1_000_000_000) throw new Error('올바른 금액을 입력해 주세요.');
      if (!data?.paymentCards?.some(card => card.id === form.paymentCardId && card.teamId === form.teamId)) throw new Error('사용팀에 배정된 카드를 선택해 주세요.');
      setConfirmOpen(true);
    } catch (cause) { setError((cause as Error).message); }
  };
  const saveRequest = async () => {
    if (saveLock.current || preparingLock.current) return;
    saveLock.current = true;
    const uid = activeUid.current;
    const checkAccount = () => { if (!uid || activeUid.current !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.'); };
    setError(''); setNotice('');
    try {
      validateRequestReceiptFiles(receipts.map(receipt => receipt.file));
      if (!form.teamId || !form.chargeToTeamId || !form.category) throw new Error('사용팀, 청구팀과 경비 구분을 확인해 주세요.');
      if (!data?.paymentCards?.some(card => card.id === form.paymentCardId && card.teamId === form.teamId)) throw new Error('사용팀에 배정된 카드를 선택해 주세요.');
      if (!Number.isSafeInteger(Number(form.amount)) || Number(form.amount) <= 0) throw new Error('올바른 금액을 입력해 주세요.');
      setSaving(true);
      checkAccount();
      const uploadKey = JSON.stringify([uid, requestId, form.teamId]);
      if (uploadedReceipts.current.key !== uploadKey) uploadedReceipts.current = { key: uploadKey, ids: new Set() };
      const uploaded = uploadedReceipts.current.ids;
      const remaining = receipts.filter(receipt => !uploaded.has(receipt.id));
      setProgress(`영수증 업로드 ${uploaded.size}/${receipts.length}`);
      for (let index = 0; index < remaining.length; index += 2) {
        // Wait for every in-flight upload before unlocking a failed attempt.
        const results = await Promise.allSettled(remaining.slice(index, index + 2).map(async receipt => {
          await teamExpenseRequestService.upload(requestId, form.teamId, receipt.id, receipt.file);
          checkAccount();
          uploaded.add(receipt.id);
          setProgress(`영수증 업로드 ${uploaded.size}/${receipts.length}`);
        }));
        const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failure) throw failure.reason;
      }
      checkAccount();
      setProgress('승인 요청 중');
      await teamExpenseRequestService.submit({ ...form, requestId, amount: Number(form.amount), receiptIds: receipts.map(receipt => receipt.id) });
      checkAccount();
      receipts.forEach(receipt => URL.revokeObjectURL(receipt.preview));
      setReceipts([]); setRequestId(createId()); setConfirmOpen(false); setDetailsOpen(false);
      uploadedReceipts.current = { key: '', ids: new Set() };
      setForm(previous => ({ ...previous, description: '', amount: '', memo: '' }));
      setNotice('승인을 요청했습니다. 사무실 승인 후 경비내역과 팀 정산에 반영됩니다.');
      // List refresh is independent of submission so the next entry is immediately usable.
      const submittedMonth = form.date.slice(0, 7);
      if (submittedMonth === yearMonth) void load(true, true);
      else {
        // Keep entry options, but never label the previous month's rows as the submitted month.
        setData(previous => previous ? { ...previous, requests: [], nextCursor: null } : previous);
        refreshAfterSaveMonth.current = submittedMonth; setYearMonth(submittedMonth);
      }
    } catch (cause) { if (activeUid.current === uid) setError(cause instanceof Error ? cause.message : '제출하지 못했습니다. 다시 시도해 주세요.'); }
    finally { saveLock.current = false; setSaving(false); setProgress(''); }
  };
  const applyReview = async () => {
    if (!review || saveLock.current) return;
    if (review.decision === 'rejected' && !reason.trim()) { setError('반려 사유를 입력해 주세요.'); return; }
    saveLock.current = true;
    const uid = activeUid.current;
    setSaving(true); setError('');
    try {
      await teamExpenseRequestService.review(review.row.id, review.decision, reason);
      if (activeUid.current !== uid) return;
      setNotice(review.decision === 'approved' ? '승인했고 경비내역과 팀 정산에 반영했습니다.' : '반려했습니다. 팀장에게 반려 사유가 표시됩니다.');
      setReview(null); setReason(''); await load();
    } catch (cause) { if (activeUid.current === uid) setError(cause instanceof Error ? cause.message : '처리에 실패했습니다.'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const rows = useMemo(() => (data?.requests || []).filter(row => (filter === 'all' || row.status === filter) && (teamFilter === 'all' || row.teamId === teamFilter || row.chargeToTeamId === teamFilter) && [row.teamName, row.chargeToTeamName || row.teamName].some(name => searchKey(name).includes(searchKey(historyTeamSearch)))), [data?.requests, filter, teamFilter, historyTeamSearch]);
  const paymentCards = (data?.paymentCards || []).filter(card => card.teamId === form.teamId);
  const summary = useMemo(() => (data?.requests || []).reduce((total, row) => {
    total[row.status]++;
    if (row.status === 'pending') total.pendingAmount += row.amount;
    return total;
  }, { pending: 0, approved: 0, rejected: 0, pendingAmount: 0 }), [data?.requests]);
  const payerTeam = data?.payerTeams.find(team => team.id === form.teamId);
  const chargeToTeam = data?.teams.find(team => team.id === form.chargeToTeamId);
  const receiptLocked = saving || loading || preparing || !payerTeam || Boolean(analysisReceipt) || confirmOpen;

  return <main className={`team-expense-request ${data && !data.canReview ? 'expense-quick-entry' : ''}`}>
    <header className="expense-request-header expense-page-header"><div className="expense-page-heading"><span className="expense-page-icon"><ReceiptText size={25} aria-hidden="true" /></span><div><span className="expense-request-eyebrow">팀장 메뉴 · 경비관리</span><h1>{data?.canReview ? '팀장 경비 승인' : '팀 경비 신청'}</h1><p>{data?.canReview ? '사용팀·청구팀과 영수증을 확인한 뒤 승인해 주세요.' : '영수증 첨부부터 승인 확인까지, 팀 경비를 한곳에서 관리하세요.'}</p></div></div><div className="expense-page-actions">{data && !data.canReview && <a href="#expense-request-history"><FileText size={16} aria-hidden="true" />신청 내역</a>}<button type="button" onClick={() => void load(true)} disabled={loading || saving}><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />새로고침</button></div></header>
    <dl className="expense-request-summary" aria-label="경비 신청 요약" aria-busy={loading}>
      <div><dt><FileText size={16} aria-hidden="true" />전체 신청</dt><dd>{data ? data.requests.length.toLocaleString('ko-KR') : '—'}<span>건</span></dd><small>선택한 월 · 불러온 내역 기준</small></div>
      <div className="expense-summary-pending"><dt><Clock3 size={16} aria-hidden="true" />승인 대기</dt><dd>{data ? summary.pending.toLocaleString('ko-KR') : '—'}<span>건</span></dd><small>{data ? money(summary.pendingAmount) : loading ? '조회 중' : '조회 필요'}</small></div>
      <div><dt><CheckCircle2 size={16} aria-hidden="true" />승인 완료</dt><dd>{data ? summary.approved.toLocaleString('ko-KR') : '—'}<span>건</span></dd><small>경비·팀 정산 반영</small></div>
      <div><dt><ClipboardCheck size={16} aria-hidden="true" />반려</dt><dd>{data ? summary.rejected.toLocaleString('ko-KR') : '—'}<span>건</span></dd><small>처리 사유를 확인해 주세요</small></div>
    </dl>
    <ol className="expense-request-steps"><li><span>1</span>팀·경비 입력</li><li><span>2</span>영수증 첨부</li><li><span>3</span>사무실 승인 후 반영</li></ol>
    <p className="expense-request-note">사무실이 승인하면 청구팀의 경비에서 차감하고, 먼저 돈을 낸 사용팀에는 같은 금액을 환급합니다. 환급은 팀 정산에 반영됩니다.</p>
    {error && !confirmOpen && <div className="expense-request-error" role="alert" style={review ? { position: 'fixed', bottom: 20, left: '10%', right: '10%', zIndex: 1001 } : undefined}>{error}</div>}
    {notice && <div className="expense-request-success" role="status"><CheckCircle2 size={18} />{notice}</div>}
    {loading && <div role="status" className="expense-request-loading-state"><p className="expense-request-loading"><Loader2 className="animate-spin" size={18} />{data ? '최신 경비 신청을 확인하고 있습니다.' : '경비 신청을 불러오는 중입니다.'}</p>{!data && <ExpenseRequestSkeleton />}</div>}
    {data && <div className={`expense-request-grid ${data.canReview ? 'review-only' : ''}`}>
      {!data.canReview && <section className="expense-request-panel"><h2><Plus size={19} />새 경비 신청</h2><p className="expense-request-note">승인 전에는 경비와 정산 금액에 포함되지 않습니다.</p>
        {!data.payerTeams.length && <p role="alert">연결된 소속팀이 없습니다. 사무실에 작업자·소속 팀 연결을 요청해 주세요.</p>}
        <form aria-label="새 경비 신청" onSubmit={submit}><fieldset disabled={saving || loading || !data.payerTeams.length || Boolean(analysisReceipt) || confirmOpen}>
          <div className="expense-request-team-fields">
            <div className="expense-current-team"><span className="expense-field-label">사용팀 (현재 소속)</span>
              {data.payerTeams.length > 1 ? <select aria-label="사용팀 (현재 소속)" required value={form.teamId} onChange={event => change('teamId', event.target.value)}><option value="">소속팀 선택</option>{data.payerTeams.map(team => <option key={team.id} value={team.id} style={{ color: team.color }}>{team.name}</option>)}</select> : null}
              <div aria-label="현재 소속팀">{payerTeam ? <TeamTag name={payerTeam.name} color={payerTeam.color} icon={payerTeam.icon} /> : '소속팀을 확인해 주세요.'}</div><small>경비를 먼저 낸 팀 · 승인 후 환급</small>
            </div>
            <div className="expense-billing-team">
              <ExpenseTeamSelect teams={data.teams} value={form.chargeToTeamId} onChange={id => change('chargeToTeamId', id)} />
              {chargeToTeam && <TeamTag name={chargeToTeam.name} color={chargeToTeam.color} icon={chargeToTeam.icon} />}<small>경비를 부담할 팀 · 승인 후 차감</small>
            </div>
          </div>
          <div className="expense-request-fields"><label>사용일<input type="date" required value={form.date} onChange={event => change('date', event.target.value)} /></label><label>경비 구분<select required value={form.category} onChange={event => change('category', event.target.value)}>{data.categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label></div>
          <div className="expense-request-fields"><label>금액 (원)<input type="number" inputMode="numeric" required min="1" max="1000000000" step="1" placeholder="0" value={form.amount} onChange={event => change('amount', event.target.value)} /></label><div><label>배정된 카드<select aria-label="배정된 카드" required value={form.paymentCardId ? `card:${form.paymentCardId}` : ''} onChange={event => changePayment(event.target.value)} aria-describedby="expense-payment-help"><option value="">배정된 카드 선택</option>{paymentCards.map(card => <option key={card.id} value={`card:${card.id}`}>{card.label}</option>)}</select></label><p id="expense-payment-help" className="expense-request-note">{paymentCards.length ? '사용한 카드를 선택해 주세요.' : '사용팀에 배정된 카드가 없습니다. 사무실에 카드 배정을 요청해 주세요.'}</p></div></div>
          <label>사용 내용<input required maxLength={500} placeholder="예: 현장 작업자 점심 식대" value={form.description} onChange={event => change('description', event.target.value)} /></label>
          <details className="expense-optional-fields" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary>메모 추가 <span className="optional">선택</span></summary><label>메모<textarea maxLength={1000} rows={2} value={form.memo} onChange={event => change('memo', event.target.value)} placeholder="확인이 필요한 내용을 남겨 주세요." /></label></details>
          <div role="group" aria-label="영수증 등록" aria-disabled={receiptLocked} className={`expense-request-upload ${dragging ? 'dragging' : ''}`}
            onDragEnter={event => { event.preventDefault(); if (!receiptLocked && Array.from(event.dataTransfer.types).includes('Files')) { dragDepth.current++; setDragging(true); } }}
            onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = receiptLocked ? 'none' : 'copy'; }}
            onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
            onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!receiptLocked) addFiles(Array.from(event.dataTransfer.files)); }}>
            <Upload size={24} aria-hidden="true" /><strong>{dragging ? '여기에 놓으면 첨부됩니다' : '영수증 사진이나 파일을 첨부하세요'}</strong><p>최대 5개 · 사진 자동 용량 조절 · PDF 5MB 이하</p><p>AI 입력은 첨부 후 필요할 때 선택하세요.</p>
            <div className="expense-receipt-buttons"><button type="button" disabled={receiptLocked} onClick={() => { if (window.matchMedia?.('(pointer: coarse), (max-width: 680px)').matches) deviceCameraInput.current?.click(); else setCameraOpen(true); }}><Camera size={18} />사진 촬영</button><button type="button" disabled={receiptLocked} onClick={() => fileInput.current?.click()}><Plus size={18} />파일 첨부</button></div>
            <input id="expense-request-receipts" className="expense-file-input" aria-label="영수증 파일 첨부" ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => addFiles(Array.from(event.target.files || []))} />
            <input className="expense-file-input" aria-label="촬영한 영수증 첨부" ref={deviceCameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => addFiles(Array.from(event.target.files || []))} />
          </div>
          {preparing && <p role="status" className="expense-request-loading"><Loader2 className="animate-spin" size={18} />사진 용량을 조절하고 있습니다. 입력은 계속할 수 있어요.</p>}
          <div className="expense-request-files">{receipts.map(receipt => <div key={receipt.id}>{receipt.file.type.startsWith('image/') ? <img src={receipt.preview} alt={`${receipt.file.name} 미리보기`} /> : <FileText size={32} />}<span>{receipt.file.name}</span><button type="button" disabled={preparing} aria-label={`${receipt.file.name} AI 입력`} onClick={() => setAnalysisReceipt(receipt)}><Sparkles size={16} />AI 입력</button><button type="button" disabled={preparing} aria-label={`${receipt.file.name} 첨부 취소`} onClick={() => { URL.revokeObjectURL(receipt.preview); setReceipts(previous => previous.filter(item => item.id !== receipt.id)); setRequestId(createId()); }}><X size={16} /></button></div>)}</div>
          <div className="expense-submit-bar"><button className="primary expense-request-submit" type="submit" disabled={saving || preparing || !receipts.length}>{saving ? <Loader2 className="animate-spin" size={18} /> : <ClipboardCheck size={18} />}{saving ? progress : '등록 전 미리보기'}</button></div>
        </fieldset></form>
      </section>}
      <section id="expense-request-history" className="expense-request-panel expense-request-history" aria-busy={loading || refreshing}><div className="expense-request-history-title"><h2><FileText size={19} aria-hidden="true" />{data.canReview ? '경비 신청 목록' : '내 신청 내역'}</h2><span>대기 {summary.pending}건 · {money(summary.pendingAmount)}</span></div>
        {refreshing && <p role="status" className="expense-request-loading"><Loader2 className="animate-spin" size={18} />내역을 갱신하고 있습니다. 다음 경비를 입력할 수 있어요.</p>}
        <p className="expense-request-note">불러온 {data.requests.length}건 기준으로 필터와 대기 합계를 표시합니다.</p>
        {data.nextCursor && <button type="button" disabled={loading || loadingMore || saving} onClick={() => void loadMore()}>{loadingMore ? '추가 조회 중…' : '다음 100건 더 보기'}</button>}
        <div className="expense-request-filters"><label>조회 월<input type="month" aria-label="조회 월" value={yearMonth} disabled={saving} onChange={event => { if (event.target.value) setYearMonth(event.target.value); }} /></label><label>상태<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">전체 상태</option><option value="pending">승인 대기</option><option value="approved">승인 완료</option><option value="rejected">반려</option></select></label><label>내역 팀 검색<input type="search" placeholder="사용팀 또는 청구팀 이름" value={historyTeamSearch} onChange={event => setHistoryTeamSearch(event.target.value)} /></label>{data.canReview && <label>팀 필터<select value={teamFilter} onChange={event => setTeamFilter(event.target.value)}><option value="all">전체 팀</option>{data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}</div>
        {!rows.length && !loading && <div className="expense-request-empty"><FileText size={30} /><p>해당 조건의 경비 신청이 없습니다.</p></div>}
        {rows.map(row => <article key={row.id} className="expense-request-card"><div className="expense-request-card-top"><span className={`expense-request-badge ${row.status}`}>{labels[row.status]}</span><strong>{money(row.amount)}</strong></div><h3>{row.description}</h3><RequestTeams row={row} teams={data.teams} /><p>{row.date} · {row.categoryLabel} · {row.paymentMethod}</p>{data.canReview && <p>신청자: {row.submitterName}</p>}{row.memo && <p className="expense-request-memo">{row.memo}</p>}<div className="expense-request-attachments">{row.attachments.map((attachment, index) => <SecureExpenseReceipt key={attachment.id} fullPath={attachment.fullPath} name={`영수증 ${index + 1}`} />)}</div>{row.reviewedAt && <p className="expense-request-note">{row.reviewerName} · {new Date(row.reviewedAt).toLocaleString('ko-KR')}{row.reviewReason && <><br />처리 사유: {row.reviewReason}</>}</p>}{data.canReview && row.status === 'pending' && <div className="expense-request-actions"><button type="button" disabled={saving || loading} onClick={() => { setReview({ row, decision: 'rejected' }); setReason(''); }}>반려</button><button type="button" className="primary" disabled={saving || loading} onClick={() => { setReview({ row, decision: 'approved' }); setReason(''); }}>승인 및 반영</button></div>}</article>)}
      </section>
    </div>}
    {data?.canReview && <div className="expense-request-panel expense-draft-maintenance"><TeamRequestDraftMaintenance key={currentUser?.uid} service={teamExpenseRequestService} /></div>}
    <ExpensePortal>
    {review && <div className="expense-request-modal" role="dialog" aria-modal="true" aria-labelledby="expense-review-title"><div><h2 id="expense-review-title">{review.decision === 'approved' ? '경비 승인' : '경비 반려'}</h2><RequestTeams row={review.row} teams={data?.teams} /><p>{money(review.row.amount)} · {review.row.description}</p><p>{review.decision === 'approved' ? '승인하면 청구팀에서 경비를 차감하고 사용팀에 선지급금을 환급합니다.' : '반려 사유가 팀장에게 표시됩니다.'}</p>{error && <p role="alert" className="expense-request-error">{error}</p>}<label>처리 사유 {review.decision === 'approved' && '(선택)'}<textarea autoFocus rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} /></label><div className="expense-request-actions"><button type="button" disabled={saving} onClick={() => setReview(null)}>취소</button><button type="button" className="primary" disabled={saving} onClick={() => void applyReview()}>{saving ? '처리 중…' : review.decision === 'approved' ? '승인 확정' : '반려 확정'}</button></div></div></div>}
    {confirmOpen && <div className="expense-request-modal" role="dialog" aria-modal="true" aria-labelledby="expense-confirm-title" onKeyDown={event => { if (event.key === 'Escape' && !saving) setConfirmOpen(false); }}><div className="expense-preview-panel">
      <h2 id="expense-confirm-title">등록 전 최종 확인</h2><p>영수증과 입력 항목이 일치하는지 확인한 뒤 승인 요청을 보내세요.</p>
      <div className="expense-preview-grid"><div className="expense-confirm-receipts"><Suspense fallback={<p role="status">영수증 미리보기를 준비하고 있습니다.</p>}>{receipts.map(receipt => <ExpenseReceiptDocument key={receipt.id} receipt={receipt} />)}</Suspense></div><div>
        <div className="expense-team-route"><span>사용팀 {payerTeam && <TeamTag name={payerTeam.name} color={payerTeam.color} icon={payerTeam.icon} />}</span><span>청구팀 {chargeToTeam && <TeamTag name={chargeToTeam.name} color={chargeToTeam.color} icon={chargeToTeam.icon} />}</span></div>
        <dl className="expense-confirm-fields"><dt>사용일</dt><dd>{form.date}</dd><dt>금액</dt><dd>{money(Number(form.amount))}</dd><dt>배정된 카드</dt><dd>{form.paymentMethod}</dd><dt>경비 구분</dt><dd>{data?.categories.find(category => category.id === form.category)?.label}</dd><dt>사용 내용</dt><dd>{form.description}</dd>{form.memo && <><dt>메모</dt><dd>{form.memo}</dd></>}</dl>
        <p className="expense-request-note">사무실 승인 후 청구팀의 경비를 차감하고 사용팀에 환급 정산합니다.</p>
        {error && <p role="alert" className="expense-request-error">{error}</p>}
        <div className="expense-request-actions"><button type="button" autoFocus disabled={saving} onClick={() => setConfirmOpen(false)}>돌아가서 수정</button><button type="button" className="primary" disabled={saving} onClick={() => void saveRequest()}>{saving ? progress : '확인 후 승인 요청'}</button></div>
      </div></div>
    </div></div>}
    {analysisReceipt && data && <Suspense fallback={<ReceiptToolLoading onClose={() => setAnalysisReceipt(null)} />}><ExpenseReceiptAnalysis key={`${analysisReceipt.id}:${form.teamId}`} receipt={analysisReceipt} teamId={form.teamId} categories={data.categories} showPaymentMethod={false} onClose={() => setAnalysisReceipt(null)} onApply={fields => { setForm(previous => ({ ...previous, ...fields, paymentCardId: previous.paymentCardId, paymentMethod: previous.paymentMethod })); setRequestId(createId()); setAnalysisReceipt(null); setNotice('확인한 영수증 항목을 입력란에 적용했습니다. 사용 내용과 청구팀을 확인해 주세요.'); }} /></Suspense>}
    {cameraOpen && <Suspense fallback={<ReceiptToolLoading onClose={() => setCameraOpen(false)} />}><ExpenseReceiptCamera onClose={() => setCameraOpen(false)} onDeviceCamera={() => { setCameraOpen(false); deviceCameraInput.current?.click(); }} onCapture={file => { setCameraOpen(false); addFiles([file]); }} /></Suspense>}
    </ExpensePortal>
  </main>;
}
