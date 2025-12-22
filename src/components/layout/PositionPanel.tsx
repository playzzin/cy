import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faCrown,
    faUserTie,
    faUserGear,
    faUsers,
    faUser,
    faUserPlus,
    faShieldHalved
} from '@fortawesome/free-solid-svg-icons';

// 직책 목록 (full = 전체 메뉴)
const POSITIONS = [
    { id: 'full', name: '전체 메뉴', icon: faShieldHalved, color: 'from-red-600 to-red-400' },
    { id: 'ceo', name: '대표', icon: faCrown, color: 'from-amber-500 to-yellow-400' },
    { id: 'manager1', name: '메니저1', icon: faUserTie, color: 'from-blue-600 to-blue-400' },
    { id: 'manager2', name: '메니저2', icon: faUserTie, color: 'from-indigo-600 to-indigo-400' },
    { id: 'manager3', name: '메니저3', icon: faUserTie, color: 'from-purple-600 to-purple-400' },
    { id: 'teamLead', name: '팀장', icon: faUserGear, color: 'from-emerald-600 to-emerald-400' },
    { id: 'foreman', name: '반장', icon: faUsers, color: 'from-teal-600 to-teal-400' },
    { id: 'general', name: '일반', icon: faUser, color: 'from-slate-500 to-slate-400' },
    { id: 'newbie', name: '신규', icon: faUserPlus, color: 'from-pink-500 to-rose-400' },
];

interface PositionPanelProps {
    isOpen: boolean;
    togglePanel: (type: 'position') => void;
    currentPosition: string;
    changePosition: (positionId: string) => void;
}

const PositionPanel: React.FC<PositionPanelProps> = ({
    isOpen,
    togglePanel,
    currentPosition,
    changePosition
}) => {
    return (
        <aside
            id="position-panel"
            className={`fixed top-0 right-0 h-full w-72 bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
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
                    {POSITIONS.map((pos) => (
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
                                <FontAwesomeIcon icon={pos.icon} className="text-lg" />
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
        </aside>
    );
};

export default PositionPanel;
export { POSITIONS };
