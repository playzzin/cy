import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faShieldHalved, faBuilding, faPhotoFilm, faCartShopping, faPenNib, faFlask, faChartPie, faSitemap, faFileImport } from '@fortawesome/free-solid-svg-icons';

interface RightPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'right') => void;
    siteData: any;
    currentSite: string;
    changeSite: (siteKey: string) => void;
    menuPaths: { [key: string]: string };
}

const iconMap: { [key: string]: any } = {
    'fa-shield-halved': faShieldHalved,
    'fa-chart-pie': faChartPie,
    'fa-building': faBuilding,
    'fa-photo-film': faPhotoFilm,
    'fa-cart-shopping': faCartShopping,
    'fa-pen-nib': faPenNib,
    'fa-flask': faFlask,
    'fa-file-import': faFileImport,
};

const RightPanel: React.FC<RightPanelProps> = ({ isOpen, togglePanel, siteData, currentSite, changeSite, menuPaths }) => {
    const navigate = useNavigate();

    const handleNavigation = (path: string) => {
        navigate(path);
        togglePanel('right');
    };

    // Get System Structure Diagram items from learning menu
    const structureItems = siteData.learning?.menu?.find((m: any) => m.text === "시스템 구조도")?.sub || [];

    return (
        <aside id="right-panel" className={`panel ${isOpen ? 'open' : ''}`}>
            <div className="panel-header">
                <span>사이트 모드</span>
                <button onClick={() => togglePanel('right')} style={{ color: 'white' }}>
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="panel-content">
                <div className="site-switch-grid" id="site-switcher" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px' }}>
                    {Object.keys(siteData)
                        .filter((key: string) => ['admin', 'test', 'company'].includes(key)) // 청연ENG, 청연SITE, 개발중만 표시
                        .map((key: string) => (
                            <button
                                key={key}
                                className={`${currentSite === key ? 'active' : ''}`}
                                onClick={() => changeSite(key)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '15px 5px',
                                    background: currentSite === key ? 'white' : 'rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    color: currentSite === key ? '#3498db' : 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    width: '100%',
                                    height: '80px', // Fixed height for uniformity
                                    boxShadow: currentSite === key ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={iconMap[siteData[key].icon] || faShieldHalved}
                                    style={{ fontSize: '20px', marginBottom: '8px' }}
                                />
                                <span style={{ fontSize: '12px', textAlign: 'center', fontWeight: currentSite === key ? 'bold' : 'normal' }}>{siteData[key].name}</span>
                            </button>
                        ))}
                </div>


            </div>
        </aside>
    );
};

export default RightPanel;
