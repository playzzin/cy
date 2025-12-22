import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave } from '@fortawesome/free-solid-svg-icons';
import { taxInvoiceFirestoreService } from '../../../services/taxInvoiceFirestoreService';
import { siteService } from '../../../services/siteService';

interface ManualSalesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialCompanyId?: string;
    initialCompanyName?: string;
    initialBusinessNumber?: string;
}

const ManualSalesModal: React.FC<ManualSalesModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialCompanyId,
    initialCompanyName,
    initialBusinessNumber
}) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [companyName, setCompanyName] = useState('');
    const [businessNumber, setBusinessNumber] = useState('');
    const [itemName, setItemName] = useState('');

    // 금액
    const [supplyAmount, setSupplyAmount] = useState('');
    const [taxAmount, setTaxAmount] = useState('');
    const [totalAmount, setTotalAmount] = useState(0);

    const [siteName, setSiteName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [memo, setMemo] = useState('');

    const [sites, setSites] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCompanyName(initialCompanyName || '');
            setBusinessNumber(initialBusinessNumber || '');
            setDate(new Date().toISOString().split('T')[0]);
            setItemName('공사대금');
            setSupplyAmount('');
            setTaxAmount('');
            setTotalAmount(0);
            setMemo('');

            // Load sites
            siteService.getSites().then(data => {
                setSites(data.map((s: any) => s.name).sort());
            });
        }
    }, [isOpen, initialCompanyName, initialBusinessNumber]);

    // 공급가액 변경 시 세액 자동 계산 (10%)
    useEffect(() => {
        const supply = Number(supplyAmount.replace(/,/g, ''));
        const tax = Number(taxAmount.replace(/,/g, ''));
        setTotalAmount(supply + tax);
    }, [supplyAmount, taxAmount]);

    const handleSupplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setSupplyAmount(val);
        // 세액 자동 계산 (10%)
        if (val) {
            const supply = Number(val);
            setTaxAmount(Math.floor(supply * 0.1).toString());
        } else {
            setTaxAmount('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName || !supplyAmount) {
            alert('거래처명과 공급가액은 필수입니다.');
            return;
        }

        setIsSubmitting(true);
        try {
            const supply = Number(supplyAmount.replace(/,/g, ''));
            const tax = Number(taxAmount.replace(/,/g, ''));

            await taxInvoiceFirestoreService.addTaxInvoice({
                invoiceNum: `MANUAL-${Date.now()}`, // 임시 번호 생성
                invoiceDate: date,
                type: 'sales',
                status: 'issued', // 수기 등록은 이미 발행된 것으로 간주

                // 공급자 (우리 회사 - 하드코딩 또는 설정에서 가져오기)
                invoicerCorpNum: '123-45-67890', // TODO: Fetch from settings
                invoicerCorpName: '(주)스마트건설',

                // 공급받는자
                invoiceeCorpNum: businessNumber,
                invoiceeCorpName: companyName,
                invoiceeCompanyId: initialCompanyId,

                // 금액
                supplyAmount: supply,
                taxAmount: tax,
                totalAmount: supply + tax,

                itemCount: 1,
                itemName: itemName,

                // 메타
                siteName: siteName || undefined,
                teamName: teamName || undefined,
                memo: memo || undefined,
                source: 'manual'
            });

            alert('수기 매출이 등록되었습니다.');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('매출 등록 실패:', error);
            alert('매출 등록 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">매출(세금계산서) 수기 등록</h3>
                    <button onClick={onClose} className="hover:text-blue-200 transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* 날짜 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">작성일자</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                        {/* 품목명 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">품목</label>
                            <input
                                type="text"
                                value={itemName}
                                onChange={(e) => setItemName(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* 거래처 정보 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">상호(법인명)</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                readOnly={!!initialCompanyId}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${initialCompanyId ? 'bg-gray-100' : ''}`}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">사업자번호 (선택)</label>
                            <input
                                type="text"
                                value={businessNumber}
                                onChange={(e) => setBusinessNumber(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="000-00-00000"
                            />
                        </div>
                    </div>

                    {/* 금액 정보 */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">공급가액</label>
                                <input
                                    type="text"
                                    value={supplyAmount ? Number(supplyAmount).toLocaleString() : ''}
                                    onChange={handleSupplyChange}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium"
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">세액 (10%)</label>
                                <input
                                    type="text"
                                    value={taxAmount ? Number(taxAmount).toLocaleString() : ''}
                                    onChange={(e) => setTaxAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="font-bold text-gray-700">합계금액</span>
                            <span className="text-xl font-bold text-blue-600">
                                {totalAmount.toLocaleString()} 원
                            </span>
                        </div>
                    </div>

                    {/* 현장 및 팀 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">관련 현장</label>
                            <input
                                list="site-list-sales"
                                type="text"
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="현장 선택"
                            />
                            <datalist id="site-list-sales">
                                {sites.map(s => (
                                    <option key={s} value={s} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">팀명 (선택)</label>
                            <input
                                type="text"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="ex) 1팀"
                            />
                        </div>
                    </div>

                    {/* 비고 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                        <input
                            type="text"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="종이세금계산서, 기타 내역"
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
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                            {isSubmitting ? (
                                '저장 중...'
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faSave} />
                                    매출 저장
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualSalesModal;
