export interface SourceDashboardAction {
  label: string;
  desc?: string;
  path: string;
  color?: string;
}

export interface MobileFieldAction {
  id: 'daily-input' | 'today-status' | 'site-status' | 'task-sla';
  label: string;
  path: string;
  color: string;
  sourceLabel?: string;
}

interface ActionTarget {
  id: MobileFieldAction['id'];
  label: string;
  fallbackPath: string;
  color: string;
  pathMatchers: string[];
  labelMatchers: string[];
}

const ACTION_TARGETS: ActionTarget[] = [
  {
    id: 'daily-input',
    label: '일보',
    fallbackPath: '/reports/daily?tab=input',
    color: 'bg-blue-600 text-white',
    pathMatchers: ['/reports/daily?tab=input'],
    labelMatchers: ['일보 작성', '작업 내용'],
  },
  {
    id: 'today-status',
    label: '현황',
    fallbackPath: '/reports/daily?tab=list-v2',
    color: 'bg-orange-500 text-white',
    pathMatchers: ['/reports/daily?tab=list-v2'],
    labelMatchers: ['오늘 현황', '일보 목록'],
  },
  {
    id: 'site-status',
    label: '현장',
    fallbackPath: '/dashboard/site-status',
    color: 'bg-emerald-600 text-white',
    pathMatchers: ['/dashboard/site-status'],
    labelMatchers: ['현장 현황'],
  },
  {
    id: 'task-sla',
    label: '요청',
    fallbackPath: '/todo',
    color: 'bg-slate-700 text-white',
    pathMatchers: ['/todo'],
    labelMatchers: ['업무 요청'],
  },
];

const includesAny = (value: string, matchers: string[]) => {
  const normalized = value.toLowerCase();
  return matchers.some((matcher) => normalized.includes(matcher.toLowerCase()));
};

export const buildMobileFieldActions = (
  quickActions: SourceDashboardAction[] = [],
  maxActions = 4
): MobileFieldAction[] => ACTION_TARGETS
  .slice(0, Math.max(1, maxActions))
  .map((target) => {
    const matched = quickActions.find((action) =>
      includesAny(action.path, target.pathMatchers) ||
      includesAny(action.label, target.labelMatchers)
    );

    return {
      id: target.id,
      label: target.label,
      path: matched?.path || target.fallbackPath,
      color: target.color,
      sourceLabel: matched?.label,
    };
  });
