import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VehicleManagerPage } from './VehicleManagerPage';
import { CardManagerPage } from './CardManagerPage';
import AccommodationManager from './AccommodationManager';
import ExpenseLedgerPage from './ExpenseLedgerPage';
import ExpenseClaimManagementPage from './ExpenseClaimManagementPage';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCar, faCreditCard, faFileCirclePlus, faFileInvoiceDollar, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import { hexToRgba } from '../../utils/color';
import MonthNavigator from '../../components/common/MonthNavigator';
import {
  getSupportManagementYearMonth,
  parseSupportManagementView,
  rememberSupportManagementYearMonth,
  subscribeSupportManagementYearMonth,
  type SupportManagementView,
} from '../../utils/supportManagementState';

type SupportTabId = 'vehicle' | 'card' | 'accommodation' | 'expense' | 'claim';

const tabs: Array<{ id: SupportTabId; label: string; icon: IconDefinition; color: string }> = [
  { id: 'expense', label: '통합현황', icon: faFileInvoiceDollar, color: '#d97706' },
  { id: 'claim', label: '경비입력', icon: faFileCirclePlus, color: '#ea580c' },
  { id: 'vehicle', label: '차량', icon: faCar, color: '#2563eb' },
  { id: 'accommodation', label: '숙소', icon: faBuilding, color: '#059669' },
  { id: 'card', label: '카드', icon: faCreditCard, color: '#7c3aed' }
];

const SupportManagerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialTab = useMemo<SupportTabId>(() => {
    if (location.pathname.includes('/support/expense-claims') || location.pathname.includes('/support/expense-claim-input')) return 'claim';
    if (location.pathname.includes('/support/expense-ledger')) return 'expense';
    if (location.pathname.includes('/support/cards')) return 'card';
    if (location.pathname.includes('/support/accommodation')) return 'accommodation';
    return 'vehicle';
  }, [location.pathname]);
  const [activeTab, setActiveTab] = useState<SupportTabId>(initialTab);
  const initialView = useMemo(
    () => parseSupportManagementView(new URLSearchParams(location.search).get('view')),
    [location.search]
  );
  const [activeView, setActiveView] = useState<SupportManagementView>(initialView);
  const [yearMonth, setYearMonth] = useState(getSupportManagementYearMonth);
  const [claimFormDirty, setClaimFormDirty] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => subscribeSupportManagementYearMonth(setYearMonth), []);

  const buildSearch = (view: SupportManagementView) => {
    const params = new URLSearchParams(location.search);
    params.set('view', view);
    return `?${params.toString()}`;
  };

  const handleTabChange = (tabId: SupportTabId) => {
    if (
      activeTab === 'claim'
      && tabId !== 'claim'
      && claimFormDirty
      && !window.confirm('작성 중인 경비입력 내용이 있습니다. 저장하지 않고 이동할까요?')
    ) {
      return;
    }

    setActiveTab(tabId);
    const pathMap = {
      vehicle: '/support/vehicles',
      card: '/support/cards',
      accommodation: '/support/accommodation',
      expense: '/support/expense-ledger',
      claim: '/support/expense-claims',
    };
    navigate(`${pathMap[tabId]}${buildSearch(activeView)}`, { replace: true });
  };

  const handleViewChange = (view: SupportManagementView) => {
    setActiveView(view);
    navigate(`${location.pathname}${buildSearch(view)}`, { replace: true });
  };

  const handleYearMonthChange = (nextYearMonth: string) => {
    if (
      activeTab === 'claim'
      && claimFormDirty
      && !window.confirm('작성 중인 경비입력 내용이 있습니다. 저장하지 않고 조회월을 바꿀까요?')
    ) {
      return;
    }

    setYearMonth(nextYearMonth);
    rememberSupportManagementYearMonth(nextYearMonth);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 px-3 pb-6 pt-0 sm:px-5 xl:px-6">
      <div className="w-full max-w-none min-w-0 space-y-3">
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
                onChange={handleYearMonthChange}
                ariaLabel="통합관리 조회월"
              />
            </div>

            <div className="support-scroll-x min-w-0 flex-1">
              <div className="support-scroll-inner inline-flex min-w-max items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="통합관리 업무 선택">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-extrabold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                        isActive ? 'bg-white shadow-sm' : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-700'
                      }`}
                      style={isActive ? {
                        borderColor: hexToRgba(tab.color, 0.35),
                        color: tab.color,
                        boxShadow: `0 4px 12px -8px ${tab.color}`
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

        <div className="w-full min-w-0">
          {activeTab === 'vehicle' && <VehicleManagerPage embedded initialTab={activeView} onTabChange={handleViewChange} />}
          {activeTab === 'card' && <CardManagerPage embedded initialTab={activeView} onTabChange={handleViewChange} />}
          {activeTab === 'accommodation' && <AccommodationManager embedded initialTab={activeView} onTabChange={handleViewChange} />}
          {activeTab === 'expense' && <ExpenseLedgerPage embedded />}
          {activeTab === 'claim' && <ExpenseClaimManagementPage embedded onDirtyChange={setClaimFormDirty} />}
        </div>
      </div>
    </div>
  );
};

export default SupportManagerPage;
