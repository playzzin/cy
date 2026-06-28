import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCreditCard,
    faFilePen,
    faLink,
    faPenToSquare,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { Card } from '../../types/card';

interface CardRegistrySheetProps {
    cards: Card[];
    loading: boolean;
    onEdit: (card: Card) => void;
    onAssign: (card: Card) => void;
}

const getStatusBadgeClass = (status?: string): string => {
    switch (status) {
        case 'ASSIGNED':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'SUSPENDED':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'CLOSED':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        default:
            return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const getStatusLabel = (status?: string): string => {
    switch (status) {
        case 'ASSIGNED':
            return '사용중';
        case 'SUSPENDED':
            return '정지';
        case 'CLOSED':
            return '해지';
        default:
            return '대기';
    }
};

const getTypeLabel = (type?: string): string => {
    switch (type) {
        case 'CREDIT':
            return '신용';
        case 'CHECK':
            return '체크';
        default:
            return '-';
    }
};

export const CardRegistrySheet: React.FC<CardRegistrySheetProps> = ({
    cards,
    loading,
    onEdit,
    onAssign
}) => {
    const totals = useMemo(() => {
        return cards.reduce(
            (acc, card) => {
                acc.count += 1;
                if (card.status === 'ASSIGNED') acc.assigned += 1;
                if (card.status === 'AVAILABLE') acc.available += 1;
                return acc;
            },
            { count: 0, assigned: 0, available: 0 }
        );
    }, [cards]);

    if (loading) {
        return (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-extrabold text-slate-900">카드 대장</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        카드 기본 정보와 사용자 배정을 엑셀처럼 바로 관리합니다.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">총 {totals.count}장</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">사용중 {totals.assigned}장</span>
                    <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">대기 {totals.available}장</span>
                </div>
            </div>

            <div className="max-h-[calc(100vh-290px)] overflow-auto">
                <table className="min-w-[1120px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold">카드명</th>
                            <th className="px-4 py-3 text-left font-bold">발급사</th>
                            <th className="px-4 py-3 text-left font-bold">종류</th>
                            <th className="px-4 py-3 text-left font-bold">카드번호</th>
                            <th className="px-4 py-3 text-left font-bold">사용자</th>
                            <th className="px-4 py-3 text-left font-bold">상태</th>
                            <th className="px-4 py-3 text-left font-bold">유효기간</th>
                            <th className="px-4 py-3 text-left font-bold">메모</th>
                            <th className="px-4 py-3 text-center font-bold">작업</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {cards.map((card) => (
                            <tr key={card.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-slate-800">
                                    <div className="flex items-center gap-2">
                                        <FontAwesomeIcon icon={faCreditCard} className="text-slate-400" />
                                        <span>{card.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{card.issuer || '-'}</td>
                                <td className="px-4 py-3 text-slate-600">{getTypeLabel(card.cardType)}</td>
                                <td className="px-4 py-3 font-mono text-slate-700">
                                    {card.maskedNumber || `****-${card.last4}`}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
                                        <span>{card.currentAssigneeName || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusBadgeClass(card.status)}`}>
                                        {getStatusLabel(card.status)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{card.expiry || '-'}</td>
                                <td className="px-4 py-3 text-slate-500">
                                    <div className="max-w-[220px] truncate" title={card.memo || ''}>
                                        {card.memo || '-'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onEdit(card)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                            title="카드 정보 수정"
                                            aria-label="카드 정보 수정"
                                        >
                                            <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onAssign(card)}
                                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                                        >
                                            <FontAwesomeIcon icon={faLink} className="mr-1" />
                                            배정/청구
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {cards.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <FontAwesomeIcon icon={faFilePen} className="text-3xl text-slate-300" />
                                        <p>조회된 카드가 없습니다.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
