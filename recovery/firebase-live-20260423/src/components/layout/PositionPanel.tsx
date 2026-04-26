import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUserTie } from '@fortawesome/free-solid-svg-icons';
import { PositionItem, SiteDataType } from '../../types/menu';
import { resolveIcon } from '../../constants/iconMap';

interface PositionPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'position') => void;
    currentPosition: string;
    changePosition: (positionId: string) => void;
    positions?: PositionItem[];
    siteData?: SiteDataType | null;
    currentSite?: string;
    changeSite?: (siteKey: string) => void;
}

const PositionPanel: React.FC<PositionPanelProps> = ({
    isOpen,
    togglePanel,
    currentPosition,
    changePosition,
    positions = [],
    siteData,
    currentSite,
    changeSite
}) => {
    const [activeTab, setActiveTab] = React.useState<'site' | 'position'>('site');

    // Filter sites for display
    const filteredSites = React.useMemo(() => {
        if (!siteData) return [];
        return Object.entries(siteData)
            .filter(([key]) => !key.startsWith('pos_'))
            .map(([key, site]) => ({ key, ...site }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [siteData]);

    return (
        <>
            {/* Backdrop for mobile/desktop to close on click outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => togglePanel('position')}
                />
            )}
            <aside
                id="position-panel"
                className={`fixed top-[65px] right-4 w-96 bg-slate-800 shadow-2xl z-50 rounded-xl border border-slate-700 transition-all duration-200 origin-top-right ${isOpen
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <FontAwesomeIcon icon={activeTab === 'site' ? resolveIcon('fa-globe', faUserTie) : faUserTie} />
                        </div>
                        <span className="text-white font-bold text-lg">모드 선택</span>
                    </div>
                    <button
                        onClick={() => togglePanel('position')}
                        className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-lg transition-colors"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 gap-2 border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('site')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'site'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        사이트 모드
                    </button>
                    <button
                        onClick={() => setActiveTab('position')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'position'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        직책 모드
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {activeTab === 'site' ? (
                        <>
                            <p className="text-slate-400 text-xs mb-4">
                                이동할 현장을 선택하세요.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {filteredSites.map((site) => (
                                    <button
                                        key={site.key}
                                        onClick={() => changeSite && changeSite(site.key)}
                                        className={`relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 ${currentSite === site.key
                                            ? 'bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-lg scale-105'
                                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:scale-102'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${currentSite === site.key
                                            ? 'bg-white/20'
                                            : 'bg-slate-600'
                                            }`}>
                                            <FontAwesomeIcon icon={resolveIcon(site.icon, faUserTie)} className="text-lg" />
                                        </div>
                                        <span className="text-sm font-medium">{site.name}</span>
                                        {currentSite === site.key && (
                                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-400 text-xs mb-4">
                                직책을 선택하면 해당 직책에 맞는 메뉴가 표시됩니다.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {positions.map((pos) => (
                                    <button
                                        key={pos.id}
                                        onClick={() => changePosition(pos.id)}
                                        className={`relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 ${currentPosition === pos.id
                                            ? `bg-gradient-to-br ${pos.color} text-white shadow-lg scale-105`
                                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:scale-102'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${currentPosition === pos.id
                                            ? 'bg-white/20'
                                            : 'bg-slate-600'
                                            }`}>
                                            {/* @ts-ignore - FontAwesome library dynamic loading */}
                                            <FontAwesomeIcon icon={resolveIcon(pos.icon, faUserTie)} className="text-lg" />
                                        </div>
                                        <span className="text-sm font-medium">{pos.name}</span>
                                        {currentPosition === pos.id && (
                                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Info Section */}
                    <div className="mt-6 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                        <p className="text-slate-400 text-xs leading-relaxed">
                            💡 <strong className="text-slate-300">
                            {activeTab === 'site' ? '사이트 모드' : '직책 모드'}
                        </strong>
                        {activeTab === 'site'
                            ? '는 선택한 사이트의 메뉴와 데이터를 기반으로 화면을 구성합니다.'
                            : '는 권한과 관계없이 해당 직책의 메뉴 구성을 미리보기 할 수 있는 기능입니다.'}
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default PositionPanel;
