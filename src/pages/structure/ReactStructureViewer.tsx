import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faLayerGroup, faFile, faProjectDiagram, faInfoCircle, faChevronDown, faChevronRight, faCode, faWindowMaximize, faColumns, faCopy, faCheck, faTag } from '@fortawesome/free-solid-svg-icons';

// 1. 컴포넌트 트리 데이터 정의 (전체 구조 반영 + 건강검진 + 동적/정적 여부)
const COMPONENT_TREE = {
    id: 'App',
    name: 'App (앱의 시작)',
    type: 'root',
    complexity: 'low',
    pageType: 'static',
    description: '우리 웹사이트의 가장 바깥쪽 껍데기입니다. 라우터(Router)를 통해 페이지 이동을 관리합니다.',
    children: [
        {
            id: 'AuthProvider',
            name: 'AuthProvider (보안/로그인)',
            type: 'library',
            complexity: 'medium',
            pageType: 'dynamic',
            description: '로그인한 사용자가 누구인지 앱 전체에 알려주는 역할을 합니다.',
            children: [
                {
                    id: 'Login',
                    name: 'Login (로그인 페이지)',
                    type: 'page',
                    complexity: 'low',
                    pageType: 'dynamic',
                    description: '아이디/비밀번호 또는 구글 계정으로 로그인하는 화면입니다.',
                },
                {
                    id: 'DashboardLayout',
                    name: 'DashboardLayout (메인 레이아웃)',
                    type: 'layout',
                    complexity: 'medium',
                    pageType: 'static',
                    description: '화면의 기본 틀입니다. 메뉴바와 상단바가 포함되어 있어 코드가 약간 깁니다.',
                    children: [
                        {
                            id: 'Header',
                            name: 'Header (상단 바)',
                            type: 'component',
                            complexity: 'low',
                            pageType: 'dynamic',
                            description: '내 정보, 로그아웃, 다크모드 설정 등이 있는 상단 영역입니다.',
                        },
                        {
                            id: 'Sidebar',
                            name: 'Sidebar (왼쪽 메뉴)',
                            type: 'component',
                            complexity: 'medium',
                            pageType: 'static',
                            description: '메뉴가 많아질수록 코드가 길어질 수 있는 부분입니다.',
                        },
                        {
                            id: 'SubmenuPanel',
                            name: 'SubmenuPanel (서브 메뉴)',
                            type: 'component',
                            complexity: 'low',
                            pageType: 'static',
                            description: '메뉴 클릭 시 나오는 하위 메뉴 패널입니다.',
                        },
                        {
                            id: 'RightPanel',
                            name: 'RightPanel (우측 패널)',
                            type: 'component',
                            complexity: 'low',
                            pageType: 'static',
                            description: '우측에서 슬라이드되어 나오는 패널입니다.',
                        },
                        {
                            id: 'ContentArea',
                            name: 'Content (페이지 영역)',
                            type: 'layout',
                            complexity: 'low',
                            pageType: 'static',
                            description: '메뉴 선택에 따라 바뀌는 실제 화면 영역입니다.',
                            children: [
                                // 1. 대시보드
                                {
                                    id: 'DashboardPage',
                                    name: 'DashboardPage (대시보드)',
                                    type: 'page',
                                    complexity: 'low',
                                    pageType: 'dynamic',
                                    description: '현장 현황, 출역 인원 등을 한눈에 보는 메인 화면입니다.',
                                    children: [
                                        { id: 'WeatherWidget', name: 'WeatherWidget (날씨 위젯)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '현재 날씨 정보를 보여줍니다.' },
                                        { id: 'ProfileSetup', name: 'ProfileSetup (프로필 설정)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '초기 사용자 프로필을 설정합니다.' },
                                        { id: 'manpowerService', name: 'manpowerService (인력 서비스)', type: 'library', complexity: 'medium', pageType: 'dynamic', description: '작업자 데이터를 가져옵니다.' },
                                        { id: 'siteService', name: 'siteService (현장 서비스)', type: 'library', complexity: 'medium', pageType: 'dynamic', description: '현장 데이터를 가져옵니다.' }
                                    ]
                                },
                                // 2. 일보 관리
                                {
                                    id: 'DailyReportPage',
                                    name: 'DailyReportPage (일보 관리)',
                                    type: 'page',
                                    complexity: 'medium',
                                    pageType: 'dynamic',
                                    description: '일보 작성과 목록 조회가 합쳐져 있어 관리가 필요합니다.',
                                    children: [
                                        {
                                            id: 'DailyReportInput',
                                            name: 'DailyReportInput (일보 작성 컨테이너)',
                                            type: 'component',
                                            complexity: 'medium',
                                            pageType: 'dynamic',
                                            description: '일보 작성 화면을 감싸는 컨테이너입니다.',
                                            children: [
                                                { id: 'DailyReportGridInput', name: 'DailyReportGridInput (그리드 입력)', type: 'component', complexity: 'high', pageType: 'dynamic', description: '엑셀처럼 일보를 입력하는 핵심 컴포넌트입니다.' }
                                            ]
                                        },
                                        { id: 'DailyReportList', name: 'DailyReportList (일보 목록)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '작성된 일보들을 날짜별로 보여줍니다.' }
                                    ]
                                },
                                // 3. 인력 관리
                                {
                                    id: 'ManpowerInputPage',
                                    name: 'ManpowerInputPage (인력 관리)',
                                    type: 'page',
                                    complexity: 'high',
                                    pageType: 'dynamic',
                                    healthDescription: '기능이 많아 복잡도가 높습니다.',
                                    description: '작업자 명단을 관리하고 엑셀로 올리거나 내릴 수 있습니다.',
                                    children: [
                                        {
                                            id: 'WorkerManagement',
                                            name: 'WorkerManagement (작업자 관리)',
                                            type: 'component',
                                            complexity: 'medium',
                                            pageType: 'dynamic',
                                            description: '작업자 CRUD 기능을 담당합니다.',
                                            children: [
                                                { id: 'WorkerTable', name: 'WorkerTable (작업자 목록)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '작업자 데이터를 테이블로 보여줍니다.' },
                                                { id: 'WorkerModal', name: 'WorkerModal (작업자 팝업)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '작업자 추가/수정 팝업입니다.' }
                                            ]
                                        }
                                    ]
                                },
                                // 4. 배정 관리
                                {
                                    id: 'AssignmentPages',
                                    name: 'Assignment (배정 관리)',
                                    type: 'page',
                                    complexity: 'low',
                                    pageType: 'static',
                                    description: '팀과 현장에 인원을 배치하는 페이지들입니다.',
                                    children: [
                                        {
                                            id: 'TeamAssignmentPage',
                                            name: 'TeamAssignmentPage (팀 배정)',
                                            type: 'page',
                                            complexity: 'high',
                                            pageType: 'dynamic',
                                            description: '드래그 앤 드롭으로 팀원을 배정합니다.',
                                            children: [
                                                { id: 'TeamForm', name: 'TeamForm (팀 등록)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '새로운 팀을 등록합니다.' },
                                                { id: 'DraggableWorker', name: 'DraggableWorker (드래그 작업자)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '드래그 가능한 작업자 카드입니다.' },
                                                { id: 'DroppableTeam', name: 'DroppableTeam (팀 드롭존)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '작업자를 놓을 수 있는 팀 영역입니다.' },
                                                { id: 'dnd-kit', name: '@dnd-kit (드래그 라이브러리)', type: 'library', complexity: 'high', pageType: 'static', description: '드래그 앤 드롭 기능을 제공하는 외부 라이브러리입니다.' }
                                            ]
                                        },
                                        {
                                            id: 'SiteAssignmentPage',
                                            name: 'SiteAssignmentPage (현장 배정)',
                                            type: 'page',
                                            complexity: 'medium',
                                            pageType: 'dynamic',
                                            description: '칸반 보드 형태로 현장 상태를 관리합니다.',
                                            children: [
                                                { id: 'Column', name: 'Column (상태 컬럼)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '예정/진행중/완료 상태를 나타내는 기둥입니다.' },
                                                { id: 'SortableItem', name: 'SortableItem (현장 카드)', type: 'component', complexity: 'low', pageType: 'dynamic', description: '드래그 가능한 현장 카드입니다.' }
                                            ]
                                        }
                                    ]
                                },
                                // 5. 급여/청구서
                                {
                                    id: 'WagePaymentPage',
                                    name: 'WagePaymentPage (급여 지급 관리)',
                                    type: 'page',
                                    complexity: 'high',
                                    pageType: 'dynamic',
                                    healthDescription: '다양한 탭과 복잡한 계산 로직이 포함되어 있습니다.',
                                    description: '급여 지급 및 청구서 발행을 관리합니다.',
                                    children: [
                                        { id: 'DailyWagePaymentPage', name: 'DailyWagePaymentPage (일급제)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '일급제 근로자 급여 관리' },
                                        { id: 'WeeklyWagePaymentPage', name: 'WeeklyWagePaymentPage (주급제)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '주급제 근로자 급여 관리' },
                                        { id: 'MonthlyWagePaymentPage', name: 'MonthlyWagePaymentPage (월급제)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '월급제 근로자 급여 관리' },
                                        { id: 'SiteLaborCostInvoice', name: 'SiteLaborCostInvoice (현장 청구서)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '현장별 노무비 청구서' },
                                        { id: 'TeamLaborCostInvoice', name: 'TeamLaborCostInvoice (팀 청구서)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '팀별 노무비 청구서' },
                                        { id: 'WorkerLaborCostInvoice', name: 'WorkerLaborCostInvoice (개인 명세서)', type: 'component', complexity: 'medium', pageType: 'dynamic', description: '개인별 급여 명세서' }
                                    ]
                                },
                                // 6. 시스템/설정
                                {
                                    id: 'SystemPages',
                                    name: 'System (시스템/설정)',
                                    type: 'page',
                                    complexity: 'low',
                                    pageType: 'static',
                                    description: '앱의 설정을 바꾸거나 사용자 권한을 관리합니다.',
                                    children: [
                                        {
                                            id: 'UserManagement',
                                            name: 'UserManagement (사용자 권한 관리)',
                                            type: 'page',
                                            complexity: 'medium',
                                            pageType: 'dynamic',
                                            description: '관리자가 직원의 권한(팀장, 반장 등)을 설정합니다.',
                                            children: [
                                                { id: 'userService', name: 'userService (사용자 서비스)', type: 'library', complexity: 'low', pageType: 'dynamic', description: '사용자 정보를 Firebase에서 가져옵니다.' }
                                            ]
                                        },
                                        { id: 'ProfilePage', name: 'ProfilePage (내 정보)', type: 'page', complexity: 'low', pageType: 'dynamic', description: '내 비밀번호나 연락처를 수정합니다.' },
                                        { id: 'ReactStructureViewer', name: 'ReactViewer (React 구조도)', type: 'page', complexity: 'low', pageType: 'static', description: '현재 보고 계신 이 화면입니다.' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

const ReactStructureViewer: React.FC = () => {
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
        'App': true,
        'DashboardLayout': true,
        'ContentArea': true,
        'ManpowerInputPage': true
    });
    const [copied, setCopied] = useState(false);

    const toggleNode = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'root': return faCube;
            case 'layout': return faColumns;
            case 'page': return faWindowMaximize;
            case 'component': return faCode;
            case 'library': return faLayerGroup;
            default: return faFile;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'root': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'layout': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'page': return 'text-green-600 bg-green-50 border-green-200';
            case 'component': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'library': return 'text-slate-600 bg-slate-50 border-slate-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'root': return '앱 시작점';
            case 'layout': return '레이아웃 (틀)';
            case 'page': return '페이지 (화면)';
            case 'component': return '컴포넌트 (부품)';
            case 'library': return '라이브러리 (도구)';
            default: return '기타';
        }
    };

    // 건강 상태 색상 반환
    const getHealthColor = (complexity?: string) => {
        switch (complexity) {
            case 'high': return 'bg-red-500';
            case 'medium': return 'bg-yellow-400';
            case 'low': return 'bg-green-500';
            default: return 'bg-slate-300';
        }
    };

    const getHealthLabel = (complexity?: string) => {
        switch (complexity) {
            case 'high': return '복잡함 (관리 필요)';
            case 'medium': return '보통 (주의)';
            case 'low': return '양호 (깔끔)';
            default: return '미측정';
        }
    };

    // 동적/정적 뱃지 렌더링
    const renderPageTypeBadge = (pageType?: string) => {
        if (!pageType) return null;

        if (pageType === 'dynamic') {
            return (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold border border-blue-200 flex items-center gap-1">
                    ⚡ 동적
                </span>
            );
        } else {
            return (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200 flex items-center gap-1">
                    ⚓ 정적
                </span>
            );
        }
    };

    const renderTree = (node: any, level: number = 0) => {
        const isExpanded = expanded[node.id];
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`
                        flex items-center gap-3 p-3 mb-2 rounded-lg border transition-all duration-200
                        ${getTypeColor(node.type)}
                        ${hasChildren ? 'cursor-pointer hover:shadow-md' : ''}
                        ${level > 0 ? 'ml-8' : ''}
                    `}
                    onClick={() => hasChildren && toggleNode(node.id)}
                    style={{ marginLeft: `${level * 24}px` }}
                >
                    <div className="w-6 flex justify-center text-slate-400">
                        {hasChildren && (
                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-xs" />
                        )}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm relative">
                        <FontAwesomeIcon icon={getTypeIcon(node.type)} className="text-sm" />
                        {/* 건강 상태 점 (라이브러리가 아닐 때만) */}
                        {node.type !== 'library' && node.complexity && (
                            <div
                                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getHealthColor(node.complexity)}`}
                                title={`건강 상태: ${getHealthLabel(node.complexity)}`}
                            />
                        )}
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{node.name}</span>

                            {/* 버전 뱃지 */}
                            {node.version && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faTag} className="text-[8px]" />
                                    v{node.version}
                                </span>
                            )}

                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-medium">
                                {getTypeLabel(node.type)}
                            </span>
                            {/* 동적/정적 뱃지 */}
                            {renderPageTypeBadge(node.pageType)}

                            {/* 고위험군 경고 뱃지 */}
                            {node.complexity === 'high' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold animate-pulse">
                                    관리 필요!
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                            {node.description}
                            {node.healthDescription && (
                                <span className="block mt-1 text-red-500 text-xs font-bold">
                                    ⚠️ {node.healthDescription}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="relative">
                        {/* 연결선 (옵션) */}
                        <div
                            className="absolute left-0 top-0 bottom-4 border-l-2 border-slate-200 border-dashed"
                            style={{ left: `${(level * 24) + 27}px` }}
                        />
                        {node.children.map((child: any) => renderTree(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    // 프롬프트 생성 함수
    const generatePromptText = () => {
        const generateNodeText = (node: any, level: number = 0): string => {
            const indent = '  '.repeat(level);
            let text = `${indent}- ${node.name} (${node.type || 'item'})`;
            if (node.version) text += ` [v${node.version}]`;
            if (node.description) text += `: ${node.description}`;
            if (node.complexity) text += ` [Complexity: ${node.complexity}]`;
            text += '\n';

            if (node.children && node.children.length > 0) {
                node.children.forEach((child: any) => {
                    text += generateNodeText(child, level + 1);
                });
            }
            return text;
        };

        let prompt = "## Project Component Structure\n\n";
        prompt += generateNodeText(COMPONENT_TREE);

        return prompt;
    };

    const handleCopyPrompt = () => {
        const text = generatePromptText();
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faProjectDiagram} className="text-brand-600" />
                        React 구조도 (레고 조립 설명서)
                    </h1>
                    <p className="text-slate-600 flex items-center gap-2">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        우리 웹사이트가 어떤 <strong>부품(Component)</strong>들로 조립되어 있는지 보여주는 지도입니다.
                    </p>
                </div>
                <button
                    onClick={handleCopyPrompt}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm
                        ${copied
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-slate-800 text-white hover:bg-slate-900'}
                    `}
                >
                    <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                    {copied ? '복사 완료!' : 'AI 프롬프트 복사'}
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCube} className="text-purple-600" />
                        1. 컴포넌트 구조 (건강검진 결과 포함 🩺)
                    </h2>
                </div>

                {/* 범례 */}
                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="w-full flex flex-wrap gap-6 mb-4 pb-4 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-500 w-full mb-1">건강 상태 (복잡도)</div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm text-slate-600">양호 (깔끔함)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <span className="text-sm text-slate-600">보통 (주의)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                            <span className="text-sm text-slate-600 font-bold text-red-500">비만 (관리 필요)</span>
                        </div>
                    </div>

                    <div className="w-full flex flex-wrap gap-6 mb-4 pb-4 border-b border-slate-200">
                        <div className="text-xs font-bold text-slate-500 w-full mb-1">페이지 성격</div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold border border-blue-200">⚡ 동적</span>
                            <span className="text-sm text-slate-600">데이터가 계속 변함 (DB 연동)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200">⚓ 정적</span>
                            <span className="text-sm text-slate-600">내용이 고정됨 (설명서 등)</span>
                        </div>
                    </div>

                    <div className="text-xs font-bold text-slate-500 w-full mb-1">부품 종류</div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center border border-purple-200">
                            <FontAwesomeIcon icon={faCube} className="text-xs" />
                        </div>
                        <span className="text-sm text-slate-600">앱 시작점</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200">
                            <FontAwesomeIcon icon={faColumns} className="text-xs" />
                        </div>
                        <span className="text-sm text-slate-600">레이아웃</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-green-100 text-green-600 flex items-center justify-center border border-green-200">
                            <FontAwesomeIcon icon={faWindowMaximize} className="text-xs" />
                        </div>
                        <span className="text-sm text-slate-600">페이지</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200">
                            <FontAwesomeIcon icon={faCode} className="text-xs" />
                        </div>
                        <span className="text-sm text-slate-600">컴포넌트</span>
                    </div>
                </div>

                {/* 트리 뷰 */}
                <div className="space-y-1">
                    {renderTree(COMPONENT_TREE)}
                </div>
            </div>
        </div>
    );
};

export default ReactStructureViewer;
