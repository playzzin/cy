import { buildSupportClientLaborPreviews, buildSupportRows } from './SupportClientSiteModel';
import type { Worker } from '../../services/manpowerService';
import type { DailyReport } from '../../services/dailyReportService';
import type { Team } from '../../services/teamService';

jest.mock('html2canvas', () => jest.fn());

const worker: Worker = {
    id: 'test-worker', name: '가상작업자',
    bankName: '기본은행', accountNumber: 'BASIC-ACCOUNT', accountHolder: '기본예금주',
    directPayBankName: '직불은행', directPayAccountNumber: '000-DIRECT', directPayAccountHolder: '직불예금주',
};
const reports = [{
    id: 'test-report', date: '2026-10-01', siteId: 'test-site', siteName: '가상현장',
    constructorCompanyName: '청연', teamId: 'test-team', teamName: '가상팀',
    workers: [{ workerId: worker.id, name: worker.name, manDay: 1, unitPrice: 100000 }],
}] as DailyReport[];
const teams = [{ id: 'test-team', name: '가상팀', companyName: '청연' }] as Team[];

it.each([
    [worker, { bankName: '직불은행', accountNumber: '000-DIRECT', accountHolder: '직불예금주' }],
    [{ ...worker, directPayBankName: undefined, directPayAccountNumber: undefined, directPayAccountHolder: undefined }, { bankName: '', accountNumber: '', accountHolder: '' }],
    [{ ...worker, directPayAccountNumber: undefined, directPayAccountHolder: undefined }, { bankName: '직불은행', accountNumber: '', accountHolder: '' }],
])('작업자 DB에서 협력사 명세서까지 직불용 계좌만 전달한다 (%#)', (profile, expected) => {
    const rows = buildSupportRows(reports, teams, [], [], [], [profile]);
    expect(rows).toHaveLength(1);
    const direct = buildSupportClientLaborPreviews(rows);
    expect(direct).toHaveLength(1);
    expect(direct[0].rows[0]).toMatchObject({ payType: 'direct', ...expected });
    const delegate = buildSupportClientLaborPreviews(rows, {}, {}, {
        unitPriceOverride: 0, defaultPayType: 'delegate', workerPayTypes: {},
        delegateBankName: '위임은행', delegateAccountHolder: '위임예금주', delegateAccountNumber: 'DELEGATE-ACCOUNT',
    });
    expect(delegate[0].rows[0]).toMatchObject({
        payType: 'delegate', bankName: '위임은행', accountHolder: '위임예금주', accountNumber: 'DELEGATE-ACCOUNT',
    });
    expect(buildSupportClientLaborPreviews(rows)[0].rows[0]).toMatchObject(expected);
});
