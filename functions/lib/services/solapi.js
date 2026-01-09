"use strict";
/**
 * SOLAPI (솔라피) 설정 및 클라이언트
 *
 * 카카오톡 알림톡 발송을 위한 SOLAPI SDK 설정
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KAKAO_TEMPLATES = exports.messageService = void 0;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.sendAlimtalk = sendAlimtalk;
exports.sendBulkAlimtalk = sendBulkAlimtalk;
const solapi_1 = require("solapi");
// 환경변수에서 API 키 로드
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || '';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || '';
const FROM_NUMBER = process.env.KAKAO_FROM_NUMBER || ''; // 발신번호
const KAKAO_PF_ID = process.env.KAKAO_PF_ID || ''; // 카카오 발신 프로필 ID (@로 시작)
// SOLAPI 클라이언트 초기화
exports.messageService = new solapi_1.SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET);
/**
 * 알림톡 템플릿 정의
 */
exports.KAKAO_TEMPLATES = {
    // 세금계산서 발행 알림
    TAX_INVOICE_ISSUED: {
        id: 'KA01TP001', // 실제 등록된 템플릿 ID로 변경 필요
        name: '세금계산서 발행 알림',
        variables: ['companyName', 'invoiceDate', 'totalAmount', 'invoiceNum']
    },
    // 입금 요청 알림
    PAYMENT_REQUEST: {
        id: 'KA01TP002',
        name: '입금 요청 알림',
        variables: ['companyName', 'balance', 'dueDate']
    },
    // 입금 확인 알림
    PAYMENT_RECEIVED: {
        id: 'KA01TP003',
        name: '입금 확인 알림',
        variables: ['companyName', 'paymentDate', 'paymentAmount', 'remainingBalance']
    },
    // 월간 거래명세서
    MONTHLY_STATEMENT: {
        id: 'KA01TP004',
        name: '월간 거래명세서',
        variables: ['companyName', 'yearMonth', 'totalSales', 'totalPayments', 'balance']
    }
};
/**
 * 전화번호 정규화 (하이픈 제거)
 */
function normalizePhoneNumber(phone) {
    return phone.replace(/[^0-9]/g, '');
}
/**
 * 알림톡 발송
 */
async function sendAlimtalk(request) {
    try {
        const template = exports.KAKAO_TEMPLATES[request.templateId];
        if (!template) {
            throw new Error(`Unknown template: ${request.templateId}`);
        }
        // 전화번호 정규화
        const to = normalizePhoneNumber(request.to);
        // SOLAPI 메시지 발송
        const result = await exports.messageService.send({
            to: to,
            from: FROM_NUMBER,
            kakaoOptions: {
                pfId: KAKAO_PF_ID,
                templateId: template.id,
                variables: request.variables,
                // 알림톡 실패 시 SMS로 대체 발송
                disableSms: false
            }
        });
        console.log('✅ Alimtalk sent:', result);
        return {
            success: true,
            messageId: result.messageId || result.groupId || 'unknown'
        };
    }
    catch (error) {
        console.error('❌ Alimtalk send error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * 여러 명에게 동시 발송
 */
async function sendBulkAlimtalk(recipients, templateId) {
    const promises = recipients.map(recipient => sendAlimtalk({
        to: recipient.phone,
        templateId,
        variables: recipient.variables
    }));
    return Promise.all(promises);
}
//# sourceMappingURL=solapi.js.map