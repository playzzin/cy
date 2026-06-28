import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, functions, storage } from '../config/firebase';
import type {
    BusinessCardImage,
    BusinessContact,
    BusinessContactFollowUp,
    BusinessContactHistory,
    CompanyRelationship,
    CompanyRelationshipType,
    ContactHistoryType,
    PartnerRecognitionCommitResult,
    PartnerRecognitionImage,
    PartnerRecognitionJob,
    PartnerRecognitionReviewPatch,
    PartnerRecognitionResult,
} from '../types/partnerRecognition';
import { PARTNER_RECOGNITION_COLLECTIONS } from '../types/partnerRecognition';

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const BUSINESS_CARD_LANDSCAPE_RATIO = 1.15;
const ANALYSIS_CALLABLE_TIMEOUT_MS = 300_000;
const RELATIONSHIP_TYPES_SETTINGS_COLLECTION = 'settings';
const RELATIONSHIP_TYPES_SETTINGS_DOC = 'partnerRecognitionRelationshipTypes';

export const DEFAULT_PARTNER_RELATIONSHIP_TYPES: CompanyRelationshipType[] = [
    '협력사',
    '임대',
    '납품',
    '하도급',
    '원청',
    '설계',
    '감리',
    '발주',
    '소개',
    '견적',
    '계약중',
    '기타',
];

type CreateJobInput = {
    title: string;
    baseCompanyId?: string;
    baseCompanyName?: string;
    defaultRelationshipType?: CompanyRelationshipType;
    defaultSiteId?: string;
    defaultSiteName?: string;
};

type CommitInput = {
    jobId: string;
    resultIds: string[];
    createRelationships: boolean;
};

type BatchStartResult = {
    success: boolean;
    batchName: string;
    state: string;
    requestCount: number;
};

type BatchSyncResult = {
    success: boolean;
    done: boolean;
    state: string;
    createdResults: number;
};

type ContactListFilters = {
    companyId?: string;
    searchTerm?: string;
    maxCount?: number;
};

type ContactUpsertInput = Partial<Omit<BusinessContact, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>> & {
    id?: string;
};

type HistoryInput = {
    contactId: string;
    companyId: string;
    companyName: string;
    type: ContactHistoryType;
    title: string;
    content: string;
    happenedAt: string;
};

type FollowUpInput = {
    contactId: string;
    companyId: string;
    companyName: string;
    title: string;
    dueDate: string;
    memo?: string;
};

const stripUndefinedDeep = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value.map((child) => {
            const cleaned = stripUndefinedDeep(child);
            return cleaned === undefined ? null : cleaned;
        });
    }
    if (value && typeof value === 'object') {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
            return value;
        }
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([key, child]) => [key, stripUndefinedDeep(child)] as const)
                .filter(([, child]) => child !== undefined)
        );
    }
    return value;
};

const cleanObject = <T extends Record<string, unknown>>(value: T): T =>
    stripUndefinedDeep(value) as T;

const getCurrentUserOrThrow = () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('로그인이 필요합니다.');
    }
    return user;
};

const normalizeSearchText = (value: unknown): string =>
    String(value || '').toLowerCase().replace(/\s+/g, '');

const normalizeRelationshipTypes = (values: unknown): CompanyRelationshipType[] => {
    const source = Array.isArray(values) ? values : [];
    const seen = new Set<string>();
    const normalized = source
        .map((value) => String(value || '').trim())
        .filter((value) => {
            if (!value || seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    return normalized.length > 0 ? normalized : DEFAULT_PARTNER_RELATIONSHIP_TYPES;
};

const relationshipTypesSettingsRef = () =>
    doc(db, RELATIONSHIP_TYPES_SETTINGS_COLLECTION, RELATIONSHIP_TYPES_SETTINGS_DOC);

const sanitizeStorageSegment = (value: string): string =>
    (value || 'image')
        .trim()
        .replace(/[\\/:*?"<>|#%{}[\]^~`]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80) || 'image';

const getExtension = (file: File): string => {
    if (file.type.includes('png')) return 'png';
    if (file.type.includes('webp')) return 'webp';
    if (file.type.includes('heic')) return 'heic';
    if (file.type.includes('heif')) return 'heif';
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext && ext.length <= 5 ? ext : 'jpg';
};

export const isRecognitionImageFile = (file: File): boolean =>
    file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

const loadImage = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('이미지를 읽을 수 없습니다.'));
        };
        image.src = url;
    });

const canvasToFile = (
    canvas: HTMLCanvasElement,
    originalName: string,
): Promise<File> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('이미지 압축에 실패했습니다.'));
                return;
            }
            const baseName = originalName.replace(/\.[^.]+$/, '') || 'partner-photo';
            resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', JPEG_QUALITY);
    });

const normalizeRotation = (degrees: number): 0 | 90 | 180 | 270 =>
    {
        const normalized = ((degrees % 360) + 360) % 360;
        if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
        return 0;
    };

const drawRotatedImage = (
    image: HTMLImageElement,
    canvas: HTMLCanvasElement,
    rotation: 0 | 90 | 180 | 270,
    sourceWidth: number,
    sourceHeight: number,
    scale: number,
): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (rotation === 90) {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
    } else if (rotation === 180) {
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate(Math.PI);
    } else if (rotation === 270) {
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
    }
    ctx.drawImage(image, 0, 0, sourceWidth * scale, sourceHeight * scale);
    ctx.restore();
};

const shouldRotatePortraitBusinessCard = (width: number, height: number): boolean =>
    height > width * BUSINESS_CARD_LANDSCAPE_RATIO;

export const rotateImageFileForRecognition = async (
    file: File,
    degrees: number,
): Promise<{ file: File; width?: number; height?: number; rotationApplied: 0 | 90 | 180 | 270 }> => {
    if (!isRecognitionImageFile(file)) {
        return { file, rotationApplied: 0 };
    }

    const rotation = normalizeRotation(degrees);
    if (rotation === 0) {
        return { file, rotationApplied: 0 };
    }

    const image = await loadImage(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
        return { file, rotationApplied: 0 };
    }

    const nextWidth = rotation === 90 || rotation === 270 ? height : width;
    const nextHeight = rotation === 90 || rotation === 270 ? width : height;
    const canvas = document.createElement('canvas');
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    drawRotatedImage(image, canvas, rotation, width, height, 1);
    const rotated = await canvasToFile(canvas, file.name);
    return { file: rotated, width: nextWidth, height: nextHeight, rotationApplied: rotation };
};

export const resizeImageForRecognition = async (
    file: File,
): Promise<{ file: File; width?: number; height?: number; rotationApplied?: 0 | 90 | 180 | 270 }> => {
    if (!isRecognitionImageFile(file)) {
        return { file };
    }

    try {
        const image = await loadImage(file);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
            return { file };
        }

        const rotation: 0 | 270 = shouldRotatePortraitBusinessCard(width, height) ? 270 : 0;
        const orientedWidth = rotation === 270 ? height : width;
        const orientedHeight = rotation === 270 ? width : height;
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(orientedWidth, orientedHeight));
        const nextWidth = Math.round(orientedWidth * scale);
        const nextHeight = Math.round(orientedHeight * scale);

        if (rotation === 0 && scale === 1 && file.size <= 2 * 1024 * 1024 && file.type !== 'image/png') {
            return { file, width, height, rotationApplied: 0 };
        }

        const canvas = document.createElement('canvas');
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        drawRotatedImage(image, canvas, rotation, width, height, scale);

        const resized = await canvasToFile(canvas, file.name);
        return { file: resized, width: nextWidth, height: nextHeight, rotationApplied: rotation };
    } catch {
        return { file };
    }
};

export const partnerRecognitionService = {
    subscribeRelationshipTypes(callback: (types: CompanyRelationshipType[]) => void): Unsubscribe {
        return onSnapshot(relationshipTypesSettingsRef(), (snapshot) => {
            callback(normalizeRelationshipTypes(snapshot.data()?.relationshipTypes));
        }, (error) => {
            console.error('Failed to subscribe partner relationship types:', error);
            callback(DEFAULT_PARTNER_RELATIONSHIP_TYPES);
        });
    },

    async getRelationshipTypes(): Promise<CompanyRelationshipType[]> {
        const snapshot = await getDoc(relationshipTypesSettingsRef());
        return normalizeRelationshipTypes(snapshot.data()?.relationshipTypes);
    },

    async saveRelationshipTypes(types: CompanyRelationshipType[]): Promise<void> {
        const user = getCurrentUserOrThrow();
        const normalized = normalizeRelationshipTypes(types);
        await setDoc(relationshipTypesSettingsRef(), {
            relationshipTypes: normalized,
            updatedAt: serverTimestamp(),
            updatedByUid: user.uid,
        }, { merge: true });
    },

    async createJob(input: CreateJobInput): Promise<string> {
        const user = getCurrentUserOrThrow();
        const docRef = doc(collection(db, PARTNER_RECOGNITION_COLLECTIONS.jobs));
        const job: Omit<PartnerRecognitionJob, 'id'> = {
            title: input.title.trim() || `사진 거래처 등록 ${new Date().toLocaleString('ko-KR')}`,
            status: 'draft',
            createdByUid: user.uid,
            createdByName: user.displayName || user.email || '',
            baseCompanyId: input.baseCompanyId,
            baseCompanyName: input.baseCompanyName,
            defaultRelationshipType: input.defaultRelationshipType,
            defaultSiteId: input.defaultSiteId,
            defaultSiteName: input.defaultSiteName,
            totalImages: 0,
            processedImages: 0,
            totalItems: 0,
            autoMatchedItems: 0,
            needsReviewItems: 0,
            noMatchItems: 0,
            excludedItems: 0,
            committedItems: 0,
            errorItems: 0,
            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
        };

        await setDoc(docRef, cleanObject(job as Record<string, unknown>));
        return docRef.id;
    },

    async uploadJobImages(jobId: string, files: File[]): Promise<PartnerRecognitionImage[]> {
        getCurrentUserOrThrow();
        if (!jobId) throw new Error('작업 ID가 없습니다.');
        if (files.length === 0) return [];

        await updateDoc(doc(db, PARTNER_RECOGNITION_COLLECTIONS.jobs, jobId), {
            status: 'uploading',
            updatedAt: serverTimestamp(),
        });

        const uploaded: PartnerRecognitionImage[] = [];

        for (const file of files) {
            const imageRef = doc(collection(db, PARTNER_RECOGNITION_COLLECTIONS.images));
            const resized = await resizeImageForRecognition(file);
            const uploadFile = resized.file;
            const ext = getExtension(uploadFile);
            const storagePath = `partner-recognition/${jobId}/original/${imageRef.id}_${sanitizeStorageSegment(file.name)}.${ext}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, uploadFile, {
                contentType: uploadFile.type || file.type || 'image/jpeg',
                customMetadata: {
                    jobId,
                    imageId: imageRef.id,
                    originalFileName: file.name,
                    rotationApplied: String(resized.rotationApplied || 0),
                },
            });
            const downloadUrl = await getDownloadURL(storageRef);

            const imageDoc: PartnerRecognitionImage = {
                id: imageRef.id,
                jobId,
                storagePath,
                downloadUrl,
                originalFileName: file.name,
                mimeType: uploadFile.type || file.type || 'image/jpeg',
                size: uploadFile.size,
                width: resized.width,
                height: resized.height,
                rotationApplied: resized.rotationApplied || 0,
                orientationNormalized: Boolean(resized.rotationApplied),
                status: 'uploaded',
                resultCount: 0,
                createdAt: serverTimestamp() as any,
                updatedAt: serverTimestamp() as any,
            };

            await setDoc(imageRef, cleanObject({ ...imageDoc, id: undefined } as Record<string, unknown>));
            uploaded.push(imageDoc);
        }

        await updateDoc(doc(db, PARTNER_RECOGNITION_COLLECTIONS.jobs, jobId), {
            status: 'queued',
            totalImages: uploaded.length,
            updatedAt: serverTimestamp(),
        });

        return uploaded;
    },

    async startAnalysis(jobId: string, imageIds?: string[]): Promise<void> {
        const callable = httpsCallable<
            { jobId: string; imageIds?: string[] },
            { success: boolean }
        >(functions, 'analyzePartnerRecognitionJob', { timeout: ANALYSIS_CALLABLE_TIMEOUT_MS });
        await callable({ jobId, imageIds });
    },

    async startBatchAnalysis(jobId: string, imageIds?: string[]): Promise<BatchStartResult> {
        const callable = httpsCallable<
            { jobId: string; imageIds?: string[] },
            BatchStartResult
        >(functions, 'createPartnerRecognitionBatchJob');
        const result = await callable({ jobId, imageIds });
        return result.data;
    },

    async syncBatchAnalysis(jobId: string): Promise<BatchSyncResult> {
        const callable = httpsCallable<{ jobId: string }, BatchSyncResult>(
            functions,
            'syncPartnerRecognitionBatchJob',
        );
        const result = await callable({ jobId });
        return result.data;
    },

    subscribeJob(jobId: string, callback: (job: PartnerRecognitionJob | null) => void): Unsubscribe {
        return onSnapshot(doc(db, PARTNER_RECOGNITION_COLLECTIONS.jobs, jobId), (snapshot) => {
            callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PartnerRecognitionJob) : null);
        });
    },

    subscribeImages(jobId: string, callback: (images: PartnerRecognitionImage[]) => void): Unsubscribe {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.images),
            where('jobId', '==', jobId),
            orderBy('createdAt', 'asc'),
        );
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PartnerRecognitionImage)));
        });
    },

    subscribeResults(jobId: string, callback: (items: PartnerRecognitionResult[]) => void): Unsubscribe {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.results),
            where('jobId', '==', jobId),
            orderBy('createdAt', 'asc'),
        );
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PartnerRecognitionResult)));
        });
    },

    async updateResultReview(resultId: string, patch: PartnerRecognitionReviewPatch): Promise<void> {
        if (!resultId) throw new Error('결과 ID가 없습니다.');
        const cleaned = cleanObject({
            ...patch,
            updatedAt: serverTimestamp(),
        } as Record<string, unknown>);
        await updateDoc(doc(db, PARTNER_RECOGNITION_COLLECTIONS.results, resultId), cleaned);
    },

    async excludeResult(resultId: string, reason: string): Promise<void> {
        await this.updateResultReview(resultId, {
            status: 'excluded',
            excludeReason: reason || '사용자 제외',
        });
    },

    async requestCompanyMaster(result: PartnerRecognitionResult): Promise<string> {
        const user = getCurrentUserOrThrow();
        if (!result.id) throw new Error('결과 ID가 없습니다.');
        const requestRef = doc(collection(db, PARTNER_RECOGNITION_COLLECTIONS.companyRequests));
        await setDoc(requestRef, cleanObject({
            jobId: result.jobId,
            resultId: result.id,
            requestedCompanyName: result.reviewed.companyName || result.extracted.companyName,
            extracted: {
                ...result.extracted,
                ...result.reviewed,
            },
            status: 'pending',
            createdByUid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }));
        await this.updateResultReview(result.id, {
            status: 'no_match',
            excludeReason: '통합DB 신규 등록 요청',
        });
        return requestRef.id;
    },

    async commitResults(input: CommitInput): Promise<PartnerRecognitionCommitResult> {
        const callable = httpsCallable<CommitInput, PartnerRecognitionCommitResult>(
            functions,
            'commitPartnerRecognitionResults',
        );
        const result = await callable(input);
        return result.data;
    },

    async getCompanyContacts(companyId: string): Promise<BusinessContact[]> {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.contacts),
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessContact));
    },

    async listContacts(filters: ContactListFilters = {}): Promise<BusinessContact[]> {
        const maxCount = Math.max(20, Math.min(filters.maxCount || 500, 1000));
        const baseCollection = collection(db, PARTNER_RECOGNITION_COLLECTIONS.contacts);
        const q = filters.companyId
            ? query(
                baseCollection,
                where('companyId', '==', filters.companyId),
                orderBy('createdAt', 'desc'),
                limit(maxCount),
            )
            : query(baseCollection, orderBy('createdAt', 'desc'), limit(maxCount));

        const snapshot = await getDocs(q);
        const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessContact));
        const term = normalizeSearchText(filters.searchTerm);
        if (!term) return rows;

        return rows.filter((contact) => {
            const haystack = normalizeSearchText([
                contact.name,
                contact.companyName,
                contact.department,
                contact.position,
                contact.mobile,
                contact.phone,
                contact.email,
                contact.memo,
                ...(contact.tags || []),
            ].filter(Boolean).join(' '));
            return haystack.includes(term);
        });
    },

    subscribeContacts(callback: (contacts: BusinessContact[]) => void, maxCount = 500): Unsubscribe {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.contacts),
            orderBy('createdAt', 'desc'),
            limit(maxCount),
        );
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessContact)));
        });
    },

    subscribeCardImages(callback: (cards: BusinessCardImage[]) => void, maxCount = 1000): Unsubscribe {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.cardImages),
            orderBy('createdAt', 'desc'),
            limit(maxCount),
        );
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessCardImage)));
        });
    },

    async upsertContact(input: ContactUpsertInput): Promise<string> {
        const user = getCurrentUserOrThrow();
        const contactRef = input.id
            ? doc(db, PARTNER_RECOGNITION_COLLECTIONS.contacts, input.id)
            : doc(collection(db, PARTNER_RECOGNITION_COLLECTIONS.contacts));
        const payload = cleanObject({
            companyId: input.companyId,
            companyName: input.companyName,
            name: input.name || '이름 미상',
            department: input.department || '',
            position: input.position || '',
            mobile: input.mobile || '',
            phone: input.phone || '',
            email: input.email || '',
            memo: input.memo || '',
            tags: input.tags || [],
            source: input.source || 'manual',
            sourceJobId: input.sourceJobId,
            sourceResultId: input.sourceResultId,
            createdByUid: input.id ? undefined : user.uid,
            createdAt: input.id ? undefined : serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await setDoc(contactRef, payload, { merge: true });
        return contactRef.id;
    },

    async deleteContact(contactId: string): Promise<void> {
        if (!contactId) throw new Error('담당자 ID가 없습니다.');
        await deleteDoc(doc(db, PARTNER_RECOGNITION_COLLECTIONS.contacts, contactId));
    },

    async getCompanyCardImages(companyId: string): Promise<BusinessCardImage[]> {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.cardImages),
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessCardImage));
    },

    async getContactCardImages(contactId: string): Promise<BusinessCardImage[]> {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.cardImages),
            where('contactId', '==', contactId),
            orderBy('createdAt', 'desc'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessCardImage));
    },

    async getContactHistories(contactId: string): Promise<BusinessContactHistory[]> {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.contactHistories),
            where('contactId', '==', contactId),
            orderBy('happenedAt', 'desc'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessContactHistory));
    },

    async addContactHistory(input: HistoryInput): Promise<string> {
        const user = getCurrentUserOrThrow();
        const historyRef = doc(collection(db, PARTNER_RECOGNITION_COLLECTIONS.contactHistories));
        await setDoc(historyRef, cleanObject({
            ...input,
            createdByUid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }));
        return historyRef.id;
    },

    async getContactFollowUps(contactId: string): Promise<BusinessContactFollowUp[]> {
        const q = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.followUps),
            where('contactId', '==', contactId),
            orderBy('dueDate', 'asc'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BusinessContactFollowUp));
    },

    async addContactFollowUp(input: FollowUpInput): Promise<string> {
        const user = getCurrentUserOrThrow();
        const followUpRef = doc(collection(db, PARTNER_RECOGNITION_COLLECTIONS.followUps));
        await setDoc(followUpRef, cleanObject({
            ...input,
            status: 'open',
            createdByUid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }));
        return followUpRef.id;
    },

    async updateFollowUpStatus(followUpId: string, status: BusinessContactFollowUp['status']): Promise<void> {
        await updateDoc(doc(db, PARTNER_RECOGNITION_COLLECTIONS.followUps, followUpId), cleanObject({
            status,
            completedAt: status === 'done' ? serverTimestamp() : undefined,
            updatedAt: serverTimestamp(),
        }));
    },

    findDuplicateContacts(contacts: BusinessContact[]): Array<{ key: string; contacts: BusinessContact[]; reason: string }> {
        const groups = new Map<string, { contacts: BusinessContact[]; reason: string }>();
        const addGroup = (key: string, reason: string, contact: BusinessContact) => {
            if (!key) return;
            const existing = groups.get(key) || { contacts: [], reason };
            if (!existing.contacts.some((item) => item.id === contact.id)) {
                existing.contacts.push(contact);
            }
            groups.set(key, existing);
        };

        contacts.forEach((contact) => {
            const companyKey = contact.companyId || contact.companyName;
            const mobile = String(contact.mobile || '').replace(/\D/g, '');
            const email = String(contact.email || '').trim().toLowerCase();
            const namePosition = normalizeSearchText(`${companyKey}:${contact.name}:${contact.position || ''}`);
            if (companyKey && mobile) addGroup(`mobile:${companyKey}:${mobile}`, '같은 회사와 휴대폰', contact);
            if (email) addGroup(`email:${email}`, '같은 이메일', contact);
            if (companyKey && contact.name) addGroup(`name:${namePosition}`, '같은 회사/이름/직책', contact);
        });

        return Array.from(groups.entries())
            .filter(([, group]) => group.contacts.length > 1)
            .map(([key, group]) => ({ key, ...group }));
    },

    async mergeContacts(primaryContactId: string, duplicateContactId: string): Promise<void> {
        if (!primaryContactId || !duplicateContactId || primaryContactId === duplicateContactId) {
            throw new Error('병합할 담당자를 올바르게 선택해 주세요.');
        }

        const batch = writeBatch(db);
        const [cardImages, histories, followUps] = await Promise.all([
            getDocs(query(
                collection(db, PARTNER_RECOGNITION_COLLECTIONS.cardImages),
                where('contactId', '==', duplicateContactId),
            )),
            getDocs(query(
                collection(db, PARTNER_RECOGNITION_COLLECTIONS.contactHistories),
                where('contactId', '==', duplicateContactId),
            )),
            getDocs(query(
                collection(db, PARTNER_RECOGNITION_COLLECTIONS.followUps),
                where('contactId', '==', duplicateContactId),
            )),
        ]);

        cardImages.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, { contactId: primaryContactId });
        });
        histories.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, { contactId: primaryContactId, updatedAt: serverTimestamp() });
        });
        followUps.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, { contactId: primaryContactId, updatedAt: serverTimestamp() });
        });
        batch.delete(doc(db, PARTNER_RECOGNITION_COLLECTIONS.contacts, duplicateContactId));
        batch.update(doc(db, PARTNER_RECOGNITION_COLLECTIONS.contacts, primaryContactId), {
            updatedAt: serverTimestamp(),
        });
        await batch.commit();
    },

    async getCompanyRelationships(companyId: string): Promise<CompanyRelationship[]> {
        const outgoingQuery = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.relationships),
            where('sourceCompanyId', '==', companyId),
            orderBy('createdAt', 'desc'),
        );
        const incomingQuery = query(
            collection(db, PARTNER_RECOGNITION_COLLECTIONS.relationships),
            where('targetCompanyId', '==', companyId),
            orderBy('createdAt', 'desc'),
        );
        const [outgoing, incoming] = await Promise.all([getDocs(outgoingQuery), getDocs(incomingQuery)]);
        const byId = new Map<string, CompanyRelationship>();
        [...outgoing.docs, ...incoming.docs].forEach((docSnap) => {
            byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as CompanyRelationship);
        });
        return Array.from(byId.values());
    },
};
