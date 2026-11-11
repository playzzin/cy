import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useMaterialAdministration } from '../../hooks/useMaterialAdministration';
import MaterialMasterPage from './MaterialMasterPage';
import materialService, { buildMaterialBusinessKey } from '../../services/materialService';
import { EXCEL_MATERIAL_CATALOG } from '../../constants/materialCatalog';

jest.mock('../../hooks/useMaterialAdministration', () => ({ useMaterialAdministration: jest.fn() }));
jest.mock('../../services/materialService', () => ({
    __esModule: true,
    default: { getUniqueMaterialsForSelection: jest.fn(), updateMaterial: jest.fn(), addMaterial: jest.fn(), deleteMaterial: jest.fn() },
    buildMaterialBusinessKey: jest.fn(row => [row.category, row.itemName, row.spec].map(value => value.replace(/\s+/g, '').toLowerCase()).join('::')),
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
    (materialService.addMaterial as jest.Mock).mockResolvedValue('new-material');
    (buildMaterialBusinessKey as jest.Mock).mockImplementation(row =>
        [row.category, row.itemName, row.spec].map(value => value.replace(/\s+/g, '').toLowerCase()).join('::')
    );
});
afterEach(() => { window.matchMedia = originalMatchMedia; });

it('엑셀 91개 품목을 세 구역에 원본 순서로 표시하고 규격으로 검색한다', async () => {
    const rows = EXCEL_MATERIAL_CATALOG.flatMap(group => group.specs.map(spec => ({
        ...group, id: `${group.category}/${group.itemName}/${spec}`, spec, unit: 'EA', isActive: true,
    })));
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([...rows].reverse());
    render(<MaterialMasterPage />);
    const dongbari = await screen.findByRole('region', { name: '동바리 자재' });
    expect(within(dongbari).getByRole('heading', { name: '시스템 동바리' })).toBeInTheDocument();
    expect(within(dongbari).getAllByRole('row')).toHaveLength(41);
    expect(within(dongbari).getAllByRole('row')[1]).toHaveTextContent('P-17');
    expect(within(dongbari).getAllByRole('row')[13]).toHaveTextContent('하부자키');
    expect(within(dongbari).getAllByRole('row')[14]).toHaveTextContent('W상부쟈키');
    expect(within(screen.getByRole('region', { name: '비계 자재' })).getAllByRole('row')).toHaveLength(42);
    expect(within(screen.getByRole('region', { name: '기타 자재' })).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByRole('button', { name: '전체 91' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('규격 검색'), { target: { value: 'W상부쟈키' } });
    expect(within(screen.getByRole('region', { name: '동바리 자재' })).getAllByRole('row')).toHaveLength(2);
});

it('세 분류만 표시하고 기존 시스템 자재는 기타에서 검색할 수 있다', async () => {
    render(<MaterialMasterPage />);
    const other = await screen.findByRole('region', { name: '기타 자재' });
    expect(within(other).getByRole('cell', { name: /QA-2/ })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '동바리 자재' })).queryByRole('cell', { name: /QA-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '시스템 자재' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: '자재 대분류' })).getAllByRole('button').map(button => button.textContent)).toEqual(['전체 4', '동바리 1', '비계 1', '기타 2']);
    for (const label of ['기본단가', '안전재고', '설명']) {
        expect(screen.queryByRole('columnheader', { name: label })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: '기타 2' }));
    expect(screen.getByRole('button', { name: '기타 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('region', { name: '동바리 자재' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('규격 검색...'), { target: { value: '없는 규격' } });
    expect(await screen.findByText('검색 조건에 맞는 자재가 없습니다.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('규격 검색...'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '전체 4' }));
    expect(await screen.findByRole('region', { name: '비계 자재' })).toBeInTheDocument();
});

it('기존 자재 수정 시 숨긴 값과 원래 분류를 덮어쓰지 않는다', async () => {
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([
        { ...materials[2], unitPrice: 2500, safetyStock: 10, description: '기존 값' },
    ]);
    render(<MaterialMasterPage />);
    const other = await screen.findByRole('region', { name: '기타 자재' });
    const row = within(other).getByRole('row', { name: /QA-2/ });
    fireEvent.click(within(row).getByTitle('수정'));
    expect(within(row).getByLabelText('분류')).toHaveValue('기타');
    for (const label of ['기본단가', '안전재고', '설명']) expect(screen.queryByText(label)).not.toBeInTheDocument();
    fireEvent.change(within(row).getByLabelText('단위'), { target: { value: 'SET' } });
    fireEvent.click(within(row).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('2', {
        category: '시스템', itemName: '시스템 품목', spec: 'QA-2', unit: 'SET', isActive: true,
    }));
    await screen.findByRole('status');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
});

it('목록에서 네 항목을 수정하면 저장된 분류로 이동한다', async () => {
    let rows = materials.map(material => ({ ...material }));
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockImplementation(async () => rows);
    (materialService.updateMaterial as jest.Mock).mockImplementation(async (id, updates) => {
        rows = rows.map(row => row.id === id ? { ...row, ...updates } : row);
    });
    render(<MaterialMasterPage />);
    const group = await screen.findByRole('region', { name: '동바리 자재' });
    const row = within(group).getByRole('row', { name: /QA-0/ });
    fireEvent.click(within(row).getByRole('button', { name: '분류 수정: 동바리' }));
    expect(within(row).getByLabelText('분류')).toHaveFocus();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    fireEvent.change(within(row).getByLabelText('분류'), { target: { value: '비계' } });
    fireEvent.change(within(row).getByLabelText('품명'), { target: { value: 'name:비계 품목' } });
    fireEvent.change(within(row).getByLabelText('규격'), { target: { value: ' 5018 ' } });
    fireEvent.change(within(row).getByLabelText('단위'), { target: { value: ' 장 ' } });
    fireEvent.click(within(row).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('0', {
        category: '비계', itemName: '비계 품목', spec: '5018', unit: '장', isActive: true,
    }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: '비계 자재' })).getByRole('row', { name: /5018/ })).toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: '동바리 자재' })).queryByText('비계 품목')).not.toBeInTheDocument();
});

it('Esc로 변경을 취소하고 Enter로 저장하며 한글 조합 중에는 저장하지 않는다', async () => {
    render(<MaterialMasterPage />);
    const group = await screen.findByRole('region', { name: '동바리 자재' });
    const row = within(group).getByRole('row', { name: /QA-0/ });
    fireEvent.click(within(row).getByRole('button', { name: '규격 수정: QA-0' }));
    const spec = within(row).getByLabelText('규격');
    expect(spec).toHaveFocus();
    fireEvent.change(spec, { target: { value: '취소할 규격' } });
    fireEvent.keyDown(spec, { key: 'Escape' });
    expect(materialService.updateMaterial).not.toHaveBeenCalled();
    expect(within(row).getByRole('button', { name: '규격 수정: QA-0' })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: '단위 수정: EA' }));
    const unit = within(row).getByLabelText('단위');
    fireEvent.change(unit, { target: { value: '' } });
    fireEvent.keyDown(unit, { key: 'Enter', isComposing: true });
    expect(materialService.updateMaterial).not.toHaveBeenCalled();
    fireEvent.keyDown(unit, { key: 'Enter' });
    await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('0', expect.objectContaining({ spec: 'QA-0', unit: 'EA' })));
    await screen.findByRole('status');
});

it('분류별 품명 목록을 중복 없이 제공하고 분류만 바꾸면 현재 품명은 유지한다', async () => {
    (materialService.getUniqueMaterialsForSelection as jest.Mock).mockResolvedValue([
        ...materials, { ...materials[1], id: 'duplicate-name', spec: 'QA-5' },
    ]);
    render(<MaterialMasterPage />);
    const group = await screen.findByRole('region', { name: '동바리 자재' });
    const row = within(group).getByRole('row', { name: /QA-0/ });
    fireEvent.click(within(row).getByTitle('수정'));
    const category = within(row).getByRole('combobox', { name: '분류' });
    const itemName = within(row).getByRole('combobox', { name: '품명' });
    expect(within(category).getAllByRole('option').map(option => option.textContent)).toEqual(['동바리', '비계', '기타']);
    expect(within(itemName).queryByRole('option', { name: '비계 품목' })).not.toBeInTheDocument();
    fireEvent.change(category, { target: { value: '비계' } });
    expect(within(itemName).getAllByRole('option', { name: '비계 품목' })).toHaveLength(1);
    expect(itemName).toHaveValue('name:동바리 품목');
    fireEvent.change(category, { target: { value: '기타' } });
    expect(within(itemName).getByRole('option', { name: '시스템 품목' })).toBeInTheDocument();
    expect(within(itemName).getByRole('option', { name: '소모품 품목' })).toBeInTheDocument();
    expect(within(itemName).queryByRole('option', { name: '비계 품목' })).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('0', expect.objectContaining({ category: '기타', itemName: '동바리 품목' })));
    await screen.findByRole('status');
});

it('품명 목록에서 직접 입력을 선택하면 새 이름을 입력하고 저장할 수 있다', async () => {
    render(<MaterialMasterPage />);
    const group = await screen.findByRole('region', { name: '동바리 자재' });
    const row = within(group).getByRole('row', { name: /QA-0/ });
    fireEvent.click(within(row).getByTitle('수정'));
    fireEvent.change(within(row).getByRole('combobox', { name: '품명' }), { target: { value: 'custom' } });
    const input = within(row).getByRole('textbox', { name: '품명 직접 입력' });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: ' 새 수직재 ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('0', expect.objectContaining({ category: '동바리', itemName: '새 수직재', spec: 'QA-0' })));
    await screen.findByRole('status');
});

it('목록 수정의 필수값과 중복을 검사하고 저장 실패 시 입력값을 유지한다', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let rejectSave!: (error: Error) => void;
    (materialService.updateMaterial as jest.Mock).mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSave = reject; }));
    try {
        render(<MaterialMasterPage />);
        const group = await screen.findByRole('region', { name: '동바리 자재' });
        const row = within(group).getByRole('row', { name: /QA-0/ });
        fireEvent.click(within(row).getByRole('button', { name: '품명 수정: 동바리 품목' }));
        fireEvent.change(within(row).getByLabelText('품명'), { target: { value: 'custom' } });
        fireEvent.change(within(row).getByLabelText('품명 직접 입력'), { target: { value: '  ' } });
        fireEvent.change(within(row).getByLabelText('규격'), { target: { value: '  ' } });
        fireEvent.click(within(row).getByRole('button', { name: '저장' }));
        expect(within(row).getByRole('alert')).toHaveTextContent('규격을 입력');
        fireEvent.change(within(row).getByLabelText('분류'), { target: { value: '비계' } });
        fireEvent.change(within(row).getByLabelText('품명'), { target: { value: 'name:비계 품목' } });
        fireEvent.change(within(row).getByLabelText('규격'), { target: { value: 'QA-1' } });
        fireEvent.click(within(row).getByRole('button', { name: '저장' }));
        expect(within(row).getByRole('alert')).toHaveTextContent('이미 등록된 자재');
        expect(materialService.updateMaterial).not.toHaveBeenCalled();
        fireEvent.change(within(row).getByLabelText('규격'), { target: { value: '새 규격' } });
        fireEvent.click(within(row).getByRole('button', { name: '저장' }));
        fireEvent.keyDown(within(row).getByLabelText('규격'), { key: 'Enter' });
        expect(materialService.updateMaterial).toHaveBeenCalledTimes(1);
        expect(within(row).getByRole('button', { name: '취소' })).toBeDisabled();
        await act(async () => { rejectSave(new Error('저장 연결 오류')); });
        expect(within(row).getByRole('alert')).toHaveTextContent('저장 연결 오류');
        expect(within(row).getByLabelText('규격')).toHaveValue('새 규격');
        fireEvent.click(within(row).getByRole('button', { name: '저장' }));
        await screen.findByRole('status');
        expect(materialService.updateMaterial).toHaveBeenCalledTimes(2);
    } finally { consoleError.mockRestore(); }
});

it('선택 분류와 EA를 기본값으로 제안하고 같은 품목을 연속 등록한다', async () => {
    render(<MaterialMasterPage />);
    await screen.findByRole('region', { name: '비계 자재' });
    fireEvent.click(screen.getByRole('button', { name: '비계 1' }));
    fireEvent.click(screen.getByRole('button', { name: '자재 등록' }));
    expect(screen.getByLabelText('분류')).toHaveValue('비계');
    expect(within(screen.getByLabelText('분류')).getAllByRole('option').map(option => option.textContent)).toEqual(['동바리', '비계', '기타']);
    expect(screen.getByLabelText('단위')).toHaveValue('EA');
    expect(screen.getByLabelText('규격 *')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('품명'), { target: { value: ' 새 수직재 ' } });
    fireEvent.change(screen.getByLabelText('규격 *'), { target: { value: ' P19 ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장 후 계속 등록' }));
    await waitFor(() => expect(materialService.addMaterial).toHaveBeenCalledWith({
        category: '비계', itemName: '새 수직재', spec: 'P19', unit: 'EA', isActive: true,
    }));
    await waitFor(() => expect(screen.getByLabelText('규격 *')).toHaveFocus());
    expect(screen.getByLabelText('규격 *')).toHaveValue('');
    expect(screen.getByLabelText('품명')).toHaveValue('새 수직재');
    expect(screen.getByRole('status')).toHaveTextContent('등록되었습니다');
    fireEvent.change(screen.getByLabelText('규격 *'), { target: { value: 'P20' } });
    fireEvent.submit(screen.getByRole('form', { name: '자재 등록' }));
    await waitFor(() => expect(materialService.addMaterial).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
});

it('공백 입력과 기타로 표시된 기존 시스템 자재의 중복 등록을 막는다', async () => {
    render(<MaterialMasterPage />);
    await screen.findByRole('region', { name: '기타 자재' });
    fireEvent.click(screen.getByRole('button', { name: '기타 2' }));
    fireEvent.click(screen.getByRole('button', { name: '자재 등록' }));
    fireEvent.change(screen.getByLabelText('품명'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('규격을 입력');
    expect(materialService.addMaterial).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('품명'), { target: { value: '시스템 품목' } });
    fireEvent.change(screen.getByLabelText('규격 *'), { target: { value: 'QA-2' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('이미 등록된 자재');
    expect(materialService.addMaterial).not.toHaveBeenCalled();
});

it('저장 중 재요청을 막고 실패하면 입력값을 유지해 재시도할 수 있다', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let rejectSave!: (error: Error) => void;
    (materialService.addMaterial as jest.Mock).mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSave = reject; }));
    try {
        render(<MaterialMasterPage />);
        await screen.findByRole('region', { name: '동바리 자재' });
        fireEvent.click(screen.getByRole('button', { name: '자재 등록' }));
        fireEvent.change(screen.getByLabelText('품명'), { target: { value: '수직재' } });
        fireEvent.change(screen.getByLabelText('규격 *'), { target: { value: 'P30' } });
        fireEvent.submit(screen.getByRole('form'));
        fireEvent.submit(screen.getByRole('form'));
        expect(materialService.addMaterial).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
        await act(async () => { rejectSave(new Error('저장 오류')); });
        expect(screen.getByRole('alert')).toHaveTextContent('저장 오류');
        expect(screen.getByLabelText('규격 *')).toHaveValue('P30');
        fireEvent.click(screen.getByRole('button', { name: '저장' }));
        await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    } finally { consoleError.mockRestore(); }
});

it('팀장은 공용 자재 목록을 조회하지만 등록·수정·삭제 기능은 보이지 않는다', async () => {
    (useMaterialAdministration as jest.Mock).mockReturnValue(false);
    render(<MaterialMasterPage />);
    await screen.findByRole('region', { name: '기타 자재' });
    expect(screen.queryByRole('button', { name: '자재 등록' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('수정')).not.toBeInTheDocument();
    expect(screen.queryByTitle('삭제')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /수정:/ })).not.toBeInTheDocument();
});

it('규격만 입력하면 빈 품명과 기본 분류·단위로 저장하고 목록에서도 품명을 비울 수 있다', async () => {
    render(<MaterialMasterPage />);
    await screen.findByRole('region', { name: '동바리 자재' });
    fireEvent.click(screen.getByRole('button', { name: '자재 등록' }));
    expect(screen.getByLabelText('품명')).not.toBeRequired();
    expect(screen.getByLabelText('규격 *')).toBeRequired();
    fireEvent.change(screen.getByLabelText('규격 *'), { target: { value: ' P99 ' } });
    fireEvent.change(screen.getByLabelText('단위'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(materialService.addMaterial).toHaveBeenCalledWith({ category: '동바리', itemName: '', spec: 'P99', unit: 'EA', isActive: true }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    const row = within(screen.getByRole('region', { name: '동바리 자재' })).getByRole('row', { name: /QA-0/ });
    fireEvent.click(within(row).getByTitle('수정'));
    fireEvent.change(within(row).getByLabelText('품명'), { target: { value: '' } });
    fireEvent.click(within(row).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(materialService.updateMaterial).toHaveBeenCalledWith('0', expect.objectContaining({ itemName: '', spec: 'QA-0' })));
    await screen.findByRole('status');
});
