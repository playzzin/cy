import {
  isCurrentAccommodationAssignment,
  isCurrentAccommodationBillingTarget,
  matchesCurrentAccommodationTeamScope,
  isAccommodationAssignmentInMonth,
  matchesAccommodationTeamScopeForMonth,
} from './accommodationStatusScope';

const TODAY = new Date(2026, 7, 27, 12, 0, 0);

describe('accommodationStatusScope', () => {
  test('월별 배정은 당시의 종료된 이력을 포함하고 아직 시작하지 않은 배정은 제외한다', () => {
    const assignment = { status: 'ended' as const, startDate: '2026-07-12', endDate: '2026-09-12' };
    expect(isAccommodationAssignmentInMonth(assignment, '2026-06')).toBe(false);
    expect(isAccommodationAssignmentInMonth(assignment, '2026-07')).toBe(true);
    expect(isAccommodationAssignmentInMonth(assignment, '2026-09')).toBe(true);
    expect(isAccommodationAssignmentInMonth(assignment, '2026-10')).toBe(false);
    expect(isAccommodationAssignmentInMonth({ ...assignment, endDate: '' }, '2026-07')).toBe(false);
  });

  test('팀별 월 조회에서 배정 이력이 없을 때만 해당 월의 청구대상을 적용한다', () => {
    const assignment = { status: 'ended' as const, startDate: '2026-07-12', endDate: '2026-08-31', teamId: 'old' };
    const target = { startDate: '2026-09-12', teamId: 'new' };
    const matches = (value: { teamId: string }) => value.teamId === 'new';
    expect(matchesAccommodationTeamScopeForMonth([assignment], [target], matches, matches, '2026-08')).toBe(false);
    expect(matchesAccommodationTeamScopeForMonth([assignment], [target], matches, matches, '2026-09')).toBe(true);
    expect(matchesAccommodationTeamScopeForMonth([], [target], matches, matches, '2026-08')).toBe(false);
  });
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
