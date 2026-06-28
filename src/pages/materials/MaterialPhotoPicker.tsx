import React, { useEffect, useRef } from 'react';
import { Camera, Images, Paperclip, X } from 'lucide-react';
import { storageService } from '../../services/storageService';

export type MaterialPhotoSource = 'camera' | 'gallery';

export interface MaterialPhotoAttachment {
    id: string;
    file: File;
    previewUrl: string;
    source: MaterialPhotoSource;
}

export interface MaterialPhotoUpload {
    path: string;
    name: string;
    contentType?: string;
    size?: number;
    originalSize: number;
    compressedSize: number;
    compressed: boolean;
    source: MaterialPhotoSource;
}

export type MaterialPhotoTone = 'blue' | 'red';

const MAX_MATERIAL_PHOTOS = 20;
const MAX_MATERIAL_PHOTO_DIMENSION = 1600;
const MATERIAL_PHOTO_QUALITY = 0.78;

const toneClasses = {
    blue: {
        border: 'border-blue-100',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        button: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
    },
    red: {
        border: 'border-red-100',
        bg: 'bg-red-50',
        text: 'text-red-700',
        button: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
        primary: 'bg-red-600 text-white hover:bg-red-700',
    },
};

const sanitizePathPart = (value: unknown): string =>
    String(value ?? 'none')
        .trim()
        .replace(/[\\/#?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80) || 'none';

const getFileExtension = (file: File): string => {
    const fromName = file.name.split('.').pop();
    if (fromName && fromName !== file.name) return fromName.toLowerCase();
    const fromType = file.type.split('/').pop();
    return fromType ? fromType.toLowerCase() : 'jpg';
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const previewUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(previewUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(previewUrl);
            reject(new Error('Failed to load material photo for compression.'));
        };
        image.src = previewUrl;
    });

const canvasToBlob = (
    canvas: HTMLCanvasElement,
    type: string,
    quality: number
): Promise<Blob | null> =>
    new Promise((resolve) => {
        canvas.toBlob(resolve, type, quality);
    });

const encodeCompressedPhoto = async (canvas: HTMLCanvasElement): Promise<Blob | null> => {
    const webpBlob = await canvasToBlob(canvas, 'image/webp', MATERIAL_PHOTO_QUALITY);
    if (webpBlob?.type === 'image/webp') return webpBlob;
    return canvasToBlob(canvas, 'image/jpeg', MATERIAL_PHOTO_QUALITY);
};

const compressMaterialPhoto = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
        return file;
    }

    try {
        const image = await loadImageFromFile(file);
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (sourceWidth <= 0 || sourceHeight <= 0) return file;

        const scale = Math.min(1, MAX_MATERIAL_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');
        if (!context) return file;

        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const compressedBlob = await encodeCompressedPhoto(canvas);
        if (!compressedBlob || compressedBlob.size >= file.size) return file;

        const extension = compressedBlob.type === 'image/webp' ? 'webp' : 'jpg';
        const nameWithoutExtension = file.name.replace(/\.[^.]+$/, '') || 'photo';
        return new File([compressedBlob], `${nameWithoutExtension}.${extension}`, {
            type: compressedBlob.type || 'image/jpeg',
            lastModified: file.lastModified,
        });
    } catch (error) {
        console.warn('[MaterialPhotoPicker] Photo compression failed. Uploading original file.', error);
        return file;
    }
};

const makeStorageFile = async (
    attachment: MaterialPhotoAttachment,
    index: number
): Promise<{ file: File; originalSize: number; compressed: boolean }> => {
    const file = await compressMaterialPhoto(attachment.file);
    const extension = getFileExtension(file);
    const fileName = `${Date.now()}-${index + 1}-${sanitizePathPart(attachment.file.name.replace(/\.[^.]+$/, ''))}.${extension}`;
    return {
        file: new File([file], fileName, { type: file.type || attachment.file.type || 'image/jpeg' }),
        originalSize: attachment.file.size,
        compressed: file.size < attachment.file.size,
    };
};

export const revokeMaterialPhotoAttachments = (photos: MaterialPhotoAttachment[]) => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
};

export const deleteUploadedMaterialPhotos = async (photos: MaterialPhotoUpload[]): Promise<void> => {
    await Promise.all(photos.map(async (photo) => {
        if (!photo.path) return;
        try {
            await storageService.deleteFile(photo.path);
        } catch (error) {
            console.warn('[MaterialPhotoPicker] Uploaded photo cleanup skipped:', photo.path, error);
        }
    }));
};

export const uploadMaterialPhotoAttachments = async (options: {
    photos: MaterialPhotoAttachment[];
    transactionType: 'inbound' | 'outbound';
    transactionDate: string;
    siteId: string;
    onProgress?: (progress: number) => void;
}): Promise<MaterialPhotoUpload[]> => {
    const { photos, transactionType, transactionDate, siteId, onProgress } = options;
    if (photos.length === 0) return [];

    const progressById = new Map<string, number>();
    photos.forEach((photo) => progressById.set(photo.id, 0));
    const updateProgress = (id: string, progress: number) => {
        progressById.set(id, progress);
        const total = Array.from(progressById.values()).reduce((sum, value) => sum + value, 0);
        onProgress?.(Math.round(total / Math.max(progressById.size, 1)));
    };

    const basePath = [
        'materials',
        transactionType,
        sanitizePathPart(transactionDate),
        sanitizePathPart(siteId),
    ].join('/');

    return Promise.all(
        photos.map(async (photo, index) => {
            const storageFile = await makeStorageFile(photo, index);
            const uploadResult = await storageService.uploadFileInfo(
                basePath,
                storageFile.file,
                (progress) => updateProgress(photo.id, progress),
                {
                    includeDownloadUrl: false,
                    metadata: {
                        contentType: storageFile.file.type || 'image/jpeg',
                        customMetadata: {
                            source: photo.source,
                            originalSize: String(storageFile.originalSize),
                            compressedSize: String(storageFile.file.size),
                            compressed: String(storageFile.compressed),
                            maxDimension: String(MAX_MATERIAL_PHOTO_DIMENSION),
                            quality: String(MATERIAL_PHOTO_QUALITY),
                        },
                    },
                }
            );

            return {
                path: uploadResult.fullPath,
                name: uploadResult.name,
                contentType: uploadResult.contentType || storageFile.file.type,
                size: uploadResult.size || storageFile.file.size,
                originalSize: storageFile.originalSize,
                compressedSize: storageFile.file.size,
                compressed: storageFile.compressed,
                source: photo.source,
            };
        })
    );
};

interface MaterialPhotoPickerProps {
    photos: MaterialPhotoAttachment[];
    onPhotosChange: (photos: MaterialPhotoAttachment[]) => void;
    tone: MaterialPhotoTone;
    disabled?: boolean;
    uploadProgress?: number | null;
}

const MaterialPhotoPicker: React.FC<MaterialPhotoPickerProps> = ({
    photos,
    onPhotosChange,
    tone,
    disabled = false,
    uploadProgress = null,
}) => {
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const latestPhotosRef = useRef(photos);
    const classes = toneClasses[tone];

    useEffect(() => {
        latestPhotosRef.current = photos;
    }, [photos]);

    useEffect(() => {
        return () => revokeMaterialPhotoAttachments(latestPhotosRef.current);
    }, []);

    const appendFiles = (fileList: FileList | null, source: MaterialPhotoSource) => {
        if (!fileList || disabled) return;

        const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
        const capacity = Math.max(0, MAX_MATERIAL_PHOTOS - photos.length);
        const nextPhotos = imageFiles.slice(0, capacity).map((file) => ({
            id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            source,
        }));

        if (nextPhotos.length > 0) {
            onPhotosChange([...photos, ...nextPhotos]);
        }
    };

    const handleInputChange = (
        event: React.ChangeEvent<HTMLInputElement>,
        source: MaterialPhotoSource
    ) => {
        appendFiles(event.target.files, source);
        event.target.value = '';
    };

    const removePhoto = (id: string) => {
        const target = photos.find((photo) => photo.id === id);
        if (target) URL.revokeObjectURL(target.previewUrl);
        onPhotosChange(photos.filter((photo) => photo.id !== id));
    };

    const clearPhotos = () => {
        revokeMaterialPhotoAttachments(photos);
        onPhotosChange([]);
    };

    return (
        <section className={`mb-5 rounded-xl border ${classes.border} ${classes.bg} p-3`}>
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => handleInputChange(event, 'camera')}
            />
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleInputChange(event, 'gallery')}
            />

            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className={`flex items-center gap-1.5 text-sm font-black ${classes.text}`}>
                        <Paperclip size={16} />
                        사진 첨부
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        촬영 또는 갤러리 선택, 최대 {MAX_MATERIAL_PHOTOS}장
                    </div>
                </div>
                {photos.length > 0 ? (
                    <button
                        type="button"
                        onClick={clearPhotos}
                        disabled={disabled}
                        className="shrink-0 text-xs font-black text-slate-500 hover:text-slate-800 disabled:text-slate-300"
                    >
                        전체삭제
                    </button>
                ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={disabled || photos.length >= MAX_MATERIAL_PHOTOS}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${classes.primary}`}
                >
                    <Camera size={17} />
                    사진 촬영
                </button>
                <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={disabled || photos.length >= MAX_MATERIAL_PHOTOS}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${classes.button}`}
                >
                    <Images size={17} />
                    갤러리 선택
                </button>
            </div>

            {uploadProgress !== null ? (
                <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-black text-slate-500">
                        <span>사진 업로드</span>
                        <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                            className={`h-full rounded-full ${tone === 'blue' ? 'bg-blue-600' : 'bg-red-600'}`}
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            ) : null}

            {photos.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {photos.map((photo) => (
                        <div key={photo.id} className="relative overflow-hidden rounded-lg border border-white bg-white shadow-sm">
                            <img
                                src={photo.previewUrl}
                                alt={photo.source === 'camera' ? '촬영 사진' : '갤러리 사진'}
                                className="h-20 w-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removePhoto(photo.id)}
                                disabled={disabled}
                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/75 text-white disabled:bg-slate-400"
                                aria-label="사진 삭제"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
};

export default MaterialPhotoPicker;
