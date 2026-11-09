export interface FirestoreCardRecord {
    id: string;
    name?: string;
    issuer?: string;
    last4?: string;
    maskedNumber?: string;
    currentAssigneeId?: string | null;
    currentAssigneeType?: string | null;
    currentAssigneeName?: string | null;
    billingTargetId?: string | null;
    billingTargetType?: string | null;
    billingTargetName?: string | null;
    memo?: string | null;
    status?: string;
}

interface StatementCardIdentity {
    cardLast4?: string;
    cardName?: string;
    holderName?: string;
}

interface CardMatchCandidate {
    cardId: string;
    cardLabel: string;
    cardLast4: string;
    score: number;
    reasons: string[];
}

interface CardMatchResult {
    matchedCardId?: string;
    matchedCardLabel?: string;
    matchConfidence: number;
    matchCandidates: CardMatchCandidate[];
    warnings: string[];
}

const asString = (value: unknown): string => String(value ?? '').trim();
const normalizeKey = (value: unknown): string => asString(value).toLowerCase();

export const getCardLabel = (card: Pick<FirestoreCardRecord, 'name' | 'last4' | 'maskedNumber'>): string => {
    const name = asString(card.name) || '카드';
    const last4 = asString(card.last4) || asString(card.maskedNumber).replace(/\D/g, '').slice(-4);
    return last4 ? `${name} (${last4})` : name;
};

const normalizeMatchText = (value: unknown): string =>
    asString(value).replace(/\s+/g, '').toLowerCase();

const textIncludes = (source: unknown, needle: unknown): boolean => {
    const sourceText = normalizeMatchText(source);
    const needleText = normalizeMatchText(needle);
    return Boolean(sourceText && needleText && sourceText.includes(needleText));
};

const buildCardMatchCandidate = (
    statementCard: StatementCardIdentity,
    card: FirestoreCardRecord
): CardMatchCandidate | null => {
    const statementLast4 = asString(statementCard.cardLast4).replace(/\D/g, '').slice(-4);
    const cardLast4 = asString(card.last4).replace(/\D/g, '').slice(-4)
        || asString(card.maskedNumber).replace(/\D/g, '').slice(-4);
    const reasons: string[] = [];
    let score = 0;

    if (statementLast4 && cardLast4 && statementLast4 === cardLast4) {
        score += 0.72;
        reasons.push('last4_exact');
    } else if (statementLast4 && asString(card.maskedNumber).replace(/\D/g, '').endsWith(statementLast4)) {
        score += 0.68;
        reasons.push('masked_number_last4');
    }

    if (statementCard.cardName && (
        textIncludes(card.name, statementCard.cardName) ||
        textIncludes(statementCard.cardName, card.name) ||
        textIncludes(card.issuer, statementCard.cardName)
    )) {
        score += 0.14;
        reasons.push('card_name');
    }

    if (statementCard.holderName && (
        textIncludes(card.currentAssigneeName, statementCard.holderName) ||
        textIncludes(card.billingTargetName, statementCard.holderName) ||
        textIncludes(card.memo, statementCard.holderName)
    )) {
        score += 0.1;
        reasons.push('holder_name');
    }

    if (normalizeKey(card.status) === 'closed') {
        score -= 0.2;
        reasons.push('closed_card_penalty');
    }

    if (['suspended', 'closed'].includes(normalizeKey(card.status))) {
        reasons.push('inactive_card');
    }

    if (score <= 0) return null;

    return {
        cardId: card.id,
        cardLabel: getCardLabel(card),
        cardLast4,
        score: Number(Math.max(0, Math.min(score, 1)).toFixed(3)),
        reasons,
    };
};

export const matchStatementCard = (
    statementCard: StatementCardIdentity,
    cards: FirestoreCardRecord[]
): CardMatchResult => {
    const statementLast4 = asString(statementCard.cardLast4).replace(/\D/g, '').slice(-4);
    const warnings: string[] = [];
    const allCandidates = cards
        .map((card) => buildCardMatchCandidate(statementCard, card))
        .filter((candidate): candidate is CardMatchCandidate => Boolean(candidate))
        .sort((a, b) => b.score - a.score);
    // Keep inactive cards available for historical statements, but never choose
    // them automatically. Resolve against the complete set before limiting UI suggestions.
    const eligibleCandidates = allCandidates.filter(candidate => !candidate.reasons.includes('inactive_card'));
    const inactiveCandidates = allCandidates.filter(candidate => candidate.reasons.includes('inactive_card'));
    const candidates = [...eligibleCandidates, ...inactiveCandidates].slice(0, 5);
    const inactiveLast4Matches = inactiveCandidates.filter(candidate => (
        statementLast4 && candidate.cardLast4 === statementLast4
    ));
    if (inactiveLast4Matches.length > 0) {
        warnings.push('같은 뒤 4자리의 분실·정지/해지 카드는 자동 매칭에서 제외했습니다. 사용 중단 전 내역이면 수동 매칭에서 해당 카드를 선택해 주세요.');
    }

    if (!statementLast4) {
        warnings.push('카드번호 뒤 4자리를 읽지 못했습니다.');
    }

    if (candidates.length === 0) {
        return {
            matchConfidence: 0,
            matchCandidates: [],
            warnings: [...warnings, '등록된 카드와 자동 매칭되지 않았습니다.'],
        };
    }

    const best = eligibleCandidates[0];
    const second = eligibleCandidates[1];
    const exactLast4Matches = eligibleCandidates.filter((candidate) => (
        statementLast4 && candidate.cardLast4 === statementLast4
    ));
    // A current status cannot override evidence identifying a previous holder.
    const identifiesInactiveHolder = inactiveLast4Matches.some(candidate => candidate.reasons.includes('holder_name'))
        && !exactLast4Matches.some(candidate => candidate.reasons.includes('holder_name'));
    if (!best || identifiesInactiveHolder) {
        return {
            matchConfidence: candidates[0].score,
            matchCandidates: candidates,
            warnings: identifiesInactiveHolder
                ? [...warnings, '명세서 사용자가 분실·정지/해지 카드와 일치합니다. 과거 사용내역인지 확인한 뒤 수동 매칭해 주세요.']
                : [...warnings, '자동 매칭할 사용 가능 카드가 없습니다. 수동 매칭으로 확인해 주세요.'],
        };
    }
    const exactLast4Count = exactLast4Matches.length;
    const hasClearWinner = best.score >= 0.72 && (!second || best.score - second.score >= 0.15);
    const hasUniqueLast4 = exactLast4Count === 1 && best.cardLast4 === statementLast4 && best.score >= 0.72;

    if (hasUniqueLast4 || hasClearWinner) {
        return {
            matchedCardId: best.cardId,
            matchedCardLabel: best.cardLabel,
            matchConfidence: best.score,
            matchCandidates: candidates,
            warnings,
        };
    }

    return {
        matchConfidence: best.score,
        matchCandidates: candidates,
        warnings: [
            ...warnings,
            exactLast4Count > 1
                ? '같은 뒤 4자리 카드 후보가 여러 개입니다.'
                : '자동 매칭 신뢰도가 낮아 확인이 필요합니다.',
        ],
    };
};
