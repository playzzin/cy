import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave } from '@fortawesome/free-solid-svg-icons';
import { paymentFirestoreService } from '../../../services/paymentFirestoreService';
import { siteService } from '../../../services/siteService';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialCompanyId?: string;
    initialCompanyName?: string;
}

const DepositModal: React.FC<DepositModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialCompanyId,
    initialCompanyName
}) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [siteName, setSiteName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [memo, setMemo] = useState('');
    const [sites, setSites] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCompanyName(initialCompanyName || '');
            setDate(new Date().toISOString().split('T')[0]);
            setAmount('');
            setMemo('');
            // Load sites
            siteService.getSites().then(data => {
                setSites(data.map((s: any) => s.name).sort());
            });
        }
    }, [isOpen, initialCompanyName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName || !amount) {
            alert('거래처명과 금액은 필수입니다.');
            return;
        }

        setIsSubmitting(true);
        try {
            await paymentFirestoreService.addPayment({
                date,
                type: 'in',
                amount: Number(amount.replace(/,/g, '')),
                companyId: initialCompanyId || undefined, // ID가 없으면 undefined (수기)
                companyName: companyName,
                siteName: siteName || undefined,
                teamName: teamName || undefined,
                memo: memo || undefined,
                category: '입금'
            });

            alert('입금이 등록되었습니다.');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('입금 등록 실패:', error);
            alert('입금 등록 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="bg-green-600 px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">입금 등록</h3>
                    <button onClick={onClose} className="hover:text-green-200 transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 날짜 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">입금일자</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    {/* 거래처명 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">거래처명</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            // ID가 있으면 수정 불가 (등록된 거래처)
                            readOnly={!!initialCompanyId}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none ${initialCompanyId ? 'bg-gray-100' : ''}`}
                            required
                        />
                    </div>

                    {/* 금액 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">입금금액</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={amount ? Number(amount).toLocaleString() : ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setAmount(val);
                                }}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none pr-8 text-right font-bold text-green-700"
                                placeholder="0"
                                required
                            />
                            <span className="absolute right-3 top-2.5 text-gray-400 font-medium">원</span>
                        </div>
                    </div>

                    {/* 현장명 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">관련 현장</label>
                        <input
                            list="site-list"
                            type="text"
                            value={siteName}
                            onChange={(e) => setSiteName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="현장명 입력 또는 선택"
                        />
                        <datalist id="site-list">
                            {sites.map(s => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                    </div>

                    {/* 팀명 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">팀명 (선택)</label>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="ex) 1팀, 철근팀"
                        />
                    </div>

                    {/* 비고 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">비고 (입금내용)</label>
                        <input
                            type="text"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="ex) 12월 기성 입금, 국민은행"
                        />
                    </div>

                    {/* 버튼 */}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                            {isSubmitting ? (
                                '저장 중...'
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faSave} />
                                    입금 저장
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DepositModal;
