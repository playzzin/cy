import { createHash } from 'crypto';

export type VehicleImportIdentityKind = 'fine' | 'toll';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export const hashVehicleImportSource = (base64: string): string => (
    createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex')
);

export const normalizeVehicleImportSourceSha256 = (value: unknown): string => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return SHA256_HEX_PATTERN.test(normalized) ? normalized : '';
};

export const buildVehicleImportIdentityKey = (
    kind: VehicleImportIdentityKind,
    sourceSha256: unknown,
    entryIndex = 0,
): string => {
    const normalizedSha256 = normalizeVehicleImportSourceSha256(sourceSha256);
    if (!normalizedSha256 || !Number.isInteger(entryIndex) || entryIndex < 0) return '';
    return `${kind}:source-sha256:${normalizedSha256}:entry:${entryIndex}`;
};

export const buildVehicleImportIdentityDocumentId = (identityKey: string): string => {
    if (!identityKey) return '';
    return `vehicle_import_${createHash('sha256').update(identityKey).digest('hex').slice(0, 40)}`;
};


interface VehicleImportDuplicateState {
    expenseId: string;
    identityId: string;
    existingExpenseIds: ReadonlySet<string>;
    createdExpenseIds: ReadonlySet<string>;
    existingIdentityIds: ReadonlySet<string>;
    existingIdentityExpenseIds: ReadonlyMap<string, string>;
    claimedIdentityExpenseIds: ReadonlyMap<string, string>;
}

export const resolveVehicleImportDuplicateExpenseId = ({
    expenseId,
    identityId,
    existingExpenseIds,
    createdExpenseIds,
    existingIdentityIds,
    existingIdentityExpenseIds,
    claimedIdentityExpenseIds,
}: VehicleImportDuplicateState): string => {
    if (identityId && existingIdentityIds.has(identityId)) {
        return existingIdentityExpenseIds.get(identityId) || expenseId;
    }
    if (identityId) {
        const claimedExpenseId = claimedIdentityExpenseIds.get(identityId);
        if (claimedExpenseId) return claimedExpenseId;
    }
    return existingExpenseIds.has(expenseId) || createdExpenseIds.has(expenseId)
        ? expenseId
        : '';
};
