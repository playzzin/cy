import React, { useMemo, useState } from 'react';
import './ConstructionPlanOnboarding.css';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

const browserStorage = (): BrowserStorage | undefined => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
};

const storedFlag = (storage: BrowserStorage | undefined, key: string): boolean => {
  try {
    return storage?.getItem(key) === 'done';
  } catch {
    return false;
  }
};

const writeFlag = (storage: BrowserStorage | undefined, key: string): void => {
  try {
    storage?.setItem(key, 'done');
  } catch {
    // The checklist remains usable when browser storage is unavailable.
  }
};

export type ConstructionPlanOnboardingTarget = 'project-overview' | 'organization' | 'drawing-register';

export interface ConstructionPlanOnboardingChecklistProps {
  planId: string;
  siteConnected: boolean;
  organizationConfirmed: boolean;
  drawingMarked: boolean;
  onNavigate: (target: ConstructionPlanOnboardingTarget) => void;
  storage?: BrowserStorage;
}

export const ConstructionPlanOnboardingChecklist: React.FC<ConstructionPlanOnboardingChecklistProps> = ({
  planId,
  siteConnected,
  organizationConfirmed,
  drawingMarked,
  onNavigate,
  storage = browserStorage(),
}) => {
  const storageKey = `construction-plan:onboarding:${planId}:v1`;
  const [dismissed, setDismissed] = useState(() => storedFlag(storage, storageKey));
  const steps = useMemo(() => ([
    { id: 'site', label: '현장 연결', complete: siteConnected, target: 'project-overview' as const, action: '현장정보 확인' },
    { id: 'organization', label: '조직 확정', complete: organizationConfirmed, target: 'organization' as const, action: '조직도 확인' },
    { id: 'drawing', label: '도면 구간 표시', complete: drawingMarked, target: 'drawing-register' as const, action: '도면 작업 열기' },
  ]), [drawingMarked, organizationConfirmed, siteConnected]);
  const completed = steps.filter((step) => step.complete).length;

  if (dismissed) {
    return (
      <button
        type="button"
        className="construction-plan-onboarding-reopen"
        onClick={() => setDismissed(false)}
      >
        첫 작성 안내 보기 · {completed}/3
      </button>
    );
  }

  return (
    <aside className="construction-plan-onboarding" aria-labelledby="construction-plan-onboarding-title">
      <div className="construction-plan-onboarding__header">
        <div>
          <strong id="construction-plan-onboarding-title">첫 작성 체크리스트</strong>
          <p>현장 연결부터 실제 도면 표시까지 순서대로 확인합니다.</p>
        </div>
        <span className="construction-plan-onboarding__progress" aria-live="polite">완료 {completed}/3</span>
      </div>
      <ol className="construction-plan-onboarding__steps">
        {steps.map((step, index) => (
          <li key={step.id} className={step.complete ? 'is-complete' : ''}>
            <span className="construction-plan-onboarding__number" aria-hidden="true">{step.complete ? '✓' : index + 1}</span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.complete ? '확인 완료' : '확인 필요'}</small>
            </span>
            <button type="button" onClick={() => onNavigate(step.target)}>
              {step.complete ? '다시 보기' : step.action}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="construction-plan-onboarding__dismiss"
        onClick={() => {
          writeFlag(storage, storageKey);
          setDismissed(true);
        }}
      >
        이 안내 숨기기
      </button>
    </aside>
  );
};

interface PracticePoint {
  x: number;
  y: number;
}

export interface ConstructionPlanPolygonPracticeProps {
  storageKey?: string;
  onComplete: () => void;
  onSkip: () => void;
  storage?: BrowserStorage;
}

const PRACTICE_POINTS: readonly PracticePoint[] = [
  { x: 92, y: 172 },
  { x: 205, y: 64 },
  { x: 326, y: 174 },
];

export const ConstructionPlanPolygonPractice: React.FC<ConstructionPlanPolygonPracticeProps> = ({
  storageKey = 'construction-plan:drawing-polygon-practice:v1',
  onComplete,
  onSkip,
  storage = browserStorage(),
}) => {
  const [points, setPoints] = useState<PracticePoint[]>([]);
  const completed = points.length >= 3;
  const addPoint = (point: PracticePoint) => {
    if (completed) return;
    setPoints((current) => [...current, point].slice(0, 3));
  };
  const finish = (callback: () => void) => {
    writeFlag(storage, storageKey);
    callback();
  };

  return (
    <section className="construction-plan-polygon-practice" role="dialog" aria-modal="true" aria-labelledby="polygon-practice-title">
      <div className="construction-plan-polygon-practice__copy">
        <span>도면 첫 사용 연습</span>
        <h3 id="polygon-practice-title">다각형으로 작업구간을 표시해 보세요</h3>
        <p>도면 위 서로 다른 위치를 세 번 선택하면 구간이 닫힙니다. 이 연습점은 계획서에 저장되지 않습니다.</p>
      </div>
      <svg
        viewBox="0 0 420 240"
        role="img"
        aria-label={`다각형 연습판 · 선택한 점 ${points.length}/3`}
        onClick={(event) => {
          const rectangle = event.currentTarget.getBoundingClientRect();
          if (rectangle.width <= 0 || rectangle.height <= 0) return;
          addPoint({
            x: ((event.clientX - rectangle.left) / rectangle.width) * 420,
            y: ((event.clientY - rectangle.top) / rectangle.height) * 240,
          });
        }}
      >
        <defs>
          <pattern id="construction-plan-practice-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#cbd5e1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="420" height="240" fill="url(#construction-plan-practice-grid)" />
        <path d="M45 195 H375 M70 205 V48 M350 205 V48" fill="none" stroke="#64748b" strokeWidth="3" />
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill={completed ? 'rgba(37, 99, 235, .2)' : 'none'}
            stroke="#2563eb"
            strokeWidth="4"
            strokeDasharray={completed ? undefined : '8 6'}
          />
        )}
        {completed && <line x1={points[2].x} y1={points[2].y} x2={points[0].x} y2={points[0].y} stroke="#2563eb" strokeWidth="4" />}
        {points.map((point, index) => (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle cx={point.x} cy={point.y} r="9" fill="#ffffff" stroke="#1d4ed8" strokeWidth="4" />
            <text x={point.x} y={point.y + 4} textAnchor="middle">{index + 1}</text>
          </g>
        ))}
      </svg>
      <div className="construction-plan-polygon-practice__keyboard">
        <span>마우스 대신 키보드로 연습하려면:</span>
        {PRACTICE_POINTS.map((point, index) => (
          <button key={index} type="button" disabled={points.length !== index} onClick={() => addPoint(point)}>
            점 {index + 1} 추가
          </button>
        ))}
      </div>
      <p className="construction-plan-polygon-practice__status" aria-live="polite">
        {completed ? '다각형이 완성됐습니다. 실제 도면에서도 같은 방식으로 표시할 수 있습니다.' : `점을 ${3 - points.length}개 더 선택하세요.`}
      </p>
      <div className="construction-plan-polygon-practice__actions">
        <button type="button" className="secondary" onClick={() => finish(onSkip)}>건너뛰기</button>
        <button type="button" className="secondary" onClick={() => setPoints([])} disabled={points.length === 0}>다시 연습</button>
        <button type="button" className="primary" disabled={!completed} onClick={() => finish(onComplete)}>연습 완료</button>
      </div>
    </section>
  );
};

export const hasCompletedConstructionPlanPolygonPractice = (
  storageKey = 'construction-plan:drawing-polygon-practice:v1',
  storage: BrowserStorage | undefined = browserStorage(),
): boolean => storedFlag(storage, storageKey);

export const ConstructionPlanDwgConversionGuide: React.FC<{ onClose?: () => void }> = ({ onClose }) => (
  <aside className="construction-plan-dwg-guide" role="alert" aria-labelledby="construction-plan-dwg-guide-title">
    <div>
      <strong id="construction-plan-dwg-guide-title">DWG는 승인도면 PDF로 변환해 등록하세요</strong>
      <p>AutoCAD 또는 DWG TrueView의 인쇄/내보내기에서 원본 축척과 도면 방향을 유지한 PDF를 만드세요.</p>
      <ol>
        <li>도면 영역과 용지 방향을 확인합니다.</li>
        <li>선 두께와 문자 포함 옵션을 켜고 PDF로 출력합니다.</li>
        <li>암호를 설정하지 말고 50MB 이하인지 확인한 뒤 PDF를 등록합니다.</li>
      </ol>
    </div>
    {onClose && <button type="button" onClick={onClose} aria-label="DWG 변환 안내 닫기">닫기</button>}
  </aside>
);

