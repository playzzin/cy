import { isEmployedInMonth, validateEmploymentPeriod, withEmploymentDates } from './workerEmploymentPeriod';

const former = { status: '퇴사', joinDate: '2025-12-31', retirementDate: '2026-09-01' };
it('출역 없는 재직월과 입사·퇴사월을 포함하고 그 밖의 월은 제외한다', () => {
    expect(isEmployedInMonth(former, '2025-11')).toBe(false);
    for (const month of ['2025-12', '2026-01', '2026-08', '2026-09']) expect(isEmployedInMonth(former, month)).toBe(true);
    expect(isEmployedInMonth(former, '2026-10')).toBe(false);
    expect(isEmployedInMonth({ status: '재직', joinDate: '2026-09-30' }, '2026-10')).toBe(true);
});
it('퇴사일을 마지막 출역일이나 수정일로 추정하지 않는다', () => {
    expect(isEmployedInMonth({ status: '퇴사' }, '2026-09', '2026-01-01')).toBe(false);
    expect(isEmployedInMonth({ status: '재직' }, '2026-09', '2026-01-01')).toBe(true);
    expect(isEmployedInMonth({ status: '출입금지', joinDate: '2026-01-01' }, '2026-09')).toBe(false);
});
it('잘못된 날짜와 역전된 기간을 거부한다', () => {
    for (const joinDate of ['2026-02-29', '2026-13-01', 'invalid']) expect(validateEmploymentPeriod({ joinDate })).toBeTruthy();
    expect(validateEmploymentPeriod({ joinDate: '2026-10-01', retirementDate: '2026-09-30' })).toBeTruthy();
    expect(validateEmploymentPeriod({ joinDate: '2024-02-29', retirementDate: '2024-02-29' })).toBe('');
});
it('퇴사와 취소의 날짜를 상태와 함께 저장하고 무관한 수정에는 날짜를 추가하지 않는다', () => {
    const before = { status: '재직', isActive: true, joinDate: '2026-01-01' };
    expect(withEmploymentDates(before, { status: '퇴사', retirementDate: '2026-09-30' })).toEqual({ status: '퇴사', isActive: false, retirementDate: '2026-09-30' });
    expect(withEmploymentDates({ ...former, isActive: false }, { status: '재직' })).toEqual({ status: '재직', isActive: true, retirementDate: '' });
    expect(withEmploymentDates(former, {})).toEqual({});
    expect(() => withEmploymentDates(before, { retirementDate: '2025-12-01' })).toThrow('빠를 수 없습니다');
});
