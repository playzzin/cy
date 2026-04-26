import React from 'react';
import styled from 'styled-components';
import { BuilderElement } from './types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAlignLeft, faAlignCenter, faAlignRight, faBold } from '@fortawesome/free-solid-svg-icons';

interface PropertiesPanelProps {
    selection: string[];
    elements: BuilderElement[];
    updateElement: (id: string, updates: Partial<BuilderElement>) => void;
    trusteeData: any; // For data keys autocomplete
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selection,
    elements,
    updateElement,
    trusteeData
}) => {
    if (selection.length === 0) {
        return (
            <div className="p-4 text-center text-slate-500 text-sm">
                요소를 선택하면 속성이 표시됩니다.
            </div>
        );
    }

    if (selection.length > 1) {
        return (
            <div className="p-4 text-center text-slate-500 text-sm">
                {selection.length}개 요소가 선택되었습니다.
            </div>
        );
    }

    const element = elements.find(el => el.id === selection[0]);
    if (!element) return null;

    const handleChange = (key: string, value: any) => {
        updateElement(element.id, { [key]: value });
    };

    const handleStyleChange = (key: string, value: any) => {
        updateElement(element.id, {
            style: { ...element.style, [key]: value }
        });
    };

    const handleContentChange = (key: string, value: any) => {
        updateElement(element.id, {
            content: { ...element.content, [key]: value }
        });
    };

    return (
        <Container>
            <SectionTitle>배치 (mm)</SectionTitle>
            <Grid2>
                <InputGroup>
                    <Label>X</Label>
                    <Input
                        type="number"
                        value={Math.round(element.x)}
                        onChange={(e) => handleChange('x', Number(e.target.value))}
                    />
                </InputGroup>
                <InputGroup>
                    <Label>Y</Label>
                    <Input
                        type="number"
                        value={Math.round(element.y)}
                        onChange={(e) => handleChange('y', Number(e.target.value))}
                    />
                </InputGroup>
                <InputGroup>
                    <Label>W</Label>
                    <Input
                        type="number"
                        value={Math.round(element.width)}
                        onChange={(e) => handleChange('width', Number(e.target.value))}
                    />
                </InputGroup>
                <InputGroup>
                    <Label>H</Label>
                    <Input
                        type="number"
                        value={Math.round(element.height)}
                        onChange={(e) => handleChange('height', Number(e.target.value))}
                    />
                </InputGroup>
            </Grid2>

            <Divider />

            <SectionTitle>스타일</SectionTitle>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label>폰트 크기</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            className="!w-16"
                            value={element.style.fontSize}
                            onChange={(e) => handleStyleChange('fontSize', Number(e.target.value))}
                        />
                        <span className="text-xs text-slate-500">pt</span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label>스타일</Label>
                    <div className="flex gap-1">
                        <IconButton
                            $active={element.style.fontWeight === 'bold'}
                            onClick={() => handleStyleChange('fontWeight', element.style.fontWeight === 'bold' ? 'normal' : 'bold')}
                            title="굵게"
                        >
                            <FontAwesomeIcon icon={faBold} size="sm" />
                        </IconButton>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label>정렬</Label>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded">
                        <IconButton
                            $active={element.style.textAlign === 'left'}
                            onClick={() => handleStyleChange('textAlign', 'left')}
                        >
                            <FontAwesomeIcon icon={faAlignLeft} size="sm" />
                        </IconButton>
                        <IconButton
                            $active={element.style.textAlign === 'center'}
                            onClick={() => handleStyleChange('textAlign', 'center')}
                        >
                            <FontAwesomeIcon icon={faAlignCenter} size="sm" />
                        </IconButton>
                        <IconButton
                            $active={element.style.textAlign === 'right'}
                            onClick={() => handleStyleChange('textAlign', 'right')}
                        >
                            <FontAwesomeIcon icon={faAlignRight} size="sm" />
                        </IconButton>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label>색상</Label>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title="글자 색상">
                            <span className="text-[10px] text-slate-400">T</span>
                            <ColorInput
                                type="color"
                                value={element.style.color || '#000000'}
                                onChange={(e) => handleStyleChange('color', e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1" title="배경 색상">
                            <span className="text-[10px] text-slate-400">BG</span>
                            <div className="relative flex items-center">
                                <ColorInput
                                    type="color"
                                    value={element.style.backgroundColor || '#ffffff'}
                                    onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                />
                                <button
                                    onClick={() => handleStyleChange('backgroundColor', '')}
                                    title="배경 없음"
                                    className="ml-1 text-[10px] text-slate-400 hover:text-red-500"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label>테두리</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            className="!w-12"
                            min="0"
                            placeholder="두께"
                            value={parseInt(element.style.border || '0')}
                            onChange={(e) => {
                                const width = Number(e.target.value);
                                const color = element.style.border?.split('solid ')[1] || '#000000';
                                handleStyleChange('border', width > 0 ? `${width}px solid ${color}` : undefined);
                            }}
                        />
                        <span className="text-xs text-slate-500">px</span>
                        <ColorInput
                            type="color"
                            value={element.style.border?.split('solid ')[1] || '#000000'}
                            disabled={!element.style.border || element.style.border === 'none'}
                            onChange={(e) => {
                                const width = parseInt(element.style.border || '1');
                                handleStyleChange('border', `${width}px solid ${e.target.value}`);
                            }}
                        />
                    </div>
                </div>
            </div >

            <Divider />

            {
                element.type === 'text' && (
                    <>
                        <SectionTitle>데이터 바인딩</SectionTitle>
                        <div className="space-y-2">
                            <div className="text-xs text-slate-500 mb-1">
                                수임인 정보 등 데이터를 연결하면 텍스트 대신 데이터 값이 표시됩니다.
                            </div>
                            <Select
                                value={element.content.dataKey || ''}
                                onChange={(e) => handleContentChange('dataKey', e.target.value || undefined)}
                            >
                                <option value="">(없음 - 직접 입력)</option>
                                {Object.keys(trusteeData).map(key => (
                                    <option key={key} value={key}>{key}</option>
                                ))}
                            </Select>
                        </div>
                    </>
                )
            }
        </Container >
    );
};

const Container = styled.div`
    padding: 16px;
`;

const SectionTitle = styled.h3`
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 12px;
`;

const Grid2 = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
`;

const InputGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
`;

const Label = styled.label`
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
    white-space: nowrap;
`;

const Input = styled.input`
    width: 100%;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    text-align: right;

    &:focus {
        outline: none;
        border-color: #3b82f6;
    }
`;

const Select = styled.select`
    width: 100%;
    padding: 6px;
    font-size: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: white;

    &:focus {
        outline: none;
        border-color: #3b82f6;
    }
`;

const Divider = styled.div`
    height: 1px;
    background: #f1f5f9;
    margin: 16px 0;
`;

const IconButton = styled.button<{ $active?: boolean }>`
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 12px;
    color: ${props => props.$active ? '#2563eb' : '#64748b'};
    background: ${props => props.$active ? 'white' : 'transparent'};
    box-shadow: ${props => props.$active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'};
    transition: all 0.1s;

    &:hover {
        background: ${props => props.$active ? 'white' : 'rgba(0,0,0,0.05)'};
        color: #1e293b;
    }
`;

const ColorInput = styled.input`
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    
    &::-webkit-color-swatch-wrapper {
        padding: 0;
    }
    &::-webkit-color-swatch {
        border: 1px solid #e2e8f0;
        border-radius: 4px;
    }
`;
