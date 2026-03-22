import React, { useState, useMemo, useEffect } from 'react';
import { useOrganizationTree, OrgNode } from './hooks/useOrganizationTree';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUserTie, faHardHat, faSearch,
    faSitemap, faCrown, faArrowRight, faIdCard, faMapMarkerAlt,
    faPhone, faEnvelope, faTimes, faChevronRight, faProjectDiagram
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';

// --- Types ---
type TabType = 'construction' | 'partner';

type MemberReportRow = {
    reportId: string;
    date: string;
    siteName: string;
    manDay: number;
    workContent: string;
};

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

            {/* Header - Premium Upgrade */}
            <header className="sticky top-0 z-40 bg-[#0f172a]/70 backdrop-blur-2xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
                <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                    <div
                        className="flex items-center gap-5 cursor-pointer group"
                        onClick={() => setSelectedTeam(null)}
                    >
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] group-hover:scale-105 transition-all duration-300 overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 blur-md rounded-full -top-4 -left-4 w-10 h-10 transform scale-0 group-hover:scale-150 transition-transform duration-500 origin-top-left" />
                            <FontAwesomeIcon icon={faProjectDiagram} className="text-2xl relative z-10" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight group-hover:from-cyan-300 group-hover:to-blue-400 transition-all duration-300 drop-shadow-sm">청연 건설 조직도</h1>
                            <p className="text-xs text-cyan-500/80 font-bold uppercase tracking-[0.2em] mt-0.5 group-hover:text-cyan-400 transition-colors">Integrated Organization System</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Tabs - Premium Segmented Control */}
                        <div className="hidden sm:flex p-1.5 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-inner shadow-black/50">
                            <TabButton
                                active={activeTab === 'construction'}
                                onClick={() => { setActiveTab('construction'); setSelectedTeam(null); }}
                                icon={faBuilding}
                                label="시공사 그룹"
                            />
                            <TabButton
                                active={activeTab === 'partner'}
                                onClick={() => { setActiveTab('partner'); setSelectedTeam(null); }}
                                icon={faUsers}
                                label="협력사 그룹"
                            />
                        </div>

                        {/* Search Bar - Premium */}
                        <div className="relative group hidden md:block">
                            <input
                                type="text"
                                placeholder="팀, 현장, 직원명 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-72 md:w-80 pl-11 pr-4 py-3 bg-slate-900/40 border border-white/10 rounded-2xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 focus:bg-slate-900/80 transition-all text-sm text-white placeholder-slate-500 outline-none hover:bg-slate-900/60 shadow-inner"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                                <FontAwesomeIcon icon={faSearch} />
                            </div>
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
                                <section key={group.company.id} className="pt-4">
                                    <div className="flex flex-col mb-8 relative">
                                        <div className="flex flex-wrap md:flex-nowrap items-center justify-between px-2 relative z-10 w-full gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
                                                    <FontAwesomeIcon icon={faBuilding} className="text-xl text-cyan-400/80" />
                                                </div>
                                                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                                                    {group.company.name}
                                                </h2>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 border border-slate-700/50 bg-slate-800/50 p-1 rounded-full px-3">
                                                <span className="text-xs font-bold text-slate-400 uppercase">Registered Teams</span>
                                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                                                    {group.teams.length}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Premium Divider */}
                                        <div className="mt-5 w-full h-[1px] bg-gradient-to-r from-cyan-500/40 via-indigo-500/10 to-transparent relative">
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                                        </div>
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
        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2.5 relative overflow-hidden group ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
    >
        {active && (
            <motion.div
                layoutId="activeOrgTab"
                className="absolute inset-0 bg-gradient-to-r from-cyan-600/90 to-indigo-600/90 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-white/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
        )}
        {!active && (
             <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        )}
        <span className="relative z-10 flex items-center gap-2.5">
            <FontAwesomeIcon icon={icon} className={active ? "text-white" : "text-slate-600 group-hover:text-slate-400 transition-colors"} /> 
            {label}
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
                            <div className="flex items-center justify-end gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/30 bg-slate-800 flex items-center justify-center text-slate-500">
                                    {leader.data?.profileImageUrl ? (
                                        <img
                                            src={leader.data.profileImageUrl}
                                            alt={`${leader.name} 프로필`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <FontAwesomeIcon icon={faUserTie} className="text-xs" />
                                    )}
                                </div>
                                <div className="text-sm font-bold text-slate-200">{leader.name}</div>
                            </div>
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
    const [selectedMember, setSelectedMember] = useState<OrgNode | null>(null);
    const [memberReports, setMemberReports] = useState<MemberReportRow[]>([]);
    const [loadingMemberReports, setLoadingMemberReports] = useState(false);

    const sites = team.data?.siteNames && team.data.siteNames.length > 0
        ? team.data.siteNames
        : (team.data?.assignedSiteName ? [team.data.assignedSiteName] : []);

    useEffect(() => {
        const loadMemberReports = async () => {
            if (!selectedMember) {
                setMemberReports([]);
                return;
            }

            setLoadingMemberReports(true);
            try {
                const teamReports = await dailyReportService.getReports({ teamId: team.id });
                const selectedWorkerId = String(selectedMember.id || '').trim();
                const selectedWorkerName = String(selectedMember.name || '').trim();

                const rows: MemberReportRow[] = [];
                teamReports.forEach((report: DailyReport) => {
                    const matchingWorkers = (report.workers || []).filter((worker) => {
                        const workerId = String(worker.workerId || '').trim();
                        const workerName = String(worker.name || '').trim();
                        return (selectedWorkerId && workerId === selectedWorkerId)
                            || (selectedWorkerName && workerName === selectedWorkerName);
                    });

                    const workContents = matchingWorkers
                        .map((worker) => String(worker.workContent || '').trim())
                        .filter(Boolean);

                    if (matchingWorkers.length > 0) {
                        rows.push({
                            reportId: String(report.id || `${report.date}-${report.siteId || report.siteName || 'unknown'}`),
                            date: String(report.date || ''),
                            siteName: String(report.siteName || '현장 미기록'),
                            manDay: matchingWorkers.reduce((sum, worker) => sum + (typeof worker.manDay === 'number' ? worker.manDay : 0), 0),
                            workContent: workContents.length > 0 ? Array.from(new Set(workContents)).join(' / ') : String(report.workContent || '-').trim() || '-',
                        });
                    }
                });

                rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
                setMemberReports(rows);
            } catch (error) {
                console.error('Failed to load member reports:', error);
                setMemberReports([]);
            } finally {
                setLoadingMemberReports(false);
            }
        };

        loadMemberReports();
    }, [selectedMember, team.id]);

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
                            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="relative mb-4 rounded-2xl overflow-hidden border border-amber-400/25 bg-slate-900/70">
                                    <div className="w-full h-52 md:h-60">
                                        {leader.data?.profileImageUrl ? (
                                            <img
                                                src={leader.data.profileImageUrl}
                                                alt={`${leader.name} 프로필`}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-5xl">
                                                <FontAwesomeIcon icon={faUserTie} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
                                        <h4 className="text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">{leader.name}</h4>
                                        <p className="text-slate-200 text-sm">{leader.data?.role || '팀장/소장'}</p>
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
                                onClick={() => setSelectedMember(member)}
                                className={`bg-slate-900 p-4 rounded-xl border flex items-center gap-4 transition-all group cursor-pointer ${selectedMember?.id === member.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-800 hover:bg-slate-800 hover:border-slate-700'}`}
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

                {selectedMember && (
                    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-cyan-300">
                                {selectedMember.name} 출력일보 이력
                            </h4>
                            <span className="text-xs text-slate-500">총 {memberReports.length}건</span>
                        </div>

                        {loadingMemberReports ? (
                            <div className="px-5 py-8 text-sm text-slate-500">출력일보 불러오는 중...</div>
                        ) : memberReports.length === 0 ? (
                            <div className="px-5 py-8 text-sm text-slate-500">해당 팀원의 출력일보 기록이 없습니다.</div>
                        ) : (
                            <div className="overflow-auto max-h-80">
                                <table className="w-full text-sm text-left text-slate-300">
                                    <thead className="sticky top-0 bg-slate-950/95 text-xs text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-5 py-3 whitespace-nowrap">날짜</th>
                                            <th className="px-5 py-3 whitespace-nowrap">현장</th>
                                            <th className="px-5 py-3 whitespace-nowrap text-right">공수</th>
                                            <th className="px-5 py-3">작업내용</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {memberReports.map((row) => (
                                            <tr key={row.reportId} className="border-t border-slate-800 hover:bg-slate-800/40">
                                                <td className="px-5 py-3 whitespace-nowrap text-slate-300">{row.date || '-'}</td>
                                                <td className="px-5 py-3 whitespace-nowrap text-slate-300">{row.siteName || '-'}</td>
                                                <td className="px-5 py-3 whitespace-nowrap text-right text-cyan-300 font-semibold">{row.manDay.toFixed(1)}</td>
                                                <td className="px-5 py-3 text-slate-400">{row.workContent || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default CheongyeonOrgChartPage;
