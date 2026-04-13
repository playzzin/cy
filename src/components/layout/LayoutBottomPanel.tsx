import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCalculator, faNoteSticky, faUserGear, faCamera } from '@fortawesome/free-solid-svg-icons';
import Calculator from '../tools/Calculator';
import QuickMemoEditor from '../tools/QuickMemo';
import QuickCameraCapture from '../tools/QuickCameraCapture';

interface LayoutBottomPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'bottom') => void;
    currentSite?: string;
    changeSite?: (site: string) => void;
}

const LayoutBottomPanel: React.FC<LayoutBottomPanelProps> = ({
    isOpen,
    togglePanel
}) => {
    const LABEL_QUICK = '\ube60\ub978 \uc2e4\ud589';
    const LABEL_MEMO = '\uba54\ubaa8\uc7a5';
    const LABEL_CALC = '\uacc4\uc0b0\uae30';
    const LABEL_CAMERA = '\uce74\uba54\ub77c';
    const [activeTab, setActiveTab] = useState<'memo' | 'calculator' | 'camera'>('memo');

    useEffect(() => {
        if (!isOpen) {
            setActiveTab('memo');
        }
    }, [isOpen]);

    return (
        <aside id="bottom-panel" data-capture-exclude="true" className={`panel ${isOpen ? 'open' : ''}`}>
            <div className="flex flex-col border-b border-white/10">
                <div className="flex justify-between items-center px-4 py-3">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faUserGear} className="text-blue-400" />
                        <span className="font-bold text-lg tracking-tight">{LABEL_QUICK}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => togglePanel('bottom')}
                            className="w-8 h-8 rounded-md flex items-center justify-center transition-all hover:bg-white/10 active:scale-95"
                            style={{
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#fff'
                            }}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                </div>

                <div className="px-4 pb-3">
                    <div className="flex bg-black/30 rounded-lg p-1 gap-1 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('memo')}
                            className={`flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'memo'
                                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            <FontAwesomeIcon icon={faNoteSticky} />
                            {LABEL_MEMO}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('calculator')}
                            className={`flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'calculator'
                                ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            <FontAwesomeIcon icon={faCalculator} />
                            {LABEL_CALC}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('camera')}
                            className={`flex-1 sm:flex-none justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'camera'
                                ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            <FontAwesomeIcon icon={faCamera} />
                            {LABEL_CAMERA}
                        </button>
                    </div>
                </div>
            </div>

            <div className="panel-content p-4 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                {activeTab === 'memo' && <QuickMemoEditor />}
                {activeTab === 'calculator' && <Calculator />}
                {activeTab === 'camera' && <QuickCameraCapture />}
            </div>
        </aside>
    );
};

export default LayoutBottomPanel;
