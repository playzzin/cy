import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMemoStore } from '../../features/smart-memo/store/useMemoStore';
import { debounce } from 'lodash';
import { Loader2, Save, FilePlus, Trash2, Pin, PinOff } from 'lucide-react';
import { Memo, MemoColor } from '../../features/smart-memo/types/memo';
import { cn } from '../../features/smart-memo/lib/utils';

const COLORS: MemoColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];
const QUICK_TAG = '__quick';

const COLOR_DOT: Record<MemoColor, string> = {
	white: '#ddd',
	red: '#ffbcbc',
	orange: '#ffd4a0',
	yellow: '#ffe87a',
	green: '#9ee09e',
	blue: '#9ec8ff',
	purple: '#c8a0ff',
	gray: '#c0c0c0',
};

const COLOR_BG: Record<MemoColor, string> = {
	white: 'bg-white',
	red: 'bg-[#ffebec]',
	orange: 'bg-[#fff0e0]',
	yellow: 'bg-[#fffbe0]',
	green: 'bg-[#e6fdec]',
	blue: 'bg-[#e3f2fd]',
	purple: 'bg-[#f3e5f5]',
	gray: 'bg-[#f5f5f5]',
};

const TXT = {
	quickNote: 'Quick Note',
	newMemo: '새 메모 (Ctrl+N)',
	saving: '저장 중...',
	saved: '저장됨',
	placeholder: '내용을 입력하세요... (자동 저장)',
	titlePlaceholder: '제목 없음',
	memoList: '메모 목록',
	compactOn: '작게',
	compactOff: '크게',
	emptyList: '메모가 없습니다.',
	deleteMemo: '메모 삭제',
	deleteConfirm: '이 메모를 삭제할까요?',
	failedSave: '저장 실패',
	pinMemo: '상단 고정',
	unpinMemo: '고정 해제',
};

const getMemoUpdatedAtMs = (memo: Memo): number => {
	const updated = memo.updatedAt as any;
	if (!updated) return 0;
	if (typeof updated === 'number') return updated;
	if (typeof updated?.seconds === 'number') return updated.seconds * 1000;
	if (typeof updated?.toMillis === 'function') return updated.toMillis();
	return 0;
};

const formatUpdatedAt = (memo: Memo): string => {
	const ms = getMemoUpdatedAtMs(memo);
	if (!ms) return '';
	const d = new Date(ms);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return '방금';
	if (diffMin < 60) return `${diffMin}분 전`;
	if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`;
	return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const getContentPreview = (text: string): string => {
	const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
	return firstLine || '(내용 없음)';
};

const getMemoDisplayTitle = (memo: Memo): string => {
	if (!memo.title || memo.title === TXT.quickNote) return '';
	return memo.title;
};

export const QuickMemoEditor: React.FC = () => {
	const { currentUser } = useAuth();
	const { memos, addMemo, updateMemo, deleteMemo, subscribeMemos } = useMemoStore();

	const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
	const [memoId, setMemoId] = useState<string | null>(null);
	const [content, setContent] = useState('');
	const [color, setColor] = useState<MemoColor>('yellow');
	const [isCompactList, setIsCompactList] = useState(true);
	const creatingRef = useRef(false);
	const contentRef = useRef('');
	const colorRef = useRef<MemoColor>('yellow');
	const hasPendingChangesRef = useRef(false);

	const quickMemos = useMemo(() => {
		const filtered = memos.filter((m) => m.title === TXT.quickNote && !m.isPinned);
		return [...filtered].sort((a, b) => getMemoUpdatedAtMs(b) - getMemoUpdatedAtMs(a));
	}, [memos]);

	useEffect(() => {
		if (!currentUser) return;
		const unsubscribe = subscribeMemos(currentUser.uid);
		return () => {
			unsubscribe();
		};
	}, [currentUser, subscribeMemos]);

	const createNewMemo = useCallback(async (): Promise<string | null> => {
		if (!currentUser) return null;
		setStatus('saving');
		try {
			const newId = await addMemo({
				title: TXT.quickNote,
				content: '',
				color: 'yellow',
				type: 'text',
				isPinned: false,
				scope: 'private',
				order: 0,
				x: 0,
				y: 0,
				w: 4,
				h: 4,
				checklistItems: [],
				tags: [],
				categoryId: null,
				isCollapsed: false,
			}, currentUser.uid);
			setMemoId(newId);
			setContent('');
			setColor('yellow');
			setStatus('ready');
			return newId;
		} catch (e) {
			console.error('Failed to create quick memo', e);
			setStatus('error');
			return null;
		}
	}, [addMemo, currentUser]);

	useEffect(() => {
		if (!currentUser) return;

		if (quickMemos.length === 0) {
			if (creatingRef.current) return;
			creatingRef.current = true;
			void createNewMemo().finally(() => {
				creatingRef.current = false;
			});
			return;
		}

		if (!memoId || !quickMemos.some((memo) => memo.id === memoId)) {
			setMemoId(quickMemos[0].id);
			setStatus('ready');
		}
	}, [currentUser, quickMemos, memoId, createNewMemo]);

	useEffect(() => {
		if (!memoId) return;
		const selected = quickMemos.find((memo) => memo.id === memoId);
		if (!selected) return;

		// 입력 중에는 스토어 스냅샷이 로컬 편집값을 덮어쓰지 않도록 보호
		if (hasPendingChangesRef.current) return;

		setContent((prev) => (prev === selected.content ? prev : selected.content));
		setColor((prev) => (prev === selected.color ? prev : selected.color));
	}, [memoId, quickMemos]);

	useEffect(() => {
		contentRef.current = content;
	}, [content]);

	useEffect(() => {
		colorRef.current = color;
	}, [color]);

	const performSave = useCallback(async (id: string, newContent: string, newColor: MemoColor) => {
		setStatus('saving');
		try {
			await updateMemo(id, { content: newContent, color: newColor });
			hasPendingChangesRef.current = false;
			setStatus('ready');
		} catch (e) {
			setStatus('error');
		}
	}, [updateMemo]);

	const saveContent = useMemo(
		() => debounce((id: string, newContent: string, newColor: MemoColor) => {
			void performSave(id, newContent, newColor);
		}, 700),
		[performSave]
	);

	const flushCurrentMemoSave = useCallback(async () => {
		if (!memoId || !hasPendingChangesRef.current) return;
		saveContent.cancel();
		await performSave(memoId, contentRef.current, colorRef.current);
	}, [memoId, performSave, saveContent]);

	useEffect(() => {
		return () => {
			if (memoId && hasPendingChangesRef.current) {
				void performSave(memoId, contentRef.current, colorRef.current);
			}
			saveContent.cancel();
		};
	}, [memoId, performSave, saveContent]);

	const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		hasPendingChangesRef.current = true;
		contentRef.current = val;
		setContent(val);
		if (memoId) {
			saveContent(memoId, val, color);
		}
	};

	const handleColorChange = async (nextColor: MemoColor) => {
		hasPendingChangesRef.current = true;
		colorRef.current = nextColor;
		setColor(nextColor);
		if (memoId) {
			saveContent.cancel();
			await performSave(memoId, contentRef.current, nextColor);
		}
	};

	const handleDeleteMemo = useCallback(async (targetMemoId: string) => {
		if (!window.confirm(TXT.deleteConfirm)) return;

		saveContent.cancel();
		setStatus('saving');
		try {
			await deleteMemo(targetMemoId);
			hasPendingChangesRef.current = false;

			if (memoId === targetMemoId) {
				const remaining = quickMemos.filter((memo) => memo.id !== targetMemoId);
				if (remaining.length > 0) {
					setMemoId(remaining[0].id);
					setContent(remaining[0].content);
					setColor(remaining[0].color);
					contentRef.current = remaining[0].content;
					colorRef.current = remaining[0].color;
				} else {
					setMemoId(null);
					setContent('');
					setColor('yellow');
					contentRef.current = '';
					colorRef.current = 'yellow';
				}
			}

			setStatus('ready');
		} catch (e) {
			setStatus('error');
		}
	}, [deleteMemo, memoId, quickMemos, saveContent]);

	const handleSelectMemo = async (selected: Memo) => {
		await flushCurrentMemoSave();
		setMemoId(selected.id);
		setContent(selected.content);
		setColor(selected.color);
		hasPendingChangesRef.current = false;
		setStatus('ready');
	};

	if ((status === 'loading' || !memoId) && quickMemos.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-8">
				<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
			</div>
		);
	}

	return (
		<div className={cn(
			'flex flex-col h-full rounded-lg shadow-inner overflow-hidden transition-colors duration-300',
			color === 'white' ? 'bg-white' :
				color === 'red' ? 'bg-[#ffebec]' :
					color === 'orange' ? 'bg-[#fff0e0]' :
						color === 'yellow' ? 'bg-[#fffbe0]' :
							color === 'green' ? 'bg-[#e6fdec]' :
								color === 'blue' ? 'bg-[#e3f2fd]' :
									color === 'purple' ? 'bg-[#f3e5f5]' :
										'bg-[#f5f5f5]'
		)}>
			<div className="flex items-center justify-between px-3 py-2 border-b border-black/5 bg-black/5">
				<div className="flex gap-1.5 items-center">
					{COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								void handleColorChange(c);
							}}
							className={cn(
								'w-4 h-4 rounded-full border border-black/10 transition-transform hover:scale-110',
								color === c && 'ring-1 ring-offset-1 ring-slate-400 scale-110',
								c === 'white' && 'bg-white',
								c === 'red' && 'bg-[#ffebec]',
								c === 'orange' && 'bg-[#fff0e0]',
								c === 'yellow' && 'bg-[#fffbe0]',
								c === 'green' && 'bg-[#e6fdec]',
								c === 'blue' && 'bg-[#e3f2fd]',
								c === 'purple' && 'bg-[#f3e5f5]',
								c === 'gray' && 'bg-[#f5f5f5]'
							)}
						/>
					))}
					<div className="w-px h-3 bg-slate-300 mx-1.5" />
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={async () => {
							await flushCurrentMemoSave();
							void createNewMemo();
						}}
						className="p-1 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
						title={TXT.newMemo}
					>
						<FilePlus className="w-4 h-4" />
					</button>
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							if (memoId) {
								void handleDeleteMemo(memoId);
							}
						}}
						className="p-1 hover:bg-rose-100 rounded-full text-rose-500 hover:text-rose-700 transition-colors"
						title={TXT.deleteMemo}
						disabled={!memoId}
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
				<div className="text-xs text-slate-400 flex items-center gap-1">
					{status === 'saving' ? (
						<>
							<Loader2 className="w-3 h-3 animate-spin" />
							<span>{TXT.saving}</span>
						</>
					) : status === 'ready' ? (
						<>
							<Save className="w-3 h-3" />
							<span>{TXT.saved}</span>
						</>
					) : status === 'error' ? (
						<span className="text-rose-500">{TXT.failedSave}</span>
					) : null}
				</div>
			</div>

			<div className="border-b border-black/5 bg-black/5">
				<div className="flex items-center justify-between px-3 py-1.5">
					<span className="text-[11px] font-semibold text-slate-500">
						{TXT.memoList} ({quickMemos.length})
					</span>
					<button
						type="button"
						className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
						onClick={() => setIsCompactList((prev) => !prev)}
					>
						{isCompactList ? TXT.compactOff : TXT.compactOn}
					</button>
				</div>
				<div className={cn('overflow-y-auto px-2 pb-2 space-y-1', isCompactList ? 'max-h-24' : 'max-h-40')}>
					{quickMemos.length === 0 && (
						<div className="text-[11px] text-slate-400 px-1 py-1.5">{TXT.emptyList}</div>
					)}
					{quickMemos.map((memo) => {
						const active = memo.id === memoId;
						return (
							<div
								key={memo.id}
								className={cn(
									'w-full rounded-md border transition-colors',
									active
										? 'border-sky-300 bg-sky-50/80'
										: 'border-black/10 bg-white/70 hover:bg-white',
									isCompactList ? 'px-2 py-1' : 'px-2.5 py-1.5'
								)}
							>
								<div className="flex items-start gap-2">
									<button
										type="button"
										onClick={() => void handleSelectMemo(memo)}
										className="flex-1 text-left min-w-0"
									>
										<div className={cn('truncate text-slate-700', isCompactList ? 'text-[11px] font-medium' : 'text-xs font-semibold')}>
											{getContentPreview(memo.content)}
										</div>
										<div className={cn('text-slate-400', isCompactList ? 'text-[10px]' : 'text-[11px]')}>
											{formatUpdatedAt(memo)}
										</div>
									</button>
									<button
										type="button"
										onClick={() => {
											void handleDeleteMemo(memo.id);
										}}
										className="mt-0.5 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
										title={TXT.deleteMemo}
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<textarea
				className={cn(
					'flex-1 w-full resize-none bg-transparent text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed',
					isCompactList ? 'p-3 text-sm' : 'p-4 text-base'
				)}
				placeholder={TXT.placeholder}
				value={content}
				onChange={handleContentChange}
				onBlur={() => {
					void flushCurrentMemoSave();
				}}
			/>
		</div>
	);
};

export default QuickMemoEditor;
