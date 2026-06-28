import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { officeStaffService, OfficeStaff } from '../../services/officeStaffService';
import { accountLinkService } from '../../services/accountLinkService';
import { AccountLink, ACCOUNT_TYPE_LABELS, getAccountRelationRoleLabel } from '../../types/accountLink';
import AccountLinkingModal from '../../components/manpower/AccountLinkingModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faPhone, faBuilding, faLink, faEdit, faSave, faTimes, faHardHat, faCalendar, faShieldAlt, faChartLine } from '@fortawesome/free-solid-svg-icons';

const getWorkerTeamName = (worker: Worker): string => {
    const teamName = String(worker.teamName || '').trim();
    if (teamName) return teamName;

    const teamId = String(worker.teamId || '').trim();
    return teamId || '팀 미배정';
};

const getWorkerPositionName = (worker: Worker): string => {
    const rank = String(worker.rank || '').trim();
    if (rank) return rank;

    return String(worker.role || '').trim();
};

const toManDayNumber = (value: unknown): number => {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const formatManDay = (value: number): string =>
    value.toLocaleString('ko-KR', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
        maximumFractionDigits: 1,
    });

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeEmail = (value: unknown): string => toText(value).toLowerCase();

const getWorkerKeys = (worker: Worker): string[] =>
    Array.from(new Set([worker.id, worker.legacyId].map(toText).filter(Boolean)));

const getOfficeStaffKeys = (staff: OfficeStaff): string[] =>
    Array.from(new Set([staff.id, staff.legacyId].map(toText).filter(Boolean)));

const formatCurrency = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return String(value);
    return `${numericValue.toLocaleString('ko-KR')}원`;
};

const formatDateLike = (value: any): string => {
    const date = value?.toDate?.() instanceof Date ? value.toDate() : value instanceof Date ? value : null;
    return date ? date.toLocaleString('ko-KR') : '';
};

const formatEmploymentStatus = (record: { status?: unknown; isActive?: unknown }): string => {
    if (record.isActive === false) return '퇴사';

    const status = toText(record.status).toLowerCase();
    if (!status) return record.isActive === true ? '재직중' : '';

    if (['inactive', 'resigned', 'retired', '퇴사', '퇴사자', '출입금지'].includes(status)) {
        return '퇴사';
    }

    if (['active', 'employed', 'working', '재직', '재직중', '근무', '미배정'].includes(status)) {
        return '재직중';
    }

    return toText(record.status);
};

const buildWorkerDetails = (worker: Worker): Array<{ label: string; value: string }> => {
    const details = [
        { label: '작업자명', value: toText(worker.name) },
        { label: '주민번호', value: toText(worker.idNumber) },
        { label: '작업자 연락처', value: toText(worker.contact) },
        { label: '작업자 이메일', value: toText(worker.email) },
        { label: '주소', value: toText(worker.address) },
        { label: '팀 유형', value: toText(worker.teamType) },
        { label: '회사', value: toText(worker.companyName || worker.companyId) },
        { label: '현장', value: toText(worker.siteName || worker.siteId) },
        { label: '직무', value: toText(worker.role) },
        { label: '고용형태', value: toText(worker.employmentType) },
        { label: '급여유형', value: toText(worker.salaryModel || worker.payType) },
        { label: '단가', value: formatCurrency(worker.unitPrice) },
        { label: '누적공수', value: `${formatManDay(toManDayNumber(worker.totalManDay))}공수` },
        { label: '은행', value: toText(worker.bankName) },
        { label: '계좌번호', value: toText(worker.accountNumber) },
        { label: '예금주', value: toText(worker.accountHolder) },
        { label: '상태', value: formatEmploymentStatus(worker) },
        { label: '혈액형', value: toText(worker.bloodType) },
        { label: '등록일', value: formatDateLike(worker.createdAt) },
        { label: '수정일', value: formatDateLike(worker.updatedAt) },
    ];

    return details.filter((item) => item.value);
};

const buildOfficeStaffDetails = (staff: OfficeStaff): Array<{ label: string; value: string }> => {
    const details = [
        { label: '사무실 직원명', value: toText(staff.name) },
        { label: '주민번호', value: toText(staff.idNumber) },
        { label: '사무실 연락처', value: toText(staff.contact) },
        { label: '사무실 이메일', value: toText(staff.email) },
        { label: '주소', value: toText(staff.address) },
        { label: '부서', value: toText(staff.department) },
        { label: '직책', value: toText(staff.role) },
        { label: '고용형태', value: toText(staff.employmentType) },
        { label: '급여유형', value: toText(staff.salaryModel || staff.payType) },
        { label: '단가', value: formatCurrency(staff.unitPrice) },
        { label: '은행', value: toText(staff.bankName) },
        { label: '계좌번호', value: toText(staff.accountNumber) },
        { label: '예금주', value: toText(staff.accountHolder) },
        { label: '입사일', value: toText(staff.joinDate) },
        { label: '상태', value: formatEmploymentStatus(staff) },
        { label: '메모', value: toText(staff.memo) },
        { label: '등록일', value: formatDateLike(staff.createdAt) },
        { label: '수정일', value: formatDateLike(staff.updatedAt) },
    ];

    return details.filter((item) => item.value);
};

const ProfilePage: React.FC = () => {
    const { currentUser } = useAuth();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [linkedWorkers, setLinkedWorkers] = useState<Worker[]>([]);
    const [linkedOfficeStaff, setLinkedOfficeStaff] = useState<OfficeStaff[]>([]);
    const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
    const handleUnlink = async (workerId: string) => {
        if (!currentUser || !window.confirm('정말로 이 작업자와의 연결을 해제하시겠습니까?')) return;

        try {
            await userService.unlinkUserFromWorker(currentUser.uid, workerId);
            setLinkedWorkers(prev => prev.filter(w => w.id !== workerId));
            setSuccess('연결이 해제되었습니다.');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('연결 해제 실패:', err);
            setError('연결 해제에 실패했습니다.');
        }
    };
    const handleOfficeStaffUnlink = async (staffId: string) => {
        if (!currentUser || !window.confirm('정말로 이 사무실 직원과의 연결을 해제하시겠습니까?')) return;

        try {
            await userService.unlinkUserFromOfficeStaff(currentUser.uid, staffId);
            setLinkedOfficeStaff(prev => prev.filter(staff => staff.id !== staffId));
            setSuccess('연결이 해제되었습니다.');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('사무실 직원 연결 해제 실패:', err);
            setError('연결 해제에 실패했습니다.');
        }
    };
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [showLinkingModal, setShowLinkingModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        displayName: ''
    });

    // Extended form data for profile fields
    const [profileData, setProfileData] = useState({
        phoneNumber: '',
        position: ''
    });

    const linkedProfileTeamName = useMemo(() => {
        const groupNames = Array.from(
            new Set([
                ...linkedWorkers.map(getWorkerTeamName),
                ...linkedOfficeStaff.map((staff) => toText(staff.department) || '사무실'),
            ].filter(Boolean))
        );

        return groupNames.length > 0 ? groupNames.join(', ') : '연결된 계정 정보 없음';
    }, [linkedOfficeStaff, linkedWorkers]);

    const linkedProfilePositionName = useMemo(() => {
        const positionNames = Array.from(
            new Set([
                ...linkedWorkers.map(getWorkerPositionName),
                ...linkedOfficeStaff.map((staff) => toText(staff.role)),
            ].filter(Boolean))
        );

        return positionNames.join(', ');
    }, [linkedOfficeStaff, linkedWorkers]);

    const linkedProfileContact = useMemo(() => {
        const contacts = Array.from(
            new Set([
                ...linkedWorkers.map((worker) => toText(worker.contact)),
                ...linkedOfficeStaff.map((staff) => toText(staff.contact)),
            ].filter(Boolean))
        );

        return contacts.join(', ');
    }, [linkedOfficeStaff, linkedWorkers]);

    const linkedWorkerTotalManDay = useMemo(
        () => linkedWorkers.reduce((total, worker) => total + toManDayNumber(worker.totalManDay), 0),
        [linkedWorkers]
    );

    const visibleAccountLinks = useMemo(
        () => accountLinks.filter((link) => link.status !== 'inactive' && link.status !== 'rejected'),
        [accountLinks]
    );

    useEffect(() => {
        loadUserData();
    }, [currentUser]);

    const loadUserData = async () => {
        if (!currentUser) {
            setUserData(null);
            setLinkedWorkers([]);
            setLinkedOfficeStaff([]);
            setAccountLinks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [user, links, allWorkers, allOfficeStaff] = await Promise.all([
                userService.getUser(currentUser.uid),
                accountLinkService.getLinksByUid(currentUser.uid),
                manpowerService.getWorkers(true),
                officeStaffService.getOfficeStaff(true),
            ]);
            setUserData(user);
            setAccountLinks(links);

            const workerByKey = new Map<string, Worker>();
            const selectedWorkers = new Map<string, Worker>();
            const officeStaffByKey = new Map<string, OfficeStaff>();
            const selectedOfficeStaff = new Map<string, OfficeStaff>();
            const currentEmail = normalizeEmail(currentUser.email);

            const addSelectedWorker = (worker?: Worker | null) => {
                if (!worker?.id) return;
                selectedWorkers.set(String(worker.id), worker);
            };
            const addSelectedOfficeStaff = (staff?: OfficeStaff | null) => {
                if (!staff?.id) return;
                selectedOfficeStaff.set(String(staff.id), staff);
            };

            allWorkers.forEach((worker) => {
                getWorkerKeys(worker).forEach((key) => workerByKey.set(key, worker));

                if (worker.uid === currentUser.uid) {
                    addSelectedWorker(worker);
                    return;
                }

                if (currentEmail && normalizeEmail(worker.email) === currentEmail) {
                    addSelectedWorker(worker);
                }
            });

            allOfficeStaff.forEach((staff) => {
                getOfficeStaffKeys(staff).forEach((key) => officeStaffByKey.set(key, staff));

                if (staff.uid === currentUser.uid) {
                    addSelectedOfficeStaff(staff);
                    return;
                }

                if (currentEmail && normalizeEmail(staff.email) === currentEmail) {
                    addSelectedOfficeStaff(staff);
                }
            });

            (user?.linkedWorkerIds || [])
                .map(toText)
                .filter(Boolean)
                .forEach((workerId) => addSelectedWorker(workerByKey.get(workerId)));
            (user?.linkedOfficeStaffIds || [])
                .map(toText)
                .filter(Boolean)
                .forEach((staffId) => addSelectedOfficeStaff(officeStaffByKey.get(staffId)));

            links
                .filter((link) => link.entityType === 'worker' && link.status === 'active')
                .map((link) => toText(link.entityId))
                .filter(Boolean)
                .forEach((workerId) => addSelectedWorker(workerByKey.get(workerId)));
            links
                .filter((link) => link.entityType === 'office' && link.status === 'active' && link.entityId !== 'office')
                .map((link) => toText(link.entityId))
                .filter(Boolean)
                .forEach((staffId) => addSelectedOfficeStaff(officeStaffByKey.get(staffId)));

            const nextLinkedWorkers = Array.from(selectedWorkers.values()).sort((a, b) =>
                toText(a.name).localeCompare(toText(b.name), 'ko-KR')
            );
            const nextLinkedOfficeStaff = Array.from(selectedOfficeStaff.values()).sort((a, b) =>
                toText(a.name).localeCompare(toText(b.name), 'ko-KR')
            );
            const workerPositions = Array.from(
                new Set([
                    ...nextLinkedWorkers.map(getWorkerPositionName),
                    ...nextLinkedOfficeStaff.map((staff) => toText(staff.role)),
                ].filter(Boolean))
            );
            const workerContacts = Array.from(
                new Set([
                    ...nextLinkedWorkers.map((worker) => toText(worker.contact)),
                    ...nextLinkedOfficeStaff.map((staff) => toText(staff.contact)),
                ].filter(Boolean))
            );

            setLinkedWorkers(nextLinkedWorkers);
            setLinkedOfficeStaff(nextLinkedOfficeStaff);

            // Set form data
            setFormData({
                displayName: user?.displayName || ''
            });

            // Set profile data
            setProfileData({
                phoneNumber: user?.phoneNumber || workerContacts.join(', '),
                position: workerPositions.join(', ') || user?.position || ''
            });
        } catch (err) {
            console.error('사용자 정보 로드 실패:', err);
            setError('사용자 정보를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentUser) return;

        try {
            await userService.updateUserProfile(currentUser.uid, {
                displayName: formData.displayName,
                phoneNumber: profileData.phoneNumber,
                position: profileData.position
            });

            const nextPosition = profileData.position.trim();
            if (nextPosition && !nextPosition.includes(',')) {
                await Promise.all([
                    ...linkedWorkers.map(worker =>
                        worker.id ? manpowerService.updateWorker(worker.id, { role: nextPosition }) : Promise.resolve()
                    ),
                    ...linkedOfficeStaff.map(staff =>
                        staff.id ? officeStaffService.updateOfficeStaff(staff.id, { role: nextPosition }) : Promise.resolve()
                    )
                ]);
            }

            await loadUserData();
            setEditing(false);
            setSuccess('프로필이 업데이트되었습니다. (직책 권한 동기화 완료)');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('프로필 업데이트 실패:', err);
            setError('프로필 업데이트에 실패했습니다.');
        }
    };

    const handleCancel = () => {
        if (userData) {
            setFormData({
                displayName: userData.displayName || ''
            });
            setProfileData({
                phoneNumber: userData.phoneNumber || linkedProfileContact,
                position: linkedProfilePositionName || userData.position || ''
            });
        }
        setEditing(false);
        setError(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <FontAwesomeIcon icon={faUser} spin className="text-4xl text-blue-500 mb-4" />
                    <p className="text-slate-500">프로필 정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] font-['Pretendard']">
            {/* 페이지 헤더 */}
            <header className="bg-white border-b border-slate-200 px-6 pt-6 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <FontAwesomeIcon icon={faUser} className="text-3xl text-blue-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">프로필 설정</h1>
                            <p className="text-sm text-slate-500">개인 정보 및 계정 연동 관리</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {editing ? (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <FontAwesomeIcon icon={faSave} />
                                    저장
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <FontAwesomeIcon icon={faEdit} />
                                편집
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* 콘텐츠 영역 */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 기본 정보 */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* 프로필 카드 */}
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <div className="flex items-center gap-6 mb-6">
                                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                    {userData?.photoURL ? (
                                        <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <FontAwesomeIcon icon={faUser} className="text-3xl text-slate-400" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{userData?.displayName || '이름 없음'}</h2>
                                    <p className="text-slate-500">{userData?.email}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <div className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full">
                                            <FontAwesomeIcon icon={faShieldAlt} className="text-slate-500 text-xs" />
                                            <span className="text-xs font-semibold text-slate-600">권한: {userData?.role === 'admin' ? '최고 관리자' : (userData?.role === 'manager' ? '관리자' : '사용자')}</span>
                                        </div>
                                        {userData?.accountType && (
                                            <div className="flex items-center gap-1 px-3 py-1 bg-cyan-50 rounded-full">
                                                <FontAwesomeIcon icon={faLink} className="text-cyan-500 text-xs" />
                                                <span className="text-xs font-semibold text-cyan-700">유형: {ACCOUNT_TYPE_LABELS[userData.accountType]}</span>
                                            </div>
                                        )}
                                        {userData?.position && (
                                            <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-full">
                                                <FontAwesomeIcon icon={faUser} className="text-blue-500 text-xs" />
                                                <span className="text-xs font-semibold text-blue-600">직책: {userData.position}</span>
                                            </div>
                                        )}
                                        <span className={`text-xs px-2 py-1 rounded-full ${userData?.status === 'pending' ? 'bg-amber-100 text-amber-700' : userData?.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-green-100 text-green-700'}`}>
                                            {userData?.status === 'pending' ? '승인 대기' : userData?.status === 'rejected' ? '반려' : '계정 활성'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <FontAwesomeIcon icon={faUser} className="mr-2" />
                                        이름
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.displayName}
                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                        disabled={!editing}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${editing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'
                                            }`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
                                        이메일
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            value={userData?.email || ''}
                                            disabled
                                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-slate-50"
                                        />
                                        <button
                                            onClick={() => setShowLinkingModal(true)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                                        >
                                            <FontAwesomeIcon icon={faLink} className="mr-2" />
                                            계정 연동
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">이메일은 변경할 수 없습니다</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <FontAwesomeIcon icon={faPhone} className="mr-2" />
                                        연락처
                                    </label>
                                    <input
                                        type="tel"
                                        value={profileData.phoneNumber}
                                        onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                                        disabled={!editing}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${editing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'
                                            }`}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            <FontAwesomeIcon icon={faBuilding} className="mr-2" />
                                            팀/부서
                                        </label>
                                        <input
                                            type="text"
                                            value={linkedProfileTeamName}
                                            disabled
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            <FontAwesomeIcon icon={faShieldAlt} className="mr-2" />
                                            직책
                                        </label>
                                        <input
                                            type="text"
                                            value={profileData.position}
                                            onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                                            disabled={!editing}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${editing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'
                                                }`}
                                        />
                                    </div>
                                </div>

                                {linkedWorkers.length > 0 || linkedOfficeStaff.length > 0 ? (
                                    <div className="space-y-5 border-t border-slate-200 pt-4">
                                        {linkedWorkers.map((worker, index) => {
                                            const workerDetails = buildWorkerDetails(worker);

                                            return (
                                                <div key={worker.id} className="space-y-4">
                                                    {linkedWorkers.length > 1 && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-sm font-semibold text-slate-700">
                                                                작업자 {index + 1}
                                                            </p>
                                                            <button
                                                                onClick={() => worker.id && handleUnlink(worker.id)}
                                                                className="text-xs font-semibold text-slate-400 hover:text-red-500"
                                                                type="button"
                                                            >
                                                                연결 해제
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {workerDetails.map((item) => (
                                                            <div key={`${worker.id}-${item.label}`}>
                                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                    {item.label}
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={item.value}
                                                                    disabled
                                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {linkedWorkers.length === 1 && (
                                                        <button
                                                            onClick={() => worker.id && handleUnlink(worker.id)}
                                                            className="text-xs font-semibold text-slate-400 hover:text-red-500"
                                                            type="button"
                                                        >
                                                            연결 해제
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {linkedOfficeStaff.map((staff, index) => {
                                            const staffDetails = buildOfficeStaffDetails(staff);
                                            const showHeader = linkedOfficeStaff.length > 1 || linkedWorkers.length > 0;

                                            return (
                                                <div key={staff.id} className="space-y-4">
                                                    {showHeader && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-sm font-semibold text-slate-700">
                                                                사무실 직원 {index + 1}
                                                            </p>
                                                            <button
                                                                onClick={() => staff.id && handleOfficeStaffUnlink(staff.id)}
                                                                className="text-xs font-semibold text-slate-400 hover:text-red-500"
                                                                type="button"
                                                            >
                                                                연결 해제
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {staffDetails.map((item) => (
                                                            <div key={`${staff.id}-${item.label}`}>
                                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                    {item.label}
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={item.value}
                                                                    disabled
                                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {!showHeader && (
                                                        <button
                                                            onClick={() => staff.id && handleOfficeStaffUnlink(staff.id)}
                                                            className="text-xs font-semibold text-slate-400 hover:text-red-500"
                                                            type="button"
                                                        >
                                                            연결 해제
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="border-t border-slate-200 pt-4">
                                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
                                            <FontAwesomeIcon icon={faHardHat} className="text-4xl text-slate-300 mb-4" />
                                            <p className="text-slate-500">연결된 작업자/사무실 직원이 없습니다</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 계정 정보 */}
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">계정 정보</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">가입일</span>
                                    <span className="text-sm font-medium text-slate-800">
                                        {userData?.lastLogin?.toDate().toLocaleString('ko-KR')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">최근 접속</span>
                                    <span className="text-sm font-medium text-slate-800">
                                        {userData?.lastLogin?.toDate().toLocaleString('ko-KR')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">계정 상태</span>
                                    <span className="text-sm font-medium text-green-600">{userData?.status || 'active'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 연결된 작업자 */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">누적공수</p>
                                    <div className="mt-2 flex items-baseline gap-1">
                                        <span className="text-3xl font-bold text-blue-600">
                                            {formatManDay(linkedWorkerTotalManDay)}
                                        </span>
                                        <span className="text-sm font-semibold text-blue-600">공수</span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        {linkedWorkers.length > 0
                                            ? `연결된 작업자 ${linkedWorkers.length}명 기준`
                                            : linkedOfficeStaff.length > 0
                                                ? `사무실 직원 ${linkedOfficeStaff.length}명 연결됨`
                                                : '연결된 작업자 기준으로 집계됩니다'}
                                    </p>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <FontAwesomeIcon icon={faChartLine} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-slate-800">연결된 계정 대상</h3>
                            </div>

                            {visibleAccountLinks.length > 0 ? (
                                <div className="space-y-3">
                                    {visibleAccountLinks.map((link) => (
                                        <div key={link.id || `${link.entityType}-${link.entityId}`} className="p-3 bg-slate-50 rounded-lg">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-slate-800">{link.entityName}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {link.entitySubType} · {getAccountRelationRoleLabel(link.relationRole, link.entityType)}
                                                    </p>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded-full ${link.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {link.status === 'active' ? '활성' : '승인 대기'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FontAwesomeIcon icon={faBuilding} className="text-4xl text-slate-300 mb-4" />
                                    <p className="text-slate-500">연결된 회사/사무실 대상이 없습니다</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 알림 메시지 */}
            {error && (
                <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg shadow-lg">
                    {success}
                </div>
            )}

            {/* 계정 연동 모달 */}
            {showLinkingModal && (
                <AccountLinkingModal onClose={() => {
                    setShowLinkingModal(false);
                    loadUserData(); // 데이터 새로고침
                }} lockedUserId={currentUser?.uid} actorEmail={currentUser?.email || 'system'} />
            )}
        </div>
    );
};

export default ProfilePage;
