/**
 * Firebase Functions - 세금계산서 API 엔드포인트
 * 
 * 바로빌 API를 호출하여 세금계산서를 발행합니다.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { issueTaxInvoice, getTaxInvoiceStatus, TaxInvoiceData } from './services/taxInvoiceService';

// Firebase Admin 초기화
admin.initializeApp();

/**
 * 세금계산서 즉시 발행 API
 * POST /taxinvoice/issue
 */
export const issueTaxInvoiceApi = functions.https.onRequest(async (req, res) => {
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
        const data: TaxInvoiceData = req.body;

        // 필수 필드 검증
        if (!data.invoicerCorpNum || !data.invoiceeCorpNum) {
            res.status(400).json({
                error: '필수 항목 누락',
                message: '공급자 및 공급받는자 사업자번호는 필수입니다.'
            });
            return;
        }

        // 바로빌 API 호출
        const result = await issueTaxInvoice(data);

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
        } else {
            res.status(400).json({
                success: false,
                code: result.code,
                message: result.message,
            });
        }
    } catch (error) {
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
export const getTaxInvoiceStatusApi = functions.https.onRequest(async (req, res) => {
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
        const invoiceNum = req.query.invoiceNum as string;

        if (!invoiceNum) {
            res.status(400).json({ error: '세금계산서 번호가 필요합니다.' });
            return;
        }

        const result = await getTaxInvoiceStatus(invoiceNum);
        res.status(200).json(result);
    } catch (error) {
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
export const getTaxInvoiceListApi = functions.https.onRequest(async (req, res) => {
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
        const limit = parseInt(req.query.limit as string) || 50;
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
    } catch (error) {
        console.error('이력 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: error instanceof Error ? error.message : '알 수 없는 오류',
        });
    }
});
