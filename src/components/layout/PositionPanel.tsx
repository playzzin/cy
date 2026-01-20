import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUserTie } from '@fortawesome/free-solid-svg-icons';
import { PositionItem } from '../../types/menu';
import { resolveIcon } from '../../constants/iconMap';

interface PositionPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'position') => void;
    currentPosition: string;
    changePosition: (positionId: string) => void;
    positions?: PositionItem[];
}

const PositionPanel: React.FC<PositionPanelProps> = ({
    isOpen,
    togglePanel,
    currentPosition,
    changePosition,
    positions = []
}) => {



    return (
        <div
            id="position-panel"
            className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <span className="text-white font-bold text-lg">직책 모드</span>
                <button
                    onClick={() => togglePanel('position')}
                    className="text-white hover:bg-slate-700 p-2 rounded-lg transition-colors"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>

            {/* Position Grid */}
            <div className="p-4">
                <p className="text-slate-400 text-xs mb-4">
                    직책을 선택하면 해당 직책에 맞는 메뉴가 표시됩니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {positions.map((pos) => (
                        <button
                            key={pos.id}
                            onClick={() => {
                                changePosition(pos.id);
                                togglePanel('position'); // Close panel on selection
                            }}
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

                {/* Info Section */}
                <div className="mt-6 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                    <p className="text-slate-400 text-xs leading-relaxed">
                        💡 <strong className="text-slate-300">직책별 메뉴</strong>는 메뉴관리에서 설정할 수 있습니다.
                        각 직책에 필요한 메뉴만 표시되도록 커스터마이징할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PositionPanel;
