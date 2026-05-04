"use strict";
/**
 * 바로빌 세금계산서 발행 서비스
 *
 * SOAP 방식으로 바로빌 API와 통신합니다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaxInvoiceStatus = exports.issueTaxInvoice = void 0;
const soap = require("soap");
const barobill_1 = require("../config/barobill");
const barobillKakaoService_1 = require("./barobillKakaoService");
/**
 * 세금계산서 즉시 발행
 */
async function issueTaxInvoice(data) {
    const auth = (0, barobill_1.getBarobillAuth)();
    const wsdlUrl = (0, barobill_1.getWsdlUrl)('tax');
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
                InvoiceeHP: data.invoiceeHP || '',
                InvoiceeEmail: data.invoiceeEmail || '',
                // 세금계산서 기본 정보
                WriteDate: data.writeDate,
                TaxType: 1,
                IssueType: 1,
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
            client.RegistAndIssueTaxInvoice(requestData, async (err, result) => {
                if (err) {
                    reject({ code: -2, message: `API 호출 실패: ${err.message}` });
                    return;
                }
                const response = parseBarobillResponse(result);
                // 성공 시 카카오톡 알림 발송
                if (response.code === 0 && response.invoiceNum && data.invoiceeHP) {
                    try {
                        // 날짜 포맷 (YYYYMMDD -> YYYY-MM-DD)
                        const formattedDate = data.writeDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                        // 금액 포맷 (천단위 콤마)
                        const formattedAmount = data.totalAmount.toLocaleString('ko-KR');
                        await (0, barobillKakaoService_1.sendAlimtalk)({
                            to: data.invoiceeHP,
                            templateId: 'TAX_INVOICE_ISSUED',
                            variables: {
                                companyName: data.invoicerCorpName,
                                invoiceDate: formattedDate,
                                totalAmount: formattedAmount + '원',
                                invoiceNum: response.invoiceNum
                            }
                        });
                    }
                    catch (notifyError) {
                        // 알림 발송 실패가 세금계산서 발행 성공 여부에 영향을 주지 않도록 로깅만 함
                        console.error('Failed to send Kakao notification for tax invoice:', notifyError);
                    }
                }
                resolve(response);
            });
        });
    });
}
exports.issueTaxInvoice = issueTaxInvoice;
/**
 * 품목 데이터를 바로빌 형식으로 변환
 */
function buildItemsData(items) {
    const result = {};
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
function parseBarobillResponse(result) {
    // 바로빌 응답 구조에 따라 파싱
    const response = result;
    const code = response.RegistAndIssueTaxInvoiceResult || -999;
    if (code > 0) {
        return {
            code: 0,
            message: '세금계산서가 성공적으로 발행되었습니다.',
            invoiceNum: code.toString(),
        };
    }
    // 에러 코드에 따른 메시지
    const errorMessages = {
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
async function getTaxInvoiceStatus(invoiceNum) {
    const auth = (0, barobill_1.getBarobillAuth)();
    const wsdlUrl = (0, barobill_1.getWsdlUrl)('tax');
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
            client.GetTaxInvoiceStateEX(requestData, (err, result) => {
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
exports.getTaxInvoiceStatus = getTaxInvoiceStatus;
//# sourceMappingURL=taxInvoiceService.js.map