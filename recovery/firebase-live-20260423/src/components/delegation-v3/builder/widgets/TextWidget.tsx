import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { BuilderElement } from '../types';

interface TextWidgetProps {
    element: BuilderElement;
    isSelected: boolean;
    onSelect?: (multi: boolean) => void; // Optional now as wrapper handles click
    onChange: (id: string, updates: Partial<BuilderElement>) => void;
    resolvedText?: string;
    readOnly?: boolean;
}

export const TextWidget: React.FC<TextWidgetProps> = ({
    element,
    isSelected,
    onChange,
    resolvedText,
    readOnly = false
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = () => {
        if (!readOnly) setIsEditing(true);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsEditing(false);
        onChange(element.id, {
            content: { ...element.content, text: e.target.value }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
        }
        e.stopPropagation();
    };

    return (
        <WidgetContainer
            $isSelected={isSelected}
            $style={element.style}
            onDoubleClick={handleDoubleClick}
        >
            {isEditing ? (
                <StyledTextarea
                    ref={textareaRef}
                    defaultValue={element.content.text}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    $style={element.style}
                    onMouseDown={(e) => e.stopPropagation()} // Allow text selection
                />
            ) : (
                <StyledContent $style={element.style}>
                    {resolvedText !== undefined ? resolvedText : (element.content.dataKey ? `{{${element.content.dataKey}}}` : element.content.text)}
                </StyledContent>
            )}
        </WidgetContainer>
    );
};

const WidgetContainer = styled.div<{ $isSelected: boolean; $style: BuilderElement['style'] }>`
    width: 100%;
    height: 100%;
    /* Cursor handled by wrapper, but text area needs auto */
    cursor: inherit; 
    background-color: ${props => props.$style.backgroundColor || 'transparent'};
    border: ${props => props.$style.border || 'none'};
    box-sizing: border-box;
    overflow: hidden;
`;

const StyledContent = styled.div<{ $style: BuilderElement['style'] }>`
    width: 100%;
    height: 100%;
    font-size: ${props => props.$style.fontSize}pt;
    font-weight: ${props => props.$style.fontWeight};
    text-align: ${props => props.$style.textAlign};
    color: ${props => props.$style.color};
    white-space: pre-wrap;
    /* overflow: hidden; // Parent handles overflow */
    user-select: none;
    display: flex;
    align-items: flex-start;
    /* Flex alignment based on text-align? */
    justify-content: ${props => {
        if (props.$style.textAlign === 'center') return 'center';
        if (props.$style.textAlign === 'right') return 'flex-end';
        return 'flex-start';
    }};
`;

const StyledTextarea = styled.textarea<{ $style: BuilderElement['style'] }>`
    width: 100%;
    height: 100%;
    font-size: ${props => props.$style.fontSize}pt;
    font-weight: ${props => props.$style.fontWeight};
    text-align: ${props => props.$style.textAlign};
    color: ${props => props.$style.color};
    border: 1px dashed #3b82f6;
    outline: none;
    resize: none;
    background: rgba(255, 255, 255, 0.9);
    padding: 0;
    margin: 0;
    font-family: inherit;
`;

