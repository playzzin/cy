import SecureExpenseReceipt from '../../components/SecureExpenseReceipt';
import { useUnsavedRequestGuard } from '../../hooks/useUnsavedRequestGuard';
import TeamRequestDraftMaintenance from '../../components/TeamRequestDraftMaintenance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle2, ClipboardCheck, FileText, Loader2, Plus, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../constants/iconMap';
import { useAuth } from '../../contexts/AuthContext';
import { teamExpenseRequestService, validateRequestReceiptFiles } from '../../services/teamExpenseRequestService';
import type { TeamExpenseRequest, TeamExpenseRequestData } from '../../types/teamExpenseRequest';
import ExpenseReceiptCamera from './ExpenseReceiptCamera';
import ExpenseReceiptAnalysis, { ExpenseReceiptDocument } from './ExpenseReceiptAnalysis';
import './TeamExpenseRequestPage.css';

const today = () => new Date().toLocaleDateString('sv-SE');
const createId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
const money = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const labels = { pending: '승인 대기', approved: '승인 · 반영 완료', rejected: '반려' };
const emptyForm = () => ({ teamId: '', chargeToTeamId: '', date: today(), category: '', description: '', amount: '', paymentMethod: '현찰', memo: '' });

const TeamTag = ({ name, color, icon }: { name: string; color?: string; icon?: string }) => {
  const safeColor = /^#[\da-f]{6}$/i.test(color || '') ? color! : '#64748b';
  return <span className="expense-team-tag" style={{ borderColor: safeColor, backgroundColor: `${safeColor}14` }}><span className="expense-team-icon" style={{ backgroundColor: safeColor }}><FontAwesomeIcon icon={resolveIcon(icon || 'fa-users', faUsers)} aria-label={`${name} 팀 아이콘`} /></span>{name}</span>;
};
const RequestTeams = ({ row, teams = [] }: { row: TeamExpenseRequest; teams?: TeamExpenseRequestData['teams'] }) => <div className="expense-team-route"><span>사용팀 <TeamTag name={row.teamName} color={row.teamColor} icon={row.teamIcon || teams.find(team => team.id === row.teamId)?.icon} /></span><span>청구팀 <TeamTag name={row.chargeToTeamName || row.teamName} color={row.chargeToTeamColor || row.teamColor} icon={row.chargeToTeamIcon || teams.find(team => team.id === (row.chargeToTeamId || row.teamId))?.icon} /></span></div>;
type Receipt = { id: string; file: File; preview: string };
const ExpensePortal = ({ children }: { children: React.ReactNode }) => createPortal(<div className="team-expense-request expense-portal-root">{children}</div>, document.body);

export default function TeamExpenseRequestPage() {
  const { currentUser } = useAuth();
  const [yearMonth, setYearMonth] = useState(() => today().slice(0, 7));
  const [data, setData] = useState<TeamExpenseRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreLock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [filter, setFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
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

  useUnsavedRequestGuard(receipts.length > 0 || Boolean(form.description || form.amount || form.memo));
  useEffect(() => {
    receiptsRef.current.forEach(receipt => URL.revokeObjectURL(receipt.preview));
    setReceipts([]); setForm(emptyForm()); setData(null); setReview(null); setNotice(''); setRequestId(createId()); setCameraOpen(false); setAnalysisReceipt(null); setConfirmOpen(false);
  }, [currentUser?.uid]);

  const load = useCallback(async () => {
    const sequence = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const next = await teamExpenseRequestService.list(yearMonth);
      if (sequence !== generation.current) return;
      setData(next);
      setForm(previous => ({ ...previous,
        teamId: next.payerTeams.some(team => team.id === previous.teamId) ? previous.teamId : next.payerTeams.length === 1 ? next.payerTeams[0].id : '',
        chargeToTeamId: next.teams.some(team => team.id === previous.chargeToTeamId) ? previous.chargeToTeamId : next.teams.length === 1 ? next.teams[0].id : '',
        category: next.categories.some(category => category.id === previous.category) ? previous.category : next.categories[0]?.id || '' }));
    } catch (cause) {
      if (sequence === generation.current) { setData(null); setError(cause instanceof Error ? cause.message : '경비 신청을 불러오지 못했습니다.'); }
    } finally { if (sequence === generation.current) setLoading(false); }
  }, [yearMonth]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load, currentUser?.uid]);
  const loadMore = async () => {
    if (!data?.nextCursor || moreLock.current || loading) return;
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
  useEffect(() => () => receiptsRef.current.forEach(receipt => URL.revokeObjectURL(receipt.preview)), []);
  useEffect(() => {
    if (!receipts.length && !form.description && !form.amount) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [receipts.length, form.description, form.amount]);

  const change = (field: keyof typeof form, value: string) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setRequestId(createId());
    setNotice('');
  };
  const addFiles = (files: File[]) => {
    if (saving || loading || !files.length || !form.teamId) return;
    try {
      validateRequestReceiptFiles([...receipts.map(receipt => receipt.file), ...files]);
      const added = files.map(file => ({ id: createId(), file, preview: URL.createObjectURL(file) }));
      setReceipts(previous => [...previous, ...added]);
      if (!receipts.length) setAnalysisReceipt(added[0]);
      setRequestId(createId());
      setError('');
    } catch (cause) { setError((cause as Error).message); }
    if (fileInput.current) fileInput.current.value = '';
    if (deviceCameraInput.current) deviceCameraInput.current.value = '';
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    try {
      validateRequestReceiptFiles(receipts.map(receipt => receipt.file));
      if (!form.teamId || !form.chargeToTeamId || !form.category || !form.description.trim() || !form.date) throw new Error('팀과 경비 항목을 모두 입력해 주세요.');
      if (!Number.isSafeInteger(Number(form.amount)) || Number(form.amount) <= 0 || Number(form.amount) > 1_000_000_000) throw new Error('올바른 금액을 입력해 주세요.');
      setConfirmOpen(true);
    } catch (cause) { setError((cause as Error).message); }
  };
  const saveRequest = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    const uid = activeUid.current;
    const checkAccount = () => { if (!uid || activeUid.current !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.'); };
    setError(''); setNotice('');
    try {
      validateRequestReceiptFiles(receipts.map(receipt => receipt.file));
      if (!form.teamId || !form.chargeToTeamId || !form.category) throw new Error('사용팀, 청구팀과 경비 구분을 확인해 주세요.');
      if (!Number.isSafeInteger(Number(form.amount)) || Number(form.amount) <= 0) throw new Error('올바른 금액을 입력해 주세요.');
      setSaving(true);
      for (let index = 0; index < receipts.length; index++) {
        setProgress(`영수증 업로드 ${index + 1}/${receipts.length}`);
        await teamExpenseRequestService.upload(requestId, form.teamId, receipts[index].id, receipts[index].file);
        checkAccount();
      }
      setProgress('승인 요청 중');
      await teamExpenseRequestService.submit({ ...form, requestId, amount: Number(form.amount), receiptIds: receipts.map(receipt => receipt.id) });
      checkAccount();
      receipts.forEach(receipt => URL.revokeObjectURL(receipt.preview));
      setReceipts([]); setRequestId(createId()); setConfirmOpen(false);
      setForm(previous => ({ ...emptyForm(), teamId: previous.teamId, chargeToTeamId: previous.chargeToTeamId, category: previous.category }));
      setNotice('승인을 요청했습니다. 사무실 승인 후 경비내역과 팀 정산에 반영됩니다.');
      setYearMonth(form.date.slice(0, 7));
      if (form.date.slice(0, 7) === yearMonth) await load();
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
  const rows = (data?.requests || []).filter(row => (filter === 'all' || row.status === filter) && (teamFilter === 'all' || row.teamId === teamFilter || row.chargeToTeamId === teamFilter));
  const pending = (data?.requests || []).filter(row => row.status === 'pending');
  const payerTeam = data?.payerTeams.find(team => team.id === form.teamId);
  const chargeToTeam = data?.teams.find(team => team.id === form.chargeToTeamId);
  const receiptLocked = saving || loading || !payerTeam || Boolean(analysisReceipt) || confirmOpen;

  return <main className="team-expense-request">
    <header className="expense-request-header"><div><span className="expense-request-eyebrow">경비관리</span><h1>{data?.canReview ? '팀장 경비 승인' : '경비입력'}</h1><p>{data?.canReview ? '사용팀·청구팀과 영수증을 확인한 뒤 승인해 주세요.' : '청구할 팀을 선택하고 영수증을 올려 사무실에 승인을 요청하세요.'}</p></div><button type="button" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={16} />새로고침</button></header>
    <ol className="expense-request-steps"><li><span>1</span>팀·경비 입력</li><li><span>2</span>영수증 첨부</li><li><span>3</span>사무실 승인 후 반영</li></ol>
    <p className="expense-request-note">사무실이 승인하면 청구팀의 경비에서 차감하고, 먼저 돈을 낸 사용팀에는 같은 금액을 환급합니다. 환급은 팀 정산에 반영됩니다.</p>
    {error && !confirmOpen && <div className="expense-request-error" role="alert" style={review ? { position: 'fixed', bottom: 20, left: '10%', right: '10%', zIndex: 1001 } : undefined}>{error}</div>}
    {notice && <div className="expense-request-success" role="status"><CheckCircle2 size={18} />{notice}</div>}
    {loading && <p role="status" className="expense-request-loading"><Loader2 className="animate-spin" size={18} />경비 신청을 불러오는 중입니다.</p>}
    {data && <div className={`expense-request-grid ${data.canReview ? 'review-only' : ''}`}>
      {!data.canReview && <section className="expense-request-panel"><h2><Plus size={19} />새 경비 신청</h2><p className="expense-request-note">승인 전에는 경비와 정산 금액에 포함되지 않습니다.</p>
        {!data.payerTeams.length && <p role="alert">연결된 소속팀이 없습니다. 사무실에 작업자·소속 팀 연결을 요청해 주세요.</p>}
        <form onSubmit={submit}><fieldset disabled={saving || loading || !data.payerTeams.length || Boolean(analysisReceipt) || confirmOpen}>
          <div className="expense-request-team-fields">
            <div className="expense-current-team"><span className="expense-field-label">사용팀 (현재 소속)</span>
              {data.payerTeams.length > 1 ? <select aria-label="사용팀 (현재 소속)" required value={form.teamId} onChange={event => change('teamId', event.target.value)}><option value="">소속팀 선택</option>{data.payerTeams.map(team => <option key={team.id} value={team.id} style={{ color: team.color }}>{team.name}</option>)}</select> : null}
              <div aria-label="현재 소속팀">{payerTeam ? <TeamTag name={payerTeam.name} color={payerTeam.color} icon={payerTeam.icon} /> : '소속팀을 확인해 주세요.'}</div><small>경비를 먼저 낸 팀 · 승인 후 환급</small>
            </div>
            <div className="expense-billing-team"><label>청구팀<select required value={form.chargeToTeamId} onChange={event => change('chargeToTeamId', event.target.value)}><option value="">경비를 청구할 팀 선택</option>{data.teams.map(team => <option key={team.id} value={team.id} style={{ color: team.color }}>{team.name}</option>)}</select></label>{chargeToTeam && <TeamTag name={chargeToTeam.name} color={chargeToTeam.color} icon={chargeToTeam.icon} />}<small>경비를 부담할 팀 · 승인 후 차감</small></div>
          </div>
          <div className="expense-request-fields"><label>사용일<input type="date" required value={form.date} onChange={event => change('date', event.target.value)} /></label><label>경비 구분<select required value={form.category} onChange={event => change('category', event.target.value)}>{data.categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label></div>
          <div className="expense-request-fields"><label>금액 (원)<input type="number" inputMode="numeric" required min="1" max="1000000000" step="1" placeholder="0" value={form.amount} onChange={event => change('amount', event.target.value)} /></label><label>결제수단<select value={form.paymentMethod} onChange={event => change('paymentMethod', event.target.value)}><option>현찰</option><option>개인카드</option><option>계좌이체</option></select></label></div>
          <label>사용 내용<input required maxLength={500} placeholder="예: 현장 작업자 점심 식대" value={form.description} onChange={event => change('description', event.target.value)} /></label>
          <label>메모 <span className="optional">선택</span><textarea maxLength={1000} rows={2} value={form.memo} onChange={event => change('memo', event.target.value)} placeholder="확인이 필요한 내용을 남겨 주세요." /></label>
          <div role="group" aria-label="영수증 등록" aria-disabled={receiptLocked} className={`expense-request-upload ${dragging ? 'dragging' : ''}`}
            onDragEnter={event => { event.preventDefault(); if (!receiptLocked && Array.from(event.dataTransfer.types).includes('Files')) { dragDepth.current++; setDragging(true); } }}
            onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = receiptLocked ? 'none' : 'copy'; }}
            onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
            onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!receiptLocked) addFiles(Array.from(event.dataTransfer.files)); }}>
            <Upload size={24} aria-hidden="true" /><strong>{dragging ? '여기에 놓으면 첨부됩니다' : '영수증을 여기에 끌어다 놓으세요'}</strong><p>사진 또는 PDF · 최대 5개 · 파일당 5MB</p><p>첫 영수증을 Gemini로 자동 분석합니다. 여러 장은 같은 경비의 증빙으로 첨부해 주세요.</p>
            <div className="expense-receipt-buttons"><button type="button" disabled={receiptLocked} onClick={() => setCameraOpen(true)}><Camera size={18} />사진 촬영</button><button type="button" disabled={receiptLocked} onClick={() => fileInput.current?.click()}><Plus size={18} />파일 첨부</button></div>
            <input id="expense-request-receipts" className="expense-file-input" aria-label="영수증 파일 첨부" ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => addFiles(Array.from(event.target.files || []))} />
            <input className="expense-file-input" aria-label="촬영한 영수증 첨부" ref={deviceCameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => addFiles(Array.from(event.target.files || []))} />
          </div>
          <div className="expense-request-files">{receipts.map(receipt => <div key={receipt.id}>{receipt.file.type.startsWith('image/') ? <img src={receipt.preview} alt={`${receipt.file.name} 미리보기`} /> : <FileText size={32} />}<span>{receipt.file.name}</span><button type="button" aria-label={`${receipt.file.name} 분석·미리보기`} onClick={() => setAnalysisReceipt(receipt)}><Sparkles size={16} />미리보기</button><button type="button" aria-label={`${receipt.file.name} 첨부 취소`} onClick={() => { URL.revokeObjectURL(receipt.preview); setReceipts(previous => previous.filter(item => item.id !== receipt.id)); setRequestId(createId()); }}><X size={16} /></button></div>)}</div>
          <button className="primary expense-request-submit" type="submit" disabled={saving || !receipts.length}>{saving ? <Loader2 className="animate-spin" size={18} /> : <ClipboardCheck size={18} />}{saving ? progress : '등록 전 미리보기'}</button>
        </fieldset></form>
      </section>}
      <section className="expense-request-panel expense-request-history"><div className="expense-request-history-title"><h2>{data.canReview ? '경비 신청 목록' : '내 신청 내역'}</h2><span>대기 {pending.length}건 · {money(pending.reduce((sum, row) => sum + row.amount, 0))}</span></div>
        <p className="expense-request-note">불러온 {data.requests.length}건 기준으로 필터와 대기 합계를 표시합니다.</p>
        {data.nextCursor && <button type="button" disabled={loading || loadingMore || saving} onClick={() => void loadMore()}>{loadingMore ? '추가 조회 중…' : '다음 100건 더 보기'}</button>}
        <div className="expense-request-filters"><label>조회 월<input type="month" aria-label="조회 월" value={yearMonth} disabled={saving} onChange={event => { if (event.target.value) setYearMonth(event.target.value); }} /></label><label>상태<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">전체 상태</option><option value="pending">승인 대기</option><option value="approved">승인 완료</option><option value="rejected">반려</option></select></label>{data.canReview && <label>팀 필터<select value={teamFilter} onChange={event => setTeamFilter(event.target.value)}><option value="all">전체 팀</option>{data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}</div>
        {!rows.length && !loading && <div className="expense-request-empty"><FileText size={30} /><p>해당 조건의 경비 신청이 없습니다.</p></div>}
        {rows.map(row => <article key={row.id} className="expense-request-card"><div className="expense-request-card-top"><span className={`expense-request-badge ${row.status}`}>{labels[row.status]}</span><strong>{money(row.amount)}</strong></div><h3>{row.description}</h3><RequestTeams row={row} teams={data.teams} /><p>{row.date} · {row.categoryLabel} · {row.paymentMethod}</p>{data.canReview && <p>신청자: {row.submitterName}</p>}{row.memo && <p className="expense-request-memo">{row.memo}</p>}<div className="expense-request-attachments">{row.attachments.map((attachment, index) => <SecureExpenseReceipt key={attachment.id} fullPath={attachment.fullPath} name={`영수증 ${index + 1}`} />)}</div>{row.reviewedAt && <p className="expense-request-note">{row.reviewerName} · {new Date(row.reviewedAt).toLocaleString('ko-KR')}{row.reviewReason && <><br />처리 사유: {row.reviewReason}</>}</p>}{data.canReview && row.status === 'pending' && <div className="expense-request-actions"><button type="button" disabled={saving || loading} onClick={() => { setReview({ row, decision: 'rejected' }); setReason(''); }}>반려</button><button type="button" className="primary" disabled={saving || loading} onClick={() => { setReview({ row, decision: 'approved' }); setReason(''); }}>승인 및 반영</button></div>}</article>)}
      </section>
    </div>}
    <ExpensePortal>
    {data?.canReview && <TeamRequestDraftMaintenance key={currentUser?.uid} service={teamExpenseRequestService} />}
    {review && <div className="expense-request-modal" role="dialog" aria-modal="true" aria-labelledby="expense-review-title"><div><h2 id="expense-review-title">{review.decision === 'approved' ? '경비 승인' : '경비 반려'}</h2><RequestTeams row={review.row} teams={data?.teams} /><p>{money(review.row.amount)} · {review.row.description}</p><p>{review.decision === 'approved' ? '승인하면 청구팀에서 경비를 차감하고 사용팀에 선지급금을 환급합니다.' : '반려 사유가 팀장에게 표시됩니다.'}</p>{error && <p role="alert" className="expense-request-error">{error}</p>}<label>처리 사유 {review.decision === 'approved' && '(선택)'}<textarea autoFocus rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} /></label><div className="expense-request-actions"><button type="button" disabled={saving} onClick={() => setReview(null)}>취소</button><button type="button" className="primary" disabled={saving} onClick={() => void applyReview()}>{saving ? '처리 중…' : review.decision === 'approved' ? '승인 확정' : '반려 확정'}</button></div></div></div>}
    {confirmOpen && <div className="expense-request-modal" role="dialog" aria-modal="true" aria-labelledby="expense-confirm-title" onKeyDown={event => { if (event.key === 'Escape' && !saving) setConfirmOpen(false); }}><div className="expense-preview-panel">
      <h2 id="expense-confirm-title">등록 전 최종 확인</h2><p>영수증과 입력 항목이 일치하는지 확인한 뒤 승인 요청을 보내세요.</p>
      <div className="expense-preview-grid"><div className="expense-confirm-receipts">{receipts.map(receipt => <ExpenseReceiptDocument key={receipt.id} receipt={receipt} />)}</div><div>
        <div className="expense-team-route"><span>사용팀 {payerTeam && <TeamTag name={payerTeam.name} color={payerTeam.color} icon={payerTeam.icon} />}</span><span>청구팀 {chargeToTeam && <TeamTag name={chargeToTeam.name} color={chargeToTeam.color} icon={chargeToTeam.icon} />}</span></div>
        <dl className="expense-confirm-fields"><dt>사용일</dt><dd>{form.date}</dd><dt>금액</dt><dd>{money(Number(form.amount))}</dd><dt>결제수단</dt><dd>{form.paymentMethod}</dd><dt>경비 구분</dt><dd>{data?.categories.find(category => category.id === form.category)?.label}</dd><dt>사용 내용</dt><dd>{form.description}</dd>{form.memo && <><dt>메모</dt><dd>{form.memo}</dd></>}</dl>
        <p className="expense-request-note">사무실 승인 후 청구팀의 경비를 차감하고 사용팀에 환급 정산합니다.</p>
        {error && <p role="alert" className="expense-request-error">{error}</p>}
        <div className="expense-request-actions"><button type="button" autoFocus disabled={saving} onClick={() => setConfirmOpen(false)}>돌아가서 수정</button><button type="button" className="primary" disabled={saving} onClick={() => void saveRequest()}>{saving ? progress : '확인 후 승인 요청'}</button></div>
      </div></div>
    </div></div>}
    {analysisReceipt && data && <ExpenseReceiptAnalysis key={`${analysisReceipt.id}:${form.teamId}`} receipt={analysisReceipt} teamId={form.teamId} categories={data.categories} onClose={() => setAnalysisReceipt(null)} onApply={fields => { setForm(previous => ({ ...previous, ...fields })); setRequestId(createId()); setAnalysisReceipt(null); setNotice('확인한 영수증 항목을 입력란에 적용했습니다. 사용 내용과 청구팀을 확인해 주세요.'); }} />}
    {cameraOpen && <ExpenseReceiptCamera onClose={() => setCameraOpen(false)} onDeviceCamera={() => { setCameraOpen(false); deviceCameraInput.current?.click(); }} onCapture={file => { setCameraOpen(false); addFiles([file]); }} />}
    </ExpensePortal>
  </main>;
}
