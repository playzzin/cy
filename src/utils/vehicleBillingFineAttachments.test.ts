import { getVehicleBillingFineExpenses } from './vehicleBillingFineAttachments';
import type { VehicleBillingDocument } from '../types/vehicleBilling';
import type { VehicleExpenseRecord } from '../types/vehicle';

const fine = (id: string, overrides: Partial<VehicleExpenseRecord> = {}): VehicleExpenseRecord => ({ id, vehicleId: 'vehicle-a', vehiclePlate: '12가3456', date: '2026-11-05', type: 'FINE', amount: 32000, payer: 'COMPANY', fineNotice: { sourceSha256: 'a'.repeat(64), sourceFileName: '고지서.png' } as VehicleExpenseRecord['fineNotice'], ...overrides });
const doc = (overrides: Partial<VehicleBillingDocument> = {}): VehicleBillingDocument => ({ id: 'bill-a', yearMonth: '2026-11', vehicleId: 'vehicle-a', vehiclePlate: '12가3456', teamId: 'team-a', issuedToType: 'team', fixedCost: 0, variableCost: 32000, totalAmount: 32000, status: 'DRAFT', lineItems: [{ id: 'fine-a', label: '과태료', category: 'FINE', type: 'VARIABLE', amount: 32000 }], ...overrides });

test('직접 연결된 과태료만 선택하고 같은 날의 다른 과태료를 포함하지 않는다', () => {
  const expected = fine('fine-a');
  expect(getVehicleBillingFineExpenses(doc(), [expected, fine('fine-b')])).toEqual([expected]);
});

test('묶음 청구는 청구기간, 월, 차량, 비용종류, 취소상태로 원본을 제한한다', () => {
  const bill = doc({ lineItems: [{ id: 'fine-segment', label: '과태료', type: 'VARIABLE', category: 'FINE', amount: 64000, sourceType: 'vehicle_ledger', sourceLedgerRowId: 'ledger-row', sourceSegmentId: 'segment-a', sourceStartDate: '2026-11-01', sourceEndDate: '2026-11-10' }] });
  const first = fine('first');
  const last = fine('last', { date: '2026-11-10' });
  expect(getVehicleBillingFineExpenses(bill, [last, first, fine('other-team-period', { date: '2026-11-11' }), fine('other-month', { date: '2026-10-05' }), fine('other-vehicle', { vehicleId: 'vehicle-b' }), fine('toll', { type: 'TOLL' }), fine('cancelled', { status: 'CANCELLED' }), fine('driver', { fineChargeTarget: 'DRIVER' })])).toEqual([first, last]);
});

test('운전자 청구의 원본은 지정된 운전자로 제한한다', () => {
  const bill = doc({ issuedToType: 'worker', issuedToWorkerId: 'worker-a', lineItems: [{ id: 'fine-driver', label: '과태료', type: 'VARIABLE', category: 'FINE', amount: 32000, sourceType: 'vehicle_ledger', sourceSegmentId: 'segment-a', sourceStartDate: '2026-11-01', sourceEndDate: '2026-11-10' }] });
  const expected = fine('mine', { fineChargeTarget: 'DRIVER', fineDriverBillingTarget: { workerId: 'worker-a', workerName: '검증작업자' } });
  expect(getVehicleBillingFineExpenses(bill, [expected, fine('other-worker', { fineChargeTarget: 'DRIVER', fineDriverBillingTarget: { workerId: 'worker-b', workerName: '다른작업자' } })])).toEqual([expected]);
});

test('원본 연결 근거가 없는 수동 금액과 이전 청구에는 임의로 월 전체 과태료를 붙이지 않는다', () => {
  expect(getVehicleBillingFineExpenses(doc({ lineItems: [{ id: 'manual-fine', label: '과태료', type: 'VARIABLE', category: 'FINE', amount: 32000, sourceType: 'manual' }] }), [fine('fine-a')])).toEqual([]);
  expect(getVehicleBillingFineExpenses(doc({ lineItems: [{ id: 'unknown', label: '과태료', type: 'VARIABLE', category: 'FINE', amount: 32000 }] }), [fine('fine-a')])).toEqual([]);
});

test('원본 파일 연결 정보가 없는 과태료는 원본 목록에서 제외한다', () => {
  expect(getVehicleBillingFineExpenses(doc(), [fine('fine-a', { fineNotice: undefined })])).toEqual([]);
});

test('월별대장 합계는 연결된 원본·상세를 조회할 기준 항목으로 선택한다', () => {
  const aggregate = fine('vehicle-ledger__2026-11__vehicle-a__2026-11-01__2026-11-30__FINE__BILLING_TARGET', { fineNotice: undefined });
  const bill = doc({ lineItems: [{ id: aggregate.id, label: '과태료', type: 'VARIABLE', category: 'FINE', amount: 32000, sourceType: 'vehicle_ledger' }] });
  expect(getVehicleBillingFineExpenses(bill, [aggregate, fine('unrelated')])).toEqual([aggregate]);
});

test('삭제된 과태료 첨부를 원본 목록에 다시 표시하지 않는다', () => {
  expect(getVehicleBillingFineExpenses(doc(), [fine('fine-a', { fineNotice: { sourceSha256: 'a'.repeat(64), attachmentRemoved: true } as VehicleExpenseRecord['fineNotice'] })])).toEqual([]);
});
