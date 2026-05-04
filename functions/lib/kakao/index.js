"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKakaoManagementUrl = exports.sendFriendTalk = exports.sendKakaoAlimtalk = void 0;
const functions = require("firebase-functions");
const barobillKakaoService_1 = require("../services/barobillKakaoService");
/**
 * [Callable] Send Kakao AlimTalk (Notification)
 */
exports.sendKakaoAlimtalk = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
    // Auth Check (Optional but recommended)
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    // }
    const { to, templateCode, content, refNum } = data;
    if (!to || !templateCode || !content) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, templateCode, content');
    }
    try {
        const result = await barobillKakaoService_1.barobillKakaoService.sendAlimTalk(to, templateCode, content, refNum);
        return result;
    }
    catch (error) {
        console.error('[Kakao] Send AlimTalk Failed:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * [Callable] Send Kakao FriendTalk (Marketing/General)
 */
exports.sendFriendTalk = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
    const { to, content, refNum } = data;
    if (!to || !content) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, content');
    }
    try {
        const result = await barobillKakaoService_1.barobillKakaoService.sendFriendTalk(to, content, refNum);
        return result;
    }
    catch (error) {
        console.error('[Kakao] Send FriendTalk Failed:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * [Callable] Get Kakao Management URL (Channel/Template)
 */
exports.getKakaoManagementUrl = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
    const { type } = data; // 'CHANNEL' or 'TEMPLATE'
    try {
        const url = await barobillKakaoService_1.barobillKakaoService.getManagementUrl(type || 'CHANNEL');
        return { success: true, url };
    }
    catch (error) {
        console.error('[Kakao] Get Management URL Failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
});
//# sourceMappingURL=index.js.map