import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import AccountLinkingModal from '../../components/manpower/AccountLinkingModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faPhone, faBuilding, faLink, faEdit, faSave, faTimes, faHardHat, faCalendar, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const ProfilePage: React.FC = () => {
    const { currentUser } = useAuth();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [linkedWorkers, setLinkedWorkers] = useState<Worker[]>([]);
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
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [showLinkingModal, setShowLinkingModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        displayName: '',
        phoneNumber: '',
        department: '',
        position: ''
    });

    // Extended form data for profile fields
    const [profileData, setProfileData] = useState({
        phoneNumber: '',
        department: '',
        position: ''
    });

    useEffect(() => {
        loadUserData();
    }, [currentUser]);

    const loadUserData = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            const user = await userService.getUser(currentUser.uid);
            setUserData(user);

            // Load linked workers
            if (user?.linkedWorkerIds && user.linkedWorkerIds.length > 0) {
                const workers = await Promise.all(
                    user.linkedWorkerIds.map(async (workerId: string) => {
                        try {
                            const worker = await manpowerService.getWorkerByUid(workerId);
                            return worker;
                        } catch {
                            return null;
                        }
                    })
                );
                setLinkedWorkers(workers.filter((w: Worker | null): w is Worker => w !== null));
            }

            // Set form data
            setFormData({
                displayName: user?.displayName || '',
                phoneNumber: '',
                department: '',
                position: ''
            });

            // Set profile data
            setProfileData({
                phoneNumber: user?.phoneNumber || '',
                department: user?.department || '',
                position: user?.position || ''
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
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                displayName: formData.displayName,
                phoneNumber: profileData.phoneNumber,
                department: profileData.department,
                position: profileData.position,
                updatedAt: serverTimestamp()
            });

            // Sync Position to Linked Workers' Rank
            if (linkedWorkers.length > 0 && profileData.position) {
                const { manpowerService } = await import('../../services/manpowerService');
                const updatePromises = linkedWorkers.map(worker =>
                    worker.id ? manpowerService.updateWorker(worker.id, { rank: profileData.position }) : Promise.resolve()
                );
                await Promise.all(updatePromises);
            }

            await loadUserData();
            setEditing(false);
            setSuccess('프로필이 업데이트되었습니다. (현장 직책 동기화 완료)');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('프로필 업데이트 실패:', err);
            setError('프로필 업데이트에 실패했습니다.');
        }
    };

    const handleCancel = () => {
        if (userData) {
            setFormData({
                displayName: userData.displayName || '',
                phoneNumber: '',
                department: '',
                position: ''
            });
            setProfileData({
                phoneNumber: userData.phoneNumber || '',
                department: userData.department || '',
                position: userData.position || ''
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
            <div className="flex-1 overflow-hidden px-6 pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
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
                                        {userData?.position && (
                                            <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-full">
                                                <FontAwesomeIcon icon={faUser} className="text-blue-500 text-xs" />
                                                <span className="text-xs font-semibold text-blue-600">직책: {userData.position}</span>
                                            </div>
                                        )}
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                            계정 활성
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
                                            부서
                                        </label>
                                        <input
                                            type="text"
                                            value={profileData.department}
                                            onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                                            disabled={!editing}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${editing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'
                                                }`}
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
                                    <span className="text-sm font-medium text-green-600">활성</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 연결된 작업자 */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-slate-800">연결된 작업자</h3>
                            </div>

                            {linkedWorkers.length > 0 ? (
                                <div className="space-y-3">
                                    {linkedWorkers.map(worker => (
                                        <div key={worker.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                <FontAwesomeIcon icon={faHardHat} className="text-slate-500" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium text-slate-800 flex items-center gap-2">
                                                            {worker.name}
                                                            {worker.rank && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">{worker.rank}</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{worker.teamName || '팀 미배정'}</p>
                                                    </div>
                                                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                                                        {worker.role || '작업자'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">{worker.idNumber}</p>
                                            </div>
                                            <button
                                                onClick={() => worker.id && handleUnlink(worker.id)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                title="연결 해제"
                                            >
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FontAwesomeIcon icon={faHardHat} className="text-4xl text-slate-300 mb-4" />
                                    <p className="text-slate-500 mb-4">연결된 작업자가 없습니다</p>
                                    <p className="text-slate-500 mb-4">연결된 작업자가 없습니다</p>
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
                }} />
            )}
        </div>
    );
};

export default ProfilePage;
