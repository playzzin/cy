const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const defaultTitles = new Set(['', '새 메모', '새 체크리스트', '제목 없음', 'New Memo', 'Quick Note']);
const blank = value => value == null || (typeof value === 'string' && !value.trim());
const emptyArray = value => value == null || (Array.isArray(value) && value.length === 0);
function isEmptyMemo(data) {
    if (!data || typeof data !== 'object') return false;
    if (!defaultTitles.has(typeof data.title === 'string' ? data.title.trim() : data.title == null ? '' : null)) return false;
    if (!blank(data.content) || data.isPinned === true) return false;
    if (['attachments', 'files', 'images', 'tags', 'comments'].some(key => !emptyArray(data[key]))) return false;
    if (data.checklistItems != null && !Array.isArray(data.checklistItems)) return false;
    return (data.checklistItems || []).every(item => item && typeof item === 'object' &&
        blank(item.text) && item.isChecked !== true && emptyArray(item.comments) &&
        Object.keys(item).every(key => ['id', 'text', 'isChecked', 'comments', 'order', 'createdAt', 'updatedAt'].includes(key)));
}
module.exports = { isEmptyMemo };

function backupValue(value) {
    if (value instanceof Timestamp) return { __firestoreType: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
    if (Array.isArray(value)) return value.map(backupValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, backupValue(item)]));
    return value;
}

async function main() {
    const mode = process.argv[2] || 'inspect';
    if (!['inspect', 'prepare', 'apply'].includes(mode)) throw new Error('Expected inspect, prepare or apply');
    if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('This cleanup targets the configured production project only.');
    const projectId = JSON.parse(fs.readFileSync(path.resolve('.firebaserc'), 'utf8')).projects.default;
    if (projectId !== 'cyee-9c1e4') throw new Error('Unexpected project');
    initializeApp({ projectId, credential: applicationDefault() });
    const db = getFirestore();
    db.settings({ preferRest: true });
    try {
        if (mode === 'apply') {
            const backupPath = path.resolve(process.argv[3] || '');
            const backupDirectory = path.resolve('.codex-smart-memo-cleanup-backup');
            if (path.dirname(backupPath) !== backupDirectory) throw new Error('Expected a prepared backup in the cleanup directory');
            const backup = v8.deserialize(fs.readFileSync(backupPath));
            if (backup.projectId !== projectId || !Array.isArray(backup.documents)) throw new Error('Invalid backup');
            let deleted = 0;
            let skipped = 0;
            for (const item of backup.documents) {
                if (!/^smart_memos\/[^/]+$/.test(item.path) || !isEmptyMemo(item.data)) throw new Error('Backup contains a non-empty or unrelated document');
                const result = await db.runTransaction(async transaction => {
                    const ref = db.doc(item.path);
                    const current = await transaction.get(ref);
                    if (!current.exists) return false;
                    const expectedTime = new Timestamp(item.updateTime.seconds, item.updateTime.nanoseconds);
                    if (!current.updateTime.isEqual(expectedTime) || !isEmptyMemo(current.data())) return false;
                    transaction.delete(ref);
                    return true;
                });
                if (result) deleted++; else skipped++;
            }
            const after = await db.collection('smart_memos').get();
            const selectedPaths = new Set(backup.documents.map(item => item.path));
            console.log(JSON.stringify({ deleted, skipped, selectedRemaining: after.docs.filter(doc => selectedPaths.has(doc.ref.path)).length,
                totalAfter: after.size, emptyRemaining: after.docs.filter(doc => isEmptyMemo(doc.data())).length, backupPath }));
            return;
        }
        const snapshot = await db.collection('smart_memos').get();
        const candidates = snapshot.docs.filter(doc => isEmptyMemo(doc.data()));
        const counts = { total: snapshot.size, emptyCandidates: candidates.length, ownerCount: new Set(candidates.map(doc => doc.data().userId)).size };
        console.log(JSON.stringify(counts));
        if (mode === 'inspect' || candidates.length === 0) return;
        const backupDirectory = path.resolve('.codex-smart-memo-cleanup-backup');
        fs.mkdirSync(backupDirectory, { recursive: true });
        const backupPath = path.join(backupDirectory, `${Date.now()}.bin`);
        const backup = { projectId, createdAt: Date.now(), documents: candidates.map(doc => ({
            path: doc.ref.path, data: backupValue(doc.data()),
            updateTime: { seconds: doc.updateTime.seconds, nanoseconds: doc.updateTime.nanoseconds }
        })) };
        fs.writeFileSync(backupPath, v8.serialize(backup), { flag: 'wx' });
        const saved = v8.deserialize(fs.readFileSync(backupPath));
        if (saved.documents.length !== candidates.length) throw new Error('Backup verification failed');
        console.log(JSON.stringify({ prepared: candidates.length, backupPath }));
    } finally { await db.terminate(); }
}
if (require.main === module) main().catch(error => { console.error(error.code || error.name || 'Cleanup failed'); process.exitCode = 1; });
