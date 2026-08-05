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

    return (
        <nav className={`partner-topnav ${className}`}>
            <div className="partner-topnav-label">
                거래처 인식 업무
            </div>
            <div className="partner-topnav-items">
                {NAV_ITEMS.map((item) => {
                    const activePaths = [item.path, ...(item.activePaths || [])];
                    const isActive = activePaths.some((path) => location.pathname === path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            aria-current={isActive ? 'page' : undefined}
                            className={`partner-topnav-link ${isActive ? 'is-active' : ''}`}
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
