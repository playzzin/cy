import React, { forwardRef } from 'react';
import styled from 'styled-components';
import { mmToPx, MM_TO_PX } from '../../../utils/units';
import { BuilderElement } from '../../../components/delegation-v3/builder/types';
import { WidgetRenderer } from '../../../components/delegation-v3/builder/WidgetRenderer';

interface PrintPreviewProps {
    elements: BuilderElement[];
    trusteeData: any;
    delegators: any[];
}

export const PrintPreview = forwardRef<HTMLDivElement, PrintPreviewProps>(({ elements, trusteeData, delegators }, ref) => {
    // Only used for rendering during print
    return (
        <PrintContainer ref={ref}>
            <A4Page>
                {elements.map(el => (
                    <WidgetRenderer
                        key={el.id}
                        element={el}
                        isSelected={false} // No selection in print
                        dataContext={{ trusteeData, delegators }}
                        onSelect={() => { }} // No op
                        onChange={() => { }} // No op
                        snapping={false}
                        readOnly={true} // New prop for read-only rendering
                    />
                ))}
            </A4Page>
        </PrintContainer>
    );
});

const PrintContainer = styled.div`
    display: none;
    
    @media print {
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        z-index: 9999;
    }
`;

const A4Page = styled.div`
    width: 210mm;
    height: 297mm;
    position: relative;
    margin: 0 auto;
    background: white;
    @media print {
        margin: 0;
        box-shadow: none;
    }
`;
