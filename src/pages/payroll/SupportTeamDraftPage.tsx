import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandshake } from '@fortawesome/free-solid-svg-icons';

const SupportTeamDraftPage: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faHandshake} className="text-amber-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">지원팀</h1>
                        <p className="text-sm text-slate-500">준비중입니다. (일급제 완료 후 동일 UI 컨셉으로 구현 예정)</p>
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto w-full">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-slate-500">
                    지원팀 페이지는 다음 단계에서 구현합니다.
                </div>
            </div>
        </div>
    );
};

export default SupportTeamDraftPage;
