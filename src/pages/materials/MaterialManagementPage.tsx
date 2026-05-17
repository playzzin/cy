import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
    faBoxes,
    faBoxesStacked,
    faBuilding,
    faClipboardList,
    faHistory,
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
    {
        to: '/materials/logs',
        label: '자재 로그',
        icon: faHistory,
        description: '변경 이력',
    },
];

const MaterialManagementPage: React.FC = () => {
    const location = useLocation();
    const normalizedPath = location.pathname.replace(/\/+$/, '');
    const isFieldGoodsPage = normalizedPath === '/materials/field-goods';

    if (isFieldGoodsPage) {
        return <Outlet />;
    }

    return (
        <div className="min-h-full w-full max-w-[calc(100vw-30px)] overflow-x-hidden bg-slate-50/50 sm:max-w-none">
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[2100px] px-2 py-1.5 sm:px-4 sm:py-3">
                    <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="hidden min-w-0 sm:block">
                            <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                                Materials
                            </div>
                            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                                자재 통합관리
                            </h1>
                        </div>

                        <nav className="grid grid-cols-3 gap-1 sm:-mx-1 sm:flex sm:gap-2 sm:overflow-x-auto sm:px-1 sm:pb-1 xl:mx-0 xl:pb-0" aria-label="자재관리 메뉴">
                            {materialTabs.map((tab, index) => (
                                <NavLink
                                    key={tab.to}
                                    to={tab.to}
                                    end
                                    className={({ isActive }) =>
                                        [
                                            index > 2 ? 'hidden sm:flex' : 'flex',
                                            'group min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-center transition sm:min-w-[132px] sm:justify-start sm:gap-3 sm:px-3 sm:py-2 sm:text-left',
                                            isActive
                                                ? 'active border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                                        ].join(' ')
                                    }
                                >
                                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 group-[.active]:bg-white group-[.active]:text-indigo-600 sm:h-9 sm:w-9">
                                        <FontAwesomeIcon icon={tab.icon} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block whitespace-nowrap text-xs font-bold sm:text-sm">
                                            {tab.label}
                                        </span>
                                        <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:block">
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
