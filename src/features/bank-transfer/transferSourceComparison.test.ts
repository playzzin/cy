import { compareTransferSources } from './transferSourceComparison';
import { loadAccountTransferCandidates, loadRentTransferCandidates, loadSupportTransferCandidates } from './transferSources';
import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';
import { createTransferRow } from './transferModel';
import type { TransferCandidate } from './types';
jest.mock('./transferSources', () => ({ loadAccountTransferCandidates: jest.fn(), loadRentTransferCandidates: jest.fn(), loadSupportTransferCandidates: jest.fn() }));
jest.mock('../../services/monthlyPayrollSettlementService', () => ({ monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn() } }));
const candidate = (patch: Partial<TransferCandidate> = {}): TransferCandidate => ({ id: 'rent:2026-09:r1', sourceId: 'r1', source: 'rent', category: 'other', name: '검증숙소', groupName: '검증팀', period: '2026-09', amount: 500000, bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '검증예금주', detail: '월세', ...patch });
beforeEach(() => { jest.resetAllMocks(); (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [], warnings: [] }); (loadRentTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [], warnings: [] }); (loadSupportTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [], warnings: [] }); (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([]); });
it('같은 월의 자료는 한번만 읽고 현재 금액·계좌·지급완료 차이를 알리며 입력은 보존한다', async () => {
    const first = createTransferRow(candidate(), '보존표시', '보존메모'); const second = createTransferRow(candidate({ id: 'rent:r2', sourceId: 'r2' }), '', '');
    const before = JSON.stringify([first, second]);
    (loadRentTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate({ amount: 510000, accountNumber: '00987654321', warning: '지급완료 표시' }), candidate({ id: 'rent:r2', sourceId: 'r2' })], warnings: [] });
    const result = await compareTransferSources([first, second]);
    expect(loadRentTransferCandidates).toHaveBeenCalledTimes(1); expect(loadRentTransferCandidates).toHaveBeenCalledWith('2026-09');
    expect(result.items[0]).toMatchObject({ status: 'different', currentAmount: 510000 });
    expect(result.items[0].notes.join(' ')).toContain('지급완료'); expect(result.items[0].notes.join(' ')).toContain('은행·계좌·예금주');
    expect(result.items[1].status).toBe('same'); expect(JSON.stringify([first, second])).toBe(before);
});
it('한 자료 조회 실패가 다른 자료 비교를 막지 않으며 미확인을 일치로 표시하지 않는다', async () => {
    (loadRentTransferCandidates as jest.Mock).mockRejectedValue(Error('network'));
    (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate({ source: 'account', category: 'worker' })], warnings: [] });
    const result = await compareTransferSources([createTransferRow(candidate(), '', ''), createTransferRow(candidate({ id: 'account:r1', source: 'account', category: 'worker', amount: 100 }), '', '')]);
    expect(result.items.map(item => item.status)).toEqual(['unavailable', 'same']);
});
it('동명이어도 원본 ID가 다르거나 결과가 중복되면 연결하지 않는다', async () => {
    (loadSupportTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate({ source: 'support', sourceId: 'different' })], warnings: [] });
    const result = await compareTransferSources([createTransferRow(candidate({ source: 'support' }), '', '')]);
    expect(result.items[0].status).toBe('unavailable');
});
it('급여 지급완료를 비교하며 상세 기준을 알 수 없으면 금액을 추정하지 않는다', async () => {
    const payroll = candidate({ source: 'payroll', category: 'worker', sourceId: 'w1', id: 'payroll:w1:laborAdvance2' });
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([{ yearMonth: '2026-09', runStatus: 'paid', rows: [{ rowKey: 'w1', netAmount: 1000, paymentSnapshot: { id: 'w1', month: '2026-09', totalAmount: 1000, bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '검증예금주' } }] }]);
    const result = await compareTransferSources([createTransferRow(payroll, '', '')]);
    expect(result.items[0].status).toBe('unavailable'); expect(result.items[0].currentAmount).toBeUndefined(); expect(result.items[0].notes.join(' ')).toContain('지급완료');
});
