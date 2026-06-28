import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { requireCallableAuth } from './auth';
import { getServerGeminiSettings } from './serverAiSettings';

declare const fetch: any;

type PartnerRecognitionResultStatus =
    | 'extracted'
    | 'auto_matched'
    | 'needs_review'
    | 'no_match'
    | 'excluded'
    | 'committed'
    | 'failed';

type CompanyRelationshipType = string;

interface ExtractedPartnerContact {
    sourceKind: string;
    companyName: string;
    companyNameAliases: string[];
    businessNumber: string;
    personName: string;
    department: string;
    position: string;
    mobile: string;
    phone: string;
    fax: string;
    email: string;
    address: string;
    website: string;
    businessCategories: string[];
    companyTypeGuess: string[];
    memo: string;
    overallConfidence: number;
    warnings: string[];
    rawText: string;
}

interface CompanyCandidate {
    id: string;
    name: string;
    type?: string;
    businessNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
}

interface MatchCandidate {
    companyId: string;
    companyName: string;
    companyType?: string;
    businessNumber?: string;
    phone?: string;
    address?: string;
    score: number;
    reasons: string[];
}

interface GeminiPartnerRecognitionOutput {
    imageQuality?: string;
    warnings?: string[];
    items?: ExtractedPartnerContact[];
}

const COLLECTIONS = {
    jobs: 'partnerRecognitionJobs',
    images: 'partnerRecognitionImages',
    results: 'partnerRecognitionResults',
    contacts: 'businessContacts',
    cardImages: 'businessCardImages',
    relationships: 'companyRelationships',
    companies: 'companies',
} as const;

const PARTNER_RECOGNITION_SCHEMA = {
    type: 'object',
    properties: {
        imageQuality: { type: 'string' },
        warnings: { type: 'array', items: { type: 'string' } },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    sourceKind: { type: 'string' },
                    companyName: { type: 'string' },
                    companyNameAliases: { type: 'array', items: { type: 'string' } },
                    businessNumber: { type: 'string' },
                    personName: { type: 'string' },
                    department: { type: 'string' },
                    position: { type: 'string' },
                    mobile: { type: 'string' },
                    phone: { type: 'string' },
                    fax: { type: 'string' },
                    email: { type: 'string' },
                    address: { type: 'string' },
                    website: { type: 'string' },
                    businessCategories: { type: 'array', items: { type: 'string' } },
                    companyTypeGuess: { type: 'array', items: { type: 'string' } },
                    memo: { type: 'string' },
                    overallConfidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                    rawText: { type: 'string' },
                },
                required: [
                    'sourceKind',
                    'companyName',
                    'companyNameAliases',
                    'businessNumber',
                    'personName',
                    'department',
                    'position',
                    'mobile',
                    'phone',
                    'fax',
                    'email',
                    'address',
                    'website',
                    'businessCategories',
                    'companyTypeGuess',
                    'memo',
                    'overallConfidence',
                    'warnings',
                    'rawText',
                ],
                propertyOrdering: [
                    'sourceKind',
                    'companyName',
                    'companyNameAliases',
                    'businessNumber',
                    'personName',
                    'department',
                    'position',
                    'mobile',
                    'phone',
                    'fax',
                    'email',
                    'address',
                    'website',
                    'businessCategories',
                    'companyTypeGuess',
                    'memo',
                    'overallConfidence',
                    'warnings',
                    'rawText',
                ],
            },
        },
    },
    required: ['imageQuality', 'warnings', 'items'],
    propertyOrdering: ['imageQuality', 'warnings', 'items'],
};

const db = admin.firestore();
const bucket = admin.storage().bucket();

const getGeminiApiKey = async (): Promise<string> => {
    const settings = await getServerGeminiSettings();
    const key = settings.apiKey || '';
    if (!key) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '/settings/ai에서 서버용 Gemini API Key를 설정해 주세요.'
        );
    }
    return key;
};

const getGeminiModel = async (): Promise<string> => {
    const settings = await getServerGeminiSettings();
    return settings.model || 'gemini-2.5-flash';
};

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error || '알 수 없는 오류');

const toHttpsError = (
    error: unknown,
    fallbackCode: functions.https.FunctionsErrorCode = 'internal'
): functions.https.HttpsError => {
    if (error instanceof functions.https.HttpsError) {
        return error;
    }
    return new functions.https.HttpsError(fallbackCode, getErrorMessage(error));
};

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
};

const parseJsonObject = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch {
        const objectStart = text.indexOf('{');
        const objectEnd = text.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            return JSON.parse(text.slice(objectStart, objectEnd + 1));
        }
        throw new Error('Gemini 응답 JSON을 파싱할 수 없습니다.');
    }
};

const buildPrompt = (): string => `
You extract Korean B2B construction partner information from the attached image.
The image may contain one business card, multiple business cards, a company document,
a participant list, a catalog, a signboard, or a phone contact screenshot.
Some uploaded business card photos may be sideways, upside down, or tightly cropped.
Mentally rotate the image as needed before reading text.

Rules:
- Return only JSON matching the response schema.
- Do not invent values. Use an empty string when a field is not visible.
- If multiple business cards or contacts are visible, return one item per person/company.
- Preserve visible Korean text. Do not translate company names or person names.
- Normalize phone numbers only by keeping digits and hyphens when visible.
- sourceKind must be one of business_card, company_document, contact_screen, participant_list, unknown.
- companyTypeGuess must use only 건설사, 협력사, 임대사, 자재사, 설계, 감리, 기타.
- overallConfidence must be a number from 0 to 1.
- Add warnings for unreadable fields, multiple possible companies, or low confidence.
`;

const downloadStorageFileAsBase64 = async (
    storagePath: string,
    fallbackMimeType?: string
): Promise<{ base64: string; mimeType: string }> => {
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
        base64: buffer.toString('base64'),
        mimeType: String(metadata.contentType || fallbackMimeType || 'image/jpeg'),
    };
};

const buildGeminiGenerateContentRequest = (image: { base64: string; mimeType: string }): Record<string, unknown> => ({
    contents: [{
        role: 'user',
        parts: [
            { text: buildPrompt() },
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
        ],
    }],
    generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: PARTNER_RECOGNITION_SCHEMA,
    },
});

const callGeminiPartnerRecognition = async (
    image: { base64: string; mimeType: string }
): Promise<GeminiPartnerRecognitionOutput> => {
    const apiKey = await getGeminiApiKey();
    const model = await getGeminiModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGeminiGenerateContentRequest(image)),
    });

    const rawText = await response.text();
    let payload: any = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch {
        payload = null;
    }

    if (!response.ok || payload?.error) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`;
        functions.logger.error('Gemini partner recognition failed', { status: response.status, message, rawText });
        throw new Error(message);
    }

    const text = extractGeminiText(payload);
    if (!text) {
        throw new Error('Gemini 응답이 비어 있습니다.');
    }

    const parsed = parseJsonObject(text) as GeminiPartnerRecognitionOutput;
    return {
        imageQuality: parsed.imageQuality || '',
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
    };
};

const asString = (value: unknown): string => String(value || '').trim();

const sanitizeExtracted = (item: Partial<ExtractedPartnerContact>): ExtractedPartnerContact => ({
    sourceKind: asString(item.sourceKind) || 'unknown',
    companyName: asString(item.companyName),
    companyNameAliases: Array.isArray(item.companyNameAliases) ? item.companyNameAliases.map(asString).filter(Boolean) : [],
    businessNumber: asString(item.businessNumber),
    personName: asString(item.personName),
    department: asString(item.department),
    position: asString(item.position),
    mobile: asString(item.mobile),
    phone: asString(item.phone),
    fax: asString(item.fax),
    email: asString(item.email).toLowerCase(),
    address: asString(item.address),
    website: asString(item.website),
    businessCategories: Array.isArray(item.businessCategories) ? item.businessCategories.map(asString).filter(Boolean) : [],
    companyTypeGuess: Array.isArray(item.companyTypeGuess) ? item.companyTypeGuess.map(asString).filter(Boolean) : [],
    memo: asString(item.memo),
    overallConfidence: Math.max(0, Math.min(1, Number(item.overallConfidence) || 0)),
    warnings: Array.isArray(item.warnings) ? item.warnings.map(asString).filter(Boolean) : [],
    rawText: asString(item.rawText),
});

const normalizeDigits = (value: string): string => String(value || '').replace(/\D/g, '');

const normalizeCompanyName = (value: string): string =>
    String(value || '')
        .toLowerCase()
        .replace(/\(주\)|㈜|주식회사|유한회사|합자회사|합명회사/g, '')
        .replace(/[^가-힣a-z0-9]/g, '')
        .trim();

const emailDomain = (value: string): string => {
    const parts = String(value || '').toLowerCase().split('@');
    return parts.length > 1 ? parts[1].trim() : '';
};

const bigrams = (value: string): Set<string> => {
    const text = normalizeCompanyName(value);
    if (text.length <= 1) return new Set(text ? [text] : []);
    const set = new Set<string>();
    for (let i = 0; i < text.length - 1; i += 1) {
        set.add(text.slice(i, i + 2));
    }
    return set;
};

const similarity = (a: string, b: string): number => {
    const left = bigrams(a);
    const right = bigrams(b);
    if (left.size === 0 || right.size === 0) return 0;
    let intersection = 0;
    left.forEach((value) => {
        if (right.has(value)) intersection += 1;
    });
    const union = new Set([...Array.from(left), ...Array.from(right)]).size;
    return union ? intersection / union : 0;
};

const loadCompanyCandidates = async (): Promise<CompanyCandidate[]> => {
    const snapshot = await db.collection(COLLECTIONS.companies).get();
    return snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return {
            id: doc.id,
            name: asString(data.name),
            type: asString(data.type),
            businessNumber: asString(data.businessNumber || data.corpNum),
            phone: asString(data.phone),
            email: asString(data.email),
            address: asString(data.address),
        };
    }).filter((company) => company.name);
};

const buildMatchCandidates = (
    extracted: ExtractedPartnerContact,
    companies: CompanyCandidate[]
): MatchCandidate[] => {
    const extractedNames = [extracted.companyName, ...extracted.companyNameAliases].map(normalizeCompanyName).filter(Boolean);
    const extractedBusinessNumber = normalizeDigits(extracted.businessNumber);
    const extractedPhones = [extracted.phone, extracted.mobile].map(normalizeDigits).filter(Boolean);
    const extractedDomain = emailDomain(extracted.email);
    const guesses = new Set(extracted.companyTypeGuess.map((guess) => guess.trim()));

    return companies
        .map((company) => {
            const reasons: string[] = [];
            let score = 0;

            const companyBusinessNumber = normalizeDigits(company.businessNumber || '');
            if (extractedBusinessNumber && companyBusinessNumber && extractedBusinessNumber === companyBusinessNumber) {
                score += 100;
                reasons.push('사업자번호 일치');
            }

            const companyPhone = normalizeDigits(company.phone || '');
            if (companyPhone && extractedPhones.some((phone) => phone === companyPhone)) {
                score += 35;
                reasons.push('전화번호 일치');
            }

            const companyDomain = emailDomain(company.email || '');
            if (extractedDomain && companyDomain && extractedDomain === companyDomain) {
                score += 15;
                reasons.push('이메일 도메인 일치');
            }

            const companyName = normalizeCompanyName(company.name);
            const hasExactName = extractedNames.some((name) => name === companyName);
            if (hasExactName) {
                score += 45;
                reasons.push('회사명 일치');
            } else if (extractedNames.some((name) => name && companyName && (name.includes(companyName) || companyName.includes(name)))) {
                score += 30;
                reasons.push('회사명 포함');
            } else {
                const maxSimilarity = Math.max(0, ...extractedNames.map((name) => similarity(name, company.name)));
                const similarityScore = Math.round(maxSimilarity * 30);
                if (similarityScore >= 10) {
                    score += similarityScore;
                    reasons.push(`회사명 유사도 ${similarityScore}`);
                }
            }

            if (extracted.address && company.address) {
                const addressTokens = extracted.address.split(/\s+/).slice(0, 3).filter((token) => token.length >= 2);
                if (addressTokens.some((token) => company.address?.includes(token))) {
                    score += 10;
                    reasons.push('주소 일부 일치');
                }
            }

            if (company.type && guesses.has(company.type)) {
                score += 5;
                reasons.push('회사 유형 일치');
            }

            return {
                companyId: company.id,
                companyName: company.name,
                companyType: company.type,
                businessNumber: company.businessNumber,
                phone: company.phone,
                address: company.address,
                score,
                reasons,
            };
        })
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
};

const decideStatus = (candidates: MatchCandidate[]): PartnerRecognitionResultStatus => {
    const top = candidates[0]?.score || 0;
    const second = candidates[1]?.score || 0;
    const topReasons = new Set(candidates[0]?.reasons || []);
    const hasStrongIdentityMatch =
        topReasons.has('사업자번호 일치')
        || topReasons.has('회사명 일치');

    if (top >= 85 && top - second >= 15) return 'auto_matched';
    if (hasStrongIdentityMatch && top >= 45 && top - second >= 25) return 'auto_matched';
    if (top >= 30) return 'needs_review';
    return 'no_match';
};

const findDuplicateContact = async (
    companyId: string,
    extracted: ExtractedPartnerContact
): Promise<{ id: string; warning: string } | null> => {
    const companySnapshot = await db.collection(COLLECTIONS.contacts)
        .where('companyId', '==', companyId)
        .get();

    const mobile = normalizeDigits(extracted.mobile);
    const email = extracted.email.toLowerCase();
    const personName = extracted.personName.trim();
    const position = extracted.position.trim();

    for (const doc of companySnapshot.docs) {
        const data = doc.data() || {};
        if (mobile && normalizeDigits(data.mobile || '') === mobile) {
            return { id: doc.id, warning: '같은 회사와 휴대폰의 기존 담당자가 있습니다.' };
        }
        if (email && String(data.email || '').toLowerCase() === email) {
            return { id: doc.id, warning: '같은 이메일의 기존 담당자가 있습니다.' };
        }
        if (
            personName &&
            String(data.name || '').trim() === personName &&
            (!position || String(data.position || '').trim() === position)
        ) {
            return { id: doc.id, warning: '같은 회사와 이름의 기존 담당자가 있습니다.' };
        }
    }

    if (email) {
        const emailSnapshot = await db.collection(COLLECTIONS.contacts)
            .where('email', '==', email)
            .limit(1)
            .get();
        if (!emailSnapshot.empty) {
            return { id: emailSnapshot.docs[0].id, warning: '같은 이메일의 기존 담당자가 있습니다.' };
        }
    }

    return null;
};

const saveRecognitionResultsForImage = async (
    jobId: string,
    imageDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
    image: FirebaseFirestore.DocumentData,
    geminiResult: GeminiPartnerRecognitionOutput,
    companies: CompanyCandidate[],
    uid: string,
    deterministicIds = false
): Promise<number> => {
    const items = (geminiResult.items || []).map(sanitizeExtracted);
    let resultCount = 0;

    for (const item of items) {
        const resultRef = deterministicIds
            ? db.collection(COLLECTIONS.results).doc(`${imageDoc.id}_${resultCount}`)
            : db.collection(COLLECTIONS.results).doc();
        if (deterministicIds) {
            const existingResult = await resultRef.get();
            if (existingResult.exists) {
                resultCount += 1;
                continue;
            }
        }
        const candidates = buildMatchCandidates(item, companies);
        const status = decideStatus(candidates);
        const top = candidates[0];
        const selectedCompanyId = status === 'auto_matched' ? top?.companyId : '';
        const selectedCompanyName = status === 'auto_matched' ? top?.companyName : '';
        const duplicate = selectedCompanyId ? await findDuplicateContact(selectedCompanyId, item) : null;

        await resultRef.set({
            jobId,
            imageId: imageDoc.id,
            imageStoragePath: image.storagePath || '',
            imageDownloadUrl: image.downloadUrl || '',
            status,
            extracted: item,
            reviewed: {},
            selectedCompanyId,
            selectedCompanyName,
            matchScore: top?.score || 0,
            matchReasons: top?.reasons || [],
            candidates,
            duplicateContactId: duplicate?.id || '',
            duplicateWarning: duplicate?.warning || '',
            createdByUid: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: deterministicIds });
        resultCount += 1;
    }

    return resultCount;
};

const recalculateJobCounters = async (jobId: string, nextStatus?: string): Promise<void> => {
    const [imagesSnapshot, resultsSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.images).where('jobId', '==', jobId).get(),
        db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get(),
    ]);

    const counters = {
        totalImages: imagesSnapshot.size,
        processedImages: imagesSnapshot.docs.filter((doc) => ['completed', 'failed'].includes(String(doc.data().status))).length,
        totalItems: resultsSnapshot.size,
        autoMatchedItems: 0,
        needsReviewItems: 0,
        noMatchItems: 0,
        excludedItems: 0,
        committedItems: 0,
        errorItems: imagesSnapshot.docs.filter((doc) => String(doc.data().status) === 'failed').length,
    };

    resultsSnapshot.docs.forEach((doc) => {
        const status = String(doc.data().status);
        if (status === 'auto_matched') counters.autoMatchedItems += 1;
        if (status === 'needs_review') counters.needsReviewItems += 1;
        if (status === 'no_match') counters.noMatchItems += 1;
        if (status === 'excluded') counters.excludedItems += 1;
        if (status === 'committed') counters.committedItems += 1;
        if (status === 'failed') counters.errorItems += 1;
    });

    await db.collection(COLLECTIONS.jobs).doc(jobId).set({
        ...counters,
        ...(nextStatus ? { status: nextStatus } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(nextStatus === 'completed' ? { completedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    }, { merge: true });
};

const markRecognitionImagesFailed = async (
    jobRef: FirebaseFirestore.DocumentReference,
    images: FirebaseFirestore.QueryDocumentSnapshot[],
    message: string
): Promise<void> => {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await Promise.all([
        jobRef.set({
            status: 'failed',
            errorMessage: message,
            updatedAt: now,
        }, { merge: true }),
        ...images.map((imageDoc) => imageDoc.ref.set({
            status: 'failed',
            errorMessage: message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })),
    ]);
};

const getGeminiBatchModel = async (): Promise<string> => {
    const settings = await getServerGeminiSettings();
    return settings.batchModel || settings.model || 'gemini-2.5-flash';
};

const parseGeminiJsonPayload = (responsePayload: any): GeminiPartnerRecognitionOutput => {
    const text = extractGeminiText(responsePayload);
    if (!text) {
        throw new Error('Gemini Batch 응답이 비어 있습니다.');
    }
    const parsed = parseJsonObject(text) as GeminiPartnerRecognitionOutput;
    return {
        imageQuality: parsed.imageQuality || '',
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
    };
};

const getBatchResource = (payload: any): any => payload?.response || payload?.metadata || payload || {};

const extractBatchState = (payload: any): string => {
    const resource = getBatchResource(payload);
    return String(resource.state || payload?.state || (payload?.done ? 'JOB_STATE_SUCCEEDED' : 'JOB_STATE_PENDING'));
};

const isBatchDone = (state: string): boolean =>
    ['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(state);

const callGeminiBatchCreate = async (
    requests: Array<Record<string, unknown>>,
    displayName: string
): Promise<any> => {
    const apiKey = await getGeminiApiKey();
    const model = await getGeminiBatchModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchGenerateContent?key=${apiKey}`;
    const body = {
        batch: {
            displayName,
            inputConfig: {
                requests: { requests },
            },
        },
    };

    const bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    if (bodySize > 18 * 1024 * 1024) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Gemini Batch inline 요청이 18MB를 초과했습니다. 사진 수를 나눠 올리거나 2차 파일 업로드 방식으로 전환해야 합니다.'
        );
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const rawText = await response.text();
    const payload = rawText ? JSON.parse(rawText) : {};

    if (!response.ok || payload?.error) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`;
        functions.logger.error('Gemini batch create failed', { status: response.status, message, rawText });
        throw new Error(message);
    }

    return payload;
};

const callGeminiBatchGet = async (batchName: string): Promise<any> => {
    const apiKey = await getGeminiApiKey();
    const normalized = batchName.replace(/^\/+/, '');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${normalized}?key=${apiKey}`;

    const response = await fetch(endpoint);
    const rawText = await response.text();
    const payload = rawText ? JSON.parse(rawText) : {};

    if (!response.ok || payload?.error) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`;
        functions.logger.error('Gemini batch get failed', { status: response.status, message, rawText, batchName });
        throw new Error(message);
    }

    return payload;
};

export const createPartnerRecognitionBatchJob = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const auth = requireCallableAuth(context);
        const jobId = asString(data?.jobId);
        const imageIds = Array.isArray(data?.imageIds) ? data.imageIds.map(asString).filter(Boolean) : [];

        if (!jobId) {
            throw new functions.https.HttpsError('invalid-argument', 'jobId가 필요합니다.');
        }

        const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) {
            throw new functions.https.HttpsError('not-found', '인식 작업을 찾을 수 없습니다.');
        }

        const imageSnapshot = await db.collection(COLLECTIONS.images).where('jobId', '==', jobId).get();
        const images = imageSnapshot.docs
            .filter((doc) => imageIds.length === 0 || imageIds.includes(doc.id))
            .filter((doc) => String(doc.data().status) !== 'completed');

        if (images.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Batch 분석할 미처리 사진이 없습니다.');
        }

        try {
            await getGeminiApiKey();
        } catch (error) {
            const message = getErrorMessage(error);
            await markRecognitionImagesFailed(jobRef, images, message);
            await recalculateJobCounters(jobId, 'failed');
            throw toHttpsError(error, 'failed-precondition');
        }

        const requests: Array<Record<string, unknown>> = [];
        for (const imageDoc of images) {
            const image = imageDoc.data();
            const base64Image = await downloadStorageFileAsBase64(
                String(image.storagePath || ''),
                String(image.mimeType || 'image/jpeg')
            );
            requests.push({
                request: buildGeminiGenerateContentRequest(base64Image),
                metadata: {
                    key: imageDoc.id,
                    imageId: imageDoc.id,
                    jobId,
                },
            });
        }

        let payload: any;
        try {
            payload = await callGeminiBatchCreate(requests, `partner-recognition-${jobId}`);
        } catch (error) {
            const message = getErrorMessage(error);
            await markRecognitionImagesFailed(jobRef, images, message);
            await recalculateJobCounters(jobId, 'failed');
            throw toHttpsError(error);
        }
        const resource = getBatchResource(payload);
        const batchModel = await getGeminiBatchModel();
        const batchName = asString(resource.name || payload.name);
        if (!batchName) {
            throw new Error('Gemini Batch 작업 이름을 확인할 수 없습니다.');
        }
        const batchState = extractBatchState(payload);

        const batch = db.batch();
        batch.set(jobRef, {
            status: 'queued',
            processingMode: 'batch',
            geminiBatchName: batchName,
            geminiBatchState: batchState,
            geminiBatchModel: batchModel,
            geminiBatchRequestCount: images.length,
            geminiBatchStats: resource.batchStats || {},
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            errorMessage: admin.firestore.FieldValue.delete(),
            createdBatchByUid: auth.uid,
        }, { merge: true });
        images.forEach((imageDoc) => {
            batch.set(imageDoc.ref, {
                status: 'analyzing',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                errorMessage: admin.firestore.FieldValue.delete(),
            }, { merge: true });
        });
        await batch.commit();

        return {
            success: true,
            batchName,
            state: batchState,
            requestCount: images.length,
        };
    });

export const syncPartnerRecognitionBatchJob = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const auth = requireCallableAuth(context);
        const jobId = asString(data?.jobId);

        if (!jobId) {
            throw new functions.https.HttpsError('invalid-argument', 'jobId가 필요합니다.');
        }

        const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) {
            throw new functions.https.HttpsError('not-found', '인식 작업을 찾을 수 없습니다.');
        }

        const job = jobSnap.data() || {};
        const batchName = asString(data?.batchName || job.geminiBatchName);
        if (!batchName) {
            throw new functions.https.HttpsError('failed-precondition', '동기화할 Gemini Batch 작업이 없습니다.');
        }

        const payload = await callGeminiBatchGet(batchName);
        const resource = getBatchResource(payload);
        const state = extractBatchState(payload);
        const done = isBatchDone(state);

        await jobRef.set({
            geminiBatchState: state,
            geminiBatchStats: resource.batchStats || {},
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(done && state !== 'JOB_STATE_SUCCEEDED' ? { status: 'failed', errorMessage: JSON.stringify(resource.error || payload.error || {}) } : {}),
        }, { merge: true });

        if (!done) {
            return { success: true, done: false, state, createdResults: 0 };
        }

        if (state !== 'JOB_STATE_SUCCEEDED') {
            await recalculateJobCounters(jobId, 'failed');
            return { success: false, done: true, state, createdResults: 0 };
        }

        const inlinedResponses = resource?.output?.inlinedResponses?.inlinedResponses || [];
        if (!Array.isArray(inlinedResponses) || inlinedResponses.length === 0) {
            await recalculateJobCounters(jobId, 'reviewing');
            return { success: true, done: true, state, createdResults: 0 };
        }

        const [imageSnapshot, companies] = await Promise.all([
            db.collection(COLLECTIONS.images).where('jobId', '==', jobId).get(),
            loadCompanyCandidates(),
        ]);
        const imageById = new Map(imageSnapshot.docs.map((doc) => [doc.id, doc]));
        let createdResults = 0;

        for (let index = 0; index < inlinedResponses.length; index += 1) {
            const inlined = inlinedResponses[index] || {};
            const metadata = inlined.metadata || {};
            const imageId = asString(metadata.imageId || metadata.key || imageSnapshot.docs[index]?.id);
            const imageDoc = imageById.get(imageId);
            if (!imageDoc) continue;

            if (inlined.error) {
                await imageDoc.ref.set({
                    status: 'failed',
                    errorMessage: inlined.error.message || JSON.stringify(inlined.error),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                continue;
            }

            try {
                const geminiResult = parseGeminiJsonPayload(inlined.response);
                const resultCount = await saveRecognitionResultsForImage(
                    jobId,
                    imageDoc,
                    imageDoc.data(),
                    geminiResult,
                    companies,
                    auth.uid,
                    true
                );
                createdResults += resultCount;
                await imageDoc.ref.set({
                    status: 'completed',
                    resultCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (error) {
                await imageDoc.ref.set({
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : String(error),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }

        await recalculateJobCounters(jobId, 'reviewing');
        return { success: true, done: true, state, createdResults };
    });

export const analyzePartnerRecognitionJob = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const auth = requireCallableAuth(context);
        const jobId = asString(data?.jobId);
        const imageIds = Array.isArray(data?.imageIds) ? data.imageIds.map(asString).filter(Boolean) : [];

        if (!jobId) {
            throw new functions.https.HttpsError('invalid-argument', 'jobId가 필요합니다.');
        }

        const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) {
            throw new functions.https.HttpsError('not-found', '인식 작업을 찾을 수 없습니다.');
        }

        await jobRef.set({
            status: 'analyzing',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            errorMessage: admin.firestore.FieldValue.delete(),
        }, { merge: true });

        const [imageSnapshot, companies] = await Promise.all([
            db.collection(COLLECTIONS.images).where('jobId', '==', jobId).get(),
            loadCompanyCandidates(),
        ]);

        const images = imageSnapshot.docs
            .filter((doc) => imageIds.length === 0 || imageIds.includes(doc.id))
            .filter((doc) => String(doc.data().status) !== 'completed');

        if (images.length > 0) {
            try {
                await getGeminiApiKey();
            } catch (error) {
                const message = getErrorMessage(error);
                await markRecognitionImagesFailed(jobRef, images, message);
                await recalculateJobCounters(jobId, 'failed');
                throw toHttpsError(error, 'failed-precondition');
            }
        }

        let failedImages = 0;
        let firstErrorMessage = '';

        for (const imageDoc of images) {
            const imageRef = imageDoc.ref;
            const image = imageDoc.data();
            try {
                await imageRef.set({
                    status: 'analyzing',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    errorMessage: admin.firestore.FieldValue.delete(),
                }, { merge: true });

                const base64Image = await downloadStorageFileAsBase64(
                    String(image.storagePath || ''),
                    String(image.mimeType || 'image/jpeg')
                );
                const geminiResult = await callGeminiPartnerRecognition(base64Image);
                const resultCount = await saveRecognitionResultsForImage(
                    jobId,
                    imageDoc,
                    image,
                    geminiResult,
                    companies,
                    auth.uid
                );

                await imageRef.set({
                    status: 'completed',
                    resultCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (error) {
                failedImages += 1;
                const message = getErrorMessage(error);
                if (!firstErrorMessage) firstErrorMessage = message;
                functions.logger.error('Partner recognition image failed', { jobId, imageId: imageDoc.id, error });
                await imageRef.set({
                    status: 'failed',
                    errorMessage: message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }

        const nextStatus = images.length > 0 && failedImages === images.length ? 'failed' : 'reviewing';
        await recalculateJobCounters(jobId, nextStatus);
        if (nextStatus === 'failed' && firstErrorMessage) {
            await jobRef.set({
                errorMessage: firstErrorMessage,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        return { success: true };
    });

export const rematchPartnerRecognitionResult = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        requireCallableAuth(context);
        const resultId = asString(data?.resultId);
        if (!resultId) {
            throw new functions.https.HttpsError('invalid-argument', 'resultId가 필요합니다.');
        }

        const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
        const resultSnap = await resultRef.get();
        if (!resultSnap.exists) {
            throw new functions.https.HttpsError('not-found', '인식 결과를 찾을 수 없습니다.');
        }

        const result = resultSnap.data() || {};
        const extracted = sanitizeExtracted({
            ...(result.extracted || {}),
            ...(result.reviewed || {}),
        });
        const companies = await loadCompanyCandidates();
        const candidates = buildMatchCandidates(extracted, companies);
        const status = decideStatus(candidates);
        const top = candidates[0];

        await resultRef.set({
            status,
            candidates,
            selectedCompanyId: status === 'auto_matched' ? top?.companyId || '' : result.selectedCompanyId || '',
            selectedCompanyName: status === 'auto_matched' ? top?.companyName || '' : result.selectedCompanyName || '',
            matchScore: top?.score || 0,
            matchReasons: top?.reasons || [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        await recalculateJobCounters(String(result.jobId || ''));
        return { success: true };
    });

const getEffectiveExtracted = (result: FirebaseFirestore.DocumentData): ExtractedPartnerContact =>
    sanitizeExtracted({
        ...(result.extracted || {}),
        ...(result.reviewed || {}),
    });

const commitOneResult = async (
    resultDoc: FirebaseFirestore.DocumentSnapshot,
    job: FirebaseFirestore.DocumentData,
    uid: string,
    createRelationships: boolean
): Promise<'committed' | 'skipped'> => {
    const result = resultDoc.data() || {};
    if (result.status === 'committed' || result.status === 'excluded' || result.status === 'failed') {
        return 'skipped';
    }

    const companyId = asString(result.selectedCompanyId);
    const companyName = asString(result.selectedCompanyName);
    if (!companyId || !companyName) {
        return 'skipped';
    }

    const extracted = getEffectiveExtracted(result);
    if (!extracted.personName && !extracted.mobile && !extracted.email && !extracted.companyName) {
        return 'skipped';
    }

    const duplicate = await findDuplicateContact(companyId, extracted);
    let contactId = duplicate?.id || '';

    const batch = db.batch();

    if (!contactId) {
        const contactRef = db.collection(COLLECTIONS.contacts).doc();
        contactId = contactRef.id;
        batch.set(contactRef, {
            companyId,
            companyName,
            name: extracted.personName || extracted.companyName || '이름 미상',
            department: extracted.department,
            position: extracted.position,
            mobile: extracted.mobile,
            phone: extracted.phone,
            email: extracted.email,
            memo: extracted.memo,
            tags: [],
            source: 'photo_recognition',
            sourceJobId: result.jobId,
            sourceResultId: resultDoc.id,
            createdByUid: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    const cardRef = db.collection(COLLECTIONS.cardImages).doc(resultDoc.id);
    batch.set(cardRef, {
        companyId,
        contactId,
        jobId: result.jobId,
        imageId: result.imageId,
        resultId: resultDoc.id,
        storagePath: result.imageStoragePath || '',
        downloadUrl: result.imageDownloadUrl || '',
        extractedRawText: extracted.rawText,
        createdByUid: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    let relationshipId = '';
    const sourceCompanyId = asString(job.baseCompanyId);
    const sourceCompanyName = asString(job.baseCompanyName);
    const relationshipType = asString(job.defaultRelationshipType) as CompanyRelationshipType || '협력사';
    if (createRelationships && sourceCompanyId && sourceCompanyId !== companyId) {
        relationshipId = `${sourceCompanyId}_${companyId}_${relationshipType}_${resultDoc.id}`
            .replace(/[^\w가-힣-]/g, '_')
            .slice(0, 140);
        const relationshipRef = db.collection(COLLECTIONS.relationships).doc(relationshipId);
        batch.set(relationshipRef, {
            sourceCompanyId,
            sourceCompanyName,
            targetCompanyId: companyId,
            targetCompanyName: companyName,
            relationshipType,
            tradeCategory: extracted.businessCategories?.[0] || '',
            siteId: job.defaultSiteId || '',
            siteName: job.defaultSiteName || '',
            status: 'active',
            sourceJobId: result.jobId,
            sourceResultId: resultDoc.id,
            memo: extracted.memo,
            createdByUid: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    batch.set(resultDoc.ref, {
        status: 'committed',
        committedContactId: contactId,
        committedCardImageId: cardRef.id,
        committedRelationshipId: relationshipId,
        duplicateContactId: duplicate?.id || result.duplicateContactId || '',
        duplicateWarning: duplicate?.warning || result.duplicateWarning || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    return 'committed';
};

export const commitPartnerRecognitionResults = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const auth = requireCallableAuth(context);
        const jobId = asString(data?.jobId);
        const resultIds = Array.isArray(data?.resultIds) ? data.resultIds.map(asString).filter(Boolean) : [];
        const createRelationships = Boolean(data?.createRelationships);

        if (!jobId) {
            throw new functions.https.HttpsError('invalid-argument', 'jobId가 필요합니다.');
        }
        if (resultIds.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', '확정할 결과가 없습니다.');
        }

        const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) {
            throw new functions.https.HttpsError('not-found', '인식 작업을 찾을 수 없습니다.');
        }
        const job = jobSnap.data() || {};

        await jobRef.set({
            status: 'committing',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        let committed = 0;
        let skipped = 0;
        let failed = 0;
        const errors: Array<{ resultId: string; message: string }> = [];

        for (const resultId of resultIds) {
            try {
                const resultDoc = await db.collection(COLLECTIONS.results).doc(resultId).get();
                if (!resultDoc.exists || String(resultDoc.data()?.jobId || '') !== jobId) {
                    skipped += 1;
                    continue;
                }
                const status = await commitOneResult(resultDoc, job, auth.uid, createRelationships);
                if (status === 'committed') committed += 1;
                else skipped += 1;
            } catch (error) {
                failed += 1;
                errors.push({
                    resultId,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }

        await recalculateJobCounters(jobId, failed > 0 ? 'reviewing' : 'completed');
        return { committed, skipped, failed, errors };
    });
