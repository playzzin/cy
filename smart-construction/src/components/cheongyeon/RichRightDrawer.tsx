import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faChevronRight, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { MenuItem } from '../../types/menu';
import { iconMap } from '../../utils/iconMapper';

interface RichRightDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    currentSiteData: any;
    menuPaths: { [key: string]: string };
    changeSite: (siteKey: string) => void;
}

const RichRightDrawer: React.FC<RichRightDrawerProps> = ({ isOpen, onClose, currentSiteData, menuPaths, changeSite }) => {
    const navigate = useNavigate();
    const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

    // Mock Project Data for Gallery
    const projects = [
        { title: 'Incheon Airport Ph4', location: 'Incheon, Korea', img: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop' },
        { title: 'Gwanggyo Center', location: 'Gyeonggi, Korea', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' },
        { title: 'Busan Eco Delta', location: 'Busan, Korea', img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2089&auto=format&fit=crop' },
    ];

    if (!isOpen) return null;

    const handleMenuClick = (item: MenuItem) => {
        if (item.sub && item.sub.length > 0) {
            setActiveSubMenu(activeSubMenu === item.text ? null : item.text);
        } else {
            // Direct Link
            if (item.path) {
                navigate(item.path);
                onClose();
            } else if (menuPaths[item.text]) {
                navigate(menuPaths[item.text]);
                onClose();
            }
        }
    };

    const handleSubLinkClick = (path: string) => {
        if (path) {
            navigate(path);
            onClose();
        }
    };

    return (
        <div className="fixed top-0 right-0 z-[2000] h-full pointer-events-none">
            {/* Drawer Panel - Enable pointer events only for the panel */}
            <div className="w-[500px] h-full bg-slate-900 shadow-2xl animate-slideLeft flex flex-col border-l border-white/10 pointer-events-auto">

                {/* 1. Header & Close */}
                <div className="h-[80px] px-8 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-sm shrink-0">
                    <span className="text-xl font-bold text-white font-display tracking-tight">
                        MENU
                        <span className="text-amber-500">.</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full border border-white/10 hover:bg-amber-500 hover:border-amber-500 hover:text-white text-slate-400 transition-all duration-300 flex items-center justify-center group"
                    >
                        <FontAwesomeIcon icon={faXmark} className="text-lg transition-transform group-hover:rotate-90" />
                    </button>
                </div>

                {/* Main Content Area (Scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                    {/* 2. Navigation Menu */}
                    <div className="mb-10">
                        <div className="text-xs font-bold text-amber-500 tracking-widest mb-4 opacity-80 uppercase">Navigation</div>
                        <div className="space-y-2">
                            {currentSiteData.menu.map((item: MenuItem, index: number) => (
                                <div key={index} className="overflow-hidden">
                                    <button
                                        className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group
                                            ${activeSubMenu === item.text ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5 border border-transparent'}
                                        `}
                                        onClick={() => handleMenuClick(item)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors
                                                ${activeSubMenu === item.text ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}
                                            `}>
                                                <FontAwesomeIcon icon={iconMap[item.icon || 'fa-circle'] || iconMap['fa-chart-pie']} />
                                            </div>
                                            <span className={`text-base font-medium transition-colors ${activeSubMenu === item.text ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                                {item.text}
                                            </span>
                                        </div>
                                        {item.sub && item.sub.length > 0 && (
                                            <FontAwesomeIcon
                                                icon={faChevronRight}
                                                className={`text-xs text-slate-500 transition-transform duration-300 ${activeSubMenu === item.text ? 'rotate-90 text-amber-500' : ''}`}
                                            />
                                        )}
                                    </button>

                                    {/* Submenu */}
                                    {item.sub && item.sub.length > 0 && activeSubMenu === item.text && (
                                        <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1 animate-slideDown">
                                            {item.sub.map((sub: string | MenuItem, idx: number) => {
                                                const subText = typeof sub === 'string' ? sub : sub.text;
                                                const subPath = typeof sub === 'string' ? menuPaths[subText] : (sub.path || menuPaths[subText]);

                                                return (
                                                    <button
                                                        key={idx}
                                                        className="w-full text-left py-2.5 px-4 text-sm text-slate-400 hover:text-amber-500 hover:bg-white/5 rounded-lg transition-all flex items-center gap-3 group"
                                                        onClick={() => handleSubLinkClick(subPath)}
                                                    >
                                                        <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-amber-500 transition-colors" />
                                                        {subText}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Latest Projects Gallery */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-xs font-bold text-amber-500 tracking-widest opacity-80 uppercase">Latest Projects</div>
                            <button className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                                MORE <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {projects.map((project, idx) => (
                                <div key={idx} className="group relative rounded-xl overflow-hidden aspect-[21/9] cursor-pointer border border-white/5">
                                    <img
                                        src={project.img}
                                        alt={project.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/30 to-transparent opacity-90" />
                                    <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col justify-end h-full">
                                        <p className="text-amber-500 text-[10px] font-bold tracking-wider mb-1 uppercase">{project.location}</p>
                                        <h4 className="text-white font-bold text-sm leading-tight group-hover:text-amber-400 transition-colors">{project.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Footer */}
                    <div className="p-6 border-t border-white/5 bg-slate-900/50 shrink-0 flex flex-col gap-4">
                        <button
                            onClick={() => {
                                changeSite('admin');
                                onClose();
                            }}
                            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-all border border-white/5 hover:border-white/20 flex items-center justify-center gap-2 group"
                        >
                            <FontAwesomeIcon icon={faArrowRight} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                            청연 ERP로 돌아가기
                        </button>
                        <p className="text-slate-600 text-xs text-center">
                            © 2024 Cheongyeon Construction. <br />All Rights Reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RichRightDrawer;
