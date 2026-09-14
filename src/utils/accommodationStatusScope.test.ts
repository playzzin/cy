import {
  isCurrentAccommodationAssignment,
  isCurrentAccommodationBillingTarget,
  matchesCurrentAccommodationTeamScope,
} from './accommodationStatusScope';

const TODAY = new Date(2026, 7, 27, 12, 0, 0);

describe('accommodationStatusScope', () => {
  test('현재 진행 중인 배정만 숙소현황 팀 필터에 포함한다', () => {
    expect(isCurrentAccommodationAssignment({
      status: 'active',
      startDate: '2026-07-27',
    }, TODAY)).toBe(true);

    expect(isCurrentAccommodationAssignment({
      status: 'ended',
      startDate: '2026-05-20',
      endDate: '2026-06-23',
    }, TODAY)).toBe(false);

    expect(isCurrentAccommodationAssignment({
      status: 'active',
      startDate: '2026-08-28',
    }, TODAY)).toBe(false);
  });

  test('종료된 과거 청구대상은 현재 팀 필터에서 제외한다', () => {
    expect(isCurrentAccommodationBillingTarget({
      startDate: '2026-01-01',
      endDate: '2026-04-30',
    }, TODAY)).toBe(false);

    expect(isCurrentAccommodationBillingTarget({
      startDate: '2026-06-20',
    }, TODAY)).toBe(true);
  });

  test('현재 배정이 있으면 개인 청구대상의 팀 정보보다 현재 배정팀을 우선한다', () => {
    const currentLeeAssignment = {
      status: 'active' as const,
      startDate: '2026-08-01',
      teamName: '이재욱팀',
    };
    const currentKimBillingTarget = {
      startDate: '2026-08-01',
      teamName: '김군회팀',
    };

    expect(matchesCurrentAccommodationTeamScope<
      typeof currentLeeAssignment,
      typeof currentKimBillingTarget
    >(
      [currentLeeAssignment],
      [currentKimBillingTarget],
      (assignment) => assignment.teamName === '김군회팀',
      (target) => target.teamName === '김군회팀',
      TODAY
    )).toBe(false);

    expect(matchesCurrentAccommodationTeamScope<
      typeof currentLeeAssignment,
      typeof currentKimBillingTarget
    >(
      [],
      [currentKimBillingTarget],
      () => false,
      (target) => target.teamName === '김군회팀',
      TODAY
    )).toBe(true);
  });
});
