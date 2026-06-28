import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAddressCard, faIdCard } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface PartnerMenuTopNavProps {
    className?: string;
}

interface PartnerMenuTopNavItem {
    label: string;
    path: string;
    icon: IconDefinition;
    activePaths?: string[];
}

const NAV_ITEMS: PartnerMenuTopNavItem[] = [
    {
        label: '사진 거래처 등록',
        path: '/database/partner-photo-registration',
        icon: faIdCard,
    },
    {
        label: '명함/담당자 관리',
        path: '/database/business-card-contacts',
        icon: faAddressCard,
    },
];

const PartnerMenuTopNav: React.FC<PartnerMenuTopNavProps> = ({ className = '' }) => {
    const location = useLocation();

    const rootClass = 'border-slate-200 bg-white text-slate-900 shadow-sm';
    const labelClass = 'text-slate-500';
    const inactiveClass = 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700';
    const activeClass = 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-100';

    return (
        <nav className={`flex flex-col gap-2 border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${rootClass} ${className}`}>
            <div className={`text-xs font-extrabold uppercase tracking-wide ${labelClass}`}>
                공통 메뉴
            </div>
            <div className="flex gap-2 overflow-x-auto">
                {NAV_ITEMS.map((item) => {
                    const activePaths = [item.path, ...(item.activePaths || [])];
                    const isActive = activePaths.some((path) => location.pathname === path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-extrabold transition-colors ${isActive ? activeClass : inactiveClass}`}
                        >
                            <FontAwesomeIcon icon={item.icon} className="text-sm" />
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default PartnerMenuTopNav;
