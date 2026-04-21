import React, { useEffect, useState } from 'react';
import { motion, useAnimation, Variants, AnimatePresence } from 'framer-motion';
import logoConstruction from '../../assets/logo_construction.jpg';
import logoFinished from '../../assets/logo_finished.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSitemap,
    faProjectDiagram,
    faBuilding,
    faUsers,
    faBoxes,
    faDatabase,
    faNetworkWired,
    faArrowRight,
    faXmark,
    faCheckCircle,
    faHelmetSafety,
    faChartLine
} from '@fortawesome/free-solid-svg-icons';

// --- Types & Data ---

interface MenuItem {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
}

const MENUS: MenuItem[] = [
    {
        id: 'system-dongbari-scaffolding',
        title: '시스템 동바리비계 시공',
        description: '시스템 동바리와 비계 시공을 통합 관리하며 구조 검토, 물량 산출, 공정 계획을 한 번에 운영합니다.',
        icon: faSitemap,
        color: 'blue'
    },
    {
        id: 'peri-dongbari',
        title: '시스템 자재임대',
        description: '페리(Peri) 규격 자재의 임대 가능 수량, 출고 일정, 회수 계획을 통합 관리하는 임대 운영 모듈.',
        icon: faProjectDiagram,
        color: 'violet'
    },
    {
        id: 'peri-scaffolding',
        title: '시스템 인력공급',
        description: '현장별 시스템 인력 배치, 출역 현황, 인건비 정산 흐름을 한 번에 관리하는 운영 사무소 모듈.',
        icon: faBuilding,
        color: 'cyan'
    },
    {
        id: 'erp-site-management',
        title: 'ERP 실시간 현장관리',
        description: '인력, 자재, 현장 데이터베이스를 통합해 실시간 투입 현황, 재고, 정산 흐름을 한 화면에서 관리합니다.',
        icon: faDatabase,
        color: 'emerald'
    },
    {
        id: 'partner-network',
        title: '협력사 네트워크',
        description: '우수 시공 협력사 정보 조회, 발주 연계, 시공 평가 내역 및 파트너 매칭.',
        icon: faNetworkWired,
        color: 'teal'
    }
];

interface SystemConstructionPhoto {
    id: string;
    category: '시스템 동바리' | '시스템 비계';
    phase: string;
    title: string;
    description: string;
    src: string;
}

interface MaterialRentalPhoto {
    id: string;
    category: '시스템 동바리 자재' | '시스템 비계 자재';
    phase: string;
    title: string;
    description: string;
    src: string;
}

interface ManpowerSupplyPhoto {
    id: string;
    category: '현장 집결' | '작업 투입';
    phase: string;
    title: string;
    description: string;
    src: string;
}

interface ErpSiteManagementPhoto {
    id: string;
    category: '현장 입력' | '통합 관제';
    phase: string;
    title: string;
    description: string;
    src: string;
}

interface PartnerNetworkPhoto {
    id: string;
    category: '파트너 미팅' | '비즈니스 협업';
    phase: string;
    title: string;
    description: string;
    src: string;
}

interface DetailProcessStep {
    step: string;
    title: string;
    icon: any;
    desc: string;
    focus?: string;
}

const SYSTEM_CONSTRUCTION_PHOTOS: SystemConstructionPhoto[] = [
    {
        id: 'dongbari-layout',
        category: '시스템 동바리',
        phase: '01 배치선 확인',
        title: '기준점과 하중 전달선 정리',
        description: '슬래브와 보 하중이 내려오는 구간에 맞춰 배치선을 먼저 잡아야 동바리 간격과 수직도가 안정적으로 맞춰집니다.',
        src: 'https://images.pexels.com/photos/17951553/pexels-photo-17951553.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-base',
        category: '시스템 동바리',
        phase: '02 하부 받침',
        title: '잭베이스와 받침면 레벨링',
        description: '바닥 편차를 정리한 뒤 잭베이스 높이를 동일하게 맞추면 초기 침하와 수평 오차를 줄일 수 있습니다.',
        src: 'https://images.pexels.com/photos/36162728/pexels-photo-36162728.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-frame',
        category: '시스템 동바리',
        phase: '03 수직재 조립',
        title: '수직재와 수평재 프레임 설치',
        description: '수직재를 세운 뒤 수평재와 가새를 규격 간격으로 조립해 좌굴 저항과 프레임 강성을 확보합니다.',
        src: 'https://images.pexels.com/photos/32577705/pexels-photo-32577705.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-uhead',
        category: '시스템 동바리',
        phase: '04 상부 지지',
        title: 'U헤드와 거푸집 지지선 완성',
        description: 'U헤드, 멍에, 장선을 연결해 상부 거푸집 하중이 균일하게 전달되도록 지지 체계를 마감합니다.',
        src: 'https://images.pexels.com/photos/35886617/pexels-photo-35886617.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-inspection',
        category: '시스템 동바리',
        phase: '05 사용 전 점검',
        title: '수직도와 체결 상태 최종 확인',
        description: '체결 상태, 간격, 침하 여부를 체크리스트로 확인한 뒤 콘크리트 타설 전 사용 승인을 진행합니다.',
        src: 'https://images.pexels.com/photos/5511066/pexels-photo-5511066.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-material',
        category: '시스템 동바리',
        phase: '06 자재 반입',
        title: '부재 분류와 설치 구간별 적치',
        description: '수직재, 수평재, 가새, U헤드를 구간별로 구분 적치하면 조립 속도와 안전성이 함께 좋아집니다.',
        src: 'https://images.pexels.com/photos/14989323/pexels-photo-14989323.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-support',
        category: '시스템 동바리',
        phase: '07 보강 지지',
        title: '집중하중 구간 추가 보강',
        description: '보 단부와 집중하중 구간에는 보강재를 추가해 처짐과 편하중 위험을 줄이는 것이 핵심입니다.',
        src: 'https://images.pexels.com/photos/7392835/pexels-photo-7392835.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-frame-view',
        category: '시스템 동바리',
        phase: '08 전체 구조 확인',
        title: '격자 프레임 정렬 상태 점검',
        description: '조립 후에는 격자 간격, 수평 레벨, 통과 동선을 한 번에 보면서 전체 구조를 재확인합니다.',
        src: 'https://images.pexels.com/photos/4564051/pexels-photo-4564051.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-pour-ready',
        category: '시스템 동바리',
        phase: '09 타설 준비',
        title: '콘크리트 타설 전 최종 준비',
        description: '타설 직전에는 상부 지지선, 연결부, 통로 확보 상태를 마지막으로 정리해 작업 혼선을 줄여야 합니다.',
        src: 'https://images.pexels.com/photos/9784169/pexels-photo-9784169.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-maintenance',
        category: '시스템 동바리',
        phase: '10 유지관리',
        title: '사용 중 침하와 체결 상태 관리',
        description: '타설 중과 양생 중에는 침하, 풀림, 변형 여부를 반복 확인해 구조 안정성을 유지합니다.',
        src: 'https://images.pexels.com/photos/3086603/pexels-photo-3086603.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-qc',
        category: '시스템 동바리',
        phase: '11 품질 검측',
        title: '작업 구간별 수평·수직 검측',
        description: '층별로 수평과 수직 오차를 나눠 점검하면 설치 완료 후에도 보강이 필요한 구간을 빠르게 찾을 수 있습니다.',
        src: 'https://images.pexels.com/photos/17919371/pexels-photo-17919371.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'dongbari-detail',
        category: '시스템 동바리',
        phase: '12 디테일 확인',
        title: '지지 부재 상세 체결 상태 확인',
        description: '브래킷과 지지 부재의 체결 디테일을 마지막에 확인하면 사용 중 풀림과 편하중 리스크를 줄일 수 있습니다.',
        src: 'https://images.pexels.com/photos/12704629/pexels-photo-12704629.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-entry',
        category: '시스템 비계',
        phase: '01 외곽 프레임',
        title: '외벽 작업면의 수직 프레임 구성',
        description: '외곽 작업구간을 따라 비계 수직 프레임을 세우고 작업층별 기준 모듈을 먼저 맞춥니다.',
        src: 'https://images.pexels.com/photos/9637500/pexels-photo-9637500.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-brace',
        category: '시스템 비계',
        phase: '02 가새 보강',
        title: '수평재와 가새로 구조 강성 확보',
        description: '연결부를 순차 체결해 횡하중과 진동에 견디는 구조를 만들고 층별 작업면을 확장합니다.',
        src: 'https://images.pexels.com/photos/10134469/pexels-photo-10134469.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-platform',
        category: '시스템 비계',
        phase: '03 작업발판 설치',
        title: '발판과 통로 확보',
        description: '근로자 이동 동선과 자재 인양 동선을 분리해 작업발판, 통로, 계단 구간을 안전하게 구성합니다.',
        src: 'https://images.pexels.com/photos/13227040/pexels-photo-13227040.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-safety',
        category: '시스템 비계',
        phase: '04 안전부재 설치',
        title: '난간, 벽이음, 낙하물 방지 보강',
        description: '추락방지 난간과 벽이음, 보호망을 추가해 고소 작업 구간의 안전성과 전도 저항을 함께 높입니다.',
        src: 'https://images.pexels.com/photos/13464875/pexels-photo-13464875.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-finish',
        category: '시스템 비계',
        phase: '05 전체 점검',
        title: '층별 작업면과 접근성 최종 점검',
        description: '층간 연결, 발판 상태, 적재하중, 안전표지까지 확인해 현장 사용 전 최종 인수 점검을 마무리합니다.',
        src: 'https://images.pexels.com/photos/11299531/pexels-photo-11299531.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-material',
        category: '시스템 비계',
        phase: '06 자재 배치',
        title: '작업면별 자재 반입과 구획 정리',
        description: '작업층과 이동 통로를 분리해 부재를 적치하면 설치 중 간섭과 낙하 위험을 낮출 수 있습니다.',
        src: 'https://images.pexels.com/photos/18080900/pexels-photo-18080900.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-height',
        category: '시스템 비계',
        phase: '07 층별 확장',
        title: '고층 작업 구간 수직 증설',
        description: '층별 모듈을 반복 증설할 때는 벽이음 위치와 작업 발판 레벨을 동시에 맞춰야 합니다.',
        src: 'https://images.pexels.com/photos/13227051/pexels-photo-13227051.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-workers',
        category: '시스템 비계',
        phase: '08 작업 투입',
        title: '작업자 접근 동선과 계단 점검',
        description: '실제 작업자가 투입되기 전 계단, 승하강 동선, 통로 폭을 먼저 확인해야 현장 체감 안전성이 올라갑니다.',
        src: 'https://images.pexels.com/photos/16853020/pexels-photo-16853020.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-wide',
        category: '시스템 비계',
        phase: '09 외벽 전개',
        title: '외벽 전체 작업면 연결',
        description: '넓은 외벽 구간은 층별 연결성과 적재하중 배분을 함께 보고 전체 작업면을 조정합니다.',
        src: 'https://images.pexels.com/photos/8960945/pexels-photo-8960945.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-final-check',
        category: '시스템 비계',
        phase: '10 사용 승인',
        title: '난간과 보호망 포함 최종 승인',
        description: '사용 승인 전에는 난간, 발판 고정, 보호망, 안전표지까지 묶어서 최종 인수 점검을 마칩니다.',
        src: 'https://images.pexels.com/photos/33339484/pexels-photo-33339484.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-tower',
        category: '시스템 비계',
        phase: '11 고층 작업면',
        title: '고층 외벽 구간 작업면 점검',
        description: '고층 구간은 풍하중과 작업 동선을 함께 보고 발판과 난간의 연속성을 별도로 확인해야 합니다.',
        src: 'https://images.pexels.com/photos/12119852/pexels-photo-12119852.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'scaffolding-skyline',
        category: '시스템 비계',
        phase: '12 외벽 마감 대응',
        title: '외벽 마감 공정 대응 작업 플랫폼',
        description: '비계는 외벽 마감 공정과 맞물려 이동성과 접근성이 중요하므로 층별 작업 범위를 다시 정리해야 합니다.',
        src: 'https://images.pexels.com/photos/14326105/pexels-photo-14326105.jpeg?auto=compress&cs=tinysrgb&w=1200'
    }
];

const MATERIAL_ONLY_PHOTO_URLS = {
    pipeRackWide: 'https://images.pexels.com/photos/15508177/pexels-photo-15508177.jpeg?cs=srgb&dl=pexels-zakhar-15508177.jpg&fm=jpg',
    pipeRackFront: 'https://images.pexels.com/photos/15508178/pexels-photo-15508178.jpeg?cs=srgb&dl=pexels-zakhar-15508178.jpg&fm=jpg',
    pipeWarehouseWide: 'https://images.pexels.com/photos/36878025/pexels-photo-36878025.jpeg?cs=srgb&dl=pexels-zakhar-36878025.jpg&fm=jpg',
    assortedBarsTop: 'https://images.pexels.com/photos/19825178/pexels-photo-19825178.jpeg?cs=srgb&dl=pexels-jimmy-liao-3615017-19825178.jpg&fm=jpg',
    assortedBarsWide: 'https://images.pexels.com/photos/14838208/pexels-photo-14838208.jpeg?cs=srgb&dl=pexels-jimmy-liao-3615017-14838208.jpg&fm=jpg',
    warehouseSheets: 'https://images.pexels.com/photos/36122954/pexels-photo-36122954.jpeg?cs=srgb&dl=pexels-james-richardson-2159544295-36122954.jpg&fm=jpg',
    steelBarsDark: 'https://images.pexels.com/photos/36397982/pexels-photo-36397982.jpeg?cs=srgb&dl=pexels-willians-huerta-2157111846-36397982.jpg&fm=jpg',
    formPanelStacks: 'https://images.pexels.com/photos/36003983/pexels-photo-36003983.jpeg?cs=srgb&dl=pexels-michael-orshan-2159363670-36003983.jpg&fm=jpg',
    steelBeamClose: 'https://images.pexels.com/photos/36003978/pexels-photo-36003978.jpeg?cs=srgb&dl=pexels-michael-orshan-2159363670-36003978.jpg&fm=jpg',
    cutPipesClose: 'https://images.pexels.com/photos/36134791/pexels-photo-36134791.jpeg?cs=srgb&dl=pexels-peter-dyllong-2158803154-36134791.jpg&fm=jpg',
    beamYard: 'https://images.pexels.com/photos/36003989/pexels-photo-36003989.jpeg?cs=srgb&dl=pexels-michael-orshan-2159363670-36003989.jpg&fm=jpg',
    pipeYardWide: 'https://images.pexels.com/photos/33996166/pexels-photo-33996166.jpeg?cs=srgb&dl=pexels-shuaizhi-tian-485596-33996166.jpg&fm=jpg',
    pipeYardClose: 'https://images.pexels.com/photos/33996167/pexels-photo-33996167.jpeg?cs=srgb&dl=pexels-shuaizhi-tian-485596-33996167.jpg&fm=jpg'
} as const;

const MATERIAL_RENTAL_PHOTOS: MaterialRentalPhoto[] = [
    {
        id: 'dongbari-jack-base',
        category: '시스템 동바리 자재',
        phase: '01 강관 적치',
        title: '동바리 강관 자재 묶음',
        description: '원형 강관이 랙에 적치된 형태로, 동바리 수직재와 보조 지지재를 규격별로 분류해 출고하는 장면에 맞는 이미지입니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeRackFront
    },
    {
        id: 'dongbari-standard',
        category: '시스템 동바리 자재',
        phase: '02 장척 자재',
        title: '장척 지지 파이프 적치',
        description: '길이가 긴 강관 자재를 길이별로 적치한 형태로, 주 지지재와 장척 수평재 보관 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeRackWide
    },
    {
        id: 'dongbari-ledger',
        category: '시스템 동바리 자재',
        phase: '03 봉형 부재',
        title: '봉형 연결 자재 정렬',
        description: '가늘고 긴 봉형 자재가 모여 있는 사진으로, 동바리 연결재나 보조 부재 적치 설명과 잘 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.assortedBarsTop
    },
    {
        id: 'dongbari-brace',
        category: '시스템 동바리 자재',
        phase: '04 보강 부재',
        title: '보강용 강재 세트',
        description: '여러 규격의 철재가 한 번에 적치된 형태로, 보강재나 보조 지지부재 세트 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.assortedBarsWide
    },
    {
        id: 'dongbari-u-head',
        category: '시스템 동바리 자재',
        phase: '05 빔형 지지재',
        title: '빔형 상부 지지 자재',
        description: '빔 단면이 드러난 강재 적치 사진으로, 상부 지지용 강재나 멍에 보조 자재 설명에 맞는 이미지입니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.steelBeamClose
    },
    {
        id: 'dongbari-plate',
        category: '시스템 동바리 자재',
        phase: '06 패널 자재',
        title: '패널형 보조 자재 적치',
        description: '판형 또는 패널형 부재가 적치된 사진으로, 받침 보강판이나 거푸집 보조 자재 묶음 설명에 어울립니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.formPanelStacks
    },
    {
        id: 'dongbari-pin',
        category: '시스템 동바리 자재',
        phase: '07 창고 보관',
        title: '창고 보관 자재 묶음',
        description: '창고 안에 정리된 자재 묶음 이미지로, 출고 전 대기 자재나 체결 보조 자재 보관 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.warehouseSheets
    },
    {
        id: 'dongbari-adjust-jack',
        category: '시스템 동바리 자재',
        phase: '08 창고 적치',
        title: '실내 적치 동바리 자재',
        description: '실내 창고에 규격별로 적치된 강재 사진으로, 정비 완료 후 재출고 대기 자재 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeWarehouseWide
    },
    {
        id: 'dongbari-support-set',
        category: '시스템 동바리 자재',
        phase: '09 중량 부재',
        title: '중량 봉강 자재 묶음',
        description: '굵은 봉강 형태가 강조된 사진으로, 집중하중 대응용 중량 자재나 보강용 부재 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.steelBarsDark
    },
    {
        id: 'dongbari-qc-set',
        category: '시스템 동바리 자재',
        phase: '10 절단 강관',
        title: '절단면 강관 자재',
        description: '강관 단면이 모여 있는 사진으로, 규격 절단 자재나 회수 후 분류된 파이프 자재 설명과 잘 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.cutPipesClose
    },
    {
        id: 'dongbari-maint-kit',
        category: '시스템 동바리 자재',
        phase: '11 야적장 보관',
        title: '야적장 빔형 자재',
        description: '실외 야적장에 보관된 빔형 자재 이미지로, 정비 대기 부재나 대량 보관 자재 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.beamYard
    },
    {
        id: 'dongbari-return-pack',
        category: '시스템 동바리 자재',
        phase: '12 회수 적치',
        title: '회수된 강관 자재 적치',
        description: '실외 적치장에 회수된 파이프 자재가 모여 있는 형태로, 반납 분류와 재임대 대기 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeYardClose
    },
    {
        id: 'scaffold-base-jack',
        category: '시스템 비계 자재',
        phase: '01 파이프 적치',
        title: '비계용 강관 자재 묶음',
        description: '비계 수직재와 수평재로 쓰이는 강관이 모여 있는 사진으로, 기본 비계 자재 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeRackWide
    },
    {
        id: 'scaffold-standard',
        category: '시스템 비계 자재',
        phase: '02 랙 보관',
        title: '랙 보관 비계 자재',
        description: '강관류가 랙에 정렬된 형태로, 수직재와 주 골조 부재를 창고형으로 관리하는 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeRackFront
    },
    {
        id: 'scaffold-ledger',
        category: '시스템 비계 자재',
        phase: '03 판형 부재',
        title: '발판·패널형 자재 적치',
        description: '판형 부재가 적치된 이미지로, 발판 계열 자재나 패널형 작업면 부재 설명에 잘 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.formPanelStacks
    },
    {
        id: 'scaffold-diagonal',
        category: '시스템 비계 자재',
        phase: '04 실외 적치',
        title: '실외 비계 파이프 적치',
        description: '야적장에 적치된 파이프류 사진으로, 가새재나 장척 연결재를 대량 보관하는 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeYardWide
    },
    {
        id: 'scaffold-platform',
        category: '시스템 비계 자재',
        phase: '05 창고 적치',
        title: '창고형 작업면 자재',
        description: '실내에 규격별로 보관된 자재 이미지로, 발판이나 작업면 보조 자재를 분류 저장하는 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.warehouseSheets
    },
    {
        id: 'scaffold-guardrail',
        category: '시스템 비계 자재',
        phase: '06 빔형 부재',
        title: '빔형 안전 보조 자재',
        description: '빔 단면이 강조된 사진으로, 난간 보조 프레임이나 강재 연결 자재 설명에 맞는 이미지입니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.steelBeamClose
    },
    {
        id: 'scaffold-wall-tie',
        category: '시스템 비계 자재',
        phase: '07 야적 보관',
        title: '야적 보관 프레임 자재',
        description: '실외에 보관된 프레임형 강재 사진으로, 벽이음 보조재나 구조 연결 자재 묶음 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.beamYard
    },
    {
        id: 'scaffold-stair-unit',
        category: '시스템 비계 자재',
        phase: '08 소구경 부재',
        title: '소구경 봉형 자재',
        description: '가늘고 긴 철재가 정렬된 이미지로, 보조 난간재나 부속 프레임 계열 설명과 잘 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.assortedBarsTop
    },
    {
        id: 'scaffold-bracket',
        category: '시스템 비계 자재',
        phase: '09 혼합 적치',
        title: '혼합 비계 부재 세트',
        description: '규격이 다른 부재가 함께 적치된 형태로, 브라켓과 보조 프레임류를 묶음 관리하는 설명에 어울립니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.assortedBarsWide
    },
    {
        id: 'scaffold-toe-board',
        category: '시스템 비계 자재',
        phase: '10 중량 부재',
        title: '중량 안전 보조 자재',
        description: '중량감 있는 강재 묶음 사진으로, 낙하물 방지 보조재나 고정 보강 부재 설명에 맞습니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.steelBarsDark
    },
    {
        id: 'scaffold-connector',
        category: '시스템 비계 자재',
        phase: '11 절단 파이프',
        title: '절단 비계 파이프 자재',
        description: '절단면이 보이는 강관 묶음으로, 연결용 파이프 자재와 회수 분류 자재 설명에 적합합니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.cutPipesClose
    },
    {
        id: 'scaffold-net',
        category: '시스템 비계 자재',
        phase: '12 회수 적치',
        title: '회수된 비계 자재 적치',
        description: '회수 후 야적장에 재정렬된 파이프 자재 이미지로, 반납 분류와 재임대 준비 설명에 맞는 사진입니다.',
        src: MATERIAL_ONLY_PHOTO_URLS.pipeYardClose
    }
];

const MANPOWER_SUPPLY_PHOTOS: ManpowerSupplyPhoto[] = [
    {
        id: 'manpower-assembly-01',
        category: '현장 집결',
        phase: '01 출근 집결',
        title: '작업 시작 전 인부 집결',
        description: '아침 작업 시작 전 인부들이 한곳에 모여 인원 점검과 작업 구역 배치를 기다리는 장면입니다.',
        src: 'https://images.pexels.com/photos/13005576/pexels-photo-13005576.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-assembly-02',
        category: '현장 집결',
        phase: '02 안전 조회',
        title: 'TBM 전 안전장비 확인',
        description: '안전모와 형광조끼 착용 상태를 맞추고, 인부들이 조회선에 모여 당일 안전수칙을 확인하는 흐름입니다.',
        src: 'https://images.pexels.com/photos/20452662/pexels-photo-20452662.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-assembly-03',
        category: '현장 집결',
        phase: '03 작업 브리핑',
        title: '작업반장 중심 사전 브리핑',
        description: '현장 반장과 작업 인부들이 도면과 작업 범위를 함께 확인하며 투입 전 브리핑을 진행하는 장면입니다.',
        src: 'https://images.pexels.com/photos/17797264/pexels-photo-17797264.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-assembly-04',
        category: '현장 집결',
        phase: '04 배치 협의',
        title: '공종별 투입 인원 협의',
        description: '여러 명의 현장 인력이 한곳에 모여 공종별 담당 구간과 장비 연계 순서를 조율하는 모습입니다.',
        src: 'https://images.pexels.com/photos/30719069/pexels-photo-30719069.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-assembly-05',
        category: '현장 집결',
        phase: '05 대기 인원 정렬',
        title: '투입 전 대기 인원 정렬',
        description: '장비 반입과 이동 동선을 고려해 작업자들이 정렬된 상태로 대기하며 순차 투입을 준비하는 구간입니다.',
        src: 'https://images.pexels.com/photos/11790051/pexels-photo-11790051.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-assembly-06',
        category: '현장 집결',
        phase: '06 현장 공유',
        title: '현장 상황 공유 및 역할 분담',
        description: '인부들이 한곳에 모여 작업 위험 요소와 자재 위치, 이동 동선을 공유하며 역할을 분담하는 장면입니다.',
        src: 'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-deploy-01',
        category: '작업 투입',
        phase: '07 동시 투입',
        title: '다수 인부 동시 작업 투입',
        description: '여러 작업자가 같은 구간에 동시에 투입되어 콘크리트와 바닥 작업을 병행하는 현장 운영 장면입니다.',
        src: 'https://images.pexels.com/photos/7509167/pexels-photo-7509167.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-deploy-02',
        category: '작업 투입',
        phase: '08 고소 구간 투입',
        title: '상부 구조물 작업반 배치',
        description: '상부 구조물 구간에 인부들이 넓게 배치되어 동시 시공을 진행하는 장면으로, 대규모 투입 느낌을 보여줍니다.',
        src: 'https://images.pexels.com/photos/30514132/pexels-photo-30514132.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-deploy-03',
        category: '작업 투입',
        phase: '09 기초 공정',
        title: '기초 공정 인부 동시 작업',
        description: '기초와 하부 구조 작업에 여러 인부가 분산 배치되어 동시에 움직이는 현장의 실제 투입 장면입니다.',
        src: 'https://images.pexels.com/photos/17410739/pexels-photo-17410739.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-deploy-04',
        category: '작업 투입',
        phase: '10 구조 작업',
        title: '콘크리트 구조부 작업반 운영',
        description: '한 팀 단위로 모여 구조부 시공을 진행하는 장면으로, 현장 인력 공급 이후 실제 운영 상태를 보여줍니다.',
        src: 'https://images.pexels.com/photos/15794723/pexels-photo-15794723.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-deploy-05',
        category: '작업 투입',
        phase: '11 목공 협업',
        title: '다인 협업 작업 장면',
        description: '여러 인부가 한 구조물에 동시에 붙어 협업하는 장면으로, 공종별 팀 단위 운영 흐름에 잘 맞습니다.',
        src: 'https://images.pexels.com/photos/11293626/pexels-photo-11293626.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        id: 'manpower-deploy-06',
        category: '작업 투입',
        phase: '12 외부 현장 작업',
        title: '외부 공정 인력 다수 투입',
        description: '외부 현장에 인력과 장비가 함께 배치된 장면으로, 인부 공급 이후 실제 현장 가동 분위기를 전달합니다.',
        src: 'https://images.pexels.com/photos/14846150/pexels-photo-14846150.jpeg?auto=compress&cs=tinysrgb&w=1200'
    }
];

const ERP_SITE_MANAGEMENT_PHOTOS: ErpSiteManagementPhoto[] = [
    {
        id: 'erp-mobile-report',
        category: '현장 입력',
        phase: '01 모바일 일보',
        title: '모바일 일보 입력',
        description: '현장 반장과 소장이 스마트폰이나 태블릿으로 출역, 공수, 작업내용을 즉시 입력하는 ERP 현장 화면에 맞춘 카드입니다.',
        src: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-attendance-check',
        category: '현장 입력',
        phase: '02 출역 확인',
        title: '출역·근태 실시간 체크',
        description: '근로자 출역 여부와 팀별 인원 현황을 현장에서 바로 체크하고 본사로 넘기는 근태 관리 흐름을 보여줍니다.',
        src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-safety-log',
        category: '현장 입력',
        phase: '03 안전 점검',
        title: '안전 점검 이력 기록',
        description: '점검 체크리스트, 사진 첨부, 시정조치 내역을 현장에서 즉시 기록해 ERP 안전관리 이력으로 남기는 구간입니다.',
        src: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-material-scan',
        category: '현장 입력',
        phase: '04 자재 입출고',
        title: '자재 반입·반출 스캔',
        description: '현장에 반입된 자재와 회수 자재를 스캔 또는 수기로 기록해 재고 흐름을 ERP에 연결하는 자재 입력 장면입니다.',
        src: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-photo-evidence',
        category: '현장 입력',
        phase: '05 사진 증빙',
        title: '공정 사진과 증빙 업로드',
        description: '작업 전후 사진, 이슈 현황, 품질 증빙 이미지를 현장에서 바로 올려 보고 체계를 표준화하는 기능에 맞는 카드입니다.',
        src: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-offline-sync',
        category: '현장 입력',
        phase: '06 오프라인 동기화',
        title: '오프라인 입력 후 자동 동기화',
        description: '통신이 약한 현장에서도 데이터를 먼저 적재하고 연결 시 본사와 자동 동기화하는 ERP 모바일 운용 흐름입니다.',
        src: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-dashboard-monitor',
        category: '통합 관제',
        phase: '07 통합 대시보드',
        title: '본사 통합 운영 대시보드',
        description: '여러 현장의 인력, 원가, 공정, 이슈를 한 화면에서 실시간으로 모니터링하는 ERP 관제 핵심 화면입니다.',
        src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-cost-analysis',
        category: '통합 관제',
        phase: '08 원가 분석',
        title: '노무·자재 원가 분석',
        description: '현장별 투입 원가와 기성, 수익성을 실시간으로 비교 분석해 경영 판단에 연결하는 ERP 분석 기능을 표현합니다.',
        src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-control-room',
        category: '통합 관제',
        phase: '09 상황실 관제',
        title: '본사 상황실형 현장 관제',
        description: '본사 담당자가 여러 현장의 상태를 모니터링하며 이상징후를 빠르게 파악하는 통합 관제 운영 장면입니다.',
        src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-collaboration',
        category: '통합 관제',
        phase: '10 협업 워크플로',
        title: '팀간 승인·협업 워크플로',
        description: '현장, 공무, 관리, 경영지원이 같은 데이터를 기준으로 승인과 피드백을 주고받는 ERP 협업 흐름을 보여줍니다.',
        src: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-executive-view',
        category: '통합 관제',
        phase: '11 경영 리포트',
        title: '경영진용 요약 리포트',
        description: '누적 매출, 공정 진척률, 리스크 지표를 요약 리포트로 보여주는 ERP 경영 보고 화면에 맞춘 카드입니다.',
        src: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'erp-data-hub',
        category: '통합 관제',
        phase: '12 데이터 허브',
        title: '클라우드 기반 데이터 허브',
        description: '현장 데이터가 클라우드에 모여 문서, 서명, 정산, 보고서까지 한 흐름으로 이어지는 ERP 허브 구조를 표현합니다.',
        src: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80'
    }
];

const PARTNER_NETWORK_PHOTOS: PartnerNetworkPhoto[] = [
    {
        id: 'partner-meeting-01',
        category: '파트너 미팅',
        phase: '01 제안 미팅',
        title: '초기 파트너 제안 미팅',
        description: '협력사와 첫 미팅을 통해 사업 범위, 수행 경험, 공사 대응력, 공급 가능 품목을 점검하는 장면에 맞춘 카드입니다.',
        src: 'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-meeting-02',
        category: '파트너 미팅',
        phase: '02 조건 협의',
        title: '단가와 수행 조건 협의',
        description: '공정 범위, 견적 조건, 지급 기준, 일정 대응 범위를 실무진끼리 조율하는 비즈니스 협상 장면입니다.',
        src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-meeting-03',
        category: '파트너 미팅',
        phase: '03 역량 검토',
        title: '시공 역량과 실적 검토',
        description: '파트너사의 과거 수행 실적과 보유 인력, 장비, 자재 대응 능력을 프레젠테이션으로 검토하는 흐름입니다.',
        src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-meeting-04',
        category: '파트너 미팅',
        phase: '04 계약 검토',
        title: '계약서와 리스크 조항 검토',
        description: '계약 전 권한, 책임, 하자 대응, 정산 기준을 문서 중심으로 맞춰보는 협력사 계약 검토 장면입니다.',
        src: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-meeting-05',
        category: '파트너 미팅',
        phase: '05 입찰 브리핑',
        title: '입찰 전 제안 브리핑',
        description: '프로젝트 요구사항과 납기, 원가, 품질 조건을 공유하며 입찰 참여 여부를 결정하는 미팅에 적합한 사진입니다.',
        src: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-meeting-06',
        category: '파트너 미팅',
        phase: '06 파트너 등록',
        title: '협력사 등록 및 승인 협의',
        description: '신규 협력사를 등록하고 등급, 거래 조건, 승인 절차를 맞추는 파트너 온보딩 단계와 잘 맞습니다.',
        src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-business-01',
        category: '비즈니스 협업',
        phase: '07 일정 연동',
        title: '공정 일정과 공급 일정 연동',
        description: '본사와 협력사가 같은 일정표를 보며 자재 반입과 인력 투입 시점을 조율하는 운영 협업 화면입니다.',
        src: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-business-02',
        category: '비즈니스 협업',
        phase: '08 공급망 운영',
        title: '공급망과 물류 운영 협업',
        description: '여러 파트너가 공급 일정과 재고 흐름을 공유하며 프로젝트 납기를 맞추는 비즈니스 운영 장면입니다.',
        src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-business-03',
        category: '비즈니스 협업',
        phase: '09 성과 리뷰',
        title: '월간 성과와 KPI 리뷰',
        description: '협력사별 납기 준수율, 품질, 원가 절감, 재발주 여부를 수치로 검토하는 성과 리뷰 회의에 맞춘 카드입니다.',
        src: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-business-04',
        category: '비즈니스 협업',
        phase: '10 공동 대응',
        title: '이슈 발생 시 공동 대응 회의',
        description: '현장 이슈, 납기 지연, 품질 문제에 대해 본사와 협력사가 즉시 대응책을 정리하는 협업 장면입니다.',
        src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-business-05',
        category: '비즈니스 협업',
        phase: '11 장기 파트너십',
        title: '장기 파트너십 전략 미팅',
        description: '단기 거래가 아닌 장기 협력과 공동 성장 계획을 논의하는 전략 회의 장면으로 사업 제휴 분위기를 보여줍니다.',
        src: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'partner-business-06',
        category: '비즈니스 협업',
        phase: '12 경영 공유',
        title: '경영진과 파트너 비즈니스 공유',
        description: '경영진과 핵심 파트너가 프로젝트 포트폴리오, 매출 계획, 투자 방향을 함께 논의하는 장면입니다.',
        src: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
    }
];

const PROCESS_STEPS: Record<string, DetailProcessStep[]> = {
    'system-dongbari-scaffolding': [
        {
            step: '01',
            title: '현장 측량 및 기준선 설정',
            icon: faSitemap,
            desc: '하중선, 반입 동선, 기준 레벨을 먼저 잡아 동바리와 비계 설치 위치를 통합 계획합니다.',
            focus: '기준 레벨 오차와 자재 적치 구간을 선행 확정'
        },
        {
            step: '02',
            title: '받침면 정리와 잭베이스 설치',
            icon: faBoxes,
            desc: '침하 우려 구간을 보강하고 잭베이스를 균일하게 맞춰 초기 변형을 억제합니다.',
            focus: '지반 상태, 받침목, 베이스플레이트 동시 확인'
        },
        {
            step: '03',
            title: '수직재·수평재·가새 조립',
            icon: faHelmetSafety,
            desc: '수직재를 세운 뒤 수평재와 가새를 규격 간격대로 체결해 프레임 강성을 확보합니다.',
            focus: '초기 2단 조립 후 수직도와 체결 토크 재점검'
        },
        {
            step: '04',
            title: 'U헤드·거푸집 지지선 구성',
            icon: faBuilding,
            desc: '상부 거푸집 하중이 안전하게 전달되도록 U헤드, 멍에, 장선 연결부를 완성합니다.',
            focus: '집중하중 구간은 추가 보강재를 별도 배치'
        },
        {
            step: '05',
            title: '비계 발판·난간·벽이음 설치',
            icon: faCheckCircle,
            desc: '작업발판, 계단, 난간, 벽이음을 설치해 고소 작업 구간의 접근성과 안전성을 동시에 확보합니다.',
            focus: '추락방지 부재와 벽체 고정 상태를 사용 전 승인'
        },
        {
            step: '06',
            title: '사용 전 검사와 일일 유지관리',
            icon: faArrowRight,
            desc: '체결 상태, 침하, 적재하중, 통로 상태를 확인하고 작업 중에도 반복 점검합니다.',
            focus: '체크리스트 기반 승인 후 일일 TBM과 재점검 수행'
        }
    ],
    'peri-dongbari': [
        { step: '01', title: '임대 상담', icon: faDatabase, desc: '규격 및 수량 확정' },
        { step: '02', title: '품질 검수', icon: faCheckCircle, desc: '정품 자재 상태 확인' },
        { step: '03', title: '현장 출고', icon: faBoxes, desc: '물류 센터 배송' },
        { step: '04', title: '사용 관리', icon: faSitemap, desc: '일일 임대료 집계' },
        { step: '05', title: '정밀 회수', icon: faArrowRight, desc: '반납 자재 등급 분류' }
    ],
    'peri-scaffolding': [
        { step: '01', title: '인력 요청', icon: faUsers, desc: '현장 난이도 분석' },
        { step: '02', title: '팀 매칭', icon: faProjectDiagram, desc: '최적 숙련공 배정' },
        { step: '03', title: '안전 교육', icon: faHelmetSafety, desc: '작업 전 TBM 수행' },
        { step: '04', title: '출역 확인', icon: faCheckCircle, desc: '모바일 GPS 근태' },
        { step: '05', title: '노무 정산', icon: faDatabase, desc: '익월 노무비 지급' }
    ],
    'erp-site-management': [
        { step: '01', title: '시스템 도입', icon: faNetworkWired, desc: '현장 코드 생성' },
        { step: '02', title: '데이터 입력', icon: faDatabase, desc: '모바일 일보 작성' },
        { step: '03', title: '실시간 집계', icon: faProjectDiagram, desc: '본사 통합 모니터링' },
        { step: '04', title: '손익 분석', icon: faChartLine, desc: '원가 대비 기성 분석' },
        { step: '05', title: '디지털 자산화', icon: faCheckCircle, desc: '준공 데이터 영구 보관' }
    ],
    'partner-network': [
        { step: '01', title: '파트너 모집', icon: faNetworkWired, desc: '역량 평가 및 등록' },
        { step: '02', title: '견적 입찰', icon: faDatabase, desc: '투명한 온라인 비딩' },
        { step: '03', title: '계약 체결', icon: faCheckCircle, desc: '전자 계약 시스템' },
        { step: '04', title: '협업 수행', icon: faUsers, desc: '실시간 소통 채널' },
        { step: '05', title: '성과 평가', icon: faChartLine, desc: '상호 평점 및 우수사 선정' }
    ]
};

// --- Animation Variants ---

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.05 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0, scale: 0.98 },
    visible: {
        y: 0,
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    }
};

const detailVariants: Variants = {
    hidden: { opacity: 0, height: 0, scale: 0.96, y: 28, filter: 'blur(16px)' },
    visible: {
        opacity: 1,
        height: 'auto',
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { type: "spring", bounce: 0, duration: 0.58, staggerChildren: 0.06, delayChildren: 0.06 }
    },
    exit: {
        opacity: 0,
        height: 0,
        scale: 0.97,
        y: 18,
        filter: 'blur(14px)',
        transition: { type: "spring", bounce: 0, duration: 0.36 }
    }
};

const sectionStaggerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
            delayChildren: 0.04
        }
    }
};

const revealBlockVariants: Variants = {
    hidden: { opacity: 0, y: 28, scale: 0.985, filter: 'blur(12px)' },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            duration: 0.55,
            ease: 'easeOut'
        }
    }
};

const floatingGlowTransition = {
    duration: 16,
    repeat: Infinity,
    ease: 'easeInOut' as const
};

// --- Helper Components ---

interface ToolCardProps extends MenuItem {
    delay: number;
    onClick: () => void;
    isSelected: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon, color, onClick, isSelected, delay }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.96, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 240, damping: 24, delay }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative p-6 bg-slate-800/80 backdrop-blur-md rounded-2xl border ${isSelected ? `border-${color}-500 ring-1 ring-${color}-500/50 shadow-lg shadow-${color}-500/20` : 'border-slate-700/50 hover:border-slate-500/50 hover:shadow-cyan-500/10'} cursor-pointer overflow-hidden transition-all`}
            onClick={onClick}
        >
            <motion.div
                className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-${color}-400/80 to-transparent`}
                animate={{ opacity: isSelected ? [0.45, 1, 0.45] : [0.2, 0.75, 0.2], scaleX: isSelected ? [0.92, 1.04, 0.92] : [0.88, 1, 0.88] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-10 -mt-10`}
                animate={{ x: [0, -10, 0], y: [0, 12, 0], opacity: isSelected ? [0.55, 0.9, 0.55] : [0.32, 0.62, 0.32], scale: [1, 1.08, 1] }}
                transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className={`absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-${color}-500/10 blur-3xl`}
                animate={{ x: [0, 12, 0], y: [0, -10, 0], opacity: [0.18, 0.36, 0.18], scale: [0.96, 1.06, 0.96] }}
                transition={{ duration: 8.8, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="relative z-10 flex flex-col h-full">
                <motion.div
                    className={`w-12 h-12 rounded-xl bg-${color}-500/15 flex items-center justify-center mb-4 text-${color}-400 transition-colors ${isSelected ? `ring-2 ring-${color}-500/50` : `group-hover:text-${color}-300`}`}
                    animate={isSelected ? { rotate: [0, -4, 4, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                    transition={{ duration: 2.8, repeat: isSelected ? Infinity : 0, ease: 'easeInOut' }}
                >
                    <FontAwesomeIcon icon={icon} className="text-xl" />
                </motion.div>

                <h3 className={`text-xl font-bold mb-2 transition-colors ${isSelected ? `text-${color}-400` : 'text-white group-hover:text-slate-200'}`}>
                    {title}
                </h3>

                <p className="text-slate-400 text-sm mb-4 leading-relaxed flex-grow">
                    {description}
                </p>

                <div className={`flex items-center text-xs font-semibold uppercase tracking-wider transition-colors ${isSelected ? `text-${color}-400` : 'text-slate-500 group-hover:text-white'}`}>
                    <span>{isSelected ? '선택됨' : '상세 보기'}</span>
                    {!isSelected && <FontAwesomeIcon icon={faArrowRight} className="ml-2 transform group-hover:translate-x-1 transition-transform" />}
                </div>
            </div>
        </motion.div>
    );
};

// --- Main Page Component ---

const DesignManagementPage: React.FC = () => {
    const controls = useAnimation();
    const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
    const [showDeepDive, setShowDeepDive] = useState(false);

    // Reset Deep Dive when menu changes
    useEffect(() => {
        setShowDeepDive(false);
    }, [selectedMenu]);

    // Initial SVG Animation
    useEffect(() => {
        const sequence = async () => {
            await controls.start('drawing');
            await controls.start('construction');
            await controls.start('finished');
        };
        sequence();
    }, [controls]);

    const pathVariants: Variants = {
        hidden: { pathLength: 0, opacity: 0 },
        drawing: { pathLength: 1, opacity: 1, transition: { duration: 2, ease: "easeInOut" } }
    };

    const logoVariants: Variants = {
        hidden: { opacity: 0, scale: 0.8 },
        construction: { opacity: 1, scale: 1, transition: { duration: 1.5, ease: "easeOut" } },
        finished: { opacity: 0, scale: 1.1 }
    };

    const finalLogoVariants: Variants = {
        hidden: { opacity: 0, scale: 0.9 },
        finished: { opacity: 1, scale: 1, transition: { duration: 1.5, delay: 0.5, ease: "easeOut" } }
    };

    const isSystemConstruction = selectedMenu?.id === 'system-dongbari-scaffolding';
    const isMaterialRental = selectedMenu?.id === 'peri-dongbari';
    const isManpowerSupply = selectedMenu?.id === 'peri-scaffolding';
    const isErpSiteManagement = selectedMenu?.id === 'erp-site-management';
    const isPartnerNetwork = selectedMenu?.id === 'partner-network';
    const processSteps = selectedMenu ? PROCESS_STEPS[selectedMenu.id] ?? [] : [];
    const dongbariPhotos = SYSTEM_CONSTRUCTION_PHOTOS.filter((photo) => photo.category === '시스템 동바리');
    const scaffoldingPhotos = SYSTEM_CONSTRUCTION_PHOTOS.filter((photo) => photo.category === '시스템 비계');
    const totalConstructionPhotos = dongbariPhotos.length + scaffoldingPhotos.length;
    const dongbariMaterialPhotos = MATERIAL_RENTAL_PHOTOS.filter((photo) => photo.category === '시스템 동바리 자재');
    const scaffoldingMaterialPhotos = MATERIAL_RENTAL_PHOTOS.filter((photo) => photo.category === '시스템 비계 자재');
    const totalMaterialRentalPhotos = dongbariMaterialPhotos.length + scaffoldingMaterialPhotos.length;
    const manpowerAssemblyPhotos = MANPOWER_SUPPLY_PHOTOS.filter((photo) => photo.category === '현장 집결');
    const manpowerDeploymentPhotos = MANPOWER_SUPPLY_PHOTOS.filter((photo) => photo.category === '작업 투입');
    const totalManpowerSupplyPhotos = manpowerAssemblyPhotos.length + manpowerDeploymentPhotos.length;
    const erpFieldPhotos = ERP_SITE_MANAGEMENT_PHOTOS.filter((photo) => photo.category === '현장 입력');
    const erpControlPhotos = ERP_SITE_MANAGEMENT_PHOTOS.filter((photo) => photo.category === '통합 관제');
    const totalErpPhotos = erpFieldPhotos.length + erpControlPhotos.length;
    const partnerMeetingPhotos = PARTNER_NETWORK_PHOTOS.filter((photo) => photo.category === '파트너 미팅');
    const partnerBusinessPhotos = PARTNER_NETWORK_PHOTOS.filter((photo) => photo.category === '비즈니스 협업');
    const totalPartnerNetworkPhotos = partnerMeetingPhotos.length + partnerBusinessPhotos.length;

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
            {/* Background Mesh */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <motion.div
                    className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-blue-900/20 blur-[100px]"
                    animate={{ x: [0, 40, -24, 0], y: [0, -22, 12, 0], scale: [1, 1.08, 0.96, 1] }}
                    transition={floatingGlowTransition}
                />
                <motion.div
                    className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-cyan-900/20 blur-[100px]"
                    animate={{ x: [0, -36, 18, 0], y: [0, 26, -12, 0], scale: [1, 0.95, 1.06, 1] }}
                    transition={{ ...floatingGlowTransition, duration: 18 }}
                />
                <motion.div
                    className="absolute left-[18%] top-[12%] h-[26rem] w-[26rem] rounded-full bg-violet-500/8 blur-[120px]"
                    animate={{ x: [0, 18, -12, 0], y: [0, 20, -16, 0], opacity: [0.25, 0.42, 0.25] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div
                    className="absolute inset-0 opacity-[0.14]"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)',
                        backgroundSize: '36px 36px'
                    }}
                />
                <motion.div
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
                    animate={{ opacity: [0.18, 0.65, 0.18], scaleX: [0.92, 1, 0.92] }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="relative z-10 w-full px-4 py-12 md:px-8 xl:px-10">

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="mb-10 flex flex-col items-center justify-between gap-10 md:flex-row"
                >
                    <motion.div
                        variants={sectionStaggerVariants}
                        initial="hidden"
                        animate="visible"
                        className="text-center md:mb-0 md:text-left"
                    >
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">
                                청연ENG 사업영역
                            </span>
                        </div>
                        <motion.h1 variants={revealBlockVariants} className="mb-4 text-5xl font-extrabold text-white">
                            청연ENG 사업영역
                        </motion.h1>
                        <motion.p variants={revealBlockVariants} className="max-w-lg text-lg text-slate-400">
                            시스템 동바리비계 시공, 시스템 자재임대, 시스템 인력공급, ERP 실시간 현장관리, 협력사 네트워크까지 청연ENG의 핵심 사업영역을 통합 운영합니다.
                        </motion.p>
                        <motion.div variants={revealBlockVariants} className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                                {MENUS.length} Core Modules
                            </span>
                            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                                Engineering Workflow
                            </span>
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-300">
                                Operations Intelligence
                            </span>
                        </motion.div>
                    </motion.div>

                    {/* Animated Stage Visualizer */}
                    <motion.div
                        initial={{ opacity: 0, x: 24, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ duration: 0.85, delay: 0.16, ease: 'easeOut' }}
                        className="relative h-48 w-64 md:h-60 md:w-80"
                    >
                        <motion.div
                            className="absolute inset-0 rounded-[34px] border border-cyan-400/15 bg-gradient-to-br from-white/5 via-transparent to-cyan-500/10 backdrop-blur-sm"
                            animate={{ boxShadow: ['0 0 0 rgba(34,211,238,0.05)', '0 0 36px rgba(34,211,238,0.12)', '0 0 0 rgba(34,211,238,0.05)'] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <svg className="absolute w-full h-full pointer-events-none opacity-50" viewBox="0 0 800 600">
                            <motion.path
                                d="M200,500 L200,200 L600,200 L600,500"
                                fill="transparent" stroke="#3b82f6" strokeWidth="4"
                                variants={pathVariants} initial="hidden" animate={controls}
                            />
                            <motion.path
                                d="M200,350 L600,350 M300,500 L300,200 M500,500 L500,200"
                                fill="transparent" stroke="#60a5fa" strokeWidth="2" strokeDasharray="10 5"
                                variants={pathVariants} initial="hidden" animate={controls}
                            />
                        </svg>
                        <motion.div className="absolute inset-0 flex items-center justify-center" variants={logoVariants} initial="hidden" animate={controls}>
                            <img src={logoConstruction} alt="Construction" className="w-3/4 h-3/4 object-contain opacity-80" />
                        </motion.div>
                        <motion.div className="absolute inset-0 flex items-center justify-center" variants={finalLogoVariants} initial="hidden" animate={controls}>
                            <img src={logoFinished} alt="Finished" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]" />
                        </motion.div>
                    </motion.div>
                </motion.div>

                {/* Expanded Detail Panel Section */}
                <AnimatePresence mode="wait">
                    {selectedMenu && (
                        <motion.div
                            key={selectedMenu.id}
                            variants={detailVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            className="mb-16 overflow-hidden"
                        >
                            <div className={`p-10 md:p-16 bg-slate-900/95 backdrop-blur-2xl border-2 border-${selectedMenu.color}-500/40 rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.5)] relative`}>
                                {/* Background glow inside the detail panel */}
                                <div className={`absolute -top-60 -left-60 w-[600px] h-[600px] bg-${selectedMenu.color}-500/10 rounded-full blur-[120px] pointer-events-none`} />
                                <div className={`absolute -bottom-60 -right-60 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none`} />
                                <motion.div
                                    className={`absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-${selectedMenu.color}-400/90 to-transparent`}
                                    animate={{ opacity: [0.3, 0.95, 0.3], scaleX: [0.92, 1.03, 0.92] }}
                                    transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
                                />
                                <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                                <motion.div
                                    variants={sectionStaggerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="relative z-10"
                                >
                                    {/* Header in Detail */}
                                    <motion.div variants={revealBlockVariants} className="mb-12 flex flex-col items-start justify-between gap-8 border-b border-slate-700/50 pb-10 lg:flex-row">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-6 mb-6">
                                                <div className={`w-20 h-20 rounded-3xl bg-${selectedMenu.color}-500/20 flex items-center justify-center text-${selectedMenu.color}-400 text-4xl border border-${selectedMenu.color}-500/30 shadow-inner`}>
                                                    <FontAwesomeIcon icon={selectedMenu.icon} />
                                                </div>
                                                <div>
                                                    <h2 className="text-5xl font-black text-white tracking-tighter mb-2">
                                                        {selectedMenu.title}
                                                    </h2>
                                                    <div className="flex gap-3">
                                                        <span className={`px-3 py-1 rounded-full bg-${selectedMenu.color}-500/10 text-${selectedMenu.color}-400 text-xs font-bold uppercase tracking-widest`}>Engineering Level 5</span>
                                                        <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-widest">Standard Compliance: KOSHA</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-2xl text-slate-300 leading-snug font-medium max-w-4xl italic">
                                                "{selectedMenu.description}"
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-3 min-w-[240px]">
                                            <motion.div
                                                whileHover={{ y: -4, scale: 1.01 }}
                                                className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50"
                                            >
                                                <p className="text-slate-500 text-[10px] font-bold uppercase mb-2 tracking-tighter">Current Module Status</p>
                                                <div className="flex items-center justify-between text-white font-bold">
                                                    <span>최적화 완료</span>
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                                </div>
                                            </motion.div>
                                        </div>
                                    </motion.div>

                                    {/* 1:1 Detailed Content Grid (Dynamic Based on Menu ID) */}
                                    <motion.div variants={revealBlockVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-12">
                                        
                                        {/* Left Side: Professional Specs */}
                                        <div className="space-y-6">
                                            <motion.div
                                                whileHover={{ y: -6, scale: 1.005 }}
                                                transition={{ duration: 0.28, ease: 'easeOut' }}
                                                className={`bg-slate-950/60 p-8 rounded-[32px] border border-${selectedMenu.color}-500/30 relative overflow-hidden group/item h-full`}
                                            >
                                                <div className="flex items-center gap-4 mb-6">
                                                    <div className={`w-12 h-12 rounded-xl bg-${selectedMenu.color}-500/20 flex items-center justify-center text-${selectedMenu.color}-400 border border-${selectedMenu.color}-500/30`}>
                                                        <FontAwesomeIcon icon={selectedMenu.icon} />
                                                    </div>
                                                    <h3 className="text-3xl font-black text-white tracking-tight">
                                                        {selectedMenu.id === 'system-dongbari-scaffolding' ? '시스템 동바리 (System Shoring)' : 
                                                         selectedMenu.id === 'peri-dongbari' ? '자재 자산 관리 (Asset MGMT)' :
                                                         selectedMenu.id === 'peri-scaffolding' ? '인력 매칭 엔진 (Smart Dispatch)' :
                                                         selectedMenu.id === 'erp-site-management' ? '실시간 데이터 통합 (Live Sync)' : '글로벌 파트너십 (B2B Network)'}
                                                    </h3>
                                                </div>

                                                <div className="space-y-6 text-slate-300">
                                                    <div className={`bg-${selectedMenu.color}-500/5 p-5 rounded-2xl border border-${selectedMenu.color}-500/10`}>
                                                        <h4 className={`text-${selectedMenu.color}-400 font-bold mb-2 uppercase text-xs tracking-widest`}>기술적 정의 및 핵심 가치</h4>
                                                        <p className="text-sm leading-relaxed">
                                                            {selectedMenu.id === 'system-dongbari-scaffolding' && '슬래브 및 보의 거푸집을 지지하기 위해 고안된 가설 구조물입니다. 개별 동바리를 수평재로 연결하여 격자 구조를 형성, 좌굴 저항력을 극대화합니다.'}
                                                            {selectedMenu.id === 'peri-dongbari' && 'Peri 규격 및 정품 자재의 입출고, 유지보수, 감가상각을 관리합니다. 바코드 기반 추적 시스템으로 현장별 자재 손실률을 0.5% 미만으로 관리합니다.'}
                                                            {selectedMenu.id === 'peri-scaffolding' && '건설 현장별 필요 숙련도를 분석하여 최적의 팀과 개인을 매칭합니다. 안전 교육 이력 및 시공 평점이 연동된 투명한 인력 수급 생태계를 지향합니다.'}
                                                            {selectedMenu.id === 'erp-site-management' && '분산된 현장 데이터를 클라우드 기반으로 통합합니다. 노무비, 자재비, 경비를 실시간으로 집계하여 투입 대비 산출물(Yield)을 분석하는 현장 경영의 핵심 도구입니다.'}
                                                            {selectedMenu.id === 'partner-network' && '검증된 시공사 및 자재사와의 긴밀한 연업을 지원합니다. 입찰 시스템과 성과 기반 등급제를 통해 프로젝트 리스크를 사전 방지하고 시너지를 극대화합니다.'}
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                        <div className="space-y-2">
                                                            <p className="text-slate-500 font-bold uppercase">주요 구성 요소</p>
                                                            <ul className="space-y-1 ml-1">
                                                                {selectedMenu.id === 'system-dongbari-scaffolding' && (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span> 수직재/수평재 (Grid)</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span> 잭베이스 (Leveling)</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span> U헤드 (Fixing)</li>
                                                                    </>
                                                                )}
                                                                {selectedMenu.id === 'peri-dongbari' && (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>Peri 정품 규격 자재</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>RFID 태그 추적</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>정비/보수 워크플로우</li>
                                                                    </>
                                                                )}
                                                                {selectedMenu.id === 'peri-scaffolding' && (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>숙련공 DB (Career)</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>안전 교육 인증 (KOSHA)</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>팀 단위 매칭 로직</li>
                                                                    </>
                                                                )}
                                                                {selectedMenu.id === 'erp-site-management' && (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>실시간 모바일 리포팅</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>AI 손익 분석 엔진</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>디지털 증빙 보관소</li>
                                                                    </>
                                                                )}
                                                                {selectedMenu.id === 'partner-network' && (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>파트너 등급 시스템</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>스마트 입찰 모듈</li>
                                                                        <li className="flex items-start gap-2"><span className={`text-${selectedMenu.color}-500`}>●</span>협업 히스토리 추적</li>
                                                                    </>
                                                                )}
                                                            </ul>
                                                        </div>
                                                        <div className="space-y-2 text-slate-400">
                                                            <p className="text-slate-500 font-bold uppercase">운영 표준 기준</p>
                                                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 leading-relaxed">
                                                                {selectedMenu.id === 'system-dongbari-scaffolding' && <p>허용 하중: 4~6톤<br/>안전율: 2.0 이상</p>}
                                                                {selectedMenu.id === 'peri-dongbari' && <p>검수 주기: 반납 즉시<br/>정비율: 98% 이상 유지</p>}
                                                                {selectedMenu.id === 'peri-scaffolding' && <p>배치 속도: 24시간 이내<br/>사고 발생율: 0% 지향</p>}
                                                                {selectedMenu.id === 'erp-site-management' && <p>데이터 지연: 100ms 미만<br/>가동시간: 99.9% 보장</p>}
                                                                {selectedMenu.id === 'partner-network' && <p>파트너사: 500+ 보유<br/>매칭 성공률: 95% 이상</p>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </div>

                                        {/* Right Side: Secondary Detail */}
                                        <div className="space-y-6">
                                            <motion.div
                                                whileHover={{ y: -6, scale: 1.005 }}
                                                transition={{ duration: 0.28, ease: 'easeOut' }}
                                                className={`bg-slate-950/60 p-8 rounded-[32px] border border-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-500/30 relative overflow-hidden group/item h-full`}
                                            >
                                                <div className="flex items-center gap-4 mb-6">
                                                    <div className={`w-12 h-12 rounded-xl bg-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-500/20 flex items-center justify-center text-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-400 border border-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-500/30`}>
                                                        <FontAwesomeIcon icon={selectedMenu.id === 'system-dongbari-scaffolding' ? faBuilding : faCheckCircle} />
                                                    </div>
                                                    <h3 className="text-3xl font-black text-white tracking-tight">
                                                        {selectedMenu.id === 'system-dongbari-scaffolding' ? '시스템 비계 (System Scaffolding)' : 
                                                         selectedMenu.id === 'peri-dongbari' ? '물류 및 운송 최적화 (Logistics)' :
                                                         selectedMenu.id === 'peri-scaffolding' ? '노무비 자동 정산 (Payroll)' :
                                                         selectedMenu.id === 'erp-site-management' ? '모바일 현장 관제 (App)' : '상생 협력 가치 (Shared Growth)'}
                                                    </h3>
                                                </div>

                                                <div className="space-y-6 text-slate-300">
                                                    <div className={`bg-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-500/5 p-5 rounded-2xl border border-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-500/10`}>
                                                        <h4 className={`text-${selectedMenu.color === 'blue' ? 'cyan' : 'emerald'}-400 font-bold mb-2 uppercase text-xs tracking-widest`}>심층 분석 및 응용</h4>
                                                        <p className="text-sm leading-relaxed">
                                                            {selectedMenu.id === 'system-dongbari-scaffolding' && '건축물 외벽 시공 및 고소 작업을 위한 일체형 가설 발판 시스템입니다. 벽이음과 전용 계단을 통해 안전성과 공기 단축을 획기적으로 개선합니다.'}
                                                            {selectedMenu.id === 'peri-dongbari' && '현장별 이동 거리와 물량을 계산하여 최적의 운송 루트를 제안합니다. 자재 대기 시간을 최소화하여 전체 공정 속도를 15% 이상 향상시킵니다.'}
                                                            {selectedMenu.id === 'peri-scaffolding' && '일일 투입 인력을 기반으로 노무비를 실시간 계산합니다. 복잡한 수당 체계를 자동화하여 정산 오류를 배제하고 투명한 금융 환경을 구축합니다.'}
                                                            {selectedMenu.id === 'erp-site-management' && '현장 소장부터 근로자까지 사용하는 멀티 디바이스 환경을 지원합니다. 오프라인 상태에서도 데이터 입력이 가능하며 연결 시 자동 동기화됩니다.'}
                                                            {selectedMenu.id === 'partner-network' && '단순 협력을 넘어 기술 공유와 금융 지원 프로그램을 운영합니다. 우수 파트너사에게는 장기 계약 및 우선 배차권을 부여하여 동반 성장을 실현합니다.'}
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                        <div className="space-y-2">
                                                            <p className="text-slate-500 font-bold uppercase">전문 기능 명세</p>
                                                            <ul className="space-y-1 ml-1">
                                                                {selectedMenu.id === 'system-dongbari-scaffolding' ? (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className="text-cyan-500">●</span> 전용 통로 발판</li>
                                                                        <li className="flex items-start gap-2"><span className="text-cyan-500">●</span> 벽이음 (Wall-Tie)</li>
                                                                        <li className="flex items-start gap-2"><span className="text-cyan-500">●</span> 추락방지 난간</li>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <li className="flex items-start gap-2"><span className="text-emerald-500">●</span> 고급 분석 알고리즘</li>
                                                                        <li className="flex items-start gap-2"><span className="text-emerald-500">●</span> 커스텀 대시보드</li>
                                                                        <li className="flex items-start gap-2"><span className="text-emerald-500">●</span> API 확장 연동</li>
                                                                    </>
                                                                )}
                                                            </ul>
                                                        </div>
                                                        <div className="space-y-2 text-slate-400">
                                                            <p className="text-slate-500 font-bold uppercase">사용자 환경</p>
                                                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                                                                <p>환경: Web / Mobile / Tablet</p>
                                                                <p>접근: 직책별 차등 권한</p>
                                                                <p>보안: AES-256 암호화</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </div>
                                    </motion.div>

                                    {/* Bottom Process Visualizer (Dynamic Labels) */}
                                    <motion.div variants={revealBlockVariants} className="bg-slate-800/40 p-10 rounded-[32px] border border-slate-700/50 mb-12">
                                        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                            <h4 className="flex items-center gap-3 text-xl font-bold text-white">
                                                <FontAwesomeIcon icon={faProjectDiagram} className="text-slate-500" />
                                                {isSystemConstruction
                                                    ? '시스템 동바리 · 시스템 비계 설치 순서'
                                                    : `${selectedMenu.title} 운영 프로세스 (Business Pipeline)`}
                                            </h4>
                                            {isSystemConstruction && (
                                                <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                                                    동바리와 비계를 따로 보지 않고 하중 전달 구조와 작업 안전 구조를 동시에 설계해야
                                                    설치 품질과 공정 안정성이 함께 올라갑니다.
                                                </p>
                                            )}
                                        </div>
                                        <div className={isSystemConstruction ? 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6' : 'grid grid-cols-2 gap-6 md:grid-cols-5'}>
                                            {processSteps.map((item, i) => (
                                                <motion.div
                                                    key={i}
                                                    variants={revealBlockVariants}
                                                    whileHover={{ y: -8, scale: 1.02 }}
                                                    transition={{ duration: 0.24, ease: 'easeOut' }}
                                                    className="relative group/step"
                                                >
                                                    <div className="flex h-full flex-col rounded-[28px] border border-slate-700/60 bg-slate-950/70 p-5 text-center">
                                                        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xl text-slate-400 transition-all group-hover/step:border-${selectedMenu.color}-500/50 group-hover/step:text-${selectedMenu.color}-400`}>
                                                            <FontAwesomeIcon icon={item.icon} />
                                                        </div>
                                                        <span className={`text-[10px] font-black text-${selectedMenu.color}-500 mb-1`}>{item.step}</span>
                                                        <h5 className="text-sm font-bold text-white mb-1">{item.title}</h5>
                                                        <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
                                                        {item.focus && (
                                                            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-left">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                                                    체크포인트
                                                                </p>
                                                                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                                                                    {item.focus}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {i < processSteps.length - 1 && (
                                                        <div className="absolute left-[calc(50%+40px)] top-8 hidden h-px w-[calc(100%-80px)] bg-slate-700 xl:block" />
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>

                                    {/* Extreme Technical Deep Dive Section (Toggleable) */}
                                    <AnimatePresence>
                                        {showDeepDive && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="mb-12 space-y-8"
                                            >
                                                {isSystemConstruction && (
                                                    <div className="space-y-8">
                                                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                                            <div>
                                                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300/80">
                                                                    Installation Photo Flow
                                                                </p>
                                                                <h4 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                                                                    시스템 동바리 · 시스템 비계 사진으로 보는 설치 과정
                                                                </h4>
                                                                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
                                                                    기준점 확인, 하부 레벨링, 프레임 조립, 상부 지지, 작업발판, 난간 및 벽이음, 최종 점검까지
                                                                    현장에서 반드시 보는 장면을 {totalConstructionPhotos}장으로 정리했습니다.
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                                                                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">동바리 사진</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{dongbariPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">비계 사진</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{scaffoldingPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">설치 단계</p>
                                                                    <p className="mt-1 text-lg font-black text-white">6단계</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
                                                            {[
                                                                {
                                                                    title: '시스템 동바리 사진',
                                                                    description: '슬래브와 보 하중을 안정적으로 지지하기 위한 하부 준비와 상부 지지 흐름입니다.',
                                                                    accent: 'blue',
                                                                    photos: dongbariPhotos
                                                                },
                                                                {
                                                                    title: '시스템 비계 사진',
                                                                    description: '외벽 작업면, 발판, 난간, 벽이음까지 안전하게 완성하는 외부 작업 플랫폼 흐름입니다.',
                                                                    accent: 'cyan',
                                                                    photos: scaffoldingPhotos
                                                                }
                                                            ].map((section) => (
                                                                <div
                                                                    key={section.title}
                                                                    className={`rounded-[32px] border p-6 md:p-8 ${
                                                                        section.accent === 'blue'
                                                                            ? 'border-blue-500/25 bg-blue-500/[0.03]'
                                                                            : 'border-cyan-500/25 bg-cyan-500/[0.03]'
                                                                    }`}
                                                                >
                                                                    <div className="mb-6">
                                                                        <h5 className="text-2xl font-black tracking-tight text-white">{section.title}</h5>
                                                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.description}</p>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                                        {section.photos.map((photo) => (
                                                                            <article
                                                                                key={photo.id}
                                                                                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
                                                                            >
                                                                                <div className="group relative">
                                                                                    <img
                                                                                        src={photo.src}
                                                                                        alt={`${photo.category} ${photo.title}`}
                                                                                        loading="lazy"
                                                                                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                                                                                    <div
                                                                                        className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${
                                                                                            section.accent === 'blue'
                                                                                                ? 'border border-blue-300/30 bg-blue-500/15 text-blue-100'
                                                                                                : 'border border-cyan-300/30 bg-cyan-500/15 text-cyan-100'
                                                                                        }`}
                                                                                    >
                                                                                        {photo.phase}
                                                                                    </div>
                                                                                    <div className="absolute bottom-4 left-4 right-4">
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
                                                                                            {photo.category}
                                                                                        </p>
                                                                                        <h6 className="mt-1 text-base font-black leading-tight text-white">
                                                                                            {photo.title}
                                                                                        </h6>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="p-4">
                                                                                    <p className="text-sm leading-relaxed text-slate-400">
                                                                                        {photo.description}
                                                                                    </p>
                                                                                </div>
                                                                            </article>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {isMaterialRental && (
                                                    <div className="space-y-8">
                                                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                                            <div>
                                                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-violet-300/80">
                                                                    Material Rental Gallery
                                                                </p>
                                                                <h4 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                                                                    시스템 동바리 자재 · 시스템 비계 자재 사진으로 보는 임대 구성
                                                                </h4>
                                                                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
                                                                    출고 전 검수, 규격 분류, 현장 반입, 회수 후 정비까지 자재임대 실무에서 자주 보는 품목을
                                                                    {totalMaterialRentalPhotos}장으로 정리했습니다.
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                                                                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">동바리 자재</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{dongbariMaterialPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">비계 자재</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{scaffoldingMaterialPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">총 자재 사진</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{totalMaterialRentalPhotos}컷</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
                                                            {[
                                                                {
                                                                    title: '시스템 동바리 자재',
                                                                    description: '잭베이스, 수직재, 수평재, U헤드, 연결핀 등 동바리 임대 핵심 품목을 정리했습니다.',
                                                                    accent: 'violet',
                                                                    photos: dongbariMaterialPhotos
                                                                },
                                                                {
                                                                    title: '시스템 비계 자재',
                                                                    description: '베이스잭, 수직재, 발판, 난간, 벽이음, 계단 유닛 등 비계 임대 핵심 품목을 정리했습니다.',
                                                                    accent: 'cyan',
                                                                    photos: scaffoldingMaterialPhotos
                                                                }
                                                            ].map((section) => (
                                                                <div
                                                                    key={section.title}
                                                                    className={`rounded-[32px] border p-6 md:p-8 ${
                                                                        section.accent === 'violet'
                                                                            ? 'border-violet-500/25 bg-violet-500/[0.03]'
                                                                            : 'border-cyan-500/25 bg-cyan-500/[0.03]'
                                                                    }`}
                                                                >
                                                                    <div className="mb-6">
                                                                        <h5 className="text-2xl font-black tracking-tight text-white">{section.title}</h5>
                                                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.description}</p>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                                        {section.photos.map((photo) => (
                                                                            <article
                                                                                key={photo.id}
                                                                                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
                                                                            >
                                                                                <div className="group relative">
                                                                                    <img
                                                                                        src={photo.src}
                                                                                        alt={`${photo.category} ${photo.title}`}
                                                                                        loading="lazy"
                                                                                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                                                                                    <div
                                                                                        className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${
                                                                                            section.accent === 'violet'
                                                                                                ? 'border border-violet-300/30 bg-violet-500/15 text-violet-100'
                                                                                                : 'border border-cyan-300/30 bg-cyan-500/15 text-cyan-100'
                                                                                        }`}
                                                                                    >
                                                                                        {photo.phase}
                                                                                    </div>
                                                                                    <div className="absolute bottom-4 left-4 right-4">
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
                                                                                            {photo.category}
                                                                                        </p>
                                                                                        <h6 className="mt-1 text-base font-black leading-tight text-white">
                                                                                            {photo.title}
                                                                                        </h6>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="p-4">
                                                                                    <p className="text-sm leading-relaxed text-slate-400">
                                                                                        {photo.description}
                                                                                    </p>
                                                                                </div>
                                                                            </article>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {isManpowerSupply && (
                                                    <div className="space-y-8">
                                                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                                            <div>
                                                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300/80">
                                                                    Workforce Photo Board
                                                                </p>
                                                                <h4 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                                                                    건설현장 인부 집결 · 작업 투입 사진으로 보는 시스템 인력공급
                                                                </h4>
                                                                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
                                                                    새벽 집결, TBM 브리핑, 안전 조회, 반별 배치, 동시 투입, 외부 공정 운영까지
                                                                    건설현장 인부들이 많이 모여 있는 장면을 중심으로 {totalManpowerSupplyPhotos}장의 사진을 정리했습니다.
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                                                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">현장 집결 사진</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{manpowerAssemblyPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">작업 투입 사진</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{manpowerDeploymentPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">총 인력 사진</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{totalManpowerSupplyPhotos}컷</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
                                                            {[
                                                                {
                                                                    title: '현장 집결 사진',
                                                                    description: '현장 도착 직후 인부들이 모여 출근 확인, TBM, 안전장비 점검, 공종별 배치를 준비하는 장면을 정리했습니다.',
                                                                    accent: 'cyan',
                                                                    photos: manpowerAssemblyPhotos
                                                                },
                                                                {
                                                                    title: '작업 투입 사진',
                                                                    description: '브리핑을 마친 뒤 각 공정으로 다수 인부가 투입되어 실제 시공을 수행하는 현장 운영 장면을 정리했습니다.',
                                                                    accent: 'emerald',
                                                                    photos: manpowerDeploymentPhotos
                                                                }
                                                            ].map((section) => (
                                                                <div
                                                                    key={section.title}
                                                                    className={`rounded-[32px] border p-6 md:p-8 ${
                                                                        section.accent === 'cyan'
                                                                            ? 'border-cyan-500/25 bg-cyan-500/[0.03]'
                                                                            : 'border-emerald-500/25 bg-emerald-500/[0.03]'
                                                                    }`}
                                                                >
                                                                    <div className="mb-6">
                                                                        <h5 className="text-2xl font-black tracking-tight text-white">{section.title}</h5>
                                                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.description}</p>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                                        {section.photos.map((photo) => (
                                                                            <article
                                                                                key={photo.id}
                                                                                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
                                                                            >
                                                                                <div className="group relative">
                                                                                    <img
                                                                                        src={photo.src}
                                                                                        alt={`${photo.category} ${photo.title}`}
                                                                                        loading="lazy"
                                                                                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                                                                                    <div
                                                                                        className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${
                                                                                            section.accent === 'cyan'
                                                                                                ? 'border border-cyan-300/30 bg-cyan-500/15 text-cyan-100'
                                                                                                : 'border border-emerald-300/30 bg-emerald-500/15 text-emerald-100'
                                                                                        }`}
                                                                                    >
                                                                                        {photo.phase}
                                                                                    </div>
                                                                                    <div className="absolute bottom-4 left-4 right-4">
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
                                                                                            {photo.category}
                                                                                        </p>
                                                                                        <h6 className="mt-1 text-base font-black leading-tight text-white">
                                                                                            {photo.title}
                                                                                        </h6>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="p-4">
                                                                                    <p className="text-sm leading-relaxed text-slate-400">
                                                                                        {photo.description}
                                                                                    </p>
                                                                                </div>
                                                                            </article>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {isErpSiteManagement && (
                                                    <div className="space-y-8">
                                                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                                            <div>
                                                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-300/80">
                                                                    ERP Operations Gallery
                                                                </p>
                                                                <h4 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                                                                    ERP 현장 입력 · 통합 관제 사진으로 보는 실시간 현장관리
                                                                </h4>
                                                                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
                                                                    모바일 일보, 출역 확인, 자재 입출고, 안전 점검, 본사 대시보드, 원가 분석, 경영 리포트까지
                                                                    ERP 운영 실무에 맞는 장면을 {totalErpPhotos}장의 사진과 정보 카드로 정리했습니다.
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                                                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">현장 입력 화면</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{erpFieldPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">통합 관제 화면</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{erpControlPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">총 ERP 카드</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{totalErpPhotos}컷</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
                                                            {[
                                                                {
                                                                    title: '현장 입력 화면',
                                                                    description: '현장 소장과 반장이 직접 사용하는 모바일 입력 화면 중심으로 출역, 공수, 자재, 안전, 증빙 데이터를 정리했습니다.',
                                                                    accent: 'emerald',
                                                                    photos: erpFieldPhotos
                                                                },
                                                                {
                                                                    title: '통합 관제 화면',
                                                                    description: '본사와 관리자가 여러 현장을 한 번에 보는 대시보드, 원가 분석, 협업 승인, 경영 보고 화면 흐름을 정리했습니다.',
                                                                    accent: 'teal',
                                                                    photos: erpControlPhotos
                                                                }
                                                            ].map((section) => (
                                                                <div
                                                                    key={section.title}
                                                                    className={`rounded-[32px] border p-6 md:p-8 ${
                                                                        section.accent === 'emerald'
                                                                            ? 'border-emerald-500/25 bg-emerald-500/[0.03]'
                                                                            : 'border-teal-500/25 bg-teal-500/[0.03]'
                                                                    }`}
                                                                >
                                                                    <div className="mb-6">
                                                                        <h5 className="text-2xl font-black tracking-tight text-white">{section.title}</h5>
                                                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.description}</p>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                                        {section.photos.map((photo) => (
                                                                            <article
                                                                                key={photo.id}
                                                                                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
                                                                            >
                                                                                <div className="group relative">
                                                                                    <img
                                                                                        src={photo.src}
                                                                                        alt={`${photo.category} ${photo.title}`}
                                                                                        loading="lazy"
                                                                                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                                                                                    <div
                                                                                        className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${
                                                                                            section.accent === 'emerald'
                                                                                                ? 'border border-emerald-300/30 bg-emerald-500/15 text-emerald-100'
                                                                                                : 'border border-teal-300/30 bg-teal-500/15 text-teal-100'
                                                                                        }`}
                                                                                    >
                                                                                        {photo.phase}
                                                                                    </div>
                                                                                    <div className="absolute bottom-4 left-4 right-4">
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
                                                                                            {photo.category}
                                                                                        </p>
                                                                                        <h6 className="mt-1 text-base font-black leading-tight text-white">
                                                                                            {photo.title}
                                                                                        </h6>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="p-4">
                                                                                    <p className="text-sm leading-relaxed text-slate-400">
                                                                                        {photo.description}
                                                                                    </p>
                                                                                </div>
                                                                            </article>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {isPartnerNetwork && (
                                                    <div className="space-y-8">
                                                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                                            <div>
                                                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-teal-300/80">
                                                                    Partner Business Gallery
                                                                </p>
                                                                <h4 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                                                                    협력사 미팅 · 비즈니스 협업 사진으로 보는 파트너 네트워크
                                                                </h4>
                                                                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
                                                                    제안 미팅, 조건 협의, 계약 검토, 입찰 브리핑, 공급망 운영, 성과 리뷰, 장기 파트너십까지
                                                                    협력사 네트워크 실무와 맞는 비즈니스 장면을 {totalPartnerNetworkPhotos}장의 사진과 정보 카드로 구성했습니다.
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                                                                <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">파트너 미팅</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{partnerMeetingPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">비즈니스 협업</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{partnerBusinessPhotos.length}컷</p>
                                                                </div>
                                                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                                                    <p className="text-slate-500">총 파트너 카드</p>
                                                                    <p className="mt-1 text-lg font-black text-white">{totalPartnerNetworkPhotos}컷</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
                                                            {[
                                                                {
                                                                    title: '파트너 미팅',
                                                                    description: '신규 협력사 제안 검토, 단가 협의, 계약 검토, 입찰 설명, 등록 승인처럼 관계 형성 초기에 필요한 미팅 장면을 모았습니다.',
                                                                    accent: 'teal',
                                                                    photos: partnerMeetingPhotos
                                                                },
                                                                {
                                                                    title: '비즈니스 협업',
                                                                    description: '일정 연동, 공급망 운영, 성과 리뷰, 이슈 대응, 장기 파트너십 논의처럼 실제 거래 이후 협업 운영 장면을 정리했습니다.',
                                                                    accent: 'cyan',
                                                                    photos: partnerBusinessPhotos
                                                                }
                                                            ].map((section) => (
                                                                <div
                                                                    key={section.title}
                                                                    className={`rounded-[32px] border p-6 md:p-8 ${
                                                                        section.accent === 'teal'
                                                                            ? 'border-teal-500/25 bg-teal-500/[0.03]'
                                                                            : 'border-cyan-500/25 bg-cyan-500/[0.03]'
                                                                    }`}
                                                                >
                                                                    <div className="mb-6">
                                                                        <h5 className="text-2xl font-black tracking-tight text-white">{section.title}</h5>
                                                                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.description}</p>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                                        {section.photos.map((photo) => (
                                                                            <article
                                                                                key={photo.id}
                                                                                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
                                                                            >
                                                                                <div className="group relative">
                                                                                    <img
                                                                                        src={photo.src}
                                                                                        alt={`${photo.category} ${photo.title}`}
                                                                                        loading="lazy"
                                                                                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                                                                                    <div
                                                                                        className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${
                                                                                            section.accent === 'teal'
                                                                                                ? 'border border-teal-300/30 bg-teal-500/15 text-teal-100'
                                                                                                : 'border border-cyan-300/30 bg-cyan-500/15 text-cyan-100'
                                                                                        }`}
                                                                                    >
                                                                                        {photo.phase}
                                                                                    </div>
                                                                                    <div className="absolute bottom-4 left-4 right-4">
                                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
                                                                                            {photo.category}
                                                                                        </p>
                                                                                        <h6 className="mt-1 text-base font-black leading-tight text-white">
                                                                                            {photo.title}
                                                                                        </h6>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="p-4">
                                                                                    <p className="text-sm leading-relaxed text-slate-400">
                                                                                        {photo.description}
                                                                                    </p>
                                                                                </div>
                                                                            </article>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {!isSystemConstruction && !isMaterialRental && !isManpowerSupply && !isErpSiteManagement && !isPartnerNetwork && (
                                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                                        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700/50">
                                                            <h5 className={`text-xs font-bold text-${selectedMenu.color}-400 uppercase tracking-widest mb-4`}>Technical Data Sheet</h5>
                                                            <div className="space-y-3">
                                                                {selectedMenu.id === 'peri-dongbari' ? (
                                                                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Tracking Method</span> <span className="text-white">RFID / UHF 900MHz</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Depreciation Rate</span> <span className="text-white">15% Annually</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Quality Grading</span> <span className="text-white">A, B, C Grade ISO</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Inventory Accuracy</span> <span className="text-white">99.8% 실시간</span></p>
                                                                    </div>
                                                                ) : selectedMenu.id === 'peri-scaffolding' ? (
                                                                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Scoring Algorithm</span> <span className="text-white">V2 Experience Match</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Dispatch Latency</span> <span className="text-white">Avg. 120min</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Safety Score Weight</span> <span className="text-white">40% Priority</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Retention Rate</span> <span className="text-white">88% (LTV)</span></p>
                                                                    </div>
                                                                ) : selectedMenu.id === 'erp-site-management' ? (
                                                                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Encryption Standard</span> <span className="text-white">AES-256 GCM</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Sync Protocol</span> <span className="text-white">WebSocket / gRPC</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>DB Architecture</span> <span className="text-white">Multi-tenant Cloud</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>API Throughput</span> <span className="text-white">5k Req/sec</span></p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Vetting Index</span> <span className="text-white">D&B Credit Grade</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Matching KPI</span> <span className="text-white">Lead Time -12%</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Contract Type</span> <span className="text-white">Blockchain Smart</span></p>
                                                                        <p className="flex justify-between border-b border-slate-800 pb-1"><span>Dispute Resolve</span> <span className="text-white">Avg. 48h SLA</span></p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 bg-slate-900/80 p-6 rounded-2xl border border-slate-700/50">
                                                            <h5 className={`text-xs font-bold text-${selectedMenu.color}-400 uppercase tracking-widest mb-4`}>Performance Metrics & Logic</h5>
                                                            <div className="grid grid-cols-2 gap-8 h-full items-center">
                                                                <div className="space-y-4">
                                                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                                                        <motion.div initial={{ width: 0 }} animate={{ width: "85%" }} className={`h-full bg-${selectedMenu.color}-500`} />
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                                                        현장 데이터 집계 및 분석 로직이 백그라운드에서 실시간으로 작동 중입니다. 하드웨어 센서와 소프트웨어 에이전트 간의 동기화를 통해 현장의 모든 변수를 수치화합니다.
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                                                        <p className="text-[10px] text-slate-500 uppercase">System Integrity</p>
                                                                        <p className="text-lg font-black text-emerald-400">OPTIMAL</p>
                                                                    </div>
                                                                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                                                        <p className="text-[10px] text-slate-500 uppercase">Latency Impact</p>
                                                                        <p className="text-lg font-black text-blue-400">&lt; 12ms</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Action Button at the bottom */}
                                    <motion.div variants={revealBlockVariants} className="flex justify-center">
                                        <motion.button 
                                            onClick={() => setShowDeepDive(!showDeepDive)}
                                            whileHover={{ y: -4, scale: 1.02 }}
                                            whileTap={{ scale: 0.985 }}
                                            animate={{ boxShadow: [`0 18px 40px rgba(2,6,23,0.24)`, `0 18px 52px rgba(2,6,23,0.38)`, `0 18px 40px rgba(2,6,23,0.24)`] }}
                                            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                                            className={`px-12 py-5 bg-gradient-to-r from-${selectedMenu.color}-600 to-${selectedMenu.color}-800 text-white rounded-2xl font-black text-xl transition-all shadow-2xl shadow-${selectedMenu.color}-600/40 flex items-center justify-center gap-6 group`}
                                        >
                                            {showDeepDive ? '닫기' : '더 자세히보기'} 
                                            <FontAwesomeIcon icon={faArrowRight} className={`transition-transform duration-500 ${showDeepDive ? '-rotate-90' : 'rotate-90 group-hover:translate-y-1'}`} />
                                        </motion.button>
                                    </motion.div>
                                </motion.div>

                                {/* Close Button */}
                                <button
                                    onClick={() => setSelectedMenu(null)}
                                    className="absolute top-10 right-10 w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-700 shadow-2xl z-50 group"
                                    aria-label="닫기"
                                >
                                    <FontAwesomeIcon icon={faXmark} className="text-2xl group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Operations Grid (Pushing down when detail opens) */}
                <motion.div layout className="relative">
                    {/* Visual Divider if detail is open */}
                    <AnimatePresence>
                        {selectedMenu && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }}
                                className="w-full h-px bg-slate-700/70 mb-12" 
                            />
                        )}
                    </AnimatePresence>
                    
                    <motion.div
                        layout
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
                    >
                        {MENUS.map((menu, idx) => (
                            <ToolCard
                                key={menu.id}
                                {...menu}
                                delay={idx * 0.1}
                                isSelected={selectedMenu?.id === menu.id}
                                onClick={() => {
                                    if (selectedMenu?.id === menu.id) {
                                        setSelectedMenu(null); // Toggle off if clicked again
                                    } else {
                                        // Scroll to top smoothly so user sees the new expanded area if they clicked from bottom
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                        setSelectedMenu(menu);
                                    }
                                }}
                            />
                        ))}
                    </motion.div>
                </motion.div>

            </div>
        </div>
    );
};

export default DesignManagementPage;
