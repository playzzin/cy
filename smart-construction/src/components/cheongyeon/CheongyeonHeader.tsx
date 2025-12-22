import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faUser, faRightFromBracket, faUserGear } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import logoFinished from '../../assets/logo_finished.png';

interface CheongyeonHeaderProps {
    currentSiteData: any;
    onMenuClick: () => void;
}

const CheongyeonHeader: React.FC<CheongyeonHeaderProps> = ({ currentSiteData, onMenuClick }) => {
    const navigate = useNavigate();
    const { currentUser, logout } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 50;
            setScrolled(isScrolled);
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('scroll', handleScroll);
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

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 border-b
                ${scrolled
                    ? 'h-[70px] bg-black/60 backdrop-blur-md border-white/10'
                    : 'h-[90px] bg-transparent border-transparent'
                }
            `}
        >
            <div className="max-w-[1800px] mx-auto h-full px-8 flex items-center justify-between">
                {/* Logo & Brand */}
                <div
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={() => navigate('/dashboard')}
                >
                    <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 bg-white
                        ${scrolled ? 'shadow-lg shadow-white/10' : 'backdrop-blur-sm border border-white/20'}
                        group-hover:scale-105
                    `}>
                        <img
                            src={logoFinished}
                            alt="Cheongyeon Logo"
                            className="w-full h-full object-contain p-1"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-2xl font-bold tracking-tight font-display transition-colors duration-300
                            ${scrolled ? 'text-white' : 'text-white'}
                        `}>
                            {currentSiteData.name}
                        </span>
                        <span className="hidden md:block text-xs font-medium tracking-widest text-amber-400 uppercase">
                            Smart Construction System
                        </span>
                    </div>
                </div>

                {/* Right Side: Profile & Menu Toggle */}
                <div className="flex items-center gap-4">

                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button
                            className={`
                                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden border
                                ${scrolled
                                    ? 'bg-white/10 border-white/20 hover:border-amber-500'
                                    : 'bg-white/20 border-white/30 hover:border-amber-500'
                                }
                            `}
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            title="Profile"
                        >
                            {currentUser?.photoURL ? (
                                <img
                                    src={currentUser.photoURL}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <FontAwesomeIcon icon={faUser} className="text-white" />
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {isProfileOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-slideDown origin-top-right">
                                <div className="p-4 border-b border-white/5 bg-slate-800/50">
                                    <p className="text-white font-bold">{currentUser?.displayName || 'User'}</p>
                                    <p className="text-slate-400 text-xs">{currentUser?.email}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-amber-500 rounded-lg flex items-center gap-3 transition-colors"
                                        onClick={() => {
                                            setIsProfileOpen(false);
                                            navigate('/profile');
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faUserGear} />
                                        Profile Settings
                                    </button>
                                    <button
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg flex items-center gap-3 transition-colors"
                                        onClick={handleLogout}
                                    >
                                        <FontAwesomeIcon icon={faRightFromBracket} />
                                        Log Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Menu Toggle */}
                    <button
                        className={`
                            relative overflow-hidden group w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                            ${scrolled
                                ? 'bg-white/10 hover:bg-amber-500 text-white'
                                : 'bg-white text-slate-900 hover:bg-amber-500 hover:text-white'
                            }
                        `}
                        onClick={onMenuClick}
                        title="Menu"
                    >
                        <FontAwesomeIcon icon={faBars} className="text-lg relative z-10 transition-transform duration-300 group-hover:rotate-180" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default CheongyeonHeader;
