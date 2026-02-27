import React, { useMemo } from 'react';
import styled from 'styled-components';

interface RulerProps {
    orientation: 'horizontal' | 'vertical';
    length: number; // in mm usually, but we render in px based on scale
    scale: number;
    mmToPx: number; // conversion factor (e.g., 3.7795)
}

export const Ruler: React.FC<RulerProps> = ({ orientation, length, scale, mmToPx }) => {
    const ticks = useMemo(() => {
        const items = [];
        // Major tick every 10mm (1cm)
        // Minor tick every 5mm
        // Micro tick every 1mm

        for (let i = 0; i <= length; i++) {
            if (i % 10 === 0) {
                items.push({ pos: i, type: 'major', label: i / 10 });
            } else if (i % 5 === 0) {
                items.push({ pos: i, type: 'minor' });
            }
            // Skipping 1mm ticks for performance if zoomed out, or render them if needed
            // else { items.push({ pos: i, type: 'micro' }); }
        }
        return items;
    }, [length]);

    const rulerSize = 20; // height or width of the ruler bar

    if (orientation === 'horizontal') {
        return (
            <HorizontalContainer style={{ height: rulerSize, width: length * mmToPx * scale }}>
                {ticks.map(t => (
                    <Tick
                        key={t.pos}
                        style={{
                            left: t.pos * mmToPx * scale,
                            height: t.type === 'major' ? '100%' : '50%',
                            borderLeftWidth: 1,
                            borderColor: t.type === 'major' ? '#94a3b8' : '#cbd5e1'
                        }}
                    >
                        {t.type === 'major' && <Label>{t.label}</Label>}
                    </Tick>
                ))}
            </HorizontalContainer>
        );
    } else {
        return (
            <VerticalContainer style={{ width: rulerSize, height: length * mmToPx * scale }}>
                {ticks.map(t => (
                    <Tick
                        key={t.pos}
                        style={{
                            top: t.pos * mmToPx * scale,
                            width: t.type === 'major' ? '100%' : '50%',
                            borderTopWidth: 1,
                            borderColor: t.type === 'major' ? '#94a3b8' : '#cbd5e1'
                        }}
                    >
                        {t.type === 'major' && <LabelVertical>{t.label}</LabelVertical>}
                    </Tick>
                ))}
            </VerticalContainer>
        );
    }
};

const HorizontalContainer = styled.div`
    position: relative;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    pointer-events: none;
`;

const VerticalContainer = styled.div`
    position: relative;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;
    pointer-events: none;
`;

const Tick = styled.div`
    position: absolute;
    border-color: #cbd5e1;
    font-size: 8px;
    color: #64748b;
`;

const Label = styled.div`
    position: absolute;
    top: 2px;
    left: 2px;
`;

const LabelVertical = styled.div`
    position: absolute;
    top: 2px;
    left: 2px;
    transform: rotate(90deg);
    transform-origin: top left;
`;
