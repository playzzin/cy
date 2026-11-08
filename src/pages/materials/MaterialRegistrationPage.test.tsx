import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import materialService from '../../services/materialService';
import { siteService } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { settlementTargetService } from '../../services/settlementTargetService';
import { uploadMaterialPhotoAttachments } from './MaterialPhotoPicker';
import MaterialInboundPage from './MaterialInboundPage';
import MaterialOutboundPage from './MaterialOutboundPage';
import * as inboundDraftStore from './materialInboundCertificateDraftStore';
import * as outboundDraftStore from './materialOutboundCertificateDraftStore';
import * as inboundCertificateExport from './materialInboundCertificateExport';
import * as certificateExport from './materialCertificateExport';

jest.mock('../../services/materialService', () => ({
    __esModule: true,
    default: {
        getUniqueMaterialsForSelection: jest.fn(),
        addInboundTransactionsBatch: jest.fn(),
        addOutboundTransactionsBatch: jest.fn(),
    },
}));
jest.mock('../../services/siteService', () => ({
    siteService: { getSites: jest.fn() },
}));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/settlementTargetService', () => ({ settlementTargetService: { getTargets: jest.fn() } }));
jest.mock('../../services/storageService', () => ({ storageService: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'qa-user', displayName: '검증 사용자' } }) }));
jest.mock('./MaterialPhotoPicker', () => ({
    __esModule: true,
    default: jest.requireActual('./MaterialPhotoPicker').default,
    uploadMaterialPhotoAttachments: jest.fn(),
    revokeMaterialPhotoAttachments: jest.fn(),
}));

const materials = [
    { id: 'system-horizontal', category: '시스템', itemName: '수평재', spec: 'SYS-H18' },
    { id: 'system-connector', category: '시스템', itemName: '비계 연결부', spec: 'SYS-C01' },
    { id: 'dongbari', category: '시스템 동바리', itemName: '수직재', spec: 'DB-P17' },
    { id: 'scaffolding', category: '시스템 비계', itemName: '발판', spec: 'SC-5018' },
    { id: 'other', category: '소모품', itemName: '장갑', spec: 'ETC-01' },
].map(row => ({ ...row, materialKey: `${row.category}::${row.itemName}::${row.spec}`, unit: 'EA', isActive: true }));

const getDesktopSection = (title: string) => {
    const sections = screen.getAllByRole('region', { name: `${title} 자재` });
    return sections[sections.length - 1];
};

const searchAndSelect = (field: HTMLElement, query: string, name: string) => {
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: query } });
    fireEvent.click(screen.getByRole('option', { name }));
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue(materials);
    (siteService.getSites as jest.Mock).mockResolvedValue([
        { id: 'qa-site', name: '검증 현장', companyName: '(주)청연이엔지', status: 'active' },
    ]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([
        { id: 'qa-rental', name: '검증 임대사', type: '임대사', status: 'active' },
        { id: 'qa-supplier', name: '검증 공급업체', type: '공급업체', status: 'active' },
    ]);
    (settlementTargetService.getTargets as jest.Mock).mockResolvedValue([]);
    (uploadMaterialPhotoAttachments as jest.Mock).mockResolvedValue([]);
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    jest.restoreAllMocks();
});

describe.each([
    ['입고', MaterialInboundPage, materialService.addInboundTransactionsBatch],
    ['출고', MaterialOutboundPage, materialService.addOutboundTransactionsBatch],
] as const)('%s 등록의 세 분류', (label, Page, saveTransactions) => {
    it('기존 시스템 자재를 기타에서 선택하고 검색 후에도 원래 자재 정보와 수량으로 저장한다', async () => {
        render(<MemoryRouter><Page /></MemoryRouter>);
        await screen.findByRole('heading', { name: '기타' });
        expect(screen.queryByRole('heading', { name: /시스템/ })).not.toBeInTheDocument();
        expect(within(screen.getByRole('group', { name: '자재 분류' })).getAllByRole('button').map(button => button.textContent)).toEqual(['동바리1 품목', '비계1 품목', '기타3 품목']);

        const other = getDesktopSection('기타');
        expect(within(other).getByRole('cell', { name: /SYS-H18/ })).toBeInTheDocument();
        expect(within(other).getByRole('cell', { name: /SYS-C01/ })).toBeInTheDocument();
        expect(within(getDesktopSection('동바리')).getByRole('cell', { name: /DB-P17/ })).toBeInTheDocument();
        expect(within(getDesktopSection('동바리')).queryByText('SYS-H18')).not.toBeInTheDocument();
        expect(within(getDesktopSection('비계')).getByRole('cell', { name: /SC-5018/ })).toBeInTheDocument();
        expect(within(getDesktopSection('비계')).queryByText('SYS-C01')).not.toBeInTheDocument();
        expect(other).toHaveAttribute('data-section-index', '2');

        const horizontalRow = within(other).getByRole('row', { name: /SYS-H18/ });
        fireEvent.change(within(horizontalRow).getByRole('spinbutton'), { target: { value: '7' } });

        fireEvent.click(screen.getByRole('button', { name: /^기타\s*3\s*품목$/ }));
        const mobile = screen.getAllByRole('region', { name: '기타 자재' })[0];
        fireEvent.click(within(mobile).getByRole('button', { name: /비계 연결부/ }));
        expect(within(mobile).getAllByText('SYS-C01')).not.toHaveLength(0);
        fireEvent.click(within(mobile).getByRole('button', { name: '+10' }));

        fireEvent.change(screen.getByPlaceholderText('품명, 규격 검색'), { target: { value: '없는 자재' } });
        expect(within(getDesktopSection('기타')).getByRole('cell', { name: /SYS-H18/ })).toBeInTheDocument();
        expect(within(getDesktopSection('기타')).getByRole('cell', { name: /SYS-C01/ })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '동바리' })).not.toBeInTheDocument();

        searchAndSelect(screen.getAllByRole('combobox')[0], '검증현', '검증 현장');
        searchAndSelect(screen.getByRole('combobox', { name: '임대사' }), '검증임', '검증 임대사');
        fireEvent.change(screen.getByLabelText('차량번호'), { target: { value: '12가3456' } });
        expect(screen.queryByPlaceholderText('공급업체명')).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: '검증 공급업체' })).not.toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: `${label} 완료` })[0]);
        await waitFor(() => expect(saveTransactions).toHaveBeenCalledTimes(1));
        const payload = (saveTransactions as jest.Mock).mock.calls[0][0];
        expect(payload).toHaveLength(2);
        expect(payload).toEqual(expect.arrayContaining([
            expect.objectContaining({ rentalCompanyId: 'qa-rental', rentalCompanyName: '검증 임대사', vehicleNumber: '12가3456' }),
        ]));
        expect(payload).toEqual(expect.arrayContaining([
            expect.objectContaining({ materialId: 'system-horizontal', materialKey: materials[0].materialKey, category: '시스템', spec: 'SYS-H18', quantity: 7, siteId: 'qa-site' }),
            expect.objectContaining({ materialId: 'system-connector', materialKey: materials[1].materialKey, category: '시스템', spec: 'SYS-C01', quantity: 10, siteId: 'qa-site' }),
        ]));
        await waitFor(() => expect(screen.getAllByRole('button', { name: `${label} 완료` })[0]).not.toBeDisabled());
    });

    it('기존 시스템 자재만 있을 때 기타를 표시하고 검색 결과가 없으면 빈 상태로 전환한다', async () => {
        (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([materials[0]]);
        render(<MemoryRouter><Page /></MemoryRouter>);
        await screen.findByRole('button', { name: /^기타\s*1\s*품목$/ });
        expect(screen.getAllByRole('heading', { name: '기타' })).toHaveLength(2);
        expect(screen.getByRole('button', { name: /^동바리\s*0\s*품목$/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^비계\s*0\s*품목$/ })).toBeDisabled();
        fireEvent.change(screen.getByPlaceholderText('품명, 규격 검색'), { target: { value: '없는 자재' } });
        expect(screen.queryByRole('heading', { name: '기타' })).not.toBeInTheDocument();
        expect(screen.getByText('표시할 자재가 없습니다.')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('품명, 규격 검색'), { target: { value: 'SYS-H18' } });
        expect(screen.getAllByRole('heading', { name: '기타' })).toHaveLength(2);
    });

    it('기타 검색과 선택 품목 복사에도 화면과 같은 분류를 사용한다', async () => {
        const originalClipboard = navigator.clipboard;
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        try {
            render(<MemoryRouter><Page /></MemoryRouter>);
            await screen.findByRole('heading', { name: '기타' });
            fireEvent.change(screen.getByPlaceholderText('품명, 규격, 분류 검색'), { target: { value: '기타' } });
            const other = getDesktopSection('기타');
            expect(within(other).getByRole('cell', { name: /SYS-H18/ })).toBeInTheDocument();
            expect(within(other).getByRole('cell', { name: /SYS-C01/ })).toBeInTheDocument();
            expect(within(other).getByRole('cell', { name: /ETC-01/ })).toBeInTheDocument();
            expect(screen.queryByRole('region', { name: '동바리 자재' })).not.toBeInTheDocument();
            const row = within(other).getByRole('row', { name: /SYS-H18/ });
            fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '3' } });
            searchAndSelect(screen.getByRole('combobox', { name: '임대사' }), '검증', '검증 임대사');
            expect(screen.queryByRole('button', { name: /부가 기능|사진분석/ })).not.toBeInTheDocument();
            const actions = within(screen.getByRole('group', { name: `${label} 부가 기능` }));
            for (const name of ['수정', '복사', '보내기', '초기화', '사진 촬영', '갤러리 선택', '사진 PDF 저장', '카카오톡 공유']) {
                expect(actions.getByRole('button', { name })).toBeVisible();
            }
            fireEvent.click(screen.getAllByRole('button', { name: '복사' })[0]);
            await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
            expect(writeText.mock.calls[0][0]).toContain('[기타]');
            expect(writeText.mock.calls[0][0]).toContain('SYS-H18 / 3 EA');
            expect(writeText.mock.calls[0][0]).not.toContain('시스템');
            expect(writeText.mock.calls[0][0]).toContain('임대사: 검증 임대사');
            expect(screen.getByRole('combobox', { name: '임대사' })).toHaveValue('검증 임대사');
            expect(within(row).getByRole('spinbutton')).toHaveValue(3);
        } finally {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        }
    });
});

it('입고증 페이지에 선택한 임대사 이름을 전달한다', async () => {
    const saveDraft = jest.spyOn(inboundDraftStore, 'saveInboundCertificateDraft');
    render(<MemoryRouter><MaterialInboundPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: '기타' });
    searchAndSelect(screen.getByRole('combobox', { name: '현장 선택' }), '검증', '검증 현장');
    searchAndSelect(screen.getByRole('combobox', { name: '임대사' }), '검증', '검증 임대사');
    fireEvent.change(within(getDesktopSection('기타')).getAllByRole('spinbutton')[0], { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '입고증 페이지' }));
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ rentalCompanyName: '검증 임대사', siteId: 'qa-site' }));
});

it('반출증 페이지에 현장·임대사 주소와 반출자·등록자를 전달한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'qa-site', name: '검증 현장', address: '서울시 검증로 1', companyName: '청연이엔지', status: 'active' }]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'qa-rental', name: '검증 임대사', address: '부산시 검증로 2', type: '임대사' }]);
    const saveDraft = jest.spyOn(outboundDraftStore, 'saveOutboundCertificateDraft');
    render(<MemoryRouter><MaterialOutboundPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: '기타' });
    const site = screen.getByRole('combobox', { name: '현장명 *' });
    fireEvent.focus(site); fireEvent.change(site, { target: { value: '검증' } });
    fireEvent.click(screen.getByRole('option', { name: /^검증 현장/ }));
    searchAndSelect(screen.getByRole('combobox', { name: '임대사' }), '검증', '검증 임대사');
    fireEvent.change(screen.getByLabelText('반출자'), { target: { value: '검증 반출자' } });
    fireEvent.change(within(getDesktopSection('기타')).getAllByRole('spinbutton')[0], { target: { value: '5' } });
    expect(screen.getByRole('button', { name: '사진 PDF 저장' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '반출증 페이지' }));
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ siteAddress: '서울시 검증로 1', rentalCompanyAddress: '부산시 검증로 2', recipient: '검증 반출자', registeredByName: '검증 사용자' }));
});

it('입고증 저장과 미리보기에 주소·등록자를 전달하고 사진은 별도 파일로 저장한다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'qa-site', name: '검증 현장', address: '서울시 입고로 1', companyName: '청연이엔지', status: 'active' }]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'qa-rental', name: '검증 임대사', address: '부산시 임대로 2', type: '임대사' }]);
    const saveDraft = jest.spyOn(inboundDraftStore, 'saveInboundCertificateDraft');
    const exportFile = jest.spyOn(inboundCertificateExport, 'createInboundCertificateImageFile').mockResolvedValue(new File(['certificate'], '입고증.jpg', { type: 'image/jpeg' }));
    const download = jest.spyOn(certificateExport, 'downloadMaterialCertificateFile').mockImplementation(() => {});
    render(<MemoryRouter><MaterialInboundPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: '기타' });
    const site = screen.getByRole('combobox', { name: '현장 선택' });
    fireEvent.focus(site); fireEvent.change(site, { target: { value: '검증' } });
    fireEvent.click(screen.getByRole('option', { name: /^검증 현장/ }));
    searchAndSelect(screen.getByRole('combobox', { name: '임대사' }), '검증', '검증 임대사');
    fireEvent.change(within(getDesktopSection('기타')).getAllByRole('spinbutton')[0], { target: { value: '5' } });
    expect(screen.getByRole('button', { name: '사진 PDF 저장' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '입고증 저장' }));
    await waitFor(() => expect(download).toHaveBeenCalled());
    expect(exportFile).toHaveBeenCalledWith(expect.objectContaining({ siteAddress: '서울시 입고로 1', rentalCompanyAddress: '부산시 임대로 2', registeredByName: '검증 사용자' }));
    expect(exportFile.mock.calls[0][0]).not.toHaveProperty('photos');
    fireEvent.click(screen.getByRole('button', { name: '입고증 페이지' }));
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ siteAddress: '서울시 입고로 1', rentalCompanyAddress: '부산시 임대로 2', registeredByName: '검증 사용자' }));
});
