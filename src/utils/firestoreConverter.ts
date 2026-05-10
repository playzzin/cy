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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const stripUndefinedDeep = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value.map((child) => {
            const cleaned = stripUndefinedDeep(child);
            return cleaned === undefined ? null : cleaned;
        });
    }
    if (value instanceof Date || value instanceof Timestamp) {
        return value;
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, child]) => [key, stripUndefinedDeep(child)] as const)
                .filter(([, child]) => child !== undefined)
        );
    }
    return value;
};

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
        const cleanData = stripUndefinedDeep(rest) as Record<string, unknown>;
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
