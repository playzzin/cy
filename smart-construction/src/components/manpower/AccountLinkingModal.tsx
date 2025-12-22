import React, { useState, useEffect } from 'react';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faLink, faTimes, faUser, faHardHat, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

interface AccountLinkingModalProps {
    onClose: () => void;
}

const AccountLinkingModal: React.FC<AccountLinkingModalProps> = ({ onClose }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

    const [workerSearch, setWorkerSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersData, workersData] = await Promise.all([
                userService.getAllUsers(),
                manpowerService.getWorkers()
            ]);
            setUsers(usersData);
            setWorkers(workersData);

            // Auto-cleanup invalid links
            const workerIds = workersData.map(w => w.id!);
            await userService.cleanupInvalidLinks(usersData, workerIds);

        } catch (err) {
            console.error(err);
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleLink = async () => {
        if (!selectedUser || !selectedWorker) return;

        if (window.confirm(`'${selectedUser.email || selectedUser.displayName}' 사용자를 '${selectedWorker.name}' 작업자와 연결하시겠습니까?`)) {
            setLinking(true);
            setError(null);
            try {
                await userService.linkUserToWorker(selectedUser.uid, selectedWorker.id!);

                // Refresh data to reflect changes
                await fetchData();

                // Reset selection
                setSelectedUser(null);
                setSelectedWorker(null);

                alert('연결이 완료되었습니다.');
            } catch (err: any) {
                console.error(err);
                if (err.message === 'worker-not-found') {
                    setError('해당 작업자를 찾을 수 없습니다.');
                } else if (err.message === 'already-linked-to-same-user') {
                    setError('이미 해당 사용자와 연결된 작업자입니다.');
                } else if (err.message === 'worker-already-managed') {
                    setError('이미 다른 계정에 연결된 작업자입니다. 관리자에게 문의하세요.');
                } else {
                    setError('연결 중 오류가 발생했습니다: ' + err.message);
                }
            } finally {
                setLinking(false);
            }
        }
    };

    const filteredWorkers = workers.filter(w =>
        w.name.includes(workerSearch) ||
        w.teamName?.includes(workerSearch) ||
        w.idNumber.includes(workerSearch)
    );

    // Sort users: Unlinked first, then by last login
    const sortedUsers = [...users].sort((a, b) => {
        const aLinked = (a.linkedWorkerIds?.length || 0) > 0;
        const bLinked = (b.linkedWorkerIds?.length || 0) > 0;
        if (aLinked === bLinked) return b.lastLogin?.seconds - a.lastLogin?.seconds;
        return aLinked ? 1 : -1;
    });

    if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 text-white">로딩중...</div>;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">계정 연동 관리</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Users */}
                    <div className="w-1/2 border-r border-slate-200 flex flex-col bg-white">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
                            <span>로그인 사용자 목록</span>
                            <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-300">
                                총 {users.length}명
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {sortedUsers.map(user => {
                                const isLinked = (user.linkedWorkerIds?.length || 0) > 0;
                                return (
                                    <div
                                        key={user.uid}
                                        onClick={() => setSelectedUser(user)}
                                        className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-3
                                            ${selectedUser?.uid === user.uid
                                                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                                                : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}
                                        `}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <FontAwesomeIcon icon={faUser} className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800 truncate">{user.displayName || '이름 없음'}</p>
                                                {isLinked && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">연동됨</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                최근 접속: {user.lastLogin?.toDate().toLocaleString()}
                                            </p>
                                        </div>
                                        {selectedUser?.uid === user.uid && (
                                            <FontAwesomeIcon icon={faCheckCircle} className="text-brand-600" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel: Workers */}
                    <div className="w-1/2 flex flex-col bg-white">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
                            <span>작업자 목록</span>
                            <div className="relative w-48">
                                <input
                                    type="text"
                                    placeholder="이름, 팀, 주민번호 검색"
                                    value={workerSearch}
                                    onChange={e => setWorkerSearch(e.target.value)}
                                    className="w-full pl-8 pr-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-brand-500"
                                />
                                <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1.5 text-slate-400 text-xs" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredWorkers.map(worker => {
                                const isLinked = !!worker.uid;
                                return (
                                    <div
                                        key={worker.id}
                                        onClick={() => !isLinked && setSelectedWorker(worker)}
                                        className={`p-3 rounded-lg border transition flex items-center gap-3
                                            ${isLinked ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                                            ${selectedWorker?.id === worker.id
                                                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                                                : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}
                                        `}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                                            <FontAwesomeIcon icon={faHardHat} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800 truncate">{worker.name}</p>
                                                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{worker.teamName || '팀 미배정'}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">{worker.idNumber}</p>
                                            {isLinked && <p className="text-[10px] text-red-500 font-bold mt-0.5">이미 연동됨</p>}
                                        </div>
                                        {selectedWorker?.id === worker.id && (
                                            <FontAwesomeIcon icon={faCheckCircle} className="text-brand-600" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                        {selectedUser ? (
                            <span>선택된 사용자: <span className="font-bold text-slate-800">{selectedUser.displayName || selectedUser.email}</span></span>
                        ) : (
                            <span>사용자를 선택해주세요.</span>
                        )}
                        <span className="mx-2 text-slate-300">|</span>
                        {selectedWorker ? (
                            <span>선택된 작업자: <span className="font-bold text-slate-800">{selectedWorker.name}</span></span>
                        ) : (
                            <span>작업자를 선택해주세요.</span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {error && <span className="text-red-500 text-sm font-bold flex items-center mr-2">{error}</span>}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold transition"
                        >
                            닫기
                        </button>
                        <button
                            onClick={handleLink}
                            disabled={!selectedUser || !selectedWorker || linking}
                            className={`px-6 py-2 rounded-lg text-white font-bold flex items-center gap-2 transition
                                ${!selectedUser || !selectedWorker || linking
                                    ? 'bg-slate-300 cursor-not-allowed'
                                    : 'bg-brand-600 hover:bg-brand-700 shadow-lg hover:shadow-xl'}
                            `}
                        >
                            <FontAwesomeIcon icon={faLink} />
                            {linking ? '연결 중...' : '계정 연결하기'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountLinkingModal;
