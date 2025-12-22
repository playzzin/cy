import React from 'react';
import { geminiService } from '../../services/geminiService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

const AIConfigurationSection: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCog} className="text-brand-600" />
                    AI 설정
                </h3>
            </div>
            <div className="p-6">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            className="flex-1 border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                            placeholder="API Key를 입력하세요"
                            defaultValue={geminiService.getKey() || ''}
                            onChange={(e) => geminiService.saveKey(e.target.value)}
                        />
                        <button
                            onClick={() => alert('저장되었습니다.')}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-bold"
                        >
                            저장
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        * 이미지를 분석하여 자동으로 정보를 입력하는데 사용됩니다. (일보 입력, 신분증 인식 등)
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIConfigurationSection;
