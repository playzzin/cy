import type { AdvancePayment } from '../../../services/advancePaymentService';
import type { LedgerManualInput } from '../types/payroll';
import {
  buildManualInputFromAdvanceRecord,
  resolveInitialLedgerManualInput,
} from './advanceLedgerInput';

const advanceRecord = (overrides: Partial<AdvancePayment> = {}): AdvancePayment => ({
  workerId: 'worker-1',
  workerName: '김승희',
  teamId: 'team-1',
  teamName: '이재욱팀',
  salaryModel: '월급제',
  yearMonth: '2026-07',
  items: {},
  prevMonthCarryover: 0,
  accommodation: 580000,
  privateRoom: 0,
  gloves: 0,
  deposit: 0,
  fines: 0,
  electricity: 31760,
  gas: 37550,
  internet: 0,
  water: 0,
  totalDeduction: 0,
  ...overrides,
});

const manualInput = (laborOverrides: Partial<LedgerManualInput['labor']> = {}): LedgerManualInput => ({
  invoice: {
    carry: 0,
    carrySecond: 0,
    currentAdvance: 0,
    currentAdvanceSecond: 0,
    lodging: 580000,
    electricity: 31760,
    gas: 37550,
    water: 0,
    internet: 0,
    management: 0,
    fine: 0,
    other: 0,
  },
  labor: {
    carry: 0,
    carrySecond: 0,
    currentAdvance: 0,
    currentAdvanceSecond: 0,
    lodging: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    internet: 0,
    management: 0,
    fine: 0,
    other: 0,
    ...laborOverrides,
  },
  personalMemo: '',
  assignmentType: 'labor',
  itemAssignments: {},
});

describe('가불관리 → 통합급여 입력 변환', () => {
  it('사용자 정의 ID로 저장된 기타와 노무 당월 가불을 모두 가져온다', () => {
    const result = buildManualInputFromAdvanceRecord(
      advanceRecord({
        items: {
          customOtherDeduction: 1414100,
          laborAdvance3: 500000,
          laborAdvance4: 1000000,
        },
        itemAssignments: { customOtherDeduction: 'labor' },
      }),
      { customOtherDeduction: '기타' }
    );

    expect(result?.labor.other).toBe(1414100);
    expect(result?.labor.currentAdvance).toBe(500000);
    expect(result?.labor.currentAdvanceSecond).toBe(1000000);
    expect(result?.itemAssignments?.other).toBe('labor');
  });

  it('가불관리 변경이 급여 초안보다 최신이면 최신 원본을 우선한다', () => {
    const source = manualInput({ other: 1414100, currentAdvance: 500000, currentAdvanceSecond: 1000000 });
    const staleDraft = manualInput();

    expect(resolveInitialLedgerManualInput({
      advanceInput: source,
      advanceUpdatedAt: '2026-08-25T02:32:00.000Z',
      settlementInput: staleDraft,
      settlementUpdatedAt: '2026-08-25T02:00:00.000Z',
      settlementStatus: 'draft',
    })).toBe(source);
  });

  it('확정된 급여는 이후 가불관리 변경으로 덮어쓰지 않는다', () => {
    const source = manualInput({ other: 1414100 });
    const confirmed = manualInput({ other: 100000 });

    expect(resolveInitialLedgerManualInput({
      advanceInput: source,
      advanceUpdatedAt: '2026-08-25T02:32:00.000Z',
      settlementInput: confirmed,
      settlementUpdatedAt: '2026-08-25T02:00:00.000Z',
      settlementStatus: 'confirmed',
    })).toBe(confirmed);
  });

  it('시간 정보가 없는 구형 초안은 새로 추가된 0원 칸만 원본으로 보완한다', () => {
    const source = manualInput({ other: 1414100, currentAdvance: 500000 });
    const legacyDraft = manualInput({ currentAdvance: 200000 });

    const result = resolveInitialLedgerManualInput({
      advanceInput: source,
      settlementInput: legacyDraft,
      settlementStatus: 'draft',
    });

    expect(result?.labor.other).toBe(1414100);
    expect(result?.labor.currentAdvance).toBe(200000);
  });
});
