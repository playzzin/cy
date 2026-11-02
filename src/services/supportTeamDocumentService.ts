import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

export type SupportDocumentPerson = {
    id: string; name: string; teamId: string; teamName: string; role: string;
    relation: 'own' | 'other';
    hasIdentity: boolean; hasBank: boolean; hasDirectPayBank: boolean;
};
export type SupportDocumentKind = 'identity' | 'bank' | 'directPayBank';
type Photo = { base64: string; contentType: string };
type PhotoPart = Photo & { offset: number; size: number; revision: string };
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
        const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
        const user = auth.currentUser;
        const parts: BlobPart[] = [];
        let offset = 0, size = 0, contentType = '';
        let revision: string | undefined;
        do {
            if (auth.currentUser !== user) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
            const data: { photo: Photo | PhotoPart | null } = await call({
                action: 'read', workerId, kind, ...(kind === 'identity' ? { offset, ...(revision && { revision }) } : {}),
            }, signal);
            const photo = data.photo;
            if (!photo && offset === 0) return null;
            if (!photo || !Object.prototype.hasOwnProperty.call(extensions, photo.contentType)) throw new Error('image-transfer-incomplete');
            const bytes = Uint8Array.from(atob(photo.base64), char => char.charCodeAt(0));
            if (!bytes.length) throw new Error('image-transfer-incomplete');
            if ('offset' in photo) {
                if (photo.offset !== offset || !Number.isSafeInteger(photo.size) || offset + bytes.length > photo.size ||
                    !/^[a-f0-9]{64}$/.test(photo.revision) ||
                    (offset > 0 && (photo.size !== size || photo.revision !== revision || photo.contentType !== contentType))) {
                    throw new Error('image-transfer-incomplete');
                }
                revision = photo.revision;
                size = photo.size;
            } else if (offset !== 0) throw new Error('image-transfer-incomplete');
            contentType = photo.contentType;
            parts.push(bytes);
            offset += bytes.length;
        } while (offset < size);
        const safeName = Array.from(name).map(char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('');
        return new File(parts, `${safeName}.${extensions[contentType]}`, { type: contentType });
    },
};
