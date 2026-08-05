import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUserShield, faListCheck, faUserGear, faDatabase, faSitemap, faBuilding, faCalendarAlt, faFolder, faHistory, faCube, faToggleOn } from '@fortawesome/free-solid-svg-icons';

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
        <aside
            id="admin-panel"
            data-html2canvas-ignore="true"
            className={`panel ${isOpen ? 'open' : ''}`}
            style={{ backgroundColor: '#ef4444' }}
        >
            <div className="panel-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <span className="text-white font-bold flex items-center gap-2">
                    <FontAwesomeIcon icon={faUserShield} /> 관리자 메뉴
                </span>
                <button onClick={() => togglePanel('admin')} style={{ color: 'white' }} aria-label="관리자 메뉴 닫기" title="관리자 메뉴 닫기">
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="panel-content">
                <div className="grid grid-cols-1 gap-2 p-2">
                    <button
                        onClick={() => handleNavigation('/settings')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faListCheck} className="w-5" />
                        <span className="font-bold">시스템 설정</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/menu-manager')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-blue-600/50 hover:bg-blue-600/70 border border-blue-400/30 text-white transition text-left shadow-lg mb-2"
                    >
                        <FontAwesomeIcon icon={faCube} className="w-5 text-blue-300" />
                        <span className="font-bold">통합 메뉴 관리 (Premium)</span>
                    </button>
                    <button
                        onClick={() => handleNavigation('/admin/user-management')}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-left"
                    >
                        <FontAwesomeIcon icon={faUserGear} className="w-5" />
                        <span className="font-bold">사용자 통합 관리</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default AdminPanel;
