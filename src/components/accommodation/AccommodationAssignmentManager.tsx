import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faPlus, faTrash, faUsers } from '@fortawesome/free-solid-svg-icons';
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
            alert('팀을 선택해주세요.');
            return;
        }
        if (!selectedAccommodation) {
            alert('숙소를 선택해주세요.');
            return;
        }
        if (!startDate) {
            alert('입실일을 입력해주세요.');
            return;
        }

        const workerIds = mode === 'team' ? selectedWorkerIds : (selectedWorkerId ? [selectedWorkerId] : []);
        if (workerIds.length === 0) {
            alert(mode === 'team' ? '배정할 작업자를 선택해주세요.' : '작업자를 선택해주세요.');
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
            alert(`이미 선택한 숙소에 배정된 작업자가 있습니다:\n- ${sameAccommodationAlready.join('\n- ')}`);
            return;
        }

        setSaving(true);
        try {
            if (conflicts.length > 0) {
                if (!autoEndExisting) {
                    const names = conflicts.map((c) => c.workerName ?? c.workerId).join(', ');
                    alert(`다른 숙소에 이미 입실 중인 작업자가 있습니다.\n자동 퇴실을 켜거나, 기존 배정을 먼저 종료해주세요.\n\n대상: ${names}`);
                    return;
                }

                const endDate = accommodationAssignmentService.buildEndDateAsDayBefore(startDate);
                const ok = window.confirm(
                    `기존 숙소 배정 ${conflicts.length}건을 '${endDate}'로 자동 퇴실 처리하고 새 배정을 생성할까요?`
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

        const ok = window.confirm(`퇴실 처리할까요?\n\n작업자: ${assignment.workerName ?? assignment.workerId}\n숙소: ${assignment.accommodationName ?? assignment.accommodationId}\n퇴실일: ${endDate}`);
        if (!ok) return;

        setSaving(true);
        try {
            await accommodationAssignmentService.endAssignment(assignment.id, endDate);
            await reloadAssignments();
        } catch (e) {
            console.error(e);
            toast.error(`퇴실 처리 실패: ${toErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAssignment = async (assignment: AccommodationAssignment) => {
        if (!assignment.id) return;
        const ok = window.confirm(`배정을 삭제할까요?\n\n작업자: ${assignment.workerName ?? assignment.workerId}\n숙소: ${assignment.accommodationName ?? assignment.accommodationId}`);
        if (!ok) return;

        setSaving(true);
        try {
            await accommodationAssignmentService.deleteAssignment(assignment.id);
            await reloadAssignments();
        } catch (e) {
            console.error(e);
            toast.error(`삭제 실패: ${toErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">배정 모드</label>
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setMode('team')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${
                                        mode === 'team' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={faUsers} className="mr-2" />
                                    팀 배정
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('worker')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${
                                        mode === 'worker' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    개인 배정
                                </button>
                            </div>
                        </div>

                        <div className="min-w-[240px]">
                            <label className="block text-xs font-bold text-slate-500 mb-1">팀</label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="w-full border-slate-300 rounded-lg text-sm"
                            >
                                <option value="">팀 선택</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {mode === 'worker' && (
                            <div className="min-w-[240px]">
                                <label className="block text-xs font-bold text-slate-500 mb-1">작업자</label>
                                <select
                                    value={selectedWorkerId}
                                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                                    className="w-full border-slate-300 rounded-lg text-sm"
                                    disabled={!selectedTeamId}
                                >
                                    <option value="">작업자 선택</option>
                                    {teamWorkers.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="min-w-[260px]">
                            <label className="block text-xs font-bold text-slate-500 mb-1">숙소</label>
                            <select
                                value={selectedAccommodationId}
                                onChange={(e) => setSelectedAccommodationId(e.target.value)}
                                className="w-full border-slate-300 rounded-lg text-sm"
                            >
                                <option value="">숙소 선택</option>
                                {accommodations.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">입실일</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border-slate-300 rounded-lg text-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="autoEndExisting"
                                type="checkbox"
                                checked={autoEndExisting}
                                onChange={(e) => setAutoEndExisting(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="autoEndExisting" className="text-sm font-bold text-slate-700">
                                기존 입실 자동 퇴실
                            </label>
                        </div>

                        <div className="flex-1" />

                        <button
                            type="button"
                            onClick={handleCreateAssignments}
                            disabled={saving}
                            className={`px-4 py-2 rounded-lg font-bold text-white transition flex items-center gap-2 ${
                                saving ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            {saving ? '저장 중...' : '입실(배정) 등록'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {mode === 'team' && (
                            <div className="lg:col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-bold text-slate-700">팀 작업자 선택</div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
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

                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={workerSearch}
                                        onChange={(e) => setWorkerSearch(e.target.value)}
                                        placeholder="작업자 검색"
                                        className="w-full border-slate-300 rounded-lg text-sm"
                                    />
                                    <div className="text-xs text-slate-500 font-bold">
                                        선택 {selectedWorkerIds.length}명
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto">
                                    {filteredTeamWorkers.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-400">작업자가 없습니다.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredTeamWorkers.map((w) => (
                                                <label
                                                    key={w.id}
                                                    className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedWorkerIds.includes(w.id)}
                                                            onChange={() => handleToggleWorker(w.id)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <div className="text-sm font-bold text-slate-800">{w.name}</div>
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-mono">
                                                        {activeAssignmentsByWorkerId.get(w.id)?.accommodationName ?? ''}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={mode === 'team' ? '' : 'lg:col-span-3'}>
                            <div className="text-sm font-bold text-slate-700 mb-2">메모</div>
                            <input
                                type="text"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder="예: 12월부터 입실"
                                className="w-full border-slate-300 rounded-lg text-sm"
                            />

                            <div className="mt-3 flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={showEnded}
                                        onChange={(e) => setShowEnded(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    퇴실 포함
                                </label>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setLoading(true);
                                        reloadAssignments()
                                            .catch((e) => {
                                                console.error(e);
                                                alert('새로고침에 실패했습니다.');
                                            })
                                            .finally(() => setLoading(false));
                                    }}
                                    className="text-sm font-bold text-slate-600 hover:text-slate-800"
                                    disabled={loading}
                                >
                                    {loading ? '불러오는 중...' : '새로고침'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex justify-between items-center mb-3">
                    <div className="text-sm font-bold text-slate-700">배정 목록</div>
                    <div className="text-xs text-slate-500 font-bold">총 {visibleAssignments.length}건</div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1100px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                            <tr>
                                <th className="p-2 text-left w-24">상태</th>
                                <th className="p-2 text-left">숙소</th>
                                <th className="p-2 text-left">팀</th>
                                <th className="p-2 text-left">작업자</th>
                                <th className="p-2 text-left w-32">입실일</th>
                                <th className="p-2 text-left w-32">퇴실일</th>
                                <th className="p-2 text-left">메모</th>
                                <th className="p-2 text-center w-36">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {visibleAssignments.map((a) => {
                                const active = isActiveAssignment(a);
                                return (
                                    <tr key={a.id ?? `${a.workerId}_${a.accommodationId}_${a.startDate}`} className="hover:bg-slate-50">
                                        <td className="p-2">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {active ? '입실' : '퇴실'}
                                            </span>
                                        </td>
                                        <td className="p-2 font-bold text-slate-800">{a.accommodationName ?? a.accommodationId}</td>
                                        <td className="p-2 text-slate-700">{a.teamName ?? ''}</td>
                                        <td className="p-2 text-slate-700">{a.workerName ?? a.workerId}</td>
                                        <td className="p-2 font-mono text-slate-600">{a.startDate}</td>
                                        <td className="p-2 font-mono text-slate-600">{a.endDate ?? ''}</td>
                                        <td className="p-2 text-slate-600">{a.memo ?? ''}</td>
                                        <td className="p-2">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEndAssignment(a)}
                                                    disabled={!active || saving}
                                                    className={`px-3 py-1.5 rounded-lg font-bold text-white transition flex items-center gap-2 ${
                                                        !active || saving
                                                            ? 'bg-slate-300 cursor-not-allowed'
                                                            : 'bg-orange-600 hover:bg-orange-700'
                                                    }`}
                                                >
                                                    <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                                    퇴실
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAssignment(a)}
                                                    disabled={saving}
                                                    className={`px-3 py-1.5 rounded-lg font-bold text-white transition flex items-center gap-2 ${
                                                        saving ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                                                    }`}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                    삭제
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {visibleAssignments.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-slate-400">
                                        배정 데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AccommodationAssignmentManager;
