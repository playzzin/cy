import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VehicleManagerPage } from './VehicleManagerPage';
import { CardManagerPage } from './CardManagerPage';
import AccommodationManager from './AccommodationManager';
import ExpenseLedgerPage from './ExpenseLedgerPage';
import ExpenseClaimManagementPage from './ExpenseClaimManagementPage';
import SupportWorkspaceHeader, { supportWorkspacePaths, type SupportTabId } from '../../components/support/SupportWorkspaceHeader';
import {
  getSupportManagementYearMonth,
  parseSupportManagementView,
  rememberSupportManagementYearMonth,
  subscribeSupportManagementYearMonth,
  type SupportManagementView,
} from '../../utils/supportManagementState';

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
  const repairLeaveGuard = React.useRef<(() => boolean) | null>(null);
  const registerRepairLeaveGuard = React.useCallback((guard: (() => boolean) | null) => { repairLeaveGuard.current = guard; }, []);

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
    if (tabId !== activeTab && repairLeaveGuard.current && !repairLeaveGuard.current()) return;
    if (
      activeTab === 'claim'
      && tabId !== 'claim'
      && claimFormDirty
      && !window.confirm('작성 중인 경비입력 내용이 있습니다. 저장하지 않고 이동할까요?')
    ) {
      return;
    }

    setActiveTab(tabId);
    navigate(`${supportWorkspacePaths[tabId]}${buildSearch(activeView)}`, { replace: true });
  };

  const handleViewChange = (view: SupportManagementView) => {
    setActiveView(view);
    navigate(`${location.pathname}${buildSearch(view)}`, { replace: true });
  };

  const handleYearMonthChange = (nextYearMonth: string) => {
    if (nextYearMonth !== yearMonth && repairLeaveGuard.current && !repairLeaveGuard.current()) return;
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
        <SupportWorkspaceHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          yearMonth={yearMonth}
          onYearMonthChange={handleYearMonthChange}
        />

        <div className="w-full min-w-0">
          {activeTab === 'vehicle' && <VehicleManagerPage embedded initialTab={activeView} onTabChange={handleViewChange} onBeforeRepairLeaveChange={registerRepairLeaveGuard} />}
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
