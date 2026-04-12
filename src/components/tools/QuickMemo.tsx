import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMemoStore } from '../../features/smart-memo/store/useMemoStore';
import { debounce } from 'lodash';
import { Loader2, Save, FilePlus } from 'lucide-react';
import { Memo, MemoColor } from '../../features/smart-memo/types/memo';
import { cn } from '../../features/smart-memo/lib/utils';

const COLORS: MemoColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

const TXT = {
	quickNote: 'Quick Note',
	newMemo: '\uc0c8 \uba54\ubaa8 \uc791\uc131',
	saving: '\uc800\uc7a5 \uc911...',
	saved: '\uc800\uc7a5\ub428',
	placeholder: '\uac04\ub2e8\ud55c \uba54\ubaa8\ub97c \uc785\ub825\ud558\uc138\uc694 (\uc790\ub3d9 \uc800\uc7a5\ub428)',
	memoList: '\uba54\ubaa8 \ubaa9\ub85d',
	compactOn: '\uc791\uac8c \ubcf4\uae30',
	compactOff: '\ud06c\uac8c \ubcf4\uae30',
	emptyList: '\uba54\ubaa8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.'
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
	return new Date(ms).toLocaleString('ko-KR', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
};

const getMemoPreview = (memo: Memo): string => {
	const firstLine = memo.content.split('\n').map((line) => line.trim()).find((line) => line.length > 0);
	if (firstLine) return firstLine;
	return TXT.placeholder;
};

export const QuickMemoEditor: React.FC = () => {
	const { currentUser } = useAuth();
	const { memos, addMemo, updateMemo, subscribeMemos } = useMemoStore();

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
		setContent(val);
		if (memoId) {
			saveContent(memoId, val, color);
		}
	};

	const handleColorChange = (nextColor: MemoColor) => {
		hasPendingChangesRef.current = true;
		setColor(nextColor);
		if (memoId) {
			saveContent(memoId, content, nextColor);
		}
	};

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
							onClick={() => handleColorChange(c)}
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
						onClick={async () => {
							await flushCurrentMemoSave();
							void createNewMemo();
						}}
						className="p-1 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
						title={TXT.newMemo}
					>
						<FilePlus className="w-4 h-4" />
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
							<button
								key={memo.id}
								type="button"
								onClick={() => void handleSelectMemo(memo)}
								className={cn(
									'w-full text-left rounded-md border transition-colors',
									active
										? 'border-sky-300 bg-sky-50/80'
										: 'border-black/10 bg-white/70 hover:bg-white',
									isCompactList ? 'px-2 py-1' : 'px-2.5 py-1.5'
								)}
							>
								<div className={cn('truncate text-slate-700', isCompactList ? 'text-[11px] font-medium' : 'text-xs font-semibold')}>
									{getMemoPreview(memo)}
								</div>
								<div className={cn('text-slate-400', isCompactList ? 'text-[10px]' : 'text-[11px]')}>
									{formatUpdatedAt(memo)}
								</div>
							</button>
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
