import {
  createTightIdentityBundleLayout,
  createTightIdentityColumns,
  cropBoxToIdentityQuad,
  expandIdentityCropForSafety,
  getIdentityDocumentQuadForOutput,
  getIdentityPerspectiveDimensions,
  getIdentityCropForOutput,
  getIdentityBundleDimensions,
  isValidIdentityPerspectiveQuad,
  mapIdentityPerspectivePoint,
} from './identityBundleComposer';

describe('identityBundleComposer', () => {
  it('고화질 출력의 최대 규격을 유지한다', () => {
    expect(getIdentityBundleDimensions('A4_300')).toEqual({ width: 2480, height: 3508 });
  });

  it('가로형 문서 두 장을 같은 폭으로 빈틈 없이 위아래 배치한다', () => {
    const layout = createTightIdentityBundleLayout([1.66, 1.46], 'A4_300', false);

    expect(layout.columns).toEqual([[0, 1]]);
    expect(layout.slots[0].x).toBe(0);
    expect(layout.slots[1].x).toBe(0);
    expect(layout.slots[0].width).toBeCloseTo(layout.width, 4);
    expect(layout.slots[0].y + layout.slots[0].height).toBeCloseTo(layout.slots[1].y, 4);
    expect(layout.slots[1].y + layout.slots[1].height).toBeCloseTo(layout.height, 4);
  });

  it('가로형 두 장은 왼쪽에 쌓고 세로형 한 장은 오른쪽 전체 높이에 붙인다', () => {
    const ratios = [1.66, 1.46, 0.58];
    const layout = createTightIdentityBundleLayout(ratios, 'A4_300', false);

    expect(createTightIdentityColumns(ratios)).toEqual([[0, 1], [2]]);
    expect(layout.slots[0].columnIndex).toBe(0);
    expect(layout.slots[1].columnIndex).toBe(0);
    expect(layout.slots[2].columnIndex).toBe(1);
    expect(layout.slots[2].y).toBe(0);
    expect(layout.slots[2].height).toBeCloseTo(layout.contentHeight, 4);
    expect(layout.slots[0].x + layout.slots[0].width).toBeCloseTo(layout.slots[2].x, 4);
    expect(layout.width / layout.height).toBeGreaterThan(1.25);
    expect(layout.width / layout.height).toBeLessThan(1.5);
  });

  it('제공된 강길원 예시처럼 2장 적층 결과 비율을 재현한다', () => {
    const layout = createTightIdentityBundleLayout(
      [719 / 432, 719 / 494],
      'A4_300',
      false,
    );

    expect(layout.width / layout.height).toBeCloseTo(719 / 926, 3);
  });

  it('제공된 김병호 예시처럼 왼쪽 2장과 오른쪽 세로형 결과 비율을 재현한다', () => {
    const layout = createTightIdentityBundleLayout(
      [545 / 326, 545 / 337, 362 / 663],
      'A4_300',
      false,
    );

    expect(layout.width / layout.height).toBeCloseTo(907 / 663, 3);
  });

  it('제공된 김영춘 예시처럼 큰 해상도에서도 같은 밀착 비율을 유지한다', () => {
    const layout = createTightIdentityBundleLayout(
      [1694 / 1151, 1694 / 1122, 1121 / 2273],
      'A4_300',
      false,
    );

    expect(layout.width / layout.height).toBeCloseTo(2815 / 2273, 3);
  });

  it('모든 슬롯은 원본 비율을 유지하면서 캔버스를 완전히 채운다', () => {
    const ratios = [1.7, 1.5, 0.62, 1.6];
    const layout = createTightIdentityBundleLayout(ratios, 'A4_150', false);
    const totalArea = layout.slots.reduce((sum, slot) => sum + (slot.width * slot.height), 0);

    expect(totalArea).toBeCloseTo(layout.width * layout.contentHeight, -1);
    layout.slots.forEach((slot, index) => {
      expect(slot.width / slot.height).toBeCloseTo(ratios[index], 2);
    });
  });

  it('AI 문서 영역을 사방으로 넓혀 모서리와 글자가 잘리지 않게 한다', () => {
    expect(expandIdentityCropForSafety(
      { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
      0.05,
    )).toEqual({
      x: 0.065,
      y: 0.17,
      width: 0.77,
      height: 0.66,
    });
  });

  it('이미지 가장자리와 가까운 문서 외곽은 원본 가장자리까지 확장한다', () => {
    expect(expandIdentityCropForSafety(
      { x: 0.04, y: 0.03, width: 0.9, height: 0.93 },
      0.03,
    )).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('경계 잘림 경고가 있으면 배경보다 문서 보존을 우선해 원본 전체를 쓴다', () => {
    expect(getIdentityCropForOutput(
      { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      0.8,
      ['문서 하단이 잘림'],
    )).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('수동 네 모서리 좌표를 자동 안전 여백보다 우선한다', () => {
    const manualQuad = [
      { x: 0.1, y: 0.12 },
      { x: 0.88, y: 0.08 },
      { x: 0.92, y: 0.9 },
      { x: 0.07, y: 0.86 },
    ] as const;
    const quad = getIdentityDocumentQuadForOutput({
      crop: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      confidence: 0.9,
      warnings: [],
      correctionMode: 'MANUAL',
      perspectiveQuad: manualQuad.map((point) => ({ ...point })) as any,
    });

    expect(quad).toEqual(manualQuad);
    expect(isValidIdentityPerspectiveQuad(quad)).toBe(true);
  });

  it('교차되거나 면적이 지나치게 작은 원근 사각형을 거부한다', () => {
    expect(isValidIdentityPerspectiveQuad([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.9, y: 0.1 },
      { x: 0.1, y: 0.9 },
    ])).toBe(false);
    expect(isValidIdentityPerspectiveQuad(cropBoxToIdentityQuad({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }))).toBe(true);
  });

  it('사각형 원근 변환은 네 꼭짓점을 정확히 보존한다', () => {
    const quad = [
      { x: 0.12, y: 0.08 },
      { x: 0.91, y: 0.15 },
      { x: 0.82, y: 0.92 },
      { x: 0.06, y: 0.83 },
    ] as const;
    expect(mapIdentityPerspectivePoint(quad as any, 0, 0)).toEqual(quad[0]);
    expect(mapIdentityPerspectivePoint(quad as any, 1, 0).x).toBeCloseTo(quad[1].x, 8);
    expect(mapIdentityPerspectivePoint(quad as any, 1, 1).y).toBeCloseTo(quad[2].y, 8);
    expect(mapIdentityPerspectivePoint(quad as any, 0, 1).x).toBeCloseTo(quad[3].x, 8);
  });

  it('보정 후 문서 비율을 네 변의 실제 픽셀 거리로 계산한다', () => {
    const size = getIdentityPerspectiveDimensions(
      cropBoxToIdentityQuad({ x: 0.1, y: 0.2, width: 0.8, height: 0.4 }),
      2000,
      1000,
    );
    expect(size.width).toBeCloseTo(1600, 4);
    expect(size.height).toBeCloseTo(400, 4);
    expect(size.aspectRatio).toBeCloseTo(4, 4);
  });
});
