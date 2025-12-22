import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faUserGroup, faHelmetSafety, faMapLocationDot, faFileLines, faArrowDown, faArrowRight, faDatabase, faKey, faLink, faSitemap, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const TestStructureViewer: React.FC = () => {
    return (
        <div className="p-8 max-w-[1400px] mx-auto bg-slate-50 min-h-screen">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-3 mb-3">
                    <FontAwesomeIcon icon={faSitemap} className="text-blue-600" />
                    테스트 데이터 관계도 (ERD)
                </h1>
                <p className="text-slate-600 max-w-2xl mx-auto">
                    테스트 데이터 생성기에서 생성되는 엔티티 간의 관계와 데이터 흐름을 시각화한 다이어그램입니다.
                    화살표는 데이터 참조(Foreign Key) 방향을 나타냅니다.
                </p>
            </div>

            <div className="relative">
                {/* Level 1: Company */}
                <div className="flex justify-center mb-16 relative z-10">
                    <div className="bg-white p-6 rounded-2xl border-2 border-blue-200 shadow-lg w-80 relative group hover:border-blue-400 transition-colors">
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                            Level 1
                        </div>
                        <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xl">
                                <FontAwesomeIcon icon={faBuilding} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Company (회사)</h3>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">3 records</span>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 font-mono">
                            <div className="flex items-center gap-2"><FontAwesomeIcon icon={faKey} className="text-yellow-500 text-xs" /> id (PK)</div>
                            <div>name: "전국건설"</div>
                            <div>type: "건설사" | "미지정"</div>
                        </div>

                        {/* Connectors */}
                        <div className="absolute -bottom-16 left-1/4 w-0.5 h-16 bg-slate-300"></div>
                        <div className="absolute -bottom-16 right-1/4 w-0.5 h-16 bg-slate-300"></div>
                    </div>
                </div>

                {/* Level 2: Team & Site */}
                <div className="flex justify-center gap-20 mb-16 relative z-10">
                    {/* Team Node */}
                    <div className="bg-white p-6 rounded-2xl border-2 border-indigo-200 shadow-lg w-80 relative group hover:border-indigo-400 transition-colors">
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                            Level 2
                        </div>
                        <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl">
                                <FontAwesomeIcon icon={faUserGroup} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Team (팀)</h3>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">10 records</span>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 font-mono">
                            <div className="flex items-center gap-2"><FontAwesomeIcon icon={faKey} className="text-yellow-500 text-xs" /> id (PK)</div>
                            <div className="flex items-center gap-2 text-blue-600 font-bold"><FontAwesomeIcon icon={faLink} className="text-xs" /> companyId (FK)</div>
                            <div className="text-xs text-red-500 flex items-center gap-1 mt-1 bg-red-50 p-1 rounded">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                Only '건설사' type allowed
                            </div>
                        </div>

                        {/* Connector down to Worker */}
                        <div className="absolute -bottom-16 left-1/2 w-0.5 h-16 bg-slate-300"></div>
                    </div>

                    {/* Site Node */}
                    <div className="bg-white p-6 rounded-2xl border-2 border-green-200 shadow-lg w-80 relative group hover:border-green-400 transition-colors">
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                            Level 2
                        </div>
                        <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 text-xl">
                                <FontAwesomeIcon icon={faMapLocationDot} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Site (현장)</h3>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">6 records</span>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 font-mono">
                            <div className="flex items-center gap-2"><FontAwesomeIcon icon={faKey} className="text-yellow-500 text-xs" /> id (PK)</div>
                            <div className="flex items-center gap-2 text-blue-600 font-bold"><FontAwesomeIcon icon={faLink} className="text-xs" /> companyId (FK)</div>
                            <div>name: "서울 현장"</div>
                        </div>
                    </div>
                </div>

                {/* Level 3: Worker */}
                <div className="flex justify-center mb-16 relative z-10">
                    <div className="bg-white p-6 rounded-2xl border-2 border-orange-200 shadow-lg w-80 relative group hover:border-orange-400 transition-colors mr-96">
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                            Level 3
                        </div>
                        <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 text-xl">
                                <FontAwesomeIcon icon={faHelmetSafety} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Worker (작업자)</h3>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">200 records</span>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 font-mono">
                            <div className="flex items-center gap-2"><FontAwesomeIcon icon={faKey} className="text-yellow-500 text-xs" /> id (PK)</div>
                            <div className="flex items-center gap-2 text-indigo-600 font-bold"><FontAwesomeIcon icon={faLink} className="text-xs" /> teamId (FK)</div>
                            <div className="text-xs text-green-600 flex items-center gap-1 mt-1 bg-green-50 p-1 rounded font-bold">
                                <FontAwesomeIcon icon={faCheckCircle} />
                                Status: "재직" (Active)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Level 4: Daily Report */}
                <div className="flex justify-center relative z-10">
                    <div className="bg-white p-6 rounded-2xl border-2 border-purple-200 shadow-lg w-[600px] relative group hover:border-purple-400 transition-colors">
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                            Level 4 (Integration)
                        </div>
                        <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 text-xl">
                                <FontAwesomeIcon icon={faFileLines} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Daily Report (일보)</h3>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">1000 records</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2 text-sm text-slate-600 font-mono">
                                <div className="flex items-center gap-2"><FontAwesomeIcon icon={faKey} className="text-yellow-500 text-xs" /> id (PK)</div>
                                <div className="flex items-center gap-2 text-green-600 font-bold"><FontAwesomeIcon icon={faLink} className="text-xs" /> siteId (FK)</div>
                                <div className="flex items-center gap-2 text-indigo-600 font-bold"><FontAwesomeIcon icon={faLink} className="text-xs" /> teamId (FK)</div>
                            </div>
                            <div className="space-y-2 text-sm text-slate-600 font-mono">
                                <div className="font-bold text-slate-800 border-b pb-1 mb-1">Workers Array []</div>
                                <div className="flex items-center gap-2 text-orange-600 font-bold"><FontAwesomeIcon icon={faLink} className="text-xs" /> workerId (FK)</div>
                                <div>manDay: 1.0</div>
                                <div>amount: 150000</div>
                            </div>
                        </div>

                        {/* Incoming Connections Visuals (Abstract) */}
                        <div className="absolute -top-10 left-1/4 flex flex-col items-center">
                            <div className="h-10 w-0.5 bg-slate-300 border-l border-dashed border-slate-400"></div>
                            <FontAwesomeIcon icon={faArrowDown} className="text-slate-400 text-xs mt-1" />
                        </div>
                        <div className="absolute -top-10 right-1/4 flex flex-col items-center">
                            <div className="h-10 w-0.5 bg-slate-300 border-l border-dashed border-slate-400"></div>
                            <FontAwesomeIcon icon={faArrowDown} className="text-slate-400 text-xs mt-1" />
                        </div>
                    </div>
                </div>

                {/* Background Connecting Lines (SVG Overlay) */}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-30">
                    {/* Company to Team */}
                    <path d="M700 180 C 700 250, 500 250, 500 320" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5" />
                    {/* Company to Site */}
                    <path d="M700 180 C 700 250, 900 250, 900 320" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5" />

                    {/* Team to Worker */}
                    <path d="M500 480 L 500 560" fill="none" stroke="#94a3b8" strokeWidth="2" />

                    {/* Site to Report */}
                    <path d="M900 480 C 900 600, 800 600, 800 750" fill="none" stroke="#94a3b8" strokeWidth="2" />

                    {/* Worker to Report */}
                    <path d="M500 720 C 500 750, 600 750, 600 750" fill="none" stroke="#94a3b8" strokeWidth="2" />
                </svg>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        데이터 생성 순서
                    </h4>
                    <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                        <li>회사 데이터 생성 (3개 + 테스트용 1개)</li>
                        <li>팀 데이터 생성 (10개, '건설사'만 배정)</li>
                        <li>현장 데이터 생성 (6개, 회사 배정)</li>
                        <li>작업자 데이터 생성 (200명, '재직' 상태)</li>
                        <li>일보 데이터 생성 (1000개, 관계 조합)</li>
                    </ol>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        관계 규칙 (Rules)
                    </h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                        <li className="text-red-600 font-bold">팀은 반드시 '건설사' 타입 회사에만 소속</li>
                        <li className="text-green-600 font-bold">팀에 소속된 작업자는 '재직' 상태 부여</li>
                        <li>일보는 현장-팀-작업자 관계 무결성 보장</li>
                    </ul>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        활용 가이드
                    </h4>
                    <p className="text-sm text-slate-600">
                        이 구조도는 테스트 데이터 생성기 페이지에서 생성되는 데이터들의 논리적 구조를 보여줍니다.
                        DB 구조도 메뉴에서 실제 Firestore 컬렉션 구조를 확인할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TestStructureViewer;
