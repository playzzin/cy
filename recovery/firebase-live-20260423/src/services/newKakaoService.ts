import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';

// --- Zod Schemas ---

const PhoneSchema = z.string()
    .min(10, '전화번호는 최소 10자리입니다.')
    .max(14, '전화번호는 최대 14자리입니다.')
    .regex(/^[0-9-]+$/, '숫자와 하이픈만 입력 가능합니다.');

const ButtonSchema = z.object({
    name: z.string().min(1),
    buttonType: z.string().min(1),
    url1: z.string().optional(),
    url2: z.string().optional()
});

export const AlimTalkSchema = z.object({
    to: PhoneSchema,
    templateName: z.string().optional(),
    templateCode: z.string().optional(),
    templateId: z.string().optional(),
    content: z.string().min(1, '내용은 필수입니다.'),
    refNum: z.string().optional(),
    receiverName: z.string().optional(),
    title: z.string().optional(),
    yellowId: z.string().optional(),
    buttons: z.array(ButtonSchema).optional(),
}).superRefine((v, ctx) => {
    if (!v.templateName && !v.templateCode && !v.templateId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '템플릿 이름(templateName)이 필요합니다.', path: ['templateName'] });
    }
});

export const FriendTalkSchema = z.object({
    to: PhoneSchema,
    content: z.string().min(1, '내용은 필수입니다.'),
    refNum: z.string().optional(),
    channelId: z.string().optional(),
    friendTalkType: z.enum(['TEXT', 'IMAGE', 'WIDE']).optional(),
    adYN: z.boolean().optional(),
    receiverName: z.string().optional(),
    buttons: z.array(z.object({
        name: z.string().min(1),
        buttonType: z.string().min(1),
        url1: z.string().optional(),
        url2: z.string().optional(),
    })).optional(),
    image: z.object({
        imgUrl: z.string().url(),
        imgLink: z.string().optional(),
    }).optional(),
}).superRefine((v, ctx) => {
    const friendTalkType = v.friendTalkType ?? (v.image?.imgUrl ? 'IMAGE' : 'TEXT');
    const imageUrl = typeof v.image?.imgUrl === 'string' ? v.image.imgUrl.trim() : '';
    if (friendTalkType !== 'TEXT' && !imageUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '친구톡 이미지/와이드 발송을 위해 image.imgUrl이 필요합니다.',
            path: ['image']
        });
    }

    const maxButtonNameLen = friendTalkType === 'WIDE' ? 8 : 28;
    const buttons = Array.isArray(v.buttons) ? v.buttons : [];
    const invalid = buttons.find((b) => (b?.name ?? '').trim().length > maxButtonNameLen);
    if (invalid) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `버튼명은 ${friendTalkType === 'WIDE' ? '와이드 이미지형 기준' : '친구톡 기준'} 최대 ${maxButtonNameLen}자까지 가능합니다.`,
            path: ['buttons']
        });
    }

    const invalidButtonType = buttons.find((b) => (b?.buttonType ?? '').trim() !== 'WL');
    if (invalidButtonType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '현재 친구톡 버튼은 WL(웹링크)만 지원합니다.',
            path: ['buttons']
        });
        return;
    }

    const invalidButtonUrl = buttons.find((b) => {
        const url1 = (b?.url1 ?? '').trim();
        const url2 = (b?.url2 ?? '').trim();
        if (!url1) return true;
        if (!/^https?:\/\//i.test(url1)) return true;
        if (url2 && !/^https?:\/\//i.test(url2)) return true;
        return false;
    });
    if (invalidButtonUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'WL(웹링크) 버튼은 url1(http/https)이 필수이며, url2는 입력 시 http/https 링크여야 합니다.',
            path: ['buttons']
        });
    }
});

export type AlimTalkRequest = z.infer<typeof AlimTalkSchema>;
export type FriendTalkRequest = z.infer<typeof FriendTalkSchema>;

export interface KakaoResponse {
    success: boolean;
    receiptNum?: string;
    message: string;
}

export interface KakaoChannelListResponse {
    success: boolean;
    channels?: Array<Record<string, unknown>>;
    message?: string;
}

export interface KakaoTemplateListResponse {
    success: boolean;
    templates?: Array<Record<string, unknown>>;
    message?: string;
}

export type KakaoManagementType = 'CHANNEL' | 'TEMPLATE';

export interface KakaoManagementUrlResponse {
    success: boolean;
    url?: string;
    message?: string;
}

export interface BarobillErrStringResponse {
    success: boolean;
    errCode: number;
    errString?: string;
    message: string;
}

export interface DefaultSmsSenderNumResponse {
    success: boolean;
    senderNum?: string;
    message?: string;
}

export interface GetSendKakaotalkExResponse {
    success: boolean;
    result?: Record<string, unknown>;
    message?: string;
}

const normalizeErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error) return error;
    if (typeof error === 'object' && error && 'message' in error) {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string' && maybeMessage) return maybeMessage;
    }
    return fallback;
};

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

        const templateName = request.templateName ?? request.templateCode ?? request.templateId ?? '';

        try {
            const sendFn = httpsCallable<AlimTalkRequest, KakaoResponse>(functions, 'sendKakaoAlimtalk');
            const result = await sendFn({
                ...request,
                templateName,
            });
            return result.data;
        } catch (error: unknown) {
            console.error('[KakaoService] Send AlimTalk Error:', error);
            return {
                success: false,
                message: normalizeErrorMessage(error, '알림톡 발송 중 오류가 발생했습니다.')
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
        } catch (error: unknown) {
            console.error('[KakaoService] Send FriendTalk Error:', error);
            return {
                success: false,
                message: normalizeErrorMessage(error, '친구톡 발송 중 오류가 발생했습니다.')
            };
        }
    },

    getChannels: async (): Promise<KakaoChannelListResponse> => {
        try {
            const fn = httpsCallable<unknown, { success: boolean; channels?: unknown }>(functions, 'getKakaotalkChannels');
            const res = await fn({});
            const channels = Array.isArray(res.data.channels) ? (res.data.channels as Array<Record<string, unknown>>) : [];
            return { success: res.data.success === true, channels };
        } catch (error: unknown) {
            console.error('[KakaoService] Get Channels Error:', error);
            return { success: false, message: normalizeErrorMessage(error, '채널 목록 조회 중 오류가 발생했습니다.') };
        }
    },

    getTemplates: async (channelId: string): Promise<KakaoTemplateListResponse> => {
        try {
            const fn = httpsCallable<{ channelId: string }, { success: boolean; templates?: unknown }>(functions, 'getKakaotalkTemplates');
            const res = await fn({ channelId });
            const templates = Array.isArray(res.data.templates) ? (res.data.templates as Array<Record<string, unknown>>) : [];
            return { success: res.data.success === true, templates };
        } catch (error: unknown) {
            console.error('[KakaoService] Get Templates Error:', error);
            return { success: false, message: normalizeErrorMessage(error, '템플릿 목록 조회 중 오류가 발생했습니다.') };
        }
    },

    getManagementUrl: async (type: KakaoManagementType): Promise<KakaoManagementUrlResponse> => {
        try {
            const fn = httpsCallable<{ type: KakaoManagementType }, { success: boolean; url?: unknown; error?: unknown }>(
                functions,
                'getKakaoManagementUrl'
            );
            const res = await fn({ type });
            const url = typeof res.data.url === 'string' ? res.data.url : '';
            const errorMessage = typeof res.data.error === 'string' ? res.data.error : '';
            return {
                success: res.data.success === true,
                url: url || undefined,
                ...(errorMessage ? { message: errorMessage } : {})
            };
        } catch (error: unknown) {
            console.error('[KakaoService] Get Management URL Error:', error);
            return { success: false, message: normalizeErrorMessage(error, '관리 URL 조회 중 오류가 발생했습니다.') };
        }
    },

    getBarobillErrString: async (errCode: number): Promise<BarobillErrStringResponse> => {
        try {
            const fn = httpsCallable<{ errCode: number }, BarobillErrStringResponse>(functions, 'getBarobillErrString');
            const res = await fn({ errCode });
            return res.data;
        } catch (error: unknown) {
            console.error('[KakaoService] Get Barobill ErrString Error:', error);
            return {
                success: false,
                errCode,
                message: normalizeErrorMessage(error, '바로빌 오류 문자열 조회 중 오류가 발생했습니다.')
            };
        }
    },

    getDefaultSmsSenderNum: async (): Promise<DefaultSmsSenderNumResponse> => {
        try {
            const fn = httpsCallable<unknown, DefaultSmsSenderNumResponse>(functions, 'getDefaultSmsSenderNum');
            const res = await fn({});
            return res.data;
        } catch (error: unknown) {
            console.error('[KakaoService] Get Default SMS SenderNum Error:', error);
            return {
                success: false,
                message: normalizeErrorMessage(error, '대체문자 발신번호 조회 중 오류가 발생했습니다.')
            };
        }
    },

    getSendKakaotalkEx: async (sendKey: string): Promise<GetSendKakaotalkExResponse> => {
        try {
            const fn = httpsCallable<{ sendKey: string }, { success: boolean; result?: unknown }>(functions, 'getSendKakaotalkEx');
            const res = await fn({ sendKey });
            const result = (res.data.result && typeof res.data.result === 'object') ? (res.data.result as Record<string, unknown>) : undefined;
            return { success: res.data.success === true, result };
        } catch (error: unknown) {
            console.error('[KakaoService] Get SendKakaotalkEx Error:', error);
            return { success: false, message: normalizeErrorMessage(error, '전송상태 조회 중 오류가 발생했습니다.') };
        }
    }
};
