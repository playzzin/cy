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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertWelfareCategory = exports.seedWelfareAssetMasters = exports.saveWelfareGameConfig = exports.saveWelfareAdminPermissions = exports.playWelfarePointGame = exports.getWelfareGameConfig = exports.deleteWelfareCategory = exports.createWelfareLedgerTransaction = exports.getTaxInvoiceListApi = exports.getTaxInvoiceStatusApi = exports.issueTaxInvoiceApi = void 0;
const admin = require("firebase-admin");
const taxInvoiceService_1 = require("./services/taxInvoiceService");
const auth_1 = require("./auth");
// Firebase Admin 초기화
admin.initializeApp();
/**
 * 세금계산서 즉시 발행 API
 * POST /taxinvoice/issue
 */
exports.issueTaxInvoiceApi = auth_1.protectedRegion.https.onRequest(async (req, res) => {
    // CORS 헤더 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    // POST 요청만 허용
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const auth = await (0, auth_1.requireHttpAuth)(req, res);
    if (!auth)
        return;
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
        if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 99) {
            res.status(400).json({
                error: 'Invalid invoice items',
                message: 'Invoice items must contain between 1 and 99 rows.'
            });
            return;
        }
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
exports.getTaxInvoiceStatusApi = auth_1.protectedRegion.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const auth = await (0, auth_1.requireHttpAuth)(req, res);
    if (!auth)
        return;
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
exports.getTaxInvoiceListApi = auth_1.protectedRegion.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const auth = await (0, auth_1.requireHttpAuth)(req, res);
    if (!auth)
        return;
    try {
        const limit = (0, auth_1.parseBoundedLimit)(req.query.limit, 50, 100);
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
// ============================================
// 카카오톡 알림톡 Functions (SOLAPI)
// ============================================
__exportStar(require("./kakao"), exports);
var welfareAssetLedger_1 = require("./services/welfareAssetLedger");
Object.defineProperty(exports, "createWelfareLedgerTransaction", { enumerable: true, get: function () { return welfareAssetLedger_1.createWelfareLedgerTransaction; } });
Object.defineProperty(exports, "deleteWelfareCategory", { enumerable: true, get: function () { return welfareAssetLedger_1.deleteWelfareCategory; } });
Object.defineProperty(exports, "getWelfareGameConfig", { enumerable: true, get: function () { return welfareAssetLedger_1.getWelfareGameConfig; } });
Object.defineProperty(exports, "playWelfarePointGame", { enumerable: true, get: function () { return welfareAssetLedger_1.playWelfarePointGame; } });
Object.defineProperty(exports, "saveWelfareAdminPermissions", { enumerable: true, get: function () { return welfareAssetLedger_1.saveWelfareAdminPermissions; } });
Object.defineProperty(exports, "saveWelfareGameConfig", { enumerable: true, get: function () { return welfareAssetLedger_1.saveWelfareGameConfig; } });
Object.defineProperty(exports, "seedWelfareAssetMasters", { enumerable: true, get: function () { return welfareAssetLedger_1.seedWelfareAssetMasters; } });
Object.defineProperty(exports, "upsertWelfareCategory", { enumerable: true, get: function () { return welfareAssetLedger_1.upsertWelfareCategory; } });
//# sourceMappingURL=index.js.map