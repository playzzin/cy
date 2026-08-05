import { createAuditLog, listAllAuditLogs } from './firestoreCrudCompat';
import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Timestamp } from '../types/timestamp';

export interface AuditLog {
    id?: string;
    action: string; // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT'
    category: string; // e.g., 'MANPOWER', 'SITE', 'SYSTEM', 'PAYROLL', 'AUTH'
    actorId: string;
    actorEmail: string;
    actorName?: string; // Optional nice name
    targetId?: string; // The ID of the object being modified
    targetName?: string; // Readable name of object
    details?: any; // JSON object for changed fields, before/after, etc.
    timestamp: Timestamp;
    ip?: string; // Optional
}

const generateId = (): string => {
    const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toTimestamp = (value: unknown): Timestamp => {
    if (!value) return Timestamp.now();
    if (value instanceof Timestamp) return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
    }
    return Timestamp.now();
};

const safeJsonParse = (raw: unknown): any => {
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return raw;
    try {
        return JSON.parse(trimmed);
    } catch {
        return raw;
    }
};

export const auditService = {
    // Write a log entry
    log: async (logData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
        try {
            await createAuditLog({
                id: generateId(),
                action: logData.action ?? null,
                category: logData.category ?? null,
                actorId: logData.actorId ?? null,
                actorEmail: logData.actorEmail ?? null,
                actorName: logData.actorName ?? null,
                targetId: logData.targetId ?? null,
                targetName: logData.targetName ?? null,
                details: logData.details !== undefined ? JSON.stringify(logData.details) : null,
                timestamp: new Date().toISOString()
            } as any);
            console.log(`[Audit] ${logData.category}:${logData.action} by ${logData.actorEmail}`);
        } catch (error) {
            console.error("Failed to write audit log", error);
            // Non-blocking error
        }
    },

    // Fetch logs with basic filtering
    getLogs: async (limitCount: number = 100, category?: string, actorId?: string): Promise<AuditLog[]> => {
        try {
            const fetchLimit = Math.min(Math.max(limitCount * 5, 200), 1000);
            const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc'), limit(fetchLimit)];
            if (category) constraints.unshift(where('category', '==', category));
            if (actorId) constraints.unshift(where('actorId', '==', actorId));

            // firestoreCrudCompat deliberately ignores ordering/filter arguments. A
            // direct query is required for log screens to show recent records.
            const snapshot = await getDocs(query(collection(db, 'audit_logs'), ...constraints));
            const rows: unknown[] = snapshot.docs.map((docSnapshot) => ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
            }));
            const logs: AuditLog[] = rows.map((row: any): AuditLog => {
                const rawTimestamp = row?.timestamp ?? row?.createdAt;
                return {
                    id: row?.id ? String(row.id) : undefined,
                    action: row?.action ? String(row.action) : '',
                    category: row?.category ? String(row.category) : '',
                    actorId: row?.actorId ? String(row.actorId) : '',
                    actorEmail: row?.actorEmail ? String(row.actorEmail) : '',
                    actorName: row?.actorName ? String(row.actorName) : undefined,
                    targetId: row?.targetId ? String(row.targetId) : undefined,
                    targetName: row?.targetName ? String(row.targetName) : undefined,
                    details: safeJsonParse(row?.details),
                    timestamp: toTimestamp(rawTimestamp)
                } as AuditLog;
            });

            return logs
                .filter((log) => !category || log.category === category)
                .filter((log) => !actorId || log.actorId === actorId)
                .sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis())
                .slice(0, limitCount);
        } catch (error) {
            // The fallback keeps log screens usable while a newly added composite
            // index is still being created in Firestore.
            try {
                const res = await listAllAuditLogs({ limit: 1000 } as any);
                const rawRows = (res as { data?: { auditLogs?: unknown } })?.data?.auditLogs;
                const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];
                return rows.map((row: any): AuditLog => ({
                    id: row?.id ? String(row.id) : undefined,
                    action: row?.action ? String(row.action) : '',
                    category: row?.category ? String(row.category) : '',
                    actorId: row?.actorId ? String(row.actorId) : '',
                    actorEmail: row?.actorEmail ? String(row.actorEmail) : '',
                    actorName: row?.actorName ? String(row.actorName) : undefined,
                    targetId: row?.targetId ? String(row.targetId) : undefined,
                    targetName: row?.targetName ? String(row.targetName) : undefined,
                    details: safeJsonParse(row?.details),
                    timestamp: toTimestamp(row?.timestamp ?? row?.createdAt),
                } as AuditLog))
                    .filter((log) => !category || log.category === category)
                    .filter((log) => !actorId || log.actorId === actorId)
                    .sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis())
                    .slice(0, limitCount);
            } catch (fallbackError) {
                console.error('Failed to fetch logs', error, fallbackError);
                return [];
            }
        }
    }
};

