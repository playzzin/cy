import React, { useState, useMemo } from 'react';
import { useOrganizationTree, OrgNode } from './hooks/useOrganizationTree';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUserTie, faHardHat, faSearch,
    faSitemap, faCrown, faArrowRight, faIdCard, faMapMarkerAlt,
    faPhone, faEnvelope, faTimes, faChevronRight, faProjectDiagram
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// --- Types ---
type TabType = 'construction' | 'partner';

// --- Animations ---
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    },
    exit: { opacity: 0 }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 30 }
    }
};

const CheongyeonOrgChartPage: React.FC = () => {
    const { treeData, loading } = useOrganizationTree();
    const [activeTab, setActiveTab] = useState<TabType>('construction');
    const [selectedTeam, setSelectedTeam] = useState<OrgNode | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Data Processing ---
    const { constructionGroups, partnerGroups } = useMemo(() => {
        const construction: { company: OrgNode, teams: OrgNode[] }[] = [];
        const partner: { company: OrgNode, teams: OrgNode[] }[] = [];

        treeData.forEach(comp => {
            if (comp.type === 'company') {
                const group = { company: comp, teams: comp.children.filter(c => c.type === 'team') };
                if (comp.data?.type === '시공사') {
                    construction.push(group);
                } else {
                    partner.push(group);
                }
            }
        });

        return { constructionGroups: construction, partnerGroups: partner };
    }, [treeData]);

    const activeGroups = activeTab === 'construction' ? constructionGroups : partnerGroups;

    const filteredGroups = useMemo(() => {
        if (!searchTerm) return activeGroups;
        const lowerTerm = searchTerm.toLowerCase();

        return activeGroups.map(group => {
            const companyMatch = group.company.name.toLowerCase().includes(lowerTerm);
            const matchingTeams = group.teams.filter(team =>
                team.name.toLowerCase().includes(lowerTerm) ||
                team.children.some(member => member.name.toLowerCase().includes(lowerTerm))
            );

            if (companyMatch) return group;
            if (matchingTeams.length > 0) return { ...group, teams: matchingTeams };
            return null;
        }).filter(Boolean) as { company: OrgNode, teams: OrgNode[] }[];
    }, [activeGroups, searchTerm]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#0f172a] text-slate-400">
                <div className="relative w-20 h-20 mb-8">
                    <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
                    <FontAwesomeIcon icon={faSitemap} className="absolute inset-0 m-auto text-2xl text-cyan-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-300 tracking-widest uppercase">System Loading</h2>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30 flex flex-col relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[150px]" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-md border-b border-slate-800/60 bg-[#0f172a]/80">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div
                        className="flex items-center gap-4 cursor-pointer group"
                        onClick={() => setSelectedTeam(null)}
                    >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                            <FontAwesomeIcon icon={faProjectDiagram} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight group-hover:text-cyan-400 transition-colors">청연 건설 조직도</h1>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Organization System</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Tabs */}
                        <div className="bg-slate-900/80 p-1 rounded-xl border border-slate-800 hidden sm:flex">
                            <TabButton
                                active={activeTab === 'construction'}
                                onClick={() => { setActiveTab('construction'); setSelectedTeam(null); }}
                                icon={faBuilding}
                                label="시공사"
                            />
                            <TabButton
                                active={activeTab === 'partner'}
                                onClick={() => { setActiveTab('partner'); setSelectedTeam(null); }}
                                icon={faUsers}
                                label="협력사"
                            />
                        </div>

                        {/* Search */}
                        <div className="relative group hidden md:block">
                            <input
                                type="text"
                                placeholder="팀, 현장, 직원 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-64 pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-slate-900 transition-all text-sm text-slate-200 placeholder-slate-600 outline-none"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500 transition-colors" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-6 relative z-10">
                <AnimatePresence mode="wait">
                    {selectedTeam ? (
                        <TeamDetailOverlay
                            key="detail"
                            team={selectedTeam}
                            onClose={() => setSelectedTeam(null)}
                        />
                    ) : (
                        <motion.div
                            key="list"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-12 pb-20"
                        >
                            {filteredGroups.map((group) => (
                                <section key={group.company.id}>
                                    <div className="flex items-end gap-4 mb-6 px-2">
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                            <span className="w-1 h-8 bg-cyan-500 rounded-full"></span>
                                            {group.company.name}
                                        </h2>
                                        <span className="text-sm text-slate-500 font-mono mb-1">
                                            {group.teams.length} Teams
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {group.teams.map(team => (
                                            <TeamCard
                                                key={team.id}
                                                team={team}
                                                onClick={() => setSelectedTeam(team)}
                                            />
                                        ))}
                                        {group.teams.length === 0 && (
                                            <div className="col-span-full py-12 text-center text-slate-600 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                                                소속된 팀이 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            ))}

                            {filteredGroups.length === 0 && (
                                <div className="text-center py-32">
                                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600">
                                        <FontAwesomeIcon icon={faSearch} className="text-3xl" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-400 mb-2">검색 결과가 없습니다</h3>
                                    <p className="text-slate-600">다른 키워드로 검색해보세요.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

// --- Sub Components ---

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button
        onClick={onClick}
        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 relative overflow-hidden ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
    >
        {active && (
            <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-slate-700 rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
        )}
        <span className="relative z-10 flex items-center gap-2">
            <FontAwesomeIcon icon={icon} /> {label}
        </span>
    </button>
);

const TeamCard: React.FC<{ team: OrgNode, onClick: () => void }> = ({ team, onClick }) => {
    const leader = team.children.find(w => w.data?.role === '팀장' || w.data?.role === '소장' || w.name === team.data?.leaderName);
    const memberCount = team.children.filter(c => c.type === 'worker').length;

    // Extract site info
    const sites = team.data?.siteNames && team.data.siteNames.length > 0
        ? team.data.siteNames
        : (team.data?.assignedSiteName ? [team.data.assignedSiteName] : []);

    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            onClick={onClick}
            className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_30px_-10px_rgba(6,182,212,0.3)] transition-all duration-300"
        >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <FontAwesomeIcon icon={faArrowRight} className="text-cyan-500 -rotate-45" />
            </div>

            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl text-slate-400 group-hover:bg-cyan-500/10 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                        <FontAwesomeIcon icon={faUsers} />
                    </div>
                    {leader && (
                        <div className="text-right">
                            <span className="inline-block px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold rounded-full mb-1">
                                <FontAwesomeIcon icon={faCrown} className="mr-1" /> 팀장
                            </span>
                            <div className="text-sm font-bold text-slate-200">{leader.name}</div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors truncate">{team.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{team.data?.code || 'NO-CODE'}</p>
                </div>

                {/* Footer Info */}
                <div className="space-y-3">
                    {/* Member Avatars */}
                    <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                            {team.children.slice(0, 3).map((member, i) => (
                                <div key={member.id} className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] text-slate-400 font-bold overflow-hidden">
                                    {member.name.charAt(0)}
                                </div>
                            ))}
                            {memberCount > 3 && (
                                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] text-slate-500">
                                    +{memberCount - 3}
                                </div>
                            )}
                        </div>
                        <span className="text-xs font-medium text-slate-400">총 {memberCount}명</span>
                    </div>

                    {/* Site Badges */}
                    {sites.length > 0 ? (
                        <div className="pt-3 border-t border-slate-800">
                            <div className="flex items-center gap-1.5 mb-2">
                                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-indigo-400 text-[10px]" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">담당 현장</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {sites.slice(0, 2).map((site: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-medium truncate max-w-full">
                                        {site}
                                    </span>
                                ))}
                                {sites.length > 2 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800 text-slate-500 text-[10px] font-medium">
                                        +{sites.length - 2}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="pt-3 border-t border-slate-800 min-h-[50px] flex items-center text-xs text-slate-600 italic">
                            배정된 현장 없음
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const TeamDetailOverlay: React.FC<{ team: OrgNode, onClose: () => void }> = ({ team, onClose }) => {
    const leader = team.children.find(w => w.data?.role === '팀장' || w.data?.role === '소장' || w.name === team.data?.leaderName);
    const members = team.children.filter(w => w.id !== leader?.id && w.type === 'worker');

    const sites = team.data?.siteNames && team.data.siteNames.length > 0
        ? team.data.siteNames
        : (team.data?.assignedSiteName ? [team.data.assignedSiteName] : []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[80vh] flex flex-col md:flex-row relative"
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-20 w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-all border border-white/10"
            >
                <FontAwesomeIcon icon={faTimes} />
            </button>

            {/* Left Panel: Info & Leader (35%) */}
            <div className="w-full md:w-[350px] lg:w-[400px] bg-gradient-to-b from-indigo-900 via-slate-900 to-slate-900 p-8 flex flex-col relative shrink-0">
                {/* Decoration */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-600/20 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="mb-10">
                        <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-4">
                            TEAM PROFILE
                        </span>
                        <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{team.name}</h2>
                        <div className="flex items-center gap-3 text-indigo-200/60 font-mono text-sm">
                            <span>{team.data?.code || 'NO CODE'}</span>
                            <span className="w-1 h-1 bg-indigo-500 rounded-full" />
                            <span>{team.children.length} Members</span>
                        </div>
                    </div>

                    {/* Leader Profile */}
                    <div className="mb-10">
                        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCrown} /> Team Leader
                        </h3>
                        {leader ? (
                            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-orange-500/20">
                                        <FontAwesomeIcon icon={faUserTie} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">{leader.name}</h4>
                                        <p className="text-slate-400 text-sm">{leader.data?.role || '팀장/소장'}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-sm text-slate-400 bg-black/20 p-2 rounded-lg">
                                        <FontAwesomeIcon icon={faPhone} className="text-slate-600 w-4" />
                                        <span>{leader.data?.phone || '연락처 정보 없음'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl border border-dashed border-slate-700 text-slate-500 text-center">
                                <FontAwesomeIcon icon={faUserTie} className="text-2xl mb-2 opacity-50" />
                                <p className="text-sm">팀장이 배정되지 않았습니다.</p>
                            </div>
                        )}
                    </div>

                    {/* Assigned Sites */}
                    <div>
                        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FontAwesomeIcon icon={faMapMarkerAlt} /> Assigned Sites
                        </h3>
                        {sites.length > 0 ? (
                            <div className="space-y-2">
                                {sites.map((site: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm">
                                            <FontAwesomeIcon icon={faBuilding} />
                                        </div>
                                        <span className="text-slate-200 text-sm font-medium">{site}</span>
                                        <FontAwesomeIcon icon={faChevronRight} className="ml-auto text-slate-600 text-xs" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm italic pl-2">배정된 현장이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Members Grid (Rest) */}
            <div className="flex-1 bg-slate-950 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full" />
                        Team Members
                    </h3>
                    <div className="text-sm text-slate-500">
                        총 <span className="text-white font-bold">{members.length}</span>명
                    </div>
                </div>

                {members.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {members.map((member, idx) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4 hover:bg-slate-800 hover:border-slate-700 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-lg group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                                    <FontAwesomeIcon icon={faHardHat} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-200 group-hover:text-white transition-colors">{member.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                                            {member.data?.role || '팀원'}
                                        </span>
                                        <span className="text-xs text-slate-600 font-mono">
                                            {member.data?.type || '일용직'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl">
                        <FontAwesomeIcon icon={faUsers} className="text-4xl mb-4 opacity-30" />
                        <p>등록된 팀원이 없습니다.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default CheongyeonOrgChartPage;
