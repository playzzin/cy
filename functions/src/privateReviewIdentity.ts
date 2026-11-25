import { OAuth2Client } from 'google-auth-library';

const google = new OAuth2Client();
let cachedKeys: { value: Record<string, string>; until: number } | undefined;

async function identity(assertion: string, audience: string) {
    if (!cachedKeys || cachedKeys.until < Date.now()) {
        const result = await google.getIapPublicKeys();
        cachedKeys = { value: result.pubkeys, until: Date.now() + 300_000 };
    }
    const ticket = await google.verifySignedJwtWithCertsAsync(assertion, cachedKeys.value, audience, [
        'https://cloud.google.com/iap',
    ]);
    return ticket.getPayload();
}

export async function allowedReviewEmail(assertion: string | undefined): Promise<string> {
    const audience = process.env.CY_REVIEW_IAP_AUDIENCE;
    const allowed = process.env.CY_REVIEW_EMAIL?.trim().toLowerCase();
    if (!audience || !allowed || !assertion) throw new Error('비공개 검증 접근 설정을 확인해 주세요.');
    const principal = await identity(assertion, audience);
    if (!principal?.sub || principal.email?.toLowerCase() !== allowed)
        throw new Error('비공개 검증 계정이 아닙니다.');
    return allowed;
}
