import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MonthlyAdvanceLedger, { type MonthlyAdvanceLedgerRow } from './MonthlyAdvanceLedger';
import type { LedgerManualInput } from '../types/payroll';

jest.mock('../../../services/payrollConfigService', () => ({
    DEFAULT_ADVANCE_ITEM_LABELS: {
        corporateAdvance1: '법인 이월',
        corporateAdvance2: '법인 추가 이월',
        corporateAdvance3: '법인 당월 가불',
        corporateAdvance4: '법인 추가 가불',
        laborAdvance1: '노무 이월',
        laborAdvance2: '노무 추가 이월',
        laborAdvance3: '노무 당월 가불',
        laborAdvance4: '노무 추가 가불',
    },
}));

const rows: MonthlyAdvanceLedgerRow[] = [{
    rowKey: '2026-07__worker-1',
    month: '2026-07',
    teamId: 'team-1',
    teamName: '테스트팀',
    workerId: 'worker-1',
    workerName: '홍길동',
    salaryModel: '월급제',
    invoiceManDay: 2,
    laborManDay: 3,
    unitPrice: 100000,
    invoiceGrossAmount: 200000,
    laborGrossAmount: 300000,
    workEntries: [],
}];

const initialInput = (laborAdvance: number): Record<string, LedgerManualInput> => ({
    [rows[0].rowKey]: {
        invoice: {
            carry: 0, carrySecond: 0, currentAdvance: 0, currentAdvanceSecond: 0,
            lodging: 0, electricity: 0, gas: 0, water: 0,
            internet: 0, management: 0, fine: 0, other: 0,
        },
        labor: {
            carry: 0, carrySecond: 0, currentAdvance: laborAdvance, currentAdvanceSecond: 0,
            lodging: 0, electricity: 0, gas: 0, water: 0,
            internet: 0, management: 0, fine: 0, other: 0,
        },
        personalMemo: '',
        assignmentType: 'labor',
        itemAssignments: {},
    },
});

describe('MonthlyAdvanceLedger 공제 분류', () => {
    it('전체 법인 적용 후에도 이름·구분·분류 열이 고정된 단일 선택기로 표시된다', () => {
        render(
            <MonthlyAdvanceLedger
                rows={rows}
                payrollConfig={null}
                withholdingThreshold={7}
                visibleSections={{ utilities: false, advances: false, taxes: false }}
            />
        );

        const allocationSelect = screen.getByRole('combobox', { name: '홍길동 공제 분류' });
        expect((allocationSelect as HTMLSelectElement).value).toBe('split');
        expect(screen.getByText('홍길동').getAttribute('title')).toBe('홍길동');
        expect(screen.getByText('월급제')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: '전체 법인' }));

        expect((allocationSelect as HTMLSelectElement).value).toBe('corporate');
    });

    it('사용자가 건드리지 않은 행은 새로 조회된 가불 원본값으로 갱신한다', () => {
        const view = render(
            <MonthlyAdvanceLedger
                rows={rows}
                payrollConfig={null}
                withholdingThreshold={7}
                visibleSections={{ utilities: false, advances: true, taxes: false }}
                initialInputs={initialInput(500000)}
            />
        );

        expect(screen.getByDisplayValue('500,000')).toBeTruthy();

        view.rerender(
            <MonthlyAdvanceLedger
                rows={rows}
                payrollConfig={null}
                withholdingThreshold={7}
                visibleSections={{ utilities: false, advances: true, taxes: false }}
                initialInputs={initialInput(1000000)}
            />
        );

        expect(screen.getByDisplayValue('1,000,000')).toBeTruthy();
    });

    it('공과금의 백만원대 금액에 충분한 입력 너비를 유지한다', () => {
        const utilities = initialInput(0);
        utilities[rows[0].rowKey].labor.other = 1414100;

        render(
            <MonthlyAdvanceLedger
                rows={rows}
                payrollConfig={null}
                withholdingThreshold={7}
                applyUtilities
                visibleSections={{ utilities: true, advances: false, taxes: false }}
                initialInputs={utilities}
            />
        );

        const amountInput = screen.getByDisplayValue('1,414,100');
        expect(amountInput.className).toContain('min-w-0');
        expect(amountInput.closest('td')?.className).toContain('min-w-[128px]');
    });
});
