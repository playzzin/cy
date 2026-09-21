// Read-only audit. Outputs aggregate counts, never memo contents or account identifiers.
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { isEmptyMemo } = require('./cleanup-empty-smart-memos.cjs');
const targetName = process.argv[2];
if (!targetName) throw new Error('A display name is required');
const projectId = JSON.parse(fs.readFileSync('.firebaserc', 'utf8')).projects.default;
if (projectId !== 'cyee-9c1e4' || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Unexpected target');
initializeApp({ projectId, credential: applicationDefault() });
const db = getFirestore();
db.settings({ preferRest: true });
const trim = value => typeof value === 'string' ? value.trim() : '';
const millis = value => value?.toMillis?.() || (typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) || 0 : 0);
const day = value => value ? new Date(value + 9 * 3600000).toISOString().slice(0, 10) : 'unknown';
const fingerprint = data => createHash('sha256').update(JSON.stringify({
    title: trim(data.title), content: trim(data.content), type: data.type || 'text',
    checklist: (Array.isArray(data.checklistItems) ? data.checklistItems : []).map(item => ({
        text: trim(item.text), checked: item.isChecked === true,
        comments: (Array.isArray(item.comments) ? item.comments : []).map(comment => trim(comment.text))
    }))
})).digest('hex');
async function main() {
    try {
        const users = await db.collection('users').where('displayName', '==', targetName).get();
        if (users.empty) { console.log(JSON.stringify({ matchingAccounts: 0 })); return; }
        const identifiers = new Set(users.docs.flatMap(doc => [doc.id, doc.data().uid, doc.data().email].filter(Boolean)));
        const all = await db.collection('smart_memos').get();
        const docs = all.docs.filter(doc => identifiers.has(doc.data().userId));
        const groups = new Map();
        const dates = new Map();
        const creationMinutes = new Map();
        const serverDates = new Map();
        const titleGroups = new Map();
        for (const doc of docs) {
            const data = doc.data();
            const key = fingerprint(data);
            groups.set(key, [...(groups.get(key) || []), doc]);
            const created = millis(data.createdAt) || millis(doc.createTime);
            dates.set(day(created), (dates.get(day(created)) || 0) + 1);
            const serverDate = day(millis(doc.createTime));
            serverDates.set(serverDate, (serverDates.get(serverDate) || 0) + 1);
            const minute = Math.floor(created / 60000);
            creationMinutes.set(minute, (creationMinutes.get(minute) || 0) + 1);
            const title = trim(data.title);
            titleGroups.set(title, (titleGroups.get(title) || 0) + 1);
        }
        const duplicates = [...groups.values()].filter(group => group.length > 1).sort((a, b) => b.length - a.length);
        const defaultTitles = new Set(['', '새 메모', '새 체크리스트', '제목 없음']);
        const namedBodyEmpty = docs.filter(doc => {
            const data = doc.data();
            return !defaultTitles.has(trim(data.title)) && !trim(data.content) && !(data.checklistItems || []).some(item => trim(item.text) || (item.comments || []).some(comment => trim(comment.text)));
        });
        console.log(JSON.stringify({
            matchingAccounts: users.size, totalAll: all.size, targetTotal: docs.length,
            pinned: docs.filter(doc => doc.data().isPinned === true).length,
            shared: docs.filter(doc => doc.data().scope === 'public' || doc.data().categoryId === 'public').length,
            strictlyEmpty: docs.filter(doc => isEmptyMemo(doc.data())).length,
            legacyDefaultTitle: docs.filter(doc => trim(doc.data().title) === 'New Memo').length,
            quickNoteTitle: docs.filter(doc => trim(doc.data().title) === 'Quick Note').length,
            emptyQuickNotes: docs.filter(doc => trim(doc.data().title) === 'Quick Note' && isEmptyMemo({ ...doc.data(), title: '' })).length,
            requestedAccountMatches: process.argv[3] ? users.docs.filter(doc => {
                const data = doc.data();
                return [doc.id, data.uid, data.email?.split('@')[0], data.username, data.loginId].includes(process.argv[3]);
            }).length : undefined,
            titledButEmptyBody: namedBodyEmpty.length,
            duplicateGroups: duplicates.length, duplicateDocuments: duplicates.reduce((sum, group) => sum + group.length, 0),
            redundantCopies: duplicates.reduce((sum, group) => sum + group.length - 1, 0),
            biggestDuplicateGroups: duplicates.slice(0, 8).map(group => ({ count: group.length,
                contentLength: trim(group[0].data().content).length,
                checklistCount: group[0].data().checklistItems?.length || 0,
                pinned: group.filter(doc => doc.data().isPinned === true).length,
                earliest: day(Math.min(...group.map(doc => millis(doc.data().createdAt) || millis(doc.createTime)))),
                latest: day(Math.max(...group.map(doc => millis(doc.data().createdAt) || millis(doc.createTime))))
            })),
            topCreationDays: [...dates.entries()].sort((a,b) => b[1]-a[1]).slice(0,8).map(([date,count])=>({date,count})),
            topServerCreationDays: [...serverDates.entries()].sort((a,b) => b[1]-a[1]).slice(0,8).map(([date,count])=>({date,count})),
            serverCreationMatchesStoredDay: docs.filter(doc => day(millis(doc.createTime)) === day(millis(doc.data().createdAt))).length,
            largestSingleMinuteBatch: Math.max(0, ...creationMinutes.values()),
            distinctTitles: titleGroups.size, mostRepeatedTitleCounts: [...titleGroups.values()].sort((a,b)=>b-a).slice(0,8),
            idPatterns: { numeric: docs.filter(doc=>/^\d+$/.test(doc.id)).length, autoId: docs.filter(doc=>/^[A-Za-z0-9]{20}$/.test(doc.id)).length }
        }));
    } finally { await db.terminate(); }
}
main().catch(error => { console.error(error.code || error.name || 'Inspection failed'); process.exitCode = 1; });
