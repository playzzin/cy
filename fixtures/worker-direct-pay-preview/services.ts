// Synthetic browser fixture only; never connects to Firebase or uploads personal data.
const key = 'worker-direct-pay-preview';
const initial = [{ id: 'test-worker', name: '가상 작업자', teamId: 'test-team', teamName: '검증팀', companyId: 'test-company', companyName: '청연 검증회사', status: '재직', isActive: true, salaryModel: '일급제', bankName: '검증은행', accountNumber: '001234567890', accountHolder: '가상 예금주', bankPhotoId: 'basic-photo' }];
const rows = () => JSON.parse(localStorage.getItem(key) || JSON.stringify(initial));
export const manpowerService = {
    getWorkers: async () => rows(),
    updateWorker: async (id: string, update: object) => localStorage.setItem(key, JSON.stringify(rows().map((row: any) => row.id === id ? { ...row, ...update } : row))),
};
export const teamService = { getTeams: async () => [{ id: 'test-team', name: '검증팀', companyId: 'test-company', type: '시공팀', status: 'active' }] };
export const companyService = { getCompanies: async () => [{ id: 'test-company', name: '청연 검증회사', status: 'active' }] };
export const accountDirectoryService = { getEntries: async () => [] };
export const primaryAccountService = { subscribe: () => () => undefined, getPrimaryAccount: async () => null };
export const aiSettingsService = {};
export const geminiService = {};
export const siteService = { getSites: async () => [] };
export const positionService = { getPositions: async () => [] };
export const statisticsService = { getCumulativeManpower: async () => ({ workerStats: {} }) };
export const dailyReportService = {};
export const recordIdentityDocumentLog = async () => undefined;
export const useAuth = () => ({ currentUser: null });
export const useRestrictedTeamWorkflow = () => false;
export const getTeamScopedRows = async () => [];
export const storage = {};
export const BANK_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const validateWorkerBankPhoto = () => undefined;
export const readWorkerBankPhoto = async (workerId: string, name: string, signal?: AbortSignal, purpose = 'default') => {
    const worker = rows().find((row: any) => row.id === workerId);
    if (!worker?.[purpose === 'directPay' ? 'directPayBankPhotoId' : 'bankPhotoId']) return null;
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 300;
    const context = canvas.getContext('2d')!; context.fillStyle = '#eff6ff'; context.fillRect(0, 0, 600, 300);
    context.fillStyle = '#1e3a8a'; context.font = 'bold 30px sans-serif'; context.fillText(purpose === 'directPay' ? 'DIRECT PAY PHOTO' : 'BASIC ACCOUNT PHOTO', 55, 100); context.font = '22px sans-serif'; context.fillText('Synthetic data / 001234567890', 55, 170);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    return new File([blob], `${name}.png`, { type: 'image/png' });
};
export const saveWorkerBankPhoto = async (id: string, file: File, photoId: string, expected: string, purpose: string) => {
    await manpowerService.updateWorker(id, { [purpose === 'directPay' ? 'directPayBankPhotoId' : 'bankPhotoId']: photoId });
    return photoId;
};
export default function EmptyPrimaryManager() { return null; }
