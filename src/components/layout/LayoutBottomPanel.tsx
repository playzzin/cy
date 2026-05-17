import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCalculator, faCamera } from '@fortawesome/free-solid-svg-icons';
import Calculator from '../tools/Calculator';
import QuickCameraCapture from '../tools/QuickCameraCapture';

type QuickTool = 'calculator' | 'camera';

interface LayoutBottomPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'bottom') => void;
    activeTool: QuickTool;
    currentSite?: string;
    changeSite?: (site: string) => void;
}

const LayoutBottomPanel: React.FC<LayoutBottomPanelProps> = ({
    isOpen,
    togglePanel,
    activeTool
}) => {
    const LABEL_CALC = '\uacc4\uc0b0\uae30';
    const LABEL_CAMERA = '\uce74\uba54\ub77c';
    const activeLabel = activeTool === 'calculator' ? LABEL_CALC : LABEL_CAMERA;
    const activeIcon = activeTool === 'calculator' ? faCalculator : faCamera;

    return (
        <aside id="bottom-panel" data-capture-exclude="true" className={`panel ${isOpen ? 'open' : ''}`}>
            <div className="flex flex-col border-b border-white/10">
                <div className="flex justify-between items-center px-4 py-3">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={activeIcon} className={activeTool === 'calculator' ? 'text-green-400' : 'text-sky-400'} />
                        <span className="font-bold text-lg tracking-tight">{activeLabel}</span>
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
                            aria-label={`${activeLabel} 닫기`}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                </div>

            </div>

            <div className="panel-content p-4 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                {activeTool === 'calculator' && <Calculator />}
                {activeTool === 'camera' && <QuickCameraCapture />}
            </div>
        </aside>
    );
};

export default LayoutBottomPanel;
