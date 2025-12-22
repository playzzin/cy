/**
 * 카카오톡 알림톡 서비스
 * 
 * 바로빌 또는 솔라피 API를 통해 카카오톡 알림톡을 발송합니다.
 * 세금계산서 발행 알림, 입금 요청 알림 등에 사용됩니다.
 */

// Firebase Functions URL
const FUNCTIONS_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Mock 모드
const MOCK_MODE = false;

// ... (types and interfaces remain unchanged)

// 알림톡 템플릿 타입
export type NotificationTemplateType =
    | 'TAX_INVOICE_ISSUED'      // 세금계산서 발행 알림
    | 'PAYMENT_REQUEST'          // 입금 요청 알림
    | 'PAYMENT_RECEIVED'         // 입금 확인 알림
    | 'MONTHLY_STATEMENT';       // 월간 거래 명세서

// 친구톡 타입
export type FriendTalkType = 'TEXT' | 'IMAGE' | 'WIDE';

// 알림톡 요청 인터페이스
export interface KakaoNotificationRequest {
    templateType: NotificationTemplateType;
    recipientPhone: string;          // 수신자 전화번호
    recipientName: string;           // 수신자 이름
    variables: Record<string, string>;  // 템플릿 변수
}

// 친구톡 요청 인터페이스
export interface FriendTalkRequest {
    type: FriendTalkType;
    recipientPhone: string;
    recipientName: string;
    message: string;
    imageUrl?: string;               // 이미지/와이드 친구톡용
    buttonText?: string;             // 버튼 텍스트
    buttonUrl?: string;              // 버튼 URL
    adFlag?: boolean;                // 광고 표시 여부
}

// 알림톡 응답 인터페이스
export interface KakaoNotificationResponse {
    success: boolean;
    message: string;
    messageId?: string;
}

// 템플릿 정보
export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateType, {
    title: string;
    description: string;
    variables: string[];
    preview: string;
}> = {
    TAX_INVOICE_ISSUED: {
        title: '세금계산서 발행 알림',
        description: '세금계산서가 발행되었음을 알립니다.',
        variables: ['companyName', 'invoiceDate', 'totalAmount', 'invoiceNum'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설에서 세금계산서가 발행되었습니다.

■ 발행일: #{invoiceDate}
■ 합계금액: #{totalAmount}원
■ 세금계산서번호: #{invoiceNum}

홈택스에서 확인 부탁드립니다.
문의: 02-XXX-XXXX`,
    },
    PAYMENT_REQUEST: {
        title: '대금 지급 요청',
        description: '미수금에 대한 입금을 요청합니다.',
        variables: ['companyName', 'balance', 'dueDate'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설입니다.
아래와 같이 미수금 입금을 요청드립니다.

■ 미수금액: #{balance}원
■ 입금요청일: #{dueDate}

입금 확인 후 연락 부탁드립니다.
문의: 02-XXX-XXXX`,
    },
    PAYMENT_RECEIVED: {
        title: '입금 확인 알림',
        description: '입금이 확인되었음을 알립니다.',
        variables: ['companyName', 'paymentDate', 'paymentAmount', 'remainingBalance'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설입니다.
입금이 확인되었습니다. 감사합니다.

■ 입금일: #{paymentDate}
■ 입금금액: #{paymentAmount}원
■ 잔여잔액: #{remainingBalance}원

감사합니다.
문의: 02-XXX-XXXX`,
    },
    MONTHLY_STATEMENT: {
        title: '월간 거래명세서',
        description: '월간 거래내역을 발송합니다.',
        variables: ['companyName', 'yearMonth', 'totalSales', 'totalPayments', 'balance'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설 #{yearMonth} 거래명세서입니다.

■ 매출합계: #{totalSales}원
■ 입금합계: #{totalPayments}원
■ 잔액: #{balance}원

자세한 내용은 첨부파일을 확인해주세요.
문의: 02-XXX-XXXX`,
    },
};

/**
 * 카카오톡 알림톡 발송
 */
export async function sendKakaoNotification(
    request: KakaoNotificationRequest
): Promise<KakaoNotificationResponse> {
    // Mock 모드
    if (MOCK_MODE) {
        console.log('🧪 [MOCK] 카카오톡 알림톡 발송 요청:', request);

        // 유효성 검사
        if (!request.recipientPhone) {
            return {
                success: false,
                message: '수신자 전화번호를 입력해주세요.',
            };
        }

        // 전화번호 형식 검사
        const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
        if (!phoneRegex.test(request.recipientPhone.replace(/-/g, ''))) {
            return {
                success: false,
                message: '올바른 전화번호 형식이 아닙니다.',
            };
        }

        // 성공 시뮬레이션 (1초 딜레이)
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            message: `✅ [테스트 모드] ${request.recipientName}님에게 알림톡이 발송되었습니다.`,
            messageId: `MOCK-${Date.now()}`,
        };
    }

    // 실제 API 호출 (Local Server)
    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/kakao/alimtalk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('알림톡 발송 오류:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
        };
    }
}

/**
 * 세금계산서 발행 알림 발송 (편의 함수)
 */
export async function sendTaxInvoiceNotification(
    recipientPhone: string,
    recipientName: string,
    companyName: string,
    invoiceDate: string,
    totalAmount: number,
    invoiceNum: string
): Promise<KakaoNotificationResponse> {
    return sendKakaoNotification({
        templateType: 'TAX_INVOICE_ISSUED',
        recipientPhone,
        recipientName,
        variables: {
            companyName,
            invoiceDate,
            totalAmount: new Intl.NumberFormat('ko-KR').format(totalAmount),
            invoiceNum,
        },
    });
}

/**
 * 입금 요청 알림 발송 (편의 함수)
 */
export async function sendPaymentRequestNotification(
    recipientPhone: string,
    recipientName: string,
    companyName: string,
    balance: number,
    dueDate: string
): Promise<KakaoNotificationResponse> {
    return sendKakaoNotification({
        templateType: 'PAYMENT_REQUEST',
        recipientPhone,
        recipientName,
        variables: {
            companyName,
            balance: new Intl.NumberFormat('ko-KR').format(balance),
            dueDate,
        },
    });
}

/**
 * 입금 확인 알림 발송 (편의 함수)
 */
export async function sendPaymentReceivedNotification(
    recipientPhone: string,
    recipientName: string,
    companyName: string,
    paymentDate: string,
    paymentAmount: number,
    remainingBalance: number
): Promise<KakaoNotificationResponse> {
    return sendKakaoNotification({
        templateType: 'PAYMENT_RECEIVED',
        recipientPhone,
        recipientName,
        variables: {
            companyName,
            paymentDate,
            paymentAmount: new Intl.NumberFormat('ko-KR').format(paymentAmount),
            remainingBalance: new Intl.NumberFormat('ko-KR').format(remainingBalance),
        },
    });
}

/**
 * 전화번호 형식 정규화 (하이픈 제거)
 */
export function normalizePhoneNumber(phone: string): string {
    return phone.replace(/-/g, '');
}

/**
 * 전화번호 형식화 (하이픈 추가)
 */
export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
}

/**
 * 친구톡 발송
 */
export async function sendFriendTalk(
    request: FriendTalkRequest
): Promise<KakaoNotificationResponse> {
    // Mock 모드
    if (MOCK_MODE) {
        console.log('🧪 [MOCK] 카카오톡 친구톡 발송 요청:', request);

        // 유효성 검사
        if (!request.recipientPhone) {
            return {
                success: false,
                message: '수신자 전화번호를 입력해주세요.',
            };
        }

        if (!request.message) {
            return {
                success: false,
                message: '메시지 내용을 입력해주세요.',
            };
        }

        // 이미지/와이드 타입일 때 이미지 URL 검사
        if ((request.type === 'IMAGE' || request.type === 'WIDE') && !request.imageUrl) {
            return {
                success: false,
                message: '이미지 URL을 입력해주세요.',
            };
        }

        // 성공 시뮬레이션 (1초 딜레이)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const typeNames = { TEXT: '텍스트', IMAGE: '이미지', WIDE: '와이드' };
        return {
            success: true,
            message: `✅ [테스트 모드] ${request.recipientName}님에게 ${typeNames[request.type]} 친구톡이 발송되었습니다.`,
            messageId: `MOCK-FT-${Date.now()}`,
        };
    }

    // 실제 API 호출 (Local Server)
    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/kakao/friendtalk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('친구톡 발송 오류:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
        };
    }
}

// 친구톡 타입 정보
export const FRIEND_TALK_TYPES: Record<FriendTalkType, {
    title: string;
    description: string;
    hasImage: boolean;
    imageSize?: string;
}> = {
    TEXT: {
        title: '텍스트 친구톡',
        description: '텍스트만 전송하는 기본 친구톡',
        hasImage: false,
    },
    IMAGE: {
        title: '이미지 친구톡',
        description: '이미지와 텍스트를 함께 전송',
        hasImage: true,
        imageSize: '720x720',
    },
    WIDE: {
        title: '와이드 친구톡',
        description: '가로형 큰 이미지로 전송 (배너형)',
        hasImage: true,
        imageSize: '800x600',
    },
};
