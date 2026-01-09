import React from 'react';
import { Rnd } from 'react-rnd';
import styled from 'styled-components';
import { BuilderElement } from './types';
import { mmToPx, pxToMm, snapToGrid } from '../../../utils/units';

interface BuilderElementWrapperProps {
    element: BuilderElement;
    isSelected: boolean;
    onSelect: (multi: boolean) => void;
    onChange: (id: string, updates: Partial<BuilderElement>) => void;
    snapping?: boolean;
    readOnly?: boolean;
    zoom?: number;
    children: React.ReactNode;
}

export function BuilderElementWrapper({
    element,
    isSelected,
    onSelect,
    onChange,
    snapping = true,
    readOnly = false,
    zoom = 1,
    children
}: BuilderElementWrapperProps) {

    const resizeHandleComponent = !readOnly && isSelected ? {
        bottomRight: <ResizeHandle $pos="se" />,
        bottomLeft: <ResizeHandle $pos="sw" />,
        topRight: <ResizeHandle $pos="ne" />,
        topLeft: <ResizeHandle $pos="nw" />,
        top: <ResizeHandle $pos="n" />,
        bottom: <ResizeHandle $pos="s" />,
        right: <ResizeHandle $pos="e" />,
        left: <ResizeHandle $pos="w" />,
    } : undefined;

    const handleDragStop = (_e: any, d: any) => {
        onChange(element.id, {
            x: snapToGrid(pxToMm(d.x)),
            y: snapToGrid(pxToMm(d.y))
        });
    };

    const handleResizeStop = (_e: any, _dir: any, ref: HTMLElement, _delta: any, position: any) => {
        const shouldDisableAutoFit =
            element.type === 'table' &&
            element.content?.tableType === 'dynamic' &&
            element.content?.autoFitHeight !== false;

        onChange(element.id, {
            width: snapToGrid(pxToMm(ref.offsetWidth)),
            height: snapToGrid(pxToMm(ref.offsetHeight)),
            x: snapToGrid(pxToMm(position.x)),
            y: snapToGrid(pxToMm(position.y)),
            ...(shouldDisableAutoFit
                ? { content: { ...element.content, autoFitHeight: false } }
                : {})
        });
    };

    return (
        <Rnd
            size={{ width: mmToPx(element.width), height: mmToPx(element.height) }}
            position={{ x: mmToPx(element.x), y: mmToPx(element.y) }}
            scale={zoom}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            onMouseDown={(e) => {
                e.stopPropagation();
                if (readOnly) return;
                if (!isSelected || e.shiftKey) onSelect(e.shiftKey);
            }}
            dragHandleClassName="builder-drag-handle"
            disableDragging={readOnly}
            enableResizing={!readOnly && isSelected}
            resizeHandleComponent={resizeHandleComponent as any}
            bounds="parent"
            dragGrid={snapping ? [mmToPx(5), mmToPx(5)] : [1, 1]}
            resizeGrid={snapping ? [mmToPx(5), mmToPx(5)] : [1, 1]}
            style={{ zIndex: isSelected ? 100 : 1 }} // Bring selected to front
        >
            <WrapperContainer $isSelected={isSelected} $style={element.style}>
                {isSelected && !readOnly && (
                    <DragHandle
                        className="builder-drag-handle"
                        title="드래그 이동"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey) onSelect(true);
                        }}
                    >
                        <div className="grid grid-cols-2 gap-[2px]">
                            <Dot />
                            <Dot />
                            <Dot />
                            <Dot />
                            <Dot />
                            <Dot />
                        </div>
                    </DragHandle>
                )}
                {children}

                {/* Selection Visuals */}
                {isSelected && !readOnly && (
                    <SelectionBorder>
                    </SelectionBorder>
                )}
            </WrapperContainer>
        </Rnd>
    );
};

const WrapperContainer = styled.div<{ $isSelected: boolean; $style?: BuilderElement['style'] }>`
    width: 100%;
    height: 100%;
    position: relative;
    /* We don't apply background here usually, as the widget handles it, 
       but we can apply cursor styles */
    cursor: ${props => props.$isSelected ? 'default' : 'pointer'};
    box-sizing: border-box;
    /* Debug border if needed */
    /* border: 1px dotted rgba(0,0,0,0.1); */
`;

const SelectionBorder = styled.div`
    position: absolute;
    inset: -2px; /* Outside the element */
    border: 2px solid #3b82f6;
    pointer-events: none;
    z-index: 50;
`;

const ResizeHandle = styled.div<{ $pos: string }>`
    position: absolute;
    width: 10px;
    height: 10px;
    background: white;
    border: 2px solid #3b82f6;
    border-radius: 999px;
    pointer-events: auto;
    z-index: 60;

    ${props => {
        switch (props.$pos) {
            case 'nw': return 'top: -6px; left: -6px; cursor: nw-resize;';
            case 'ne': return 'top: -6px; right: -6px; cursor: ne-resize;';
            case 'sw': return 'bottom: -6px; left: -6px; cursor: sw-resize;';
            case 'se': return 'bottom: -6px; right: -6px; cursor: se-resize;';
            case 'n': return 'top: -6px; left: 50%; transform: translateX(-50%); cursor: n-resize;';
            case 's': return 'bottom: -6px; left: 50%; transform: translateX(-50%); cursor: s-resize;';
            case 'e': return 'top: 50%; right: -6px; transform: translateY(-50%); cursor: e-resize;';
            case 'w': return 'top: 50%; left: -6px; transform: translateY(-50%); cursor: w-resize;';
            default: return '';
        }
    }}
`;

const DragHandle = styled.div`
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 44px;
    height: 16px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    z-index: 70;

    &:active {
        cursor: grabbing;
    }
`;

const Dot = styled.div`
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.95);
`;
