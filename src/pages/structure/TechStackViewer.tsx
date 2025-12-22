import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faLayerGroup, faCode, faDatabase, faRobot, faWind, faCheckCircle, faBolt, faRocket
} from '@fortawesome/free-solid-svg-icons';
import { faReact, faGoogle } from '@fortawesome/free-brands-svg-icons';

const TechStackViewer: React.FC = () => {
    return (
        <div className="p-8 max-w-6xl mx-auto font-['Pretendard']">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-slate-800 mb-4 flex items-center justify-center gap-3">
                    <FontAwesomeIcon icon={faRocket} className="text-brand-600" />
                    <span>My Tech Stack</span>
                </h1>
                <p className="text-xl text-slate-600">
                    사장님의 프로젝트는 <span className="font-bold text-brand-600">"AI 코딩(Vibe Coding)"</span>에 최적화된<br />
                    <span className="font-bold text-slate-800">우주 최강 조합</span>으로 구성되어 있습니다.
                </p>
            </div>

            {/* Vibe Coding Section */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-lg mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                    <FontAwesomeIcon icon={faRobot} size="10x" />
                </div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBolt} className="text-yellow-300" />
                    왜 이 조합이 "바이브 코딩"에 최적화인가요?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                        <h3 className="font-bold text-lg mb-2 text-yellow-300">1. AI 학습 데이터 깡패</h3>
                        <p className="leading-relaxed opacity-90">
                            React와 Tailwind는 전 세계에서 가장 많이 쓰이는 기술입니다.<br />
                            AI(ChatGPT, Gemini 등)가 학습한 데이터 양이 압도적이라서,<br />
                            "대충 말해도 찰떡같이" 코드를 짜줍니다.
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                        <h3 className="font-bold text-lg mb-2 text-yellow-300">2. 속도전의 제왕</h3>
                        <p className="leading-relaxed opacity-90">
                            Tailwind CSS는 별도의 CSS 파일을 왔다 갔다 할 필요 없이,<br />
                            AI가 코드 한 줄에 스타일까지 한 번에 작성할 수 있어<br />
                            개발 속도가 2배 이상 빠릅니다.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tech Stack Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Frontend */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 text-2xl mb-4 group-hover:scale-110 transition-transform">
                        <FontAwesomeIcon icon={faReact as any} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">React + TypeScript</h3>
                    <p className="text-sm text-slate-500 mb-4">프론트엔드 (화면)</p>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>전 세계 1위 프레임워크</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>TypeScript로 오류 사전 방지</span>
                        </li>
                    </ul>
                </div>

                {/* Styling */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-500 text-2xl mb-4 group-hover:scale-110 transition-transform">
                        <FontAwesomeIcon icon={faWind} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Tailwind CSS</h3>
                    <p className="text-sm text-slate-500 mb-4">스타일링 (디자인)</p>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>클래스 이름 고민 끝 (빠른 개발)</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>모던하고 깔끔한 디자인</span>
                        </li>
                    </ul>
                </div>

                {/* Backend */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-500 text-2xl mb-4 group-hover:scale-110 transition-transform">
                        <FontAwesomeIcon icon={faDatabase} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Firebase</h3>
                    <p className="text-sm text-slate-500 mb-4">백엔드 (서버/DB)</p>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>서버 구축 없이 바로 사용 (Serverless)</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>실시간 데이터 동기화</span>
                        </li>
                    </ul>
                </div>

                {/* AI */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 text-2xl mb-4 group-hover:scale-110 transition-transform">
                        <FontAwesomeIcon icon={faGoogle as any} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Gemini API</h3>
                    <p className="text-sm text-slate-500 mb-4">인공지능 (AI)</p>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>강력한 이미지 인식 (OCR)</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 mt-1" />
                            <span>똑똑한 자연어 처리</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Additional Tools */}
            <div className="mt-12">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLayerGroup} className="text-slate-400" />
                    함께 사용하는 강력한 도구들
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { name: 'SweetAlert2', desc: '예쁜 알림창', icon: '🎨' },
                        { name: 'XLSX (SheetJS)', desc: '엑셀 처리', icon: '📊' },
                        { name: 'React Router', desc: '페이지 이동', icon: '🔗' },
                        { name: 'FontAwesome', desc: '아이콘', icon: '✨' },
                    ].map((tool, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex items-center gap-3">
                            <span className="text-2xl">{tool.icon}</span>
                            <div>
                                <div className="font-bold text-slate-700">{tool.name}</div>
                                <div className="text-xs text-slate-500">{tool.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TechStackViewer;
