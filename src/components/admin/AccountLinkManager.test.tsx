import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AccountLinkManager from './AccountLinkManager';
import type { UserData } from '../../services/userService';
import type { Worker } from '../../services/manpowerService';
import type { Company } from '../../services/companyService';
import type { AccountLink } from '../../types/accountLink';
import { accountLinkService } from '../../services/accountLinkService';
import { companyService } from '../../services/companyService';
import { officeStaffService } from '../../services/officeStaffService';

jest.mock('../../services/userService', () => ({ userService: {} }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: {} }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn() } }));
jest.mock('../../services/accountLinkService', () => ({ accountLinkService: { getAllLinks: jest.fn(), approveLink: jest.fn() } }));

const users = [
    { uid: 'sample-user', displayName: '연결 사용자', email: 'sample@example.test', position: '일반', status: 'active', linkedWorkerIds: ['worker-1'] },
    { uid: 'pending-user', displayName: '대기 사용자', email: 'pending@example.test', status: 'pending' },
] as UserData[];
const workers = [{ id: 'worker-1', uid: 'sample-user', name: '예시 작업자', role: '일반' }] as Worker[];
const companies = [{ id: 'company-1', name: '예시 회사', type: '협력사' }] as Company[];
const links = [{ id: 'link-1', uid: 'pending-user', entityType: 'company', entityId: 'company-1', entityName: '예시 회사', entitySubType: '협력사', status: 'pending', relationRole: 'staff' }] as AccountLink[];
const previewData = { companies, officeStaff: [], links };

beforeEach(() => {
    jest.clearAllMocks();
    (companyService.getCompanies as jest.Mock).mockResolvedValue(companies);
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (accountLinkService.getAllLinks as jest.Mock).mockResolvedValue(links);
});

it('연결된 대상 이름을 표시하고 이름으로 검색한다', async () => {
    const select = jest.fn();
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" onSelectUser={select} previewData={previewData} />);
    await screen.findByRole('button', { name: /연결 사용자 사용 가능 sample@example.test 일반 작업자 예시 작업자/ });
    fireEvent.change(screen.getByLabelText('계정 또는 연결 대상 검색'), { target: { value: '예시 회사' } });
    expect(screen.getByRole('button', { name: /대기 사용자.*예시 회사/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /연결 사용자 사용 가능 sample@example.test 일반 작업자 예시 작업자/ })).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
});

it('승인 대기 중인 회사 연결을 연결 완료 필터에 포함하지 않는다', async () => {
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" previewData={previewData} />);
    await screen.findByRole('button', { name: /대기 사용자.*예시 회사/ });
    fireEvent.click(screen.getByRole('button', { name: '연결됨' }));
    expect(screen.queryByRole('button', { name: /대기 사용자.*예시 회사/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '미연결' }));
    expect(screen.getByRole('button', { name: /대기 사용자.*예시 회사/ })).toBeInTheDocument();
});

it('권한 설정으로 선택 계정을 전달하고 샘플 모드에서는 서버를 읽거나 연결을 변경하지 않는다', async () => {
    const manage = jest.fn();
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" onManageAccess={manage} previewData={previewData} />);
    await screen.findByRole('button', { name: '직책·권한 설정 →' });
    fireEvent.click(screen.getByRole('button', { name: '직책·권한 설정 →' }));
    expect(manage).toHaveBeenCalledWith('sample-user');
    expect(screen.getByRole('button', { name: '예시 작업자 연결 해제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '연결' })).toBeDisabled();
    expect(accountLinkService.getAllLinks).not.toHaveBeenCalled();
    expect(companyService.getCompanies).not.toHaveBeenCalled();
});

it('메타데이터 조회가 실패하면 새로고침 안내를 표시한다', async () => {
    (accountLinkService.getAllLinks as jest.Mock).mockRejectedValue(new Error('sample read failure'));
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" />);
    expect(await screen.findByText('연결 정보를 불러오지 못했습니다. 새로고침을 눌러 다시 시도해 주세요.')).toBeInTheDocument();
});
