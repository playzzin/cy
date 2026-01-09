import React from 'react';
import { Rnd, DraggableData, ResizableDelta, Position } from 'react-rnd';
import styled from 'styled-components';
import { mmToPx, pxToMm, snapToGrid } from '../../utils/units';

interface DelegatorItem {
    id: string;
    name: string;
    idNumber: string;
    address: string;
    unitPrice: number;
    workDays: number;
    claimAmount: number;
    signature: string;
}

interface DraggableTableProps {
    id: string;
    data: DelegatorItem[];
    x: number;
    y: number;
    width: number;
    height: number; // Auto height usually, but can be constrained
    isSelected: boolean;
    fontSize?: number;
    onSelect: () => void;
    onPositionChange: (x: number, y: number) => void;
    onResize: (width: number, height: number, x: number, y: number) => void;
}

export const DraggableTable: React.FC<DraggableTableProps> = ({
    id,
    data,
    x,
    y,
    width,
    height,
    isSelected,
    fontSize = 10,
    onSelect,
    onPositionChange,
    onResize
}) => {
    const handleDragStop = (_e: any, data: DraggableData) => {
        const newX = snapToGrid(pxToMm(data.x));
        const newY = snapToGrid(pxToMm(data.y));
        onPositionChange(newX, newY);
    };

    const handleResizeStop = (
        _e: any,
        _dir: string,
        ref: HTMLElement,
        _delta: ResizableDelta,
        position: Position
    ) => {
        const newWidth = snapToGrid(pxToMm(ref.offsetWidth));
        const newHeight = snapToGrid(pxToMm(ref.offsetHeight));
        const newX = snapToGrid(pxToMm(position.x));
        const newY = snapToGrid(pxToMm(position.y));

        onResize(newWidth, newHeight, newX, newY);
    };

    const totalAmount = data.reduce((sum, d) => sum + d.claimAmount, 0);

    return (
        <Rnd
            size={{ width: mmToPx(width), height: 'auto' }} // Height auto for table
            position={{ x: mmToPx(x), y: mmToPx(y) }}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            onMouseDown={(e) => {
                e.stopPropagation();
                onSelect();
            }}
            bounds="parent"
            grid={[mmToPx(5), mmToPx(5)]}
            dragGrid={[mmToPx(5), mmToPx(5)]}
            resizeGrid={[mmToPx(5), mmToPx(5)]}
            enableResizing={{ top: false, right: true, bottom: false, left: true, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }} // Width only for table
            disableDragging={!isSelected}
        >
            <TableContainer $isSelected={isSelected} style={{ fontSize: `${fontSize}pt` }}>
                <StyledTable>
                    <thead>
                        <tr>
                            <th>번호</th>
                            <th>위임인</th>
                            <th>주민번호</th>
                            <th>주소</th>
                            <th>청구금액</th>
                            <th>서명</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((delegator, idx) => (
                            <tr key={delegator.id || idx}>
                                <td className="text-center">{idx + 1}</td>
                                <td>{delegator.name}</td>
                                <td className="text-center">{delegator.idNumber}</td>
                                <td>{delegator.address}</td>
                                <td className="text-right">{delegator.claimAmount.toLocaleString()}</td>
                                <td className="text-center">
                                    {delegator.signature && <img src={delegator.signature} alt="서명" style={{ height: '20px', margin: '0 auto' }} />}
                                </td>
                            </tr>
                        ))}
                        {data.length > 0 && (
                            <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                                <td colSpan={4} className="text-center">합계</td>
                                <td className="text-right">{totalAmount.toLocaleString()}</td>
                                <td></td>
                            </tr>
                        )}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center text-slate-400 py-4">
                                    작업자를 선택하면 이곳에 표시됩니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </StyledTable>
                {isSelected && <SelectionBorder />}
            </TableContainer>
        </Rnd>
    );
};

const TableContainer = styled.div<{ $isSelected: boolean }>`
    background: white;
    border: ${props => props.$isSelected ? '2px solid #4f46e5' : '1px solid transparent'}; // Transparent if not selected to look like print
    cursor: pointer;
    box-sizing: border-box;
    width: 100%;
`;

const StyledTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: inherit;

    th, td {
        border: 1px solid #000; // Print style border
        padding: 4px;
    }

    th {
        background: #f1f5f9;
        font-weight: bold;
        text-align: center;
    }
`;

const SelectionBorder = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px solid #4f46e5;
  z-index: 10;
`;
