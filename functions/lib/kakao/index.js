"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKakaoManagementUrl = exports.sendFriendTalk = exports.sendKakaoAlimtalk = void 0;
const functions = require("firebase-functions");
const barobillKakaoService_1 = require("../services/barobillKakaoService");
const auth_1 = require("../auth");
/**
 * [Callable] Send Kakao AlimTalk (Notification)
 */
exports.sendKakaoAlimtalk = auth_1.protectedRegion.https.onCall(async (data, context) => {
    (0, auth_1.requireCallableAuth)(context);
    const { to, templateCode, content, refNum } = data;
    if (!to || !templateCode || !content) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, templateCode, content');
    }
    if (String(content).length > 1000) {
        throw new functions.https.HttpsError('invalid-argument', 'Message content is too long.');
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
exports.sendFriendTalk = auth_1.protectedRegion.https.onCall(async (data, context) => {
    (0, auth_1.requireCallableAuth)(context);
    const { to, content, refNum } = data;
    if (!to || !content) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, content');
    }
    if (String(content).length > 1000) {
        throw new functions.https.HttpsError('invalid-argument', 'Message content is too long.');
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
exports.getKakaoManagementUrl = auth_1.protectedRegion.https.onCall(async (data, context) => {
    (0, auth_1.requireCallableAuth)(context);
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