/**
 * 바로빌 세금계산서 API 서비스
 * 
 * Firebase Functions를 통해 바로빌 API를 호출합니다.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Firebase Functions URL (기본값: Production URL)
// 로컬 테스트 시: firebase emulators:start 후 http://localhost:5001/cyee-9c1e4/us-central1 로 설정
const FUNCTIONS_BASE_URL = process.env.REACT_APP_API_URL || 'https://asia-northeast3-cyee-9c1e4.cloudfunctions.net';

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
    invoiceeHP?: string;

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
    invoiceeCompanyId?: string;
    siteId?: string;
    siteName?: string;
}

type NtsTaxInvoiceRow = Record<string, unknown>;

type NtsTaxType = '매출' | '매입';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const safeGetArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const safeJson = async (response: Response): Promise<unknown> => {
    try {
        return await response.json();
    } catch {
        return undefined;
    }
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

const asNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const formatCallableErrorMessage = (error: unknown): string => {
    if (!isRecord(error)) {
        return error instanceof Error ? error.message : '국세청 조회 중 오류가 발생했습니다.';
    }

    const resolveDetails = (e: Record<string, unknown>): unknown => {
        if ('details' in e && e.details !== undefined) return e.details;
        const customData = isRecord(e.customData) ? e.customData : undefined;
        if (customData && 'details' in customData) return customData.details;
        if (customData && 'data' in customData) return customData.data;
        return undefined;
    };

    const code = typeof error.code === 'string' ? error.code : '';
    const message = typeof error.message === 'string' ? error.message : '국세청 조회 중 오류가 발생했습니다.';
    const details = resolveDetails(error);

    if (isRecord(details) && typeof details.code === 'number') {
        const detail = isRecord(details.detail) ? details.detail : undefined;
        const errStringRaw = detail && typeof detail.errString === 'string' ? detail.errString : '';
        const errString = errStringRaw.trim();
        return errString ? `${message} (바로빌 코드: ${details.code})\n상세: ${errString}` : `${message} (바로빌 코드: ${details.code})`;
    }

    if (typeof details === 'string' && details.trim()) {
        return `${message} (${details.trim()})`;
    }

    if (code) {
        return `${message} (${code})`;
    }

    return message;
};

export interface NtsTaxInvoicesRangeResult {
    success: boolean;
    data: Array<Record<string, unknown>>;
    meta?: Record<string, unknown>;
}

export interface NtsSendOption {
    TaxationOption: number;
    TaxationAddTaxAllowYN: number;
    TaxExemptionOption: number;
    TaxExemptionAddTaxAllowYN: number;
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

        const payload = await safeJson(response);
        if (!isRecord(payload)) {
            return { success: false, message: '서버 응답 형식이 올바르지 않습니다.' };
        }

        const success = payload.success === true;
        const message = typeof payload.message === 'string' ? payload.message : '요청 처리 중 오류가 발생했습니다.';
        const invoiceNum = asString(payload.invoiceNum) || undefined;
        const sendKey = asString(payload.sendKey) || undefined;
        const code = typeof payload.code === 'number' ? payload.code : undefined;
        return { success, message, invoiceNum, sendKey, code };
    } catch (error) {
        console.error('세금계산서 발행 오류:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
        };
    }
}

/**
 * 바로빌 설정 조회 (사업자번호 등)
 * GET /taxinvoice/setting
 */
export async function getBarobillSetting(): Promise<{
    corpNum: string;
    corpName?: string;
    ceoName?: string;
    addr?: string;
    bizType?: string;
    bizClass?: string;
    email?: string;
}> {
    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/getBarobillSettingApi`);
        const payload = await safeJson(response);
        if (!isRecord(payload) || !isRecord(payload.data)) {
            return { corpNum: '' };
        }

        const data = payload.data as Record<string, unknown>;
        return {
            corpNum: asString(data.corpNum),
            corpName: asString(data.corpName),
            ceoName: asString(data.ceoName),
            addr: asString(data.addr),
            bizType: asString(data.bizType),
            bizClass: asString(data.bizClass),
            email: asString(data.email)
        };
    } catch (error) {
        console.error('설정 조회 오류:', error);
        return { corpNum: '' };
    }
}

export async function fetchNtsTaxInvoicesDaily(
    baseDate: string,
    type: NtsTaxType = '매출',
    options?: { taxInvoiceType?: number; dateType?: number }
): Promise<NtsTaxInvoicesRangeResult> {
    const taxType = type === '매출' ? 1 : 2;
    try {
        const callable = httpsCallable(functions, 'fetchNtsTaxInvoicesDaily');
        const res = await callable({
            baseDate,
            taxType,
            ...(typeof options?.taxInvoiceType === 'number' ? { taxInvoiceType: options.taxInvoiceType } : {}),
            ...(typeof options?.dateType === 'number' ? { dateType: options.dateType } : {})
        });
        const payload = res.data;
        if (!isRecord(payload)) {
            throw new Error('국세청 일별 조회 응답 형식이 올바르지 않습니다.');
        }
        const success = payload.success === true;
        const data = safeGetArray(payload.data).filter(isRecord).map((row) => row);
        const meta = isRecord(payload.meta) ? payload.meta : undefined;
        if (!success) {
            throw new Error('국세청 일별 내역 조회가 실패했습니다.');
        }
        return { success: true, data, meta };
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('국세청 일별 조회 오류:', error);
        throw new Error(msg);
    }
}

export async function fetchNtsTaxInvoicesMonthly(
    baseMonth: string,
    type: NtsTaxType = '매출',
    options?: { taxInvoiceType?: number; dateType?: number; orderDirection?: number }
): Promise<NtsTaxInvoicesRangeResult> {
    const taxType = type === '매출' ? 1 : 2;
    try {
        const callable = httpsCallable(functions, 'fetchNtsTaxInvoicesMonthly');
        const res = await callable({
            baseMonth,
            taxType,
            ...(typeof options?.taxInvoiceType === 'number' ? { taxInvoiceType: options.taxInvoiceType } : {}),
            ...(typeof options?.dateType === 'number' ? { dateType: options.dateType } : {}),
            ...(typeof options?.orderDirection === 'number' ? { orderDirection: options.orderDirection } : {})
        });
        const payload = res.data;
        if (!isRecord(payload)) {
            throw new Error('국세청 월별 조회 응답 형식이 올바르지 않습니다.');
        }
        const success = payload.success === true;
        const data = safeGetArray(payload.data).filter(isRecord).map((row) => row);
        const meta = isRecord(payload.meta) ? payload.meta : undefined;
        if (!success) {
            throw new Error('국세청 월별 내역 조회가 실패했습니다.');
        }
        return { success: true, data, meta };
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('국세청 월별 조회 오류:', error);
        throw new Error(msg);
    }
}

export async function getNtsSendOption(): Promise<NtsSendOption> {
    try {
        const callable = httpsCallable(functions, 'getNtsSendOptionCallable');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; option?: unknown }>(res.data, '국세청 전송 옵션');
        const opt = payload.option;
        if (!payload.success || !isRecord(opt)) {
            throw new Error('국세청 전송 옵션 조회가 실패했습니다.');
        }
        const toNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
        return {
            TaxationOption: toNum(opt.TaxationOption),
            TaxationAddTaxAllowYN: toNum(opt.TaxationAddTaxAllowYN),
            TaxExemptionOption: toNum(opt.TaxExemptionOption),
            TaxExemptionAddTaxAllowYN: toNum(opt.TaxExemptionAddTaxAllowYN)
        };
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('국세청 전송 옵션 조회 오류:', error);
        throw new Error(msg);
    }
}

export async function changeNtsSendOption(option: NtsSendOption): Promise<number> {
    try {
        const callable = httpsCallable(functions, 'changeNtsSendOptionCallable');
        const res = await callable({ option });
        const payload = getCallablePayload<{ success: boolean; result?: unknown }>(res.data, '국세청 전송 옵션 변경');
        const n = typeof payload.result === 'number' ? payload.result : Number(payload.result);
        if (!payload.success || !Number.isFinite(n)) {
            throw new Error('국세청 전송 옵션 변경이 실패했습니다.');
        }
        return n;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('국세청 전송 옵션 변경 오류:', error);
        throw new Error(msg);
    }
}

export async function stopHometaxScrap(): Promise<number> {
    try {
        const callable = httpsCallable(functions, 'stopTaxInvoiceScrapCallable');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; result?: unknown }>(res.data, '스크래핑 중지');
        const n = typeof payload.result === 'number' ? payload.result : Number(payload.result);
        if (!payload.success || !Number.isFinite(n)) {
            throw new Error('스크래핑 중지 요청이 실패했습니다.');
        }
        return n;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('스크래핑 중지 요청 오류:', error);
        throw new Error(msg);
    }
}

export async function cancelStopHometaxScrap(): Promise<number> {
    try {
        const callable = httpsCallable(functions, 'cancelStopTaxInvoiceScrapCallable');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; result?: unknown }>(res.data, '스크래핑 중지 해제');
        const n = typeof payload.result === 'number' ? payload.result : Number(payload.result);
        if (!payload.success || !Number.isFinite(n)) {
            throw new Error('스크래핑 중지 해제 요청이 실패했습니다.');
        }
        return n;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('스크래핑 중지 해제 요청 오류:', error);
        throw new Error(msg);
    }
}

const getCallablePayload = <T>(value: unknown, label: string): T => {
    if (!isRecord(value)) {
        throw new Error(`${label} 응답 형식이 올바르지 않습니다.`);
    }
    return value as T;
};

export async function getHometaxScrapRequestUrl(): Promise<string> {
    try {
        const callable = httpsCallable(functions, 'getHometaxScrapRequestUrl');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; url?: unknown }>(res.data, '홈택스 연동 신청 URL');
        const url = typeof payload.url === 'string' ? payload.url : '';
        if (!payload.success || !url) {
            throw new Error('홈택스 연동 신청 URL 조회가 실패했습니다.');
        }
        return url;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('홈택스 연동 신청 URL 조회 오류:', error);
        throw new Error(msg);
    }
}

export async function getHometaxCertificateRegistUrl(): Promise<string> {
    try {
        const callable = httpsCallable(functions, 'getHometaxCertificateRegistUrl');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; url?: unknown }>(res.data, '인증서 등록 URL');
        const url = typeof payload.url === 'string' ? payload.url : '';
        if (!payload.success || !url) {
            throw new Error('인증서 등록 URL 조회가 실패했습니다.');
        }
        return url;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('인증서 등록 URL 조회 오류:', error);
        throw new Error(msg);
    }
}

export async function checkHometaxCertIsValid(): Promise<number> {
    try {
        const callable = httpsCallable(functions, 'checkHometaxCertIsValid');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; result?: unknown }>(res.data, '인증서 상태');
        const n = typeof payload.result === 'number' ? payload.result : Number(payload.result);
        if (!payload.success || !Number.isFinite(n)) {
            throw new Error('인증서 상태 확인이 실패했습니다.');
        }
        return n;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('인증서 상태 확인 오류:', error);
        throw new Error(msg);
    }
}

export async function refreshHometaxScrap(): Promise<number> {
    try {
        const callable = httpsCallable(functions, 'refreshHometaxScrap');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; result?: unknown }>(res.data, '홈택스 즉시조회');
        const n = typeof payload.result === 'number' ? payload.result : Number(payload.result);
        if (!payload.success || !Number.isFinite(n)) {
            throw new Error('홈택스 즉시조회 요청이 실패했습니다.');
        }
        return n;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('홈택스 즉시조회 요청 오류:', error);
        throw new Error(msg);
    }
}

export async function reRegistHometaxScrap(): Promise<number> {
    try {
        const callable = httpsCallable(functions, 'reRegistHometaxScrap');
        const res = await callable({});
        const payload = getCallablePayload<{ success: boolean; result?: unknown }>(res.data, '홈택스 재신청');
        const n = typeof payload.result === 'number' ? payload.result : Number(payload.result);
        if (!payload.success || !Number.isFinite(n)) {
            throw new Error('홈택스 재신청 요청이 실패했습니다.');
        }
        return n;
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('홈택스 재신청 요청 오류:', error);
        throw new Error(msg);
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

        const payload = await safeJson(response);
        if (!isRecord(payload)) {
            return { success: false, message: '서버 응답 형식이 올바르지 않습니다.' };
        }

        const success = payload.success === true;
        const message = typeof payload.message === 'string' ? payload.message : '상태 조회 중 오류가 발생했습니다.';
        const code = typeof payload.code === 'number' ? payload.code : undefined;
        return { success, message, invoiceNum, code };
    } catch (error) {
        console.error('상태 조회 오류:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
        };
    }
}

/**
 * 국세청(홈택스) 일별 세금계산서 조회 (스크래핑)
 */
export async function fetchNtsTaxInvoices(date: string, type: '매출' | '매입' = '매출'): Promise<NtsTaxInvoiceRow[]> {
    const range = await fetchNtsTaxInvoicesRange(date, date, type);
    return range.data;
}

export async function fetchNtsTaxInvoicesRange(
    startDate: string,
    endDate: string,
    type: NtsTaxType = '매출',
    options?: { taxInvoiceType?: number; dateType?: number }
): Promise<NtsTaxInvoicesRangeResult> {
    const taxType = type === '매출' ? 1 : 2;
    try {
        const callable = httpsCallable(functions, 'fetchNtsTaxInvoicesRange');
        const res = await callable({
            startDate,
            endDate,
            taxType,
            ...(typeof options?.taxInvoiceType === 'number' ? { taxInvoiceType: options.taxInvoiceType } : {}),
            ...(typeof options?.dateType === 'number' ? { dateType: options.dateType } : {})
        });
        const payload = res.data;

        if (!isRecord(payload)) {
            throw new Error('국세청 조회 응답 형식이 올바르지 않습니다.');
        }

        const success = payload.success === true;
        const data = safeGetArray(payload.data)
            .filter(isRecord)
            .map((row) => row);

        const meta = isRecord(payload.meta) ? payload.meta : undefined;
        if (!success) {
            throw new Error('국세청 내역 조회가 실패했습니다.');
        }
        return { success: true, data, meta };
    } catch (error) {
        const msg = formatCallableErrorMessage(error);
        console.error('국세청 조회 오류:', error);
        throw new Error(msg);
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

        const payload = await safeJson(response);
        if (!isRecord(payload)) return [];

        const invoicesRaw = payload.invoices;
        const invoices = safeGetArray(invoicesRaw)
            .filter(isRecord)
            .map((row) => {
                const id = asString(row.id);
                const invoicerCorpName = asString(row.invoicerCorpName);
                const invoiceeCorpName = asString(row.invoiceeCorpName);
                const totalAmount = asNumber(row.totalAmount);
                const status = asString(row.status);
                const issuedAtRaw = row.issuedAt;
                const issuedAt = isRecord(issuedAtRaw)
                    ? {
                        seconds: asNumber(issuedAtRaw.seconds),
                        nanoseconds: asNumber(issuedAtRaw.nanoseconds)
                    }
                    : { seconds: 0, nanoseconds: 0 };
                const invoiceNumParsed = asString(row.invoiceNum) || undefined;

                return {
                    id,
                    invoicerCorpName,
                    invoiceeCorpName,
                    totalAmount,
                    status,
                    issuedAt,
                    invoiceNum: invoiceNumParsed
                };
            })
            .filter((row) => row.id);

        return invoices;
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
