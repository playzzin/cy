import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import IntegratedMassUploader from './IntegratedMassUploader';
import { companyService } from '../../services/companyService';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { MASTER_DEFINITIONS, MASTER_TYPES, emptyMasterSnapshot, planMasterImport } from './masterDataImport';
import { readIntegratedWorkbook, WorkbookSection } from './integratedWorkbook';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-user' } }) }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn(async () => []), addCompany: jest.fn(async () => 'company-1'), updateCompany: jest.fn(async () => undefined) } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn(async () => []), addTeam: jest.fn(async () => 'team-1'), updateTeam: jest.fn(async () => undefined) } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn(async () => []), addSite: jest.fn(async () => 'site-1'), updateSite: jest.fn(async () => undefined) } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(async () => []), addWorker: jest.fn(async () => 'worker-1'), updateWorker: jest.fn(async () => undefined) } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn(async () => []), addOfficeStaff: jest.fn(async () => 'staff-1'), updateOfficeStaff: jest.fn(async () => undefined) } }));
jest.mock('../../services/settlementTargetService', () => ({ settlementTargetService: { getTargets: jest.fn(async () => []), addTarget: jest.fn(async () => 'target-1'), updateTarget: jest.fn(async () => undefined) } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getAllReports: jest.fn(async () => []), getReportsByRange: jest.fn(async () => []), addReport: jest.fn(async () => 'report-1') } }));
jest.mock('../../services/dailyReportTransferService', () => ({ dailyReportTransferService: {} }));
jest.mock('../../services/backupService', () => ({ resetCollection: jest.fn() }));
jest.mock('../../services/companyFirestoreService', () => ({ companyFirestoreService: { getCompanies: () => jest.requireMock('../../services/companyService').companyService.getCompanies() } }));
jest.mock('../../services/teamFirestoreService', () => ({ teamFirestoreService: { getTeams: () => jest.requireMock('../../services/teamService').teamService.getTeams() } }));
jest.mock('../../services/siteFirestoreService', () => ({ siteFirestoreService: { getSites: () => jest.requireMock('../../services/siteService').siteService.getSites() } }));
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn(async () => ({ isConfirmed: true })) } }));

const upload = (sheets: Record<string, unknown[][]>) => {
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name));
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    fireEvent.change(screen.getByLabelText('통합 엑셀 파일'), { target: { files: [{ name: 'test.xlsx', arrayBuffer: async () => bytes }] } });
};

beforeEach(() => {
    jest.clearAllMocks();
    (Swal.fire as jest.Mock).mockResolvedValue({ isConfirmed: true });
    for (const [module, service, prefix] of [
        ['companyService', 'companyService', 'company'], ['teamService', 'teamService', 'team'],
        ['siteService', 'siteService', 'site'], ['manpowerService', 'manpowerService', 'worker'],
        ['officeStaffService', 'officeStaffService', 'staff'], ['settlementTargetService', 'settlementTargetService', 'target'],
        ['dailyReportService', 'dailyReportService', 'report'],
    ]) {
        const methods = jest.requireMock(`../../services/${module}`)[service] as Record<string, jest.Mock>;
        Object.entries(methods).forEach(([name, method]) => method.mockResolvedValue(name.startsWith('get') ? [] : name.startsWith('add') ? `${prefix}-1` : undefined));
    }
});

test('upload, preview, confirmation and persistence share the complete DB payload', async () => {
    render(<IntegratedMassUploader />);
    upload({ 회사: [['회사명', '구분', '이메일', '계좌번호'], ['예시회사', '시공사', 'office@example.com', '000123']], 팀: [['팀명', '회사명', '은행명'], ['예시팀', '예시회사', '예시은행']], 작업자: [['이름', '소속팀', '이메일', '혈액형', '상태'], ['예시작업자', '예시팀', 'worker@example.com', 'A형', '휴직']] });
    expect(await screen.findByText('데이터 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록 시작' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '등록 시작' }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('완료', expect.any(String), 'success'));
    expect(companyService.addCompany).toHaveBeenCalledWith(expect.objectContaining({ email: 'office@example.com', accountNumber: '000123' }));
    expect(teamService.updateTeam).toHaveBeenCalledWith('team-1', expect.objectContaining({ companyId: 'company-1', companyName: '예시회사' }));
    expect(manpowerService.addWorker).toHaveBeenCalledWith(expect.objectContaining({ email: 'worker@example.com', bloodType: 'A', status: '휴직' }));
    expect(manpowerService.updateWorker).toHaveBeenCalledWith('worker-1', expect.objectContaining({ teamId: 'team-1', companyId: 'company-1', companyName: '예시회사' }));
    expect(screen.getByRole('link', { name: /통합 DB에서 등록 결과 확인/ })).toHaveAttribute('href', '/database/manpower-db');
});

test('unknown populated columns stay visible and prevent all registration', async () => {
    render(<IntegratedMassUploader />);
    upload({ 작업자: [['이름', '누락될항목'], ['예시', '값']] });
    expect(await screen.findByRole('alert')).toHaveTextContent('인식하지 못한 열: 누락될항목');
    expect(screen.getByRole('button', { name: '등록 시작' })).toBeDisabled();
    expect(companyService.addCompany).not.toHaveBeenCalled();
    expect(manpowerService.addWorker).not.toHaveBeenCalled();
});

test('existing daily-report workbook aliases still work with newly created master entities', async () => {
    render(<IntegratedMassUploader />);
    upload({
        팀: [['팀명'], ['예시팀']],
        현장: [['현장명', '해당팀', '현장구분', '결제구분'], ['예시현장', '예시팀', '도급', '계산서']],
        작업자: [['이름', '소속팀', '단가'], ['예시작업자', '예시팀', '150000']],
        일보목록V2: [['날짜', '현장', '현장소속팀', '이름', '공수', '비고'], ['2026-09-14', '예시현장', '예시팀', '예시작업자', '1', '예시작업']],
    });
    await screen.findByText('데이터 미리보기');
    expect(screen.getByRole('button', { name: '등록 시작' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '등록 시작' }));
    await waitFor(() => expect(dailyReportService.addReport).toHaveBeenCalledWith(expect.objectContaining({
        date: '2026-09-14', siteId: 'site-1', teamId: 'team-1',
        workers: [expect.objectContaining({ workerId: 'worker-1', unitPrice: 150000, manDay: 1, workContent: '예시작업' })],
    })));
});

test('a changed DB identity after preview prevents stale registration', async () => {
    render(<IntegratedMassUploader />);
    upload({ 작업자: [['이름', '이메일'], ['예시', 'worker@example.com']] });
    await screen.findByText('데이터 미리보기');
    (manpowerService.getWorkers as jest.Mock).mockResolvedValueOnce([{ id: 'concurrent-worker', name: '예시' }]);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: '등록 시작' }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('등록 중단', expect.stringContaining('다시 분석'), 'error'));
    expect(manpowerService.addWorker).not.toHaveBeenCalled();
    expect(manpowerService.updateWorker).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
});

test('blank and sample templates include all six entity sheets, and master sample rows validate', async () => {
    const write = jest.spyOn(XLSX, 'writeFile').mockImplementation(() => undefined);
    render(<IntegratedMassUploader />);
    fireEvent.click(screen.getByRole('button', { name: '전체 항목 빈 양식 다운로드' }));
    expect(write).toHaveBeenCalledTimes(1);
    const blank = write.mock.calls[0][0];
    for (const type of MASTER_TYPES) {
        const definition = MASTER_DEFINITIONS[type];
        const matrix = XLSX.utils.sheet_to_json(blank.Sheets[definition.sheetName], { header: 1 });
        expect(matrix).toEqual([definition.fields.map(field => field.label)]);
    }
    fireEvent.click(screen.getByRole('button', { name: '샘플 양식 다운로드' }));
    const sample = write.mock.calls[1][0];
    const sections = Object.fromEntries(MASTER_TYPES.map(type => [type, { ...MASTER_DEFINITIONS[type], name: MASTER_DEFINITIONS[type].sheetName }])) as unknown as Record<typeof MASTER_TYPES[number], WorkbookSection>;
    const parsed = readIntegratedWorkbook(sample, sections);
    const plan = planMasterImport(parsed.data, emptyMasterSnapshot());
    expect(MASTER_TYPES.flatMap(type => plan[type].filter(r => r.status === 'CONFLICT').map(r => r.changes))).toEqual([]);
    write.mockRestore();
});
