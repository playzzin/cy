import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBuilding, faDatabase, faNetworkWired, faProjectDiagram, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { ERP_WORKFLOW } from './erpMotionContent';

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

export type BusinessModule = {
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

export const MODULES: BusinessModule[] = [
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
        description: '규격 자재와 비계 부재의 재고, 출고, 반납 이력을 현장별로 연결합니다. 필요한 자재를 필요한 시점에 공급하고 회수와 정비까지 관리합니다.',
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
        subtitle: '여러 현장의 팀 배치부터 노무비 지급까지',
        summary: '현장의 전화 한 통에서 시작해, 사무실 팀 매칭과 현장 배치, 근로자 노무비 지급까지 연결합니다.',
        description: '현장에서 전화로 인력을 요청하면 사무실 담당자가 공종과 일정을 확인해 팀을 매칭합니다. 안전 확인 후 여러 현장에 팀을 배치하고, 출역과 공수 기록을 근로자 노무비 지급까지 연결합니다.',
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
            { label: '운영 포커스', value: '지급', helper: '출역 · 공수 확인 후 노무비 지급' }
        ],
        lessons: ['여러 현장의 공종과 요청 인원 확인', '숙련도와 안전 교육 이력에 맞춘 팀별 배치', '현장별 출역·공수를 확인하고 근로자 노무비 지급까지 연결'],
        outcomes: ['현장별 인력 요청과 배치 판단 시간 단축', '팀 단위 투입과 출역 이력 누락 감소', '일보부터 정산·지급까지 이어지는 운영 흐름'],
        workflow: [
            { title: '현장 전화 요청', desc: '현장 담당자가 사무실로 전화해 필요한 공종, 투입일과 인원을 요청합니다.' },
            { title: '사무실 팀 매칭', desc: '사무실 담당자가 접수한 요청과 팀별 공종·숙련도·가용 일정을 비교해 투입 팀을 확정합니다.' },
            { title: '안전 조회', desc: '투입 전 TBM과 교육 상태를 확인합니다.' },
            { title: '현장별 팀 배치', desc: 'A·B·C팀이 각 현장으로 이동하고, 도착한 팀의 출역과 공수를 기록합니다.' },
            { title: '노무비 지급', desc: '현장별 출역과 공수를 확인해 지급을 승인하고, 각 팀 근로자에게 노무비를 지급합니다.' }
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
        subtitle: '현장 기록부터 노임서류·정산까지, 스마트하게',
        summary: '여러 현장의 모바일 기록, 출역·공수, 노임서류와 정산을 사무실의 한 흐름으로 연결합니다.',
        description: '현장 작업일보와 사진이 사무실로 연결되고, 출역·공수와 자재·경비가 함께 정리됩니다. 노임서류 초안 작성부터 담당자 검토, 지급 관리, 손익 분석과 증빙 조회까지 스마트한 업무 환경을 살펴보세요.',
        icon: faDatabase,
        accent: '#4f7cff',
        accentDark: '#315de8',
        soft: '#eef4ff',
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
        duration: '실시간',
        level: 'ERP',
        stats: [
            { label: '관리 액션', value: '10개', helper: '현장 연결부터 증빙 조회까지' },
            { label: '노임서류', value: '6종', helper: '서류를 선택해 초안 구성 탐색' },
            { label: '스마트 협업', value: '동기화', helper: '알림 · 보완 · 처리 상태 연결' }
        ],
        lessons: ['모바일 작업일보·사진과 팀별 출역·공수 집계', '출역일보·노임대장·급여명세서·노무비 지급명세서·지급확인서·노무비 청구서', '담당자 검토·승인부터 정산·지급과 증빙 조회까지 연결'],
        outcomes: ['현장과 사무실이 같은 처리 상태를 확인', '누락 알림과 보완 흐름으로 자료 완성도 향상', '현장별 원가·손익과 서류 이력을 함께 파악'],
        workflow: ERP_WORKFLOW,
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
        subtitle: '단체 카카오톡방 · 협회 · 노조의 상호 지원',
        summary: '단체 카카오톡방, 협회, 노조에서 지원 요청과 가용팀 소식이 오가고, 세 채널이 함께 현장을 연결합니다.',
        description: '지원이 필요한 현장, 지원 가능한 팀, 함께할 팀을 모집하는 메시지가 세 채널에 이어집니다. 단체 카카오톡방·협회·노조와 공종과 일정을 조율해 청연팀이 지원을 가고, 협력팀이 청연 현장으로 지원을 옵니다.',
        icon: faNetworkWired,
        accent: '#ff8a34',
        accentDark: '#d96a1e',
        soft: '#fff4ec',
        image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
        duration: '3분 탐색',
        level: 'Network',
        stats: [
            { label: '단체 카카오톡방', value: '요청 공유', helper: '현장 소식과 지원 가능 회신' },
            { label: '협회', value: '전문 협력', helper: '공종별 가용팀과 일정 조율' },
            { label: '노조', value: '상호 지원', helper: '지원팀 모집과 현장 연결' }
        ],
        lessons: ['단체 카카오톡방·협회·노조에 지원 요청과 팀 모집 공유', '지원 가능한 팀의 회신을 모아 공종·일정 조율', '청연팀 파견과 협력팀 지원을 양방향으로 연결'],
        outcomes: ['현장에 필요한 지원팀을 빠르게 연결', '현장 간 인력 수급 공백을 상호 지원으로 보완', '지속적인 지원 교류로 협력 관계 강화'],
        workflow: [
            { title: '협력망 연결', desc: '단체 카카오톡방, 협회, 노조의 세 협력 채널을 청연 지원센터와 연결합니다.' },
            { title: '지원 요청 공유', desc: '여러 현장의 지원 요청, 지원 가능한 팀의 회신, 지원팀 모집 메시지가 세 채팅창에 연달아 올라옵니다.' },
            { title: '지원 보내기', desc: '협력사 현장에 인력이 필요하면, 일정을 조율한 청연 지원팀이 해당 현장으로 이동합니다.' },
            { title: '지원 받기', desc: '청연 현장에 인력이 필요하면, 단체 카카오톡방·협회·노조에서 연결된 협력 지원팀이 현장으로 옵니다.' },
            { title: '상호 지원', desc: '청연팀은 협력사 현장으로, 협력팀은 청연 현장으로 이동하며 서로의 현장 운영을 돕습니다.' }
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

export const MODULE_LINKS: Record<BusinessModule['id'], { to: string; label: string }> = {
    'system-dongbari-scaffolding': { to: '/site/management', label: '프로젝트 보기' },
    'material-rental': { to: '/materials/inventory', label: '자재 재고 보기' },
    'manpower-supply': { to: '/assignment/daily-dispatch', label: '인력 배치 보기' },
    'erp-site-management': { to: '/reports/daily', label: '출력일보 보기' },
    'partner-network': { to: '/company/management', label: '협력사 관리 보기' }
};
export const TOPICS = ['시공', '자재임대', '인력공급', '현장관리', '협력사'];

