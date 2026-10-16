import * as functions from 'firebase-functions/v1';
import { barobillKakaoService } from '../services/barobillKakaoService';
import { protectedRegion, requireCallableAuth } from '../auth';

/**
 * [Callable] Send Kakao AlimTalk (Notification)
 */
export const sendKakaoAlimtalk = protectedRegion.https.onCall(async (data, context) => {
        requireCallableAuth(context);

        const { to, templateCode, content, refNum } = data;

        if (!to || !templateCode || !content) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, templateCode, content');
        }

        if (String(content).length > 1000) {
            throw new functions.https.HttpsError('invalid-argument', 'Message content is too long.');
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
export const sendFriendTalk = protectedRegion.https.onCall(async (data, context) => {
        requireCallableAuth(context);

        const { to, content, refNum } = data;

        if (!to || !content) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: to, content');
        }

        if (String(content).length > 1000) {
            throw new functions.https.HttpsError('invalid-argument', 'Message content is too long.');
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
export const getKakaoManagementUrl = protectedRegion.https.onCall(async (data, context) => {
        requireCallableAuth(context);

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
