// Browser fixture only; no Firebase imports or real payroll writes.
import type { StoredMonthData } from '../../src/pages/payroll/officeStaffPayrollModel';
export const validatePayrollMonth = (value: StoredMonthData) => value;
export const officeStaffPayrollService = {
    async loadMonth(month: string) {
        if (localStorage.getItem('qa-payroll-read-error')) throw { code: 'unavailable' };
        return JSON.parse(localStorage.getItem(`qa-shared-payroll:${month}`) || 'null') || { data: null, revision: 0 };
    },
    async saveMonth(month: string, data: StoredMonthData, expectedRevision: number) {
        const saved = await this.loadMonth(month);
        if (saved.revision !== expectedRevision) throw new Error('다른 화면에서 이 월의 급여를 변경했습니다. 공용 자료를 다시 불러와 주세요.');
        const revision = saved.revision + 1;
        localStorage.setItem(`qa-shared-payroll:${month}`, JSON.stringify({ data, revision }));
        return revision;
    },
};
