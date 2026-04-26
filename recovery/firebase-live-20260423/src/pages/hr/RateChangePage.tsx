import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBillWave, faArrowLeft, faSave, faEdit, faSearch, faUser, faChartLine, faPercentage, faWonSign } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';

interface RateChange {
    workerId: string;
    workerName: string;
    currentRate: number;
    newRate: number;
    teamName: string;
    teamId: string;
    role: string;
}

const RateChangePage: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [changes, setChanges] = useState<RateChange[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [bulkRate, setBulkRate] = useState<string>('');

    // 직책 목록
    const roles = ['신규자', '일반공', '기능공', '반장', '팀장', '사장'];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [workersData, teamsData] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams()
            ]);
            setWorkers(workersData);
            setTeams(teamsData);
            
            // 초기 변경 데이터 설정
            const initialChanges = workersData.map(worker => ({
                workerId: worker.id || '',
                workerName: worker.name,
                currentRate: worker.unitPrice || 0,
                newRate: worker.unitPrice || 0,
                teamName: worker.teamName || '',
                teamId: worker.teamId || '',
                role: worker.role || '작업자'
            }));
            setChanges(initialChanges);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    // 단가 변경
    const handleRateChange = (workerId: string, newRate: string) => {
        const rate = parseFloat(newRate) || 0;
        const newChanges = changes.map(change => 
            change.workerId === workerId 
                ? { ...change, newRate: rate }
                : change
        );
        setChanges(newChanges);
    };

    // 필터링된 작업자
    const getFilteredWorkers = () => {
        return changes.filter(change => {
            const matchesSearch = change.workerName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTeam = !selectedTeam || change.teamName === selectedTeam;
            const matchesRole = !selectedRole || change.role === selectedRole;
            return matchesSearch && matchesTeam && matchesRole;
        });
    };

    // 일괄 단가 변경
    const handleBulkRateChange = () => {
        if (!bulkRate) {
            alert('변경할 단가를 입력해주세요.');
            return;
        }

        const rate = parseFloat(bulkRate);
        if (isNaN(rate) || rate < 0) {
            alert('유효한 단가를 입력해주세요.');
            return;
        }

        const filteredWorkers = getFilteredWorkers();
        const newChanges = changes.map(change => {
            const isTarget = filteredWorkers.find(w => w.workerId === change.workerId);
            return isTarget ? { ...change, newRate: rate } : change;
        });
        setChanges(newChanges);
        setBulkRate('');
        alert(`${filteredWorkers.length}명의 작업자 단가를 ${rate.toLocaleString()}원으로 변경했습니다.`);
    };

    // 단가 저장
    const handleSaveChanges = async () => {
        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const change of changes) {
                if (change.currentRate !== change.newRate) {
                    try {
                        const worker = workers.find(w => w.id === change.workerId);
                        if (worker && worker.id) {
                            await manpowerService.updateWorker(worker.id, {
                                ...worker,
                                unitPrice: change.newRate
                            });
                            successCount++;
                        }
                    } catch (error) {
                        console.error(`단가 변경 실패 (${change.workerName}):`, error);
                        errorCount++;
                    }
                }
            }

            if (successCount > 0 || errorCount > 0) {
                alert(`단가 변경 완료!\n성공: ${successCount}명\n실패: ${errorCount}명`);
                await fetchData();
            } else {
                alert('변경된 단가가 없습니다.');
            }
        } catch (error) {
            console.error("단가 변경 저장 실패:", error);
            alert("단가 변경 저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 단가 통계
    const getRateStats = () => {
        const filtered = getFilteredWorkers();
        const totalCurrent = filtered.reduce((sum, w) => sum + w.currentRate, 0);
        const totalNew = filtered.reduce((sum, w) => sum + w.newRate, 0);
        const changed = filtered.filter(w => w.currentRate !== w.newRate);
        
        return {
            count: filtered.length,
            changed: changed.length,
            totalCurrent,
            totalNew,
            difference: totalNew - totalCurrent,
            avgCurrent: filtered.length > 0 ? totalCurrent / filtered.length : 0,
            avgNew: filtered.length > 0 ? totalNew / filtered.length : 0
        };
    };

    // 단가 포맷
    const formatRate = (rate: number) => {
        return rate.toLocaleString() + '원';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* 헤더 */}
            <div className="mb-6">
                <button
                    onClick={() => window.history.back()}
                    className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    뒤로 가기
                </button>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-green-600" />
                    💰 단가 변경 관리
                </h1>
                <p className="text-gray-600 mt-2">
                    작업자의 단가를 변경하고 관리합니다. 개별 또는 일괄 단가 변경이 가능합니다.
                </p>
            </div>

            {/* 검색 및 필터 영역 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="작업자명 검색..."
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="">전체 팀</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.name}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="">전체 직책</option>
                            {roles.map(role => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleSaveChanges}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </div>

            {/* 일괄 변경 영역 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">🔄 일괄 단가 변경</h3>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faWonSign} className="text-green-600" />
                        <input
                            type="number"
                            value={bulkRate}
                            onChange={(e) => setBulkRate(e.target.value)}
                            placeholder="변경할 단가 입력"
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            min="0"
                        />
                    </div>
                    <button
                        onClick={handleBulkRateChange}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faPercentage} />
                        선택된 작업자 {getFilteredWorkers().length}명 일괄 변경
                    </button>
                </div>
            </div>

            {/* 단가 통계 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">📊 단가 현황</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">{getRateStats().count}</div>
                        <div className="text-sm text-gray-600">대상 작업자</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">{getRateStats().changed}</div>
                        <div className="text-sm text-gray-600">변경된 작업자</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded">
                        <div className="text-lg font-bold text-purple-600">
                            {formatRate(getRateStats().avgCurrent)}
                        </div>
                        <div className="text-sm text-gray-600">평균 단가</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded">
                        <div className="text-lg font-bold text-orange-600">
                            {getRateStats().difference > 0 ? '+' : ''}{formatRate(getRateStats().difference)}
                        </div>
                        <div className="text-sm text-gray-600">총 변동액</div>
                    </div>
                </div>
            </div>

            {/* 작업자 목록 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">작업자 목록</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        총 {getFilteredWorkers().length}명의 작업자
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">작업자명</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">소속 팀</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">직책</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">현재 단가</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">변경 단가</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">변동액</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {getFilteredWorkers().map((change) => (
                                <tr key={change.workerId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faUser} className="text-gray-600 text-sm" />
                                            <span className="font-medium text-gray-900">{change.workerName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{change.teamName || '-'}</td>
                                    <td className="px-4 py-3 text-gray-600">{change.role}</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                                        {formatRate(change.currentRate)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            value={change.newRate}
                                            onChange={(e) => handleRateChange(change.workerId, e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            min="0"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {change.currentRate !== change.newRate && (
                                            <span className={`font-medium ${
                                                change.newRate > change.currentRate ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {change.newRate > change.currentRate ? '+' : ''}
                                                {formatRate(change.newRate - change.currentRate)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {change.currentRate !== change.newRate ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <FontAwesomeIcon icon={faEdit} className="mr-1" />
                                                변경됨
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                동일
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 단가 변경 가이드 */}
            <div className="mt-6 bg-green-50 rounded-lg border border-green-200 p-4">
                <h3 className="font-semibold text-green-800 mb-2">📋 단가 변경 가이드</h3>
                <div className="text-sm text-green-700 space-y-1">
                    <p>• <strong>개별 변경:</strong> 각 작업자의 단가를 직접 입력하여 변경</p>
                    <p>• <strong>일괄 변경:</strong> 검색된 작업자들을 한 번에 동일한 단가로 변경</p>
                    <p>• <strong>필터링:</strong> 팀, 직책으로 필터링하여 대상 작업자 선택</p>
                    <p>• <strong>변동액:</strong> 현재 단가와 변경 단가의 차이를 자동 계산</p>
                    <p>• <strong>저장:</strong> 변경사항을 반드시 [변경사항 저장] 버튼으로 저장</p>
                </div>
            </div>
        </div>
    );
};

export default RateChangePage;
