import React from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';

registerAllModules();

interface WorkbookInputHotTableProps {
    hotRef: React.Ref<any>;
    data: any[];
    dataSchema: any;
    columns: any[];
    colHeaders: string[];
    cells: any;
    beforePaste: any;
    beforeChange: any;
    afterChange: any;
    beforeOnCellMouseDown: any;
}

// Handsontable의 내장 IME 포커스 흐름을 사용해야 한글 조합 첫 글자가 보존된다.
const WorkbookInputHotTable: React.FC<WorkbookInputHotTableProps> = ({
    hotRef,
    data,
    dataSchema,
    columns,
    colHeaders,
    cells,
    beforePaste,
    beforeChange,
    afterChange,
    beforeOnCellMouseDown,
}) => (
    <HotTable
        ref={hotRef}
        data={data}
        dataSchema={dataSchema}
        columns={columns}
        colHeaders={colHeaders}
        rowHeaders={true}
        rowHeights={34}
        columnHeaderHeight={42}
        width="100%"
        height={760}
        stretchH="all"
        manualColumnResize={true}
        contextMenu={true}
        minSpareRows={8}
        licenseKey="non-commercial-and-evaluation"
        beforePaste={beforePaste}
        beforeChange={beforeChange}
        afterChange={afterChange}
        beforeOnCellMouseDown={beforeOnCellMouseDown}
        copyPaste={true}
        imeFastEdit={true}
        outsideClickDeselects={false}
        className="excel-handsontable"
        cells={cells}
    />
);

export default React.memo(WorkbookInputHotTable);
