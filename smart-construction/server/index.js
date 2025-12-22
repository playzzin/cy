/**
 * 바로빌 API 연동 로컬 서버
 * 
 * Firebase Functions 배포 없이 로컬에서 바로빌 API 테스트 가능
 * 
 * 실행 방법:
 * 1. cd server
 * 2. npm install
 * 3. node index.js
 * 
 * 테스트 환경 사용 시 국세청에 실제 전송되지 않습니다.
 */

const express = require('express');
const cors = require('cors');
const soap = require('soap');

const app = express();
const PORT = 4000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 바로빌 설정
const BAROBILL_CONFIG = {
    // 테스트 환경 (실제 운영 시 변경)
    wsdlUrl: 'https://testws.baroservice.com/Tax.asmx?WSDL', // 테스트용 WSDL
    // wsdlUrl: 'https://ws.barobill.co.kr/Tax.asmx?WSDL', // 실 운영 WSDL
    certKey: process.env.BAROBILL_CERT_KEY || 'TEST_CERT_KEY',
    corpNum: process.env.BAROBILL_CORP_NUM || '1234567890',
    userId: process.env.BAROBILL_USER_ID || 'testuser',
    senderPhone: process.env.BAROBILL_SENDER_PHONE || '010-0000-0000', // 발신 번호 (사전 등록 필수)
};

// SOAP 클라이언트 캐시
let soapClient = null;

/**
 * SOAP 클라이언트 가져오기
 */
async function getSoapClient() {
    if (soapClient) return soapClient;

    return new Promise((resolve, reject) => {
        soap.createClient(BAROBILL_CONFIG.wsdlUrl, (err, client) => {
            if (err) {
                console.error('SOAP 클라이언트 생성 실패:', err.message);
                reject(err);
            } else {
                soapClient = client;
                console.log('✅ 바로빌 SOAP 클라이언트 연결 완료');
                resolve(client);
            }
        });
    });
}

// 상태 확인 API
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: '바로빌 연동 서버 정상 동작 중',
        config: {
            wsdlUrl: BAROBILL_CONFIG.wsdlUrl,
            corpNum: BAROBILL_CONFIG.corpNum,
        }
    });
});

/**
 * 세금계산서 발행 API
 * POST /api/tax-invoice/issue
 */
app.post('/api/tax-invoice/issue', async (req, res) => {
    try {
        const {
            invoicerCorpNum,
            invoicerCorpName,
            invoicerCEOName,
            invoicerAddr,
            invoicerBizType,
            invoicerBizClass,
            invoicerEmail,
            invoiceeCorpNum,
            invoiceeCorpName,
            invoiceeCEOName,
            invoiceeAddr,
            invoiceeBizType,
            invoiceeBizClass,
            invoiceeEmail,
            writeDate,
            supplyCostTotal,
            taxTotal,
            totalAmount,
            items,
            remark,
            purposeType
        } = req.body;

        console.log('📄 세금계산서 발행 요청:', {
            invoicerCorpNum,
            invoiceeCorpNum,
            totalAmount,
            itemCount: items?.length || 0
        });

        // 테스트 모드에서는 Mock 응답
        if (BAROBILL_CONFIG.certKey === 'TEST_CERT_KEY') {
            console.log('🧪 테스트 모드 - Mock 응답 반환');

            const mockInvoiceNum = `TEST-${Date.now()}`;
            const mockSendKey = `SEND-${Date.now()}`;

            return res.json({
                success: true,
                message: `✅ [테스트 모드] 세금계산서 발행 완료 (${mockInvoiceNum})`,
                invoiceNum: mockInvoiceNum,
                sendKey: mockSendKey
            });
        }

        // 실제 바로빌 API 호출
        const client = await getSoapClient();

        // 바로빌 RegistAndIssueTaxInvoice 호출
        const params = {
            CERTKEY: BAROBILL_CONFIG.certKey,
            CorpNum: BAROBILL_CONFIG.corpNum,
            UserID: BAROBILL_CONFIG.userId,
            InvoicerCorpNum: invoicerCorpNum,
            InvoicerMgtKey: `INV-${Date.now()}`,
            InvoicerCorpName: invoicerCorpName,
            InvoicerCEOName: invoicerCEOName,
            InvoicerAddr: invoicerAddr,
            InvoicerBizType: invoicerBizType || '',
            InvoicerBizClass: invoicerBizClass || '',
            InvoicerContactEmail: invoicerEmail || '',
            InvoiceeCorpNum: invoiceeCorpNum,
            InvoiceeCorpName: invoiceeCorpName,
            InvoiceeCEOName: invoiceeCEOName,
            InvoiceeAddr: invoiceeAddr,
            InvoiceeBizType: invoiceeBizType || '',
            InvoiceeBizClass: invoiceeBizClass || '',
            InvoiceeEmail: invoiceeEmail || '',
            InvoiceType: 1, // 1: 일반
            WriteDate: writeDate,
            TaxType: 1, // 1: 과세
            PurposeType: purposeType === '청구' ? 2 : 1,
            SupplyCostTotal: supplyCostTotal,
            TaxTotal: taxTotal,
            TotalAmount: totalAmount,
            Remark1: remark || '',
            // 품목 정보 (최대 99개)
            TaxInvoiceTradeLineItems: {
                TaxInvoiceTradeLineItem: items.map((item, index) => ({
                    ItemSeq: index + 1,
                    ItemName: item.itemName,
                    ItemInfo: item.spec || '',
                    ItemQty: item.qty || 1,
                    ItemUnitCost: item.unitCost || 0,
                    ItemSupplyCost: item.supplyCost,
                    ItemTax: item.tax
                }))
            }
        };

        client.RegistAndIssueTaxInvoice(params, (err, result) => {
            if (err) {
                console.error('❌ 바로빌 API 오류:', err.message);
                return res.status(500).json({
                    success: false,
                    message: `바로빌 API 오류: ${err.message}`
                });
            }

            const returnValue = result?.RegistAndIssueTaxInvoiceResult;

            if (returnValue && returnValue > 0) {
                console.log('✅ 세금계산서 발행 성공:', returnValue);
                return res.json({
                    success: true,
                    message: '세금계산서가 발행되었습니다.',
                    sendKey: returnValue.toString(),
                    invoiceNum: params.InvoicerMgtKey
                });
            } else {
                console.error('❌ 발행 실패:', returnValue);
                return res.status(400).json({
                    success: false,
                    message: getBarobillErrorMessage(returnValue)
                });
            }
        });

    } catch (error) {
        console.error('❌ 서버 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message || '서버 오류가 발생했습니다.'
        });
    }
});

/**
 * 세금계산서 발행 이력 조회 API
 * GET /api/tax-invoice/list
 */
app.get('/api/tax-invoice/list', async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        console.log(`📋 세금계산서 이력 조회 (Limit: ${limit})`);

        // 테스트 데이터 반환
        return res.json({
            success: true,
            invoices: [
                {
                    id: 'mock-1',
                    invoicerCorpName: '청연건설',
                    invoiceeCorpName: '테스트 협력사',
                    totalAmount: 11000000,
                    status: 'issued',
                    issuedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                    invoiceNum: 'TEST-12345',
                },
                {
                    id: 'mock-2',
                    invoicerCorpName: '청연건설',
                    invoiceeCorpName: '테스트 건설사',
                    totalAmount: 5500000,
                    status: 'issued',
                    issuedAt: { seconds: Math.floor(Date.now() / 1000) - 86400, nanoseconds: 0 },
                    invoiceNum: 'TEST-67890',
                }
            ]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 세금계산서 상태 조회 API
 * GET /api/tax-invoice/status/:sendKey
 */
app.get('/api/tax-invoice/status/:sendKey', async (req, res) => {
    try {
        const { sendKey } = req.params;

        console.log('📋 세금계산서 상태 조회:', sendKey);

        // 테스트 모드
        if (BAROBILL_CONFIG.certKey === 'TEST_CERT_KEY') {
            return res.json({
                success: true,
                status: 'issued',
                ntsResult: 'success',
                message: '[테스트 모드] 발행 완료'
            });
        }

        const client = await getSoapClient();

        // GetTaxInvoiceState 호출
        client.GetTaxInvoiceState({
            CERTKEY: BAROBILL_CONFIG.certKey,
            CorpNum: BAROBILL_CONFIG.corpNum,
            MgtKey: sendKey,
            MgtKeyType: 1
        }, (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            res.json({
                success: true,
                status: result?.GetTaxInvoiceStateResult || 'unknown'
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 카카오톡 알림톡 발송 API
 * POST /api/kakao/alimtalk
 */
app.post('/api/kakao/alimtalk', async (req, res) => {
    try {
        const { templateType, recipientPhone, recipientName, variables } = req.body;

        console.log('📱 알림톡 발송 요청:', { templateType, recipientPhone, recipientName });

        // 실제 운영 모드: 바로빌 API 호출
        const client = await getSoapClient();

        // 알림톡 템플릿 코드 매핑 (고객사 사전 등록 필요)
        const templateCodes = {
            'TAX_INVOICE_ISSUED': 'TAX_ISSUE_01',
            'PAYMENT_REQUEST': 'PAY_REQ_01',
            'PAYMENT_RECEIVED': 'PAY_RECV_01',
            'MONTHLY_STATEMENT': 'STMT_01'
        };

        const params = {
            CERTKEY: BAROBILL_CONFIG.certKey,
            CorpNum: BAROBILL_CONFIG.corpNum,
            SenderID: BAROBILL_CONFIG.userId,
            ToCorpNum: '', // 선택 사항
            ToName: recipientName,
            ToHP: recipientPhone.replace(/-/g, ''),
            SenderHP: BAROBILL_CONFIG.senderPhone,
            TemplateCode: templateCodes[templateType] || 'DEFAULT',
            Content: variables.content || '알림톡 내용', // 템플릿과 일치해야 함
            KButtonList: '' // 필요한 경우 버튼 JSON 문자열
        };

        // SendATKakaotalkEx 호출 (알림톡)
        client.SendATKakaotalkEx(params, (err, result) => {
            if (err) {
                console.error('❌ 알림톡 발송 실패 (SOAP Error):', err.message);
                return res.status(500).json({ success: false, message: err.message });
            }

            const returnValue = result?.SendATKakaotalkExResult;
            // 양수면 접수 번호(성공), 음수면 에러 코드
            if (returnValue && parseInt(returnValue) > 0) {
                console.log('✅ 알림톡 접수 성공:', returnValue);
                return res.json({
                    success: true,
                    message: '알림톡이 발송되었습니다.',
                    messageId: returnValue.toString()
                });
            } else {
                console.error('❌ 알림톡 발송 실패:', returnValue);
                return res.status(400).json({
                    success: false,
                    message: getBarobillErrorMessage(returnValue)
                });
            }
        });

    } catch (error) {
        console.error('SERVER ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 카카오톡 친구톡 발송 API
 * POST /api/kakao/friendtalk
 */
app.post('/api/kakao/friendtalk', async (req, res) => {
    try {
        const { type, recipientPhone, recipientName, message, imageUrl, buttonText, buttonUrl } = req.body;

        console.log('📱 친구톡 발송 요청:', { type, recipientPhone, recipientName });

        // 테스트 모드 (인증키가 TEST_CERT_KEY인 경우)
        if (BAROBILL_CONFIG.certKey === 'TEST_CERT_KEY') {
            const typeNames = { TEXT: '텍스트', IMAGE: '이미지', WIDE: '와이드' };
            await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 딜레이

            return res.json({
                success: true,
                message: `✅ [테스트 모드] ${recipientName}님에게 ${typeNames[type]} 친구톡이 발송되었습니다.`,
                messageId: `MOCK-FT-${Date.now()}`
            });
        }

        // 실제 운영 모드
        const client = await getSoapClient();

        const params = {
            CERTKEY: BAROBILL_CONFIG.certKey,
            CorpNum: BAROBILL_CONFIG.corpNum,
            SenderID: BAROBILL_CONFIG.userId,
            ToCorpNum: '',
            ToName: recipientName,
            ToHP: recipientPhone.replace(/-/g, ''),
            SenderHP: BAROBILL_CONFIG.senderPhone,
            Content: message,
            ImageURL: imageUrl || '', // 이미지 URL (친구톡은 필수일 수 있음)
            KButtonList: buttonText && buttonUrl ? JSON.stringify([{
                n: buttonText, t: 'WL', u1: buttonUrl, u2: buttonUrl
            }]) : ''
        };

        // 친구톡 메서드 호출 (SendFKakaotalkEx 가정)
        // 주의: 바로빌 문서를 확인하여 정확한 메서드명 사용 필요 (SendFKakaotalkEx or SendKakaotalk 등)
        client.SendFKakaotalkEx(params, (err, result) => {
            if (err) {
                console.error('❌ 친구톡 발송 실패 (SOAP Error):', err.message);
                return res.status(500).json({ success: false, message: err.message });
            }

            const returnValue = result?.SendFKakaotalkExResult;

            if (returnValue && parseInt(returnValue) > 0) {
                console.log('✅ 친구톡 접수 성공:', returnValue);
                return res.json({
                    success: true,
                    message: '친구톡이 발송되었습니다.',
                    messageId: returnValue.toString()
                });
            } else {
                console.error('❌ 친구톡 발송 실패:', returnValue);
                return res.status(400).json({
                    success: false,
                    message: getBarobillErrorMessage(returnValue)
                });
            }
        });

    } catch (error) {
        console.error('SERVER ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 바로빌 오류 코드 → 메시지 변환
 */
function getBarobillErrorMessage(code) {
    const errors = {
        '-1': '인증 실패',
        '-2': '필수 값 누락',
        '-3': '사업자번호 오류',
        '-99': '시스템 오류',
    };
    return errors[String(code)] || `오류 코드: ${code}`;
}

// 서버 시작
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║  🚀 바로빌 API 연동 서버 시작                    ║
╠════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                     ║
║  상태: ${BAROBILL_CONFIG.certKey === 'TEST_CERT_KEY' ? '🧪 테스트 모드' : '🔴 운영 모드'}                    ║
╠════════════════════════════════════════════════╣
║  엔드포인트:                                     ║
║  - GET  /api/status                            ║
║  - POST /api/tax-invoice/issue                 ║
║  - GET  /api/tax-invoice/status/:sendKey       ║
║  - POST /api/kakao/alimtalk                    ║
║  - POST /api/kakao/friendtalk                  ║
╚════════════════════════════════════════════════╝
    `);
});
