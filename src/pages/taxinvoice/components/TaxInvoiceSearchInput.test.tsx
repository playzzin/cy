import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TaxInvoiceSearchInput from './TaxInvoiceSearchInput';

function mount(onChange = jest.fn(), onKeyDown = jest.fn()) {
    function Search() {
        const [value, setValue] = useState('');
        return <>
            <TaxInvoiceSearchInput type="search" aria-label="검증 검색" value={value}
                clearLabel="검색어 지우기" onChange={next => { setValue(next); onChange(next); }} onKeyDown={onKeyDown} />
            <button onClick={() => setValue('')}>외부 초기화</button>
        </>;
    }
    render(<Search />);
    return screen.getByRole('searchbox', { name: '검증 검색' }) as HTMLInputElement;
}

test('실제 키보드의 영문 입력을 강제로 한글로 바꾸지 않는다', () => {
    const onChange = jest.fn();
    const input = mount(onChange);
    userEvent.type(input, 'gksrmf');
    expect(input).toHaveValue('gksrmf');
    expect(onChange).toHaveBeenLastCalledWith('gksrmf');
    userEvent.type(input, '{backspace}', { skipClick: true });
    expect(input).toHaveValue('gksrm');
    userEvent.type(input, '{backspace}', { skipClick: true });
    expect(input).toHaveValue('gksr');
    userEvent.type(input, '{backspace}', { skipClick: true });
    expect(input).toHaveValue('gks');
    expect(input).toHaveFocus();
});

test('네이티브 한글 조합 중에는 목록을 갱신하거나 Enter로 필터를 확정하지 않는다', () => {
    const onChange = jest.fn();
    const onKeyDown = jest.fn();
    const input = mount(onChange, onKeyDown);
    fireEvent.compositionStart(input);
    ['ㅎ', '하', '한'].forEach(value => fireEvent.change(input, { target: { value } }));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('한');
    expect(onChange).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    expect(onChange).toHaveBeenLastCalledWith('한');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(onKeyDown).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
});

test('숫자, 붙여넣기와 지우기를 보존하고 별도의 입력 언어 상태를 만들지 않는다', () => {
    const input = mount();
    expect(screen.queryByRole('button', { name: /입력 언어/ })).not.toBeInTheDocument();
    userEvent.type(input, 'ABC-123');
    expect(input).toHaveValue('ABC-123');
    userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    userEvent.paste(input, 'ENG 한글 123');
    expect(input).toHaveValue('ENG 한글 123');
    userEvent.click(screen.getByRole('button', { name: '외부 초기화' }));
    expect(input).toHaveValue('');
    userEvent.type(input, '123 gks');
    expect(input).toHaveValue('123 gks');
});

test('중간 삽입과 선택 영역 교체 후 커서와 앞뒤 검색어를 보존한다', () => {
    const input = mount();
    userEvent.paste(input, '앞 뒤');
    input.focus();
    input.setSelectionRange(2, 2);
    userEvent.type(input, 'AB', { skipClick: true });
    expect(input).toHaveValue('앞 AB뒤');
    expect(input.selectionStart).toBe(4);
    input.setSelectionRange(2, 4);
    userEvent.type(input, 'CD', { skipClick: true });
    expect(input).toHaveValue('앞 CD뒤');
    expect(input.selectionStart).toBe(4);
    userEvent.type(input, '{arrowleft}{backspace}', { skipClick: true });
    expect(input).toHaveValue('앞 D뒤');
});

test('한글 조합 뒤 한/영 키를 눌러 영어를 입력하고 다시 한글 조합으로 돌아간다', () => {
    const onChange = jest.fn();
    const input = mount(onChange);
    input.focus();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '한글' } });
    fireEvent.compositionEnd(input);
    expect(fireEvent.keyDown(input, { key: 'HangulMode', code: 'Lang1', keyCode: 21 })).toBe(true);
    userEvent.type(input, 'ABC', { skipClick: true });
    expect(input).toHaveValue('한글ABC');
    expect(fireEvent.keyDown(input, { key: 'HangulMode', code: 'Lang1', keyCode: 21 })).toBe(true);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '한글ABC검' } });
    expect(onChange).toHaveBeenLastCalledWith('한글ABC');
    fireEvent.compositionEnd(input);
    expect(onChange).toHaveBeenLastCalledWith('한글ABC검');
});

test('Ctrl 단축키를 가로채지 않고 포커스 이동 시 조합 중 값을 반영한다', () => {
    const onChange = jest.fn();
    const input = mount(onChange);
    expect(fireEvent.keyDown(input, { key: 'a', ctrlKey: true })).toBe(true);
    expect(input).toHaveValue('');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '한글' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('한글');
});
