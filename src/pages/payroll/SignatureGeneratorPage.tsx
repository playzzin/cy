import React, { useState, useEffect, useMemo } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import SignatureGeneratorModal from '../../components/signatures/SignatureGeneratorModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSignature, faSpinner, faCheck, faUser, faRotateRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { getContrastingTextColor, getReadableAccentColor, hexToRgba, normalizeHexColor } from '../../utils/color';

interface SignatureGeneratorPageProps {
    embedded?: boolean;
    className?: string;
    onSignatureSaved?: (workerId: string, newUrl: string) => void;
}

const getWorkerKey = (worker: Worker | null | undefined): string =>
    String(worker?.id ?? worker?.legacyId ?? '').trim();

const hasRegisteredSignature = (worker: Worker): boolean =>
    Boolean(String(worker.signatureUrl ?? '').trim());

const isActiveWorker = (worker: Worker): boolean => {
    const status = String(worker.status ?? '').trim().toLowerCase();
    return worker.isActive !== false
        && !status.includes('퇴사')
        && !status.includes('inactive')
        && !status.includes('출입금지');
};

const getTeamLabel = (worker: Worker, teamsById?: Map<string, Team>): string => {
    const teamId = String(worker.teamId ?? '').trim();
    return String(teamsById?.get(teamId)?.name ?? worker.teamName ?? '').trim() || '미배정';
};

const getWorkerTeamKey = (worker: Worker, teamsById?: Map<string, Team>): string =>
    String(worker.teamId ?? '').trim() || `name:${getTeamLabel(worker, teamsById)}`;

const getWorkerTeamColor = (worker: Worker, teamsById: Map<string, Team>): string => {
    const teamId = String(worker.teamId ?? '').trim();
    const hasTeam = Boolean(teamId || String(worker.teamName ?? '').trim());
    const fallback = hasTeam ? '#64748b' : '#94a3b8';
    return normalizeHexColor(teamsById.get(teamId)?.color ?? worker.color, fallback);
};

const isConstructionTeamWorker = (worker: Worker, teamsById: Map<string, Team>): boolean => {
    const teamId = String(worker.teamId ?? '').trim();
    const team = teamsById.get(teamId);
    return team
        ? String(team.type ?? '').trim() === '시공팀'
        : String(worker.teamType ?? '').trim() === '시공팀';
};

type SignatureStatusFilter = 'all' | 'registered' | 'unregistered';

const SignatureGeneratorPage: React.FC<SignatureGeneratorPageProps> = ({
    embedded = false,
    className = '',
    onSignatureSaved
}) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeamKey, setSelectedTeamKey] = useState('all');
    const [statusFilter, setStatusFilter] = useState<SignatureStatusFilter>('all');
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [failedSignatureImages, setFailedSignatureImages] = useState<Set<string>>(new Set());

    useEffect(() => {
        void loadWorkers();
        const unsubscribe = manpowerService.subscribeWorkers((latestWorkers) => {
            setWorkers(latestWorkers);
        });
        return unsubscribe;
    }, []);

    const activeWorkers = useMemo(
        () => workers.filter(isActiveWorker),
        [workers]
    );

    const teamsById = useMemo(
        () => new Map(teams
            .map((team) => [String(team.id ?? team.legacyId ?? '').trim(), team] as const)
            .filter(([teamId]) => Boolean(teamId))),
        [teams]
    );

    const constructionWorkers = useMemo(
        () => activeWorkers.filter((worker) => isConstructionTeamWorker(worker, teamsById)),
        [activeWorkers, teamsById]
    );

    const teamTabs = useMemo(() => {
        const tabs = new Map<string, { key: string; name: string; color: string; count: number }>();

        constructionWorkers.forEach((worker) => {
            const key = getWorkerTeamKey(worker, teamsById);
            const current = tabs.get(key);
            if (current) {
                current.count += 1;
                return;
            }

            tabs.set(key, {
                key,
                name: getTeamLabel(worker, teamsById),
                color: getWorkerTeamColor(worker, teamsById),
                count: 1,
            });
        });

        return Array.from(tabs.values()).sort((left, right) => left.name.localeCompare(right.name, 'ko'));
    }, [constructionWorkers, teamsById]);

    useEffect(() => {
        if (selectedTeamKey !== 'all' && !teamTabs.some((team) => team.key === selectedTeamKey)) {
            setSelectedTeamKey('all');
        }
    }, [selectedTeamKey, teamTabs]);

    const teamScopedWorkers = useMemo(
        () => selectedTeamKey === 'all'
            ? constructionWorkers
            : constructionWorkers.filter((worker) => getWorkerTeamKey(worker, teamsById) === selectedTeamKey),
        [constructionWorkers, selectedTeamKey, teamsById]
    );

    const signatureCounts = useMemo(() => {
        const registered = teamScopedWorkers.filter(hasRegisteredSignature).length;
        return {
            all: teamScopedWorkers.length,
            registered,
            unregistered: teamScopedWorkers.length - registered,
        };
    }, [teamScopedWorkers]);

    const filteredWorkers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return teamScopedWorkers.filter((worker) => {
            const matchesSearch = !normalizedSearch
                || String(worker.name ?? '').toLowerCase().includes(normalizedSearch)
                || String(worker.contact ?? '').toLowerCase().includes(normalizedSearch)
                || getTeamLabel(worker, teamsById).toLowerCase().includes(normalizedSearch);
            const registered = hasRegisteredSignature(worker);
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'registered' && registered)
                || (statusFilter === 'unregistered' && !registered);
            return matchesSearch && matchesStatus;
        });
    }, [searchTerm, statusFilter, teamScopedWorkers, teamsById]);

    const workerGroups = useMemo(() => {
        const groups = new Map<string, { teamName: string; teamColor: string; workers: Worker[] }>();

        filteredWorkers.forEach((worker) => {
            const teamKey = getWorkerTeamKey(worker, teamsById);
            const group = groups.get(teamKey) ?? {
                teamName: getTeamLabel(worker, teamsById),
                teamColor: getWorkerTeamColor(worker, teamsById),
                workers: [],
            };
            group.workers.push(worker);
            groups.set(teamKey, group);
        });

        return Array.from(groups.values())
            .sort((left, right) => left.teamName.localeCompare(right.teamName, 'ko'))
            .map((group) => ({
                ...group,
                workers: group.workers.sort((left, right) =>
                    String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko')
                ),
            }));
    }, [filteredWorkers, teamsById]);

    const loadWorkers = async () => {
        try {
            setLoading(true);
            setLoadError(null);
            const [result, teamRows] = await Promise.all([
                manpowerService.getWorkersPaginated(1000),
                teamService.getTeams().catch((teamError) => {
                    console.warn('Unable to load team colors for signature generator:', teamError);
                    return [];
                }),
            ]);
            setWorkers(result.workers);
            setTeams(teamRows);
        } catch (error) {
            console.error('작업자 목록 로드 실패:', error);
            setLoadError('작업자 목록을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (worker: Worker) => {
        setSelectedWorker(worker);
        setIsModalOpen(true);
    };

    const handleSaveComplete = (newUrl: string) => {
        const savedWorkerId = getWorkerKey(selectedWorker);

        // Update the worker's signature URL in local state
        setWorkers(prev =>
            prev.map(w =>
                getWorkerKey(w) === savedWorkerId
                    ? { ...w, signatureUrl: newUrl }
                    : w
            )
        );
        if (savedWorkerId) {
            onSignatureSaved?.(savedWorkerId, newUrl);
            setFailedSignatureImages(prev => {
                const next = new Set(prev);
                next.delete(savedWorkerId);
                return next;
            });
        }
        setIsModalOpen(false);
        setSelectedWorker(null);
    };

    if (loading) {
        return (
            <div role="status" aria-live="polite" className={`flex items-center justify-center bg-slate-50 ${embedded ? 'h-full min-h-[360px]' : 'h-screen'} ${className}`}>
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-600 mb-4" />
                    <p className="text-slate-500 font-medium">작업자 목록을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className={`flex items-center justify-center bg-slate-50 p-6 ${embedded ? 'h-full min-h-[360px]' : 'min-h-screen'} ${className}`}>
                <div role="alert" className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                        <FontAwesomeIcon icon={faSignature} className="text-xl" />
                    </div>
                    <h2 className="font-bold text-slate-800">서명 대상 목록을 열지 못했습니다</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{loadError}</p>
                    <button
                        type="button"
                        onClick={loadWorkers}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`${embedded ? 'h-full min-h-0 overflow-hidden flex flex-col bg-slate-50 p-4' : 'min-h-screen bg-slate-50 p-6'} ${className}`}>
            {/* Header */}
            <div className={embedded ? 'mb-4' : 'mb-8'}>
                <h1 className={`${embedded ? 'text-xl' : 'text-2xl'} font-bold text-slate-800 flex items-center gap-3`}>
                    <div className={`${embedded ? 'w-9 h-9' : 'w-10 h-10'} bg-indigo-100 rounded-lg flex items-center justify-center`}>
                        <FontAwesomeIcon icon={faSignature} className="text-indigo-600" />
                    </div>
                    서명 등록
                </h1>
                {!embedded && (
                    <p className="text-slate-500 mt-2">시공팀 재직 작업자를 팀별로 확인하고, 직접 서명을 그려 등록/수정할 수 있습니다.</p>
                )}
            </div>

            {/* Team filter */}
            <div className={`${embedded ? 'mb-4' : 'mb-6'} min-w-0`}>
                <div
                    role="tablist"
                    aria-label="팀별 서명 대상 필터"
                    className="flex max-w-full gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={selectedTeamKey === 'all'}
                        onClick={() => setSelectedTeamKey('all')}
                        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            selectedTeamKey === 'all'
                                ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                    >
                        <span className="h-2.5 w-2.5 rounded-full bg-current" />
                        전체 시공팀
                        <span className="text-xs opacity-80">{constructionWorkers.length}명</span>
                    </button>
                    {teamTabs.map((team) => {
                        const isSelected = selectedTeamKey === team.key;
                        const textColor = getContrastingTextColor(team.color);

                        return (
                            <button
                                key={team.key}
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                onClick={() => setSelectedTeamKey(team.key)}
                                title={`${team.name} ${team.count}명`}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                style={isSelected
                                    ? {
                                        backgroundColor: team.color,
                                        borderColor: team.color,
                                        color: textColor,
                                    }
                                    : {
                                        backgroundColor: hexToRgba(team.color, 0.12),
                                        borderColor: hexToRgba(team.color, 0.42),
                                        color: getReadableAccentColor(team.color),
                                    }}
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: isSelected ? textColor : team.color }}
                                />
                                <span className="whitespace-nowrap">{team.name}</span>
                                <span className="text-xs opacity-80">{team.count}명</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Search */}
            <div className={`${embedded ? 'mb-4' : 'mb-6'} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
                <div className={`relative ${embedded ? 'max-w-none flex-1' : 'w-full max-w-md'}`}>
                    <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="이름, 연락처 또는 팀명 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            aria-label="검색어 지우기"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    )}
                </div>
                <p className="text-xs font-medium text-slate-500" aria-live="polite">
                    조건에 맞는 작업자 <strong className="text-slate-700">{filteredWorkers.length}명</strong>
                </p>
            </div>

            {/* Stats */}
            <div
                role="group"
                aria-label="서명 등록 상태 필터"
                className={`${embedded ? 'mb-4 grid grid-cols-3 gap-2' : 'mb-6 grid max-w-2xl grid-cols-3 gap-3'}`}
            >
                {([
                    { id: 'all' as const, label: '전체 시공팀', count: signatureCounts.all, activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-700' },
                    { id: 'registered' as const, label: '서명 등록', count: signatureCounts.registered, activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                    { id: 'unregistered' as const, label: '미등록', count: signatureCounts.unregistered, activeClass: 'border-orange-500 bg-orange-50 text-orange-700' },
                ]).map(option => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={statusFilter === option.id}
                        onClick={() => setStatusFilter(option.id)}
                        className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            statusFilter === option.id
                                ? option.activeClass
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span className="block truncate text-xs font-semibold sm:text-sm">{option.label}</span>
                        <span className="mt-1 block text-lg font-extrabold">{option.count}<span className="ml-0.5 text-xs font-semibold">명</span></span>
                    </button>
                ))}
            </div>

            {/* Worker Grid */}
            <div className={`${embedded ? 'flex-1 min-h-0 overflow-y-auto pr-1' : ''} space-y-6`}>
                {workerGroups.map(({ teamName, teamColor, workers: teamWorkers }) => {
                    const teamTextColor = getReadableAccentColor(teamColor);
                    return (
                    <section key={teamName} aria-label={`${teamName} 팀 서명 대상`}>
                        <div className="mb-3 flex items-center gap-2 border-b pb-2" style={{ borderBottomColor: hexToRgba(teamColor, 0.35) }}>
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} />
                            <h2 className="text-base font-bold" style={{ color: teamTextColor }}>{teamName}</h2>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                {teamWorkers.length}명
                            </span>
                        </div>
                        <div className={`${embedded ? 'grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                            {teamWorkers.map((worker) => {
                                const workerTeamColor = getWorkerTeamColor(worker, teamsById);
                                const workerIconTextColor = getContrastingTextColor(workerTeamColor);
                                return (
                                <button
                                    type="button"
                                    key={getWorkerKey(worker)}
                                    onClick={() => handleOpenModal(worker)}
                                    aria-label={`${worker.name} 서명 ${hasRegisteredSignature(worker) ? '수정' : '등록'}`}
                                    className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-300 hover:shadow-lg focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                    style={{ borderLeftColor: workerTeamColor, borderLeftWidth: 3 }}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: workerTeamColor }}>
                                            <FontAwesomeIcon icon={faUser} style={{ color: workerIconTextColor }} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{worker.name}</h3>
                                            <p className="text-xs text-slate-400">{worker.role || '미분류'}</p>
                                        </div>
                                    </div>

                                    {/* Signature Preview */}
                                    <div className="h-16 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-200 overflow-hidden">
                                        {hasRegisteredSignature(worker) && !failedSignatureImages.has(getWorkerKey(worker)) ? (
                                            <div className="relative w-full h-full">
                                                <img
                                                    src={worker.signatureUrl}
                                                    alt={`${worker.name} 서명`}
                                                    loading="lazy"
                                                    decoding="async"
                                                    onError={() => {
                                                        const workerKey = getWorkerKey(worker);
                                                        if (!workerKey) return;
                                                        setFailedSignatureImages(prev => new Set(prev).add(workerKey));
                                                    }}
                                                    className="w-full h-full object-contain"
                                                />
                                                <div className="absolute top-1 right-1">
                                                    <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                        <FontAwesomeIcon icon={faCheck} className="text-[8px]" />
                                                        등록됨
                                                    </span>
                                                </div>
                                            </div>
                                        ) : hasRegisteredSignature(worker) ? (
                                            <span className="px-2 text-center text-xs font-medium text-red-400">미리보기 오류 · 다시 등록 가능</span>
                                        ) : (
                                            <span className="text-xs text-slate-400">서명 미등록</span>
                                        )}
                                    </div>

                                    {/* Action Hint */}
                                    <div className="mt-3 text-center">
                                        <span className="text-xs font-semibold text-indigo-600 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                                            서명 {hasRegisteredSignature(worker) ? '수정' : '등록'} 열기
                                        </span>
                                    </div>
                                </button>
                                );
                            })}
                        </div>
                    </section>
                    );
                })}
            </div>

            {filteredWorkers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
                    <p className="font-semibold">
                        {constructionWorkers.length === 0
                            ? '시공팀 재직 작업자가 없습니다.'
                            : searchTerm
                                ? '검색 조건에 맞는 작업자가 없습니다.'
                                : '현재 상태 필터에 맞는 작업자가 없습니다.'}
                    </p>
                    {(searchTerm || selectedTeamKey !== 'all' || statusFilter !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedTeamKey('all');
                                setStatusFilter('all');
                            }}
                            className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
                        >
                            검색·필터 초기화
                        </button>
                    )}
                </div>
            )}

            {/* Modal */}
            {selectedWorker && (
                <SignatureGeneratorModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedWorker(null);
                    }}
                    workerId={getWorkerKey(selectedWorker)}
                    workerName={selectedWorker.name}
                    onSaveComplete={handleSaveComplete}
                />
            )}
        </div>
    );
};

export default SignatureGeneratorPage;
