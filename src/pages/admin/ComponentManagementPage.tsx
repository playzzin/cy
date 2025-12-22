
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCubes, faToggleOn, faToggleOff, faSync, faTools } from '@fortawesome/free-solid-svg-icons';
import { componentService, COMPONENT_REGISTRY, ComponentConfig } from '../../services/componentService';
import Swal from 'sweetalert2';

const ComponentManagementPage: React.FC = () => {
    const [components, setComponents] = useState<ComponentConfig[]>([]);

    useEffect(() => {
        // Load initial state
        updateList();

        const unsubscribe = componentService.subscribe(() => {
            updateList();
        });

        return () => unsubscribe();
    }, []);

    const updateList = () => {
        // Merge Registry with DB Service state
        const merged = COMPONENT_REGISTRY.map(reg => {
            const dbConfig = componentService.getConfig(reg.id);
            return dbConfig || reg;
        });
        setComponents(merged);
    };

    const handleToggle = async (id: string, currentState: boolean) => {
        try {
            await componentService.updateConfig(id, { isEnabled: !currentState });
        } catch (error) {
            console.error("Failed to toggle", error);
            Swal.fire("오류", "상태 변경 실패", "error");
        }
    };

    const handleReset = async () => {
        if (await Swal.fire({ title: '초기화 하시겠습니까?', text: '모든 설정이 기본값으로 돌아갑니다.', icon: 'warning', showCancelButton: true }).then(r => r.isConfirmed)) {
            await componentService.resetToRegistry();
            Swal.fire("완료", "초기화 되었습니다.", "success");
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <FontAwesomeIcon icon={faCubes} />
                        </span>
                        컴포넌트/기능 관리 (Feature Flags)
                    </h1>
                    <p className="text-slate-500 mt-1">시스템 내 주요 컴포넌트 및 기능의 사용 여부를 제어합니다.</p>
                </div>
                <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faSync} /> 초기화
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-20">상태</th>
                            <th className="p-4">컴포넌트 명</th>
                            <th className="p-4">카테고리</th>
                            <th className="p-4">설명</th>
                            <th className="p-4 w-32 text-center">제어</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {components.map(comp => (
                            <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <span className={`inline-flex w-3 h-3 rounded-full ${comp.isEnabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                </td>
                                <td className="p-4 font-bold text-slate-700">
                                    {comp.name}
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{comp.id}</div>
                                </td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">
                                        {comp.category}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-600 text-sm">
                                    {comp.description}
                                </td>
                                <td className="p-4 text-center">
                                    <button
                                        onClick={() => handleToggle(comp.id, comp.isEnabled)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 mx-auto transition-all ${comp.isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        <FontAwesomeIcon icon={comp.isEnabled ? faToggleOn : faToggleOff} />
                                        {comp.isEnabled ? 'ON' : 'OFF'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {components.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                        등록된 컴포넌트가 없습니다.
                    </div>
                )}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-3">
                <FontAwesomeIcon icon={faTools} className="mt-1" />
                <div>
                    <strong className="block mb-1">사용 가이드</strong>
                    <p>이 페이지에서 "OFF"로 설정하면, 해당 컴포넌트는 시스템 전체에서 즉시 비활성화(숨김 처리) 됩니다.</p>
                </div>
            </div>
        </div>
    );
};

export default ComponentManagementPage;
