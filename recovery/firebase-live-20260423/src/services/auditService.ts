import { createAuditLog, listAllAuditLogs } from './firestoreCrudCompat';
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
                targetId: logData.targetId ?? null,
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
            const where: any = {};
            if (category) where.category = { eq: category };
            if (actorId) where.actorId = { eq: actorId };

            const res = await listAllAuditLogs({
                limit: limitCount,
                where: Object.keys(where).length > 0 ? where : undefined,
                orderBy: [{ timestamp: 'DESC' }]
            } as any);

            const rows = (res as any)?.data?.auditLogs ?? [];
            return rows.map((row: any): AuditLog => {
                const rawTimestamp = row?.timestamp ?? row?.createdAt;
                return {
                    id: row?.id ? String(row.id) : undefined,
                    action: row?.action ? String(row.action) : '',
                    category: row?.category ? String(row.category) : '',
                    actorId: row?.actorId ? String(row.actorId) : '',
                    actorEmail: row?.actorEmail ? String(row.actorEmail) : '',
                    targetId: row?.targetId ? String(row.targetId) : undefined,
                    details: safeJsonParse(row?.details),
                    timestamp: toTimestamp(rawTimestamp)
                } as AuditLog;
            });
        } catch (error) {
            console.error("Failed to fetch logs", error);
            return [];
        }
    }
};

