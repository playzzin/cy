import React from 'react';
import './MaterialWorkspace.css';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
    faBoxesStacked,
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
];

const MaterialManagementPage: React.FC = () => {
    const location = useLocation();
    const normalizedPath = location.pathname.replace(/\/+$/, '');
    const isFieldGoodsPage = normalizedPath === '/materials/field-goods';

    if (isFieldGoodsPage) {
        return <Outlet />;
    }

    return (
        <div className="materials-workspace">
            <div className="materials-navigation">
                <div className="materials-navigation__inner">
                    <div className="materials-navigation__brand">
                        <span className="materials-navigation__mark"><FontAwesomeIcon icon={faBoxesStacked} /></span>
                        <div><small>MATERIALS</small><h1>자재 통합관리</h1></div>
                    </div>
                    <nav aria-label="자재관리 메뉴">
                        {materialTabs.map(tab => (
                            <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => `materials-navigation__tab${isActive ? ' active' : ''}`}>
                                <FontAwesomeIcon icon={tab.icon} />
                                <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </div>

            <Outlet />
        </div>
    );
};

export default MaterialManagementPage;
