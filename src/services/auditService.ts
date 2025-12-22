import { db } from '../config/firebase';
import { collection, addDoc, Timestamp, query, orderBy, limit, getDocs, where, QueryConstraint } from 'firebase/firestore';

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

const COLLECTION_NAME = 'audit_logs';

export const auditService = {
    // Write a log entry
    log: async (logData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
        try {
            await addDoc(collection(db, COLLECTION_NAME), {
                ...logData,
                timestamp: Timestamp.now()
            });
            console.log(`[Audit] ${logData.category}:${logData.action} by ${logData.actorEmail}`);
        } catch (error) {
            console.error("Failed to write audit log", error);
            // Non-blocking error
        }
    },

    // Fetch logs with basic filtering
    getLogs: async (limitCount: number = 100, category?: string, actorId?: string): Promise<AuditLog[]> => {
        try {
            const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc')];

            if (category) constraints.push(where('category', '==', category));
            if (actorId) constraints.push(where('actorId', '==', actorId));

            constraints.push(limit(limitCount));

            const q = query(collection(db, COLLECTION_NAME), ...constraints);
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AuditLog));
        } catch (error) {
            console.error("Failed to fetch logs", error);
            return [];
        }
    }
};

