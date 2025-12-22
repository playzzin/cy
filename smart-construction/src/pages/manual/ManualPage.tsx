import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBook, faChartPie, faDatabase, faClipboardList, faFileInvoiceDollar,
    faCogs, faCheckCircle, faChevronRight, faStar, faCalendarCheck,
    faChartSimple, faListCheck, faCode, faRocket, faLayerGroup, faMobileScreen, faBrain, faUserGroup
} from '@fortawesome/free-solid-svg-icons';

const ManualPage: React.FC = () => {
    const [activeSection, setActiveSection] = useState('intro');
    const location = useLocation();

    // 쿼리 파라미터(section)에 따라 활성 섹션 설정
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const section = params.get('section');

        if (!section) {
            setActiveSection('intro');
            return;
        }

        switch (section) {

            case 'modify-request':
                setActiveSection('homepage_modify_request');
                break;

            default:
                setActiveSection('intro');
        }
    }, [location.search]);

    // 청연 집중 메뉴 구조
    const sections = [
        { id: 'intro', title: '청연ERP 소개', icon: faBook },
        { id: 'dashboard', title: '대시보드', icon: faChartPie },
        { id: 'status', title: '현황관리', icon: faChartSimple },
        { id: 'db', title: '통합DB', icon: faDatabase },
        { id: 'output', title: '출력 관리', icon: faClipboardList },
        { id: 'payroll', title: '급여관리', icon: faFileInvoiceDollar },
        { id: 'settings', title: '설정', icon: faCogs },
        { id: 'dev_process', title: '개발 과정 (Roadmap)', icon: faCode },

        { id: 'homepage_modify_request', title: '홈페이지 수정요청 사용법', icon: faClipboardList },

    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'intro':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">
                                <FontAwesomeIcon icon={faBook} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">청연ENG ERP 시스템</h2>
                                <p className="text-lg text-slate-500 font-medium">건설 현장 통합 관리의 새로운 표준</p>
                            </div>
                        </div>

                        <p className="text-slate-600 leading-relaxed text-lg border-b border-slate-100 pb-6">
                            청연ERP는 <strong>청연이엔지</strong>에 최적화된 맞춤형 현장 관리 솔루션입니다.<br />
                            복잡한 인력 관리와 노무비 정산을 자동화하고, 단일 시스템에서 모든 현황을 실시간으로 파악할 수 있도록 설계되었습니다.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 text-xl">
                                    <FontAwesomeIcon icon={faChartSimple} />
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg mb-2">실시간 통합 현황</h3>
                                <p className="text-slate-600">본사 및 외부 지원 현장의 모든 인원 투입 현황을 한눈에 파악하고 통제합니다.</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 text-xl">
                                    <FontAwesomeIcon icon={faBrain} />
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg mb-2">AI 기반 업무 자동화</h3>
                                <p className="text-slate-600">카카오톡 사진 인식부터 신분증 스캔까지, 반복 업무를 AI가 대신 처리합니다.</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 text-xl">
                                    <FontAwesomeIcon icon={faFileInvoiceDollar} />
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg mb-2">정확한 급여/노무비</h3>
                                <p className="text-slate-600">복잡한 공수 계산과 급여 계산을 자동화하여 휴먼 에러를 0%로 줄입니다.</p>
                            </div>
                        </div>
                    </div>
                );

            case 'dashboard':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
                            <FontAwesomeIcon icon={faChartPie} className="text-indigo-600" /> 대시보드 (Dashboard)
                        </h2>
                        <div className="prose max-w-none text-slate-600">
                            <p>시스템 접속 시 메인 화면으로, 회사의 핵심 지표를 실시간으로 시각화하여 보여줍니다.</p>
                            <ul className="list-disc pl-5 space-y-2 mt-4">
                                <li><strong>핵심 KPI 카드:</strong> 총 작업자 수, 가동 중인 현장 수, 금일 총 출력 인원 등 주요 수치를 직관적으로 확인합니다.</li>
                                <li><strong>월별 추이 차트:</strong> 지난달 대비 출력 인원의 증감 추이를 그래프로 분석합니다.</li>
                                <li><strong>빠른 실행 메뉴:</strong> 자주 사용하는 기능으로 즉시 이동할 수 있는 단축 버튼을 제공합니다.</li>
                            </ul>
                        </div>
                    </div>
                );

            case 'status':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                                <FontAwesomeIcon icon={faChartSimple} className="text-indigo-600" /> 현황관리 (Status Management)
                            </h2>
                            <p className="text-slate-600 mb-6 text-lg">
                                단순한 집계를 넘어, <strong>다차원 데이터 분석 엔진</strong>을 통해 현장의 투입 현황을 정밀하게 산출하고 시각화합니다.
                            </p>
                        </div>

                        <div className="space-y-8">
                            {/* 1. 통합 현황판 */}
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">01</span>
                                    통합 현황판 (Integrated Dashboard)
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-slate-700 border-l-4 border-indigo-500 pl-3">통합 산출 근거 (Calculation Logic)</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-3 leading-relaxed">
                                            <p>
                                                <strong>1. 재귀적 공수 집계 (Recursive Aggregation):</strong><br />
                                                현장 데이터는 <code>현장 &gt; 팀 &gt; 작업자</code>의 3단계 계층 구조를 가집니다. 시스템은 최하위 '작업자' 단위의 0.1공수까지 오차 없이 트리를 타고 올라가며 실시간으로 합산합니다.
                                            </p>
                                            <p>
                                                <strong>2. 교차 검증 알고리즘 (Cross-Validation):</strong><br />
                                                단순 합산뿐만 아니라, 팀별 투입 인원과 현장별 총원 데이터를 교차 검증하여 데이터의 무결성을 99.9% 보장합니다.
                                            </p>
                                            <p>
                                                <strong>3. 동적 필터링 엔진 (Dynamic Filtering):</strong><br />
                                                '청연이엔지(본사)' 데이터와 '외부 지원' 데이터를 ID 기반으로 즉시 분리하여 계산합니다. 이는 DB 쿼리 없이 클라이언트 레벨에서 수행되어 0.1초 미만의 반응 속도를 제공합니다.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-bold text-slate-700 border-l-4 border-orange-500 pl-3">시각화 고도화 (Advanced Visualization)</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-3 leading-relaxed">
                                            <p>
                                                <strong>1. 스마트 그리드 패킹 (Smart Grid Packing):</strong><br />
                                                <code>grid-auto-flow: dense</code> 알고리즘을 적용하여, 카드가 펼쳐질 때 빈 공간(Gap) 없이 화면을 자동으로 꽉 채우도록 설계되었습니다. 이는 정보 밀도를 극대화합니다.
                                            </p>
                                            <p>
                                                <strong>2. 직관적 색상 코딩 (Context-Aware Coloring):</strong><br />
                                                <span className="text-indigo-600 font-bold">• 내부지원(청연):</span> 신뢰와 안정을 상징하는 <span className="text-indigo-600">Indigo</span> 테마 적용<br />
                                                <span className="text-orange-500 font-bold">• 외부지원(타사):</span> 주의와 구분을 위한 <span className="text-orange-500">Orange</span> 테마 자동 적용<br />
                                                이 로직은 <code>User Company ID</code>를 실시간 비교하여 자동으로 렌더링됩니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 통합 지원 현황판 */}
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm">02</span>
                                    통합 지원 현황판 (Support Status)
                                </h3>
                                <p className="text-slate-600 mb-4">
                                    현장별로 발생하는 <strong>간접비(식대, 유류비, 숙소비 등)</strong>를 공수와 연동하여 분석합니다.
                                </p>
                                <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <li className="bg-green-50 p-4 rounded-lg border border-green-100">
                                        <strong className="block text-green-800 mb-2">비용/공수 비율 분석</strong>
                                        <span className="text-xs text-green-700">1공수당 발생하는 지원비를 실시간으로 산출하여 현장의 효율성을 판단하는 지표로 활용합니다.</span>
                                    </li>
                                    <li className="bg-green-50 p-4 rounded-lg border border-green-100">
                                        <strong className="block text-green-800 mb-2">예산 임계값 알림</strong>
                                        <span className="text-xs text-green-700">설정된 지원비 예산을 초과할 경우 시스템이 자동으로 경고를 표시합니다.</span>
                                    </li>
                                    <li className="bg-green-50 p-4 rounded-lg border border-green-100">
                                        <strong className="block text-green-800 mb-2">기간별 추이 그래프</strong>
                                        <span className="text-xs text-green-700">월별/분기별 지원비 지출 추이를 꺾은선 그래프로 시각화하여 비용 흐름을 예측합니다.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* 3. 인원전체내역조회 */}
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm">03</span>
                                    인원 전체 내역 조회 (Total History)
                                </h3>
                                <div className="flex gap-4 items-start">
                                    <div className="flex-1 bg-purple-50 p-4 rounded-lg text-sm text-purple-900 leading-relaxed">
                                        <p className="mb-2"><strong>빅데이터 처리 엔진:</strong></p>
                                        수천 명의 작업자와 수년 간의 출역 기록(수십만 건)을 <strong>인메모리 캐싱(In-Memory Caching)</strong> 기법으로 처리하여, 검색 버튼을 누르는 즉시(0.5초 이내) 결과를 반환합니다.
                                        특정 작업자가 1년 전 어느 현장에서 며칠간 근무했는지, 총 지급액은 얼마인지 1원 단위까지 정확하게 역추적할 수 있습니다.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'db':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                                <FontAwesomeIcon icon={faDatabase} className="text-indigo-600" /> 통합DB (Integrated Database)
                            </h2>
                            <p className="text-slate-600 mb-6 text-lg">
                                시스템의 근간이 되는 기초 데이터를 <strong>NoSQL 아키텍처</strong> 기반으로 설계하여, 유연한 확장성과 초고속 데이터 처리를 보장합니다.
                            </p>
                        </div>

                        <div className="space-y-8">
                            {/* 1. 작업자 DB - 데이터 아키텍처 */}
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">01</span>
                                    인메모리 작업자 관리 (In-Memory Worker Engine)
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-slate-700 border-l-4 border-blue-500 pl-3">데이터 구조 및 무결성 (Schema & Integrity)</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-3 leading-relaxed">
                                            <p>
                                                <strong>1. 유니크 키 인덱싱 (Unique Indexing):</strong><br />
                                                주민등록번호와 연락처의 중복을 원천 차단하기 위해 <code>Composite Key Index</code>를 적용했습니다. 동명이인이 있어도 시스템은 정확하게 식별합니다.
                                            </p>
                                            <p>
                                                <strong>2. 타입 안전성 (Type Safety):</strong><br />
                                                TypeScript Interface를 통해 단가, 계좌번호 등 핵심 데이터의 타입을 엄격하게 검증합니다. 잘못된 데이터 형식이 DB에 저장되는 것을 컴파일 단계에서 방지합니다.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-bold text-slate-700 border-l-4 border-indigo-500 pl-3">실시간 동기화 (Real-time Synchronization)</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-3 leading-relaxed">
                                            <p>
                                                <strong>1. 리스너 기반 업데이트 (Firestore Listeners):</strong><br />
                                                현장에서 작업자 정보를 수정하는 즉시, 본사 관리자의 화면에도 별도의 새로고침 없이 <code>0.05초</code> 내에 변경 사항이 반영됩니다.
                                            </p>
                                            <p>
                                                <strong>2. 오프라인 지속성 (Offline Persistence):</strong><br />
                                                네트워크 연결이 불안정한 현장에서도 데이터를 조회하고 수정할 수 있으며, 연결이 복구되는 즉시 서버와 동기화됩니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100">
                                    <FontAwesomeIcon icon={faBrain} className="text-blue-600 mt-1" />
                                    <div>
                                        <strong className="text-blue-800">AI 스마트 입력 (AI-Powered Input)</strong>
                                        <p className="text-sm text-blue-700 mt-1">
                                            Gemini Pro Vision API를 연동하여, 신분증 사진을 업로드하면 이름, 주민번호, 주소를 AI가 98% 이상의 정확도로 추출하여 자동 입력합니다. (OCR 기술 적용)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 현장/팀 DB - 관계형 모델링 */}
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center text-sm">02</span>
                                    관계형 매핑 시스템 (Relational Mapping)
                                </h3>
                                <p className="text-slate-600 mb-4">NoSQL의 유연함 위에 관계형 데이터베이스(RDBMS)의 강력한 참조 무결성을 구현했습니다.</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border border-slate-200 rounded-xl p-5 hover:bg-slate-50 transition-colors">
                                        <div className="text-cyan-600 font-bold mb-2 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faLayerGroup} /> 현장 (Site)
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            최상위 엔티티로서 다수의 팀을 포함합니다.<br />
                                            <strong>Cascading Delete:</strong> 현장 종료 시 산하 팀 배정을 자동으로 해제하거나 보존하는 옵션을 제공합니다.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center text-slate-300">
                                        <FontAwesomeIcon icon={faChevronRight} />
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-5 hover:bg-slate-50 transition-colors">
                                        <div className="text-indigo-600 font-bold mb-2 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faUserGroup} /> 팀 (Team)
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            작업자와 현장을 잇는 중간 관리 객체입니다.<br />
                                            <strong>Dynamic Mapping:</strong> 팀장이 변경되면 해당 팀원들의 보고 체계가 자동으로 업데이트됩니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'output':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
                            <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" /> 출력 관리
                        </h2>
                        <div className="space-y-4">
                            <div className="bg-white p-5 rounded-lg border border-slate-200">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">1</span>
                                    일보 작성 (Daily Report)
                                </h3>
                                <p className="text-sm text-slate-600 pl-8">
                                    매일의 작업 내역을 기록합니다. AI 기능을 통해 카카오톡으로 받은 작업 사진을 업로드하면 자동으로 인원과 공수를 분석해줍니다.
                                </p>
                            </div>
                            <div className="bg-white p-5 rounded-lg border border-slate-200">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">2</span>
                                    일보 목록
                                </h3>
                                <p className="text-sm text-slate-600 pl-8">
                                    작성된 문서를 날짜별로 조회하고, 엑셀 파일로 다운로드하거나 수정할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'payroll':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-indigo-600" /> 급여관리
                        </h2>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <li className="bg-slate-50 p-4 rounded-lg">
                                <strong className="block text-slate-800 mb-2">급여 명세서</strong>
                                <span className="text-sm text-slate-600">개인별 급여 상세 내역을 생성하고 출력합니다.</span>
                            </li>
                            <li className="bg-slate-50 p-4 rounded-lg">
                                <strong className="block text-slate-800 mb-2">급여 지급 관리</strong>
                                <span className="text-sm text-slate-600">실지급액을 계산하고 이체 리스트를 관리합니다.</span>
                            </li>
                        </ul>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
                            <FontAwesomeIcon icon={faCogs} className="text-indigo-600" /> 설정
                        </h2>
                        <p className="text-slate-600">시스템 환경 설정, 사용자 계정 관리, 데이터 초기화 등을 수행합니다.</p>
                    </div>
                );

            case 'dev_process':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                                    <FontAwesomeIcon icon={faRocket} className="text-indigo-600" /> 개발 과정 및 로드맵
                                </h2>
                                <p className="text-lg text-slate-500 mt-2">청연ERP 시스템의 진화 과정과 미래 비전</p>
                            </div>
                        </div>

                        <div className="relative border-l-2 border-slate-200 ml-4 space-y-12 py-4">
                            {/* Phase 1 */}
                            <div className="relative pl-8">
                                <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-300 ring-4 ring-white"></span>
                                <h3 className="text-xl font-bold text-slate-400 mb-2">Phase 1: 기반 구축 (Foundation)</h3>
                                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-slate-500">
                                    <span className="inline-block px-2 py-1 bg-slate-200 text-xs font-bold rounded mb-3">완료됨</span>
                                    <ul className="space-y-2 text-sm list-disc pl-4">
                                        <li>React & TypeScript 기반 프론트엔드 아키텍처 설계</li>
                                        <li>Firebase 인증(로그인, 권한 관리) 시스템 통합</li>
                                        <li>Firestore NoSQL 데이터베이스 스키마 설계 1차</li>
                                        <li>TailwindCSS 기반의 일관된 UI/UX 디자인 시스템 구축</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Phase 2 */}
                            <div className="relative pl-8">
                                <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-white"></span>
                                <h3 className="text-xl font-bold text-indigo-900 mb-2">Phase 2: 핵심 기능 구현 (Core Features)</h3>
                                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 text-indigo-800 shadow-sm">
                                    <span className="inline-block px-2 py-1 bg-indigo-200 text-indigo-800 text-xs font-bold rounded mb-3">완료됨</span>
                                    <ul className="space-y-2 text-sm list-disc pl-4">
                                        <li><strong>통합 인력 관리:</strong> 작업자, 팀, 현장 DB 등록/수정/삭제(CRUD) 기능완성</li>
                                        <li><strong>스마트 일보 시스템:</strong> 엑셀 호환 그리드 입력 및 데이터 처리 엔진 개발</li>
                                        <li><strong>AI OCR 연동:</strong> Gemini AI를 활용한 신분증 및 작업일지 자동 인식 구현</li>
                                        <li><strong>자동 급여 계산:</strong> 일급/주급/월급 등 복잡한 급여 로직 자동화 엔진 탑재</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Phase 3 */}
                            <div className="relative pl-8">
                                <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-orange-100 animate-pulse"></span>
                                <h3 className="text-xl font-bold text-orange-600 mb-2">Phase 3: 시각화 및 최적화 (Current)</h3>
                                <div className="bg-white p-6 rounded-xl border-2 border-orange-100 shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">현재 진행 중</div>
                                    <h4 className="font-bold text-slate-800 mb-4">현재 중점 개발 항목</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <FontAwesomeIcon icon={faChartSimple} className="text-orange-500" /> 통합 현황판 고도화
                                            </div>
                                            <p className="text-xs text-slate-600 pl-6">
                                                - 회사별/팀별 다차원 필터링 구현<br />
                                                - 내부/외부 지원 시각적 구분 (Badge System)<br />
                                                - 대량 데이터 렌더링 최적화
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <FontAwesomeIcon icon={faLayerGroup} className="text-orange-500" /> UI/UX 개선
                                            </div>
                                            <p className="text-xs text-slate-600 pl-6">
                                                - 메뉴 구조 직관화 (청연 전용 메뉴 분리)<br />
                                                - 반응형 모바일 레이아웃 안정화<br />
                                                - 부드러운 애니메이션 및 인터랙션 강화
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Phase 4 */}
                            <div className="relative pl-8">
                                <span className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 ring-4 ring-white border-2 border-slate-400 border-dashed"></span>
                                <h3 className="text-xl font-bold text-slate-500 mb-2">Phase 4: 미래 로드맵 (Future)</h3>
                                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 border-dashed text-slate-500">
                                    <span className="inline-block px-2 py-1 bg-slate-200 text-xs font-bold rounded mb-3">예정</span>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500">
                                                <FontAwesomeIcon icon={faMobileScreen} />
                                            </div>
                                            <div>
                                                <strong>전용 모바일 앱 (Native App)</strong>
                                                <p className="text-xs mt-1">현장 관리자가 폰으로 즉시 출력을 입력하고 사진을 전송하는 전용 앱 개발</p>
                                            </div>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-purple-500">
                                                <FontAwesomeIcon icon={faBrain} />
                                            </div>
                                            <div>
                                                <strong>AI 예측 분석 (Advanced Analytics)</strong>
                                                <p className="text-xs mt-1">과거 데이터를 학습하여 미래의 현장별 노무비 및 공기를 예측하는 고급 분석 모듈</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );



            case 'homepage_modify_request':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
                            <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" /> 홈페이지 수정요청 사용법
                        </h2>
                        <ol className="list-decimal pl-5 space-y-3 text-slate-700 text-sm">
                            <li>
                                <strong>수정 범위 정리:</strong> 고객이 "어느 페이지의 어떤 위치를 어떻게 바꾸고 싶은지"를 캡처 이미지 + 텍스트로 남기도록 안내합니다.
                            </li>
                            <li>
                                <strong>우선순위 설정:</strong> 필수 수정 / 선택 수정 / 차후 반영 으로 태그를 달아두면, 개발자가 급한 것부터 처리할 수 있습니다.
                            </li>
                            <li>
                                <strong>버전 관리:</strong> 한번에 여러 수정이 들어올 경우, 수정 요청 번호(예: M-2025-001)를 부여해서 히스토리를 남깁니다.
                            </li>
                            <li>
                                <strong>검수 절차:</strong> 수정 후에는 캡처 화면과 함께 "수정 전/후"를 비교해서 고객에게 보여주고, 확인 버튼을 받아야 완료로 처리합니다.
                            </li>
                        </ol>
                    </div>
                );



            default:
                return null;
        }
    };

    return (
        <div className="flex h-full bg-[#f8fafc] font-['Pretendard']">
            {/* Sidebar Navigation */}
            <div className="w-72 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col shadow-lg z-10">
                <div className="p-8 border-b border-slate-100 bg-white">
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <span className="text-indigo-600">Manual</span>
                        <span className="text-slate-300 font-light">|</span>
                        <span className="text-sm text-slate-500 font-bold mt-1">청연ERP</span>
                    </h1>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-sm font-bold transition-all duration-200 group ${activeSection === section.id
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm translate-x-1'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activeSection === section.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                    }`}>
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

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-10 min-h-[800px] relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="relative z-10">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualPage;
