import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FieldBuybackWorkbookPage from './FieldBuybackWorkbookPage';
import { settlementTargetService } from '../../services/settlementTargetService';
import { buybackWorkbookService } from '../../services/buybackWorkbookService';

jest.mock('../../services/settlementTargetService', () => ({
    normalizeSettlementTargetAfterTaxRate: (value: unknown) => Number(value ?? 0.75),
    settlementTargetService: {
        getTargets: jest.fn(),
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
        expect(screen.getByText(/관계자 DB:/).parentElement).toHaveTextContent('관계자 DB:연결됨');
        expect(screen.getByText(/현장 DB:/).parentElement).toHaveTextContent('현장 DB:미연동');

        fireEvent.click(screen.getByRole('button', { name: '새 정산 행 시작' }));

        const card = await screen.findByRole('article', { name: '1번째 정산 행' });
        await waitFor(() => expect(within(card).getByRole('textbox', { name: '1번째 정산 행 세전' })).toHaveFocus());
        expect(screen.getByRole('button', { name: '새 정산 행' })).toHaveClass('min-h-11');
        expect(screen.getByText('키보드 단축키 안내').closest('summary')).toHaveClass('min-h-11');
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
        const labels = Array.from(card.querySelectorAll('label > span, div[aria-live="polite"] > span')).map((node) => node.textContent);

        expect(mobileCards).toHaveClass('md:hidden');
        expect(desktopGrid).toHaveClass('hidden', 'md:block');
        expect(mobileCards.closest('.min-h-screen')).toHaveClass('max-w-full', 'overflow-x-hidden');
        expect(labels).toEqual(['연월', '현장', '세전', '자동 계산 세후 / 세금', '입금 상태', '비고']);
        expect(within(card).getByLabelText('1번째 정산 행 자동 계산 세후')).toHaveTextContent('75,000원');
        expect(within(card).getByLabelText('1번째 정산 행 자동 계산 세금')).toHaveTextContent('25,000원');
    });
});
