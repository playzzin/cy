import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandHoldingDollar, faSave, faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';

const SupportSettingsPage: React.FC = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Local state for editing to avoid frequent DB updates
    const [edits, setEdits] = useState<{ [key: string]: Partial<Team> }>({});

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const data = await teamService.getTeams();
            setTeams(data);
        } catch (error) {
            console.error("Error fetching teams:", error);
            alert("팀 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (teamId: string, field: keyof Team, value: any) => {
        setEdits(prev => ({
            ...prev,
            [teamId]: {
                ...prev[teamId],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        const teamIds = Object.keys(edits);
        if (teamIds.length === 0) return;

        setSaving(true);
        try {
            await Promise.all(teamIds.map(id =>
                teamService.updateTeam(id, edits[id])
            ));

            alert(`총 ${teamIds.length}개 팀의 설정이 저장되었습니다.`);
            setEdits({});
            fetchTeams(); // Refresh
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const filteredTeams = teams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const hasChanges = Object.keys(edits).length > 0;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faHandHoldingDollar} className="text-indigo-600" />
                        지원비 설정
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        타 현장/회사로 지원(파견) 나갈 때 청구할 <b>팀 단가</b>를 설정합니다.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`
                        px-4 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2
                        transition-all
                        ${hasChanges
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-slate-300 cursor-not-allowed'}
                    `}
                >
                    {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                    {saving ? '저장 중...' : `변경사항 저장 (${Object.keys(edits).length})`}
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-slate-50">
                    <div className="relative flex-1 max-w-sm">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="팀 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold">팀명</th>
                                <th className="px-6 py-3 font-semibold">시공종목</th>
                                <th className="px-6 py-3 font-semibold">지원비 방식</th>
                                <th className="px-6 py-3 font-semibold">청구 단가 (원)</th>
                                <th className="px-6 py-3 font-semibold">비고</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : filteredTeams.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        검색된 팀이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredTeams.map(team => {
                                    const edit = edits[team.id || ''] || {};
                                    // Current values (Edit > Original)
                                    const currentRate = edit.supportRate !== undefined ? edit.supportRate : team.supportRate;
                                    const currentDesc = edit.supportDescription !== undefined ? edit.supportDescription : team.supportDescription;
                                    // Default to man_day if not set
                                    const currentModel = edit.supportModel || team.supportModel || 'man_day';

                                    const isEdited = !!edits[team.id || ''];

                                    return (
                                        <tr key={team.id} className={`hover:bg-slate-50 transition-colors ${isEdited ? 'bg-indigo-50/30' : ''}`}>
                                            <td className="px-6 py-3 font-medium text-slate-800">
                                                {team.name}
                                                {isEdited && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-indigo-500"></span>}
                                            </td>
                                            <td className="px-6 py-3 text-slate-500">{team.type}</td>
                                            <td className="px-6 py-3">
                                                <select
                                                    value={currentModel}
                                                    onChange={(e) => handleChange(team.id!, 'supportModel', e.target.value)}
                                                    className="border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                                >
                                                    <option value="man_day">공수제 (Man-Day)</option>
                                                    {/* Future proofing: Fixed cost */}
                                                    {/* <option value="fixed">월 고정급</option> */}
                                                </select>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="relative max-w-[150px]">
                                                    <input
                                                        type="number"
                                                        value={currentRate || ''}
                                                        onChange={(e) => handleChange(team.id!, 'supportRate', Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full border border-slate-200 rounded px-3 py-1.5 text-right pr-8 text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                    />
                                                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs">원</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="text"
                                                    value={currentDesc || ''}
                                                    onChange={(e) => handleChange(team.id!, 'supportDescription', e.target.value)}
                                                    placeholder="비고..."
                                                    className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SupportSettingsPage;
