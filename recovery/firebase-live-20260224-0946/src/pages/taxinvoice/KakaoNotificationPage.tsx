/**
 * 카카오톡 통합 발송 페이지
 * 
 * 알림톡 + 친구톡 (텍스트, 이미지, 와이드) 통합 발송 UI
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faComments,
    faPaperPlane,
    faUser,
    faBuilding,
    faFileInvoiceDollar,
    faCheckCircle,
    faExclamationCircle,
    faBell,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import {
    sendKakaoNotification,
    NOTIFICATION_TEMPLATES,
    NotificationTemplateType,
    formatPhoneNumber
} from '../../services/kakaoNotificationService';

type MessageType = 'alimtalk' | 'friendtalk';

const KakaoNotificationPage: React.FC = () => {
    const navigate = useNavigate();
    // 탭 상태
    const [messageType, setMessageType] = useState<MessageType>('alimtalk');

    // 알림톡 폼 상태
    const [templateType, setTemplateType] = useState<NotificationTemplateType>('TAX_INVOICE_ISSUED');

    // 공통 폼 상태
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [companyName, setCompanyName] = useState('');

    // 알림톡 템플릿 변수
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [totalAmount, setTotalAmount] = useState('');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [balance, setBalance] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [remainingBalance, setRemainingBalance] = useState('');
    const [yearMonth, setYearMonth] = useState('');
    const [totalSales, setTotalSales] = useState('');
    const [totalPayments, setTotalPayments] = useState('');

    // 발송 상태
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // 전화번호 입력 핸들러
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        setRecipientPhone(formatPhoneNumber(value));
    };

    const alimtalkPreview = useMemo(() => {
        let preview = NOTIFICATION_TEMPLATES[templateType].preview;
        preview = preview.replace('#{companyName}', companyName || '거래처명');
        preview = preview.replace('#{invoiceDate}', invoiceDate);
        preview = preview.replace('#{totalAmount}', totalAmount ? Number(totalAmount).toLocaleString() : '0');
        preview = preview.replace('#{invoiceNum}', invoiceNum || '계산서번호');
        preview = preview.replace('#{balance}', balance ? Number(balance).toLocaleString() : '0');
        preview = preview.replace('#{dueDate}', dueDate || '입금요청일');
        preview = preview.replace('#{paymentDate}', paymentDate || '입금일');
        preview = preview.replace('#{paymentAmount}', paymentAmount ? Number(paymentAmount).toLocaleString() : '0');
        preview = preview.replace('#{remainingBalance}', remainingBalance ? Number(remainingBalance).toLocaleString() : '0');
        preview = preview.replace('#{yearMonth}', yearMonth || '2025년 01월');
        preview = preview.replace('#{totalSales}', totalSales ? Number(totalSales).toLocaleString() : '0');
        preview = preview.replace('#{totalPayments}', totalPayments ? Number(totalPayments).toLocaleString() : '0');
        return preview;
    }, [
        balance,
        companyName,
        dueDate,
        invoiceDate,
        invoiceNum,
        paymentAmount,
        paymentDate,
        remainingBalance,
        templateType,
        totalAmount,
        totalPayments,
        totalSales,
        yearMonth
    ]);

    // 알림톡 발송
    const handleSendAlimtalk = async () => {
        if (!recipientPhone || !recipientName) {
            setResult({ success: false, message: '수신자 정보를 입력해주세요.' });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            let variables: Record<string, string> = { companyName };

            switch (templateType) {
                case 'TAX_INVOICE_ISSUED':
                    variables = { companyName, invoiceDate, totalAmount: Number(totalAmount).toLocaleString(), invoiceNum };
                    break;
                case 'PAYMENT_REQUEST':
                    variables = { companyName, balance: Number(balance).toLocaleString(), dueDate };
                    break;
                case 'PAYMENT_RECEIVED':
                    variables = { companyName, paymentDate, paymentAmount: Number(paymentAmount).toLocaleString(), remainingBalance: Number(remainingBalance).toLocaleString() };
                    break;
                case 'MONTHLY_STATEMENT':
                    variables = { companyName, yearMonth, totalSales: Number(totalSales).toLocaleString(), totalPayments: Number(totalPayments).toLocaleString(), balance: Number(balance).toLocaleString() };
                    break;
            }

            const response = await sendKakaoNotification({
                templateType,
                recipientPhone: recipientPhone.replace(/-/g, ''),
                recipientName,
                variables,
            });

            setResult(response);
        } catch (error) {
            setResult({ success: false, message: error instanceof Error ? error.message : '발송 중 오류가 발생했습니다.' });
        } finally {
            setIsLoading(false);
        }
    };

    // 알림톡 템플릿 필드
    const renderAlimtalkFields = () => {
        switch (templateType) {
            case 'TAX_INVOICE_ISSUED':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">발행일</label>
                            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">합계금액</label>
                            <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="11000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">세금계산서 번호</label>
                            <input type="text" value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} placeholder="20250101-001"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                    </>
                );
            case 'PAYMENT_REQUEST':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">미수금액</label>
                            <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="5000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">입금요청일</label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                    </>
                );
            case 'PAYMENT_RECEIVED':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">입금일</label>
                            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">입금금액</label>
                            <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="3000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">잔여잔액</label>
                            <input type="number" value={remainingBalance} onChange={(e) => setRemainingBalance(e.target.value)} placeholder="2000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                    </>
                );
            case 'MONTHLY_STATEMENT':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">년월</label>
                            <input type="text" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} placeholder="2025년 01월"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">매출합계</label>
                            <input type="number" value={totalSales} onChange={(e) => setTotalSales(e.target.value)} placeholder="50000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">입금합계</label>
                            <input type="number" value={totalPayments} onChange={(e) => setTotalPayments(e.target.value)} placeholder="45000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">잔액</label>
                            <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="5000000"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl p-6 mb-6 text-black">
                    <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faComments} className="text-3xl" />
                        <div>
                            <h1 className="text-2xl font-bold">카카오톡 메시지 발송</h1>
                            <p className="text-yellow-900">업무용 알림톡(프리셋 템플릿) 발송</p>
                        </div>
                    </div>
                </div>

                {/* 탭 선택 */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setMessageType('alimtalk')}
                        className={`flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${messageType === 'alimtalk'
                                ? 'bg-yellow-400 text-black shadow-lg'
                                : 'bg-white text-gray-600 border hover:bg-gray-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faBell} />
                        알림톡
                    </button>
                    <button
                        onClick={() => setMessageType('friendtalk')}
                        className={`flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${messageType === 'friendtalk'
                                ? 'bg-yellow-400 text-black shadow-lg'
                                : 'bg-white text-gray-600 border hover:bg-gray-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faUsers} />
                        친구톡
                    </button>
                </div>

                {/* 결과 메시지 */}
                {result && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${result.success ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                        <FontAwesomeIcon icon={result.success ? faCheckCircle : faExclamationCircle} className="text-xl" />
                        <p>{result.message}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 폼 영역 */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h2 className="text-lg font-semibold mb-4">
                            {messageType === 'alimtalk' ? '알림톡 발송' : '친구톡 발송'}
                        </h2>

                        {/* 수신자 정보 (공통) */}
                        <div className="space-y-4 mb-6">
                            <h3 className="font-medium text-gray-700 flex items-center gap-2">
                                <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                                수신자 정보
                            </h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">수신자명 *</label>
                                <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="홍길동"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">휴대폰번호 *</label>
                                <input type="tel" value={recipientPhone} onChange={handlePhoneChange} placeholder="010-1234-5678"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">거래처명 *</label>
                                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="(주)테스트건설"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500" />
                            </div>
                        </div>

                        {/* 알림톡 전용 */}
                        {messageType === 'alimtalk' && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">템플릿 선택</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(NOTIFICATION_TEMPLATES).map(([key, template]) => (
                                            <button key={key} onClick={() => setTemplateType(key as NotificationTemplateType)}
                                                className={`p-3 rounded-lg border text-sm text-left transition-colors ${templateType === key ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-gray-200 hover:bg-gray-50'
                                                    }`}>
                                                <div className="font-medium">{template.title}</div>
                                                <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4 mb-6">
                                    <h3 className="font-medium text-gray-700 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-gray-400" />
                                        세부 정보
                                    </h3>
                                    {renderAlimtalkFields()}
                                </div>
                                <button onClick={handleSendAlimtalk} disabled={isLoading}
                                    className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${isLoading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-yellow-400 hover:bg-yellow-500 text-black'
                                        }`}>
                                    <FontAwesomeIcon icon={faPaperPlane} />
                                    {isLoading ? '발송 중...' : '알림톡 발송'}
                                </button>
                            </>
                        )}

                        {/* 친구톡 전용 */}
                        {messageType === 'friendtalk' && (
                            <>
                                <div className="p-4 border rounded-xl bg-blue-50 text-blue-800 text-sm">
                                    이 페이지의 친구톡(이미지/와이드 등)은 현재 운영 백엔드 스펙과 일치하지 않아 제거되었습니다.
                                    <br />
                                    친구톡 발송은 <strong>카카오톡 발송센터</strong>에서 진행해주세요.
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate('/payroll/kakao-message-center')}
                                    className="mt-4 w-full py-3 rounded-xl font-semibold bg-yellow-400 hover:bg-yellow-500 text-black"
                                >
                                    카카오톡 발송센터로 이동
                                </button>
                            </>
                        )}
                    </div>

                    {/* 미리보기 */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h2 className="text-lg font-semibold mb-4">미리보기</h2>

                        <div className="bg-[#FAE100] rounded-xl p-1">
                            <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
                                        <FontAwesomeIcon icon={faBuilding} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">청연건설</div>
                                        <div className="text-xs text-gray-500">
                                            {messageType === 'alimtalk' ? '알림톡' : '친구톡'}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-sm whitespace-pre-wrap text-gray-800 bg-gray-50 rounded-lg p-3">
                                    {messageType === 'alimtalk'
                                        ? alimtalkPreview
                                        : '친구톡 발송은 카카오톡 발송센터(/payroll/kakao-message-center)에서 진행해주세요.'}
                                </div>
                            </div>
                        </div>

                        {/* 안내 문구 */}
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                            💡 <strong>주의</strong>: 이 페이지에서 발송하면 운영 환경에서는 실제로 발송될 수 있습니다.
                        </div>

                        {/* 알림톡 vs 친구톡 안내 */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-blue-800 text-sm">
                            <strong>📌 {messageType === 'alimtalk' ? '알림톡' : '친구톡'} 특징</strong>
                            <ul className="mt-2 space-y-1 text-xs">
                                {messageType === 'alimtalk' ? (
                                    <>
                                        <li>• 친구 추가 없이 누구에게나 발송 가능</li>
                                        <li>• 템플릿 사전 승인 필요 (2-3일)</li>
                                        <li>• 정보성 메시지만 가능 (광고 불가)</li>
                                    </>
                                ) : (
                                    <>
                                        <li>• 친구톡은 카카오톡 발송센터에서 지원합니다.</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KakaoNotificationPage;
