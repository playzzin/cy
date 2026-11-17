import React, { useRef, useState } from 'react';
import WorkerForm from '../../src/components/manpower/WorkerForm';
import type { Worker } from '../../src/services/manpowerService';
import { WorkerRegistrationSaveSession } from '../../src/services/workerRegistrationSave';

// Only synthetic local data; the real form is rendered without a backend connection.
export default function WorkerFormPreview() {
    const [worker, setWorker] = useState<Worker | null>(() => JSON.parse(localStorage.getItem('worker-form-accounts-preview') || 'null'));
    const [saved, setSaved] = useState(false);
    const session = useRef(new WorkerRegistrationSaveSession(worker));
    return <main className="min-h-screen bg-slate-100 p-4">
        {saved && <p role="status">가상 작업자 저장 완료</p>}
        <WorkerForm initialData={worker} isEditMode={!!worker} teams={[]} companies={[]} positions={[]}
            onCancel={() => { setWorker(null); setSaved(false); session.current = new WorkerRegistrationSaveSession(); }} onSave={async (data, _file, photos = {}) => {
                await session.current.save(data, photos, async (fields, savedId) => {
                    const previous = savedId ? JSON.parse(localStorage.getItem('worker-form-accounts-preview') || '{}') : {};
                    const next = { ...previous, ...fields, id: savedId || 'synthetic-form-worker' } as Worker;
                    localStorage.setItem('worker-form-accounts-preview', JSON.stringify(next));
                    return { id: next.id! };
                });
                const next = JSON.parse(localStorage.getItem('worker-form-accounts-preview')!);
                setWorker(next); setSaved(true); session.current = new WorkerRegistrationSaveSession(next);
            }} />
    </main>;
}
