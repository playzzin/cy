import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faNetworkWired, faLayerGroup, faLightbulb, faCheckCircle,
    faUsers, faClipboardList, faMoneyBillWave, faMapLocationDot, faSitemap,
    faArrowRight, faDatabase, faLaptopCode
} from '@fortawesome/free-solid-svg-icons';

const SystemArchitectureViewer: React.FC = () => {
    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-slate-800 mb-3 flex items-center justify-center gap-3">
                    <FontAwesomeIcon icon={faSitemap} className="text-brand-600" />
                    전국JS ERP 시스템 설계도
                </h1>
                <p className="text-slate-600 text-lg">
                    현장의 모든 흐름을 한눈에 보고 제어하는 <strong>통합 관제 센터</strong>의 청사진입니다.
                </p>
            </div>

            {/* 1. 기초 공사 (Core) */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b pb-3 border-slate-200">
                    <FontAwesomeIcon icon={faNetworkWired} className="text-blue-600" />
                    1. 기초 공사 (Core Architecture)
                    <span className="text-sm font-normal text-slate-500 ml-auto">모든 데이터는 하나로 연결됩니다</span>
                </h2>

                <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 relative overflow-hidden">
                    {/* 배경 장식 */}
                    <div className="absolute top-0 right-0 opacity-5 text-blue-900 text-9xl transform translate-x-10 -translate-y-10">
                        <FontAwesomeIcon icon={faDatabase} />
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 relative z-10">
                        {/* 카드 1 */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 w-64 text-center">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                                <FontAwesomeIcon icon={faUsers} />
                            </div>
                            <h3 className="font-bold text-lg mb-2">인력 (Manpower)</h3>
                            <p className="text-sm text-slate-500">작업자 정보 & 신분증</p>
                        </div>

                        <FontAwesomeIcon icon={faArrowRight} className="text-blue-300 text-2xl hidden md:block" />
                        <FontAwesomeIcon icon={faArrowRight} className="text-blue-300 text-2xl md:hidden transform rotate-90" />

                        {/* 카드 2 */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 w-64 text-center">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                                <FontAwesomeIcon icon={faMapLocationDot} />
                            </div>
                            <h3 className="font-bold text-lg mb-2">배정 (Assignment)</h3>
                            <p className="text-sm text-slate-500">팀 & 현장 배치</p>
                        </div>

                        <FontAwesomeIcon icon={faArrowRight} className="text-blue-300 text-2xl hidden md:block" />
                        <FontAwesomeIcon icon={faArrowRight} className="text-blue-300 text-2xl md:hidden transform rotate-90" />

                        {/* 카드 3 */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 w-64 text-center">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                                <FontAwesomeIcon icon={faMoneyBillWave} />
                            </div>
                            <h3 className="font-bold text-lg mb-2">정산 (Payroll)</h3>
                            <p className="text-sm text-slate-500">일보 & 급여 자동화</p>
                        </div>
                    </div>
                    <p className="text-center text-blue-600 mt-8 font-medium">
                        "작업자가 등록되면 → 팀에 배정되고 → 현장에 나가 일하면 → 급여가 자동 계산됩니다."
                    </p>
                </div>
            </div>

            {/* 2. 주요 건물 (Modules) */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b pb-3 border-slate-200">
                    <FontAwesomeIcon icon={faLayerGroup} className="text-purple-600" />
                    2. 주요 건물 (Key Modules)
                    <span className="text-sm font-normal text-slate-500 ml-auto">5가지 핵심 기둥</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 모듈 1 */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                <FontAwesomeIcon icon={faUsers} />
                            </div>
                            <h3 className="font-bold text-lg">인력 관리</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>작업자 등록 및 관리</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>AI 신분증 스캔 (Gemini)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>엑셀 일괄 업로드/다운로드</span>
                            </li>
                        </ul>
                    </div>

                    {/* 모듈 2 */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                <FontAwesomeIcon icon={faMapLocationDot} />
                            </div>
                            <h3 className="font-bold text-lg">배정 시스템</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>드래그 앤 드롭 팀 배치</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>현장별 인원 현황 시각화</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>직관적인 UI/UX</span>
                            </li>
                        </ul>
                    </div>

                    {/* 모듈 3 */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                                <FontAwesomeIcon icon={faClipboardList} />
                            </div>
                            <h3 className="font-bold text-lg">일보 관리</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>현장별 출력 인원 기록</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>작업 내용 및 특이사항 저장</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>일별/월별 통계 차트</span>
                            </li>
                        </ul>
                    </div>

                    {/* 모듈 4 */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                <FontAwesomeIcon icon={faMoneyBillWave} />
                            </div>
                            <h3 className="font-bold text-lg">급여/정산</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>일급/주급/월급 자동 계산</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>청구서 및 명세서 자동 발행</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>계산 실수 방지 로직</span>
                            </li>
                        </ul>
                    </div>

                    {/* 모듈 5 */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                                <FontAwesomeIcon icon={faLaptopCode} />
                            </div>
                            <h3 className="font-bold text-lg">구조 시각화</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>DB 구조도 (데이터 설계도)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>React 구조도 (부품 조립도)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                                <span>파일 구조도 (창고 지도)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* 3. 팀 & 지원 구조 (Team & Support Logic) - NEW */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b pb-3 border-slate-200">
                    <FontAwesomeIcon icon={faSitemap} className="text-indigo-600" />
                    3. 팀 & 지원 구조 (Team & Support Logic)
                    <span className="text-sm font-normal text-slate-500 ml-auto">유연한 조직과 지원 시스템</span>
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 팀 계급 구조 */}
                    <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm">
                        <h3 className="font-bold text-lg text-indigo-800 mb-4 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} />
                            팀 계급 체계 (Hierarchy)
                        </h3>
                        <div className="flex flex-col gap-4 relative">
                            {/* 연결선 */}
                            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-indigo-100"></div>

                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center border-4 border-white shadow-sm text-xl">
                                    👑
                                </div>
                                <div>
                                    <span className="font-bold text-slate-800 block">팀장 (Team Leader)</span>
                                    <span className="text-xs text-slate-500">팀의 대표, 정산의 주체</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center border-4 border-white shadow-sm text-xl">
                                    🧢
                                </div>
                                <div>
                                    <span className="font-bold text-slate-800 block">반장 (Foreman)</span>
                                    <span className="text-xs text-slate-500">현장 지휘, 팀장 보좌</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border-4 border-white shadow-sm text-xl">
                                    👷
                                </div>
                                <div>
                                    <span className="font-bold text-slate-800 block">팀원 (Worker)</span>
                                    <span className="text-xs text-slate-500">실무 담당, 유동적 이동</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 지원(Support) 로직 */}
                    <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 relative overflow-hidden">
                        <h3 className="font-bold text-lg text-indigo-800 mb-4 flex items-center gap-2 relative z-10">
                            <FontAwesomeIcon icon={faNetworkWired} />
                            지원 시스템 (Support Flow)
                        </h3>

                        <div className="flex items-center justify-between relative z-10 mt-8">
                            {/* A팀 */}
                            <div className="text-center">
                                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm mb-2">
                                    <span className="font-bold text-slate-700">A팀 (소속)</span>
                                </div>
                                <div className="text-4xl">👷</div>
                            </div>

                            {/* 화살표 */}
                            <div className="flex-1 px-4 text-center">
                                <div className="text-xs font-bold text-indigo-600 mb-1 animate-pulse">지원 (Support)</div>
                                <div className="h-0.5 bg-indigo-300 w-full relative">
                                    <div className="absolute right-0 -top-1.5 w-3 h-3 border-t-2 border-r-2 border-indigo-300 transform rotate-45"></div>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">"몸은 B현장으로"</div>
                            </div>

                            {/* B현장 */}
                            <div className="text-center">
                                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm mb-2">
                                    <span className="font-bold text-slate-700">B현장 (근무지)</span>
                                </div>
                                <div className="text-4xl">🏗️</div>
                            </div>
                        </div>

                        <div className="mt-8 bg-white/80 p-3 rounded-lg border border-indigo-100 text-sm text-center relative z-10">
                            <span className="font-bold text-red-500">💰 정산 핵심:</span>
                            <span className="text-slate-700 ml-1">
                                "소속은 A팀이지만, <br className="md:hidden" />급여 청구는 <strong>B현장</strong>으로!"
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. 철학 (Philosophy) */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b pb-3 border-slate-200">
                    <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500" />
                    4. 개발 철학 (Philosophy)
                    <span className="text-sm font-normal text-slate-500 ml-auto">우리가 지키는 원칙</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl border border-purple-100">
                        <h3 className="font-bold text-lg text-purple-800 mb-2">🎨 보기 좋은 떡이 먹기도 좋다</h3>
                        <p className="text-slate-600">
                            딱딱하고 지루한 관리자 화면은 가라! <br />
                            <strong>TailwindCSS</strong>와 <strong>FontAwesome</strong>을 사용해
                            현대적이고 세련된 디자인을 추구합니다.
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-xl border border-green-100">
                        <h3 className="font-bold text-lg text-green-800 mb-2">👶 초보자도 쉽게</h3>
                        <p className="text-slate-600">
                            어려운 개발 용어 대신 <strong>쉬운 비유</strong>와 <strong>시각적 지표</strong>(신호등, 뱃지)를 사용해
                            누구나 쉽게 이해하고 사용할 수 있는 시스템을 만듭니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemArchitectureViewer;
