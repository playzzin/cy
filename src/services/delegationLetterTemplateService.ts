import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type DocumentData, type Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    DEFAULT_DELEGATION_BODY_TEXT,
    LEGACY_DELEGATION_BODY_TEXT,
    PREVIOUS_DELEGATION_BODY_TEXT,
} from '../constants/delegationLetter';

const SETTINGS_DOCUMENT_ID = 'delegation_letter_v2_public';

export interface DelegationLetterPublicTemplate {
    bodyText: string;
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const resolvePublicTemplate = (data: DocumentData | undefined): DelegationLetterPublicTemplate | null => {
    const bodyText = String(data?.bodyText ?? '').trim();
    if (!bodyText) return null;
    const normalizedBodyText = normalizeWhitespace(bodyText);
    const usesPreviousDefault = [
        LEGACY_DELEGATION_BODY_TEXT,
        PREVIOUS_DELEGATION_BODY_TEXT,
    ].some((previousText) => normalizeWhitespace(previousText) === normalizedBodyText);
    return {
        bodyText: usesPreviousDefault
            ? DEFAULT_DELEGATION_BODY_TEXT
            : bodyText,
    };
};

export const delegationLetterTemplateService = {
    getPublicTemplate: async (): Promise<DelegationLetterPublicTemplate | null> => {
        const snapshot = await getDoc(doc(db, 'settings', SETTINGS_DOCUMENT_ID));
        if (!snapshot.exists()) return null;
        return resolvePublicTemplate(snapshot.data());
    },

    subscribePublicTemplate: (
        onChange: (template: DelegationLetterPublicTemplate | null) => void,
        onError?: (error: Error) => void
    ): Unsubscribe => {
        return onSnapshot(
            doc(db, 'settings', SETTINGS_DOCUMENT_ID),
            (snapshot) => onChange(snapshot.exists() ? resolvePublicTemplate(snapshot.data()) : null),
            (error) => onError?.(error)
        );
    },

    savePublicTemplate: async (bodyText: string): Promise<void> => {
        const normalizedBodyText = String(bodyText ?? '').trim();
        if (!normalizedBodyText) return;
        await setDoc(doc(db, 'settings', SETTINGS_DOCUMENT_ID), {
            bodyText: normalizedBodyText,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    },
};
