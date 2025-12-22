import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap, faDatabase, faTable, faProjectDiagram, faFileInvoiceDollar, faHouse, faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';

const AccommodationDesignViewer: React.FC = () => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopyMarkdown = async () => {
        // Simple copy logic or placeholder
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faProjectDiagram} className="text-blue-600" />
                        숙소 관리 시스템 설계도 (Design Document)
                    </h1>
                    <p className="text-slate-600">
                        숙소 계약 정보와 월별 공과금 내역을 관리하기 위한 시스템 구조 및 데이터 설계입니다.
                    </p>
                </div>
                <button
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
                >
                    <FontAwesomeIcon icon={copySuccess ? faCheck : faCopy} className={copySuccess ? "text-green-500" : ""} />
                    {copySuccess ? "복사 완료" : "설계 복사"}
                </button>
            </div>

            {/* 1. System Architecture */}
            <div className="mb-12">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faSitemap} className="text-indigo-500" />
                    1. 시스템 구조 (Architecture)
                </h2>
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center gap-8">
                    <div className="flex gap-12 items-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-3xl text-slate-500">
                                👤
                            </div>
                            <span className="font-bold text-slate-700">관리자 (User)</span>
                        </div>
                        <div className="h-0.5 w-16 bg-slate-300"></div>
                        <div className="flex flex-col gap-4">
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg w-64 text-center">
                                <div className="font-bold text-blue-800 mb-1">숙소 현황판 (Dashboard)</div>
                                <div className="text-xs text-blue-600">계약 만료 알림, 총 지출 요약</div>
                            </div>
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg w-64 text-center">
                                <div className="font-bold text-green-800 mb-1">월별 공과금 대장 (Ledger)</div>
                                <div className="text-xs text-green-600">엑셀형 그리드 입력, 자동 정산</div>
                            </div>
                        </div>
                        <div className="h-0.5 w-16 bg-slate-300"></div>
                        <div className="flex flex-col gap-4">
                            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg w-48 text-center flex items-center gap-3 justify-center">
                                <FontAwesomeIcon icon={faHouse} className="text-purple-400" />
                                <div className="text-left">
                                    <div className="font-bold text-purple-800">Accommodation</div>
                                    <div className="text-xs text-purple-600">계약/입주자 정보</div>
                                </div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg w-48 text-center flex items-center gap-3 justify-center">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-orange-400" />
                                <div className="text-left">
                                    <div className="font-bold text-orange-800">UtilityRecord</div>
                                    <div className="text-xs text-orange-600">월별 지출 내역</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. ERD */}
            <div className="mb-12">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faDatabase} className="text-pink-500" />
                    2. 데이터베이스 설계 (ERD)
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Accommodation Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900">Accommodation (숙소)</h3>
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Collection</span>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                                    <tr>
                                        <th className="px-2 py-2">Field</th>
                                        <th className="px-2 py-2">Type</th>
                                        <th className="px-2 py-2">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr><td className="px-2 py-2 font-mono">id</td><td className="px-2 py-2 text-blue-600">string</td><td className="px-2 py-2">PK</td></tr>
                                    <tr><td className="px-2 py-2 font-mono">name</td><td className="px-2 py-2 text-blue-600">string</td><td className="px-2 py-2">숙소명 (예: 501호)</td></tr>
                                    <tr><td className="px-2 py-2 font-mono">address</td><td className="px-2 py-2 text-blue-600">string</td><td className="px-2 py-2">주소</td></tr>
                                    <tr className="bg-indigo-50/30"><td className="px-2 py-2 font-mono font-bold">contract</td><td className="px-2 py-2 text-purple-600">Map</td><td className="px-2 py-2">계약 정보 (보증금, 월세 등)</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- deposit</td><td className="px-2 py-2 text-green-600">number</td><td className="px-2 py-2">보증금</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- monthlyRent</td><td className="px-2 py-2 text-green-600">number</td><td className="px-2 py-2">기본 월세</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- endDate</td><td className="px-2 py-2 text-orange-600">string</td><td className="px-2 py-2">계약 만료일</td></tr>
                                    <tr className="bg-indigo-50/30"><td className="px-2 py-2 font-mono font-bold">occupants</td><td className="px-2 py-2 text-purple-600">Array</td><td className="px-2 py-2">입주자 목록</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* UtilityRecord Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
                            <h3 className="font-bold text-orange-900">UtilityRecord (공과금)</h3>
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Collection</span>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                                    <tr>
                                        <th className="px-2 py-2">Field</th>
                                        <th className="px-2 py-2">Type</th>
                                        <th className="px-2 py-2">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr><td className="px-2 py-2 font-mono">id</td><td className="px-2 py-2 text-blue-600">string</td><td className="px-2 py-2">PK</td></tr>
                                    <tr><td className="px-2 py-2 font-mono">accommodationId</td><td className="px-2 py-2 text-blue-600">string</td><td className="px-2 py-2">FK (Accommodation)</td></tr>
                                    <tr><td className="px-2 py-2 font-mono">yearMonth</td><td className="px-2 py-2 text-blue-600">string</td><td className="px-2 py-2">귀속년월 (2025-01)</td></tr>
                                    <tr className="bg-orange-50/30"><td className="px-2 py-2 font-mono font-bold">paymentDetails</td><td className="px-2 py-2 text-purple-600">Map</td><td className="px-2 py-2">납부 상세</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- rent</td><td className="px-2 py-2 text-green-600">number</td><td className="px-2 py-2">실제 월세</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- electricity</td><td className="px-2 py-2 text-green-600">number</td><td className="px-2 py-2">전기세</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- gas</td><td className="px-2 py-2 text-green-600">number</td><td className="px-2 py-2">가스비</td></tr>
                                    <tr><td className="px-2 py-2 font-mono pl-6">- total</td><td className="px-2 py-2 text-green-600">number</td><td className="px-2 py-2">합계 (자동계산)</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. UI Wireframes */}
            <div className="mb-12">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faTable} className="text-emerald-500" />
                    3. UI 설계 (Wireframes)
                </h2>

                {/* Dashboard Wireframe */}
                <div className="mb-6">
                    <h3 className="font-bold text-slate-700 mb-2 pl-2 border-l-4 border-blue-500">A. 숙소 현황판 (Cards)</h3>
                    <div className="bg-slate-100 p-6 rounded-xl border border-dashed border-slate-300">
                        {/* Header Stats */}
                        <div className="flex gap-4 mb-6">
                            <div className="bg-white p-4 rounded shadow-sm w-48">
                                <div className="text-xs text-slate-400">총 숙소</div>
                                <div className="text-2xl font-bold">32개</div>
                            </div>
                            <div className="bg-white p-4 rounded shadow-sm w-48 border-l-4 border-red-500">
                                <div className="text-xs text-slate-400">만료 임박</div>
                                <div className="text-2xl font-bold text-red-500">2건</div>
                            </div>
                        </div>
                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white p-4 rounded shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold">사동 {500 + i}호</div>
                                        <div className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">계약중</div>
                                    </div>
                                    <div className="text-sm text-slate-600 mb-2">👤 김동혁 팀</div>
                                    <div className="text-xs text-slate-400">만료: 2026.05.20 (D-150)</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ledger Wireframe */}
                <div>
                    <h3 className="font-bold text-slate-700 mb-2 pl-2 border-l-4 border-green-500">B. 월별 공과금 대장 (Excel Grid)</h3>
                    <div className="bg-slate-100 p-6 rounded-xl border border-dashed border-slate-300">
                        <div className="bg-white rounded shadow-sm border border-slate-200">
                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <button className="font-bold text-slate-600">◀ 2025년 1월 ▶</button>
                                <button className="bg-green-600 text-white px-3 py-1 rounded text-sm">저장하기</button>
                            </div>
                            <table className="w-full text-sm text-center">
                                <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-2 border-r">숙소명</th>
                                        <th className="p-2 border-r">입주자</th>
                                        <th className="p-2 border-r bg-yellow-50">월세</th>
                                        <th className="p-2 border-r">전기세</th>
                                        <th className="p-2 border-r">가스비</th>
                                        <th className="p-2">합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100">
                                        <td className="p-2 border-r">사동 502호</td>
                                        <td className="p-2 border-r text-slate-600">김동혁</td>
                                        <td className="p-2 border-r bg-yellow-50/30 text-right pr-4 font-mono">650,000</td>
                                        <td className="p-2 border-r text-right pr-4 font-mono">78,200</td>
                                        <td className="p-2 border-r text-right pr-4 font-mono">22,950</td>
                                        <td className="p-2 text-right pr-4 font-bold">751,150</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="p-2 border-r">와동 103호</td>
                                        <td className="p-2 border-r text-slate-600">-</td>
                                        <td className="p-2 border-r bg-yellow-50/30 text-right pr-4 font-mono">420,000</td>
                                        <td className="p-2 border-r text-right pr-4 font-mono">11,940</td>
                                        <td className="p-2 border-r text-right pr-4 font-mono">77,390</td>
                                        <td className="p-2 text-right pr-4 font-bold">509,330</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AccommodationDesignViewer;
