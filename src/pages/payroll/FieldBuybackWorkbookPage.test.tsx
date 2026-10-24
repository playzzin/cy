import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FieldBuybackWorkbookPage from './FieldBuybackWorkbookPage';
import { settlementTargetService } from '../../services/settlementTargetService';
import { buybackWorkbookService } from '../../services/buybackWorkbookService';

jest.mock('../../services/settlementTargetService', () => ({
    normalizeSettlementTargetAfterTaxRate: (value: unknown) => Number(value ?? 0.75),
    settlementTargetService: {
        getTargets: jest.fn(),
        addTarget: jest.fn(),
        updateTarget: jest.fn(),
        deactivateTarget: jest.fn(),
    },
}));

jest.mock('../../services/buybackWorkbookService', () => ({
    buybackWorkbookService: {
        getEntriesByTargetIds: jest.fn(),
        saveEntry: jest.fn().mockResolvedValue(undefined),
        deleteEntry: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../components/common/YearMonthPicker', () => ({
    YearMonthPicker: ({ value, ariaLabel, inputClassName }: { value: string; ariaLabel?: string; inputClassName?: string }) => (
        <input readOnly value={value} aria-label={ariaLabel} className={inputClassName} />
    ),
}));

const targets = [
    { id: 'target-a', name: '김관계', positionTitle: '부장', targetType: 'client_contact', buybackEnabled: true, status: 'active', defaultAfterTaxRate: 0.75 },
    { id: 'target-b', name: '이관계', positionTitle: '이사', targetType: 'client_contact', buybackEnabled: true, status: 'active', defaultAfterTaxRate: 0.8 },
    { id: 'target-c', name: '박관계', positionTitle: '소장', targetType: 'client_contact', buybackEnabled: true, status: 'active', defaultAfterTaxRate: 0.75 },
];

const mockViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: jest.fn().mockImplementation((query: string) => ({
            matches: query.includes('max-width') ? width <= 767 : width >= 768,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
};

describe('FieldBuybackWorkbookPage mobile UX and accessibility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockViewport(375);
        window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)) as typeof window.requestAnimationFrame;
        window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
        HTMLElement.prototype.scrollIntoView = jest.fn();
        (settlementTargetService.getTargets as jest.Mock).mockResolvedValue(targets);
        (settlementTargetService.addTarget as jest.Mock).mockReset().mockResolvedValue('target-new');
        (settlementTargetService.updateTarget as jest.Mock).mockReset().mockResolvedValue(undefined);
        (settlementTargetService.deactivateTarget as jest.Mock).mockReset().mockResolvedValue(undefined);
        (buybackWorkbookService.getEntriesByTargetIds as jest.Mock).mockResolvedValue([]);
    });

    it('uses an accessible tablist and moves the active relationship with arrow keys', async () => {
        render(<FieldBuybackWorkbookPage />);

        const tabList = await screen.findByRole('tablist', { name: '정산 관계자' });
        const tabs = within(tabList).getAllByRole('tab');
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        expect(tabs[0]).toHaveAttribute('tabindex', '0');
        expect(tabs[1]).toHaveAttribute('tabindex', '-1');

        fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });

        await waitFor(() => expect(tabs[1]).toHaveAttribute('aria-selected', 'true'));
        expect(tabs[1]).toHaveFocus();
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[1].id);
    });

    it('hides zero-value rows for an empty relationship and starts with the pre-tax field', async () => {
        render(<FieldBuybackWorkbookPage />);

        expect(await screen.findByText('아직 정산 내역이 없습니다.')).toBeInTheDocument();
        expect(screen.getByText('첫 행에 세전 금액을 입력하거나 붙여넣으세요.')).toBeInTheDocument();
        expect(screen.queryByRole('table', { name: '관계자별 바이백 엑셀 입력표' })).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('자동 저장 준비');
        expect(screen.getByRole('button', { name: '관계자 DB 새로고침' })).toBeEnabled();

        fireEvent.click(screen.getByRole('button', { name: '새 정산 행 시작' }));

        const card = await screen.findByRole('article', { name: '1번째 정산 행' });
        await waitFor(() => expect(within(card).getByRole('textbox', { name: '1번째 정산 행 세전' })).toHaveFocus());
        expect(screen.getByRole('button', { name: '새 정산 행' })).toHaveClass('min-h-11');
        expect(screen.getByText('키보드 단축키 안내')).toBeInTheDocument();
    });

    it.each([375, 768, 1280])('keeps the %ipx layout on the no-overflow responsive contract', async (width) => {
        mockViewport(width);
        (buybackWorkbookService.getEntriesByTargetIds as jest.Mock).mockResolvedValue([{
            id: 'entry-a',
            targetId: 'target-a',
            targetName: '김관계 부장',
            date: '2026-08',
            year: '2026',
            month: '08',
            siteName: '서울 현장',
            preTax: 100000,
            afterTaxManual: false,
            note: '',
            paymentStatus: 'unpaid',
        }]);

        render(<FieldBuybackWorkbookPage />);

        const mobileCards = await screen.findByTestId('field-buyback-mobile-cards');
        const desktopGrid = screen.getByTestId('field-buyback-desktop-grid');
        const card = within(mobileCards).getByRole('article', { name: '1번째 정산 행' });

        expect(mobileCards).toHaveClass('md:hidden');
        expect(desktopGrid).toHaveClass('hidden', 'md:block');
        for (const field of ['연월 선택', '현장', '세전', '입금 상태', '비고']) {
            expect(within(card).getByLabelText(`1번째 정산 행 ${field}`)).toBeInTheDocument();
        }
        expect(within(card).getByLabelText('1번째 정산 행 자동 계산 세후')).toHaveTextContent('75,000원');
        expect(within(card).getByLabelText('1번째 정산 행 자동 계산 세금')).toHaveTextContent('25,000원');
    });

    it('registers the first buyback relationship and saves a row under its returned ID', async () => {
        (settlementTargetService.getTargets as jest.Mock).mockResolvedValue([]);
        render(<FieldBuybackWorkbookPage />);
        await screen.findByText(/등록된 바이백 관계자가 없습니다/);
        fireEvent.click(screen.getByRole('button', { name: '정산 관계자 등록' }));
        const dialog = screen.getByRole('dialog', { name: '정산 관계자 등록' });
        expect(within(dialog).getByLabelText('관계자 이름 (필수)')).toHaveFocus();
        fireEvent.change(within(dialog).getByLabelText('관계자 이름 (필수)'), { target: { value: ' 새관계 ' } });
        fireEvent.change(within(dialog).getByLabelText('직책/직급'), { target: { value: ' 과장 ' } });
        fireEvent.change(within(dialog).getByLabelText('기본 세후율 (%)'), { target: { value: '80' } });
        fireEvent.click(within(dialog).getByRole('button', { name: '관계자 등록' }));

        expect(await screen.findByRole('tab', { name: '새관계 과장' })).toHaveAttribute('aria-selected', 'true');
        expect(settlementTargetService.addTarget).toHaveBeenCalledWith(expect.objectContaining({
            name: '새관계', positionTitle: '과장', defaultAfterTaxRate: 0.8,
            targetType: 'client_contact', defaultProcessType: 'payable', buybackEnabled: true, status: 'active',
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '새 정산 행 시작' }));
        const preTax = screen.getByRole('textbox', { name: '1번째 정산 행 세전' });
        fireEvent.change(preTax, { target: { value: '100000' } });
        fireEvent.blur(preTax);
        await waitFor(() => expect(buybackWorkbookService.saveEntry).toHaveBeenCalledWith(expect.objectContaining({
            targetId: 'target-new', targetName: '새관계 과장', preTax: 100000,
        })));
        expect(screen.getByLabelText('1번째 정산 행 자동 계산 세후')).toHaveTextContent('80,000원');
    });

    it('preserves existing draft rows when adding a relationship', async () => {
        render(<FieldBuybackWorkbookPage />);
        fireEvent.click(await screen.findByRole('button', { name: '새 정산 행 시작' }));
        fireEvent.click(screen.getByRole('button', { name: '정산 관계자 등록' }));
        fireEvent.change(screen.getByLabelText('관계자 이름 (필수)'), { target: { value: '새관계' } });
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '관계자 등록' }));
        expect(await screen.findByRole('tab', { name: '새관계' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('tab', { name: '김관계 부장' }));
        expect(screen.getByRole('article', { name: '1번째 정산 행' })).toBeInTheDocument();
        expect(settlementTargetService.getTargets).toHaveBeenCalledTimes(1);
    });

    it('updates the selected relationship and rate while preserving rows and manual amounts', async () => {
        (settlementTargetService.getTargets as jest.Mock).mockResolvedValue([
            { ...targets[0], companyId: 'company-a', companyName: '연결 회사', defaultProcessType: 'memo' }, ...targets.slice(1),
        ]);
        (buybackWorkbookService.getEntriesByTargetIds as jest.Mock).mockResolvedValue([
            { id: 'auto-row', targetId: 'target-a', preTax: 100000, afterTaxManual: false, paymentStatus: 'unpaid', siteName: '', note: '' },
            { id: 'manual-row', targetId: 'target-a', preTax: 100000, afterTax: 70000, afterTaxManual: true, paymentStatus: 'paid', siteName: '', note: '' },
        ]);
        render(<FieldBuybackWorkbookPage />);
        fireEvent.click(await screen.findByRole('button', { name: '관계자 수정' }));
        expect(screen.getByLabelText('관계자 이름 (필수)')).toHaveValue('김관계');
        fireEvent.change(screen.getByLabelText('관계자 이름 (필수)'), { target: { value: '수정관계' } });
        fireEvent.change(screen.getByLabelText('기본 세후율 (%)'), { target: { value: '82.5' } });
        fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
        expect(await screen.findByRole('tab', { name: '수정관계 부장' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('82.5%')).toBeInTheDocument();
        expect(screen.getByLabelText('1번째 정산 행 자동 계산 세후')).toHaveTextContent('82,500원');
        expect(screen.getByLabelText('2번째 정산 행 자동 계산 세후')).toHaveTextContent('70,000원');
        const [id, updates] = (settlementTargetService.updateTarget as jest.Mock).mock.calls[0];
        expect(id).toBe('target-a');
        expect(updates).toEqual(expect.objectContaining({ name: '수정관계', defaultAfterTaxRate: 0.825 }));
        expect(updates).not.toHaveProperty('companyId');
        expect(updates).not.toHaveProperty('defaultProcessType');
        expect(buybackWorkbookService.saveEntry).not.toHaveBeenCalled();
        expect(settlementTargetService.getTargets).toHaveBeenCalledTimes(1);
    });

    it('requires deletion confirmation, preserves ledger records, and selects the remaining relationship', async () => {
        render(<FieldBuybackWorkbookPage />);
        fireEvent.click(await screen.findByRole('button', { name: '관계자 삭제' }));
        expect(screen.getByRole('dialog')).toHaveTextContent('기존 정산 내역은 보존됩니다.');
        expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(settlementTargetService.deactivateTarget).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '관계자 삭제' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '관계자 삭제' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(settlementTargetService.deactivateTarget).toHaveBeenCalledWith('target-a');
        expect(screen.queryByRole('tab', { name: '김관계 부장' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: '이관계 이사' })).toHaveAttribute('aria-selected', 'true');
        expect(buybackWorkbookService.deleteEntry).not.toHaveBeenCalled();
    });

    it('keeps registration available after deleting the last relationship', async () => {
        (settlementTargetService.getTargets as jest.Mock).mockResolvedValue([targets[0]]);
        render(<FieldBuybackWorkbookPage />);
        fireEvent.click(await screen.findByRole('button', { name: '관계자 삭제' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '관계자 삭제' }));
        await screen.findByText(/등록된 바이백 관계자가 없습니다/);
        expect(screen.getByRole('button', { name: '정산 관계자 등록' })).toBeEnabled();
    });

    it.each(['', '-1', '101'])('rejects the invalid after-tax percentage %s before saving', async (percent) => {
        render(<FieldBuybackWorkbookPage />);
        await screen.findByRole('tablist');
        fireEvent.click(screen.getByRole('button', { name: '정산 관계자 등록' }));
        fireEvent.change(screen.getByLabelText('관계자 이름 (필수)'), { target: { value: '새관계' } });
        fireEvent.change(screen.getByLabelText('기본 세후율 (%)'), { target: { value: percent } });
        fireEvent.submit(screen.getByRole('form', { name: '정산 관계자 등록' }));
        expect(screen.getByRole('alert')).toHaveTextContent('0% 이상 100% 이하');
        expect(settlementTargetService.addTarget).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only name', async () => {
        render(<FieldBuybackWorkbookPage />);
        await screen.findByRole('tablist');
        fireEvent.click(screen.getByRole('button', { name: '정산 관계자 등록' }));
        fireEvent.change(screen.getByLabelText('관계자 이름 (필수)'), { target: { value: '   ' } });
        fireEvent.submit(screen.getByRole('form', { name: '정산 관계자 등록' }));
        expect(screen.getByRole('alert')).toHaveTextContent('관계자 이름을 입력');
        expect(settlementTargetService.addTarget).not.toHaveBeenCalled();
    });

    it.each(['create', 'edit', 'delete'] as const)('retains the form and existing relationship when %s fails', async mode => {
        const service = mode === 'create' ? settlementTargetService.addTarget : mode === 'edit' ? settlementTargetService.updateTarget : settlementTargetService.deactivateTarget;
        (service as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
        render(<FieldBuybackWorkbookPage />);
        await screen.findByRole('tablist');
        fireEvent.click(screen.getByRole('button', { name: mode === 'create' ? '정산 관계자 등록' : mode === 'edit' ? '관계자 수정' : '관계자 삭제' }));
        if (mode === 'create') fireEvent.change(screen.getByLabelText('관계자 이름 (필수)'), { target: { value: '새관계' } });
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: mode === 'create' ? '관계자 등록' : mode === 'edit' ? '변경사항 저장' : '관계자 삭제' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('권한과 연결 상태');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(screen.getByRole('tab', { name: '김관계 부장' })).toHaveAttribute('aria-selected', 'true');
    });

    it('prevents duplicate registration and dismissal while saving', async () => {
        let finishSave!: (id: string) => void;
        (settlementTargetService.addTarget as jest.Mock).mockReturnValueOnce(new Promise<string>(resolve => { finishSave = resolve; }));
        render(<FieldBuybackWorkbookPage />);
        await screen.findByRole('tablist');
        fireEvent.click(screen.getByRole('button', { name: '정산 관계자 등록' }));
        fireEvent.change(screen.getByLabelText('관계자 이름 (필수)'), { target: { value: '새관계' } });
        fireEvent.submit(screen.getByRole('form', { name: '정산 관계자 등록' }));
        fireEvent.submit(screen.getByRole('form', { name: '정산 관계자 등록' }));
        expect(settlementTargetService.addTarget).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await act(async () => finishSave('target-new'));
        expect(screen.getByRole('tab', { name: '새관계' })).toHaveAttribute('aria-selected', 'true');
    });
});
