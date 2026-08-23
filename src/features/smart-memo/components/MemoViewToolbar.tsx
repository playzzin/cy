import React from 'react';
import {
    CheckSquare,
    ChevronDown,
    FileText,
    FolderPlus,
    List,
    Plus,
    Search
} from 'lucide-react';

type MemoViewMode = 'split' | 'sticky';
type MemoSortMode = 'updated-desc' | 'created-desc' | 'title-asc';
type MemoType = 'text' | 'checklist';

type MemoViewToolbarProps = {
    searchQuery: string;
    sortMode: MemoSortMode;
    viewMode: MemoViewMode;
    isCreateMenuOpen: boolean;
    isSaving: boolean;
    onSearchQueryChange: (value: string) => void;
    onSortModeChange: (value: MemoSortMode) => void;
    onViewModeChange: (value: MemoViewMode) => void;
    onOpenCategoryComposer: () => void;
    onToggleCreateMenu: () => void;
    onCloseCreateMenu: () => void;
    onCreateMemo: (type: MemoType) => void;
};

export function MemoViewToolbar({
    searchQuery,
    sortMode,
    viewMode,
    isCreateMenuOpen,
    isSaving,
    onSearchQueryChange,
    onSortModeChange,
    onViewModeChange,
    onOpenCategoryComposer,
    onToggleCreateMenu,
    onCloseCreateMenu,
    onCreateMemo
}: MemoViewToolbarProps) {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-end xl:max-w-[900px]">
            <label className="relative block min-w-0 flex-1 lg:max-w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    value={searchQuery}
                    onChange={event => onSearchQueryChange(event.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    placeholder="제목, 내용, 카테고리 검색"
                    aria-label="메모 검색"
                />
            </label>

            <label className="relative min-w-0 flex-1 lg:max-w-40">
                <span className="sr-only">메모 정렬</span>
                <select
                    value={sortMode}
                    onChange={event => onSortModeChange(event.target.value as MemoSortMode)}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    aria-label="메모 정렬"
                >
                    <option value="updated-desc">최근 수정순</option>
                    <option value="created-desc">최근 생성순</option>
                    <option value="title-asc">제목순</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </label>

            <div className="flex min-w-0 items-center gap-2">
                <div
                    className="inline-flex h-14 min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm sm:h-11 sm:flex-none"
                    role="group"
                    aria-label="기본 보기 선택"
                    title="선택한 보기를 다음 방문의 기본값으로 저장합니다."
                >
                    <span className="hidden px-2 text-[11px] font-bold text-slate-500 md:inline">기본 보기</span>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('split')}
                        className={`inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 text-sm font-bold transition sm:flex-none ${
                            viewMode === 'split'
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-white'
                        }`}
                        aria-label="목록과 편집 보기"
                        aria-pressed={viewMode === 'split'}
                    >
                        <List className="h-4 w-4" />
                        목록
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('sticky')}
                        className={`inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 text-sm font-bold transition sm:flex-none ${
                            viewMode === 'sticky'
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-white'
                        }`}
                        aria-label="스티커 보기"
                        aria-pressed={viewMode === 'sticky'}
                    >
                        <CheckSquare className="h-4 w-4" />
                        스티커
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onOpenCategoryComposer}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-0 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:h-11 sm:w-auto sm:px-3"
                    aria-label="카테고리 만들기"
                >
                    <FolderPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">카테고리</span>
                </button>

                <div className="relative shrink-0">
                    {isCreateMenuOpen && (
                        <button
                            type="button"
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={onCloseCreateMenu}
                            aria-label="새 메모 메뉴 닫기"
                        />
                    )}
                    <button
                        type="button"
                        onClick={onToggleCreateMenu}
                        disabled={isSaving}
                        className="relative z-50 inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-slate-950 px-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11"
                        aria-haspopup="menu"
                        aria-expanded={isCreateMenuOpen}
                        aria-label="새 메모 메뉴 열기"
                    >
                        <Plus className="h-4 w-4" />
                        새 메모
                        <ChevronDown className="h-4 w-4" />
                    </button>
                    {isCreateMenuOpen && (
                        <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" role="menu">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => onCreateMemo('text')}
                                className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-slate-800 transition hover:bg-slate-100"
                            >
                                <FileText className="h-4 w-4 text-blue-700" />
                                일반 메모
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => onCreateMemo('checklist')}
                                className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-slate-800 transition hover:bg-slate-100"
                            >
                                <CheckSquare className="h-4 w-4 text-emerald-700" />
                                체크리스트
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MemoViewToolbar;
