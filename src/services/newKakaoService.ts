import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';

// --- Zod Schemas ---

const PhoneSchema = z.string()
    .min(10, '전화번호는 최소 10자리입니다.')
    .max(14, '전화번호는 최대 14자리입니다.')
    .regex(/^[0-9-]+$/, '숫자와 하이픈만 입력 가능합니다.');

export const AlimTalkSchema = z.object({
    to: PhoneSchema,
    templateCode: z.string().min(1, '템플릿 코드는 필수입니다.'),
    content: z.string().min(1, '내용은 필수입니다.'),
    refNum: z.string().optional(),
});

export const FriendTalkSchema = z.object({
    to: PhoneSchema,
    content: z.string().min(1, '내용은 필수입니다.'),
    refNum: z.string().optional(),
});

export type AlimTalkRequest = z.infer<typeof AlimTalkSchema>;
export type FriendTalkRequest = z.infer<typeof FriendTalkSchema>;

export interface KakaoResponse {
    success: boolean;
    receiptNum?: string;
    message: string;
}

/**
 * New Commercial-Grade Kakao Service Wrapper
 */
export const kakaoService = {
    /**
     * Send AlimTalk (Notification)
     */
    sendAlimTalk: async (request: AlimTalkRequest): Promise<KakaoResponse> => {
        // Validate Frontend-side
        const validation = AlimTalkSchema.safeParse(request);
        if (!validation.success) {
            return {
                success: false,
                message: validation.error.errors[0].message
            };
        }

        try {
            const sendFn = httpsCallable<AlimTalkRequest, KakaoResponse>(functions, 'sendKakaoAlimtalk');
            const result = await sendFn(request);
            return result.data;
        } catch (error: any) {
            console.error('[KakaoService] Send AlimTalk Error:', error);
            return {
                success: false,
                message: error.message || '알림톡 발송 중 오류가 발생했습니다.'
            };
        }
    },

    /**
     * Send FriendTalk (Marketing)
     */
    sendFriendTalk: async (request: FriendTalkRequest): Promise<KakaoResponse> => {
        const validation = FriendTalkSchema.safeParse(request);
        if (!validation.success) {
            return {
                success: false,
                message: validation.error.errors[0].message
            };
        }

        try {
            const sendFn = httpsCallable<FriendTalkRequest, KakaoResponse>(functions, 'sendFriendTalk');
            const result = await sendFn(request);
            return result.data;
        } catch (error: any) {
            console.error('[KakaoService] Send FriendTalk Error:', error);
            return {
                success: false,
                message: error.message || '친구톡 발송 중 오류가 발생했습니다.'
            };
        }
    }
};
