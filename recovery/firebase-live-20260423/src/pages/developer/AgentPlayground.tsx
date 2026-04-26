// src/pages/developer/AgentPlayground.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRobot,
    faPaperPlane,
    faSpinner,
    faCheckCircle,
    faExclamationTriangle,
    faClock,
    faSave,
    faFolderOpen,
    faTrash,
    faPlus,
    faTimes
} from '@fortawesome/free-solid-svg-icons';
import { Agent, AgentConversation, SUB_AGENT_TEMPLATES } from '../../types/agentTypes';
import { agentService, conversationService } from '../../services/agentService';
import { EnhancedAgentOrchestrator } from '../../services/agentOrchestrator';
import { conversationHistoryService, SavedConversation } from '../../services/conversationHistoryService';
import ProcessSteps, { ProcessStep } from './components/ProcessSteps';
import './AgentPlayground.css';
import Swal from 'sweetalert2';

const AgentPlayground: React.FC = () => {
    const [mainAgent, setMainAgent] = useState<Agent | null>(null);
    const [subAgents, setSubAgents] = useState<Agent[]>([]);
    const [conversation, setConversation] = useState<AgentConversation | null>(null);
    const [userInput, setUserInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [orchestrator, setOrchestrator] = useState<EnhancedAgentOrchestrator | null>(null);
    const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);

    // 서브에이전트 추가 모달
    const [showAddSubagent, setShowAddSubagent] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('');

    // 대화 히스토리
    const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // 메시지 영역 auto-scroll
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 초기화: 메인 에이전트 생성
    useEffect(() => {
        initializeMainAgent();
        loadSavedConversations();
    }, []);

    // 메시지 자동 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation?.messages]);

    const initializeMainAgent = async () => {
        try {
            const mainAgentId = await agentService.createAgent({
                name: '메인 오케스트레이터',
                type: 'main',
                role: '작업을 분석하고 적절한 서브 에이전트에게 작업을 할당하는 조율자',
                capabilities: ['작업 분석', '에이전트 관리', '결과 통합'],
                systemPrompt: `당신은 메인 에이전트입니다. 사용자의 요청을 분석하고 필요한 서브 에이전트를 생성하여 작업을 분배합니다.
가능한 서브 에이전트 타입: 데이터 분석가, 코드 생성기, 문서 작성가, 검증자
작업을 효율적으로 분배하고 결과를 통합하여 사용자에게 제공합니다.`,
                status: 'idle'
            });

            const agent: Agent = {
                id: mainAgentId,
                name: '메인 오케스트레이터',
                type: 'main',
                role: '작업 조율자',
                capabilities: ['작업 분석', '에이전트 관리', '결과 통합'],
                systemPrompt: '',
                status: 'idle',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            setMainAgent(agent);

            const orch = new EnhancedAgentOrchestrator(mainAgentId, {
                onProgress: (step) => {
                    setProcessSteps((prev) => {
                        const idx = prev.findIndex((s) => s.id === step.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = { ...next[idx], ...step };
                            return next;
                        }
                        return [...prev, step];
                    });
                }
            });
            setOrchestrator(orch);

            const conversationId = await conversationService.createConversation(mainAgentId, 'user-001');
            const conv = await conversationService.getConversation(conversationId);
            setConversation(conv);

        } catch (error) {
            console.error('Failed to initialize main agent:', error);
        }
    };

    // 저장된 대화 목록 불러오기
    const loadSavedConversations = async () => {
        try {
            const conversations = await conversationHistoryService.listConversations();
            setSavedConversations(conversations);
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    };

    // 사용자 메시지 전송
    const handleSendMessage = async () => {
        if (!userInput.trim() || !mainAgent || !conversation || !orchestrator) return;

        const currentInput = userInput;
        setUserInput('');
        setIsProcessing(true);
        setProcessSteps([]);

        try {
            await conversationService.addMessage(conversation.id, {
                role: 'user',
                content: currentInput
            });

            let updatedConv = await conversationService.getConversation(conversation.id);
            setConversation(updatedConv);

            await agentService.updateAgentStatus(mainAgent.id, 'working');
            setMainAgent(prev => prev ? { ...prev, status: 'working' } : null);

            await conversationService.addMessage(conversation.id, {
                role: 'assistant',
                content: `🔍 요청을 분석하고 처리하고 있습니다...`,
                agentId: mainAgent.id
            });

            updatedConv = await conversationService.getConversation(conversation.id);
            setConversation(updatedConv);

            const result = await orchestrator.processRequest(currentInput);

            await conversationService.addMessage(conversation.id, {
                role: 'assistant',
                content: result,
                agentId: mainAgent.id
            });

            await agentService.updateAgentStatus(mainAgent.id, 'completed');
            setMainAgent(prev => prev ? { ...prev, status: 'completed' } : null);

            const finalConv = await conversationService.getConversation(conversation.id);
            setConversation(finalConv);

        } catch (error) {
            console.error('Failed to process message:', error);

            if (conversation) {
                await conversationService.addMessage(conversation.id, {
                    role: 'assistant',
                    content: `❌ 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
                    agentId: mainAgent?.id
                });

                const errorConv = await conversationService.getConversation(conversation.id);
                setConversation(errorConv);
            }

            if (mainAgent) {
                await agentService.updateAgentStatus(mainAgent.id, 'error');
                setMainAgent(prev => prev ? { ...prev, status: 'error' } : null);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // 서브에이전트 수동 추가
    const handleAddSubagent = async () => {
        if (!selectedTemplate || !mainAgent) return;

        const template = SUB_AGENT_TEMPLATES[selectedTemplate];
        if (!template) return;

        try {
            const subAgentId = await agentService.createAgent({
                name: template.name,
                type: 'sub',
                role: template.role,
                capabilities: template.capabilities,
                systemPrompt: template.systemPrompt,
                status: 'idle',
                parentAgentId: mainAgent.id
            });

            const newSubAgent: Agent = {
                id: subAgentId,
                name: template.name,
                type: 'sub',
                role: template.role,
                capabilities: template.capabilities,
                systemPrompt: template.systemPrompt,
                status: 'idle',
                parentAgentId: mainAgent.id,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            setSubAgents(prev => [...prev, newSubAgent]);
            setShowAddSubagent(false);
            setSelectedTemplate('');

        } catch (error) {
            console.error('Failed to create subagent:', error);
        }
    };

    // 서브에이전트 삭제
    const handleDeleteSubagent = async (agentId: string) => {
        const result = await Swal.fire({
            title: '서브에이전트 삭제',
            text: '이 서브에이전트를 삭제하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소',
            background: '#1e293b',
            color: '#e2e8f0'
        });

        if (result.isConfirmed) {
            setSubAgents(prev => prev.filter(agent => agent.id !== agentId));
        }
    };

    // 대화 저장
    const handleSaveConversation = async () => {
        if (!conversation) return;

        const { value: title } = await Swal.fire({
            title: '대화 저장',
            input: 'text',
            inputLabel: '대화 제목을 입력하세요',
            inputPlaceholder: `대화 ${new Date().toLocaleDateString()}`,
            showCancelButton: true,
            confirmButtonText: '저장',
            cancelButtonText: '취소',
            background: '#1e293b',
            color: '#e2e8f0'
        });

        if (title) {
            try {
                await conversationHistoryService.saveConversation(conversation, title);
                await loadSavedConversations();

                Swal.fire({
                    icon: 'success',
                    title: '저장 완료',
                    text: '대화가 저장되었습니다.',
                    background: '#1e293b',
                    color: '#e2e8f0',
                    timer: 2000
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: '저장 실패',
                    text: '대화 저장 중 오류가 발생했습니다.',
                    background: '#1e293b',
                    color: '#e2e8f0'
                });
            }
        }
    };

    // 대화 불러오기
    const handleLoadConversation = async (conversationId: string) => {
        try {
            const saved = await conversationHistoryService.loadConversation(conversationId);
            if (saved) {
                setConversation(saved);
                setShowHistory(false);

                Swal.fire({
                    icon: 'success',
                    title: '불러오기 완료',
                    text: `"${saved.title}" 대화를 불러왔습니다.`,
                    background: '#1e293b',
                    color: '#e2e8f0',
                    timer: 2000
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '불러오기 실패',
                text: '대화 불러오기 중 오류가 발생했습니다.',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        }
    };

    // 대화 삭제
    const handleDeleteConversation = async (conversationId: string) => {
        const result = await Swal.fire({
            title: '대화 삭제',
            text: '이 대화를 삭제하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소',
            background: '#1e293b',
            color: '#e2e8f0'
        });

        if (result.isConfirmed) {
            try {
                await conversationHistoryService.deleteConversation(conversationId);
                await loadSavedConversations();

                Swal.fire({
                    icon: 'success',
                    title: '삭제 완료',
                    background: '#1e293b',
                    color: '#e2e8f0',
                    timer: 1500
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: '삭제 실패',
                    background: '#1e293b',
                    color: '#e2e8f0'
                });
            }
        }
    };

    // 상태 아이콘
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'idle': return faClock;
            case 'working': return faSpinner;
            case 'completed': return faCheckCircle;
            case 'error': return faExclamationTriangle;
            default: return faClock;
        }
    };

    // 상태 클래스
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'idle': return 'agent-badge-idle';
            case 'working': return 'agent-badge-working';
            case 'completed': return 'agent-badge-completed';
            case 'error': return 'agent-badge-error';
            default: return 'agent-badge-idle';
        }
    };

    return (
        <div className="agent-playground-container">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="agent-glass-card p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
                                <FontAwesomeIcon icon={faRobot} className="text-indigo-400 agent-neon-glow" />
                                AI 에이전트 플레이그라운드
                            </h1>
                            <p className="text-slate-400">
                                메인 에이전트가 서브 에이전트를 관리하며 작업을 처리합니다
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveConversation}
                                className="agent-button-secondary px-4 py-2"
                                disabled={!conversation || conversation.messages.length === 0}
                                title="대화 저장"
                            >
                                <FontAwesomeIcon icon={faSave} />
                            </button>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="agent-button-secondary px-4 py-2"
                                title="대화 히스토리"
                            >
                                <FontAwesomeIcon icon={faFolderOpen} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 왼쪽: 에이전트 패널 */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* 메인 에이전트 */}
                        <div className="agent-glass-card p-4">
                            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                                <FontAwesomeIcon icon={faRobot} className="text-indigo-400" />
                                메인 에이전트
                            </h3>
                            {mainAgent ? (
                                <div className={`agent-status-card ${mainAgent.status}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-white text-sm">{mainAgent.name}</span>
                                        <span className={`agent-badge ${getStatusClass(mainAgent.status)}`}>
                                            <FontAwesomeIcon
                                                icon={getStatusIcon(mainAgent.status)}
                                                className={mainAgent.status === 'working' ? 'agent-spin' : ''}
                                            />
                                            {mainAgent.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300">{mainAgent.role}</p>
                                    {mainAgent.status === 'working' && (
                                        <div className="agent-progress-bar mt-2">
                                            <div className="agent-progress-indeterminate"></div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center text-slate-400 py-4">
                                    <FontAwesomeIcon icon={faSpinner} spin className="mb-2" />
                                    <p className="text-sm">초기화 중...</p>
                                </div>
                            )}
                        </div>

                        {processSteps.length > 0 && (
                            <div className="agent-glass-card p-4">
                                <h3 className="font-bold text-white mb-3">진행 단계</h3>
                                <ProcessSteps steps={processSteps} />
                            </div>
                        )}

                        {/* 서브 에이전트 목록 */}
                        <div className="agent-glass-card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <FontAwesomeIcon icon={faRobot} className="text-blue-400" />
                                    서브 에이전트 ({subAgents.length})
                                </h3>
                                <button
                                    onClick={() => setShowAddSubagent(true)}
                                    className="agent-button text-xs px-2 py-1"
                                    title="서브에이전트 추가"
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto agent-scrollbar">
                                {subAgents.length > 0 ? (
                                    subAgents.map((agent) => (
                                        <div key={agent.id} className="agent-status-card">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-white text-xs">{agent.name}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className={`agent-badge ${getStatusClass(agent.status)}`}>
                                                        <FontAwesomeIcon icon={getStatusIcon(agent.status)} className="text-xs" />
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteSubagent(agent.id)}
                                                        className="text-red-400 hover:text-red-300 text-xs"
                                                        title="삭제"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400">{agent.role}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-slate-500 py-4 text-sm">
                                        서브 에이전트가 없습니다
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 대화 히스토리 (선택시) */}
                        {showHistory && (
                            <div className="agent-glass-card p-4 agent-fade-in">
                                <h3 className="font-bold text-white mb-3">
                                    💾 저장된 대화
                                </h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto agent-scrollbar">
                                    {savedConversations.length > 0 ? (
                                        savedConversations.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className="bg-slate-800/50 border border-slate-700 rounded p-2 hover:bg-slate-700/50 transition-colors cursor-pointer"
                                                onClick={() => handleLoadConversation(conv.id)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-white text-sm font-medium truncate">{conv.title}</p>
                                                        <p className="text-slate-400 text-xs">
                                                            {new Date(conv.updatedAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteConversation(conv.id);
                                                        }}
                                                        className="text-red-400 hover:text-red-300 text-xs ml-2"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-slate-500 text-sm text-center py-4">저장된 대화가 없습니다</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 오른쪽: 대화 영역 */}
                    <div className="lg:col-span-3">
                        <div className="agent-glass-card p-6 h-[calc(100vh-12rem)] flex flex-col">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                💬 대화
                                {conversation && conversation.messages.length > 0 && (
                                    <span className="text-sm font-normal text-slate-400">
                                        ({conversation.messages.length} 메시지)
                                    </span>
                                )}
                            </h3>

                            {/* 메시지 목록 */}
                            <div className="flex-1 overflow-y-auto agent-scrollbar mb-4 space-y-3">
                                {conversation && conversation.messages.length > 0 ? (
                                    <>
                                        {conversation.messages.map((message, index) => (
                                            <div
                                                key={index}
                                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} agent-fade-in`}
                                            >
                                                <div className={`max-w-[80%] ${message.role === 'user'
                                                    ? 'agent-message-user'
                                                    : message.role === 'system'
                                                        ? 'agent-message-system'
                                                        : 'agent-message-assistant'
                                                    }`}>
                                                    {message.role !== 'user' && (
                                                        <div className="text-xs font-semibold mb-1 text-indigo-300">
                                                            🤖 {message.agentId === mainAgent?.id ? '메인 에이전트' : '서브 에이전트'}
                                                        </div>
                                                    )}
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                    <p className="text-xs opacity-60 mt-1">
                                                        {new Date(message.timestamp).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                        <FontAwesomeIcon icon={faRobot} className="text-6xl mb-4 opacity-20" />
                                        <p className="text-lg">메시지를 입력하여 대화를 시작하세요</p>
                                        <p className="text-sm mt-2">예: "오늘 일보 몇 건 등록됐어?"</p>
                                    </div>
                                )}
                            </div>

                            {/* 입력 영역 */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder="작업을 입력하세요 (예: 지난달 일보 데이터 분석해줘)"
                                    className="flex-1 agent-input"
                                    disabled={isProcessing}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isProcessing || !userInput.trim()}
                                    className="agent-button px-6 py-3"
                                    title="전송"
                                >
                                    {isProcessing ? (
                                        <FontAwesomeIcon icon={faSpinner} spin />
                                    ) : (
                                        <FontAwesomeIcon icon={faPaperPlane} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 서브에이전트 추가 모달 */}
            {showAddSubagent && (
                <div className="agent-modal-overlay" onClick={() => setShowAddSubagent(false)}>
                    <div
                        className="agent-modal p-6 max-w-md w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">서브에이전트 추가</h3>
                            <button
                                onClick={() => setShowAddSubagent(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            템플릿 선택
                        </label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="agent-input w-full mb-4"
                        >
                            <option value="">-- 선택하세요 --</option>
                            {Object.entries(SUB_AGENT_TEMPLATES).map(([type, template]) => (
                                <option key={type} value={type}>
                                    {template.name} - {template.role}
                                </option>
                            ))}
                        </select>

                        {selectedTemplate && SUB_AGENT_TEMPLATES[selectedTemplate] && (
                            <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-3 mb-4">
                                <p className="text-sm text-white font-semibold mb-1">
                                    {SUB_AGENT_TEMPLATES[selectedTemplate].name}
                                </p>
                                <p className="text-xs text-indigo-300">
                                    {SUB_AGENT_TEMPLATES[selectedTemplate].role}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowAddSubagent(false);
                                    setSelectedTemplate('');
                                }}
                                className="flex-1 agent-button-secondary px-4 py-2"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddSubagent}
                                disabled={!selectedTemplate}
                                className="flex-1 agent-button px-4 py-2"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentPlayground;
