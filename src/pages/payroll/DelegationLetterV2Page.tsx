import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCopy, faPrint } from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { toast } from '../../utils/swal';

// --- Types ---
interface TrusteeInfo {
    name: string;
    idNumber: string;
    address: string;
    contact: string;
    signature: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
}

interface DelegatorItem {
    id: string;
    name: string;
    idNumber: string;
    address: string;
    unitPrice: number;
    workDays: number;
    claimAmount: number;
    signature: string;
}

const DelegationLetterV2Page: React.FC = () => {
    // --- State ---
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    // Form Data
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [siteName, setSiteName] = useState('');
    const [content, setContent] = useState('');

    // Trustee (수임인 - 청연 대표)
    const [trustee, setTrustee] = useState<TrusteeInfo | null>(null);

    // Delegators (위임인 - 선택된 작업자들)
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [delegators, setDelegators] = useState<DelegatorItem[]>([]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [batchUnitPrice, setBatchUnitPrice] = useState<number>(0);
    const [batchWorkDays, setBatchWorkDays] = useState<number>(1);
    const [copying, setCopying] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    // --- Load Data ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [companiesData, workersData] = await Promise.all([
                companyService.getCompanies(),
                manpowerService.getWorkers()
            ]);

            setCompanies(companiesData);
            setWorkers(workersData);

            // 청연 대표 자동 로드
            loadTrustee(companiesData, workersData);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('데이터 로딩에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 수임인 (청연 대표) 자동 로드
    const loadTrustee = (companiesData: Company[], workersData: Worker[]) => {
        const cheongyeonCompany = companiesData.find(c => c.type === '시공사');
        if (!cheongyeonCompany) {
            toast.warning('시공사(청연)를 찾을 수 없습니다.');
            return;
        }

        const ceo = workersData.find(w =>
            w.companyId === cheongyeonCompany.id &&
            w.role === '대표'
        );

        if (ceo) {
            setTrustee({
                name: ceo.name,
                idNumber: ceo.idNumber,
                address: ceo.address || '',
                contact: ceo.contact || '',
                signature: ceo.signatureUrl || '',
                bankName: ceo.bankName || '',
                accountNumber: ceo.accountNumber || '',
                accountHolder: ceo.accountHolder || ceo.name
            });
        } else {
            toast.warning('청연 대표를 찾을 수 없습니다.');
        }
    };

    // --- 청연 소속 작업자 필터링 ---
    const cheongyeonWorkers = useMemo(() => {
        const cheongyeonCompany = companies.find(c => c.type === '시공사');
        if (!cheongyeonCompany) return [];

        return workers.filter(w =>
            w.companyId === cheongyeonCompany.id &&
            w.status === 'active' &&
            w.role !== '대표' // 대표는 제외
        );
    }, [companies, workers]);

    // --- 검색 필터링 ---
    const filteredWorkers = useMemo(() => {
        if (!searchTerm) return cheongyeonWorkers;

        return cheongyeonWorkers.filter(w =>
            w.name.includes(searchTerm) ||
            w.idNumber.includes(searchTerm)
        );
    }, [cheongyeonWorkers, searchTerm]);

    // --- 위임인 선택/해제 ---
    const toggleWorker = (workerId: string) => {
        const worker = workers.find(w => w.id === workerId);
        if (!worker) return;

        if (selectedWorkerIds.includes(workerId)) {
            // 해제
            setSelectedWorkerIds(prev => prev.filter(id => id !== workerId));
            setDelegators(prev => prev.filter(d => d.id !== workerId));
        } else {
            // 선택
            setSelectedWorkerIds(prev => [...prev, workerId]);
            setDelegators(prev => [...prev, {
                id: workerId,
                name: worker.name,
                idNumber: worker.idNumber,
                address: worker.address || '',
                unitPrice: worker.unitPrice || 0,
                workDays: 1,
                claimAmount: (worker.unitPrice || 0) * 1,
                signature: worker.signatureUrl || ''
            }]);
        }
    };

    // --- 전체 선택/해제 ---
    const toggleAll = () => {
        if (selectedWorkerIds.length === filteredWorkers.length) {
            // 전체 해제
            setSelectedWorkerIds([]);
            setDelegators([]);
        } else {
            // 전체 선택
            const newIds = filteredWorkers.map(w => w.id!);
            setSelectedWorkerIds(newIds);
            setDelegators(filteredWorkers.map(w => ({
                id: w.id!,
                name: w.name,
                idNumber: w.idNumber,
                address: w.address || '',
                unitPrice: w.unitPrice || 0,
                workDays: 1,
                claimAmount: (w.unitPrice || 0) * 1,
                signature: w.signatureUrl || ''
            })));
        }
    };

    // --- 단가/공수 변경 ---
    const updateDelegator = (id: string, field: 'unitPrice' | 'workDays', value: number) => {
        setDelegators(prev => prev.map(d => {
            if (d.id !== id) return d;
            const updated = { ...d, [field]: value };
            updated.claimAmount = updated.unitPrice * updated.workDays;
            return updated;
        }));
    };

    // --- 일괄 변경 ---
    const applyBatchChange = (type: 'unitPrice' | 'workDays') => {
        const value = type === 'unitPrice' ? batchUnitPrice : batchWorkDays;
        setDelegators(prev => prev.map(d => {
            const updated = { ...d, [type]: value };
            updated.claimAmount = updated.unitPrice * updated.workDays;
            return updated;
        }));
        toast.success(`${type === 'unitPrice' ? '단가' : '공수'}를 일괄 적용했습니다.`);
    };

    // --- 총합 계산 ---
    const totalAmount = useMemo(() => {
        return delegators.reduce((sum, d) => sum + d.claimAmount, 0);
    }, [delegators]);

    // --- 이미지 복사 ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;

        setCopying(true);
        try {
            const canvas = await html2canvas(printRef.current, {
                useCORS: true
            });

            canvas.toBlob(blob => {
                if (blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    toast.success('위임장이 이미지로 복사되었습니다!');
                }
            });
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('복사에 실패했습니다.');
        } finally {
            setCopying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-slate-600">데이터 로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-full mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-slate-800">위임장 v2</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCopyToClipboard}
                            disabled={copying || delegators.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FontAwesomeIcon icon={faCopy} className="mr-2" />
                            {copying ? '복사 중...' : '이미지 복사'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            disabled={delegators.length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FontAwesomeIcon icon={faPrint} className="mr-2" />
                            출력
                        </button>
                    </div>
                </div>

                {/* Settings Panel */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* 년도 선택 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">년도</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                {[2024, 2025, 2026].map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                        </div>

                        {/* 월 선택 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">월</label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>

                        {/* 현장명 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">현장명</label>
                            <input
                                type="text"
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="현장명 입력"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* 본문 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">본문</label>
                            <input
                                type="text"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="본문 내용"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* 작업자 선택 영역 */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 검색 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">작업자 검색</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="이름 또는 주민번호"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* 일괄 단가 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">일괄 단가</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={batchUnitPrice}
                                    onChange={(e) => setBatchUnitPrice(Number(e.target.value))}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                />
                                <button
                                    onClick={() => applyBatchChange('unitPrice')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    적용
                                </button>
                            </div>
                        </div>

                        {/* 일괄 공수 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">일괄 공수</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={batchWorkDays}
                                    onChange={(e) => setBatchWorkDays(Number(e.target.value))}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                />
                                <button
                                    onClick={() => applyBatchChange('workDays')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    적용
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 작업자 목록 */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">작업자 선택 ({selectedWorkerIds.length}명)</label>
                            <button
                                onClick={toggleAll}
                                className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                                {selectedWorkerIds.length === filteredWorkers.length ? '전체 해제' : '전체 선택'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                            {filteredWorkers.map(worker => {
                                const isSelected = selectedWorkerIds.includes(worker.id!);
                                const delegator = delegators.find(d => d.id === worker.id);

                                return (
                                    <div
                                        key={worker.id}
                                        className={`p-2 rounded border-2 cursor-pointer text-sm ${isSelected
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        onClick={() => toggleWorker(worker.id!)}
                                    >
                                        <div className="font-medium text-slate-900">{worker.name}</div>
                                        {isSelected && delegator && (
                                            <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="number"
                                                    value={delegator.unitPrice}
                                                    onChange={(e) => updateDelegator(worker.id!, 'unitPrice', Number(e.target.value))}
                                                    placeholder="단가"
                                                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                                                />
                                                <input
                                                    type="number"
                                                    value={delegator.workDays}
                                                    onChange={(e) => updateDelegator(worker.id!, 'workDays', Number(e.target.value))}
                                                    placeholder="공수"
                                                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                                                />
                                                <div className="text-xs font-bold text-blue-600">
                                                    {delegator.claimAmount.toLocaleString()}원
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <div ref={printRef} className="space-y-4">
                        <h1 className="text-center text-3xl font-bold border-b-2 border-slate-800 pb-4">위 임 장</h1>

                        {/* 수임인 섹션 - 한 줄 테이블 */}
                        {trustee && (
                            <div>
                                <div className="mb-2 flex justify-between">
                                    <span className="font-bold">수임인</span>
                                    <span className="font-bold">{year}년 {month}월분</span>
                                </div>
                                <table className="w-full border-collapse border border-slate-800 text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-24">수임인</td>
                                            <td className="border border-slate-800 px-3 py-2">{trustee.name}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-32">주민등록번호</td>
                                            <td className="border border-slate-800 px-3 py-2">{trustee.idNumber}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-20">주소</td>
                                            <td className="border border-slate-800 px-3 py-2">{trustee.address}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-24">연락처</td>
                                            <td className="border border-slate-800 px-3 py-2">{trustee.contact}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-32">서명 또는 인</td>
                                            <td className="border border-slate-800 px-3 py-2 text-center">
                                                {trustee.signature && <img src={trustee.signature} alt="수임인 서명" className="max-h-12 mx-auto" />}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* 위임 사항 */}
                        {content && (
                            <div className="text-sm leading-relaxed">
                                {content}
                            </div>
                        )}

                        {/* 계좌 정보 */}
                        {trustee && (
                            <div>
                                <table className="w-full border-collapse border border-slate-800 text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-20">은행</td>
                                            <td className="border border-slate-800 px-3 py-2 w-32">{trustee.bankName}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-24">계좌번호</td>
                                            <td className="border border-slate-800 px-3 py-2">{trustee.accountNumber}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-20">예금주</td>
                                            <td className="border border-slate-800 px-3 py-2 w-24">{trustee.accountHolder}</td>
                                            <td className="border border-slate-800 px-3 py-2 font-medium bg-slate-50 w-20">검인일</td>
                                            <td className="border border-slate-800 px-3 py-2 w-32">{year}. {month}. 11</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* 위임인 목록 */}
                        {delegators.length > 0 && (
                            <div>
                                <div className="font-bold mb-2">- 아 래 -</div>
                                <table className="w-full border-collapse border border-slate-800 text-xs">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border border-slate-800 px-2 py-1">번호</th>
                                            <th className="border border-slate-800 px-2 py-1">위임인</th>
                                            <th className="border border-slate-800 px-2 py-1">주민등록번호</th>
                                            <th className="border border-slate-800 px-2 py-1">주소</th>
                                            <th className="border border-slate-800 px-2 py-1">청구금액</th>
                                            <th className="border border-slate-800 px-2 py-1">서명 또는 인</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {delegators.map((delegator, idx) => (
                                            <tr key={delegator.id}>
                                                <td className="border border-slate-800 px-2 py-1 text-center">{idx + 1}</td>
                                                <td className="border border-slate-800 px-2 py-1">{delegator.name}</td>
                                                <td className="border border-slate-800 px-2 py-1 text-xs">{delegator.idNumber}</td>
                                                <td className="border border-slate-800 px-2 py-1 text-xs">{delegator.address}</td>
                                                <td className="border border-slate-800 px-2 py-1 text-right">{delegator.claimAmount.toLocaleString()}</td>
                                                <td className="border border-slate-800 px-2 py-1 text-center">
                                                    {delegator.signature && <img src={delegator.signature} alt="서명" className="max-h-8 mx-auto" />}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold bg-slate-50">
                                            <td colSpan={4} className="border border-slate-800 px-2 py-1 text-center">합계</td>
                                            <td className="border border-slate-800 px-2 py-1 text-right">{totalAmount.toLocaleString()}</td>
                                            <td className="border border-slate-800 px-2 py-1"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterV2Page;
