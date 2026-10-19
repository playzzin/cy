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
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'qa-user', displayName: '검증 사용자' } }) }));
jest.mock('./MaterialPhotoPicker', () => ({
    __esModule: true,
    default: () => null,
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

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue(materials);
    (siteService.getSites as jest.Mock).mockResolvedValue([
        { id: 'qa-site', name: '검증 현장', companyName: '(주)청연이엔지', status: 'active' },
    ]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
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
] as const)('%s 등록의 시스템 자재', (label, Page, saveTransactions) => {
    it('마스터의 시스템 자재를 별도로 표시하고 모바일 선택·검색 후에도 원래 분류와 수량으로 저장한다', async () => {
        render(<MemoryRouter><Page /></MemoryRouter>);
        await screen.findByRole('heading', { name: '시스템' });

        const system = getDesktopSection('시스템');
        expect(within(system).getByRole('cell', { name: /SYS-H18/ })).toBeInTheDocument();
        expect(within(system).getByRole('cell', { name: /SYS-C01/ })).toBeInTheDocument();
        expect(within(getDesktopSection('시스템 동바리')).getByRole('cell', { name: /DB-P17/ })).toBeInTheDocument();
        expect(within(getDesktopSection('시스템 동바리')).queryByText('SYS-H18')).not.toBeInTheDocument();
        expect(within(getDesktopSection('시스템 비계')).getByRole('cell', { name: /SC-5018/ })).toBeInTheDocument();
        expect(within(getDesktopSection('시스템 비계')).queryByText('SYS-C01')).not.toBeInTheDocument();
        expect(getDesktopSection('기타 및 소모품')).toHaveAttribute('data-section-index', '3');

        const horizontalRow = within(system).getByRole('row', { name: /SYS-H18/ });
        fireEvent.change(within(horizontalRow).getByRole('spinbutton'), { target: { value: '7' } });

        fireEvent.click(screen.getByRole('button', { name: /^시스템\s*2\s*품목$/ }));
        const mobile = screen.getAllByRole('region', { name: '시스템 자재' })[0];
        fireEvent.click(within(mobile).getByRole('button', { name: /비계 연결부/ }));
        expect(within(mobile).getAllByText('SYS-C01')).not.toHaveLength(0);
        fireEvent.click(within(mobile).getByRole('button', { name: '+10' }));

        fireEvent.change(screen.getByPlaceholderText('품명, 규격 검색'), { target: { value: '없는 자재' } });
        expect(within(getDesktopSection('시스템')).getByRole('cell', { name: /SYS-H18/ })).toBeInTheDocument();
        expect(within(getDesktopSection('시스템')).getByRole('cell', { name: /SYS-C01/ })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '시스템 동바리' })).not.toBeInTheDocument();

        fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'qa-site' } });
        fireEvent.click(screen.getAllByRole('button', { name: `${label} 완료` })[0]);
        await waitFor(() => expect(saveTransactions).toHaveBeenCalledTimes(1));
        const payload = (saveTransactions as jest.Mock).mock.calls[0][0];
        expect(payload).toHaveLength(2);
        expect(payload).toEqual(expect.arrayContaining([
            expect.objectContaining({ materialId: 'system-horizontal', materialKey: materials[0].materialKey, category: '시스템', spec: 'SYS-H18', quantity: 7, siteId: 'qa-site' }),
            expect.objectContaining({ materialId: 'system-connector', materialKey: materials[1].materialKey, category: '시스템', spec: 'SYS-C01', quantity: 10, siteId: 'qa-site' }),
        ]));
        await waitFor(() => expect(screen.getAllByRole('button', { name: `${label} 완료` })[0]).not.toBeDisabled());
    });

    it('시스템만 있는 목록도 표시하고 검색 결과가 없으면 빈 상태로 전환한다', async () => {
        (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([materials[0]]);
        render(<MemoryRouter><Page /></MemoryRouter>);
        await screen.findByRole('button', { name: /^시스템\s*1\s*품목$/ });
        expect(screen.getAllByRole('heading', { name: '시스템' })).toHaveLength(2);
        fireEvent.change(screen.getByPlaceholderText('품명, 규격 검색'), { target: { value: '없는 자재' } });
        expect(screen.queryByRole('heading', { name: '시스템' })).not.toBeInTheDocument();
        expect(screen.getByText('표시할 자재가 없습니다.')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('품명, 규격 검색'), { target: { value: 'SYS-H18' } });
        expect(screen.getAllByRole('heading', { name: '시스템' })).toHaveLength(2);
    });
});
