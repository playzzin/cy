import React from 'react';
import type { WorkerEmployment } from './types';

export default function WorkerEmploymentBadge({ status }: { status?: WorkerEmployment }) {
    if (!status) return null;
    return <span className={`bt-employment-badge is-${status}`} title="작업자 등록정보 기준 현재 재직 상태">
        {status === 'active' ? '재직중' : status === 'retired' ? '퇴사자' : '상태 미확인'}
    </span>;
}
