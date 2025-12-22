import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUserShield, faListCheck, faUserGear, faDatabase, faSitemap, faBuilding, faCalendarAlt, faFolder, faUserTag, faHistory, faCube, faToggleOn } from '@fortawesome/free-solid-svg-icons';

interface AdminPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'admin') => void;
    siteData: any;
    menuPaths: { [key: string]: string };
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, togglePanel, siteData, menuPaths }) => {
    const navigate = useNavigate();

    const handleNavigation = (path: string) => {
        navigate(path);
        togglePanel('admin'); // Close panel after navigation
    };



    return (
        <aside id="admin-panel" className={`panel ${isOpen ? 'open' : ''}`} style={{ backgroundColor: '#ef4444' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <span className="text-white font-bold flex items-center gap-2">
                    <FontAwesomeIcon icon={faUserShield} /> 관리자 메뉴
                </span>
                <button onClick={() => togglePanel('admin')} style={{ color: 'white' }}>
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="panel-content">
                <div className="grid grid-cols-1 gap-2 p-2">
                    <button className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left">
                        <FontAwesomeIcon icon={faListCheck} className="w-5" />
                        <span className="font-bold">시스템 설정</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/user-management')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faUserGear} className="w-5" />
                        <span className="font-bold">사용자 관리</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/hr/position-management')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faUserTag} className="w-5" />
                        <span className="font-bold">직책 관리</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/data-backup')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faDatabase} className="w-5" />
                        <span className="font-bold">데이터 백업 및 초기화</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/project-structure')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faSitemap} className="w-5" />
                        <span className="font-bold">통합프로젝트 구조도</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/console')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faDatabase} className="w-5" />
                        <span className="font-bold">통합 데이터 콘솔</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/activity-logs')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faHistory} className="w-5" />
                        <span className="font-bold">시스템 활동 로그</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/design-system')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faCube} className="w-5" />
                        <span className="font-bold">컴포넌트 라이브러리</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/component-management')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faToggleOn} className="w-5" />
                        <span className="font-bold">기능/컴포넌트 관리</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/accommodation-design')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faSitemap} className="w-5" />
                        <span className="font-bold">숙소 관리 설계도</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/support/accommodation')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faBuilding} className="w-5" />
                        <span className="font-bold">숙소 통합 관리</span>
                    </button>

                </div>
            </div>
        </aside>
    );
};

export default AdminPanel;
