/**
 * =============================================================================
 * 통합 출력일보 엑셀 업로드 시스템 (상용화 버전 v2.1)
 * =============================================================================
 *
 * ## 1. 목표 및 범위 정의
 *
 * ### 목표
 * - 회사, 현장, 팀, 작업자, 출력일보 데이터를 단일 엑셀 파일로 통합 업로드
 * - 데이터 의존성(회사→현장→팀→작업자→일보)을 자동으로 처리
 * - 상용화 수준의 검증, 미리보기, 에러 핸들링 제공
 *
 * ### 범위
 * - 5개 시트 지원: Company, Site, Team, Worker, DailyReport
 * - 자동 컬럼 매핑 (한글/영문 헤더, 별칭 지원)
 * - 실시간 검증 및 에러/경고 피드백
 * - 미등록 데이터 자동 생성 옵션
 * - 배치 처리 및 진행 상황 표시
 * - 에러 로그 다운로드 (Excel/CSV)
 *
 * ### 지원 필드 목록
 *
 * #### Company (회사)
 * - name: 회사명 (필수)
 * - companyType: 회사구분 (시공사/협력사/발주사)
 * - ceoName: 대표자
 * - businessNumber: 사업자번호
 * - address: 주소
 * - phone: 연락처
 *
 * #### Site (현장)
 * - name: 현장명 (필수)
 * - companyName: 회사명
 * - responsibleTeamName: 담당팀
 * - code: 현장코드
 * - address: 주소
 * - siteType: 현장유형 (도급/직영)
 * - paymentMethod: 결제구분 (계산서/노무)
 * - startDate: 착공일
 * - endDate: 준공일
 *
 * #### Team (팀)
 * - name: 팀명 (필수)
 * - companyName: 소속회사
 * - leaderName: 팀장
 * - type: 팀유형 (지원팀/용역팀/일용직)
 * - role: 주요공종
 *
 * #### Worker (작업자)
 * - name: 이름 (필수)
 * - idNumber: 주민번호
 * - teamName: 소속팀
 * - companyName: 소속회사
 * - position: 직책 (반장/조장/기공/기능공/일반)
 * - unitPrice: 단가
 * - salaryType: 급여구분 (일급제/월급제)
 * - contact: 연락처
 * - address: 주소
 * - bloodType: 혈액형 (A형/B형/O형/AB형)
 * - bankName: 은행
 * - accountNumber: 계좌번호
 * - accountHolder: 예금주
 *
 * #### DailyReport (출력일보)
 * - date: 날짜 (필수)
 * - siteName: 현장명 (필수)
 * - teamName: 팀명 (필수)
 * - workerName: 작업자명 (필수)
 * - manDay: 공수 (필수)
 * - position: 직책
 * - unitPrice: 단가
 * - salaryType: 급여구분
 * - workContent: 작업내용
 * - companyName: 회사명
 * - responsibleTeamName: 현장담당
 *
 * ## 2. 맥락 분석
 *
 * ### 데이터 흐름
 * Company (발주사/협력사)
 *   └── Site (현장) ← responsibleTeam, paymentMethod
 *       └── Team (팀) ← company 연결
 *           └── Worker (작업자) ← team 연결, 개인정보(주민번호/주소/혈액형)
 *               └── DailyReport (출력일보) ← site, team, workers 연결
 *
 * ### 필드 매핑 규칙
 * - companyType → type (회사 서비스)
 * - position → rank (작업자 서비스)
 * - salaryType → payType, salaryModel (작업자/일보 서비스)
 * - paymentMethod → paymentMethod (현장 서비스)
 *
 * ### 기존 시스템 통합
 * - dailyReportService: addReport, updateReport, getReports
 * - manpowerService: addWorker, getWorkers, getWorkerByName
 *   (지원 필드: idNumber, address, bloodType, accountHolder, rank)
 * - teamService: addTeam, getTeams, getTeamByName
 * - siteService: addSite, getSites, getSiteByName
 *   (지원 필드: paymentMethod)
 * - companyService: addCompany, getCompanies, getCompanyByName
 *   (지원 필드: type)
 *
 * ## 3. ⚠️ 위험 요소
 *
 * ### 데이터 무결성
 * - 중복 데이터 생성 방지 (이름 기반 중복 체크)
 * - 순환 참조 방지 (의존성 순서대로 처리)
 * - 트랜잭션 롤백 불가 (Firebase 제약) → 배치 단위 에러 복구
 * - 주민번호 등 민감정보 검증 및 마스킹 처리
 *
 * ### 성능
 * - 대용량 데이터 (1000건+) 처리 시 배치 분할 필수
 * - 캐시 활용으로 중복 API 호출 최소화
 *
 * ### 사용자 경험
 * - 명확한 에러 메시지 (행 번호, 필드명 포함)
 * - 진행 상황 실시간 표시
 * - 취소/재시도 가능
 *
 * ## 4. 🛠️ 구현 전략
 *
 * ### 단계별 처리
 * 1. UPLOAD: 파일 선택 및 시트 감지
 * 2. MAPPING: 컬럼 자동/수동 매핑
 * 3. PREVIEW: 데이터 검증 및 미리보기 (그룹화된 뷰)
 * 4. PROCESSING: 의존성 순서대로 배치 저장
 * 5. COMPLETE: 결과 요약 및 에러 로그
 *
 * ### 검증 전략
 * - 필수 필드 검증
 * - 참조 무결성 검증 (현장→회사, 팀→회사, 작업자→팀)
 * - 중복 데이터 감지
 * - 범위 검증 (공수: 0.5~3.0, 단가: 50,000~1,000,000)
 * - 주민번호 형식 검증 (NNNNNN-NNNNNNN)
 * - 혈액형 유효값 검증 (A형/B형/O형/AB형)
 *
 * ## 5. ✅ 검증 계획
 *
 * ### 테스트 케이스
 * - 빈 시트 처리
 * - 필수 필드 누락
 * - 중복 데이터 처리 (신규/수정/동일)
 * - 미등록 참조 데이터 자동 생성
 * - 대용량 데이터 (500건+) 배치 처리
 * - 네트워크 오류 시 에러 복구
 * - 신규 필드 (주민번호/주소/혈액형/예금주/직책/결제구분) 저장 검증
 * - 회사구분/급여구분 필드 분리 검증
 * - 샘플 파일 다운로드 및 재업로드 테스트
 *
 * ### 예상 샘플 데이터
 * - Company: 3개 회사 (시공사/협력사/발주사)
 * - Site: 3개 현장 (도급/직영, 계산서/노무)
 * - Team: 4개 팀 (지원팀/용역팀/일용직)
 * - Worker: 5명 작업자 (전체 필드 포함)
 * - DailyReport: 6개 일보 (2일치, 3개 현장)
 *
 * @author Claude Code Assistant
 * @version 2.1.0
 * @since 2024-01-01
 * @updated 2026-01-19
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt, faCheckCircle, faSpinner, faExclamationTriangle,
    faFileExcel, faArrowRight, faDatabase, faTimes, faDownload, faCog,
    faBuilding, faMapMarkerAlt, faUsers, faUser, faClipboardList,
    faPlay, faEye, faLayerGroup, faChevronDown, faChevronRight,
    faInfoCircle, faExclamationCircle, faCheck, faSyncAlt,
    faSearch, faFilter, faSortAmountDown, faTable, faThLarge
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReportWorker } from '../../services/dailyReportService';
import { useAuth } from '../../contexts/AuthContext';
import {
    normalizeString, normalizeNumber, formatExcelDate,
    normalizePhone, normalizeBusinessNumber, normalizeNameForCompare
} from '../../utils/excelUtils';
import Swal from 'sweetalert2';

// =============================================================================
// 타입 정의
// =============================================================================

type SheetType = 'Company' | 'Site' | 'Team' | 'Worker' | 'DailyReport';
type Stage = 'UPLOAD' | 'MAPPING' | 'PREVIEW' | 'PROCESSING' | 'COMPLETE';
type ValidationStatus = 'NEW' | 'UPDATE' | 'IDENTICAL' | 'ERROR' | 'WARNING';
type ViewMode = 'table' | 'grouped';

interface FieldDef {
    key: string;
    label: string;
    required?: boolean;
    aliases?: string[];
    example?: string;
    type?: 'string' | 'number' | 'date';
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    status: ValidationStatus;
    changes?: { field: string; oldValue: any; newValue: any }[];
    linkedData?: {
        companyId?: string;
        companyName?: string;
        partnerId?: string;
        partnerName?: string;
        clientCompanyId?: string;
        clientCompanyName?: string;
        siteId?: string;
        siteName?: string;
        teamId?: string;
        teamName?: string;
        workerId?: string;
        workerName?: string;
    };
}

interface ParsedRow {
    _rowIndex: number;
    _sheetType: SheetType;
    _validation?: ValidationResult;
    [key: string]: any;
}

interface GroupedReport {
    key: string;
    date: string;
    siteName: string;
    teamName: string;
    companyName?: string;
    partnerCompanyName?: string;
    clientCompanyName?: string;
    responsibleTeamName?: string;
    paymentMethod?: string;
    workers: ParsedRow[];
    totalManDay: number;
    status: ValidationStatus;
    errors: string[];
    warnings: string[];
}

interface ProcessingLog {
    step: SheetType;
    status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
    message: string;
    progress?: number;
    total?: number;
    success?: number;
    failed?: number;
    skipped?: number;
    details?: string[];
}

interface ErrorLogEntry {
    rowIndex: number;
    sheetType: SheetType;
    rowData: Record<string, any>;
    errors: string[];
    warnings: string[];
    status: ValidationStatus;
    timestamp: string;
}

// =============================================================================
// 상수 정의
// =============================================================================

const PROCESSING_ORDER: SheetType[] = ['Company', 'Site', 'Team', 'Worker', 'DailyReport'];

const SHEET_CONFIG: Record<SheetType, {
    name: string;
    icon: any;
    keywords: string[];
    color: string;
    bgColor: string;
    fields: FieldDef[];
}> = {
    Company: {
        name: '회사',
        icon: faBuilding,
        keywords: ['회사', 'company', '업체', '협력사', '발주사', '시공사'],
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        fields: [
            { key: 'name', label: '회사명', required: true, aliases: ['상호', '업체명', '회사', 'company'], example: '(주)대한건설' },
            { key: 'code', label: '회사코드', aliases: ['코드', 'companyCode', 'code'], example: 'CY001' },
            { key: 'companyType', label: '회사구분', aliases: ['업체구분', '회사유형', '구분', 'type', 'companyType'], example: '시공사' },
            { key: 'ceoName', label: '대표자', aliases: ['대표', 'ceo'], example: '김대한' },
            { key: 'ceoResidentNumber', label: '대표자 주민번호', aliases: ['대표주민번호', '대표자주민번호', '주민번호', 'ceoResidentNumber'], example: '700101-1234567' },
            { key: 'businessNumber', label: '사업자번호', aliases: ['사업자등록번호', 'business_number'], example: '123-45-67890' },
            { key: 'address', label: '주소', aliases: ['회사주소', 'address'], example: '서울시 강남구 테헤란로 123' },
            { key: 'phone', label: '연락처', aliases: ['전화', '전화번호', 'phone', 'tel'], example: '02-1234-5678' },
            { key: 'email', label: '이메일', aliases: ['email', 'e-mail', 'mail'], example: 'office@daehan.co.kr' },
            { key: 'bankName', label: '은행명', aliases: ['은행', 'bank'], example: '국민은행' },
            { key: 'accountNumber', label: '계좌번호', aliases: ['계좌', 'account'], example: '123-456-789012' },
            { key: 'accountHolder', label: '예금주', aliases: ['계좌주', 'holder', 'accountHolder'], example: '김대한' },
            { key: 'color', label: '색상', aliases: ['컬러', 'color'], example: '#4f46e5' }
        ]
    },
    Site: {
        name: '현장',
        icon: faMapMarkerAlt,
        keywords: ['현장', 'site', '공사', '프로젝트', '건설현장'],
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        fields: [
            { key: 'name', label: '현장명', required: true, aliases: ['현장', '공사명', '프로젝트명', 'site', 'siteName'], example: '강남역 복합개발' },
            { key: 'companyName', label: '시공사', aliases: ['회사명', '회사', '시공사', '시공', 'constructor', 'company', 'companyName'], example: '(주)대한건설' },
            { key: 'partnerCompanyName', label: '협력사', aliases: ['협력사', '하도급', 'partner', 'partnerCompany', 'partnerCompanyName', 'partnerName'], example: '삼성엔지니어링' },
            { key: 'clientCompanyName', label: '발주사', aliases: ['발주사', '발주처', 'client', 'clientCompany', 'clientCompanyName'], example: '한화건설' },
            { key: 'responsibleTeamName', label: '담당팀', aliases: ['해당팀', '현장담당', '담당', 'team'], example: '1공구팀' },
            { key: 'code', label: '현장코드', aliases: ['코드', 'code'], example: 'S-2024-001' },
            { key: 'address', label: '주소', aliases: ['현장주소', 'address'], example: '서울시 강남구 역삼동 123' },
            { key: 'status', label: '진행상태', aliases: ['상태', '진행', 'status'], example: 'active' },
            { key: 'siteType', label: '현장유형', aliases: ['현장구분', '유형', 'type'], example: '도급' },
            { key: 'paymentMethod', label: '결제구분', aliases: ['결제방식', '결제유형', 'payment', 'paymentMethod'], example: '계산서' },
            { key: 'startDate', label: '착공일', aliases: ['시작일', 'start', 'startDate'], example: '2024-01-01', type: 'date' },
            { key: 'endDate', label: '준공일', aliases: ['종료일', 'end', 'endDate'], example: '2024-12-31', type: 'date' },
            { key: 'color', label: '현장색상', aliases: ['색상', '컬러', 'siteColor', 'color'], example: '#2563eb' }
        ]
    },
    Team: {
        name: '팀',
        icon: faUsers,
        keywords: ['팀', 'team', '조', '반', '소속'],
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        fields: [
            { key: 'name', label: '팀명', required: true, aliases: ['팀', '조명', 'team', 'teamName'], example: '1공구팀' },
            { key: 'companyName', label: '소속회사', aliases: ['회사명', '회사', 'company'], example: '(주)대한건설' },
            { key: 'leaderName', label: '팀장', aliases: ['팀장명', '반장', 'leader'], example: '김팀장' },
            { key: 'type', label: '팀유형', aliases: ['구분', '유형', 'teamType'], example: '지원팀' },
            { key: 'defaultSalaryModel', label: '기본지급구분', aliases: ['기본급여구분', 'salaryModel', 'defaultSalaryModel'], example: '일급제' },
            { key: 'parentTeamName', label: '상위팀', aliases: ['상위팀명', 'parentTeam', 'parentTeamName'], example: '관리팀' },
            { key: 'role', label: '주요공종', aliases: ['직종', '공종', 'role'], example: '철근' },
            { key: 'status', label: '상태', aliases: ['팀상태', 'status'], example: 'active' },
            { key: 'color', label: '팀색상', aliases: ['색상', '컬러', 'teamColor', 'color'], example: '#2563eb' }
        ]
    },
    Worker: {
        name: '작업자',
        icon: faUser,
        keywords: ['작업자', 'worker', '인원', '명단', '인력', '근로자'],
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        fields: [
            { key: 'name', label: '이름', required: true, aliases: ['성명', '작업자명', '작업자', 'name', 'worker'], example: '홍길동' },
            { key: 'idNumber', label: '주민번호', aliases: ['주민등록번호', '주민', 'ssn', 'residentNumber'], example: '900101-1234567' },
            { key: 'teamName', label: '소속팀', aliases: ['팀명', '팀', 'team'], example: '1공구팀' },
            { key: 'teamType', label: '팀유형', aliases: ['팀구분', 'teamType'], example: '지원팀' },
            { key: 'companyName', label: '소속회사', aliases: ['회사명', '회사', 'company'], example: '(주)대한건설' },
            { key: 'position', label: '직책', aliases: ['직위', 'position', 'title', '직종', '공종', '역할', 'role'], example: '반장' },
            { key: 'unitPrice', label: '단가', aliases: ['일당', '임금', '노임', 'price'], example: '180000', type: 'number' },
            { key: 'salaryType', label: '급여구분', aliases: ['급여방식', '급여형태', 'payType', 'salaryType'], example: '일급제' },
            { key: 'contact', label: '연락처', aliases: ['휴대폰', '전화', 'phone', 'contact'], example: '010-1234-5678' },
            { key: 'email', label: '이메일', aliases: ['email', 'e-mail', 'mail'], example: 'hong@worker.com' },
            { key: 'address', label: '주소', aliases: ['거주지', '자택주소', 'address'], example: '서울시 강남구 역삼동 123' },
            { key: 'status', label: '상태', aliases: ['재직상태', 'status'], example: '재직' },
            { key: 'salaryModel', label: '지급구분', aliases: ['구분', 'salaryModel'], example: '일급제' },
            { key: 'bloodType', label: '혈액형', aliases: ['혈핵형', 'blood', 'bloodType'], example: 'A형' },
            { key: 'bankName', label: '은행', aliases: ['은행명', 'bank'], example: '국민은행' },
            { key: 'accountNumber', label: '계좌번호', aliases: ['계좌', 'account'], example: '123-456-789012' },
            { key: 'accountHolder', label: '예금주', aliases: ['계좌주', 'holder', 'accountHolder'], example: '홍길동' },
            { key: 'fileNameSaved', label: '파일명', aliases: ['파일', '첨부', 'file', 'fileName', 'fileNameSaved'], example: 'hong_id.jpg' },
            { key: 'color', label: '작업자색상', aliases: ['색상', '컬러', 'workerColor', 'color'], example: '#0f766e' }
        ]
    },
    DailyReport: {
        name: '출력일보',
        icon: faClipboardList,
        keywords: ['출력일보', '일보', 'report', '출력', '공수', 'daily'],
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        fields: [
            { key: 'date', label: '날짜', required: true, aliases: ['작업일', '일자', 'date'], example: '2024-01-15', type: 'date' },
            { key: 'siteName', label: '현장명', required: true, aliases: ['현장', '공사명', 'site'], example: '강남역 복합개발' },
            { key: 'teamName', label: '팀명', required: true, aliases: ['팀', '소속팀', '조', 'team'], example: '1공구팀' },
            { key: 'paymentMethod', label: '결제구분', aliases: ['결제방식', '결제유형', 'payment', 'paymentMethod'], example: '계산서' },
            { key: 'workerName', label: '작업자명', required: true, aliases: ['이름', '성명', '작업자', 'name', 'worker'], example: '김철수' },
            { key: 'manDay', label: '공수', required: true, aliases: ['M/D', '출력', '인일', 'manday'], example: '1.0', type: 'number' },
            { key: 'position', label: '직책', aliases: ['직위', 'position', 'title', '직종', '공종', '역할', 'role'], example: '반장' },
            { key: 'unitPrice', label: '단가', aliases: ['일당', '임금', 'price'], example: '180000', type: 'number' },
            { key: 'salaryType', label: '급여구분', aliases: ['급여방식', '급여형태', 'payType', 'salaryType'], example: '일급제' },
            { key: 'workContent', label: '작업내용', aliases: ['내용', '비고', 'content', 'work'], example: '철근 배근 작업' },
            { key: 'companyName', label: '시공사', aliases: ['회사명', '회사', '시공사', '시공', 'constructor', 'company', 'companyName'], example: '(주)대한건설' },
            { key: 'partnerCompanyName', label: '협력사', aliases: ['협력사', '하도급', 'partner', 'partnerCompany', 'partnerCompanyName', 'partnerName'], example: '삼성엔지니어링' },
            { key: 'clientCompanyName', label: '발주사', aliases: ['발주사', '발주처', 'client', 'clientCompany', 'clientCompanyName'], example: '한화건설' },
            { key: 'responsibleTeamName', label: '현장담당', aliases: ['담당팀', '해당팀', 'responsibleTeam'], example: '1공구팀' }
        ]
    }
};

// =============================================================================
// 메인 컴포넌트
// =============================================================================

const IntegratedDailyReportUploader: React.FC = () => {
    const { currentUser } = useAuth();

    const findBestHeaderMatch = useCallback((headers: string[], field: FieldDef): string | undefined => {
        const normalizedHeaders = headers.map((h) => ({
            raw: h,
            normalized: (h || '').toLowerCase().trim()
        }));
        const labelNormalized = (field.label || '').toLowerCase().trim();
        const aliasesNormalized = (field.aliases ?? []).map((a) => (a || '').toLowerCase().trim()).filter(Boolean);

        const exactLabel = normalizedHeaders.find((h) => h.normalized === labelNormalized)?.raw;
        if (exactLabel) return exactLabel;

        const exactAlias = normalizedHeaders.find((h) => aliasesNormalized.includes(h.normalized))?.raw;
        if (exactAlias) return exactAlias;

        const includesLabel = normalizedHeaders.find((h) => h.normalized.includes(labelNormalized))?.raw;
        if (includesLabel) return includesLabel;

        const includesAlias = normalizedHeaders.find((h) => aliasesNormalized.some((a) => a && h.normalized.includes(a)))?.raw;
        if (includesAlias) return includesAlias;

        return undefined;
    }, []);

    // Stage & Data State
    const [stage, setStage] = useState<Stage>('UPLOAD');
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [sheetData, setSheetData] = useState<Record<SheetType, any[]>>({
        Company: [], Site: [], Team: [], Worker: [], DailyReport: []
    });
    const [fieldMappings, setFieldMappings] = useState<Record<SheetType, Record<string, string>>>({
        Company: {}, Site: {}, Team: {}, Worker: {}, DailyReport: {}
    });
    const [excelHeaders, setExcelHeaders] = useState<Record<SheetType, string[]>>({
        Company: [], Site: [], Team: [], Worker: [], DailyReport: []
    });

    // Preview State
    const [parsedData, setParsedData] = useState<Record<SheetType, ParsedRow[]>>({
        Company: [], Site: [], Team: [], Worker: [], DailyReport: []
    });
    const [groupedReports, setGroupedReports] = useState<GroupedReport[]>([]);
    const [activeTab, setActiveTab] = useState<SheetType>('DailyReport');
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<ValidationStatus | 'ALL'>('ALL');

    // Cache State
    const [companiesCache, setCompaniesCache] = useState<Map<string, Company>>(new Map());
    const [sitesCache, setSitesCache] = useState<Map<string, Site>>(new Map());
    const [teamsCache, setTeamsCache] = useState<Map<string, Team>>(new Map());
    const [workersCache, setWorkersCache] = useState<Map<string, Worker>>(new Map());
    const [existingReports, setExistingReports] = useState<Map<string, DailyReportWorker[]>>(new Map());
    const [cacheLoaded, setCacheLoaded] = useState(false);

    // Options State
    const [autoCreateWorker, setAutoCreateWorker] = useState(true);
    const [autoCreateTeam, setAutoCreateTeam] = useState(true);
    const [autoCreateSite, setAutoCreateSite] = useState(true);
    const [overwriteExisting, setOverwriteExisting] = useState(false);
    const [batchSize, setBatchSize] = useState(25);
    const [showSettings, setShowSettings] = useState(false);

    // Processing State
    const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
    const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
    const [resultSummary, setResultSummary] = useState({
        total: 0, success: 0, failed: 0, skipped: 0
    });

    // ==========================================================================
    // 캐시 로딩
    // ==========================================================================

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [companies, sites, teams, workers] = await Promise.all([
                    companyService.getCompanies(),
                    siteService.getSites(),
                    teamService.getTeams(),
                    manpowerService.getWorkers()
                ]);

                const companyMap = new Map<string, Company>();
                companies.forEach(c => {
                    if (c.id && c.name) companyMap.set(normalizeNameForCompare(c.name), c);
                });
                setCompaniesCache(companyMap);

                const siteMap = new Map<string, Site>();
                sites.forEach(s => {
                    if (s.id && s.name) siteMap.set(normalizeNameForCompare(s.name), s);
                });
                setSitesCache(siteMap);

                const teamMap = new Map<string, Team>();
                teams.forEach(t => {
                    if (t.id && t.name) teamMap.set(normalizeNameForCompare(t.name), t);
                });
                setTeamsCache(teamMap);

                const workerMap = new Map<string, Worker>();
                workers.forEach(w => {
                    if (w.id && w.name) workerMap.set(normalizeNameForCompare(w.name), w);
                });
                setWorkersCache(workerMap);

                // 최근 90일 일보 캐시
                const today = new Date();
                const past = new Date(today);
                past.setDate(today.getDate() - 90);
                const startDate = past.toISOString().split('T')[0];

                const reports = await dailyReportService.getReportsByRange(startDate, '2099-12-31');
                const reportMap = new Map<string, DailyReportWorker[]>();
                reports.forEach(r => {
                    const d = formatExcelDate(r.date);
                    const key = `${d}_${r.siteId}_${r.teamId}`;
                    reportMap.set(key, r.workers);
                });
                setExistingReports(reportMap);

                setCacheLoaded(true);
            } catch (error) {
                console.error('Cache loading failed:', error);
                Swal.fire('경고', '기초 데이터 로딩 중 일부 오류가 발생했습니다.', 'warning');
                setCacheLoaded(true);
            }
        };

        loadCache();
    }, []);

    // ==========================================================================
    // 파일 처리
    // ==========================================================================

    const processFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                if (typeof bstr !== 'string') return;

                const wb = XLSX.read(bstr, { type: 'binary' });
                const newSheetData: Record<SheetType, any[]> = {
                    Company: [], Site: [], Team: [], Worker: [], DailyReport: []
                };
                const newHeaders: Record<SheetType, string[]> = {
                    Company: [], Site: [], Team: [], Worker: [], DailyReport: []
                };
                const newMappings: Record<SheetType, Record<string, string>> = {
                    Company: {}, Site: {}, Team: {}, Worker: {}, DailyReport: {}
                };

                // 각 시트 파싱
                (Object.keys(SHEET_CONFIG) as SheetType[]).forEach(type => {
                    const config = SHEET_CONFIG[type];
                    const sheetName = wb.SheetNames.find(n =>
                        config.keywords.some(k => n.toLowerCase().includes(k.toLowerCase()))
                    );

                    if (sheetName) {
                        const ws = wb.Sheets[sheetName];
                        const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
                        const data = XLSX.utils.sheet_to_json(ws);

                        newHeaders[type] = headers;
                        newSheetData[type] = data;

                        // 자동 매핑
                        const mapping: Record<string, string> = {};
                        config.fields.forEach(field => {
                            const matched = findBestHeaderMatch(headers, field);
                            if (matched) mapping[field.key] = matched;
                        });
                        newMappings[type] = mapping;
                    }
                });

                setRawFile(file);
                setSheetData(newSheetData);
                setExcelHeaders(newHeaders);
                setFieldMappings(newMappings);
                setStage('MAPPING');

            } catch (error) {
                console.error('File processing error:', error);
                Swal.fire('오류', '파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        reader.readAsBinaryString(file);
    }, []);

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    // ==========================================================================
    // 매핑 처리
    // ==========================================================================

    const handleMappingChange = (sheetType: SheetType, fieldKey: string, header: string) => {
        setFieldMappings(prev => ({
            ...prev,
            [sheetType]: { ...prev[sheetType], [fieldKey]: header }
        }));
    };

    // ==========================================================================
    // 검증 및 미리보기
    // ==========================================================================

    const validateAndPreview = async () => {
        const newParsedData: Record<SheetType, ParsedRow[]> = {
            Company: [], Site: [], Team: [], Worker: [], DailyReport: []
        };
        const newErrorLogs: ErrorLogEntry[] = [];

        // 임시 캐시 (배치 내 생성된 데이터 추적)
        const tempCompanies = new Map(companiesCache);
        const tempSites = new Map(sitesCache);
        const tempTeams = new Map(teamsCache);
        const tempWorkers = new Map(workersCache);

        for (const type of PROCESSING_ORDER) {
            const config = SHEET_CONFIG[type];
            const mapping = fieldMappings[type];
            const rows = sheetData[type];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const parsed: ParsedRow = {
                    _rowIndex: i + 2, // Excel 1-indexed + header
                    _sheetType: type
                };

                // 필드 매핑
                config.fields.forEach(field => {
                    const header = mapping[field.key];
                    if (header && row[header] !== undefined) {
                        let value = row[header];

                        // 타입별 변환
                        if (field.type === 'date') {
                            value = formatExcelDate(value);
                        } else if (field.type === 'number') {
                            value = normalizeNumber(value);
                        } else {
                            value = normalizeString(value);
                        }

                        parsed[field.key] = value;
                    }
                });

                // 검증
                const validation = await validateRow(parsed, type, tempCompanies, tempSites, tempTeams, tempWorkers);
                parsed._validation = validation;

                // 임시 캐시 업데이트 (미리보기용)
                if (validation.isValid || validation.status === 'WARNING') {
                    updateTempCache(parsed, type, tempCompanies, tempSites, tempTeams, tempWorkers);
                }

                // 에러 로그 수집
                if (!validation.isValid || validation.warnings.length > 0) {
                    newErrorLogs.push({
                        rowIndex: parsed._rowIndex,
                        sheetType: type,
                        rowData: { ...parsed },
                        errors: validation.errors,
                        warnings: validation.warnings,
                        status: validation.status,
                        timestamp: new Date().toISOString()
                    });
                }

                newParsedData[type].push(parsed);
            }
        }

        setParsedData(newParsedData);
        setErrorLogs(newErrorLogs);

        // 일보 그룹화
        const grouped = groupDailyReports(newParsedData.DailyReport);
        setGroupedReports(grouped);

        setStage('PREVIEW');
    };

    const validateRow = async (
        row: ParsedRow,
        type: SheetType,
        tempCompanies: Map<string, Company>,
        tempSites: Map<string, Site>,
        tempTeams: Map<string, Team>,
        tempWorkers: Map<string, Worker>
    ): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: ValidationStatus = 'NEW';
        const linkedData: ValidationResult['linkedData'] = {};

        const config = SHEET_CONFIG[type];

        // 필수 필드 검증
        config.fields.filter(f => f.required).forEach(f => {
            if (!row[f.key]) {
                errors.push(`${f.label} 필수`);
            }
        });

        if (errors.length > 0) {
            return { isValid: false, errors, warnings, status: 'ERROR', linkedData };
        }

        // 타입별 상세 검증
        switch (type) {
            case 'Company': {
                const nameKey = normalizeNameForCompare(row.name);
                if (tempCompanies.has(nameKey)) {
                    status = 'UPDATE';
                    warnings.push('기존 회사 정보가 수정됩니다');
                }
                break;
            }

            case 'Site': {
                const nameKey = normalizeNameForCompare(row.name);
                if (tempSites.has(nameKey)) {
                    status = 'UPDATE';
                    warnings.push('기존 현장 정보가 수정됩니다');
                }

                // 회사 연결 확인
                if (row.companyName) {
                    const companyKey = normalizeNameForCompare(row.companyName);
                    const company = tempCompanies.get(companyKey);
                    if (company) {
                        linkedData.companyId = company.id;
                        linkedData.companyName = company.name;
                    } else {
                        warnings.push(`시공사 '${row.companyName}' 미등록`);
                    }
                }

                if (row.partnerCompanyName) {
                    const partnerKey = normalizeNameForCompare(row.partnerCompanyName);
                    const partner = tempCompanies.get(partnerKey);
                    if (partner) {
                        linkedData.partnerId = partner.id;
                        linkedData.partnerName = partner.name;
                    } else {
                        warnings.push(`협력사 '${row.partnerCompanyName}' 미등록`);
                    }
                }

                if (row.clientCompanyName) {
                    const clientKey = normalizeNameForCompare(row.clientCompanyName);
                    const client = tempCompanies.get(clientKey);
                    if (client) {
                        linkedData.clientCompanyId = client.id;
                        linkedData.clientCompanyName = client.name;
                    } else {
                        warnings.push(`발주사 '${row.clientCompanyName}' 미등록`);
                    }
                }
                break;
            }

            case 'Team': {
                const nameKey = normalizeNameForCompare(row.name);
                if (tempTeams.has(nameKey)) {
                    status = 'UPDATE';
                    warnings.push('기존 팀 정보가 수정됩니다');
                }

                // 회사 연결 확인
                if (row.companyName) {
                    const companyKey = normalizeNameForCompare(row.companyName);
                    const company = tempCompanies.get(companyKey);
                    if (company) {
                        linkedData.companyId = company.id;
                        linkedData.companyName = company.name;
                    } else {
                        warnings.push(`회사 '${row.companyName}' 미등록`);
                    }
                }
                break;
            }

            case 'Worker': {
                const nameKey = normalizeNameForCompare(row.name);
                if (tempWorkers.has(nameKey)) {
                    status = 'UPDATE';
                    warnings.push('기존 작업자 정보가 수정됩니다');
                }

                if (!row.position) {
                    warnings.push('직책 미입력');
                }

                // 팀 연결 확인
                if (row.teamName) {
                    const teamKey = normalizeNameForCompare(row.teamName);
                    const team = tempTeams.get(teamKey);
                    if (team) {
                        linkedData.teamId = team.id;
                        linkedData.teamName = team.name;
                    } else if (!autoCreateTeam) {
                        warnings.push(`팀 '${row.teamName}' 미등록`);
                    }
                }

                // 단가 범위 검증
                if (row.unitPrice) {
                    const price = normalizeNumber(row.unitPrice);
                    if (price < 50000 || price > 1000000) {
                        warnings.push(`단가 범위 확인: ${price.toLocaleString()}원`);
                    }
                }
                break;
            }

            case 'DailyReport': {
                // 현장 검증
                const siteKey = normalizeNameForCompare(row.siteName);
                const site = tempSites.get(siteKey);
                if (site) {
                    linkedData.siteId = site.id;
                    linkedData.siteName = site.name;
                } else if (!autoCreateSite) {
                    errors.push(`현장 '${row.siteName}' 미등록`);
                } else {
                    warnings.push(`현장 '${row.siteName}' 자동 생성됩니다`);
                }

                // 팀 검증
                const teamKey = normalizeNameForCompare(row.teamName);
                const team = tempTeams.get(teamKey);
                if (team) {
                    linkedData.teamId = team.id;
                    linkedData.teamName = team.name;
                } else if (!autoCreateTeam) {
                    errors.push(`팀 '${row.teamName}' 미등록`);
                } else {
                    warnings.push(`팀 '${row.teamName}' 자동 생성됩니다`);
                }

                // 작업자 검증
                const workerKey = normalizeNameForCompare(row.workerName);
                const worker = tempWorkers.get(workerKey);
                if (worker) {
                    linkedData.workerId = worker.id;
                    linkedData.workerName = worker.name;
                } else if (!autoCreateWorker) {
                    errors.push(`작업자 '${row.workerName}' 미등록`);
                } else {
                    warnings.push(`작업자 '${row.workerName}' 자동 생성됩니다`);
                }

                // 공수 범위 검증
                const manDay = normalizeNumber(row.manDay);
                if (manDay <= 0 || manDay > 3) {
                    warnings.push(`공수 확인: ${manDay} (일반적으로 0.5~2.0)`);
                }

                if (!row.paymentMethod) {
                    warnings.push('결제구분 미입력');
                } else {
                    const paymentMethod = String(row.paymentMethod).trim();
                    const isExpected = paymentMethod.includes('계산서') || paymentMethod.includes('노무');
                    if (!isExpected) {
                        warnings.push(`결제구분 확인: ${paymentMethod} (권장: 계산서/노무)`);
                    }
                }

                if (!row.position) {
                    warnings.push('직책 미입력');
                }

                // 중복 체크
                if (site && team) {
                    const reportKey = `${row.date}_${site.id}_${team.id}`;
                    const existingWorkers = existingReports.get(reportKey);
                    if (existingWorkers) {
                        const existingWorker = existingWorkers.find(w =>
                            normalizeNameForCompare(w.name) === workerKey
                        );
                        if (existingWorker) {
                            if (overwriteExisting) {
                                status = 'UPDATE';
                                warnings.push('기존 일보가 수정됩니다');
                            } else {
                                status = 'IDENTICAL';
                                warnings.push('이미 등록된 데이터입니다');
                            }
                        }
                    }
                }
                break;
            }
        }

        if (warnings.length > 0 && status === 'NEW') {
            status = 'WARNING';
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            status,
            linkedData
        };
    };

    const updateTempCache = (
        row: ParsedRow,
        type: SheetType,
        tempCompanies: Map<string, Company>,
        tempSites: Map<string, Site>,
        tempTeams: Map<string, Team>,
        tempWorkers: Map<string, Worker>
    ) => {
        const nameKey = normalizeNameForCompare(row.name || row.workerName || '');

        switch (type) {
            case 'Company':
                if (row.name && !tempCompanies.has(nameKey)) {
                    tempCompanies.set(nameKey, { id: `temp_${nameKey}`, name: row.name } as Company);
                }
                break;
            case 'Site':
                if (row.name && !tempSites.has(nameKey)) {
                    tempSites.set(nameKey, { id: `temp_${nameKey}`, name: row.name } as Site);
                }
                break;
            case 'Team':
                if (row.name && !tempTeams.has(nameKey)) {
                    tempTeams.set(nameKey, { id: `temp_${nameKey}`, name: row.name } as Team);
                }
                break;
            case 'Worker':
                if (row.name && !tempWorkers.has(nameKey)) {
                    tempWorkers.set(nameKey, { id: `temp_${nameKey}`, name: row.name } as Worker);
                }
                break;
        }
    };

    const groupDailyReports = (reports: ParsedRow[]): GroupedReport[] => {
        const groups: Map<string, GroupedReport> = new Map();

        reports.forEach(row => {
            if (!row.date || !row.siteName || !row.teamName) return;

            const key = `${row.date}_${row.siteName}_${row.teamName}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    date: row.date,
                    siteName: row.siteName,
                    teamName: row.teamName,
                    companyName: row.companyName,
                    partnerCompanyName: row.partnerCompanyName,
                    clientCompanyName: row.clientCompanyName,
                    responsibleTeamName: row.responsibleTeamName,
                    paymentMethod: row.paymentMethod,
                    workers: [],
                    totalManDay: 0,
                    status: 'NEW',
                    errors: [],
                    warnings: []
                });
            }

            const group = groups.get(key)!;
            if (!group.companyName && row.companyName) group.companyName = row.companyName;
            if (!group.partnerCompanyName && row.partnerCompanyName) group.partnerCompanyName = row.partnerCompanyName;
            if (!group.clientCompanyName && row.clientCompanyName) group.clientCompanyName = row.clientCompanyName;
            if (!group.responsibleTeamName && row.responsibleTeamName) group.responsibleTeamName = row.responsibleTeamName;
            if (!group.paymentMethod && row.paymentMethod) group.paymentMethod = row.paymentMethod;
            group.workers.push(row);
            group.totalManDay += normalizeNumber(row.manDay) || 0;

            // 그룹 상태 업데이트
            if (row._validation) {
                if (!row._validation.isValid) {
                    group.status = 'ERROR';
                    group.errors.push(...row._validation.errors.map(e => `[${row.workerName}] ${e}`));
                } else if (row._validation.status === 'UPDATE') {
                    if (group.status !== 'ERROR') group.status = 'UPDATE';
                } else if (row._validation.status === 'WARNING') {
                    if (group.status === 'NEW') group.status = 'WARNING';
                }
                group.warnings.push(...row._validation.warnings.map(w => `[${row.workerName}] ${w}`));
            }
        });

        return Array.from(groups.values()).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName);
            return a.teamName.localeCompare(b.teamName);
        });
    };

    // ==========================================================================
    // 저장 처리
    // ==========================================================================

    const handleProcess = async () => {
        setStage('PROCESSING');
        setProcessingLogs(PROCESSING_ORDER.map(type => ({
            step: type,
            status: 'pending',
            message: `${SHEET_CONFIG[type].name} 대기 중...`
        })));

        const summary = { total: 0, success: 0, failed: 0, skipped: 0 };
        const newErrorLogs: ErrorLogEntry[] = [...errorLogs];

        // 실제 캐시 업데이트용
        const realCompanies = new Map(companiesCache);
        const realSites = new Map(sitesCache);
        const realTeams = new Map(teamsCache);
        const realWorkers = new Map(workersCache);

        for (const type of PROCESSING_ORDER) {
            const rows = parsedData[type].filter(r => r._validation?.isValid);

            if (rows.length === 0) {
                updateProcessingLog(type, 'skipped', '데이터 없음 (건너뜀)');
                continue;
            }

            updateProcessingLog(type, 'processing', `처리 중... (0/${rows.length})`);

            try {
                const result = await processSheetData(
                    type, rows, realCompanies, realSites, realTeams, realWorkers, newErrorLogs
                );

                summary.success += result.success;
                summary.failed += result.failed;
                summary.skipped += result.skipped;
                summary.total += rows.length;

                updateProcessingLog(
                    type, 'success',
                    `완료 (신규: ${result.success}, 수정: result.updated || 0, 실패: ${result.failed})`,
                    rows.length, result
                );

            } catch (error: any) {
                console.error(`Processing ${type} failed:`, error);
                summary.failed += rows.length;
                updateProcessingLog(type, 'error', `오류: ${error.message}`);
            }
        }

        // 캐시 업데이트
        setCompaniesCache(realCompanies);
        setSitesCache(realSites);
        setTeamsCache(realTeams);
        setWorkersCache(realWorkers);

        setResultSummary(summary);
        setErrorLogs(newErrorLogs);
        setStage('COMPLETE');
    };

    const processSheetData = async (
        type: SheetType,
        rows: ParsedRow[],
        companies: Map<string, Company>,
        sites: Map<string, Site>,
        teams: Map<string, Team>,
        workers: Map<string, Worker>,
        errorLogs: ErrorLogEntry[]
    ): Promise<{ success: number; failed: number; skipped: number; updated?: number }> => {
        let success = 0, failed = 0, skipped = 0, updated = 0;

        switch (type) {
            case 'Company': {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    try {
                        const nameKey = normalizeNameForCompare(row.name);
                        const existing = companies.get(nameKey);

                        // companyType을 type으로 매핑 (회사구분 → type)
                        const companyType = row.companyType || row.type;

                        const companyPayload: Partial<Company> = {
                            name: row.name
                        };

                        if (row.code) companyPayload.code = row.code;
                        if (companyType) (companyPayload as any).type = companyType;
                        if (row.ceoName) companyPayload.ceoName = row.ceoName;
                        if (row.ceoResidentNumber) (companyPayload as any).ceoResidentNumber = row.ceoResidentNumber;
                        if (row.businessNumber) companyPayload.businessNumber = normalizeBusinessNumber(row.businessNumber);
                        if (row.address) companyPayload.address = row.address;
                        if (row.phone) companyPayload.phone = normalizePhone(row.phone);
                        if (row.email) (companyPayload as any).email = row.email;
                        if (row.bankName) (companyPayload as any).bankName = row.bankName;
                        if (row.accountNumber) (companyPayload as any).accountNumber = row.accountNumber;
                        if (row.accountHolder) (companyPayload as any).accountHolder = row.accountHolder;
                        if (row.color) (companyPayload as any).color = row.color;

                        if (existing) {
                            await companyService.updateCompany(existing.id!, companyPayload);
                            updated++;
                        } else {
                            const newId = await companyService.addCompany({
                                name: row.name,
                                type: companyType || '미지정',
                                ceoName: companyPayload.ceoName || '',
                                businessNumber: companyPayload.businessNumber || '',
                                address: companyPayload.address || '',
                                phone: companyPayload.phone || '',
                                email: (companyPayload as any).email || '',
                                bankName: (companyPayload as any).bankName || '',
                                accountNumber: (companyPayload as any).accountNumber || '',
                                accountHolder: (companyPayload as any).accountHolder || '',
                                ceoResidentNumber: (companyPayload as any).ceoResidentNumber || '',
                                color: (companyPayload as any).color || '',
                                code: companyPayload.code || `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`
                            });
                            companies.set(nameKey, { id: newId, name: row.name } as Company);
                            success++;
                        }

                        updateProcessingLog(type, 'processing', `처리 중... (${i + 1}/${rows.length})`);
                    } catch (err: any) {
                        failed++;
                        errorLogs.push({
                            rowIndex: row._rowIndex,
                            sheetType: type,
                            rowData: row,
                            errors: [err.message],
                            warnings: [],
                            status: 'ERROR',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                break;
            }

            case 'Site': {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    try {
                        const nameKey = normalizeNameForCompare(row.name);
                        const existing = sites.get(nameKey);

                        // 회사 연결
                        let companyId = '', companyName = '';
                        if (row.companyName) {
                            const company = companies.get(normalizeNameForCompare(row.companyName));
                            if (company) {
                                companyId = company.id!;
                                companyName = company.name;
                            }
                        }

                        // 협력사/발주사 연결
                        let partnerId = '', partnerName = '';
                        if (row.partnerCompanyName) {
                            const partner = companies.get(normalizeNameForCompare(row.partnerCompanyName));
                            if (partner) {
                                partnerId = partner.id!;
                                partnerName = partner.name;
                            }
                        }

                        let clientCompanyId = '', clientCompanyName = '';
                        if (row.clientCompanyName) {
                            const client = companies.get(normalizeNameForCompare(row.clientCompanyName));
                            if (client) {
                                clientCompanyId = client.id!;
                                clientCompanyName = client.name;
                            }
                        }

                        // 담당팀 연결
                        let responsibleTeamId = '', responsibleTeamName = '';
                        if (row.responsibleTeamName) {
                            const team = teams.get(normalizeNameForCompare(row.responsibleTeamName));
                            if (team) {
                                responsibleTeamId = team.id!;
                                responsibleTeamName = team.name;
                            }
                        }

                        const normalizeSiteStatus = (value: unknown): Site['status'] | undefined => {
                            const v = String(value ?? '').trim();
                            if (!v) return undefined;
                            if (v === 'active' || v === 'completed' || v === 'planned') return v as Site['status'];
                            if (v === '진행중') return 'active';
                            if (v === '완료') return 'completed';
                            if (v === '예정') return 'planned';
                            return undefined;
                        };

                        const sitePayload: Partial<Site> = {
                            name: row.name
                        };
                        if (companyId) sitePayload.companyId = companyId;
                        if (companyName) sitePayload.companyName = companyName;
                        if (partnerId) (sitePayload as any).partnerId = partnerId;
                        if (partnerName) (sitePayload as any).partnerName = partnerName;
                        if (clientCompanyId) (sitePayload as any).clientCompanyId = clientCompanyId;
                        if (clientCompanyName) (sitePayload as any).clientCompanyName = clientCompanyName;
                        if (responsibleTeamId) (sitePayload as any).responsibleTeamId = responsibleTeamId;
                        if (responsibleTeamName) (sitePayload as any).responsibleTeamName = responsibleTeamName;
                        if (row.code) sitePayload.code = row.code;
                        if (row.address) sitePayload.address = row.address;
                        if (row.siteType) sitePayload.siteType = row.siteType;
                        if (row.paymentMethod) sitePayload.paymentMethod = row.paymentMethod;
                        if (row.startDate) sitePayload.startDate = row.startDate;
                        if (row.endDate) sitePayload.endDate = row.endDate;
                        if (row.color) sitePayload.color = row.color;
                        const normalizedStatus = normalizeSiteStatus(row.status);
                        if (normalizedStatus) sitePayload.status = normalizedStatus;

                        if (existing) {
                            await siteService.updateSite(existing.id!, sitePayload);
                            updated++;
                        } else {
                            const newId = await siteService.addSite({
                                name: row.name,
                                companyId: sitePayload.companyId,
                                companyName: sitePayload.companyName,
                                partnerId: (sitePayload as any).partnerId,
                                partnerName: (sitePayload as any).partnerName,
                                clientCompanyId: (sitePayload as any).clientCompanyId,
                                clientCompanyName: (sitePayload as any).clientCompanyName,
                                responsibleTeamId: (sitePayload as any).responsibleTeamId,
                                responsibleTeamName: (sitePayload as any).responsibleTeamName,
                                code: sitePayload.code || `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                address: sitePayload.address || '',
                                status: sitePayload.status || 'active',
                                siteType: sitePayload.siteType,
                                paymentMethod: sitePayload.paymentMethod,
                                startDate: sitePayload.startDate,
                                endDate: sitePayload.endDate,
                                color: sitePayload.color
                            });
                            sites.set(nameKey, { id: newId, name: row.name } as Site);
                            success++;
                        }

                        updateProcessingLog(type, 'processing', `처리 중... (${i + 1}/${rows.length})`);
                    } catch (err: any) {
                        failed++;
                        errorLogs.push({
                            rowIndex: row._rowIndex,
                            sheetType: type,
                            rowData: row,
                            errors: [err.message],
                            warnings: [],
                            status: 'ERROR',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                break;
            }

            case 'Team': {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    try {
                        const nameKey = normalizeNameForCompare(row.name);
                        const existing = teams.get(nameKey);

                        const normalizeTeamStatus = (value: unknown): Team['status'] | undefined => {
                            const v = String(value ?? '').trim();
                            if (!v) return undefined;

                            if (v === 'active' || v === 'waiting' || v === 'closed') {
                                return v as Team['status'];
                            }

                            if (v === '협업중' || v === '협업' || v === '진행' || v === '진행중') return 'active';
                            if (v === '대기') return 'waiting';
                            if (v === '폐업' || v === '종료' || v === '완료') return 'closed';

                            return undefined;
                        };

                        // 회사 연결
                        let companyId = '', companyName = '';
                        if (row.companyName) {
                            const company = companies.get(normalizeNameForCompare(row.companyName));
                            if (company) {
                                companyId = company.id!;
                                companyName = company.name;
                            }
                        }

                        let parentTeamId = '';
                        let parentTeamName = '';
                        if (row.parentTeamName) {
                            const parent = teams.get(normalizeNameForCompare(row.parentTeamName));
                            if (parent?.id) {
                                parentTeamId = parent.id;
                                parentTeamName = parent.name;
                            } else {
                                parentTeamName = row.parentTeamName;
                            }
                        }

                        const teamPayload: Partial<Team> = {
                            name: row.name
                        };

                        if (companyId) teamPayload.companyId = companyId;
                        if (companyName) teamPayload.companyName = companyName;
                        if (row.type) teamPayload.type = row.type;
                        if (row.role) teamPayload.role = row.role;
                        if (row.defaultSalaryModel) teamPayload.defaultSalaryModel = row.defaultSalaryModel;
                        if (parentTeamId) teamPayload.parentTeamId = parentTeamId;
                        if (parentTeamName) teamPayload.parentTeamName = parentTeamName;
                        const normalizedStatus = normalizeTeamStatus(row.status);
                        if (normalizedStatus) teamPayload.status = normalizedStatus;
                        if (row.color) teamPayload.color = row.color;

                        if (existing) {
                            await teamService.updateTeam(existing.id!, teamPayload);
                            updated++;
                        } else {
                            const newId = await teamService.addTeam({
                                name: row.name,
                                companyId: teamPayload.companyId,
                                companyName: teamPayload.companyName,
                                leaderName: row.leaderName || '미지정',
                                leaderId: '',
                                type: teamPayload.type || '미지정',
                                role: teamPayload.role || '',
                                defaultSalaryModel: teamPayload.defaultSalaryModel,
                                parentTeamId: teamPayload.parentTeamId,
                                parentTeamName: teamPayload.parentTeamName,
                                status: teamPayload.status,
                                color: teamPayload.color
                            });
                            teams.set(nameKey, { id: newId, name: row.name } as Team);
                            success++;
                        }

                        updateProcessingLog(type, 'processing', `처리 중... (${i + 1}/${rows.length})`);
                    } catch (err: any) {
                        failed++;
                        errorLogs.push({
                            rowIndex: row._rowIndex,
                            sheetType: type,
                            rowData: row,
                            errors: [err.message],
                            warnings: [],
                            status: 'ERROR',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                break;
            }

            case 'Worker': {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    try {
                        const nameKey = normalizeNameForCompare(row.name);
                        const existing = workers.get(nameKey);

                        // 팀 연결
                        let teamId = '', teamName = '', teamType = '일용직';
                        if (row.teamName) {
                            const team = teams.get(normalizeNameForCompare(row.teamName));
                            if (team) {
                                teamId = team.id!;
                                teamName = team.name;
                                teamType = team.type || '일용직';
                            }
                        }

                        // 회사 연결
                        let companyId = '';
                        if (row.companyName) {
                            const company = companies.get(normalizeNameForCompare(row.companyName));
                            if (company) companyId = company.id!;
                        }

                        // salaryType을 payType으로 매핑 (급여구분 → payType/salaryModel)
                        const salaryType = row.salaryType || row.payType;
                        const roleForDb = row.position || row.role;

                        const workerPayload: Partial<Worker> = {
                            name: row.name
                        };

                        if (teamId) workerPayload.teamId = teamId;
                        if (teamName) workerPayload.teamName = teamName;
                        if (teamType) workerPayload.teamType = teamType;
                        if (companyId) workerPayload.companyId = companyId;
                        if (row.companyName) workerPayload.companyName = row.companyName;
                        if (roleForDb) workerPayload.role = roleForDb;
                        if (row.position) (workerPayload as any).rank = row.position;
                        if (row.contact) workerPayload.contact = normalizePhone(row.contact);
                        if (row.idNumber) workerPayload.idNumber = row.idNumber;
                        if (row.address) workerPayload.address = row.address;
                        if (row.bloodType) (workerPayload as any).bloodType = row.bloodType;
                        if (row.unitPrice !== undefined && row.unitPrice !== null && row.unitPrice !== '') workerPayload.unitPrice = normalizeNumber(row.unitPrice);
                        if (salaryType) {
                            workerPayload.payType = salaryType;
                            workerPayload.salaryModel = salaryType;
                        }
                        if (row.email) (workerPayload as any).email = row.email;
                        if (row.status) (workerPayload as any).status = row.status;
                        if (row.salaryModel) (workerPayload as any).salaryModel = row.salaryModel;
                        if (row.bankName) workerPayload.bankName = row.bankName;
                        if (row.accountNumber) workerPayload.accountNumber = row.accountNumber;
                        if (row.accountHolder) workerPayload.accountHolder = row.accountHolder;
                        if (row.fileNameSaved) workerPayload.fileNameSaved = row.fileNameSaved;
                        if (row.color) (workerPayload as any).color = row.color;

                        if (existing) {
                            await manpowerService.updateWorker(existing.id!, workerPayload);
                            updated++;
                        } else {
                            const newId = await manpowerService.addWorker({
                                name: workerPayload.name || '',
                                teamId: workerPayload.teamId,
                                teamName: workerPayload.teamName,
                                companyId: workerPayload.companyId,
                                companyName: workerPayload.companyName,
                                role: workerPayload.role || '작업자',
                                rank: (workerPayload as any).rank || '',
                                contact: workerPayload.contact || '',
                                idNumber: workerPayload.idNumber || '',
                                address: workerPayload.address || '',
                                email: (workerPayload as any).email || '',
                                bloodType: (workerPayload as any).bloodType || '',
                                unitPrice: typeof workerPayload.unitPrice === 'number' ? workerPayload.unitPrice : 0,
                                payType: workerPayload.payType || '일급제',
                                salaryModel: (workerPayload as any).salaryModel || workerPayload.payType || '일급제',
                                bankName: workerPayload.bankName || '',
                                accountNumber: workerPayload.accountNumber || '',
                                accountHolder: workerPayload.accountHolder || '',
                                teamType: workerPayload.teamType || '',
                                status: (workerPayload as any).status || 'available',
                                fileNameSaved: workerPayload.fileNameSaved,
                                color: (workerPayload as any).color
                            });
                            workers.set(nameKey, { id: newId, name: row.name } as Worker);
                            success++;
                        }

                        updateProcessingLog(type, 'processing', `처리 중... (${i + 1}/${rows.length})`);
                    } catch (err: any) {
                        failed++;
                        errorLogs.push({
                            rowIndex: row._rowIndex,
                            sheetType: type,
                            rowData: row,
                            errors: [err.message],
                            warnings: [],
                            status: 'ERROR',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                break;
            }

            case 'DailyReport': {
                // 그룹별 처리
                const groups = groupDailyReports(rows);
                let processedGroups = 0;

                for (const group of groups) {
                    try {
                        // 현장 확인/생성
                        const siteKey = normalizeNameForCompare(group.siteName);
                        let site = sites.get(siteKey);
                        if (!site && autoCreateSite) {
                            const newSiteId = await siteService.addSite({
                                name: group.siteName,
                                code: `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                address: '',
                                status: 'active',
                                paymentMethod: (group.paymentMethod === '계산서' || group.paymentMethod === '노무') ? group.paymentMethod : undefined
                            });
                            site = { id: newSiteId, name: group.siteName } as Site;
                            sites.set(siteKey, site);
                        }

                        if (!site) {
                            failed += group.workers.length;
                            continue;
                        }

                        // 팀 확인/생성
                        const teamKey = normalizeNameForCompare(group.teamName);
                        let team = teams.get(teamKey);
                        if (!team && autoCreateTeam) {
                            const newTeamId = await teamService.addTeam({
                                name: group.teamName,
                                leaderName: '미지정',
                                leaderId: '',
                                type: '미지정'
                            });
                            team = { id: newTeamId, name: group.teamName } as Team;
                            teams.set(teamKey, team);
                        }

                        if (!team) {
                            failed += group.workers.length;
                            continue;
                        }

                        // 현장 회사(시공사/협력사/발주사) 저장
                        if (site?.id) {
                            const updateSitePayload: Partial<Site> = {};

                            if (group.paymentMethod === '계산서' || group.paymentMethod === '노무') {
                                updateSitePayload.paymentMethod = group.paymentMethod;
                            }

                            if (group.companyName) {
                                const constructor = companies.get(normalizeNameForCompare(group.companyName));
                                if (constructor?.id) {
                                    (updateSitePayload as any).companyId = constructor.id;
                                    (updateSitePayload as any).companyName = constructor.name;
                                } else {
                                    (updateSitePayload as any).companyName = group.companyName;
                                }
                            }

                            if (group.partnerCompanyName) {
                                const partner = companies.get(normalizeNameForCompare(group.partnerCompanyName));
                                if (partner?.id) {
                                    (updateSitePayload as any).partnerId = partner.id;
                                    (updateSitePayload as any).partnerName = partner.name;
                                } else {
                                    (updateSitePayload as any).partnerName = group.partnerCompanyName;
                                }
                            }

                            if (group.clientCompanyName) {
                                const client = companies.get(normalizeNameForCompare(group.clientCompanyName));
                                if (client?.id) {
                                    (updateSitePayload as any).clientCompanyId = client.id;
                                    (updateSitePayload as any).clientCompanyName = client.name;
                                } else {
                                    (updateSitePayload as any).clientCompanyName = group.clientCompanyName;
                                }
                            }

                            if (Object.keys(updateSitePayload).length > 0) {
                                await siteService.updateSite(site.id, updateSitePayload);
                            }
                        }

                        // 작업자 매핑
                        const workerDataList: DailyReportWorker[] = [];

                        for (const workerRow of group.workers) {
                            const workerKey = normalizeNameForCompare(workerRow.workerName);
                            let worker = workers.get(workerKey);

                            // salaryType을 payType으로 매핑
                            const salaryType = workerRow.salaryType || workerRow.payType;
                            const roleForReport = workerRow.position || workerRow.role;

                            if (!worker && autoCreateWorker) {
                                const newWorkerId = await manpowerService.addWorker({
                                    name: workerRow.workerName,
                                    role: roleForReport || '작업자',
                                    rank: workerRow.position || '',
                                    idNumber: '',
                                    contact: '',
                                    status: 'available',
                                    unitPrice: normalizeNumber(workerRow.unitPrice) || 0,
                                    payType: salaryType || '일급제',
                                    salaryModel: salaryType || '일급제',
                                    teamId: team.id!,
                                    teamType: team.type || '일용직'
                                });
                                worker = { id: newWorkerId, name: workerRow.workerName } as Worker;
                                workers.set(workerKey, worker);
                            }

                            workerDataList.push({
                                workerId: worker?.id || `unknown:${team.id}:${workerRow.workerName}`,
                                name: workerRow.workerName,
                                role: roleForReport || worker?.role || '작업자',
                                status: 'attendance',
                                manDay: normalizeNumber(workerRow.manDay) || 1.0,
                                workContent: workerRow.workContent || '',
                                teamId: team.id!,
                                unitPrice: normalizeNumber(workerRow.unitPrice) || worker?.unitPrice || 0,
                                payType: salaryType || worker?.payType || '일급제',
                                salaryModel: salaryType || worker?.salaryModel || '일급제'
                            });
                        }

                        // 기존 일보 확인
                        const reportKey = `${group.date}_${site.id}_${team.id}`;
                        const existingWorkersList = existingReports.get(reportKey);

                        if (existingWorkersList && !overwriteExisting) {
                            skipped += group.workers.length;
                        } else {
                            const reports = await dailyReportService.getReports(group.date, team.id!);
                            const targetReport = reports.find(r => r.siteId === site!.id);

                            const totalManDay = workerDataList.reduce((sum, w) => sum + (w.manDay || 0), 0);

                            if (targetReport && targetReport.id) {
                                // 기존 일보 업데이트
                                let mergedWorkers = [...targetReport.workers];

                                workerDataList.forEach(newWorker => {
                                    const existingIndex = mergedWorkers.findIndex(w =>
                                        normalizeNameForCompare(w.name) === normalizeNameForCompare(newWorker.name)
                                    );
                                    if (existingIndex !== -1) {
                                        if (overwriteExisting) {
                                            mergedWorkers[existingIndex] = { ...mergedWorkers[existingIndex], ...newWorker };
                                        }
                                    } else {
                                        mergedWorkers.push(newWorker);
                                    }
                                });

                                await dailyReportService.updateReport(targetReport.id, {
                                    workers: mergedWorkers,
                                    totalManDay: mergedWorkers.reduce((sum, w) => sum + (w.manDay || 0), 0),
                                    responsibleTeamName: group.responsibleTeamName || targetReport.responsibleTeamName,
                                    companyName: group.companyName || targetReport.companyName
                                });
                                updated += group.workers.length;
                            } else {
                                // 신규 일보 생성
                                await dailyReportService.addReport({
                                    date: group.date,
                                    siteId: site.id!,
                                    siteName: group.siteName,
                                    teamId: team.id!,
                                    teamName: group.teamName,
                                    workers: workerDataList,
                                    totalManDay,
                                    writerId: currentUser?.uid || 'excel_upload',
                                    companyName: group.companyName || '',
                                    responsibleTeamName: group.responsibleTeamName || group.teamName
                                });
                                success += group.workers.length;
                            }
                        }

                        processedGroups++;
                        updateProcessingLog(type, 'processing', `처리 중... (${processedGroups}/${groups.length} 그룹)`);

                    } catch (err: any) {
                        failed += group.workers.length;
                        group.workers.forEach(w => {
                            errorLogs.push({
                                rowIndex: w._rowIndex,
                                sheetType: type,
                                rowData: w,
                                errors: [err.message],
                                warnings: [],
                                status: 'ERROR',
                                timestamp: new Date().toISOString()
                            });
                        });
                    }
                }
                break;
            }
        }

        return { success, failed, skipped, updated };
    };

    const updateProcessingLog = (
        step: SheetType,
        status: ProcessingLog['status'],
        message: string,
        total?: number,
        result?: { success: number; failed: number; skipped: number }
    ) => {
        setProcessingLogs(prev => prev.map(log =>
            log.step === step
                ? { ...log, status, message, total, ...result }
                : log
        ));
    };

    // ==========================================================================
    // 샘플 다운로드
    // ==========================================================================

    const downloadSampleExcel = () => {
        const wb = XLSX.utils.book_new();

        (Object.keys(SHEET_CONFIG) as SheetType[]).forEach(type => {
            const config = SHEET_CONFIG[type];

            // 헤더 및 샘플 데이터 생성
            const headers = config.fields.map(f => f.label);
            const sampleRows = getSampleDataForType(type);

            const wsData = [headers, ...sampleRows.map(row =>
                config.fields.map(f => row[f.key] ?? '')
            )];

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // 열 너비 자동 조정
            const colWidths = headers.map((h, i) => {
                const maxLen = Math.max(
                    h.length,
                    ...sampleRows.map(row => String(row[config.fields[i]?.key] ?? '').length)
                );
                return { wch: Math.min(Math.max(maxLen * 1.5, 10), 30) };
            });
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, `${config.name}(${type})`);
        });

        XLSX.writeFile(wb, `통합_출력일보_샘플양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const getSampleDataForType = (type: SheetType): Record<string, any>[] => {
        switch (type) {
            case 'Company':
                return [
                    { name: '(주)대한건설', code: 'CY001', companyType: '시공사', ceoName: '김대한', ceoResidentNumber: '700101-1234567', businessNumber: '123-45-67890', address: '서울시 강남구 테헤란로 123', phone: '02-1234-5678', email: 'office@daehan.co.kr', bankName: '국민은행', accountNumber: '123-456-789012', accountHolder: '김대한', color: '#4f46e5' },
                    { name: '삼성엔지니어링', code: 'CY002', companyType: '협력사', ceoName: '이삼성', ceoResidentNumber: '', businessNumber: '234-56-78901', address: '경기도 수원시 영통구 삼성로 456', phone: '031-234-5678', email: 'contact@samsung-eng.co.kr', bankName: '신한은행', accountNumber: '234-567-890123', accountHolder: '이삼성', color: '#16a34a' },
                    { name: '한화건설', code: 'CY003', companyType: '발주사', ceoName: '박한화', ceoResidentNumber: '680202-2345678', businessNumber: '345-67-89012', address: '서울시 중구 청계천로 100', phone: '02-3456-7890', email: 'admin@hanwha.co.kr', bankName: '우리은행', accountNumber: '345-678-901234', accountHolder: '박한화', color: '#dc2626' }
                ];
            case 'Site':
                return [
                    { name: '강남역 복합개발', companyName: '(주)대한건설', partnerCompanyName: '삼성엔지니어링', clientCompanyName: '한화건설', responsibleTeamName: '1공구팀', code: 'S-2024-001', address: '서울시 강남구 역삼동 123', status: 'active', siteType: '도급', paymentMethod: '계산서', startDate: '2024-01-01', endDate: '2024-12-31', color: '#2563eb' },
                    { name: '판교 테크노밸리 2단계', companyName: '삼성엔지니어링', partnerCompanyName: '한화건설', clientCompanyName: '(주)대한건설', responsibleTeamName: '2공구팀', code: 'S-2024-002', address: '경기도 성남시 분당구 판교로 256', status: 'active', siteType: '직영', paymentMethod: '노무', startDate: '2024-03-01', endDate: '2025-06-30', color: '#0ea5e9' },
                    { name: '송도 국제업무단지', companyName: '한화건설', partnerCompanyName: '(주)대한건설', clientCompanyName: '삼성엔지니어링', responsibleTeamName: '철근조', code: 'S-2024-003', address: '인천시 연수구 송도동 200', status: 'planned', siteType: '도급', paymentMethod: '계산서', startDate: '2024-02-15', endDate: '2025-02-14', color: '#1d4ed8' }
                ];
            case 'Team':
                return [
                    { name: '1공구팀', companyName: '(주)대한건설', leaderName: '김대리', type: '지원팀', defaultSalaryModel: '일급제', parentTeamName: '관리팀', role: '종합', status: 'active', color: '#2563eb' },
                    { name: '2공구팀', companyName: '삼성엔지니어링', leaderName: '박반장', type: '용역팀', defaultSalaryModel: '용역팀', parentTeamName: '관리팀', role: '철근', status: 'active', color: '#16a34a' },
                    { name: '철근조', companyName: '한화건설', leaderName: '이팀장', type: '일용직', defaultSalaryModel: '일급제', parentTeamName: '', role: '철근공', status: 'active', color: '#f97316' },
                    { name: '형틀반', companyName: '(주)대한건설', leaderName: '최기사', type: '지원팀', defaultSalaryModel: '지원팀', parentTeamName: '1공구팀', role: '형틀목공', status: 'waiting', color: '#0ea5e9' }
                ];
            case 'Worker':
                return [
                    { name: '김철수', idNumber: '900101-1234567', teamName: '1공구팀', teamType: '지원팀', companyName: '(주)대한건설', position: '반장', unitPrice: 180000, salaryType: '일급제', contact: '010-1234-5678', email: 'chulsoo@worker.com', address: '서울시 강남구 역삼동 123-45', status: '재직', salaryModel: '일급제', bloodType: 'A형', bankName: '국민은행', accountNumber: '123-456-789012', accountHolder: '김철수', fileNameSaved: 'kim_id.jpg', color: '#0f766e' },
                    { name: '이영희', idNumber: '850315-2345678', teamName: '1공구팀', teamType: '지원팀', companyName: '(주)대한건설', position: '기공', unitPrice: 220000, salaryType: '일급제', contact: '010-2345-6789', email: 'younghee@worker.com', address: '서울시 서초구 서초동 456-78', status: '재직', salaryModel: '일급제', bloodType: 'B형', bankName: '신한은행', accountNumber: '234-567-890123', accountHolder: '이영희', fileNameSaved: 'lee_id.jpg', color: '#0f766e' },
                    { name: '박진우', idNumber: '880720-1456789', teamName: '철근조', teamType: '일용직', companyName: '한화건설', position: '조장', unitPrice: 230000, salaryType: '일급제', contact: '010-3456-7890', email: 'jinwoo@worker.com', address: '경기도 성남시 분당구 정자동 789', status: '재직', salaryModel: '일급제', bloodType: 'O형', bankName: '우리은행', accountNumber: '345-678-901234', accountHolder: '박진우', fileNameSaved: 'park_id.jpg', color: '#0f766e' },
                    { name: '최민수', idNumber: '920505-1567890', teamName: '2공구팀', teamType: '용역팀', companyName: '삼성엔지니어링', position: '기능공', unitPrice: 200000, salaryType: '월급제', contact: '010-4567-8901', email: 'minsoo@worker.com', address: '경기도 수원시 영통구 매탄동 321', status: '재직', salaryModel: '월급제', bloodType: 'AB형', bankName: '하나은행', accountNumber: '456-789-012345', accountHolder: '최민수', fileNameSaved: 'choi_id.jpg', color: '#0f766e' },
                    { name: '정수진', idNumber: '870812-2678901', teamName: '형틀반', teamType: '지원팀', companyName: '(주)대한건설', position: '일반', unitPrice: 210000, salaryType: '일급제', contact: '010-5678-9012', email: 'soojin@worker.com', address: '서울시 송파구 잠실동 654', status: '재직', salaryModel: '일급제', bloodType: 'A형', bankName: '농협', accountNumber: '567-890-123456', accountHolder: '정수진', fileNameSaved: 'jung_id.jpg', color: '#0f766e' }
                ];
            case 'DailyReport':
                return [
                    { date: '2024-01-15', siteName: '강남역 복합개발', teamName: '1공구팀', paymentMethod: '계산서', workerName: '김철수', manDay: 1.0, position: '반장', salaryType: '일급제', unitPrice: 180000, workContent: '자재 정리 및 청소', companyName: '(주)대한건설', partnerCompanyName: '삼성엔지니어링', clientCompanyName: '한화건설', responsibleTeamName: '1공구팀' },
                    { date: '2024-01-15', siteName: '강남역 복합개발', teamName: '1공구팀', paymentMethod: '계산서', workerName: '이영희', manDay: 1.0, position: '기공', salaryType: '일급제', unitPrice: 220000, workContent: '거푸집 설치', companyName: '(주)대한건설', partnerCompanyName: '삼성엔지니어링', clientCompanyName: '한화건설', responsibleTeamName: '1공구팀' },
                    { date: '2024-01-15', siteName: '판교 테크노밸리 2단계', teamName: '철근조', paymentMethod: '노무', workerName: '박진우', manDay: 1.0, position: '조장', salaryType: '일급제', unitPrice: 230000, workContent: '철근 배근', companyName: '삼성엔지니어링', partnerCompanyName: '한화건설', clientCompanyName: '(주)대한건설', responsibleTeamName: '철근조' },
                    { date: '2024-01-15', siteName: '강남역 복합개발', teamName: '형틀반', paymentMethod: '계산서', workerName: '정수진', manDay: 0.5, position: '일반', salaryType: '일급제', unitPrice: 210000, workContent: '비계 설치', companyName: '(주)대한건설', partnerCompanyName: '삼성엔지니어링', clientCompanyName: '한화건설', responsibleTeamName: '형틀반' },
                    { date: '2024-01-16', siteName: '강남역 복합개발', teamName: '1공구팀', paymentMethod: '계산서', workerName: '김철수', manDay: 1.0, position: '반장', salaryType: '일급제', unitPrice: 180000, workContent: '콘크리트 타설 보조', companyName: '(주)대한건설', partnerCompanyName: '삼성엔지니어링', clientCompanyName: '한화건설', responsibleTeamName: '1공구팀' },
                    { date: '2024-01-16', siteName: '송도 국제업무단지', teamName: '2공구팀', paymentMethod: '계산서', workerName: '최민수', manDay: 1.0, position: '기능공', salaryType: '월급제', unitPrice: 200000, workContent: '현장 정리', companyName: '한화건설', partnerCompanyName: '(주)대한건설', clientCompanyName: '삼성엔지니어링', responsibleTeamName: '2공구팀' }
                ];
            default:
                return [];
        }
    };

    // ==========================================================================
    // 에러 로그 다운로드
    // ==========================================================================

    const downloadErrorLogAsExcel = () => {
        if (errorLogs.length === 0) {
            Swal.fire('알림', '다운로드할 에러 로그가 없습니다.', 'info');
            return;
        }

        const data = errorLogs.map(entry => ({
            '행번호': entry.rowIndex,
            '시트': SHEET_CONFIG[entry.sheetType]?.name || entry.sheetType,
            '상태': entry.status,
            '에러': entry.errors.join('; '),
            '경고': entry.warnings.join('; '),
            '데이터': JSON.stringify(entry.rowData),
            '시간': entry.timestamp
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '에러로그');
        XLSX.writeFile(wb, `통합업로드_에러로그_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // ==========================================================================
    // 필터링된 데이터
    // ==========================================================================

    const filteredGroupedReports = useMemo(() => {
        return groupedReports.filter(group => {
            // 검색어 필터
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                    group.siteName.toLowerCase().includes(query) ||
                    group.teamName.toLowerCase().includes(query) ||
                    group.date.includes(query) ||
                    group.workers.some(w => w.workerName?.toLowerCase().includes(query));
                if (!matchesSearch) return false;
            }

            // 상태 필터
            if (filterStatus !== 'ALL' && group.status !== filterStatus) {
                return false;
            }

            return true;
        });
    }, [groupedReports, searchQuery, filterStatus]);

    // ==========================================================================
    // 통계 계산
    // ==========================================================================

    const previewStats = useMemo(() => {
        const stats = {
            total: 0,
            new: 0,
            update: 0,
            warning: 0,
            error: 0,
            identical: 0
        };

        parsedData.DailyReport.forEach(row => {
            stats.total++;
            switch (row._validation?.status) {
                case 'NEW': stats.new++; break;
                case 'UPDATE': stats.update++; break;
                case 'WARNING': stats.warning++; break;
                case 'ERROR': stats.error++; break;
                case 'IDENTICAL': stats.identical++; break;
            }
        });

        return stats;
    }, [parsedData.DailyReport]);

    // ==========================================================================
    // 렌더링
    // ==========================================================================

    if (!cacheLoaded) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
                    <p className="text-slate-600">기초 데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    // Stage: UPLOAD
    if (stage === 'UPLOAD') {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">통합 출력일보 엑셀 업로드</h1>
                    <p className="text-slate-500">회사, 현장, 팀, 작업자, 출력일보 데이터를 한 번에 업로드합니다.</p>
                </div>

                {/* 권장 처리 순서 안내 */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                    <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        데이터 처리 순서
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                        {PROCESSING_ORDER.map((type, idx) => (
                            <React.Fragment key={type}>
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${SHEET_CONFIG[type].bgColor}`}>
                                    <FontAwesomeIcon icon={SHEET_CONFIG[type].icon} className={SHEET_CONFIG[type].color} />
                                    <span className={`font-medium ${SHEET_CONFIG[type].color}`}>{SHEET_CONFIG[type].name}</span>
                                </div>
                                {idx < PROCESSING_ORDER.length - 1 && (
                                    <FontAwesomeIcon icon={faArrowRight} className="text-slate-400" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* 업로드 영역 */}
                <div
                    className="bg-white p-12 rounded-2xl shadow-lg border-2 border-dashed border-slate-300 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                >
                    <div className="mb-6">
                        <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">엑셀 파일 업로드</h3>
                        <p className="text-slate-500 mb-6">
                            통합 데이터(.xlsx)를 여기에 드래그하거나 클릭하세요
                        </p>
                    </div>

                    <div className="flex justify-center gap-4">
                        <label className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25">
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2" />
                            파일 선택
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                            />
                        </label>
                        <button
                            onClick={downloadSampleExcel}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-500/25"
                        >
                            <FontAwesomeIcon icon={faDownload} className="mr-2" />
                            샘플 양식 다운로드
                        </button>
                    </div>
                </div>

                {/* 엑셀 파일 권장 헤더 */}
                <div className="mt-8 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faInfoCircle} className="text-slate-500" />
                        <h3 className="font-bold text-slate-800">엑셀 파일 권장 헤더</h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">아래 필드로 포함하는 엑셀 파일을 업로드해주세요. <span className="text-red-600 font-semibold">빨간색은 필수 항목</span>입니다.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {PROCESSING_ORDER.map(type => {
                            const config = SHEET_CONFIG[type];
                            const requiredFields = config.fields.filter(f => f.required);
                            const optionalFields = config.fields.filter(f => !f.required);

                            return (
                                <div key={type} className={`p-4 rounded-xl border-2 ${config.bgColor} border-transparent hover:border-slate-200 transition-all`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <FontAwesomeIcon icon={config.icon} className={`${config.color} text-lg`} />
                                        <h4 className={`font-bold ${config.color}`}>{config.name}</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {requiredFields.map(f => (
                                            <span
                                                key={f.key}
                                                className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-semibold"
                                            >
                                                {f.label}*
                                            </span>
                                        ))}
                                        {optionalFields.map(f => (
                                            <span
                                                key={f.key}
                                                className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-700 border border-slate-200"
                                            >
                                                {f.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Stage: MAPPING
    if (stage === 'MAPPING') {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">데이터 연결 (컬럼 매핑)</h1>
                        <p className="text-slate-500">엑셀 컬럼과 시스템 필드를 연결합니다.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStage('UPLOAD')}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <FontAwesomeIcon icon={faTimes} className="mr-2" />
                            취소
                        </button>
                        <button
                            onClick={validateAndPreview}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                        >
                            다음: 데이터 확인
                            <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
                        </button>
                    </div>
                </div>

                {/* 시트별 매핑 */}
                <div className="space-y-6">
                    {PROCESSING_ORDER.map(type => {
                        const config = SHEET_CONFIG[type];
                        const hasData = sheetData[type].length > 0;
                        const mapping = fieldMappings[type];
                        const headers = excelHeaders[type];

                        return (
                            <div
                                key={type}
                                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${!hasData ? 'opacity-50' : ''}`}
                            >
                                <div className={`p-4 ${config.bgColor} flex items-center justify-between`}>
                                    <div className="flex items-center gap-3">
                                        <FontAwesomeIcon icon={config.icon} className={`${config.color} text-xl`} />
                                        <div>
                                            <h3 className={`font-bold ${config.color}`}>{config.name}</h3>
                                            <p className="text-sm text-slate-500">
                                                {hasData ? `${sheetData[type].length}건의 데이터` : '데이터 없음'}
                                            </p>
                                        </div>
                                    </div>
                                    {hasData && (
                                        <span className="px-3 py-1 bg-white rounded-full text-sm font-medium text-slate-600">
                                            {Object.keys(mapping).filter(k => mapping[k]).length} / {config.fields.length} 연결됨
                                        </span>
                                    )}
                                </div>

                                {hasData && (
                                    <div className="p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {config.fields.map(field => (
                                                <div key={field.key} className="relative">
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                                        {field.label}
                                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                                    </label>
                                                    <select
                                                        className={`w-full text-sm rounded-lg border ${!mapping[field.key] && field.required
                                                            ? 'border-red-300 bg-red-50'
                                                            : mapping[field.key]
                                                                ? 'border-green-300 bg-green-50'
                                                                : 'border-slate-300'
                                                            }`}
                                                        value={mapping[field.key] || ''}
                                                        onChange={(e) => handleMappingChange(type, field.key, e.target.value)}
                                                    >
                                                        <option value="">(선택 안함)</option>
                                                        {headers.map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                    {mapping[field.key] && sheetData[type][0] && (
                                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                                            예: {sheetData[type][0][mapping[field.key]] ?? '-'}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Stage: PREVIEW
    if (stage === 'PREVIEW') {
        return (
            <div className="max-w-7xl mx-auto p-6">
                {/* 헤더 */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">데이터 미리보기</h1>
                        <p className="text-slate-500">저장 전 데이터를 확인하세요.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStage('MAPPING')}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            이전
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`px-4 py-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                        >
                            <FontAwesomeIcon icon={faCog} className="mr-2" />
                            설정
                        </button>
                        <button
                            onClick={handleProcess}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={previewStats.error > 0 && previewStats.new === 0 && previewStats.update === 0}
                        >
                            <FontAwesomeIcon icon={faPlay} className="mr-2" />
                            저장 시작 ({previewStats.new + previewStats.update + previewStats.warning}건)
                        </button>
                    </div>
                </div>

                {/* 설정 패널 */}
                {showSettings && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4">업로드 옵션</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoCreateWorker}
                                    onChange={(e) => setAutoCreateWorker(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600"
                                />
                                <span className="text-sm">미등록 작업자 자동 생성</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoCreateTeam}
                                    onChange={(e) => setAutoCreateTeam(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600"
                                />
                                <span className="text-sm">미등록 팀 자동 생성</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoCreateSite}
                                    onChange={(e) => setAutoCreateSite(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600"
                                />
                                <span className="text-sm">미등록 현장 자동 생성</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={overwriteExisting}
                                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600"
                                />
                                <span className="text-sm">기존 데이터 덮어쓰기</span>
                            </label>
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                            <label className="text-sm text-slate-600">배치 크기:</label>
                            <select
                                value={batchSize}
                                onChange={(e) => setBatchSize(Number(e.target.value))}
                                className="text-sm border-slate-300 rounded-lg"
                            >
                                <option value={10}>10건</option>
                                <option value={25}>25건</option>
                                <option value={50}>50건</option>
                                <option value={100}>100건</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* 통계 카드 */}
                <div className="mb-6 grid grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                        <p className="text-3xl font-bold text-slate-700">{previewStats.total}</p>
                        <p className="text-sm text-slate-500">전체</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center">
                        <p className="text-3xl font-bold text-green-600">{previewStats.new}</p>
                        <p className="text-sm text-green-600">신규</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
                        <p className="text-3xl font-bold text-blue-600">{previewStats.update}</p>
                        <p className="text-sm text-blue-600">수정</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                        <p className="text-3xl font-bold text-amber-600">{previewStats.warning}</p>
                        <p className="text-sm text-amber-600">경고</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center">
                        <p className="text-3xl font-bold text-red-600">{previewStats.error}</p>
                        <p className="text-sm text-red-600">오류</p>
                    </div>
                </div>

                {/* 탭 & 필터 */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex border-b border-slate-200">
                        {PROCESSING_ORDER.map(type => (
                            <button
                                key={type}
                                onClick={() => setActiveTab(type)}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === type
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FontAwesomeIcon icon={SHEET_CONFIG[type].icon} />
                                {SHEET_CONFIG[type].name}
                                <span className={`px-2 py-0.5 rounded-full text-xs ${parsedData[type].length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {parsedData[type].length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {activeTab === 'DailyReport' && (
                        <div className="flex items-center gap-4">
                            {/* 검색 */}
                            <div className="relative">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg w-48"
                                />
                            </div>

                            {/* 상태 필터 */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as ValidationStatus | 'ALL')}
                                className="text-sm border-slate-300 rounded-lg"
                            >
                                <option value="ALL">전체 상태</option>
                                <option value="NEW">신규</option>
                                <option value="UPDATE">수정</option>
                                <option value="WARNING">경고</option>
                                <option value="ERROR">오류</option>
                            </select>

                            {/* 뷰 모드 */}
                            <div className="flex border border-slate-300 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grouped')}
                                    className={`px-3 py-2 text-sm ${viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                                >
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                                >
                                    <FontAwesomeIcon icon={faTable} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 데이터 테이블/그룹 뷰 */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {activeTab === 'DailyReport' && viewMode === 'grouped' ? (
                        // 그룹 뷰
                        <div className="divide-y divide-slate-100">
                            {filteredGroupedReports.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <FontAwesomeIcon icon={faFileExcel} className="text-4xl mb-4 opacity-30" />
                                    <p>표시할 데이터가 없습니다.</p>
                                </div>
                            ) : (
                                filteredGroupedReports.map(group => (
                                    <div key={group.key} className="hover:bg-slate-50">
                                        {/* 그룹 헤더 */}
                                        <div
                                            className="p-4 cursor-pointer flex items-center justify-between"
                                            onClick={() => {
                                                const newExpanded = new Set(expandedGroups);
                                                if (newExpanded.has(group.key)) {
                                                    newExpanded.delete(group.key);
                                                } else {
                                                    newExpanded.add(group.key);
                                                }
                                                setExpandedGroups(newExpanded);
                                            }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <FontAwesomeIcon
                                                    icon={expandedGroups.has(group.key) ? faChevronDown : faChevronRight}
                                                    className="text-slate-400 w-4"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${group.status === 'NEW' ? 'bg-green-100 text-green-700' :
                                                            group.status === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                                group.status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                                    group.status === 'ERROR' ? 'bg-red-100 text-red-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {group.status === 'NEW' ? '신규' :
                                                                group.status === 'UPDATE' ? '수정' :
                                                                    group.status === 'WARNING' ? '경고' :
                                                                        group.status === 'ERROR' ? '오류' : '동일'}
                                                        </span>
                                                        <span className="font-bold text-slate-800">{group.date}</span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="text-blue-600 font-medium">{group.siteName}</span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="text-green-600 font-medium">{group.teamName}</span>
                                                    </div>
                                                    {group.errors.length > 0 && (
                                                        <p className="text-xs text-red-500 mt-1">{group.errors[0]}</p>
                                                    )}
                                                    {group.warnings.length > 0 && group.errors.length === 0 && (
                                                        <p className="text-xs text-amber-500 mt-1">{group.warnings[0]}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="text-slate-500">
                                                    {group.workers.length}명
                                                </span>
                                                <span className="font-bold text-slate-700">
                                                    {group.totalManDay.toFixed(1)} M/D
                                                </span>
                                            </div>
                                        </div>

                                        {/* 그룹 상세 */}
                                        {expandedGroups.has(group.key) && (
                                            <div className="px-4 pb-4">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">작업자</th>
                                                            <th className="px-3 py-2 text-left">직책</th>
                                                            <th className="px-3 py-2 text-right">공수</th>
                                                            <th className="px-3 py-2 text-right">단가</th>
                                                            <th className="px-3 py-2 text-left">작업내용</th>
                                                            <th className="px-3 py-2 text-left">상태</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {group.workers.map((worker, idx) => (
                                                            <tr key={idx} className={
                                                                worker._validation?.status === 'ERROR' ? 'bg-red-50' :
                                                                    worker._validation?.status === 'WARNING' ? 'bg-amber-50' : ''
                                                            }>
                                                                <td className="px-3 py-2 font-medium">{worker.workerName}</td>
                                                                <td className="px-3 py-2 text-slate-600">{worker.position || '-'}</td>
                                                                <td className="px-3 py-2 text-right">{worker.manDay}</td>
                                                                <td className="px-3 py-2 text-right">
                                                                    {worker.unitPrice ? Number(worker.unitPrice).toLocaleString() : '-'}
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]">
                                                                    {worker.workContent || '-'}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    {worker._validation?.warnings?.map((w, i) => (
                                                                        <span key={i} className="text-xs text-amber-600 block">{w}</span>
                                                                    ))}
                                                                    {worker._validation?.errors?.map((e, i) => (
                                                                        <span key={i} className="text-xs text-red-600 block">{e}</span>
                                                                    ))}
                                                                    {!worker._validation?.warnings?.length && !worker._validation?.errors?.length && (
                                                                        <FontAwesomeIcon icon={faCheck} className="text-green-500" />
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        // 테이블 뷰
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">상태</th>
                                        {SHEET_CONFIG[activeTab].fields.map(f => (
                                            <th key={f.key} className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase whitespace-nowrap">
                                                {f.label}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">메시지</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {parsedData[activeTab].slice(0, 100).map((row, idx) => (
                                        <tr
                                            key={idx}
                                            className={
                                                row._validation?.status === 'ERROR' ? 'bg-red-50' :
                                                    row._validation?.status === 'WARNING' ? 'bg-amber-50' :
                                                        row._validation?.status === 'UPDATE' ? 'bg-blue-50' :
                                                            'hover:bg-slate-50'
                                            }
                                        >
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row._validation?.status === 'NEW' ? 'bg-green-100 text-green-700' :
                                                    row._validation?.status === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                        row._validation?.status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                            row._validation?.status === 'ERROR' ? 'bg-red-100 text-red-700' :
                                                                'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {row._validation?.status === 'NEW' ? '신규' :
                                                        row._validation?.status === 'UPDATE' ? '수정' :
                                                            row._validation?.status === 'WARNING' ? '경고' :
                                                                row._validation?.status === 'ERROR' ? '오류' : '동일'}
                                                </span>
                                            </td>
                                            {SHEET_CONFIG[activeTab].fields.map(f => (
                                                <td key={f.key} className="px-4 py-3 truncate max-w-[150px]" title={String(row[f.key] ?? '')}>
                                                    {f.type === 'number' && row[f.key] !== undefined && row[f.key] !== null && row[f.key] !== ''
                                                        ? Number(row[f.key]).toLocaleString()
                                                        : String(row[f.key] ?? '-')}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-xs max-w-[200px]">
                                                {row._validation?.errors?.length ? (
                                                    <span className="text-red-600">{row._validation.errors.join(', ')}</span>
                                                ) : row._validation?.warnings?.length ? (
                                                    <span className="text-amber-600">{row._validation.warnings.join(', ')}</span>
                                                ) : (
                                                    <span className="text-green-500">OK</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {parsedData[activeTab].length > 100 && (
                                <div className="p-4 text-center text-slate-400 text-sm">
                                    ... 외 {parsedData[activeTab].length - 100}건 (성능을 위해 100건만 표시)
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 에러 로그 다운로드 */}
                {errorLogs.length > 0 && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={downloadErrorLogAsExcel}
                            className="px-4 py-2 text-sm text-amber-600 border border-amber-300 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
                        >
                            <FontAwesomeIcon icon={faDownload} className="mr-2" />
                            에러/경고 로그 다운로드 ({errorLogs.length}건)
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Stage: PROCESSING
    if (stage === 'PROCESSING') {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">데이터 저장 중...</h1>
                    <p className="text-slate-500">잠시만 기다려주세요.</p>
                </div>

                <div className="space-y-4">
                    {processingLogs.map(log => (
                        <div
                            key={log.step}
                            className={`p-4 rounded-xl border ${log.status === 'success' ? 'bg-green-50 border-green-200' :
                                log.status === 'error' ? 'bg-red-50 border-red-200' :
                                    log.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                                        log.status === 'skipped' ? 'bg-slate-50 border-slate-200' :
                                            'bg-white border-slate-200'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.status === 'success' ? 'bg-green-100 text-green-600' :
                                        log.status === 'error' ? 'bg-red-100 text-red-600' :
                                            log.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                                                'bg-slate-100 text-slate-400'
                                        }`}>
                                        {log.status === 'processing' ? (
                                            <FontAwesomeIcon icon={faSpinner} spin />
                                        ) : log.status === 'success' ? (
                                            <FontAwesomeIcon icon={faCheckCircle} />
                                        ) : log.status === 'error' ? (
                                            <FontAwesomeIcon icon={faExclamationTriangle} />
                                        ) : (
                                            <FontAwesomeIcon icon={SHEET_CONFIG[log.step].icon} />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-700">{SHEET_CONFIG[log.step].name}</h3>
                                        <p className="text-sm text-slate-500">{log.message}</p>
                                    </div>
                                </div>
                                {log.success !== undefined && (
                                    <div className="text-sm text-slate-600">
                                        성공: <span className="font-bold text-green-600">{log.success}</span>
                                        {log.failed! > 0 && (
                                            <>, 실패: <span className="font-bold text-red-600">{log.failed}</span></>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Stage: COMPLETE
    if (stage === 'COMPLETE') {
        const hasErrors = resultSummary.failed > 0;

        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center bg-white rounded-2xl shadow-lg border border-slate-200 p-12">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl ${hasErrors ? 'bg-amber-100 text-amber-500' : 'bg-green-100 text-green-500'
                        }`}>
                        <FontAwesomeIcon icon={hasErrors ? faExclamationTriangle : faCheckCircle} />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                        {hasErrors ? '업로드 완료 (일부 오류)' : '업로드 완료!'}
                    </h1>
                    <p className="text-slate-500 mb-8">모든 데이터가 처리되었습니다.</p>

                    {/* 결과 요약 */}
                    <div className="flex justify-center gap-8 mb-8">
                        <div className="text-center">
                            <p className="text-4xl font-bold text-green-600">{resultSummary.success}</p>
                            <p className="text-sm text-slate-500">성공</p>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold text-red-500">{resultSummary.failed}</p>
                            <p className="text-sm text-slate-500">실패</p>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold text-amber-500">{resultSummary.skipped}</p>
                            <p className="text-sm text-slate-500">건너뜀</p>
                        </div>
                        <div className="text-center">
                            <p className="text-4xl font-bold text-slate-700">{resultSummary.total}</p>
                            <p className="text-sm text-slate-500">전체</p>
                        </div>
                    </div>

                    {/* 에러 로그 다운로드 */}
                    {errorLogs.length > 0 && (
                        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl inline-block">
                            <p className="text-sm text-amber-800 mb-3">
                                총 <strong>{errorLogs.length}</strong>건의 에러/경고 로그가 있습니다.
                            </p>
                            <button
                                onClick={downloadErrorLogAsExcel}
                                className="px-6 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors"
                            >
                                <FontAwesomeIcon icon={faDownload} className="mr-2" />
                                에러 로그 다운로드
                            </button>
                        </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => {
                                setStage('UPLOAD');
                                setRawFile(null);
                                setSheetData({ Company: [], Site: [], Team: [], Worker: [], DailyReport: [] });
                                setParsedData({ Company: [], Site: [], Team: [], Worker: [], DailyReport: [] });
                                setGroupedReports([]);
                                setErrorLogs([]);
                            }}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                        >
                            <FontAwesomeIcon icon={faSyncAlt} className="mr-2" />
                            다른 파일 업로드
                        </button>
                    </div>
                </div>

                {/* 처리 로그 */}
                <div className="mt-8">
                    <h3 className="font-bold text-slate-700 mb-4">처리 상세 로그</h3>
                    <div className="space-y-2">
                        {processingLogs.map(log => (
                            <div
                                key={log.step}
                                className={`p-3 rounded-lg ${log.status === 'success' ? 'bg-green-50' :
                                    log.status === 'error' ? 'bg-red-50' :
                                        'bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FontAwesomeIcon
                                            icon={log.status === 'success' ? faCheckCircle :
                                                log.status === 'error' ? faExclamationTriangle :
                                                    SHEET_CONFIG[log.step].icon}
                                            className={log.status === 'success' ? 'text-green-500' :
                                                log.status === 'error' ? 'text-red-500' :
                                                    'text-slate-400'}
                                        />
                                        <span className="font-medium">{SHEET_CONFIG[log.step].name}</span>
                                    </div>
                                    <span className="text-sm text-slate-600">{log.message}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default IntegratedDailyReportUploader;
