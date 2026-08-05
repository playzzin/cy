import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { requireCallableAdmin } from './auth';

export interface ServerGeminiSettings {
    apiKey?: string;
    model: string;
    documentModel: string;
    batchModel: string;
    updatedAt?: FirebaseFirestore.Timestamp;
    updatedByUid?: string;
}

const SETTINGS_COLLECTION = 'server_settings';
const AI_SETTINGS_DOC = 'ai';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_DOCUMENT_MODEL = 'gemini-2.5-flash';

const db = admin.firestore();

const asString = (value: unknown): string => String(value || '').trim();

const maskApiKey = (apiKey: string): string => {
    const trimmed = asString(apiKey);
    if (!trimmed) return '';
    if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

const normalizeModel = (value: unknown, fallback = DEFAULT_GEMINI_MODEL): string => {
    const model = asString(value).replace(/^models\//, '');
    return model || fallback;
};

// Gemini 2.5 Pro is no longer available for new Gemini API users. Keep saved
// server settings from breaking document imports after the provider retirement.
const normalizeDocumentModel = (value: unknown): string => {
    const model = normalizeModel(value, DEFAULT_DOCUMENT_MODEL);
    return /^gemini-2\.5-pro(?:$|[-._:])/i.test(model)
        ? DEFAULT_DOCUMENT_MODEL
        : model;
};

const settingsRef = () => db.collection(SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC);

export const getServerGeminiSettings = async (): Promise<ServerGeminiSettings> => {
    const snap = await settingsRef().get();
    const data = snap.data() || {};
    const envApiKey = asString(
        process.env.GEMINI_API_KEY
        || process.env.GOOGLE_GENAI_API_KEY
        || process.env.GOOGLE_API_KEY
    );
    const apiKey = asString(data.apiKey) || envApiKey;
    const model = normalizeModel(data.model || process.env.GEMINI_MODEL);
    const documentModel = normalizeDocumentModel(
        data.documentModel || process.env.GEMINI_DOCUMENT_MODEL,
    );
    const batchModel = normalizeModel(data.batchModel || process.env.GEMINI_BATCH_MODEL || model, model);

    return {
        apiKey,
        model,
        documentModel,
        batchModel,
        updatedAt: data.updatedAt,
        updatedByUid: asString(data.updatedByUid),
    };
};

export const getServerAiSettingsStatus = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (_data, context) => {
        await requireCallableAdmin(context);
        const settings = await getServerGeminiSettings();

        return {
            configured: Boolean(settings.apiKey),
            maskedApiKey: maskApiKey(settings.apiKey || ''),
            model: settings.model,
            documentModel: settings.documentModel,
            batchModel: settings.batchModel,
            updatedAt: settings.updatedAt?.toDate?.().toISOString?.() || '',
            updatedByUid: settings.updatedByUid || '',
        };
    });

export const saveServerAiSettings = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const auth = await requireCallableAdmin(context);
        const patch: Record<string, unknown> = {
            model: normalizeModel(data?.model),
            documentModel: normalizeDocumentModel(data?.documentModel),
            batchModel: normalizeModel(data?.batchModel || data?.model),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUid: auth.uid,
        };

        const apiKey = asString(data?.apiKey);
        if (apiKey) {
            patch.apiKey = apiKey;
        }
        if (data?.clearApiKey === true) {
            patch.apiKey = admin.firestore.FieldValue.delete();
        }

        await settingsRef().set(patch, { merge: true });

        const settings = await getServerGeminiSettings();
        return {
            configured: Boolean(settings.apiKey),
            maskedApiKey: maskApiKey(settings.apiKey || ''),
            model: settings.model,
            documentModel: settings.documentModel,
            batchModel: settings.batchModel,
            updatedAt: new Date().toISOString(),
            updatedByUid: auth.uid,
        };
    });
