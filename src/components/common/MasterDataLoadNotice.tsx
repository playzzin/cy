import React from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';

const MasterDataLoadNotice: React.FC = () => {
    const { loadErrors = {} } = useMasterData();
    const messages = Array.from(new Set(Object.values(loadErrors).filter(Boolean)));
    if (!messages.length) return null;
    return (
        <div role="alert" className="relative z-20 m-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:m-5">
            <p className="font-bold">일부 업무 데이터를 불러오지 못했습니다</p>
            {messages.map(message => <p key={message} className="mt-2 leading-6">{message}</p>)}
            <p className="mt-2 leading-6">데이터가 없는 상태와는 다릅니다. 연결을 수정한 뒤 다시 불러와 주세요.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 font-bold">
                다시 불러오기
            </button>
        </div>
    );
};

export default MasterDataLoadNotice;
