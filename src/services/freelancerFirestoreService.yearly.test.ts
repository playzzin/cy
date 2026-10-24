import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { freelancerFirestoreService } from './freelancerFirestoreService';
import { FreelancerPaymentSchema } from '../types/zod/freelancerSchema';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./firestoreCrudCompat', () => ({}));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn((_db, name) => name),
    doc: jest.fn((...args) => args.length === 3 ? `${args[1]}/${args[2]}` : `${args[0]}/new`),
    serverTimestamp: jest.fn(() => 'timestamp'),
    writeBatch: jest.fn(),
}));
const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn(async () => undefined) };
beforeEach(() => {
    jest.clearAllMocks();
    (collection as jest.Mock).mockImplementation((_db, name) => name);
    (doc as jest.Mock).mockImplementation((...args) => args.length === 3 ? `${args[1]}/${args[2]}` : `${args[0]}/new`);
    (serverTimestamp as jest.Mock).mockReturnValue('timestamp');
    (writeBatch as jest.Mock).mockReturnValue(batch);
});

it('동일 작업자의 두 팀 수기 수정과 연간 요약을 각각의 팀 정보로 저장한다', async () => {
    await freelancerFirestoreService.saveYearlyPaymentsBatch(2026, [
        { id: 'worker', teamId: 'a', teamName: '검증 A팀', m09: 0, m09_sourceAmount: 100, m09_id: 'a9', latestPaymentId: 'a9', performanceBonus: 10 },
        { id: 'worker', teamId: 'b', teamName: '검증 B팀', m09: 250, m09_sourceAmount: 200, m09_id: 'b9', latestPaymentId: 'b9', performanceBonus: 20 },
    ]);
    expect(batch.update).toHaveBeenCalledWith('freelancerPayments/a9', expect.objectContaining({ teamId: 'a', amount: 0, isManualTaxOverride: true }));
    expect(batch.update).toHaveBeenCalledWith('freelancerPayments/b9', expect.objectContaining({ teamId: 'b', amount: 250, isManualTaxOverride: true }));
    expect(batch.update).toHaveBeenCalledWith('freelancerPayments/a9', expect.objectContaining({ teamId: 'a', performanceBonus: 10 }));
    expect(batch.update).toHaveBeenCalledWith('freelancerPayments/b9', expect.objectContaining({ teamId: 'b', performanceBonus: 20 }));
    expect(batch.commit).toHaveBeenCalledTimes(1);
});

it('새 수기값과 연간 요약에도 팀을 기록하고 정산 전용 인원의 마스터는 수정하지 않는다', async () => {
    await freelancerFirestoreService.saveYearlyPaymentsBatch(2026, [{ id: 'worker', teamId: 'b', teamName: '검증 B팀', isSettlementOnly: true, m09: 300, m09_sourceAmount: 200 }]);
    expect(batch.set).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ freelancerId: 'worker', teamId: 'b', teamName: '검증 B팀', month: 9, amount: 300, isManualTaxOverride: true }));
    expect(batch.set).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ freelancerId: 'worker', teamId: 'b', month: 12, isManualTaxOverride: false }));
    expect(batch.update).not.toHaveBeenCalled();
});

it('12월에 처음 수기 수정하면 같은 팀의 요약 문서를 중복 생성하지 않는다', async () => {
    await freelancerFirestoreService.saveYearlyPaymentsBatch(2026, [{ id: 'worker', teamId: 'b', isSettlementOnly: true, m12: 300, m12_sourceAmount: 200 }]);
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ teamId: 'b', month: 12, amount: 300 }));
});

it('결제 검증 스키마가 팀 스냅샷을 제거하지 않는다', () => {
    expect(FreelancerPaymentSchema.parse({ freelancerId: 'worker', teamId: 'b', teamName: '검증 B팀', year: 2026, month: 9 })).toMatchObject({ teamId: 'b', teamName: '검증 B팀' });
});
