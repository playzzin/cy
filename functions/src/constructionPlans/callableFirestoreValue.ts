import { isUnknownRecord, type UnknownRecord } from './domain';

interface FirestoreTimestampLike {
    toDate: () => Date;
}

const firestoreTimestampIso = (value: unknown): string | undefined => {
    if (!isUnknownRecord(value) || typeof value.toDate !== 'function') return undefined;

    // Do not rely on `admin.firestore.Timestamp` being present on the namespace.
    // Firebase Admin versions and the Functions emulator can expose Timestamp from
    // different module copies, which makes a direct `instanceof` either unsafe or
    // false even though the snapshot value is a valid Firestore Timestamp.
    try {
        const date = (value as unknown as FirestoreTimestampLike).toDate();
        return date instanceof Date && Number.isFinite(date.getTime())
            ? date.toISOString()
            : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Converts values read from Firestore into the JSON-safe shape returned by
 * construction-plan callable functions. Timestamp detection is structural so
 * values remain compatible across Firebase Admin SDK module/version boundaries.
 */
export const callableFirestoreValue = (value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();

    const timestampIso = firestoreTimestampIso(value);
    if (timestampIso) return timestampIso;

    if (Array.isArray(value)) return value.map(callableFirestoreValue);
    if (isUnknownRecord(value)) {
        return Object.entries(value).reduce<UnknownRecord>((result, [key, item]) => {
            result[key] = callableFirestoreValue(item);
            return result;
        }, {});
    }
    return value;
};
