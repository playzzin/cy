import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import {
    AlertTriangle,
    BellRing,
    Check,
    ChevronDown,
    Edit3,
    Eye,
    EyeOff,
    Filter,
    Megaphone,
    Pin,
    Plus,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    Users,
    X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { noticeService } from '../../services/noticeService';
import { systemMessageService } from '../../services/systemMessageService';
import { positionService, type Position } from '../../services/positionService';
import { userService, type UserData } from '../../services/userService';
import { manpowerService } from '../../services/manpowerService';
import type {
    Notice,
    NoticeAuthor,
    NoticeCategory,
    NoticePriority,
    UpsertNoticeInput
} from '../../types/notice';

type NoticeDraft = UpsertNoticeInput;

const defaultDraft: NoticeDraft = {
    title: '',
    body: '',
    category: '일반',
    targetPositions: [],
    priority: 'normal',
    pinned: false,
    expiresAt: null
};

const baseCategories = ['일반', '현장', '안전', '급여', '자재', '시스템'];
const defaultCategoryColor = '#0f766e';
const derivedCategoryIdPrefix = 'derived-category:';
const normalizeCategoryColor = (value?: string | null): string => {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : defaultCategoryColor;
};
const isDerivedCategory = (category: NoticeCategory): boolean =>
    category.id.startsWith(derivedCategoryIdPrefix);

const priorityLabels: Record<NoticePriority, string> = {
    normal: '일반',
    important: '중요',
    urgent: '긴급'
};

const priorityClassNames: Record<NoticePriority, string> = {
    normal: 'border-slate-200 bg-slate-50 text-slate-700',
    important: 'border-amber-200 bg-amber-50 text-amber-800',
    urgent: 'border-rose-200 bg-rose-50 text-rose-800'
};

const formatDateTime = (value?: Timestamp | null): string => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(value.toDate());
};

const uniqueStrings = (values: unknown[]): string[] =>
    Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const isAdminLike = (profile: UserData | null): boolean => {
    const values = [profile?.role, profile?.position, ...(profile?.additionalPositions || [])]
        .map((value) => String(value || '').trim().toLowerCase());
    return values.some((value) => (
        ['admin', 'administrator', 'super_admin', 'owner', 'manager', '관리자', '사장', '실장', '매니저'].includes(value)
    ));
};

const normalizeDevRoleKey = (value: unknown): string =>
    String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');

const isDevRoleValue = (value: unknown): boolean =>
    ['dev', 'developer', 'development', 'engineer', '\uac1c\ubc1c', '\uac1c\ubc1c\uc790', '\uac1c\ubc1c\ud300'].includes(normalizeDevRoleKey(value));

const isDevLike = (profile: UserData | null): boolean => (
    [profile?.role, profile?.position, profile?.department, ...(profile?.additionalPositions || [])].some(isDevRoleValue)
);

const targetLabel = (notice: Notice): string =>
    noticeService.isAllPositionsNotice(notice.targetPositions)
        ? '전체 직책'
        : notice.targetPositions.join(', ');

const buildSearchText = (notice: Notice): string =>
    [
        notice.title,
        notice.body,
        notice.category,
        notice.createdBy.name,
        notice.targetPositions.join(' ')
    ].join(' ').toLowerCase();

const NoticeBoardPage: React.FC = () => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [noticeCategories, setNoticeCategories] = useState<NoticeCategory[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [profile, setProfile] = useState<UserData | null>(null);
    const [linkedWorkerRole, setLinkedWorkerRole] = useState('');
    const [openNoticeIds, setOpenNoticeIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [positionFilters, setPositionFilters] = useState<string[]>([]);
    const [draft, setDraft] = useState<NoticeDraft>(defaultDraft);
    const [categoryDraftName, setCategoryDraftName] = useState('');
    const [categoryDraftColor, setCategoryDraftColor] = useState(defaultCategoryColor);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const isNoticeAdmin = isAdminLike(profile);
    const canManageCategories = Boolean(currentUser);
    const canViewPositionFilters = isDevLike(profile) || isDevRoleValue(linkedWorkerRole);

    const actor = useMemo<NoticeAuthor>(() => ({
        uid: currentUser?.uid || 'unknown',
        name: currentUser?.displayName || profile?.displayName || currentUser?.email || '관리자',
        email: currentUser?.email || profile?.email || null
    }), [currentUser?.displayName, currentUser?.email, currentUser?.uid, profile?.displayName, profile?.email]);

    const targetNoticeId = useMemo(() => (
        new URLSearchParams(location.search).get('noticeId')?.trim() || ''
    ), [location.search]);

    const viewerPositions = useMemo(() => uniqueStrings([
        profile?.position,
        profile?.role,
        linkedWorkerRole,
        ...(profile?.additionalPositions || [])
    ]), [linkedWorkerRole, profile]);

    useEffect(() => {
        const unsubscribe = noticeService.subscribeNotices(
            (nextNotices) => {
                setNotices(nextNotices);
                setIsLoading(false);
            },
            () => {
                setErrorMessage('공지사항을 불러오지 못했습니다.');
                setIsLoading(false);
            }
        );

        return unsubscribe;
    }, []);

    useEffect(() => {
        const unsubscribe = noticeService.subscribeCategories(
            setNoticeCategories,
            () => setErrorMessage('공지 카테고리를 불러오지 못했습니다.')
        );

        return unsubscribe;
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadMeta = async () => {
            try {
                const [loadedPositions, loadedProfile, linkedWorker] = await Promise.all([
                    positionService.getPositions(),
                    currentUser?.uid ? userService.getUser(currentUser.uid) : Promise.resolve(null),
                    currentUser?.uid ? manpowerService.getWorkerByUid(currentUser.uid).catch(() => null) : Promise.resolve(null)
                ]);
                if (cancelled) return;
                setPositions(loadedPositions);
                setProfile(loadedProfile);
                setLinkedWorkerRole(String(linkedWorker?.role || '').trim());
            } catch (error) {
                console.error('[NoticeBoard] failed to load profile metadata:', error);
                if (!cancelled) setErrorMessage('사용자 직책 정보를 불러오지 못했습니다.');
            }
        };

        void loadMeta();
        return () => {
            cancelled = true;
        };
    }, [currentUser?.uid]);

    const availableCategories = useMemo(() => {
        const fromManaged = noticeCategories.map((category) => category.name);
        const fromNotices = notices.map((notice) => notice.category);
        return uniqueStrings([
            ...(noticeCategories.length === 0 ? baseCategories : []),
            ...fromManaged,
            ...fromNotices
        ]).sort((left, right) => left.localeCompare(right, 'ko-KR'));
    }, [noticeCategories, notices]);

    const editableCategories = useMemo<NoticeCategory[]>(() => {
        const managedByName = new Map<string, NoticeCategory>();
        noticeCategories.forEach((category) => managedByName.set(category.name, category));

        return availableCategories.map((name, index) => (
            managedByName.get(name) || {
                id: `${derivedCategoryIdPrefix}${name}`,
                name,
                color: defaultCategoryColor,
                order: index + 1,
                createdAt: null,
                updatedAt: null
            }
        ));
    }, [availableCategories, noticeCategories]);

    const categoryByName = useMemo(() => {
        const map = new Map<string, NoticeCategory>();
        editableCategories.forEach((category) => map.set(category.name, category));
        return map;
    }, [editableCategories]);

    const noticeCategoryOptions = useMemo(() => {
        const options = editingNoticeId && draft.category
            ? [draft.category, ...availableCategories]
            : availableCategories;
        return uniqueStrings(options.length > 0 ? options : [defaultDraft.category])
            .sort((left, right) => left.localeCompare(right, 'ko-KR'));
    }, [availableCategories, draft.category, editingNoticeId]);

    const allPositionOptions = useMemo(() => {
        const fromPositions = positions.map((position) => position.name);
        const fromNotices = notices.flatMap((notice) => notice.targetPositions);
        return uniqueStrings([...fromPositions, ...fromNotices, ...viewerPositions])
            .filter((position) => !noticeService.isAllPositionsNotice([position]))
            .sort((left, right) => left.localeCompare(right, 'ko-KR'));
    }, [notices, positions, viewerPositions]);

    const filteredNotices = useMemo(() => {
        const queryText = searchQuery.trim().toLowerCase();

        return notices.filter((notice) => {
            if (!isNoticeAdmin && !noticeService.isNoticeVisibleToPositions(notice, viewerPositions, false)) {
                return false;
            }

            if (categoryFilter !== 'all' && notice.category !== categoryFilter) return false;

            if (canViewPositionFilters && positionFilters.length > 0) {
                const globalNotice = noticeService.isAllPositionsNotice(notice.targetPositions);
                const selectedSpecificPositions = positionFilters.filter((position) => position !== 'global');
                const hasGlobalFilter = positionFilters.includes('global');
                const hasSpecificFilter = selectedSpecificPositions.length > 0;
                const selectedKeys = new Set(selectedSpecificPositions.map(noticeService.normalizePositionKey));
                const matchesSpecificPosition = notice.targetPositions.some((position) =>
                    selectedKeys.has(noticeService.normalizePositionKey(position))
                );

                if (globalNotice) {
                    if (!hasGlobalFilter && !hasSpecificFilter) return false;
                } else if (!matchesSpecificPosition) {
                    return false;
                }
            }

            if (!queryText) return true;
            return buildSearchText(notice).includes(queryText);
        });
    }, [canViewPositionFilters, categoryFilter, isNoticeAdmin, notices, positionFilters, searchQuery, viewerPositions]);

    useEffect(() => {
        if (!canViewPositionFilters && positionFilters.length > 0) {
            setPositionFilters([]);
        }
    }, [canViewPositionFilters, positionFilters.length]);

    useEffect(() => {
        setOpenNoticeIds((previous) => {
            const liveIds = new Set(filteredNotices.map((notice) => notice.id));
            const hasOpenNotice = Array.from(previous).some((id) => liveIds.has(id));
            if (hasOpenNotice) return previous;
            return filteredNotices[0] ? new Set([filteredNotices[0].id]) : new Set();
        });
    }, [filteredNotices]);

    useEffect(() => {
        if (!targetNoticeId) return;
        const targetNotice = notices.find((notice) => notice.id === targetNoticeId);
        if (!targetNotice) return;

        setSearchQuery('');
        setCategoryFilter('all');
        setPositionFilters([]);
        setOpenNoticeIds((previous) => (
            previous.size === 1 && previous.has(targetNoticeId)
                ? previous
                : new Set([targetNoticeId])
        ));
    }, [notices, targetNoticeId]);

    const visibleCount = filteredNotices.length;
    const urgentCount = filteredNotices.filter((notice) => notice.priority === 'urgent').length;
    const pinnedCount = filteredNotices.filter((notice) => notice.pinned).length;
    const categoryUsageCounts = useMemo(() => {
        const counts = new Map<string, number>();
        notices.forEach((notice) => counts.set(notice.category, (counts.get(notice.category) || 0) + 1));
        return counts;
    }, [notices]);

    useEffect(() => {
        if (!isEditorOpen || editingNoticeId || availableCategories.length === 0) return;
        setDraft((previous) => (
            availableCategories.includes(previous.category)
                ? previous
                : { ...previous, category: availableCategories[0] }
        ));
    }, [availableCategories, editingNoticeId, isEditorOpen]);

    const resetEditor = useCallback((clearStatus = true) => {
        setDraft(defaultDraft);
        setEditingNoticeId(null);
        setIsEditorOpen(false);
        if (clearStatus) setStatusMessage('');
    }, []);

    const toggleOpen = (noticeId: string) => {
        setOpenNoticeIds((previous) => {
            const next = new Set(previous);
            if (next.has(noticeId)) next.delete(noticeId);
            else next.add(noticeId);
            return next;
        });
    };

    const toggleDraftPosition = (position: string) => {
        setDraft((previous) => {
            const exists = previous.targetPositions.includes(position);
            return {
                ...previous,
                targetPositions: exists
                    ? previous.targetPositions.filter((item) => item !== position)
                    : [...previous.targetPositions, position]
            };
        });
    };

    const togglePositionFilter = (position: string) => {
        setPositionFilters((previous) => (
            previous.includes(position)
                ? previous.filter((item) => item !== position)
                : [...previous, position]
        ));
    };

    const resetCategoryDraft = () => {
        setCategoryDraftName('');
        setCategoryDraftColor(defaultCategoryColor);
        setEditingCategoryId(null);
    };

    const startEditCategory = (category: NoticeCategory) => {
        setCategoryDraftName(category.name);
        setCategoryDraftColor(normalizeCategoryColor(category.color));
        setEditingCategoryId(category.id);
    };

    const saveCategory = async () => {
        if (!canManageCategories) return;
        const nextName = categoryDraftName.trim();
        if (!nextName) {
            setErrorMessage('카테고리명을 입력해주세요.');
            return;
        }

        const duplicate = editableCategories.some((category) =>
            category.id !== editingCategoryId &&
            category.name.localeCompare(nextName, 'ko-KR', { sensitivity: 'accent' }) === 0
        );
        if (duplicate) {
            setErrorMessage('이미 존재하는 카테고리입니다.');
            return;
        }

        setIsSaving(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            if (editingCategoryId) {
                const current = editableCategories.find((category) => category.id === editingCategoryId);
                if (!current) throw new Error('category-not-found');
                if (isDerivedCategory(current)) {
                    if (noticeCategories.length === 0) {
                        await noticeService.createCategories(
                            editableCategories.map((category, index) => ({
                                name: category.id === current.id ? nextName : category.name,
                                color: category.id === current.id ? categoryDraftColor : category.color,
                                order: index + 1
                            }))
                        );
                    } else {
                        await noticeService.createCategory({
                            name: nextName,
                            color: categoryDraftColor,
                            order: current.order
                        });
                    }
                    await noticeService.renameCategory(current.name, nextName);
                } else {
                    await noticeService.updateCategory(current, {
                        name: nextName,
                        color: categoryDraftColor,
                        order: current.order
                    });
                }
                if (categoryFilter === current.name) setCategoryFilter(nextName);
                setDraft((previous) => previous.category === current.name ? { ...previous, category: nextName } : previous);
                setStatusMessage('카테고리를 수정했습니다.');
            } else {
                await noticeService.createCategory({
                    name: nextName,
                    color: categoryDraftColor,
                    order: editableCategories.length + 1
                });
                setStatusMessage('카테고리를 추가했습니다.');
            }
            resetCategoryDraft();
        } catch (error) {
            console.error('[NoticeBoard] category save failed:', error);
            setErrorMessage('카테고리 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteCategory = async (category: NoticeCategory) => {
        if (!canManageCategories) return;
        const usedCount = categoryUsageCounts.get(category.name) || 0;
        const fallbackCategory = category.name === '일반' ? '미분류' : '일반';
        const message = usedCount > 0
            ? `"${category.name}" 카테고리를 삭제하고, 연결된 공지 ${usedCount.toLocaleString('ko-KR')}건을 "${fallbackCategory}"(으)로 이동할까요?`
            : `"${category.name}" 카테고리를 삭제할까요?`;
        if (!window.confirm(message)) return;

        setIsSaving(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            if (isDerivedCategory(category)) {
                if (noticeCategories.length === 0) {
                    await noticeService.createCategories(
                        editableCategories
                            .filter((item) => item.id !== category.id)
                            .map((item, index) => ({
                                name: item.name,
                                color: item.color,
                                order: index + 1
                            }))
                    );
                }
                await noticeService.renameCategory(category.name, fallbackCategory);
            } else {
                await noticeService.deleteCategory(category, fallbackCategory);
            }
            if (categoryFilter === category.name) setCategoryFilter('all');
            setDraft((previous) => previous.category === category.name ? { ...previous, category: fallbackCategory } : previous);
            if (editingCategoryId === category.id) resetCategoryDraft();
            setStatusMessage('카테고리를 삭제했습니다.');
        } catch (error) {
            console.error('[NoticeBoard] category delete failed:', error);
            setErrorMessage('카테고리 삭제에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const startCreate = () => {
        setDraft({
            ...defaultDraft,
            category: availableCategories[0] || defaultDraft.category
        });
        setEditingNoticeId(null);
        setIsEditorOpen(true);
        setStatusMessage('');
    };

    const startEdit = (notice: Notice) => {
        setDraft({
            title: notice.title,
            body: notice.body,
            category: notice.category,
            targetPositions: [...notice.targetPositions],
            priority: notice.priority,
            pinned: notice.pinned,
            expiresAt: notice.expiresAt || null
        });
        setEditingNoticeId(notice.id);
        setIsEditorOpen(true);
        setStatusMessage('');
    };

    const saveNotice = async () => {
        if (!isNoticeAdmin) return;
        setIsSaving(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            if (editingNoticeId) {
                await noticeService.updateNotice(editingNoticeId, draft, actor);
                setStatusMessage('공지사항을 수정했습니다.');
            } else {
                const noticeId = await noticeService.createNotice(draft, actor);
                await systemMessageService.notifyNoticeCreatedEvent({ ...draft, id: noticeId }, actor);
                setOpenNoticeIds(new Set([noticeId]));
                setStatusMessage('공지사항을 등록했습니다.');
            }
            resetEditor(false);
        } catch (error) {
            console.error('[NoticeBoard] save failed:', error);
            const message = error instanceof Error ? error.message : '';
            if (message === 'title-required') setErrorMessage('제목을 입력해주세요.');
            else if (message === 'body-required') setErrorMessage('본문을 입력해주세요.');
            else setErrorMessage('공지사항 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteNoticeItem = async (notice: Notice) => {
        if (!isNoticeAdmin) return;
        if (!window.confirm(`"${notice.title}" 공지사항을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) return;

        setIsSaving(true);
        setErrorMessage('');
        setStatusMessage('');

        try {
            await noticeService.deleteNotice(notice.id);
            setOpenNoticeIds((previous) => {
                const next = new Set(previous);
                next.delete(notice.id);
                return next;
            });
            if (editingNoticeId === notice.id) resetEditor(false);
            setStatusMessage('공지사항을 삭제했습니다.');
        } catch (error) {
            console.error('[NoticeBoard] delete failed:', error);
            setErrorMessage('공지사항 삭제에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setCategoryFilter('all');
        setPositionFilters([]);
    };

    const layoutClassName = isNoticeAdmin && isEditorOpen
        ? 'grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_380px]'
        : 'grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]';

    return (
        <main className="min-h-screen bg-slate-100 p-3 text-slate-950 sm:p-5">
            <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
                <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white">
                                <BellRing className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">공지사항</h1>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                    <span>내 직책: {viewerPositions.length > 0 ? viewerPositions.join(', ') : '미지정'}</span>
                                    {isNoticeAdmin && <span className="text-emerald-700">관리 가능</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] font-bold text-slate-500">표시</div>
                            <div className="text-lg font-black text-slate-950">{visibleCount.toLocaleString('ko-KR')}</div>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                            <div className="text-[11px] font-bold text-rose-600">긴급</div>
                            <div className="text-lg font-black text-rose-800">{urgentCount.toLocaleString('ko-KR')}</div>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <div className="text-[11px] font-bold text-amber-700">고정</div>
                            <div className="text-lg font-black text-amber-900">{pinnedCount.toLocaleString('ko-KR')}</div>
                        </div>
                        {isNoticeAdmin && (
                            <button
                                type="button"
                                onClick={startCreate}
                                className="col-span-3 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 sm:col-span-1"
                            >
                                <Plus className="h-4 w-4" />
                                새 공지
                            </button>
                        )}
                    </div>
                </header>

                {errorMessage && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {errorMessage}
                    </div>
                )}
                {statusMessage && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                        <Check className="h-4 w-4 shrink-0" />
                        {statusMessage}
                    </div>
                )}

                <div className={layoutClassName}>
                    <aside className="min-w-0 self-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                <Filter className="h-4 w-4" />
                                필터
                            </div>
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                            >
                                초기화
                            </button>
                        </div>

                        <label className="mt-3 block">
                            <span className="mb-1 block text-xs font-bold text-slate-500">검색</span>
                            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
                                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                                    placeholder="제목, 본문, 작성자"
                                />
                            </span>
                        </label>

                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-500">카테고리</span>
                                {canManageCategories && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCategoryManagerOpen((previous) => !previous)}
                                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                                    >
                                        {isCategoryManagerOpen ? '닫기' : '관리'}
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCategoryFilter('all')}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                                        categoryFilter === 'all'
                                            ? 'border-teal-700 bg-teal-700 text-white'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    전체
                                </button>
                                {availableCategories.map((category) => (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => setCategoryFilter(category)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                                            categoryFilter === category
                                                ? 'border-teal-700 bg-teal-700 text-white'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: categoryByName.get(category)?.color || defaultCategoryColor }}
                                        />
                                        {category}
                                    </button>
                                ))}
                            </div>

                            {canManageCategories && isCategoryManagerOpen && (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-[minmax(0,1fr)_42px] gap-2">
                                            <input
                                                value={categoryDraftName}
                                                onChange={(event) => setCategoryDraftName(event.target.value)}
                                                className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                                placeholder="카테고리명"
                                            />
                                            <input
                                                type="color"
                                                value={categoryDraftColor}
                                                onChange={(event) => setCategoryDraftColor(event.target.value)}
                                                className="h-10 w-full rounded-lg border border-slate-200 bg-white p-1"
                                                title="카테고리 색상"
                                                aria-label="카테고리 색상"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void saveCategory()}
                                                disabled={isSaving}
                                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 text-xs font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Save className="h-3.5 w-3.5" />
                                                {editingCategoryId ? '수정' : '추가'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={resetCategoryDraft}
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                                        {editableCategories.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs font-bold text-slate-500">
                                                저장된 카테고리가 없습니다.
                                            </div>
                                        ) : (
                                            editableCategories.map((category) => (
                                                <div key={category.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                                                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                                                    <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-700">
                                                        {category.name}
                                                        <span className="ml-1 font-bold text-slate-400">
                                                            {categoryUsageCounts.get(category.name) || 0}
                                                        </span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditCategory(category)}
                                                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                                                        title="카테고리 수정"
                                                        aria-label="카테고리 수정"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void deleteCategory(category)}
                                                        disabled={isSaving}
                                                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="카테고리 삭제"
                                                        aria-label="카테고리 삭제"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        삭제
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {canViewPositionFilters && (
                            <div className="mt-4">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-500">직책</span>
                                    {positionFilters.length > 0 && (
                                        <span className="text-[11px] font-black text-indigo-700">
                                            {positionFilters.length.toLocaleString('ko-KR')}개 선택
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPositionFilters([])}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                                            positionFilters.length === 0
                                                ? 'border-indigo-700 bg-indigo-700 text-white'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        전체
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => togglePositionFilter('global')}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                                            positionFilters.includes('global')
                                                ? 'border-indigo-700 bg-indigo-700 text-white'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        전체 직책
                                    </button>
                                    {allPositionOptions.map((position) => (
                                        <button
                                            key={position}
                                            type="button"
                                            onClick={() => togglePositionFilter(position)}
                                            className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                                                positionFilters.includes(position)
                                                    ? 'border-indigo-700 bg-indigo-700 text-white'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {position}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>

                    <section className="min-w-0">
                        {isLoading ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
                                공지사항을 불러오는 중입니다.
                            </div>
                        ) : filteredNotices.length === 0 ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                                <Megaphone className="mx-auto h-9 w-9 text-slate-300" />
                                <p className="mt-3 text-sm font-black text-slate-700">표시할 공지사항이 없습니다.</p>
                                {isNoticeAdmin && (
                                    <button
                                        type="button"
                                        onClick={startCreate}
                                        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        새 공지
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredNotices.map((notice) => {
                                    const isOpen = openNoticeIds.has(notice.id);
                                    const expired = noticeService.isExpired(notice);
                                    const dimmed = expired;

                                    return (
                                        <article
                                            key={notice.id}
                                            className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
                                                isOpen ? 'border-slate-300' : 'border-slate-200 hover:border-slate-300'
                                            } ${dimmed ? 'opacity-75' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleOpen(notice.id)}
                                                className="grid w-full gap-3 px-4 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                                                aria-expanded={isOpen}
                                            >
                                                <span className="min-w-0">
                                                    <span className="mb-2 flex flex-wrap items-center gap-2">
                                                        {notice.pinned && (
                                                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-800">
                                                                <Pin className="h-3 w-3" />
                                                                고정
                                                            </span>
                                                        )}
                                                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-black ${priorityClassNames[notice.priority]}`}>
                                                            {notice.priority === 'urgent' ? <AlertTriangle className="h-3 w-3" /> : <Megaphone className="h-3 w-3" />}
                                                            {priorityLabels[notice.priority]}
                                                        </span>
                                                        <span className="rounded-lg border border-teal-100 bg-teal-50 px-2 py-1 text-[11px] font-black text-teal-800">
                                                            {notice.category}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-800">
                                                            <Users className="h-3 w-3" />
                                                            {targetLabel(notice)}
                                                        </span>
                                                    </span>
                                                    <span className="block truncate text-lg font-black text-slate-950">{notice.title}</span>
                                                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                                                        <span>{notice.createdBy.name}</span>
                                                        <span>{formatDateTime(notice.publishedAt || notice.updatedAt || notice.createdAt)}</span>
                                                        {notice.expiresAt && <span>만료 {formatDateTime(notice.expiresAt)}</span>}
                                                    </span>
                                                </span>
                                                <span className="flex items-center justify-between gap-2 sm:justify-end">
                                                    {isNoticeAdmin && (
                                                        <span className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                onClick={() => startEdit(notice)}
                                                                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                                                                title="수정"
                                                                aria-label="공지사항 수정"
                                                            >
                                                                <Edit3 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void deleteNoticeItem(notice)}
                                                                disabled={isSaving}
                                                                className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                title="삭제"
                                                                aria-label="공지사항 삭제"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </span>
                                                    )}
                                                    <ChevronDown className={`h-5 w-5 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                                                </span>
                                            </button>

                                            {isOpen && (
                                                <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                                                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800">
                                                        {notice.body.split(/\r?\n/).map((line, index) => (
                                                            <React.Fragment key={`${notice.id}-${index}`}>
                                                                {line || '\u00a0'}
                                                                {index < notice.body.split(/\r?\n/).length - 1 && <br />}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {isNoticeAdmin && isEditorOpen && (
                        <aside className="min-w-0 self-start rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-3">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                                        <ShieldCheck className="h-4 w-4 text-emerald-700" />
                                        {editingNoticeId ? '공지 수정' : '새 공지'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => resetEditor()}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                                    title="닫기"
                                    aria-label="닫기"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <label className="block">
                                    <span className="mb-1 block text-xs font-bold text-slate-500">제목</span>
                                    <input
                                        value={draft.title}
                                        onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                    />
                                </label>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-bold text-slate-500">카테고리</span>
                                        <select
                                            value={draft.category}
                                            onChange={(event) => setDraft((previous) => ({ ...previous, category: event.target.value }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                        >
                                            {noticeCategoryOptions.map((category) => (
                                                <option key={category} value={category}>
                                                    {category}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-xs font-bold text-slate-500">중요도</span>
                                        <select
                                            value={draft.priority}
                                            onChange={(event) => setDraft((previous) => ({ ...previous, priority: event.target.value as NoticePriority }))}
                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                        >
                                            <option value="normal">일반</option>
                                            <option value="important">중요</option>
                                            <option value="urgent">긴급</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={draft.pinned}
                                        onChange={(event) => setDraft((previous) => ({ ...previous, pinned: event.target.checked }))}
                                        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-700"
                                    />
                                    상단 고정
                                </label>

                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-500">대상 직책</span>
                                        <button
                                            type="button"
                                            onClick={() => setDraft((previous) => ({ ...previous, targetPositions: [] }))}
                                            className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-black transition ${
                                                draft.targetPositions.length === 0
                                                    ? 'border-indigo-700 bg-indigo-700 text-white'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                            전체 직책
                                        </button>
                                    </div>
                                    <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                                        {allPositionOptions.length === 0 ? (
                                            <div className="p-3 text-xs font-bold text-slate-500">직책 데이터 없음</div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {allPositionOptions.map((position) => {
                                                    const selected = draft.targetPositions.includes(position);
                                                    return (
                                                        <button
                                                            key={position}
                                                            type="button"
                                                            onClick={() => toggleDraftPosition(position)}
                                                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-black transition ${
                                                                selected
                                                                    ? 'border-indigo-700 bg-indigo-700 text-white'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            {selected ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                                            {position}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <label className="block">
                                    <span className="mb-1 block text-xs font-bold text-slate-500">본문</span>
                                    <textarea
                                        value={draft.body}
                                        onChange={(event) => setDraft((previous) => ({ ...previous, body: event.target.value }))}
                                        className="min-h-[220px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                    />
                                </label>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end xl:flex-col-reverse">
                                    <button
                                        type="button"
                                        onClick={() => resetEditor()}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void saveNotice()}
                                        disabled={isSaving}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        저장
                                    </button>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </main>
    );
};

export default NoticeBoardPage;
