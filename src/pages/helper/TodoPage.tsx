// 요청 작성과 진행 확인에 집중한 간결한 개발 요청 화면입니다.
import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faBolt,
    faCalendar,
    faCheck,
    faChevronDown,
    faChevronUp,
    faCircleCheck,
    faClock,
    faComment,
    faImage,
    faInbox,
    faMagnifyingGlass,
    faPaperclip,
    faPaperPlane,
    faPlus,
    faRotateLeft,
    faSearch,
    faSpinner,
    faTriangleExclamation,
    faUser,
    faUsers,
    faX,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { taskService } from '../../services/taskService';
import { userService, UserData } from '../../services/userService';
import { Task, TaskComment } from '../../types/task';
import { UserRole } from '../../types/roles';
import { toast } from '../../utils/swal';

type ViewFilter = 'all' | 'mine' | 'active' | 'review' | 'done';

type DraftTask = {
    title: string;
    description: string;
    assignee: string;
    priority: '긴급' | '보통';
    dueDate: string;
    images: string[];
};

const EMPTY_DRAFT: DraftTask = {
    title: '',
    description: '',
    assignee: '',
    priority: '보통',
    dueDate: '',
    images: [],
};

const STATUS_META: Record<string, {
    label: string;
    description: string;
    className: string;
}> = {
    요청: {
        label: '접수',
        description: '담당자가 확인할 차례예요',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
    요청중: {
        label: '접수',
        description: '담당자가 확인할 차례예요',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
    재요청: {
        label: '수정 요청',
        description: '요청자의 의견을 확인해 주세요',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    진행: {
        label: '작업 중',
        description: '담당자가 요청을 처리하고 있어요',
        className: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    진행중: {
        label: '작업 중',
        description: '담당자가 요청을 처리하고 있어요',
        className: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    완료: {
        label: '확인 필요',
        description: '요청자가 결과를 확인할 차례예요',
        className: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    검토중: {
        label: '확인 필요',
        description: '요청자가 결과를 확인할 차례예요',
        className: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    검토: {
        label: '완료',
        description: '요청 처리가 완료되었어요',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    완료함: {
        label: '완료',
        description: '요청 처리가 완료되었어요',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
};

const FILTERS: Array<{ key: ViewFilter; label: string }> = [
    { key: 'all', label: '전체' },
    { key: 'mine', label: '내 요청' },
    { key: 'active', label: '처리 중' },
    { key: 'review', label: '확인 필요' },
    { key: 'done', label: '완료' },
];

const ACTIVE_STATUSES = new Set(['요청', '요청중', '재요청', '진행', '진행중']);
const REVIEW_STATUSES = new Set(['완료', '검토중']);
const DONE_STATUSES = new Set(['검토', '완료함']);

const getStatusMeta = (status: string) => STATUS_META[status] || STATUS_META['요청'];

const getDateValue = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string) => {
    const date = getDateValue(value);
    if (!date) return '일정 미정';
    return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date);
};

const getDueLabel = (value?: string) => {
    const dueDate = getDateValue(value);
    if (!dueDate) return { text: '일정 미정', overdue: false, today: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);

    if (days < 0) return { text: `${Math.abs(days)}일 지남`, overdue: true, today: false };
    if (days === 0) return { text: '오늘까지', overdue: false, today: true };
    if (days === 1) return { text: '내일까지', overdue: false, today: false };
    return { text: `${formatDate(value)}까지`, overdue: false, today: false };
};

const getCurrentUserName = (displayName?: string | null, email?: string | null) => (
    displayName || email?.split('@')[0] || '익명'
);

const TodoPage: React.FC = () => {
    const { currentUser } = useAuth();
    const currentUserName = getCurrentUserName(currentUser?.displayName, currentUser?.email);
    const initialFilter: ViewFilter = new URLSearchParams(window.location.search).get('filter') === 'mine'
        ? 'mine'
        : 'all';

    const [tasks, setTasks] = useState<Task[]>([]);
    const [assigneeUsers, setAssigneeUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filter, setFilter] = useState<ViewFilter>(initialFilter);
    const [searchQuery, setSearchQuery] = useState('');
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draft, setDraft] = useState<DraftTask>(EMPTY_DRAFT);
    const [commentText, setCommentText] = useState('');
    const [commentImages, setCommentImages] = useState<string[]>([]);
    const [revisionTaskId, setRevisionTaskId] = useState<string | null>(null);
    const [revisionReason, setRevisionReason] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        void userService.getAllUsers()
            .then(users => {
                if (!active) return;
                setAssigneeUsers(users.filter(user => (
                    user.role === UserRole.ADMIN
                    || user.role === UserRole.MANAGER
                    || user.role === '관리자'
                    || user.role === '매니저'
                    || user.role === 'admin'
                    || user.role === 'manager'
                )));
            })
            .catch(error => console.error('담당자 목록 로드 실패:', error));

        const unsubscribe = taskService.subscribe(
            taskRows => {
                if (!active) return;
                setTasks(taskRows);
                setLoadError('');
                setLoading(false);
            },
            error => {
                if (!active) return;
                console.error('요청 목록 구독 실패:', error);
                setLoadError('요청 목록을 불러오지 못했습니다. 접근 권한 또는 네트워크 연결을 확인해 주세요.');
                setLoading(false);
            },
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const assigneeOptions = useMemo(() => (
        [...new Set(assigneeUsers
            .map(user => user.displayName || user.email?.split('@')[0])
            .filter((name): name is string => Boolean(name)))]
    ), [assigneeUsers]);

    const counts = useMemo(() => ({
        all: tasks.length,
        mine: tasks.filter(task => task.createdBy === currentUserName).length,
        active: tasks.filter(task => ACTIVE_STATUSES.has(task.status)).length,
        review: tasks.filter(task => REVIEW_STATUSES.has(task.status)).length,
        done: tasks.filter(task => DONE_STATUSES.has(task.status)).length,
    }), [currentUserName, tasks]);

    const filteredTasks = useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase();
        const matchesFilter = (task: Task) => {
            if (filter === 'mine') return task.createdBy === currentUserName;
            if (filter === 'active') return ACTIVE_STATUSES.has(task.status);
            if (filter === 'review') return REVIEW_STATUSES.has(task.status);
            if (filter === 'done') return DONE_STATUSES.has(task.status);
            return true;
        };

        const priority = (task: Task) => {
            if (REVIEW_STATUSES.has(task.status)) return 0;
            if (task.priority === '긴급' && !DONE_STATUSES.has(task.status)) return 1;
            if (task.status === '재요청') return 2;
            if (task.status === '요청' || task.status === '요청중') return 3;
            if (task.status === '진행' || task.status === '진행중') return 4;
            return 5;
        };

        return tasks
            .filter(task => {
                if (!matchesFilter(task)) return false;
                if (!query) return true;
                return [
                    task.title,
                    task.description,
                    task.assignee,
                    task.createdBy,
                    ...(task.comments || []).map(comment => comment.text),
                ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
            })
            .sort((a, b) => {
                const statusDifference = priority(a) - priority(b);
                if (statusDifference !== 0) return statusDifference;
                return (getDateValue(b.createdAt)?.getTime() || 0) - (getDateValue(a.createdAt)?.getTime() || 0);
            });
    }, [currentUserName, filter, searchQuery, tasks]);

    const showSuccess = (message: string) => toast.success(message);
    const showWarning = (message: string) => toast.warning(message);

    const readImage = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    const appendImages = async (
        fileList: FileList | null,
        currentImages: string[],
        onChange: (images: string[]) => void,
    ) => {
        if (!fileList) return;
        const availableSlots = Math.max(0, 3 - currentImages.length);
        const files = Array.from(fileList).slice(0, availableSlots);
        if (files.length < fileList.length) showWarning('사진은 한 번에 최대 3장까지 첨부할 수 있습니다.');
        try {
            const images = await Promise.all(files.map(readImage));
            onChange([...currentImages, ...images]);
        } catch (error) {
            console.error('사진 읽기 실패:', error);
            showWarning('사진을 불러오지 못했습니다.');
        }
    };

    const handleSubmitNewTask = async (event: FormEvent) => {
        event.preventDefault();
        if (isSubmitting || !draft.title.trim()) return;

        setIsSubmitting(true);
        try {
            const assignee = draft.assignee || assigneeOptions[0] || '개발팀';
            const taskData: Omit<Task, 'id'> = {
                title: draft.title.trim(),
                description: draft.description.trim() || undefined,
                assignee,
                createdBy: currentUserName,
                priority: draft.priority,
                status: '요청',
                dueDate: draft.dueDate,
                createdAt: new Date().toISOString(),
                image: draft.images[0] || null,
                images: draft.images,
                comments: [],
                automation: { mode: 'manual', autoRun: false },
            };
            await taskService.addTask(taskData);
            setDraft(EMPTY_DRAFT);
            setIsComposerOpen(false);
            setFilter('mine');
            showSuccess('요청을 등록했습니다. 진행 상태는 이 화면에서 확인할 수 있습니다.');
        } catch (error) {
            console.error('요청 등록 실패:', error);
            showWarning('요청을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateTaskStatus = async (task: Task, status: Task['status'], message: string) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const comments: TaskComment[] = [...(task.comments || []), {
                id: Date.now(),
                user: 'System',
                text: message,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: true,
            }];
            const updates: Partial<Task> = { status, comments };
            if (status === '완료' && task.createdBy) updates.assignee = task.createdBy;
            await taskService.updateTask(task.id, updates);
            showSuccess(message);
        } catch (error) {
            console.error('상태 변경 실패:', error);
            showWarning('상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrimaryAction = (task: Task) => {
        if (task.status === '요청' || task.status === '요청중' || task.status === '재요청') {
            void updateTaskStatus(task, '진행', '담당자가 작업을 시작했습니다.');
            return;
        }
        if (task.status === '진행' || task.status === '진행중') {
            void updateTaskStatus(task, '완료', '작업이 끝났습니다. 요청자의 확인을 기다립니다.');
            return;
        }
        if (task.status === '완료' || task.status === '검토중') {
            void updateTaskStatus(task, '검토', '요청자가 결과를 확인하고 완료 처리했습니다.');
        }
    };

    const handleSubmitRevision = async (task: Task) => {
        const reason = revisionReason.trim();
        if (!reason || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const comments: TaskComment[] = [...(task.comments || []), {
                id: Date.now(),
                user: currentUserName,
                text: `수정 요청: ${reason}`,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: false,
            }];
            await taskService.updateTask(task.id, { status: '재요청', comments });
            setRevisionTaskId(null);
            setRevisionReason('');
            showSuccess('수정 요청을 담당자에게 전달했습니다.');
        } catch (error) {
            console.error('수정 요청 실패:', error);
            showWarning('수정 요청을 전달하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitComment = async (task: Task) => {
        if (isSubmitting || (!commentText.trim() && commentImages.length === 0)) return;
        setIsSubmitting(true);
        try {
            const comment: TaskComment = {
                id: Date.now(),
                user: currentUserName,
                text: commentText.trim(),
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                image: commentImages[0] || null,
                images: commentImages,
                isSystem: false,
            };
            await taskService.updateTask(task.id, { comments: [...(task.comments || []), comment] });
            setCommentText('');
            setCommentImages([]);
        } catch (error) {
            console.error('댓글 등록 실패:', error);
            showWarning('메시지를 등록하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleTask = (taskId: string) => {
        setExpandedTaskId(current => current === taskId ? null : taskId);
        setRevisionTaskId(null);
        setRevisionReason('');
        setCommentText('');
        setCommentImages([]);
    };

    const primaryActionLabel = (task: Task) => {
        if (task.status === '요청' || task.status === '요청중' || task.status === '재요청') return '작업 시작';
        if (task.status === '진행' || task.status === '진행중') return '확인 요청';
        if (task.status === '완료' || task.status === '검토중') return '완료 승인';
        return '';
    };

    return (
        <div className="min-h-full bg-slate-50 px-3 py-5 text-slate-900 sm:px-5 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">
                <header className="mb-6 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                            <FontAwesomeIcon icon={faInbox} className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">개발 요청</h1>
                                {counts.review > 0 && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-700">확인 필요 {counts.review}</span>}
                            </div>
                            <p className="max-w-2xl text-sm leading-6 text-slate-500">불편한 점이나 필요한 기능을 남겨 주세요. 접수부터 완료까지 진행 상황을 한곳에서 확인할 수 있습니다.</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setIsComposerOpen(open => !open)} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">
                        <FontAwesomeIcon icon={isComposerOpen ? faX : faPlus} className="h-4 w-4" />
                        {isComposerOpen ? '작성 닫기' : '새 요청'}
                    </button>
                </header>

                {isComposerOpen && (
                    <form onSubmit={handleSubmitNewTask} className="mb-6 overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-xl shadow-indigo-100/60">
                        <div className="border-b border-indigo-100 bg-indigo-50/70 px-5 py-4 sm:px-7">
                            <h2 className="font-black text-slate-950">무엇을 개선하면 좋을까요?</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">제목만 입력해도 등록할 수 있습니다. 자세한 설명은 처리 시간을 줄여 줍니다.</p>
                        </div>
                        <div className="space-y-5 p-5 sm:p-7">
                            <div>
                                <label htmlFor="todo-title" className="mb-2 block text-sm font-extrabold text-slate-700">요청 제목 <span className="text-rose-500">*</span></label>
                                <input id="todo-title" value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="예: 급여 페이지에서 엑셀 다운로드가 안 돼요" autoFocus className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                            </div>
                            <div>
                                <label htmlFor="todo-description" className="mb-2 block text-sm font-extrabold text-slate-700">상세 내용 <span className="font-medium text-slate-400">선택</span></label>
                                <textarea id="todo-description" value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="어느 화면에서 문제가 생겼는지, 원하는 결과가 무엇인지 적어 주세요." rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label htmlFor="todo-assignee" className="mb-2 block text-xs font-bold text-slate-500">담당자</label>
                                    <select id="todo-assignee" value={draft.assignee} onChange={event => setDraft(current => ({ ...current, assignee: event.target.value }))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
                                        <option value="">자동 배정</option>
                                        {assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="todo-priority" className="mb-2 block text-xs font-bold text-slate-500">중요도</label>
                                    <select id="todo-priority" value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value as DraftTask['priority'] }))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
                                        <option value="보통">보통</option>
                                        <option value="긴급">긴급</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="todo-due-date" className="mb-2 block text-xs font-bold text-slate-500">희망 완료일</label>
                                    <input id="todo-due-date" type="date" value={draft.dueDate} onChange={event => setDraft(current => ({ ...current, dueDate: event.target.value }))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                                </div>
                            </div>

                            {draft.images.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {draft.images.map((image, index) => (
                                        <div key={`${image.slice(-12)}-${index}`} className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                            <img src={image} alt={`요청 첨부 ${index + 1}`} className="h-full w-full object-cover" />
                                            <button type="button" aria-label={`첨부 사진 ${index + 1} 삭제`} onClick={() => setDraft(current => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index) }))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/75 text-white">
                                                <FontAwesomeIcon icon={faX} className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                    <FontAwesomeIcon icon={faPaperclip} className="h-4 w-4" />
                                    사진 첨부 ({draft.images.length}/3)
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={event => void appendImages(event.target.files, draft.images, images => setDraft(current => ({ ...current, images })))} />
                                </label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsComposerOpen(false)} className="min-h-11 flex-1 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-100 sm:flex-none">취소</button>
                                    <button type="submit" disabled={isSubmitting || !draft.title.trim()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none">
                                        {isSubmitting ? <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" /> : <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />}
                                        요청 등록
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}

                {loadError && (
                    <div role="alert" className="mb-6 flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-5 w-5 text-rose-500" />
                            <div>
                                <p className="font-extrabold text-rose-900">요청 목록을 표시할 수 없습니다</p>
                                <p className="mt-1 text-sm leading-6 text-rose-700">{loadError}</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100">다시 시도</button>
                    </div>
                )}

                <section aria-label="요청 목록">
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="요청 상태 필터">
                                {FILTERS.map(item => (
                                    <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-extrabold transition ${filter === item.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                                        {item.label}<span className={`ml-1.5 text-xs ${filter === item.key ? 'text-indigo-500' : 'text-slate-400'}`}>{counts[item.key]}</span>
                                    </button>
                                ))}
                            </div>
                            <label className="relative block w-full xl:max-w-xs">
                                <span className="sr-only">요청 검색</span>
                                <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="제목, 요청자, 담당자 검색" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                            </label>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
                            <div className="text-center text-slate-500">
                                <FontAwesomeIcon icon={faSpinner} className="mb-3 h-6 w-6 animate-spin text-indigo-500" />
                                <p className="text-sm font-bold">요청을 불러오는 중입니다</p>
                            </div>
                        </div>
                    ) : !loadError && filteredTasks.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FontAwesomeIcon icon={searchQuery ? faMagnifyingGlass : faInbox} className="h-6 w-6" /></div>
                            <h2 className="text-lg font-black text-slate-900">{searchQuery ? '검색 결과가 없습니다' : '아직 등록된 요청이 없습니다'}</h2>
                            <p className="mt-2 text-sm text-slate-500">{searchQuery ? '검색어를 바꾸거나 다른 상태를 확인해 주세요.' : '필요한 개선 사항을 첫 요청으로 남겨 보세요.'}</p>
                            {!searchQuery && <button type="button" onClick={() => setIsComposerOpen(true)} className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700">새 요청 작성</button>}
                        </div>
                    ) : !loadError && (
                        <div className="space-y-3">
                            {filteredTasks.map(task => {
                                const status = getStatusMeta(task.status);
                                const due = getDueLabel(task.dueDate);
                                const expanded = expandedTaskId === task.id;
                                const actionLabel = primaryActionLabel(task);
                                const comments = task.comments || [];
                                const images = task.images?.length ? task.images : (task.image ? [task.image] : []);

                                return (
                                    <article key={task.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${expanded ? 'border-indigo-300 shadow-lg shadow-indigo-100/60' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <div className="p-4 sm:p-5">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${status.className}`}>{status.label}</span>
                                                        {task.priority === '긴급' && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-600"><FontAwesomeIcon icon={faBolt} className="h-3 w-3" /> 긴급</span>}
                                                        {comments.length > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400"><FontAwesomeIcon icon={faComment} className="h-3 w-3" /> {comments.length}</span>}
                                                    </div>
                                                    <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">{task.title}</h2>
                                                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{task.description || status.description}</p>
                                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                                                        <span className="inline-flex items-center gap-1.5"><FontAwesomeIcon icon={faUser} className="h-3 w-3 text-slate-400" /> 요청 {task.createdBy || '알 수 없음'}</span>
                                                        <span className="inline-flex items-center gap-1.5"><FontAwesomeIcon icon={faUsers} className="h-3 w-3 text-slate-400" /> 담당 {task.assignee || '미지정'}</span>
                                                        <span className={`inline-flex items-center gap-1.5 ${due.overdue ? 'text-rose-600' : due.today ? 'text-amber-600' : ''}`}><FontAwesomeIcon icon={faCalendar} className="h-3 w-3" /> {due.text}</span>
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                                                    <button type="button" onClick={() => toggleTask(task.id)} aria-expanded={expanded} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 lg:flex-none">
                                                        {expanded ? '접기' : '자세히'}<FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} className="h-3 w-3" />
                                                    </button>
                                                    {actionLabel && (
                                                        <button type="button" disabled={isSubmitting} onClick={() => handlePrimaryAction(task)} className={`inline-flex min-h-10 flex-[1.4] items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white transition disabled:opacity-50 lg:flex-none ${REVIEW_STATUSES.has(task.status) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                                            {actionLabel}<FontAwesomeIcon icon={REVIEW_STATUSES.has(task.status) ? faCheck : faArrowRight} className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {expanded && (
                                            <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-6">
                                                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                                                    <div className="space-y-5">
                                                        <div>
                                                            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">요청 내용</h3>
                                                            <p className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">{task.description || '상세 내용이 없습니다.'}</p>
                                                        </div>
                                                        {images.length > 0 && (
                                                            <div>
                                                                <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">첨부 사진</h3>
                                                                <div className="flex flex-wrap gap-3">
                                                                    {images.map((image, index) => <button key={`${task.id}-image-${index}`} type="button" onClick={() => setPreviewImage(image)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={image} alt={`첨부 사진 ${index + 1}`} className="h-24 w-28 object-cover transition hover:scale-105" /></button>)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {REVIEW_STATUSES.has(task.status) && (
                                                            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <FontAwesomeIcon icon={faCircleCheck} className="mt-0.5 h-5 w-5 text-violet-600" />
                                                                    <div className="flex-1"><p className="font-extrabold text-violet-950">작업 결과를 확인해 주세요</p><p className="mt-1 text-sm leading-6 text-violet-700">문제가 해결되었다면 완료 승인, 보완이 필요하면 수정 요청을 선택하세요.</p></div>
                                                                </div>
                                                                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                                                    <button type="button" onClick={() => setRevisionTaskId(revisionTaskId === task.id ? null : task.id)} className="min-h-10 flex-1 rounded-xl border border-violet-200 bg-white px-4 text-sm font-extrabold text-violet-700 hover:bg-violet-100"><FontAwesomeIcon icon={faRotateLeft} className="mr-2 h-3.5 w-3.5" />수정 요청</button>
                                                                    <button type="button" disabled={isSubmitting} onClick={() => handlePrimaryAction(task)} className="min-h-10 flex-1 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"><FontAwesomeIcon icon={faCheck} className="mr-2 h-3.5 w-3.5" />완료 승인</button>
                                                                </div>
                                                                {revisionTaskId === task.id && (
                                                                    <div className="mt-4 rounded-xl border border-violet-200 bg-white p-3">
                                                                        <label htmlFor={`revision-${task.id}`} className="mb-2 block text-xs font-extrabold text-slate-600">수정이 필요한 내용을 적어 주세요</label>
                                                                        <textarea id={`revision-${task.id}`} value={revisionReason} onChange={event => setRevisionReason(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                                                                        <button type="button" disabled={!revisionReason.trim() || isSubmitting} onClick={() => void handleSubmitRevision(task)} className="mt-2 min-h-10 w-full rounded-xl bg-violet-600 px-4 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-40">수정 내용 전달</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">진행 기록</h3>
                                                        <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
                                                            {comments.length === 0 ? <p className="py-5 text-center text-sm text-slate-400">아직 등록된 메시지가 없습니다.</p> : comments.map(comment => (
                                                                <div key={comment.id} className={comment.isSystem ? 'rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500' : ''}>
                                                                    {!comment.isSystem && (
                                                                        <div className="rounded-2xl bg-indigo-50 p-3">
                                                                            <div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-extrabold text-indigo-900">{comment.user}</span><span className="text-[11px] text-indigo-400">{comment.time}</span></div>
                                                                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.text}</p>
                                                                            {(comment.images || (comment.image ? [comment.image] : [])).length > 0 && <div className="mt-2 flex flex-wrap gap-2">{(comment.images || (comment.image ? [comment.image] : [])).map((image, index) => <button key={`${comment.id}-${index}`} type="button" onClick={() => setPreviewImage(image)}><img src={image} alt="메시지 첨부" className="h-16 w-16 rounded-lg object-cover" /></button>)}</div>}
                                                                        </div>
                                                                    )}
                                                                    {comment.isSystem && <span><FontAwesomeIcon icon={faClock} className="mr-2 h-3 w-3" />{comment.text}</span>}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {commentImages.length > 0 && <div className="mt-3 flex gap-2">{commentImages.map((image, index) => <div key={`${image.slice(-12)}-${index}`} className="relative h-14 w-14"><img src={image} alt="메시지 첨부 미리보기" className="h-full w-full rounded-xl object-cover" /><button type="button" aria-label="메시지 첨부 삭제" onClick={() => setCommentImages(images => images.filter((_, imageIndex) => imageIndex !== index))} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"><FontAwesomeIcon icon={faX} className="h-2.5 w-2.5" /></button></div>)}</div>}
                                                        <div className="mt-3 flex items-end gap-2">
                                                            <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600">
                                                                <FontAwesomeIcon icon={faImage} className="h-4 w-4" /><span className="sr-only">메시지에 사진 첨부</span>
                                                                <input type="file" accept="image/*" multiple className="hidden" onChange={event => void appendImages(event.target.files, commentImages, setCommentImages)} />
                                                            </label>
                                                            <textarea value={commentText} onChange={event => setCommentText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSubmitComment(task); } }} rows={1} placeholder="메시지 남기기" className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                                                            <button type="button" aria-label="메시지 등록" disabled={isSubmitting || (!commentText.trim() && commentImages.length === 0)} onClick={() => void handleSubmitComment(task)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"><FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setPreviewImage(null)}>
                    <button type="button" aria-label="사진 미리보기 닫기" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><FontAwesomeIcon icon={faX} className="h-5 w-5" /></button>
                    <img src={previewImage} alt="첨부 사진 미리보기" className="max-h-[90vh] max-w-full rounded-2xl object-contain" onClick={event => event.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default TodoPage;
