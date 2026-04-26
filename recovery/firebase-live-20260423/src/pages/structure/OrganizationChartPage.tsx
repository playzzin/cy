import React, { useState, useEffect, useMemo } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUser, faHardHat, faMapMarkerAlt,
    faChevronDown, faChevronRight, faSearch, faSitemap, faExclamationTriangle, faProjectDiagram, faArrowDown, faCheck, faTimes, faRobot, faIdCard, faCommentDots, faDatabase, faDiagramProject, faCrown,
    faCalculator, faUserShield, faBullhorn, faCode, faBriefcase, faLaptopCode, faHandshake, faFileInvoice, faShieldHalved,
    faHelmetSafety, faFileSignature, faTruckLoading, faScaleBalanced, faLayerGroup
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import InteractiveOrgChart from '../../components/structure/InteractiveOrgChart';

// ============================================================================
// 1. 핵심 5개 부서 프리미엄 설정 (Team Operation Grid)
// ============================================================================
const HQ_DEPT_CONFIG: Record<string, { 
    vision: string, 
    strategy: string, 
    desc: string, 
    tasks: string[], 
    icon: any, 
    color: string, 
    bgColor: string, 
    image: string,
    keywords: string[] // 매칭 확률을 높이기 위한 키워드
}> = {
    '인사': {
        vision: 'People & Culture Core',
        strategy: '직무 역량 강화와 성과 기반 보상 체계 확립',
        desc: '인재 채용부터 교육, 평가, 보상까지 전 과정을 관리하여 조직의 경쟁력을 높입니다.',
        tasks: ['우수 인재 채용 및 적재적소 배치', '급여 및 4대보험, 퇴직금 정산', '성과 평가 및 합리적 보상 설계', '노무 법규 준수 및 노사 협력 관리', '임직원 역량 강화 교육 기획'],
        icon: faUserShield,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&q=80&w=800',
        keywords: ['인사', 'HR', '노무', '채용']
    },
    '회계': {
        vision: 'Financial Transparency',
        strategy: '투명한 자금 흐름 관리와 선제적 리스크 대응',
        desc: '기업의 재무 상태를 정확히 진단하고 효율적인 자금 운영 계획을 수립합니다.',
        tasks: ['월/분기/연 결산 보고 및 감사 수감', '각종 세무 신고 (부가세, 법인세 등)', '전사 자금 수지 계획 및 집행 관리', '법인카드 및 경비 지출 모니터링', '원가 분석 및 이익 지표 관리'],
        icon: faCalculator,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800',
        keywords: ['회계', '재무', '경리', '자금']
    },
    '관리': {
        vision: 'Operational Excellence',
        strategy: '표준화된 행정 시스템과 자산 가치 극대화',
        desc: '사내 인프라를 안정적으로 지원하고 기업 자산을 체계적으로 관리합니다.',
        tasks: ['유무형 자산 및 비품 통합 관리', '본사 시설 유지보수 및 차량 관리', '대내외 공문서 수발신 및 법무 지원', '전사 소모품 구매 및 비용 최적화', '복리후생 제도 운영 및 사내 행사 지원'],
        icon: faBriefcase,
        color: 'text-slate-600',
        bgColor: 'bg-slate-100',
        image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=800',
        keywords: ['관리', '총무', '행정', '지원']
    },
    '영업': {
        vision: 'Market Expansion Leader',
        strategy: '전략적 네트워크 구축과 수익 중심 수주 확대',
        desc: '건설 시장 트렌드를 분석하고 신규 사업 기회를 발굴하여 매출 성장을 주도합니다.',
        tasks: ['신규 발주처 발굴 및 입찰 참여', '기존 협력사 및 시행사 네트워크 관리', '수주 목표 설정 및 달성 현황 분석', '프로젝트 사업성 검토 및 견적 지원', '시장 동향 조사 및 경쟁사 모니터링'],
        icon: faBullhorn,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800',
        keywords: ['영업', '수주', '견적', '마케팅']
    },
    '개발': {
        vision: 'Digital Backbone',
        strategy: '기술 혁신을 통한 건설 업무 프로세스 자동화',
        desc: '데이터 기반의 효율적인 의사결정을 돕는 사내 IT 생태계를 구축합니다.',
        tasks: ['ERP 시스템 및 사내 솔루션 개발/운영', 'AI OCR 기술 도입 및 데이터 자동화', '클라우드 서버 인프라 보안 및 관리', '임직원 IT 기술 지원 및 협업툴 운영', '디지털 트랜스포메이션 과제 발굴'],
        icon: faCode,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800',
        keywords: ['개발', 'IT', '전산', '소프트웨어']
    }
};

const OrganizationChartPage: React.FC = () => {
    const [viewMode, setViewMode] = useState<'team' | 'company' | 'site' | 'interactive'>('team');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [w, t, c] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                companyService.getCompanies()
            ]);
            setWorkers(w);
            setTeams(t);
            setCompanies(c);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTeam = (id: string) => {
        const newSet = new Set(expandedTeams);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedTeams(newSet);
    };

    // Filter Logic
    const filterNode = (name: string | undefined) => (name || '').toLowerCase().includes(searchTerm.toLowerCase());

    // ============================================================================
    // RENDER: 프리미엄 팀 운영 그리드 (핵심 5개 부서)
    // ============================================================================
    const renderOperationGrid = () => {
        return (
            <div className="space-y-12">
                <div className="flex flex-col items-center text-center py-10">
                    <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-4">CY SYSTEM OPERATIONS</span>
                    <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">본사 핵심 운영 그리드</h3>
                    <p className="text-slate-500 text-lg max-w-2xl font-medium leading-relaxed">
                        부서별 현장 정보나 인원 통계 대신, <span className="text-indigo-600 font-black">실제 수행하는 업무와 운영 전략</span>에 집중한 전문 리포트입니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-20">
                    {Object.entries(HQ_DEPT_CONFIG).map(([name, config]) => {
                        // DB에서 해당 팀 찾기 (키워드 기반 매칭)
                        const matchedTeam = teams.find(t => config.keywords.some(k => t.name.includes(k)));
                        const teamWorkers = matchedTeam ? workers.filter(w => w.teamId === matchedTeam.id) : [];
                        const isExpanded = matchedTeam ? expandedTeams.has(matchedTeam.id!) : false;

                        return (
                            <div key={name} className="bg-white rounded-[60px] shadow-2xl shadow-indigo-100/50 border border-slate-100 overflow-hidden flex flex-col xl:flex-row min-h-[600px] transition-all hover:scale-[1.005]">
                                {/* 사진 영역 */}
                                <div className="xl:w-1/2 relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-slate-900/30 group-hover:bg-slate-900/10 transition-all z-10" />
                                    <img src={config.image} alt={name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                                    <div className="absolute inset-0 z-20 p-12 flex flex-col justify-end text-white">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-16 h-16 rounded-[24px] bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center text-3xl">
                                                <FontAwesomeIcon icon={config.icon} />
                                            </div>
                                            <div className="h-[2px] bg-white/30 flex-1" />
                                        </div>
                                        <span className="text-sm font-black uppercase tracking-[0.4em] text-indigo-300 mb-2">{config.vision}</span>
                                        <h4 className="text-8xl font-black tracking-tighter mb-4">{name}<span className="font-thin text-5xl opacity-60 ml-4 italic">Core</span></h4>
                                    </div>
                                </div>

                                {/* 상세 업무 그리드 영역 */}
                                <div className="xl:w-1/2 p-12 lg:p-20 flex flex-col justify-center bg-white relative">
                                    <div className="mb-14">
                                        <div className="inline-flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest mb-6 py-2 px-5 bg-indigo-50 rounded-2xl shadow-sm shadow-indigo-100">
                                            <FontAwesomeIcon icon={faProjectDiagram} />
                                            Strategic Objective
                                        </div>
                                        <h5 className="text-4xl font-black text-slate-900 leading-tight mb-8 tracking-tighter">{config.strategy}</h5>
                                        <p className="text-xl text-slate-500 font-medium leading-relaxed pl-8 border-l-[10px] border-indigo-600 shadow-inner rounded-r-2xl py-2">{config.desc}</p>
                                    </div>

                                    <div className="flex-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-8 flex items-center gap-6">
                                            Key Roles & Tasks
                                            <div className="h-px bg-slate-100 flex-1" />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {config.tasks.map((task, idx) => (
                                                <div key={idx} className="flex items-center gap-6 p-6 rounded-[32px] bg-slate-50 border-2 border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl transition-all group">
                                                    <div className={`w-4 h-4 rounded-full shrink-0 ${config.color.replace('text-', 'bg-')} opacity-60 group-hover:scale-150 transition-transform shadow-lg shadow-current`} />
                                                    <span className="text-lg text-slate-800 font-black tracking-tight">{task}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 인사 정보 (선택적 표시) */}
                                    <div className="mt-16 pt-12 border-t border-slate-100 flex items-center justify-between">
                                        {matchedTeam ? (
                                            <>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex -space-x-4">
                                                        {teamWorkers.slice(0, 5).map(w => (
                                                            <div key={w.id} className="w-14 h-14 rounded-full ring-4 ring-white bg-slate-100 flex items-center justify-center text-slate-400 shadow-lg"><FontAwesomeIcon icon={faUser} /></div>
                                                        ))}
                                                        {teamWorkers.length > 5 && (
                                                            <div className="w-14 h-14 rounded-full ring-4 ring-white bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-lg">+{teamWorkers.length - 5}</div>
                                                        )}
                                                    </div>
                                                    <div className="hidden sm:block">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase">Registered</div>
                                                        <div className="text-sm font-black text-slate-800">Operational Personnel</div>
                                                    </div>
                                                </div>
                                                <button onClick={() => toggleTeam(matchedTeam.id!)} className={`px-10 py-4 rounded-3xl text-sm font-black transition-all ${isExpanded ? 'bg-slate-900 text-white shadow-2xl' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                    {isExpanded ? '리스트 닫기' : '명단 조회'}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="text-slate-300 font-black italic uppercase tracking-widest text-xs">System Matching Pending...</div>
                                        )}
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && matchedTeam && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-8 p-8 bg-slate-900 rounded-[40px] grid grid-cols-2 gap-4">
                                                {teamWorkers.map(w => (
                                                    <div key={w.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col">
                                                        <span className="text-white font-black">{w.name}</span>
                                                        <span className="text-[10px] text-white/40 font-bold uppercase mt-1">{w.role || 'Member'}</span>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ============================================================================
    // RENDER: 시공 현장 리스트
    // ============================================================================
    const renderFieldList = () => {
        // '시공'이 포함된 팀들 위주로 필터링
        const fieldTeams = teams.filter(t => !Object.keys(HQ_DEPT_CONFIG).some(key => t.name.includes(key)));

        return (
            <div className="mt-32 pt-20 border-t-2 border-slate-200">
                <div className="flex items-center gap-6 mb-16">
                    <div className="w-24 h-24 bg-slate-900 text-white rounded-[40px] flex items-center justify-center shadow-3xl">
                        <FontAwesomeIcon icon={faHardHat} size="3x" />
                    </div>
                    <div>
                        <h3 className="text-5xl font-black text-slate-900 tracking-tighter">Field Operations</h3>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-sm mt-2">현장 실시간 투입 및 인원 관리</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {fieldTeams.map(team => {
                        const teamWorkers = workers.filter(w => w.teamId === team.id);
                        const isExpanded = expandedTeams.has(team.id!);
                        if (searchTerm && !filterNode(team.name)) return null;

                        return (
                            <div key={team.id} className="bg-white rounded-[40px] border border-slate-200 hover:border-indigo-500 transition-all group overflow-hidden hover:shadow-2xl">
                                <div className="p-10 flex items-center justify-between cursor-pointer hover:bg-slate-50/50" onClick={() => toggleTeam(team.id!)}>
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-[30px] flex items-center justify-center transition-all duration-500 shadow-inner">
                                            <FontAwesomeIcon icon={faHardHat} size="lg" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-800 group-hover:text-indigo-900 transition-colors tracking-tight">{team.name}</h4>
                                            <div className="flex items-center gap-3 text-sm font-bold text-slate-400 mt-2">
                                                <span className="text-indigo-600 font-black">{teamWorkers.length} Personnel</span>
                                            </div>
                                        </div>
                                    </div>
                                    <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-slate-300 group-hover:text-indigo-400 transition-colors text-xl" />
                                </div>
                                {isExpanded && (
                                    <div className="px-10 pb-10 pt-0 bg-white grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
                                        {teamWorkers.map(w => (
                                            <div key={w.id} className="px-5 py-4 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4 hover:bg-white hover:border-indigo-200 transition-all">
                                                <div className="w-2 h-2 rounded-full bg-indigo-300" />
                                                <span className="text-base font-black text-slate-700">{w.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-x-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 sticky top-0 z-40 shadow-sm">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
                    <FontAwesomeIcon icon={faSitemap} className="text-indigo-600" />
                    조직도 리포트
                </h2>
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button onClick={() => setViewMode('team')} className={`px-6 py-3 rounded-xl text-sm font-black transition-all ${viewMode === 'team' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>팀 기준 그리드</button>
                    <button onClick={() => setViewMode('interactive')} className={`px-6 py-3 rounded-xl text-sm font-black transition-all ${viewMode === 'interactive' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>인터랙티브 트리</button>
                </div>
            </div>

            {/* Search */}
            <div className="p-6 bg-white border-b border-slate-100">
                <div className="relative max-w-xl mx-auto">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="부서명, 업무 키워드, 사원명 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 text-lg font-bold" />
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 p-8 lg:p-16 max-w-[1600px] mx-auto w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-6">
                        <FontAwesomeIcon icon={faSitemap} spin className="text-6xl text-indigo-200" />
                        <p className="text-xl font-black text-slate-400 animate-pulse uppercase tracking-widest">Constructing Map...</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'team' && (
                            <>
                                {renderOperationGrid()}
                                {renderFieldList()}
                            </>
                        )}
                        {viewMode === 'interactive' && (
                            <InteractiveOrgChart companies={companies} teams={teams} workers={workers} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default OrganizationChartPage;
