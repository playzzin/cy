import React, { useState } from 'react';
import { VehicleManagerPage } from './VehicleManagerPage';
import { CardManagerPage } from './CardManagerPage';
import AccommodationManager from './AccommodationManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCar, faCreditCard, faBuilding } from '@fortawesome/free-solid-svg-icons';

const tabs = [
  { id: 'vehicle', label: '차량 지원', icon: faCar },
  { id: 'card', label: '카드 지원', icon: faCreditCard },
  { id: 'accommodation', label: '숙소 관리', icon: faBuilding },
];

const SupportManagerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vehicle' | 'card' | 'accommodation'>('vehicle');

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
      <div className="max-w-[1800px] mx-auto space-y-8">
        {/* 상단 탭 */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2.5
                ${activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              <FontAwesomeIcon icon={tab.icon} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
              {tab.label}
            </button>
          ))}
        </div>
        {/* 탭별 페이지 */}
        <div>
          {activeTab === 'vehicle' && <VehicleManagerPage />}
          {activeTab === 'card' && <CardManagerPage />}
          {activeTab === 'accommodation' && <AccommodationManager />}
        </div>
      </div>
    </div>
  );
};

export default SupportManagerPage;
