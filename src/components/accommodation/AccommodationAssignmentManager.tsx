import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faPlus, faTrash, faUsers, faUser, faBuilding, faCalendarAlt, faSearch, faSyncAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { accommodationService } from '../../services/accommodationService';
import { companyService } from '../../services/companyService';
import { Accommodation } from '../../types/accommodation';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { toast } from '../../utils/swal';

type AssignMode = 'team' | 'worker';

type WorkerPickRow = {
    id: string;
    name: string;
};

const toDateInputValue = (d: Date): string => {
    return format(d, 'yyyy-MM-dd');
};

const isActiveAssignment = (a: AccommodationAssignment): boolean => {
    return (a.status ?? 'active') === 'active' && !a.endDate;
};

const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        const maybeCode = (error as unknown as { code?: unknown }).code;
        const codeText = typeof maybeCode === 'string' ? ` (${maybeCode})` : '';
        return `${error.message}${codeText}`.trim();
    }
    if (typeof error === 'string') return error;
    return '알 수 없는 오류가 발생했습니다.';
};

const AccommodationAssignmentManager: React.FC = () => {
    const today = useMemo(() => toDateInputValue(new Date()), []);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [mode, setMode] = useState<AssignMode>('team');

    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);

    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedAccommodationId, setSelectedAccommodationId] = useState('');
    const [startDate, setStartDate] = useState(today);
    const [memo, setMemo] = useState('');

    const [autoEndExisting, setAutoEndExisting] = useState(true);
    const [showEnded, setShowEnded] = useState(false);

    const [workerSearch, setWorkerSearch] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [teamList, workerList, accommodationList, assignmentList, constructionCompanies] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    accommodationService.getAccommodations(),
                    accommodationAssignmentService.getAllAssignments(),
                    companyService.getCompaniesByType('시공사')
                ]);

                const constructionCompanyIdSet = new Set(
                    constructionCompanies
                        .map((c) => c.id)
                        .filter((id): id is string => Boolean(id))
                );
                const constructionCompanyNameSet = new Set(constructionCompanies.map((c) => c.name));

                const allowedTeams = teamList.filter((team) => {
                    if (team.companyId) return constructionCompanyIdSet.has(team.companyId);
                    if (team.companyName) return constructionCompanyNameSet.has(team.companyName);
                    return false;
                });

                const sortedTeams = [...allowedTeams].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'));
                const sortedAccommodations = [...accommodationList].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

                setTeams(sortedTeams);
                setWorkers(workerList);
                setAccommodations(sortedAccommodations);
                setAssignments(assignmentList);

                setSelectedTeamId((prev) => {
                    if (prev) return prev;
                    const fallback = sortedTeams[0]?.id ?? '';
                    return fallback;
                });

                setSelectedAccommodationId((prev) => {
                    if (prev) return prev;
                    const fallback = sortedAccommodations[0]?.id ?? '';
                    return fallback;
                });
            } finally {
                setLoading(false);
            }
        };

        load().catch((e) => {
            console.error(e);
            alert('숙소 배정 데이터를 불러오는데 실패했습니다.');
        });
    }, []);

    const selectedTeam = useMemo(() => {
        return teams.find((t) => t.id === selectedTeamId) ?? null;
    }, [selectedTeamId, teams]);

    const selectedAccommodation = useMemo(() => {
        return accommodations.find((a) => a.id === selectedAccommodationId) ?? null;
    }, [accommodations, selectedAccommodationId]);

    const teamWorkers = useMemo((): WorkerPickRow[] => {
        if (!selectedTeamId) return [];
        return workers
            .filter((w) => Boolean(w.id) && w.teamId === selectedTeamId)
            .map((w) => ({ id: w.id ?? '', name: w.name }))
            .filter((w) => Boolean(w.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [selectedTeamId, workers]);

    const filteredTeamWorkers = useMemo(() => {
        const q = workerSearch.trim();
        if (!q) return teamWorkers;
        return teamWorkers.filter((w) => w.name.includes(q));
    }, [teamWorkers, workerSearch]);

    useEffect(() => {
        if (mode !== 'team') return;
        if (teamWorkers.length === 0) {
            setSelectedWorkerIds([]);
            return;
        }
        setSelectedWorkerIds(teamWorkers.map((w) => w.id));
    }, [mode, teamWorkers]);

    useEffect(() => {
        if (mode !== 'worker') return;
        if (!selectedWorkerId && teamWorkers.length > 0) {
            setSelectedWorkerId(teamWorkers[0].id);
        }
    }, [mode, selectedWorkerId, teamWorkers]);

    const activeAssignmentsByWorkerId = useMemo(() => {
        const map = new Map<string, AccommodationAssignment>();
        assignments.forEach((a) => {
            if (!a.workerId) return;
            if (!isActiveAssignment(a)) return;
            map.set(a.workerId, a);
        });
        return map;
    }, [assignments]);

    const visibleAssignments = useMemo(() => {
        const filtered = showEnded ? assignments : assignments.filter(isActiveAssignment);
        return filtered
            .slice()
            .sort((a, b) => {
                const aKey = `${a.teamName ?? ''}_${a.workerName ?? ''}`;
                const bKey = `${b.teamName ?? ''}_${b.workerName ?? ''}`;
                return aKey.localeCompare(bKey, 'ko-KR');
            });
    }, [assignments, showEnded]);

    const reloadAssignments = async () => {
        const list = await accommodationAssignmentService.getAllAssignments();
        setAssignments(list);
    };

    const handleToggleWorker = (workerId: string) => {
        setSelectedWorkerIds((prev) => {
            if (prev.includes(workerId)) {
                return prev.filter((id) => id !== workerId);
            }
            return [...prev, workerId];
        });
    };

    const handleSelectAllWorkers = (checked: boolean) => {
        if (!checked) {
            setSelectedWorkerIds([]);
            return;
        }
        setSelectedWorkerIds(teamWorkers.map((w) => w.id));
    };

    const handleCreateAssignments = async () => {
        if (!selectedTeam || !selectedTeam.id) {
            toast.error('팀을 선택해주세요.');
            return;
        }
        if (!selectedAccommodation) {
            toast.error('숙소를 선택해주세요.');
            return;
        }
        if (!startDate) {
            toast.error('입실일을 입력해주세요.');
            return;
        }

        const workerIds = mode === 'team' ? selectedWorkerIds : (selectedWorkerId ? [selectedWorkerId] : []);
        if (workerIds.length === 0) {
            toast.error(mode === 'team' ? '배정할 작업자를 선택해주세요.' : '작업자를 선택해주세요.');
            return;
        }

        const uniqueWorkerIds = Array.from(new Set(workerIds));

        const sameAccommodationAlready: string[] = [];
        const conflicts: AccommodationAssignment[] = [];

        uniqueWorkerIds.forEach((workerId) => {
            const active = activeAssignmentsByWorkerId.get(workerId);
            if (!active) return;

            if (active.accommodationId === selectedAccommodation.id) {
                sameAccommodationAlready.push(active.workerName ?? workerId);
                return;
            }

            conflicts.push(active);
        });

        if (sameAccommodationAlready.length > 0) {
            alert(`이미 해당 숙소에 배정된 작업자가 있습니다:\n\n- ${sameAccommodationAlready.join('\n- ')}`);
            return;
        }

        setSaving(true);
        try {
            if (conflicts.length > 0) {
                if (!autoEndExisting) {
                    const names = conflicts.map((c) => c.workerName ?? c.workerId).join(', ');
                    alert(`다른 숙소에 이미 입실 중인 작업자가 있습니다.\n'기존 입실 자동 퇴실'을 체크하거나, 기존 배정을 먼저 종료해주세요.\n\n대상: ${names}`);
                    return;
                }

                const endDate = accommodationAssignmentService.buildEndDateAsDayBefore(startDate);
                const conflictNames = conflicts.map(c => c.workerName).join(', ');
                const ok = window.confirm(
                    `기존 숙소 배정 ${conflicts.length}건을 자동 퇴실 처리하고 새 배정을 진행할까요?\n(퇴실일: ${endDate})\n\n대상: ${conflictNames}`
                );
                if (!ok) return;

                const conflictIds = conflicts.map((c) => c.id).filter((id): id is string => Boolean(id));
                await accommodationAssignmentService.endAssignmentsBatch(conflictIds, endDate);
            }

            const workerMap = new Map(
                workers
                    .filter((w): w is Worker & { id: string } => Boolean(w.id))
                    .map((w) => [w.id, w])
            );

            const toCreate = uniqueWorkerIds
                .map((workerId) => {
                    const worker = workerMap.get(workerId);
                    if (!worker) return null;

                    return {
                        workerId,
                        workerName: worker.name,
                        teamId: selectedTeam.id,
                        teamName: selectedTeam.name,
                        accommodationId: selectedAccommodation.id,
                        accommodationName: selectedAccommodation.name,
                        status: 'active' as const,
                        startDate,
                        endDate: undefined,
                        source: mode === 'team' ? ('team' as const) : ('worker' as const),
                        memo: memo.trim() ? memo.trim() : undefined
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            await accommodationAssignmentService.addAssignmentsBatch(toCreate);
            setMemo('');
            setWorkerSearch('');
            if (mode === 'worker') {
                // If single mode, maybe clear selection or not? keep for consecutive adds
            }
            toast.success(`${toCreate.length}명 배정 완료`);
            await reloadAssignments();
        } catch (e) {
            console.error(e);
            toast.error(`숙소 배정 저장 실패: ${toErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleEndAssignment = async (assignment: AccommodationAssignment) => {
        if (!assignment.id) return;
        if (!isActiveAssignment(assignment)) return;

        const endDate = window.prompt('퇴실일(YYYY-MM-DD)을 입력하세요.', today) ?? '';
        if (!endDate.trim()) return;

        const ok = window.confirm(`퇴실 처리하시겠습니까?\n\n작업자: ${assignment.workerName ?? assignment.workerId}\n숙소: ${assignment.accommodationName ?? assignment.accommodationId}\n퇴실일: ${endDate}`);
        if (!ok) return;

        setSaving(true);
        try {
            await accommodationAssignmentService.endAssignment(assignment.id, endDate);
            await reloadAssignments();
            toast.success('퇴실 처리되었습니다.');
        } catch (e) {
            console.error(e);
            toast.error(`퇴실 처리 실패: ${toErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAssignment = async (assignment: AccommodationAssignment) => {
        if (!assignment.id) return;
        const ok = window.confirm(`[주의] 배정 기록을 완전히 삭제합니다.\n단순 퇴실 처리는 '삭제'가 아닌 '퇴실' 버튼을 사용해주세요.\n\n계속하시겠습니까?`);
        if (!ok) return;

        setSaving(true);
        try {
            await accommodationAssignmentService.deleteAssignment(assignment.id);
            await reloadAssignments();
            toast.success('삭제되었습니다.');
        } catch (e) {
            console.error(e);
            toast.error(`삭제 실패: ${toErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <FontAwesomeIcon icon={faPlus} />
                    </span>
                    숙소 배정 등록
                </h3>

                <div className="flex flex-col xl:flex-row gap-8">
                    {/* Left: Inputs */}
                    <div className="flex-1 space-y-6">
                        {/* Mode Selection */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">배정 모드</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setMode('team')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${mode === 'team' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faUsers} />
                                    팀 단위 배정
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('worker')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${mode === 'worker' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faUser} />
                                    개인 배정
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">팀 선택</label>
                                <div className="relative">
                                    <select
                                        value={selectedTeamId}
                                        onChange={(e) => setSelectedTeamId(e.target.value)}
                                        className="w-full p-3 pl-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700 appearance-none"
                                    >
                                        <option value="">팀 선택...</option>
                                        {teams.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                                        <FontAwesomeIcon icon={faUsers} />
                                    </div>
                                </div>
                            </div>

                            {mode === 'worker' && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">작업자 선택</label>
                                    <div className="relative">
                                        <select
                                            value={selectedWorkerId}
                                            onChange={(e) => setSelectedWorkerId(e.target.value)}
                                            className="w-full p-3 pl-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700 appearance-none disabled:opacity-50"
                                            disabled={!selectedTeamId}
                                        >
                                            <option value="">작업자 선택...</option>
                                            {teamWorkers.map((w) => (
                                                <option key={w.id} value={w.id}>
                                                    {w.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                                            <FontAwesomeIcon icon={faUser} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">숙소 선택</label>
                                <div className="relative">
                                    <select
                                        value={selectedAccommodationId}
                                        onChange={(e) => setSelectedAccommodationId(e.target.value)}
                                        className="w-full p-3 pl-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700 appearance-none"
                                    >
                                        <option value="">숙소 선택...</option>
                                        {accommodations.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                                        <FontAwesomeIcon icon={faBuilding} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">입실일</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-3 pl-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700"
                                    />
                                    {/* <div className="absolute right-4 top-3.5 text-slate-400 pointer-events-none">
                                        <FontAwesomeIcon icon={faCalendarAlt} />
                                    </div> */}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">메모 (선택사항)</label>
                            <input
                                type="text"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder="특이사항 입력"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700"
                            />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <input
                                id="autoEndExisting"
                                type="checkbox"
                                checked={autoEndExisting}
                                onChange={(e) => setAutoEndExisting(e.target.checked)}
                                className="w-5 h-5 rounded text-indigo-600 border-indigo-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="autoEndExisting" className="text-sm font-bold text-indigo-900 cursor-pointer select-none">
                                다른 숙소에 있는 경우, 자동 퇴실 처리 후 배정
                            </label>
                        </div>
                    </div>

                    {/* Right: Team Worker Selection (Only in Team Mode) */}
                    {mode === 'team' && (
                        <div className="w-full xl:w-96 flex flex-col h-full bg-slate-50 rounded-xl p-5 border border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-slate-700 text-sm">팀 작업자 선택</h4>
                                <label className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 cursor-pointer transition">
                                    <input
                                        type="checkbox"
                                        checked={teamWorkers.length > 0 && selectedWorkerIds.length === teamWorkers.length}
                                        onChange={(e) => handleSelectAllWorkers(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                        disabled={teamWorkers.length === 0}
                                    />
                                    전체 선택
                                </label>
                            </div>

                            <div className="relative mb-3">
                                <input
                                    type="text"
                                    value={workerSearch}
                                    onChange={(e) => setWorkerSearch(e.target.value)}
                                    placeholder="작업자 이름 검색"
                                    className="w-full pl-9 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-slate-400 text-sm" />
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-200 rounded-lg bg-white p-1">
                                {filteredTeamWorkers.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-xs py-10">
                                        {teamWorkers.length === 0 ? '팀을 먼저 선택해주세요.' : '검색 결과가 없습니다.'}
                                    </div>
                                ) : (
                                    <div className="space-y-0.5">
                                        {filteredTeamWorkers.map((w) => {
                                            const assignedHere = activeAssignmentsByWorkerId.get(w.id);
                                            const isElsewhere = assignedHere && assignedHere.accommodationId !== selectedAccommodationId;

                                            return (
                                                <label
                                                    key={w.id}
                                                    className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors group
                                                        ${selectedWorkerIds.includes(w.id) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedWorkerIds.includes(w.id)}
                                                            onChange={() => handleToggleWorker(w.id)}
                                                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                                        />
                                                        <div>
                                                            <div className={`text-sm font-bold ${selectedWorkerIds.includes(w.id) ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                                {w.name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {assignedHere && (
                                                        <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium border flex items-center gap-1
                                                            ${isElsewhere
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            }
                                                        `}>
                                                            {isElsewhere && <FontAwesomeIcon icon={faExclamationTriangle} />}
                                                            {assignedHere.accommodationName}
                                                        </div>
                                                    )}
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 text-right text-xs font-bold text-slate-500">
                                {selectedWorkerIds.length}명 선택됨
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        type="button"
                        onClick={handleCreateAssignments}
                        disabled={saving}
                        className={`px-8 py-3.5 rounded-xl font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 flex items-center gap-2.5 ${saving
                                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                            }`}
                    >
                        {saving ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                        ) : (
                            <FontAwesomeIcon icon={faPlus} />
                        )}
                        {mode === 'team' ? `${selectedWorkerIds.length}명 일괄 배정` : '배정 등록'}
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FontAwesomeIcon icon={faBuilding} />
                        </div>
                        <h3 className="font-bold text-slate-800">배정 현황 목록</h3>
                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">{visibleAssignments.length}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showEnded}
                                onChange={(e) => setShowEnded(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            종료된 배정 포함
                        </label>

                        <button
                            onClick={() => {
                                setLoading(true);
                                reloadAssignments().finally(() => setLoading(false));
                            }}
                            disabled={loading}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                        >
                            <FontAwesomeIcon icon={faSyncAlt} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 w-28 text-center">상태</th>
                                <th className="px-6 py-4">숙소명</th>
                                <th className="px-6 py-4">팀 / 소속</th>
                                <th className="px-6 py-4">작업자</th>
                                <th className="px-6 py-4 w-32">입실일</th>
                                <th className="px-6 py-4 w-32">퇴실일</th>
                                <th className="px-6 py-4">메모</th>
                                <th className="px-6 py-4 text-center w-32">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {visibleAssignments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <FontAwesomeIcon icon={faBuilding} className="text-3xl opacity-20" />
                                            <span>배정 데이터가 없습니다.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                visibleAssignments.map((a) => {
                                    const active = isActiveAssignment(a);
                                    return (
                                        <tr key={a.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5
                                                    ${active
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        : 'bg-slate-100 text-slate-500 border border-slate-200'}
                                                `}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                    {active ? '입실중' : '퇴실'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                {a.accommodationName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {a.teamName}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-700">
                                                {a.workerName}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-600 text-xs">
                                                {a.startDate}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                                                {a.endDate || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs truncate max-w-[200px]">
                                                {a.memo}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {active && (
                                                        <button
                                                            onClick={() => handleEndAssignment(a)}
                                                            className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition"
                                                            title="퇴실 처리"
                                                        >
                                                            <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteAssignment(a)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition"
                                                        title="기록 삭제"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
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

export default AccommodationAssignmentManager;
