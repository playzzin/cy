"use strict";
/**
 * 카카오톡 알림톡 Firebase Functions
 *
 * SOLAPI를 통한 알림톡 발송 HTTP Functions
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
exports.getKakaoSendHistory = exports.getKakaoTemplates = exports.sendBulkKakaoAlimtalk = exports.sendKakaoAlimtalk = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const solapi_1 = require("../services/solapi");
/**
 * 알림톡 단건 발송
 *
 * POST /api/kakao/alimtalk
 * Body: { to: string, templateId: string, variables: object }
 */
exports.sendKakaoAlimtalk = functions
    .region('asia-northeast3') // 서울 리전
    .https.onCall(async (data, context) => {
    try {
        // 인증 확인 (선택사항)
        // if (!context.auth) {
        //     throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다');
        // }
        const { to, templateId, variables } = data;
        // 유효성 검사
        if (!to || !templateId || !variables) {
            throw new functions.https.HttpsError('invalid-argument', '수신자, 템플릿, 변수가 모두 필요합니다');
        }
        // 알림톡 발송
        const result = await (0, solapi_1.sendAlimtalk)({
            to,
            templateId,
            variables
        });
        // Firestore에 발송 이력 저장
        if (result.success) {
            await admin.firestore().collection('kakao_send_history').add({
                to,
                templateId,
                variables,
                messageId: result.messageId,
                status: 'sent',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                userId: context.auth?.uid || null
            });
        }
        return result;
    }
    catch (error) {
        console.error('sendKakaoAlimtalk error:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * 알림톡 대량 발송
 *
 * Body: { templateId: string, recipients: Array<{phone, variables}> }
 */
exports.sendBulkKakaoAlimtalk = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
    try {
        const { templateId, recipients } = data;
        if (!templateId || !recipients || !Array.isArray(recipients)) {
            throw new functions.https.HttpsError('invalid-argument', '템플릿과 수신자 목록이 필요합니다');
        }
        // 최대 100명으로 제한
        if (recipients.length > 100) {
            throw new functions.https.HttpsError('invalid-argument', '한 번에 최대 100명까지 발송 가능합니다');
        }
        // 대량 발송
        const results = await (0, solapi_1.sendBulkAlimtalk)(recipients, templateId);
        // 발송 이력 저장
        const batch = admin.firestore().batch();
        results.forEach((result, index) => {
            if (result.success) {
                const docRef = admin.firestore().collection('kakao_send_history').doc();
                batch.set(docRef, {
                    to: recipients[index].phone,
                    templateId,
                    variables: recipients[index].variables,
                    messageId: result.messageId,
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    userId: context.auth?.uid || null
                });
            }
        });
        await batch.commit();
        return {
            total: recipients.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }
    catch (error) {
        console.error('sendBulkKakaoAlimtalk error:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * 템플릿 목록 조회
 */
exports.getKakaoTemplates = functions
    .region('asia-northeast3')
    .https.onCall(async () => {
    return solapi_1.KAKAO_TEMPLATES;
});
/**
 * 발송 이력 조회
 */
exports.getKakaoSendHistory = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
    try {
        const { limit = 50, startAfter } = data;
        let query = admin.firestore()
            .collection('kakao_send_history')
            .orderBy('sentAt', 'desc')
            .limit(limit);
        if (startAfter) {
            query = query.startAfter(startAfter);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }
    catch (error) {
        console.error('getKakaoSendHistory error:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
//# sourceMappingURL=index.js.map