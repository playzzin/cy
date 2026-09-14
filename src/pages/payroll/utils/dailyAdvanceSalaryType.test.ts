import {
  normalizeDailyAdvanceSalaryType,
  resolveDailyAdvanceRowSalaryType,
} from './dailyAdvanceSalaryType';

describe('dailyAdvanceSalaryType', () => {
  test('과거 일보가 월급제이면 현재 인원DB가 일급제여도 월급제를 유지한다', () => {
    expect(
      resolveDailyAdvanceRowSalaryType(
        { salaryModel: '월급제', payType: '월급제' },
        { salaryModel: '일급제', payType: '일급제' }
      )
    ).toBe('월급제');
  });

  test('과거 일보에 급여형태가 없을 때만 현재 인원DB 값을 사용한다', () => {
    expect(
      resolveDailyAdvanceRowSalaryType(
        { salaryModel: '', payType: undefined },
        { salaryModel: '일급제', payType: '일급제' }
      )
    ).toBe('일급제');
  });

  test('첫 번째로 저장된 급여형태를 우선하고 용역·일급 별칭을 정규화한다', () => {
    expect(normalizeDailyAdvanceSalaryType('월급제', '일급제')).toBe('월급제');
    expect(normalizeDailyAdvanceSalaryType('인력소개', '월급제')).toBe('용역팀');
    expect(normalizeDailyAdvanceSalaryType('일당', '월급제')).toBe('일급제');
  });
});
