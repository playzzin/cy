import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

export type SupportDocumentPerson = {
    id: string; name: string; teamId: string; teamName: string; role: string;
    relation: 'own' | 'other';
    hasIdentity: boolean; hasBank: boolean; hasDirectPayBank: boolean;
};
export type SupportDocumentKind = 'identity' | 'bank' | 'directPayBank';
const call = async <T>(data: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const response = await httpsCallable<Record<string, unknown>, T>(functions, 'supportTeamDocuments', { timeout: 120000 })(data);
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (auth.currentUser !== user) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
    return response.data;
};
export const supportTeamDocumentService = {
    list: async (signal?: AbortSignal): Promise<SupportDocumentPerson[]> => {
        const data = await call<{ workers: SupportDocumentPerson[] }>({ action: 'list' }, signal);
        if (!Array.isArray(data.workers)) throw new Error('서류 공유 대상을 확인하지 못했습니다.');
        return data.workers;
    },
    read: async (workerId: string, kind: SupportDocumentKind, name: string, signal?: AbortSignal): Promise<File | null> => {
        const result = await call<{ photo: { base64: string; contentType: string } | null }>({ action: 'read', workerId, kind }, signal);
        if (!result.photo) return null;
        const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
        const { contentType, base64 } = result.photo;
        if (!extensions[contentType] || base64.length > 6990510) throw new Error('서류 사진 형식을 확인하지 못했습니다.');
        const safeName = Array.from(name).map(char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('');
        return new File([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], `${safeName}.${extensions[contentType]}`, { type: contentType });
    },
};
