import React, { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  boundsFromPoints,
  clientPointToNormalized,
  constrainDraftPoint,
  DrawingResizeHandle,
  isPracticalShape,
  normalizePoint,
  objectAccessibleName,
  objectLabelPoint,
  resizePointsWithinPage,
  toSvgPoints,
  translatePointsWithinPage,
} from './geometry';
import {
  DRAWING_LAYERS,
  DRAWING_LAYER_CONTRACT,
  DRAWING_LAYER_ORDER,
  canonicalDrawingObjectStyle,
  drawingLayerStyleColor,
} from './layers';
import { parseDrawingStudioValue } from './drawingStudioSchema';
import {
  DrawingBackground,
  DrawingLayerType,
  DrawingObject,
  DrawingObjectKind,
  DrawingStudioProps,
  DrawingStudioValue,
  DrawingTool,
  NormalizedPoint,
} from './types';
import {
  ConstructionPlanDwgConversionGuide,
  ConstructionPlanPolygonPractice,
  hasCompletedConstructionPlanPolygonPractice,
} from '../ConstructionPlanOnboarding';
import './DrawingStudio.css';

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 700;
const MAX_HISTORY = 50;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

interface DrawingViewport {
  zoom: number;
  x: number;
  y: number;
}

type GeometryInteraction =
  | {
      kind: 'move';
      pointerId: number;
      objectId: string;
      start: NormalizedPoint;
      originalPoints: NormalizedPoint[];
    }
  | {
      kind: 'resize';
      pointerId: number;
      objectId: string;
      handle: DrawingResizeHandle;
      originalPoints: NormalizedPoint[];
    }
  | {
      kind: 'pan';
      pointerId: number;
      startClientX: number;
      startClientY: number;
      originalViewport: DrawingViewport;
    };

interface GeometryPreview {
  objectId: string;
  points: NormalizedPoint[];
}

const RESIZE_HANDLE_LABELS: Record<DrawingResizeHandle, string> = {
  'north-west': '왼쪽 위',
  'north-east': '오른쪽 위',
  'south-east': '오른쪽 아래',
  'south-west': '왼쪽 아래',
};

const pointsAreEqual = (left: NormalizedPoint[], right: NormalizedPoint[]): boolean =>
  left.length === right.length
  && left.every((point, index) => point.x === right[index]?.x && point.y === right[index]?.y);

const clampViewport = (viewport: DrawingViewport): DrawingViewport => {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom));
  const width = SVG_WIDTH / zoom;
  const height = SVG_HEIGHT / zoom;
  return {
    zoom,
    x: Math.min(SVG_WIDTH - width, Math.max(0, viewport.x)),
    y: Math.min(SVG_HEIGHT - height, Math.max(0, viewport.y)),
  };
};

const EMPTY_VALUE: DrawingStudioValue = { schemaVersion: 1, objects: [] };

const TOOL_OPTIONS: Array<{ value: DrawingTool; label: string; symbol: string }> = [
  { value: 'select', label: '선택', symbol: '↖' },
  { value: 'rectangle', label: '사각형', symbol: '▭' },
  { value: 'polygon', label: '다각형', symbol: '⬡' },
  { value: 'arrow', label: '화살표', symbol: '→' },
  { value: 'ellipse', label: '타원', symbol: '◯' },
  { value: 'marker', label: '마커', symbol: '⌖' },
  { value: 'text', label: '텍스트', symbol: 'T' },
];

const KIND_LABELS: Record<DrawingObjectKind, string> = {
  rectangle: '사각형',
  polygon: '다각형',
  arrow: '화살표',
  polyline: '연속선',
  ellipse: '타원',
  marker: '마커',
  text: '텍스트',
};

const cloneValue = (value: DrawingStudioValue): DrawingStudioValue => ({
  ...value,
  background: value.background ? { ...value.background } : undefined,
  preview: value.preview
    ? {
        ...value.preview,
        ...(value.preview.status === 'ready'
          ? { availablePageIndexes: [...value.preview.availablePageIndexes] }
          : {}),
      }
    : undefined,
  objects: value.objects.map((object) => ({
    ...object,
    points: object.points.map((point) => ({ ...point })),
    ...(object.style ? { style: { ...object.style } } : {}),
  })),
});

const createObjectId = (): string => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `mark-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const humanFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PatternDefinitions = () => (
  <defs>
    <pattern id="drawing-pattern-install" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M-3 14 L14 -3 M4 17 L17 4" stroke="currentColor" strokeWidth="2" />
    </pattern>
    <pattern id="drawing-pattern-dismantle" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M-3 -3 L17 17" stroke="currentColor" strokeWidth="2" />
    </pattern>
    <pattern id="drawing-pattern-retain" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2" fill="currentColor" />
      <circle cx="11" cy="11" r="2" fill="currentColor" />
    </pattern>
    <pattern id="drawing-pattern-equipment" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M0 4 H16 M0 12 H16" stroke="currentColor" strokeWidth="2" />
    </pattern>
    <pattern id="drawing-pattern-pedestrian" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M4 0 V14 M11 0 V14" stroke="currentColor" strokeWidth="1.5" />
    </pattern>
    <pattern id="drawing-pattern-lifting" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M0 4 H16 M0 12 H16 M4 0 V16 M12 0 V16" stroke="currentColor" strokeWidth="1.5" />
    </pattern>
    <pattern id="drawing-pattern-restricted" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M-2 10 L10 -2 M3 12 L12 3" stroke="currentColor" strokeWidth="2.4" />
    </pattern>
    <pattern id="drawing-pattern-storage" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M-2 16 L16 -2 M-2 0 L16 18" stroke="currentColor" strokeWidth="1.5" />
    </pattern>
    {DRAWING_LAYER_ORDER.map((layer) => (
      <marker
        key={layer}
        id={`drawing-arrow-${layer}`}
        markerWidth="12"
        markerHeight="12"
        refX="10"
        refY="5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L10,5 L0,10 z" fill={DRAWING_LAYERS[layer].color} />
      </marker>
    ))}
  </defs>
);

interface ShapeProps {
  object: DrawingObject;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  readOnly: boolean;
}

const DrawingShape = ({ object, selected, onSelect, onPointerDown, readOnly }: ShapeProps) => {
  const config = DRAWING_LAYERS[object.layer];
  const standardStyle = canonicalDrawingObjectStyle(object.layer);
  const labelPoint = objectLabelPoint(object);
  const accessibleName = objectAccessibleName(object, config.label);
  const strokeColor = drawingLayerStyleColor(standardStyle.strokeToken, config.color);
  const fillColor = drawingLayerStyleColor(standardStyle.fillToken, config.color);
  const safeObjectId = object.id.replace(/[^A-Za-z0-9_-]/g, '-');
  const styledPatternId = `drawing-style-pattern-${safeObjectId}`;
  const styledArrowId = `drawing-style-arrow-${safeObjectId}`;
  const hatch = standardStyle.hatch ?? 'none';
  const areaFill = hatch === 'none' ? fillColor : `url(#${styledPatternId})`;
  const commonProps = {
    className: `construction-drawing-shape${selected ? ' is-selected' : ''}`,
    stroke: strokeColor,
    strokeWidth: Math.max(2, standardStyle.strokeWidthPt * 2) + (selected ? 1 : 0),
    strokeDasharray: standardStyle.dash === 'dash' ? '12 8' : standardStyle.dash === 'dot' ? '3 7' : config.dashArray,
    opacity: standardStyle.opacity,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  let shape: React.ReactNode;

  if (object.kind === 'rectangle' && object.points.length >= 2) {
    const bounds = boundsFromPoints(object.points);
    shape = (
      <rect
        {...commonProps}
        x={bounds.x * SVG_WIDTH}
        y={bounds.y * SVG_HEIGHT}
        width={bounds.width * SVG_WIDTH}
        height={bounds.height * SVG_HEIGHT}
        fill={areaFill}
        fillOpacity={hatch === 'none' ? config.fillOpacity : 1}
      />
    );
  } else if (object.kind === 'polygon') {
    shape = (
      <polygon
        {...commonProps}
        points={toSvgPoints(object.points, SVG_WIDTH, SVG_HEIGHT)}
        fill={areaFill}
        fillOpacity={hatch === 'none' ? config.fillOpacity : 1}
      />
    );
  } else if (object.kind === 'ellipse' && object.points.length >= 2) {
    const bounds = boundsFromPoints(object.points);
    shape = (
      <ellipse
        {...commonProps}
        cx={(bounds.x + bounds.width / 2) * SVG_WIDTH}
        cy={(bounds.y + bounds.height / 2) * SVG_HEIGHT}
        rx={(bounds.width / 2) * SVG_WIDTH}
        ry={(bounds.height / 2) * SVG_HEIGHT}
        fill={areaFill}
        fillOpacity={hatch === 'none' ? config.fillOpacity : 1}
      />
    );
  } else if (object.kind === 'marker' && object.points.length === 1) {
    const point = object.points[0];
    shape = (
      <g {...commonProps} fill="white">
        <circle cx={point.x * SVG_WIDTH} cy={point.y * SVG_HEIGHT} r="16" />
        <path
          d={`M${point.x * SVG_WIDTH - 23},${point.y * SVG_HEIGHT} H${point.x * SVG_WIDTH + 23} M${point.x * SVG_WIDTH},${point.y * SVG_HEIGHT - 23} V${point.y * SVG_HEIGHT + 23}`}
          fill="none"
        />
      </g>
    );
  } else if (object.kind === 'text' && object.points.length >= 2) {
    const bounds = boundsFromPoints(object.points);
    const anchor = object.textAlign === 'right' ? 'end' : object.textAlign === 'center' ? 'middle' : 'start';
    const x = object.textAlign === 'right'
      ? (bounds.x + bounds.width) * SVG_WIDTH
      : object.textAlign === 'center'
        ? (bounds.x + bounds.width / 2) * SVG_WIDTH
        : bounds.x * SVG_WIDTH;
    shape = (
      <g>
        <rect
          {...commonProps}
          x={bounds.x * SVG_WIDTH}
          y={bounds.y * SVG_HEIGHT}
          width={bounds.width * SVG_WIDTH}
          height={bounds.height * SVG_HEIGHT}
          fill={fillColor}
          fillOpacity={config.fillOpacity}
        />
        <text
          x={x}
          y={(bounds.y + bounds.height / 2) * SVG_HEIGHT}
          textAnchor={anchor}
          dominantBaseline="central"
          fill={strokeColor}
          fontSize={20}
        >
          {object.label || '텍스트'}
        </text>
      </g>
    );
  } else if ((object.kind === 'arrow' || object.kind === 'polyline') && object.points.length >= 2) {
    const points = object.kind === 'arrow' ? object.points.slice(0, 2) : object.points;
    shape = (
      <polyline
        {...commonProps}
        points={toSvgPoints(points, SVG_WIDTH, SVG_HEIGHT)}
        fill="none"
        markerStart={object.arrowStart ? `url(#${styledArrowId})` : undefined}
        markerEnd={object.arrowEnd !== false ? `url(#${styledArrowId})` : undefined}
      />
    );
  } else {
    return null;
  }

  const displayLabel = [object.zoneCode, object.label].filter(Boolean).join(' · ');

  return (
    <g
      role="button"
      tabIndex={readOnly ? -1 : 0}
      aria-label={accessibleName}
      aria-pressed={selected}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      style={{ color: strokeColor }}
      data-object-id={object.id}
    >
      <title>{accessibleName}</title>
      <defs>
        <pattern id={styledPatternId} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill={fillColor} fillOpacity={config.fillOpacity} />
          <path
            d={hatch === 'cross'
              ? 'M-3 14 L14 -3 M4 17 L17 4 M-3 -3 L17 17'
              : 'M-3 14 L14 -3 M4 17 L17 4'}
            stroke={strokeColor}
            strokeWidth="1.8"
          />
        </pattern>
        <marker
          id={styledArrowId}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={strokeColor} />
        </marker>
      </defs>
      {shape}
      {displayLabel && object.kind !== 'text' && (
        <g className="construction-drawing-label" pointerEvents="none">
          <text
            x={labelPoint.x * SVG_WIDTH}
            y={labelPoint.y * SVG_HEIGHT}
            textAnchor="middle"
            dominantBaseline="central"
            stroke="white"
            strokeWidth="7"
            paintOrder="stroke"
          >
            {displayLabel}
          </text>
          <text
            x={labelPoint.x * SVG_WIDTH}
            y={labelPoint.y * SVG_HEIGHT}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111827"
          >
            {displayLabel}
          </text>
        </g>
      )}
    </g>
  );
};

interface DrawingPageThumbnailProps {
  pageIndex: number;
  selected: boolean;
  previewIdentity: string;
  sourceUrl?: string;
  resolveUrl?: (pageIndex: number) => Promise<string>;
  onSelect?: (pageIndex: number) => void;
}

const DrawingPageThumbnail: React.FC<DrawingPageThumbnailProps> = ({
  pageIndex,
  selected,
  previewIdentity,
  sourceUrl,
  resolveUrl,
  onSelect,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ownedUrlRef = useRef<string>();
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(sourceUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | undefined;
    const releaseOwnedUrl = () => {
      if (ownedUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(ownedUrlRef.current);
      ownedUrlRef.current = undefined;
    };
    releaseOwnedUrl();
    setFailed(false);
    if (sourceUrl) {
      setResolvedUrl(sourceUrl);
      return () => { active = false; };
    }
    setResolvedUrl(undefined);
    if (!resolveUrl) return () => { active = false; };

    const load = () => {
      void resolveUrl(pageIndex).then((url) => {
        if (!active) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        ownedUrlRef.current = url;
        setResolvedUrl(url);
      }).catch(() => {
        if (active) setFailed(true);
      });
    };

    if (typeof IntersectionObserver === 'function' && buttonRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        load();
      }, { rootMargin: '160px' });
      observer.observe(buttonRef.current);
    } else {
      load();
    }

    return () => {
      active = false;
      observer?.disconnect();
      releaseOwnedUrl();
    };
  }, [pageIndex, previewIdentity, resolveUrl, sourceUrl]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`construction-drawing-page-thumbnail${selected ? ' is-selected' : ''}`}
      aria-current={selected ? 'page' : undefined}
      aria-label={`${pageIndex + 1}페이지 미리보기 선택`}
      onClick={() => onSelect?.(pageIndex)}
      disabled={!onSelect}
    >
      <span className="construction-drawing-page-thumbnail__image">
        {resolvedUrl
          ? <img src={resolvedUrl} alt={`${pageIndex + 1}페이지 썸네일`} />
          : <span aria-hidden="true">{failed ? '!' : pageIndex + 1}</span>}
      </span>
      <strong>{pageIndex + 1}</strong>
    </button>
  );
};

export const DrawingStudio = ({
  value,
  defaultValue = EMPTY_VALUE,
  onChange,
  onBackgroundFileChange,
  onPreviewPageChange,
  resolvePreviewPageUrl,
  onRetryPreview,
  showFirstUsePractice = false,
  firstUsePracticeStorageKey = 'construction-plan:drawing-polygon-practice:v1',
  focusObjectId,
  focusRequestKey,
  readOnly = false,
  className = '',
  'aria-label': ariaLabel = '시공 도면 구간 편집기',
}: DrawingStudioProps) => {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<DrawingStudioValue>(() => cloneValue(parseDrawingStudioValue(defaultValue)));
  const editorValue = useMemo(
    () => parseDrawingStudioValue(value ?? internalValue),
    [internalValue, value],
  );
  const valueRef = useRef(editorValue);
  const [tool, setTool] = useState<DrawingTool>('select');
  const [layer, setLayer] = useState<DrawingLayerType>('install');
  const [hiddenLayers, setHiddenLayers] = useState<Set<DrawingLayerType>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<NormalizedPoint | null>(null);
  const [draftEnd, setDraftEnd] = useState<NormalizedPoint | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<NormalizedPoint[]>([]);
  const [pointerPoint, setPointerPoint] = useState<NormalizedPoint | null>(null);
  const [history, setHistory] = useState<DrawingStudioValue[]>([]);
  const [future, setFuture] = useState<DrawingStudioValue[]>([]);
  const historyRef = useRef<DrawingStudioValue[]>([]);
  const futureRef = useRef<DrawingStudioValue[]>([]);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showDwgGuide, setShowDwgGuide] = useState(false);
  const [showPolygonPractice, setShowPolygonPractice] = useState(() => (
    showFirstUsePractice
    && !hasCompletedConstructionPlanPolygonPractice(firstUsePracticeStorageKey)
  ));
  const [viewport, setViewport] = useState<DrawingViewport>({ zoom: 1, x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  const [panMode, setPanMode] = useState(false);
  const spacePressedRef = useRef(false);
  const interactionRef = useRef<GeometryInteraction | null>(null);
  const [geometryPreview, setGeometryPreview] = useState<GeometryPreview | null>(null);
  const geometryPreviewRef = useRef<GeometryPreview | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const previewPageUrlResolverRef = useRef(resolvePreviewPageUrl);

  useEffect(() => {
    previewPageUrlResolverRef.current = resolvePreviewPageUrl;
  }, [resolvePreviewPageUrl]);

  useEffect(() => {
    setShowPolygonPractice(
      showFirstUsePractice
      && !hasCompletedConstructionPlanPolygonPractice(firstUsePracticeStorageKey),
    );
  }, [firstUsePracticeStorageKey, showFirstUsePractice]);

  const resolveThumbnailUrl = useCallback((pageIndex: number): Promise<string> => {
    const resolver = previewPageUrlResolverRef.current;
    return resolver
      ? resolver(pageIndex)
      : Promise.reject(new Error('construction-plan-drawing-thumbnail-resolver-unavailable'));
  }, []);

  useEffect(() => {
    valueRef.current = editorValue;
  }, [editorValue]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (selectedId && !editorValue.objects.some((object) => object.id === selectedId)) {
      setSelectedId(null);
    }
  }, [editorValue.objects, selectedId]);

  useEffect(() => {
    if (!focusObjectId) return;
    const target = editorValue.objects.find((object) => object.id === focusObjectId);
    if (!target) return;
    setTool('select');
    setSelectedId(target.id);
    setHiddenLayers((current) => {
      if (!current.has(target.layer)) return current;
      const next = new Set(current);
      next.delete(target.layer);
      return next;
    });
    const bounds = boundsFromPoints(target.points);
    const zoom = 1.8;
    setViewport(clampViewport({
      zoom,
      x: (bounds.x + bounds.width / 2) * SVG_WIDTH - SVG_WIDTH / zoom / 2,
      y: (bounds.y + bounds.height / 2) * SVG_HEIGHT - SVG_HEIGHT / zoom / 2,
    }));
    document.getElementById(`construction-drawing-object-${target.id}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [editorValue.objects, focusObjectId, focusRequestKey]);

  const toggleLayerVisibility = useCallback((layerId: DrawingLayerType) => {
    setHiddenLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      if (localPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(localPreviewUrl);
    },
    [localPreviewUrl],
  );

  const commitValue = useCallback(
    (next: DrawingStudioValue, recordHistory = true) => {
      if (recordHistory) {
        const previous = cloneValue(valueRef.current);
        setHistory((items) => {
          const nextHistory = [...items.slice(-(MAX_HISTORY - 1)), previous];
          historyRef.current = nextHistory;
          return nextHistory;
        });
        futureRef.current = [];
        setFuture([]);
      }
      valueRef.current = next;
      if (!controlled) setInternalValue(next);
      onChange?.(cloneValue(next));
    },
    [controlled, onChange],
  );

  const pointFromEvent = useCallback((event: Pick<ReactPointerEvent<SVGElement>, 'clientX' | 'clientY'>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const bounds = svg.getBoundingClientRect();
    const localPoint = clientPointToNormalized(event.clientX, event.clientY, bounds);
    const currentViewport = viewportRef.current;
    return normalizePoint({
      x: (currentViewport.x + localPoint.x * (SVG_WIDTH / currentViewport.zoom)) / SVG_WIDTH,
      y: (currentViewport.y + localPoint.y * (SVG_HEIGHT / currentViewport.zoom)) / SVG_HEIGHT,
    });
  }, []);

  const addObject = useCallback(
    (kind: DrawingObjectKind, points: NormalizedPoint[]) => {
      const cleanPoints = points.map(normalizePoint);
      if (!isPracticalShape(kind, cleanPoints)) return;
      const nextObject: DrawingObject = {
        id: createObjectId(),
        kind,
        layer,
        points: cleanPoints,
        label: '',
        zoneCode: '',
        ...(['install', 'dismantle'].includes(layer)
          ? {
              sequence: Math.max(
                0,
                ...valueRef.current.objects
                  .filter((object) => object.layer === layer)
                  .map((object) => object.sequence ?? 0),
              ) + 1,
            }
          : {}),
        ...(kind === 'arrow' ? { arrowStart: false, arrowEnd: true } : {}),
        style: canonicalDrawingObjectStyle(layer),
      };
      commitValue({ ...valueRef.current, objects: [...valueRef.current.objects, nextObject] });
      setSelectedId(nextObject.id);
      setTool('select');
    },
    [commitValue, layer],
  );

  const finishPolygon = useCallback(() => {
    if (isPracticalShape('polygon', polygonPoints)) addObject('polygon', polygonPoints);
    setPolygonPoints([]);
    setPointerPoint(null);
  }, [addObject, polygonPoints]);

  const cancelDraft = useCallback(() => {
    setDragStart(null);
    setDraftEnd(null);
    setPolygonPoints([]);
    setPointerPoint(null);
  }, []);

  const deleteObject = useCallback(
    (id: string) => {
      if (readOnly) return;
      if (valueRef.current.objects.find((object) => object.id === id)?.locked) return;
      const objects = valueRef.current.objects.filter((object) => object.id !== id);
      if (objects.length === valueRef.current.objects.length) return;
      commitValue({ ...valueRef.current, objects });
      if (selectedId === id) setSelectedId(null);
    },
    [commitValue, readOnly, selectedId],
  );

  const undo = useCallback(() => {
    if (readOnly || historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    const nextFuture = [...futureRef.current.slice(-(MAX_HISTORY - 1)), cloneValue(valueRef.current)];
    futureRef.current = nextFuture;
    setFuture(nextFuture);
    const nextHistory = historyRef.current.slice(0, -1);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    commitValue(cloneValue(previous), false);
    cancelDraft();
  }, [cancelDraft, commitValue, readOnly]);

  const redo = useCallback(() => {
    if (readOnly || futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    const nextFuture = futureRef.current.slice(0, -1);
    futureRef.current = nextFuture;
    setFuture(nextFuture);
    const nextHistory = [...historyRef.current.slice(-(MAX_HISTORY - 1)), cloneValue(valueRef.current)];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    commitValue(cloneValue(next), false);
    cancelDraft();
  }, [cancelDraft, commitValue, readOnly]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId || readOnly) return;
    const selectedIndex = valueRef.current.objects.findIndex((object) => object.id === selectedId);
    const selected = valueRef.current.objects[selectedIndex];
    if (!selected) return;
    const duplicate: DrawingObject = {
      ...selected,
      id: createObjectId(),
      label: selected.label ? `${selected.label} 복사` : '',
      locked: false,
      points: selected.points.map((point) => normalizePoint({ x: point.x + 0.015, y: point.y + 0.015 })),
      ...(selected.style ? { style: { ...selected.style } } : {}),
    };
    const objects = [...valueRef.current.objects];
    objects.splice(selectedIndex + 1, 0, duplicate);
    commitValue({ ...valueRef.current, objects });
    setSelectedId(duplicate.id);
  }, [commitValue, readOnly, selectedId]);

  const moveSelected = useCallback((direction: 'front' | 'back') => {
    if (!selectedId || readOnly) return;
    const objects = [...valueRef.current.objects];
    const index = objects.findIndex((object) => object.id === selectedId);
    if (index < 0) return;
    const target = direction === 'front' ? Math.min(objects.length - 1, index + 1) : Math.max(0, index - 1);
    if (target === index) return;
    const [selected] = objects.splice(index, 1);
    objects.splice(target, 0, selected);
    commitValue({ ...valueRef.current, objects });
  }, [commitValue, readOnly, selectedId]);

  const updateSelected = useCallback(
    (patch: Partial<Pick<DrawingObject,
      | 'label' | 'zoneCode' | 'sequence' | 'startDate' | 'endDate' | 'reason'
      | 'releaseCondition' | 'equipmentType' | 'equipmentId' | 'entrance' | 'destination'
      | 'radius' | 'responsibleWorkerId' | 'responsibleRole' | 'materialType'
      | 'layer' | 'style' | 'locked' | 'markerType' | 'textAlign'>>) => {
      if (!selectedId || readOnly) return;
      const objects = valueRef.current.objects.map((object) =>
        object.id === selectedId && (!object.locked || Object.prototype.hasOwnProperty.call(patch, 'locked'))
          ? {
              ...object,
              ...patch,
              ...(patch.layer
                ? {
                    style: canonicalDrawingObjectStyle(patch.layer),
                  }
                : {}),
            }
          : object,
      );
      commitValue({ ...valueRef.current, objects });
    },
    [commitValue, readOnly, selectedId],
  );

  const selectedObject = useMemo(
    () => editorValue.objects.find((object) => object.id === selectedId) ?? null,
    [editorValue.objects, selectedId],
  );

  const updateGeometryPreview = useCallback((preview: GeometryPreview | null) => {
    geometryPreviewRef.current = preview;
    setGeometryPreview(preview);
  }, []);

  const cancelGeometryInteraction = useCallback(() => {
    interactionRef.current = null;
    updateGeometryPreview(null);
  }, [updateGeometryPreview]);

  const beginPan = useCallback((event: ReactPointerEvent<SVGElement>) => {
    cancelDraft();
    interactionRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalViewport: { ...viewportRef.current },
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  }, [cancelDraft]);

  const handleObjectPointerDown = useCallback((event: ReactPointerEvent<SVGGElement>, object: DrawingObject) => {
    if (panMode || spacePressedRef.current || event.button === 1) {
      beginPan(event);
      return;
    }
    if (readOnly || tool !== 'select') return;
    setSelectedId(object.id);
    if (object.locked) return;
    const originalPoints = object.points.map((point) => ({ ...point }));
    interactionRef.current = {
      kind: 'move',
      pointerId: event.pointerId,
      objectId: object.id,
      start: pointFromEvent(event),
      originalPoints,
    };
    updateGeometryPreview({ objectId: object.id, points: originalPoints });
    svgRef.current?.setPointerCapture?.(event.pointerId);
  }, [beginPan, panMode, pointFromEvent, readOnly, tool, updateGeometryPreview]);

  const beginResize = useCallback((
    event: ReactPointerEvent<SVGCircleElement>,
    object: DrawingObject,
    handle: DrawingResizeHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly || object.locked || tool !== 'select') return;
    const originalPoints = object.points.map((point) => ({ ...point }));
    interactionRef.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      objectId: object.id,
      handle,
      originalPoints,
    };
    updateGeometryPreview({ objectId: object.id, points: originalPoints });
    svgRef.current?.setPointerCapture?.(event.pointerId);
  }, [readOnly, tool, updateGeometryPreview]);

  const finalizeGeometryInteraction = useCallback((pointerId?: number) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    if (interaction.kind !== 'pan') {
      const preview = geometryPreviewRef.current;
      const currentObject = valueRef.current.objects.find((object) => object.id === interaction.objectId);
      if (preview && currentObject && !currentObject.locked && !pointsAreEqual(currentObject.points, preview.points)) {
        const objects = valueRef.current.objects.map((object) => object.id === interaction.objectId
          ? { ...object, points: preview.points.map((point) => ({ ...point })) }
          : object);
        commitValue({ ...valueRef.current, objects });
      }
    }
    interactionRef.current = null;
    updateGeometryPreview(null);
    if (pointerId !== undefined) {
      try {
        svgRef.current?.releasePointerCapture?.(pointerId);
      } catch {
        // The browser may already have released capture on pointercancel/leave.
      }
    }
  }, [commitValue, updateGeometryPreview]);

  const changeZoom = useCallback((delta: number) => {
    setViewport((current) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current.zoom + delta).toFixed(2))));
      if (nextZoom === current.zoom) return current;
      const centerX = current.x + SVG_WIDTH / current.zoom / 2;
      const centerY = current.y + SVG_HEIGHT / current.zoom / 2;
      return clampViewport({
        zoom: nextZoom,
        x: centerX - SVG_WIDTH / nextZoom / 2,
        y: centerY - SVG_HEIGHT / nextZoom / 2,
      });
    });
  }, []);

  const resetViewport = useCallback(() => {
    setViewport({ zoom: 1, x: 0, y: 0 });
    setPanMode(false);
  }, []);

  const nudgeSelected = useCallback((delta: NormalizedPoint) => {
    if (!selectedId || readOnly) return;
    const currentObject = valueRef.current.objects.find((object) => object.id === selectedId);
    if (!currentObject || currentObject.locked) return;
    const points = translatePointsWithinPage(currentObject.points, delta);
    if (pointsAreEqual(points, currentObject.points)) return;
    const objects = valueRef.current.objects.map((object) => object.id === selectedId
      ? { ...object, points }
      : object);
    commitValue({ ...valueRef.current, objects });
  }, [commitValue, readOnly, selectedId]);

  const resizeSelectedWithKeyboard = useCallback((
    object: DrawingObject,
    handle: DrawingResizeHandle,
    key: string,
    preserveAspectRatio: boolean,
  ) => {
    if (readOnly || object.locked) return;
    const bounds = boundsFromPoints(object.points);
    const handlePoint = {
      x: handle === 'north-east' || handle === 'south-east' ? bounds.x + bounds.width : bounds.x,
      y: handle === 'south-east' || handle === 'south-west' ? bounds.y + bounds.height : bounds.y,
    };
    const step = 0.01;
    const target = normalizePoint({
      x: handlePoint.x + (key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0),
      y: handlePoint.y + (key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0),
    });
    const points = resizePointsWithinPage(object.points, handle, target, preserveAspectRatio);
    if (pointsAreEqual(points, object.points)) return;
    const objects = valueRef.current.objects.map((item) => item.id === object.id ? { ...item, points } : item);
    commitValue({ ...valueRef.current, objects });
  }, [commitValue, readOnly]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panMode || spacePressedRef.current || event.button === 1) {
      beginPan(event);
      return;
    }
    if (readOnly) return;
    const point = pointFromEvent(event);

    if (tool === 'select') {
      setSelectedId(null);
      return;
    }

    if (tool === 'polygon') {
      const constrainedPoint = event.shiftKey && polygonPoints.length > 0
        ? (() => {
            const previous = polygonPoints[polygonPoints.length - 1];
            return Math.abs(point.x - previous.x) >= Math.abs(point.y - previous.y)
              ? normalizePoint({ x: point.x, y: previous.y })
              : normalizePoint({ x: previous.x, y: point.y });
          })()
        : point;
      setPolygonPoints((points) => [...points, constrainedPoint]);
      setPointerPoint(constrainedPoint);
      return;
    }

    if (tool === 'marker') {
      addObject('marker', [point]);
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragStart(point);
    setDraftEnd(point);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    if (interaction?.kind === 'pan') {
      const bounds = svgRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      const viewWidth = SVG_WIDTH / interaction.originalViewport.zoom;
      const viewHeight = SVG_HEIGHT / interaction.originalViewport.zoom;
      setViewport(clampViewport({
        ...interaction.originalViewport,
        x: interaction.originalViewport.x - ((event.clientX - interaction.startClientX) / bounds.width) * viewWidth,
        y: interaction.originalViewport.y - ((event.clientY - interaction.startClientY) / bounds.height) * viewHeight,
      }));
      return;
    }
    if (interaction?.kind === 'move') {
      const point = pointFromEvent(event);
      updateGeometryPreview({
        objectId: interaction.objectId,
        points: translatePointsWithinPage(interaction.originalPoints, {
          x: point.x - interaction.start.x,
          y: point.y - interaction.start.y,
        }, event.shiftKey),
      });
      return;
    }
    if (interaction?.kind === 'resize') {
      updateGeometryPreview({
        objectId: interaction.objectId,
        points: resizePointsWithinPage(interaction.originalPoints, interaction.handle, pointFromEvent(event), event.shiftKey),
      });
      return;
    }
    if (readOnly) return;
    const point = pointFromEvent(event);
    if (tool === 'polygon') {
      const previous = polygonPoints[polygonPoints.length - 1];
      setPointerPoint(event.shiftKey && previous
        ? Math.abs(point.x - previous.x) >= Math.abs(point.y - previous.y)
          ? normalizePoint({ x: point.x, y: previous.y })
          : normalizePoint({ x: previous.x, y: point.y })
        : point);
    }
    if (dragStart) {
      setDraftEnd(constrainDraftPoint(dragStart, point, tool as DrawingObjectKind, event.shiftKey, SVG_WIDTH / SVG_HEIGHT));
    }
  };

  const handleCanvasPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (interactionRef.current) {
      finalizeGeometryInteraction(event.pointerId);
      return;
    }
    if (readOnly || !dragStart || !['rectangle', 'arrow', 'ellipse', 'text'].includes(tool)) return;
    const end = constrainDraftPoint(
      dragStart,
      pointFromEvent(event),
      tool as DrawingObjectKind,
      event.shiftKey,
      SVG_WIDTH / SVG_HEIGHT,
    );
    addObject(tool as DrawingObjectKind, [dragStart, end]);
    setDragStart(null);
    setDraftEnd(null);
  };

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const editingText = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    if (event.key === 'Escape') {
      cancelGeometryInteraction();
      cancelDraft();
      setSelectedId(null);
      return;
    }
    if (event.key === ' ' && !editingText) {
      event.preventDefault();
      spacePressedRef.current = true;
      return;
    }
    if (selectedId && !editingText && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 0.05 : 0.01;
      if (event.key === 'ArrowLeft') nudgeSelected({ x: -step, y: 0 });
      if (event.key === 'ArrowRight') nudgeSelected({ x: step, y: 0 });
      if (event.key === 'ArrowUp') nudgeSelected({ x: 0, y: -step });
      if (event.key === 'ArrowDown') nudgeSelected({ x: 0, y: step });
      return;
    }
    if (event.key === 'Enter' && tool === 'polygon' && !editingText) {
      event.preventDefault();
      finishPolygon();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !editingText) {
      event.preventDefault();
      deleteObject(selectedId);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editingText) {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && !editingText) {
      event.preventDefault();
      redo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && !editingText) {
      event.preventDefault();
      duplicateSelected();
    }
  };

  const handleEditorKeyUp = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === ' ') spacePressedRef.current = false;
  };

  const handleBackgroundChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (/\.dwg$/i.test(file.name)) {
      setFileError(null);
      setShowDwgGuide(true);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = ['image/png', 'image/jpeg'].includes(file.type) || /\.(png|jpe?g)$/i.test(file.name);
    if (!isPdf && !isImage) {
      setFileError('PDF, PNG, JPG 파일만 업로드할 수 있습니다.');
      return;
    }

    setFileError(null);
    const metadata: DrawingBackground = {
      fileName: file.name,
      mimeType: isPdf ? 'application/pdf' : file.type,
      sizeBytes: file.size,
      kind: isPdf ? 'pdf' : 'image',
    };
    if (localPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(isImage ? URL.createObjectURL(file) : null);
    commitValue({ ...valueRef.current, background: metadata, preview: undefined });
    onBackgroundFileChange?.(file, metadata);
  };

  const removeBackground = () => {
    if (readOnly || !editorValue.background) return;
    if (localPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    commitValue({ ...valueRef.current, background: undefined, preview: undefined });
  };

  const backgroundPreviewUrl = localPreviewUrl
    ?? (editorValue.preview?.status === 'ready' ? editorValue.preview.sourceUrl : undefined)
    ?? (editorValue.background?.kind === 'image' ? editorValue.background.sourceUrl : undefined);
  const readyPreview = editorValue.preview?.status === 'ready' ? editorValue.preview : undefined;

  const draftKind: DrawingObjectKind | null = tool === 'rectangle' || tool === 'arrow' || tool === 'ellipse' || tool === 'text'
    ? tool
    : null;
  const draftObject: DrawingObject | null = dragStart && draftEnd && draftKind
    ? { id: 'draft', kind: draftKind, layer, points: [dragStart, draftEnd], label: '', zoneCode: '' }
    : null;
  const polygonPreview: DrawingObject | null = polygonPoints.length > 0
    ? {
        id: 'polygon-draft',
        kind: 'polygon',
        layer,
        points: pointerPoint ? [...polygonPoints, pointerPoint] : polygonPoints,
        label: '',
        zoneCode: '',
      }
    : null;
  const renderedObjects = editorValue.objects.map((object) => geometryPreview?.objectId === object.id
    ? { ...object, points: geometryPreview.points }
    : object);
  const renderedSelectedObject = renderedObjects.find((object) => object.id === selectedId) ?? null;
  const selectionBounds = renderedSelectedObject ? boundsFromPoints(renderedSelectedObject.points) : null;
  const resizeHandles: Array<{ handle: DrawingResizeHandle; point: NormalizedPoint }> = selectionBounds
    ? [
        { handle: 'north-west', point: { x: selectionBounds.x, y: selectionBounds.y } },
        { handle: 'north-east', point: { x: selectionBounds.x + selectionBounds.width, y: selectionBounds.y } },
        { handle: 'south-east', point: { x: selectionBounds.x + selectionBounds.width, y: selectionBounds.y + selectionBounds.height } },
        { handle: 'south-west', point: { x: selectionBounds.x, y: selectionBounds.y + selectionBounds.height } },
      ]
    : [];
  const viewportWidth = SVG_WIDTH / viewport.zoom;
  const viewportHeight = SVG_HEIGHT / viewport.zoom;

  const setActiveTool = (nextTool: DrawingTool) => {
    cancelDraft();
    setTool(nextTool);
    if (nextTool !== 'select') setSelectedId(null);
  };

  if (showPolygonPractice && !readOnly) {
    return (
      <section
        className={`construction-drawing-studio construction-drawing-studio--practice ${className}`.trim()}
        aria-label="도면 첫 사용 연습"
      >
        <ConstructionPlanPolygonPractice
          storageKey={firstUsePracticeStorageKey}
          onComplete={() => setShowPolygonPractice(false)}
          onSkip={() => setShowPolygonPractice(false)}
        />
      </section>
    );
  }

  return (
    <section
      className={`construction-drawing-studio ${className}`.trim()}
      aria-label={ariaLabel}
      onKeyDown={handleEditorKeyDown}
      onKeyUp={handleEditorKeyUp}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) spacePressedRef.current = false;
      }}
    >
      <header className="construction-drawing-header">
        <div>
          <p className="construction-drawing-eyebrow">도면 레이어 편집</p>
          <h2>설치·해체 구간 표시</h2>
          <p>도면 위에 작업 구간과 동선을 표시합니다. 표시는 PDF 크기와 무관한 상대 좌표로 저장됩니다.</p>
        </div>
        {!readOnly && (
          <div className="construction-drawing-file-actions">
            <input
              ref={uploadRef}
              className="construction-drawing-visually-hidden"
              type="file"
              accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg,.dwg"
              onChange={handleBackgroundChange}
              aria-label="도면 파일 선택"
            />
            <button type="button" className="construction-drawing-primary-button" onClick={() => uploadRef.current?.click()}>
              도면 업로드
            </button>
            <button type="button" className="construction-drawing-secondary-button" onClick={() => setShowDwgGuide(true)}>
              DWG 변환 안내
            </button>
            {editorValue.background && (
              <button type="button" className="construction-drawing-secondary-button" onClick={removeBackground}>
                도면 제거
              </button>
            )}
          </div>
        )}
      </header>

      {fileError && <div className="construction-drawing-alert" role="alert">{fileError}</div>}
      {showDwgGuide && <ConstructionPlanDwgConversionGuide onClose={() => setShowDwgGuide(false)} />}

      {editorValue.background && (
        <div className="construction-drawing-file-info" aria-label="업로드한 도면 정보">
          <span className="construction-drawing-file-badge">{editorValue.background.kind === 'pdf' ? 'PDF' : 'IMAGE'}</span>
          <strong>{editorValue.background.fileName}</strong>
          <span>{humanFileSize(editorValue.background.sizeBytes)}</span>
          {editorValue.background.kind === 'pdf' && (
            <span className="construction-drawing-pdf-notice">
              {editorValue.preview?.status === 'ready'
                ? `PDF 원본을 보존한 자동 미리보기 · ${editorValue.preview.pageIndex + 1}/${editorValue.preview.pageCount}페이지`
                : editorValue.preview?.status === 'failed'
                  ? `PDF 자동 미리보기 실패 · ${editorValue.preview.errorMessage || editorValue.preview.errorCode || '재시도가 필요합니다.'}`
                  : editorValue.preview?.status === 'processing'
                    ? 'PDF 원본을 보존한 채 페이지 미리보기를 생성하고 있습니다.'
                    : 'PDF 원본 업로드가 완료되면 서버에서 페이지 미리보기를 자동 생성합니다. 준비 전에는 검토 요청이 차단됩니다.'}
            </span>
          )}
          {editorValue.preview?.status === 'ready'
            && editorValue.preview.availablePageIndexes.length > 1
            && (
              <label className="construction-drawing-page-picker">
                미리보기 페이지
                <select
                  value={editorValue.preview.pageIndex}
                  onChange={(event) => onPreviewPageChange?.(Number(event.target.value))}
                  disabled={!onPreviewPageChange}
                >
                  {editorValue.preview.availablePageIndexes.map((pageIndex) => (
                    <option key={pageIndex} value={pageIndex}>{pageIndex + 1}페이지</option>
                  ))}
                </select>
              </label>
            )}
          {editorValue.background.kind === 'pdf'
            && editorValue.preview?.status === 'failed'
            && !readOnly
            && onRetryPreview
            && (
              <button type="button" className="construction-drawing-secondary-button" onClick={onRetryPreview}>
                미리보기 다시 생성
              </button>
            )}
        </div>
      )}

      {readyPreview
        && readyPreview.availablePageIndexes.length > 1
        && (
          <nav className="construction-drawing-page-thumbnails" aria-label="PDF 페이지 썸네일">
            {readyPreview.availablePageIndexes.map((pageIndex) => {
              const previewIdentity = `${editorValue.background?.storagePath || editorValue.background?.fileName || 'drawing'}:${editorValue.background?.sizeBytes || 0}:${readyPreview.pageCount}`;
              return (
                <DrawingPageThumbnail
                  key={`${previewIdentity}:${pageIndex}`}
                  pageIndex={pageIndex}
                  selected={pageIndex === readyPreview.pageIndex}
                  previewIdentity={previewIdentity}
                  sourceUrl={pageIndex === readyPreview.pageIndex ? backgroundPreviewUrl : undefined}
                  resolveUrl={resolvePreviewPageUrl ? resolveThumbnailUrl : undefined}
                  onSelect={onPreviewPageChange}
                />
              );
            })}
          </nav>
        )}

      {!readOnly && (
        <div className="construction-drawing-toolbar" role="toolbar" aria-label="도면 표시 도구">
          <div className="construction-drawing-tool-group" aria-label="그리기 도구">
            {TOOL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={tool === option.value ? 'is-active' : ''}
                aria-pressed={tool === option.value}
                onClick={() => setActiveTool(option.value)}
                title={`${option.label} 도구`}
              >
                <span aria-hidden="true">{option.symbol}</span>
                {option.label}
              </button>
            ))}
          </div>
          <label className="construction-drawing-layer-picker">
            표시 레이어
            <select
              value={layer}
              onChange={(event) => {
                const nextLayer = event.target.value as DrawingLayerType;
                setLayer(nextLayer);
                if (tool !== 'select') setActiveTool(DRAWING_LAYER_CONTRACT[nextLayer].preferredTool);
              }}
            >
              {DRAWING_LAYER_ORDER.map((layerId) => (
                <option key={layerId} value={layerId}>{DRAWING_LAYERS[layerId].label}</option>
              ))}
            </select>
          </label>
          {tool === 'polygon' && polygonPoints.length > 0 && (
            <div className="construction-drawing-polygon-actions">
              <span>{polygonPoints.length}개 꼭짓점</span>
              <button type="button" disabled={polygonPoints.length < 3} onClick={finishPolygon}>다각형 완료</button>
              <button type="button" onClick={cancelDraft}>취소</button>
            </div>
          )}
          <div className="construction-drawing-history-actions">
            <button type="button" onClick={undo} disabled={history.length === 0} aria-label="마지막 변경 실행 취소">
              ↶ 실행 취소
            </button>
            <button type="button" onClick={redo} disabled={future.length === 0} aria-label="취소한 변경 다시 실행">
              ↷ 다시 실행
            </button>
            <button type="button" onClick={duplicateSelected} disabled={!selectedId} aria-label="선택한 표시 복제">
              복제
            </button>
            <button
              type="button"
              onClick={() => selectedId && deleteObject(selectedId)}
              disabled={!selectedId}
              aria-label="선택한 표시 삭제"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      <div className="construction-drawing-workspace">
        <div className="construction-drawing-canvas-shell">
          <div className="construction-drawing-canvas-status">
            <span>{tool === 'select' ? '표시를 선택해 정보를 편집하세요.' : `${TOOL_OPTIONS.find((item) => item.value === tool)?.label} 도구 · ${DRAWING_LAYERS[layer].label}`}</span>
            <div className="construction-drawing-viewport-actions" role="group" aria-label="도면 확대 및 이동">
              <button
                type="button"
                onClick={() => changeZoom(-ZOOM_STEP)}
                disabled={viewport.zoom <= MIN_ZOOM}
                aria-label="도면 축소"
              >−</button>
              <output aria-label="도면 확대 비율">{Math.round(viewport.zoom * 100)}%</output>
              <button
                type="button"
                onClick={() => changeZoom(ZOOM_STEP)}
                disabled={viewport.zoom >= MAX_ZOOM}
                aria-label="도면 확대"
              >+</button>
              <button
                type="button"
                onClick={resetViewport}
                disabled={viewport.zoom === 1 && viewport.x === 0 && viewport.y === 0}
                aria-label="도면 확대 및 위치 초기화"
              >초기화</button>
              <button
                type="button"
                className={panMode ? 'is-active' : ''}
                aria-pressed={panMode}
                aria-label="도면 이동 모드"
                onClick={() => {
                  cancelDraft();
                  setPanMode((current) => !current);
                }}
              >손 이동</button>
              <strong>{editorValue.objects.length}개 표시</strong>
            </div>
          </div>
          <svg
            ref={svgRef}
            className={`construction-drawing-canvas tool-${tool}${panMode ? ' is-pan-mode' : ''}${interactionRef.current?.kind === 'pan' ? ' is-panning' : ''}`}
            viewBox={`${viewport.x} ${viewport.y} ${viewportWidth} ${viewportHeight}`}
            preserveAspectRatio="none"
            role="img"
            tabIndex={0}
            aria-label="시공 도면 표시 캔버스"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={(event) => finalizeGeometryInteraction(event.pointerId)}
            onPointerLeave={(event) => {
              if (dragStart) handleCanvasPointerUp(event);
            }}
          >
            <PatternDefinitions />
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#f8fafc" />
            {backgroundPreviewUrl ? (
              <image
                href={backgroundPreviewUrl}
                x="0"
                y="0"
                width={SVG_WIDTH}
                height={SVG_HEIGHT}
                preserveAspectRatio="xMidYMid meet"
                aria-label="업로드한 도면 미리보기"
              />
            ) : (
              <g className="construction-drawing-empty-canvas" pointerEvents="none">
                <rect x="170" y="210" width="660" height="280" rx="24" fill="white" stroke="#cbd5e1" strokeDasharray="12 10" />
                <text x="500" y="320" textAnchor="middle">{editorValue.background?.kind === 'pdf' ? 'PDF 미리보기 준비 중' : '도면 미리보기 영역'}</text>
                <text x="500" y="370" textAnchor="middle" className="construction-drawing-empty-help">
                  {editorValue.background?.kind === 'pdf'
                    ? editorValue.preview?.status === 'failed'
                      ? '미리보기 생성에 실패했습니다. 오류를 확인한 뒤 다시 시도하세요.'
                      : '원본은 변경하지 않으며 생성된 페이지와 주석 좌표가 함께 고정됩니다.'
                    : '검토·주석용으로 PNG 또는 JPG 도면 업로드를 권장합니다.'}
                </text>
              </g>
            )}
            {renderedObjects.filter((object) => !hiddenLayers.has(object.layer)).map((object) => (
              <DrawingShape
                key={object.id}
                object={object}
                selected={selectedId === object.id}
                readOnly={readOnly}
                onSelect={() => !readOnly && setSelectedId(object.id)}
                onPointerDown={(event) => handleObjectPointerDown(event, object)}
              />
            ))}
            {renderedSelectedObject && selectionBounds && !hiddenLayers.has(renderedSelectedObject.layer) && (
              <g className="construction-drawing-selection" aria-label="선택한 표시 크기 및 위치">
                <rect
                  x={selectionBounds.x * SVG_WIDTH}
                  y={selectionBounds.y * SVG_HEIGHT}
                  width={selectionBounds.width * SVG_WIDTH}
                  height={selectionBounds.height * SVG_HEIGHT}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={2 / viewport.zoom}
                  strokeDasharray={`${7 / viewport.zoom} ${5 / viewport.zoom}`}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                {!readOnly
                  && !renderedSelectedObject.locked
                  && ['rectangle', 'ellipse', 'text'].includes(renderedSelectedObject.kind)
                  && resizeHandles.map(({ handle, point }) => (
                    <circle
                      key={handle}
                      className="construction-drawing-resize-handle"
                      cx={point.x * SVG_WIDTH}
                      cy={point.y * SVG_HEIGHT}
                      r={9 / viewport.zoom}
                      fill="white"
                      stroke="#0f172a"
                      strokeWidth={2 / viewport.zoom}
                      role="button"
                      tabIndex={0}
                      aria-label={`선택한 표시 ${RESIZE_HANDLE_LABELS[handle]} 크기 조절`}
                      onPointerDown={(event) => beginResize(event, renderedSelectedObject, handle)}
                      onKeyDown={(event) => {
                        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        resizeSelectedWithKeyboard(renderedSelectedObject, handle, event.key, event.shiftKey);
                      }}
                    />
                  ))}
              </g>
            )}
            {draftObject && <DrawingShape object={draftObject} selected={false} readOnly onSelect={() => undefined} onPointerDown={() => undefined} />}
            {polygonPreview && polygonPreview.points.length >= 2 && (
              <polyline
                points={toSvgPoints(polygonPreview.points, SVG_WIDTH, SVG_HEIGHT)}
                fill="none"
                stroke={DRAWING_LAYERS[layer].color}
                strokeWidth="4"
                strokeDasharray="8 6"
                pointerEvents="none"
              />
            )}
            {polygonPoints.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x * SVG_WIDTH}
                cy={point.y * SVG_HEIGHT}
                r="7"
                fill="white"
                stroke={DRAWING_LAYERS[layer].color}
                strokeWidth="4"
                pointerEvents="none"
              />
            ))}
          </svg>
          <p className="construction-drawing-canvas-hint">
            선택한 표시는 끌어서 이동하고 모서리 손잡이로 크기를 조절합니다. <kbd>Shift</kbd>를 누르면 축·비율을 고정하며, <kbd>Space</kbd>+끌기로 확대된 도면을 이동합니다. <kbd>Esc</kbd> 취소 · <kbd>Delete</kbd> 삭제 · <kbd>Ctrl</kbd>+<kbd>Z</kbd> 실행 취소 · <kbd>Ctrl</kbd>+<kbd>Y</kbd> 다시 실행
          </p>
        </div>

        <aside className="construction-drawing-sidebar" aria-label="도면 표시 관리">
          {selectedObject && !readOnly ? (
            <section className="construction-drawing-inspector" aria-labelledby="drawing-inspector-title">
              <div className="construction-drawing-section-heading">
                <div>
                  <span>선택한 표시</span>
                  <h3 id="drawing-inspector-title">{KIND_LABELS[selectedObject.kind]} 정보</h3>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="선택 해제">×</button>
              </div>
              <label>
                구역 코드
                <input
                  value={selectedObject.zoneCode}
                  maxLength={30}
                  placeholder="예: A-01"
                  onChange={(event) => updateSelected({ zoneCode: event.target.value })}
                  disabled={selectedObject.locked}
                />
              </label>
              <label>
                표시 이름
                <input
                  value={selectedObject.label}
                  maxLength={80}
                  placeholder="예: 1차 설치 구간"
                  onChange={(event) => updateSelected({ label: event.target.value })}
                  disabled={selectedObject.locked}
                />
              </label>
              <label>
                레이어
                <select
                  value={selectedObject.layer}
                  onChange={(event) => updateSelected({ layer: event.target.value as DrawingLayerType })}
                  disabled={selectedObject.locked}
                >
                  {DRAWING_LAYER_ORDER.map((layerId) => (
                    <option key={layerId} value={layerId}>{DRAWING_LAYERS[layerId].label}</option>
                  ))}
                </select>
              </label>
              {(selectedObject.layer === 'install' || selectedObject.layer === 'dismantle') && (
                <label>
                  작업 순서
                  <input
                    aria-label="작업 순서"
                    type="number"
                    min="1"
                    step="1"
                    value={selectedObject.sequence ?? ''}
                    onChange={(event) => updateSelected({
                      sequence: event.target.value ? Number(event.target.value) : undefined,
                    })}
                    disabled={selectedObject.locked}
                  />
                </label>
              )}
              {selectedObject.layer === 'dismantle' && (
                <label>
                  해체 예정일
                  <input
                    aria-label="해체 예정일"
                    type="date"
                    value={selectedObject.startDate ?? ''}
                    onChange={(event) => updateSelected({ startDate: event.target.value })}
                    disabled={selectedObject.locked}
                  />
                </label>
              )}
              {selectedObject.layer === 'retain' && (
                <>
                  <label>
                    존치 사유
                    <textarea
                      aria-label="존치 사유"
                      value={selectedObject.reason ?? ''}
                      maxLength={500}
                      onChange={(event) => updateSelected({ reason: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                  <label>
                    해제조건
                    <textarea
                      aria-label="해제조건"
                      value={selectedObject.releaseCondition ?? ''}
                      maxLength={500}
                      onChange={(event) => updateSelected({ releaseCondition: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                </>
              )}
              {selectedObject.layer === 'equipment' && (
                <div className="construction-drawing-inspector-grid">
                  <label>
                    장비종류
                    <input
                      aria-label="장비종류"
                      value={selectedObject.equipmentType ?? ''}
                      maxLength={120}
                      onChange={(event) => updateSelected({ equipmentType: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                  <label>
                    장비 식별자
                    <input
                      aria-label="장비 식별자"
                      value={selectedObject.equipmentId ?? ''}
                      maxLength={160}
                      onChange={(event) => updateSelected({ equipmentId: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                </div>
              )}
              {selectedObject.layer === 'pedestrian' && (
                <div className="construction-drawing-inspector-grid">
                  <label>
                    출입구
                    <input
                      aria-label="출입구"
                      value={selectedObject.entrance ?? ''}
                      maxLength={160}
                      onChange={(event) => updateSelected({ entrance: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                  <label>
                    도착지
                    <input
                      aria-label="도착지"
                      value={selectedObject.destination ?? ''}
                      maxLength={160}
                      onChange={(event) => updateSelected({ destination: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                </div>
              )}
              {selectedObject.layer === 'lifting' && (
                <div className="construction-drawing-inspector-grid">
                  <label>
                    양중장비 식별자
                    <input
                      aria-label="양중장비 식별자"
                      value={selectedObject.equipmentId ?? ''}
                      maxLength={160}
                      onChange={(event) => updateSelected({ equipmentId: event.target.value })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                  <label>
                    양중반경(m)
                    <input
                      aria-label="양중반경"
                      type="number"
                      min="0.1"
                      max="10000"
                      step="0.1"
                      value={selectedObject.radius ?? ''}
                      onChange={(event) => updateSelected({
                        radius: event.target.value ? Number(event.target.value) : undefined,
                      })}
                      disabled={selectedObject.locked}
                    />
                  </label>
                </div>
              )}
              {selectedObject.layer === 'restricted' && (
                <>
                  <div className="construction-drawing-inspector-grid">
                    <label>
                      통제 시작
                      <input
                        aria-label="통제 시작"
                        value={selectedObject.startDate ?? ''}
                        maxLength={40}
                        placeholder="예: 08:00"
                        onChange={(event) => updateSelected({ startDate: event.target.value })}
                        disabled={selectedObject.locked}
                      />
                    </label>
                    <label>
                      통제 종료
                      <input
                        aria-label="통제 종료"
                        value={selectedObject.endDate ?? ''}
                        maxLength={40}
                        placeholder="예: 18:00"
                        onChange={(event) => updateSelected({ endDate: event.target.value })}
                        disabled={selectedObject.locked}
                      />
                    </label>
                  </div>
                  <div className="construction-drawing-inspector-grid">
                    <label>
                      담당 작업자 ID
                      <input
                        aria-label="담당 작업자 ID"
                        value={selectedObject.responsibleWorkerId ?? ''}
                        maxLength={160}
                        onChange={(event) => updateSelected({ responsibleWorkerId: event.target.value })}
                        disabled={selectedObject.locked}
                      />
                    </label>
                    <label>
                      담당 역할
                      <input
                        aria-label="담당 역할"
                        value={selectedObject.responsibleRole ?? ''}
                        maxLength={160}
                        onChange={(event) => updateSelected({ responsibleRole: event.target.value })}
                        disabled={selectedObject.locked}
                      />
                    </label>
                  </div>
                </>
              )}
              {selectedObject.layer === 'storage' && (
                <label>
                  자재종류
                  <input
                    aria-label="자재종류"
                    value={selectedObject.materialType ?? ''}
                    maxLength={160}
                    onChange={(event) => updateSelected({ materialType: event.target.value })}
                    disabled={selectedObject.locked}
                  />
                </label>
              )}
              {selectedObject.kind === 'text' && (
                <label>
                  텍스트 정렬
                  <select
                    value={selectedObject.textAlign ?? 'left'}
                    onChange={(event) => updateSelected({ textAlign: event.target.value as 'left' | 'center' | 'right' })}
                    disabled={selectedObject.locked}
                  >
                    <option value="left">왼쪽</option>
                    <option value="center">가운데</option>
                    <option value="right">오른쪽</option>
                  </select>
                </label>
              )}
              {selectedObject.kind === 'marker' && (
                <label>
                  마커 종류
                  <select
                    value={selectedObject.markerType ?? 'pin'}
                    onChange={(event) => updateSelected({ markerType: event.target.value })}
                    disabled={selectedObject.locked}
                  >
                    <option value="pin">위치</option>
                    <option value="warning">주의</option>
                    <option value="checkpoint">확인점</option>
                  </select>
                </label>
              )}
              <div className="construction-drawing-standard-style" aria-label="레이어 표준 스타일">
                <span
                  className="construction-drawing-standard-style__swatch"
                  style={{ backgroundColor: DRAWING_LAYER_CONTRACT[selectedObject.layer].stroke }}
                  aria-hidden="true"
                />
                <span>
                  <strong>표준 스타일 고정</strong>
                  {` · ${DRAWING_LAYER_CONTRACT[selectedObject.layer].dash === 'solid' ? '실선' : DRAWING_LAYER_CONTRACT[selectedObject.layer].dash === 'dash' ? '파선' : '점선'}`}
                  {DRAWING_LAYER_CONTRACT[selectedObject.layer].hatch === 'diagonal' ? ' · 사선 해칭' : ''}
                  {` · ${DRAWING_LAYER_CONTRACT[selectedObject.layer].geometry === 'direction' ? '방향 화살표' : DRAWING_LAYER_CONTRACT[selectedObject.layer].geometry === 'radius' ? '반경 타원' : '구역 면'}`}
                </span>
              </div>
              <div className="construction-drawing-inspector-actions">
                <button type="button" onClick={duplicateSelected}>복제</button>
                <button type="button" onClick={() => moveSelected('back')} disabled={selectedObject.locked}>뒤로</button>
                <button type="button" onClick={() => moveSelected('front')} disabled={selectedObject.locked}>앞으로</button>
                <button type="button" onClick={() => updateSelected({ locked: !selectedObject.locked })}>
                  {selectedObject.locked ? '잠금 해제' : '잠금'}
                </button>
              </div>
              <button type="button" className="construction-drawing-danger-button" disabled={selectedObject.locked} onClick={() => deleteObject(selectedObject.id)}>
                이 표시 삭제
              </button>
            </section>
          ) : (
            <section className="construction-drawing-legend" aria-labelledby="drawing-legend-title">
              <div className="construction-drawing-section-heading">
                <div>
                  <span>범례</span>
                  <h3 id="drawing-legend-title">레이어 구분</h3>
                </div>
              </div>
              <ul>
                {DRAWING_LAYER_ORDER.map((layerId) => {
                  const config = DRAWING_LAYERS[layerId];
                  return (
                    <li key={layerId} className={hiddenLayers.has(layerId) ? 'is-hidden' : ''}>
                      <button
                        type="button"
                        className="construction-drawing-layer-visibility"
                        onClick={() => toggleLayerVisibility(layerId)}
                        aria-pressed={!hiddenLayers.has(layerId)}
                        aria-label={`${config.label} 레이어 ${hiddenLayers.has(layerId) ? '표시' : '숨기기'}`}
                      >
                        <svg viewBox="0 0 56 22" aria-hidden="true">
                          <line
                            x1="3"
                            y1="11"
                            x2="53"
                            y2="11"
                            stroke={config.color}
                            strokeWidth="5"
                            strokeDasharray={config.dashArray}
                          />
                        </svg>
                        <span>{config.label}</span>
                        <small>{hiddenLayers.has(layerId) ? '숨김' : '표시'}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p>색상을 흑백으로 출력해도 선 간격과 채움 무늬로 구분됩니다.</p>
            </section>
          )}

          <section className="construction-drawing-object-list" aria-labelledby="drawing-object-list-title">
            <div className="construction-drawing-section-heading">
              <div>
                <span>객체 목록</span>
                <h3 id="drawing-object-list-title">등록된 표시 {editorValue.objects.length}</h3>
              </div>
            </div>
            {editorValue.objects.length === 0 ? (
              <p className="construction-drawing-list-empty">아직 등록된 표시가 없습니다.</p>
            ) : (
              <ol>
                {editorValue.objects.map((object, index) => {
                  const config = DRAWING_LAYERS[object.layer];
                  const name = objectAccessibleName(object, config.label);
                  return (
                    <li key={object.id} className={`${selectedId === object.id ? 'is-selected ' : ''}${hiddenLayers.has(object.layer) ? 'is-hidden' : ''}`.trim()}>
                      <button
                        id={`construction-drawing-object-${object.id}`}
                        type="button"
                        className="construction-drawing-object-select"
                        onClick={() => !readOnly && setSelectedId(object.id)}
                        aria-current={selectedId === object.id ? 'true' : undefined}
                      >
                        <span className="construction-drawing-object-index">{index + 1}</span>
                        <span>
                          <strong>{object.locked ? '🔒 ' : ''}{object.zoneCode || object.label || `${config.shortLabel} ${KIND_LABELS[object.kind]}`}</strong>
                          <small>{name}</small>
                        </span>
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          className="construction-drawing-list-delete"
                          onClick={() => deleteObject(object.id)}
                          aria-label={`${name} 삭제`}
                          disabled={object.locked}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
};

export default DrawingStudio;
