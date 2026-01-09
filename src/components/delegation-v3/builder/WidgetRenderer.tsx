import React from 'react';
import { BuilderElement } from './types';
import { TextWidget } from './widgets/TextWidget';
import { TableWidget } from './widgets/TableWidget';
import { BuilderElementWrapper as BuilderElementWrapperComponent } from './BuilderElementWrapper';

interface WidgetRendererProps {
    element: BuilderElement;
    isSelected: boolean;
    dataContext: any; // accessing trusteeData, workers, etc.
    onSelect: (multi: boolean) => void;
    onChange: (id: string, updates: Partial<BuilderElement>) => void;
    snapping?: boolean;
    readOnly?: boolean;
    zoom?: number;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
    element,
    isSelected,
    dataContext,
    onSelect,
    onChange,
    snapping = true,
    readOnly = false,
    zoom = 1
}) => {
    // Resolve Text Processing
    const resolveText = () => {
        if (element.content.dataKey) {
            return dataContext.trusteeData?.[element.content.dataKey] || '';
        }
        let text = element.content.text || '';
        if (text.includes('{{')) {
            // Safety check for trusteeData
            if (dataContext.trusteeData) {
                Object.keys(dataContext.trusteeData).forEach(key => {
                    text = text.replace(new RegExp(`{{${key}}}`, 'g'), dataContext.trusteeData[key] || '');
                });
            }
        }
        return text;
    };

    const renderContent = () => {
        switch (element.type) {
            case 'text':
                return (
                    <TextWidget
                        element={element}
                        isSelected={isSelected}
                        onChange={onChange}
                        resolvedText={resolveText()}
                        readOnly={readOnly}
                    />
                );
            case 'table':
                return (
                    <TableWidget
                        element={element}
                        isSelected={isSelected}
                        data={dataContext.delegators || []}
                        onChange={onChange} // wrapper handles resize/drag, widget handles internal content
                        readOnly={readOnly}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <BuilderElementWrapperComponent
            element={element}
            isSelected={isSelected}
            onSelect={onSelect}
            onChange={onChange}
            snapping={snapping}
            readOnly={readOnly}
            zoom={zoom}
        >
            {renderContent()}
        </BuilderElementWrapperComponent>
    );
};


