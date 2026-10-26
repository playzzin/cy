import * as functions from 'firebase-functions/v1';

export const PREVIEW_UID_PREFIX = 'cy-preview-';
export const PREVIEW_SECONDS = 15 * 60;
export const isPreviewIdentity = (uid: unknown, token: Record<string, any> = {}) =>
    String(uid || '').startsWith(PREVIEW_UID_PREFIX) || token.devPreview === true || 'previewTargetUid' in token;
export const normalizePreviewRole = (value: unknown) => String(value || '').trim().toLowerCase().replace(/^pos_/, '');
const devNames = new Set(['dev', 'developer', '개발', '개발자']);
export function previewDevRole(profile: any, positions: Array<{ id: string; name: string }> = []): string | null {
    if (!profile || profile.status !== 'active') return null;
    const rawRoles = [profile.role, profile.position, profile.systemRole, ...(profile.roles || []), ...(profile.additionalPositions || [])];
    return rawRoles.find(value => typeof value === 'string' && (devNames.has(normalizePreviewRole(value))
        || positions.some(position => normalizePreviewRole(position.id) === normalizePreviewRole(value) && devNames.has(normalizePreviewRole(position.name))))) || null;
}

// Explicitly audited read operations. New endpoints fail closed until reviewed.
const reads = new Set(['getTeamScopedData', 'listGeminiUsageLogs', 'getCardExpenseAuditDashboard', 'listCardStatementFiles', 'getCardStatementFileDetail',
    'getMyAccountLinkCandidate', 'getMyAccountLinkStatus', 'searchAccountLinkCompanies', 'getWelfareGameConfig', 'getNoticeDeliveryReport', 'getNoticeBoard', 'getCardStatementImportJobStatus']);
const readActions: Record<string, string[]> = {
    supportTeamDocuments: ['list', 'read'],
    teamExpenseRequests: ['list', 'receipt'],
    teamWorkerRequests: ['list', 'document'],
    teamAccountApprovals: ['list'],
    workerSignatures: ['read'],
};
export function permitsPreviewCall(name: string, data: any): boolean {
    return reads.has(name) || Boolean(readActions[name]?.includes(String(data?.action || '')));
}
export function assertPreviewClaims(uid: string, token: Record<string, any>, nowSeconds = Date.now() / 1000) {
    if (!uid.startsWith(PREVIEW_UID_PREFIX) || token.devPreview !== true
        || !Number.isFinite(token.previewExpiresAt) || token.previewExpiresAt <= nowSeconds
        || token.previewExpiresAt > nowSeconds + PREVIEW_SECONDS + 60
        || ![token.previewActorUid, token.previewTargetUid].every(value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') && !value.startsWith(PREVIEW_UID_PREFIX))
        || typeof token.previewDevRole !== 'string' || !token.previewDevRole) {
        throw new functions.https.HttpsError('permission-denied', '사용자 미리보기 세션이 만료되었거나 유효하지 않습니다. 다시 시작해 주세요.');
    }
}
