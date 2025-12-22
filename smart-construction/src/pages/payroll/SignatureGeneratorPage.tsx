import React, { useState, useEffect } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import SignatureGeneratorModal from '../../components/signatures/SignatureGeneratorModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSignature, faSpinner, faCheck, faUser } from '@fortawesome/free-solid-svg-icons';

const SignatureGeneratorPage: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadWorkers();
    }, []);

    useEffect(() => {
        if (searchTerm.trim()) {
            setFilteredWorkers(
                workers.filter(w =>
                    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    w.contact?.includes(searchTerm)
                )
            );
        } else {
            setFilteredWorkers(workers);
        }
    }, [searchTerm, workers]);

    const loadWorkers = async () => {
        try {
            setLoading(true);
            const result = await manpowerService.getWorkersPaginated(1000);
            setWorkers(result.workers);
            setFilteredWorkers(result.workers);
        } catch (error) {
            console.error('작업자 목록 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (worker: Worker) => {
        setSelectedWorker(worker);
        setIsModalOpen(true);
    };

    const handleSaveComplete = (newUrl: string) => {
        // Update the worker's signature URL in local state
        setWorkers(prev =>
            prev.map(w =>
                w.id === selectedWorker?.id
                    ? { ...w, signatureUrl: newUrl }
                    : w
            )
        );
        setIsModalOpen(false);
        setSelectedWorker(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-600 mb-4" />
                    <p className="text-slate-500 font-medium">작업자 목록을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faSignature} className="text-indigo-600" />
                    </div>
                    서명 생성기
                </h1>
                <p className="text-slate-500 mt-2">작업자를 선택하여 자동 서명을 생성하거나 직접 서명을 입력할 수 있습니다.</p>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="작업자 이름 또는 연락처 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="mb-6 flex gap-4">
                <div className="bg-white rounded-xl px-4 py-3 border border-slate-200">
                    <span className="text-slate-500 text-sm">전체 작업자</span>
                    <span className="ml-2 font-bold text-slate-800">{workers.length}명</span>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 border border-slate-200">
                    <span className="text-slate-500 text-sm">서명 등록</span>
                    <span className="ml-2 font-bold text-green-600">
                        {workers.filter(w => w.signatureUrl).length}명
                    </span>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 border border-slate-200">
                    <span className="text-slate-500 text-sm">미등록</span>
                    <span className="ml-2 font-bold text-orange-600">
                        {workers.filter(w => !w.signatureUrl).length}명
                    </span>
                </div>
            </div>

            {/* Worker Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredWorkers.map((worker) => (
                    <div
                        key={worker.id}
                        onClick={() => handleOpenModal(worker)}
                        className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                <FontAwesomeIcon icon={faUser} className="text-slate-400 group-hover:text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">{worker.name}</h3>
                                <p className="text-xs text-slate-400">{worker.role || '미분류'}</p>
                            </div>
                        </div>

                        {/* Signature Preview */}
                        <div className="h-16 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-200 overflow-hidden">
                            {worker.signatureUrl ? (
                                <div className="relative w-full h-full">
                                    <img
                                        src={worker.signatureUrl}
                                        alt="서명"
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-1 right-1">
                                        <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                            <FontAwesomeIcon icon={faCheck} className="text-[8px]" />
                                            등록됨
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-xs text-slate-400">서명 미등록</span>
                            )}
                        </div>

                        {/* Action Hint */}
                        <div className="mt-3 text-center">
                            <span className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                클릭하여 서명 {worker.signatureUrl ? '수정' : '생성'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {filteredWorkers.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    검색 결과가 없습니다.
                </div>
            )}

            {/* Modal */}
            {selectedWorker && (
                <SignatureGeneratorModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedWorker(null);
                    }}
                    workerId={selectedWorker.id!}
                    workerName={selectedWorker.name}
                    onSaveComplete={handleSaveComplete}
                />
            )}
        </div>
    );
};

export default SignatureGeneratorPage;
