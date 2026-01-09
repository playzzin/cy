import * as functions from 'firebase-functions';
import { barobillKakaoService } from '../services/barobillKakaoService';

/**
 * [Callable] Send Kakao AlimTalk (Notification)
 */
export const sendKakaoAlimtalk = functions
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
            const result = await barobillKakaoService.sendAlimTalk(to, templateCode, content, refNum);
            return result;
        } catch (error) {
            console.error('[Kakao] Send AlimTalk Failed:', error);
            throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
        }
    });

/**
 * [Callable] Send Kakao FriendTalk (Marketing/General)
 */
export const sendFriendTalk = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const { to, content, refNum } = data;

        if (!to || !content) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, content');
        }

        try {
            const result = await barobillKakaoService.sendFriendTalk(to, content, refNum);
            return result;
        } catch (error) {
            console.error('[Kakao] Send FriendTalk Failed:', error);
            throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
        }
    });

/**
 * [Callable] Get Kakao Management URL (Channel/Template)
 */
export const getKakaoManagementUrl = functions
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const { type } = data; // 'CHANNEL' or 'TEMPLATE'

        try {
            const url = await barobillKakaoService.getManagementUrl(type || 'CHANNEL');
            return { success: true, url };
        } catch (error) {
            console.error('[Kakao] Get Management URL Failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
