import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUser, faHardHat, faCheck,
    faArrowRight, faSearch, faBriefcase, faIdCard
} from '@fortawesome/free-solid-svg-icons';
import { Company } from '../../services/companyService';
import { Team } from '../../services/teamService';
import { Worker } from '../../services/manpowerService';

// ============================================================================
// STYLES & VARIANTS
// ============================================================================
const GLASS_STYLE = "bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg";

const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants: any = {
    hidden: { opacity: 0, y: 30, scale: 0.95, rotate: -5 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        rotate: 0,
        transition: { type: 'spring', stiffness: 100, damping: 12 }
    }
};

interface InteractiveOrgChartProps {
    companies: Company[];
    teams: Team[];
    workers: Worker[];
}

// ============================================================================
// COMPONENT
// ============================================================================
const InteractiveOrgChart: React.FC<InteractiveOrgChartProps> = ({ companies, teams, workers }) => {
    // STATE
    const [selectedType, setSelectedType] = useState<'시공사' | '협력사' | null>(null);
    // Removed selectedCompanyId as we go straight to Teams
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

    // HELPER: Check if a worker belongs to a team (handling both UUID and Legacy ID)
    const isWorkerInTeam = (worker: Worker, team: Team) => {
        if (!worker.teamId) return false;
        return worker.teamId === team.id || (team.legacyId && worker.teamId === team.legacyId);
    };

    // Filtered Data
    const filteredCompanies = useMemo(() => {
        if (!selectedType) return [];
        return companies.filter(c => c.type === selectedType);
    }, [companies, selectedType]);

    // Teams are now filtered directly by the selected Type (via their companies)
    const filteredTeams = useMemo(() => {
        if (!selectedType) return [];
        // Get IDs of companies matching the selected type
        const targetCompanyIds = companies
            .filter(c => c.type === selectedType)
            .map(c => c.id);

        // Filter teams belonging to those companies
        return teams.filter(t => t.companyId && targetCompanyIds.includes(t.companyId));
    }, [teams, companies, selectedType]);

    const filteredWorkers = useMemo(() => {
        if (!selectedTeamId) return [];
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        if (!selectedTeam) return [];

        return workers.filter(w => isWorkerInTeam(w, selectedTeam));
    }, [workers, selectedTeamId, teams]);

    // Handlers
    const handleTypeSelect = (type: '시공사' | '협력사') => {
        setSelectedType(type === selectedType ? null : type);
        setSelectedTeamId(null);
    };

    const handleTeamSelect = (id: string) => {
        setSelectedTeamId(id === selectedTeamId ? null : id);
    };

    // RENDER HELPERS
    const renderLevel1_TypeSelection = () => (
        <div className="flex gap-6 justify-center mb-12">
            {(['시공사', '협력사'] as const).map((type) => {
                const isSelected = selectedType === type;
                const isOtherSelected = selectedType && !isSelected;

                return (
                    <motion.button
                        key={type}
                        onClick={() => handleTypeSelect(type)}
                        className={`
                            relative px-12 py-8 rounded-2xl text-2xl font-bold transition-all duration-300
                            ${isSelected
                                ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-2xl scale-105 ring-4 ring-indigo-200'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-md hover:shadow-xl dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700'
                            }
                            ${isOtherSelected ? 'opacity-40 scale-95 blur-[1px]' : 'opacity-100'}
                        `}
                        whileHover={!isSelected && !isOtherSelected ? { scale: 1.05, y: -5, rotate: -2 } : {}}
                        whileTap={{ scale: 0.95 }}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className={`
                                w-16 h-16 rounded-full flex items-center justify-center text-3xl
                                ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400'}
                            `}>
                                <FontAwesomeIcon icon={type === '시공사' ? faBuilding : faHardHat} />
                            </div>
                            <span>{type}</span>
                        </div>
                        {isSelected && (
                            <motion.div
                                layoutId="activeIndicator"
                                className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-500 rotate-45"
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );

    // Level 2: Teams (Formerly Level 3)
    const renderLevel2_Teams = () => (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-8"
        >
            <div className="flex items-center gap-3 mb-4 px-4 mt-8">
                <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1" />
                <span className="text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm">
                    {selectedType} 소속 팀 목록 ({filteredTeams.length})
                </span>
                <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4">
                {filteredTeams.map(team => {
                    const isSelected = selectedTeamId === team.id;
                    const isDimmed = selectedTeamId && !isSelected;
                    const teamWorkersCount = workers.filter(w => isWorkerInTeam(w, team)).length;

                    // Find company for badge
                    const teamCompany = companies.find(c => c.id === team.companyId);

                    return (
                        <motion.div
                            key={team.id}
                            variants={itemVariants}
                            layout
                            onClick={() => team.id && handleTeamSelect(team.id)}
                            whileHover={{ scale: 1.03, y: -4 }}
                            className={`
                                cursor-pointer rounded-xl p-4 relative transition-all duration-300 flex flex-col h-full
                                ${isSelected
                                    ? 'bg-emerald-600 text-white shadow-xl ring-4 ring-emerald-100 scale-[1.02] z-10'
                                    : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-900 dark:border-slate-700'
                                }
                                ${isDimmed ? 'opacity-40 scale-95' : 'opacity-100'}
                            `}
                        >
                            {/* Company Badge */}
                            <div className="mb-2">
                                <span className={`
                                    text-[10px] font-bold px-2 py-0.5 rounded-full inline-block
                                    ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}
                                `}>
                                    <FontAwesomeIcon icon={faBuilding} className="mr-1" />
                                    {teamCompany?.name || '소속 미지정'}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 mb-2">
                                <div className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0
                                    ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300'}
                                `}>
                                    <FontAwesomeIcon icon={faUsers} />
                                </div>
                                <h4 className="font-bold truncate text-base leading-tight dark:text-slate-100">{team.name}</h4>
                            </div>

                            <div className="mt-auto pt-2 flex justify-between items-end border-t border-black/5 dark:border-white/10">
                                <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <span className="opacity-70 mr-1">팀장</span>
                                    {team.leaderName || '-'}
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {teamWorkersCount}명
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
            {filteredTeams.length === 0 && (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                    등록된 {selectedType} 팀이 없습니다.
                </div>
            )}
        </motion.div>
    );

    const renderLevel3_Workers = () => {
        const teamLeader = filteredWorkers.find(w => w.role === '팀장' || w.name === teams.find(t => t.id === selectedTeamId)?.leaderName);
        const otherWorkers = filteredWorkers.filter(w => w !== teamLeader);

        return (
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="mt-8 px-4"
            >
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-inner dark:bg-slate-900 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faIdCard} />
                        </div>
                        <h4 className="font-bold text-slate-700 text-lg dark:text-slate-100">팀원 상세 명단</h4>

                        {/* Selected Team Info Context */}
                        {selectedTeamId && (
                            <span className="ml-auto text-sm text-slate-400 font-medium dark:text-slate-500">
                                {teams.find(t => t.id === selectedTeamId)?.name}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Leader Highlight */}
                        {teamLeader && (
                            <div className="lg:col-span-3">
                                <motion.div
                                    variants={itemVariants}
                                    className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg h-full relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl">
                                        <FontAwesomeIcon icon={faUser} />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="bg-white/20 text-xs font-bold inline-block px-3 py-1 rounded-full mb-4 backdrop-blur-sm">
                                            TEAM LEADER
                                        </div>
                                        <h3 className="text-2xl font-bold mb-1">{teamLeader.name}</h3>
                                        <p className="text-indigo-100 mb-6 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faBriefcase} /> {teamLeader.role}
                                        </p>

                                        <div className="space-y-3 text-sm text-indigo-50">
                                            <div className="flex justify-between border-b border-white/10 pb-2">
                                                <span>연락처</span>
                                                <span className="font-mono">{teamLeader.contact || '-'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/10 pb-2">
                                                <span>생년월일</span>
                                                <span className="font-mono">{teamLeader.idNumber ? teamLeader.idNumber.substring(0, 6) : '-'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/10 pb-2">
                                                <span>단가</span>
                                                <span className="font-mono font-bold text-white">{(teamLeader.unitPrice || 0).toLocaleString()}원</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {/* Other Workers */}
                        <div className={`${teamLeader ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
                            {otherWorkers.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {otherWorkers.map(worker => (
                                        <motion.div
                                            key={worker.id}
                                            variants={itemVariants}
                                            whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(0,0,0,0.1)" }}
                                            className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow group dark:bg-slate-800 dark:border-slate-700 dark:hover:shadow-lg dark:hover:shadow-emerald-900/20"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-sm group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-indigo-900 dark:group-hover:text-indigo-300">
                                                <FontAwesomeIcon icon={faUser} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-700 truncate dark:text-slate-100">{worker.name}</div>
                                                <div className="text-xs text-slate-500 truncate dark:text-slate-400">{worker.role}</div>
                                            </div>
                                            <div className="text-xs font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                {(worker.unitPrice || 0).toLocaleString()}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px] border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700">
                                    <FontAwesomeIcon icon={faUsers} className="text-3xl mb-3 opacity-50 dark:text-slate-600" />
                                    <p className="dark:text-slate-500">추가 팀원이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen py-8 bg-slate-900 dark:bg-slate-950">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2 dark:text-white">
                        조직도 탐색
                    </h2>
                    <p className="text-slate-500 dark:text-slate-300">
                        시공사/협력사 선택 후 바로 팀을 탐색할 수 있습니다.
                    </p>
                </div>

                {/* Level 1: Type Selection */}
                {renderLevel1_TypeSelection()}

                {/* Level 2: Teams (Filtered by Type) */}
                <AnimatePresence>
                    {selectedType && renderLevel2_Teams()}
                </AnimatePresence>

                {/* Level 3: Workers */}
                <AnimatePresence>
                    {selectedTeamId && renderLevel3_Workers()}
                </AnimatePresence>

                {/* Empty State / Initial Instructions */}
                {!selectedType && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-slate-300 mx-4 dark:bg-slate-800/50 dark:border-slate-700"
                    >
                        <FontAwesomeIcon icon={faSearch} className="text-5xl text-slate-200 mb-6 dark:text-slate-600" />
                        <h3 className="text-xl font-bold text-slate-400 mb-2 dark:text-slate-300">조직을 선택해주세요</h3>
                        <p className="text-slate-400 dark:text-slate-400">시공사 또는 협력사를 선택하여 팀 목록을 확인하세요.</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default InteractiveOrgChart;
