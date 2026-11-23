const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const team = { id: 'qa-team', name: '검증팀', companyName: '가상회사' };
const card = { id: 'qa-card', name: '검증카드', issuer: '검증발급사', last4: '1234', status: 'ASSIGNED',
    currentAssigneeType: 'TEAM', currentAssigneeId: team.id, currentAssigneeName: team.name };
const fines = ['fine-a', 'fine-b'].map((id, index) => ({ id, vehicleId: 'qa-car', vehiclePlate: '12가3456',
    date: `${month}-0${index + 1}`, type: 'FINE', amount: index ? 64000 : 32000, payer: 'COMPANY',
    fineNotice: { sourceSha256: 'a'.repeat(64), sourceFileName: `고지서${index + 1}.${index ? 'pdf' : 'png'}`, violationDateTime: `${month}-0${index + 1} 09:30`,
        dueDate: `${month}-${index ? '28' : '20'}`, violationLocation: '가상시 검증로', violationDescription: '주정차 위반 (검증용)' },
}));
const bill = { id: 'bill-card', yearMonth: month, cardId: card.id, cardLabel: card.name, teamId: team.id, teamName: team.name,
    issuedToType: 'team', variableCost: 30000, totalAmount: 30000, status: 'CONFIRMED', lineItems: [],
    statementAttachmentPaths: [`card-billing-statements/${month}/사용내역서.pdf`, `card-billing-statements/${month}/카드원본_1.png`, `card-billing-statements/${month}/카드원본_2.png`] };
const vehicleBill = { id: 'bill-car', yearMonth: month, vehicleId: 'qa-car', vehiclePlate: '12가3456', teamId: team.id, teamName: team.name,
    issuedToType: 'team', status: 'CONFIRMED', fixedCost: 0, variableCost: 96000, totalAmount: 96000,
    lineItems: fines.map(fine => ({ id: fine.id, label: '과태료', category: 'FINE', type: 'VARIABLE', amount: fine.amount })) };

export const accommodationService = { getAccommodations: async () => [], getAssignments: async () => [] };
export const manpowerService = { getWorkers: async () => [] };
export const cardService = { getCards: async () => [card], listAllCardAssignments: async () => [], getTransactionsByMonth: async () => [] };
export const vehicleService = { getVehicles: async () => [], listAllVehicleAssignments: async () => [], listAllVehicleExpenses: async () => fines };
export const useWorkerAccessScope = () => ({ mode: 'all', loading: false });
export const workerAccessCanViewWholeTeam = () => true;
export const workerAccessMatchesTeam = () => true;
export const workerAccessMatchesWorkerRef = () => false;
export const useExpenseLedgerData = (selectedMonth: string) => ({ loading: false, teamOptions: [team], summaries: [],
    rawDocs: { accommodationDocs: [], vehicleDocs: selectedMonth === month ? [vehicleBill] : [], cardDocs: selectedMonth === month ? [bill] : [], claims: [] },
    resolveTeam: (id: string, name: string) => id === team.id || name === team.name ? team : null, allCategoryOptions: [], loadData: async () => undefined });
export const getBillingStatusLabel = () => '확정';
export const getCategoryLabel = (value: string) => value;
export const getEffectiveClaimType = () => 'other';
export const getStatusLabel = (value: string) => value;
export const getSummaryTotal = () => 126000;
export const summarizeVehicleBillingCosts = (doc: { totalAmount: number }) => ({ rent: 0, lease: 0, fuel: 0, fine: doc.totalAmount, repair: 0, toll: 0, other: 0, total: doc.totalAmount });
export const toast = { error: () => undefined, success: () => undefined, warning: () => undefined };
export const isDevAdminSessionEnabled = () => false;

function sampleImage(title: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1000, 1400);
    ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 48px sans-serif'; ctx.fillText(title, 70, 100);
    ctx.fillStyle = '#475569'; ctx.font = '25px sans-serif'; ctx.fillText('화면 검증용 가상 자료 · 실제 청구서가 아닙니다', 70, 155);
    ctx.font = '28px sans-serif';
    for (let i = 0; i < 12; i++) {
        const y = 250 + i * 82;
        ctx.fillStyle = i % 2 ? '#f1f5f9' : '#eff6ff'; ctx.fillRect(60, y - 36, 880, 75);
        ctx.fillStyle = '#334155'; ctx.fillText(`${month}-${String(i + 1).padStart(2, '0')}    검증 내역 ${i + 1}           10,000원`, 80, y + 10);
    }
    return canvas.toDataURL('image/png');
}
export const getCardStatementFileName = (path: string) => path.split('/').pop()!;
export const getCardStatementAttachmentError = () => '검증용 조회 오류';
export const cardStatementAttachmentService = { resolve: async (path: string) => ({
    url: path.endsWith('.pdf') ? '/fixture.pdf' : sampleImage(path.endsWith('_1.png') ? '카드 원본 1' : '카드 원본 2'), release: () => undefined,
}) };
export const vehicleFineImportService = { getAttachment: async (id: string) => {
    if (id === 'fine-b') {
        const bytes = new Uint8Array(await (await fetch('/fixture.pdf')).arrayBuffer());
        return { base64: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')), mimeType: 'application/pdf', fileName: '고지서2.pdf' };
    }
    return { base64: sampleImage('과태료 고지서').split(',')[1], mimeType: 'image/png', fileName: '고지서1.png' };
} };
