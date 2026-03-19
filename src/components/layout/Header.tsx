import React, { useRef, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBars,
    faUserGear,
    faGear,
    faUserShield,
    faUser,
    faRightFromBracket,
    faShieldHalved,
    faIdBadge
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { resolveIcon } from '../../constants/iconMap';
import { userService } from '../../services/userService';
import PositionPanel from './PositionPanel';
import { PositionItem, SiteDataType } from '../../types/menu';

interface HeaderProps {
    toggleSidebar: () => void;
    togglePanel: (type: 'bottom' | 'admin' | 'position') => void;
    currentSiteData: any;
    isAdmin: boolean;
    isPositionPanelOpen: boolean;
    currentPosition: string;
    changePosition: (positionId: string) => void;
    positions: PositionItem[];
    siteData: SiteDataType | null;
    currentSite: string;
    changeSite: (siteKey: string) => void;
    logoUrl?: string;
}

const Header: React.FC<HeaderProps> = ({
    toggleSidebar,
    togglePanel,
    currentSiteData,
    isAdmin,
    isPositionPanelOpen,
    currentPosition,
    changePosition,
    positions,
    siteData,
    currentSite,
    changeSite,
    logoUrl
}) => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const positionPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
            // Close position panel if click is outside
            if (positionPanelRef.current && !positionPanelRef.current.contains(event.target as Node)) {
                if (isPositionPanelOpen) {
                    togglePanel('position');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPositionPanelOpen, togglePanel]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const handleAdminToggle = async () => {
        if (!currentUser) return;
        try {
            await userService.updateUserRole(currentUser.uid, isAdmin ? 'user' : 'admin');
            alert(`관리자 권한이 ${isAdmin ? '해제' : '부여'}되었습니다. 새로고침하세요.`);
            window.location.reload();
        } catch (e: any) {
            console.error(e);
            alert(`변경 실패: ${e?.message || JSON.stringify(e)}`);
        }
    };

    return (
        <header id="main-header">
            <div className="header-left-group">
                <button className="header-btn" id="sidebar-toggle" onClick={toggleSidebar} aria-label="메뉴 토글">
                    <FontAwesomeIcon icon={faBars} />
                </button>

                <div className="mobile-logo-area">
                    {logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt="Logo" 
                            style={{ height: '24px', width: 'auto', marginRight: '8px', objectFit: 'contain' }}
                        />
                    ) : (
                        <FontAwesomeIcon icon={resolveIcon(currentSiteData.icon, faShieldHalved)} style={{ marginRight: '8px', color: '#3498db' }} />
                    )}
                    <span>{currentSiteData.name}</span>
                </div>
            </div>
            <div className="header-right-group">
                <button className="header-btn" onClick={() => togglePanel('bottom')} title="빠른 실행">
                    <FontAwesomeIcon icon={faUserGear} />
                </button>

                {isAdmin && (
                    <div className="relative" ref={positionPanelRef}>
                        <button className="header-btn text-indigo-400 hover:bg-white/10" onClick={() => togglePanel('position')} title="모드 선택">
                            <FontAwesomeIcon icon={faIdBadge} />
                        </button>
                        {isPositionPanelOpen && (
                            <PositionPanel
                                isOpen={isPositionPanelOpen}
                                togglePanel={togglePanel}
                                currentPosition={currentPosition}
                                changePosition={changePosition}
                                positions={positions}
                                siteData={siteData}
                                currentSite={currentSite}
                                changeSite={changeSite}
                            />
                        )}
                    </div>
                )}

                {isAdmin && (
                    <button className="header-btn text-red-400 hover:bg-white/10" onClick={() => togglePanel('admin')} title="관리자 메뉴">
                        <FontAwesomeIcon icon={faUserShield} />
                    </button>
                )}

                <div className="profile-menu-container" ref={profileRef}>
                    <button
                        className="header-btn profile-btn"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        title="프로필"
                    >
                        {currentUser?.photoURL ? (
                            <img
                                src={currentUser.photoURL}
                                alt="Profile"
                                className="header-profile-img"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const icon = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                    if (icon) icon.style.display = 'block';
                                }}
                            />
                        ) : (
                            <FontAwesomeIcon icon={faUser} />
                        )}
                        {currentUser?.photoURL && (
                            <FontAwesomeIcon icon={faUser} className="fallback-icon" style={{ display: 'none' }} />
                        )}
                    </button>

                    {isProfileOpen && (
                        <div className="profile-dropdown">
                            <div className="profile-info">
                                <div className="profile-name">{currentUser?.displayName || '사용자'}</div>
                                <div className="profile-email">{currentUser?.email}</div>
                            </div>
                            <button className="dropdown-item logout-btn" onClick={() => {
                                setIsProfileOpen(false);
                                navigate('/profile');
                            }}>
                                <FontAwesomeIcon icon={faUserGear} />
                                <span>프로필 설정</span>
                            </button>
                            <button className="dropdown-item logout-btn" onClick={handleLogout}>
                                <FontAwesomeIcon icon={faRightFromBracket} />
                                <span>로그아웃</span>
                            </button>
                            <button className="dropdown-item logout-btn" onClick={handleAdminToggle} style={{ marginTop: '10px', color: '#3b82f6', borderTop: '1px solid #eee' }}>
                                <FontAwesomeIcon icon={faUserShield} />
                                <span>{isAdmin ? '관리자 해제' : '관리자 권한 부여 (임시)'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
