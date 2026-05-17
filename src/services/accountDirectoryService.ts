import { accountDirectoryFirestoreService } from './accountDirectoryFirestoreService';
import { databaseLogService } from './databaseLogService';
import { AccountDirectoryZod as AccountDirectory } from '../types/zod/accountDirectorySchema';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export type { AccountDirectory };

const snapshotAccount = (id: string, data: Record<string, unknown>): Record<string, unknown> => ({
    id,
    ...stripUndefinedFields(data),
});

const logAccountChange = async (
    action: 'created' | 'updated' | 'deleted',
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    source = 'accountDirectoryService'
): Promise<void> => {
    await databaseLogService.safeCreateLog({
        action,
        entityType: 'account',
        before,
        after,
        source,
    });
};

export const accountDirectoryService = {
    getEntries: async (): Promise<AccountDirectory[]> => {
        return accountDirectoryFirestoreService.getEntries();
    },

    getEntry: async (id: string): Promise<AccountDirectory | null> => {
        return accountDirectoryFirestoreService.getEntry(id);
    },

    getEntriesByCategory: async (category: AccountDirectory['category']): Promise<AccountDirectory[]> => {
        return accountDirectoryFirestoreService.getEntriesByCategory(category);
    },

    addEntry: async (entry: Omit<AccountDirectory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const id = await accountDirectoryFirestoreService.addEntry(entry);
        await logAccountChange('created', null, snapshotAccount(id, entry as Record<string, unknown>), 'accountDirectoryService.addEntry');
        return id;
    },

    updateEntry: async (id: string, entry: Partial<AccountDirectory>): Promise<void> => {
        const existing = await accountDirectoryFirestoreService.getEntry(id);
        const cleanedUpdates = stripUndefinedFields(entry as Record<string, unknown>);
        await accountDirectoryFirestoreService.updateEntry(id, cleanedUpdates as Partial<AccountDirectory>);
        await logAccountChange(
            'updated',
            existing ? snapshotAccount(id, existing as Record<string, unknown>) : null,
            snapshotAccount(id, { ...(existing ? existing as Record<string, unknown> : {}), ...cleanedUpdates }),
            'accountDirectoryService.updateEntry'
        );
    },

    deleteEntry: async (id: string): Promise<void> => {
        const existing = await accountDirectoryFirestoreService.getEntry(id);
        await accountDirectoryFirestoreService.deleteEntry(id);
        await logAccountChange(
            'deleted',
            existing ? snapshotAccount(id, existing as Record<string, unknown>) : null,
            null,
            'accountDirectoryService.deleteEntry'
        );
    },
};
