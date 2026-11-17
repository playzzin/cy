import type { Worker } from '../services/manpowerService';

export function hasForeignRegistrationNumber(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const digits = value.normalize('NFKC').replace(/[\s-]/g, '');
    // MOJ: a 13-digit foreign registration number has 5, 6, 7, or 8 in position 7.
    // https://www.moj.go.kr/bbs/moj/182/451877/download.do
    // This classifies a complete number; it does not validate or reconstruct an ID.
    return /^\d{6}[5-8]\d{6}$/.test(digits);
}

export function isForeignWorker(worker: Partial<Worker> | null | undefined): boolean {
    return worker?.isForeignWorker === true || hasForeignRegistrationNumber(worker?.idNumber);
}
