import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { MenuItem } from '../../types/menu';
import { iconMap } from '../../utils/iconMapper';

interface WebsiteHeaderProps {
    currentSiteData: any;
    menuPaths: { [key: string]: string };
    toggleSidebar: () => void;
}

const WebsiteHeader: React.FC<WebsiteHeaderProps> = ({ currentSiteData, menuPaths, toggleSidebar }) => {
    const navigate = useNavigate();
    const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

    const handleMenuClick = (item: MenuItem) => {
        if (item.path) {
            navigate(item.path);
        } else if (item.text === "메인페이지") {
            navigate('/dashboard');
        }
    };

    const handleSubMenuClick = (subItem: string | MenuItem) => {
        // Logic similar to Sidebar
        if (typeof subItem === 'string') {
            const path = menuPaths[subItem];
            if (path) navigate(path);
        } else {
            if (subItem.path) navigate(subItem.path);
        }
        setHoveredMenu(null);
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-[80px] bg-white/90 backdrop-blur-md border-b border-slate-200 z-[1000] transition-all duration-300">
            <div className="max-w-[1600px] mx-auto h-full px-6 flex items-center justify-between">
                {/* Logo */}
                <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                >
                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <FontAwesomeIcon icon={iconMap[currentSiteData.icon] || iconMap['fa-building']} />
                    </div>
                    <span className="text-xl font-bold text-slate-800 tracking-tight font-display">
                        {currentSiteData.name}
                    </span>
                </div>

                {/* Right Side Tools */}
                <div className="flex items-center gap-6">
                    {/* Desktop Menu (Horizontal) */}
                    <nav className="hidden lg:flex items-center gap-8 h-full">
                        {currentSiteData.menu.map((item: MenuItem, index: number) => (
                            <div
                                key={index}
                                className="relative h-full flex items-center"
                                onMouseEnter={() => setHoveredMenu(item.text)}
                                onMouseLeave={() => setHoveredMenu(null)}
                            >
                                <button
                                    className={`text-base font-bold transition-colors flex items-center gap-2 px-2 py-2
                                        ${hoveredMenu === item.text ? 'text-indigo-600' : 'text-slate-700 hover:text-indigo-600'}
                                    `}
                                    onClick={() => handleMenuClick(item)}
                                >
                                    {item.text}
                                    {item.sub && item.sub.length > 0 && (
                                        <FontAwesomeIcon icon={faChevronDown} className="text-xs opacity-50" />
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {item.sub && item.sub.length > 0 && hoveredMenu === item.text && (
                                    <div className="absolute top-[80px] left-1/2 -translate-x-1/2 min-w-[200px] bg-white rounded-b-xl shadow-xl border-t border-indigo-500 py-3 animate-slideDown origin-top z-50">
                                        {item.sub.map((sub: string | MenuItem, idx: number) => {
                                            const text = typeof sub === 'string' ? sub : sub.text;
                                            return (
                                                <button
                                                    key={idx}
                                                    className="w-full text-left px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSubMenuClick(sub);
                                                    }}
                                                >
                                                    {text}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>

                    {/* All Menu Button (Sidebar Trigger) */}
                    <button
                        className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                        onClick={toggleSidebar}
                        title="전체메뉴"
                    >
                        <FontAwesomeIcon icon={faBars} className="text-lg" />
                    </button>
                </div>
            </div>

        </header>
    );
};

export default WebsiteHeader;
