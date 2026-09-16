import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface ServerAiSettingsStatus {
    configured: boolean;
    maskedApiKey: string;
    model: string;
    documentModel: string;
    batchModel: string;
    excelConversionModel: string;
    excelConversionThinking: 'low' | 'medium' | 'high';
    updatedAt: string;
    updatedByUid: string;
}

export interface SaveServerAiSettingsInput {
    apiKey?: string;
    model: string;
    documentModel: string;
    batchModel: string;
    excelConversionModel?: string;
    excelConversionThinking?: 'low' | 'medium' | 'high';
    clearApiKey?: boolean;
}

const DEFAULT_STATUS: ServerAiSettingsStatus = {
    configured: false,
    maskedApiKey: '',
    model: 'gemini-2.5-flash',
    documentModel: 'gemini-2.5-flash',
    batchModel: 'gemini-2.5-flash',
    excelConversionModel: 'gemini-3.8-flash',
    excelConversionThinking: 'medium',
    updatedAt: '',
    updatedByUid: '',
};

export const serverAiSettingsService = {
    async getStatus(): Promise<ServerAiSettingsStatus> {
        const callable = httpsCallable<void, ServerAiSettingsStatus>(functions, 'getServerAiSettingsStatus');
        const result = await callable();
        return { ...DEFAULT_STATUS, ...(result.data || {}) };
    },

    async save(input: SaveServerAiSettingsInput): Promise<ServerAiSettingsStatus> {
        const callable = httpsCallable<SaveServerAiSettingsInput, ServerAiSettingsStatus>(
            functions,
            'saveServerAiSettings',
        );
        const result = await callable(input);
        return { ...DEFAULT_STATUS, ...(result.data || {}) };
    },
};
