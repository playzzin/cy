import React from 'react';
import { Rnd, DraggableData, ResizableDelta, Position } from 'react-rnd';
import styled from 'styled-components';
import { mmToPx, pxToMm, snapToGrid } from '../../utils/units';

interface DraggableFieldProps {
    id: string;
    label: string;
    value: string;
    x: number;  // mm
    y: number;  // mm
    width: number;  // mm
    height: number;  // mm
    fontSize?: number; // pt
    isSelected: boolean;
    onSelect: () => void;
    onPositionChange: (x: number, y: number) => void;
    onResize: (width: number, height: number, x: number, y: number) => void;
    onDelete?: () => void; // Optional delete handler
}

export const DraggableField: React.FC<DraggableFieldProps> = ({
    id,
    label,
    value,
    x,
    y,
    width,
    height,
    fontSize = 10,
    isSelected,
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

    return (
        <Rnd
            size={{ width: mmToPx(width), height: mmToPx(height) }}
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
            enableResizing={isSelected}
            disableDragging={!isSelected}
        >
            <FieldContainer
                $isSelected={isSelected}
                style={{ width: '100%', height: '100%' }}
            >
                <FieldLabel style={{ fontSize: `${fontSize}pt` }}>{label}</FieldLabel>
                <FieldValue style={{ fontSize: `${fontSize}pt` }}>{value}</FieldValue>

                {isSelected && <SelectionBorder />}
            </FieldContainer>
        </Rnd>
    );
};

// Styled Components
const FieldContainer = styled.div<{ $isSelected: boolean }>`
  width: 100%;
  height: 100%;
  display: flex;
  background: white;
  border: ${props => props.$isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0'};
  border-radius: 2px;
  cursor: pointer; 
  box-sizing: border-box;
  overflow: hidden; 
  
  &:hover {
    border-color: ${props => props.$isSelected ? '#4f46e5' : '#94a3b8'};
  }
`;

const FieldLabel = styled.div`
  width: 30%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
`;

const FieldValue = styled.div`
  width: 70%;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 8px;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
`;

const SelectionBorder = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

