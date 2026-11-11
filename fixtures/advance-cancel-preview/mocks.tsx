export * from '../client-mobile-preview/mocks';

const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const key = 'advance-cancel-synthetic-requests';
const initial = ['requested', 'approved', 'paid'].map((status, index) => ({
    id: `synthetic-${status}`, workerId: 'sample-worker', workerName: '가상작업자', requesterUid: 'preview-leader',
    yearMonth: month, periodStart: `${month}-01`, periodEnd: `${month}-28`, category: 'second',
    requestedAmount: (index + 1) * 10000, status,
}));
const read = (): typeof initial => JSON.parse(sessionStorage.getItem(key) || JSON.stringify(initial));
export const advanceRequestService = {
    listForWorkerIds: async () => read(),
    cancelRequest: async (id: string) => {
        const requests = read();
        const target = requests.find(row => row.id === id);
        if (!target || target.status !== 'requested') throw new Error('Only pending synthetic requests can be cancelled');
        target.status = 'cancelled';
        sessionStorage.setItem(key, JSON.stringify(requests));
    },
};
