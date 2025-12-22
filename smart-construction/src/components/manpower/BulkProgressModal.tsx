import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImages } from '@fortawesome/free-solid-svg-icons';

interface BulkProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    progress: {
        current: number;
        total: number;
        success: number;
        fail: number;
    };
    logs: string[];
}

const BulkProgressModal: React.FC<BulkProgressModalProps> = ({ isOpen, onClose, progress, logs }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faImages} className="text-brand-600" /> 신분증 대량 등록
                </h2>

                <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-slate-700">진행률 ({progress.current}/{progress.total})</span>
                        <span className="text-slate-500">{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div
                            className="bg-brand-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-2">
                        <span className="text-green-600">성공: {progress.success}</span>
                        <span className="text-red-600">실패: {progress.fail}</span>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 h-48 overflow-y-auto text-xs space-y-1 font-mono border border-slate-200">
                    {logs.map((log, idx) => (
                        <div key={idx} className={log.startsWith('[실패]') ? 'text-red-600' : 'text-slate-600'}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-slate-400 text-center py-4">대기중...</div>}
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        disabled={progress.current < progress.total}
                        className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition ${progress.current < progress.total
                            ? 'bg-slate-300 cursor-not-allowed'
                            : 'bg-brand-600 hover:bg-brand-700'
                            }`}
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkProgressModal;
