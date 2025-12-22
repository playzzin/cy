/**
 * 바로빌 세금계산서 발행 서비스
 * 
 * SOAP 방식으로 바로빌 API와 통신합니다.
 */

import * as soap from 'soap';
import { getWsdlUrl, getBarobillAuth } from '../config/barobill';

// 세금계산서 데이터 인터페이스
export interface TaxInvoiceData {
    // 공급자 정보
    invoicerCorpNum: string;       // 공급자 사업자번호 (10자리)
    invoicerCorpName: string;      // 공급자 상호
    invoicerCEOName: string;       // 공급자 대표자명
    invoicerAddr?: string;         // 공급자 주소
    invoicerBizType?: string;      // 업태
    invoicerBizClass?: string;     // 종목
    invoicerEmail?: string;        // 공급자 이메일

    // 공급받는자 정보
    invoiceeCorpNum: string;       // 공급받는자 사업자번호 (10자리)
    invoiceeCorpName: string;      // 공급받는자 상호
    invoiceeCEOName: string;       // 공급받는자 대표자명
    invoiceeAddr?: string;         // 공급받는자 주소
    invoiceeBizType?: string;      // 업태
    invoiceeBizClass?: string;     // 종목
    invoiceeEmail?: string;        // 공급받는자 이메일

    // 세금계산서 정보
    writeDate: string;             // 작성일자 (YYYYMMDD)
    supplyCostTotal: number;       // 공급가액 합계
    taxTotal: number;              // 세액 합계
    totalAmount: number;           // 합계금액

    // 품목 정보
    items: TaxInvoiceItem[];

    // 기타
    remark?: string;               // 비고
    purposeType?: '영수' | '청구';  // 영수/청구 구분
}

export interface TaxInvoiceItem {
    serialNum: number;             // 일련번호
    purchaseDT?: string;           // 거래일자 (YYYYMMDD)
    itemName: string;              // 품명
    spec?: string;                 // 규격
    qty: number;                   // 수량
    unitCost: number;              // 단가
    supplyCost: number;            // 공급가액
    tax: number;                   // 세액
    remark?: string;               // 비고
}

// 바로빌 API 응답 인터페이스
export interface BarobillResponse {
    code: number;
    message: string;
    invoiceNum?: string;  // 발행된 세금계산서 번호
}

/**
 * 세금계산서 즉시 발행
 */
export async function issueTaxInvoice(data: TaxInvoiceData): Promise<BarobillResponse> {
    const auth = getBarobillAuth();
    const wsdlUrl = getWsdlUrl('tax');

    return new Promise((resolve, reject) => {
        soap.createClient(wsdlUrl, (err, client) => {
            if (err) {
                reject({ code: -1, message: `SOAP 클라이언트 생성 실패: ${err.message}` });
                return;
            }

            // 바로빌 API 요청 데이터 구성
            const requestData = {
                CERTKEY: auth.certKey,
                CorpNum: auth.corpNum,
                ID: auth.id,
                PWD: auth.pwd,

                // 공급자 정보
                InvoicerCorpNum: data.invoicerCorpNum,
                InvoicerTaxRegID: '',
                InvoicerCorpName: data.invoicerCorpName,
                InvoicerCEOName: data.invoicerCEOName,
                InvoicerAddr: data.invoicerAddr || '',
                InvoicerBizType: data.invoicerBizType || '',
                InvoicerBizClass: data.invoicerBizClass || '',
                InvoicerContactName: '',
                InvoicerTEL: '',
                InvoicerHP: '',
                InvoicerEmail: data.invoicerEmail || '',

                // 공급받는자 정보
                InvoiceeCorpNum: data.invoiceeCorpNum,
                InvoiceeTaxRegID: '',
                InvoiceeCorpName: data.invoiceeCorpName,
                InvoiceeCEOName: data.invoiceeCEOName,
                InvoiceeAddr: data.invoiceeAddr || '',
                InvoiceeBizType: data.invoiceeBizType || '',
                InvoiceeBizClass: data.invoiceeBizClass || '',
                InvoiceeContactName: '',
                InvoiceeTEL: '',
                InvoiceeHP: '',
                InvoiceeEmail: data.invoiceeEmail || '',

                // 세금계산서 기본 정보
                WriteDate: data.writeDate,
                TaxType: 1,  // 과세
                IssueType: 1, // 정발행
                SupplyCostTotal: data.supplyCostTotal.toString(),
                TaxTotal: data.taxTotal.toString(),
                TotalAmount: data.totalAmount.toString(),
                PurposeType: data.purposeType === '청구' ? 2 : 1,

                // 비고
                Remark1: data.remark || '',

                // 품목 정보 (최대 99개)
                ...buildItemsData(data.items),
            };

            // RegistAndIssueTaxInvoice 메서드 호출 (등록 + 즉시발행)
            client.RegistAndIssueTaxInvoice(requestData, (err: Error | null, result: unknown) => {
                if (err) {
                    reject({ code: -2, message: `API 호출 실패: ${err.message}` });
                    return;
                }

                const response = parseBarobillResponse(result);
                resolve(response);
            });
        });
    });
}

/**
 * 품목 데이터를 바로빌 형식으로 변환
 */
function buildItemsData(items: TaxInvoiceItem[]): Record<string, string> {
    const result: Record<string, string> = {};

    items.forEach((item, index) => {
        const num = index + 1;
        result[`ItemSeq${num}`] = item.serialNum.toString();
        result[`ItemPurchaseDT${num}`] = item.purchaseDT || '';
        result[`ItemName${num}`] = item.itemName;
        result[`ItemSpec${num}`] = item.spec || '';
        result[`ItemQty${num}`] = item.qty.toString();
        result[`ItemUnitCost${num}`] = item.unitCost.toString();
        result[`ItemSupplyCost${num}`] = item.supplyCost.toString();
        result[`ItemTax${num}`] = item.tax.toString();
        result[`ItemRemark${num}`] = item.remark || '';
    });

    return result;
}

/**
 * 바로빌 응답 파싱
 */
function parseBarobillResponse(result: unknown): BarobillResponse {
    // 바로빌 응답 구조에 따라 파싱
    const response = result as { RegistAndIssueTaxInvoiceResult?: number };
    const code = response.RegistAndIssueTaxInvoiceResult || -999;

    if (code > 0) {
        return {
            code: 0,
            message: '세금계산서가 성공적으로 발행되었습니다.',
            invoiceNum: code.toString(),
        };
    }

    // 에러 코드에 따른 메시지
    const errorMessages: Record<number, string> = {
        [-1]: '인증 실패',
        [-2]: '필수 항목 누락',
        [-3]: '잘못된 사업자번호',
        [-4]: '중복된 문서번호',
        [-99]: '시스템 오류',
    };

    return {
        code,
        message: errorMessages[code] || `오류 발생 (코드: ${code})`,
    };
}

/**
 * 세금계산서 상태 조회
 */
export async function getTaxInvoiceStatus(invoiceNum: string): Promise<BarobillResponse> {
    const auth = getBarobillAuth();
    const wsdlUrl = getWsdlUrl('tax');

    return new Promise((resolve, reject) => {
        soap.createClient(wsdlUrl, (err, client) => {
            if (err) {
                reject({ code: -1, message: `SOAP 클라이언트 생성 실패: ${err.message}` });
                return;
            }

            const requestData = {
                CERTKEY: auth.certKey,
                CorpNum: auth.corpNum,
                ID: auth.id,
                PWD: auth.pwd,
                InvoiceNum: invoiceNum,
            };

            client.GetTaxInvoiceStateEX(requestData, (err: Error | null, result: unknown) => {
                if (err) {
                    reject({ code: -2, message: `조회 실패: ${err.message}` });
                    return;
                }

                resolve({
                    code: 0,
                    message: '조회 성공',
                    invoiceNum,
                });
            });
        });
    });
}
