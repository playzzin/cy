import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { estimateService } from '../../services/estimateService';
import { companyFirestoreService } from '../../services/companyFirestoreService';
import materialService from '../../services/materialService';
import { loadRentalCatalog, saveRentalCatalog, RentalCatalogEntry, RentalCatalogSnapshot } from '../../services/rentalCatalogService';
import TransactionManagePage from './TransactionManagePage';

jest.mock('../../services/estimateService', () => ({ estimateService: { getEstimates: jest.fn(), addEstimate: jest.fn() } }));
jest.mock('../../services/companyFirestoreService', () => ({ companyFirestoreService: { getCompanies: jest.fn() } }));
jest.mock('../../services/materialService', () => ({ __esModule: true, default: { getUniqueMaterialsForSelection: jest.fn() } }));
jest.mock('../../services/rentalCatalogService', () => ({ loadRentalCatalog: jest.fn(), saveRentalCatalog: jest.fn() }));
jest.mock('../../hooks/useDocumentStamp', () => ({ useDocumentStamp: () => '' }));
jest.mock('../../utils/estimateExcelUtils', () => ({ downloadEstimateExcel: jest.fn() }));
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn() } }));

const shoring: RentalCatalogEntry = {
    materialId: 'shoring-a', workType: 'shoring', category: '시스템동바리', itemName: '수직재', spec: 'P-17', unit: 'EA',
    quantity: 2, baseFee: 240, dailyFee: 6, maxQuantity: 50, active: true,
};
const scaffold: RentalCatalogEntry = {
    ...shoring, materialId: 'scaffold-a', workType: 'scaffold', category: '시스템비계', spec: 'PB-19',
    quantity: 4, baseFee: 350, dailyFee: 10,
};
let stored: RentalCatalogSnapshot;

beforeEach(() => {
    jest.clearAllMocks();
    stored = { revision: 3, entries: [shoring, scaffold] };
    (loadRentalCatalog as jest.Mock).mockImplementation(async () => stored);
    (saveRentalCatalog as jest.Mock).mockImplementation(async (entries, revision) => {
        stored = { entries, revision: revision + 1 };
        return stored;
    });
    (estimateService.getEstimates as jest.Mock).mockResolvedValue([]);
    (companyFirestoreService.getCompanies as jest.Mock).mockResolvedValue([]);
    (estimateService.addEstimate as jest.Mock).mockResolvedValue('rental-document');
});

const pickMaterial = (materialId: string) => {
    fireEvent.change(screen.getByRole('combobox', { name: '거래 품목' }), { target: { value: materialId } });
    fireEvent.click(screen.getByRole('button', { name: '명세표에 추가' }));
};

describe('임대거래명세표의 자재 카탈로그', () => {
    it('uses the registered catalog and preserves prices already inserted when settings change', async () => {
        render(<TransactionManagePage />);
        expect(loadRentalCatalog).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '임대 명세표' }));
        await screen.findByRole('option', { name: '수직재 P-17' });
        expect(screen.queryByRole('option', { name: '수직재 PB-19' })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('spinbutton', { name: '사용일수' }), { target: { value: '10' } });
        pickMaterial(shoring.materialId);
        expect(screen.getByPlaceholderText('규격')).toHaveValue('P-17');
        const firstRow = within(screen.getByRole('row', { name: /600 60 660/ }));
        expect(firstRow.getByDisplayValue('240')).toBeInTheDocument();
        expect(firstRow.getByDisplayValue('2')).toBeInTheDocument();
        expect(firstRow.getByDisplayValue('6')).toBeInTheDocument();
        expect(firstRow.getByText('600')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '자재 설정' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: '기본 수량' }), { target: { value: '3' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '기본료' }), { target: { value: '300' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '일단가' }), { target: { value: '8' } });
        fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
        await screen.findByText('임대거래자재를 저장했습니다.');
        expect(saveRentalCatalog).toHaveBeenCalledWith([expect.objectContaining({ quantity: 3, baseFee: 300, dailyFee: 8 }), scaffold], 3);
        expect(firstRow.getByDisplayValue('240')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '거래표에 넣기' }));
        fireEvent.change(screen.getByRole('combobox', { name: '임대 품목' }), { target: { value: 'scaffold' } });
        expect(screen.queryByRole('option', { name: '수직재 P-17' })).not.toBeInTheDocument();
        pickMaterial(scaffold.materialId);
        const client = within(screen.getByRole('main')).getByRole('row', { name: /업 체 명/ });
        fireEvent.change(within(client).getByRole('textbox'), { target: { value: '시험 업체' } });
        fireEvent.click(screen.getByRole('button', { name: '명세표 저장' }));
        await waitFor(() => expect(estimateService.addEstimate).toHaveBeenCalledWith(expect.objectContaining({
            estimateMode: 'rental', clientCompany: '시험 업체', subtotal: 3540, tax: 354, total: 3894,
            items: [
                expect.objectContaining({ section: '수직재', rentalSpec: 'P-17', quantity: 2, finalUnitPrice: 240, rentalUnitPrice: 6, amount: 600 }),
                expect.objectContaining({ section: '수직재', rentalSpec: 'P-17', quantity: 3, finalUnitPrice: 300, rentalUnitPrice: 8, amount: 1140 }),
                expect.objectContaining({ section: '수직재', rentalSpec: 'PB-19', quantity: 4, finalUnitPrice: 350, rentalUnitPrice: 10, amount: 1800 }),
            ],
        })));
        await screen.findByRole('button', { name: '명세표 수정' });
        expect(materialService.getUniqueMaterialsForSelection).not.toHaveBeenCalled();
    }, 15000); // This workflow edits the catalog, adds three rows, and saves the statement.

    it('blocks use after a failed read and until the initial catalog has been registered', async () => {
        stored.revision = 0;
        (loadRentalCatalog as jest.Mock).mockRejectedValueOnce(new Error('카탈로그 읽기 실패'));
        render(<TransactionManagePage />);
        fireEvent.click(screen.getByRole('button', { name: '임대' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('카탈로그 읽기 실패');
        expect(screen.getByRole('combobox', { name: '거래 품목' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
        const register = await screen.findByRole('button', { name: '견적 품목 DB 등록' });
        expect(screen.getByRole('button', { name: '자동 생성' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '명세표에 추가' })).toBeDisabled();
        fireEvent.click(register);
        await waitFor(() => expect(screen.getByRole('combobox', { name: '거래 품목' })).toBeEnabled());
        expect(saveRentalCatalog).toHaveBeenCalledWith([shoring, scaffold], 0);
        expect(materialService.getUniqueMaterialsForSelection).not.toHaveBeenCalled();
    });

    it('generates amounts from the selected work type with the registered daily and base fees', async () => {
        render(<TransactionManagePage />);
        fireEvent.click(screen.getByRole('button', { name: '임대 명세표' }));
        await screen.findByRole('option', { name: '수직재 P-17' });
        fireEvent.change(screen.getByRole('combobox', { name: '임대 품목' }), { target: { value: 'scaffold' } });
        fireEvent.change(screen.getByRole('textbox', { name: '목표 금액' }), { target: { value: '900' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '사용일수' }), { target: { value: '10' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: '자재 수' }), { target: { value: '1' } });
        fireEvent.click(screen.getByRole('button', { name: '자동 생성' }));
        const row = within(screen.getByRole('row', { name: /900 90 990/ }));
        expect(row.getByDisplayValue('PB-19')).toBeInTheDocument();
        expect(row.getByDisplayValue('350')).toBeInTheDocument();
        expect(row.getByDisplayValue('2')).toBeInTheDocument();
        expect(row.getByText('900')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('P-17')).not.toBeInTheDocument();
    });
});
