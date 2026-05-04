import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
    faBoxes,
    faBoxesStacked,
    faBuilding,
    faClipboardList,
} from '@fortawesome/free-solid-svg-icons';

const materialTabs = [
    {
        to: '/materials/master',
        label: '자재 마스터',
        icon: faBoxesStacked,
        description: '품명/규격 기준',
    },
    {
        to: '/materials/inbound',
        label: '입고 등록',
        icon: faArrowDown,
        description: '현장 입고',
    },
    {
        to: '/materials/outbound',
        label: '출고 등록',
        icon: faArrowUp,
        description: '현장 출고',
    },
    {
        to: '/materials/transactions',
        label: '입출고 내역',
        icon: faClipboardList,
        description: '조회/수정',
    },
    {
        to: '/materials/inventory',
        label: '재고 현황',
        icon: faBoxes,
        description: '전체 재고',
    },
    {
        to: '/materials/inventory-by-site',
        label: '현장별 재고',
        icon: faBuilding,
        description: '현장 집계',
    },
];

const MaterialManagementPage: React.FC = () => {
    return (
        <div className="min-h-full bg-slate-50/50">
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[2100px] px-4 py-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                                Materials
                            </div>
                            <h1 className="text-xl font-bold text-slate-900">
                                자재 통합관리
                            </h1>
                        </div>

                        <nav className="flex gap-2 overflow-x-auto pb-1 xl:pb-0" aria-label="자재관리 메뉴">
                            {materialTabs.map((tab) => (
                                <NavLink
                                    key={tab.to}
                                    to={tab.to}
                                    end
                                    className={({ isActive }) =>
                                        [
                                            'group flex min-w-[132px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                                            isActive
                                                ? 'active border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                                        ].join(' ')
                                    }
                                >
                                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 group-[.active]:bg-white group-[.active]:text-indigo-600">
                                        <FontAwesomeIcon icon={tab.icon} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block whitespace-nowrap text-sm font-bold">
                                            {tab.label}
                                        </span>
                                        <span className="block whitespace-nowrap text-xs text-slate-400">
                                            {tab.description}
                                        </span>
                                    </span>
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </div>
            </div>

            <Outlet />
        </div>
    );
};

export default MaterialManagementPage;
