import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './DesignManagementPage.css';
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
    id: 'system-dongbari-scaffolding' | 'material-rental' | 'manpower-supply' | 'erp-site-management' | 'partner-network';
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
            { label: '설치 기준', value: '5단계', helper: '하부부터 최종 검측까지' },
            { label: '안전 검토', value: '현장별', helper: '승인 도면과 구조 검토 기준' },
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

const MODULE_LINKS: Record<BusinessModule['id'], { to: string; label: string }> = {
    'system-dongbari-scaffolding': { to: '/site/management', label: '프로젝트 보기' },
    'material-rental': { to: '/materials/inventory', label: '자재 재고 보기' },
    'manpower-supply': { to: '/assignment/daily-dispatch', label: '인력 배치 보기' },
    'erp-site-management': { to: '/reports/daily', label: '출력일보 보기' },
    'partner-network': { to: '/company/management', label: '협력사 관리 보기' }
};
const TOPICS = ['시공', '자재임대', '인력공급', '현장관리', '협력사'];

const BusinessImage: React.FC<{ src: string; alt: string; eager?: boolean }> = ({ src, alt, eager }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    return failed ? (
        <div className="business-image-fallback" role="img" aria-label={alt}>
            <FontAwesomeIcon icon={faBuilding} />
            <span>청연ENG · {alt}</span>
        </div>
    ) : <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
};

const DesignManagementCodeitPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeModule = MODULES.find((item) => item.id === searchParams.get('module')) || MODULES[0];
    const [query, setQuery] = useState('');
    const [showGallery, setShowGallery] = useState(false);
    const detailRef = useRef<HTMLElement>(null);
    const pendingFocus = useRef(false);
    const activeIndex = MODULES.findIndex((item) => item.id === activeModule.id);
    const normalizedQuery = query.trim().toLocaleLowerCase().replace(/\s/g, '');
    const visibleModules = MODULES.filter((item) =>
        [item.title, item.subtitle, item.summary, ...item.lessons].join(' ').toLocaleLowerCase().replace(/\s/g, '').includes(normalizedQuery)
    );
    const relatedLink = MODULE_LINKS[activeModule.id];

    useEffect(() => {
        document.body.classList.add('dashboard2-codeit-theme');
        return () => document.body.classList.remove('dashboard2-codeit-theme');
    }, []);

    const scrollTo = (element: HTMLElement | null) => {
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        element?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };

    useEffect(() => {
        setShowGallery(false);
        if (pendingFocus.current) {
            detailRef.current?.focus({ preventScroll: true });
            scrollTo(detailRef.current);
            pendingFocus.current = false;
        }
    }, [activeModule.id]);

    const selectModule = (id: string) => {
        if (id === activeModule.id) {
            detailRef.current?.focus({ preventScroll: true });
            scrollTo(detailRef.current);
            return;
        }
        pendingFocus.current = true;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('module', id);
        setSearchParams(nextParams, { preventScrollReset: true });
    };

    return (
        <div className="business-page">
            <div className="business-announcement">청연이엔지는 시공, 자재, 인력, 현장 운영을 하나의 기준으로 연결합니다.</div>
            <div className="business-container">
                <div className="business-breadcrumb"><Link to="/dashboard2">청연ENG</Link><span>/</span><span>사업영역</span></div>
                <section className="business-hero" aria-labelledby="business-title">
                    <div className="business-hero-copy">
                        <p className="business-eyebrow business-hero-badge"><span /> 청연이엔지 사업영역</p>
                        <h1 id="business-title">현장의 시작부터,<br /><em>완성까지 함께.</em></h1>
                        <p className="business-intro">시공의 전문성에 자재, 인력, 데이터의 연결을 더합니다.<br className="business-desktop-break" /> 청연ENG의 다섯 가지 사업영역을 만나보세요.</p>
                        <div className="business-actions">
                            <button className="business-button business-primary" onClick={() => scrollTo(document.getElementById('business-modules'))}>사업영역 살펴보기 <FontAwesomeIcon icon={faArrowRight} /></button>
                            <Link className="business-button business-secondary" to="/site/management">프로젝트 보기 <span aria-hidden="true">↗</span></Link>
                        </div>
                        <div className="business-hero-note"><FontAwesomeIcon icon={faHelmetSafety} /><span>시공 · 자재 · 인력 · 현장관리 · 협력사</span></div>
                    </div>
                    <div className="business-hero-visual">
                        <BusinessImage src={MODULES[0].image} alt="건설 현장의 구조 프레임" eager />
                        <div className="business-photo-shade" />
                        <span className="business-photo-label">OUR BUSINESS / 01—05</span>
                        <div className="business-photo-caption"><span>기초를 단단하게, 연결을 긴밀하게</span><strong>현장을 이해하는<br />통합 엔지니어링</strong></div>
                        <span className="business-photo-credit">사업 이해를 위한 참고 이미지</span>
                    </div>
                </section>

                <nav className="business-quick-nav" aria-label="사업영역 빠른 탐색">
                    {MODULES.map((item, index) => (
                        <button key={item.id} onClick={() => selectModule(item.id)} aria-pressed={activeModule.id === item.id}>
                            <span className="business-nav-number">0{index + 1}</span><FontAwesomeIcon icon={item.icon} /><span>{TOPICS[index]}</span><span className="business-nav-arrow" aria-hidden="true">↗</span>
                        </button>
                    ))}
                </nav>

                <section id="business-modules" className="business-section" aria-labelledby="business-modules-title">
                    <div className="business-section-heading">
                        <div><p className="business-eyebrow">OUR EXPERTISE</p><h2 id="business-modules-title">다섯 가지 전문성, 하나의 현장</h2><p>필요한 사업을 선택해 핵심 업무와 운영 과정을 확인하세요.</p></div>
                        <div className="business-search"><label htmlFor="business-search">사업영역 검색</label><div><input id="business-search" type="search" placeholder="사업명 또는 업무 검색" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="검색어 지우기">×</button>}</div></div>
                    </div>
                    <p className="business-result-count" role="status">{query ? '검색 결과' : '전체 사업영역'} <strong>{visibleModules.length}</strong></p>
                    {visibleModules.length > 0 ? <div className="business-cards">
                        {visibleModules.map((item) => {
                            const index = MODULES.indexOf(item);
                            const selected = activeModule.id === item.id;
                            return <button key={item.id} className={'business-card' + (selected ? ' is-selected' : '')} style={{ '--module-accent': item.accent, '--module-soft': item.soft, '--module-ink': item.accentDark } as React.CSSProperties} aria-pressed={selected} onClick={() => selectModule(item.id)}>
                                <span className="business-card-top"><span className="business-card-icon"><FontAwesomeIcon icon={item.icon} /></span><span>0{index + 1}</span></span>
                                <span className="business-card-category">{item.level}</span>
                                <h3>{item.title}</h3><p>{item.summary}</p>
                                <span className="business-card-bottom">{selected ? '선택한 사업' : '자세히 보기'}<FontAwesomeIcon icon={selected ? faCheckCircle : faArrowRight} /></span>
                            </button>;
                        })}
                    </div> : <div className="business-empty"><FontAwesomeIcon icon={faSitemap} /><h3>일치하는 사업영역이 없습니다</h3><p>시공, 자재, 인력, 현장관리 또는 협력사로 검색해 보세요.</p><button className="business-button business-secondary" onClick={() => setQuery('')}>전체 사업 보기</button></div>}
                </section>

                <section ref={detailRef} tabIndex={-1} id="business-detail" className="business-detail business-section" aria-labelledby="business-detail-title">
                    <div className="business-detail-heading">
                        <div><p className="business-eyebrow">BUSINESS DETAIL <span className="business-detail-number">0{activeIndex + 1} / 05</span></p><h2 id="business-detail-title">{activeModule.title}</h2><p>{activeModule.subtitle}</p></div>
                        <Link to={relatedLink.to} className="business-button business-primary">{relatedLink.label}<span aria-hidden="true">↗</span></Link>
                    </div>
                    <div className="business-overview">
                        <div className="business-overview-copy"><h3>사업 개요</h3><p>{activeModule.description}</p><dl className="business-metrics">{activeModule.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd><span>{stat.helper}</span></div>)}</dl></div>
                        <div className="business-checklist"><p className="business-eyebrow">KEY POINTS</p><h3>먼저 확인할 핵심 업무</h3><ul>{activeModule.lessons.map((lesson) => <li key={lesson}><FontAwesomeIcon icon={faCheckCircle} /><span>{lesson}</span></li>)}</ul></div>
                    </div>
                    <div className="business-workflow"><div className="business-subheading"><div><p className="business-eyebrow">WORK PROCESS</p><h3>현장으로 이어지는 운영 과정</h3></div><span>{activeModule.workflow.length}단계</span></div>
                        <ol>{activeModule.workflow.map((step, index) => <li key={step.title}><span className="business-step-number">0{index + 1}</span><h4>{step.title}</h4><p>{step.desc}</p></li>)}</ol>
                    </div>
                    <div className="business-outcomes"><h3>이렇게 연결됩니다</h3><ul>{activeModule.outcomes.map((outcome) => <li key={outcome}><FontAwesomeIcon icon={faCheckCircle} />{outcome}</li>)}</ul></div>
                    <div className="business-gallery">
                        <div className="business-subheading"><div><p className="business-eyebrow">BUSINESS SCENES</p><h3>이미지로 살펴보는 사업영역</h3><p>사업 이해를 돕는 참고 이미지이며 실제 수행 현장 사진과는 다를 수 있습니다.</p></div>
                            <button className="business-button business-secondary" onClick={() => setShowGallery((value) => !value)} aria-expanded={showGallery} aria-controls="business-gallery-items">{showGallery ? '이미지 접기' : '이미지 보기'}<span aria-hidden="true">{showGallery ? '−' : '+'}</span></button>
                        </div>
                        <div id="business-gallery-items" hidden={!showGallery}>
                            {showGallery && <div className="business-gallery-grid">{activeModule.gallery.map((item) => <figure key={item.src}><div><BusinessImage src={item.src} alt={item.title} /><span>{item.label}</span></div><figcaption>{item.title}</figcaption></figure>)}</div>}
                        </div>
                    </div>
                    <div className="business-detail-footer"><button onClick={() => scrollTo(document.getElementById('business-modules'))}>↑ 사업영역 목록으로</button><button onClick={() => selectModule(MODULES[(activeIndex + 1) % MODULES.length].id)}>다음 사업 · {TOPICS[(activeIndex + 1) % MODULES.length]} <FontAwesomeIcon icon={faArrowRight} /></button></div>
                </section>
                <section className="business-closing"><div><p className="business-eyebrow">CONNECTED ON SITE</p><h2>각 분야의 전문성이<br />현장에서 하나로 이어집니다.</h2><p>사업의 이해에서 실제 프로젝트 확인까지, 청연ENG와 함께하세요.</p></div><Link to="/site/management" className="business-button business-primary">프로젝트 둘러보기 <FontAwesomeIcon icon={faArrowRight} /></Link></section>
                <footer className="business-footer"><div><img src={logoConstruction} alt="" /><strong>청연ENG</strong><span>CHUNG YEON ENGINEERING</span></div><span>시공의 기준을 세우고, 현장의 가치를 잇다.</span></footer>
            </div>
        </div>
    );
};

export default DesignManagementCodeitPage;
