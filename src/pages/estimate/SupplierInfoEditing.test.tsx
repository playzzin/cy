import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Swal from 'sweetalert2';
import { estimateService, Estimate } from '../../services/estimateService';
import { companyFirestoreService } from '../../services/companyFirestoreService';
import materialService from '../../services/materialService';
import { downloadEstimateExcel } from '../../utils/estimateExcelUtils';
import { getEmptyDraft } from '../../utils/estimateUtils';
import EstimateManagePage from './EstimateManagePage';
import TransactionManagePage from './TransactionManagePage';

jest.mock('../../services/estimateService', () => ({
    estimateService: { getEstimates: jest.fn(), addEstimate: jest.fn(), updateEstimate: jest.fn() },
}));
jest.mock('../../services/companyFirestoreService', () => ({
    companyFirestoreService: { getCompanies: jest.fn() },
}));
jest.mock('../../services/materialService', () => ({
    __esModule: true,
    default: { getUniqueMaterialsForSelection: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../hooks/useDocumentStamp', () => ({ useDocumentStamp: () => '' }));
jest.mock('../../utils/estimateExcelUtils', () => ({ downloadEstimateExcel: jest.fn().mockResolvedValue(undefined) }));
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn() } }));

const supplier = {
    supplierCompany: '검증 공급사', supplierBizNo: '000-00-00000', supplierName: '대표자 A',
    supplierAddress: '테스트 주소', supplierContact: '02-000-0000', supplierFax: '02-000-0001',
    supplierAccount: '테스트은행 000-000', supplierManager: '담당자 A', supplierManagerContact: '010-0000-0000',
};

const updatedSupplier = {
    supplierCompany: '변경 공급사', supplierBizNo: '000-00-00001', supplierName: '대표자 B',
    supplierAddress: '변경 주소', supplierContact: '02-000-0002', supplierFax: '',
    supplierAccount: '검증은행 000-001', supplierManager: '담당자 B', supplierManagerContact: '010-0000-0001',
};

const fields = [
    ['상호', 'supplierCompany'], ['사업자등록번호', 'supplierBizNo'], ['대표자', 'supplierName'],
    ['주소', 'supplierAddress'], ['전화', 'supplierContact'], ['팩스', 'supplierFax'],
    ['은행 / 계좌번호', 'supplierAccount'], ['담당자', 'supplierManager'], ['담당자 연락처', 'supplierManagerContact'],
] as const;

const pages = [
    { type: 'estimate' as const, Page: EstimateManagePage, save: '견적서 저장', edit: '견적서 수정' },
    { type: 'transaction' as const, Page: TransactionManagePage, save: '명세표 저장', edit: '명세표 수정' },
];

let savedDocuments: Estimate[];

beforeEach(() => {
    jest.clearAllMocks();
    savedDocuments = [];
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([]);
    (downloadEstimateExcel as jest.Mock).mockResolvedValue(undefined);
    (companyFirestoreService.getCompanies as jest.Mock).mockResolvedValue([{
        id: 'company', name: supplier.supplierCompany, isMyCompany: true,
        businessNumber: supplier.supplierBizNo, ceoName: supplier.supplierName,
        address: supplier.supplierAddress, phone: supplier.supplierContact, fax: supplier.supplierFax,
        bankName: '테스트은행', accountNumber: '000-000',
    }]);
    (estimateService.getEstimates as jest.Mock).mockImplementation(async () => [...savedDocuments]);
    (estimateService.updateEstimate as jest.Mock).mockImplementation(async (id, payload) => {
        savedDocuments = savedDocuments.map(document => document.id === id ? { ...document, ...payload } : document);
    });
    (estimateService.addEstimate as jest.Mock).mockImplementation(async payload => {
        savedDocuments.push({ ...payload, id: 'new-document' });
        return 'new-document';
    });
});

describe.each(pages)('$type 상단 공급자 정보', ({ type, Page, save, edit }) => {
    it('문서와 양방향으로 동기화하고 수정 내용을 저장·다시 열기·엑셀 출력에 유지한다', async () => {
        savedDocuments = [{ ...getEmptyDraft(type), ...supplier, id: 'document', title: '검증 문서', clientCompany: '검증 발주사', subtotal: 0, total: 0 }];
        const view = render(<Page />);
        fireEvent.click(await screen.findByRole('heading', { name: '검증 문서' }));
        fireEvent.click(screen.getByRole('button', { name: '공급자 정보' }));
        const panel = within(screen.getByRole('region', { name: '공급자 정보 편집' }));
        for (const [label, field] of fields) {
            expect(panel.getByLabelText(label, { exact: true })).toHaveValue(supplier[field]);
            fireEvent.change(panel.getByLabelText(label, { exact: true }), { target: { value: updatedSupplier[field] } });
        }

        const document = within(screen.getByRole('main'));
        const companyInput = document.getByDisplayValue(updatedSupplier.supplierCompany);
        fireEvent.change(companyInput, { target: { value: '문서에서 변경한 공급사' } });
        expect(panel.getByLabelText('상호', { exact: true })).toHaveValue('문서에서 변경한 공급사');
        fireEvent.change(companyInput, { target: { value: updatedSupplier.supplierCompany } });
        expect(document.getByDisplayValue(updatedSupplier.supplierName)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '공급자 정보' }));
        expect(screen.getByRole('button', { name: '공급자 정보' })).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(screen.getByRole('button', { name: '공급자 정보' }));
        expect(panel.getByLabelText('상호', { exact: true })).toHaveValue(updatedSupplier.supplierCompany);
        fireEvent.click(screen.getByRole('button', { name: edit }));
        await waitFor(() => expect(estimateService.updateEstimate).toHaveBeenCalledWith('document', expect.objectContaining(updatedSupplier)));
        await waitFor(() => expect(screen.getByRole('button', { name: edit })).toBeEnabled());

        view.unmount();
        render(<Page />);
        fireEvent.click(await screen.findByRole('heading', { name: '검증 문서' }));
        fireEvent.click(screen.getByRole('button', { name: '공급자 정보' }));
        for (const [label, field] of fields) {
            expect(screen.getByLabelText(label, { exact: true })).toHaveValue(updatedSupplier[field]);
        }
        fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
        await waitFor(() => expect(downloadEstimateExcel).toHaveBeenCalledWith(
            expect.objectContaining(updatedSupplier), expect.any(Array), 0, 0, 0, type, { freezePanes: false }
        ));
    });

    it('새 문서에 입력한 공급자가 기본 회사 정보로 되돌아가지 않고 저장된다', async () => {
        render(<Page />);
        fireEvent.click(screen.getByRole('button', { name: '공급자 정보' }));
        await waitFor(() => expect(screen.getByLabelText('상호', { exact: true })).toBeEnabled());
        fireEvent.change(screen.getByLabelText('상호', { exact: true }), { target: { value: '새 문서 공급사' } });
        const clientRow = within(screen.getByRole('main')).getByRole('row', { name: /업 체 명/ });
        fireEvent.change(within(clientRow).getByRole('textbox'), { target: { value: '신규 발주사' } });
        fireEvent.click(screen.getByRole('button', { name: save }));
        await waitFor(() => expect(estimateService.addEstimate).toHaveBeenCalledWith(expect.objectContaining({
            supplierCompany: '새 문서 공급사', clientCompany: '신규 발주사', documentType: type,
        })));
        await waitFor(() => expect(screen.getByRole('button', { name: edit })).toBeEnabled());
        expect(screen.getByLabelText('상호', { exact: true })).toHaveValue('새 문서 공급사');
    });

    it('저장 실패 시 입력을 유지해 다시 저장할 수 있다', async () => {
        savedDocuments = [{ ...getEmptyDraft(type), ...supplier, id: 'document', title: '검증 문서', clientCompany: '검증 발주사', subtotal: 0, total: 0 }];
        (estimateService.updateEstimate as jest.Mock).mockRejectedValueOnce(new Error('test save failure'));
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            render(<Page />);
            fireEvent.click(await screen.findByRole('heading', { name: '검증 문서' }));
            fireEvent.click(screen.getByRole('button', { name: '공급자 정보' }));
            fireEvent.change(screen.getByLabelText('상호', { exact: true }), { target: { value: '재시도 공급사' } });
            fireEvent.click(screen.getByRole('button', { name: edit }));
            await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('오류', '저장 중 문제가 발생했습니다.', 'error'));
            expect(screen.getByLabelText('상호', { exact: true })).toHaveValue('재시도 공급사');
            expect(screen.getByLabelText('상호', { exact: true })).toBeEnabled();
            expect(savedDocuments[0].supplierCompany).toBe(supplier.supplierCompany);
        } finally {
            consoleError.mockRestore();
        }
    });
});
