export type DrawingLayerType =
  | 'install'
  | 'dismantle'
  | 'retain'
  | 'equipment'
  | 'pedestrian'
  | 'lifting'
  | 'restricted'
  | 'storage';

export type DrawingObjectKind =
  | 'rectangle'
  | 'polygon'
  | 'arrow'
  | 'polyline'
  | 'ellipse'
  | 'marker'
  | 'text';

export type DrawingTool = 'select' | Exclude<DrawingObjectKind, 'polyline'>;

/**
 * A point relative to the drawing page. Both values are always clamped to 0..1.
 * Keeping marks page-relative makes them independent from screen and PDF resolution.
 */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface DrawingObject {
  id: string;
  kind: DrawingObjectKind;
  layer: DrawingLayerType;
  points: NormalizedPoint[];
  label: string;
  zoneCode: string;
  /** Ordered installation/dismantling stage. Retained verbatim across edits. */
  sequence?: number;
  /** Layer schedule fields. Dismantling uses startDate as its planned date. */
  startDate?: string;
  endDate?: string;
  /** Retention reason or legacy annotation reason. */
  reason?: string;
  releaseCondition?: string;
  equipmentType?: string;
  equipmentId?: string;
  entrance?: string;
  destination?: string;
  /** Lifting radius in metres; geometry remains normalized independently. */
  radius?: number;
  responsibleWorkerId?: string;
  responsibleRole?: string;
  materialType?: string;
  /** Geometry details that cannot be represented by points alone. */
  rotationDeg?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  markerType?: string;
  textAlign?: 'left' | 'center' | 'right';
  /** Domain annotation style. Keeping it in the studio prevents lossy re-editing. */
  style?: DrawingObjectStyle;
  locked?: boolean;
}

export interface DrawingObjectStyle {
  strokeToken: string;
  fillToken?: string;
  strokeWidthPt: number;
  opacity: number;
  dash: 'solid' | 'dash' | 'dot';
  hatch?: 'none' | 'diagonal' | 'cross';
  fontSizePt?: number;
}

export interface DrawingBackground {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf';
  /** Immutable Firebase Storage object path persisted with the plan. */
  storagePath?: string;
  /** Runtime-only preview URL. Hosts must not persist bearer/blob URLs. */
  sourceUrl?: string;
}

export type DrawingRuntimePreview =
  | {
      status: 'pending' | 'processing';
    }
  | {
      status: 'failed';
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      status: 'ready';
      pageIndex: number;
      pageCount: number;
      availablePageIndexes: number[];
      pageFingerprint: string;
      storagePath: string;
      /** Runtime-only authenticated blob URL; never persisted with a plan. */
      sourceUrl?: string;
    };

export interface DrawingStudioValue {
  schemaVersion: 1;
  background?: DrawingBackground;
  /** Runtime projection of a derived page preview. Hosts strip it before persistence. */
  preview?: DrawingRuntimePreview;
  objects: DrawingObject[];
}

export interface DrawingStudioProps {
  /** Pass `value` to control the editor from the host form. */
  value?: DrawingStudioValue;
  /** Used only when `value` is not supplied. */
  defaultValue?: DrawingStudioValue;
  onChange?: (value: DrawingStudioValue) => void;
  /** Gives the host a chance to upload the original file to Storage. */
  onBackgroundFileChange?: (file: File, metadata: DrawingBackground) => void;
  /** Select an exact generated PDF page; the host hydrates its private URL. */
  onPreviewPageChange?: (pageIndex: number) => void;
  /** Lazily hydrate an authenticated page image for the PDF thumbnail rail. */
  resolvePreviewPageUrl?: (pageIndex: number) => Promise<string>;
  /** Retry a failed server preview job without replacing the source PDF. */
  onRetryPreview?: () => void;
  /** Show the isolated three-point polygon exercise before the first real edit. */
  showFirstUsePractice?: boolean;
  /** Scope practice completion to the signed-in operator rather than plan data. */
  firstUsePracticeStorageKey?: string;
  /** Select and reveal an exact annotation requested by validation/navigation. */
  focusObjectId?: string;
  /** Increment when the same object must be focused again. */
  focusRequestKey?: number;
  readOnly?: boolean;
  className?: string;
  'aria-label'?: string;
}

export interface DrawingLayerConfig {
  label: string;
  shortLabel: string;
  color: string;
  fillOpacity: number;
  dashArray?: string;
  pattern: 'diagonal' | 'reverse' | 'cross' | 'dots' | 'horizontal' | 'vertical' | 'grid' | 'dense';
}
