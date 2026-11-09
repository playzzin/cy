import { strict as assert } from 'assert';
import { test } from 'node:test';
import { matchStatementCard, type FirestoreCardRecord } from './cardStatementMatching';

const card = (id: string, status = 'ASSIGNED', extra: Partial<FirestoreCardRecord> = {}): FirestoreCardRecord => ({
    id, name: '테스트 법인카드', last4: '1234', status, ...extra,
});
const statement = { cardLast4: '1234', cardName: '테스트 법인카드' };

test('one usable card wins over a lost card with the same last four digits, regardless of order', () => {
    for (const cards of [
        [card('lost', 'SUSPENDED'), card('active')],
        [card('active'), card('lost', 'SUSPENDED')],
    ]) {
        const result = matchStatementCard(statement, cards);
        assert.equal(result.matchedCardId, 'active');
        assert.ok(result.matchCandidates.some(candidate => candidate.cardId === 'lost'));
        assert.ok(result.warnings.some(warning => warning.includes('분실')));
    }
});

test('closed cards do not compete with a usable card', () => {
    assert.equal(matchStatementCard(statement, [card('closed', 'CLOSED'), card('active')]).matchedCardId, 'active');
});

test('inactive-only matches require a manual decision for historical statements', () => {
    for (const status of ['SUSPENDED', 'CLOSED', ' suspended ']) {
        const result = matchStatementCard(statement, [card('inactive', status)]);
        assert.equal(result.matchedCardId, undefined);
        assert.equal(result.matchCandidates[0].cardId, 'inactive');
        assert.ok(result.warnings.some(warning => warning.includes('수동 매칭')));
    }
});

test('a holder identifying only the lost card must not silently map to another active holder', () => {
    const result = matchStatementCard({ ...statement, holderName: '이전담당자' }, [
        card('lost', 'SUSPENDED', { currentAssigneeName: '이전담당자' }),
        card('active', 'ASSIGNED', { currentAssigneeName: '현재담당자' }),
    ]);
    assert.equal(result.matchedCardId, undefined);
    assert.ok(result.warnings.some(warning => warning.includes('사용자')));
});

test('two equally plausible usable cards remain ambiguous even with an inactive duplicate', () => {
    const result = matchStatementCard(statement, [card('lost', 'SUSPENDED'), card('active-a'), card('active-b')]);
    assert.equal(result.matchedCardId, undefined);
    assert.ok(result.warnings.some(warning => warning.includes('여러 개')));
});

test('all candidates are considered before the five displayed suggestions are limited', () => {
    const cards = Array.from({ length: 6 }, (_, i) => card(`lost-${i}`, 'SUSPENDED'));
    const result = matchStatementCard(statement, [...cards, card('active')]);
    assert.equal(result.matchedCardId, 'active');
    assert.equal(result.matchCandidates.length, 5);
    assert.ok(result.matchCandidates.some(candidate => candidate.cardId === 'active'));
});

test('a different suffix, or missing digits, cannot be matched by name alone', () => {
    assert.equal(matchStatementCard(statement, [card('other', 'ASSIGNED', { last4: '5678' })]).matchedCardId, undefined);
    assert.equal(matchStatementCard({ cardName: statement.cardName }, [card('active')]).matchedCardId, undefined);
});

test('unique active, available and legacy cards retain matching and masked-number support', () => {
    for (const status of ['ASSIGNED', 'AVAILABLE', undefined]) {
        const result = matchStatementCard(statement, [{ ...card('unique'), last4: '', maskedNumber: '****-****-****-1234', status }]);
        assert.equal(result.matchedCardId, 'unique');
        assert.equal(result.matchedCardLabel, '테스트 법인카드 (1234)');
        assert.deepEqual(result.warnings, []);
    }
});
