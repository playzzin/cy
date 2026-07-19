import { strict as assert } from 'assert';
import * as crypto from 'crypto';
import { describe, it } from 'node:test';
import {
    computeProtocolSignature,
    classifyFcmFailure,
    isPushDeliveryExpired,
    resolveOutboxClaimDecision,
    decryptStoredMessage,
    isAllowedSender,
    makeProviderIdempotencyKey,
    makeSmsIdempotencyKey,
    maskAccount,
    maskCounterparty,
    normalizeOfficialProviderEvent,
    parseDateValue,
    parseKbBankSms,
    parseSecretMap,
    resolveBridgeHealthState,
    verifyProtocolHmac,
    isWithinQuietHours,
} from './bankNotifications';

describe('Android SMS bridge HMAC protocol', () => {
    const secret = '0123456789abcdef0123456789abcdef';
    const timestamp = '1783987200000';
    const nonce = 'nonce_1234567890abcdef';
    const body = Buffer.from('{"version":1,"message":"입금 1,000원"}', 'utf8');

    it('signs the exact timestamp, nonce, newline prefix and raw UTF-8 bytes', () => {
        const signature = computeProtocolSignature(secret, timestamp, nonce, body);
        assert.equal(signature.length, 64);
        const result = verifyProtocolHmac({
            identifier: 'office-phone-1', timestamp, nonce, signature: `sha256=${signature}`,
            rawBody: body, secret, nowMs: Number(timestamp),
        });
        assert.deepEqual(result, { ok: true, code: 'ok', timestampMs: Number(timestamp) });
    });

    it('rejects a one-byte body change and stale timestamps', () => {
        const signature = computeProtocolSignature(secret, timestamp, nonce, body);
        assert.equal(verifyProtocolHmac({
            identifier: 'office-phone-1', timestamp, nonce, signature,
            rawBody: Buffer.from(`${body.toString('utf8')} `), secret, nowMs: Number(timestamp),
        }).code, 'invalid-signature');
        assert.equal(verifyProtocolHmac({
            identifier: 'office-phone-1', timestamp, nonce, signature,
            rawBody: body, secret, nowMs: Number(timestamp) + 300_001,
        }).code, 'expired');
    });

    it('fails closed for malformed secret maps', () => {
        assert.deepEqual(parseSecretMap('{not-json'), {});
        assert.deepEqual(parseSecretMap(JSON.stringify({ phone: 'short' })), {});
        assert.equal(parseSecretMap(undefined, 'phone', secret).phone, secret);
        assert.equal(parseSecretMap(JSON.stringify({ phone: '가'.repeat(11) })).phone, '가'.repeat(11));
    });
});

describe('KB Korean SMS parser v1', () => {
    const receivedAt = new Date('2026-07-14T06:00:00.000Z');

    it('parses a multiline deposit notification', () => {
        const parsed = parseKbBankSms(
            '[KB] 07/14 14:03\n계좌 123-***-4567\n입금 1,234,500원\n잔액 5,000,000원\n입금자: 홍길동',
            receivedAt
        );
        assert.equal(parsed.status, 'parsed');
        assert.equal(parsed.direction, 'deposit');
        assert.equal(parsed.amount, 1_234_500);
        assert.equal(parsed.balance, 5_000_000);
        assert.equal(parsed.accountSuffix, '4567');
        assert.equal(parsed.memo, '홍길동');
        assert.equal(parsed.transactionAt?.toISOString(), '2026-07-14T05:03:00.000Z');
    });

    it('parses amount-before-direction withdrawal format and ignores 출금가능잔액', () => {
        const parsed = parseKbBankSms(
            'KB국민 2026-07-14 15:20 98,700원 출금 거래후잔액 1,001,300원 출금가능잔액 1,001,300원',
            receivedAt
        );
        assert.equal(parsed.status, 'parsed');
        assert.equal(parsed.direction, 'withdrawal');
        assert.equal(parsed.amount, 98_700);
        assert.equal(parsed.balance, 1_001_300);
        assert.equal(parsed.transactionAt?.toISOString(), '2026-07-14T06:20:00.000Z');
    });

    it('parses carrier templates that omit spaces around the direction and amount', () => {
        const deposit = parseKbBankSms(
            '[Web발신]\nKB국민은행\n07/14 14:03\n입금1,234,500원\n잔액5,000,000원',
            receivedAt
        );
        const withdrawal = parseKbBankSms(
            '[KB] 07/14 14:04 출금액98,700원 잔액 1,001,300원',
            receivedAt
        );
        assert.equal(deposit.status, 'parsed');
        assert.equal(deposit.direction, 'deposit');
        assert.equal(deposit.amount, 1_234_500);
        assert.equal(withdrawal.status, 'parsed');
        assert.equal(withdrawal.direction, 'withdrawal');
        assert.equal(withdrawal.amount, 98_700);
    });

    it('rejects a zero-value transaction amount', () => {
        const parsed = parseKbBankSms('KB국민 07/14 14:03 입금 0원', receivedAt);
        assert.equal(parsed.status, 'failed');
        assert.equal(parsed.errorCode, 'invalid-amount');
    });

    it('persists an explicit failure state when a transaction marker lacks an amount', () => {
        const parsed = parseKbBankSms('KB국민은행 07/14 14:03 입금 처리됨', receivedAt);
        assert.equal(parsed.status, 'failed');
        assert.equal(parsed.direction, 'deposit');
        assert.equal(parsed.errorCode, 'amount-not-found');
    });

    it('returns unknown for a non-transaction bank message', () => {
        const parsed = parseKbBankSms('KB국민은행 시스템 점검 안내', receivedAt);
        assert.equal(parsed.status, 'unknown');
        assert.equal(parsed.errorCode, 'not-a-transaction');
    });
});

describe('normalization, privacy and idempotency helpers', () => {
    it('accepts Android epoch-millis numbers, numeric strings, and ISO timestamps', () => {
        assert.equal(parseDateValue(1_783_987_200_000)?.toISOString(), '2026-07-14T00:00:00.000Z');
        assert.equal(parseDateValue('1783987200000')?.toISOString(), '2026-07-14T00:00:00.000Z');
        assert.equal(parseDateValue('2026-07-14T00:00:00.000Z')?.toISOString(), '2026-07-14T00:00:00.000Z');
        assert.equal(parseDateValue('not-a-date'), null);
    });

    it('normalizes an official provider event', () => {
        const event = normalizeOfficialProviderEvent({
            provider: 'KB', eventId: 'evt-100', direction: 'credit', amount: '2,000,000',
            balance: 3_500_000, occurredAt: '2026-07-14T01:02:03.000Z', accountSuffix: '1234',
        }, new Date('2026-07-14T01:02:04.000Z'));
        assert.equal(event.status, 'parsed');
        assert.equal(event.direction, 'deposit');
        assert.equal(event.amount, 2_000_000);
        assert.equal(makeProviderIdempotencyKey(event), makeProviderIdempotencyKey(event));

        const epochEvent = normalizeOfficialProviderEvent({
            provider: 'KB', eventId: 'evt-epoch', direction: 'debit', amount: 1000,
            occurredAt: 1_783_987_200_000,
        });
        assert.equal(epochEvent.transactionAt?.toISOString(), '2026-07-14T00:00:00.000Z');

        const zeroAmountEvent = normalizeOfficialProviderEvent({
            provider: 'KB', eventId: 'evt-zero', direction: 'credit', amount: 0,
            occurredAt: '2026-07-14T01:02:03.000Z',
        });
        assert.equal(zeroAmountEvent.status, 'failed');
        assert.equal(zeroAmountEvent.errorCode, 'invalid-amount');
    });

    it('uses device message ids when available and normalized content otherwise', () => {
        assert.equal(
            makeSmsIdempotencyKey('phone', '42', '15889999', 'first'),
            makeSmsIdempotencyKey('phone', '42', '15889999', 'changed')
        );
        assert.equal(
            makeSmsIdempotencyKey('phone', null, '1588-9999', '입금   1,000원', 1_783_987_200_000),
            makeSmsIdempotencyKey('phone', null, '15889999', '입금 1,000원', '1783987200000')
        );
        assert.notEqual(
            makeSmsIdempotencyKey('phone', null, '15889999', '입금 1,000원', 1_783_987_200_000),
            makeSmsIdempotencyKey('phone', null, '15889999', '입금 1,000원', 1_783_987_260_000)
        );
    });

    it('decrypts retained SMS only with the configured AES-GCM key', () => {
        const previousKey = process.env.BANK_SMS_ENCRYPTION_KEY;
        const previousKeyId = process.env.BANK_SMS_ENCRYPTION_KEY_ID;
        const key = Buffer.alloc(32, 7);
        const iv = Buffer.alloc(12, 3);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([cipher.update('입금 10,000원', 'utf8'), cipher.final()]);
        process.env.BANK_SMS_ENCRYPTION_KEY = key.toString('base64');
        try {
            assert.equal(decryptStoredMessage({
                version: 1,
                algorithm: 'AES-256-GCM',
                keyId: 'v1',
                iv: iv.toString('base64'),
                ciphertext: ciphertext.toString('base64'),
                authTag: cipher.getAuthTag().toString('base64'),
            }), '입금 10,000원');
        } finally {
            if (previousKey === undefined) delete process.env.BANK_SMS_ENCRYPTION_KEY;
            else process.env.BANK_SMS_ENCRYPTION_KEY = previousKey;
            if (previousKeyId === undefined) delete process.env.BANK_SMS_ENCRYPTION_KEY_ID;
            else process.env.BANK_SMS_ENCRYPTION_KEY_ID = previousKeyId;
        }
    });

    it('decrypts retained SMS with an older key while a new key is active', () => {
        const previousKey = process.env.BANK_SMS_ENCRYPTION_KEY;
        const previousKeyId = process.env.BANK_SMS_ENCRYPTION_KEY_ID;
        const oldKey = Buffer.alloc(32, 5);
        const newKey = Buffer.alloc(32, 9);
        const iv = Buffer.alloc(12, 4);
        const cipher = crypto.createCipheriv('aes-256-gcm', oldKey, iv);
        const ciphertext = Buffer.concat([cipher.update('출금 20,000원', 'utf8'), cipher.final()]);
        process.env.BANK_SMS_ENCRYPTION_KEY_ID = 'v2';
        process.env.BANK_SMS_ENCRYPTION_KEY = JSON.stringify({
            v1: oldKey.toString('base64'),
            v2: newKey.toString('base64'),
        });
        try {
            assert.equal(decryptStoredMessage({
                version: 1,
                algorithm: 'AES-256-GCM',
                keyId: 'v1',
                iv: iv.toString('base64'),
                ciphertext: ciphertext.toString('base64'),
                authTag: cipher.getAuthTag().toString('base64'),
            }), '출금 20,000원');
        } finally {
            if (previousKey === undefined) delete process.env.BANK_SMS_ENCRYPTION_KEY;
            else process.env.BANK_SMS_ENCRYPTION_KEY = previousKey;
            if (previousKeyId === undefined) delete process.env.BANK_SMS_ENCRYPTION_KEY_ID;
            else process.env.BANK_SMS_ENCRYPTION_KEY_ID = previousKeyId;
        }
    });

    it('matches normalized sender allowlists and masks sensitive display values', () => {
        assert.equal(isAllowedSender('1588-9999', ['15889999']), true);
        assert.equal(isAllowedSender('010-0000-0000', ['15889999']), false);
        assert.equal(isAllowedSender('+82 10-1234-5678', ['01012345678']), true);
        assert.equal(maskAccount('1234'), '••••1234');
        assert.equal(maskCounterparty('홍길동'), '홍*동');
    });

    it('handles same-day and overnight quiet-hour windows', () => {
        assert.equal(isWithinQuietHours('23:30', '22:00', '07:00'), true);
        assert.equal(isWithinQuietHours('06:59', '22:00', '07:00'), true);
        assert.equal(isWithinQuietHours('12:00', '22:00', '07:00'), false);
        assert.equal(isWithinQuietHours('12:00', '09:00', '18:00'), true);
    });

    it('derives bridge health with a Doze-tolerant stale threshold', () => {
        const now = 1_783_987_200_000;
        assert.equal(resolveBridgeHealthState(null, now), 'unconfigured');
        assert.equal(resolveBridgeHealthState(now - 30 * 60 * 1000, now), 'healthy');
        assert.equal(resolveBridgeHealthState(now - 3 * 60 * 60 * 1000, now), 'stale');
    });

    it('classifies FCM failures so only transient errors retry', () => {
        assert.equal(classifyFcmFailure('messaging/invalid-registration-token'), 'invalid-token');
        assert.equal(classifyFcmFailure('messaging/server-unavailable'), 'transient');
        assert.equal(classifyFcmFailure('messaging/mismatched-credential'), 'permanent');
    });

    it('expires stale outbox entries before FCM can refresh their WebPush TTL', () => {
        const now = 1_783_987_200_000;
        assert.equal(isPushDeliveryExpired(now - 14 * 60 * 1000, now, 15), false);
        assert.equal(isPushDeliveryExpired(now - 16 * 60 * 1000, now, 15), true);
        assert.equal(isPushDeliveryExpired(Number.NaN, now, 15), true);
    });

    it('keeps a live outbox lease retryable and reclaims it only after expiry', () => {
        const now = 1_783_987_200_000;
        assert.equal(resolveOutboxClaimDecision(true, 'processing', now - 60_000, now), 'leased');
        assert.equal(resolveOutboxClaimDecision(true, 'processing', now - 6 * 60_000, now), 'claimable');
        assert.equal(resolveOutboxClaimDecision(true, 'dead_letter', null, now), 'terminal');
        assert.equal(resolveOutboxClaimDecision(false, '', null, now), 'terminal');
    });
});
