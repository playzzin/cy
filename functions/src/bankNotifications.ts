import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { requireCallableAdmin } from './auth';

export const KB_SMS_PARSER_VERSION = 'kb-sms-v1';
const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 7;

export type BankDirection = 'deposit' | 'withdrawal' | 'unknown';
export type BankParseStatus = 'parsed' | 'unknown' | 'failed';

export interface ParsedBankSms {
    parserVersion: string;
    status: BankParseStatus;
    direction: BankDirection;
    amount: number | null;
    balance: number | null;
    transactionAt: Date | null;
    accountSuffix: string | null;
    memo: string | null;
    confidence: number;
    errorCode: string | null;
}

export interface NormalizedBankEvent extends ParsedBankSms {
    source: 'sms' | 'provider';
    provider: string;
    providerEventId: string | null;
    receivedAt: Date;
}

interface HmacVerificationInput {
    identifier: string;
    timestamp: string;
    nonce: string;
    signature: string;
    rawBody: Buffer;
    secret: string;
    nowMs?: number;
    maxSkewMs?: number;
}

export interface HmacVerificationResult {
    ok: boolean;
    code: 'ok' | 'invalid-identifier' | 'invalid-timestamp' | 'expired' | 'invalid-nonce' | 'invalid-signature';
    timestampMs: number | null;
}

const bankSmsRegion = functions
    .runWith({
        timeoutSeconds: 30, memory: '256MB', maxInstances: 10,
        secrets: ['BANK_SMS_DEVICE_SECRETS', 'BANK_SMS_ENCRYPTION_KEY'],
    })
    .region('asia-northeast3');

const bankProviderRegion = functions
    .runWith({
        timeoutSeconds: 30, memory: '256MB', maxInstances: 10,
        secrets: ['BANK_PROVIDER_WEBHOOK_SECRETS'],
    })
    .region('asia-northeast3');

const bankMonitorRegion = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 1 })
    .region('asia-northeast3');

const bankPushRegion = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
        maxInstances: 10,
        failurePolicy: true,
    })
    .region('asia-northeast3');

const bankReprocessRegion = functions
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB',
        maxInstances: 5,
        secrets: ['BANK_SMS_ENCRYPTION_KEY'],
    })
    .region('asia-northeast3');

const normalizeWhitespace = (value: string): string =>
    String(value || '').normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();

export const sha256Hex = (value: string | Buffer): string =>
    crypto.createHash('sha256').update(value).digest('hex');

export const computeProtocolSignature = (
    secret: string,
    timestamp: string,
    nonce: string,
    rawBody: Buffer
): string => {
    const prefix = Buffer.from(`${timestamp}\n${nonce}\n`, 'utf8');
    return crypto.createHmac('sha256', secret).update(prefix).update(rawBody).digest('hex');
};

const parseEpochMillis = (value: string): number | null => {
    if (!/^\d{10,13}$/.test(value)) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return value.length <= 10 ? parsed * 1000 : parsed;
};

const normalizeSignature = (value: string): string | null => {
    const normalized = String(value || '').trim().replace(/^sha256=/i, '').toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
};

export function verifyProtocolHmac(input: HmacVerificationInput): HmacVerificationResult {
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(input.identifier)) {
        return { ok: false, code: 'invalid-identifier', timestampMs: null };
    }
    const timestampMs = parseEpochMillis(String(input.timestamp || ''));
    if (timestampMs === null) return { ok: false, code: 'invalid-timestamp', timestampMs: null };

    const maxSkewMs = input.maxSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
    if (Math.abs((input.nowMs ?? Date.now()) - timestampMs) > maxSkewMs) {
        return { ok: false, code: 'expired', timestampMs };
    }
    if (!/^[A-Za-z0-9._~-]{16,160}$/.test(String(input.nonce || ''))) {
        return { ok: false, code: 'invalid-nonce', timestampMs };
    }
    const supplied = normalizeSignature(input.signature);
    if (!supplied) return { ok: false, code: 'invalid-signature', timestampMs };

    const expected = computeProtocolSignature(
        input.secret,
        String(input.timestamp),
        String(input.nonce),
        input.rawBody
    );
    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
    return { ok: valid, code: valid ? 'ok' : 'invalid-signature', timestampMs };
}

export function parseSecretMap(
    serialized: string | undefined,
    fallbackId?: string,
    fallbackSecret?: string
): Record<string, string> {
    const result: Record<string, string> = {};
    if (serialized) {
        try {
            const value = JSON.parse(serialized) as Record<string, unknown>;
            Object.entries(value || {}).forEach(([id, secret]) => {
                if (/^[A-Za-z0-9._-]{1,80}$/.test(id)
                    && typeof secret === 'string'
                    && Buffer.byteLength(secret, 'utf8') >= 32) {
                    result[id] = secret;
                }
            });
        } catch {
            // Invalid configuration is represented by an empty map and fails closed.
        }
    }
    if (fallbackId && fallbackSecret && Buffer.byteLength(fallbackSecret, 'utf8') >= 32) {
        result[fallbackId] = fallbackSecret;
    }
    return result;
}

export const normalizeSmsSender = (value: string): string => {
    const compact = String(value || '').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
    if (/^82\d{8,}$/.test(compact)) return `0${compact.slice(2)}`;
    return compact;
};

export function isAllowedSender(sender: string, allowlist: string[]): boolean {
    const normalized = normalizeSmsSender(sender);
    return Boolean(normalized) && allowlist.map(normalizeSmsSender).filter(Boolean).includes(normalized);
}

const parseWon = (value: string | undefined): number | null => {
    if (!value) return null;
    const digits = String(value).normalize('NFKC').replace(/[,\s원₩]/g, '');
    if (!/^\d+$/.test(digits)) return null;
    const number = Number(digits);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

export function parseDateValue(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        const date = new Date(value < 100_000_000_000 ? value * 1000 : value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return null;
    if (/^\d{10,13}$/.test(text)) {
        const numeric = Number(text);
        const date = new Date(text.length <= 10 ? numeric * 1000 : numeric);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

const validKstDate = (year: number, month: number, day: number, hour: number, minute: number, second: number): Date | null => {
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second));
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});
    return Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day
        && Number(parts.hour) === hour && Number(parts.minute) === minute ? date : null;
};

const kstYear = (date: Date): number => Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric',
}).format(date));

const parseKoreanTransactionDate = (message: string, receivedAt: Date): Date | null => {
    const standard = message.match(/(?:(20\d{2})[./-])?(\d{1,2})[./-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const korean = message.match(/(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const match = standard || korean;
    if (!match) return null;
    const explicitYear = match[1] ? Number(match[1]) : null;
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);
    if (explicitYear) return validKstDate(explicitYear, month, day, hour, minute, second);

    const baseYear = kstYear(receivedAt);
    const candidates = [baseYear - 1, baseYear, baseYear + 1]
        .map((year) => validKstDate(year, month, day, hour, minute, second))
        .filter((value): value is Date => Boolean(value));
    candidates.sort((left, right) => Math.abs(left.getTime() - receivedAt.getTime()) - Math.abs(right.getTime() - receivedAt.getTime()));
    return candidates[0] || null;
};

const extractAccountSuffix = (message: string): string | null => {
    const keyword = message.match(/(?:계좌(?:번호)?|account)\s*[:：]?\s*([0-9*Xx•-]{4,30})/i);
    const masked = message.match(/\b([0-9]{2,8}(?:[*Xx•]{2,}|-[*Xx•]+)[0-9*Xx•-]{0,12})\b/);
    const full = message.match(/\b\d{2,6}-\d{2,6}-\d{2,8}\b/);
    const token = keyword?.[1] || masked?.[1] || full?.[0];
    if (!token) return null;
    const visible = token.replace(/[^0-9]/g, '');
    return visible ? visible.slice(-4) : null;
};

const extractMemo = (message: string): string | null => {
    const explicit = message.match(/(?:적요|내용|입금자|보낸분|받는분|거래처)\s*[:：]\s*([^\n]{1,40})/);
    if (!explicit) return null;
    const value = explicit[1]
        .replace(/\s*(?:잔액|거래후잔액)\s*[:：]?\s*[0-9,]+\s*원?.*$/i, '')
        .trim();
    return value ? value.slice(0, 40) : null;
};

export function parseKbBankSms(rawMessage: string, receivedAt: Date = new Date()): ParsedBankSms {
    const message = normalizeWhitespace(rawMessage);
    const base: ParsedBankSms = {
        parserVersion: KB_SMS_PARSER_VERSION,
        status: 'failed', direction: 'unknown', amount: null, balance: null,
        transactionAt: null, accountSuffix: null, memo: null, confidence: 0, errorCode: null,
    };
    if (!message) return { ...base, errorCode: 'empty-message' };

    const directionText = message.replace(/출금\s*가능\s*잔액/g, '잔액');
    // Some carrier templates omit the space between the direction and amount
    // (for example, "입금10,000원"). The look-ahead accepts that form while
    // still excluding labels such as "입금자".
    const deposit = /(?:^|\s|\])(?:입\s*금(?:완료|액)?)(?=\s|:|：|\d|$)/.test(directionText);
    const withdrawal = /(?:^|\s|\])(?:출\s*금(?:완료|액)?|지급)(?=\s|:|：|\d|$)/.test(directionText);
    let direction: BankDirection = 'unknown';
    if (deposit !== withdrawal) direction = deposit ? 'deposit' : 'withdrawal';

    const directionWord = direction === 'deposit'
        ? '(?:입\\s*금(?:완료|액)?)'
        : '(?:출\\s*금(?:완료|액)?|지급)';
    let amount: number | null = null;
    if (direction !== 'unknown') {
        const after = message.match(new RegExp(`${directionWord}\\s*(?:금액)?\\s*[:：]?\\s*([0-9][0-9,]*)\\s*원?`, 'i'));
        // Requiring the won marker here prevents the minute part of "14:03 입금" from
        // being mistaken for an amount. KB formats that omit 원 put the direction first.
        const before = message.match(new RegExp(`([0-9][0-9,]*)\\s*원\\s*${directionWord}`, 'i'));
        amount = parseWon(after?.[1] || before?.[1]);
    }
    if (amount === null) {
        const generic = message.match(/(?:거래금액|금액)\s*[:：]?\s*([0-9][0-9,]*)\s*원?/);
        amount = parseWon(generic?.[1]);
    }
    const balanceMatch = message.match(/(?:거래후\s*)?잔액\s*[:：]?\s*([0-9][0-9,]*)\s*원?/);
    const balance = parseWon(balanceMatch?.[1]);
    const transactionAt = parseKoreanTransactionDate(message, receivedAt);
    const accountSuffix = extractAccountSuffix(message);
    const memo = extractMemo(message);

    if (direction === 'unknown') {
        const hasTransactionMarker = /입금|출금|거래금액|거래후잔액/.test(directionText);
        return {
            ...base, status: hasTransactionMarker ? 'failed' : 'unknown', balance,
            transactionAt, accountSuffix, memo, confidence: hasTransactionMarker ? 0.25 : 0.05,
            errorCode: hasTransactionMarker ? 'ambiguous-direction' : 'not-a-transaction',
        };
    }
    if (amount === null || amount <= 0) {
        return {
            ...base, direction, balance, transactionAt, accountSuffix, memo, confidence: 0.4,
            errorCode: amount === 0 ? 'invalid-amount' : 'amount-not-found',
        };
    }
    return {
        ...base, status: 'parsed', direction, amount, balance, transactionAt,
        accountSuffix, memo, confidence: transactionAt ? 0.98 : 0.9, errorCode: null,
    };
}

const normalizeProviderDirection = (value: unknown): BankDirection => {
    const text = String(value || '').trim().toLowerCase();
    if (['deposit', 'credit', 'in', '입금'].includes(text)) return 'deposit';
    if (['withdrawal', 'debit', 'out', '출금', '지급'].includes(text)) return 'withdrawal';
    return 'unknown';
};

export function normalizeOfficialProviderEvent(payload: Record<string, unknown>, receivedAt = new Date()): NormalizedBankEvent {
    const direction = normalizeProviderDirection(payload.direction ?? payload.transactionType ?? payload.type);
    const amount = parseWon(String(payload.amount ?? ''));
    const balance = payload.balance === undefined || payload.balance === null ? null : parseWon(String(payload.balance));
    const transactionAt = parseDateValue(payload.occurredAt ?? payload.transactionAt);
    const suffix = String(payload.accountSuffix ?? '').replace(/[^0-9]/g, '').slice(-4) || null;
    const provider = String(payload.provider || 'kb').trim().toLowerCase().slice(0, 30) || 'kb';
    const providerEventId = String(payload.eventId ?? payload.providerEventId ?? '').trim().slice(0, 160) || null;
    const valid = direction !== 'unknown' && amount !== null && amount > 0 && transactionAt !== null;
    return {
        parserVersion: 'official-provider-v1', source: 'provider', provider, providerEventId,
        status: valid ? 'parsed' : 'failed', direction, amount, balance, transactionAt,
        receivedAt, accountSuffix: suffix, memo: String(payload.memo ?? payload.description ?? '').trim().slice(0, 40) || null,
        confidence: valid ? 1 : 0.2,
        errorCode: valid
            ? null
            : direction === 'unknown'
                ? 'invalid-direction'
                : amount === null || amount <= 0
                    ? 'invalid-amount'
                    : 'invalid-occurred-at',
    };
}

export function makeSmsIdempotencyKey(
    deviceId: string,
    deviceMessageId: string | null,
    sender: string,
    message: string,
    receivedAt?: Date | string | number | null
): string {
    const parsedReceivedAt = parseDateValue(receivedAt);
    const identity = deviceMessageId
        ? `sms\0${deviceId}\0${deviceMessageId}`
        : `sms\0${normalizeSmsSender(sender)}\0${normalizeWhitespace(message)}\0${parsedReceivedAt?.toISOString() || 'unknown-time'}`;
    return sha256Hex(identity);
}

export function makeProviderIdempotencyKey(event: NormalizedBankEvent): string {
    if (event.providerEventId) return sha256Hex(`provider\0${event.provider}\0${event.providerEventId}`);
    return sha256Hex(JSON.stringify({
        source: event.source, provider: event.provider, direction: event.direction, amount: event.amount,
        balance: event.balance, transactionAt: event.transactionAt?.toISOString() || null,
        accountSuffix: event.accountSuffix, memo: event.memo,
    }));
}

export const maskAccount = (suffix: string | null): string | null => suffix ? `••••${suffix.slice(-4)}` : null;

export const maskCounterparty = (value: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.length <= 1) return '*';
    if (trimmed.length === 2) return `${trimmed[0]}*`;
    return `${trimmed[0]}${'*'.repeat(Math.min(6, trimmed.length - 2))}${trimmed[trimmed.length - 1]}`;
};

const maskSender = (value: string): string => {
    const normalized = String(value || '').replace(/\s+/g, '');
    if (normalized.length <= 4) return '*'.repeat(normalized.length || 1);
    return `${normalized.slice(0, 4)}${'*'.repeat(Math.min(8, normalized.length - 4))}`;
};

const maskAmountForPreview = (amount: number | null): string => {
    if (amount === null) return '금액 확인 필요';
    const text = amount.toLocaleString('ko-KR');
    return `${text[0]}${text.slice(1).replace(/\d/g, '*')}원`;
};

const buildMessagePreview = (event: NormalizedBankEvent): string => {
    if (event.status !== 'parsed') return 'KB국민은행 문자 · 내용 확인 필요';
    const label = event.direction === 'deposit' ? '입금' : '출금';
    const account = maskAccount(event.accountSuffix);
    return `KB국민은행 ${label} ${maskAmountForPreview(event.amount)}${account ? ` · ${account}` : ''}`;
};

const parsePositiveInt = (value: string | undefined, fallback: number, maximum: number): number => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

export const resolveBridgeHealthState = (
    lastActivityMs: number | null,
    nowMs = Date.now(),
    staleAfterMs = 2 * 60 * 60 * 1000
): 'healthy' | 'stale' | 'unconfigured' => {
    if (lastActivityMs === null || !Number.isFinite(lastActivityMs)) return 'unconfigured';
    return nowMs - lastActivityMs <= staleAfterMs ? 'healthy' : 'stale';
};

const firestoreDateMillis = (value: unknown): number | null => {
    if (value instanceof admin.firestore.Timestamp) return value.toMillis();
    const date = parseDateValue(value);
    return date?.getTime() ?? null;
};

const decodeEncryptionKey = (configured: string): Buffer => {
    let key: Buffer;
    if (/^[a-f0-9]{64}$/i.test(configured)) key = Buffer.from(configured, 'hex');
    else key = Buffer.from(configured, 'base64');
    if (key.length !== 32) throw new Error('BANK_SMS_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    return key;
};

const activeEncryptionKeyId = (): string => {
    const keyId = String(process.env.BANK_SMS_ENCRYPTION_KEY_ID || 'v1').trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(keyId)) throw new Error('BANK_SMS_ENCRYPTION_KEY_ID is invalid.');
    return keyId;
};

const parseEncryptionKey = (requestedKeyId?: string): Buffer | null => {
    const configured = String(process.env.BANK_SMS_ENCRYPTION_KEY || '').trim();
    if (!configured) return null;
    const activeKeyId = activeEncryptionKeyId();
    if (configured.startsWith('{')) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(configured);
        } catch {
            throw new Error('BANK_SMS_ENCRYPTION_KEY key ring JSON is invalid.');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('BANK_SMS_ENCRYPTION_KEY key ring must be a JSON object.');
        }
        const keyId = requestedKeyId || activeKeyId;
        const encoded = String((parsed as Record<string, unknown>)[keyId] || '').trim();
        if (!encoded) throw new Error('encryption-key-id-unavailable');
        return decodeEncryptionKey(encoded);
    }
    if (requestedKeyId && requestedKeyId !== activeKeyId) throw new Error('encryption-key-id-unavailable');
    return decodeEncryptionKey(configured);
};

const encryptMessage = (message: string): Record<string, string | number> | null => {
    const keyId = activeEncryptionKeyId();
    const key = parseEncryptionKey(keyId);
    if (!key) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
    return {
        version: 1, algorithm: 'AES-256-GCM', keyId,
        iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), authTag: cipher.getAuthTag().toString('base64'),
    };
};

export const decryptStoredMessage = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('encrypted-message-unavailable');
    }
    const encrypted = payload as Record<string, unknown>;
    if (encrypted.version !== 1 || encrypted.algorithm !== 'AES-256-GCM') {
        throw new Error('unsupported-encrypted-message');
    }
    const keyId = String(encrypted.keyId || '').trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(keyId)) throw new Error('invalid-encrypted-message');
    const key = parseEncryptionKey(keyId);
    if (!key) throw new Error('encryption-key-unavailable');

    const readBase64 = (field: string, maximumLength: number): Buffer => {
        const value = String(encrypted[field] || '');
        if (!value || value.length > maximumLength || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
            throw new Error('invalid-encrypted-message');
        }
        return Buffer.from(value, 'base64');
    };
    const iv = readBase64('iv', 64);
    const ciphertext = readBase64('ciphertext', 24_000);
    const authTag = readBase64('authTag', 64);
    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length > 16_000) {
        throw new Error('invalid-encrypted-message');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    if (!plaintext || plaintext.length > 8_000) throw new Error('invalid-encrypted-message');
    return plaintext;
};

interface NotificationSettings {
    enabled: boolean;
    recipientIds: string[];
    minimumAmount: number;
    directions: BankDirection[];
    notifyOnParseFailure: boolean;
    quietHours: { enabled: boolean; start: string; end: string; timezone: 'Asia/Seoul' };
}

const uniqueStrings = (value: unknown): string[] => Array.from(new Set(
    (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
));

const loadSettings = async (): Promise<NotificationSettings> => {
    const snap = await admin.firestore().collection('bank_notification_settings').doc('global').get();
    const data = snap.data() || {};
    const envRecipients = String(process.env.BANK_NOTIFICATION_RECIPIENT_IDS || '').split(',').map((item) => item.trim()).filter(Boolean);
    const configuredDirections = uniqueStrings(data.directions).filter((value): value is BankDirection => value === 'deposit' || value === 'withdrawal');
    const rawQuietHours = data.quietHours && typeof data.quietHours === 'object' ? data.quietHours : {};
    const validClock = (value: unknown, fallback: string): string => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : fallback;
    return {
        enabled: data.enabled !== false,
        // An explicitly saved empty list means "send to nobody". Environment
        // recipients are only a bootstrap fallback before the settings document exists.
        recipientIds: (snap.exists ? uniqueStrings(data.recipientIds) : envRecipients).slice(0, 100),
        minimumAmount: Math.max(0, Number(data.minimumAmount || 0)),
        directions: configuredDirections.length ? configuredDirections : ['deposit', 'withdrawal'],
        notifyOnParseFailure: data.notifyOnParseFailure !== false,
        quietHours: {
            enabled: Boolean(rawQuietHours.enabled),
            start: validClock(rawQuietHours.start, '22:00'),
            end: validClock(rawQuietHours.end, '07:00'),
            timezone: 'Asia/Seoul',
        },
    };
};

const shouldNotify = (event: NormalizedBankEvent, settings: NotificationSettings): boolean => {
    if (!settings.enabled || settings.recipientIds.length === 0) return false;
    if (event.status !== 'parsed') return settings.notifyOnParseFailure;
    return settings.directions.includes(event.direction) && (event.amount || 0) >= settings.minimumAmount;
};

export const isWithinQuietHours = (clockTime: string, start: string, end: string): boolean => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clockTime)
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return false;
    if (start === end) return true;
    return start < end ? clockTime >= start && clockTime < end : clockTime >= start || clockTime < end;
};

const quietHoursReason = (settings: NotificationSettings, now = new Date()): string | null => {
    if (!settings.quietHours.enabled) return null;
    const clockTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(now);
    return isWithinQuietHours(clockTime, settings.quietHours.start, settings.quietHours.end) ? 'quiet_hours' : null;
};

class RequestFailure extends Error {
    constructor(public status: number, public code: string, message: string) {
        super(message);
    }
}

const getHeader = (req: functions.https.Request, name: string): string => String(req.get(name) || '').trim();

const requireRawBody = (req: functions.https.Request): Buffer => {
    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw) || raw.length === 0) throw new RequestFailure(400, 'missing-raw-body', 'Raw UTF-8 request body is required.');
    if (raw.length > MAX_BODY_BYTES) throw new RequestFailure(413, 'payload-too-large', 'Request body is too large.');
    return raw;
};

const parseJsonObject = (rawBody: Buffer): Record<string, any> => {
    try {
        const parsed = JSON.parse(rawBody.toString('utf8'));
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('not-object');
        return parsed;
    } catch {
        throw new RequestFailure(400, 'invalid-json', 'A JSON object is required.');
    }
};

const reserveReplayNonce = async (
    transaction: admin.firestore.Transaction,
    identifier: string,
    nonce: string,
    requestTimestamp: Date
): Promise<void> => {
    const ref = admin.firestore().collection('bank_ingestion_replay_nonces').doc(sha256Hex(`${identifier}\0${nonce}`));
    const snap = await transaction.get(ref);
    if (snap.exists) throw new RequestFailure(409, 'replay-detected', 'This signed request was already processed.');
    transaction.create(ref, {
        identifierHash: sha256Hex(identifier), nonceHash: sha256Hex(nonce), requestTimestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        retentionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
};

const buildCandidate = (
    event: NormalizedBankEvent,
    ingestionId: string,
    senderMasked: string,
    now: admin.firestore.FieldValue
): Record<string, unknown> => {
    const counterpartyMasked = maskCounterparty(event.memo);
    return {
        direction: event.direction, amount: event.amount, balance: event.balance,
        bankName: 'KB국민은행', accountSuffix: event.accountSuffix, accountMasked: maskAccount(event.accountSuffix),
        sourceMasked: senderMasked, senderText: senderMasked, counterpartyMasked,
        memo: counterpartyMasked, messagePreview: buildMessagePreview(event),
        transactionAt: event.transactionAt || event.receivedAt, receivedAt: event.receivedAt,
        status: event.status === 'parsed' ? 'pending' : 'parse_failed',
        parseStatus: event.status, parseError: event.errorCode, parserVersion: event.parserVersion,
        confidence: event.confidence, source: event.source, provider: event.provider,
        providerEventId: event.providerEventId, ingestionId, idempotencyKey: ingestionId,
        reviewedBy: null, reviewedById: null, reviewedByName: null, reviewedAt: null,
        createdAt: now, updatedAt: now,
    };
};

const buildErpMessage = (
    event: NormalizedBankEvent,
    candidateId: string,
    recipients: string[],
    now: admin.firestore.FieldValue
): Record<string, unknown> => {
    const parsed = event.status === 'parsed';
    const label = event.direction === 'deposit' ? '입금' : event.direction === 'withdrawal' ? '출금' : '문자 분석 실패';
    return {
        type: 'system', title: `국민은행 ${label} 알림`,
        body: parsed ? `새 ${label} 거래가 감지되었습니다. 거래 후보를 확인해 주세요.` : '국민은행 문자를 자동 분석하지 못했습니다. 검토가 필요합니다.',
        category: '입출금', priority: parsed ? 'high' : 'urgent', status: 'active',
        senderId: 'system:bank-notification', senderName: '국민은행 알림', senderEmail: null,
        recipientScope: 'users', recipientIds: recipients, recipientNames: [], readBy: [], readAtBy: {},
        pinned: false, actionLabel: '거래 확인', actionUrl: `/finance/bank-notifications?candidate=${candidateId}`,
        bankCandidateId: candidateId, createdAt: now, updatedAt: now, expiresAt: null,
    };
};

interface PersistInput {
    event: NormalizedBankEvent;
    idempotencyKey: string;
    identifier: string;
    nonce: string;
    requestTimestamp: Date;
    senderMasked: string;
    encryptedMessage: Record<string, string | number> | null;
    settings: NotificationSettings;
    deviceMessageId?: string | null;
    queuedAt?: Date | null;
}

interface PersistResult {
    duplicate: boolean;
    candidateId: string;
    messageId: string | null;
    notify: boolean;
    pushAllowed: boolean;
    pushSuppressedReason: string | null;
}

const persistEvent = async (input: PersistInput): Promise<PersistResult> => {
    const db = admin.firestore();
    const ingestionRef = db.collection('bank_sms_ingestions').doc(input.idempotencyKey);
    const candidateRef = db.collection('bank_transaction_candidates').doc(input.idempotencyKey);
    const messageRef = db.collection('erp_messages').doc(`bank-${input.idempotencyKey}`);
    const outboxRef = db.collection('bank_notification_outbox').doc(input.idempotencyKey);
    const providerEventRef = input.event.source === 'provider'
        ? db.collection('bank_provider_events').doc(input.idempotencyKey)
        : null;
    const healthRef = db.collection('bank_notification_health').doc('current');
    const notify = shouldNotify(input.event, input.settings);
    const pushSuppressedReason = notify ? quietHoursReason(input.settings) : 'notification_policy';
    const pushAllowed = notify && pushSuppressedReason === null;
    const retentionDays = parsePositiveInt(process.env.BANK_SMS_RETENTION_DAYS, DEFAULT_RETENTION_DAYS, 90);

    return db.runTransaction(async (transaction) => {
        // Firestore requires every transaction read to happen before its first write.
        const replayRef = db.collection('bank_ingestion_replay_nonces').doc(sha256Hex(`${input.identifier}\0${input.nonce}`));
        const [replay, existing] = await Promise.all([
            transaction.get(replayRef),
            transaction.get(ingestionRef),
        ]);
        if (replay.exists) throw new RequestFailure(409, 'replay-detected', 'This signed request was already processed.');
        transaction.create(replayRef, {
            identifierHash: sha256Hex(input.identifier), nonceHash: sha256Hex(input.nonce),
            requestTimestamp: input.requestTimestamp,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            retentionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        if (existing.exists) return {
            duplicate: true, candidateId: candidateRef.id, messageId: existing.get('erpMessageId') || null,
            notify: false, pushAllowed: false, pushSuppressedReason: 'duplicate',
        };

        const now = admin.firestore.FieldValue.serverTimestamp();
        const preview = buildMessagePreview(input.event);
        const ingestion: Record<string, unknown> = {
            source: input.event.source, provider: input.event.provider, processingStatus: input.event.status === 'parsed' ? 'candidate_created' : 'needs_review',
            parseStatus: input.event.status, parseError: input.event.errorCode, parserVersion: input.event.parserVersion,
            idempotencyKey: input.idempotencyKey, candidateId: candidateRef.id, erpMessageId: notify ? messageRef.id : null,
            messageHash: input.idempotencyKey, messagePreview: preview, senderMasked: input.senderMasked,
            deviceMessageIdHash: input.deviceMessageId ? sha256Hex(input.deviceMessageId) : null,
            requestIdentifierHash: sha256Hex(input.identifier), requestNonceHash: sha256Hex(input.nonce),
            requestTimestamp: input.requestTimestamp, receivedAt: input.event.receivedAt, queuedAt: input.queuedAt || null,
            encryptedMessage: input.encryptedMessage,
            audit: { auth: 'hmac-sha256', replayProtection: 'verified', senderPolicy: input.event.source === 'sms' ? 'allowed' : 'provider-authenticated' },
            health: {
                parser: input.event.status, notificationEligible: notify,
                pushStatus: pushAllowed ? 'queued' : 'suppressed', pushSuppressedReason,
            },
            createdAt: now, updatedAt: now,
            retentionExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
        };
        transaction.create(ingestionRef, ingestion);
        transaction.create(candidateRef, buildCandidate(input.event, input.idempotencyKey, input.senderMasked, now));
        if (providerEventRef) transaction.create(providerEventRef, {
            provider: input.event.provider,
            providerEventId: input.event.providerEventId,
            ingestionId: ingestionRef.id,
            candidateId: candidateRef.id,
            parseStatus: input.event.status,
            parserVersion: input.event.parserVersion,
            createdAt: now,
            updatedAt: now,
            retentionExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
        });
        if (notify) transaction.create(messageRef, buildErpMessage(input.event, candidateRef.id, input.settings.recipientIds, now));
        if (pushAllowed) transaction.create(outboxRef, {
            status: 'pending', ingestionId: ingestionRef.id, candidateId: candidateRef.id,
            direction: input.event.direction, parseStatus: input.event.status,
            recipientIds: input.settings.recipientIds,
            attempts: 0, createdAt: now, updatedAt: now,
            retentionExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
        });
        transaction.set(healthRef, {
            integration: input.event.source === 'sms' ? 'android_sms_bridge' : 'official_provider_adapter',
            state: 'healthy', lastEventAt: now,
            lastReceivedAt: now, lastSuccessfulIngestionAt: now,
            ...(input.event.status === 'parsed' ? { lastParsedAt: now } : { lastParseFailureAt: now }),
            ...(input.event.source === 'sms' ? { lastBridgeDeviceHash: sha256Hex(input.identifier) } : {}),
            lastSource: input.event.source, lastIngestionId: ingestionRef.id,
            lastParserStatus: input.event.status,
            lastErrorCode: input.event.status === 'parsed' ? null : input.event.errorCode,
            updatedAt: now,
        }, { merge: true });
        return {
            duplicate: false, candidateId: candidateRef.id, messageId: notify ? messageRef.id : null,
            notify, pushAllowed, pushSuppressedReason,
        };
    });
};

interface PushTokenRecord { token: string; refs: admin.firestore.DocumentReference[]; }

const loadEligibleRecipientIds = async (recipientIds: string[]): Promise<Set<string>> => {
    const uniqueIds = Array.from(new Set(recipientIds)).slice(0, 100);
    if (!uniqueIds.length) return new Set();

    const db = admin.firestore();
    const [profileSnapshots, authResult] = await Promise.all([
        db.getAll(...uniqueIds.map((uid) => db.collection('users').doc(uid))),
        admin.auth().getUsers(uniqueIds.map((uid) => ({ uid }))),
    ]);
    const activeAuthIds = new Set(authResult.users.filter((user) => !user.disabled).map((user) => user.uid));
    const blockedStatuses = new Set(['rejected', 'suspended', 'inactive', 'disabled', 'deleted']);

    return new Set(profileSnapshots
        .filter((snapshot) => {
            const profile = snapshot.data() || {};
            return snapshot.exists
                && activeAuthIds.has(snapshot.id)
                && !blockedStatuses.has(String(profile.status || '').trim().toLowerCase())
                && profile.disabled !== true;
        })
        .map((snapshot) => snapshot.id));
};

const loadRecipientTokens = async (recipientIds: string[]): Promise<PushTokenRecord[]> => {
    if (!recipientIds.length) return [];
    const recipients = await loadEligibleRecipientIds(recipientIds);
    if (!recipients.size) return [];
    const maximumAgeDays = parsePositiveInt(process.env.BANK_PUSH_DEVICE_MAX_AGE_DAYS, 90, 365);
    const oldestAllowedAt = Date.now() - maximumAgeDays * 24 * 60 * 60 * 1000;
    // Query only configured recipients. A global `enabled == true LIMIT 2000`
    // query could be crowded out by unrelated or malicious device documents.
    const recipientChunks: string[][] = [];
    const recipientList = Array.from(recipients);
    for (let offset = 0; offset < recipientList.length; offset += 30) {
        recipientChunks.push(recipientList.slice(offset, offset + 30));
    }
    const snapshots = await Promise.all(recipientChunks.map((chunk) => (
        chunk.length === 1
            ? admin.firestore().collection('notification_devices').where('uid', '==', chunk[0]).get()
            : admin.firestore().collection('notification_devices').where('uid', 'in', chunk).get()
    )));
    const byToken = new Map<string, PushTokenRecord>();
    snapshots.flatMap((snapshot) => snapshot.docs).forEach((doc) => {
        const data = doc.data();
        const uid = String(data.uid || data.userId || '');
        const token = String(data.token || data.fcmToken || data.messagingToken || '').trim();
        const lastSeenValue = data.lastSeenAt ?? data.updatedAt ?? data.createdAt;
        const lastSeenAt = firestoreDateMillis(lastSeenValue);
        if (!recipients.has(uid) || data.enabled !== true || !token || data.permission === 'denied'
            || lastSeenAt === null || lastSeenAt < oldestAllowedAt) return;
        const record = byToken.get(token) || { token, refs: [] };
        record.refs.push(doc.ref);
        byToken.set(token, record);
    });
    return Array.from(byToken.values());
};

interface PushEventSummary {
    status: BankParseStatus;
    direction: BankDirection;
}

export type FcmFailureDisposition = 'invalid-token' | 'transient' | 'permanent';

export const classifyFcmFailure = (code: string): FcmFailureDisposition => {
    if (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') return 'invalid-token';
    if (code === 'messaging/internal-error'
        || code === 'messaging/server-unavailable'
        || code === 'messaging/quota-exceeded'
        || code === 'messaging/unknown-error') return 'transient';
    return 'permanent';
};

export const isPushDeliveryExpired = (
    createdAtMillis: number,
    nowMillis: number = Date.now(),
    maximumAgeMinutes: number = 15
): boolean => !Number.isFinite(createdAtMillis)
    || createdAtMillis <= 0
    || nowMillis - createdAtMillis > maximumAgeMinutes * 60 * 1000;

export const resolveOutboxClaimDecision = (
    exists: boolean,
    status: string,
    processingAtMillis: number | null,
    nowMillis: number = Date.now(),
    leaseMillis: number = 5 * 60 * 1000
): 'terminal' | 'leased' | 'claimable' => {
    if (!exists || status === 'delivered' || status === 'dead_letter') return 'terminal';
    if (status === 'processing'
        && processingAtMillis !== null
        && Number.isFinite(processingAtMillis)
        && processingAtMillis > nowMillis - leaseMillis) return 'leased';
    return 'claimable';
};

interface PushDispatchResult {
    sent: number;
    failed: number;
    transientFailed: number;
    permanentFailed: number;
    retryTokenHashes: string[];
}

const dispatchPush = async (
    candidateId: string,
    event: PushEventSummary,
    recipients: string[],
    retryTokenHashes: string[] = []
): Promise<PushDispatchResult> => {
    const retryAllowlist = new Set(retryTokenHashes);
    const records = (await loadRecipientTokens(recipients)).filter((record) => (
        retryAllowlist.size === 0 || retryAllowlist.has(sha256Hex(record.token))
    ));
    let sent = 0;
    let failed = 0;
    let transientFailed = 0;
    let permanentFailed = 0;
    const nextRetryTokenHashes = new Set<string>();
    const invalidRefs: admin.firestore.DocumentReference[] = [];
    for (let offset = 0; offset < records.length; offset += 500) {
        const batch = records.slice(offset, offset + 500);
        const label = event.status !== 'parsed' ? '거래 문자 확인 필요' : event.direction === 'deposit' ? '입금 알림' : '출금 알림';
        const configuredAppUrl = String(process.env.BANK_NOTIFICATION_APP_URL || '').trim();
        const clickUrl = /^https:\/\//i.test(configuredAppUrl)
            ? `${configuredAppUrl.replace(/\/$/, '')}/finance/bank-notifications?candidate=${candidateId}`
            : null;
        const result = await admin.messaging().sendEachForMulticast({
            tokens: batch.map((item) => item.token),
            notification: { title: `국민은행 ${label}`, body: '새 은행 거래가 감지되었습니다. 앱에서 안전하게 확인하세요.' },
            data: { type: 'bank_transaction', candidateId, actionUrl: `/finance/bank-notifications?candidate=${candidateId}` },
            webpush: {
                headers: { TTL: '900', Urgency: 'high' },
                ...(clickUrl ? { fcmOptions: { link: clickUrl } } : {}),
            },
        });
        sent += result.successCount;
        failed += result.failureCount;
        result.responses.forEach((response, index) => {
            if (response.success) return;
            const code = response.error?.code || '';
            const disposition = classifyFcmFailure(code);
            if (disposition === 'invalid-token') {
                invalidRefs.push(...batch[index].refs);
                permanentFailed += 1;
            } else if (disposition === 'transient') {
                transientFailed += 1;
                nextRetryTokenHashes.add(sha256Hex(batch[index].token));
            } else {
                permanentFailed += 1;
            }
        });
    }
    for (let offset = 0; offset < invalidRefs.length; offset += 400) {
        const write = admin.firestore().batch();
        invalidRefs.slice(offset, offset + 400).forEach((ref) => write.set(ref, {
            enabled: false, disabledReason: 'invalid-token', updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }));
        await write.commit();
    }
    return {
        sent, failed, transientFailed, permanentFailed,
        retryTokenHashes: Array.from(nextRetryTokenHashes),
    };
};

const updatePushHealth = async (
    ingestionId: string,
    push: { sent: number; failed: number },
    statusOverride?: string
): Promise<void> => {
    await admin.firestore().collection('bank_sms_ingestions').doc(ingestionId).update({
        'health.pushStatus': statusOverride || (push.failed > 0 && push.sent === 0 ? 'failed' : 'completed'),
        'health.pushSent': push.sent, 'health.pushFailed': push.failed,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

class RetryableOutboxFailure extends Error {}

/**
 * Reliable push outbox consumer. Firestore creation is atomic with ingestion,
 * and the background failure policy retries transient all-recipient failures.
 */
export const processBankNotificationOutbox = bankPushRegion.firestore
    .document('bank_notification_outbox/{outboxId}')
    .onCreate(async (createdSnapshot) => {
        const ref = createdSnapshot.ref;
        const attemptId = crypto.randomUUID();
        const claimResult = await admin.firestore().runTransaction(async (transaction) => {
            const current = await transaction.get(ref);
            const status = current.exists ? String(current.get('status') || '') : '';
            const processingAt = current.exists ? current.get('processingAt') : null;
            const decision = resolveOutboxClaimDecision(
                current.exists,
                status,
                processingAt instanceof admin.firestore.Timestamp ? processingAt.toMillis() : null
            );
            if (decision !== 'claimable') return decision;

            transaction.update(ref, {
                status: 'processing', processingAt: admin.firestore.FieldValue.serverTimestamp(),
                processingAttemptId: attemptId, attempts: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return 'claimed' as const;
        });
        if (claimResult === 'terminal') return;
        if (claimResult === 'leased') {
            // Never acknowledge an onCreate retry while another attempt's lease is
            // still live. Throwing preserves the event until that attempt finishes
            // or the five-minute lease expires and a later retry can reclaim it.
            throw new RetryableOutboxFailure('outbox-lease-active');
        }

        const current = await ref.get();
        const data = current.data() || {};
        const attempts = Math.max(1, Number(data.attempts || 1));
        const maximumAttempts = parsePositiveInt(process.env.BANK_PUSH_MAX_ATTEMPTS, 5, 20);
        const maximumEventAgeMinutes = parsePositiveInt(process.env.BANK_PUSH_MAX_EVENT_AGE_MINUTES, 15, 24 * 60);
        const ingestionId = String(data.ingestionId || createdSnapshot.id);
        const candidateId = String(data.candidateId || '');
        const recipients = uniqueStrings(data.recipientIds);
        const event: PushEventSummary = {
            status: ['parsed', 'unknown', 'failed'].includes(String(data.parseStatus))
                ? data.parseStatus as BankParseStatus
                : 'failed',
            direction: ['deposit', 'withdrawal', 'unknown'].includes(String(data.direction))
                ? data.direction as BankDirection
                : 'unknown',
        };

        try {
            if (!candidateId || recipients.length === 0) throw new Error('invalid-outbox-payload');
            const createdAt = data.createdAt;
            const createdAtMillis = createdAt instanceof admin.firestore.Timestamp
                ? createdAt.toMillis()
                : Number.NaN;
            if (isPushDeliveryExpired(createdAtMillis, Date.now(), maximumEventAgeMinutes)) {
                await Promise.all([
                    updatePushHealth(ingestionId, {
                        sent: Math.max(0, Number(data.sent || 0)),
                        failed: 1,
                    }, 'expired'),
                    ref.update({
                        status: 'dead_letter', deliveryResult: 'expired',
                        lastErrorCode: 'push-event-expired',
                        retryTokenHashes: admin.firestore.FieldValue.delete(),
                        processingAttemptId: admin.firestore.FieldValue.delete(),
                        processingAt: admin.firestore.FieldValue.delete(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }),
                ]);
                functions.logger.warn('Bank push outbox expired before delivery.', {
                    outboxId: createdSnapshot.id, attempts,
                });
                return;
            }
            const push = await dispatchPush(
                candidateId,
                event,
                recipients,
                uniqueStrings(data.retryTokenHashes)
            );
            const cumulativeSent = Math.max(0, Number(data.sent || 0)) + push.sent;
            const cumulativePermanentFailed = Math.max(0, Number(data.permanentFailed || 0)) + push.permanentFailed;

            if (push.transientFailed > 0 && attempts < maximumAttempts) {
                await Promise.all([
                    admin.firestore().collection('bank_sms_ingestions').doc(ingestionId).update({
                        'health.pushStatus': 'retrying', updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }),
                    ref.update({
                        status: 'retry', sent: cumulativeSent,
                        permanentFailed: cumulativePermanentFailed,
                        retryTokenHashes: push.retryTokenHashes,
                        lastErrorCode: 'transient-push-failure',
                        processingAttemptId: admin.firestore.FieldValue.delete(),
                        processingAt: admin.firestore.FieldValue.delete(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }),
                ]);
                throw new RetryableOutboxFailure('transient-push-failure');
            }

            const remainingTransientFailures = push.transientFailed;
            const finalFailed = cumulativePermanentFailed + remainingTransientFailures;
            const deadLetter = remainingTransientFailures > 0
                || (cumulativeSent === 0 && finalFailed > 0);
            const finalStatus = deadLetter ? 'dead_letter' : 'delivered';
            const healthStatus = deadLetter ? 'failed' : finalFailed > 0 ? 'partial' : 'completed';

            await Promise.all([
                updatePushHealth(ingestionId, { sent: cumulativeSent, failed: finalFailed }, healthStatus),
                ref.update({
                    status: finalStatus,
                    deliveryResult: deadLetter
                        ? (remainingTransientFailures > 0 ? 'retry_exhausted' : 'permanent_failure')
                        : cumulativeSent === 0 ? 'no_registered_devices' : finalFailed > 0 ? 'partial' : 'sent',
                    sent: cumulativeSent, failed: finalFailed,
                    permanentFailed: cumulativePermanentFailed,
                    transientFailed: remainingTransientFailures,
                    retryTokenHashes: admin.firestore.FieldValue.delete(),
                    deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
                    processingAttemptId: admin.firestore.FieldValue.delete(),
                    processingAt: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }),
            ]);
        } catch (error) {
            if (error instanceof RetryableOutboxFailure) {
                functions.logger.warn('Bank push outbox transient delivery will retry.', {
                    outboxId: createdSnapshot.id, attempts,
                });
                throw error;
            }
            if (attempts >= maximumAttempts) {
                // The trigger must not acknowledge the event until the durable
                // dead-letter state has actually been written.
                await Promise.all([
                    updatePushHealth(ingestionId, {
                        sent: Math.max(0, Number(data.sent || 0)),
                        failed: 1,
                    }, 'failed'),
                    ref.update({
                        status: 'dead_letter', deliveryResult: 'retry_exhausted',
                        lastErrorCode: 'push-delivery-failed',
                        processingAttemptId: admin.firestore.FieldValue.delete(),
                        processingAt: admin.firestore.FieldValue.delete(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }),
                ]);
                functions.logger.error('Bank push outbox moved to dead letter.', {
                    outboxId: createdSnapshot.id, attempts,
                });
                return;
            }
            await Promise.allSettled([
                admin.firestore().collection('bank_sms_ingestions').doc(ingestionId).update({
                    'health.pushStatus': 'retrying', updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }),
                ref.update({
                    status: 'retry', lastErrorCode: 'push-delivery-failed',
                    processingAttemptId: admin.firestore.FieldValue.delete(),
                    processingAt: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }),
            ]);
            functions.logger.warn('Bank push outbox delivery will retry.', {
                outboxId: createdSnapshot.id,
                attempts,
                errorName: error instanceof Error ? error.name : 'unknown',
            });
            throw error;
        }
    });

/** Admin-only recovery path after a bank SMS template/parser update. */
export const reprocessBankSmsCandidate = bankReprocessRegion.https.onCall(async (data, context) => {
    const auth = await requireCallableAdmin(context);
    const candidateId = String(data?.candidateId || '').trim();
    if (!/^[a-f0-9]{64}$/.test(candidateId)) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid candidate id is required.');
    }

    const db = admin.firestore();
    const ingestionRef = db.collection('bank_sms_ingestions').doc(candidateId);
    const candidateRef = db.collection('bank_transaction_candidates').doc(candidateId);
    const ingestionSnapshot = await ingestionRef.get();
    if (!ingestionSnapshot.exists || ingestionSnapshot.get('source') !== 'sms') {
        throw new functions.https.HttpsError('not-found', 'The SMS ingestion was not found.');
    }

    let rawMessage: string;
    try {
        rawMessage = decryptStoredMessage(ingestionSnapshot.get('encryptedMessage'));
    } catch {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Encrypted source retention is unavailable for this candidate.'
        );
    }
    const receivedAtMillis = firestoreDateMillis(ingestionSnapshot.get('receivedAt'));
    if (receivedAtMillis === null) {
        throw new functions.https.HttpsError('failed-precondition', 'The original receive time is unavailable.');
    }
    const parsed = parseKbBankSms(rawMessage, new Date(receivedAtMillis));
    const senderMasked = String(ingestionSnapshot.get('senderMasked') || '');
    const normalized: NormalizedBankEvent = {
        ...parsed, source: 'sms', provider: 'kb', providerEventId: null,
        receivedAt: new Date(receivedAtMillis),
    };
    const settings = await loadSettings();
    const notifyAfterReprocess = parsed.status === 'parsed' && shouldNotify(normalized, settings);
    const pushSuppressedReason = notifyAfterReprocess ? quietHoursReason(settings) : 'notification_policy';
    const pushAfterReprocess = notifyAfterReprocess && pushSuppressedReason === null;
    const messageRef = db.collection('erp_messages').doc(`bank-${candidateId}`);
    const outboxRef = db.collection('bank_notification_outbox').doc(candidateId);
    const retentionDays = parsePositiveInt(process.env.BANK_SMS_RETENTION_DAYS, DEFAULT_RETENTION_DAYS, 90);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
        const [currentIngestion, currentCandidate, currentMessage, currentOutbox] = await Promise.all([
            transaction.get(ingestionRef),
            transaction.get(candidateRef),
            transaction.get(messageRef),
            transaction.get(outboxRef),
        ]);
        if (!currentIngestion.exists || !currentCandidate.exists) {
            throw new functions.https.HttpsError('not-found', 'The candidate no longer exists.');
        }
        if (currentCandidate.get('status') !== 'parse_failed') {
            throw new functions.https.HttpsError('failed-precondition', 'Only parse-failed candidates can be reprocessed.');
        }

        const counterpartyMasked = maskCounterparty(parsed.memo);
        transaction.update(candidateRef, {
            direction: parsed.direction, amount: parsed.amount, balance: parsed.balance,
            accountSuffix: parsed.accountSuffix, accountMasked: maskAccount(parsed.accountSuffix),
            sourceMasked: senderMasked, senderText: senderMasked,
            counterpartyMasked, memo: counterpartyMasked,
            messagePreview: buildMessagePreview(normalized),
            transactionAt: parsed.transactionAt || new Date(receivedAtMillis),
            parseStatus: parsed.status, parseError: parsed.errorCode,
            parserVersion: parsed.parserVersion, confidence: parsed.confidence,
            status: parsed.status === 'parsed' ? 'pending' : 'parse_failed',
            updatedAt: now,
        });
        const ingestionUpdate: Record<string, unknown> = {
            processingStatus: parsed.status === 'parsed' ? 'candidate_created' : 'needs_review',
            parseStatus: parsed.status, parseError: parsed.errorCode,
            parserVersion: parsed.parserVersion,
            'health.parser': parsed.status,
            'health.notificationEligible': notifyAfterReprocess,
            'reprocess.count': admin.firestore.FieldValue.increment(1),
            'reprocess.lastAt': now,
            'reprocess.lastBy': auth.uid,
            updatedAt: now,
        };

        if (parsed.status === 'parsed' && currentMessage.exists) {
            const corrected = buildErpMessage(normalized, candidateId, settings.recipientIds, now);
            transaction.update(messageRef, {
                title: corrected.title, body: corrected.body, category: corrected.category,
                priority: corrected.priority, actionLabel: corrected.actionLabel,
                actionUrl: corrected.actionUrl, updatedAt: now,
            });
        } else if (parsed.status === 'parsed' && notifyAfterReprocess && !currentMessage.exists) {
            transaction.create(messageRef, buildErpMessage(normalized, candidateId, settings.recipientIds, now));
            ingestionUpdate.erpMessageId = messageRef.id;
            if (pushAfterReprocess && !currentOutbox.exists) {
                transaction.create(outboxRef, {
                    status: 'pending', ingestionId: candidateId, candidateId,
                    direction: parsed.direction, parseStatus: parsed.status,
                    recipientIds: settings.recipientIds,
                    attempts: 0, createdAt: now, updatedAt: now,
                    retentionExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
                });
                ingestionUpdate['health.pushStatus'] = 'queued';
                ingestionUpdate['health.pushSuppressedReason'] = null;
            } else if (!pushAfterReprocess) {
                ingestionUpdate['health.pushStatus'] = 'suppressed';
                ingestionUpdate['health.pushSuppressedReason'] = pushSuppressedReason;
            }
        }
        transaction.update(ingestionRef, ingestionUpdate);
        transaction.set(db.collection('bank_notification_health').doc('current'), {
            lastReprocessedAt: now, lastReprocessedBy: auth.uid,
            lastParserStatus: parsed.status,
            lastErrorCode: parsed.status === 'parsed' ? null : parsed.errorCode,
            ...(parsed.status === 'parsed' ? { lastParsedAt: now } : { lastParseFailureAt: now }),
            updatedAt: now,
        }, { merge: true });
    });

    return {
        success: parsed.status === 'parsed',
        parseStatus: parsed.status,
        errorCode: parsed.errorCode,
        parserVersion: parsed.parserVersion,
        notificationQueued: parsed.status === 'parsed' && notifyAfterReprocess && pushAfterReprocess,
    };
});

const respondFailure = (res: functions.Response, error: unknown): void => {
    if (error instanceof RequestFailure) {
        res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
        return;
    }
    functions.logger.error('Bank notification processing failed.', {
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    res.status(500).json({ success: false, error: { code: 'internal', message: 'The request could not be processed.' } });
};

const validateSignedRequest = (
    req: functions.https.Request,
    rawBody: Buffer,
    identifierHeader: string,
    secrets: Record<string, string>
): { identifier: string; nonce: string; requestTimestamp: Date } => {
    const identifier = getHeader(req, identifierHeader);
    const timestamp = getHeader(req, identifierHeader === 'X-Sms-Bridge-Device' ? 'X-Sms-Bridge-Timestamp' : 'X-Bank-Provider-Timestamp');
    const nonce = getHeader(req, identifierHeader === 'X-Sms-Bridge-Device' ? 'X-Sms-Bridge-Nonce' : 'X-Bank-Provider-Nonce');
    const signature = getHeader(req, identifierHeader === 'X-Sms-Bridge-Device' ? 'X-Sms-Bridge-Signature' : 'X-Bank-Provider-Signature');
    const secret = secrets[identifier];
    if (!secret) throw new RequestFailure(401, 'unknown-client', 'Unknown signing client.');
    const verified = verifyProtocolHmac({
        identifier, timestamp, nonce, signature, rawBody, secret,
        maxSkewMs: parsePositiveInt(process.env.BANK_HMAC_MAX_SKEW_SECONDS, 300, 3600) * 1000,
    });
    if (!verified.ok || verified.timestampMs === null) throw new RequestFailure(401, verified.code, 'Request signature validation failed.');
    return { identifier, nonce, requestTimestamp: new Date(verified.timestampMs) };
};

export const ingestBankSms = bankSmsRegion.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.set('Allow', 'POST').status(405).json({ success: false, error: { code: 'method-not-allowed' } });
        return;
    }
    try {
        const rawBody = requireRawBody(req);
        const payload = parseJsonObject(rawBody);
        const secrets = parseSecretMap(process.env.BANK_SMS_DEVICE_SECRETS, process.env.BANK_SMS_DEVICE_ID, process.env.BANK_SMS_DEVICE_SECRET);
        if (!Object.keys(secrets).length) throw new RequestFailure(503, 'bridge-not-configured', 'SMS bridge authentication is not configured.');
        const auth = validateSignedRequest(req, rawBody, 'X-Sms-Bridge-Device', secrets);
        if (String(payload.deviceId || '') !== auth.identifier || String(payload.nonce || '') !== auth.nonce) {
            throw new RequestFailure(400, 'header-body-mismatch', 'Signed header and body identifiers must match.');
        }
        if (Number(payload.version) !== 1) throw new RequestFailure(400, 'unsupported-version', 'Only bridge payload version 1 is supported.');

        if (payload.eventType === 'connection_test') {
            await admin.firestore().runTransaction(async (transaction) => {
                await reserveReplayNonce(transaction, auth.identifier, auth.nonce, auth.requestTimestamp);
                transaction.set(admin.firestore().collection('bank_notification_health').doc('current'), {
                    state: 'healthy', lastEventAt: admin.firestore.FieldValue.serverTimestamp(),
                    integration: 'android_sms_bridge', lastConnectionTestAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastBridgeDeviceHash: sha256Hex(auth.identifier), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
            res.status(200).json({ success: true, eventType: 'connection_test', serverTime: new Date().toISOString() });
            return;
        }
        if (payload.eventType !== 'bank_sms') throw new RequestFailure(400, 'invalid-event-type', 'Unsupported event type.');

        const sender = String(payload.sender || '').trim();
        const message = String(payload.message || '');
        if (!sender || !message || message.length > 8000) throw new RequestFailure(400, 'invalid-sms', 'sender and message are required.');
        const allowlist = String(process.env.BANK_SMS_ALLOWED_SENDERS || '').split(/[,;\r\n]+/).map((item) => item.trim()).filter(Boolean);
        if (!allowlist.length) throw new RequestFailure(503, 'sender-policy-not-configured', 'SMS sender allowlist is not configured.');
        if (!isAllowedSender(sender, allowlist)) throw new RequestFailure(403, 'sender-not-allowed', 'SMS sender is not allowed.');

        const receivedAt = parseDateValue(payload.receivedAt);
        if (!receivedAt) throw new RequestFailure(400, 'invalid-received-at', 'receivedAt must be epoch milliseconds or an ISO timestamp.');
        const queuedAt = payload.queuedAt === undefined || payload.queuedAt === null ? null : parseDateValue(payload.queuedAt);
        if (payload.queuedAt !== undefined && payload.queuedAt !== null && !queuedAt) {
            throw new RequestFailure(400, 'invalid-queued-at', 'queuedAt must be epoch milliseconds or an ISO timestamp.');
        }
        const parsed = parseKbBankSms(message, receivedAt);
        const event: NormalizedBankEvent = {
            ...parsed, source: 'sms', provider: 'kb', providerEventId: null, receivedAt,
        };
        const deviceMessageId = String(payload.deviceMessageId ?? payload.messageId ?? '').trim() || null;
        const idempotencyKey = makeSmsIdempotencyKey(auth.identifier, deviceMessageId, sender, message, receivedAt);
        const settings = await loadSettings();
        const persisted = await persistEvent({
            event, idempotencyKey, identifier: auth.identifier, nonce: auth.nonce,
            requestTimestamp: auth.requestTimestamp, senderMasked: maskSender(sender),
            encryptedMessage: encryptMessage(message), settings, deviceMessageId, queuedAt,
        });
        res.status(200).json({
            success: true, duplicate: persisted.duplicate, ingestionId: idempotencyKey,
            candidateId: persisted.candidateId, parseStatus: event.status,
        });
    } catch (error) {
        respondFailure(res, error);
    }
});

export const ingestBankProviderWebhook = bankProviderRegion.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.set('Allow', 'POST').status(405).json({ success: false, error: { code: 'method-not-allowed' } });
        return;
    }
    try {
        const rawBody = requireRawBody(req);
        const payload = parseJsonObject(rawBody);
        const secrets = parseSecretMap(process.env.BANK_PROVIDER_WEBHOOK_SECRETS, process.env.BANK_PROVIDER_WEBHOOK_ID, process.env.BANK_PROVIDER_WEBHOOK_SECRET);
        if (!Object.keys(secrets).length) throw new RequestFailure(503, 'provider-not-configured', 'Provider webhook authentication is not configured.');
        const auth = validateSignedRequest(req, rawBody, 'X-Bank-Provider-Id', secrets);
        if (Number(payload.version ?? 1) !== 1) throw new RequestFailure(400, 'unsupported-version', 'Only provider payload version 1 is supported.');
        const receivedAt = new Date();
        const providerEventPayload = payload.event && typeof payload.event === 'object' && !Array.isArray(payload.event)
            ? { ...payload.event, provider: auth.identifier }
            : { ...payload, provider: auth.identifier };
        const event = normalizeOfficialProviderEvent(providerEventPayload, receivedAt);
        if (!event.providerEventId) {
            throw new RequestFailure(400, 'missing-provider-event-id', 'Official provider events require a stable eventId.');
        }
        const idempotencyKey = makeProviderIdempotencyKey(event);
        const settings = await loadSettings();
        const persisted = await persistEvent({
            event, idempotencyKey, identifier: auth.identifier, nonce: auth.nonce,
            requestTimestamp: auth.requestTimestamp, senderMasked: `${event.provider.slice(0, 4)}****`,
            encryptedMessage: null, settings,
        });
        res.status(200).json({ success: true, duplicate: persisted.duplicate, ingestionId: idempotencyKey, candidateId: persisted.candidateId, parseStatus: event.status });
    } catch (error) {
        respondFailure(res, error);
    }
});

/**
 * Marks a silent Android bridge as stale. The app sends a signed, content-free
 * heartbeat every 15 minutes; two hours leaves room for Android Doze delays.
 */
export const monitorBankNotificationHealth = bankMonitorRegion.pubsub
    .schedule('every 30 minutes')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        const ref = admin.firestore().collection('bank_notification_health').doc('current');
        const snapshot = await ref.get();
        if (!snapshot.exists) return null;

        const data = snapshot.data() || {};
        const activityCandidates = [
            firestoreDateMillis(data.lastConnectionTestAt),
            firestoreDateMillis(data.lastSuccessfulIngestionAt),
            firestoreDateMillis(data.lastEventAt),
        ].filter((value): value is number => value !== null);
        const latestActivityMs = activityCandidates.length ? Math.max(...activityCandidates) : null;
        const staleMinutes = parsePositiveInt(process.env.BANK_BRIDGE_STALE_MINUTES, 120, 10_080);
        const nextState = resolveBridgeHealthState(latestActivityMs, Date.now(), staleMinutes * 60 * 1000);

        if (data.state !== nextState) {
            await ref.update({
                state: nextState,
                stateChangedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return null;
    });
