/**
 * 바로빌 세금계산서 API 서비스
 * 
 * Firebase Functions를 통해 바로빌 API를 호출합니다.
 */

// Firebase Functions URL (기본값: Production URL)
// 로컬 테스트 시: firebase emulators:start 후 http://localhost:5001/cyee-9c1e4/us-central1 로 설정
const FUNCTIONS_BASE_URL = process.env.REACT_APP_API_URL || 'https://us-central1-cyee-9c1e4.cloudfunctions.net';

export interface TaxInvoiceRequest {
    // 공급자 정보
    invoicerCorpNum: string;
    invoicerCorpName: string;
    invoicerCEOName: string;
    invoicerAddr?: string;
    invoicerBizType?: string;
    invoicerBizClass?: string;
    invoicerEmail?: string;

    // 공급받는자 정보
    invoiceeCorpNum: string;
    invoiceeCorpName: string;
    invoiceeCEOName: string;
    invoiceeAddr?: string;
    invoiceeBizType?: string;
    invoiceeBizClass?: string;
    invoiceeEmail?: string;

    // 세금계산서 정보
    writeDate: string;
    supplyCostTotal: number;
    taxTotal: number;
    totalAmount: number;

    // 품목 정보
    items: TaxInvoiceItem[];

    // 기타
    remark?: string;
    purposeType?: '영수' | '청구';
}

export interface TaxInvoiceItem {
    serialNum: number;
    purchaseDT?: string;
    itemName: string;
    spec?: string;
    qty: number;
    unitCost: number;
    supplyCost: number;
    tax: number;
    remark?: string;
}

export interface TaxInvoiceResponse {
    success: boolean;
    message: string;
    invoiceNum?: string;
    sendKey?: string;
    code?: number;
}

export interface TaxInvoiceListItem {
    id: string;
    invoicerCorpName: string;
    invoiceeCorpName: string;
    totalAmount: number;
    status: string;
    issuedAt: { seconds: number; nanoseconds: number };
    invoiceNum?: string;
}

// Mock 모드 (백엔드 없이 테스트용)
// Mock 모드 (백엔드 없이 테스트용)
const MOCK_MODE = false;

/**
 * 세금계산서 발행
 */
export async function issueTaxInvoice(data: TaxInvoiceRequest): Promise<TaxInvoiceResponse> {
    // Mock 모드: 백엔드 없이 테스트
    if (MOCK_MODE) {
        console.log('🧪 [MOCK] 세금계산서 발행 요청:', data);

        // 유효성 검사 시뮬레이션
        if (!data.invoicerCorpNum || !data.invoiceeCorpNum) {
            return {
                success: false,
                message: '사업자번호를 입력해주세요.',
            };
        }

        // 성공 시뮬레이션 (1초 딜레이)
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            message: '✅ [테스트 모드] 세금계산서 발행이 성공적으로 시뮬레이션되었습니다.',
            invoiceNum: `TEST-${Date.now()}`,
        };
    }

    // 실제 API 호출
    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/issueTaxInvoiceApi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('세금계산서 발행 오류:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
        };
    }
}

/**
 * 세금계산서 상태 조회
 */
export async function getTaxInvoiceStatus(invoiceNum: string): Promise<TaxInvoiceResponse> {
    try {
        const response = await fetch(
            `${FUNCTIONS_BASE_URL}/getTaxInvoiceStatusApi?invoiceNum=${invoiceNum}`
        );

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('상태 조회 오류:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
        };
    }
}

/**
 * 세금계산서 발행 이력 조회
 */
export async function getTaxInvoiceList(limit = 50): Promise<TaxInvoiceListItem[]> {
    // Mock 모드
    if (MOCK_MODE) {
        console.log('🧪 [MOCK] 세금계산서 이력 조회');
        return [
            {
                id: 'mock-1',
                invoicerCorpName: '청연건설',
                invoiceeCorpName: '테스트 협력사',
                totalAmount: 11000000,
                status: 'issued',
                issuedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                invoiceNum: 'TEST-12345',
            },
        ];
    }

    try {
        const response = await fetch(
            `${FUNCTIONS_BASE_URL}/getTaxInvoiceListApi?limit=${limit}`
        );

        const result = await response.json();
        return result.invoices || [];
    } catch (error) {
        console.error('이력 조회 오류:', error);
        return [];
    }
}

/**
 * 공급가액으로부터 세액 계산 (10%)
 */
export function calculateTax(supplyCost: number): number {
    return Math.floor(supplyCost * 0.1);
}

/**
 * 날짜를 YYYYMMDD 형식으로 변환
 */
export function formatDateForTaxInvoice(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
