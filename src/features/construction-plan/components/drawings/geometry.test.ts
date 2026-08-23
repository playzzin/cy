import {
  boundsFromPoints,
  clamp01,
  clientPointToNormalized,
  constrainDraftPoint,
  isPracticalShape,
  normalizePoint,
  objectLabelPoint,
  resizePointsWithinPage,
  translatePointsWithinPage,
} from './geometry';
import { DrawingObject } from './types';

describe('construction drawing geometry', () => {
  it('clamps and rounds normalized coordinates', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
    expect(normalizePoint({ x: 0.123456789, y: 4 })).toEqual({ x: 0.123457, y: 1 });
  });

  it('converts browser coordinates to page-relative values', () => {
    const bounds = { left: 100, top: 50, width: 400, height: 200 };
    expect(clientPointToNormalized(300, 100, bounds)).toEqual({ x: 0.5, y: 0.25 });
    expect(clientPointToNormalized(900, -100, bounds)).toEqual({ x: 1, y: 0 });
  });

  it('calculates order-independent bounds', () => {
    expect(boundsFromPoints([{ x: 0.8, y: 0.2 }, { x: 0.1, y: 0.9 }, { x: 0.4, y: 0.1 }])).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.7000000000000001,
      height: 0.8,
    });
  });

  it('rejects clicks and accepts practical shapes', () => {
    expect(isPracticalShape('rectangle', [{ x: 0.2, y: 0.2 }, { x: 0.201, y: 0.201 }])).toBe(false);
    expect(isPracticalShape('arrow', [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }])).toBe(true);
    expect(isPracticalShape('polygon', [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }])).toBe(false);
    expect(isPracticalShape('polygon', [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.8 }])).toBe(true);
  });

  it('places a label at the visual center', () => {
    const object: DrawingObject = {
      id: 'one',
      kind: 'rectangle',
      layer: 'install',
      label: '',
      zoneCode: '',
      points: [{ x: 0.2, y: 0.1 }, { x: 0.6, y: 0.9 }],
    };
    expect(objectLabelPoint(object)).toEqual({ x: 0.4, y: 0.5 });
  });

  it('moves the whole geometry and clamps the delta without distorting it', () => {
    const points = [{ x: 0.8, y: 0.7 }, { x: 0.95, y: 0.9 }, { x: 0.9, y: 0.8 }];
    expect(translatePointsWithinPage(points, { x: 0.3, y: 0.3 })).toEqual([
      { x: 0.85, y: 0.8 },
      { x: 1, y: 1 },
      { x: 0.95, y: 0.9 },
    ]);
    expect(translatePointsWithinPage(points, { x: -0.2, y: 0.08 }, true)).toEqual([
      { x: 0.6, y: 0.7 },
      { x: 0.75, y: 0.9 },
      { x: 0.7, y: 0.8 },
    ]);
  });

  it('resizes from a selected corner, preserves point ordering and supports aspect lock', () => {
    const points = [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.4 }];
    expect(resizePointsWithinPage(points, 'south-east', { x: 0.8, y: 0.7 })).toEqual([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.7 },
    ]);
    expect(resizePointsWithinPage(points, 'south-east', { x: 0.8, y: 0.45 }, true)).toEqual([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.5 },
    ]);
  });

  it('applies Shift creation constraints for square boxes and 45-degree arrows', () => {
    expect(constrainDraftPoint(
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.3 },
      'rectangle',
      true,
      10 / 7,
    )).toEqual({ x: 0.5, y: 0.628571 });
    expect(constrainDraftPoint(
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.4 },
      'arrow',
      true,
      10 / 7,
    )).toEqual({ x: 0.434094, y: 0.53442 });
  });
});
