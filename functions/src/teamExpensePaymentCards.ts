import * as functions from 'firebase-functions/v1';

const text = (value: unknown) => String(value ?? '').trim();
const cardFields = ['name', 'issuer', 'last4', 'status', 'currentAssigneeType', 'currentAssigneeId'];
type PaymentCard = { id: string; label: string; teamId: string };

const cardOption = (doc: FirebaseFirestore.DocumentSnapshot, teamId: string): PaymentCard => {
    const card = doc.data() || {};
    const last4 = text(card.last4).replace(/\D/g, '').slice(-4);
    const label = [text(card.name) || '경비카드', text(card.issuer), last4 ? `•••• ${last4}` : ''].filter(Boolean).join(' · ');
    return { id: doc.id, label, teamId };
};

const isAssignedCard = (card: FirebaseFirestore.DocumentData | undefined, teamRefs: Set<string>) =>
    card?.status === 'ASSIGNED' && card.currentAssigneeType === 'TEAM' && teamRefs.has(text(card.currentAssigneeId));

export async function listExpensePaymentCards(db: FirebaseFirestore.Firestore, teams: Array<{ id: string }>): Promise<PaymentCard[]> {
    if (!teams.length) return [];
    const teamDocs = await db.getAll(...teams.map(team => db.doc(`teams/${team.id}`)), { fieldMask: ['legacyId'] });
    const teamByReference = new Map<string, string>();
    teamDocs.forEach(doc => {
        if (!doc.exists) return;
        teamByReference.set(doc.id, doc.id);
        const legacyId = text(doc.data()?.legacyId);
        if (legacyId) teamByReference.set(legacyId, doc.id);
    });
    const references = [...teamByReference.keys()];
    const queries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
    for (let index = 0; index < references.length; index += 30) {
        queries.push(db.collection('cards').where('currentAssigneeId', 'in', references.slice(index, index + 30)).select(...cardFields).get());
    }
    const snapshots = await Promise.all(queries);
    const allowed = new Set(references);
    return snapshots.flatMap(snapshot => snapshot.docs)
        .filter(doc => isAssignedCard(doc.data(), allowed))
        .map(doc => cardOption(doc, teamByReference.get(text(doc.data().currentAssigneeId))!))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

export async function readExpensePaymentCard(db: FirebaseFirestore.Firestore, teamId: string, cardId: string, transaction?: FirebaseFirestore.Transaction): Promise<PaymentCard> {
    const refs = [db.doc(`teams/${teamId}`), db.doc(`cards/${cardId}`)];
    const [team, card] = transaction ? await transaction.getAll(...refs) : await db.getAll(...refs, { fieldMask: ['legacyId', ...cardFields] });
    const teamRefs = new Set([teamId, text(team.data()?.legacyId)].filter(Boolean));
    if (!team.exists || !card.exists || !isAssignedCard(card.data(), teamRefs)) {
        throw new functions.https.HttpsError('failed-precondition', '현재 사용팀에 배정된 경비카드를 선택해 주세요. 카드 목록을 새로고침해 주세요.');
    }
    return cardOption(card, teamId);
}
