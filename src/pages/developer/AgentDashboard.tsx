/**
 * AI 에이전트 대시보드
 * - 서브 에이전트 생성/관리
 * - 작업 분배 및 실행
 * - 협업 세션 관리
 * - 실시간 상태 모니터링
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRobot,
    faPlus,
    faPlay,
    faStop,
    faSyncAlt,
    faUsers,
    faTasks,
    faProjectDiagram,
    faChartBar,
    faSpinner,
    faCheckCircle,
    faExclamationTriangle,
    faClock,
    faTimes,
    faPaperPlane,
    faCogs,
    faBolt,
    faNetworkWired,
    faEye
} from '@fortawesome/free-solid-svg-icons';
import {
    AGENT_NAMES,
    type AgentId
} from '../../services/agentExecutionService';
import {
    createSubAgent,
    createAgentTeam,
    getSubAgents,
    terminateSubAgent,
    distributeTasks,
    executeTask,
    createCollaboration,
    startCollaboration,
    getCollaboration,
    endCollaboration,
    type SubAgentInstance,
    type TaskAssignment,
    type TaskResult,
    type CollaborationSessionInfo,
    type CollaborationResult
} from '../../services/subAgentService';
import Swal from 'sweetalert2';
import './AgentPlayground.css';

// ============================================
// 상수
// ============================================

const ALL_AGENT_IDS: AgentId[] = [
    'planner', 'frontend', 'backend', 'qa', 'tester',
    'designer', 'db_engineer', 'security', 'refactor',
    'sequential', 'debugger', 'healer'
];

const TEAM_PRESETS = [
    {
        name: '기능 개발팀',
        agents: [
            { agentId: 'planner' as AgentId, count: 1 },
            { agentId: 'frontend' as AgentId, count: 1 },
            { agentId: 'backend' as AgentId, count: 1 },
            { agentId: 'qa' as AgentId, count: 1 }
        ]
    },
    {
        name: '긴급 대응팀',
        agents: [
            { agentId: 'debugger' as AgentId, count: 1 },
            { agentId: 'healer' as AgentId, count: 1 },
            { agentId: 'tester' as AgentId, count: 1 }
        ]
    },
    {
        name: '리뷰팀',
        agents: [
            { agentId: 'security' as AgentId, count: 1 },
            { agentId: 'qa' as AgentId, count: 1 },
            { agentId: 'refactor' as AgentId, count: 1 }
        ]
    }
];

const DISTRIBUTION_STRATEGIES = [
    { id: 'load_balanced', name: '부하 균형', desc: '작업 부하를 균등하게 분배' },
    { id: 'capability_based', name: '능력 기반', desc: '에이전트 능력에 맞게 배정' },
    { id: 'round_robin', name: '라운드 로빈', desc: '순서대로 돌아가며 배정' },
    { id: 'priority_based', name: '우선순위 기반', desc: '우선순위에 따라 배정' }
] as const;

// ============================================
// 헬퍼 함수
// ============================================

function getStateColor(state: string): string {
    switch (state) {
        case 'idle': return 'text-blue-400';
        case 'created': return 'text-slate-400';
        case 'busy': return 'text-yellow-400';
        case 'completed': return 'text-green-400';
        case 'failed': return 'text-red-400';
        case 'terminated': return 'text-slate-600';
        default: return 'text-slate-400';
    }
}

function getStateBg(state: string): string {
    switch (state) {
        case 'idle': return 'bg-blue-500/20 border-blue-500/30';
        case 'created': return 'bg-slate-500/20 border-slate-500/30';
        case 'busy': return 'bg-yellow-500/20 border-yellow-500/30';
        case 'completed': return 'bg-green-500/20 border-green-500/30';
        case 'failed': return 'bg-red-500/20 border-red-500/30';
        case 'terminated': return 'bg-slate-700/20 border-slate-700/30';
        default: return 'bg-slate-500/20 border-slate-500/30';
    }
}

function getStateIcon(state: string) {
    switch (state) {
        case 'idle': return faClock;
        case 'created': return faPlus;
        case 'busy': return faSpinner;
        case 'completed': return faCheckCircle;
        case 'failed': return faExclamationTriangle;
        case 'terminated': return faStop;
        default: return faClock;
    }
}

function formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================
// 메인 컴포넌트
// ============================================

type TabId = 'agents' | 'tasks' | 'collaboration' | 'monitor';

const AgentDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('agents');
    const [loading, setLoading] = useState(false);

    // 서브 에이전트 상태
    const [subAgents, setSubAgents] = useState<SubAgentInstance[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('planner');

    // 작업 분배 상태
    const [taskDescriptions, setTaskDescriptions] = useState<string[]>(['']);
    const [taskPriorities, setTaskPriorities] = useState<string[]>(['medium']);
    const [strategy, setStrategy] = useState<string>('load_balanced');
    const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
    const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
    const [distributionReasoning, setDistributionReasoning] = useState('');

    // 협업 상태
    const [collaborationSessions, setCollaborationSessions] = useState<CollaborationSessionInfo[]>([]);
    const [showCollabModal, setShowCollabModal] = useState(false);
    const [collabForm, setCollabForm] = useState({
        name: '',
        goal: '',
        orchestratorAgentId: 'planner' as AgentId,
        participantAgentIds: ['frontend', 'backend'] as AgentId[]
    });
    const [collabResults, setCollabResults] = useState<CollaborationResult | null>(null);
    const [activeCollabSession, setActiveCollabSession] = useState<string | null>(null);

    // ============================================
    // 데이터 로드
    // ============================================

    const loadSubAgents = useCallback(async () => {
        setLoading(true);
        try {
            const agents = await getSubAgents();
            setSubAgents(agents);
        } catch (error) {
            console.error('Failed to load sub-agents:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSubAgents();
    }, [loadSubAgents]);

    // ============================================
    // 서브 에이전트 관리
    // ============================================

    const handleCreateSubAgent = async () => {
        try {
            setLoading(true);
            const instance = await createSubAgent(selectedAgentId);
            setSubAgents(prev => [...prev, instance]);
            setShowCreateModal(false);

            Swal.fire({
                icon: 'success',
                title: '에이전트 생성 완료',
                text: `${AGENT_NAMES[selectedAgentId]} 에이전트가 생성되었습니다.`,
                background: '#1e293b',
                color: '#e2e8f0',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '생성 실패',
                text: error instanceof Error ? error.message : '에이전트 생성에 실패했습니다.',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async (preset: typeof TEAM_PRESETS[0]) => {
        try {
            setLoading(true);
            const result = await createAgentTeam(preset.name, preset.agents);
            setSubAgents(prev => [...prev, ...result.instances]);
            setShowTeamModal(false);

            Swal.fire({
                icon: 'success',
                title: '팀 생성 완료',
                text: `"${preset.name}" (${result.instances.length}명) 생성됨`,
                background: '#1e293b',
                color: '#e2e8f0',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '팀 생성 실패',
                text: error instanceof Error ? error.message : '팀 생성에 실패했습니다.',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTerminate = async (instanceId: string) => {
        const confirm = await Swal.fire({
            title: '에이전트 종료',
            text: '이 에이전트를 종료하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '종료',
            cancelButtonText: '취소',
            background: '#1e293b',
            color: '#e2e8f0'
        });

        if (!confirm.isConfirmed) return;

        try {
            await terminateSubAgent(instanceId);
            setSubAgents(prev =>
                prev.map(a => a.instanceId === instanceId ? { ...a, state: 'terminated' } : a)
            );
        } catch (error) {
            console.error('Failed to terminate:', error);
        }
    };

    // ============================================
    // 작업 분배
    // ============================================

    const handleAddTask = () => {
        setTaskDescriptions(prev => [...prev, '']);
        setTaskPriorities(prev => [...prev, 'medium']);
    };

    const handleRemoveTask = (index: number) => {
        setTaskDescriptions(prev => prev.filter((_, i) => i !== index));
        setTaskPriorities(prev => prev.filter((_, i) => i !== index));
    };

    const handleDistribute = async () => {
        const validTasks = taskDescriptions
            .map((desc, i) => ({ description: desc.trim(), priority: taskPriorities[i] as 'low' | 'medium' | 'high' | 'critical' }))
            .filter(t => t.description);

        if (validTasks.length === 0) {
            Swal.fire({ icon: 'warning', title: '작업을 입력하세요', background: '#1e293b', color: '#e2e8f0' });
            return;
        }

        const idleAgents = subAgents.filter(a => a.state === 'idle' || a.state === 'created');
        if (idleAgents.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: '가용 에이전트 없음',
                text: '먼저 에이전트를 생성하세요.',
                background: '#1e293b',
                color: '#e2e8f0'
            });
            return;
        }

        try {
            setLoading(true);
            const result = await distributeTasks(validTasks, strategy as 'round_robin' | 'load_balanced' | 'capability_based' | 'priority_based');
            setAssignments(result.assignments);
            setDistributionReasoning(result.reasoning);

            Swal.fire({
                icon: 'success',
                title: '작업 분배 완료',
                text: `${result.assignments.length}건 할당, ${result.unassignedTasks.length}건 미할당`,
                background: '#1e293b',
                color: '#e2e8f0',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '분배 실패',
                text: error instanceof Error ? error.message : '작업 분배에 실패했습니다.',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteTask = async (taskId: string) => {
        try {
            setLoading(true);
            const result = await executeTask(taskId);
            setTaskResults(prev => [...prev, result]);
            await loadSubAgents();

            Swal.fire({
                icon: result.status === 'completed' ? 'success' : 'error',
                title: result.status === 'completed' ? '작업 완료' : '작업 실패',
                text: result.status === 'completed'
                    ? `${formatTime(result.executionTime)} 소요`
                    : result.error || '실행 중 오류',
                background: '#1e293b',
                color: '#e2e8f0',
                timer: 3000
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '실행 실패',
                text: error instanceof Error ? error.message : '작업 실행에 실패했습니다.',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // 협업 세션
    // ============================================

    const handleCreateCollaboration = async () => {
        if (!collabForm.name.trim() || !collabForm.goal.trim()) {
            Swal.fire({ icon: 'warning', title: '이름과 목표를 입력하세요', background: '#1e293b', color: '#e2e8f0' });
            return;
        }

        try {
            setLoading(true);
            const session = await createCollaboration({
                name: collabForm.name,
                goal: collabForm.goal,
                orchestratorAgentId: collabForm.orchestratorAgentId,
                participantAgentIds: collabForm.participantAgentIds
            });

            setCollaborationSessions(prev => [...prev, session]);
            setShowCollabModal(false);
            setCollabForm({ name: '', goal: '', orchestratorAgentId: 'planner', participantAgentIds: ['frontend', 'backend'] });

            Swal.fire({
                icon: 'success',
                title: '협업 세션 생성',
                text: `"${session.name}" 세션이 생성되었습니다.`,
                background: '#1e293b',
                color: '#e2e8f0',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '세션 생성 실패',
                text: error instanceof Error ? error.message : '',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStartCollaboration = async (sessionId: string) => {
        const { value: task } = await Swal.fire({
            title: '협업 작업 입력',
            input: 'textarea',
            inputLabel: '에이전트들이 협업할 작업을 입력하세요',
            inputPlaceholder: '예: 로그인 페이지 구현',
            showCancelButton: true,
            confirmButtonText: '시작',
            cancelButtonText: '취소',
            background: '#1e293b',
            color: '#e2e8f0'
        });

        if (!task) return;

        try {
            setLoading(true);
            setActiveCollabSession(sessionId);
            const result = await startCollaboration(sessionId, task);
            setCollabResults(result);

            // 세션 상태 업데이트
            const updated = await getCollaboration(sessionId);
            setCollaborationSessions(prev =>
                prev.map(s => s.sessionId === sessionId ? updated : s)
            );

            Swal.fire({
                icon: result.success ? 'success' : 'error',
                title: result.success ? '협업 완료' : '협업 실패',
                text: `${result.results.length}개 에이전트 결과, ${result.artifactsCount}개 아티팩트`,
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '협업 시작 실패',
                text: error instanceof Error ? error.message : '',
                background: '#1e293b',
                color: '#e2e8f0'
            });
        } finally {
            setLoading(false);
            setActiveCollabSession(null);
        }
    };

    const handleEndCollaboration = async (sessionId: string) => {
        try {
            await endCollaboration(sessionId);
            setCollaborationSessions(prev =>
                prev.map(s => s.sessionId === sessionId ? { ...s, status: 'completed' as const } : s)
            );
        } catch (error) {
            console.error('Failed to end collaboration:', error);
        }
    };

    // ============================================
    // 모니터 통계
    // ============================================

    const stats = {
        total: subAgents.length,
        idle: subAgents.filter(a => a.state === 'idle' || a.state === 'created').length,
        busy: subAgents.filter(a => a.state === 'busy').length,
        completed: subAgents.filter(a => a.state === 'completed').length,
        failed: subAgents.filter(a => a.state === 'failed').length,
        terminated: subAgents.filter(a => a.state === 'terminated').length,
        activeSessions: collaborationSessions.filter(s => s.status === 'active').length,
        totalTasks: assignments.length,
        completedTasks: taskResults.filter(r => r.status === 'completed').length
    };

    // ============================================
    // 탭 설정
    // ============================================

    const tabs: { id: TabId; label: string; icon: typeof faRobot }[] = [
        { id: 'agents', label: '에이전트 관리', icon: faRobot },
        { id: 'tasks', label: '작업 분배', icon: faTasks },
        { id: 'collaboration', label: '협업 세션', icon: faProjectDiagram },
        { id: 'monitor', label: '모니터링', icon: faChartBar }
    ];

    // ============================================
    // 렌더링
    // ============================================

    return (
        <div className="agent-playground-container">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="agent-glass-card p-6 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                <FontAwesomeIcon icon={faNetworkWired} className="text-indigo-400 agent-neon-glow" />
                                서브 에이전트 대시보드
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                에이전트 생성 · 작업 분배 · 협업 · 모니터링
                            </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-blue-400">
                                <FontAwesomeIcon icon={faRobot} /> {stats.total}
                            </span>
                            <span className="flex items-center gap-1 text-green-400">
                                <FontAwesomeIcon icon={faCheckCircle} /> {stats.completedTasks}
                            </span>
                            <span className="flex items-center gap-1 text-purple-400">
                                <FontAwesomeIcon icon={faProjectDiagram} /> {stats.activeSessions}
                            </span>
                            <button
                                onClick={loadSubAgents}
                                className="agent-button-secondary px-3 py-1.5 text-xs"
                                disabled={loading}
                            >
                                <FontAwesomeIcon icon={faSyncAlt} spin={loading} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-white'
                            }`}
                        >
                            <FontAwesomeIcon icon={tab.icon} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ============================================ */}
                {/* 탭 1: 에이전트 관리 */}
                {/* ============================================ */}
                {activeTab === 'agents' && (
                    <div className="space-y-6">
                        {/* 액션 바 */}
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="agent-button px-4 py-2 text-sm"
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                에이전트 생성
                            </button>
                            <button
                                onClick={() => setShowTeamModal(true)}
                                className="agent-button-secondary px-4 py-2 text-sm"
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" />
                                팀 생성
                            </button>
                        </div>

                        {/* 에이전트 그리드 */}
                        {subAgents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {subAgents.map(agent => (
                                    <div
                                        key={agent.instanceId}
                                        className={`agent-glass-card p-4 border ${getStateBg(agent.state)}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faRobot} className={getStateColor(agent.state)} />
                                                <div>
                                                    <p className="font-semibold text-white text-sm">
                                                        {AGENT_NAMES[agent.agentId] || agent.agentId}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-mono">
                                                        {agent.instanceId.substring(0, 20)}...
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getStateBg(agent.state)} ${getStateColor(agent.state)}`}>
                                                <FontAwesomeIcon
                                                    icon={getStateIcon(agent.state)}
                                                    spin={agent.state === 'busy'}
                                                    className="text-[10px]"
                                                />
                                                {agent.state}
                                            </span>
                                        </div>

                                        {agent.currentTask && (
                                            <div className="bg-slate-800/50 rounded px-3 py-2 mb-3 text-xs">
                                                <p className="text-slate-300">{agent.currentTask.description}</p>
                                                <p className="text-slate-500 mt-1">상태: {agent.currentTask.status}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>작업 {agent.taskHistoryCount}건</span>
                                            <div className="flex gap-1">
                                                {agent.state !== 'terminated' && (
                                                    <button
                                                        onClick={() => handleTerminate(agent.instanceId)}
                                                        className="text-red-400/60 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                                                        title="종료"
                                                    >
                                                        <FontAwesomeIcon icon={faStop} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="agent-glass-card p-12 text-center">
                                <FontAwesomeIcon icon={faRobot} className="text-5xl text-slate-600 mb-4" />
                                <p className="text-slate-400 text-lg">서브 에이전트가 없습니다</p>
                                <p className="text-slate-500 text-sm mt-2">
                                    "에이전트 생성" 또는 "팀 생성"으로 시작하세요
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================ */}
                {/* 탭 2: 작업 분배 */}
                {/* ============================================ */}
                {activeTab === 'tasks' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 작업 입력 */}
                        <div className="agent-glass-card p-5">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faTasks} className="text-indigo-400" />
                                작업 목록
                            </h3>

                            <div className="space-y-3 mb-4">
                                {taskDescriptions.map((desc, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={desc}
                                            onChange={e => {
                                                const next = [...taskDescriptions];
                                                next[index] = e.target.value;
                                                setTaskDescriptions(next);
                                            }}
                                            placeholder={`작업 ${index + 1} 설명`}
                                            className="agent-input flex-1 text-sm"
                                        />
                                        <select
                                            value={taskPriorities[index]}
                                            onChange={e => {
                                                const next = [...taskPriorities];
                                                next[index] = e.target.value;
                                                setTaskPriorities(next);
                                            }}
                                            className="agent-input w-24 text-xs"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                        {taskDescriptions.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveTask(index)}
                                                className="text-red-400/60 hover:text-red-400 px-2"
                                            >
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button onClick={handleAddTask} className="text-indigo-400 text-sm hover:text-indigo-300 mb-4">
                                <FontAwesomeIcon icon={faPlus} className="mr-1" /> 작업 추가
                            </button>

                            <div className="mb-4">
                                <label className="text-sm text-slate-400 block mb-2">분배 전략</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {DISTRIBUTION_STRATEGIES.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setStrategy(s.id)}
                                            className={`text-left p-2 rounded-lg border text-xs transition-all ${
                                                strategy === s.id
                                                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                                                    : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600'
                                            }`}
                                        >
                                            <p className="font-medium">{s.name}</p>
                                            <p className="text-[10px] opacity-70 mt-0.5">{s.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleDistribute}
                                disabled={loading}
                                className="agent-button w-full py-2.5 text-sm"
                            >
                                {loading ? (
                                    <><FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> 분배 중...</>
                                ) : (
                                    <><FontAwesomeIcon icon={faPaperPlane} className="mr-2" /> 작업 분배</>
                                )}
                            </button>
                        </div>

                        {/* 분배 결과 */}
                        <div className="agent-glass-card p-5">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCogs} className="text-green-400" />
                                분배 결과
                            </h3>

                            {assignments.length > 0 ? (
                                <div className="space-y-3">
                                    {distributionReasoning && (
                                        <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-lg p-3 text-xs text-indigo-300 whitespace-pre-wrap mb-3">
                                            {distributionReasoning}
                                        </div>
                                    )}

                                    {assignments.map((assignment, i) => {
                                        const result = taskResults.find(r => r.taskId === assignment.taskId);
                                        return (
                                            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <FontAwesomeIcon icon={faRobot} className="text-indigo-400 text-xs" />
                                                        <span className="text-white text-sm font-medium">
                                                            {AGENT_NAMES[assignment.agentId] || assignment.agentId}
                                                        </span>
                                                    </div>
                                                    {result ? (
                                                        <span className={`text-xs ${result.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                                                            <FontAwesomeIcon icon={result.status === 'completed' ? faCheckCircle : faExclamationTriangle} className="mr-1" />
                                                            {result.status === 'completed' ? formatTime(result.executionTime) : '실패'}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleExecuteTask(assignment.taskId)}
                                                            disabled={loading}
                                                            className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20 transition-colors"
                                                        >
                                                            <FontAwesomeIcon icon={faPlay} className="mr-1" />
                                                            실행
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400">{assignment.reason}</p>
                                                <p className="text-[10px] text-slate-600 mt-1 font-mono">{assignment.taskId}</p>

                                                {result?.output && (
                                                    <details className="mt-2">
                                                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">결과 보기</summary>
                                                        <pre className="mt-2 text-xs text-slate-300 bg-slate-900/50 rounded p-2 max-h-40 overflow-auto agent-scrollbar whitespace-pre-wrap">
                                                            {result.output.substring(0, 1000)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 py-8">
                                    <FontAwesomeIcon icon={faTasks} className="text-3xl mb-3 opacity-30" />
                                    <p className="text-sm">작업을 분배하면 결과가 여기에 표시됩니다</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================ */}
                {/* 탭 3: 협업 세션 */}
                {/* ============================================ */}
                {activeTab === 'collaboration' && (
                    <div className="space-y-6">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowCollabModal(true)}
                                className="agent-button px-4 py-2 text-sm"
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                협업 세션 생성
                            </button>
                        </div>

                        {collaborationSessions.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {collaborationSessions.map(session => (
                                    <div key={session.sessionId} className="agent-glass-card p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h4 className="font-bold text-white">{session.name}</h4>
                                                <p className="text-xs text-slate-400 mt-1 font-mono">
                                                    {session.sessionId.substring(0, 25)}...
                                                </p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                session.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                session.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                                {session.status}
                                            </span>
                                        </div>

                                        {session.sharedContext && (
                                            <div className="bg-slate-800/50 rounded-lg p-3 mb-3 text-xs">
                                                <p className="text-slate-300 mb-1">
                                                    <span className="text-slate-500">목표:</span> {session.sharedContext.goal}
                                                </p>
                                                <p className="text-slate-400">
                                                    단계: {session.sharedContext.currentPhase} ·
                                                    결정 {session.sharedContext.decisionsCount}건 ·
                                                    아티팩트 {session.sharedContext.artifactsCount}개
                                                </p>
                                            </div>
                                        )}

                                        {session.participants && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {session.participants.map(p => (
                                                    <span
                                                        key={p.instanceId}
                                                        className={`text-[10px] px-2 py-0.5 rounded-full ${getStateBg(p.status)} ${getStateColor(p.status)}`}
                                                    >
                                                        {AGENT_NAMES[p.agentId] || p.agentId} ({p.role})
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {session.status === 'active' && (
                                                <>
                                                    <button
                                                        onClick={() => handleStartCollaboration(session.sessionId)}
                                                        disabled={loading && activeCollabSession === session.sessionId}
                                                        className="agent-button text-xs px-3 py-1.5 flex-1"
                                                    >
                                                        {loading && activeCollabSession === session.sessionId ? (
                                                            <><FontAwesomeIcon icon={faSpinner} spin className="mr-1" /> 진행 중...</>
                                                        ) : (
                                                            <><FontAwesomeIcon icon={faPlay} className="mr-1" /> 협업 시작</>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEndCollaboration(session.sessionId)}
                                                        className="agent-button-secondary text-xs px-3 py-1.5"
                                                    >
                                                        <FontAwesomeIcon icon={faStop} className="mr-1" /> 종료
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="agent-glass-card p-12 text-center">
                                <FontAwesomeIcon icon={faProjectDiagram} className="text-5xl text-slate-600 mb-4" />
                                <p className="text-slate-400 text-lg">협업 세션이 없습니다</p>
                                <p className="text-slate-500 text-sm mt-2">
                                    여러 에이전트가 함께 작업하는 협업 세션을 생성하세요
                                </p>
                            </div>
                        )}

                        {/* 협업 결과 */}
                        {collabResults && (
                            <div className="agent-glass-card p-5">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faEye} className="text-purple-400" />
                                    최근 협업 결과
                                </h3>
                                <div className="space-y-3">
                                    {collabResults.results.map((r, i) => (
                                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FontAwesomeIcon icon={faRobot} className="text-indigo-400 text-xs" />
                                                <span className="text-sm font-medium text-white">
                                                    {AGENT_NAMES[r.agentId] || r.agentId}
                                                </span>
                                            </div>
                                            <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-32 overflow-auto agent-scrollbar">
                                                {r.output.substring(0, 500)}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================ */}
                {/* 탭 4: 모니터링 */}
                {/* ============================================ */}
                {activeTab === 'monitor' && (
                    <div className="space-y-6">
                        {/* 통계 카드 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: '전체 에이전트', value: stats.total, color: 'indigo', icon: faRobot },
                                { label: '가용 에이전트', value: stats.idle, color: 'blue', icon: faClock },
                                { label: '작업 중', value: stats.busy, color: 'yellow', icon: faBolt },
                                { label: '완료 작업', value: stats.completedTasks, color: 'green', icon: faCheckCircle }
                            ].map((stat, i) => (
                                <div key={i} className="agent-glass-card p-4 text-center">
                                    <FontAwesomeIcon icon={stat.icon} className={`text-${stat.color}-400 text-2xl mb-2`} />
                                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                                    <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* 에이전트 타입별 분포 */}
                        <div className="agent-glass-card p-5">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faChartBar} className="text-indigo-400" />
                                에이전트 분포
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {ALL_AGENT_IDS.map(agentId => {
                                    const count = subAgents.filter(a => a.agentId === agentId).length;
                                    const busy = subAgents.filter(a => a.agentId === agentId && a.state === 'busy').length;
                                    return (
                                        <div key={agentId} className="bg-slate-800/50 rounded-lg p-3 text-center">
                                            <p className="text-sm font-medium text-white">{AGENT_NAMES[agentId]}</p>
                                            <p className="text-2xl font-bold text-indigo-400 mt-1">{count}</p>
                                            {busy > 0 && (
                                                <p className="text-[10px] text-yellow-400 mt-0.5">
                                                    {busy} 작업 중
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 최근 작업 결과 */}
                        {taskResults.length > 0 && (
                            <div className="agent-glass-card p-5">
                                <h3 className="font-bold text-white mb-4">최근 작업 결과</h3>
                                <div className="space-y-2">
                                    {taskResults.slice(-10).reverse().map((result, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <FontAwesomeIcon
                                                    icon={result.status === 'completed' ? faCheckCircle : faExclamationTriangle}
                                                    className={result.status === 'completed' ? 'text-green-400' : 'text-red-400'}
                                                />
                                                <div>
                                                    <p className="text-sm text-white">{AGENT_NAMES[result.agentId]}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono">{result.taskId}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">{formatTime(result.executionTime)}</p>
                                                {result.tokenUsage && (
                                                    <p className="text-[10px] text-slate-500">
                                                        {result.tokenUsage.input + result.tokenUsage.output} tokens
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ============================================ */}
            {/* 모달: 에이전트 생성 */}
            {/* ============================================ */}
            {showCreateModal && (
                <div className="agent-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="agent-modal p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">서브 에이전트 생성</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <label className="text-sm text-slate-300 block mb-2">에이전트 유형</label>
                        <div className="grid grid-cols-2 gap-2 mb-4 max-h-60 overflow-y-auto agent-scrollbar">
                            {ALL_AGENT_IDS.map(id => (
                                <button
                                    key={id}
                                    onClick={() => setSelectedAgentId(id)}
                                    className={`text-left p-2.5 rounded-lg border text-sm transition-all ${
                                        selectedAgentId === id
                                            ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                                            : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={faRobot} className="mr-1.5" />
                                    {AGENT_NAMES[id]}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 agent-button-secondary py-2">
                                취소
                            </button>
                            <button onClick={handleCreateSubAgent} disabled={loading} className="flex-1 agent-button py-2">
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : '생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* 모달: 팀 생성 */}
            {/* ============================================ */}
            {showTeamModal && (
                <div className="agent-modal-overlay" onClick={() => setShowTeamModal(false)}>
                    <div className="agent-modal p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">팀 프리셋</h3>
                            <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-white">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {TEAM_PRESETS.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleCreateTeam(preset)}
                                    disabled={loading}
                                    className="w-full text-left p-4 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/40 transition-all"
                                >
                                    <p className="font-semibold text-white mb-1">
                                        <FontAwesomeIcon icon={faUsers} className="mr-2 text-indigo-400" />
                                        {preset.name}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {preset.agents.map((a, j) => (
                                            <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
                                                {AGENT_NAMES[a.agentId]} x{a.count}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* 모달: 협업 세션 생성 */}
            {/* ============================================ */}
            {showCollabModal && (
                <div className="agent-modal-overlay" onClick={() => setShowCollabModal(false)}>
                    <div className="agent-modal p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">협업 세션 생성</h3>
                            <button onClick={() => setShowCollabModal(false)} className="text-slate-400 hover:text-white">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300 block mb-1">세션 이름</label>
                                <input
                                    type="text"
                                    value={collabForm.name}
                                    onChange={e => setCollabForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="예: 로그인 기능 개발"
                                    className="agent-input w-full text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-slate-300 block mb-1">목표</label>
                                <textarea
                                    value={collabForm.goal}
                                    onChange={e => setCollabForm(prev => ({ ...prev, goal: e.target.value }))}
                                    placeholder="예: 사용자 인증 시스템 구현"
                                    className="agent-input w-full text-sm"
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="text-sm text-slate-300 block mb-1">오케스트레이터</label>
                                <select
                                    value={collabForm.orchestratorAgentId}
                                    onChange={e => setCollabForm(prev => ({ ...prev, orchestratorAgentId: e.target.value as AgentId }))}
                                    className="agent-input w-full text-sm"
                                >
                                    {ALL_AGENT_IDS.map(id => (
                                        <option key={id} value={id}>{AGENT_NAMES[id]}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-slate-300 block mb-1">참여 에이전트</label>
                                <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto agent-scrollbar">
                                    {ALL_AGENT_IDS.filter(id => id !== collabForm.orchestratorAgentId).map(id => (
                                        <button
                                            key={id}
                                            onClick={() => {
                                                setCollabForm(prev => ({
                                                    ...prev,
                                                    participantAgentIds: prev.participantAgentIds.includes(id)
                                                        ? prev.participantAgentIds.filter(a => a !== id)
                                                        : [...prev.participantAgentIds, id]
                                                }));
                                            }}
                                            className={`text-xs p-1.5 rounded border transition-all ${
                                                collabForm.participantAgentIds.includes(id)
                                                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                                                    : 'border-slate-700/50 text-slate-500 hover:border-slate-600'
                                            }`}
                                        >
                                            {AGENT_NAMES[id]}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    {collabForm.participantAgentIds.length}개 선택됨
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button onClick={() => setShowCollabModal(false)} className="flex-1 agent-button-secondary py-2">
                                취소
                            </button>
                            <button onClick={handleCreateCollaboration} disabled={loading} className="flex-1 agent-button py-2">
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : '생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentDashboard;
