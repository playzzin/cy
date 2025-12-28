import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faWon, faSpinner, faCheck, faSave, faUsers, faEdit
} from '@fortawesome/free-solid-svg-icons';
import { supportRateService, SupportRate } from '../../services/supportRateService';
import { teamService, Team } from '../../services/teamService';
import { toast } from '../../utils/swal';

const SupportRateManagementPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [rates, setRates] = useState<Record<string, number>>({});
    const [editingRates, setEditingRates] = useState<Record<string, number>>({});
    const [bulkRate, setBulkRate] = useState<number>(0);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [teamsData, ratesData] = await Promise.all([
                    teamService.getTeams(),
                    supportRateService.getAllRates()
                ]);
                setTeams(teamsData);

                // Convert rates array to object
                const ratesMap: Record<string, number> = {};
                ratesData.forEach(r => {
                    ratesMap[r.teamId] = r.defaultRate || 0;
                });
                setRates(ratesMap);
                setEditingRates(ratesMap);
            } catch (error) {
                console.error('Failed to load data:', error);
                toast.error('데이터 로드 실패');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleRateChange = (teamId: string, value: number) => {
        setEditingRates(prev => ({
            ...prev,
            [teamId]: value
        }));
    };

    const handleSaveTeamRate = async (team: Team) => {
        const teamId = team.id!;
        const newRate = editingRates[teamId] || 0;

        if (newRate === rates[teamId]) {
            toast.info('변경된 내용이 없습니다.');
            return;
        }

        setSaving(true);
        try {
            await supportRateService.saveRate({
                teamId,
                teamName: team.name,
                defaultRate: newRate
            });
            setRates(prev => ({ ...prev, [teamId]: newRate }));
            toast.success(`${team.name} 단가가 저장되었습니다.`);
        } catch (error) {
            console.error('Failed to save rate:', error);
            toast.error('저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkApply = async () => {
        if (!bulkRate || bulkRate <= 0) {
            toast.warning('일괄 적용할 단가를 입력해주세요.');
            return;
        }

        const confirmed = window.confirm(`모든 팀에 ${bulkRate.toLocaleString()}원을 일괄 적용하시겠습니까?`);
        if (!confirmed) return;

        setSaving(true);
        try {
            await Promise.all(
                teams.map(team =>
                    supportRateService.saveRate({
                        teamId: team.id!,
                        teamName: team.name,
                        defaultRate: bulkRate
                    })
                )
            );

            const newRates: Record<string, number> = {};
            teams.forEach(t => { newRates[t.id!] = bulkRate; });
            setRates(newRates);
            setEditingRates(newRates);
            toast.success('모든 팀에 단가가 적용되었습니다.');
        } catch (error) {
            console.error('Failed to apply bulk rate:', error);
            toast.error('일괄 적용 실패');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR').format(amount);
    };

    const isChanged = (teamId: string) => {
        return (editingRates[teamId] || 0) !== (rates[teamId] || 0);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faWon} className="text-green-600" />
                            지원비 단가 관리
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            팀별 지원비 단가를 설정합니다.
                        </p>
                    </div>

                    {/* Bulk Apply */}
                    <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-4 py-2">
                        <span className="text-sm text-slate-600 font-medium">일괄 적용:</span>
                        <input
                            type="number"
                            value={bulkRate || ''}
                            onChange={(e) => setBulkRate(Number(e.target.value))}
                            placeholder="단가 입력"
                            className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-right text-sm"
                        />
                        <span className="text-sm text-slate-500">원</span>
                        <button
                            onClick={handleBulkApply}
                            disabled={saving || !bulkRate}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            {saving ? (
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                            ) : (
                                <FontAwesomeIcon icon={faSave} />
                            )}
                            전체 적용
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <FontAwesomeIcon icon={faSpinner} className="text-4xl text-indigo-600 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {teams.map(team => {
                            const teamId = team.id!;
                            const currentRate = rates[teamId] || 0;
                            const editingRate = editingRates[teamId] || 0;
                            const changed = isChanged(teamId);

                            return (
                                <div
                                    key={teamId}
                                    className={`bg-white rounded-xl border-2 p-4 transition-all ${changed
                                            ? 'border-amber-400 shadow-amber-100 shadow-lg'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    {/* Team Header */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                            <FontAwesomeIcon icon={faUsers} className="text-indigo-600 text-sm" />
                                        </div>
                                        <span className="font-bold text-slate-800 truncate flex-1">
                                            {team.name}
                                        </span>
                                    </div>

                                    {/* Rate Input */}
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={editingRate || ''}
                                            onChange={(e) => handleRateChange(teamId, Number(e.target.value))}
                                            placeholder="0"
                                            className={`w-full px-3 py-2 border rounded-lg text-right text-lg font-bold transition-colors ${changed
                                                    ? 'border-amber-400 bg-amber-50'
                                                    : 'border-slate-200 bg-slate-50'
                                                }`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                            원
                                        </span>
                                    </div>

                                    {/* Current Value */}
                                    {currentRate > 0 && !changed && (
                                        <div className="mt-2 text-xs text-slate-500 text-center">
                                            현재: {formatCurrency(currentRate)}원
                                        </div>
                                    )}

                                    {/* Save Button (only show when changed) */}
                                    {changed && (
                                        <button
                                            onClick={() => handleSaveTeamRate(team)}
                                            disabled={saving}
                                            className="w-full mt-3 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            {saving ? (
                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                            ) : (
                                                <FontAwesomeIcon icon={faCheck} />
                                            )}
                                            저장
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between text-sm text-slate-600">
                <span>총 {teams.length}개 팀</span>
                <span>
                    단가 설정됨: {Object.values(rates).filter(r => r > 0).length}개
                </span>
            </div>
        </div>
    );
};

export default SupportRateManagementPage;
