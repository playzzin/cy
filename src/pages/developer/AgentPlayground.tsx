import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRobot,
    faPaperPlane,
    faSpinner,
    faCheckCircle,
    faExclamationTriangle,
    faClock,
    faChartLine,
    faCode,
    faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import { Agent, Task, AgentConversation, SUB_AGENT_TEMPLATES } from '../../types/agentTypes';
import { agentService, taskService, conversationService } from '../../services/agentService';
import { geminiService } from '../../services/geminiService';
import { AgentOrchestrator } from '../../services/agentOrchestrator';

const AgentPlayground: React.FC = () => {
    const [mainAgent, setMainAgent] = useState<Agent | null>(null);
    const [subAgents, setSubAgents] = useState<Agent[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [conversation, setConversation] = useState<AgentConversation | null>(null);
    const [userInput, setUserInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [orchestrator, setOrchestrator] = useState<AgentOrchestrator | null>(null);

    // 초기화: 메인 에이전트 생성
    useEffect(() => {
        initializeMainAgent();
    }, []);

    const initializeMainAgent = async () => {
        try {
            // 메인 에이전트 생성
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

            // 오케스트레이터 생성
            const orch = new AgentOrchestrator(mainAgentId);
            setOrchestrator(orch);

            // 대화 시작
            const conversationId = await conversationService.createConversation(mainAgentId, 'user-001');
            const conv = await conversationService.getConversation(conversationId);
            setConversation(conv);

        } catch (error) {
            console.error('Failed to initialize main agent:', error);
        }
    };

    // 사용자 메시지 전송
    const handleSendMessage = async () => {
        if (!userInput.trim() || !mainAgent || !conversation || !orchestrator) return;

        const currentInput = userInput;
        setUserInput('');
        setIsProcessing(true);

        try {
            // 사용자 메시지 추가
            await conversationService.addMessage(conversation.id, {
                role: 'user',
                content: currentInput
            });

            let updatedConv = await conversationService.getConversation(conversation.id);
            setConversation(updatedConv);

            // 메인 에이전트 상태 업데이트
            await agentService.updateAgentStatus(mainAgent.id, 'working');
            setMainAgent(prev => prev ? { ...prev, status: 'working' } : null);

            // 분석 중 메시지
            await conversationService.addMessage(conversation.id, {
                role: 'assistant',
                content: `🔍 요청을 분석하고 처리하고 있습니다...`,
                agentId: mainAgent.id
            });

            updatedConv = await conversationService.getConversation(conversation.id);
            setConversation(updatedConv);

            // 오케스트레이터로 처리
            const result = await orchestrator.processRequest(currentInput);

            // 최종 응답 추가
            await conversationService.addMessage(conversation.id, {
                role: 'assistant',
                content: result,
                agentId: mainAgent.id
            });

            // 완료 상태로 업데이트
            await agentService.updateAgentStatus(mainAgent.id, 'completed');
            setMainAgent(prev => prev ? { ...prev, status: 'completed' } : null);

            // 대화 갱신
            const finalConv = await conversationService.getConversation(conversation.id);
            setConversation(finalConv);

        } catch (error) {
            console.error('Failed to process message:', error);

            // 에러 메시지 추가
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

    // 상태 색상
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'idle': return 'text-slate-500';
            case 'working': return 'text-blue-500';
            case 'completed': return 'text-green-500';
            case 'error': return 'text-red-500';
            default: return 'text-slate-500';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faRobot} className="text-indigo-600" />
                            에이전트 놀이터
                        </h1>
                        <p className="text-slate-500 mt-1">
                            메인 에이전트가 서브 에이전트를 관리하며 작업을 처리합니다
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 메인 에이전트 */}
                    <div className="lg:col-span-1">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <FontAwesomeIcon icon={faRobot} />
                            메인 에이전트
                        </h3>
                        {mainAgent ? (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-indigo-900">{mainAgent.name}</span>
                                    <FontAwesomeIcon
                                        icon={getStatusIcon(mainAgent.status)}
                                        className={`${getStatusColor(mainAgent.status)} ${mainAgent.status === 'working' ? 'animate-spin' : ''}`}
                                    />
                                </div>
                                <p className="text-sm text-indigo-700">{mainAgent.role}</p>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400">
                                초기화 중...
                            </div>
                        )}

                        {/* 서브 에이전트 목록 */}
                        <h3 className="font-bold text-slate-700 mt-6 mb-3 flex items-center gap-2">
                            <FontAwesomeIcon icon={faRobot} />
                            서브 에이전트 ({subAgents.length})
                        </h3>
                        <div className="space-y-2">
                            {subAgents.length > 0 ? (
                                subAgents.map((agent) => (
                                    <div key={agent.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-slate-800 text-sm">{agent.name}</span>
                                            <FontAwesomeIcon
                                                icon={getStatusIcon(agent.status)}
                                                className={`${getStatusColor(agent.status)} text-sm`}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-600">{agent.role}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-400">
                                    아직 생성된 서브 에이전트가 없습니다
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 대화 영역 */}
                    <div className="lg:col-span-2">
                        <h3 className="font-bold text-slate-700 mb-3">💬 대화</h3>

                        {/* 메시지 목록 */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-96 overflow-y-auto mb-4">
                            {conversation && conversation.messages.length > 0 ? (
                                <div className="space-y-3">
                                    {conversation.messages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === 'user'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border border-slate-200 text-slate-800'
                                                }`}>
                                                {message.role !== 'user' && (
                                                    <div className="text-xs font-semibold mb-1 text-indigo-600">
                                                        🤖 {message.agentId === mainAgent?.id ? '메인 에이전트' : '서브 에이전트'}
                                                    </div>
                                                )}
                                                <p className="text-sm">{message.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400">
                                    메시지를 입력하여 대화를 시작하세요
                                </div>
                            )}
                        </div>

                        {/* 입력 영역 */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="작업을 입력하세요 (예: 지난달 일보 데이터 분석해줘)"
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={isProcessing}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isProcessing || !userInput.trim()}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors ${isProcessing || !userInput.trim()
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
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
    );
};

export default AgentPlayground;
