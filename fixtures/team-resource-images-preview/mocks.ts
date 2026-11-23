import { vehicleService as baseVehicleService, vehicleFineImportService as baseFineService, useExpenseLedgerData as baseLedgerData } from '../team-originals-preview/mocks';
export * from '../team-originals-preview/mocks';
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const aggregate = { id: `vehicle-ledger__${month}__qa-car__${month}-01__${month}-28__FINE__BILLING_TARGET`, vehicleId: 'qa-car', vehiclePlate: '12가3456',
    date: `${month}-01`, type: 'FINE', amount: 96000, payer: 'COMPANY', fineSourceExpenseIds: ['fine-a', 'fine-b'] };
export const vehicleService = { ...baseVehicleService, listAllVehicleExpenses: async () => [aggregate] };
export const useExpenseLedgerData = (selectedMonth: string) => {
    const data = baseLedgerData(selectedMonth);
    return { ...data, rawDocs: { ...data.rawDocs,
        accommodationDocs: [{ id: 'qa-room-bill', yearMonth: month, teamId: 'qa-team', teamName: '검증팀', issuedToType: 'team', status: 'CONFIRMED',
            memo: '가상숙소의긴주소와관리비상세설명'.repeat(8), lineItems: [{ id: 'rent', label: '숙소 임대료', amount: 1234567 }] }],
        claims: [{ id: 'qa-expense', date: `${month}-05`, payerTeamId: 'qa-team', payerTeamName: '검증팀', status: 'CONFIRMED', amount: 123456789,
            category: '자재', siteName: '가상현장주소'.repeat(8), description: '가상자재구매상세내역'.repeat(12), cardLabel: '현장 카드' }],
        vehicleDocs: data.rawDocs.vehicleDocs.map(doc => ({ ...doc,
        lineItems: [{ id: aggregate.id, label: '과태료', category: 'FINE', type: 'VARIABLE', amount: aggregate.amount }] })) } };
};
export const vehicleFineImportService = { ...baseFineService, getDetails: async () => [{ expenseId: aggregate.id,
    notices: (await baseVehicleService.listAllVehicleExpenses()).map(row => ({ ...row, attachmentExpenseId: aggregate.id, originalAvailable: true })) }] };
export const cardStatementImportService = {
    getFileDetail: async ({ storagePath }: { storagePath: string }) => {
        if (new URLSearchParams(window.location.search).has('detailError')) throw new Error('합성 자료 조회 오류');
        return { file: { storagePath, sha256: 'same-statement', status: 'completed' }, analysisStatus: 'completed', results: [
            { id: 'qa-result', matchedCardId: 'qa-card', status: 'matched', transactions: [
                { id: 'meal', date: `${month}-01`, merchant: '가상 현장 식당', category: 'MEAL', amount: 18000, confidence: 1, memo: '가상 점심 식대' },
                { id: 'fuel', date: `${month}-02`, merchant: '가상 주유소', category: 'FUEL', amount: 12000, confidence: 1 },
                { id: 'material', date: `${month}-03`, merchant: '가상 자재상', category: 'MATERIAL', amount: 5000, confidence: 1 },
                { id: 'toll', date: `${month}-04`, merchant: '가상 톨게이트', category: 'TOLL', amount: 5000, confidence: 1 },
            ] },
            { id: 'other-card', matchedCardId: 'qa-other-card', status: 'matched', transactions: [
                { id: 'other', date: `${month}-01`, merchant: '다른 카드 내역', category: 'OTHER', amount: 99999, confidence: 1 },
            ] },
        ] };
    },
};
