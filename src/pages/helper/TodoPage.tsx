import React, { useState, useEffect, useMemo } from 'react';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faPlus, faTrash, faCheck, faClock,
    faSpinner, faMagnifyingGlass, faRotateRight, faArrowUp,
    faArrowDown, faCircle, faBell, faBars,
    faUsers, faComment, faX, faImage, faUpload, faPaperPlane, faInbox,
    faGaugeHigh, faCircleCheck, faRotate, faRotateLeft, faArrowRight,
    faTerminal, faClipboard
} from '@fortawesome/free-solid-svg-icons';
import { Task, TaskComment, STATUS_CONFIG, PRIORITY_CONFIG } from '../../types/task';
import { taskService } from '../../services/taskService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { userService, UserData } from '../../services/userService';
import { UserRole } from '../../types/roles';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/swal';

// Helper: D-Day 계산
const getDDay = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    const diffTime = (target.getTime() as number) - (today.getTime() as number);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `D+${Math.abs(diffDays)}`, isOverdue: true };
    if (diffDays === 0) return { text: 'D-Day', isOverdue: false, isToday: true };
    return { text: `D-${diffDays}`, isOverdue: false };
};

const STATUS_ICON_MAP: Record<string, IconProp> = {
    clock: faClock,
    loader: faSpinner,
    'circle-check': faCircleCheck,
    'magnifying-glass': faMagnifyingGlass,
    'rotate-right': faRotateRight
};

const PRIORITY_ICON_MAP: Record<string, IconProp> = {
    'arrow-up': faArrowUp,
    circle: faCircle
};

const getStatusIcon = (iconName?: string) => STATUS_ICON_MAP[iconName || ''] || faClock;
const getPriorityIcon = (iconName?: string) => PRIORITY_ICON_MAP[iconName || ''] || faCircle;
const CODEX_BRIDGE_COMMAND = 'npm run todo:codex-bridge';
const CODEX_BRIDGE_URL = process.env.REACT_APP_TODO_CODEX_BRIDGE_URL || 'http://127.0.0.1:8787';

const createCodexComment = (text: string, offset = 0): TaskComment => ({
    id: Date.now() + offset,
    user: 'Codex 자동화',
    text,
    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    isSystem: true
});

const isCodexRunnableTask = (task: Task) => (
    task.status === '요청'
    || task.status === '재요청'
    || (task.automation?.source === 'codex_cli' && task.automation.status === 'completed')
);

const TodoPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [assigneeUsers, setAssigneeUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [activeUser, setActiveUser] = useState<string>('전체');
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>('전체');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'dueDate'>('newest');

    // UI States
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [openStatusDropdownId, setOpenStatusDropdownId] = useState<string | null>(null);

    // Modal States
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReRequestModalOpen, setIsReRequestModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [codexRunningTaskIds, setCodexRunningTaskIds] = useState<Set<string>>(() => new Set());

    // Form States
    const [newTask, setNewTask] = useState({
        title: '',
        assignee: '',
        priority: '보통' as '긴급' | '보통',
        dueDate: '',
        image: undefined as string | undefined | null,
        images: [] as string[]
    });

    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const [reRequest, setReRequest] = useState({
        taskId: null as string | null,
        reason: '',
        image: undefined as string | undefined | null,
        images: [] as string[]
    });

    const [newComment, setNewComment] = useState({
        text: '',
        image: undefined as string | undefined | null,
        images: [] as string[]
    });

    // 데이터 로드 (리얼타임 구독)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const allUsers = await userService.getAllUsers();
                // 관리자(ADMIN) 또는 매니저(MANAGER) 권한을 가진 사용자만 필터링
                const filtered = allUsers.filter(user =>
                    user.role === UserRole.ADMIN ||
                    user.role === UserRole.MANAGER ||
                    user.role === '관리자' ||
                    user.role === '매니저' ||
                    user.role === 'admin' ||
                    user.role === 'manager'
                );
                setAssigneeUsers(filtered);
            } catch (error) {
                console.error('데이터 로드 실패:', error);
            }
        };

        loadInitialData();

        // 업무(Task) 리얼타임 구독
        const unsubscribe = taskService.subscribe((tasksData) => {
            setTasks(tasksData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 필터링 및 정렬
    const filteredTasks = useMemo(() => {
        let filtered = tasks.filter(task => {
            let userMatch = true;
            if (activeUser === '전체') {
                userMatch = true;
            } else if (activeUser === '내가 요청한 업무') {
                const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || '익명';
                userMatch = task.createdBy === myName;
            } else if (activeUser === '내가 받은 업무') {
                const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || '익명';
                userMatch = task.assignee === myName;
            } else {
                userMatch = task.assignee === activeUser;
            }

            const statusMatch = activeStatusFilter === '전체' || task.status === activeStatusFilter;
            const searchMatch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
            return userMatch && statusMatch && searchMatch;
        });

        if (sortBy === 'newest') {
            filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else {
            filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        }

        return filtered;
    }, [tasks, activeUser, activeStatusFilter, searchQuery, sortBy]);

    // 통계
    const stats = useMemo(() => ({
        total: tasks.length,
        done: tasks.filter(t => t.status === '검토').length, // 최종 완료(검토됨)
        reviewing: tasks.filter(t => t.status === '완료').length, // 검토 대기(완료됨)
        urgent: tasks.filter(t => t.priority === '긴급' && t.status !== '검토').length
    }), [tasks]);

    const codexWorkerStats = useMemo(
        () => ({
            pending: tasks.filter(t => t.status === '요청').length,
            running: tasks.filter(t => t.automation?.source === 'codex_cli' && t.automation.status === 'in_progress').length,
            completed: tasks.filter(t => t.automation?.source === 'codex_cli' && t.automation.status === 'completed').length,
            failed: tasks.filter(t => t.automation?.source === 'codex_cli' && t.automation.status === 'failed').length
        }),
        [tasks]
    );

    // 팀 멤버 목록 (담당자)
    const teamMembers = useMemo(() => {
        const names = assigneeUsers.map(u => u.displayName || u.email?.split('@')[0] || '익명').filter(Boolean);
        return ['전체', '내가 요청한 업무', '내가 받은 업무', ...new Set(names)];
    }, [assigneeUsers]);

    // 이미지 처리
    const handleImageRead = (file: File, callback: (result: string) => void) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => callback(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    // 토스트
    const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
        if (type === 'warning') {
            toast.warning(message);
            return;
        }
        toast.success(message);
    };

    // 상태 변경
    const handleStatusChange = async (taskId: string, newStatus: string) => {
        if (isSubmitting) return;
        setOpenStatusDropdownId(null);

        if (newStatus === '반려') {
            setReRequest({ taskId, reason: '', image: null, images: [] });
            setIsReRequestModalOpen(true);
            return;
        }

        const task = tasks.find(t => t.id === taskId);
        if (task) {
            setIsSubmitting(true);
            try {
                const comments = [...task.comments];

                // 시스템 메시지 추가 로직 (필요 시)
                let systemMsg = '';
                if (newStatus === '진행' && task.status === '요청') systemMsg = '업무가 [진행] 상태로 변경되었습니다.';
                else if (newStatus === '완료' && task.status === '진행') systemMsg = '작업자가 업무를 [완료]했습니다. 검토를 기다립니다.';
                else if (newStatus === '검토' && task.status === '완료') systemMsg = '업무가 [최종 검토] 상태입니다.';

                if (systemMsg) {
                    comments.push({
                        id: Date.now(),
                        user: 'System',
                        text: systemMsg,
                        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                        isSystem: true
                    });
                }

                const finalStatus = newStatus as Task['status'];

                let updateData: Partial<Task> = {
                    status: finalStatus,
                    comments
                };

                // 완료(검토 대기) 상태로 변경 시, 담당자를 요청자로 변경
                if (finalStatus === '완료' && task.createdBy && task.assignee !== task.createdBy) {
                    updateData.assignee = task.createdBy;
                    systemMsg += ` (담당자가 요청자 [${task.createdBy}]로 변경되었습니다)`;

                    // systemMsg가 이미 comments에 추가되었으므로, 마지막 댓글을 업데이트하거나 새로 추가해야 함
                    // 위에서 comments.push를 했으므로, 마지막 요소를 수정
                    if (comments.length > 0 && comments[comments.length - 1].isSystem) {
                        comments[comments.length - 1].text = systemMsg;
                    }
                }

                await taskService.updateTask(taskId, updateData);

                // 실시간 구독(onSnapshot)으로 인해 setTasks를 수동으로 호출할 필요가 없습니다.
                showToast(`상태가 [${finalStatus}]으로 변경되었습니다.`);
            } catch (error) {
                console.error('상태 변경 실패:', error);
                showToast('상태 변경에 실패했습니다.', 'warning');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // 완료 승인 -> 검토 완료 처리
    const handleApproveCompletion = async (taskId: string) => {
        if (isSubmitting) return;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            setIsSubmitting(true);
            try {
                const comments = [...task.comments, {
                    id: Date.now(),
                    user: 'System',
                    text: '요청자가 업무 완료를 승인하여 [검토]가 완료되었습니다.',
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    isSystem: true
                }];

                await taskService.updateTask(taskId, { status: '검토', comments });
                showToast('업무 검토가 완료되었습니다.');
            } catch (error) {
                console.error('승인 실패:', error);
                showToast('승인 처리에 실패했습니다.', 'warning');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // 업무 삭제
    const handleDeleteTask = async (id: string) => {
        if (window.confirm('정말 삭제하시겠습니까? 복구할 수 없습니다.')) {
            await taskService.deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            showToast('업무가 삭제되었습니다.', 'warning');
        }
    };

    // 새 업무 등록
    const handleSubmitNewTask = async () => {
        if (isSubmitting || !newTask.title.trim()) return;

        setIsSubmitting(true);
        try {
            const defaultAssignee = assigneeUsers[0]?.displayName || assigneeUsers[0]?.email?.split('@')[0] || '미지정';

            const taskData: Omit<Task, 'id'> = {
                title: newTask.title,
                assignee: newTask.assignee || defaultAssignee,
                createdBy: currentUser?.displayName || currentUser?.email?.split('@')[0] || '익명',
                priority: newTask.priority,
                status: '요청' as const,
                dueDate: newTask.dueDate || new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString().split('T')[0],
                image: newTask.images.length > 0 ? newTask.images[0] : null,
                images: newTask.images,
                comments: []
            };

            await taskService.addTask(taskData);
            setIsNewTaskModalOpen(false);
            setNewTask({ title: '', assignee: '', priority: '보통', dueDate: '', image: null, images: [] });
            showToast(`${taskData.assignee}님에게 업무를 요청했습니다.`);
        } catch (error) {
            console.error('업무 등록 실패:', error);
            showToast('업무 등록에 실패했습니다.', 'warning');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 반려 (상태를 '요청'으로 되돌림)
    const handleSubmitReject = async () => {
        if (isSubmitting || !reRequest.reason.trim()) return;

        const task = tasks.find(t => t.id === reRequest.taskId);
        if (task) {
            setIsSubmitting(true);
            try {
                const comments = [...task.comments, {
                    id: Date.now(),
                    user: 'System',
                    text: `[반려] ${reRequest.reason}`,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    image: reRequest.images.length > 0 ? reRequest.images[0] : null,
                    images: reRequest.images,
                    isSystem: true
                }];

                await taskService.updateTask(task.id, { status: '요청', comments });

                setIsReRequestModalOpen(false);
                setReRequest({ taskId: null, reason: '', image: null, images: [] });
                showToast('업무가 반려되어 [요청] 상태로 되돌아갔습니다.', 'warning');
            } catch (error) {
                console.error('반려 처리 실패:', error);
                showToast('반려 처리에 실패했습니다.', 'warning');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // 업무 수정 시작
    const handleEditClick = (task: Task) => {
        setEditingTask({ ...task });
        setIsEditModalOpen(true);
    };

    // 업무 수정 저장
    const handleUpdateTask = async () => {
        if (!editingTask || isSubmitting || !editingTask.title.trim()) return;

        setIsSubmitting(true);
        try {
            const { id, ...updates } = editingTask;
            await taskService.updateTask(id, updates);
            setIsEditModalOpen(false);
            setEditingTask(null);
            showToast('업무 정보가 수정되었습니다.');
        } catch (error) {
            console.error('업무 수정 실패:', error);
            showToast('업무 수정에 실패했습니다.', 'warning');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 댓글 작성
    const handleSubmitComment = async (taskId: string) => {
        if (isSubmitting || (!newComment.text.trim() && newComment.images.length === 0)) return;

        const task = tasks.find(t => t.id === taskId);
        if (task) {
            setIsSubmitting(true);
            try {
                const comment: TaskComment = {
                    id: Date.now(),
                    user: currentUser?.displayName || currentUser?.email?.split('@')[0] || '나',
                    text: newComment.text,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    image: newComment.images.length > 0 ? newComment.images[0] : null,
                    images: newComment.images,
                    isSystem: false
                };

                const comments = [...task.comments, comment];
                await taskService.updateTask(taskId, { comments });
                setNewComment({ text: '', image: null, images: [] });
            } catch (error) {
                console.error('댓글 작성 실패:', error);
                showToast('댓글 작성에 실패했습니다.', 'warning');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleCopyWorkerCommand = async (command: string) => {
        try {
            await navigator.clipboard.writeText(command);
            showToast(`터미널 명령을 복사했습니다: ${command}`);
        } catch (error) {
            console.error('명령 복사 실패:', error);
            showToast(`터미널에서 실행하세요: ${command}`, 'warning');
        }
    };

    const handleRunCodexTask = async (task: Task) => {
        const canRunCodex = isCodexRunnableTask(task);
        const isAlreadyRunning = codexRunningTaskIds.has(task.id) || task.automation?.status === 'in_progress';

        if (!canRunCodex || isAlreadyRunning) return;

        const startedAt = new Date().toISOString();
        const originalTitle = task.automation?.originalTitle || task.title;
        const isReImprovement = task.automation?.source === 'codex_cli' && task.automation.status === 'completed';
        const startComment = createCodexComment(
            isReImprovement
                ? 'Codex가 원 요청 내용을 기준으로 다시 개선을 시작해 상태를 [진행]으로 변경했습니다.'
                : 'Codex가 요청 내용 개선을 시작해 상태를 [진행]으로 변경했습니다.'
        );

        setCodexRunningTaskIds(prev => {
            const next = new Set(prev);
            next.add(task.id);
            return next;
        });

        try {
            await taskService.updateTask(task.id, {
                status: '진행',
                comments: [...(task.comments || []), startComment],
                automation: {
                    status: 'in_progress',
                    source: 'codex_cli',
                    startedAt,
                    originalTitle
                }
            });

            const response = await fetch(`${CODEX_BRIDGE_URL}/todo-codex/improve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: {
                        id: task.id,
                        title: originalTitle,
                        description: task.description,
                        createdBy: task.createdBy,
                        assignee: task.assignee,
                        priority: task.priority,
                        dueDate: task.dueDate,
                        comments: task.comments || []
                    }
                })
            });
            const result = await response.json().catch(() => null);

            if (!response.ok || result?.ok === false) {
                throw new Error(result?.error || 'Codex 브릿지 실행 요청에 실패했습니다.');
            }

            const improvement = result?.improvement;
            const improvedTitle = String(improvement?.improvedTitle || '').trim();

            if (!improvedTitle) {
                throw new Error('Codex 개선 결과가 비어 있습니다.');
            }

            const latestTask = await taskService.getTask(task.id);
            const latestComments = latestTask?.comments || [...(task.comments || []), startComment];
            const summaryText = Array.isArray(improvement.summary) && improvement.summary.length > 0
                ? `\n\n개선 요약:\n${improvement.summary.map((item: string) => `- ${item}`).join('\n')}`
                : '';
            const feedback = `Codex가 요청 내용을 개선했습니다.\n\n${improvement.feedback || '요청사항을 더 명확한 작업 지시문으로 정리했습니다.'}${summaryText}`;
            const completionComment = createCodexComment(feedback, 1);
            const updateData: Partial<Task> = {
                title: improvedTitle,
                status: '완료',
                comments: [...latestComments, completionComment],
                automation: {
                    status: 'completed',
                    source: 'codex_cli',
                    startedAt,
                    completedAt: new Date().toISOString(),
                    originalTitle,
                    updatedTitle: improvedTitle,
                    feedback
                }
            };

            if (task.createdBy && task.assignee !== task.createdBy) {
                updateData.assignee = task.createdBy;
            }

            await taskService.updateTask(task.id, updateData);
            showToast('Codex가 요청 내용을 개선하고 [완료]로 변경했습니다.');
        } catch (error) {
            console.error('Codex 수정 실행 실패:', error);
            const latestTask = await taskService.getTask(task.id).catch(() => null);
            const latestComments = latestTask?.comments || [...(task.comments || []), startComment];
            const errorMessage = error instanceof Error ? error.message : 'Codex 요청 내용 개선에 실패했습니다.';
            const failureComment = createCodexComment(`Codex 요청 내용 개선이 실패해 상태를 [재요청]으로 변경했습니다.\n\n${errorMessage}`, 2);

            await taskService.updateTask(task.id, {
                status: '재요청',
                comments: [...latestComments, failureComment],
                automation: {
                    status: 'failed',
                    source: 'codex_cli',
                    startedAt,
                    completedAt: new Date().toISOString(),
                    originalTitle,
                    error: errorMessage
                }
            }).catch(updateError => {
                console.error('Codex 실패 상태 저장 실패:', updateError);
            });

            if (errorMessage.includes('Failed to fetch')) {
                try {
                    await navigator.clipboard.writeText(CODEX_BRIDGE_COMMAND);
                } catch {
                }
            }
            showToast(errorMessage.includes('Failed to fetch') ? `Codex 브릿지를 먼저 실행하세요: ${CODEX_BRIDGE_COMMAND}` : errorMessage, 'warning');
        } finally {
            setCodexRunningTaskIds(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-lg text-slate-300 flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    데이터 로딩 중...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-slate-800 border-r border-slate-700 p-6 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-indigo-200 shadow-lg">
                        <FontAwesomeIcon icon={faGaugeHigh} className="w-6 h-6" />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight">할일</span>
                </div>

                <div className="mb-8">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">담당자</p>
                    <nav className="space-y-1">
                        {teamMembers.map(member => {
                            const isActive = activeUser === member;
                            return (
                                <button
                                    key={member}
                                    onClick={() => { setActiveUser(member); setIsSidebarOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-between group ${isActive ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {member === '전체' ? (
                                            <FontAwesomeIcon icon={faUsers} className="w-4 h-4" />
                                        ) : member === '내가 요청한 업무' ? (
                                            <FontAwesomeIcon icon={faPaperPlane} className="w-4 h-4" />
                                        ) : member === '내가 받은 업무' ? (
                                            <FontAwesomeIcon icon={faInbox} className="w-4 h-4" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white font-bold">
                                                {member[0]}
                                            </div>
                                        )}
                                        <span className="text-sm">{member}</span>
                                    </div>
                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>}
                                </button>
                            );
                        })}
                    </nav>
                </div>

            </aside>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-400 hover:text-white">
                            <FontAwesomeIcon icon={faBars} className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white hidden md:block">
                            {activeUser === '전체' ? '전체 업무 현황' : `${activeUser}님의 업무`}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <FontAwesomeIcon icon={faSearch} className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="업무 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:bg-slate-700 transition-all outline-none text-white placeholder-slate-400"
                            />
                        </div>
                        <button
                            onClick={() => setIsNewTaskModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-sm font-bold"
                        >
                            <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">새 업무 요청</span>
                        </button>
                        <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors">
                            <FontAwesomeIcon icon={faBell} className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-800/50 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between text-slate-400">
                                <span className="text-xs font-bold uppercase">전체 업무</span>
                                <FontAwesomeIcon icon={faGaugeHigh} className="w-4 h-4 opacity-50" />
                            </div>
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between text-violet-400">
                                <span className="text-xs font-bold uppercase">최종 검토중</span>
                                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 opacity-50" />
                            </div>
                            <p className="text-3xl font-bold text-violet-400">{filteredTasks.filter(t => t.status === '검토').length}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between text-rose-400">
                                <span className="text-xs font-bold uppercase">긴급 업무</span>
                                <FontAwesomeIcon icon={faCircle} className="w-4 h-4 opacity-50" />
                            </div>
                            <p className="text-3xl font-bold text-rose-400">{filteredTasks.filter(t => t.priority === '긴급' && t.status !== '검토').length}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between text-violet-400">
                                <span className="text-xs font-bold uppercase">검토 대기</span>
                                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 opacity-50" />
                            </div>
                            <p className="text-3xl font-bold text-violet-400">{filteredTasks.filter(t => t.status === '완료').length}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between text-emerald-400">
                                <span className="text-xs font-bold uppercase">최종 완료</span>
                                <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 opacity-50" />
                            </div>
                            <p className="text-3xl font-bold text-emerald-400">{filteredTasks.filter(t => t.status === '검토').length}</p>
                        </div>
                    </div>

                    <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-slate-800/50 px-4 py-3 shadow-xl shadow-slate-950/20">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                                    <FontAwesomeIcon icon={faTerminal} className={`w-4 h-4 ${codexWorkerStats.running > 0 ? 'animate-pulse' : ''}`} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-black text-white">Codex 내용 개선</span>
                                        <span className="rounded-full border border-slate-600 bg-slate-900/60 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                                            요청 {codexWorkerStats.pending}건
                                        </span>
                                        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-bold text-blue-300">
                                            진행 {codexWorkerStats.running}건
                                        </span>
                                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                                            완료 {codexWorkerStats.completed}건
                                        </span>
                                        {codexWorkerStats.failed > 0 && (
                                            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                                                실패 {codexWorkerStats.failed}건
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 truncate text-xs font-medium text-slate-400">
                                        <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-indigo-200">{CODEX_BRIDGE_COMMAND}</code>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => handleCopyWorkerCommand(CODEX_BRIDGE_COMMAND)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-xs font-black text-slate-200 transition-all hover:bg-slate-600 active:scale-95"
                                >
                                    <FontAwesomeIcon icon={faClipboard} className="w-3.5 h-3.5" />
                                    브릿지 명령 복사
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
                            {['전체', '요청', '진행', '완료', '검토'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setActiveStatusFilter(s)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${activeStatusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800 text-slate-400 border-slate-600 hover:bg-slate-700'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">정렬:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'newest' | 'dueDate')}
                                className="text-sm bg-transparent border-none font-semibold text-white focus:ring-0 cursor-pointer outline-none"
                            >
                                <option value="newest">최신순</option>
                                <option value="dueDate">마감임박순</option>
                            </select>
                        </div>
                    </div>

                    {/* Task List */}
                    {/* Task Table */}
                    <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/80 border-b border-slate-700/50 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4 text-center w-32">상태</th>
                                        <th className="px-6 py-4 text-center w-28">우선순위</th>
                                        <th className="px-6 py-4">업무 내용</th>
                                        <th className="px-6 py-4 w-32">담당자</th>
                                        <th className="px-6 py-4 w-40">마감일</th>
                                        <th className="px-6 py-4 text-center w-44">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {filteredTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-24 text-center">
                                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                                                    <FontAwesomeIcon icon={faSearch} className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-1">표시할 업무가 없습니다.</h3>
                                                <p className="text-slate-400 text-sm font-medium">필터를 변경하거나 새로운 업무를 등록해보세요.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTasks.map(task => {
                                            const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG['요청'];
                                            const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['보통'];
                                            const dDay = getDDay(task.dueDate);
                                            const isExpanded = expandedTaskId === task.id;
                                            const isDropdownOpen = openStatusDropdownId === task.id;
                                            const isCodexRunnable = isCodexRunnableTask(task);
                                            const isCodexRunning = codexRunningTaskIds.has(task.id) || task.automation?.status === 'in_progress';
                                            const codexButtonLabel = task.automation?.source === 'codex_cli' && task.automation.status === 'completed' ? '재개선' : 'Codex';

                                            return (
                                                <React.Fragment key={task.id}>
                                                    <tr
                                                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                                        className={`group cursor-pointer transition-all duration-200 ${isExpanded ? 'bg-indigo-500/10' : 'hover:bg-indigo-500/5'}`}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="relative flex justify-center" data-dropdown-trigger onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => setOpenStatusDropdownId(isDropdownOpen ? null : task.id)}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold border shadow-sm transition-all ${statusInfo.color} min-w-[85px] justify-center hover:scale-105 active:scale-95`}
                                                                >
                                                                    <FontAwesomeIcon icon={getStatusIcon(statusInfo.icon)} className="w-3.5 h-3.5" />
                                                                    {task.status}
                                                                </button>
                                                                {isDropdownOpen && (
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-36 bg-slate-800 rounded-xl shadow-2xl border border-slate-600 z-30 overflow-hidden ring-1 ring-black/50">
                                                                        {['요청', '진행', '완료', '검토'].map(key => (
                                                                            <button
                                                                                key={key}
                                                                                onClick={() => handleStatusChange(task.id, key)}
                                                                                className={`w-full text-left px-4 py-3 text-[11px] font-bold hover:bg-slate-700 flex items-center gap-2.5 transition-colors ${task.status === key ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300'}`}
                                                                            >
                                                                                <FontAwesomeIcon icon={getStatusIcon(STATUS_CONFIG[key].icon)} className="w-3.5 h-3.5 opacity-70" />
                                                                                {key}
                                                                            </button>
                                                                        ))}
                                                                        <div className="border-t border-slate-700 my-1"></div>
                                                                        <button
                                                                            onClick={() => handleStatusChange(task.id, '반려')}
                                                                            className="w-full text-left px-4 py-3 text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                                                                        >
                                                                            <FontAwesomeIcon icon={faRotateLeft} className="w-3.5 h-3.5" />
                                                                            반려 (요청단계로)
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex justify-center">
                                                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-tighter ${priorityInfo.color}`}>
                                                                    <FontAwesomeIcon icon={getPriorityIcon(priorityInfo.icon)} className="w-2.5 h-2.5" />
                                                                    {task.priority}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1.5 max-w-md">
                                                                <span className={`text-[13px] font-bold text-slate-100 group-hover:text-indigo-400 transition-colors leading-relaxed ${task.status === '검토' ? 'text-slate-500 line-through decoration-slate-600' : ''}`}>
                                                                    {task.title}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {task.createdBy && (
                                                                        <span className="text-[10px] text-indigo-400/80 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                                                                            요청자: {task.createdBy}
                                                                        </span>
                                                                    )}
                                                                    {task.automation?.source === 'codex_cli' && task.automation.status === 'completed' && (
                                                                        <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                                                                            Codex 개선
                                                                        </span>
                                                                    )}
                                                                    {((task.images && task.images.length > 0) || task.image) && (
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                                            <FontAwesomeIcon icon={faImage} className="w-3 h-3 text-indigo-400/70" />
                                                                            이미지 {(task.images?.length || 0) + (task.image ? 1 : 0)}개 첨부
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600/50 flex items-center justify-center text-[10px] font-black text-indigo-400 shadow-inner">
                                                                    {task.assignee[0]}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-extrabold text-slate-300 tracking-tight">{task.assignee}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-start">
                                                                <span className={`text-[11px] font-black tracking-tighter ${dDay.isOverdue ? 'text-rose-400' : (dDay.isToday ? 'text-indigo-400' : 'text-slate-300')}`}>
                                                                    {dDay.text}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-medium font-mono">{task.dueDate}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => handleRunCodexTask(task)}
                                                                    disabled={!isCodexRunnable || isCodexRunning}
                                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600/90 px-2.5 py-2 text-[10px] font-black text-white shadow-lg shadow-indigo-600/15 transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
                                                                    title={isCodexRunnable ? 'Codex로 요청 내용을 개선' : '요청 또는 재요청 상태에서 실행할 수 있습니다'}
                                                                >
                                                                    <FontAwesomeIcon icon={isCodexRunning ? faSpinner : faTerminal} className={`w-3.5 h-3.5 ${isCodexRunning ? 'animate-spin' : ''}`} />
                                                                    {codexButtonLabel}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEditClick(task)}
                                                                    className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition-colors"
                                                                    title="업무 정보 수정"
                                                                >
                                                                    <FontAwesomeIcon icon={faRotate} className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                                                    className={`relative p-2 rounded-xl transition-all ${isExpanded ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-700'}`}
                                                                    title="피드백 및 상세 보기"
                                                                >
                                                                    <FontAwesomeIcon icon={faComment} className="w-4 h-4" />
                                                                    {task.comments.length > 0 && (
                                                                        <span className="absolute -top-1 -right-1 bg-rose-500 text-[9px] w-4 h-4 flex items-center justify-center rounded-full text-white font-black border border-slate-800 shadow-sm">
                                                                            {task.comments.length}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTask(task.id)}
                                                                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                                                    title="업무 삭제"
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Detail View */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-900/30">
                                                            <td colSpan={6} className="px-10 py-8 border-l-2 border-indigo-500/50">
                                                                <div className="max-w-4xl space-y-8">
                                                                    {/* Images Section */}
                                                                    {((task.images && task.images.length > 0) || task.image) && (
                                                                        <div className="space-y-4">
                                                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                                <FontAwesomeIcon icon={faImage} className="text-indigo-500" />
                                                                                첨부 리소스 영역
                                                                            </h4>
                                                                            <div className="flex flex-wrap gap-4">
                                                                                {task.images?.map((img, idx) => (
                                                                                    <div key={idx} className="relative group/img overflow-hidden rounded-2xl border border-slate-700 shadow-xl" onClick={() => setPreviewImage(img)}>
                                                                                        <img src={img} alt="첨부" className="h-28 w-auto object-cover cursor-pointer hover:scale-110 transition-transform duration-500" />
                                                                                        <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                                                                                            <FontAwesomeIcon icon={faSearch} />
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                                {task.image && !task.images?.includes(task.image) && (
                                                                                    <div className="relative group/img overflow-hidden rounded-2xl border border-slate-700 shadow-xl" onClick={() => setPreviewImage(task.image || null)}>
                                                                                        <img src={task.image} alt="첨부" className="h-28 w-auto object-cover cursor-pointer hover:scale-110 transition-transform duration-500" />
                                                                                        <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                                                                                            <FontAwesomeIcon icon={faSearch} />
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Guide Actions Section */}
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faPaperPlane} className="text-indigo-500" />
                                                                            진행 가이드 액션
                                                                        </h4>
                                                                        {task.status === '요청' && (
                                                                            <div className="flex items-center gap-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 shadow-inner">
                                                                                <div className="bg-indigo-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-400">
                                                                                    <FontAwesomeIcon icon={faClock} className="w-6 h-6" />
                                                                                </div>
                                                                                <div className="flex flex-col gap-0.5">
                                                                                    <span className="text-sm font-bold text-indigo-100">업무 할당을 확인하셨나요?</span>
                                                                                    <span className="text-xs text-indigo-400/60 font-medium">진행 중 상태로 변경하여 구성원에게 알리세요.</span>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleStatusChange(task.id, '진행')}
                                                                                    className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-3 rounded-xl flex items-center gap-2 shadow-xl shadow-indigo-600/20 transition-all hover:scale-105"
                                                                                >
                                                                                    업무 진행하기
                                                                                    <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {task.status === '진행' && (
                                                                            <div className="flex items-center gap-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 shadow-inner">
                                                                                <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-blue-400">
                                                                                    <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 animate-spin-slow" />
                                                                                </div>
                                                                                <div className="flex flex-col gap-0.5">
                                                                                    <span className="text-sm font-bold text-blue-100">작업이 마무리되었나요?</span>
                                                                                    <span className="text-xs text-blue-400/60 font-medium">검토 요청을 보내 작업을 완료 처리하세요.</span>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleStatusChange(task.id, '완료')}
                                                                                    className="ml-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-6 py-3 rounded-xl flex items-center gap-2 shadow-xl shadow-blue-600/20 transition-all hover:scale-105"
                                                                                >
                                                                                    완료 보고하기
                                                                                    <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {task.status === '완료' && (
                                                                            <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-6 shadow-inner space-y-5">
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="bg-violet-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-violet-400">
                                                                                        <FontAwesomeIcon icon={faMagnifyingGlass} className="w-6 h-6" />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-sm font-bold text-violet-100">최종 승인 및 검토 단계입니다.</span>
                                                                                        <span className="text-xs text-violet-400/60 font-medium">작업 결과를 확인하고 승인하거나 반려를 결정하세요.</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex gap-3">
                                                                                    <button
                                                                                        onClick={() => handleStatusChange(task.id, '반려')}
                                                                                        className="flex-1 bg-slate-800 hover:bg-rose-900/40 text-rose-400 text-xs font-black px-4 py-4 rounded-2xl flex items-center justify-center gap-2.5 border border-rose-500/20 transition-all hover:scale-[0.98]"
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faRotateLeft} className="w-4 h-4" />
                                                                                        불충분함 (반려 처리)
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleApproveCompletion(task.id)}
                                                                                        className="flex-[2] bg-violet-600 hover:bg-violet-500 text-white text-xs font-black px-4 py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl shadow-violet-600/30 transition-all hover:scale-[1.02]"
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faCircleCheck} className="w-5 h-5" />
                                                                                        완벽합니다 (최종 승인)
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Feedback/History Section */}
                                                                    <div className="space-y-5">
                                                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faComment} className="text-indigo-500" />
                                                                            커뮤니케이션 히스토리
                                                                        </h4>
                                                                        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                                                                            {task.comments.length === 0 ? (
                                                                                <div className="text-center py-12 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700/50 text-slate-500 text-[13px] font-medium">아직 히스토리가 없습니다.</div>
                                                                            ) : (
                                                                                task.comments.map(comment => (
                                                                                    <div key={comment.id}>
                                                                                        {comment.isSystem ? (
                                                                                            <div className="flex justify-center my-6">
                                                                                                <div className="bg-slate-800/80 border border-slate-700/50 text-slate-400 px-6 py-2 rounded-full text-[10px] font-extrabold flex items-center gap-2.5 shadow-sm">
                                                                                                    <div className={`w-1.5 h-1.5 rounded-full ${comment.text.includes('반려') ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                                                                                    {comment.text}
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="flex gap-4 group/cmt">
                                                                                                <div className="w-10 h-10 rounded-2xl bg-slate-700 border border-slate-600 flex items-center justify-center text-indigo-400 shadow-lg flex-shrink-0 font-black text-sm group-hover/cmt:border-indigo-500/50 transition-colors">
                                                                                                    {comment.user[0]}
                                                                                                </div>
                                                                                                <div className="flex-1 space-y-1.5">
                                                                                                    <div className="flex items-center gap-2.5 pl-1">
                                                                                                        <span className="font-black text-[13px] text-slate-100">{comment.user}</span>
                                                                                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{comment.time}</span>
                                                                                                    </div>
                                                                                                    <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-3xl rounded-tl-none shadow-xl inline-block max-w-[95%] group-hover/cmt:border-slate-600 transition-colors">
                                                                                                        <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">{comment.text}</p>
                                                                                                        <div className="flex flex-wrap gap-2 mt-3">
                                                                                                            {comment.images?.map((img, idx) => (
                                                                                                                <img key={idx} src={img} alt="피드백" onClick={() => setPreviewImage(img)} className="rounded-xl h-44 w-auto border border-slate-700 hover:border-indigo-500/50 cursor-pointer transition-all" />
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))
                                                                            )}
                                                                        </div>

                                                                        {/* Enhanced Comment Input */}
                                                                        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-2xl ring-1 ring-white/5">
                                                                            {newComment.images.length > 0 && (
                                                                                <div className="flex flex-wrap gap-3 mb-4 px-1">
                                                                                    {newComment.images.map((img, idx) => (
                                                                                        <div key={idx} className="relative group">
                                                                                            <img src={img} alt="첨부" className="h-16 w-16 rounded-xl object-cover border border-slate-600 shadow-md transition-transform group-hover:scale-105" />
                                                                                            <button onClick={() => setNewComment(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-xl hover:bg-rose-600 active:scale-90 transition-all">
                                                                                                <FontAwesomeIcon icon={faX} className="w-2.5 h-2.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            <div className="flex items-end gap-3">
                                                                                <div className="flex flex-col items-center">
                                                                                    <input type="file" accept="image/*" multiple className="hidden" id={`comment-file-${task.id}`} onChange={e => {
                                                                                        if (e.target.files) {
                                                                                            Array.from(e.target.files).forEach(file => handleImageRead(file, result => setNewComment(prev => ({ ...prev, images: [...prev.images, result] }))));
                                                                                        }
                                                                                    }} />
                                                                                    <label htmlFor={`comment-file-${task.id}`} className="flex items-center justify-center bg-slate-700/50 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 w-11 h-11 rounded-xl transition-all cursor-pointer shadow-inner">
                                                                                        <FontAwesomeIcon icon={faImage} className="w-5 h-5" />
                                                                                    </label>
                                                                                </div>
                                                                                <div className="flex-1 bg-slate-900/40 rounded-xl p-2.5 border border-slate-700/50 shadow-inner">
                                                                                    <textarea
                                                                                        placeholder="업무 히드백을 남겨주세요... (Enter로 전송)"
                                                                                        value={newComment.text}
                                                                                        onChange={e => setNewComment(prev => ({ ...prev, text: e.target.value }))}
                                                                                        onKeyDown={e => {
                                                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                                                e.preventDefault();
                                                                                                handleSubmitComment(task.id);
                                                                                            }
                                                                                        }}
                                                                                        rows={1}
                                                                                        className="w-full bg-transparent border-none text-white text-[13px] font-medium focus:ring-0 placeholder-slate-600 resize-none min-h-[44px] py-2 px-1"
                                                                                    />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleSubmitComment(task.id)}
                                                                                    disabled={!newComment.text.trim() && newComment.images.length === 0}
                                                                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-600/20 transition-all active:scale-90 group"
                                                                                >
                                                                                    <FontAwesomeIcon icon={faPaperPlane} className="w-5 h-5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main >

            {/* New Task Modal */}
            {
                isNewTaskModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsNewTaskModalOpen(false)}>
                        <div className="bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 md:p-8 border border-slate-700" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">새 업무 등록</h3>
                                <button onClick={() => setIsNewTaskModalOpen(false)} className="text-slate-400 hover:text-white">
                                    <FontAwesomeIcon icon={faX} className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">업무 내용</label>
                                    <textarea
                                        value={newTask.title}
                                        onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="요청할 업무 내용을 상세히 입력하세요"
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-500 resize-none min-h-[120px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-300 mb-2">담당자</label>
                                        <select
                                            value={newTask.assignee}
                                            onChange={(e) => setNewTask(prev => ({ ...prev, assignee: e.target.value }))}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="">담당자 선택</option>
                                            {teamMembers.filter(m => m !== '전체').map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-300 mb-2">우선순위</label>
                                        <select
                                            value={newTask.priority}
                                            onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="보통">보통</option>
                                            <option value="긴급">긴급</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">마감일</label>
                                    <input
                                        type="date"
                                        value={newTask.dueDate}
                                        onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">참고 이미지 (다중 선택 가능)</label>
                                    <div className="space-y-4">
                                        <div
                                            onClick={() => document.getElementById('new-task-file')?.click()}
                                            className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-slate-700/30 transition-all group"
                                        >
                                            <input
                                                type="file"
                                                id="new-task-file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files) {
                                                        const files = Array.from(e.target.files);
                                                        files.forEach(file => {
                                                            handleImageRead(file, (result) => {
                                                                setNewTask(prev => ({ ...prev, images: [...prev.images, result] }));
                                                            });
                                                        });
                                                    }
                                                }}
                                            />
                                            <div className="text-slate-400 flex flex-col items-center gap-2 group-hover:text-indigo-400">
                                                <div className="bg-slate-700 p-3 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                                                    <FontAwesomeIcon icon={faUpload} className="w-6 h-6" />
                                                </div>
                                                <span className="text-sm font-medium">클릭하거나 파일을 드래그하여 업로드</span>
                                                <span className="text-xs opacity-60">여러 장을 동시에 선택할 수 있습니다.</span>
                                            </div>
                                        </div>

                                        {newTask.images.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {newTask.images.map((img, idx) => (
                                                    <div key={idx} className="relative group aspect-square">
                                                        <img src={img} alt={`첨부 ${idx + 1}`} className="w-full h-full rounded-lg object-cover border border-slate-600 shadow-sm" />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setNewTask(prev => ({
                                                                    ...prev,
                                                                    images: prev.images.filter((_, i) => i !== idx)
                                                                }));
                                                            }}
                                                            className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 rounded-full shadow-md hover:bg-rose-600 flex items-center justify-center transition-transform hover:scale-110"
                                                        >
                                                            <FontAwesomeIcon icon={faX} className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setIsNewTaskModalOpen(false)}
                                        className="flex-1 py-3.5 text-slate-400 font-bold hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSubmitNewTask}
                                        className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        요청하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Task Modal */}
            {
                isEditModalOpen && editingTask && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsEditModalOpen(false)}>
                        <div className="bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 md:p-8 border border-slate-700" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FontAwesomeIcon icon={faRotate} className="text-amber-400" />
                                    업무 정보 수정
                                </h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                                    <FontAwesomeIcon icon={faX} className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">업무 내용</label>
                                    <textarea
                                        value={editingTask.title}
                                        onChange={(e) => setEditingTask(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                        placeholder="요청할 업무 내용을 상세히 입력하세요"
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-slate-500 resize-none min-h-[120px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-300 mb-2">담당자</label>
                                        <select
                                            value={editingTask.assignee}
                                            onChange={(e) => setEditingTask(prev => prev ? ({ ...prev, assignee: e.target.value }) : null)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                        >
                                            <option value="">담당자 선택</option>
                                            {teamMembers.filter(m => m !== '전체').map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-300 mb-2">우선순위</label>
                                        <select
                                            value={editingTask.priority}
                                            onChange={(e) => setEditingTask(prev => prev ? ({ ...prev, priority: e.target.value as any }) : null)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                        >
                                            <option value="보통">보통</option>
                                            <option value="긴급">긴급</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">마감일</label>
                                    <input
                                        type="date"
                                        value={editingTask.dueDate}
                                        onChange={(e) => setEditingTask(prev => prev ? ({ ...prev, dueDate: e.target.value }) : null)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 py-3.5 text-slate-400 font-bold hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleUpdateTask}
                                        disabled={isSubmitting}
                                        className="flex-1 py-3.5 bg-amber-600/90 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
                                    >
                                        {isSubmitting ? '저장 중...' : '변경사항 저장'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Re-Request Modal */}
            {
                isReRequestModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsReRequestModalOpen(false)}>
                        <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 border-t-4 border-rose-500" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
                                <FontAwesomeIcon icon={faRotateLeft} className="w-6 h-6 text-rose-500" />
                                업무 반려
                            </h3>
                            <p className="text-sm text-slate-400 mb-6">반려 사유를 입력해주세요. 상태가 다시 [요청]으로 변경됩니다.</p>
                            <div className="space-y-4">
                                <textarea
                                    value={reRequest.reason}
                                    onChange={(e) => setReRequest(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="수정 요청 사항을 입력하세요..."
                                    className="w-full h-32 px-4 py-3 rounded-xl border border-slate-600 bg-slate-700/50 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none placeholder-slate-500"
                                />
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-2">참고 사진 (다중 선택 가능)</label>
                                    <div className="space-y-3">
                                        <div
                                            onClick={() => document.getElementById('re-req-file')?.click()}
                                            className="border border-dashed border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-orange-500 hover:bg-orange-500/5 transition-all group"
                                        >
                                            <input
                                                type="file"
                                                id="re-req-file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files) {
                                                        const files = Array.from(e.target.files);
                                                        files.forEach(file => {
                                                            handleImageRead(file, (result) => {
                                                                setReRequest(prev => ({ ...prev, images: [...prev.images, result] }));
                                                            });
                                                        });
                                                    }
                                                }}
                                            />
                                            <div className="text-slate-400 flex flex-col items-center gap-1 group-hover:text-orange-400">
                                                <FontAwesomeIcon icon={faUpload} className="w-5 h-5 mb-1" />
                                                <span className="text-xs font-medium">클릭하거나 파일을 드래그하여 업로드</span>
                                            </div>
                                        </div>

                                        {reRequest.images.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2">
                                                {reRequest.images.map((img, idx) => (
                                                    <div key={idx} className="relative group aspect-square">
                                                        <img src={img} alt={`첨부 ${idx + 1}`} className="w-full h-full rounded-lg object-cover border border-slate-600 shadow-sm" />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReRequest(prev => ({
                                                                    ...prev,
                                                                    images: prev.images.filter((_, i) => i !== idx)
                                                                }));
                                                            }}
                                                            className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 rounded-full shadow-md hover:bg-rose-600 flex items-center justify-center transition-transform hover:scale-110"
                                                        >
                                                            <FontAwesomeIcon icon={faX} className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setIsReRequestModalOpen(false)}
                                    className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSubmitReject}
                                    className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                                >
                                    반려 처리하기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Image Preview Modal */}
            {
                previewImage && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                        <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2">
                            <FontAwesomeIcon icon={faX} className="w-8 h-8" />
                        </button>
                        <img src={previewImage} alt="미리보기" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                    </div>
                )
            }

            {/* Dropdown overlay */}
            {
                openStatusDropdownId && (
                    <div className="fixed inset-0 z-10" onClick={() => setOpenStatusDropdownId(null)}></div>
                )
            }
        </div >
    );
};

export default TodoPage;
