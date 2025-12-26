import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardList, faSearch, faDownload } from '@fortawesome/free-solid-svg-icons';

const MaterialTransactionsPage: React.FC = () => {
    const [startDate, setStartDate] = useState('2025-01-01');
    const [endDate, setEndDate] = useState('2025-12-31');

    return (
        <div className="p-6 max-w-[1800px] mx-auto bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faClipboardList} className="text-indigo-600" />
                        입출고 내역
                    </h1>
                    <p className="text-slate-500 mt-1">자재 입출고 내역을 조회합니다</p>
                </div>
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-sm">
                    <FontAwesomeIcon icon={faDownload} />
                    Excel 다운로드
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="grid grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">시작일</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">종료일</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">현장</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2">
                            <option value="">전체</option>
                            <option value="포천 탑엔지니어링">포천 탑엔지니어링</option>
                            <option value="고양 한경기건">고양 한경기건</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">구분</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2">
                            <option value="">전체</option>
                            <option value="inbound">입고</option>
                            <option value="outbound">출고</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b border-slate-300">
                            <tr>
                                <th className="p-3 text-left font-bold text-slate-700">일자</th>
                                <th className="p-3 text-center font-bold text-slate-700">구분</th>
                                <th className="p-3 text-left font-bold text-slate-700">현장</th>
                                <th className="p-3 text-left font-bold text-slate-700">품명</th>
                                <th className="p-3 text-left font-bold text-slate-700">규격</th>
                                <th className="p-3 text-right font-bold text-slate-700">수량</th>
                                <th className="p-3 text-left font-bold text-slate-700">단위</th>
                                <th className="p-3 text-left font-bold text-slate-700">차량번호</th>
                                <th className="p-3 text-left font-bold text-slate-700">등록자</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={9} className="p-20 text-center text-slate-400">
                                    <FontAwesomeIcon icon={faClipboardList} className="text-6xl mb-4 text-slate-200" />
                                    <p>조회된 내역이 없습니다.</p>
                                    <p className="text-sm mt-2">조회 조건을 설정하고 조회 버튼을 눌러주세요.</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MaterialTransactionsPage;
