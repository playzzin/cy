"use strict";
/**
 * Firebase Functions - 세금계산서 API 엔드포인트
 *
 * 바로빌 API를 호출하여 세금계산서를 발행합니다.
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
exports.getTaxInvoiceListApi = exports.getTaxInvoiceStatusApi = exports.issueTaxInvoiceApi = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const taxInvoiceService_1 = require("./services/taxInvoiceService");
// Firebase Admin 초기화
admin.initializeApp();
/**
 * 세금계산서 즉시 발행 API
 * POST /taxinvoice/issue
 */
exports.issueTaxInvoiceApi = functions.https.onRequest(async (req, res) => {
    // CORS 헤더 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    // POST 요청만 허용
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const data = req.body;
        // 필수 필드 검증
        if (!data.invoicerCorpNum || !data.invoiceeCorpNum) {
            res.status(400).json({
                error: '필수 항목 누락',
                message: '공급자 및 공급받는자 사업자번호는 필수입니다.'
            });
            return;
        }
        // 바로빌 API 호출
        const result = await (0, taxInvoiceService_1.issueTaxInvoice)(data);
        if (result.code === 0) {
            // 발행 이력을 Firestore에 저장
            await admin.firestore().collection('taxInvoices').add({
                ...data,
                invoiceNum: result.invoiceNum,
                status: 'issued',
                issuedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            res.status(200).json({
                success: true,
                message: result.message,
                invoiceNum: result.invoiceNum,
            });
        }
        else {
            res.status(400).json({
                success: false,
                code: result.code,
                message: result.message,
            });
        }
    }
    catch (error) {
        console.error('세금계산서 발행 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: error instanceof Error ? error.message : '알 수 없는 오류',
        });
    }
});
/**
 * 세금계산서 상태 조회 API
 * GET /taxinvoice/status/:invoiceNum
 */
exports.getTaxInvoiceStatusApi = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const invoiceNum = req.query.invoiceNum;
        if (!invoiceNum) {
            res.status(400).json({ error: '세금계산서 번호가 필요합니다.' });
            return;
        }
        const result = await (0, taxInvoiceService_1.getTaxInvoiceStatus)(invoiceNum);
        res.status(200).json(result);
    }
    catch (error) {
        console.error('상태 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: error instanceof Error ? error.message : '알 수 없는 오류',
        });
    }
});
/**
 * 세금계산서 발행 이력 조회 API
 * GET /taxinvoice/list
 */
exports.getTaxInvoiceListApi = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const limit = parseInt(req.query.limit) || 50;
        const snapshot = await admin.firestore()
            .collection('taxInvoices')
            .orderBy('issuedAt', 'desc')
            .limit(limit)
            .get();
        const invoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.status(200).json({ invoices });
    }
    catch (error) {
        console.error('이력 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: error instanceof Error ? error.message : '알 수 없는 오류',
        });
    }
});
//# sourceMappingURL=index.js.map