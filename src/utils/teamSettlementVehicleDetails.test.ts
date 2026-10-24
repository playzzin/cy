import type { TeamSettlementDeductionItem } from '../types/teamSettlement';
import type { VehicleBillingDocument } from '../types/vehicleBilling';
import { buildTeamSettlementVehicleDetail } from './teamSettlementVehicleDetails';

const bill = (id: string, amount = 100000): VehicleBillingDocument => ({
  id, yearMonth: '2026-08', vehicleId: 'car-a', vehiclePlate: '검증차량',
  teamId: 'own', status: 'CONFIRMED', fixedCost: amount, variableCost: 0, totalAmount: amount,
  lineItems: [{ id: 'rent', label: '임대료', type: 'FIXED', amount }]
});
const deduction = (sourceId: string, amount = 100000): TeamSettlementDeductionItem => ({
  id: `vehicle_billing:2026-08:${sourceId}`, source: 'auto', origin: 'vehicle_billing',
  category: '차량비 (검증차량)', amount
});

it('같은 차량의 여러 청구 중 정산에 저장된 청구 한 건만 연결한다', () => {
  const result = buildTeamSettlementVehicleDetail(deduction('bill-a'), [bill('bill-a'), bill('bill-b', 200000)], '2026-08');
  expect(result.rows.map(row => row.amount)).toEqual([100000]);
  expect(result.memo).toBe('');
});

it('원본 청구 금액이 달라졌다면 저장액을 보존하고 현재 합계와의 차이를 알린다', () => {
  const saved = deduction('bill-a');
  const billing = bill('bill-a', 200000);
  const original = JSON.stringify({ saved, billing });
  const result = buildTeamSettlementVehicleDetail(saved, [billing], '2026-08');
  expect(result.amount).toBe(100000);
  expect(result.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(100000);
  expect(result.memo).toContain('현재 청구 내역 합계 200,000원과 정산 반영액이 다릅니다');
  expect(JSON.stringify({ saved, billing })).toBe(original);
});

it.each(['car-a:ledger', 'car-a:ledger:assignment-a'])('대장 배분액 %s를 현재 청구서로 대체하지 않는다', sourceId => {
  const result = buildTeamSettlementVehicleDetail(deduction(sourceId, 30000), [bill('bill-a')], '2026-08');
  expect(result.rows.map(row => row.amount)).toEqual([30000]);
  expect(result.memo).toContain('배정 기간이 반영된 정산 금액');
});

it('금액을 줄이는 환급 항목을 상세에서 누락하지 않는다', () => {
  const billing = bill('bill-a');
  billing.lineItems.push({ id: 'credit', label: '환급', type: 'VARIABLE', amount: -10000 });
  const result = buildTeamSettlementVehicleDetail(deduction('bill-a', 90000), [billing], '2026-08');
  expect(result.rows.map(row => row.amount)).toEqual([100000, -10000]);
  expect(result.amount).toBe(90000);
});

it('세부 항목이 없는 청구서도 정산과 같은 고정비·변동비 또는 총액 기준을 쓴다', () => {
  const billing = { ...bill('bill-a'), lineItems: [], fixedCost: 60000, variableCost: 40000 };
  expect(buildTeamSettlementVehicleDetail(deduction('bill-a'), [billing], '2026-08').rows.map(row => row.amount)).toEqual([60000, 40000]);
  billing.fixedCost = 0;
  billing.variableCost = 0;
  expect(buildTeamSettlementVehicleDetail(deduction('bill-a'), [billing], '2026-08').rows).toEqual([
    { subject: '검증차량', label: '차량 청구액', amount: 100000 }
  ]);
});

it('원본이 없거나 다른 월이거나 취소되었으면 저장된 정산 금액을 유지한다', () => {
  for (const bills of [[], [{ ...bill('bill-a'), yearMonth: '2026-09' }], [{ ...bill('bill-a'), status: 'CANCELLED' as const }]]) {
    const result = buildTeamSettlementVehicleDetail(deduction('bill-a'), bills, '2026-08');
    expect(result.rows[0]).toMatchObject({ label: '정산 반영액', amount: 100000 });
    expect(result.memo).not.toBe('');
  }
});

it('차량 식별자만 있는 옛 정산은 청구 한 건일 때만 연결한다', () => {
  const single = buildTeamSettlementVehicleDetail(deduction('car-a'), [bill('bill-a')], '2026-08');
  expect(single.rows[0].label).toBe('임대료');
  const ambiguous = buildTeamSettlementVehicleDetail(deduction('car-a'), [bill('bill-a'), bill('bill-b')], '2026-08');
  expect(ambiguous.rows[0].label).toBe('정산 반영액');
  const partialId = buildTeamSettlementVehicleDetail(deduction('car'), [bill('bill-a')], '2026-08');
  expect(partialId.rows[0].label).toBe('정산 반영액');
});

it('정산 서비스의 원 단위 반올림을 상세 합계에도 명시적으로 반영한다', () => {
  const result = buildTeamSettlementVehicleDetail(deduction('bill-a'), [bill('bill-a', 99999.6)], '2026-08');
  expect(result.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(100000);
  expect(result.rows[1].label).toBe('원 단위 반올림');
});
