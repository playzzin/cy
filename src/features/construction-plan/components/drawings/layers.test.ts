import {
  DRAWING_LAYER_CONTRACT,
  canonicalDrawingObjectStyle,
  drawingLayerStyleColor,
  isCanonicalDrawingObjectStyle,
} from './layers';

describe('drawing layer contract', () => {
  it('matches the eight P05 standard visual expressions', () => {
    expect(DRAWING_LAYER_CONTRACT.install).toMatchObject({ stroke: '#1677ff', dash: 'solid', geometry: 'area' });
    expect(DRAWING_LAYER_CONTRACT.dismantle).toMatchObject({ stroke: '#f97316', dash: 'dot', geometry: 'area' });
    expect(DRAWING_LAYER_CONTRACT.retain).toMatchObject({ stroke: '#dc2626', hatch: 'diagonal', geometry: 'area' });
    expect(DRAWING_LAYER_CONTRACT.equipment).toMatchObject({ stroke: '#2563eb', geometry: 'direction', preferredTool: 'arrow' });
    expect(DRAWING_LAYER_CONTRACT.pedestrian).toMatchObject({ stroke: '#16a34a', geometry: 'direction', preferredTool: 'arrow' });
    expect(DRAWING_LAYER_CONTRACT.lifting).toMatchObject({ stroke: '#ca8a04', dash: 'dash', geometry: 'radius', preferredTool: 'ellipse' });
    expect(DRAWING_LAYER_CONTRACT.restricted).toMatchObject({ stroke: '#dc2626', dash: 'dash', geometry: 'area' });
    expect(DRAWING_LAYER_CONTRACT.storage).toMatchObject({ stroke: '#16a34a', dash: 'solid', geometry: 'area' });
    Object.values(DRAWING_LAYER_CONTRACT).forEach((contract) => {
      expect(drawingLayerStyleColor(contract.strokeToken, 'fallback')).toBe(contract.stroke);
      expect(drawingLayerStyleColor(contract.fillToken, 'fallback')).toBe(contract.fill);
    });
  });

  it('accepts only the canonical persisted style for each layer', () => {
    const style = canonicalDrawingObjectStyle('retain');
    expect(isCanonicalDrawingObjectStyle('retain', style)).toBe(true);
    expect(isCanonicalDrawingObjectStyle('retain', { ...style, hatch: 'cross' })).toBe(false);
  });
});
