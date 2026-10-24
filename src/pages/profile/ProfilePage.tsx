import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, CircleAlert, Link2, Loader2, Pencil, RefreshCw, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedRequestGuard } from '../../hooks/useUnsavedRequestGuard';
import { userService, UserData } from '../../services/userService';
import { profileConnectionService, ProfileConnections } from '../../services/profileConnectionService';
import { ACCOUNT_TYPE_LABELS, getAccountRelationRoleLabel } from '../../types/accountLink';
import { isAdminAccessRole } from '../../utils/accessRoles';
import AccountLinkingModal from '../../components/manpower/AccountLinkingModal';
import {
    buildOfficeStaffDetails, buildWorkerDetails, formatDateLike, formatManDay, getWorkerPositionName,
    getWorkerTeamName, personalDetailLabels, profileStatus, ProfileDraft, ProfileErrors,
    toManDayNumber, validateProfileDraft,
} from './profilePresentation';
import './ProfilePage.css';

const emptyConnections = (): ProfileConnections => ({ workers: [], officeStaff: [], links: [], unavailable: [] });
const draftFor = (user: UserData): ProfileDraft => ({ displayName: user.displayName || '', phoneNumber: user.phoneNumber || '' });
const sections = [
    { id: 'basic', label: '기본 정보' },
    { id: 'connections', label: '소속·연결' },
    { id: 'personal', label: '급여·개인정보' },
    { id: 'account', label: '계정 정보' },
] as const;
type SectionId = typeof sections[number]['id'];
const Details = ({ items }: { items: Array<{ label: string; value: string }> }) => (
    <dl className="profile-details">{items.map(item => <div key={item.label}>
        <dt>{item.label}</dt><dd>{item.value || '미등록'}</dd>
    </div>)}</dl>
);

export default function ProfilePage() {
    const { currentUser } = useAuth();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [connections, setConnections] = useState<ProfileConnections>(emptyConnections);
    const [loading, setLoading] = useState(true);
    const [connectionsLoading, setConnectionsLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<ProfileDraft>({ displayName: '', phoneNumber: '' });
    const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [section, setSection] = useState<SectionId>('basic');
    const [showLinkingModal, setShowLinkingModal] = useState(false);
    const [photoFailed, setPhotoFailed] = useState(false);
    const basicSequence = useRef(0);
    const connectionSequence = useRef(0);
    const saveLock = useRef<string | null>(null);
    const activeUid = useRef(currentUser?.uid);
    activeUid.current = currentUser?.uid;
    const nameInput = useRef<HTMLInputElement>(null);
    const phoneInput = useRef<HTMLInputElement>(null);
    const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
    const baseline = userData ? draftFor(userData) : { displayName: '', phoneNumber: '' };
    const dirty = editing && (draft.displayName !== baseline.displayName || draft.phoneNumber !== baseline.phoneNumber);
    useUnsavedRequestGuard(dirty || saving);

    useEffect(() => {
        if (!dirty && !saving) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, saving]);
    useEffect(() => { if (editing) nameInput.current?.focus(); }, [editing]);

    const loadConnections = useCallback(async (user: UserData) => {
        const sequence = ++connectionSequence.current;
        setConnectionsLoading(true);
        try {
            const next = await profileConnectionService.load(user);
            if (sequence === connectionSequence.current && activeUid.current === user.uid) setConnections(next);
        } catch {
            if (sequence === connectionSequence.current && activeUid.current === user.uid) {
                setConnections({ ...emptyConnections(), unavailable: ['소속·연결 정보'] });
            }
        } finally {
            if (sequence === connectionSequence.current && activeUid.current === user.uid) setConnectionsLoading(false);
        }
    }, []);

    const loadProfile = useCallback(async () => {
        const uid = currentUser?.uid;
        const sequence = ++basicSequence.current;
        connectionSequence.current++;
        setLoading(true); setError(''); setSuccess(''); setConnections(emptyConnections());
        if (!uid) { setUserData(null); setLoading(false); return; }
        try {
            const user = await userService.getUser(uid, true);
            if (sequence !== basicSequence.current || activeUid.current !== uid) return;
            if (!user) throw new Error('profile-not-found');
            setUserData(user); setDraft(draftFor(user));
            void loadConnections(user);
        } catch {
            if (sequence === basicSequence.current && activeUid.current === uid) {
                setUserData(null); setError('기본 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            }
        } finally {
            if (sequence === basicSequence.current && activeUid.current === uid) setLoading(false);
        }
    }, [currentUser?.uid, loadConnections]);

    useEffect(() => {
        setUserData(null); setEditing(false); setSaving(false); saveLock.current = null;
        setFieldErrors({}); setSection('basic'); setShowLinkingModal(false); setPhotoFailed(false);
        void loadProfile();
        return () => { basicSequence.current++; connectionSequence.current++; };
    }, [loadProfile]);

    const discardChanges = () => {
        if (saving) return false;
        if (dirty && !window.confirm('저장하지 않은 변경 사항을 취소할까요?')) return false;
        if (userData) setDraft(draftFor(userData));
        setEditing(false); setFieldErrors({}); setError('');
        return true;
    };
    const selectSection = (id: SectionId) => {
        if (id === section) return true;
        if (editing && !discardChanges()) return false;
        setSection(id); return true;
    };
    const changeField = (field: keyof ProfileDraft, value: string) => {
        setDraft(previous => ({ ...previous, [field]: value }));
        setFieldErrors(previous => ({ ...previous, [field]: undefined }));
        setError(''); setSuccess('');
    };
    const saveProfile = async (event: React.FormEvent) => {
        event.preventDefault();
        const uid = currentUser?.uid;
        if (!uid || !userData || saveLock.current || !dirty) return;
        const errors = validateProfileDraft(draft);
        setFieldErrors(errors); setSuccess(''); setError('');
        if (Object.keys(errors).length) {
            (errors.displayName ? nameInput : phoneInput).current?.focus();
            return;
        }
        const next = { displayName: draft.displayName.trim(), phoneNumber: draft.phoneNumber.trim() };
        saveLock.current = uid; setSaving(true);
        try {
            // Personal edits never modify employee roles or account access.
            await userService.updateUserProfile(uid, next);
            if (activeUid.current !== uid || saveLock.current !== uid) return;
            setUserData(previous => previous?.uid === uid ? { ...previous, ...next } : previous);
            setDraft(next); setEditing(false); setSuccess('기본 정보가 저장되었습니다.');
        } catch {
            if (activeUid.current === uid && saveLock.current === uid) {
                setError('저장하지 못했습니다. 입력한 내용은 유지됩니다. 연결 상태를 확인하고 다시 저장해 주세요.');
            }
        } finally {
            if (saveLock.current === uid) { saveLock.current = null; setSaving(false); }
        }
    };

    if (loading || (userData && userData.uid !== currentUser?.uid)) return <div className="profile-page profile-loading" role="status">
        <Loader2 className="profile-spin" size={26} /><p>프로필 정보를 불러오는 중입니다.</p>
    </div>;
    if (!currentUser) return <div className="profile-page profile-empty">로그인 후 프로필을 확인할 수 있습니다.</div>;
    if (!userData) return <div className="profile-page"><div className="profile-card profile-empty">
        <CircleAlert size={28} /><p role="alert">{error}</p>
        <button className="profile-button" onClick={() => void loadProfile()}><RefreshCw size={16} />다시 불러오기</button>
    </div></div>;

    const status = profileStatus(userData.status);
    const canManageConnections = [userData.role, userData.position, ...(userData.additionalPositions || [])].some(isAdminAccessRole);
    const teamNames = Array.from(new Set([
        ...connections.workers.map(getWorkerTeamName),
        ...connections.officeStaff.map(staff => staff.department?.trim() || '사무실'),
    ])).join(', ') || userData.department || '소속 정보 미등록';
    const positionNames = Array.from(new Set([
        ...connections.workers.map(getWorkerPositionName), ...connections.officeStaff.map(staff => staff.role?.trim() || ''),
    ].filter(Boolean))).join(', ') || userData.position || '직책 미등록';
    const records = [
        ...connections.workers.map(worker => ({ key: `worker-${worker.id}`, name: worker.name, type: '작업자', details: buildWorkerDetails(worker) })),
        ...connections.officeStaff.map(staff => ({ key: `office-${staff.id}`, name: staff.name, type: '사무실 직원', details: buildOfficeStaffDetails(staff) })),
    ];
    const visibleLinks = connections.links.filter(link => link.status !== 'inactive');
    const joinedAt = formatDateLike(userData.createdAt) || formatDateLike(currentUser.metadata?.creationTime) || '가입일 정보 없음';

    return <div className="profile-page">
        <div className="profile-container">
            <header className="profile-page-heading">
                <div><p className="profile-eyebrow">내 계정</p><h1>프로필 설정</h1><p>기본 정보와 소속, 계정 상태를 확인하세요.</p></div>
            </header>
            <section className="profile-card profile-identity" aria-label="프로필 요약">
                <div className="profile-avatar">{userData.photoURL && !photoFailed
                    ? <img src={userData.photoURL} alt="프로필 사진" onError={() => setPhotoFailed(true)} />
                    : <UserRound size={32} aria-hidden="true" />}</div>
                <div className="profile-identity-copy"><h2>{userData.displayName || '이름 미등록'}</h2>
                    <p className="profile-email">{userData.email || '이메일 미등록'}</p><p className="profile-affiliation">{teamNames} · {positionNames}</p>
                </div>
                <span className={`profile-badge profile-status-${status.tone}`}>{status.label}</span>
            </section>
            <div className="profile-notice-slot" aria-live="polite">{success && <div className="profile-notice profile-notice-success" role="status"><Check size={18} />{success}</div>}</div>
            {error && <div className="profile-notice profile-notice-error" role="alert"><CircleAlert size={18} />{error}</div>}
            <nav className="profile-tabs" role="tablist" aria-label="프로필 정보 영역">
                {sections.map((item, index) => <button key={item.id} ref={element => { tabButtons.current[index] = element; }}
                    type="button" role="tab" id={`profile-tab-${item.id}`} aria-controls={`profile-panel-${item.id}`}
                    aria-selected={section === item.id} tabIndex={section === item.id ? 0 : -1}
                    onClick={() => selectSection(item.id)} onKeyDown={event => {
                        const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1;
                        if (next < 0) return;
                        event.preventDefault();
                        if (selectSection(sections[next].id)) tabButtons.current[next]?.focus();
                    }}>{item.label}</button>)}
            </nav>
            <div className="profile-layout">
                <main className="profile-card profile-main-panel" role="tabpanel" id={`profile-panel-${section}`} aria-labelledby={`profile-tab-${section}`} tabIndex={0}>
                    {section === 'basic' && <>
                        <div className="profile-section-heading"><div><h2>기본 정보</h2><p>이름과 연락처를 직접 수정할 수 있습니다.</p></div>
                            {!editing && <button type="button" className="profile-button" onClick={() => { setEditing(true); setError(''); setSuccess(''); }}><Pencil size={16} />편집</button>}
                        </div>
                        {editing ? <form onSubmit={saveProfile} noValidate aria-label="기본 정보 편집" aria-busy={saving}>
                            <div className="profile-form-field"><label htmlFor="profile-display-name">이름 <span aria-hidden="true">*</span></label>
                                <input ref={nameInput} id="profile-display-name" name="displayName" autoComplete="name" required maxLength={50} value={draft.displayName} disabled={saving}
                                    aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? 'profile-name-error' : undefined}
                                    onChange={event => changeField('displayName', event.target.value)} />
                                {fieldErrors.displayName && <p id="profile-name-error" className="profile-field-error">{fieldErrors.displayName}</p>}
                            </div>
                            <div className="profile-form-field"><label htmlFor="profile-phone">연락처 <span className="profile-optional">선택</span></label>
                                <input ref={phoneInput} id="profile-phone" name="phoneNumber" type="tel" autoComplete="tel" maxLength={30} value={draft.phoneNumber} disabled={saving}
                                    placeholder="010-0000-0000" aria-invalid={Boolean(fieldErrors.phoneNumber)} aria-describedby={fieldErrors.phoneNumber ? 'profile-phone-error' : 'profile-phone-hint'}
                                    onChange={event => changeField('phoneNumber', event.target.value)} />
                                <p id="profile-phone-hint" className="profile-help">연락받을 전화번호를 입력해 주세요.</p>
                                {fieldErrors.phoneNumber && <p id="profile-phone-error" className="profile-field-error">{fieldErrors.phoneNumber}</p>}
                            </div>
                            <div className="profile-edit-bar"><span role="status">{saving ? '저장하고 있습니다.' : dirty ? '저장하지 않은 변경 사항이 있습니다.' : '수정할 내용을 입력해 주세요.'}</span>
                                <div><button className="profile-button profile-button-secondary" type="button" disabled={saving} onClick={discardChanges}><X size={16} />취소</button>
                                    <button className="profile-button" type="submit" disabled={saving || !dirty}>{saving ? <Loader2 className="profile-spin" size={16} /> : <Save size={16} />}{saving ? '저장 중' : '저장'}</button></div>
                            </div>
                        </form> : <Details items={[{ label: '이름', value: userData.displayName || '' }, { label: '연락처', value: userData.phoneNumber || '' }, { label: '로그인 이메일', value: userData.email || '' }]} />}
                        <p className="profile-section-note"><ShieldCheck size={17} />이메일은 로그인 계정 기준입니다. 소속과 직책은 관리자에게 변경을 요청해 주세요.</p>
                    </>}
                    {(section === 'connections' || section === 'personal') && <>
                        <div className="profile-section-heading"><div><h2>{section === 'connections' ? '소속·연결' : '급여·개인정보'}</h2><p>{section === 'connections' ? '계정에 연결된 소속과 담당 정보를 확인합니다.' : '연결된 직원 정보에 등록된 내용을 표시합니다.'}</p></div>
                            {section === 'connections' && canManageConnections && <button type="button" className="profile-button" onClick={() => setShowLinkingModal(true)}><Link2 size={16} />계정 연동</button>}
                        </div>
                        {connectionsLoading && <p className="profile-inline-loading" role="status"><Loader2 size={16} className="profile-spin" />연결 정보를 불러오는 중입니다.</p>}
                        {connections.unavailable.length > 0 && <div className="profile-notice profile-notice-warning" role="status"><div><strong>일부 정보를 확인하지 못했습니다.</strong><p>{connections.unavailable.join(', ')}를 불러오지 못했습니다. 기본 정보는 계속 사용할 수 있습니다.</p><button className="profile-text-button" disabled={connectionsLoading} onClick={() => void loadConnections(userData)}>연결 정보 다시 불러오기</button></div></div>}
                        {section === 'connections' && <>
                            <Details items={[{ label: '팀·부서', value: teamNames }, { label: '직책', value: positionNames }]} />
                            <p className="profile-section-note">소속·직책 변경은 관리자가 처리합니다.{canManageConnections && <Link to="/admin/user-management">직책·권한 관리 →</Link>}</p>
                            {visibleLinks.length > 0 && <div className="profile-link-list" aria-label="계정 연결 상태">{visibleLinks.map(link => <div className="profile-link-row" key={link.id || `${link.entityType}-${link.entityId}`}>
                                <div><strong>{link.entityName || '연결 대상'}</strong><p>{link.entitySubType} · {getAccountRelationRoleLabel(link.relationRole, link.entityType)}</p>{link.status === 'rejected' && link.rejectionReason && <p>{link.rejectionReason}</p>}</div>
                                <span className={`profile-badge profile-status-${link.status}`}>{link.status === 'active' ? '연결됨' : link.status === 'pending' ? '승인 대기' : '반려'}</span>
                            </div>)}</div>}
                        </>}
                        {records.map(record => {
                            const details = record.details.filter(item => section === 'personal' ? personalDetailLabels.has(item.label) : !personalDetailLabels.has(item.label) && !['작업자명', '사무실 직원명'].includes(item.label));
                            return <section className="profile-record" key={record.key}><div className="profile-record-heading"><h3>{record.name}</h3><span>{record.type}</span></div>
                                {details.length ? <Details items={details} /> : <p className="profile-help">등록된 상세 정보가 없습니다.</p>}
                            </section>;
                        })}
                        {!connectionsLoading && !records.length && (section === 'personal' || !visibleLinks.length) && <div className="profile-empty"><Building2 size={28} /><p>{connections.unavailable.length ? '현재 표시할 수 있는 상세 정보가 없습니다.' : '연결된 직원 정보가 없습니다.'}</p><span>연결이나 정보 수정이 필요하면 관리자에게 문의해 주세요.</span></div>}
                    </>}
                    {section === 'account' && <>
                        <div className="profile-section-heading"><div><h2>계정 정보</h2><p>가입 정보와 현재 계정 상태입니다.</p></div></div>
                        <Details items={[
                            { label: '가입일', value: joinedAt },
                            { label: '최근 접속', value: formatDateLike(userData.lastLogin) || '접속 기록 없음' },
                            { label: '계정 상태', value: status.label },
                            { label: '계정 유형', value: userData.accountType ? ACCOUNT_TYPE_LABELS[userData.accountType] || '유형 확인 필요' : '유형 미등록' },
                            { label: '권한', value: isAdminAccessRole(userData.role) ? '관리자' : userData.role === 'manager' ? '매니저' : userData.role === 'user' || !userData.role ? '일반 사용자' : userData.role },
                        ]} />
                    </>}
                </main>
                <aside className="profile-aside" aria-label="연결 요약">
                    <section className="profile-card"><div className="profile-aside-heading"><Building2 size={19} /><h2>연결 현황</h2></div>
                        {connectionsLoading ? <p role="status" className="profile-help">확인 중입니다.</p> : <>
                            <dl className="profile-counts"><div><dt>작업자</dt><dd>{connections.workers.length}명</dd></div><div><dt>사무실 직원</dt><dd>{connections.officeStaff.length}명</dd></div></dl>
                            {connections.unavailable.length > 0 && <p className="profile-help">일부 정보 확인 필요</p>}
                            <button className="profile-text-button" onClick={() => selectSection('connections')}>소속·연결 확인 →</button>
                        </>}
                    </section>
                    {connections.workers.length > 0 && <section className="profile-card profile-manday"><h2>누적공수</h2><p><strong>{formatManDay(connections.workers.reduce((sum, worker) => sum + toManDayNumber(worker.totalManDay), 0))}</strong> 공수</p><span>연결된 작업자 {connections.workers.length}명 기준{connections.unavailable.includes('작업자 상세 정보') ? ' · 조회된 정보만 집계' : ''}</span></section>}
                </aside>
            </div>
        </div>
        {showLinkingModal && canManageConnections && <AccountLinkingModal lockedUserId={userData.uid} actorEmail={currentUser.email || 'system'} onClose={() => { setShowLinkingModal(false); void loadProfile(); }} />}
    </div>;
}
