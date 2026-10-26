import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { invalidateWorkerCache } from '../utils/workerCacheRevision';
import { invalidateTeamScopedCache } from './teamScopedReadService';
import type { WorkerAccountPurpose } from '../utils/workerAccount';

export const BANK_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const validateWorkerBankPhoto = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
        throw new Error('JPG·PNG·WEBP 원본 사진을 5MB 이하로 선택해 주세요.');
    }
};
const abortIfNeeded = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
const requireUser = () => {
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    return user;
};
const call = async <T>(data: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
    abortIfNeeded(signal);
    const user = requireUser();
    const result = await httpsCallable<Record<string, unknown>, T>(functions, 'workerBankPhotos', { timeout: 60000 })(data);
    abortIfNeeded(signal);
    if (auth.currentUser !== user) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
    return result.data;
};
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const readWorkerBankPhoto = async (workerId: string, name: string, signal?: AbortSignal, purpose: WorkerAccountPurpose = 'default'): Promise<File | null> => {
    const result = await call<{ photo: { base64: string; contentType: string; photoId: string } | null }>({ action: purpose === 'directPay' ? 'readDirectPay' : 'read', workerId }, signal);
    if (!result.photo) return null;
    const { base64, contentType } = result.photo;
    if (!extensions[contentType] || base64.length > 6990510) throw new Error('계좌사진 형식을 확인하지 못했습니다.');
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const safeName = Array.from(name).map(char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('');
    return new File([bytes], `${safeName}.${extensions[contentType]}`, { type: contentType });
};
export const saveWorkerBankPhoto = async (workerId: string, file: File, photoId: string, expectedPhotoId: string, purpose: WorkerAccountPurpose = 'default') => {
    const user = requireUser();
    validateWorkerBankPhoto(file);
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('계좌사진을 읽지 못했습니다.'));
        reader.readAsDataURL(file);
    });
    if (auth.currentUser !== user) throw new Error('로그인 계정이 변경되었습니다.');
    const result = await call<{ photoId: string }>({ action: purpose === 'directPay' ? 'saveDirectPay' : 'save', workerId, photoId, expectedPhotoId, base64 });
    invalidateWorkerCache(); invalidateTeamScopedCache();
    return result.photoId;
};
