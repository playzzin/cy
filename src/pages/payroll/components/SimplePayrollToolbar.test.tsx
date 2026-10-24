import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PayrollToolbar, type PayrollToolbarProps } from './SimplePayrollToolbar';
import type { Worker } from '../../../services/manpowerService';

jest.mock('../../../components/common/CompanyTeamSelector', () => ({
    __esModule: true,
    default: ({ onChange }: { onChange: (id: string) => void }) => <button onClick={() => onChange('team-1')}>검증 팀 선택</button>,
}));

const workers = [
    { id: 'worker-1', name: '검증 하나', payType: '월급제' },
    { id: 'worker-2', name: '검증 둘', payType: '월급제' },
] as Worker[];

function Harness({ fetchData = jest.fn() }: { fetchData?: () => void }) {
    const [filterMode, setFilterMode] = useState<'team' | 'worker'>('team');
    const [workerSearchText, setWorkerSearchText] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const props: PayrollToolbarProps = {
        hideHeader: false, rangeLabel: '2026-10', targetCount: 2,
        monthSelectionMode: 'single', yearCursor: '2026-10',
        formatYearMonthParts: () => ({ year: '2026', month: '10' }),
        monthRangeSet: new Set(['2026-10']), startMonth: '2026-10', endMonth: '2026-10',
        teams: [], filterMode, setFilterMode, workerSearchText, setWorkerSearchText,
        selectedWorkerId, setSelectedWorkerId, selectedTeamId, setSelectedTeamId,
        workerOptions: workers, pageViewMode: 'ledger', toolbarExpanded: false,
        fetchData, primaryAccountSettings: null,
        monthRangeLength: 1, totalLoadCount: 2, handleMonthModeChange: jest.fn(),
        setYearCursor: jest.fn(), shiftYearMonth: (ym) => ym,
        handleSelectPrevMonth: jest.fn(), handleSelectCurrentMonth: jest.fn(),
        rangeAnchorMonth: null, handleMonthButtonSelect: jest.fn(),
        teamDropdownRef: { current: null }, teamDropdownOpen: false, setTeamDropdownOpen: jest.fn(), selectedTeamLabel: '전체 팀',
        setPageViewMode: jest.fn(), ledgerSalaryModelFilter: 'all', setLedgerSalaryModelFilter: jest.fn(),
        ledgerVisibleSections: { utilities: false, advances: true, taxes: false }, setLedgerVisibleSections: jest.fn(),
        showAccountColumns: false, setShowAccountColumns: jest.fn(), showCalculationLabor: false, setShowCalculationLabor: jest.fn(),
        insuranceApplied: false, insuranceTeamSiteOnly: false, businessIncomeApplied: false, utilitiesApplied: false, dailyFeeApplied: false,
        applyCalculatedDeductions: jest.fn(), insuranceThresholdDays: 8,
        withholdingApplyAllLaborView: true, WITHHOLDING_MAX_MAN_DAY: 7, withholdingBaseDeductionWonView: 150000,
        withholdingIncomeRatePercentView: 6, withholdingTaxCreditPercentView: 55, withholdingResidentRatePercentView: 10,
        employmentApplyBelowThresholdView: false, dailyWorkerFeePerManDayView: 15000,
        setToolbarExpanded: jest.fn(), openInsuranceSettings: jest.fn(), setShowKBPreview: jest.fn(),
        isPaymentDataEmpty: false, openPayslipPreview: jest.fn(), handleBatchDownload: jest.fn(), batchDownloading: false,
        advanceLedgerRef: { current: null }, isLedgerRowsDataEmpty: false, currentYearMonth: '2026-10',
        handleSavePayrollSettlement: jest.fn(), payrollSettlementSaving: false, payrollSettlementLoading: false,
        payrollSettlementFeedback: '', payrollSettlementDisabled: false,
    };
    return <>
        <PayrollToolbar {...props} />
        <output aria-label="선택 결과">{filterMode}:{selectedWorkerId}:{selectedTeamId}</output>
    </>;
}

it('이름 검색 중 방향키와 Enter로 작업자를 선택하고 지우면 팀 조회로 돌아간다', () => {
    const fetchData = jest.fn();
    render(<Harness fetchData={fetchData} />);
    const input = screen.getByRole('combobox', { name: '개인 이름 검색' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '검증' } });
    expect(screen.getByLabelText('선택 결과').textContent).toBe('worker::');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: '검증 둘 월급제' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByLabelText('선택 결과').textContent).toBe('worker:worker-2:');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(fetchData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '개인 검색 지우기' }));
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('선택 결과').textContent).toBe('team::');
    expect(input).toHaveFocus();
});

it('Escape와 바깥 포커스로 목록을 닫고 선택 없는 Enter는 현재 이름으로 조회한다', () => {
    const fetchData = jest.fn();
    render(<Harness fetchData={fetchData} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '검증' } });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(fetchData).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: '조회' }) });
    expect(screen.queryByRole('listbox')).toBeNull();
});

it('검색 목록을 눌러 선택한 뒤 팀을 선택하면 개인 검색이 해제된다', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '검증' } });
    fireEvent.click(screen.getByRole('option', { name: '검증 하나 월급제' }));
    expect(screen.getByLabelText('선택 결과').textContent).toBe('worker:worker-1:');
    fireEvent.click(screen.getByRole('button', { name: '검증 팀 선택' }));
    expect(screen.getByLabelText('선택 결과').textContent).toBe('team::team-1');
    expect((input as HTMLInputElement).value).toBe('');
});
