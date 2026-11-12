import { applyAccommodationTerminationHistory, getAccommodationStatusForMonth, isAccommodationContractInMonth } from './accommodationLifecycle';
import type { Accommodation } from '../types/accommodation';
import type { SupportCancellationLog } from '../types/supportCancellationLog';

const room = (patch: Partial<Accommodation> = {}) => ({ id: 'room', status: 'inactive', ...patch } as Accommodation);
const log = (patch: Partial<SupportCancellationLog> = {}) => ({
    resourceType: 'accommodation', resourceId: 'room', statusAfter: 'inactive',
    processedDate: '2026-11-12', createdAtIso: '2026-11-12T01:00:00Z', ...patch,
} as SupportCancellationLog);

it('비용 종료월까지 포함하고 다음 달부터 제외하며 처리일과 만기일에 영향받지 않는다', () => {
    const ended = room({ endedDate: '2026-11-12', billingEndYearMonth: '2026-10',
        contract: { startDate: '2026-01-01', endDate: '2026-11-10' } as Accommodation['contract'] });
    expect(isAccommodationContractInMonth(ended, '2026-10')).toBe(true);
    expect(isAccommodationContractInMonth(ended, '2026-11')).toBe(false);
    expect(getAccommodationStatusForMonth(ended, '2026-10')).toBe('active');
    expect(getAccommodationStatusForMonth(ended, '2026-11')).toBe('inactive');
    expect(getAccommodationStatusForMonth(ended, '2026-12')).toBe('inactive');
    expect(getAccommodationStatusForMonth(room({ status: 'active', endedDate: '2026-09-01' }), '2026-11')).toBe('active');
});

it('계약 만기보다 늦은 비용 종료월도 명시한 월까지 포함한다', () => {
    const ended = room({ billingEndYearMonth: '2026-12', contract: { startDate: '2026-10-12', endDate: '2026-11-10' } as Accommodation['contract'] });
    expect(isAccommodationContractInMonth(ended, '2026-09')).toBe(false);
    expect(isAccommodationContractInMonth(ended, '2026-12')).toBe(true);
    expect(isAccommodationContractInMonth(ended, '2027-01')).toBe(false);
});

it('과거 처리 이력에서 실제 종료일을 복원하되 원본은 변경하지 않는다', () => {
    const original = room();
    const restored = applyAccommodationTerminationHistory([original], [log()]);
    expect(restored[0].endedDate).toBe('2026-11-12');
    expect(restored[0].billingEndYearMonth).toBe('2026-11');
    expect(original.endedDate).toBeUndefined();
    expect(getAccommodationStatusForMonth(restored[0], '2026-10')).toBe('active');
});

it('처리 이력의 비용 종료월을 처리일보다 우선한다', () => {
    const restored = applyAccommodationTerminationHistory([room()], [log({ billingEndYearMonth: '2026-10' })]);
    expect(restored[0].billingEndYearMonth).toBe('2026-10');
    expect(getAccommodationStatusForMonth(restored[0], '2026-10')).toBe('active');
    expect(getAccommodationStatusForMonth(restored[0], '2026-11')).toBe('inactive');
});

it('현재 저장된 종료일과 최신 처리취소를 과거 이력으로 덮어쓰지 않는다', () => {
    expect(applyAccommodationTerminationHistory([room({ endedDate: '2026-10-01' })], [log()])[0].endedDate).toBe('2026-10-01');
    const restored = log({ statusAfter: 'active', createdAtIso: '2026-11-13T01:00:00Z' });
    expect(applyAccommodationTerminationHistory([room()], [restored, log()])[0].endedDate).toBeUndefined();
    expect(applyAccommodationTerminationHistory([room()], [log(), restored])[0].endedDate).toBeUndefined();
    expect(applyAccommodationTerminationHistory([room()], [log({ resourceType: 'vehicle' })])[0].endedDate).toBeUndefined();
});

it('종료일 근거가 없는 숙소를 임의로 과거 운영 중으로 추정하지 않는다', () => {
    expect(getAccommodationStatusForMonth(room(), '2026-10')).toBe('inactive');
    expect(applyAccommodationTerminationHistory([room()], [log({ processedDate: '' })])[0].endedDate).toBeUndefined();
});
