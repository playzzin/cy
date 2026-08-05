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

        return {
            success: false,
            message: 'Kakao notification provider is not configured.'
        };
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

        return {
            success: false,
            message: 'Kakao notification provider is not configured.'
        };
    },

    getChannels: async (): Promise<KakaoChannelListResponse> => {
        return { success: false, channels: [], message: 'Kakao notification provider is not configured.' };
    },

    getTemplates: async (channelId: string): Promise<KakaoTemplateListResponse> => {
        void channelId;
        return { success: false, templates: [], message: 'Kakao notification provider is not configured.' };
    },

    getManagementUrl: async (type: KakaoManagementType): Promise<KakaoManagementUrlResponse> => {
        void type;
        return { success: false, message: 'Kakao notification provider is not configured.' };
    },

    getDefaultSmsSenderNum: async (): Promise<DefaultSmsSenderNumResponse> => {
        return { success: false, message: 'Kakao notification provider is not configured.' };
    },

    getSendKakaotalkEx: async (sendKey: string): Promise<GetSendKakaotalkExResponse> => {
        void sendKey;
        return { success: false, message: 'Kakao notification provider is not configured.' };
    }
};
