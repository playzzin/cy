const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
    initializeApp({ projectId: 'cyee-9c1e4' });
}
const db = getFirestore();

const cols = ['sites', 'settings', 'teams', 'companies'];
Promise.all(
    cols.map(c =>
        db.collection(c).limit(5).get()
            .then(s => ({ col: c, empty: s.empty, size: s.size, names: s.docs.slice(0, 3).map(d => d.data().name || d.id) }))
            .catch(e => ({ col: c, err: e.message }))
    )
).then(results => {
    results.forEach(r => {
        if (r.err) {
            console.log(r.col + ': 오류-' + r.err);
        } else if (r.empty) {
            console.log(r.col + ': ❌ 비어있음');
        } else {
            console.log(r.col + ': ✅ ' + r.size + '개 - [' + r.names.join(', ') + ']');
        }
    });
    process.exit(0);
});
