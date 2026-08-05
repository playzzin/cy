import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faCalendarCheck,
  faClipboardCheck,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { DashboardModeConfig } from './roleDashboardConfig';
import { buildMobileFieldActions, type MobileFieldAction } from '../../features/mobile-field-mode/mobileFieldActions';

interface MobileFieldCommandBarProps {
  modeConfig: DashboardModeConfig;
}

const ICON_BY_ACTION: Record<MobileFieldAction['id'], IconDefinition> = {
  'daily-input': faCalendarCheck,
  'today-status': faClipboardList,
  'site-status': faBuilding,
  'task-sla': faClipboardCheck,
};

export const MobileFieldCommandBar = React.memo<MobileFieldCommandBarProps>(({ modeConfig }) => {
  const navigate = useNavigate();
  const actions = React.useMemo(
    () => buildMobileFieldActions(modeConfig.quickActions),
    [modeConfig.quickActions]
  );

  if (modeConfig.layout !== 'field') return null;

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden" aria-label="현장 빠른 실행">
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => navigate(action.path)}
            title={action.sourceLabel || action.label}
            className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-extrabold shadow-sm transition active:scale-[0.98] ${action.color}`}
          >
            <FontAwesomeIcon icon={ICON_BY_ACTION[action.id]} className="text-base" />
            <span className="max-w-full truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
});
