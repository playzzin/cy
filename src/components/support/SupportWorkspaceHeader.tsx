import React from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCar, faCreditCard, faFileCirclePlus, faFileInvoiceDollar, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import MonthNavigator from '../common/MonthNavigator';
import { hexToRgba } from '../../utils/color';

export type SupportTabId = 'vehicle' | 'card' | 'accommodation' | 'expense' | 'claim';

export const supportWorkspacePaths: Record<SupportTabId, string> = {
  vehicle: '/support/vehicles',
  card: '/support/cards',
  accommodation: '/support/accommodation',
  expense: '/support/expense-ledger',
  claim: '/support/expense-claims',
};

const tabs: Array<{ id: SupportTabId; label: string; icon: IconDefinition; color: string }> = [
  { id: 'expense', label: '통합현황', icon: faFileInvoiceDollar, color: '#d97706' },
  { id: 'claim', label: '경비입력', icon: faFileCirclePlus, color: '#ea580c' },
  { id: 'vehicle', label: '차량', icon: faCar, color: '#2563eb' },
  { id: 'accommodation', label: '숙소', icon: faBuilding, color: '#059669' },
  { id: 'card', label: '카드', icon: faCreditCard, color: '#7c3aed' },
];

interface SupportWorkspaceHeaderProps {
  activeTab: SupportTabId;
  onTabChange: (tab: SupportTabId) => void;
  yearMonth: string;
  onYearMonthChange: (yearMonth: string) => void;
  monthDisabled?: boolean;
}

const SupportWorkspaceHeader: React.FC<SupportWorkspaceHeaderProps> = ({
  activeTab,
  onTabChange,
  yearMonth,
  onYearMonthChange,
  monthDisabled = false,
}) => (
  <header className="sticky top-0 z-30 rounded-b-xl border border-t-0 border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/50 backdrop-blur">
    <div className="flex h-[52px] min-w-0 items-center gap-2 px-2 sm:px-3">
      <div className="flex shrink-0 items-center gap-2 border-r border-slate-200 pr-2 sm:pr-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
          <FontAwesomeIcon icon={faLayerGroup} className="text-sm" />
        </span>
        <div className="hidden whitespace-nowrap text-sm font-black text-slate-950 sm:block">
          배정·경비 통합관리
        </div>
      </div>

      <div className="w-[148px] shrink-0 sm:w-[168px]">
        <MonthNavigator
          value={yearMonth}
          onChange={onYearMonthChange}
          disabled={monthDisabled}
          ariaLabel="통합관리 조회월"
        />
      </div>

      <div className="support-scroll-x min-w-0 flex-1">
        <div className="support-scroll-inner inline-flex min-w-max items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="통합관리 업무 선택">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(tab.id)}
                className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-extrabold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                  isActive ? 'bg-white shadow-sm' : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-700'
                }`}
                style={isActive ? {
                  borderColor: hexToRgba(tab.color, 0.35),
                  color: tab.color,
                  boxShadow: `0 4px 12px -8px ${tab.color}`,
                } : undefined}
              >
                <FontAwesomeIcon icon={tab.icon} className={isActive ? '' : 'text-slate-400'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  </header>
);

export default SupportWorkspaceHeader;
