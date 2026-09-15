import React, { useState } from 'react';
import type { TaskReview } from '../../types/task';
import { emptyTaskReview, TASK_DEPLOYMENT_LABELS, validateTaskReview } from '../../utils/taskReview';

export function TaskReviewGuide({ review }: { review: TaskReview }) {
    return <section className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4" aria-label="결과 확인 안내">
        <h3 className="font-bold text-violet-900">결과 확인 안내</h3>
        <span className="mt-2 inline-block rounded bg-white px-2 py-1 text-xs font-bold">{TASK_DEPLOYMENT_LABELS[review.deployment] || '반영 상태 확인 필요'}</span>
        <dl className="mt-3 space-y-3 text-sm">
            {([['바뀐 점', review.changes], ['확인할 화면', review.location], ['확인 순서', review.steps], ['정상 결과', review.expected]] as const).map(([label, value]) => <div key={label}><dt className="font-bold text-slate-800">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{value}</dd></div>)}
        </dl>
        {review.requestedBy && <p className="mt-3 text-xs text-slate-500">안내 작성: {review.requestedBy}{review.requestedAt ? ` · ${new Date(review.requestedAt).toLocaleString('ko-KR')}` : ''}</p>}
    </section>;
}

export function TaskReviewForm({ initial, busy, onSubmit, onCancel }: { initial?: TaskReview; busy: boolean; onSubmit: (review: TaskReview) => void; onCancel: () => void }) {
    const [review, setReview] = useState<TaskReview>(initial || emptyTaskReview());
    const [error, setError] = useState('');
    return <form className="mb-4 space-y-3 rounded-2xl border border-violet-300 bg-white p-4" aria-label="확인 요청 작성" onSubmit={event => {
        event.preventDefault();
        const message = validateTaskReview(review);
        if (message) { setError(message); return; }
        onSubmit(review);
    }}>
        <h3 className="font-bold">요청자가 직접 확인할 수 있게 안내해 주세요</h3>
        {([{ key: 'changes', label: '바뀐 점', placeholder: '예: 대표계좌를 선택하면 등록된 계좌가 적용됩니다.' }, { key: 'location', label: '확인할 화면', placeholder: '예: 월급여정산 → 내보내기 → 은행이체' }, { key: 'steps', label: '확인 순서', placeholder: '1. 화면을 새로고침합니다.\n2. 확인할 항목을 선택합니다.' }, { key: 'expected', label: '정상 결과', placeholder: '어떻게 보이면 해결된 것인지 적어 주세요.' }] as const).map(field => <label key={field.key} className="block text-sm font-bold">{field.label}<textarea required maxLength={3000} rows={2} value={review[field.key]} placeholder={field.placeholder} onChange={event => setReview({ ...review, [field.key]: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal" /></label>)}
        <label className="block text-sm font-bold">반영 상태<select value={review.deployment} onChange={event => setReview({ ...review, deployment: event.target.value as TaskReview['deployment'] })} className="ml-2 rounded-lg border p-2 font-normal">{Object.entries(TASK_DEPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="text-xs text-slate-500">실제로 확인한 반영 상태를 선택해 주세요. 이 표시는 작성자의 확인 기록입니다.</p>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? '전달 중...' : '안내와 함께 확인 요청'}</button><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">취소</button></div>
    </form>;
}
