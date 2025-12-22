import React, { useState, useEffect } from 'react';
import { userService, UserData } from '../../services/userService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserShield, faUser, faEnvelope, faCalendar, faSearch } from '@fortawesome/free-solid-svg-icons';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await userService.getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (uid: string, newRole: any) => {
        if (!window.confirm(`해당 사용자의 권한을 '${newRole}'(으)로 변경하시겠습니까?`)) return;

        try {
            await userService.updateUserRole(uid, newRole);
            setUsers(prev => prev.map(user =>
                user.uid === uid ? { ...user, role: newRole } : user
            ));
            alert('권한이 변경되었습니다.');
        } catch (error) {
            console.error("Failed to update role", error);
            alert('권한 변경에 실패했습니다.');
        }
    };

    const filteredUsers = users.filter(user =>
        (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || '')
    );

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUserShield} className="text-brand-600" />
                        사용자 권한 관리
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">시스템 사용자의 권한을 관리합니다.</p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="이름 또는 이메일 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 w-64"
                    />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-slate-400" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 border-b border-slate-200">사용자</th>
                                <th className="px-6 py-4 border-b border-slate-200">이메일</th>
                                <th className="px-6 py-4 border-b border-slate-200">최근 접속</th>
                                <th className="px-6 py-4 border-b border-slate-200">현재 권한</th>
                                <th className="px-6 py-4 border-b border-slate-200">권한 변경</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-10">로딩중...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-400">사용자가 없습니다.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                                                        <FontAwesomeIcon icon={faUser} />
                                                    </div>
                                                )}
                                                <span className="font-bold text-slate-700">{user.displayName || '이름 없음'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faEnvelope} className="text-slate-400" />
                                                {user.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faCalendar} className="text-slate-400" />
                                                {user.lastLogin?.toDate().toLocaleString() || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${['관리자', 'admin'].includes(user.role || '') ? 'bg-red-100 text-red-700' :
                                                ['대표', 'manager', '메니저'].includes(user.role || '') ? 'bg-orange-100 text-orange-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                {user.role || '일반'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={user.role || '일반'}
                                                onChange={(e) => handleRoleChange(user.uid, e.target.value as any)}
                                                className="border-slate-300 rounded-lg text-sm p-1.5 focus:ring-brand-500 focus:border-brand-500"
                                            >
                                                <option value="일반">일반</option>
                                                <option value="메니저">메니저</option>
                                                <option value="대표">대표</option>
                                                <option value="관리자">관리자</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
