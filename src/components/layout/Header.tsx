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
    faChartPie,
    faClipboardList,
    faFileInvoiceDollar,
    faDatabase,
    faBuilding,
    faPhotoFilm,
    faCartShopping,
    faPenNib,
    faFlask,
    faIdBadge
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { resolveIcon } from '../../constants/iconMap';

interface HeaderProps {
    toggleSidebar: () => void;
    togglePanel: (type: 'right' | 'bottom' | 'admin' | 'position') => void;
    currentSiteData: any;
    isAdmin: boolean;
}

// Icon mapping (duplicated for now, can be moved to a shared utility)


const Header: React.FC<HeaderProps> = ({ toggleSidebar, togglePanel, currentSiteData, isAdmin }) => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../config/firebase');
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                role: isAdmin ? 'user' : 'admin'
            });
            alert(`관리자 권한이 ${isAdmin ? '해제' : '부여'}되었습니다. 새로고침하세요.`);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert('변경 실패');
        }
    };

    return (
        <header id="main-header">
            <div className="header-left-group">
                <button className="header-btn" id="sidebar-toggle" onClick={toggleSidebar} aria-label="메뉴 토글">
                    <FontAwesomeIcon icon={faBars} />
                </button>

                <div className="mobile-logo-area">
                    <FontAwesomeIcon icon={resolveIcon(currentSiteData.icon, faShieldHalved)} style={{ marginRight: '8px', color: '#3498db' }} />
                    <span>{currentSiteData.name}</span>
                </div>
            </div>
            <div className="header-right-group">
                <button className="header-btn" onClick={() => togglePanel('bottom')} title="빠른 실행">
                    <FontAwesomeIcon icon={faUserGear} />
                </button>
                {isAdmin && (
                    <button className="header-btn" onClick={() => togglePanel('right')} title="사이트 모드">
                        <FontAwesomeIcon icon={faGear} />
                    </button>
                )}

                {isAdmin && (
                    <button className="header-btn text-indigo-500 hover:bg-indigo-50" onClick={() => togglePanel('position')} title="직책 모드">
                        <FontAwesomeIcon icon={faIdBadge} />
                    </button>
                )}

                {isAdmin && (
                    <button className="header-btn text-red-500 hover:bg-red-50" onClick={() => togglePanel('admin')} title="관리자 메뉴">
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
