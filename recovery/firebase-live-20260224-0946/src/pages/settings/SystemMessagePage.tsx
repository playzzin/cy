import React, { useState, useEffect } from 'react';
import { MessageManager, MessageRule } from '../../constants/messages';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faCheck, faFlask, faUndo, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from '../../utils/swal';

// Simple ID generator
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const AVAILABLE_KEYS = [
    { key: 'SUCCESS.SAVE', label: '저장/등록 성공', default: '✔ {target} {count}건이 안전하게 저장되었습니다.' },
    { key: 'SUCCESS.DELETE', label: '삭제 성공', default: '🗑 {target} {count}건이 삭제되었습니다.' },
    { key: 'SUCCESS.UPDATE', label: '수정 성공', default: '✔ {target} 정보가 수정되었습니다.' },
    { key: 'SUCCESS.PROCESS', label: '일반 처리 완료', default: '✔ {action} 처리가 완료되었습니다.' },
    { key: 'ERROR.SAVE', label: '저장 실패', default: '❌ 저장 중 오류가 발생했습니다.' },
    { key: 'ERROR.DELETE', label: '삭제 실패', default: '❌ 삭제 중 오류가 발생했습니다.' },
    { key: 'ERROR.AUTH', label: '권한 없음', default: '❌ 권한이 없습니다.' },
    { key: 'CONFIRM.SAVE', label: '저장 확인', default: '정말 저장하시겠습니까?' },
    { key: 'CONFIRM.DELETE', label: '삭제 확인', default: '정말 삭제하시겠습니까? 복구할 수 없습니다.' },
    { key: 'CONFIRM.BATCH', label: '일괄 수정 확인', default: '선택한 {count}명의 {target} 정보를 일괄 수정하시겠습니까?' },
    { key: 'CONFIRM.OVERWRITE', label: '덮어쓰기 확인', default: '이미 {target} 데이터가 존재합니다. 덮어쓰시겠습니까?' },
];

// Pre-defined scenarios for "Easy Mode"
const PRESET_SCENARIOS = [
    { id: 'daily_save', label: '일보 등록 완료 시', key: 'SUCCESS.SAVE', conditions: { page: '/reports/daily' }, description: '일보 작성 페이지에서 저장을 완료했을 때 보여줄 메시지입니다.' },
    { id: 'worker_save', label: '근로자 등록 완료 시', key: 'SUCCESS.SAVE', conditions: { page: '/jeonkuk/worker-registration' }, description: '근로자 관리 페이지에서 저장을 완료했을 때 보여줄 메시지입니다.' },
    { id: 'team_save', label: '팀 등록 완료 시', key: 'SUCCESS.SAVE', conditions: { page: '/manpower/team-management' }, description: '팀 관리 페이지에서 저장을 완료했을 때 보여줄 메시지입니다.' },
    { id: 'site_save', label: '현장 등록 완료 시', key: 'SUCCESS.SAVE', conditions: { page: '/jeonkuk/site-registration' }, description: '현장 관리 페이지에서 저장을 완료했을 때 보여줄 메시지입니다.' },
    { id: 'admin_login', label: '관리자 작업 완료 시', key: 'SUCCESS.SAVE', conditions: { role: 'admin' }, description: '관리자 권한으로 데이터를 저장했을 때 보여줄 메시지입니다.' },
    // Error Scenarios
    { id: 'error_save', label: '저장 실패 시', key: 'ERROR.SAVE', conditions: {}, description: '데이터 저장 중에 오류가 발생했을 때 보여줄 경고 메시지입니다.' },
    { id: 'error_auth', label: '권한 부족 시', key: 'ERROR.AUTH', conditions: {}, description: '허용되지 않은 작업을 시도했을 때 보여줄 경고 메시지입니다.' },
    // Confirm Scenarios
    { id: 'confirm_save', label: '저장 확인 창', key: 'CONFIRM.SAVE', conditions: {}, description: '데이터를 저장하기 전에 물어보는 확인 창의 문구입니다.' },
    { id: 'confirm_delete', label: '삭제 확인 창', key: 'CONFIRM.DELETE', conditions: {}, description: '데이터를 삭제하기 전에 물어보는 확인 창의 문구입니다.' },
    { id: 'confirm_batch', label: '일괄 수정 확인 창', key: 'CONFIRM.BATCH', conditions: {}, description: '여러 데이터를 한꺼번에 수정할 때 물어보는 확인 창입니다.' },
    { id: 'confirm_overwrite', label: '덮어쓰기 확인 창', key: 'CONFIRM.OVERWRITE', conditions: {}, description: '이미 데이터가 있을 때 덮어쓸지 물어보는 확인 창입니다.' },
];

const PRESET_COLORS = [
    { label: '기본 (하양)', value: '' },
    { label: '성공 (녹색)', value: '#2ecc71' },
    { label: '주의 (파랑)', value: '#3498db' },
    { label: '경고 (주황)', value: '#e67e22' },
    { label: '위험 (빨강)', value: '#e74c3c' },
    { label: '고급 (보라)', value: '#9b59b6' },
    { label: '다크 (검정)', value: '#34495e' },
];

const PRESET_SOUNDS = [
    { label: '없음', value: '' },
    { label: '성공 (띠링)', value: 'success' },
    { label: '알림 (뿅)', value: 'chime' },
    { label: '에러 (삐빅)', value: 'error' },
];

const SystemMessagePage: React.FC = () => {
    const [rules, setRules] = useState<MessageRule[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<MessageRule>>({});

    // Test Playground
    const [testResult, setTestResult] = useState('');

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = () => {
        setRules(MessageManager.getRules());
    };

    const handleSaveRule = () => {
        if (!editingRule.key || !editingRule.template) {
            alert('메시지 내용을 입력해주세요.');
            return;
        }

        const newRule: MessageRule = {
            id: editingRule.id || generateId(),
            key: editingRule.key,
            template: editingRule.template,
            conditions: editingRule.conditions || {},
            priority: 10,
            style: editingRule.style
        };

        // Remove existing rule with same ID if update
        let updatedRules = [...rules];
        if (editingRule.id) {
            updatedRules = updatedRules.map(r => r.id === editingRule.id ? newRule : r);
        } else {
            updatedRules.push(newRule);
        }

        MessageManager.saveRules(updatedRules);
        setRules(updatedRules);
        setIsModalOpen(false);
        setEditingRule({});
        toast.saved('설정', 1);
    };

    const handleDeleteRule = (id: string) => {
        if (!window.confirm('기본 메시지로 되돌리시겠습니까?')) return;
        const updatedRules = rules.filter(r => r.id !== id);
        MessageManager.saveRules(updatedRules);
        setRules(updatedRules);
        toast.deleted('설정', 1);
    };

    const findRuleForPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
        return rules.find(r =>
            r.key === preset.key &&
            JSON.stringify(r.conditions) === JSON.stringify(preset.conditions)
        );
    };

    const openPresetEdit = (preset: typeof PRESET_SCENARIOS[0]) => {
        const existing = findRuleForPreset(preset);
        setEditingRule({
            id: existing?.id,
            key: preset.key,
            conditions: preset.conditions,
            template: existing?.template || AVAILABLE_KEYS.find(k => k.key === preset.key)?.default || '',
            style: existing?.style || { color: '', sound: '' }
        });
        setIsModalOpen(true);
    };

    const runSimulation = (preset: typeof PRESET_SCENARIOS[0]) => {
        const originalContext = { ...(MessageManager as any).context };

        // Mock Context
        (MessageManager as any).setContext({
            role: preset.conditions.role || '',
            page: preset.conditions.page || ''
        });

        // The get method now returns an object { text, style }
        const result = MessageManager.get(
            preset.key,
            'DEFAULT',
            { target: '테스트 데이터', count: 5, action: '처리' }
        ) as unknown as { text: string }; // Cast for easy display stringification if needed, but get returns MessageResult

        setTestResult(`[${preset.label}] 결과: "${result.text}"`);

        // Restore
        (MessageManager as any).context = originalContext;
    };

    const playPreviewSound = (sound: string) => {
        let audioSrc = '';
        switch (sound) {
            case 'success': audioSrc = 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'; break;
            case 'error': audioSrc = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'; break;
            case 'chime': audioSrc = 'https://actions.google.com/sounds/v1/cartoon/pop.ogg'; break;
            default: break;
        }
        if (audioSrc) new Audio(audioSrc).play().catch(() => { });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">시스템 알림 메시지 설정</h1>
                <p className="text-slate-500">각 상황별 알림 메시지, 색상, 소리를 쉽고 간편하게 변경해보세요.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {PRESET_SCENARIOS.map(preset => {
                    const activeRule = findRuleForPreset(preset);
                    const defaultMsg = AVAILABLE_KEYS.find(k => k.key === preset.key)?.default;
                    const currentMsg = activeRule ? activeRule.template : defaultMsg;
                    const currentColor = activeRule?.style?.color;

                    return (
                        <div key={preset.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-2 transition-colors`} style={{ backgroundColor: currentColor || '#e2e8f0' }}></div>

                            <div className="flex flex-col md:flex-row justify-between items-center gap-6 pl-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-slate-800">{preset.label}</h3>
                                        {activeRule ? (
                                            <span className="px-2.5 py-1 bg-brand-100 text-brand-700 text-xs rounded-full font-bold">사용자 설정됨</span>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs rounded-full font-bold">기본 사용중</span>
                                        )}
                                        {activeRule?.style?.sound && (
                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1">
                                                <i className="fas fa-volume-up"></i>
                                                {PRESET_SOUNDS.find(s => s.value === activeRule.style?.sound)?.label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm mb-4">{preset.description}</p>

                                    <div
                                        className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3 transition-colors"
                                        style={currentColor ? { backgroundColor: currentColor, color: 'white', borderColor: 'transparent' } : {}}
                                    >
                                        <div className={`mt-0.5 ${currentColor ? 'text-white' : 'text-slate-400'}`}>
                                            <FontAwesomeIcon icon={faFlask} />
                                        </div>
                                        <div>
                                            <div className={`text-xs font-bold mb-1 ${currentColor ? 'text-white/80' : 'text-slate-400'}`}>현재 적용 중인 메시지</div>
                                            <div className="font-medium text-lg">"{currentMsg}"</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 w-full md:w-auto">
                                    <button
                                        onClick={() => openPresetEdit(preset)}
                                        className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-w-[140px]"
                                    >
                                        <FontAwesomeIcon icon={faEdit} />
                                        꾸미기
                                    </button>

                                    {activeRule && (
                                        <button
                                            onClick={() => handleDeleteRule(activeRule.id)}
                                            className="px-6 py-3 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={faUndo} />
                                            초기화
                                        </button>
                                    )}

                                    <button
                                        onClick={() => runSimulation(preset)}
                                        className="px-6 py-2 text-xs text-slate-400 hover:text-brand-600 font-bold underline decoration-dotted underline-offset-4"
                                    >
                                        테스트 하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {testResult && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl animate-fade-in-up z-40 flex items-center gap-3">
                    <FontAwesomeIcon icon={faFlask} className="text-brand-400" />
                    <span className="font-bold">{testResult}</span>
                    <button onClick={() => setTestResult('')} className="ml-2 text-slate-400 hover:text-white"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in-up overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">메시지 꾸미기</h3>
                                <p className="text-sm text-slate-500 mt-1">문구, 색상, 소리를 자유롭게 수정하세요.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">메시지 내용</label>
                                <input
                                    type="text"
                                    value={editingRule.template || ''}
                                    onChange={(e) => setEditingRule({ ...editingRule, template: e.target.value })}
                                    className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-xl font-bold text-slate-800 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">배경 색상</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color.label}
                                            onClick={() => setEditingRule({ ...editingRule, style: { ...editingRule.style, color: color.value } })}
                                            className={`w-10 h-10 rounded-full border-2 transition-all shadow-sm flex items-center justify-center ${editingRule.style?.color === color.value ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'
                                                }`}
                                            style={color.value ? { backgroundColor: color.value } : { backgroundColor: '#f1f5f9', border: '2px solid #cbd5e1' }}
                                            title={color.label}
                                        >
                                            {editingRule.style?.color === color.value && <FontAwesomeIcon icon={faCheck} className={`text-sm ${!color.value ? 'text-slate-600' : 'text-white'}`} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">효과음</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {PRESET_SOUNDS.map(sound => (
                                        <div
                                            key={sound.value}
                                            onClick={() => {
                                                setEditingRule({ ...editingRule, style: { ...editingRule.style, sound: sound.value } });
                                                if (sound.value) playPreviewSound(sound.value);
                                            }}
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${editingRule.style?.sound === sound.value
                                                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                                }`}
                                        >
                                            <span className="font-bold text-sm">{sound.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 p-4 bg-slate-50 text-slate-600 rounded-xl text-xs border border-slate-100">
                                <p className="font-bold mb-2">💡 팁</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>색상을 선택하면 알림창이 눈에 확 띕니다.</li>
                                    <li>소리를 설정하면 작업 완료를 청각적으로 알 수 있습니다.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3 sticky bottom-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-3 text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-xl text-sm font-bold transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveRule}
                                className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 transition-transform active:scale-95"
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemMessagePage;
