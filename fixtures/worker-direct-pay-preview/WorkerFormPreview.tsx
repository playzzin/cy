import React, { useState } from 'react';
import WorkerForm from '../../src/components/manpower/WorkerForm';
import type { Worker } from '../../src/services/manpowerService';

// Only synthetic local data; the real form is rendered without a backend connection.
export default function WorkerFormPreview() {
    const [worker, setWorker] = useState<Worker | null>(() => JSON.parse(localStorage.getItem('worker-form-accounts-preview') || 'null'));
    const [saved, setSaved] = useState(false);
    return <main className="min-h-screen bg-slate-100 p-4">
        {saved && <p role="status">가상 작업자 저장 완료</p>}
        <WorkerForm initialData={worker} isEditMode={!!worker} teams={[]} companies={[]} positions={[]}
            onCancel={() => { setWorker(null); setSaved(false); }} onSave={async data => {
                const next = { ...data, id: 'synthetic-form-worker' } as Worker;
                localStorage.setItem('worker-form-accounts-preview', JSON.stringify(next));
                setWorker(next); setSaved(true);
            }} />
    </main>;
}
