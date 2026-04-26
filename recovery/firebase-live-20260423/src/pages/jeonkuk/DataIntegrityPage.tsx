import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faShieldHalved,
    faUserSlash,
    faCheckCircle,
    faExclamationTriangle,
    faSearch,
    faCircleQuestion
} from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';

const DataIntegrityPage: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDoc, setShowDoc] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await manpowerService.getWorkers();
            setWorkers(data);
        } catch (error) {
            console.error("Error fetching workers:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Resigned Workers
    const resignedWorkersAll = workers.filter(
        w => w.status === 'resigned' || w.status === '퇴사'
    );
    const resignedWorkers = resignedWorkersAll.filter(w =>
        w.name.includes(searchTerm) || w.idNumber?.includes(searchTerm)
    );

    const hasResignedWorkers = resignedWorkersAll.length > 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <FontAwesomeIcon icon={faShieldHalved} className="text-indigo-600" />
                            데이터 무결성 현황 (Data Integrity)
                        </h1>
                        <p className="text-slate-500 mt-2 text-sm">
                            시스템 내 데이터의 상태를 진단하고 퇴사자 및 오류 데이터를 관리합니다.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowDoc(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                        >
                            <FontAwesomeIcon icon={faCircleQuestion} className="text-indigo-500" />
                            설명서
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
                {loading && (
                    <div className="mb-4 text-xs text-slate-400">인력 데이터를 불러오는 중입니다...</div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Resigned Workers Card - only render when there is at least one resigned worker */}
                    {hasResignedWorkers && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faUserSlash} className="text-red-500" />
                                    퇴사자 명단
                                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {resignedWorkers.length}명
                                    </span>
                                </h3>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="이름 또는 주민번호 검색"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 w-48"
                                    />
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">이름</th>
                                            <th className="px-4 py-3">주민번호</th>
                                            <th className="px-4 py-3">연락처</th>
                                            <th className="px-4 py-3">직종</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {resignedWorkers.map(worker => (
                                            <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">
                                                    {worker.name}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                                    {worker.idNumber}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">
                                                    {worker.contact || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {worker.rank || worker.role || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Placeholder for Future metrics */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">데이터 이상 감지</h3>
                                <p className="text-xs text-slate-500">
                                    주민번호 형식 오류, 중복 데이터 등을 감지하는 기능이 추가될 예정입니다.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-slate-400 text-sm py-12">
                            준비 중입니다.
                        </div>
                    </div>
                </div>
            </div>

            {/* 설명서 모달 */}
            {showDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                            <h2 className="text-sm font-semibold text-slate-800">데이터 무결성 점검 항목 설명서</h2>
                            <button
                                type="button"
                                onClick={() => setShowDoc(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-5 space-y-4 text-sm text-slate-700">
                            <p className="text-slate-600 text-xs">
                                이 화면은 통합 인력 DB의 상태를 점검하여, 시스템 운영에 영향을 줄 수 있는 데이터 이상 항목을 한 눈에 보여주기 위한 용도입니다.
                            </p>
                            <div>
                                <h3 className="text-xs font-semibold text-slate-900 mb-2">현재 제공 중인 점검 항목</h3>
                                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                                    <li>
                                        <strong>퇴사자 명단</strong>{' '}
                                        <span className="text-slate-500">
                                            : 인력 DB에서 <code>status</code> 값이 <code>"resigned"</code> 또는 <code>"퇴사"</code> 인 근로자만 집계하여 보여줍니다.
                                        </span>
                                    </li>
                                    <li>
                                        <strong>검색 기능</strong>{' '}
                                        <span className="text-slate-500">
                                            : 상단 검색창에서 이름 또는 주민등록번호 일부를 입력해 퇴사자 명단을 빠르게 필터링할 수 있습니다.
                                        </span>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-slate-900 mb-2">향후 추가 예정 항목 (계획)</h3>
                                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                                    <li>주민번호 형식 오류 검증 (자릿수/패턴 불일치)</li>
                                    <li>중복 주민번호 또는 중복 이름+생년월일 조합 감지</li>
                                    <li>미배정 인력 (팀/현장/회사 정보가 누락된 인력) 점검</li>
                                </ul>
                                <p className="text-[11px] text-slate-400 mt-2">
                                    ※ 위 항목들은 단계적으로 구현될 예정이며, 실제 적용 시 이 설명서에도 함께 업데이트됩니다.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end px-5 py-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowDoc(false)}
                                className="px-4 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-900"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataIntegrityPage;
