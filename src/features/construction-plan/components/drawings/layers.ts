import rawLayerContract from './drawingLayerContract.json';
import type {
  DrawingLayerConfig,
  DrawingLayerType,
  DrawingObjectStyle,
  DrawingTool,
} from './types';

export const DRAWING_LAYER_ORDER: DrawingLayerType[] = [
  'install',
  'dismantle',
  'retain',
  'equipment',
  'pedestrian',
  'lifting',
  'restricted',
  'storage',
];

export type DrawingLayerGeometryContract = 'area' | 'direction' | 'radius';

export interface DrawingLayerContractEntry {
  label: string;
  shortLabel: string;
  strokeToken: string;
  fillToken: string;
  stroke: string;
  fill: string;
  strokeWidthPt: number;
  opacity: number;
  dash: DrawingObjectStyle['dash'];
  hatch: NonNullable<DrawingObjectStyle['hatch']>;
  dashArray: string;
  pattern: DrawingLayerConfig['pattern'];
  geometry: DrawingLayerGeometryContract;
  preferredTool: Exclude<DrawingTool, 'select'>;
}

/** Canonical P05 contract used by editor, preview and persisted annotations. */
export const DRAWING_LAYER_CONTRACT = rawLayerContract as Record<
  DrawingLayerType,
  DrawingLayerContractEntry
>;

export const DRAWING_LAYERS: Record<DrawingLayerType, DrawingLayerConfig> = Object.fromEntries(
  DRAWING_LAYER_ORDER.map((layer) => {
    const contract = DRAWING_LAYER_CONTRACT[layer];
    return [layer, {
      label: contract.label,
      shortLabel: contract.shortLabel,
      color: contract.stroke,
      fillOpacity: contract.opacity,
      ...(contract.dashArray ? { dashArray: contract.dashArray } : {}),
      pattern: contract.pattern,
    }];
  }),
) as Record<DrawingLayerType, DrawingLayerConfig>;

/** Exact token-to-colour projection shared by the editor and client A4 preview. */
export const DRAWING_LAYER_STYLE_COLOR_VALUES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(DRAWING_LAYER_ORDER.flatMap((layer) => {
    const contract = DRAWING_LAYER_CONTRACT[layer];
    return [
      [contract.strokeToken, contract.stroke],
      [contract.fillToken, contract.fill],
    ];
  })),
);

export const drawingLayerStyleColor = (
  token: string | undefined,
  fallback: string,
): string => (token && DRAWING_LAYER_STYLE_COLOR_VALUES[token]) || fallback;

export const canonicalDrawingObjectStyle = (
  layer: DrawingLayerType,
): DrawingObjectStyle => {
  const contract = DRAWING_LAYER_CONTRACT[layer];
  return {
    strokeToken: contract.strokeToken,
    fillToken: contract.fillToken,
    strokeWidthPt: contract.strokeWidthPt,
    opacity: contract.opacity,
    dash: contract.dash,
    hatch: contract.hatch,
  };
};

export const isCanonicalDrawingObjectStyle = (
  layer: DrawingLayerType,
  style: DrawingObjectStyle | undefined,
): boolean => {
  if (!style) return false;
  const expected = canonicalDrawingObjectStyle(layer);
  return style.strokeToken === expected.strokeToken
    && style.fillToken === expected.fillToken
    && style.strokeWidthPt === expected.strokeWidthPt
    && style.opacity === expected.opacity
    && style.dash === expected.dash
    && (style.hatch ?? 'none') === expected.hatch;
};
