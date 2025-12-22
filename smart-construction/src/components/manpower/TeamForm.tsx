import React, { useState, useEffect } from 'react';
import { Team, teamService } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { Company } from '../../services/companyService';

interface TeamFormProps {
    initialData?: Partial<Team>;
    teams: Team[];
    workers: Worker[];
    companies: Company[];
    onSave: () => void;
    onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ initialData, teams, workers, companies, onSave, onCancel }) => {
    const [currentTeam, setCurrentTeam] = useState<Partial<Team>>(initialData || { type: '본팀' });

    const salaryModelOptions = ['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'];

    const handleSave = async () => {
        try {
            // Find leader name
            const leader = workers.find(w => w.id === currentTeam.leaderId);
            // Find company name
            const company = companies.find(c => c.id === currentTeam.companyId);
            // Find parent team name
            const parentTeam = teams.find(t => t.id === currentTeam.parentTeamId);

            const teamData = {
                ...currentTeam,
                leaderName: leader ? leader.name : '',
                companyName: company ? company.name : '',
                parentTeamName: parentTeam ? parentTeam.name : ''
            };

            if (currentTeam.id) {
                await teamService.updateTeam(currentTeam.id, teamData);

                // Sync Name Change if needed
                if (initialData?.name && currentTeam.name && initialData.name !== currentTeam.name) {
                    await manpowerService.updateWorkersTeamName(currentTeam.id, currentTeam.name);
                }

                const prevDefaultSalaryModel = initialData?.defaultSalaryModel ?? '';
                const nextDefaultSalaryModel = currentTeam.defaultSalaryModel ?? '';
                if (prevDefaultSalaryModel !== nextDefaultSalaryModel && nextDefaultSalaryModel) {
                    const ok = window.confirm('팀 기본 지급구분이 변경되었습니다. 이 팀의 모든 작업자 지급구분도 일괄 변경할까요?');
                    if (ok) {
                        await manpowerService.updateWorkersSalaryModelByTeam(currentTeam.id, nextDefaultSalaryModel);
                    }
                }
            } else {
                await teamService.addTeam(teamData as Team);
            }
            onSave();
        } catch (error) {
            console.error("Failed to save team", error);
            alert("저장에 실패했습니다.");
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">
                {currentTeam.id ? '팀 수정' : '팀 등록'}
            </h2>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">팀명</label>
                        <input
                            type="text"
                            value={currentTeam.name || ''}
                            onChange={(e) => setCurrentTeam({ ...currentTeam, name: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                            placeholder="팀명을 입력하세요"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">회사명</label>
                        <select
                            value={currentTeam.companyId || ''}
                            onChange={(e) => setCurrentTeam({ ...currentTeam, companyId: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="">선택안함</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">팀유형</label>
                        <select
                            value={currentTeam.type || '작업팀'}
                            onChange={(e) => {
                                const nextType = e.target.value;
                                setCurrentTeam(prev => {
                                    const next: Partial<Team> = { ...prev, type: nextType };
                                    if (!prev.defaultSalaryModel) {
                                        if (nextType === '지원팀') next.defaultSalaryModel = '지원팀';
                                        if (nextType === '용역팀') next.defaultSalaryModel = '용역팀';
                                    }
                                    return next;
                                });
                            }}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="본팀">본팀</option>
                            <option value="관리팀">관리팀</option>
                            <option value="새끼팀">새끼팀</option>
                            <option value="지원팀">지원팀</option>
                            <option value="용역팀">용역팀</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">기본 지급구분</label>
                        <select
                            value={currentTeam.defaultSalaryModel || ''}
                            onChange={(e) => setCurrentTeam({ ...currentTeam, defaultSalaryModel: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="">선택안함</option>
                            {salaryModelOptions.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">팀장 선택</label>
                        <select
                            value={currentTeam.leaderId || ''}
                            onChange={(e) => setCurrentTeam({ ...currentTeam, leaderId: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="">선택안함</option>
                            {workers.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.name} ({w.teamType}/{w.role || '작업자'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">팀 색상</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={currentTeam.color || '#2563eb'}
                                onChange={(e) => setCurrentTeam({ ...currentTeam, color: e.target.value })}
                                className="h-9 w-9 rounded border border-slate-300 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={currentTeam.color || ''}
                                onChange={(e) => setCurrentTeam({ ...currentTeam, color: e.target.value })}
                                placeholder="#2563eb"
                                className="flex-1 border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border font-mono"
                            />
                        </div>
                    </div>
                </div>

                {currentTeam.type !== '본팀' && currentTeam.type !== '관리팀' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">상위 팀 (본팀/관리팀)</label>
                        <select
                            value={currentTeam.parentTeamId || ''}
                            onChange={(e) => setCurrentTeam({ ...currentTeam, parentTeamId: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="">선택안함</option>
                            {teams.filter(t => t.type === '본팀' || t.type === '관리팀').map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-300 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
                    >
                        {currentTeam.id ? '수정 완료' : '등록 완료'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamForm;
