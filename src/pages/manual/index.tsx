import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBook,
    faChartPie,
    faDatabase,
    faClipboardList,
    faFileInvoiceDollar,
    faCogs,
    faChevronRight,
    faStar,
    faCalendarCheck,
    faRocket,
    faLayerGroup
} from '@fortawesome/free-solid-svg-icons';

type SectionId =
    | 'overview'
    | 'quick_start'
    | 'reports'
    | 'manpower_db'
    | 'payroll_tax'
    | 'support_material'
    | 'bulk_upload'
    | 'admin_ops'
    | 'homepage_modify_request';

type ManualSection = {
    id: SectionId;
    title: string;
    icon: IconDefinition;
};

type QuickLinkItem = {
    label: string;
    path: string;
    description: string;
};

const sections: ManualSection[] = [
    { id: 'overview', title: '메뉴얼 개요', icon: faBook },
    { id: 'quick_start', title: '빠른 시작', icon: faRocket },
    { id: 'reports', title: '일보/현황', icon: faChartPie },
    { id: 'manpower_db', title: '인력/DB', icon: faDatabase },
    { id: 'payroll_tax', title: '급여/세금', icon: faFileInvoiceDollar },
    { id: 'support_material', title: '지원/자재', icon: faLayerGroup },
    { id: 'bulk_upload', title: '엑셀 업로드', icon: faCalendarCheck },
    { id: 'admin_ops', title: '운영/관리자', icon: faCogs },
    { id: 'homepage_modify_request', title: '홈페이지 수정요청', icon: faClipboardList }
];

const queryToSectionMap: Record<string, SectionId> = {
    intro: 'overview',
    dashboard: 'reports',
    status: 'reports',
    db: 'manpower_db',
    output: 'reports',
    payroll: 'payroll_tax',
    settings: 'admin_ops',
    dev_process: 'overview',
    'quick-start': 'quick_start',
    'bulk-upload': 'bulk_upload',
    'modify-request': 'homepage_modify_request'
};

const ManualPage: React.FC = () => {
    const [activeSection, setActiveSection] = useState<SectionId>('overview');
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const section = params.get('section');

        if (!section) {
            setActiveSection('overview');
            return;
        }

        setActiveSection(queryToSectionMap[section] ?? 'overview');
    }, [location.search]);

    const QuickLinkGrid: React.FC<{ items: QuickLinkItem[] }> = ({ items }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
                <button
                    key={`${item.label}-${item.path}`}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                    <p className="font-bold text-slate-800">{item.label}</p>
                    <p className="text-xs text-indigo-600 mt-1">{item.path}</p>
                    <p className="text-sm text-slate-600 mt-2">{item.description}</p>
                </button>
            ))}
        </div>
    );

    const renderContent = () => {
        switch (activeSection) {
            case 'overview':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="border-b border-slate-100 pb-6">
                            <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                                <FontAwesomeIcon icon={faBook} className="text-indigo-600" />
                                청연ERP 사용자 메뉴얼
                            </h2>
                            <p className="text-slate-600 mt-3">
                                현재 서비스 라우트 기준으로 메뉴얼을 재구성했습니다. 아래 순서대로 보면 실제 업무 흐름과
                                동일하게 사용할 수 있습니다.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-slate-200 p-5 bg-white">
                                <p className="text-sm text-slate-500">첫 세팅</p>
                                <p className="text-lg font-bold text-slate-800 mt-1">인력/현장/팀 등록</p>
                                <p className="text-sm text-slate-600 mt-2">기초 데이터가 맞아야 이후 정산까지 오류가 줄어듭니다.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-5 bg-white">
                                <p className="text-sm text-slate-500">일일 운영</p>
                                <p className="text-lg font-bold text-slate-800 mt-1">일보 입력과 현황 확인</p>
                                <p className="text-sm text-slate-600 mt-2">현장 투입 인원과 실적을 매일 누적합니다.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-5 bg-white">
                                <p className="text-sm text-slate-500">마감 업무</p>
                                <p className="text-lg font-bold text-slate-800 mt-1">급여/세금/정산</p>
                                <p className="text-sm text-slate-600 mt-2">지급, 가불, 세금계산서 흐름을 한 화면군으로 관리합니다.</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
                            <h3 className="text-xl font-bold text-indigo-900 mb-4">권장 업무 흐름</h3>
                            <ol className="list-decimal pl-5 space-y-2 text-slate-700 text-sm">
                                <li>기초 데이터 등록: 현장/회사/팀/작업자 등록 및 검증</li>
                                <li>배정 관리: 팀 배정, 현장 배정, 직책/단가 적용</li>
                                <li>일보 입력: 일보 작성, 대량 업로드, 통계/현황 확인</li>
                                <li>정산/지급: 일급/월급/팀정산/가불/세금 처리</li>
                                <li>운영 관리: 권한, 메뉴, 백업, 시스템 상태 점검</li>
                            </ol>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-slate-800 mb-4">자주 쓰는 시작 링크</h3>
                            <QuickLinkGrid
                                items={[
                                    { label: '대시보드', path: '/dashboard', description: '당일 운영 현황을 먼저 확인합니다.' },
                                    { label: '통합 일괄 등록', path: '/mass-upload/integrated', description: '기초 데이터 초기 업로드에 사용합니다.' },
                                    { label: '일보 관리', path: '/reports/daily', description: '일보 입력/조회의 기본 화면입니다.' },
                                    { label: '급여 지급 관리', path: '/payroll/wage-payment', description: '실지급 처리의 시작점입니다.' }
                                ]}
                            />
                        </div>
                    </div>
                );

            case 'quick_start':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faRocket} className="text-indigo-600" />
                            빠른 시작 (초기 도입 체크리스트)
                        </h2>

                        <div className="space-y-4">
                            {[
                                {
                                    step: '1단계',
                                    title: '현장/회사/팀/작업자 기초 데이터 등록',
                                    detail: '대량 업로드를 먼저 사용하고, 누락 데이터만 개별 화면에서 보완합니다.'
                                },
                                {
                                    step: '2단계',
                                    title: '배정 및 단가 체계 확정',
                                    detail: '현장 배정/팀 배정/단가 변경을 반영한 뒤 일보를 시작합니다.'
                                },
                                {
                                    step: '3단계',
                                    title: '일보 입력 방식 선택',
                                    detail: '일반 입력, v2, 스마트 입력, 엑셀 업로드 중 현장에 맞는 방식을 정합니다.'
                                },
                                {
                                    step: '4단계',
                                    title: '급여/정산 시나리오 설정',
                                    detail: '일급/월급/지원팀/팀정산/가불을 어떤 화면에서 처리할지 운영 규칙을 고정합니다.'
                                }
                            ].map((item) => (
                                <div key={item.step} className="bg-white p-5 rounded-xl border border-slate-200">
                                    <p className="text-xs font-bold text-indigo-600">{item.step}</p>
                                    <h3 className="text-lg font-bold text-slate-800 mt-1">{item.title}</h3>
                                    <p className="text-sm text-slate-600 mt-2">{item.detail}</p>
                                </div>
                            ))}
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '통합 엑셀등록', path: '/mass-upload/integrated', description: '기초 데이터 대량 입력' },
                                { label: '현장 배정', path: '/assignment/site-assignment', description: '현장별 팀 운영 체계 반영' },
                                { label: '팀 배정', path: '/assignment/team-assignment', description: '팀 기준 인력 배치 관리' },
                                { label: '단가 변경', path: '/hr/rate-change', description: '직책/단가 정책 적용' },
                                { label: '일보 관리', path: '/reports/daily', description: '일일 데이터 수집 시작' },
                                { label: '급여 지급', path: '/payroll/wage-payment', description: '정산 후 지급 처리' }
                            ]}
                        />
                    </div>
                );

            case 'reports':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faChartPie} className="text-indigo-600" />
                            일보/현황 운영
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">일보 입력군</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>기본: `/reports/daily`</li>
                                    <li>개선형: `/reports/daily-v2`</li>
                                    <li>스마트 입력: `/report/excel`</li>
                                    <li>대량 업로드: `/report/mass-upload`, `/mass-upload/daily-report`</li>
                                </ul>
                            </div>
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">현황/분석군</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>대시보드: `/dashboard`, `/dashboard-v2`</li>
                                    <li>통합 현황: `/jeonkuk/integrated-status`</li>
                                    <li>통합 지원 현황: `/jeonkuk/integrated-support-status`</li>
                                    <li>그래프/통계: `/jeonkuk/status-graph`, `/reports/statistics`</li>
                                    <li>팀별/인원별 조회: `/reports/team-personnel-status`</li>
                                </ul>
                            </div>
                        </div>

                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                            <h3 className="font-bold text-emerald-900 mb-2">실무 권장 루틴</h3>
                            <p className="text-sm text-slate-700">
                                오전: 현황판 확인 → 낮: 일보 입력/검수 → 저녁: 팀/인원별 누계 확인 순서로 운영하면 누락을 줄일 수 있습니다.
                            </p>
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '일보 관리', path: '/reports/daily', description: '일보 작성/조회 기본 화면' },
                                { label: '스마트 입력', path: '/report/excel', description: '엑셀 친화 입력 화면' },
                                { label: '통합 현황판', path: '/jeonkuk/integrated-status', description: '실시간 투입 현황 확인' },
                                { label: '팀별/인원별 조회', path: '/reports/team-personnel-status', description: '누적 실적 추적' }
                            ]}
                        />
                    </div>
                );

            case 'manpower_db':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faDatabase} className="text-indigo-600" />
                            인력/DB 관리
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">등록/관리</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>팀 관리: `/manpower/team-management`</li>
                                    <li>작업자 대량 등록: `/manpower/smart-registration`</li>
                                    <li>작업자 그리드 등록: `/manpower/smart-registration-grid`</li>
                                    <li>팀/현장 대량 등록: `/manpower/smart-team-registration`, `/manpower/smart-site-registration`</li>
                                    <li>프리랜서 관리: `/manpower/freelancer`</li>
                                </ul>
                            </div>
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">DB/구조 확인</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>통합DB: `/database/manpower-db`</li>
                                    <li>회사DB: `/database/company-db`</li>
                                    <li>구조도: `/jeonkuk/db-structure`, `/jeonkuk/db-design`</li>
                                    <li>데이터 관계: `/admin/data-relationships`, `/admin/relationship-console`</li>
                                </ul>
                            </div>
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '통합DB', path: '/database/manpower-db', description: '기초 데이터 통합 조회' },
                                { label: '회사DB', path: '/database/company-db', description: '협력사/회사 데이터 관리' },
                                { label: '팀 관리', path: '/manpower/team-management', description: '팀 단위 운영 핵심 화면' },
                                { label: '작업자 요약', path: '/manpower/summary', description: '작업자 현황 요약 확인' }
                            ]}
                        />
                    </div>
                );

            case 'payroll_tax':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-600" />
                            급여/세금/정산
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">급여 처리</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>지급 관리: `/payroll/wage-payment`</li>
                                    <li>일급/월급: `/payroll/daily-wage`, `/payroll/monthly-wage`</li>
                                    <li>명세서: `/payroll/payslip`, `/payroll/team-payslip`</li>
                                    <li>가불: `/payroll/advance-payment`</li>
                                    <li>팀정산: `/payroll/team-settlement`</li>
                                </ul>
                            </div>
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">세금/증빙</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>세금계산서 발행/원장: `/payroll/tax-invoice`, `/payroll/tax-invoice-ledger`</li>
                                    <li>거래처 장부/대시보드: `/payroll/partner-ledger`, `/payroll/taxinvoice/dashboard`</li>
                                    <li>계좌관리/계좌조회/세무: `/payroll/taxinvoice/account-inquiry`, `/payroll/taxinvoice/bank-inquiry`, `/payroll/tax-affairs`</li>
                                    <li>서명/위임장: `/payroll/sign-management`, `/payroll/delegation-letter-v5`</li>
                                </ul>
                            </div>
                        </div>

                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
                            <h3 className="font-bold text-amber-900 mb-2">월 마감 기준 권장 순서</h3>
                            <p className="text-sm text-slate-700">
                                일보 마감 → 팀정산 → 가불 반영 → 급여 지급 → 세금계산서 원장 확인 순서로 처리하면 누락 교정이 쉽습니다.
                            </p>
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '급여 지급 관리', path: '/payroll/wage-payment', description: '최종 지급 처리' },
                                { label: '팀정산 관리', path: '/payroll/team-settlement', description: '팀 단위 정산 검증' },
                                { label: '가불 관리', path: '/payroll/advance-payment', description: '가불 등록/정산 반영' },
                                { label: '세금계산서 원장', path: '/payroll/tax-invoice-ledger', description: '증빙 이력 관리' }
                            ]}
                        />
                    </div>
                );

            case 'support_material':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faLayerGroup} className="text-indigo-600" />
                            지원/자재/현장 운영
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">지원 운영</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>지원 설정/현황: `/support/settings`, `/support/status`</li>
                                    <li>지원 단가/교류정산: `/support/rate-management`, `/support/labor-exchange`</li>
                                    <li>숙소/차량/카드: `/support/accommodation`, `/support/vehicles`, `/support/cards`</li>
                                </ul>
                            </div>
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">자재/사무실</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>자재 마스터/입출고: `/materials/master`, `/materials/inbound`, `/materials/outbound`</li>
                                    <li>재고 조회: `/materials/inventory`, `/materials/inventory-by-site`</li>
                                    <li>사무실 관리: `/office/management`</li>
                                    <li>현장 관리 시스템: `/site/management`</li>
                                </ul>
                            </div>
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '지원 현황판', path: '/support/status', description: '지원비 흐름 모니터링' },
                                { label: '숙소 관리', path: '/support/accommodation', description: '현장 숙소 운영 관리' },
                                { label: '재고 현황', path: '/materials/inventory', description: '자재 재고 실시간 확인' },
                                { label: '현장별 재고', path: '/materials/inventory-by-site', description: '현장 단위 재고 비교' }
                            ]}
                        />
                    </div>
                );

            case 'bulk_upload':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faCalendarCheck} className="text-indigo-600" />
                            엑셀 업로드 가이드
                        </h2>

                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h3 className="font-bold text-slate-800 mb-2">권장 업로드 순서</h3>
                            <p className="text-sm text-slate-600 mb-3">
                                데이터 참조관계 때문에 아래 순서로 올리면 오류가 가장 적습니다.
                            </p>
                            <p className="text-sm text-slate-700 font-medium">
                                현장/회사 → 팀 → 작업자 → 출력일보
                            </p>
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '통합 일괄 등록', path: '/mass-upload/integrated', description: '한 화면에서 다중 시트 업로드' },
                                { label: '작업자 업로드', path: '/upload/worker', description: '작업자 전용 엑셀 등록' },
                                { label: '팀 업로드', path: '/upload/team', description: '팀 전용 엑셀 등록' },
                                { label: '현장 업로드', path: '/upload/site', description: '현장 전용 엑셀 등록' },
                                { label: '회사 업로드', path: '/upload/company', description: '회사 전용 엑셀 등록' },
                                { label: '출력일보 업로드', path: '/mass-upload/daily-report', description: '일보 데이터 대량 반영' },
                                { label: '안전 업로드 상세 가이드', path: '/manual/excel-guide', description: '4단계 마법사 상세 설명' },
                                { label: '엑셀 데이터 구조도', path: '/admin/excel-guide', description: '필드 구조 확인용 문서' }
                            ]}
                        />
                    </div>
                );

            case 'admin_ops':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-3">
                            <FontAwesomeIcon icon={faCogs} className="text-indigo-600" />
                            운영/관리자 메뉴
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">일반 운영</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>설정: `/settings`, `/settings/ai`, `/settings/system-messages`</li>
                                    <li>프로필: `/profile`</li>
                                    <li>저장소: `/storage`, `/storage/google-drive`</li>
                                    <li>시스템 동기화: `/system/sync-status`</li>
                                </ul>
                            </div>
                            <div className="p-5 rounded-xl border border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-800">관리자 기능</h3>
                                <ul className="list-disc pl-5 text-sm text-slate-600 mt-3 space-y-1">
                                    <li>메뉴/권한: `/admin/menu-manager`, `/admin/role-menu`</li>
                                    <li>무결성/백업: `/admin/integrity`, `/admin/data-backup`</li>
                                    <li>데이터 콘솔: `/admin/console`, `/admin/relationship-console`</li>
                                    <li>시스템 상태: `/admin/system-status`</li>
                                </ul>
                            </div>
                        </div>

                        <QuickLinkGrid
                            items={[
                                { label: '시스템 설정', path: '/settings', description: '기본 운영 설정' },
                                { label: 'AI 설정', path: '/settings/ai', description: 'Gemini 모델/페이지별 AI 제어' },
                                { label: '메뉴 관리', path: '/admin/menu-manager', description: '메뉴 구조/노출 제어' },
                                { label: '권한 관리', path: '/admin/role-menu', description: '역할별 접근 권한 설정' },
                                { label: '데이터 백업', path: '/admin/data-backup', description: '정기 백업 및 복구 대응' }
                            ]}
                        />
                    </div>
                );

            case 'homepage_modify_request':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
                            <FontAwesomeIcon icon={faStar} className="text-indigo-600" />
                            홈페이지 수정요청 사용법
                        </h2>

                        <ol className="list-decimal pl-5 space-y-3 text-slate-700 text-sm">
                            <li>
                                <strong>수정 범위 명확화:</strong> 페이지 경로, 위치, 원하는 변경 결과를 캡처와 함께 남깁니다.
                            </li>
                            <li>
                                <strong>우선순위 표기:</strong> 필수/권장/보류로 구분해 개발 처리 순서를 명확히 합니다.
                            </li>
                            <li>
                                <strong>요청 번호 부여:</strong> `M-YYYY-001` 형식으로 추적 번호를 만들어 이력을 관리합니다.
                            </li>
                            <li>
                                <strong>검수 완료 조건:</strong> 수정 전/후 비교 화면 확인 후 승인되면 완료 처리합니다.
                            </li>
                        </ol>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                            <h3 className="font-bold text-slate-800 mb-2">요청 템플릿</h3>
                            <p className="text-sm text-slate-700">
                                요청 제목 / 페이지 경로 / 변경 전 / 변경 후 / 우선순위 / 희망 반영일 / 검수 담당자
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="flex h-full bg-[#f8fafc] font-['Pretendard']">
            <div className="w-72 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col shadow-lg z-10">
                <div className="p-8 border-b border-slate-100 bg-white">
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <span className="text-indigo-600">Manual</span>
                        <span className="text-slate-300 font-light">|</span>
                        <span className="text-sm text-slate-500 font-bold mt-1">청연ERP</span>
                    </h1>
                </div>

                <nav className="p-4 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            type="button"
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-sm font-bold transition-all duration-200 group ${activeSection === section.id
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm translate-x-1'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activeSection === section.id
                                            ? 'bg-indigo-200 text-indigo-700'
                                            : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={section.icon} />
                                </div>
                                {section.title}
                            </div>
                            {activeSection === section.id && (
                                <FontAwesomeIcon icon={faChevronRight} className="text-xs text-indigo-400" />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-10 min-h-[800px] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="relative z-10">{renderContent()}</div>
                </div>
            </div>
        </div>
    );
};

export default ManualPage;
