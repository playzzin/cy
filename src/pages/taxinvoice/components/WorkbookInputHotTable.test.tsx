import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkbookInputHotTable from './WorkbookInputHotTable';

jest.mock('@handsontable/react', () => ({
    HotTable: jest.requireActual('react').forwardRef((props: Record<string, unknown>, _ref: unknown) => (
        jest.requireActual('react').createElement('div', {
            'data-testid': 'workbook-input-hot-table',
            'data-ime-fast-edit': String(props.imeFastEdit),
            'data-after-init': String(typeof props.afterInit),
            'data-after-selection-end': String(typeof props.afterSelectionEnd),
            'data-before-key-down': String(typeof props.beforeKeyDown),
            'data-modify-focused-element': String(typeof props.modifyFocusedElement),
            'data-grid-height': String(props.height),
            'data-fixed-columns': String(props.fixedColumnsStart),
        })
    )),
}));

jest.mock('handsontable/registry', () => ({
    registerAllModules: jest.fn(),
}));

describe('WorkbookInputHotTable', () => {
    it('한글 입력은 내장 IME 흐름만 사용하고 수동 포커스 훅을 연결하지 않는다', () => {
        render(
            <WorkbookInputHotTable
                hotRef={React.createRef()}
                data={[]}
                dataSchema={{}}
                columns={[]}
                colHeaders={[]}
                cells={() => ({})}
                beforePaste={jest.fn()}
                beforeChange={jest.fn()}
                afterChange={jest.fn()}
                beforeOnCellMouseDown={jest.fn()}
            />
        );

        const hotTable = screen.getByTestId('workbook-input-hot-table');
        expect(hotTable.getAttribute('data-ime-fast-edit')).toBe('true');
        expect(hotTable.getAttribute('data-after-init')).toBe('undefined');
        expect(hotTable.getAttribute('data-after-selection-end')).toBe('undefined');
        expect(hotTable.getAttribute('data-before-key-down')).toBe('undefined');
        expect(hotTable.getAttribute('data-modify-focused-element')).toBe('undefined');
        expect(hotTable.getAttribute('data-grid-height')).toBe('min(68vh, 760px)');
        expect(hotTable.getAttribute('data-fixed-columns')).toBe('2');
    });
});
