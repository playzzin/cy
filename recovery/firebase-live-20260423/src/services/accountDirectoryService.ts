import { accountDirectoryFirestoreService } from './accountDirectoryFirestoreService';
import { AccountDirectoryZod as AccountDirectory } from '../types/zod/accountDirectorySchema';

export type { AccountDirectory };

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
        return accountDirectoryFirestoreService.addEntry(entry);
    },

    updateEntry: async (id: string, entry: Partial<AccountDirectory>): Promise<void> => {
        return accountDirectoryFirestoreService.updateEntry(id, entry);
    },

    deleteEntry: async (id: string): Promise<void> => {
        return accountDirectoryFirestoreService.deleteEntry(id);
    },
};
