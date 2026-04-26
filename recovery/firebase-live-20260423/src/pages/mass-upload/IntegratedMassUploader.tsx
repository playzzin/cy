import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt,
    faSpinner,
    faCheckCircle,
    faExclamationTriangle,
    faFileExcel,
    faDownload,
    faTable,
    faPlay,
    faTimes,
    faBuilding,
    faUsers,
    faMapMarkerAlt,
    faUser,
    faClipboard
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReportWorker, DailyReport } from '../../services/dailyReportService';
import { dailyReportTransferService } from '../../services/dailyReportTransferService';
import { resetCollection } from '../../services/backupService';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeLooseDateText } from '../../utils/dateNormalization';
import Swal from 'sweetalert2';

interface LogItem {
    step: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    message: string;
    count?: number;
}

type SheetType = 'Company' | 'Team' | 'Site' | 'Worker' | 'DailyReport';

type MappingStatus = 'NEW' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT';

type ActionType = 'CREATE' | 'UPDATE' | 'SKIP' | 'MERGE';

type DailyReportKey = `${string}_${string}_${string}`;

type ProcessingErrorItem = {
    type: SheetType;
    key: string;
    message: string;
};

interface MappedRow {
    row: any;
    status: MappingStatus;
    existingData?: any;
    changes: string[];
    action: ActionType;
    key: string;
}

const SHEET_CONFIG: { [key in SheetType]: { name: string; icon: any; keywords: string[] } } = {
    'Company': { name: '회사', icon: faBuilding, keywords: ['회사'] },
    'Team': { name: '팀', icon: faUsers, keywords: ['팀'] },
    'Site': { name: '현장', icon: faMapMarkerAlt, keywords: ['현장'] },
    'Worker': { name: '작업자', icon: faUser, keywords: ['작업자'] },
    'DailyReport': { name: '출력일보', icon: faClipboard, keywords: ['출력일보', 'Report'] }
};

const formatExcelDate = (val: any): string => {
    return normalizeLooseDateText(val);
};

type TemplateSheetType = 'Company' | 'Team' | 'Site' | 'Worker' | 'DailyReport';

type TemplateField = {
    label: string;
    required?: boolean;
    aliases: string[];
    example: string;
    description: string;
    allowedValues?: string[];
};

const TEMPLATE_FIELDS: Record<TemplateSheetType, { sheetName: string; fields: TemplateField[] }> = {
    Company: {
        sheetName: '회사',
        fields: [
            { label: '회사명', required: true, aliases: ['상호', '업체명'], example: '(주)청연ENG', description: '회사(거래처) 이름 (중복 체크 기준)' },
            { label: '구분', aliases: [], example: '시공사', description: '회사 구분 (시공사/발주사/협력사 등)', allowedValues: ['시공사', '발주사', '협력사', '건설사', '기타'] },
            { label: '대표자', aliases: [], example: '김대한', description: '대표자 성명' },
            { label: '사업자번호', aliases: [], example: '123-45-67890', description: '사업자등록번호 (하이픈 포함 가능)' },
            { label: '주소', aliases: [], example: '서울시 강남구 테헤란로 123', description: '회사 주소' },
            { label: '연락처', aliases: ['전화번호', '대표전화'], example: '02-1234-5678', description: '회사 연락처' }
        ]
    },
    Team: {
        sheetName: '팀',
        fields: [
            { label: '팀명', required: true, aliases: [], example: '1공구팀', description: '팀 이름 (중복 체크 기준)' },
            { label: '회사명', aliases: ['소속회사'], example: '(주)대한건설', description: '팀 소속 회사명 (회사 시트와 연결, 선택)' },
            { label: '팀장명', aliases: ['팀장'], example: '김팀장', description: '팀장 성명 (작업자 시트와 매칭 시 자동 팀장 연결)' },
            { label: '직종', aliases: [], example: '철근', description: '주요 직종/공종' }
        ]
    },
    Site: {
        sheetName: '현장',
        fields: [
            { label: '현장명', required: true, aliases: ['현장', '공사명'], example: '강남역 복합개발', description: '현장/프로젝트 이름 (중복 체크 기준)' },
            { label: '발주사', aliases: ['발주처'], example: '삼성엔지니어링', description: '발주사명 (회사 DB와 매칭)' },
            { label: '시공사', aliases: ['건설사', '회사명'], example: '(주)청연ENG', description: '시공사명 (회사 DB와 매칭)' },
            { label: '협력사', aliases: ['협력업체', '파트너'], example: '다원파트너스', description: '협력사명 (회사 DB와 매칭)' },
            { label: '해당팀', aliases: ['현장담당'], example: '1공구팀', description: '현장 담당 팀명. 코드상 "해당팀" 또는 "현장담당"을 읽음' },
            { label: '발주사연락처', aliases: ['발주처연락처', '발주사전화번호', '발주처전화번호', '발주사대표전화', '발주처대표전화'], example: '02-1111-2222', description: '발주사 연락처 (회사 연락처 보강용, 선택)' },
            { label: '시공사연락처', aliases: ['건설사연락처', '회사연락처', '시공사전화번호', '건설사전화번호', '회사전화번호', '시공사대표전화', '건설사대표전화', '회사대표전화'], example: '02-3333-4444', description: '시공사 연락처 (회사 연락처 보강용, 선택)' },
            { label: '협력사연락처', aliases: ['협력업체연락처', '파트너연락처', '협력사전화번호', '협력업체전화번호', '파트너전화번호', '협력사대표전화', '협력업체대표전화', '파트너대표전화'], example: '031-555-6666', description: '협력사 연락처 (회사 연락처 보강용, 선택)' },
            { label: '현장코드', aliases: [], example: 'GN-001', description: '현장 내부 코드 (선택)' },
            { label: '주소', aliases: [], example: '서울시 강남구 역삼동 123', description: '현장 주소 (선택)' },
            { label: '착공일', aliases: [], example: '2024-01-01', description: '착공일 (YYYY-MM-DD 권장, Excel 날짜도 가능)' },
            { label: '준공일', aliases: [], example: '2024-12-31', description: '준공일 (YYYY-MM-DD 권장, Excel 날짜도 가능)' },
            { label: '현장구분', aliases: ['구분', '현장유형'], example: '도급', description: '현장 구분', allowedValues: ['도급', '직영', '지원'] },
            { label: '결제구분', aliases: ['결제방식', 'paymentType', 'paymentMethod'], example: '계산서', description: '결제 구분', allowedValues: ['계산서', '노무'] }
        ]
    },
    Worker: {
        sheetName: '작업자',
        fields: [
            { label: '이름', required: true, aliases: ['성명', '작업자명'], example: '홍길동', description: '작업자 성명 (중복 체크 기준)' },
            { label: '소속팀', aliases: ['팀명', '팀'], example: '1공구팀', description: '소속 팀명 (팀 시트와 연결). 별칭: 팀명/팀' },
            { label: '회사명', aliases: ['소속회사'], example: '삼성엔지니어링', description: '소속 회사명 (회사 시트와 연결). 별칭: 소속회사' },
            { label: '직종', aliases: ['역할'], example: '철근', description: '직종/역할. 코드상 직종 또는 역할을 읽음' },
            { label: '연락처', aliases: ['휴대폰'], example: '010-1234-5678', description: '연락처. 코드상 연락처 또는 휴대폰을 읽음' },
            { label: '주민번호', aliases: [], example: '900101-1234567', description: '민감정보(선택). 정확한 형식으로만 입력(마스킹 입력 금지 권장)' },
            { label: '주소', aliases: [], example: '서울시 강남구 역삼동 123', description: '주소(선택)' },
            { label: '단가', aliases: ['일당', '임금', '급여'], example: '180000', description: '단가/일당/임금/급여 중 하나로 입력 가능. 숫자만 입력 권장' },
            { label: '급여방식', aliases: ['구분', '급여구분', '급여형태', '급여모델'], example: '일급제', description: '급여 방식', allowedValues: ['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'] },
            { label: '은행명', aliases: ['은행', 'bankName', 'bank'], example: '국민은행', description: '은행명(선택)' },
            { label: '계좌번호', aliases: ['계좌', '계좌번호(숫자)', 'accountNumber', 'account', 'accountNo', 'account_number'], example: '123-456-789012', description: '계좌번호(선택)' },
            { label: '예금주', aliases: ['예금주명', '계좌주', 'accountHolder', 'holder'], example: '홍길동', description: '예금주(선택)' },
            { label: '팀구분', aliases: [], example: '일용직', description: '팀 구분(선택). 작업자 생성 시 teamType으로 저장' }
        ]
    },
    DailyReport: {
        sheetName: '출력일보',
        fields: [
            { label: '날짜', required: true, aliases: ['작업일'], example: '2024-01-15', description: '날짜. 코드상 "날짜" 또는 "작업일"을 읽음' },
            { label: '현장명', required: true, aliases: ['현장'], example: '강남역 복합개발', description: '현장명. 코드상 "현장명" 또는 "현장"을 읽음' },
            { label: '팀명', required: true, aliases: ['팀'], example: '1공구팀', description: '팀명. 코드상 "팀명" 또는 "팀"을 읽음' },
            { label: '해당팀', aliases: ['현장담당'], example: '1공구팀', description: '현장 책임팀 (선택, 누락 현장 자동 생성 시 사용)' },
            { label: '이름', required: true, aliases: ['성명', '작업자명'], example: '홍길동', description: '작업자명. 코드상 "이름"을 사용' },
            { label: '공수', required: true, aliases: [], example: '1.0', description: '공수. 없으면 기본 1.0 처리' },
            { label: '직종', aliases: ['역할'], example: '철근', description: '직종 (선택). 없으면 작업자 기본 직종 사용' },
            { label: '단가', aliases: ['일당', '임금', '급여'], example: '180000', description: '단가 (선택). 없으면 작업자 기본 단가 사용' },
            { label: '급여방식', aliases: ['구분', '급여구분', '급여형태'], example: '일급제', description: '급여 구분 (선택). 없으면 작업자 기본 구분 사용' },
            { label: '현장구분', aliases: ['siteType'], example: '도급', description: '일보 레벨 현장구분 (선택)', allowedValues: ['도급', '직영', '지원'] },
            { label: '결제구분', aliases: ['결제방식', 'paymentType'], example: '계산서', description: '일보 레벨 결제구분 (선택)', allowedValues: ['계산서', '노무'] },
            { label: '작업내용', aliases: [], example: '철근 배근 작업', description: '작업 내용 (선택)' }
        ]
    }
};

const TEMPLATE_SAMPLE_ROWS: Record<TemplateSheetType, Array<Record<string, string>>> = {
    Company: [
        { 회사명: '(주)청연ENG', 구분: '시공사', 대표자: '김청연', 사업자번호: '123-45-67890', 주소: '서울시 강남구 테헤란로 101', 연락처: '02-1111-2222' },
        { 회사명: '삼성엔지니어링', 구분: '발주사', 대표자: '이엔지', 사업자번호: '234-56-78901', 주소: '서울시 서초구 서초대로 88', 연락처: '02-3333-4444' },
        { 회사명: '다원파트너스', 구분: '협력사', 대표자: '박다원', 사업자번호: '345-67-89012', 주소: '경기도 성남시 분당구 판교로 123', 연락처: '031-555-6666' }
    ],
    Team: [
        { 팀명: '1공구팀', 회사명: '(주)청연ENG', 팀장명: '김철수', 직종: '철근' },
        { 팀명: '형틀반', 회사명: '(주)청연ENG', 팀장명: '이영희', 직종: '형틀' }
    ],
    Site: [
        {
            현장명: '강남역 복합개발',
            발주사: '삼성엔지니어링',
            시공사: '(주)청연ENG',
            협력사: '다원파트너스',
            해당팀: '1공구팀',
            발주사연락처: '02-3333-4444',
            시공사연락처: '02-1111-2222',
            협력사연락처: '031-555-6666',
            현장코드: 'GN-001',
            주소: '서울시 강남구 역삼동 123',
            착공일: '2024-01-01',
            준공일: '2024-12-31',
            현장구분: '도급',
            결제구분: '계산서'
        },
        {
            현장명: '판교 테크노밸리 2단계',
            발주사: '삼성엔지니어링',
            시공사: '(주)청연ENG',
            협력사: '다원파트너스',
            해당팀: '형틀반',
            발주사연락처: '02-3333-4444',
            시공사연락처: '02-1111-2222',
            협력사연락처: '031-555-6666',
            현장코드: 'PG-002',
            주소: '경기도 성남시 분당구 판교로 256',
            착공일: '2024-03-01',
            준공일: '2025-06-30',
            현장구분: '직영',
            결제구분: '노무'
        }
    ],
    Worker: [
        {
            이름: '김철수',
            소속팀: '1공구팀',
            회사명: '(주)청연ENG',
            직종: '반장',
            연락처: '010-1234-5678',
            주민번호: '900101-1234567',
            주소: '서울시 강남구 역삼동 12',
            단가: '180000',
            급여방식: '일급제',
            은행명: '국민은행',
            계좌번호: '111-222-333333',
            예금주: '김철수',
            팀구분: '일용직'
        },
        {
            이름: '이영희',
            소속팀: '형틀반',
            회사명: '(주)청연ENG',
            직종: '기공',
            연락처: '010-2222-3333',
            주민번호: '920202-2345678',
            주소: '경기도 성남시 분당구 정자동 45',
            단가: '220000',
            급여방식: '월급제',
            은행명: '신한은행',
            계좌번호: '444-555-666666',
            예금주: '이영희',
            팀구분: '정규직'
        }
    ],
    DailyReport: [
        {
            날짜: '2024-01-15',
            현장명: '강남역 복합개발',
            팀명: '1공구팀',
            해당팀: '1공구팀',
            이름: '김철수',
            공수: '1.0',
            직종: '반장',
            단가: '180000',
            급여방식: '일급제',
            현장구분: '도급',
            결제구분: '계산서',
            작업내용: '철근 배근 작업'
        },
        {
            날짜: '2024-01-15',
            현장명: '판교 테크노밸리 2단계',
            팀명: '형틀반',
            해당팀: '형틀반',
            이름: '이영희',
            공수: '1.0',
            직종: '기공',
            단가: '220000',
            급여방식: '월급제',
            현장구분: '직영',
            결제구분: '노무',
            작업내용: '형틀 설치'
        }
    ]
};

const TEMPLATE_SAMPLE_LIMIT = 6;

const OPERATION_FLOW_ROWS: Array<Record<string, string>> = [
    {
        단계: '1. 기준 데이터 준비',
        작업: 'Company/Site/Team/Worker 시트 작성',
        핵심포인트: '현장명, 회사명, 팀명은 오탈자 없이 고정 키로 관리',
        검증위치: '/mass-upload/integrated'
    },
    {
        단계: '2. 기준 데이터 업로드',
        작업: '통합 업로더에서 미리보기 후 CREATE/UPDATE 확인',
        핵심포인트: 'Site 시트의 발주사/시공사/협력사, 해당팀 매핑 확인',
        검증위치: '/database/manpower-db'
    },
    {
        단계: '3. 운영 일보 업로드',
        작업: 'DailyReport 시트 또는 일보 전용 업로더로 증분 반영',
        핵심포인트: '날짜+현장명+팀명 그룹 기준으로 merge/overwrite 정책 적용',
        검증위치: '/reports/daily?tab=list-v2'
    },
    {
        단계: '4. 사후 검증',
        작업: '필터로 데이터 누락/중복/오입력 점검',
        핵심포인트: '현장구분/결제구분/해당팀/소속팀 필터 교차 검증',
        검증위치: '/reports/daily?tab=list-v2'
    }
];

const UPLOAD_CHECKLIST_ROWS: Array<Record<string, string>> = [
    {
        구분: '업로드 전',
        체크항목: '회사명 정규화(띄어쓰기/특수문자/법인표기)',
        성공기준: '같은 회사가 서로 다른 이름으로 중복되지 않음',
        비고: '예: (주)청연ENG / 청연ENG 통일'
    },
    {
        구분: '업로드 전',
        체크항목: '현장구분/결제구분 값 검증',
        성공기준: '현장구분=도급/직영/지원, 결제구분=계산서/노무만 사용',
        비고: '미허용 값은 INVALID 처리'
    },
    {
        구분: '업로드 중',
        체크항목: '미리보기 상태 확인',
        성공기준: 'CONFLICT/INVALID는 0건 또는 사유 확인 후 진행',
        비고: '충돌 건은 행별 원인 확인'
    },
    {
        구분: '업로드 후',
        체크항목: '통합DB 현장목록 검증',
        성공기준: '발주사/시공사/협력사/해당팀/현장구분/결제구분 정상 반영',
        비고: '/database/manpower-db'
    },
    {
        구분: '업로드 후',
        체크항목: '일보 목록 v2 검증',
        성공기준: '날짜/현장/해당팀/소속팀 필터에서 누락 없이 조회',
        비고: '/reports/daily?tab=list-v2'
    },
    {
        구분: '업로드 후',
        체크항목: '재처리 판단',
        성공기준: '오류 행만 수정 후 재업로드, 전체 재업로드는 최소화',
        비고: 'overwrite는 정정 배치에서만 사용 권장'
    }
];

const ERROR_CODE_ROWS: Array<Record<string, string>> = [
    {
        코드: 'E-REQUIRED',
        유형: '필수값 누락',
        설명: '필수 컬럼(예: 날짜/현장명/팀명/이름)이 비어 있음',
        원인: '원본 파일 누락 또는 헤더 오타',
        조치: '가이드 시트 컬럼명에 맞춰 값 보완 후 재업로드'
    },
    {
        코드: 'E-REF-SITE',
        유형: '참조 누락(현장)',
        설명: '일보 행의 현장명이 DB/현장시트에 없음',
        원인: '현장 선등록 누락 또는 현장명 불일치',
        조치: '현장 시트 먼저 반영하거나 자동생성 허용 후 재시도'
    },
    {
        코드: 'E-REF-TEAM',
        유형: '참조 누락(팀)',
        설명: '일보 행의 팀명이 DB/팀시트에 없음',
        원인: '팀 선등록 누락/오탈자',
        조치: '팀 시트 반영 후 재업로드'
    },
    {
        코드: 'E-REF-WORKER',
        유형: '참조 누락(작업자)',
        설명: '일보 행의 작업자가 DB/작업자시트에 없음',
        원인: '작업자 선등록 누락/이름 불일치',
        조치: '작업자 시트 반영 또는 자동생성 정책에 따라 처리'
    },
    {
        코드: 'E-VALUE-SITETYPE',
        유형: '값 형식 오류',
        설명: '현장구분 허용값 외 입력',
        원인: '도급/직영/지원 외 임의값 사용',
        조치: '허용값으로 정규화'
    },
    {
        코드: 'E-VALUE-PAYMENT',
        유형: '값 형식 오류',
        설명: '결제구분 허용값 외 입력',
        원인: '계산서/노무 외 임의값 사용',
        조치: '허용값으로 정규화'
    },
    {
        코드: 'E-CONFLICT',
        유형: '충돌',
        설명: '기존 데이터와 매핑 충돌로 자동 판단 불가',
        원인: '동일 키에 상이한 참조값 존재',
        조치: '충돌행 수동 정리 후 merge 또는 overwrite 선택'
    }
];

const buildTemplateSampleRowsFromDb = async (): Promise<Partial<Record<TemplateSheetType, Array<Record<string, string>>>>> => {
    const [companiesRes, teamsRes, sitesRes, workersRes, reportsRes] = await Promise.allSettled([
        companyService.getCompanies(),
        teamService.getTeams(),
        siteService.getSites(),
        manpowerService.getWorkers(),
        dailyReportService.getAllReports()
    ]);

    const companies = companiesRes.status === 'fulfilled' ? companiesRes.value : [];
    const teams = teamsRes.status === 'fulfilled' ? teamsRes.value : [];
    const sites = sitesRes.status === 'fulfilled' ? sitesRes.value : [];
    const workers = workersRes.status === 'fulfilled' ? workersRes.value : [];
    const reports = reportsRes.status === 'fulfilled' ? reportsRes.value : [];

    const companyRows = companies.slice(0, TEMPLATE_SAMPLE_LIMIT).map((c: Company) => ({
        회사명: getCellString(c.name),
        구분: getCellString(c.type),
        대표자: getCellString(c.ceoName),
        사업자번호: getCellString(c.businessNumber),
        주소: getCellString(c.address),
        연락처: getCellString(c.phone)
    }));

    const teamRows = teams.slice(0, TEMPLATE_SAMPLE_LIMIT).map((t: Team) => ({
        팀명: getCellString(t.name),
        회사명: getCellString(t.companyName),
        팀장명: getCellString(t.leaderName),
        직종: getCellString(t.role)
    }));

    const siteRows = sites.slice(0, TEMPLATE_SAMPLE_LIMIT).map((s: Site) => ({
        현장명: getCellString(s.name),
        발주사: getCellString(s.clientCompanyName),
        시공사: getCellString(s.companyName),
        협력사: getCellString(s.partnerName),
        해당팀: getCellString(s.responsibleTeamName),
        발주사연락처: '',
        시공사연락처: '',
        협력사연락처: '',
        현장코드: getCellString(s.code),
        주소: getCellString(s.address),
        착공일: getCellString(s.startDate),
        준공일: getCellString(s.endDate),
        현장구분: getCellString(s.siteType),
        결제구분: getCellString(s.paymentMethod)
    }));

    const workerRows = workers.slice(0, TEMPLATE_SAMPLE_LIMIT).map((w: Worker) => ({
        이름: getCellString(w.name),
        소속팀: getCellString(w.teamName),
        회사명: getCellString(w.companyName),
        직종: getCellString(w.role),
        연락처: getCellString(w.contact),
        주민번호: getCellString(w.idNumber),
        주소: getCellString(w.address),
        단가: getCellString(w.unitPrice),
        급여방식: getCellString(w.payType || w.salaryModel),
        은행명: getCellString(w.bankName),
        계좌번호: getCellString(w.accountNumber),
        예금주: getCellString(w.accountHolder),
        팀구분: getCellString(w.teamType)
    }));

    const dailyRows: Array<Record<string, string>> = [];
    for (const report of reports) {
        if (dailyRows.length >= TEMPLATE_SAMPLE_LIMIT) break;
        const workersInReport = Array.isArray(report.workers) ? report.workers : [];
        for (const worker of workersInReport) {
            if (dailyRows.length >= TEMPLATE_SAMPLE_LIMIT) break;
            dailyRows.push({
                날짜: getCellString(report.date),
                현장명: getCellString(report.siteName),
                팀명: getCellString(report.teamName),
                해당팀: getCellString(report.responsibleTeamName || report.teamName),
                이름: getCellString(worker.name),
                공수: getCellString(worker.manDay),
                직종: getCellString(worker.role),
                단가: getCellString(worker.unitPrice),
                급여방식: getCellString(worker.payType || worker.salaryModel),
                현장구분: getCellString(worker.siteType || report.siteType),
                결제구분: getCellString(worker.paymentType || report.paymentType),
                작업내용: getCellString(worker.workContent || report.workContent)
            });
        }
    }

    return {
        Company: companyRows,
        Team: teamRows,
        Site: siteRows,
        Worker: workerRows,
        DailyReport: dailyRows
    };
};

const buildSheetColumnWidths = (headers: string[]): { wch: number }[] => {
    return headers.map((h) => ({ wch: Math.min(40, Math.max(12, (h || '').length * 2 + 4)) }));
};

const downloadIntegratedTemplateExcel = async (): Promise<void> => {
    const wb = XLSX.utils.book_new();
    let dbSampleRows: Partial<Record<TemplateSheetType, Array<Record<string, string>>>> = {};

    try {
        dbSampleRows = await buildTemplateSampleRowsFromDb();
    } catch (error) {
        console.warn('[IntegratedMassUploader] Failed to load DB samples, fallback to static template rows.', error);
    }

    // Guide sheet
    const guideHeader = ['시트', '항목', '필수', '허용값', '별칭(aliases)', '예시', '설명'];
    const guideRows: Array<Record<string, string>> = [];
    (Object.keys(TEMPLATE_FIELDS) as TemplateSheetType[]).forEach((sheetType) => {
        const { sheetName, fields } = TEMPLATE_FIELDS[sheetType];
        fields.forEach((f) => {
            guideRows.push({
                [guideHeader[0]]: sheetName,
                [guideHeader[1]]: f.label,
                [guideHeader[2]]: f.required ? 'Y' : 'N',
                [guideHeader[3]]: (f.allowedValues ?? []).join('/'),
                [guideHeader[4]]: (f.aliases ?? []).join(', '),
                [guideHeader[5]]: f.example,
                [guideHeader[6]]: f.description
            });
        });
    });
    const guideWs = XLSX.utils.json_to_sheet(guideRows, { header: guideHeader });
    guideWs['!cols'] = buildSheetColumnWidths(guideHeader);
    XLSX.utils.book_append_sheet(wb, guideWs, '가이드');

    const flowHeader = ['단계', '작업', '핵심포인트', '검증위치'];
    const flowWs = XLSX.utils.json_to_sheet(OPERATION_FLOW_ROWS, { header: flowHeader });
    flowWs['!cols'] = buildSheetColumnWidths(flowHeader);
    XLSX.utils.book_append_sheet(wb, flowWs, '운영플로우');

    const checklistHeader = ['구분', '체크항목', '성공기준', '비고'];
    const checklistWs = XLSX.utils.json_to_sheet(UPLOAD_CHECKLIST_ROWS, { header: checklistHeader });
    checklistWs['!cols'] = buildSheetColumnWidths(checklistHeader);
    XLSX.utils.book_append_sheet(wb, checklistWs, '체크리스트');

    const errorHeader = ['코드', '유형', '설명', '원인', '조치'];
    const errorWs = XLSX.utils.json_to_sheet(ERROR_CODE_ROWS, { header: errorHeader });
    errorWs['!cols'] = buildSheetColumnWidths(errorHeader);
    XLSX.utils.book_append_sheet(wb, errorWs, '오류코드');

    const buildSampleRowsForFields = (fields: TemplateField[], count = TEMPLATE_SAMPLE_LIMIT): Array<Record<string, string>> => {
        const rows: Array<Record<string, string>> = [];
        for (let idx = 0; idx < count; idx += 1) {
            const row: Record<string, string> = {};
            fields.forEach((f) => {
                const base = f.example ?? '';
                if (idx === 0) {
                    row[f.label] = base;
                    return;
                }
                if (f.label.includes('날짜') || f.label.includes('착공일') || f.label.includes('준공일')) {
                    row[f.label] = base;
                    return;
                }
                if (f.label.includes('공수')) {
                    row[f.label] = idx % 2 === 0 ? '1.0' : '0.5';
                    return;
                }
                if (f.label.includes('단가')) {
                    row[f.label] = String(180000 + (idx * 10000));
                    return;
                }
                row[f.label] = base ? `${base}_${idx + 1}` : '';
            });
            rows.push(row);
        }
        return rows;
    };

    (Object.keys(TEMPLATE_FIELDS) as TemplateSheetType[]).forEach((sheetType) => {
        const { sheetName, fields } = TEMPLATE_FIELDS[sheetType];
        const headers = fields.map((f) => f.label);
        const fallbackRows = TEMPLATE_SAMPLE_ROWS[sheetType] ?? buildSampleRowsForFields(fields);
        const selectedRows = [
            ...(dbSampleRows[sheetType] ?? []),
            ...fallbackRows
        ].slice(0, TEMPLATE_SAMPLE_LIMIT);
        const rows = selectedRows.map((sample) => {
            const normalized: Record<string, string> = {};
            headers.forEach((h) => {
                normalized[h] = getCellString((sample as any)?.[h]);
            });
            return normalized;
        });
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        ws['!cols'] = buildSheetColumnWidths(headers);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const ymd = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `integrated_mass_upload_template_${ymd}.xlsx`);
};

type PreviewRowStatus = 'OK' | 'INVALID' | 'DUPLICATE' | 'SKIP';

type PreviewAnnotatedRow = {
    row: any;
    status: PreviewRowStatus;
    reasons: string[];
    key: string;
};

const getCellString = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    return String(val).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
};

const normalizeExcelHeaderKey = (key: string): string => {
    return String(key).replace(/\s+/g, '').trim();
};

const normalizeExcelRowKeys = (row: unknown): any => {
    if (!row || typeof row !== 'object') return row;
    const out: Record<string, unknown> = {};
    Object.entries(row as Record<string, unknown>).forEach(([k, v]) => {
        const nk = normalizeExcelHeaderKey(k);
        if (!nk) return;
        if (/^__EMPTY/i.test(nk)) return;
        if (!(nk in out)) {
            out[nk] = v;
            return;
        }
        const prev = out[nk];
        const prevEmpty = prev === undefined || prev === null || prev === '';
        const nextEmpty = v === undefined || v === null || v === '';
        if (prevEmpty && !nextEmpty) out[nk] = v;
    });
    return out;
};

const getPayTypeFromRow = (row: any): string => {
    if (!row || typeof row !== 'object') return '';

    const direct = getCellString(
        (row as any)?.['급여방식']
        ?? (row as any)?.['구분']
        ?? (row as any)?.['급여구분']
        ?? (row as any)?.['급여형태']
        ?? (row as any)?.['급여모델']
    );
    if (direct) return direct;

    // 일부 엑셀은 급여 컬럼에 숫자(단가)가 아니라 "일급제/월급제" 같은 텍스트를 넣는 경우가 있음
    const maybePayType = getCellString((row as any)?.['급여']);
    if (!maybePayType) return '';
    const numericOnly = maybePayType.replace(/[,\s]/g, '').match(/^\d+$/);
    if (numericOnly) return '';

    return maybePayType;
};

const normalizeSiteTypeValue = (value: unknown): Site['siteType'] | undefined => {
    const raw = getCellString(value).replace(/\s+/g, '');
    if (!raw) return undefined;
    if (raw.includes('도급')) return '도급';
    if (raw.includes('직영')) return '직영';
    if (raw.includes('지원')) return '지원';
    return undefined;
};

const normalizePaymentMethodValue = (value: unknown): Site['paymentMethod'] | undefined => {
    const raw = getCellString(value).replace(/\s+/g, '');
    if (!raw) return undefined;
    if (raw.includes('계산서') || raw.includes('세금계산서')) return '계산서';
    if (raw.includes('노무')) return '노무';
    return undefined;
};

const getCellByHeaderIncludes = (row: any, includes: string[]): unknown => {
    if (!row || typeof row !== 'object') return undefined;
    const normalizedIncludes = includes.map((s) => normalizeExcelHeaderKey(s));
    for (const [rawKey, value] of Object.entries(row as Record<string, unknown>)) {
        const key = normalizeExcelHeaderKey(rawKey);
        if (!key) continue;
        if (normalizedIncludes.some((needle) => key.includes(needle))) {
            return value;
        }
    }
    return undefined;
};

const getWorkerBankNameFromRow = (row: any): string => {
    const direct = getCellString(
        row?.['은행명']
        ?? row?.['은행']
        ?? row?.['bankName']
        ?? row?.['bank']
    );
    if (direct) return direct;

    return getCellString(getCellByHeaderIncludes(row, ['은행명', '은행', 'bankName', 'bank']));
};

const getWorkerAccountNumberFromRow = (row: any): string => {
    const direct = getCellString(
        row?.['계좌번호']
        ?? row?.['계좌']
        ?? row?.['계좌번호(숫자)']
        ?? row?.['accountNumber']
        ?? row?.['account']
        ?? row?.['accountNo']
        ?? row?.['account_number']
    );
    if (direct) return direct.replace(/\s+/g, '');

    const guessed = getCellByHeaderIncludes(row, [
        '계좌번호',
        '계좌',
        '계좌번호(숫자)',
        'accountNumber',
        'account',
        'accountNo',
        'account_number'
    ]);
    return getCellString(guessed).replace(/\s+/g, '');
};

const getWorkerAccountHolderFromRow = (row: any): string => {
    const direct = getCellString(
        row?.['예금주']
        ?? row?.['예금주명']
        ?? row?.['계좌주']
        ?? row?.['accountHolder']
        ?? row?.['holder']
    );
    if (direct) return direct;

    return getCellString(getCellByHeaderIncludes(row, ['예금주', '예금주명', '계좌주', 'accountHolder', 'holder']));
};

const getSiteTypeRawFromSiteRow = (row: any): unknown => (
    row?.['현장구분']
    ?? row?.['현장현장구분']
    ?? row?.['구분']
    ?? row?.['현장유형']
    ?? row?.['siteType']
    ?? getCellByHeaderIncludes(row, ['현장구분', 'siteType'])
);

const getPaymentMethodRawFromSiteRow = (row: any): unknown => (
    row?.['결제구분']
    ?? row?.['결제결제구분']
    ?? row?.['결제방식']
    ?? row?.['paymentType']
    ?? row?.['paymentMethod']
    ?? getCellByHeaderIncludes(row, ['결제구분', '결제방식', 'paymentType', 'paymentMethod'])
);

const getSiteTypeRawFromDailyRow = (row: any): unknown => (
    row?.['현장구분']
    ?? row?.['현장현장구분']
    ?? row?.['siteType']
    ?? getCellByHeaderIncludes(row, ['현장구분', 'siteType'])
);

const getPaymentMethodRawFromDailyRow = (row: any): unknown => (
    row?.['결제구분']
    ?? row?.['결제결제구분']
    ?? row?.['결제방식']
    ?? row?.['paymentType']
    ?? row?.['paymentMethod']
    ?? getCellByHeaderIncludes(row, ['결제구분', '결제방식', 'paymentType', 'paymentMethod'])
);

const getFirstNormalizedSiteTypeFromRows = (rows: any[]): Site['siteType'] | undefined => {
    for (const row of rows ?? []) {
        const normalized = normalizeSiteTypeValue(getSiteTypeRawFromDailyRow(row));
        if (normalized) return normalized;
    }
    return undefined;
};

const getFirstNormalizedPaymentMethodFromRows = (rows: any[]): Site['paymentMethod'] | undefined => {
    for (const row of rows ?? []) {
        const normalized = normalizePaymentMethodValue(getPaymentMethodRawFromDailyRow(row));
        if (normalized) return normalized;
    }
    return undefined;
};

const getUnitPriceFromRow = (row: any): number | undefined => {
    if (!row || typeof row !== 'object') return undefined;

    const aliases = ['단가', '단가(원)', '단가(숫자)', '단가(원/일)', '단가(세전)', '일당', '임금', '급여'] as const;

    let raw: unknown = undefined;
    for (const key of aliases) {
        const v = (row as any)?.[key];
        if (v !== undefined && v !== null && v !== '') {
            raw = v;
            break;
        }
    }

    if (raw === undefined) {
        const normalizeHeaderKey = (key: string): string => key.replace(/\s+/g, '').trim();
        const normalizedAliases = new Set(aliases.map((a) => normalizeHeaderKey(a)));

        for (const k of Object.keys(row)) {
            if (!k) continue;
            const nk = normalizeHeaderKey(k);
            if (!nk) continue;
            if (!normalizedAliases.has(nk)) continue;
            const v = (row as any)?.[k];
            if (v !== undefined && v !== null && v !== '') {
                raw = v;
                break;
            }
        }
    }

    const text = getCellString(raw);
    if (text === '') return undefined;

    const parsed = Number(text.replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
};

type PreviewAnalyzeContext = {
    existingTeamNames: Set<string>;
    fileTeamNames: Set<string>;
    existingSiteNames: Set<string>;
    fileSiteNames: Set<string>;
    existingWorkerNames: Set<string>;
    fileWorkerNames: Set<string>;
};

const buildPreviewAnalyzeContext = async (data: { [key in SheetType]: any[] }): Promise<PreviewAnalyzeContext> => {
    const fileTeamNames = new Set<string>();
    (data.Team ?? []).forEach((row: any) => {
        const n = getCellString(row?.['팀명']);
        if (n) fileTeamNames.add(n);
    });

    const fileSiteNames = new Set<string>();
    (data.Site ?? []).forEach((row: any) => {
        const n = getCellString(row?.['현장'] ?? row?.['현장명']);
        if (n) fileSiteNames.add(n);
    });

    const fileWorkerNames = new Set<string>();
    (data.Worker ?? []).forEach((row: any) => {
        const n = getCellString(row?.['이름'] ?? row?.['성명']);
        if (n) fileWorkerNames.add(n);
    });

    const existingTeamNames = new Set<string>();
    try {
        const teams = await teamService.getTeams();
        teams.forEach((t) => {
            const n = getCellString((t as any)?.name);
            if (n) existingTeamNames.add(n);
        });
    } catch {
        // ignore
    }

    const existingSiteNames = new Set<string>();
    try {
        const sites = await siteService.getSites();
        sites.forEach((s) => {
            const n = getCellString((s as any)?.name);
            if (n) existingSiteNames.add(n);
        });
    } catch {
        // ignore
    }

    const existingWorkerNames = new Set<string>();
    try {
        const workers = await manpowerService.getWorkers();
        workers.forEach((w) => {
            const n = getCellString((w as any)?.name);
            if (n) existingWorkerNames.add(n);
        });
    } catch {
        // ignore
    }

    return { existingTeamNames, fileTeamNames, existingSiteNames, fileSiteNames, existingWorkerNames, fileWorkerNames };
};

const analyzeSheetRows = (type: SheetType, rows: any[], ctx: PreviewAnalyzeContext): PreviewAnnotatedRow[] => {
    const base: PreviewAnnotatedRow[] = rows.map((row) => {
        const reasons: string[] = [];

        if (type === 'Company') {
            const companyName = getCellString(row?.['회사명'] ?? row?.['상호']);
            if (!companyName) reasons.push('회사명/상호 누락');
            return { row, status: reasons.length ? 'INVALID' : 'OK', reasons, key: companyName };
        }

        if (type === 'Team') {
            const teamName = getCellString(row?.['팀명']);
            if (!teamName) reasons.push('팀명 누락');
            return { row, status: reasons.length ? 'INVALID' : 'OK', reasons, key: teamName };
        }

        if (type === 'Site') {
            const siteName = getCellString(row?.['현장'] ?? row?.['현장명']);
            if (!siteName) reasons.push('현장/현장명 누락');
            const siteTypeRaw = getCellString(getSiteTypeRawFromSiteRow(row));
            const paymentMethodRaw = getCellString(getPaymentMethodRawFromSiteRow(row));
            if (siteTypeRaw && !normalizeSiteTypeValue(siteTypeRaw)) {
                reasons.push(`현장구분 값 오류: ${siteTypeRaw} (허용: 도급/직영/지원)`);
            }
            if (paymentMethodRaw && !normalizePaymentMethodValue(paymentMethodRaw)) {
                reasons.push(`결제구분 값 오류: ${paymentMethodRaw} (허용: 계산서/노무)`);
            }
            return { row, status: reasons.length ? 'INVALID' : 'OK', reasons, key: siteName };
        }

        if (type === 'Worker') {
            const workerName = getCellString(row?.['이름'] ?? row?.['성명']);
            if (!workerName) reasons.push('이름/성명 누락');
            return { row, status: reasons.length ? 'INVALID' : 'OK', reasons, key: workerName };
        }

        // DailyReport
        const date = formatExcelDate(row?.['날짜'] ?? row?.['작업일']);
        const siteName = getCellString(row?.['현장명'] ?? row?.['현장']);
        const teamName = getCellString(row?.['팀명'] ?? row?.['팀'] ?? row?.['해당팀'] ?? row?.['현장담당']);
        const workerName = getCellString(row?.['이름']);

        if (!date) reasons.push('날짜/작업일 누락');
        if (!siteName) reasons.push('현장명/현장 누락');
        if (!teamName) reasons.push('팀명/팀 누락');
        if (!workerName) reasons.push('이름 누락');
        const dailySiteTypeRaw = getCellString(getSiteTypeRawFromDailyRow(row));
        const dailyPaymentMethodRaw = getCellString(getPaymentMethodRawFromDailyRow(row));
        if (dailySiteTypeRaw && !normalizeSiteTypeValue(dailySiteTypeRaw)) {
            reasons.push(`현장구분 값 오류: ${dailySiteTypeRaw} (허용: 도급/직영/지원)`);
        }
        if (dailyPaymentMethodRaw && !normalizePaymentMethodValue(dailyPaymentMethodRaw)) {
            reasons.push(`결제구분 값 오류: ${dailyPaymentMethodRaw} (허용: 계산서/노무)`);
        }

        const key = [date, siteName, teamName, workerName].join('|');
        const hasRequired = !reasons.length;
        if (hasRequired) {
            const siteExists = (ctx.fileSiteNames.has(siteName) || ctx.existingSiteNames.has(siteName));
            if (!siteExists) {
                reasons.push('DB등록불가: 현장 미등록(현장 시트/DB)');
                return { row, status: 'SKIP', reasons, key };
            }
            const teamExists = (ctx.fileTeamNames.has(teamName) || ctx.existingTeamNames.has(teamName));
            if (!teamExists) {
                reasons.push('DB등록불가: 팀 미등록(팀 시트/DB)');
                return { row, status: 'SKIP', reasons, key };
            }

            const workerExists = (ctx.fileWorkerNames.has(workerName) || ctx.existingWorkerNames.has(workerName));
            if (!workerExists) {
                reasons.push('DB등록불가: 작업자 미등록(작업자 시트/DB)');
                return { row, status: 'SKIP', reasons, key };
            }
        }
        return { row, status: reasons.length ? 'INVALID' : 'OK', reasons, key };
    });

    const keyCount = new Map<string, number>();
    base.forEach((r) => {
        const k = getCellString(r.key);
        if (!k) return;
        keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    });

    return base.map((r) => {
        const k = getCellString(r.key);
        const dup = k && (keyCount.get(k) ?? 0) > 1;
        if (!dup) return r;
        const nextReasons = r.reasons.includes('중복') ? r.reasons : [...r.reasons, '중복'];
        const nextStatus: PreviewRowStatus = r.status === 'INVALID' ? 'INVALID' : r.status === 'SKIP' ? 'SKIP' : 'DUPLICATE';
        return { ...r, status: nextStatus, reasons: nextReasons };
    });
};

const analyzeAllSheets = (data: { [key in SheetType]: any[] }, ctx: PreviewAnalyzeContext): { [key in SheetType]: PreviewAnnotatedRow[] } => {
    return {
        Company: analyzeSheetRows('Company', data.Company ?? [], ctx),
        Team: analyzeSheetRows('Team', data.Team ?? [], ctx),
        Site: analyzeSheetRows('Site', data.Site ?? [], ctx),
        Worker: analyzeSheetRows('Worker', data.Worker ?? [], ctx),
        DailyReport: analyzeSheetRows('DailyReport', data.DailyReport ?? [], ctx)
    };
};

// ===========================
// Mapping Analysis Functions
// ===========================

const analyzeCompanyMapping = async (fileRows: any[]): Promise<MappedRow[]> => {
    const normalizeNameKey = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');
    const existingCompanies = await companyService.getCompanies();
    const existingMap = new Map(existingCompanies.map(c => [normalizeNameKey(c.name), c]));

    const nameCounts = new Map<string, number>();
    fileRows.forEach((row) => {
        const n = normalizeNameKey(row?.['회사명'] || row?.['상호']);
        if (!n) return;
        nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    });

    const seen = new Set<string>();

    return fileRows.map(row => {
        const name = normalizeNameKey(row?.['회사명'] || row?.['상호']);
        if (!name) {
            return {
                row,
                status: 'CONFLICT' as MappingStatus,
                changes: ['회사명 누락'],
                action: 'SKIP' as ActionType,
                key: ''
            };
        }

        if ((nameCounts.get(name) ?? 0) > 1) {
            if (seen.has(name)) {
                return {
                    row,
                    status: 'CONFLICT' as MappingStatus,
                    changes: ['파일 내 중복'],
                    action: 'SKIP' as ActionType,
                    key: name
                };
            }
            seen.add(name);
        }

        const existing = existingMap.get(name);
        if (!existing) {
            return {
                row,
                status: 'NEW' as MappingStatus,
                changes: [],
                action: 'CREATE' as ActionType,
                key: name
            };
        }

        const changes: string[] = [];
        if (row['구분'] && row['구분'] !== existing.type) {
            changes.push(`구분: ${existing.type || '-'} → ${row['구분']}`);
        }
        if (row['대표자'] && row['대표자'] !== existing.ceoName) {
            changes.push(`대표자: ${existing.ceoName || '-'} → ${row['대표자']}`);
        }
        if (row['사업자번호'] && row['사업자번호'] !== existing.businessNumber) {
            changes.push('사업자번호 변경');
        }
        if (row['주소'] && row['주소'] !== existing.address) {
            changes.push(`주소 변경`);
        }
        const rowPhone = getCellString(row['연락처'] ?? row['전화번호'] ?? row['대표전화']);
        if (rowPhone && rowPhone !== (existing.phone ?? '')) {
            changes.push(`연락처 변경`);
        }

        return {
            row,
            status: changes.length > 0 ? 'UPDATE' as MappingStatus : 'UNCHANGED' as MappingStatus,
            existingData: existing,
            changes,
            action: changes.length > 0 ? 'UPDATE' as ActionType : 'SKIP' as ActionType,
            key: name
        };
    });
};

const analyzeTeamMapping = async (fileRows: any[]): Promise<MappedRow[]> => {
    const normalizeNameKey = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');
    const existingTeams = await teamService.getTeams();
    const existingMap = new Map(existingTeams.map(t => [normalizeNameKey(t.name), t]));

    const nameCounts = new Map<string, number>();
    fileRows.forEach((row) => {
        const n = normalizeNameKey(row?.['팀명']);
        if (!n) return;
        nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    });

    const seen = new Set<string>();

    return fileRows.map(row => {
        const name = normalizeNameKey(row?.['팀명']);
        if (!name) {
            return {
                row,
                status: 'CONFLICT' as MappingStatus,
                changes: ['팀명 누락'],
                action: 'SKIP' as ActionType,
                key: ''
            };
        }

        if ((nameCounts.get(name) ?? 0) > 1) {
            if (seen.has(name)) {
                return {
                    row,
                    status: 'CONFLICT' as MappingStatus,
                    changes: ['파일 내 중복'],
                    action: 'SKIP' as ActionType,
                    key: name
                };
            }
            seen.add(name);
        }

        const existing = existingMap.get(name);
        if (!existing) {
            return {
                row,
                status: 'NEW' as MappingStatus,
                changes: [],
                action: 'CREATE' as ActionType,
                key: name
            };
        }

        const changes: string[] = [];
        const rowCompanyName = normalizeNameKey(row?.['회사명'] || row?.['소속회사']);
        if (rowCompanyName && rowCompanyName !== normalizeNameKey(existing.companyName ?? '')) {
            changes.push(`회사명: ${existing.companyName || '-'} → ${rowCompanyName}`);
        }
        const rowLeaderName = normalizeNameKey(row?.['팀장명'] ?? row?.['팀장']);
        if (rowLeaderName && rowLeaderName !== normalizeNameKey(existing.leaderName ?? '')) {
            changes.push(`팀장: ${existing.leaderName || '-'} → ${rowLeaderName}`);
        }
        const rowRole = getCellString(row?.['직종']);
        if (rowRole && rowRole !== (existing.role ?? '')) {
            changes.push(`직종: ${existing.role || '-'} → ${rowRole}`);
        }

        return {
            row,
            status: changes.length > 0 ? 'UPDATE' as MappingStatus : 'UNCHANGED' as MappingStatus,
            existingData: existing,
            changes,
            action: changes.length > 0 ? 'UPDATE' as ActionType : 'SKIP' as ActionType,
            key: name
        };
    });
};

const analyzeSiteMapping = async (fileRows: any[]): Promise<MappedRow[]> => {
    const normalizeNameKey = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');
    const [existingSites, existingCompanies] = await Promise.all([
        siteService.getSites(),
        companyService.getCompanies()
    ]);
    const existingMap = new Map(existingSites.map(s => [normalizeNameKey(s.name), s]));
    const companiesByName = new Map(existingCompanies.map(c => [normalizeNameKey(c.name), c]));

    const nameCounts = new Map<string, number>();
    fileRows.forEach((row) => {
        const n = normalizeNameKey(row?.['현장'] || row?.['현장명']);
        if (!n) return;
        nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    });

    const seen = new Set<string>();

    return fileRows.map(row => {
        const name = normalizeNameKey(row?.['현장'] || row?.['현장명']);
        if (!name) {
            return {
                row,
                status: 'CONFLICT' as MappingStatus,
                changes: ['현장명 누락'],
                action: 'SKIP' as ActionType,
                key: ''
            };
        }

        if ((nameCounts.get(name) ?? 0) > 1) {
            if (seen.has(name)) {
                return {
                    row,
                    status: 'CONFLICT' as MappingStatus,
                    changes: ['파일 내 중복'],
                    action: 'SKIP' as ActionType,
                    key: name
                };
            }
            seen.add(name);
        }

        const siteTypeRaw = getCellString(getSiteTypeRawFromSiteRow(row));
        const paymentMethodRaw = getCellString(getPaymentMethodRawFromSiteRow(row));
        const siteTypeNormalized = normalizeSiteTypeValue(siteTypeRaw);
        const paymentMethodNormalized = normalizePaymentMethodValue(paymentMethodRaw);

        if (siteTypeRaw && !siteTypeNormalized) {
            return {
                row,
                status: 'CONFLICT' as MappingStatus,
                changes: [`현장구분 값 오류: ${siteTypeRaw} (허용: 도급/직영/지원)`],
                action: 'SKIP' as ActionType,
                key: name
            };
        }
        if (paymentMethodRaw && !paymentMethodNormalized) {
            return {
                row,
                status: 'CONFLICT' as MappingStatus,
                changes: [`결제구분 값 오류: ${paymentMethodRaw} (허용: 계산서/노무)`],
                action: 'SKIP' as ActionType,
                key: name
            };
        }

        const existing = existingMap.get(name);
        if (!existing) {
            return {
                row,
                status: 'NEW' as MappingStatus,
                changes: [],
                action: 'CREATE' as ActionType,
                key: name
            };
        }

        const changes: string[] = [];

        // --- 스마트 회사 매핑 (Smart Company Mapping) ---
        const rawClient = normalizeNameKey(row?.['발주사'] || row?.['발주처']);
        const rawConstructor = normalizeNameKey(row?.['시공사'] || row?.['건설사'] || row?.['회사명']);
        const rawPartner = normalizeNameKey(row?.['협력사'] || row?.['협력업체'] || row?.['파트너']);

        let clientComp = rawClient ? companiesByName.get(rawClient) : null;
        let constructorComp = rawConstructor ? companiesByName.get(rawConstructor) : null;
        let partnerComp = rawPartner ? companiesByName.get(rawPartner) : null;

        let shouldClearCompany = false;

        // Smart Distribution: "시공사" 컬럼에 잘못 들어간 협력사/발주사 자동 이동
        if (constructorComp) {
            if (constructorComp.type === '협력사' && !partnerComp && !rawPartner) {
                partnerComp = constructorComp;
                constructorComp = null;
                shouldClearCompany = true;
            } else if (constructorComp.type === '건설사' && !clientComp && !rawClient) {
                clientComp = constructorComp;
                constructorComp = null;
                shouldClearCompany = true;
            }
        }

        const clientCompanyName = clientComp ? clientComp.name : (rawClient || '');
        let companyNameVal = constructorComp ? constructorComp.name : (shouldClearCompany ? '' : (rawConstructor || ''));
        const partnerName = partnerComp ? partnerComp.name : (rawPartner || '');

        // Default Constructor: 발주사가 있는데 시공사가 없으면 '청연'으로 지정
        if (clientCompanyName && !companyNameVal) {
            const defaultComp = companiesByName.get('청연');
            if (defaultComp && defaultComp.type === '시공사') {
                companyNameVal = defaultComp.name;
            } else {
                companyNameVal = '청연';
            }
        }

        if (clientCompanyName && clientCompanyName !== existing.clientCompanyName) {
            changes.push(`발주사: ${existing.clientCompanyName || '-'} → ${clientCompanyName}`);
        }
        if (companyNameVal && companyNameVal !== existing.companyName) {
            changes.push(`시공사: ${existing.companyName || '-'} → ${companyNameVal}`);
        }
        if (partnerName && partnerName !== existing.partnerName) {
            changes.push(`협력사: ${existing.partnerName || '-'} → ${partnerName}`);
        }
        const rowTeamName = normalizeNameKey(row?.['해당팀'] || row?.['현장담당'] || row?.['담당팀']);
        if (rowTeamName && rowTeamName !== normalizeNameKey(existing.responsibleTeamName ?? '')) {
            changes.push(`담당팀: ${existing.responsibleTeamName || '-'} → ${rowTeamName}`);
        }
        const rowCode = getCellString(row['현장코드']);
        if (rowCode && rowCode !== (existing.code ?? '')) {
            changes.push('현장코드 변경');
        }
        if (row['주소'] && row['주소'] !== existing.address) {
            changes.push(`주소 변경`);
        }
        const rowStartDate = getCellString(formatExcelDate(row['착공일']));
        if (rowStartDate && rowStartDate !== (existing.startDate ?? '')) {
            changes.push('착공일 변경');
        }
        const rowEndDate = getCellString(formatExcelDate(row['준공일']));
        if (rowEndDate && rowEndDate !== (existing.endDate ?? '')) {
            changes.push('준공일 변경');
        }
        if (siteTypeNormalized && siteTypeNormalized !== existing.siteType) {
            changes.push(`현장구분: ${existing.siteType || '-'} → ${siteTypeNormalized}`);
        }
        if (paymentMethodNormalized && paymentMethodNormalized !== existing.paymentMethod) {
            changes.push(`결제구분: ${existing.paymentMethod || '-'} → ${paymentMethodNormalized}`);
        }

        return {
            row,
            status: changes.length > 0 ? 'UPDATE' as MappingStatus : 'UNCHANGED' as MappingStatus,
            existingData: existing,
            changes,
            action: changes.length > 0 ? 'UPDATE' as ActionType : 'SKIP' as ActionType,
            key: name
        };
    });
};

const analyzeWorkerMapping = async (fileRows: any[]): Promise<MappedRow[]> => {
    const [existingWorkers, existingTeams] = await Promise.all([
        manpowerService.getWorkers(),
        teamService.getTeams()
    ]);
    const existingMap = new Map(existingWorkers.map(w => [w.name, w]));

    const normalizeNameKey = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');
    const teamsByName = new Map<string, Team>();
    existingTeams.forEach((t) => {
        const n = getCellString((t as any)?.name);
        if (!n) return;
        teamsByName.set(n, t);
    });
    const teamsByNormalizedName = new Map<string, Team>();
    teamsByName.forEach((t, k) => {
        teamsByNormalizedName.set(normalizeNameKey(k), t);
    });

    const nameCounts = new Map<string, number>();
    fileRows.forEach((row) => {
        const n = getCellString(row?.['이름'] || row?.['성명']);
        if (!n) return;
        nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    });

    const seen = new Set<string>();

    return fileRows.map(row => {
        const name = getCellString(row['이름'] || row['성명']);
        if (!name) {
            return {
                row,
                status: 'CONFLICT' as MappingStatus,
                changes: ['이름 누락'],
                action: 'SKIP' as ActionType,
                key: ''
            };
        }

        if ((nameCounts.get(name) ?? 0) > 1) {
            if (seen.has(name)) {
                return {
                    row,
                    status: 'CONFLICT' as MappingStatus,
                    changes: ['파일 내 중복'],
                    action: 'SKIP' as ActionType,
                    key: name
                };
            }
            seen.add(name);
        }

        const existing = existingMap.get(name);
        if (!existing) {
            return {
                row,
                status: 'NEW' as MappingStatus,
                changes: [],
                action: 'CREATE' as ActionType,
                key: name
            };
        }

        const changes: string[] = [];
        const rowTeamNameRaw = getCellString(row['소속팀'] ?? row['팀명'] ?? row['팀']);
        if (rowTeamNameRaw && rowTeamNameRaw !== (existing.teamName ?? '')) {
            changes.push(`팀: ${existing.teamName || '-'} → ${rowTeamNameRaw}`);
        }

        const resolvedRowTeam = rowTeamNameRaw
            ? (teamsByName.get(rowTeamNameRaw) ?? teamsByNormalizedName.get(normalizeNameKey(rowTeamNameRaw)))
            : undefined;
        if (resolvedRowTeam?.id && !getCellString((existing as any)?.teamId)) {
            changes.push('팀 ID 보강');
        }
        const rowRole = row['직종'] || row['역할'];
        if (rowRole && rowRole !== existing.role) {
            changes.push(`직종: ${existing.role || '-'} → ${rowRole}`);
        }
        const unitPrice = getUnitPriceFromRow(row);
        if (unitPrice !== undefined && unitPrice !== (existing.unitPrice ?? 0)) {
            changes.push(`단가: ${(existing.unitPrice ?? 0).toLocaleString()} → ${unitPrice.toLocaleString()}`);
        }

        const rowPayType = getPayTypeFromRow(row);
        if (rowPayType && rowPayType !== (existing.payType ?? '')) {
            changes.push(`급여방식: ${existing.payType || '-'} → ${rowPayType}`);
        }

        const rowCompanyNameRaw = getCellString(row['회사명'] ?? row['소속회사']);
        const effectiveTeamName = rowTeamNameRaw || getCellString(existing.teamName);
        const team = effectiveTeamName
            ? (teamsByName.get(effectiveTeamName) ?? teamsByNormalizedName.get(normalizeNameKey(effectiveTeamName)))
            : undefined;
        const derivedCompanyName = rowCompanyNameRaw || getCellString(team?.companyName);
        if (derivedCompanyName && derivedCompanyName !== (existing.companyName ?? '')) {
            changes.push(`회사명: ${existing.companyName || '-'} → ${derivedCompanyName}`);
        }

        const rowTeamType = getCellString(row['팀구분']);
        if (rowTeamType && rowTeamType !== (existing.teamType ?? '')) {
            changes.push(`팀구분: ${existing.teamType || '-'} → ${rowTeamType}`);
        }

        const rowContact = getCellString(row['연락처'] ?? row['휴대폰']);
        if (rowContact && rowContact !== (existing.contact ?? '')) {
            changes.push(`연락처: ${existing.contact || '-'} → ${rowContact}`);
        }

        const rowIdNumber = getCellString(row['주민번호']);
        if (rowIdNumber && rowIdNumber !== (existing.idNumber ?? '')) {
            changes.push('주민번호 변경');
        }

        const rowAddress = getCellString(row['주소']);
        if (rowAddress && rowAddress !== (existing.address ?? '')) {
            changes.push('주소 변경');
        }

        const rowBankName = getWorkerBankNameFromRow(row);
        if (rowBankName && rowBankName !== (existing.bankName ?? '')) {
            changes.push(`은행명: ${existing.bankName || '-'} → ${rowBankName}`);
        }
        const rowAccountNumber = getWorkerAccountNumberFromRow(row);
        if (rowAccountNumber && rowAccountNumber !== (existing.accountNumber ?? '')) {
            changes.push('계좌번호 변경');
        }
        const rowAccountHolder = getWorkerAccountHolderFromRow(row);
        if (rowAccountHolder && rowAccountHolder !== (existing.accountHolder ?? '')) {
            changes.push(`예금주: ${existing.accountHolder || '-'} → ${rowAccountHolder}`);
        }

        return {
            row,
            status: changes.length > 0 ? 'UPDATE' as MappingStatus : 'UNCHANGED' as MappingStatus,
            existingData: existing,
            changes,
            action: changes.length > 0 ? 'UPDATE' as ActionType : 'SKIP' as ActionType,
            key: name
        };
    });
};

const getDailyReportDateRange = (fileRows: any[]): { startDate: string; endDate: string } => {
    const today = new Date().toISOString().slice(0, 10);
    const dates = (fileRows ?? [])
        .map((row) => formatExcelDate(row?.['날짜'] ?? row?.['작업일']))
        .map((d) => getCellString(d))
        .filter((d) => !!d)
        .sort();

    if (dates.length <= 0) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return { startDate: sixMonthsAgo.toISOString().slice(0, 10), endDate: today };
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1] || startDate;
    return { startDate, endDate };
};

const analyzeDailyReportMapping = async (fileRows: any[], workerRows: any[] = []): Promise<MappedRow[]> => {
    const normalizeNameKey = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');

    const { startDate, endDate } = getDailyReportDateRange(fileRows);
    const [existingReports, existingWorkers] = await Promise.all([
        dailyReportService.getReportsByRange(startDate, endDate),
        manpowerService.getWorkers()
    ]);

    const payTypeByWorkerNameFromDb = new Map<string, string>();
    (existingWorkers ?? []).forEach((w: Worker) => {
        const name = normalizeNameKey(w?.name);
        if (!name) return;
        const payType = getCellString((w as any)?.payType ?? (w as any)?.salaryModel);
        if (!payTypeByWorkerNameFromDb.has(name)) payTypeByWorkerNameFromDb.set(name, payType);
    });

    const payTypeByWorkerNameFromFile = new Map<string, string>();
    (workerRows ?? []).forEach((row: any) => {
        const name = normalizeNameKey(row?.['이름'] ?? row?.['성명'] ?? row?.['작업자명']);
        if (!name) return;
        const payType = getPayTypeFromRow(row);
        if (!payType) return;
        if (!payTypeByWorkerNameFromFile.has(name)) payTypeByWorkerNameFromFile.set(name, payType);
    });

    const existingMap = new Map<DailyReportKey, any>(
        existingReports.map(r => {
            const d = getCellString(r?.date);
            const s = normalizeNameKey(r?.siteName);
            const t = normalizeNameKey(r?.teamName);
            return [`${d}_${s}_${t}` as DailyReportKey, r] as const;
        })
    );

    const grouped = new Map<DailyReportKey, any[]>();
    fileRows.forEach(row => {
        const date = getCellString(formatExcelDate(row['날짜'] || row['작업일']));
        const siteName = normalizeNameKey(row['현장명'] || row['현장']);
        const teamName = normalizeNameKey(row['팀명'] || row['팀'] || row['해당팀'] || row['현장담당']);
        if (!date || !siteName || !teamName) return;
        const key = `${date}_${siteName}_${teamName}` as DailyReportKey;

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(row);
    });

    const results: MappedRow[] = [];
    for (const [key, rows] of grouped.entries()) {
        const first = rows?.[0] ?? {};
        const date = getCellString(formatExcelDate(first?.['날짜'] || first?.['작업일']));
        const siteName = normalizeNameKey(first?.['현장명'] || first?.['현장']);
        const teamName = normalizeNameKey(first?.['팀명'] || first?.['팀'] || first?.['해당팀'] || first?.['현장담당']);

        const invalidSiteTypes = Array.from(new Set(
            rows
                .map((r) => getCellString(getSiteTypeRawFromDailyRow(r)))
                .filter((raw) => raw && !normalizeSiteTypeValue(raw))
        ));
        const invalidPaymentMethods = Array.from(new Set(
            rows
                .map((r) => getCellString(getPaymentMethodRawFromDailyRow(r)))
                .filter((raw) => raw && !normalizePaymentMethodValue(raw))
        ));

        const groupedSiteType = getFirstNormalizedSiteTypeFromRows(rows);
        const groupedPaymentMethod = getFirstNormalizedPaymentMethodFromRows(rows);

        const buildSummaryRow = (workersLabel: string, count: number) => ({
            key,
            date,
            siteName,
            teamName,
            workers: workersLabel,
            count,
            siteType: groupedSiteType ?? '',
            paymentType: groupedPaymentMethod ?? ''
        });

        if (invalidSiteTypes.length > 0 || invalidPaymentMethods.length > 0) {
            const invalidMessages: string[] = [];
            if (invalidSiteTypes.length > 0) {
                invalidMessages.push(`현장구분 값 오류: ${invalidSiteTypes.join(', ')} (허용: 도급/직영/지원)`);
            }
            if (invalidPaymentMethods.length > 0) {
                invalidMessages.push(`결제구분 값 오류: ${invalidPaymentMethods.join(', ')} (허용: 계산서/노무)`);
            }
            results.push({
                row: buildSummaryRow(rows.map((r) => getCellString(r?.['이름'])).filter(Boolean).join(', '), rows.length),
                status: 'CONFLICT' as MappingStatus,
                changes: invalidMessages,
                action: 'SKIP' as ActionType,
                key
            });
            continue;
        }

        const existing = existingMap.get(key);
        if (!existing) {
            results.push({
                row: buildSummaryRow(rows.map((r) => getCellString(r?.['이름'])).filter(Boolean).join(', '), rows.length),
                status: 'NEW' as MappingStatus,
                changes: [],
                action: 'CREATE' as ActionType,
                key
            });
            continue;
        }

        const existingWorkersArray: any[] = Array.isArray(existing.workers) ? existing.workers : [];
        const existingByName = new Map<string, any>();
        existingWorkersArray.forEach((w) => {
            const n = normalizeNameKey(w?.name);
            if (!n) return;
            existingByName.set(n, w);
        });

        const fileByName = new Map<string, any>();
        rows.forEach((r) => {
            const n = normalizeNameKey(r?.['이름']);
            if (!n) return;

            const manDayRaw = r?.['공수'];
            const manDayCandidate = manDayRaw === undefined || manDayRaw === null || manDayRaw === ''
                ? 1.0
                : Number(manDayRaw);
            const manDay = Number.isFinite(manDayCandidate) ? manDayCandidate : 1.0;

            const unitPriceRaw = r?.['단가'] ?? r?.['일당'] ?? r?.['임금'] ?? r?.['급여'];
            const unitPriceText = getCellString(unitPriceRaw);
            const parsedUnitPrice = unitPriceText !== '' ? Number(unitPriceText.replace(/[^0-9]/g, '')) : NaN;
            const unitPrice = Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : undefined;

            const role = getCellString(r?.['직종']);
            const payType = (
                getPayTypeFromRow(r)
                || payTypeByWorkerNameFromFile.get(n)
                || payTypeByWorkerNameFromDb.get(n)
            );
            const workContent = getCellString(r?.['작업내용']);
            const siteType = normalizeSiteTypeValue(getCellString(r?.['현장구분']));
            const paymentType = normalizePaymentMethodValue(getCellString(r?.['결제구분']));

            fileByName.set(n, { name: n, manDay, unitPrice, role, payType, workContent, siteType, paymentType });
        });

        const toAdd: string[] = [];
        const toUpdate: string[] = [];
        const toRemove: string[] = [];
        let payTypeDiffCount = 0;

        for (const [name, fw] of fileByName.entries()) {
            const ew = existingByName.get(name);
            if (!ew) {
                toAdd.push(name);
                continue;
            }

            const oldManDay = typeof ew?.manDay === 'number' ? ew.manDay : 0;
            const oldUnitPrice = typeof ew?.unitPrice === 'number' ? ew.unitPrice : undefined;
            const oldRole = getCellString(ew?.role);
            const oldPayType = getCellString(ew?.payType ?? ew?.salaryModel);
            const oldWorkContent = getCellString(ew?.workContent);
            const oldSiteType = getCellString(ew?.siteType);
            const oldPaymentType = getCellString(ew?.paymentType);

            const hasManDayDiff = typeof fw?.manDay === 'number' && fw.manDay !== oldManDay;
            const hasUnitPriceDiff = typeof fw?.unitPrice === 'number' && fw.unitPrice !== (oldUnitPrice ?? 0);
            const hasRoleDiff = fw?.role ? fw.role !== oldRole : false;
            const hasPayTypeDiff = fw?.payType ? fw.payType !== oldPayType : false;
            const hasWorkContentDiff = fw?.workContent ? fw.workContent !== oldWorkContent : false;
            const hasSiteTypeDiff = fw?.siteType ? fw.siteType !== oldSiteType : false;
            const hasPaymentTypeDiff = fw?.paymentType ? fw.paymentType !== oldPaymentType : false;

            if (hasManDayDiff || hasUnitPriceDiff || hasRoleDiff || hasPayTypeDiff || hasWorkContentDiff || hasSiteTypeDiff || hasPaymentTypeDiff) {
                toUpdate.push(name);
                if (hasPayTypeDiff) payTypeDiffCount += 1;
            }
        }

        for (const name of existingByName.keys()) {
            if (!fileByName.has(name)) toRemove.push(name);
        }

        const changes: string[] = [];
        if (toAdd.length > 0) changes.push(`작업자 ${toAdd.length}명 추가`);
        if (toUpdate.length > 0) changes.push(`작업자 ${toUpdate.length}명 수정`);
        if (payTypeDiffCount > 0) changes.push(`급여방식 ${payTypeDiffCount}명 변경`);
        if (toRemove.length > 0) changes.push(`작업자 ${toRemove.length}명 제거`);
        if (groupedSiteType && groupedSiteType !== getCellString(existing?.siteType)) {
            changes.push(`현장구분: ${getCellString(existing?.siteType) || '-'} → ${groupedSiteType}`);
        }
        if (groupedPaymentMethod && groupedPaymentMethod !== getCellString(existing?.paymentType)) {
            changes.push(`결제구분: ${getCellString(existing?.paymentType) || '-'} → ${groupedPaymentMethod}`);
        }

        const sampleWorkers = Array.from(fileByName.keys()).slice(0, 30).join(', ');

        if (changes.length > 0) {
            results.push({
                row: buildSummaryRow(sampleWorkers, fileByName.size),
                status: 'UPDATE' as MappingStatus,
                existingData: existing,
                changes,
                action: 'MERGE' as ActionType,
                key
            });
        } else {
            results.push({
                row: buildSummaryRow(sampleWorkers, fileByName.size),
                status: 'UNCHANGED' as MappingStatus,
                existingData: existing,
                changes: [],
                action: 'SKIP' as ActionType,
                key
            });
        }
    }

    return results;
};

const IntegratedMassUploader: React.FC = () => {
    const { currentUser } = useAuth();

    // Stages: 'upload' -> 'preview' -> 'processing'
    const [stage, setStage] = useState<'upload' | 'preview' | 'processing'>('upload');
    const [dailyReportExistingMode, setDailyReportExistingMode] = useState<'merge' | 'overwrite'>('overwrite');
    const [previewData, setPreviewData] = useState<{ [key in SheetType]: any[] }>({
        Company: [],
        Team: [],
        Site: [],
        Worker: [],
        DailyReport: []
    });
    const [activeTab, setActiveTab] = useState<SheetType>('Company');
    const [previewAnalysis, setPreviewAnalysis] = useState<{ [key in SheetType]: PreviewAnnotatedRow[] }>({
        Company: [],
        Team: [],
        Site: [],
        Worker: [],
        DailyReport: []
    });
    const [showOnlyIssues, setShowOnlyIssues] = useState(false);

    // Mapping analysis for data comparison
    const [mappingAnalysis, setMappingAnalysis] = useState<{ [key in SheetType]: MappedRow[] }>({
        Company: [],
        Team: [],
        Site: [],
        Worker: [],
        DailyReport: []
    });
    const [isResettingData, setIsResettingData] = useState(false);
    const [previewPage, setPreviewPage] = useState(1);
    const [previewPageSize, setPreviewPageSize] = useState(100);

    const [logs, setLogs] = useState<LogItem[]>([
        { step: 'Company', status: 'pending', message: '회사 데이터 대기 중...' },
        { step: 'Team', status: 'pending', message: '팀 데이터 대기 중...' },
        { step: 'Site', status: 'pending', message: '현장 데이터 대기 중...' },
        { step: 'Worker', status: 'pending', message: '작업자 데이터 대기 중...' },
        { step: 'DailyReport', status: 'pending', message: '출력일보 대기 중...' },
    ]);

    const updateLog = (stepName: string, status: LogItem['status'], message: string, count?: number) => {
        setLogs(prev => prev.map(log =>
            log.step === stepName ? { ...log, status, message, count } : log
        ));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            (async () => {
                const bstr = evt.target?.result;
                if (typeof bstr !== 'string') return;

                const wb = XLSX.read(bstr, { type: 'binary' });

                const newData = {
                    Company: [] as any[],
                    Team: [] as any[],
                    Site: [] as any[],
                    Worker: [] as any[],
                    DailyReport: [] as any[]
                };
                const headerIssues: string[] = [];

                // Parse each sheet
                (Object.keys(SHEET_CONFIG) as SheetType[]).forEach(type => {
                    const config = SHEET_CONFIG[type];
                    const sheetName = wb.SheetNames.find((n) => {
                        const normalizedName = normalizeExcelHeaderKey(n);
                        return config.keywords.some((k) => normalizedName.includes(normalizeExcelHeaderKey(k)));
                    });
                    if (sheetName) {
                        const ws = wb.Sheets[sheetName];
                        // raw:false로 읽어 긴 숫자/선행 0이 포함된 계좌번호를 표시 문자열 기준으로 보존한다.
                        const rawData = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
                        const normalizedData = rawData.map((row: any) => normalizeExcelRowKeys(row));
                        const headerMatrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
                        const headers = (headerMatrix?.[0] ?? [])
                            .map((h) => normalizeExcelHeaderKey(getCellString(h)))
                            .filter((h) => !!h);
                        const headerSet = new Set(headers);
                        const fieldDef = TEMPLATE_FIELDS[type as TemplateSheetType];
                        const missingRequired = (fieldDef?.fields ?? [])
                            .filter((f) => f.required)
                            .filter((f) => {
                                const candidates = [f.label, ...(f.aliases ?? [])]
                                    .map((k) => normalizeExcelHeaderKey(k));
                                return !candidates.some((c) => headerSet.has(c));
                            })
                            .map((f) => f.label);
                        if (headerSet.size > 0 && missingRequired.length > 0) {
                            headerIssues.push(`${fieldDef.sheetName}: 필수 컬럼 누락 (${missingRequired.join(', ')})`);
                        }

                        // Normalize Dates immediately for Preview
                        newData[type] = normalizedData.map((row: any) => {
                            if (row['날짜']) row['날짜'] = formatExcelDate(row['날짜']);
                            if (row['작업일']) row['작업일'] = formatExcelDate(row['작업일']);
                            if (row['착공일']) row['착공일'] = formatExcelDate(row['착공일']);
                            if (row['준공일']) row['준공일'] = formatExcelDate(row['준공일']);
                            if (row['생년월일']) row['생년월일'] = formatExcelDate(row['생년월일']);
                            return row;
                        });
                    }
                });

                const ctx = await buildPreviewAnalyzeContext(newData);

                setPreviewData(newData);
                setPreviewAnalysis(analyzeAllSheets(newData, ctx));
                setDailyReportExistingMode('overwrite');

                // Perform mapping analysis
                const mappingResults = {
                    Company: await analyzeCompanyMapping(newData.Company),
                    Team: await analyzeTeamMapping(newData.Team),
                    Site: await analyzeSiteMapping(newData.Site),
                    Worker: await analyzeWorkerMapping(newData.Worker),
                    DailyReport: await analyzeDailyReportMapping(newData.DailyReport, newData.Worker)
                };
                setMappingAnalysis(mappingResults);

                setStage('preview');
                setPreviewPage(1);

                // Find first non-empty tab
                const firstDataTab = (Object.keys(newData) as SheetType[]).find(k => newData[k].length > 0);
                if (firstDataTab) setActiveTab(firstDataTab);

                if (headerIssues.length > 0) {
                    await Swal.fire({
                        title: '헤더 확인 필요',
                        html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">${headerIssues.map((m) => `- ${m}`).join('<br/>')}</div>`,
                        icon: 'warning'
                    });
                }
            })().catch((error) => {
                console.error(error);
                Swal.fire('오류', '파일을 읽는 중 오류가 발생했습니다.', 'error');
            });
        };
        reader.readAsBinaryString(file);
    };

    const handleProcess = async () => {
        const planLines = (Object.keys(SHEET_CONFIG) as SheetType[]).map((type) => {
            const mapping = mappingAnalysis[type] || [];
            const createCount = mapping.filter((m) => m.action === 'CREATE').length;
            const updateCount = mapping.filter((m) => m.action === 'UPDATE').length;
            const mergeCount = mapping.filter((m) => m.action === 'MERGE').length;
            const conflictCount = mapping.filter((m) => m.status === 'CONFLICT').length;
            const skipCount = mapping.filter((m) => m.action === 'SKIP').length;
            if (type === 'DailyReport') {
                const mergeLabel = dailyReportExistingMode === 'overwrite' ? '덮어쓰기' : '병합';
                return `${SHEET_CONFIG[type].name}: 생성 ${createCount}, ${mergeLabel} ${mergeCount}, 충돌 ${conflictCount}, 스킵 ${skipCount}`;
            }
            return `${SHEET_CONFIG[type].name}: 생성 ${createCount}, 덮어쓰기 ${updateCount}, 충돌 ${conflictCount}, 스킵 ${skipCount}`;
        });

        const confirm = await Swal.fire({
            title: '등록 시작 확인',
            html: `<div style="text-align:left; font-size: 14px; line-height: 1.6;">${planLines.map((l) => `<div>${l}</div>`).join('')}</div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '계속',
            cancelButtonText: '취소'
        });
        if (!confirm.isConfirmed) return;

        setStage('processing');

        // Reset logs
        setLogs([
            { step: 'Company', status: 'pending', message: '회사 데이터 대기 중...' },
            { step: 'Team', status: 'pending', message: '팀 데이터 대기 중...' },
            { step: 'Site', status: 'pending', message: '현장 데이터 대기 중...' },
            { step: 'Worker', status: 'pending', message: '작업자 데이터 대기 중...' },
            { step: 'DailyReport', status: 'pending', message: '출력일보 대기 중...' },
        ]);

        try {
            const errors: ProcessingErrorItem[] = [];
            const yieldToBrowser = async (): Promise<void> => {
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
            };

            const [allCompanies, allTeams, allSites, allWorkers] = await Promise.all([
                companyService.getCompanies(),
                teamService.getTeams(),
                siteService.getSites(),
                manpowerService.getWorkers()
            ]);

            const companiesByName = new Map<string, Company>();
            allCompanies.forEach((c) => {
                const n = getCellString(c?.name);
                if (!n) return;
                companiesByName.set(n, c);
            });

            const companiesById = new Map<string, Company>();
            allCompanies.forEach((c) => {
                const id = c?.id ? String(c.id) : '';
                if (!id) return;
                companiesById.set(id, c);
            });

            const teamsByName = new Map<string, Team>();
            allTeams.forEach((t) => {
                const n = getCellString(t?.name);
                if (!n) return;
                teamsByName.set(n, t);
            });

            const sitesByName = new Map<string, Site>();
            allSites.forEach((s) => {
                const n = getCellString(s?.name);
                if (!n) return;
                sitesByName.set(n, s);
            });

            const normalizeNameKey = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');

            const companiesByNormalizedName = new Map<string, Company>();
            companiesByName.forEach((c, k) => {
                companiesByNormalizedName.set(normalizeNameKey(k), c);
            });

            const teamsByNormalizedName = new Map<string, Team>();
            teamsByName.forEach((t, k) => {
                teamsByNormalizedName.set(normalizeNameKey(k), t);
            });

            const sitesByNormalizedName = new Map<string, Site>();
            sitesByName.forEach((s, k) => {
                sitesByNormalizedName.set(normalizeNameKey(k), s);
            });

            const workersByName = new Map<string, Worker>();
            allWorkers.forEach((w) => {
                const n = getCellString(w?.name);
                if (!n) return;
                if (!workersByName.has(n)) workersByName.set(n, w);
            });

            const workersByNormalizedName = new Map<string, Worker>();
            workersByName.forEach((w, k) => {
                workersByNormalizedName.set(normalizeNameKey(k), w);
            });

            const pendingTeamLeaderNames = new Map<string, string>();

            const processMapped = async (type: SheetType, items: MappedRow[], handler: (item: MappedRow) => Promise<void>) => {
                if (!items || items.length === 0) {
                    updateLog(type, 'success', '데이터 없음 (건너뜀)');
                    return;
                }

                updateLog(type, 'processing', '처리 중...');
                let ok = 0;
                let skipped = 0;
                let failed = 0;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.status === 'CONFLICT') {
                        failed++;
                        errors.push({
                            type,
                            key: getCellString(item.key),
                            message: (item.changes ?? []).join(', ') || 'CONFLICT'
                        });
                        continue;
                    }
                    if (item.action === 'SKIP' || item.status === 'UNCHANGED') {
                        skipped++;
                        continue;
                    }
                    try {
                        await handler(item);
                        ok++;
                    } catch (e) {
                        failed++;
                        errors.push({
                            type,
                            key: getCellString(item.key),
                            message: e instanceof Error ? e.message : String(e)
                        });
                    }

                    if ((i + 1) % 25 === 0) {
                        await yieldToBrowser();
                    }
                }
                updateLog(type, failed > 0 ? 'error' : 'success', `완료 (성공 ${ok}, 스킵 ${skipped}, 실패 ${failed})`, ok);
            };

            await processMapped('Company', mappingAnalysis.Company || [], async (item) => {
                const row = item.row;
                const companyName = normalizeNameKey(row?.['회사명'] || row?.['상호']);
                if (!companyName) throw new Error('회사명 누락');

                const phone = getCellString(row?.['연락처'] || row?.['전화번호'] || row?.['대표전화']);

                const existing = companiesByName.get(companyName) ?? companiesByNormalizedName.get(normalizeNameKey(companyName));
                if (item.action === 'CREATE') {
                    const createdId = await companyService.addCompany({
                        name: companyName,
                        type: (row?.['구분'] as any) || '기타',
                        ceoName: getCellString(row?.['대표자']),
                        businessNumber: getCellString(row?.['사업자번호']),
                        address: getCellString(row?.['주소']),
                        code: '',
                        phone
                    });
                    const createdCompany: Company = {
                        id: createdId,
                        name: companyName,
                        type: (row?.['구분'] as any) || '기타',
                        ceoName: getCellString(row?.['대표자']),
                        businessNumber: getCellString(row?.['사업자번호']),
                        address: getCellString(row?.['주소']),
                        code: '',
                        phone
                    } as Company;
                    companiesByName.set(companyName, createdCompany);
                    companiesByNormalizedName.set(normalizeNameKey(companyName), createdCompany);
                    companiesById.set(String(createdId), createdCompany);
                    return;
                }

                if (!existing?.id) throw new Error('DB 기존 회사 조회 실패');
                await companyService.updateCompany(existing.id, {
                    name: companyName,
                    type: (row?.['구분'] as any) || existing.type,
                    ceoName: getCellString(row?.['대표자']) || existing.ceoName,
                    businessNumber: getCellString(row?.['사업자번호']) || existing.businessNumber,
                    address: getCellString(row?.['주소']) || existing.address,
                    phone: phone || existing.phone
                });

                const nextCompany: Company = {
                    ...existing,
                    name: companyName,
                    type: ((row?.['구분'] as any) || existing.type) as any,
                    ceoName: getCellString(row?.['대표자']) || existing.ceoName,
                    businessNumber: getCellString(row?.['사업자번호']) || existing.businessNumber,
                    address: getCellString(row?.['주소']) || existing.address,
                    phone: phone || existing.phone
                } as Company;
                companiesByName.set(companyName, nextCompany);
                companiesByNormalizedName.set(normalizeNameKey(companyName), nextCompany);
                companiesById.set(String(existing.id), nextCompany);
            });

            await processMapped('Team', mappingAnalysis.Team || [], async (item) => {
                const row = item.row;
                const teamName = normalizeNameKey(row?.['팀명']);
                if (!teamName) throw new Error('팀명 누락');

                const leaderName = normalizeNameKey(row?.['팀장명'] ?? row?.['팀장']);
                if (leaderName) pendingTeamLeaderNames.set(teamName, leaderName);

                const rawCompanyName = normalizeNameKey(row?.['회사명'] || row?.['소속회사']);
                const resolvedCompany = rawCompanyName
                    ? (companiesByName.get(rawCompanyName) ?? companiesByNormalizedName.get(normalizeNameKey(rawCompanyName)))
                    : undefined;
                const companyId = resolvedCompany?.id ? String(resolvedCompany.id) : '';
                const companyName = resolvedCompany?.name ? String(resolvedCompany.name) : (rawCompanyName || '');

                const existing = teamsByName.get(teamName);
                if (item.action === 'CREATE') {
                    const createdId = await teamService.addTeam({
                        name: teamName,
                        companyId: companyId || undefined,
                        leaderName: leaderName,
                        role: getCellString(row?.['직종']) || '기타',
                        leaderId: '',
                        type: '일반'
                    } as Team);
                    const createdTeam: Team = {
                        id: createdId,
                        name: teamName,
                        companyId: companyId || undefined,
                        companyName: companyName || undefined,
                        leaderName: leaderName,
                        role: getCellString(row?.['직종']) || '기타',
                        leaderId: '',
                        type: '일반'
                    } as Team;
                    teamsByName.set(teamName, createdTeam);
                    teamsByNormalizedName.set(normalizeNameKey(teamName), createdTeam);
                    return;
                }

                if (!existing?.id) throw new Error('DB 기존 팀 조회 실패');
                await teamService.updateTeam(existing.id, {
                    name: teamName,
                    companyId: companyId || existing.companyId,
                    leaderName: leaderName || existing.leaderName,
                    role: getCellString(row?.['직종']) || existing.role
                });

                const nextTeam: Team = {
                    ...existing,
                    name: teamName,
                    companyId: companyId || existing.companyId,
                    companyName: companyName || existing.companyName,
                    leaderName: leaderName || existing.leaderName,
                    role: getCellString(row?.['직종']) || existing.role
                } as Team;
                teamsByName.set(teamName, nextTeam);
                teamsByNormalizedName.set(normalizeNameKey(teamName), nextTeam);
            });

            const updatedCompanyPhoneIds = new Set<string>();
            const maybeUpdateCompanyPhone = async (company: Company | null, nextPhoneRaw: string): Promise<void> => {
                const id = company?.id ? String(company.id) : '';
                const nextPhone = getCellString(nextPhoneRaw);
                if (!id || !nextPhone) return;
                if (updatedCompanyPhoneIds.has(id)) return;
                if (getCellString((company as any)?.phone)) return;

                updatedCompanyPhoneIds.add(id);
                await companyService.updateCompany(id, { phone: nextPhone });
                const nextCompany: Company = { ...(company as any), phone: nextPhone } as Company;
                companiesByName.set(nextCompany.name, nextCompany);
                companiesByNormalizedName.set(normalizeNameKey(nextCompany.name), nextCompany);
                companiesById.set(id, nextCompany);
            };

            await processMapped('Site', mappingAnalysis.Site || [], async (item) => {
                const row = item.row;
                const siteName = normalizeNameKey(row?.['현장'] || row?.['현장명']);
                if (!siteName) throw new Error('현장명 누락');

                // --- 스마트 회사 매핑 (Smart Company Mapping) ---
                const rawClient = normalizeNameKey(row?.['발주사'] || row?.['발주처']);
                const rawConstructor = normalizeNameKey(row?.['시공사'] || row?.['건설사'] || row?.['회사명']);
                const rawPartner = normalizeNameKey(row?.['협력사'] || row?.['협력업체'] || row?.['파트너']);

                let clientComp = rawClient
                    ? (companiesByName.get(rawClient) ?? companiesByNormalizedName.get(normalizeNameKey(rawClient)) ?? null)
                    : null;
                let constructorComp = rawConstructor
                    ? (companiesByName.get(rawConstructor) ?? companiesByNormalizedName.get(normalizeNameKey(rawConstructor)) ?? null)
                    : null;
                let partnerComp = rawPartner
                    ? (companiesByName.get(rawPartner) ?? companiesByNormalizedName.get(normalizeNameKey(rawPartner)) ?? null)
                    : null;

                let shouldClearCompany = false;

                // Smart Distribution
                if (constructorComp) {
                    if (constructorComp.type === '협력사' && !partnerComp && !rawPartner) {
                        partnerComp = constructorComp;
                        constructorComp = null;
                        shouldClearCompany = true;
                    } else if (constructorComp.type === '건설사' && !clientComp && !rawClient) {
                        clientComp = constructorComp;
                        constructorComp = null;
                        shouldClearCompany = true;
                    }
                }

                const clientCompanyId = clientComp ? clientComp.id! : '';
                const clientCompanyName = clientComp ? clientComp.name : (rawClient || '');

                let companyId = constructorComp ? constructorComp.id! : '';
                // 이동했으면(shouldClearCompany) 빈값, 아니면 raw값 유지
                let companyNameVal = constructorComp ? constructorComp.name : (shouldClearCompany ? '' : (rawConstructor || ''));

                // Default Constructor: 발주사가 있는데 시공사가 없으면 '청연'으로 지정
                if (clientCompanyName && !companyNameVal) {
                    const defaultComp = companiesByName.get('청연');
                    if (defaultComp && defaultComp.type === '시공사') {
                        companyId = defaultComp.id!;
                        companyNameVal = defaultComp.name;
                    } else {
                        companyNameVal = '청연';
                    }
                }

                const partnerId = partnerComp ? partnerComp.id! : '';
                const partnerName = partnerComp ? partnerComp.name : (rawPartner || '');

                const clientPhone = getCellString(
                    row?.['발주사연락처'] ?? row?.['발주처연락처'] ?? row?.['발주사전화번호'] ?? row?.['발주처전화번호'] ?? row?.['발주사대표전화'] ?? row?.['발주처대표전화']
                );
                const constructorPhone = getCellString(
                    row?.['시공사연락처'] ?? row?.['건설사연락처'] ?? row?.['회사연락처'] ?? row?.['시공사전화번호'] ?? row?.['건설사전화번호'] ?? row?.['회사전화번호'] ?? row?.['시공사대표전화'] ?? row?.['건설사대표전화'] ?? row?.['회사대표전화']
                );
                const partnerPhone = getCellString(
                    row?.['협력사연락처'] ?? row?.['협력업체연락처'] ?? row?.['파트너연락처'] ?? row?.['협력사전화번호'] ?? row?.['협력업체전화번호'] ?? row?.['파트너전화번호'] ?? row?.['협력사대표전화'] ?? row?.['협력업체대표전화'] ?? row?.['파트너대표전화']
                );

                await maybeUpdateCompanyPhone(clientComp, clientPhone);
                await maybeUpdateCompanyPhone(constructorComp, constructorPhone);
                await maybeUpdateCompanyPhone(partnerComp, partnerPhone);

                const teamName = normalizeNameKey(row?.['해당팀'] || row?.['현장담당'] || row?.['담당팀']);
                const responsibleTeam = teamName
                    ? (teamsByName.get(teamName) ?? teamsByNormalizedName.get(normalizeNameKey(teamName)))
                    : undefined;
                const responsibleTeamId = responsibleTeam?.id ? String(responsibleTeam.id) : '';
                const responsibleTeamName = responsibleTeam?.name ? String(responsibleTeam.name) : (teamName || '');

                const startDate = getCellString(formatExcelDate(row?.['착공일']));
                const endDate = getCellString(formatExcelDate(row?.['준공일']));

                const code = getCellString(row?.['현장코드']);
                const address = getCellString(row?.['주소']);
                const siteType = normalizeSiteTypeValue(getSiteTypeRawFromSiteRow(row));
                const paymentMethod = normalizePaymentMethodValue(getPaymentMethodRawFromSiteRow(row));

                const existing = sitesByName.get(siteName);
                if (item.action === 'CREATE') {
                    const createdId = await siteService.addSite({
                        name: siteName,
                        companyId: companyId || undefined,
                        companyName: companyNameVal || undefined,
                        clientCompanyId: clientCompanyId || undefined,
                        clientCompanyName: clientCompanyName || undefined,
                        partnerId: partnerId || undefined,
                        partnerName: partnerName || undefined,
                        responsibleTeamId: responsibleTeamId || undefined,
                        responsibleTeamName: responsibleTeamName || undefined,
                        code: code || '',
                        status: 'active',
                        address: address || '',
                        startDate: startDate || undefined,
                        endDate: endDate || undefined,
                        siteType,
                        paymentMethod
                    });
                    const createdSite: Site = {
                        id: createdId,
                        name: siteName,
                        companyId: companyId || undefined,
                        companyName: companyNameVal || undefined,
                        clientCompanyId: clientCompanyId || undefined,
                        clientCompanyName: clientCompanyName || undefined,
                        partnerId: partnerId || undefined,
                        partnerName: partnerName || undefined,
                        responsibleTeamId: responsibleTeamId || undefined,
                        responsibleTeamName: responsibleTeamName || undefined,
                        code: code || '',
                        status: 'active',
                        address: address || '',
                        startDate: startDate || undefined,
                        endDate: endDate || undefined,
                        siteType,
                        paymentMethod
                    } as Site;
                    sitesByName.set(siteName, createdSite);
                    sitesByNormalizedName.set(normalizeNameKey(siteName), createdSite);
                    return;
                }

                if (!existing?.id) throw new Error('DB 기존 현장 조회 실패');
                await siteService.updateSite(existing.id, {
                    siteType: siteType || existing.siteType,
                    paymentMethod: paymentMethod || existing.paymentMethod,
                    name: siteName,
                    companyId: shouldClearCompany ? undefined : (companyId || existing.companyId),
                    companyName: shouldClearCompany ? undefined : (companyNameVal || existing.companyName),
                    clientCompanyId: clientCompanyId || existing.clientCompanyId,
                    clientCompanyName: clientCompanyName || existing.clientCompanyName,
                    partnerId: partnerId || existing.partnerId,
                    partnerName: partnerName || existing.partnerName,
                    responsibleTeamId: responsibleTeamId || existing.responsibleTeamId,
                    responsibleTeamName: responsibleTeamName || existing.responsibleTeamName,
                    code: code || existing.code,
                    address: address || existing.address,
                    startDate: startDate || existing.startDate,
                    endDate: endDate || existing.endDate,
                    status: existing.status
                });

                const nextSite: Site = {
                    ...existing,
                    name: siteName,
                    companyId: shouldClearCompany ? existing.companyId : (companyId || existing.companyId),
                    companyName: shouldClearCompany ? existing.companyName : (companyNameVal || existing.companyName),
                    clientCompanyId: clientCompanyId || existing.clientCompanyId,
                    clientCompanyName: clientCompanyName || existing.clientCompanyName,
                    partnerId: partnerId || existing.partnerId,
                    partnerName: partnerName || existing.partnerName,
                    responsibleTeamId: responsibleTeamId || existing.responsibleTeamId,
                    responsibleTeamName: responsibleTeamName || existing.responsibleTeamName,
                    code: code || existing.code,
                    address: address || existing.address,
                    startDate: startDate || existing.startDate,
                    endDate: endDate || existing.endDate,
                    siteType: siteType || existing.siteType,
                    paymentMethod: paymentMethod || existing.paymentMethod
                } as Site;
                sitesByName.set(siteName, nextSite);
                sitesByNormalizedName.set(normalizeNameKey(siteName), nextSite);
            });

            await processMapped('Worker', mappingAnalysis.Worker || [], async (item) => {
                const row = item.row;
                const name = normalizeNameKey(row?.['이름'] || row?.['성명']);
                if (!name) throw new Error('이름 누락');

                const rowTeamName = normalizeNameKey(row?.['소속팀'] || row?.['팀명'] || row?.['팀']);
                const team = rowTeamName
                    ? (teamsByName.get(rowTeamName) ?? teamsByNormalizedName.get(normalizeNameKey(rowTeamName)))
                    : undefined;
                const teamId = team?.id || '';
                const teamName = team?.name || rowTeamName || '';

                const rowCompanyName = normalizeNameKey(row?.['회사명'] || row?.['소속회사']);
                const resolvedWorkerCompany = rowCompanyName
                    ? (companiesByName.get(rowCompanyName) ?? companiesByNormalizedName.get(normalizeNameKey(rowCompanyName)))
                    : undefined;

                const companyNameFromRow = resolvedWorkerCompany?.name ? String(resolvedWorkerCompany.name) : (rowCompanyName || '');
                const companyNameFromTeam = team?.companyName ? String(team.companyName) : '';
                const companyNameFromTeamCompanyId = team?.companyId
                    ? (companiesById.get(String(team.companyId))?.name ? String(companiesById.get(String(team.companyId))!.name) : '')
                    : '';

                const companyName = companyNameFromRow || companyNameFromTeam || companyNameFromTeamCompanyId;

                const unitPrice = getUnitPriceFromRow(row);

                const bankName = getWorkerBankNameFromRow(row);
                const accountNumber = getWorkerAccountNumberFromRow(row);
                const accountHolder = getWorkerAccountHolderFromRow(row);

                const existing = workersByName.get(name);
                if (item.action === 'CREATE') {
                    const createdId = await manpowerService.addWorker({
                        name,
                        teamId,
                        teamName,
                        companyId: '',
                        companyName,
                        role: getCellString(row?.['직종'] || row?.['역할']) || '작업자',
                        contact: getCellString(row?.['연락처'] || row?.['휴대폰']),
                        idNumber: getCellString(row?.['주민번호']),
                        address: getCellString(row?.['주소']),
                        unitPrice: unitPrice ?? 0,
                        payType: getPayTypeFromRow(row) || '일급제',
                        bankName,
                        accountNumber,
                        accountHolder,
                        teamType: getCellString(row?.['팀구분']) || '일용직',
                        status: 'active'
                    });
                    workersByName.set(name, {
                        id: createdId,
                        name,
                        idNumber: getCellString(row?.['주민번호']),
                        address: getCellString(row?.['주소']),
                        contact: getCellString(row?.['연락처'] || row?.['휴대폰']),
                        role: getCellString(row?.['직종'] || row?.['역할']) || '작업자',
                        teamId,
                        teamName,
                        teamType: getCellString(row?.['팀구분']) || '일용직',
                        status: 'active',
                        unitPrice: unitPrice ?? 0,
                        payType: getPayTypeFromRow(row) || '일급제',
                        companyName,
                        bankName,
                        accountNumber,
                        accountHolder
                    } as Worker);
                    workersByNormalizedName.set(normalizeNameKey(name), workersByName.get(name)!);
                    return;
                }

                if (!existing?.id) throw new Error('DB 기존 작업자 조회 실패');
                await manpowerService.updateWorker(existing.id, {
                    name,
                    teamId: teamId || existing.teamId,
                    teamName: teamName || existing.teamName,
                    companyName: companyName || existing.companyName,
                    role: getCellString(row?.['직종'] || row?.['역할']) || existing.role,
                    contact: getCellString(row?.['연락처'] || row?.['휴대폰']) || existing.contact,
                    idNumber: getCellString(row?.['주민번호']) || existing.idNumber,
                    address: getCellString(row?.['주소']) || existing.address,
                    unitPrice: unitPrice !== undefined ? unitPrice : existing.unitPrice,
                    payType: getPayTypeFromRow(row) || existing.payType,
                    bankName: bankName || existing.bankName,
                    accountNumber: accountNumber || existing.accountNumber,
                    accountHolder: accountHolder || existing.accountHolder
                });

                const nextWorker: Worker = {
                    ...existing,
                    name,
                    teamId: teamId || existing.teamId,
                    teamName: teamName || existing.teamName,
                    companyName: companyName || existing.companyName,
                    role: getCellString(row?.['직종'] || row?.['역할']) || existing.role,
                    contact: getCellString(row?.['연락처'] || row?.['휴대폰']) || existing.contact,
                    idNumber: getCellString(row?.['주민번호']) || existing.idNumber,
                    address: getCellString(row?.['주소']) || existing.address,
                    unitPrice: unitPrice !== undefined ? unitPrice : existing.unitPrice,
                    payType: getPayTypeFromRow(row) || existing.payType,
                    bankName: bankName || existing.bankName,
                    accountNumber: accountNumber || existing.accountNumber,
                    accountHolder: accountHolder || existing.accountHolder
                } as Worker;
                workersByName.set(name, nextWorker);
                workersByNormalizedName.set(normalizeNameKey(name), nextWorker);
            });

            if (pendingTeamLeaderNames.size > 0) {
                let i = 0;
                for (const [teamName, leaderName] of pendingTeamLeaderNames.entries()) {
                    i++;
                    const team = teamsByName.get(teamName) ?? teamsByNormalizedName.get(normalizeNameKey(teamName));
                    if (!team?.id) continue;

                    const currentLeaderName = normalizeNameKey((team as any)?.leaderName);
                    if (team.leaderId && currentLeaderName && currentLeaderName === normalizeNameKey(leaderName)) {
                        continue;
                    }

                    const worker = workersByName.get(leaderName) ?? workersByNormalizedName.get(normalizeNameKey(leaderName));
                    if (!worker?.id) {
                        errors.push({ type: 'Team', key: teamName, message: `팀장 작업자 미등록: ${leaderName}` });
                        continue;
                    }

                    try {
                        await teamService.updateTeam(team.id, { leaderId: String(worker.id) });
                        const nextTeam: Team = { ...team, leaderId: String(worker.id), leaderName } as Team;
                        teamsByName.set(team.name, nextTeam);
                        teamsByNormalizedName.set(normalizeNameKey(team.name), nextTeam);
                    } catch (e) {
                        errors.push({ type: 'Team', key: teamName, message: e instanceof Error ? e.message : String(e) });
                    }

                    if (i % 25 === 0) {
                        await yieldToBrowser();
                    }
                }
            }

            // --- 5. Daily Report (출력일보) ---
            const reportData = previewData['DailyReport'];
            if (reportData.length > 0) {
                updateLog('DailyReport', 'processing', `일보 데이터 처리 중...`);

                const requiredSiteNames = new Set<string>();
                const siteToResponsibleTeamName = new Map<string, string>();
                const siteToSiteType = new Map<string, Site['siteType']>();
                const siteToPaymentMethod = new Map<string, Site['paymentMethod']>();
                reportData.forEach((row: any) => {
                    const siteName = normalizeNameKey(row?.['현장명'] || row?.['현장']);
                    if (!siteName) return;
                    requiredSiteNames.add(siteName);

                    const responsibleTeamName = getCellString(row?.['해당팀'] ?? row?.['현장담당']);
                    if (responsibleTeamName && !siteToResponsibleTeamName.has(siteName)) {
                        siteToResponsibleTeamName.set(siteName, responsibleTeamName);
                    }

                    if (!siteToSiteType.has(siteName)) {
                        const normalizedSiteType = normalizeSiteTypeValue(getSiteTypeRawFromDailyRow(row));
                        if (normalizedSiteType) {
                            siteToSiteType.set(siteName, normalizedSiteType);
                        }
                    }
                    if (!siteToPaymentMethod.has(siteName)) {
                        const normalizedPaymentMethod = normalizePaymentMethodValue(getPaymentMethodRawFromDailyRow(row));
                        if (normalizedPaymentMethod) {
                            siteToPaymentMethod.set(siteName, normalizedPaymentMethod);
                        }
                    }
                });

                const missingSiteNames = Array.from(requiredSiteNames.values()).filter((siteName) => {
                    const existingSite = sitesByName.get(siteName) ?? sitesByNormalizedName.get(siteName);
                    return !existingSite?.id;
                });

                if (missingSiteNames.length > 0) {
                    const confirmMissingSites = await Swal.fire({
                        title: '일보 현장 자동 생성',
                        html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">일보에 포함된 현장 중 DB/현장시트에서 찾지 못한 현장이 있습니다.<br/>자동으로 생성할까요?<br/><br/>${missingSiteNames.slice(0, 20).map((n) => `- ${n}`).join('<br/>')}${missingSiteNames.length > 20 ? '<br/>...' : ''}</div>`,
                        icon: 'warning',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: '자동 생성',
                        denyButtonText: '그대로 진행',
                        cancelButtonText: '취소'
                    });
                    if (confirmMissingSites.isDismissed) return;

                    if (confirmMissingSites.isConfirmed) {
                        for (const siteName of missingSiteNames) {
                            const responsibleTeamName = siteToResponsibleTeamName.get(siteName) ?? '';
                            const team = responsibleTeamName
                                ? (teamsByName.get(responsibleTeamName) ?? teamsByNormalizedName.get(normalizeNameKey(responsibleTeamName)))
                                : undefined;

                            const createdId = await siteService.addSite({
                                name: siteName,
                                code: '',
                                address: '',
                                status: 'active',
                                responsibleTeamId: team?.id ? String(team.id) : undefined,
                                responsibleTeamName: team?.name ? String(team.name) : (responsibleTeamName || undefined),
                                siteType: siteToSiteType.get(siteName),
                                paymentMethod: siteToPaymentMethod.get(siteName)
                            });

                            const createdSite: Site = {
                                id: createdId,
                                name: siteName,
                                code: '',
                                address: '',
                                status: 'active',
                                responsibleTeamId: team?.id ? String(team.id) : undefined,
                                responsibleTeamName: team?.name ? String(team.name) : (responsibleTeamName || undefined),
                                siteType: siteToSiteType.get(siteName),
                                paymentMethod: siteToPaymentMethod.get(siteName)
                            } as Site;
                            sitesByName.set(siteName, createdSite);
                            sitesByNormalizedName.set(normalizeNameKey(siteName), createdSite);
                        }
                    }
                }

                for (const siteName of requiredSiteNames.values()) {
                    const existingSite = sitesByName.get(siteName) ?? sitesByNormalizedName.get(siteName);
                    if (!existingSite?.id) continue;

                    const nextSiteType = siteToSiteType.get(siteName);
                    const nextPaymentMethod = siteToPaymentMethod.get(siteName);
                    const shouldUpdateSiteType = Boolean(nextSiteType && nextSiteType !== existingSite.siteType);
                    const shouldUpdatePaymentMethod = Boolean(nextPaymentMethod && nextPaymentMethod !== existingSite.paymentMethod);
                    if (!shouldUpdateSiteType && !shouldUpdatePaymentMethod) continue;

                    try {
                        await siteService.updateSite(String(existingSite.id), {
                            siteType: nextSiteType || existingSite.siteType,
                            paymentMethod: nextPaymentMethod || existingSite.paymentMethod
                        });
                        const nextSite: Site = {
                            ...existingSite,
                            siteType: nextSiteType || existingSite.siteType,
                            paymentMethod: nextPaymentMethod || existingSite.paymentMethod
                        } as Site;
                        sitesByName.set(siteName, nextSite);
                        sitesByNormalizedName.set(normalizeNameKey(siteName), nextSite);
                    } catch (e) {
                        errors.push({
                            type: 'Site',
                            key: siteName,
                            message: `일보 기반 현장구분/결제구분 업데이트 실패: ${e instanceof Error ? e.message : String(e)}`
                        });
                    }
                }

                const requiredTeamNames = new Set<string>();
                const requiredWorkerNames = new Set<string>();
                reportData.forEach((row: any) => {
                    const teamName = normalizeNameKey(row?.['팀명'] || row?.['팀'] || row?.['해당팀'] || row?.['현장담당']);
                    if (teamName) requiredTeamNames.add(teamName);
                    const workerName = normalizeNameKey(row?.['이름']);
                    if (workerName) requiredWorkerNames.add(workerName);
                });

                const missingTeamNames = Array.from(requiredTeamNames.values()).filter((teamName) => {
                    const t = teamsByName.get(teamName) ?? teamsByNormalizedName.get(teamName);
                    return !t?.id;
                });

                if (missingTeamNames.length > 0) {
                    const confirmMissingTeams = await Swal.fire({
                        title: '일보 팀 자동 생성',
                        html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">일보에 포함된 팀 중 DB/팀시트에서 찾지 못한 팀이 있습니다.<br/>자동으로 생성할까요?<br/><br/>${missingTeamNames.slice(0, 20).map((n) => `- ${n}`).join('<br/>')}${missingTeamNames.length > 20 ? '<br/>...' : ''}</div>`,
                        icon: 'warning',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: '자동 생성',
                        denyButtonText: '그대로 진행',
                        cancelButtonText: '취소'
                    });
                    if (confirmMissingTeams.isDismissed) return;
                    if (confirmMissingTeams.isConfirmed) {
                        for (const teamName of missingTeamNames) {
                            const createdId = await teamService.addTeam({
                                name: teamName,
                                companyId: undefined,
                                leaderName: '',
                                role: '기타',
                                leaderId: '',
                                type: '일반'
                            } as Team);
                            const createdTeam: Team = {
                                id: createdId,
                                name: teamName,
                                companyId: undefined,
                                companyName: undefined,
                                leaderName: '',
                                role: '기타',
                                leaderId: '',
                                type: '일반'
                            } as Team;
                            teamsByName.set(teamName, createdTeam);
                            teamsByNormalizedName.set(normalizeNameKey(teamName), createdTeam);
                        }
                    }
                }

                const missingWorkerNames = Array.from(requiredWorkerNames.values()).filter((workerName) => {
                    const w = workersByName.get(workerName) ?? workersByNormalizedName.get(workerName);
                    return !w?.id;
                });

                if (missingWorkerNames.length > 0) {
                    const confirmMissingWorkers = await Swal.fire({
                        title: '일보 작업자 자동 생성',
                        html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">일보에 포함된 작업자 중 DB/작업자시트에서 찾지 못한 작업자가 있습니다.<br/>자동으로 생성할까요?<br/><br/>${missingWorkerNames.slice(0, 20).map((n) => `- ${n}`).join('<br/>')}${missingWorkerNames.length > 20 ? '<br/>...' : ''}</div>`,
                        icon: 'warning',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: '자동 생성',
                        denyButtonText: '그대로 진행',
                        cancelButtonText: '취소'
                    });
                    if (confirmMissingWorkers.isDismissed) return;
                    if (confirmMissingWorkers.isConfirmed) {
                        for (const workerName of missingWorkerNames) {
                            const createdId = await manpowerService.addWorker({
                                name: workerName,
                                teamId: '',
                                teamName: '',
                                companyId: '',
                                companyName: '',
                                role: '작업자',
                                contact: '',
                                idNumber: '',
                                address: '',
                                unitPrice: 0,
                                payType: '일급제',
                                bankName: '',
                                accountNumber: '',
                                accountHolder: '',
                                teamType: '일용직',
                                status: 'active'
                            } as Worker);

                            const createdWorker: Worker = {
                                id: createdId,
                                name: workerName,
                                teamId: '',
                                teamName: '',
                                companyId: '',
                                companyName: '',
                                role: '작업자',
                                contact: '',
                                idNumber: '',
                                address: '',
                                unitPrice: 0,
                                payType: '일급제',
                                bankName: '',
                                accountNumber: '',
                                accountHolder: '',
                                teamType: '일용직',
                                status: 'active'
                            } as Worker;
                            workersByName.set(workerName, createdWorker);
                            workersByNormalizedName.set(normalizeNameKey(workerName), createdWorker);
                        }
                    }
                }

                const dailyItems = mappingAnalysis.DailyReport || [];
                const dailyKeyToRows = new Map<DailyReportKey, any[]>();
                reportData.forEach((row: any) => {
                    const date = getCellString(formatExcelDate(row?.['날짜'] || row?.['작업일']));
                    const siteName = normalizeNameKey(row?.['현장명'] || row?.['현장']);
                    const teamName = normalizeNameKey(row?.['팀명'] || row?.['팀'] || row?.['해당팀'] || row?.['현장담당']);
                    if (!date || !siteName || !teamName) return;
                    const key = `${date}_${siteName}_${teamName}` as DailyReportKey;
                    const list = dailyKeyToRows.get(key) ?? [];
                    list.push(row);
                    dailyKeyToRows.set(key, list);
                });

                const hasMerge = dailyItems.some((it) => it.action === 'MERGE');
                const dailyMode: 'merge' | 'overwrite' = hasMerge ? dailyReportExistingMode : 'merge';

                let ok = 0;
                let skipped = 0;
                let failed = 0;
                const skippedUnchangedKeys: string[] = [];
                const skippedConflictKeys: string[] = [];

                for (let i = 0; i < dailyItems.length; i++) {
                    const item = dailyItems[i];
                    if (item.status === 'CONFLICT' || item.action === 'SKIP' || item.status === 'UNCHANGED') {
                        skipped++;
                        if (item.status === 'CONFLICT') {
                            if (item.key) skippedConflictKeys.push(String(item.key));
                        } else {
                            if (item.key) skippedUnchangedKeys.push(String(item.key));
                        }
                        continue;
                    }

                    const key = getCellString(item.key) as DailyReportKey;
                    const rows = dailyKeyToRows.get(key) ?? [];
                    if (rows.length <= 0) {
                        failed++;
                        errors.push({ type: 'DailyReport', key, message: '파일에서 해당 일보 그룹을 찾을 수 없습니다.' });
                        continue;
                    }

                    const date = getCellString((item.row as any)?.date) || String(key).split('_')[0] || '';
                    const siteName = normalizeNameKey((item.row as any)?.siteName) || normalizeNameKey(String(key).split('_')[1] || '');
                    const teamName = normalizeNameKey((item.row as any)?.teamName) || normalizeNameKey(String(key).split('_')[2] || '');

                    const site = sitesByName.get(siteName) ?? sitesByNormalizedName.get(siteName);
                    if (!site?.id) {
                        failed++;
                        errors.push({ type: 'DailyReport', key, message: `현장 미등록: ${siteName}` });
                        continue;
                    }

                    const team = teamsByName.get(teamName) ?? teamsByNormalizedName.get(teamName);
                    if (!team?.id) {
                        failed++;
                        errors.push({ type: 'DailyReport', key, message: `팀 미등록: ${teamName}` });
                        continue;
                    }

                    const dailySiteType = getFirstNormalizedSiteTypeFromRows(rows) ?? normalizeSiteTypeValue(site.siteType);
                    const dailyPaymentMethod = getFirstNormalizedPaymentMethodFromRows(rows) ?? normalizePaymentMethodValue(site.paymentMethod);

                    const mappedWorkersByName = new Map<string, DailyReportWorker>();
                    for (const r of rows) {
                        const wName = normalizeNameKey(r?.['이름']);
                        if (!wName) continue;
                        const cached = workersByName.get(wName) ?? workersByNormalizedName.get(wName);

                        const manDayRaw = r?.['공수'];
                        const manDayCandidate = manDayRaw === undefined || manDayRaw === null || manDayRaw === ''
                            ? 1.0
                            : Number(manDayRaw);
                        const manDay = Number.isFinite(manDayCandidate) ? manDayCandidate : 1.0;

                        const unitPriceRaw = r?.['단가'] ?? r?.['일당'] ?? r?.['임금'] ?? r?.['급여'];
                        const unitPriceText = getCellString(unitPriceRaw);
                        const unitPriceCandidate = unitPriceText !== ''
                            ? Number(unitPriceText.replace(/[^0-9]/g, ''))
                            : (cached?.unitPrice ?? 0);
                        const unitPrice = Number.isFinite(unitPriceCandidate) ? unitPriceCandidate : 0;

                        const role = getCellString(r?.['직종']) || getCellString(cached?.role) || '작업자';
                        // payType은 엑셀 파일 값을 우선적으로 사용, 없을 때 작업자 정보에서 가져옴
                        const payType = getPayTypeFromRow(r) || getCellString((cached as any)?.payType ?? (cached as any)?.salaryModel) || '일급제';
                        const status: DailyReportWorker['status'] = 'attendance';

                        const mapped: DailyReportWorker = {
                            workerId: cached?.id ? String(cached.id) : 'unknown',
                            name: wName,
                            role,
                            status,
                            manDay,
                            workContent: getCellString(r?.['작업내용']),
                            teamId: cached?.teamId ? String(cached.teamId) : (team.id ? String(team.id) : undefined),
                            unitPrice,
                            payType,
                            salaryModel: payType,
                            siteType: dailySiteType,
                            paymentType: dailyPaymentMethod
                        };
                        mappedWorkersByName.set(wName, mapped);
                    }

                    const mappedWorkers = Array.from(mappedWorkersByName.values());

                    if (mappedWorkers.length <= 0) {
                        failed++;
                        errors.push({ type: 'DailyReport', key, message: '일보 작업자 목록이 비어있습니다.' });
                        continue;
                    }

                    const base: Omit<DailyReport, 'id'> = {
                        date,
                        siteId: String(site.id),
                        siteName,
                        teamId: String(team.id),
                        teamName,
                        workers: mappedWorkers,
                        totalManDay: mappedWorkers.reduce((sum, w) => sum + (typeof w.manDay === 'number' ? w.manDay : 0), 0),
                        writerId: currentUser?.uid || 'system',
                        companyName: site.companyName || '',
                        responsibleTeamName: site.responsibleTeamName || '',
                        siteType: dailySiteType,
                        paymentType: dailyPaymentMethod
                    };

                    try {
                        if (item.action === 'CREATE') {
                            await dailyReportService.addReport(base);
                            ok++;
                        } else if (item.action === 'MERGE') {
                            const existingReport = item.existingData as DailyReport | undefined;
                            const existingId = existingReport?.id ? String(existingReport.id) : '';
                            if (!existingId) throw new Error('기존 일보 ID를 찾을 수 없습니다.');

                            const prevWorkers = Array.isArray(existingReport?.workers) ? existingReport!.workers : [];

                            const prevByName = new Map<string, DailyReportWorker>();
                            prevWorkers.forEach((w: DailyReportWorker) => {
                                const n = normalizeNameKey(w?.name);
                                if (!n) return;
                                prevByName.set(n, w);
                            });

                            const mappedByName = new Map<string, DailyReportWorker>();
                            mappedWorkers.forEach((w) => {
                                const n = normalizeNameKey(w?.name);
                                if (!n) return;

                                const prev = prevByName.get(n);
                                const nextWorkerId = (getCellString(w?.workerId).startsWith('unknown') && prev?.workerId)
                                    ? String(prev.workerId)
                                    : String(w.workerId);

                                mappedByName.set(n, { ...w, workerId: nextWorkerId });
                            });

                            const nextWorkers = dailyMode === 'overwrite'
                                ? Array.from(mappedByName.values())
                                : (() => {
                                    const next = new Map<string, DailyReportWorker>();
                                    prevByName.forEach((w, k) => next.set(k, w));
                                    mappedByName.forEach((w, k) => {
                                        const existing = next.get(k);
                                        if (existing) {
                                            // payType을 포함한 모든 필드를 업데이트
                                            next.set(k, {
                                                ...existing,
                                                ...w,
                                                // payType은 항상 엑셀 값 또는 작업자 정보에서 최신 값으로 업데이트
                                                payType: w.payType,
                                                salaryModel: w.salaryModel ?? w.payType
                                            });
                                        } else {
                                            next.set(k, w);
                                        }
                                    });
                                    return Array.from(next.values());
                                })();

                            await dailyReportService.updateReport(existingId, {
                                ...base,
                                workers: nextWorkers,
                                totalManDay: nextWorkers.reduce((sum, w) => sum + (typeof w.manDay === 'number' ? w.manDay : 0), 0)
                            });
                            ok++;
                        }
                    } catch (e) {
                        failed++;
                        errors.push({
                            type: 'DailyReport',
                            key,
                            message: e instanceof Error ? e.message : String(e)
                        });
                    }

                    if ((i + 1) % 10 === 0) {
                        await yieldToBrowser();
                    }
                }

                updateLog('DailyReport', failed > 0 ? 'error' : 'success', `완료 (성공 ${ok}, 스킵 ${skipped}, 실패 ${failed})`, ok);
                if (skipped > 0) {
                    const unchangedCount = skippedUnchangedKeys.length;
                    const conflictCount = skippedConflictKeys.length;
                    const unchangedLines = skippedUnchangedKeys.slice(0, 10).map((k) => `- ${k}`).join('<br/>');
                    const conflictLines = skippedConflictKeys.slice(0, 10).map((k) => `- ${k}`).join('<br/>');
                    await Swal.fire({
                        title: '일보 스킵 안내',
                        html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">` +
                            `<div><b>스킵 ${skipped}건</b> (동일 ${unchangedCount}건, 충돌 ${conflictCount}건)</div>` +
                            `<div style="margin-top:8px;">동일(변경 없음)으로 스킵된 일보는 <b>DB에 이미 존재하는 일보를 그대로 유지</b>합니다. (엑셀 변경사항 저장 없음)</div>` +
                            (unchangedCount > 0 ? `<div style="margin-top:8px;"><b>동일(변경 없음) 예시</b><br/>${unchangedLines}${unchangedCount > 10 ? '<br/>...' : ''}</div>` : '') +
                            (conflictCount > 0 ? `<div style="margin-top:8px;"><b>충돌 예시</b><br/>${conflictLines}${conflictCount > 10 ? '<br/>...' : ''}</div>` : '') +
                            `</div>`,
                        icon: 'info'
                    });
                }
            } else {
                updateLog('DailyReport', 'success', '데이터 없음 (건너뜀)');
            }

            if (errors.length > 0) {
                const lines = errors.slice(0, 20).map((e) => `- [${e.type}] ${e.key}: ${e.message}`);
                await Swal.fire({
                    title: '완료(일부 실패)',
                    html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">총 실패 ${errors.length}건<br/>${lines.join('<br/>')}${errors.length > 20 ? '<br/>...' : ''}</div>`,
                    icon: 'warning'
                });
            } else {
                await Swal.fire('완료', '모든 데이터가 통합 처리되었습니다.', 'success');
            }

        } catch (error) {
            console.error(error);
            Swal.fire('오류', '데이터 처리 중 오류가 발생했습니다.', 'error');
        } finally {
            // Optional: setStage('upload') to reset?
        }
    };

    const handleCancel = () => {
        setStage('upload');
        setPreviewData({ Company: [], Team: [], Site: [], Worker: [], DailyReport: [] });
        setPreviewAnalysis({ Company: [], Team: [], Site: [], Worker: [], DailyReport: [] });
        setMappingAnalysis({ Company: [], Team: [], Site: [], Worker: [], DailyReport: [] });
        setShowOnlyIssues(false);
        setPreviewPage(1);
    };

    const handleResetIntegratedData = async () => {
        const confirmed = await Swal.fire({
            icon: 'warning',
            title: '통합 데이터 초기화',
            html: '<div class="text-sm text-slate-600 text-left leading-6">회사, 팀, 현장, 작업자, 출력일보 데이터를 모두 삭제합니다.<br />계속하려면 <strong>통합초기화</strong>를 입력하세요.</div>',
            input: 'text',
            inputPlaceholder: '통합초기화',
            showCancelButton: true,
            confirmButtonText: '초기화',
            cancelButtonText: '취소',
            preConfirm: (value) => {
                if (String(value ?? '').trim() !== '통합초기화') {
                    Swal.showValidationMessage("'통합초기화'를 입력하세요.");
                }
                return value;
            }
        });
        if (!confirmed.isConfirmed) return;

        const updateResetProgress = (message: string) => {
            if (!Swal.isVisible()) return;
            Swal.update({
                html: `<div class="text-sm text-slate-600 leading-6">${message}</div>`
            });
        };

        setIsResettingData(true);
        Swal.fire({
            title: '초기화 중',
            html: '<div class="text-sm text-slate-600 leading-6">출력일보 데이터를 정리하고 있습니다.</div>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            updateResetProgress('출력일보 데이터를 초기화하고 있습니다.');
            const dailyReportResult = await dailyReportTransferService.resetDb();

            updateResetProgress('작업자 데이터를 초기화하고 있습니다.');
            const workerCount = await resetCollection('workers');

            updateResetProgress('현장 데이터를 초기화하고 있습니다.');
            const siteCount = await resetCollection('sites');

            updateResetProgress('팀 데이터를 초기화하고 있습니다.');
            const teamCount = await resetCollection('teams');

            updateResetProgress('회사 데이터를 초기화하고 있습니다.');
            const companyCount = await resetCollection('companies');

            handleCancel();
            Swal.close();

            await Swal.fire({
                icon: 'success',
                title: '초기화 완료',
                html: '<div class="text-sm text-slate-600 text-left leading-6">'
                    + `회사 ${companyCount.toLocaleString()}건<br />`
                    + `팀 ${teamCount.toLocaleString()}건<br />`
                    + `현장 ${siteCount.toLocaleString()}건<br />`
                    + `작업자 ${workerCount.toLocaleString()}건<br />`
                    + `출력일보 ${dailyReportResult.reports.toLocaleString()}건<br />`
                    + `일보상세 ${dailyReportResult.legacyRows.toLocaleString()}건`
                    + '</div>'
            });
        } catch (error) {
            console.error('[IntegratedMassUploader] reset failed', error);
            Swal.close();
            await Swal.fire('오류', '통합 데이터 초기화에 실패했습니다.', 'error');
        } finally {
            setIsResettingData(false);
        }
    };

    const previewPageSizeOptions = [50, 100, 200, 500];

    const renderPreviewTableArea = () => {
        const rawRows = previewData[activeTab] || [];
        const annotations = previewAnalysis[activeTab] || [];
        const mapping = mappingAnalysis[activeTab] || [];
        const isDailyReportTab = activeTab === 'DailyReport';
        const normalizeDailyReportKeyPart = (val: unknown): string => getCellString(val).replace(/\s+/g, ' ');
        const buildDailyReportKeyFromRow = (row: any): DailyReportKey | '' => {
            const date = getCellString(formatExcelDate(row?.['날짜'] ?? row?.['작업일']));
            const siteName = normalizeDailyReportKeyPart(row?.['현장명'] ?? row?.['현장']);
            const teamName = normalizeDailyReportKeyPart(row?.['팀명'] ?? row?.['팀'] ?? row?.['해당팀'] ?? row?.['현장담당']);
            if (!date || !siteName || !teamName) return '';
            return `${date}_${siteName}_${teamName}` as DailyReportKey;
        };
        const mappingByKey = new Map<string, MappedRow>(mapping.map((m) => [m.key, m] as const));
        const rawHeaderSet = new Set<string>();

        rawRows.forEach((row) => {
            Object.keys(row || {}).forEach((header) => {
                if (!/^__EMPTY/i.test(header)) {
                    rawHeaderSet.add(header);
                }
            });
        });

        const dailyPreferredHeaders = ['날짜', '현장명', '팀명', '해당팀', '이름', '직종', '공수', '급여방식', '단가', '현장구분', '결제구분', '작업내용'];
        const preferredHeaders = isDailyReportTab
            ? dailyPreferredHeaders
            : (TEMPLATE_FIELDS[activeTab as TemplateSheetType]?.fields ?? []).map((field) => field.label);
        const rawHeaders = Array.from(rawHeaderSet);
        const baseHeaders = [
            ...preferredHeaders.filter((header) => rawHeaderSet.has(header)),
            ...rawHeaders.filter((header) => !preferredHeaders.includes(header))
        ];
        const headers = ['행', '검사상태', 'DB상태', '처리예정', '문제/변경사유', ...baseHeaders];

        const combinedRows = rawRows.map((row, index) => {
            const annotation = annotations[index];
            const derivedKey = annotation?.key || (isDailyReportTab ? buildDailyReportKeyFromRow(row) : '');
            const mappingItem = isDailyReportTab
                ? (derivedKey ? mappingByKey.get(derivedKey) : undefined)
                : mapping[index] ?? (derivedKey ? mappingByKey.get(derivedKey) : undefined);
            const reasonSet = new Set<string>();

            (annotation?.reasons ?? []).forEach((reason) => reasonSet.add(reason));
            (mappingItem?.changes ?? []).forEach((change) => reasonSet.add(change));
            if (mappingItem?.status === 'CONFLICT' && reasonSet.size === 0) {
                reasonSet.add('DB 데이터와 충돌합니다.');
            }
            if (mappingItem?.action === 'SKIP' && mappingItem?.status !== 'UNCHANGED' && reasonSet.size === 0) {
                reasonSet.add('검토가 필요한 항목이라 건너뜁니다.');
            }

            const hasProblem = annotation?.status === 'INVALID'
                || annotation?.status === 'DUPLICATE'
                || annotation?.status === 'SKIP'
                || mappingItem?.status === 'CONFLICT'
                || (mappingItem?.action === 'SKIP' && mappingItem?.status !== 'UNCHANGED');

            return {
                index,
                row,
                key: derivedKey,
                annotation,
                mappingItem,
                reasons: Array.from(reasonSet),
                hasProblem
            };
        });

        const visibleRows = showOnlyIssues
            ? combinedRows.filter((item) => item.hasProblem)
            : combinedRows;
        const invalidCount = combinedRows.filter((item) => item.annotation?.status === 'INVALID').length;
        const duplicateCount = combinedRows.filter((item) => item.annotation?.status === 'DUPLICATE').length;
        const skipCount = combinedRows.filter((item) => item.annotation?.status === 'SKIP').length;
        const conflictCount = combinedRows.filter((item) => item.mappingItem?.status === 'CONFLICT' || (item.mappingItem?.action === 'SKIP' && item.mappingItem?.status !== 'UNCHANGED')).length;
        const totalPages = Math.max(1, Math.ceil(Math.max(visibleRows.length, 1) / previewPageSize));
        const currentPage = Math.min(previewPage, totalPages);
        const startIndex = visibleRows.length === 0 ? 0 : (currentPage - 1) * previewPageSize;
        const endIndex = visibleRows.length === 0 ? 0 : Math.min(startIndex + previewPageSize, visibleRows.length);
        const pagedRows = visibleRows.slice(startIndex, endIndex);
        const issueHighlights = combinedRows.filter((item) => item.hasProblem).slice(0, 12);
        const issueSummaryItems = [
            { label: '필수값 오류', count: invalidCount, className: 'bg-red-100 text-red-700' },
            { label: '파일 중복', count: duplicateCount, className: 'bg-amber-100 text-amber-700' },
            { label: '건너뜀', count: skipCount, className: 'bg-slate-200 text-slate-700' },
            { label: 'DB 충돌', count: conflictCount, className: 'bg-rose-100 text-rose-700' }
        ].filter((item) => item.count > 0);

        const getPreviewStatusMeta = (status?: PreviewRowStatus) => {
            if (status === 'INVALID') return { label: '필수값 오류', className: 'bg-red-100 text-red-700' };
            if (status === 'DUPLICATE') return { label: '파일 중복', className: 'bg-amber-100 text-amber-700' };
            if (status === 'SKIP') return { label: '건너뜀', className: 'bg-slate-200 text-slate-700' };
            return { label: '정상', className: 'bg-emerald-100 text-emerald-700' };
        };

        const getMappingStatusMeta = (status?: MappingStatus) => {
            if (status === 'NEW') return { label: '신규', className: 'bg-green-100 text-green-700' };
            if (status === 'UPDATE') return { label: '업데이트', className: 'bg-blue-100 text-blue-700' };
            if (status === 'UNCHANGED') return { label: '동일', className: 'bg-gray-100 text-gray-600' };
            if (status === 'CONFLICT') return { label: '충돌', className: 'bg-red-100 text-red-700' };
            return { label: '-', className: 'bg-slate-100 text-slate-500' };
        };

        const getPlannedActionLabel = (item: { mappingItem?: MappedRow; annotation?: PreviewAnnotatedRow }) => {
            if (item.mappingItem?.status === 'CONFLICT') return '충돌';
            if (item.mappingItem?.action === 'SKIP' || item.mappingItem?.status === 'UNCHANGED') return '스킵';
            if (item.mappingItem?.action === 'CREATE') return '생성';
            if (item.mappingItem?.action === 'UPDATE') return '덮어쓰기';
            if (item.mappingItem?.action === 'MERGE') return dailyReportExistingMode === 'overwrite' ? '덮어쓰기' : '병합';
            if (item.annotation?.status === 'INVALID' || item.annotation?.status === 'DUPLICATE' || item.annotation?.status === 'SKIP') return '검토 필요';
            return '생성';
        };

        if (rawRows.length === 0) {
            return (
                <div className="p-12 text-center text-slate-400">
                    <FontAwesomeIcon icon={faFileExcel} className="text-4xl mb-4 opacity-30" />
                    <p>데이터가 없습니다.</p>
                </div>
            );
        }

        return (
            <>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 border-b border-slate-200 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 min-w-[120px]">
                            <div className="text-[11px] font-bold text-slate-500">전체 행</div>
                            <div className="text-lg font-extrabold text-slate-800">{rawRows.length.toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 min-w-[120px]">
                            <div className="text-[11px] font-bold text-slate-500">현재 표시</div>
                            <div className="text-lg font-extrabold text-slate-800">{visibleRows.length.toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 min-w-[160px]">
                            <div className="text-[11px] font-bold text-slate-500">현재 범위</div>
                            <div className="text-sm font-bold text-slate-800">
                                {visibleRows.length === 0 ? '0건' : `${startIndex + 1}-${endIndex} / ${visibleRows.length.toLocaleString()}건`}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xs text-slate-500 font-medium">
                            전체 내역은 페이지로 나눠서 모두 확인할 수 있습니다.
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="font-bold">페이지당</span>
                            <select
                                value={previewPageSize}
                                onChange={(e) => {
                                    setPreviewPageSize(Number(e.target.value));
                                    setPreviewPage(1);
                                }}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                            >
                                {previewPageSizeOptions.map((size) => (
                                    <option key={size} value={size}>{size}건</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                {issueSummaryItems.length > 0 && (
                    <div className="px-6 py-4 bg-rose-50/60 border-b border-slate-200">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-sm font-bold text-slate-700">문제 요약</span>
                            {issueSummaryItems.map((item) => (
                                <span key={item.label} className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.className}`}>
                                    {item.label} {item.count.toLocaleString()}건
                                </span>
                            ))}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {issueHighlights.map((item) => (
                                <div key={`${item.key || 'row'}-${item.index}`} className="rounded-lg border border-rose-100 bg-white px-4 py-3 shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-bold text-rose-700">행 {item.index + 2}</div>
                                        {item.key && <div className="text-[11px] text-slate-400 truncate max-w-[220px]">{item.key}</div>}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {item.reasons.slice(0, 3).map((reason) => (
                                            <div key={reason} className="text-xs text-slate-600 leading-5">• {reason}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="p-0 overflow-x-auto max-h-[500px]">
                    {visibleRows.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <FontAwesomeIcon icon={faFileExcel} className="text-4xl mb-4 opacity-30" />
                            <p>{showOnlyIssues ? '문제행이 없습니다.' : '데이터가 없습니다.'}</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                                <tr>
                                    {headers.map((header, idx) => (
                                        <th key={idx} className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map((item) => {
                                    const previewStatusMeta = getPreviewStatusMeta(item.annotation?.status);
                                    const mappingStatusMeta = getMappingStatusMeta(item.mappingItem?.status);
                                    const plannedActionLabel = getPlannedActionLabel(item);
                                    return (
                                        <tr key={`${item.key || 'row'}-${item.index}`} className={`${item.hasProblem ? 'bg-rose-50/40' : 'bg-white'} border-b hover:bg-slate-50`}>
                                            <td className="px-4 py-4 whitespace-nowrap font-bold text-slate-700">{item.index + 2}</td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${previewStatusMeta.className}`}>
                                                    {previewStatusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${mappingStatusMeta.className}`}>
                                                    {mappingStatusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="text-xs font-bold text-slate-700">{plannedActionLabel}</span>
                                            </td>
                                            <td className="px-4 py-4 min-w-[280px] max-w-[360px]">
                                                <div className="text-xs text-slate-600 leading-5">
                                                    {item.reasons.length > 0 ? item.reasons.map((reason) => (
                                                        <div key={reason}>{reason}</div>
                                                    )) : <span className="text-slate-400">변경사항 없음</span>}
                                                </div>
                                            </td>
                                            {baseHeaders.map((header) => (
                                                <td key={header} className="px-4 py-4 whitespace-nowrap">
                                                    {String(item.row?.[header] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-3 bg-slate-50 text-xs text-slate-500 border-t border-slate-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        {visibleRows.length === 0
                            ? '표시할 항목이 없습니다.'
                            : `${startIndex + 1}-${endIndex} / ${visibleRows.length.toLocaleString()}건 표시`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPreviewPage(1)}
                            disabled={currentPage === 1 || visibleRows.length === 0}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            처음
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1 || visibleRows.length === 0}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            이전
                        </button>
                        <span className="px-2 text-slate-600 font-bold">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPreviewPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages || visibleRows.length === 0}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            다음
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewPage(totalPages)}
                            disabled={currentPage === totalPages || visibleRows.length === 0}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            마지막
                        </button>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">통합 데이터 일괄 등록 (One-Shot Upload)</h1>

            {/* Stage 1: Upload */}
            {stage === 'upload' && (
                <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center animate-fade-in">
                    <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
                        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-5xl text-slate-400 mb-4" />
                                <p className="mb-2 text-lg text-slate-600 font-bold">엑셀 파일 업로드</p>
                                <p className="text-sm text-slate-500">통합 데이터(.xlsx)를 여기에 드래그하거나 클릭하세요</p>
                            </div>
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className="mt-6 flex justify-center gap-4">
                        <button
                            type="button"
                            onClick={downloadIntegratedTemplateExcel}
                            className="px-6 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faDownload} /> 샘플 양식 다운로드
                        </button>
                        <button
                            type="button"
                            onClick={() => { void handleResetIntegratedData(); }}
                            disabled={isResettingData}
                            className={`px-6 py-3 rounded-lg text-white font-bold transition-colors flex items-center gap-2 ${isResettingData
                                ? 'bg-red-400 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={isResettingData ? faSpinner : faTimes} spin={isResettingData} /> 데이터 초기화
                        </button>
                    </div>
                    <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
                        {Object.values(SHEET_CONFIG).map((conf, idx) => (
                            <div key={idx} className="flex flex-col items-center p-4 bg-slate-50 rounded-lg">
                                <FontAwesomeIcon icon={conf.icon} className="text-2xl text-slate-400 mb-2" />
                                <span className="text-xs font-semibold text-slate-600">{conf.name}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 max-w-5xl mx-auto text-left rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <h3 className="text-base font-extrabold text-slate-800">정밀 업로드 가이드</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            현장/일보의 분류값은 아래 허용값으로 입력해야 정확히 등록됩니다.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">현장구분: 도급 / 직영 / 지원</span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">결제구분: 계산서 / 노무</span>
                        </div>

                        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-bold">시트</th>
                                        <th className="px-3 py-2 text-left font-bold">필수 컬럼</th>
                                        <th className="px-3 py-2 text-left font-bold">선택 컬럼(주요)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Object.keys(TEMPLATE_FIELDS) as TemplateSheetType[]).map((sheetType) => {
                                        const section = TEMPLATE_FIELDS[sheetType];
                                        const required = section.fields.filter((f) => f.required).map((f) => f.label).join(', ') || '-';
                                        const optional = section.fields.filter((f) => !f.required).map((f) => f.label).slice(0, 8).join(', ') || '-';
                                        return (
                                            <tr key={sheetType} className="border-t border-slate-100">
                                                <td className="px-3 py-2 font-bold text-slate-700 whitespace-nowrap">{section.sheetName}</td>
                                                <td className="px-3 py-2 text-slate-700">{required}</td>
                                                <td className="px-3 py-2 text-slate-500">{optional}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">
                            전체 컬럼, 별칭, 허용값은 샘플 파일의 `가이드` 시트에 상세히 포함됩니다.
                        </p>
                    </div>
                </div>
            )}

            {/* Stage 2: Preview */}
            {stage === 'preview' && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faTable} className="text-blue-500" />
                            데이터 미리보기
                        </h2>
                        <div className="flex gap-2 items-center">
                            {mappingAnalysis.DailyReport?.some((m) => m.action === 'MERGE') && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                                    <span className="text-xs font-bold text-slate-700">일보 기존건:</span>
                                    <button
                                        type="button"
                                        onClick={() => setDailyReportExistingMode('overwrite')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${dailyReportExistingMode === 'overwrite'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        덮어쓰기
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDailyReportExistingMode('merge')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${dailyReportExistingMode === 'merge'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        병합
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowOnlyIssues((v) => !v);
                                    setPreviewPage(1);
                                }}
                                className={`px-4 py-2 rounded-lg transition-colors text-sm font-bold ${showOnlyIssues ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`}
                            >
                                {showOnlyIssues ? '문제행만 보기: ON' : '문제행만 보기: OFF'}
                            </button>
                            <button onClick={handleCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2">
                                <FontAwesomeIcon icon={faTimes} /> 취소
                            </button>
                            <button onClick={handleProcess} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2 font-bold">
                                <FontAwesomeIcon icon={faPlay} /> 등록 시작
                            </button>
                        </div>
                    </div>

                    {/* Mapping Statistics */}
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">📊 DB 데이터와의 매핑 분석</h3>
                        <div className="grid grid-cols-5 gap-4">
                            {(Object.keys(SHEET_CONFIG) as SheetType[]).map(type => {
                                const mapping = mappingAnalysis[type] || [];
                                const newCount = mapping.filter(m => m.status === 'NEW').length;
                                const updateCount = mapping.filter(m => m.status === 'UPDATE').length;
                                const unchangedCount = mapping.filter(m => m.status === 'UNCHANGED').length;
                                const conflictCount = mapping.filter(m => m.status === 'CONFLICT').length;

                                return (
                                    <div key={type} className="bg-white rounded-lg p-3 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FontAwesomeIcon icon={SHEET_CONFIG[type].icon} className="text-slate-500" />
                                            <span className="text-xs font-bold text-slate-700">{SHEET_CONFIG[type].name}</span>
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            {newCount > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-green-600">✨ 신규</span>
                                                    <span className="font-bold text-green-700">{newCount}</span>
                                                </div>
                                            )}
                                            {updateCount > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-blue-600">🔄 업데이트</span>
                                                    <span className="font-bold text-blue-700">{updateCount}</span>
                                                </div>
                                            )}
                                            {unchangedCount > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-500">⏸️ 동일</span>
                                                    <span className="font-bold text-gray-600">{unchangedCount}</span>
                                                </div>
                                            )}
                                            {conflictCount > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-red-600">⚠️ 충돌</span>
                                                    <span className="font-bold text-red-700">{conflictCount}</span>
                                                </div>
                                            )}
                                            {mapping.length === 0 && (
                                                <div className="text-slate-400 text-center py-1">-</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        {(Object.keys(SHEET_CONFIG) as SheetType[]).map(type => (
                            (() => {
                                const total = previewData[type].length;
                                const invalidCount = (previewAnalysis[type] ?? []).filter((r) => r.status === 'INVALID').length;
                                const duplicateCount = (previewAnalysis[type] ?? []).filter((r) => r.status === 'DUPLICATE').length;
                                const skipCount = (previewAnalysis[type] ?? []).filter((r) => r.status === 'SKIP').length;
                                const issueCount = invalidCount + duplicateCount + skipCount;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setActiveTab(type);
                                            setPreviewPage(1);
                                        }}
                                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === type
                                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        <FontAwesomeIcon icon={SHEET_CONFIG[type].icon} />
                                        {SHEET_CONFIG[type].name}
                                        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${total > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                            {total}
                                        </span>
                                        {issueCount > 0 && (
                                            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                                문제 {issueCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })()
                        ))}
                    </div>

                    {/* Table Area */}
                    {renderPreviewTableArea()}
                </div>
            )}

            {/* Stage 3: Processing Logs */}
            {stage === 'processing' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800">처리 진행 상황</h2>
                        <button onClick={handleCancel} className="text-sm text-slate-500 underline">처음으로</button>
                    </div>
                    {logs.map((log) => (
                        <div key={log.step} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.status === 'success' ? 'bg-green-100 text-green-600' :
                                    log.status === 'error' ? 'bg-red-100 text-red-600' :
                                        log.status === 'processing' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    {log.status === 'processing' ? <FontAwesomeIcon icon={faSpinner} spin /> :
                                        log.status === 'success' ? <FontAwesomeIcon icon={faCheckCircle} /> :
                                            log.status === 'error' ? <FontAwesomeIcon icon={faExclamationTriangle} /> :
                                                <FontAwesomeIcon icon={faFileExcel} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700">{log.step}</h3>
                                    <p className="text-sm text-slate-500">{log.message}</p>
                                </div>
                            </div>
                            {log.count !== undefined && (
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                    {log.count} Items
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IntegratedMassUploader;
