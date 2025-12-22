"use strict";
/**
 * 바로빌 세금계산서 발행 서비스
 *
 * SOAP 방식으로 바로빌 API와 통신합니다.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueTaxInvoice = issueTaxInvoice;
exports.getTaxInvoiceStatus = getTaxInvoiceStatus;
const soap = __importStar(require("soap"));
const barobill_1 = require("../config/barobill");
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
                InvoiceeHP: '',
                InvoiceeEmail: data.invoiceeEmail || '',
                // 세금계산서 기본 정보
                WriteDate: data.writeDate,
                TaxType: 1, // 과세
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
            client.RegistAndIssueTaxInvoice(requestData, (err, result) => {
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
//# sourceMappingURL=taxInvoiceService.js.map