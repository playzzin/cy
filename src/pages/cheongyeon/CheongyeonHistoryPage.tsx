import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faCity,
    faHelmetSafety,
    faTrophy,
    faUsers,
    faChartLine,
    faAward,
    faNetworkWired,
    faSeedling,
    faGlobe,
    faRocket,
} from '@fortawesome/free-solid-svg-icons';
import { useSiteMode } from '../../contexts/SiteModeContext';

type HistoryItem = {
    year: number;
    title: string;
    summary: string;
    details: string[];
    icon: any;
    accent: string;
};

const HISTORY_ITEMS: HistoryItem[] = [
    {
        year: 2016,
        title: '법인 설립 및 기반 구축',
        summary: '청연ENG 설립과 함께 시스템 비계/동바리 시공 체계를 정비했습니다.',
        details: ['법인 출범', '핵심 인력 조직 구성', '안전·품질 기준 초안 수립'],
        icon: faBuilding,
        accent: 'from-amber-400 to-orange-500',
    },
    {
        year: 2017,
        title: '초기 레퍼런스 확보',
        summary: '중소형 현장 수행을 통해 표준 공정과 운영 매뉴얼을 정착시켰습니다.',
        details: ['공정 표준화', '협력사 네트워크 확장', '현장 커뮤니케이션 프로토콜 수립'],
        icon: faCity,
        accent: 'from-cyan-400 to-sky-500',
    },
    {
        year: 2018,
        title: '안전 중심 운영 고도화',
        summary: '시공 안전관리 체계를 강화하며 현장 리스크 대응 속도를 높였습니다.',
        details: ['안전 점검 루틴 고도화', '현장 교육 강화', '사고 예방 체크리스트 운영'],
        icon: faHelmetSafety,
        accent: 'from-emerald-400 to-green-500',
    },
    {
        year: 2019,
        title: '주요 프로젝트 수주 확대',
        summary: '대형 프로젝트 참여 비중을 높이며 시공 역량을 검증했습니다.',
        details: ['중대형 현장 다수 수행', '공정 안정성 개선', '납기 준수율 향상'],
        icon: faTrophy,
        accent: 'from-fuchsia-400 to-pink-500',
    },
    {
        year: 2020,
        title: '현장 운영 디지털 전환 시작',
        summary: '현장 데이터 기반 관리 체계를 도입해 의사결정 속도를 높였습니다.',
        details: ['현장 데이터 수집 자동화', '보고 체계 디지털화', '인력 배치 정확도 향상'],
        icon: faUsers,
        accent: 'from-violet-400 to-purple-500',
    },
    {
        year: 2021,
        title: '성과 지표 중심 경영',
        summary: '원가·생산성·품질 지표를 통합 관리하며 운영 효율을 개선했습니다.',
        details: ['KPI 대시보드 정착', '공정 생산성 개선', '품질 기준 재정의'],
        icon: faChartLine,
        accent: 'from-blue-400 to-indigo-500',
    },
    {
        year: 2022,
        title: '품질/신뢰도 경쟁력 강화',
        summary: '재시공 최소화 및 현장 대응 고도화로 고객 신뢰도를 높였습니다.',
        details: ['품질검수 프로세스 강화', '현장 대응 리드타임 단축', '고객사 만족도 향상'],
        icon: faAward,
        accent: 'from-teal-400 to-cyan-500',
    },
    {
        year: 2023,
        title: '전국 단위 협업 네트워크 확장',
        summary: '권역별 협력 체계를 구축해 기동성과 대응 범위를 넓혔습니다.',
        details: ['권역별 협력팀 확보', '긴급 공정 대응력 강화', '자재·인력 연계 최적화'],
        icon: faNetworkWired,
        accent: 'from-lime-400 to-emerald-500',
    },
    {
        year: 2024,
        title: '지속가능 운영 체계 정비',
        summary: '장기 성장 기반을 위한 인재·안전·품질 밸런스를 강화했습니다.',
        details: ['인재 육성 체계 정비', '안전/품질 통합 점검', '운영 표준 고도화'],
        icon: faSeedling,
        accent: 'from-green-400 to-teal-500',
    },
    {
        year: 2025,
        title: '브랜드 신뢰 자산 확장',
        summary: '레퍼런스 고도화와 서비스 품질 안정화를 통해 브랜드 가치를 높였습니다.',
        details: ['대표 레퍼런스 강화', '프로세스 안정성 향상', '대외 커뮤니케이션 체계화'],
        icon: faGlobe,
        accent: 'from-sky-400 to-blue-500',
    },
    {
        year: 2026,
        title: '스마트 현장 운영 가속',
        summary: '데이터 기반 운영과 자동화 프로세스를 결합해 다음 도약을 준비합니다.',
        details: ['데이터 기반 운영 고도화', '자동화 워크플로 확대', '차세대 성장 전략 실행'],
        icon: faRocket,
        accent: 'from-orange-400 to-rose-500',
    },
];

const CheongyeonHistoryPage: React.FC = () => {
    const { isDarkMode } = useSiteMode();

    return (
        <div
            className={`relative min-h-screen overflow-hidden ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}
            style={{ fontFamily: "'Pretendard Variable','Pretendard','SUIT Variable','Noto Sans KR',sans-serif" }}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className={`absolute -top-40 -left-32 h-96 w-96 rounded-full blur-3xl ${isDarkMode ? 'bg-cyan-500/15' : 'bg-cyan-500/10'}`} />
                <div className={`absolute -bottom-32 -right-20 h-96 w-96 rounded-full blur-3xl ${isDarkMode ? 'bg-fuchsia-500/10' : 'bg-indigo-500/10'}`} />
            </div>

            <main className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:px-8 md:py-16">
                <motion.header
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="mb-12 md:mb-16"
                >
                    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${isDarkMode ? 'bg-white/10 border border-white/20 text-cyan-100' : 'bg-white border border-slate-200 text-cyan-700'}`}>
                        <FontAwesomeIcon icon={faBuilding} />
                        Company History
                    </div>
                    <h1 className={`mt-5 text-4xl font-black tracking-tight md:text-6xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        청연ENG 회사연혁
                    </h1>
                    <p className={`mt-4 max-w-3xl text-base leading-relaxed md:text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        2016년부터 현재까지, 청연ENG가 쌓아온 성장의 흐름을 연도별로 정리했습니다.
                        시공 역량, 안전 운영, 디지털 전환, 그리고 조직의 확장을 시간 축 위에서 한눈에 확인할 수 있습니다.
                    </p>
                </motion.header>

                <div className="relative">
                    <div className={`absolute left-4 top-0 h-full w-px md:left-1/2 md:-translate-x-1/2 ${isDarkMode ? 'bg-white/15' : 'bg-slate-300'}`} />

                    <div className="space-y-8 md:space-y-10">
                        {HISTORY_ITEMS.map((item, index) => {
                            const isLeft = index % 2 === 0;

                            return (
                                <motion.article
                                    key={item.year}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }}
                                    transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.35) }}
                                    className="relative"
                                >
                                    <div className={`grid grid-cols-1 md:grid-cols-2 ${isLeft ? '' : 'md:[&>div:first-child]:order-2'} gap-4 md:gap-8`}>
                                        <div className={isLeft ? 'md:pr-10' : 'md:pl-10'}>
                                            <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${isDarkMode ? 'bg-white/5 border-white/15 shadow-black/40' : 'bg-white/90 border-slate-200 shadow-slate-200/70'}`}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className={`text-xs font-bold tracking-[0.2em] ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>YEAR</div>
                                                        <div className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.year}</div>
                                                    </div>
                                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg`}>
                                                        <FontAwesomeIcon icon={item.icon} />
                                                    </div>
                                                </div>

                                                <h2 className={`mt-5 text-xl font-extrabold md:text-2xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                    {item.title}
                                                </h2>
                                                <p className={`mt-3 text-sm leading-relaxed md:text-base ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    {item.summary}
                                                </p>

                                                <ul className="mt-5 space-y-2.5">
                                                    {item.details.map((detail) => (
                                                        <li key={detail} className="flex items-start gap-2.5">
                                                            <span className={`mt-1 inline-block h-2 w-2 rounded-full bg-gradient-to-r ${item.accent}`} />
                                                            <span className={`text-sm md:text-[15px] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                {detail}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="relative hidden md:block">
                                            <div className={`absolute top-10 h-6 w-6 -translate-y-1/2 rounded-full border-4 ${isLeft ? '-left-3' : '-right-3'} ${isDarkMode ? 'bg-slate-950 border-cyan-300' : 'bg-white border-cyan-500'}`} />
                                        </div>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CheongyeonHistoryPage;
