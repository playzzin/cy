import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { manpowerService, Worker } from '../../services/manpowerService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCheck, faSearch, faUserPlus, faExclamationTriangle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

interface ProfileSetupProps {
    onComplete: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
    const { currentUser } = useAuth();
    const [step, setStep] = useState<'check' | 'auto-confirm' | 'manual-search' | 'create-new'>('check');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundWorker, setFoundWorker] = useState<Worker | null>(null);

    // Manual Search State
    const [searchName, setSearchName] = useState('');
    const [searchIdNumber, setSearchIdNumber] = useState('');

    // Create New State
    const [newWorkerData, setNewWorkerData] = useState({
        name: '',
        idNumber: '',
        contact: '',
        address: ''
    });

    useEffect(() => {
        checkAutoMatch();
    }, [currentUser]);

    const checkAutoMatch = async () => {
        if (!currentUser?.email) {
            setStep('manual-search');
            return;
        }

        setLoading(true);
        try {
            const worker = await manpowerService.getWorkerByEmail(currentUser.email);
            if (worker && !worker.uid) {
                setFoundWorker(worker);
                setStep('auto-confirm');
            } else {
                setStep('manual-search');
            }
        } catch (err) {
            console.error(err);
            setStep('manual-search');
        } finally {
            setLoading(false);
        }
    };

    const handleAutoLink = async () => {
        if (!foundWorker?.id || !currentUser?.uid) return;

        setLoading(true);
        try {
            await manpowerService.linkWorkerToUid(foundWorker.id, currentUser.uid);
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const worker = await manpowerService.findWorkerForLinking(searchName, searchIdNumber);
            if (worker) {
                if (worker.uid) {
                    setError('이미 다른 계정에 연결된 근로자입니다.');
                } else {
                    setFoundWorker(worker);
                    // Confirm manual link
                    if (window.confirm(`${worker.name}님으로 연결하시겠습니까?`)) {
                        await manpowerService.linkWorkerToUid(worker.id!, currentUser!.uid);
                        onComplete();
                    }
                }
            } else {
                setError('일치하는 근로자 정보를 찾을 수 없습니다.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!newWorkerData.name || !newWorkerData.idNumber) {
            setError('이름과 주민번호는 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            await manpowerService.addWorker({
                ...newWorkerData,
                email: currentUser?.email || '',
                uid: currentUser?.uid,
                teamType: '미배정',
                status: '미배정',
                unitPrice: 0
            });
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && step === 'check') {
        return <div className="p-8 text-center">프로필 확인 중...</div>;
    }

    return (
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden my-10 border border-slate-200">
            <div className="bg-slate-50 p-6 border-b border-slate-100 text-center">
                <h2 className="text-xl font-bold text-slate-800">프로필 설정</h2>
                <p className="text-slate-500 text-sm mt-1">서비스 이용을 위해 근로자 정보를 연결해주세요.</p>
            </div>

            <div className="p-6">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        {error}
                    </div>
                )}

                {step === 'auto-confirm' && foundWorker && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                            <FontAwesomeIcon icon={faUserCheck} />
                        </div>
                        <h3 className="text-lg font-bold mb-2">기존 프로필을 찾았습니다!</h3>
                        <div className="bg-slate-50 p-4 rounded-lg mb-6 text-left">
                            <p><span className="font-bold text-slate-500 w-20 inline-block">이름:</span> {foundWorker.name}</p>
                            <p><span className="font-bold text-slate-500 w-20 inline-block">이메일:</span> {foundWorker.email}</p>
                            <p><span className="font-bold text-slate-500 w-20 inline-block">팀:</span> {foundWorker.teamName || '-'}</p>
                        </div>
                        <button
                            onClick={handleAutoLink}
                            disabled={loading}
                            className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition mb-3"
                        >
                            {loading ? '연결 중...' : '이 프로필 사용하기'}
                        </button>
                        <button
                            onClick={() => setStep('manual-search')}
                            className="text-slate-500 text-sm hover:underline"
                        >
                            아니요, 다른 프로필을 찾겠습니다.
                        </button>
                    </div>
                )}

                {step === 'manual-search' && (
                    <div>
                        <div className="mb-6">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faSearch} className="text-brand-500" />
                                기존 정보 찾기
                            </h3>
                            <form onSubmit={handleManualSearch} className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="이름"
                                    value={searchName}
                                    onChange={e => setSearchName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="주민등록번호 (예: 900101-1234567)"
                                    value={searchIdNumber}
                                    onChange={e => setSearchIdNumber(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-bold hover:bg-slate-900 transition"
                                >
                                    {loading ? '검색 중...' : '검색 및 연결'}
                                </button>
                            </form>
                        </div>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-slate-500">또는</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('create-new')}
                            className="w-full border-2 border-dashed border-slate-300 text-slate-600 py-3 rounded-lg font-bold hover:border-brand-500 hover:text-brand-600 transition flex items-center justify-center gap-2"
                        >
                            <FontAwesomeIcon icon={faUserPlus} />
                            신규 프로필 생성
                        </button>
                    </div>
                )}

                {step === 'create-new' && (
                    <div>
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUserPlus} className="text-brand-500" />
                            신규 프로필 생성
                        </h3>
                        <form onSubmit={handleCreateNew} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">이름 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newWorkerData.name}
                                    onChange={e => setNewWorkerData({ ...newWorkerData, name: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">주민등록번호 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newWorkerData.idNumber}
                                    onChange={e => setNewWorkerData({ ...newWorkerData, idNumber: e.target.value })}
                                    placeholder="000000-0000000"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">연락처</label>
                                <input
                                    type="text"
                                    value={newWorkerData.contact}
                                    onChange={e => setNewWorkerData({ ...newWorkerData, contact: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">주소</label>
                                <input
                                    type="text"
                                    value={newWorkerData.address}
                                    onChange={e => setNewWorkerData({ ...newWorkerData, address: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setStep('manual-search')}
                                    className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-200 transition"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition"
                                >
                                    {loading ? '생성 중...' : '생성 완료'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileSetup;
