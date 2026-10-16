import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useMaterialAdministration } from '../../hooks/useMaterialAdministration';
import MaterialMasterPage from './MaterialMasterPage';
import materialService from '../../services/materialService';

jest.mock('../../hooks/useMaterialAdministration', () => ({ useMaterialAdministration: jest.fn() }));
jest.mock('../../services/materialService', () => ({
    __esModule: true,
    default: { getUniqueMaterialsForSelection: jest.fn(), updateMaterial: jest.fn(), addMaterial: jest.fn(), deleteMaterial: jest.fn() },
    buildMaterialBusinessKey: jest.fn(row => `${row.category}::${row.itemName}::${row.spec}`),
}));

const materials = ['동바리', '비계', '시스템', '소모품'].map((category, index) => ({
    id: String(index), category, itemName: `${category} 품목`, spec: `QA-${index}`, unit: 'EA', isActive: true,
}));
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
    jest.clearAllMocks();
    (useMaterialAdministration as jest.Mock).mockReturnValue(true);
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue(materials);
});
afterEach(() => { window.matchMedia = originalMatchMedia; });

it('시스템 자재를 별도 그룹에 표시하고 대분류와 검색 필터를 함께 적용한다', async () => {
    render(<MaterialMasterPage />);
    const system = await screen.findByRole('region', { name: '시스템 자재' });
    expect(within(system).getByRole('cell', { name: 'QA-2' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '동바리 자재' })).queryByRole('cell', { name: 'QA-2' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '기타 자재' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '시스템 1' }));
    expect(screen.getByRole('button', { name: '시스템 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('region', { name: '동바리 자재' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('규격 검색...'), { target: { value: '없는 규격' } });
    expect(await screen.findByText('검색 조건에 맞는 자재가 없습니다.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('규격 검색...'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '전체 4' }));
    expect(await screen.findByRole('region', { name: '비계 자재' })).toBeInTheDocument();
});

it('시스템 분류를 수정 폼과 저장 요청에 그대로 유지한다', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    try {
        render(<MaterialMasterPage />);
        const system = await screen.findByRole('region', { name: '시스템 자재' });
        fireEvent.click(within(system).getAllByTitle('수정')[0]);
        expect(screen.getByLabelText('분류 *')).toHaveValue('시스템');
        fireEvent.change(screen.getByPlaceholderText('선택사항'), { target: { value: '시스템 설명' } });
        fireEvent.click(screen.getByRole('button', { name: '저장' }));
        await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('2', expect.objectContaining({ category: '시스템', description: '시스템 설명' })));
        await waitFor(() => expect(screen.queryByRole('heading', { name: '자재 수정' })).not.toBeInTheDocument());
    } finally { alert.mockRestore(); }
});

it('팀장은 공용 자재 목록을 조회하지만 등록·수정·삭제 기능은 보이지 않는다', async () => {
    (useMaterialAdministration as jest.Mock).mockReturnValue(false);
    render(<MaterialMasterPage />);
    await screen.findByRole('region', { name: '시스템 자재' });
    expect(screen.queryByRole('button', { name: '자재 등록' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument();
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument();
});
