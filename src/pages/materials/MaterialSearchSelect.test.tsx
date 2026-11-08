import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MaterialSearchSelect from './MaterialSearchSelect';

const options = [
    { id: 'a', name: '서울 현장', description: '중구', keywords: 'SEOUL-01' },
    { id: 'b', name: '부산 현장', description: '해운대구' },
    { id: 'c', name: '서울 현장', description: '강남구' },
];

const Picker = ({ onChange = jest.fn(), initialValue = '' }: { onChange?: (id: string) => void; initialValue?: string }) => {
    const [value, setValue] = useState(initialValue);
    return <MaterialSearchSelect id="site" label="현장 선택" value={value} options={options} placeholder="현장명 검색"
        onChange={id => { setValue(id); onChange(id); }} />;
};

it('이름·주소·코드를 공백과 대소문자에 관계없이 검색하고 동명 현장의 정확한 ID를 선택한다', () => {
    const onChange = jest.fn();
    render(<Picker onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '서울현장' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(input, { target: { value: 'seoul-01' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.change(input, { target: { value: '강남' } });
    fireEvent.click(screen.getByRole('option', { name: '서울 현장 강남구' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(input).toHaveValue('서울 현장');
    expect(input).toHaveAttribute('aria-expanded', 'false');
});

it('키보드로 검색 결과를 선택하되 한글 조합 중 Enter로 확정하지 않는다', () => {
    const onChange = jest.fn();
    render(<Picker onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '서울' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'site-options-1');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');
});

it('검색만 하거나 결과가 없는 이름을 입력해도 저장할 선택값을 바꾸지 않고 Esc·바깥 클릭으로 복원한다', () => {
    const onChange = jest.fn();
    render(<Picker initialValue="b" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('부산 현장');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '미등록 현장' } });
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과가 없습니다.');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('부산 현장');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '서울' } });
    fireEvent.pointerDown(document.body);
    expect(input).toHaveValue('부산 현장');
    expect(onChange).not.toHaveBeenCalled();
});

it('선택 해제를 명시적으로 적용하고 목록에 없는 임시저장 항목의 이름도 표시한다', () => {
    const onChange = jest.fn();
    const { rerender } = render(<MaterialSearchSelect id="rental" label="임대사" value="legacy" selectedName="기존 임대사"
        options={[]} placeholder="임대사명 검색" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('기존 임대사');
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('button', { name: '임대사 선택 해제' }));
    expect(onChange).toHaveBeenCalledWith('');
    rerender(<MaterialSearchSelect id="rental" label="임대사" value="" options={[]} placeholder="임대사명 검색" onChange={onChange} disabled />);
    expect(input).toBeDisabled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('조회용 전체 옵션도 목록과 키보드로 선택할 수 있다', () => {
    const onChange = jest.fn();
    render(<MaterialSearchSelect id="site" label="현장" value="a" options={options} placeholder="전체 현장 · 검색"
        emptyOptionLabel="전체 현장" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: '전체 현장' })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('');
});
