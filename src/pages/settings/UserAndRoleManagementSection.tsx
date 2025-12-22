import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserShield, faUserTag, faInfoCircle, faSpinner, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { useNavigate } from 'react-router-dom';

const UserAndRoleManagementSection: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserData[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, workersData] = await Promise.all([
                userService.getAllUsers(),
                manpowerService.getWorkers()
            ]);
            setUsers(usersData);
            setWorkers(workersData);
        } catch (error) {
            console.error("Failed to load users/workers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (uid: string, newRole: string) => {
        if (!window.confirm(`사용자의 시스템 권한을 '${newRole}'(으)로 변경하시겠습니까?`)) return;

        setUpdating(uid);
        try {
            await userService.updateUserRole(uid, newRole);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole as any } : u));
        } catch (error) {
            console.error("Failed to update role:", error);
            alert("권한 변경 실패");
        } finally {
            setUpdating(null);
        }
    };

    const getLinkedWorkerInfo = (linkedWorkerIds?: string[]) => {
        if (!linkedWorkerIds || linkedWorkerIds.length === 0) return null;
        // For simplicity, take the first linked worker (usually 1:1)
        const workerId = linkedWorkerIds[0];
        const worker = workers.find(w => w.id === workerId);
        return worker;
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500"><FontAwesomeIcon icon={faSpinner} spin /> 로딩 중...</div>;
    }

    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                    <FontAwesomeIcon icon={faUserShield} /> 권한 관리 (시스템 vs 직책)
                </h2>
            </div>

            <div className="p-6 space-y-6">
                {/* Intro / Explanation */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-4">
                    <div className="text-blue-500 mt-1"><FontAwesomeIcon icon={faInfoCircle} size="lg" /></div>
                    <div className="text-sm text-blue-800">
                        <h4 className="font-bold mb-1">권한 구분 가이드</h4>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><strong>시스템 권한 (System Role):</strong> 앱 로그인 후 메뉴 접근 권한을 제어합니다. (예: 관리자, 사용자, 매니저)</li>
                            <li><strong>직책 (Job Position):</strong> 현장에서의 역할입니다. 노무비, 팀장 수당 등에 영향을 줍니다. (예: 팀장, 기공, 조공)</li>
                        </ul>
                    </div>
                </div>

                {/* User Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-3">사용자 (이메일/이름)</th>
                                <th className="p-3">시스템 권한 (앱 접근)</th>
                                <th className="p-3">연동된 작업자 (직책)</th>
                                <th className="p-3 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(user => {
                                const linkedWorker = getLinkedWorkerInfo(user.linkedWorkerIds);
                                return (
                                    <tr key={user.uid} className="hover:bg-slate-50 transition">
                                        <td className="p-3">
                                            <div className="font-bold text-slate-800">{user.displayName || '이름 없음'}</div>
                                            <div className="text-xs text-slate-500">{user.email}</div>
                                        </td>
                                        <td className="p-3">
                                            <select
                                                className={`border rounded px-2 py-1 text-xs font-bold ${user.role === 'admin' ? 'bg-red-50 text-red-600 border-red-200' :
                                                        user.role === 'manager' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                            'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}
                                                value={user.role || 'user'}
                                                onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                                                disabled={!!updating}
                                            >
                                                <option value="user">일반 사용자 (User)</option>
                                                <option value="manager">매니저 (Manager)</option>
                                                <option value="admin">관리자 (Admin)</option>
                                            </select>
                                            {updating === user.uid && <FontAwesomeIcon icon={faSpinner} spin className="ml-2 text-slate-400" />}
                                        </td>
                                        <td className="p-3">
                                            {linkedWorker ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{linkedWorker.name}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${linkedWorker.role === '팀장' ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {linkedWorker.role || '직책 없음'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs">- 연동 안됨 -</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => navigate('/manpower/worker-registration')}
                                                className="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded text-slate-600"
                                            >
                                                <FontAwesomeIcon icon={faUserTag} className="mr-1" />
                                                직책 변경
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="text-xs text-slate-400 text-right">
                    * 직책 변경은 작업자 관리 페이지에서 수행합니다.
                </div>
            </div>
        </section>
    );
};

export default UserAndRoleManagementSection;
