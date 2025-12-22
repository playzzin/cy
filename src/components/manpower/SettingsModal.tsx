import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { geminiService } from '../../services/geminiService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            const key = geminiService.getKey();
            if (key) setApiKey(key);
        }
    }, [isOpen]);

    const handleSave = () => {
        geminiService.saveKey(apiKey);
        onClose();
        alert('API Key가 저장되었습니다.');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faRobot} className="text-brand-600" /> AI 설정
                </h2>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
                    <input
                        type="password"
                        className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        placeholder="API Key를 입력하세요"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        * 이미지를 분석하여 자동으로 정보를 입력하는데 사용됩니다.
                    </p>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">취소</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700">저장</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
