import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { usesTeamScopedReads, invalidateTeamScopedCache } from './teamScopedReadService';

export async function saveScopedMaterialTransactions(direction: 'inbound' | 'outbound', transactions: unknown[], photoBatch?: unknown): Promise<boolean> {
    if (!await usesTeamScopedReads()) return false;
    await httpsCallable(functions, 'teamMaterialTransactions')({ direction, transactions, ...(photoBatch ? { photoBatch } : {}) });
    invalidateTeamScopedCache();
    return true;
}
