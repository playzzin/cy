import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faLink, faInfoCircle, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';

const ExcelDataGuideViewer: React.FC = () => {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'base',
            themeVariables: {
                primaryColor: '#e0e7ff',
                primaryTextColor: '#1e1b4b',
                primaryBorderColor: '#4338ca',
                lineColor: '#6366f1',
                secondaryColor: '#dcfce7',
                tertiaryColor: '#fef9c3'
            },
            flowchart: {
                htmlLabels: true,
                curve: 'basis'
            }
        });
        renderGraph();
    }, []);

    const renderGraph = async () => {
        if (!mermaidRef.current) return;

        const graph = `
            classDiagram
            direction LR
            
            class Company {
                <span class="font-bold">🏢 회사 (Company)</span>
                ---
                <span class="text-blue-600 font-bold">*회사명 (필수, PK)</span>
                사업자번호 (선택)
                대표자명 (선택)
                전화번호 (선택)
            }

            class Team {
                <span class="font-bold">👥 팀 (Team)</span>
                ---
                <span class="text-green-600 font-bold">*팀명 (필수, PK)</span>
                <span class="text-blue-600 font-bold">*소속회사 (선택, FK)</span>
                팀장명 (선택)
                팀구분 (선택)
            }

            class Site {
                <span class="font-bold">🏗️ 현장 (Site)</span>
                ---
                <span class="text-yellow-600 font-bold">*현장명 (필수, PK)</span>
                <span class="text-blue-600 font-bold">*발주처 (선택, FK)</span>
                <span class="text-green-600 font-bold">*담당팀 (선택, FK)</span>
                현장코드 (자동생성)
                공사기간 (선택)
            }

            class Worker {
                <span class="font-bold">👷 작업자 (Worker)</span>
                ---
                <span class="text-slate-700 font-bold">*이름 (필수)</span>
                <span class="text-slate-700 font-bold">*주민번호 (필수)</span>
                <span class="text-green-600 font-bold">*팀명 (선택, FK)</span>
                <span class="text-blue-600 font-bold">*소속회사 (선택, FK)</span>
                직책 (선택)
                단가 (선택)
            }

            %% Relationships
            Company "1" -- "*" Team : 소속회사 = 회사명
            Company "1" -- "*" Site : 발주처 = 회사명
            Company "1" -- "*" Worker : 소속회사 = 회사명
            
            Team "1" -- "*" Worker : 팀명 = 팀명
            Team "1" -- "*" Site : 담당팀 = 팀명

            %% Styling
            style Company fill:#e0e7ff,stroke:#4b5563,stroke-width:2px
            style Team fill:#dcfce7,stroke:#4b5563,stroke-width:2px
            style Site fill:#fef9c3,stroke:#4b5563,stroke-width:2px
            style Worker fill:#f3f4f6,stroke:#4b5563,stroke-width:2px
        `;

        try {
            mermaidRef.current.innerHTML = '';
            const { svg } = await mermaid.render('excel-schema-graph', graph);
            mermaidRef.current.innerHTML = svg;
        } catch (error) {
            console.error("Mermaid render error:", error);
            mermaidRef.current.innerHTML = '<div class="text-red-500">다이어그램 생성 오류</div>';
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(id);
        setTimeout(() => setCopySuccess(null), 2000);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                    <FontAwesomeIcon icon={faFileExcel} className="text-green-600" />
                    엑셀 데이터 연결 구조도 (Data Connection Map)
                </h1>
                <p className="text-slate-600 text-lg">
                    각 엑셀 파일의 <strong>어떤 항목(열)</strong>이 서로 연결되는지 보여주는 가이드입니다.<br />
                    <span className="text-blue-600 font-bold">화살표가 가리키는 곳의 이름</span>과 <span className="text-red-600 font-bold">정확히 일치</span>해야 자동으로 연결됩니다.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Diagram Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} className="text-indigo-600" />
                        연결 구조 시각화
                    </h2>
                    <div className="bg-slate-50 rounded-lg p-4 flex justify-center overflow-auto min-h-[400px]">
                        <div ref={mermaidRef} className="w-full max-w-lg"></div>
                    </div>
                </div>

                {/* Detailed Guide Section */}
                <div className="space-y-6">
                    {/* Worker Guide */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-sm">1</span>
                                작업자 등록 엑셀 (Worker)
                            </h3>
                            <button
                                onClick={() => copyToClipboard("이름\t주민번호\t팀명\t소속회사\t직책\t단가", "worker")}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={copySuccess === "worker" ? faCheck : faCopy} />
                                {copySuccess === "worker" ? "복사됨" : "헤더 복사"}
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-4">작업자를 등록할 때 <strong>팀명</strong>과 <strong>소속회사</strong>를 정확히 입력해야 연결됩니다.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-2 font-semibold text-slate-700">필수 항목</th>
                                            <th className="px-4 py-2 font-semibold text-indigo-600">연결 항목 (중요!)</th>
                                            <th className="px-4 py-2 font-semibold text-slate-500">기타 항목</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-4 py-3 border-b border-slate-100 align-top">
                                                <span className="font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded">이름</span><br />
                                                <span className="font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded mt-1 inline-block">주민번호</span>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 bg-indigo-50/30 align-top">
                                                <div className="mb-2">
                                                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">팀명</span>
                                                    <div className="text-xs text-indigo-600 mt-1">👉 팀 엑셀의 [팀명]과 일치해야 함</div>
                                                </div>
                                                <div>
                                                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">소속회사</span>
                                                    <div className="text-xs text-indigo-600 mt-1">👉 회사 엑셀의 [회사명]과 일치해야 함</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 text-slate-500 align-top">
                                                연락처, 주소, 계좌번호, 직책, 단가 등
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Team Guide */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-green-50 px-6 py-3 border-b border-green-100 flex justify-between items-center">
                            <h3 className="font-bold text-green-900 flex items-center gap-2">
                                <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded text-sm">2</span>
                                팀 등록 엑셀 (Team)
                            </h3>
                            <button
                                onClick={() => copyToClipboard("팀명\t팀구분\t팀장명\t소속회사", "team")}
                                className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={copySuccess === "team" ? faCheck : faCopy} />
                                {copySuccess === "team" ? "복사됨" : "헤더 복사"}
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-2 font-semibold text-slate-700">필수 항목</th>
                                            <th className="px-4 py-2 font-semibold text-indigo-600">연결 항목 (중요!)</th>
                                            <th className="px-4 py-2 font-semibold text-slate-500">기타 항목</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-4 py-3 border-b border-slate-100 align-top">
                                                <span className="font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded">팀명</span>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 bg-indigo-50/30 align-top">
                                                <div className="mb-2">
                                                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">소속회사</span>
                                                    <div className="text-xs text-indigo-600 mt-1">👉 회사 엑셀의 [회사명]과 일치해야 함</div>
                                                </div>
                                                <div>
                                                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">팀장명</span>
                                                    <div className="text-xs text-indigo-600 mt-1">👉 작업자 엑셀의 [이름]과 일치 (선택사항)</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 text-slate-500 align-top">
                                                팀구분 (시공팀/직영팀 등)
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Site Guide */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-yellow-50 px-6 py-3 border-b border-yellow-100 flex justify-between items-center">
                            <h3 className="font-bold text-yellow-900 flex items-center gap-2">
                                <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded text-sm">3</span>
                                현장 등록 엑셀 (Site)
                            </h3>
                            <button
                                onClick={() => copyToClipboard("현장명\t현장코드\t발주처\t담당팀", "site")}
                                className="text-xs text-yellow-700 hover:text-yellow-900 flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={copySuccess === "site" ? faCheck : faCopy} />
                                {copySuccess === "site" ? "복사됨" : "헤더 복사"}
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-2 font-semibold text-slate-700">필수 항목</th>
                                            <th className="px-4 py-2 font-semibold text-indigo-600">연결 항목 (중요!)</th>
                                            <th className="px-4 py-2 font-semibold text-slate-500">기타 항목</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-4 py-3 border-b border-slate-100 align-top">
                                                <span className="font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded">현장명</span>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 bg-indigo-50/30 align-top">
                                                <div className="mb-2">
                                                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">발주처</span>
                                                    <div className="text-xs text-indigo-600 mt-1">👉 회사 엑셀의 [회사명]과 일치해야 함</div>
                                                </div>
                                                <div>
                                                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">담당팀</span>
                                                    <div className="text-xs text-indigo-600 mt-1">👉 팀 엑셀의 [팀명]과 일치해야 함</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 border-b border-slate-100 text-slate-500 align-top">
                                                현장코드, 주소, 공사기간 등
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExcelDataGuideViewer;
