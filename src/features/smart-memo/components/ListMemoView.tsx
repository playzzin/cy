import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Memo } from '../types/memo';
import { useMemoStore } from '../store/useMemoStore';
import { MemoCard } from './MemoCard';
import { cn } from '../lib/utils';

interface ListMemoViewProps {
    memos: Memo[];
}

const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 }
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.2 }
    }
};

export const ListMemoView: React.FC<ListMemoViewProps> = ({ memos }) => {
    const deleteMemo = useMemoStore(state => state.deleteMemo);
    const setSelectedMemoId = useMemoStore(state => state.setSelectedMemoId);

    if (!memos.length) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50"
            >
                <p>메모가 없습니다. 새 메모를 추가하세요.</p>
            </motion.div>
        );
    }

    return (
        <div className="w-full h-full p-4 overflow-y-auto">
            {/* CSS Masonry with AnimatePresence */}
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
                <AnimatePresence mode="popLayout">
                    {memos.map(memo => (
                        <motion.div
                            key={memo.id}
                            layoutId={`memo-card-${memo.id}`}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            className="break-inside-avoid mb-4 cursor-pointer"
                            onClick={() => setSelectedMemoId(memo.id)}
                        >
                            <MemoCard
                                memo={memo}
                                onDelete={() => deleteMemo(memo.id)}
                                showDragHandle={false}
                                className="w-full"
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
