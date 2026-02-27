import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faShieldHalved, faBuilding, faPhotoFilm, faCartShopping, faPenNib, faFlask, faChartPie, faSitemap, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../constants/iconMap';

interface RightPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'right') => void;
    siteData: any;
    currentSite: string;
    changeSite: (siteKey: string) => void;
    menuPaths: { [key: string]: string };
}

const RightPanel: React.FC<RightPanelProps> = ({ isOpen, togglePanel, siteData, currentSite, changeSite, menuPaths }) => {
    const navigate = useNavigate();

    const handleNavigation = (path: string) => {
        navigate(path);
        togglePanel('right');
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-[1999]"
                    onClick={() => togglePanel('right')}
                />
            )}

            {/* Panel */}
            <aside
                id="right-panel"
                style={{
                    position: 'fixed',
                    top: '60px',
                    right: 0,
                    bottom: 0,
                    width: '320px',
                    height: 'calc(100vh - 60px)',
                    background: 'linear-gradient(to bottom, #0ea5e9, #0284c7)',
                    boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 2000,
                    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <div style={{
                    height: '60px',
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>사이트 모드</span>
                    <button
                        onClick={() => togglePanel('right')}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.3s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {siteData && Object.keys(siteData)
                            .filter((key: string) => !key.startsWith('pos_'))
                            .sort((a, b) => (siteData[a].order || 999) - (siteData[b].order || 999))
                            .map((key: string) => (
                                <button
                                    key={key}
                                    onClick={() => changeSite(key)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '15px 5px',
                                        background: currentSite === key ? 'white' : 'rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: currentSite === key ? '#0ea5e9' : 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: '0.2s',
                                        width: '100%',
                                        height: '80px',
                                        boxShadow: currentSite === key ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    <FontAwesomeIcon
                                        // @ts-ignore
                                        icon={resolveIcon(siteData[key].icon, faBuilding)}
                                        style={{ fontSize: '20px', marginBottom: '8px' }}
                                    />
                                    <span style={{ fontSize: '12px', textAlign: 'center', fontWeight: currentSite === key ? 'bold' : 'normal' }}>{siteData[key].name}</span>
                                </button>
                            ))}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default RightPanel;

