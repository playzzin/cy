import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faBuilding,
    faChartLine,
    faCheckCircle,
    faDatabase,
    faHelmetSafety,
    faNetworkWired,
    faProjectDiagram,
    faSitemap,
} from '@fortawesome/free-solid-svg-icons';
import logoConstruction from '../../assets/logo_construction.jpg';
import logoFinished from '../../assets/logo_finished.png';

type Metric = {
    label: string;
    value: string;
    helper: string;
};

type WorkflowStep = {
    title: string;
    desc: string;
};

type GalleryItem = {
    label: string;
    title: string;
    src: string;
};

type BusinessModule = {
    id: string;
    title: string;
    subtitle: string;
    summary: string;
    description: string;
    icon: IconDefinition;
    accent: string;
    accentDark: string;
    soft: string;
    image: string;
    duration: string;
    level: string;
    stats: Metric[];
    lessons: string[];
    outcomes: string[];
    workflow: WorkflowStep[];
    gallery: GalleryItem[];
};

const MODULES: BusinessModule[] = [
    {
        id: 'system-dongbari-scaffolding',
        title: '시스템 동바리비계 시공',
        subtitle: '구조 검토부터 설치 점검까지',
        summary: '시스템 동바리와 비계 시공 흐름을 하나의 운영 루틴으로 정리합니다.',
        description: '하중 전달 구조, 작업 발판, 난간, 벽이음, 최종 점검까지 현장 품질을 좌우하는 기준을 짧은 단계로 나눠 확인합니다.',
        icon: faSitemap,
        accent: '#4f7cff',
        accentDark: '#315de8',
        soft: '#eef4ff',
        image: 'https://images.pexels.com/photos/17951553/pexels-photo-17951553.jpeg?auto=compress&cs=tinysrgb&w=1200',
        duration: '5분 요약',
        level: 'Engineering',
        stats: [
            { label: '설치 기준', value: '6단계', helper: '하부부터 최종 검측까지' },
            { label: '안전 체크', value: '2.0+', helper: '권장 안전율 기준' },
            { label: '운영 포커스', value: '품질', helper: '구조 안정성과 공기 관리' }
        ],
        lessons: ['기준점과 하중 조건 먼저 확인', '하부 레벨링 후 수직재와 수평재 체결', '작업 발판, 난간, 벽이음 기준 동시 검토'],
        outcomes: ['시공 전 구조 리스크를 빠르게 분류', '동바리와 비계 작업 순서를 한 화면에서 공유', '최종 검측 체크리스트로 품질 편차 축소'],
        workflow: [
            { title: '기준점 확인', desc: '도면, 하중, 바닥 상태를 먼저 정리합니다.' },
            { title: '하부 레벨링', desc: '잭베이스와 받침면을 맞춰 초기 오차를 줄입니다.' },
            { title: '프레임 조립', desc: '수직재, 수평재, 가새를 기준 간격으로 체결합니다.' },
            { title: '안전 설비', desc: '발판, 난간, 벽이음, 통로를 함께 확인합니다.' },
            { title: '최종 검측', desc: '간격, 체결, 수평, 변형 여부를 기록합니다.' }
        ],
        gallery: [
            {
                label: '동바리',
                title: '기준점과 하중 조건 정리',
                src: 'https://images.pexels.com/photos/17951553/pexels-photo-17951553.jpeg?auto=compress&cs=tinysrgb&w=1200'
            },
            {
                label: '비계',
                title: '외부 작업 발판 구성',
                src: 'https://images.pexels.com/photos/9637500/pexels-photo-9637500.jpeg?auto=compress&cs=tinysrgb&w=1200'
            },
            {
                label: '검측',
                title: '체결 상태 최종 확인',
                src: 'https://images.pexels.com/photos/5511066/pexels-photo-5511066.jpeg?auto=compress&cs=tinysrgb&w=1200'
            }
        ]
    },
    {
        id: 'material-rental',
        title: '시스템 자재임대',
        subtitle: '입출고와 회수 흐름 정리',
        summary: '규격 자재의 재고, 출고, 반납, 정비를 카드 단위로 추적합니다.',
        description: 'Peri 규격 자재와 비계 부재를 현장별로 연결해 대기 시간과 손실률을 줄이는 임대 운영 화면으로 구성했습니다.',
        icon: faProjectDiagram,
        accent: '#9d2cff',
        accentDark: '#7c3aed',
        soft: '#f6f5ff',
        image: 'https://images.pexels.com/photos/15508177/pexels-photo-15508177.jpeg?cs=srgb&dl=pexels-zakhar-15508177.jpg&fm=jpg',
        duration: '4분 과정',
        level: 'Assets',
        stats: [
            { label: '추적 범위', value: '입출고', helper: '출고부터 반납 정비까지' },
            { label: '관리 단위', value: '규격별', helper: '현장별 수량 연결' },
            { label: '운영 포커스', value: '회전율', helper: '대기 자재와 손실률 축소' }
        ],
        lessons: ['규격과 등급을 먼저 분류', '현장별 출고 일정과 운송 동선 연결', '반납 즉시 검수와 정비 상태 기록'],
        outcomes: ['가용 재고를 빠르게 확인', '출고 지연과 중복 배차 감소', '반납 후 정비 우선순위가 선명해짐'],
        workflow: [
            { title: '재고 분류', desc: '품목, 규격, 등급을 기준으로 정리합니다.' },
            { title: '현장 요청', desc: '필요 수량과 반입 날짜를 카드로 연결합니다.' },
            { title: '출고 배차', desc: '상차 물량과 운송 동선을 맞춥니다.' },
            { title: '반납 검수', desc: '손상, 누락, 정비 필요 여부를 기록합니다.' },
            { title: '회전 분석', desc: '가동률과 장기 대기 품목을 확인합니다.' }
        ],
        gallery: [
            {
                label: '자재 야드',
                title: '규격별 자재 분류',
                src: 'https://images.pexels.com/photos/15508178/pexels-photo-15508178.jpeg?cs=srgb&dl=pexels-zakhar-15508178.jpg&fm=jpg'
            },
            {
                label: '출고 준비',
                title: '반입 물량 사전 정리',
                src: 'https://images.pexels.com/photos/36878025/pexels-photo-36878025.jpeg?cs=srgb&dl=pexels-zakhar-36878025.jpg&fm=jpg'
            },
            {
                label: '정비',
                title: '회수 후 상태 점검',
                src: 'https://images.pexels.com/photos/36003983/pexels-photo-36003983.jpeg?cs=srgb&dl=pexels-michael-orshan-2159363670-36003983.jpg&fm=jpg'
            }
        ]
    },
    {
        id: 'manpower-supply',
        title: '시스템 인력공급',
        subtitle: '팀 배치와 출역 흐름',
        summary: '현장 난이도, 숙련도, 안전 이력을 기준으로 투입 팀을 정리합니다.',
        description: '새벽 집결, TBM, 반별 배치, 일일 출역, 노무비 정산으로 이어지는 흐름을 짧고 반복 가능한 운영 사이클로 바꿉니다.',
        icon: faBuilding,
        accent: '#00b894',
        accentDark: '#009b7a',
        soft: '#e9fbf5',
        image: 'https://images.pexels.com/photos/13005576/pexels-photo-13005576.jpeg?auto=compress&cs=tinysrgb&w=1200',
        duration: '5분 배치',
        level: 'Workforce',
        stats: [
            { label: '배치 기준', value: '팀 단위', helper: '숙련도와 현장 조건 매칭' },
            { label: '확인 항목', value: 'TBM', helper: '작업 전 안전 브리핑' },
            { label: '운영 포커스', value: '출역', helper: '투입 기록과 정산 연결' }
        ],
        lessons: ['현장 요청 인원과 작업 난이도 확인', '팀별 숙련도와 안전 교육 이력 매칭', '출역 기록을 노무비 정산까지 연결'],
        outcomes: ['인력 요청과 배치 판단 시간 단축', '팀 단위 투입 이력 누락 감소', '일보와 정산 데이터가 자연스럽게 연결'],
        workflow: [
            { title: '인력 요청', desc: '현장 난이도와 필요 공종을 정리합니다.' },
            { title: '팀 매칭', desc: '숙련도, 거리, 안전 이력을 함께 봅니다.' },
            { title: '안전 조회', desc: '투입 전 TBM과 교육 상태를 확인합니다.' },
            { title: '출역 기록', desc: '일일 투입 인원과 공수를 기록합니다.' },
            { title: '정산 연결', desc: '노무비와 증빙 흐름으로 이어집니다.' }
        ],
        gallery: [
            {
                label: '집결',
                title: '작업 전 팀 브리핑',
                src: 'https://images.pexels.com/photos/20452662/pexels-photo-20452662.jpeg?auto=compress&cs=tinysrgb&w=1200'
            },
            {
                label: '투입',
                title: '현장별 반 배치',
                src: 'https://images.pexels.com/photos/17797264/pexels-photo-17797264.jpeg?auto=compress&cs=tinysrgb&w=1200'
            },
            {
                label: '운영',
                title: '일일 출역 흐름 관리',
                src: 'https://images.pexels.com/photos/30719069/pexels-photo-30719069.jpeg?auto=compress&cs=tinysrgb&w=1200'
            }
        ]
    },
    {
        id: 'erp-site-management',
        title: 'ERP 실시간 현장관리',
        subtitle: '현장 데이터가 바로 보이는 구조',
        summary: '인력, 자재, 사진, 정산 데이터를 실시간 현장 운영 화면으로 묶습니다.',
        description: '모바일 입력, 관리자 검토, 손익 분석, 증빙 보관을 하나의 운영 대시보드로 연결해 현장 의사결정 속도를 높입니다.',
        icon: faDatabase,
        accent: '#4f7cff',
        accentDark: '#315de8',
        soft: '#eef4ff',
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
        duration: '실시간',
        level: 'ERP',
        stats: [
            { label: '데이터 입력', value: '모바일', helper: '현장 기록 즉시 반영' },
            { label: '분석 범위', value: '손익', helper: '노무, 자재, 경비 통합' },
            { label: '운영 포커스', value: '판단', helper: '지연 없는 현장 의사결정' }
        ],
        lessons: ['현장 입력과 관리자 검토를 분리', '노무비, 자재비, 경비를 같은 기준으로 집계', '사진과 증빙을 정산 흐름에 붙여 보관'],
        outcomes: ['현장 상태 확인 시간이 짧아짐', '비용 누락과 중복 입력 감소', '관리자가 같은 기준으로 현장을 비교'],
        workflow: [
            { title: '현장 입력', desc: '모바일에서 일보, 사진, 작업자를 기록합니다.' },
            { title: '관리 검토', desc: '누락과 이상치를 빠르게 확인합니다.' },
            { title: '비용 집계', desc: '노무, 자재, 경비를 같은 화면에서 합산합니다.' },
            { title: '손익 분석', desc: '투입 대비 산출 흐름을 비교합니다.' },
            { title: '증빙 보관', desc: '정산에 필요한 자료를 함께 남깁니다.' }
        ],
        gallery: [
            {
                label: '대시보드',
                title: '실시간 운영 현황',
                src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80'
            },
            {
                label: '모바일',
                title: '현장 입력 환경',
                src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
            },
            {
                label: '분석',
                title: '원가와 성과 비교',
                src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80'
            }
        ]
    },
    {
        id: 'partner-network',
        title: '협력사 네트워크',
        subtitle: '검증된 파트너와 발주 연결',
        summary: '시공 협력사 정보, 발주 이력, 평가 데이터를 한 화면에서 확인합니다.',
        description: '파트너 등급, 협업 이력, 발주 적합도, 이슈 대응 속도를 기준으로 현장에 맞는 협력사를 빠르게 찾도록 구성했습니다.',
        icon: faNetworkWired,
        accent: '#ff8a34',
        accentDark: '#d96a1e',
        soft: '#fff4ec',
        image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
        duration: '3분 탐색',
        level: 'Network',
        stats: [
            { label: '관리 기준', value: '평가', helper: '성과와 이슈 대응 이력' },
            { label: '연결 범위', value: '발주', helper: '현장 조건에 맞는 매칭' },
            { label: '운영 포커스', value: '신뢰', helper: '장기 협업 기반 구축' }
        ],
        lessons: ['파트너 정보와 수행 이력을 같은 기준으로 정리', '현장 조건에 맞는 발주 후보를 빠르게 압축', '성과 평가와 다음 협업 우선순위를 연결'],
        outcomes: ['파트너 탐색과 비교 시간이 짧아짐', '발주 후 이슈 대응 이력 축적', '우수 협력사와 장기 협업 구조 강화'],
        workflow: [
            { title: '파트너 등록', desc: '회사 정보와 수행 가능 공종을 정리합니다.' },
            { title: '조건 매칭', desc: '현장, 일정, 공종 기준으로 후보를 좁힙니다.' },
            { title: '발주 연계', desc: '견적, 계약, 투입 일정을 연결합니다.' },
            { title: '협업 수행', desc: '이슈와 커뮤니케이션 이력을 남깁니다.' },
            { title: '성과 평가', desc: '다음 협업을 위한 등급을 갱신합니다.' }
        ],
        gallery: [
            {
                label: '미팅',
                title: '협력사 조건 조율',
                src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80'
            },
            {
                label: '계약',
                title: '발주와 일정 연결',
                src: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80'
            },
            {
                label: '성과',
                title: '파트너십 리뷰',
                src: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80'
            }
        ]
    }
];

const HERO_TOPICS = ['시공', '자재', '인력', 'ERP', '파트너'];

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 22 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: 'easeOut' } }
};

const stagger: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.07 }
    }
};

const DesignManagementCodeitPage: React.FC = () => {
    const [activeId, setActiveId] = useState(MODULES[0].id);
    const [showGallery, setShowGallery] = useState(false);

    const activeModule = useMemo(
        () => MODULES.find((module) => module.id === activeId) || MODULES[0],
        [activeId]
    );

    useEffect(() => {
        setShowGallery(false);
    }, [activeId]);

    useEffect(() => {
        document.body.classList.add('dashboard2-codeit-theme');
        return () => document.body.classList.remove('dashboard2-codeit-theme');
    }, []);

    const scrollToModules = () => {
        document.getElementById('codeit-modules')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const focusModule = (moduleId: string) => {
        setActiveId(moduleId);
        window.setTimeout(() => {
            document.getElementById('codeit-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 40);
    };

    return (
        <div
            className="codeit-design-management min-h-screen bg-[#ffffff] text-[#333236]"
            style={{ fontFamily: 'Pretendard, SpoqaHanSansNeo, Apple SD Gothic Neo, Noto Sans KR, sans-serif' }}
        >
            <div className="bg-[#080c16] px-4 py-3 text-center text-sm font-semibold text-[#f7f8fb]">
                청연ENG 사업영역을 짧은 모듈로 훑고, 필요한 운영 흐름으로 바로 이동하세요
            </div>

            <section className="mx-auto grid min-h-[640px] max-w-[1240px] grid-cols-1 items-center gap-12 px-5 pb-16 pt-20 md:px-8 lg:grid-cols-[0.95fr_1.05fr]">
                <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center lg:text-left">
                    <motion.div
                        variants={fadeUp}
                        className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#dedff5] bg-[#f6f5ff] px-4 py-2 text-sm font-black text-[#5b43d6]"
                    >
                        <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
                        청연ENG에서는
                    </motion.div>

                    <motion.h1
                        variants={fadeUp}
                        className="text-4xl font-black leading-[1.14] text-[#24242a] md:text-6xl lg:text-7xl"
                        style={{ wordBreak: 'keep-all' }}
                    >
                        사업영역이 5분마다 선명해집니다
                    </motion.h1>
                    <motion.p
                        variants={fadeUp}
                        className="mt-7 text-xl font-extrabold leading-relaxed text-[#4f7cff] md:text-3xl"
                        style={{ wordBreak: 'keep-all' }}
                    >
                        시공, 자재, 인력, ERP, 파트너 흐름까지 한 번에
                    </motion.p>
                    <motion.p
                        variants={fadeUp}
                        className="mx-auto mt-5 max-w-[680px] text-base leading-8 text-[#656b7a] md:text-lg lg:mx-0"
                        style={{ wordBreak: 'keep-all' }}
                    >
                        복잡한 사업 소개를 Codeit의 학습 카드처럼 짧고 명확한 구조로 재배치했습니다.
                        각 모듈은 핵심 기준, 운영 순서, 결과물 중심으로 바로 읽히도록 정리됩니다.
                    </motion.p>

                    <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                        <button
                            type="button"
                            onClick={scrollToModules}
                            className="inline-flex h-14 min-w-[220px] items-center justify-center gap-3 rounded-[8px] bg-gradient-to-r from-[#4f7cff] to-[#9d2cff] px-7 text-base font-extrabold text-white shadow-[0_16px_30px_rgba(79,124,255,0.28)] transition hover:-translate-y-0.5"
                        >
                            모듈 둘러보기
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                        <button
                            type="button"
                            onClick={() => focusModule('erp-site-management')}
                            className="inline-flex h-14 min-w-[220px] items-center justify-center gap-3 rounded-[8px] border border-[#dfe3ef] bg-[#ffffff] px-7 text-base font-extrabold text-[#333236] transition hover:border-[#4f7cff] hover:text-[#4f7cff]"
                        >
                            ERP 흐름 보기
                            <FontAwesomeIcon icon={faDatabase} />
                        </button>
                    </motion.div>

                    <motion.div variants={fadeUp} className="mt-12 grid grid-cols-5 gap-2">
                        {HERO_TOPICS.map((topic, index) => (
                            <div
                                key={topic}
                                className="flex h-[92px] flex-col items-center justify-center rounded-[18px] border border-[#e8eaf1] bg-[#f7f8fb] px-2 text-center shadow-[0_12px_28px_rgba(21,27,45,0.04)]"
                            >
                                <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ffffff] text-sm font-black text-[#4f7cff]">
                                    {index + 1}
                                </span>
                                <span className="text-sm font-extrabold text-[#333236]">{topic}</span>
                            </div>
                        ))}
                    </motion.div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 26, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="rounded-[28px] border border-[#e2e5ee] bg-[#f7f8fb] p-5 shadow-[0_24px_60px_rgba(21,27,45,0.08)]"
                >
                    <div className="overflow-hidden rounded-[22px] bg-[#ffffff]">
                        <div className="flex items-center justify-between gap-4 border-b border-[#eef0f6] p-5">
                            <div className="flex items-center gap-3">
                                <img src={logoConstruction} alt="청연이엔지 로고" className="h-11 w-11 rounded-[12px] object-cover" />
                                <div>
                                    <div className="text-sm font-bold text-[#7a8191]">오늘의 사업 모듈</div>
                                    <div className="text-lg font-black text-[#24242a]">핵심 흐름만 빠르게 보기</div>
                                </div>
                            </div>
                            <img src={logoFinished} alt="청연ENG 심볼" className="hidden h-12 w-12 rounded-[14px] object-cover sm:block" />
                        </div>

                        <div className="relative h-[310px] overflow-hidden">
                            <img src={activeModule.image} alt={activeModule.title} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#080c16]/85 via-[#080c16]/18 to-transparent" />
                            <div className="absolute bottom-5 left-5 right-5">
                                <div className="mb-3 inline-flex rounded-full bg-white/92 px-3 py-1 text-xs font-black text-[#4f7cff]">
                                    {activeModule.duration}
                                </div>
                                <h2 className="text-3xl font-black leading-tight text-white">{activeModule.title}</h2>
                                <p className="mt-2 max-w-[520px] text-sm font-semibold leading-6 text-[#dfe7f5]">
                                    {activeModule.summary}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
                            {activeModule.stats.map((stat) => (
                                <div key={stat.label} className="rounded-[16px] border border-[#eef0f6] bg-[#f7f8fb] px-4 py-4">
                                    <div className="text-xs font-bold text-[#7a8191]">{stat.label}</div>
                                    <div className="mt-1 text-2xl font-black text-[#24242a]">{stat.value}</div>
                                    <div className="mt-1 text-xs font-semibold text-[#656b7a]">{stat.helper}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </section>

            <section id="codeit-modules" className="bg-[#f7f8fb] px-5 py-20 md:px-8">
                <div className="mx-auto max-w-[1180px]">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                        <div>
                            <p className="text-base font-extrabold text-[#4f7cff]">5분 사업 모듈</p>
                            <h2 className="mt-4 text-3xl font-black leading-tight text-[#24242a] md:text-5xl">
                                필요한 흐름부터 열어보세요
                            </h2>
                        </div>
                        <p className="max-w-[430px] text-base leading-7 text-[#656b7a]">
                            각 카드는 하나의 짧은 강의처럼 핵심 기준, 단계, 결과물을 같은 순서로 보여줍니다.
                        </p>
                    </div>

                    <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
                        {MODULES.map((module, index) => {
                            const selected = module.id === activeModule.id;
                            return (
                                <motion.button
                                    key={module.id}
                                    type="button"
                                    onClick={() => focusModule(module.id)}
                                    whileHover={{ y: -5 }}
                                    whileTap={{ scale: 0.985 }}
                                    aria-pressed={selected}
                                    className="group flex min-h-[260px] flex-col rounded-[18px] border bg-[#ffffff] p-6 text-left transition"
                                    style={{
                                        borderColor: selected ? module.accent : '#e2e5ee',
                                        boxShadow: selected
                                            ? `0 22px 48px ${module.accent}24`
                                            : '0 18px 45px rgba(21,27,45,0.05)'
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span
                                            className="flex h-12 w-12 items-center justify-center rounded-[14px] text-xl text-white"
                                            style={{ backgroundColor: module.accent }}
                                        >
                                            <FontAwesomeIcon icon={module.icon} />
                                        </span>
                                        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: module.soft, color: module.accentDark }}>
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="mt-7 text-sm font-black" style={{ color: module.accentDark }}>
                                        {module.level}
                                    </div>
                                    <h3 className="mt-2 text-2xl font-black leading-tight text-[#24242a]" style={{ wordBreak: 'keep-all' }}>
                                        {module.title}
                                    </h3>
                                    <p className="mt-4 flex-1 text-sm font-semibold leading-6 text-[#656b7a]" style={{ wordBreak: 'keep-all' }}>
                                        {module.summary}
                                    </p>
                                    <div className="mt-6 flex items-center justify-between border-t border-[#eef0f6] pt-4">
                                        <span className="text-xs font-black text-[#7a8191]">{module.duration}</span>
                                        <FontAwesomeIcon icon={faArrowRight} className="text-sm transition group-hover:translate-x-1" style={{ color: module.accent }} />
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="codeit-detail" className="px-5 py-20 md:px-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeModule.id}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.34, ease: 'easeOut' }}
                        className="mx-auto max-w-[1180px]"
                    >
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-[24px] border border-[#e2e5ee] bg-[#ffffff] p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                <div className="mb-8 inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-black" style={{ backgroundColor: activeModule.soft, color: activeModule.accentDark }}>
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeModule.accent }} />
                                    {activeModule.subtitle}
                                </div>
                                <h2 className="text-3xl font-black leading-tight text-[#24242a] md:text-5xl" style={{ wordBreak: 'keep-all' }}>
                                    {activeModule.title}
                                </h2>
                                <p className="mt-6 text-lg leading-8 text-[#656b7a]" style={{ wordBreak: 'keep-all' }}>
                                    {activeModule.description}
                                </p>

                                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {activeModule.stats.map((stat) => (
                                        <div key={stat.label} className="rounded-[14px] border border-[#eef0f6] bg-[#f7f8fb] px-4 py-4">
                                            <div className="text-xs font-bold text-[#7a8191]">{stat.label}</div>
                                            <div className="mt-2 text-2xl font-black text-[#24242a]">{stat.value}</div>
                                            <div className="mt-1 text-xs font-semibold text-[#656b7a]">{stat.helper}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-[#e2e5ee] bg-[#f7f8fb] p-5 shadow-[0_24px_60px_rgba(21,27,45,0.08)]">
                                <div className="rounded-[18px] bg-[#ffffff] p-5">
                                    <div className="flex flex-col gap-5 md:flex-row">
                                        <img src={activeModule.image} alt={`${activeModule.title} 대표 이미지`} className="h-56 w-full rounded-[14px] object-cover md:w-[42%]" />
                                        <div className="flex-1">
                                            <p className="text-sm font-black" style={{ color: activeModule.accentDark }}>학습 노트</p>
                                            <h3 className="mt-2 text-2xl font-black text-[#24242a]">핵심만 먼저 봅니다</h3>
                                            <div className="mt-5 space-y-3">
                                                {activeModule.lessons.map((lesson) => (
                                                    <div key={lesson} className="flex gap-3 rounded-[14px] border border-[#eef0f6] bg-[#ffffff] p-3">
                                                        <FontAwesomeIcon icon={faCheckCircle} className="mt-1 flex-shrink-0" style={{ color: activeModule.accent }} />
                                                        <span className="text-sm font-semibold leading-6 text-[#656b7a]">{lesson}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                            <div className="rounded-[24px] border border-[#e2e5ee] bg-[#ffffff] p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                                    <div>
                                        <p className="text-sm font-black" style={{ color: activeModule.accentDark }}>운영 사이클</p>
                                        <h3 className="mt-2 text-2xl font-black text-[#24242a]">다섯 단계로 이어지는 실행 흐름</h3>
                                    </div>
                                    <span className="rounded-[8px] bg-[#f7f8fb] px-3 py-2 text-xs font-black text-[#7a8191]">
                                        {activeModule.workflow.length} Steps
                                    </span>
                                </div>

                                <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-5">
                                    {activeModule.workflow.map((step, index) => (
                                        <div key={step.title} className="rounded-[16px] border border-[#eef0f6] bg-[#f7f8fb] p-4">
                                            <div className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ffffff] text-sm font-black" style={{ color: activeModule.accent }}>
                                                {index + 1}
                                            </div>
                                            <h4 className="text-base font-black text-[#24242a]">{step.title}</h4>
                                            <p className="mt-3 text-sm font-semibold leading-6 text-[#656b7a]">{step.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-[#e2e5ee] bg-[#f7f8fb] p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                <p className="text-sm font-black" style={{ color: activeModule.accentDark }}>완료 후 얻는 것</p>
                                <div className="mt-5 space-y-4">
                                    {activeModule.outcomes.map((outcome) => (
                                        <div key={outcome} className="flex items-start gap-4 rounded-[14px] bg-[#ffffff] p-4">
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] text-white" style={{ backgroundColor: activeModule.accent }}>
                                                <FontAwesomeIcon icon={faChartLine} />
                                            </div>
                                            <p className="text-sm font-bold leading-6 text-[#333236]">{outcome}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-[24px] border border-[#e2e5ee] bg-[#ffffff] p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                                <div>
                                    <p className="text-sm font-black" style={{ color: activeModule.accentDark }}>현장 이미지 보드</p>
                                    <h3 className="mt-2 text-2xl font-black text-[#24242a]">대표 장면을 같이 확인합니다</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowGallery((value) => !value)}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] px-5 text-sm font-extrabold text-white transition hover:-translate-y-0.5"
                                    style={{ backgroundColor: activeModule.accentDark }}
                                >
                                    {showGallery ? '이미지 접기' : '이미지 보기'}
                                    <FontAwesomeIcon icon={faArrowRight} className={showGallery ? '-rotate-90 transition' : 'rotate-90 transition'} />
                                </button>
                            </div>

                            <AnimatePresence>
                                {showGallery && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
                                            {activeModule.gallery.map((item) => (
                                                <article key={item.title} className="overflow-hidden rounded-[18px] border border-[#e2e5ee] bg-[#f7f8fb]">
                                                    <div className="relative h-56">
                                                        <img src={item.src} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                                                        <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-black" style={{ color: activeModule.accentDark }}>
                                                            {item.label}
                                                        </div>
                                                    </div>
                                                    <div className="p-5">
                                                        <h4 className="text-lg font-black text-[#24242a]">{item.title}</h4>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </section>

            <section className="bg-[#111827] px-5 py-20 text-white md:px-8">
                <div className="mx-auto max-w-[1180px]">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {[
                            {
                                title: '짧게 보고',
                                desc: '각 사업영역은 한 문장 요약, 핵심 기준, 실행 순서로 먼저 읽힙니다.',
                                icon: faCheckCircle,
                                color: '#4f7cff'
                            },
                            {
                                title: '바로 비교하고',
                                desc: '모듈마다 같은 구조를 사용해 시공, 자재, 인력, ERP를 빠르게 비교합니다.',
                                icon: faProjectDiagram,
                                color: '#9d2cff'
                            },
                            {
                                title: '현장으로 연결합니다',
                                desc: '운영 단계와 결과물을 함께 보여 현장 업무 흐름으로 자연스럽게 이어집니다.',
                                icon: faHelmetSafety,
                                color: '#00b894'
                            }
                        ].map((card) => (
                            <div key={card.title} className="rounded-[24px] border border-[#273244] bg-[#182133] p-8">
                                <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-[16px] text-2xl" style={{ backgroundColor: card.color }}>
                                    <FontAwesomeIcon icon={card.icon} />
                                </div>
                                <h3 className="text-2xl font-black">{card.title}</h3>
                                <p className="mt-4 text-base leading-8 text-[#c7d0df]">{card.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="border-t border-[#e8eaf1] bg-[#f7f8fb] px-5 py-10 md:px-8">
                <div className="mx-auto flex max-w-[1180px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <img src={logoConstruction} alt="청연이엔지 로고" className="h-14 w-14 rounded-[14px] object-cover" />
                        <div>
                            <div className="text-2xl font-black text-[#24242a]">청연ENG 사업영역</div>
                            <div className="mt-1 text-sm font-semibold text-[#656b7a]">시공부터 ERP까지, 같은 기준으로 읽히는 운영 모듈</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={scrollToModules}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#24242a] px-5 text-sm font-extrabold text-white"
                    >
                        다시 모듈 보기
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default DesignManagementCodeitPage;
