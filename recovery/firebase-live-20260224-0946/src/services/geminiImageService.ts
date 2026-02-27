/**
 * Gemini Image Generation Service
 * 
 * Gemini 2.5 Flash Image를 사용하여 다양한 용도의 이미지를 생성합니다.
 * - 파비콘, 로고, 아이콘, 배너, 카카오 친구톡 등 다양한 프리셋 지원
 * - Firebase Storage에 카테고리별 저장 및 관리
 */

import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getMetadata, updateMetadata } from 'firebase/storage';
import { aiSettingsService } from './aiSettingsService';

// --- Types ---
export type ImageCategory = 'favicon' | 'logo' | 'icon' | 'banner' | 'kakao-square' | 'kakao-wide' | 'og-image' | 'character' | 'business-card' | 'custom';

export interface ImagePreset {
    key: ImageCategory;
    label: string;
    width: number;
    height: number;
    maxSizeKB: number;
    description: string;
    promptHint: string;
}

export interface GalleryImage {
    name: string;
    url: string;
    fullPath: string;
    createdAt: string;
    category: ImageCategory;
    prompt?: string;
    tags?: string[];
    customName?: string;
}

export interface GeminiImageResult {
    success: boolean;
    imageBase64?: string;
    mimeType?: string;
    error?: string;
}

// --- Legacy aliases for backward compatibility (KakaoMessageCenterPage) ---
export type KakaoImageSpec = 'SQUARE' | 'WIDE';
export type SavedImage = GalleryImage & { spec: KakaoImageSpec };

// --- Constants ---
const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const STORAGE_BASE_PATH = 'gallery/ai-images';
const KAKAO_STORAGE_PATH = 'kakao/friendtalk/ai-generated';

export const IMAGE_PRESETS: Record<ImageCategory, ImagePreset> = {
    'favicon': {
        key: 'favicon', label: '파비콘', width: 512, height: 512, maxSizeKB: 200,
        description: '웹사이트 파비콘 (512x512)', promptHint: '심플하고 인식하기 쉬운 아이콘. 배경 투명 권장.'
    },
    'logo': {
        key: 'logo', label: '로고', width: 1024, height: 1024, maxSizeKB: 1024,
        description: '브랜드 로고 (1024x1024)', promptHint: '깔끔하고 전문적인 브랜드 로고.'
    },
    'icon': {
        key: 'icon', label: '아이콘', width: 256, height: 256, maxSizeKB: 100,
        description: 'UI 아이콘 (256x256)', promptHint: '미니멀하고 명확한 UI 아이콘.'
    },
    'banner': {
        key: 'banner', label: '배너', width: 1200, height: 630, maxSizeKB: 2048,
        description: '웹 배너 이미지 (1200x630)', promptHint: '눈에 띄는 마케팅 배너 이미지.'
    },
    'og-image': {
        key: 'og-image', label: 'OG 이미지', width: 1200, height: 630, maxSizeKB: 2048,
        description: 'Open Graph / SNS 공유 이미지 (1200x630)', promptHint: 'SNS 공유 시 표시되는 대표 이미지.'
    },
    'character': {
        key: 'character', label: '캐릭터', width: 750, height: 750, maxSizeKB: 1024,
        description: '일러스트 / 캐릭터 캐릭터 (750x750)', promptHint: '일관성 있는 캐릭터 디자인, 전신 또는 흉상 일러스트.'
    },
    'kakao-square': {
        key: 'kakao-square', label: '카카오 정사각형', width: 720, height: 720, maxSizeKB: 500,
        description: '카카오 친구톡 이미지형 (720x720)', promptHint: '카카오톡 친구톡 이미지형 정사각형.'
    },
    'kakao-wide': {
        key: 'kakao-wide', label: '카카오 와이드', width: 800, height: 600, maxSizeKB: 2048,
        description: '카카오 친구톡 와이드 이미지형 (800x600)', promptHint: '카카오톡 친구톡 와이드 이미지형.'
    },
    'custom': {
        key: 'custom', label: '커스텀', width: 1024, height: 1024, maxSizeKB: 2048,
        description: '사용자 지정 크기', promptHint: '원하는 이미지를 자유롭게 설명하세요.'
    },
    'business-card': {
        key: 'business-card', label: '명함', width: 1024, height: 600, maxSizeKB: 1024,
        description: '비즈니스 명함 (1024x600)', promptHint: '전문적인 비즈니스 명함 디자인. 텍스트 배치를 위한 레이아웃 중점.'
    }
};

// Legacy compat: IMAGE_SPECS for KakaoMessageCenterPage
export const IMAGE_SPECS: Record<'SQUARE' | 'WIDE', { label: string; width: number; height: number; maxSizeKB: number; description: string }> = {
    SQUARE: { label: IMAGE_PRESETS['kakao-square'].label, width: 720, height: 720, maxSizeKB: 500, description: IMAGE_PRESETS['kakao-square'].description },
    WIDE: { label: IMAGE_PRESETS['kakao-wide'].label, width: 800, height: 600, maxSizeKB: 2048, description: IMAGE_PRESETS['kakao-wide'].description }
};

// --- Core: Gemini Image Generation ---

export async function generateImage(prompt: string, categoryOrSpec: ImageCategory | KakaoImageSpec): Promise<GeminiImageResult> {
    aiSettingsService.assertCurrentPageEnabled('AI 이미지 생성');

    const geminiApiKey = aiSettingsService.getApiKey() || process.env.REACT_APP_GOOGLE_API_KEY || '';
    const geminiImageModel = aiSettingsService.getModels().imageModel || 'gemini-2.5-flash-image';

    if (!geminiApiKey) {
        return { success: false, error: 'Google API 키가 설정되지 않았습니다. (/settings/ai 또는 .env.local REACT_APP_GOOGLE_API_KEY)' };
    }

    let preset: ImagePreset;
    if (categoryOrSpec === 'SQUARE') preset = IMAGE_PRESETS['kakao-square'];
    else if (categoryOrSpec === 'WIDE') preset = IMAGE_PRESETS['kakao-wide'];
    else preset = IMAGE_PRESETS[categoryOrSpec] || IMAGE_PRESETS['custom'];

    const { width, height, promptHint } = preset;

    const fullPrompt = `Generate a high-quality image with the following specifications:
- Dimensions: ${width}x${height} pixels
- Style guidance: ${promptHint}
- Make it visually appealing, professional, and suitable for web/mobile use.
- Do NOT include any text in the image unless specifically requested by the user.

User's request: ${prompt}`;

    try {
        const endpoint = `${GEMINI_API_URL_BASE}/${geminiImageModel}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE']
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GeminiImage] API Error:', errorText);
            return { success: false, error: `API 오류 (${response.status}): ${errorText.substring(0, 200)}` };
        }

        const data = await response.json();
        const candidates = data?.candidates;
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            return { success: false, error: '이미지 생성 결과가 없습니다. 다른 프롬프트를 시도해주세요.' };
        }

        const parts = candidates[0]?.content?.parts;
        if (!parts || !Array.isArray(parts)) {
            return { success: false, error: '응답 형식이 올바르지 않습니다.' };
        }

        const imagePart = parts.find((p: any) => p.inlineData?.data);
        if (!imagePart) {
            const textPart = parts.find((p: any) => p.text);
            const reason = textPart?.text || '이미지가 생성되지 않았습니다.';
            return { success: false, error: `이미지 생성 실패: ${reason.substring(0, 300)}` };
        }

        return {
            success: true,
            imageBase64: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || 'image/png'
        };
    } catch (error) {
        console.error('[GeminiImage] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '이미지 생성 중 오류가 발생했습니다.'
        };
    }
}

// --- Storage Operations ---

function getStoragePath(category: ImageCategory): string {
    if (category === 'kakao-square' || category === 'kakao-wide') return KAKAO_STORAGE_PATH;
    return `${STORAGE_BASE_PATH}/${category}`;
}

export async function saveGeneratedImage(
    base64Data: string,
    mimeType: string,
    categoryOrSpec: ImageCategory | KakaoImageSpec,
    prompt: string,
    customName?: string,
    tags?: string[]
): Promise<{ success: boolean; url?: string; fullPath?: string; error?: string }> {
    try {
        let category: ImageCategory;
        if (categoryOrSpec === 'SQUARE') category = 'kakao-square';
        else if (categoryOrSpec === 'WIDE') category = 'kakao-wide';
        else category = categoryOrSpec;

        const ext = mimeType.includes('png') ? 'png' : 'jpg';
        const safeName = customName ? customName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').substring(0, 50) : category;
        const fileName = `${safeName}_${Date.now()}.${ext}`;
        const storagePath = `${getStoragePath(category)}/${fileName}`;
        const storageRefObj = ref(storage, storagePath);

        const byteChars = atob(base64Data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        await uploadBytes(storageRefObj, blob, {
            contentType: mimeType,
            customMetadata: {
                category,
                prompt: prompt.substring(0, 500),
                createdAt: new Date().toISOString(),
                customName: customName || '',
                tags: (tags || []).join(','),
                spec: categoryOrSpec === 'SQUARE' || categoryOrSpec === 'WIDE' ? categoryOrSpec : category === 'kakao-square' ? 'SQUARE' : category === 'kakao-wide' ? 'WIDE' : ''
            }
        });

        const url = await getDownloadURL(storageRefObj);
        return { success: true, url, fullPath: storagePath };
    } catch (error) {
        console.error('[GeminiImage] Save Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '이미지 저장 중 오류가 발생했습니다.'
        };
    }
}

export async function listGalleryImages(categoryFilter?: ImageCategory): Promise<GalleryImage[]> {
    try {
        const paths: string[] = [];
        if (categoryFilter) {
            paths.push(getStoragePath(categoryFilter));
        } else {
            const categories: ImageCategory[] = ['favicon', 'logo', 'icon', 'banner', 'og-image', 'character', 'business-card', 'custom'];
            categories.forEach(c => paths.push(`${STORAGE_BASE_PATH}/${c}`));
            paths.push(KAKAO_STORAGE_PATH);
        }

        const images: GalleryImage[] = [];

        for (const path of paths) {
            try {
                const listRef = ref(storage, path);
                const result = await listAll(listRef);

                for (const itemRef of result.items) {
                    try {
                        const [url, metadata] = await Promise.all([
                            getDownloadURL(itemRef),
                            getMetadata(itemRef)
                        ]);

                        const category = (metadata.customMetadata?.category as ImageCategory) ||
                            (path === KAKAO_STORAGE_PATH
                                ? (itemRef.name.startsWith('wide') ? 'kakao-wide' : 'kakao-square')
                                : 'custom');

                        images.push({
                            name: itemRef.name,
                            url,
                            fullPath: itemRef.fullPath,
                            createdAt: metadata.customMetadata?.createdAt || metadata.timeCreated || '',
                            category,
                            prompt: metadata.customMetadata?.prompt,
                            tags: metadata.customMetadata?.tags ? metadata.customMetadata.tags.split(',').filter(Boolean) : [],
                            customName: metadata.customMetadata?.customName
                        });
                    } catch (e) {
                        console.warn('[GeminiImage] Skip item:', itemRef.name, e);
                    }
                }
            } catch {
                // Path doesn't exist yet, skip
            }
        }

        return images.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (error) {
        console.error('[GeminiImage] List Error:', error);
        return [];
    }
}

// Legacy compat alias
export async function listSavedImages(): Promise<SavedImage[]> {
    const kakaoImages = await listGalleryImages('kakao-square');
    const wideImages = await listGalleryImages('kakao-wide');
    return [...kakaoImages, ...wideImages].map(img => ({
        ...img,
        spec: (img.category === 'kakao-wide' ? 'WIDE' : 'SQUARE') as KakaoImageSpec
    }));
}

export async function updateImageMetadata(
    fullPath: string,
    updates: { customName?: string; tags?: string[] }
): Promise<boolean> {
    try {
        const imageRef = ref(storage, fullPath);
        const meta = await getMetadata(imageRef);
        const newCustomMeta = { ...meta.customMetadata };
        if (updates.customName !== undefined) newCustomMeta.customName = updates.customName;
        if (updates.tags !== undefined) newCustomMeta.tags = updates.tags.join(',');
        await updateMetadata(imageRef, { customMetadata: newCustomMeta });
        return true;
    } catch (error) {
        console.error('[GeminiImage] Update Error:', error);
        return false;
    }
}

export async function deleteSavedImage(fullPath: string): Promise<boolean> {
    try {
        const imageRef = ref(storage, fullPath);
        await deleteObject(imageRef);
        return true;
    } catch (error) {
        console.error('[GeminiImage] Delete Error:', error);
        return false;
    }
}

// --- File Upload (regular images, not AI-generated) ---

export async function uploadImageFile(
    file: File,
    category: ImageCategory,
    customName?: string,
    tags?: string[]
): Promise<{ success: boolean; url?: string; fullPath?: string; error?: string }> {
    try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const safeName = customName ? customName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').substring(0, 50) : category;
        const fileName = `${safeName}_${Date.now()}.${ext}`;
        const storagePath = `${getStoragePath(category)}/${fileName}`;
        const storageRefObj = ref(storage, storagePath);

        await uploadBytes(storageRefObj, file, {
            contentType: file.type,
            customMetadata: {
                category,
                prompt: '',
                createdAt: new Date().toISOString(),
                customName: customName || file.name,
                tags: (tags || []).join(','),
                source: 'upload'
            }
        });

        const url = await getDownloadURL(storageRefObj);
        return { success: true, url, fullPath: storagePath };
    } catch (error) {
        console.error('[GeminiImage] Upload Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.'
        };
    }
}

// --- Custom Category Management (localStorage-based) ---

export interface CustomCategory {
    key: string;
    label: string;
    width: number;
    height: number;
    description: string;
    color: string; // gradient class like 'from-teal-500 to-cyan-500'
}

const CUSTOM_CATEGORIES_STORAGE_KEY = 'cy_image_custom_categories';

export function getCustomCategories(): CustomCategory[] {
    try {
        const raw = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as CustomCategory[];
    } catch {
        return [];
    }
}

export function saveCustomCategories(categories: CustomCategory[]): void {
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

export function addCustomCategory(cat: CustomCategory): CustomCategory[] {
    const existing = getCustomCategories();
    const updated = [...existing.filter(c => c.key !== cat.key), cat];
    saveCustomCategories(updated);
    return updated;
}

export function deleteCustomCategory(key: string): CustomCategory[] {
    const updated = getCustomCategories().filter(c => c.key !== key);
    saveCustomCategories(updated);
    return updated;
}

// --- Favicon & Logo Application ---

const FAVICON_PATH = 'settings/favicon';
const LOGO_PATH = 'settings/logo';

export async function applyAsFavicon(imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Download the image and re-upload to settings/favicon
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const storageRefObj = ref(storage, FAVICON_PATH);
        await uploadBytes(storageRefObj, blob, { contentType: blob.type });

        // Update browser favicon immediately
        const faviconUrl = await getDownloadURL(storageRefObj);
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = faviconUrl;
        } else {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = faviconUrl;
            document.head.appendChild(newLink);
        }

        return { success: true };
    } catch (error) {
        console.error('[GeminiImage] Apply Favicon Error:', error);
        return { success: false, error: error instanceof Error ? error.message : '파비콘 적용 실패' };
    }
}

export async function applyAsLogo(imageUrl: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const storageRefObj = ref(storage, LOGO_PATH);
        await uploadBytes(storageRefObj, blob, { contentType: blob.type });
        const url = await getDownloadURL(storageRefObj);
        return { success: true, url };
    } catch (error) {
        console.error('[GeminiImage] Apply Logo Error:', error);
        return { success: false, error: error instanceof Error ? error.message : '로고 적용 실패' };
    }
}

export async function getCurrentFaviconUrl(): Promise<string | null> {
    try {
        return await getDownloadURL(ref(storage, FAVICON_PATH));
    } catch {
        return null;
    }
}

export async function getCurrentLogoUrl(): Promise<string | null> {
    try {
        return await getDownloadURL(ref(storage, LOGO_PATH));
    } catch {
        return null;
    }
}
