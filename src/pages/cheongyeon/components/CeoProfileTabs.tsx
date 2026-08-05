import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faAward,
    faBriefcase,
    faBuilding,
    faChartLine,
    faChevronDown,
    faCompass,
    faFileLines,
    faHandshake,
    faHardHat,
    faIdCard,
    faImages,
    faShieldHalved,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion } from 'framer-motion';
import ceoPortrait from '../../../assets/ceo_portrait.png';
import brandSkyline from '../../../assets/logo_finished.png';
import brandConstruction from '../../../assets/logo_construction.jpg';

type ProfileTab = 'brand' | 'resume' | 'introduction';

interface CeoProfileTabsProps {
    isDarkMode: boolean;
}

const profileTabs: Array<{
    id: ProfileTab;
    label: string;
    description: string;
    icon: typeof faImages;
}> = [
    {
        id: 'brand',
        label: '대표브랜드',
        description: '청연을 표현하는 공식 이미지',
        icon: faImages,
    },
    {
        id: 'resume',
        label: '대표이력서',
        description: '대표 이력과 청연의 약속',
        icon: faIdCard,
    },
    {
        id: 'introduction',
        label: '대표소개서',
        description: '경영 철학과 소개',
        icon: faFileLines,
    },
];

const brandItems = [
    {
        title: '청연 시그니처',
        subtitle: '도시의 성장과 신뢰를 담은 대표 브랜드',
        image: brandSkyline,
        imageAlt: '청연이엔지 도시형 시그니처 브랜드',
        imageClassName: 'object-contain',
        surfaceClassName: 'bg-white',
    },
    {
        title: '현장 아이덴티티',
        subtitle: '건설 현장의 실행력과 안전을 상징하는 브랜드',
        image: brandConstruction,
        imageAlt: '청연이엔지 건설 현장형 브랜드',
        imageClassName: 'object-cover',
        surfaceClassName: 'bg-white',
    },
    {
        title: '공식 워드마크',
        subtitle: '문서와 대외 커뮤니케이션에 사용하는 기본 로고',
        image: '/assets/estimate/cheongyeon-logo.png',
        imageAlt: '청연이엔지 공식 워드마크',
        imageClassName: 'object-contain px-5 sm:px-8',
        surfaceClassName: 'bg-gradient-to-br from-slate-950 to-blue-950',
    },
    {
        title: '디지털 심벌',
        subtitle: '청연의 시스템과 디지털 현장 관리를 나타내는 아이콘',
        image: '/icons/icon-512.png',
        imageAlt: '청연 디지털 서비스 심벌',
        imageClassName: 'object-contain p-8 sm:p-10',
        surfaceClassName: 'bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950',
    },
];

const careerRows = [
    {
        category: '현재',
        title: '주식회사 청연이엔지 대표이사',
        description: '경영 전략과 현장 운영 기준, 안전 및 협력사 관리 체계를 총괄합니다.',
    },
    {
        category: '운영 총괄',
        title: '전사적 사무관리 체계 구축·운영',
        description: '계약, 공정, 인력, 출역, 정산 데이터를 하나의 업무 흐름으로 연결합니다.',
    },
    {
        category: '현장 관리',
        title: '실시간 현장관리 및 책임 시공',
        description: '작업 현황과 안전 정보를 확인해 공기, 품질, 마감의 기준을 일관되게 관리합니다.',
    },
    {
        category: '상생 관리',
        title: '근로 기록·정산 및 협력사 운영',
        description: '정확한 출역 기록과 투명한 정산 기준으로 임금 사고를 예방합니다.',
    },
];

const resumeHighlights = [
    {
        icon: faChartLine,
        title: '전사 관리',
        description: '계약·공정·인력·정산 정보를 하나의 운영 흐름으로 관리',
    },
    {
        icon: faHardHat,
        title: '현장 운영',
        description: '작업·안전·출역 정보를 실시간으로 확인하는 책임 경영',
    },
    {
        icon: faShieldHalved,
        title: '안전·임금',
        description: '안전을 타협하지 않고 임금 사고를 예방하는 투명한 기준',
    },
    {
        icon: faHandshake,
        title: '협력과 상생',
        description: '자체팀과 협력사팀이 같은 공정 기준으로 움직이는 구조',
    },
];

const introductionSections = [
    {
        id: 'philosophy',
        eyebrow: '01 · 경영 철학',
        title: '신뢰는 투명한 운영에서 시작됩니다',
        icon: faCompass,
        content: [
            '청연은 감에 의존하는 시공보다 데이터로 확인하고 책임 있게 관리하는 시공을 지향합니다.',
            '사무실과 현장의 정보를 하나의 기준으로 연결해 발주처, 협력사, 근로자가 모두 안심할 수 있는 운영 체계를 만들겠습니다.',
        ],
    },
    {
        id: 'execution',
        eyebrow: '02 · 실행 원칙',
        title: '공기와 품질을 끝까지 책임집니다',
        icon: faBuilding,
        content: [
            '약속된 공사기간을 지키고 가능한 범위에서는 공기를 단축할 수 있도록 공정의 병목과 낭비를 선제적으로 관리합니다.',
            '과정의 속도만큼 책임 있는 마감과 예측 가능한 운영을 중요하게 생각합니다.',
        ],
    },
    {
        id: 'safety',
        eyebrow: '03 · 사람과 안전',
        title: '안전과 임금은 타협하지 않는 기준입니다',
        icon: faShieldHalved,
        content: [
            '현장의 안전을 최우선으로 두고 정확한 근로 기록과 정산 기준을 통해 임금 사고를 예방합니다.',
            '모든 구성원이 믿고 일할 수 있는 환경이 지속 가능한 성과의 출발점이라는 원칙을 지킵니다.',
        ],
    },
    {
        id: 'partnership',
        eyebrow: '04 · 상생과 협력',
        title: '같은 기준으로 움직이는 파트너십을 만듭니다',
        icon: faUsers,
        content: [
            '자체팀과 협력사팀을 구분하기보다 하나의 공정 목표와 투명한 기준으로 연결합니다.',
            '각자의 역할과 책임이 분명한 협업 구조를 통해 더 안전하고 신뢰할 수 있는 현장을 만들겠습니다.',
        ],
    },
];

const CeoProfileTabs: React.FC<CeoProfileTabsProps> = ({ isDarkMode }) => {
    const [activeTab, setActiveTab] = useState<ProfileTab>('brand');
    const [openIntroductionId, setOpenIntroductionId] = useState<string>('philosophy');

    const focusProfileTab = (tabId: ProfileTab) => {
        setActiveTab(tabId);
        window.requestAnimationFrame(() => {
            document.getElementById(`ceo-profile-tab-${tabId}`)?.focus();
        });
    };

    const handleProfileTabKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        currentTabId: ProfileTab
    ) => {
        const currentIndex = profileTabs.findIndex((tab) => tab.id === currentTabId);
        if (currentIndex < 0) return;

        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % profileTabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + profileTabs.length) % profileTabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = profileTabs.length - 1;
        if (nextIndex === currentIndex) return;

        event.preventDefault();
        focusProfileTab(profileTabs[nextIndex].id);
    };

    const panelSurfaceClass = isDarkMode
        ? 'border-white/10 bg-slate-900/85 shadow-black/20'
        : 'border-slate-200 bg-white/95 shadow-slate-900/10';

    const borderClass = isDarkMode ? 'border-white/10' : 'border-slate-200';
    const mutedTextClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

    return (
        <section className="px-4 pt-8 sm:px-6 md:pt-12" aria-labelledby="ceo-profile-section-title">
            <div className="mx-auto max-w-6xl">
                <div className={`overflow-hidden rounded-[28px] border shadow-2xl backdrop-blur-xl ${panelSurfaceClass}`}>
                    <div className={`border-b px-5 py-6 sm:px-8 md:px-10 md:py-8 ${
                        isDarkMode
                            ? 'border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-blue-500/10'
                            : 'border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50'
                    }`}>
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <div className={`mb-2 text-xs font-black tracking-[0.24em] ${
                                    isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                                }`}>
                                    CEO PROFILE
                                </div>
                                <h2 id="ceo-profile-section-title" className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
                                    대표 경영 원칙
                                </h2>
                                <p className={`mt-3 max-w-2xl text-sm leading-6 sm:text-base ${
                                    isDarkMode ? 'text-slate-300' : 'text-slate-600'
                                }`}>
                                    청연의 브랜드, 대표 이력과 경영 철학을 기존 프로필 섹션에서 확인할 수 있습니다.
                                </p>
                            </div>

                            <div
                                role="tablist"
                                aria-label="대표 프로필 메뉴"
                                className={`grid grid-cols-3 gap-1 rounded-2xl border p-1.5 ${
                                    isDarkMode ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-slate-100/80'
                                }`}
                            >
                                {profileTabs.map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            id={`ceo-profile-tab-${tab.id}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls={`ceo-profile-panel-${tab.id}`}
                                            tabIndex={isActive ? 0 : -1}
                                            onClick={() => setActiveTab(tab.id)}
                                            onKeyDown={(event) => handleProfileTabKeyDown(event, tab.id)}
                                            className={`min-w-0 rounded-xl px-3 py-2.5 text-left transition-all sm:min-w-[140px] sm:px-4 ${
                                                isActive
                                                    ? isDarkMode
                                                        ? 'bg-white text-slate-950 shadow-lg'
                                                        : 'bg-slate-950 text-white shadow-lg'
                                                    : isDarkMode
                                                        ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                        : 'text-slate-500 hover:bg-white hover:text-slate-900'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2 text-xs font-black sm:text-sm">
                                                <FontAwesomeIcon icon={tab.icon} />
                                                <span className="truncate">{tab.label}</span>
                                            </span>
                                            <span className={`mt-1 hidden text-[10px] leading-4 sm:block ${
                                                isActive
                                                    ? isDarkMode ? 'text-slate-600' : 'text-slate-300'
                                                    : isDarkMode ? 'text-slate-500' : 'text-slate-400'
                                            }`}>
                                                {tab.description}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 sm:p-8 md:p-10">
                        <AnimatePresence initial={false}>
                            {activeTab === 'brand' && (
                                <motion.div
                                    key="brand"
                                    id="ceo-profile-panel-brand"
                                    role="tabpanel"
                                    aria-labelledby="ceo-profile-tab-brand"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.24 }}
                                >
                                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className={`text-xs font-bold tracking-[0.18em] ${
                                                isDarkMode ? 'text-cyan-400' : 'text-cyan-700'
                                            }`}>BRAND COLLECTION</p>
                                            <h3 className="mt-1 text-xl font-black sm:text-2xl">이미지로 만나는 청연 브랜드</h3>
                                        </div>
                                        <p className={`max-w-md text-sm leading-6 ${mutedTextClass}`}>
                                            문서, 현장, 디지털 서비스에 맞춰 확장되는 청연의 대표 이미지를 소개합니다.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        {brandItems.map((item, index) => (
                                            <figure
                                                key={item.title}
                                                className={`group overflow-hidden rounded-2xl border ${
                                                    isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'
                                                }`}
                                            >
                                                <div className={`relative aspect-[16/10] overflow-hidden ${item.surfaceClassName}`}>
                                                    <img
                                                        src={item.image}
                                                        alt={item.imageAlt}
                                                        className={`h-full w-full transition-transform duration-500 group-hover:scale-[1.03] ${item.imageClassName}`}
                                                    />
                                                    <span className="absolute left-4 top-4 rounded-full bg-slate-950/75 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-white backdrop-blur">
                                                        BRAND {String(index + 1).padStart(2, '0')}
                                                    </span>
                                                </div>
                                                <figcaption className="p-4 sm:p-5">
                                                    <h4 className="font-black">{item.title}</h4>
                                                    <p className={`mt-1 text-sm leading-5 ${mutedTextClass}`}>{item.subtitle}</p>
                                                </figcaption>
                                            </figure>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'resume' && (
                                <motion.div
                                    key="resume"
                                    id="ceo-profile-panel-resume"
                                    role="tabpanel"
                                    aria-labelledby="ceo-profile-tab-resume"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.24 }}
                                    className={`overflow-hidden rounded-2xl border ${
                                        isDarkMode ? 'border-white/10 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'
                                    }`}
                                >
                                    <div className={`grid border-b md:grid-cols-[260px_1fr] ${borderClass}`}>
                                        <div className={`relative min-h-[320px] overflow-hidden ${
                                            isDarkMode ? 'bg-slate-900' : 'bg-slate-200'
                                        }`}>
                                            <img
                                                src={ceoPortrait}
                                                alt="청연이엔지 이재욱 대표이사 프로필"
                                                className="absolute inset-0 h-full w-full object-cover object-top"
                                            />
                                        </div>

                                        <div className="p-6 sm:p-8">
                                            <div className="mb-6 flex items-center gap-3">
                                                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                                                    isDarkMode ? 'bg-cyan-400/15 text-cyan-300' : 'bg-cyan-100 text-cyan-800'
                                                }`}>
                                                    <FontAwesomeIcon icon={faBriefcase} />
                                                </span>
                                                <div>
                                                    <div className={`text-xs font-bold tracking-[0.18em] ${
                                                        isDarkMode ? 'text-cyan-400' : 'text-cyan-700'
                                                    }`}>EXECUTIVE RESUME</div>
                                                    <h3 className="text-2xl font-black">대표이사 이재욱 이력서</h3>
                                                </div>
                                            </div>

                                            <dl className={`grid overflow-hidden rounded-xl border text-sm sm:grid-cols-2 ${borderClass}`}>
                                                {[
                                                    ['성명', '이재욱'],
                                                    ['직위', '대표이사'],
                                                    ['소속', '주식회사 청연이엔지'],
                                                    ['전문분야', '건설 현장 및 전사 운영관리'],
                                                ].map(([label, value]) => (
                                                    <div key={label} className={`grid grid-cols-[88px_1fr] border-b sm:[&:nth-last-child(-n+2)]:border-b-0 ${borderClass}`}>
                                                        <dt className={`px-3 py-3 font-bold ${
                                                            isDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                                                        }`}>{label}</dt>
                                                        <dd className="px-3 py-3 font-semibold">{value}</dd>
                                                    </div>
                                                ))}
                                            </dl>

                                            <div className="mt-6">
                                                <h4 className="mb-3 text-sm font-black">주요 경력 및 담당 업무</h4>
                                                <ol className="space-y-3">
                                                    {careerRows.map((item) => (
                                                        <li key={item.category} className="grid grid-cols-[76px_1fr] gap-3">
                                                            <span className={`mt-0.5 h-fit rounded-lg px-2 py-1 text-center text-[11px] font-black ${
                                                                isDarkMode ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                                                            }`}>{item.category}</span>
                                                            <div>
                                                                <div className="font-bold">{item.title}</div>
                                                                <p className={`mt-1 text-sm leading-5 ${mutedTextClass}`}>{item.description}</p>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`grid lg:grid-cols-[1fr_0.95fr] ${
                                        isDarkMode ? 'bg-slate-950/20' : 'bg-white'
                                    }`}>
                                        <section className={`p-6 sm:p-8 lg:border-r ${borderClass}`} aria-labelledby="resume-capabilities-heading">
                                            <p className={`text-[10px] font-black tracking-[0.2em] ${mutedTextClass}`}>CORE CAPABILITIES</p>
                                            <h4 id="resume-capabilities-heading" className="mt-1 text-lg font-black">핵심 역량</h4>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                {resumeHighlights.map((item) => (
                                                    <div key={item.title} className={`rounded-xl border p-4 ${
                                                        isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'
                                                    }`}>
                                                        <div className="flex items-center gap-3">
                                                            <FontAwesomeIcon icon={item.icon} className={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'} />
                                                            <h5 className="font-black">{item.title}</h5>
                                                        </div>
                                                        <p className={`mt-2 text-xs leading-5 ${mutedTextClass}`}>{item.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className={`p-6 sm:p-8 ${
                                            isDarkMode ? 'bg-emerald-400/[0.035]' : 'bg-emerald-50/45'
                                        }`} aria-labelledby="resume-promise-heading">
                                            <p className={`text-[10px] font-black tracking-[0.2em] ${
                                                isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                                            }`}>MANAGEMENT COMMITMENT</p>
                                            <h4 id="resume-promise-heading" className="mt-1 text-xl font-black">신뢰할 수 있는 청연의 약속</h4>
                                            <div className={`mt-5 space-y-4 text-sm leading-7 ${
                                                isDarkMode ? 'text-slate-300' : 'text-slate-600'
                                            }`}>
                                                <p>
                                                    청연에 보내주시는 <strong className={isDarkMode ? 'text-white' : 'text-slate-950'}>관심과 신뢰</strong>에 깊은 감사를 드립니다.
                                                </p>
                                                <p>
                                                    청연은 단순히 공사를 수행하는 회사가 아니라, 발주처와 협력사가 함께 안심할 수 있는 현장 운영 체계를 만드는 회사입니다.
                                                    사무실에서는 계약, 공정, 인력, 정산을 한 흐름으로 관리하고 현장에서는 작업 상황과 안전, 출역 정보를 실시간으로 확인해 의사결정의 속도와 정확도를 높입니다.
                                                </p>
                                                <p>
                                                    이 시스템은 약속된 공사기간을 지키고, 가능한 범위에서는 공기를 단축하며, 현장의 낭비와 병목을 줄이는 청연만의 실행 기반입니다.
                                                    <strong className={isDarkMode ? 'text-cyan-200' : 'text-cyan-800'}> 자체팀과 협력사팀이 하나의 공정 기준으로 움직이며 약속된 공사기일을 함께 지켜내겠습니다.</strong>
                                                    {' '}특히 <strong className={isDarkMode ? 'text-emerald-200' : 'text-emerald-800'}>임금 사고 없는 투명한 경영</strong>을 핵심 원칙으로 삼고,
                                                    정확한 근로 기록과 정산 기준을 바탕으로 모두가 믿고 일할 수 있는 상생 구조를 만들어가겠습니다.
                                                </p>
                                                <p>
                                                    감에 의존하는 시공이 아니라 데이터로 확인하고 책임 있게 관리하는 시공, 이것이 청연이 다른 시공팀과 차별화되는 이유입니다.
                                                    안전을 타협하지 않는 시공, 책임 있는 마감, 예측 가능한 운영으로 신뢰할 수 있는 청연이 되겠습니다.
                                                </p>
                                            </div>

                                            <div className={`mt-6 border-t pt-5 text-right ${borderClass}`}>
                                                <p className={`text-xs font-bold ${mutedTextClass}`}>청연이엔지 대표이사</p>
                                                <p className="mt-1 text-2xl font-black tracking-[0.18em]">이 재 욱</p>
                                            </div>
                                        </section>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'introduction' && (
                                <motion.div
                                    key="introduction"
                                    id="ceo-profile-panel-introduction"
                                    role="tabpanel"
                                    aria-labelledby="ceo-profile-tab-introduction"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.24 }}
                                >
                                    <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end">
                                        <div>
                                            <p className={`text-xs font-bold tracking-[0.18em] ${
                                                isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                                            }`}>SELF INTRODUCTION</p>
                                            <h3 className="mt-1 text-xl font-black sm:text-2xl">대표 자기소개서</h3>
                                            <p className={`mt-3 max-w-2xl text-sm leading-6 ${mutedTextClass}`}>
                                                이재욱 대표의 경영 철학과 현장을 대하는 원칙을 항목별로 확인해 보세요.
                                            </p>
                                        </div>
                                        <blockquote className={`rounded-2xl border p-5 text-sm font-bold leading-6 ${
                                            isDarkMode
                                                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                                                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        }`}>
                                            “안전하게 짓고, 약속한 기준을 끝까지 지키겠습니다.”
                                        </blockquote>
                                    </div>

                                    <div className="space-y-3">
                                        {introductionSections.map((section) => {
                                            const isOpen = openIntroductionId === section.id;
                                            const contentId = `ceo-introduction-${section.id}`;
                                            return (
                                                <article
                                                    key={section.id}
                                                    className={`overflow-hidden rounded-2xl border transition-colors ${
                                                        isOpen
                                                            ? isDarkMode
                                                                ? 'border-cyan-400/30 bg-cyan-400/[0.06]'
                                                                : 'border-cyan-200 bg-cyan-50/60'
                                                            : isDarkMode
                                                                ? 'border-white/10 bg-white/[0.02]'
                                                                : 'border-slate-200 bg-white'
                                                    }`}
                                                >
                                                    <h4>
                                                        <button
                                                            type="button"
                                                            aria-expanded={isOpen}
                                                            aria-controls={contentId}
                                                            onClick={() => setOpenIntroductionId(isOpen ? '' : section.id)}
                                                            className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-6 sm:py-5"
                                                        >
                                                            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${
                                                                isOpen
                                                                    ? isDarkMode
                                                                        ? 'bg-cyan-300 text-slate-950'
                                                                        : 'bg-slate-950 text-white'
                                                                    : isDarkMode
                                                                        ? 'bg-white/5 text-slate-400'
                                                                        : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                <FontAwesomeIcon icon={section.icon} />
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className={`block text-[10px] font-black tracking-[0.18em] ${
                                                                    isOpen
                                                                        ? isDarkMode ? 'text-cyan-300' : 'text-cyan-700'
                                                                        : isDarkMode ? 'text-slate-500' : 'text-slate-400'
                                                                }`}>{section.eyebrow}</span>
                                                                <span className="mt-1 block text-sm font-black sm:text-base">{section.title}</span>
                                                            </span>
                                                            <FontAwesomeIcon
                                                                icon={faChevronDown}
                                                                className={`flex-none transition-transform duration-200 ${
                                                                    isOpen ? 'rotate-180' : ''
                                                                } ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                                                            />
                                                        </button>
                                                    </h4>

                                                    <AnimatePresence initial={false}>
                                                        {isOpen && (
                                                            <motion.div
                                                                id={contentId}
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.24 }}
                                                            >
                                                                <div className={`space-y-3 border-t px-4 py-5 text-sm leading-7 sm:px-[84px] sm:py-6 ${
                                                                    isDarkMode
                                                                        ? 'border-white/10 text-slate-300'
                                                                        : 'border-cyan-100 text-slate-600'
                                                                }`}>
                                                                    {section.content.map((paragraph) => (
                                                                        <p key={paragraph}>{paragraph}</p>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CeoProfileTabs;
