import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useReactToPrint } from 'react-to-print';
import { useDocumentStamp } from '../../hooks/useDocumentStamp';
import EmploymentCertificatePage from './EmploymentCertificatePage';
import TerminationCertificatePage from './TerminationCertificatePage';

jest.mock('../../services/companyService', () => ({
    companyService: {
        getCompanies: async () => [{ id: 'test-company', name: '청연', type: '시공사', ceoName: '테스트대표' }],
    },
}));
jest.mock('../../services/manpowerService', () => ({
    manpowerService: {
        getWorkers: async () => [{ id: 'test-worker', name: '테스트근로자', companyId: 'test-company' }],
    },
}));
jest.mock('../../hooks/useDocumentStamp', () => ({ useDocumentStamp: jest.fn() }));
jest.mock('react-to-print', () => ({ useReactToPrint: jest.fn() }));
jest.mock('date-fns/locale', () => ({ ko: undefined }));

const print = jest.fn();
let printContent: React.RefObject<HTMLDivElement>;
let printedDocuments: HTMLElement[];

beforeEach(() => {
    jest.clearAllMocks();
    printedDocuments = [];
    (useDocumentStamp as jest.Mock).mockReturnValue('/test-stamp.png');
    (useReactToPrint as jest.Mock).mockImplementation(({ contentRef }) => {
        printContent = contentRef;
        return print;
    });
    print.mockImplementation(() => {
        printedDocuments.push(printContent.current!.cloneNode(true) as HTMLElement);
    });
});

afterEach(() => jest.restoreAllMocks());

it('재직증명서 기본 직위·업무를 선택과 취소 시 적용하고 수정값을 인쇄한다', async () => {
    render(<EmploymentCertificatePage />);
    const position = screen.getByRole('textbox', { name: '직위 (Rank)' });
    const duties = screen.getByRole('textbox', { name: '담당업무 (Duties)' });
    expect(position).toHaveValue('팀원');
    expect(duties).toHaveValue('비계공');
    fireEvent.click(await screen.findByText(/테스트근로자 \(/));
    expect(position).toHaveValue('팀원');
    expect(duties).toHaveValue('비계공');
    fireEvent.change(position, { target: { value: '팀장' } });
    fireEvent.change(duties, { target: { value: '현장관리' } });
    fireEvent.click(screen.getByRole('button', { name: '재직증명서 인쇄 / PDF 저장' }));
    expect(printedDocuments[0]).toHaveTextContent('팀장');
    expect(printedDocuments[0]).toHaveTextContent('현장관리');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(position).toHaveValue('팀원');
    expect(duties).toHaveValue('비계공');
});

describe.each([
    ['재직증명서', EmploymentCertificatePage],
    ['해촉증명서', TerminationCertificatePage],
] as const)('%s 도장 인쇄', (title, Page) => {
    const openCertificate = async () => {
        render(<Page />);
        fireEvent.click(await screen.findByText(/테스트근로자 \(/));
        return screen.getByRole('button', { name: `${title} 인쇄 / PDF 저장` });
    };

    it('기본으로 도장을 포함하고 제외·재포함 선택을 미리보기와 인쇄 문서에 반영한다', async () => {
        const printButton = await openCertificate();
        const stampSelect = screen.getByRole('combobox', { name: '도장 인쇄' });
        expect(stampSelect).toHaveValue('include');
        expect(screen.getByAltText('직인')).toBeInTheDocument();
        fireEvent.click(printButton);
        expect(within(printedDocuments[0]).getByAltText('직인')).toHaveAttribute('src', '/test-stamp.png');

        fireEvent.change(stampSelect, { target: { value: 'exclude' } });
        expect(screen.queryByAltText('직인')).not.toBeInTheDocument();
        expect(screen.getByText('대표이사 테스트대표 (인)')).toBeInTheDocument();
        fireEvent.click(printButton);
        expect(within(printedDocuments[1]).queryByAltText('직인')).toBeNull();
        expect(printedDocuments[1]).toHaveTextContent('테스트근로자');
        expect(printedDocuments[1]).not.toHaveTextContent('도장 인쇄');

        fireEvent.change(stampSelect, { target: { value: 'include' } });
        expect(screen.getByAltText('직인')).toBeInTheDocument();
        fireEvent.click(printButton);
        expect(within(printedDocuments[2]).getByAltText('직인')).toHaveAttribute('src', '/test-stamp.png');
    });

    it('도장 이미지가 없을 때 표시하는 대체 도장도 제외한다', async () => {
        (useDocumentStamp as jest.Mock).mockReturnValue(null);
        const printButton = await openCertificate();
        expect(within(printContent.current!).getByText('인', { exact: true })).toBeInTheDocument();

        fireEvent.change(screen.getByRole('combobox', { name: '도장 인쇄' }), { target: { value: 'exclude' } });
        expect(within(printContent.current!).queryByText('인', { exact: true })).not.toBeInTheDocument();
        fireEvent.click(printButton);
        expect(within(printedDocuments[0]).queryByText('인', { exact: true })).toBeNull();
        expect(printedDocuments[0]).toHaveTextContent('대표이사 테스트대표 (인)');
    });

    it('기본 인쇄 실패 후 새 창으로 인쇄할 때도 도장 제외를 유지한다', async () => {
        const printButton = await openCertificate();
        const popup = {
            document: { open: jest.fn(), write: jest.fn(), close: jest.fn() },
            focus: jest.fn(),
            print: jest.fn(),
        };
        jest.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        print.mockImplementationOnce(() => { throw new Error('print unavailable'); });

        fireEvent.change(screen.getByRole('combobox', { name: '도장 인쇄' }), { target: { value: 'exclude' } });
        fireEvent.click(printButton);
        await waitFor(() => expect(popup.print).toHaveBeenCalledTimes(1));
        const printedHtml = popup.document.write.mock.calls[0][0];
        expect(printedHtml).toContain('테스트근로자');
        expect(printedHtml).not.toContain('/test-stamp.png');
        expect(printedHtml).not.toContain('도장 인쇄');
    });
});
