import { useUnsavedRequestGuard } from '../../hooks/useUnsavedRequestGuard';
import TeamRequestDraftMaintenance from '../../components/TeamRequestDraftMaintenance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, FilePlus2, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../constants/iconMap';
import { useAuth } from '../../contexts/AuthContext';
import { teamWorkerRequestService as service, validateWorkerDocument } from '../../services/teamWorkerRequestService';
import type { TeamWorkerRequest, TeamWorkerRequestData, WorkerDocumentKind, WorkerRegistrationFields } from '../../types/teamWorkerRequest';
import './TeamWorkerRequestPage.css';

const createId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
const monthNow = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
const empty = (): WorkerRegistrationFields => ({ name: '', address: '', contact: '', bankName: '', accountNumber: '', accountHolder: '' });
const fieldLabels: Record<keyof WorkerRegistrationFields, string> = { name: '이름', address: '주소', contact: '연락처', bankName: '은행', accountNumber: '계좌번호', accountHolder: '예금주' };
const statusLabels = { pending: '승인 대기', approved: '통합DB 등록 완료', rejected: '반려' };
type DocumentFile = { id: string; kind: WorkerDocumentKind; file: File; preview: string };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : '처리하지 못했습니다. 다시 시도해 주세요.';
const TeamTag = ({ name, color, icon }: { name: string; color?: string; icon?: string }) => {
  const safeColor = /^#[\da-f]{6}$/i.test(color || '') ? color! : '#64748b';
  return <span className="worker-team-tag" style={{ borderColor: safeColor, backgroundColor: `${safeColor}14` }}><FontAwesomeIcon icon={resolveIcon(icon || 'fa-users', faUsers)} style={{ color: safeColor }} />{name}</span>;
};
function DocumentPreview({ document: doc }: { document: DocumentFile }) {
  return <div className="worker-document-preview">
    {doc.file.type.startsWith('image/') ? <img src={doc.preview} alt={`${doc.kind === 'identity' ? '신분증' : '통장'} 원본`} /> : <object data={doc.preview} type="application/pdf" aria-label={`${doc.file.name} 원본`}><p>PDF는 크게 보기에서 확인해 주세요.</p></object>}
    <a href={doc.preview} target="_blank" rel="noreferrer">{doc.file.name} 크게 보기</a>
  </div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(<div className="team-worker-request worker-modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}><section className="worker-modal-panel"><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label={`${title} 닫기`} autoFocus><X size={20} /></button></header>{children}</section></div>, document.body);
}
function UploadBox({ kind, document: doc, disabled, onFile, onRemove, onAnalyze }: { kind: WorkerDocumentKind; document?: DocumentFile; disabled: boolean; onFile: (file: File) => void; onRemove: () => void; onAnalyze: () => void }) {
  const input = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const title = kind === 'identity' ? '신분증' : '통장';
  const accept = (files: FileList | null) => { if (!disabled && files?.[0]) onFile(files[0]); };
  return <section className={`worker-upload ${dragging ? 'dragging' : ''}`} aria-label={`${title} 첨부`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }}>
    <h3>{title} {kind === 'identity' ? '(필수)' : '(선택)'}</h3><p>{kind === 'identity' ? '이름·주소·연락처를 분석합니다. 사진에 없는 연락처는 직접 입력해 주세요.' : '은행·계좌번호·예금주를 분석합니다.'}</p>
    <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" aria-label={`${title} 파일`} onChange={event => { accept(event.target.files); event.target.value = ''; }} />
    <input ref={camera} type="file" hidden capture="environment" accept="image/*" aria-label={`${title} 촬영 파일`} onChange={event => { accept(event.target.files); event.target.value = ''; }} />
    {doc ? <DocumentPreview document={doc} /> : <div className="worker-drop-hint"><Upload size={26} /><span>사진을 끌어 놓거나 첨부하세요</span><small>JPG · PNG · WEBP · PDF / 최대 5MB</small></div>}
    <div className="worker-actions"><button type="button" disabled={disabled} onClick={() => input.current?.click()}><Upload size={16} />{doc ? '사진 변경' : '파일 첨부'}</button><button type="button" disabled={disabled} onClick={() => camera.current?.click()}><Camera size={16} />사진 촬영</button>{doc && <><button type="button" disabled={disabled} onClick={onAnalyze}><Sparkles size={16} />다시 분석</button><button type="button" disabled={disabled} onClick={onRemove}>제거</button></>}</div>
  </section>;
}
function FieldSummary({ fields }: { fields: WorkerRegistrationFields }) { return <dl className="worker-fields-summary">{(Object.keys(fieldLabels) as Array<keyof WorkerRegistrationFields>).map(key => <div key={key}><dt>{fieldLabels[key]}</dt><dd>{fields[key] || '미등록'}</dd></div>)}</dl>; }

export default function TeamWorkerRequestPage() {
  const { currentUser } = useAuth();
  const [yearMonth, setYearMonth] = useState(monthNow), [data, setData] = useState<TeamWorkerRequestData | null>(null), [teamId, setTeamId] = useState('');
  const [fields, setFields] = useState(empty), [documents, setDocuments] = useState<DocumentFile[]>([]), [requestId, setRequestId] = useState(createId);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [payroll, setPayroll] = useState({ payType: '', unitPrice: '' });
  const moreLock = useRef(false);
  const [warnings, setWarnings] = useState<Partial<Record<WorkerDocumentKind, string[]>>>({}), [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState('all'), [review, setReview] = useState<TeamWorkerRequest | null>(null), [reason, setReason] = useState(''), [preview, setPreview] = useState<DocumentFile | null>(null);
  const generation = useRef(0), lock = useRef(false), activeUid = useRef(currentUser?.uid), documentsRef = useRef(documents), previewRef = useRef(preview);
  activeUid.current = currentUser?.uid; documentsRef.current = documents; previewRef.current = preview;
  const load = useCallback(async () => {
    const sequence = ++generation.current; setLoading(true); setError('');
    try { const next = await service.list(yearMonth); if (sequence !== generation.current) return; setData(next); setTeamId(previous => next.teams.some(team => team.id === previous) ? previous : next.teams.length === 1 ? next.teams[0].id : ''); }
    catch (cause) { if (sequence === generation.current) { setData(null); setError(errorText(cause)); } }
    finally { if (sequence === generation.current) setLoading(false); }
  }, [yearMonth]);
  useUnsavedRequestGuard(documents.length > 0 || Object.values(fields).some(Boolean));
  useEffect(() => {
    documentsRef.current.forEach(doc => URL.revokeObjectURL(doc.preview));
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.preview);
    setDocuments([]); setFields(empty()); setTeamId(''); setData(null); setReview(null); setPreview(null); setConfirm(false); setWarnings({}); setNotice(''); setRequestId(createId());
  }, [currentUser?.uid]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [currentUser?.uid, load]);
  const loadMore = async () => {
    if (!data?.nextCursor || moreLock.current || loading) return;
    moreLock.current = true; setLoadingMore(true); setError('');
    const sequence = generation.current;
    try {
      const next = await service.list(yearMonth, data.nextCursor);
      if (sequence !== generation.current) return;
      if (!next.canReview) setReview(null);
      setData(previous => previous ? { ...next, requests: [...new Map([...previous.requests.filter(row => next.canReview || row.ownerUid === activeUid.current), ...next.requests].map(row => [row.id, row])).values()].sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))) } : previous);
    } catch (cause) { if (sequence === generation.current) setError(errorText(cause)); }
    finally { moreLock.current = false; setLoadingMore(false); }
  };
  useEffect(() => () => { documentsRef.current.forEach(doc => URL.revokeObjectURL(doc.preview)); if (previewRef.current) URL.revokeObjectURL(previewRef.current.preview); }, []);
  useEffect(() => {
    if (!documents.length && !Object.values(fields).some(Boolean)) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [documents.length, fields]);
  const resetRequest = () => { setRequestId(createId()); setNotice(''); };
  const analyze = async (doc: DocumentFile) => {
    if (lock.current || !teamId) return;
    lock.current = true; const uid = activeUid.current, sequence = generation.current;
    setBusy(`${doc.kind === 'identity' ? '신분증' : '통장'}을 Gemini로 분석하고 있습니다…`); setError('');
    try { const result = await service.analyze(teamId, doc.kind, doc.file); if (uid !== activeUid.current || sequence !== generation.current) return;
      setFields(previous => ({ ...previous, ...result.fields })); setWarnings(previous => ({ ...previous, [doc.kind]: result.warnings })); resetRequest();
    } catch (cause) { if (uid === activeUid.current && sequence === generation.current) setError(`${errorText(cause)} 아래 입력란에서 직접 입력할 수 있습니다.`); }
    finally { lock.current = false; setBusy(''); }
  };
  const removeDocument = (kind: WorkerDocumentKind) => {
    documents.filter(doc => doc.kind === kind).forEach(doc => URL.revokeObjectURL(doc.preview)); setDocuments(previous => previous.filter(doc => doc.kind !== kind));
    setFields(previous => kind === 'identity' ? { ...previous, name: '', address: '', contact: '' } : { ...previous, bankName: '', accountNumber: '', accountHolder: '' }); setWarnings(previous => ({ ...previous, [kind]: [] })); resetRequest();
  };
  const attach = (kind: WorkerDocumentKind, file: File) => {
    if (lock.current || !teamId) return;
    try { validateWorkerDocument(file); removeDocument(kind); const doc = { id: createId(), kind, file, preview: URL.createObjectURL(file) }; setDocuments(previous => [...previous.filter(item => item.kind !== kind), doc]); void analyze(doc); }
    catch (cause) { setError(errorText(cause)); }
  };
  const validate = () => {
    if (!teamId || !documents.some(doc => doc.kind === 'identity') || !fields.name.trim() || !fields.address.trim() || !/^0\d{8,10}$/.test(fields.contact.replace(/[\s-]/g, ''))) throw new Error('신분증·이름·주소·올바른 연락처를 확인해 주세요.');
    if (documents.some(doc => doc.kind === 'bank') ? !fields.bankName.trim() || !fields.accountHolder.trim() || !/^\d{6,20}$/.test(fields.accountNumber.replace(/[\s-]/g, '')) : fields.bankName || fields.accountNumber || fields.accountHolder) throw new Error('계좌를 등록하려면 통장 사진·은행·계좌번호·예금주를 함께 확인해 주세요.');
  };
  const save = async () => {
    if (lock.current) return; lock.current = true; const uid = activeUid.current;
    const check = () => { if (!uid || activeUid.current !== uid) throw new Error('로그인 계정이 변경되었습니다.'); };
    setError(''); setBusy('서류 업로드 중…');
    try { validate(); for (const doc of documents) { check(); await service.upload(requestId, teamId, doc.kind, doc.id, doc.file); check(); }
      setBusy('승인 요청 중…'); await service.submit(requestId, teamId, fields, documents.find(doc => doc.kind === 'identity')!.id, documents.find(doc => doc.kind === 'bank')?.id); check();
      documents.forEach(doc => URL.revokeObjectURL(doc.preview)); setDocuments([]); setFields(empty()); setWarnings({}); setRequestId(createId()); setConfirm(false); setNotice('승인을 요청했습니다. 사무실 승인 후 통합DB에 작업자가 등록됩니다.');
      if (yearMonth !== monthNow()) setYearMonth(monthNow()); else await load();
    } catch (cause) { if (uid === activeUid.current) setError(errorText(cause)); }
    finally { lock.current = false; setBusy(''); }
  };
  const applyReview = async (decision: 'approved' | 'rejected') => {
    if (!review || lock.current) return;
    if (decision === 'rejected' && !reason.trim()) { setError('반려 사유를 입력해 주세요.'); return; }
    if (decision === 'approved' && (!payroll.payType || !Number.isSafeInteger(Number(payroll.unitPrice)) || Number(payroll.unitPrice) <= 0 || Number(payroll.unitPrice) > 1_000_000_000)) { setError('승인 전에 급여 구분과 올바른 단가를 입력해 주세요.'); return; }
    lock.current = true; const uid = activeUid.current; setBusy('처리 중…'); setError('');
    try { await service.review(review.id, decision, reason, decision === 'approved' ? { payType: payroll.payType, unitPrice: Number(payroll.unitPrice) } : undefined); if (uid !== activeUid.current) return; setReview(null); setNotice(decision === 'approved' ? '승인하여 통합DB에 작업자를 등록했습니다.' : '신청을 반려했습니다.'); await load(); }
    catch (cause) { if (uid === activeUid.current) setError(errorText(cause)); }
    finally { lock.current = false; setBusy(''); }
  };
  const openDocument = async (row: TeamWorkerRequest, id: string) => {
    if (lock.current) return; lock.current = true; const uid = activeUid.current, sequence = generation.current; setBusy('서류를 불러오는 중…'); setError('');
    try { const file = await service.document(row.id, id); if (uid !== activeUid.current || sequence !== generation.current) return; if (previewRef.current) URL.revokeObjectURL(previewRef.current.preview); setPreview({ id, kind: row.attachments.find(doc => doc.id === id)!.kind, file, preview: URL.createObjectURL(file) }); }
    catch (cause) { if (uid === activeUid.current) setError(errorText(cause)); }
    finally { lock.current = false; setBusy(''); }
  };
  const selectedTeam = data?.teams.find(team => team.id === teamId);
  const disabled = loading || loadingMore || Boolean(busy) || confirm || Boolean(review) || Boolean(preview);
  const warningsList = Object.values(warnings).flatMap(value => value || []);
  const differentHolder = Boolean(fields.accountHolder && fields.name && fields.accountHolder.trim() !== fields.name.trim());
  return <main className="team-worker-request">
    <header className="worker-page-heading"><div><h1><FilePlus2 size={28} />{data?.canReview ? '작업자 등록 승인' : '신규 작업자 등록'}</h1><p>서류와 입력 내용을 확인한 후 승인 요청하세요. 사무실 승인 후 통합DB에 등록됩니다.</p></div><button type="button" disabled={disabled} onClick={() => void load()}><RefreshCw size={16} />새로고침</button></header>
    {error && !confirm && !review && <p role="alert" className="worker-error">{error}</p>}{notice && <p role="status" className="worker-notice">{notice}</p>}{busy && <p role="status" className="worker-busy">{busy}</p>}{loading && <p role="status">신청 내역을 불러오고 있습니다…</p>}
    {data && data.teams.length > 0 && <form className="worker-form" onSubmit={event => { event.preventDefault(); if (disabled) return; try { validate(); setError(''); setConfirm(true); } catch (cause) { setError(errorText(cause)); } }}>
      <div className="worker-affiliation"><div><span>현재 소속팀</span>{data.teams.length > 1 && <select aria-label="현재 소속팀" value={teamId} disabled={disabled} required onChange={event => { setTeamId(event.target.value); resetRequest(); }}><option value="">소속팀 선택</option>{data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>}{selectedTeam && <TeamTag {...selectedTeam} />}</div><div><span>소속회사</span><strong>{data.company.name}</strong></div></div>
      {!teamId && <p>현재 소속팀을 먼저 선택해 주세요.</p>}
      <div className="worker-upload-grid">{(['identity', 'bank'] as const).map(kind => <UploadBox key={kind} kind={kind} document={documents.find(doc => doc.kind === kind)} disabled={disabled || !teamId} onFile={file => attach(kind, file)} onRemove={() => removeDocument(kind)} onAnalyze={() => void analyze(documents.find(doc => doc.kind === kind)!)} />)}</div>
      {warningsList.length > 0 && <div className="worker-warning"><strong>분석 후 확인할 항목</strong><ul>{warningsList.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
      <h2>등록 정보 확인</h2><p>자동 입력된 값은 원본과 비교하고 수정해 주세요. 연락처가 사진에 없으면 직접 입력해 주세요.</p>
      <fieldset disabled={disabled} className="worker-input-grid">{(Object.keys(fieldLabels) as Array<keyof WorkerRegistrationFields>).map(key => <label key={key}>{fieldLabels[key]}{['name', 'address', 'contact'].includes(key) ? ' *' : ''}<input value={fields[key]} required={['name', 'address', 'contact'].includes(key) || documents.some(doc => doc.kind === 'bank')} maxLength={key === 'address' ? 300 : 80} inputMode={['contact', 'accountNumber'].includes(key) ? 'tel' : 'text'} autoComplete="off" onChange={event => { setFields(previous => ({ ...previous, [key]: event.target.value })); resetRequest(); }} /></label>)}</fieldset>
      {differentHolder && <p className="worker-warning">이름과 예금주가 다릅니다. 통장 원본과 예금주를 확인해 주세요.</p>}
      <div className="worker-actions end"><button type="submit" className="primary" disabled={disabled}>등록 전 미리보기</button></div>
    </form>}
    {data && !data.teams.length && !data.canReview && <p className="worker-warning">현재 소속팀이 없습니다. 사무실에서 작업자와 소속팀 연결을 확인해 주세요.</p>}
    {data && <section className="worker-history"><header><h2>{data.canReview ? '작업자 등록 신청' : '내 신청 내역'}</h2><div className="worker-actions"><label>조회 월<input type="month" value={yearMonth} disabled={disabled || documents.length > 0} onChange={event => { if (event.target.value) setYearMonth(event.target.value); }} /></label><label>처리 상태<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">전체</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></header>
      <p>불러온 {data.requests.length}건 기준으로 표시합니다.</p>
      {data.nextCursor && <button type="button" disabled={disabled} onClick={() => void loadMore()}>{loadingMore ? '추가 조회 중…' : '다음 100건 더 보기'}</button>}
      {data.requests.filter(row => filter === 'all' || row.status === filter).length === 0 && <p className="worker-empty">해당하는 신청이 없습니다.</p>}
      <div className="worker-request-list">{data.requests.filter(row => filter === 'all' || row.status === filter).map(row => <article key={row.id}><header><h3>{row.name}</h3><span className={`worker-status ${row.status}`}>{statusLabels[row.status]}</span></header><TeamTag name={row.teamName} color={row.teamColor} icon={row.teamIcon} /><p>{row.companyName} · 신청자 {row.submitterName}</p><p>{row.contact} · {row.submittedAt.slice(0, 10)}</p>{row.reviewReason && <p className="worker-warning">반려 사유: {row.reviewReason}</p>}<button type="button" disabled={disabled} onClick={() => { setReview(row); setReason(''); setError(''); setPayroll({ payType: '', unitPrice: '' }); }}>서류 및 신청 내용 {data.canReview && row.status === 'pending' ? '검토' : '보기'}</button></article>)}</div>
    </section>}
    {confirm && <Modal title="작업자 등록 전 미리보기" onClose={() => { if (!busy) setConfirm(false); }}><p>이름·주소·연락처·계좌를 원본과 비교해 주세요. 승인할 소속회사와 팀도 확인해 주세요.</p><div className="worker-affiliation">{selectedTeam && <TeamTag {...selectedTeam} />}<strong>{data?.company.name}</strong></div><FieldSummary fields={fields} />{differentHolder && <p className="worker-warning">이름과 예금주가 다릅니다. 제출 전에 확인해 주세요.</p>}<div className="worker-upload-grid">{documents.map(doc => <DocumentPreview key={doc.id} document={doc} />)}</div>{error && <p role="alert" className="worker-error">{error}</p>}<div className="worker-actions end"><button disabled={Boolean(busy)} onClick={() => setConfirm(false)}>돌아가서 수정</button><button className="primary" disabled={Boolean(busy)} onClick={() => void save()}>{busy || '확인 후 승인 요청'}</button></div></Modal>}
    {data?.canReview && <TeamRequestDraftMaintenance key={currentUser?.uid} service={service} />}
    {review && <Modal title="작업자 신청 검토" onClose={() => { if (!busy) setReview(null); }}><div className="worker-affiliation"><TeamTag name={review.teamName} color={review.teamColor} icon={review.teamIcon} /><strong>{review.companyName}</strong><span>{statusLabels[review.status]}</span></div><FieldSummary fields={review} />{review.accountHolder && review.accountHolder !== review.name && <p className="worker-warning">이름과 예금주가 다릅니다. 통장 원본을 확인해 주세요.</p>}<div className="worker-actions">{review.attachments.map(doc => <button key={doc.id} disabled={Boolean(busy)} onClick={() => void openDocument(review, doc.id)}>{doc.kind === 'identity' ? '신분증' : '통장'} 원본 보기</button>)}</div>{review.reviewReason && <p className="worker-warning">반려 사유: {review.reviewReason}</p>}{error && <p role="alert" className="worker-error">{error}</p>}{data?.canReview && review.status === 'pending' && review.ownerUid !== currentUser?.uid && <><p>승인하면 위 정보와 확인한 급여 설정으로 통합DB에 등록됩니다.</p><div className="worker-input-grid"><label>승인 급여 구분<select value={payroll.payType} disabled={Boolean(busy)} onChange={event => setPayroll(previous => ({ ...previous, payType: event.target.value }))}><option value="">급여 구분 선택</option>{["일급제", "주급제", "월급제", "지원팀", "용역팀", "가지급"].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>승인 단가 (원)<input type="number" min="1" max="1000000000" step="1" value={payroll.unitPrice} disabled={Boolean(busy)} onChange={event => setPayroll(previous => ({ ...previous, unitPrice: event.target.value }))} /></label></div><p>급여 구분과 단가는 사무실에서 확인해야 하며 자동으로 추정하지 않습니다.</p><label>반려 사유<textarea value={reason} maxLength={500} disabled={Boolean(busy)} onChange={event => setReason(event.target.value)} /></label><div className="worker-actions end"><button disabled={Boolean(busy)} onClick={() => void applyReview('rejected')}>반려</button><button className="primary" disabled={Boolean(busy)} onClick={() => void applyReview('approved')}>승인 후 통합DB 등록</button></div></>}{busy && <p role="status">{busy}</p>}</Modal>}
    {preview && <Modal title="첨부 서류 원본" onClose={() => { URL.revokeObjectURL(preview.preview); setPreview(null); }}><DocumentPreview document={preview} /></Modal>}
  </main>;
}
