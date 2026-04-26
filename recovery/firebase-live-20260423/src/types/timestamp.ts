export type FieldValue = unknown;

export class Timestamp {
    private readonly _millis: number;

    private constructor(millis: number) {
        this._millis = millis;
    }

    static fromDate(date: Date): Timestamp {
        return new Timestamp(date.getTime());
    }

    static fromMillis(millis: number): Timestamp {
        return new Timestamp(millis);
    }

    static now(): Timestamp {
        return new Timestamp(Date.now());
    }

    toDate(): Date {
        return new Date(this._millis);
    }

    toMillis(): number {
        return this._millis;
    }

    get seconds(): number {
        return Math.floor(this._millis / 1000);
    }

    get nanoseconds(): number {
        return (this._millis % 1000) * 1_000_000;
    }
}
