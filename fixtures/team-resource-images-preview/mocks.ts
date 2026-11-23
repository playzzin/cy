export * from '../team-originals-preview/mocks';
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
export const cardStatementImportService = {
    getFileDetail: async ({ storagePath }: { storagePath: string }) => {
        if (new URLSearchParams(window.location.search).has('detailError')) throw new Error('합성 자료 조회 오류');
        return { file: { storagePath, sha256: 'same-statement', status: 'completed' }, analysisStatus: 'completed', results: [
            { id: 'qa-result', matchedCardId: 'qa-card', status: 'matched', transactions: [
                { id: 'meal', date: `${month}-01`, merchant: '가상 현장 식당', category: 'MEAL', amount: 18000, confidence: 1, memo: '가상 점심 식대' },
                { id: 'fuel', date: `${month}-02`, merchant: '가상 주유소', category: 'FUEL', amount: 12000, confidence: 1 },
            ] },
            { id: 'other-card', matchedCardId: 'qa-other-card', status: 'matched', transactions: [
                { id: 'other', date: `${month}-01`, merchant: '다른 카드 내역', category: 'OTHER', amount: 99999, confidence: 1 },
            ] },
        ] };
    },
};
