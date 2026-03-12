import {
    FirestoreDataConverter,
    QueryDocumentSnapshot,
    SnapshotOptions,
    DocumentData,
    serverTimestamp,
    Timestamp,
    PartialWithFieldValue,
} from 'firebase/firestore';
import { z } from 'zod';
import { NormalizeNullable } from '../types/zod/typeUtils';

type ConvertedModel<T extends z.ZodTypeAny> = NormalizeNullable<z.input<T>>;

const normalizeFirestoreNulls = (value: unknown): unknown => {
    if (value === null) return undefined;
    if (Array.isArray(value)) {
        return value.map(normalizeFirestoreNulls);
    }
    if (value instanceof Date || value instanceof Timestamp) {
        return value;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, normalizeFirestoreNulls(child)])
        );
    }
    return value;
};

export const createConverter = <T extends z.ZodTypeAny>(_schema: T): FirestoreDataConverter<ConvertedModel<T>> => ({
    toFirestore(data: PartialWithFieldValue<ConvertedModel<T>>): DocumentData {
        const { id, ...rest } = data as Record<string, unknown>;
        const cleanData = Object.fromEntries(
            Object.entries(rest).filter(([_, v]) => v !== undefined)
        );
        return {
            ...cleanData,
            updatedAt: serverTimestamp(),
        };
    },
    fromFirestore(
        snapshot: QueryDocumentSnapshot,
        options: SnapshotOptions
    ): ConvertedModel<T> {
        const data = snapshot.data(options);
        return {
            ...(normalizeFirestoreNulls(data) as Record<string, unknown>),
            id: snapshot.id,
        } as ConvertedModel<T>;
    },
});
