import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { applyStampCommand, createDefaultStampSettings, resolveStampAsset, ROUND_STAMP_URL, StampAsset, StampCommand, StampDocument, StampSettings } from '../features/document-stamps/model';
import { LEGACY_ESTIMATE_STAMP_URL } from '../features/document-stamps/legacyStampUrl';

const settingsRef = () => doc(db, 'settings', 'document_stamps_v1');
const LOCAL_KEY = 'cy_dev_document_stamps_v1';
const LOCAL_EVENT = 'cy-document-stamps-changed';
const readSettings = (data?: Partial<StampSettings>): StampSettings => data && Array.isArray(data.assets) && data.profiles
    ? { revision: data.revision || 0, assets: data.assets, profiles: data.profiles }
    : createDefaultStampSettings();
const readLocal = (): StampSettings => readSettings(JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') || undefined);
const fileDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(file);
});

export const validateStampFile = (file: File) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('PNG 또는 JPG 이미지를 선택해 주세요.');
    if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('이미지는 0바이트보다 크고 2MB 이하여야 합니다.');
};

export const inspectStampFile = async (file: File): Promise<{ url: string; width: number; height: number }> => {
    validateStampFile(file);
    const url = await fileDataUrl(file);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > 4096 || img.naturalHeight > 4096) {
                reject(new Error('이미지의 가로·세로는 각각 1~4096px이어야 합니다.'));
            } else resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => reject(new Error('이미지 파일을 열 수 없습니다. 다른 PNG 또는 JPG 파일을 선택해 주세요.'));
        img.src = url;
    });
};

export const documentStampService = {
    async getSettings(): Promise<StampSettings> {
        if (isDevAdminSessionEnabled()) return readLocal();
        const snapshot = await getDoc(settingsRef());
        return readSettings(snapshot.exists() ? snapshot.data() : undefined);
    },
    subscribe(next: (value: StampSettings) => void, error: (error: Error) => void): () => void {
        if (isDevAdminSessionEnabled()) {
            const refresh = () => { try { next(readLocal()); } catch (e) { error(e as Error); } };
            const onStorage = (event: StorageEvent) => { if (event.key === LOCAL_KEY) refresh(); };
            refresh();
            window.addEventListener(LOCAL_EVENT, refresh);
            window.addEventListener('storage', onStorage);
            return () => { window.removeEventListener(LOCAL_EVENT, refresh); window.removeEventListener('storage', onStorage); };
        }
        return onSnapshot(settingsRef(), snapshot => next(readSettings(snapshot.exists() ? snapshot.data() : undefined)), error);
    },
    async execute(command: StampCommand, expectedRevision: number): Promise<void> {
        const update = (current: StampSettings) => {
            if (current.revision !== expectedRevision) throw new Error('다른 작업에서 도장 설정이 변경되었습니다. 최신 목록을 확인한 뒤 다시 시도해 주세요.');
            return applyStampCommand(current, command);
        };
        if (isDevAdminSessionEnabled()) {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(update(readLocal())));
            window.dispatchEvent(new Event(LOCAL_EVENT));
            return;
        }
        await runTransaction(db, async transaction => {
            const snapshot = await transaction.get(settingsRef());
            const next = update(readSettings(snapshot.exists() ? snapshot.data() : undefined));
            transaction.set(settingsRef(), { ...next, updatedAt: serverTimestamp() });
        });
    },
    async upload(file: File): Promise<Pick<StampAsset, 'url' | 'storagePath' | 'width' | 'height'>> {
        const image = await inspectStampFile(file);
        if (isDevAdminSessionEnabled()) return image;
        const storagePath = `system/document-stamps/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
        const target = ref(storage, storagePath);
        await uploadBytes(target, file, { contentType: file.type });
        return { storagePath, url: await getDownloadURL(target), width: image.width, height: image.height };
    },
    async assetUrl(asset: StampAsset | null): Promise<string | null> {
        if (!asset) return null;
        if (asset.url) return asset.url;
        if (!asset.storagePath) return null;
        try { return await getDownloadURL(ref(storage, asset.storagePath)); }
        catch (error) {
            if (asset.id === 'legacy-cheongyeon' && asset.builtin) return LEGACY_ESTIMATE_STAMP_URL;
            throw error;
        }
    },
    async resolveUrl(settings: StampSettings, document: StampDocument, companyName?: string | null, output: 'screen' | 'excel' = 'screen'): Promise<string | null> {
        const asset = resolveStampAsset(settings, document, companyName, output);
        if (asset?.id === 'legacy-cheongyeon' && asset.builtin && output === 'screen' && (document === 'estimate' || document === 'transaction')) return LEGACY_ESTIMATE_STAMP_URL;
        try { return await documentStampService.assetUrl(asset); }
        catch {
            // The receipt already used this local image when the old Storage object was unavailable.
            if (document === 'receipt' && asset?.id === 'legacy-cheongyeon') return ROUND_STAMP_URL;
            return null;
        }
    },
    async getUrl(document: StampDocument, companyName?: string | null, output: 'screen' | 'excel' = 'screen'): Promise<string | null> {
        let settings: StampSettings;
        try { settings = await documentStampService.getSettings(); }
        catch { settings = createDefaultStampSettings(); }
        return documentStampService.resolveUrl(settings, document, companyName, output);
    },
};
