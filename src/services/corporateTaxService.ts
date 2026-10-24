import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { workbookLedgerService } from './workbookLedgerService';
import { freelancerService } from './freelancerService';
import { officeStaffPayrollService } from './officeStaffPayrollService';
import { companyService } from './companyService';
import { teamService } from './teamService';
import { cardService } from './cardService';
import { accommodationService } from './accommodationService';
import { CorporateTaxManual, Evidence, emptyManual, freelancerEvidence, ledgerEvidence, salaryEvidence, validateManual, cardEvidence, lodgingEvidence } from '../pages/tax/corporateTaxModel';
import { describeCorporateTaxLoadError } from '../pages/tax/corporateTaxLoadError';

export type CorporateTaxSource = 'ledger' | 'labor' | 'salary' | 'card' | 'lodging';
export interface CorporateTaxSources {
    evidence: Evidence[];
    errors: Partial<Record<CorporateTaxSource, string>>;
    failedMonths?: Partial<Record<CorporateTaxSource, number[]>>;
    warnings: string[];
    missingSalaryMonths: number[];
    unconfirmedSalaryMonths?: number[];
}
export interface CorporateTaxSaved { manual: CorporateTaxManual; revision: number }
function assertYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('연도는 2000~2100년 사이로 선택해 주세요.');
}
const documentRef = (year: number) => doc(db, 'corporate_tax_settlements', `cheongyeon-${year}`);

async function loadMonthlyEvidence(periods: string[], load: (period: string) => Promise<Evidence[]>) {
    const results = await Promise.allSettled(periods.map(load));
    const evidence: Evidence[] = [], failedMonths: number[] = [];
    const reasons = new Map<string, number[]>();
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') evidence.push(...result.value);
        else {
            const month = index + 1, reason = describeCorporateTaxLoadError(result.reason);
            failedMonths.push(month);
            reasons.set(reason, [...(reasons.get(reason) || []), month]);
        }
    });
    return { evidence, failedMonths, error: Array.from(reasons, ([reason, months]) => `${months.map(month => `${month}월`).join(', ')}: ${reason}`).join(' ') };
}

export const corporateTaxService = {
    async loadSources(year: number): Promise<CorporateTaxSources> {
        assertYear(year);
        const periods = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
        const [ledger, labor, salary, card, lodging] = await Promise.allSettled([
            workbookLedgerService.getEntries({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, force: true }).then(rows => ledgerEvidence(year, rows)),
            Promise.all([freelancerService.getFreelancerYearlyData(year), teamService.getTeams(), companyService.getCompanies()])
                .then(([report, teams, companies]) => freelancerEvidence(report.freelancers, teams, companies)),
            officeStaffPayrollService.loadYear(year).then(stored => salaryEvidence(year, [], stored)),
            loadMonthlyEvidence(periods, async period => cardEvidence(year, await cardService.getTransactionsByMonth(period))),
            loadMonthlyEvidence(periods, async period => lodgingEvidence(year, await accommodationService.getMonthlyLedger(period))),
        ]);
        const result: CorporateTaxSources = { evidence: [], errors: {}, warnings: [], missingSalaryMonths: [] };
        if (ledger.status === 'fulfilled') result.evidence.push(...ledger.value);
        else result.errors.ledger = `매입·매출 장부: ${describeCorporateTaxLoadError(ledger.reason)}`;
        if (labor.status === 'fulfilled') result.evidence.push(...labor.value);
        else result.errors.labor = `프리랜서 신고 자료: ${describeCorporateTaxLoadError(labor.reason)}`;
        if (salary.status === 'fulfilled') {
            result.evidence.push(...salary.value.rows);
            result.warnings.push(...salary.value.warnings);
            result.missingSalaryMonths = salary.value.missingMonths;
            result.unconfirmedSalaryMonths = salary.value.unconfirmedMonths;
        } else result.errors.salary = `사무실 직원 급여 자료: ${describeCorporateTaxLoadError(salary.reason)}`;
        if (card.status === 'fulfilled') {
            result.evidence.push(...card.value.evidence);
            if (card.value.error) {
                result.errors.card = `경비관리 카드사용 내역 · ${card.value.error}`;
                result.failedMonths = { ...result.failedMonths, card: card.value.failedMonths };
            }
        }
        else result.errors.card = `경비관리 카드사용 내역: ${describeCorporateTaxLoadError(card.reason)}`;
        if (lodging.status === 'fulfilled') {
            result.evidence.push(...lodging.value.evidence);
            if (lodging.value.error) {
                result.errors.lodging = `경비관리 숙소비용 내역 · ${lodging.value.error}`;
                result.failedMonths = { ...result.failedMonths, lodging: lodging.value.failedMonths };
            }
        }
        else result.errors.lodging = `경비관리 숙소비용 내역: ${describeCorporateTaxLoadError(lodging.reason)}`;
        return result;
    },
    async loadManual(year: number): Promise<CorporateTaxSaved> {
        assertYear(year);
        const snapshot = await getDoc(documentRef(year));
        if (!snapshot.exists()) return { manual: emptyManual(), revision: 0 };
        const data = snapshot.data();
        return { manual: validateManual(data.manual), revision: Number(data.revision) || 0 };
    },
    async saveManual(year: number, manual: CorporateTaxManual, expectedRevision: number): Promise<number> {
        assertYear(year);
        const safeManual = validateManual(manual);
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('로그인 후 다시 저장해 주세요.');
        return runTransaction(db, async transaction => {
            const ref = documentRef(year);
            const current = await transaction.get(ref);
            const revision = current.exists() ? Number(current.data().revision) || 0 : 0;
            if (revision !== expectedRevision) throw new Error('다른 화면에서 수기 자료가 변경되었습니다. 입력값을 별도로 보관하고 저장 자료를 다시 불러온 뒤 반영해 주세요.');
            const next = revision + 1;
            transaction.set(ref, { year, company: 'cheongyeon', manual: safeManual, revision: next, updatedAt: serverTimestamp(), updatedBy: uid });
            return next;
        });
    },
};
