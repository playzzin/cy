const koreaDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});
const koreaTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Business dates use Korea time, independently of the browser's timezone. */
export const getKoreanDateKey = (now: Date = new Date()): string => {
    const parts = koreaDateFormatter.formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
};

export const getKoreanMinuteOfDay = (now: Date = new Date()): number => {
    const parts = koreaTimeFormatter.formatToParts(now);
    return Number(parts.find((item) => item.type === 'hour')?.value) * 60
        + Number(parts.find((item) => item.type === 'minute')?.value);
};

export const toKoreanDateKey = (value: Date | string): string => (
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value : getKoreanDateKey(value instanceof Date ? value : new Date(value))
);

/** UTC is only used to perform calendar arithmetic on an already resolved date. */
export const shiftDateKey = (date: string, days: number): string => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
};
