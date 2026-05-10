import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VehicleManagerPage } from './VehicleManagerPage';
import { CardManagerPage } from './CardManagerPage';
import AccommodationManager from './AccommodationManager';
import ExpenseLedgerPage from './ExpenseLedgerPage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCar, faCreditCard, faFileInvoiceDollar, faLifeRing } from '@fortawesome/free-solid-svg-icons';
import { hexToRgba } from '../../utils/color';

const tabs = [
  { id: 'vehicle', label: '차량 지원', icon: faCar },
  { id: 'card', label: '카드 지원', icon: faCreditCard },
  { id: 'accommodation', label: '숙소 관리', icon: faBuilding },
  { id: 'expense', label: '경비 정산', icon: faFileInvoiceDollar },
].map((tab) => ({
  ...tab,
  color: tab.id === 'vehicle'
    ? '#2563eb'
    : tab.id === 'card'
      ? '#7c3aed'
      : tab.id === 'accommodation'
        ? '#059669'
        : '#d97706'
}));

type SupportTabId = 'vehicle' | 'card' | 'accommodation' | 'expense';

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

  return (
    <div className="min-h-screen bg-slate-50 p-6 xl:p-10">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                <FontAwesomeIcon icon={faLifeRing} className="text-white text-xl" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">지원관리 통합센터</h1>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  차량, 카드, 숙소의 배정 현황과 청구 업무를 같은 흐름으로 관리합니다.
                </p>
              </div>
            </div>

            <div className="bg-slate-100 p-1 rounded-xl inline-flex w-fit">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as SupportTabId)}
                    className={`flex items-center gap-2.5 rounded-lg border px-5 py-2.5 text-sm font-bold transition-all ${
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

        <div>
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
