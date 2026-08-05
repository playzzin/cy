import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VehicleManagerPage } from './VehicleManagerPage';
import { CardManagerPage } from './CardManagerPage';
import AccommodationManager from './AccommodationManager';
import ExpenseLedgerPage from './ExpenseLedgerPage';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCar, faCreditCard, faFileInvoiceDollar, faLifeRing } from '@fortawesome/free-solid-svg-icons';
import { hexToRgba } from '../../utils/color';

type SupportTabId = 'vehicle' | 'card' | 'accommodation' | 'expense';

const tabs: Array<{ id: SupportTabId; label: string; icon: IconDefinition; color: string }> = [
  { id: 'vehicle', label: '차량 지원', icon: faCar, color: '#2563eb' },
  { id: 'card', label: '카드 지원', icon: faCreditCard, color: '#7c3aed' },
  { id: 'accommodation', label: '숙소 관리', icon: faBuilding, color: '#059669' },
  { id: 'expense', label: '경비 정산', icon: faFileInvoiceDollar, color: '#d97706' }
];

const SupportManagerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialTab = useMemo<SupportTabId>(() => {
    if (location.pathname.includes('/support/expense-ledger')) return 'expense';
    if (location.pathname.includes('/support/cards')) return 'card';
    if (location.pathname.includes('/support/accommodation')) return 'accommodation';
    return 'vehicle';
  }, [location.pathname]);
  const [activeTab, setActiveTab] = useState<SupportTabId>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tabId: SupportTabId) => {
    setActiveTab(tabId);
    const pathMap = {
      vehicle: '/support/vehicles',
      card: '/support/cards',
      accommodation: '/support/accommodation',
      expense: '/support/expense-ledger',
    };
    navigate(pathMap[tabId], { replace: true });
  };

  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 px-3 py-4 sm:p-6 xl:p-8">
      <div className="w-full max-w-none min-w-0 space-y-5 sm:space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white shadow-lg"
                style={{ backgroundColor: currentTab.color, boxShadow: `0 12px 28px -18px ${currentTab.color}` }}
              >
                <FontAwesomeIcon icon={faLifeRing} className="text-lg" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentTab.color }} />
                  {currentTab.label}
                </div>
                <h1 className="truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">지원관리 통합센터</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  차량, 카드, 숙소의 배정 현황과 청구 업무를 같은 흐름으로 관리합니다.
                </p>
              </div>
            </div>

            <div className="support-scroll-x w-full lg:w-auto">
              <div className="support-scroll-inner inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="지원관리 업무 선택">
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
                      className={`flex h-10 items-center gap-2.5 whitespace-nowrap rounded-md border px-4 text-sm font-extrabold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:px-5 ${
                        isActive ? 'bg-white shadow-sm' : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-700'
                      }`}
                      style={isActive ? {
                        borderColor: hexToRgba(tab.color, 0.35),
                        color: tab.color,
                        boxShadow: `0 4px 12px -8px ${tab.color}`
                      } : undefined}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tab.color }} />
                      <FontAwesomeIcon icon={tab.icon} className={isActive ? '' : 'text-slate-400'} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full min-w-0">
          {activeTab === 'vehicle' && <VehicleManagerPage embedded />}
          {activeTab === 'card' && <CardManagerPage embedded />}
          {activeTab === 'accommodation' && <AccommodationManager embedded />}
          {activeTab === 'expense' && <ExpenseLedgerPage embedded />}
        </div>
      </div>
    </div>
  );
};

export default SupportManagerPage;
