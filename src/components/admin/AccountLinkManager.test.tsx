import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
jest.mock('../../services/accountLinkService', () => ({ accountLinkService: { getAllLinks: jest.fn(), approveLink: jest.fn(), rejectLink: jest.fn() } }));

const users = [
    { uid: 'sample-user', displayName: '연결 사용자', email: 'sample@example.test', position: '일반', status: 'active', linkedWorkerIds: ['worker-1'] },
    { uid: 'pending-user', displayName: '대기 사용자', email: 'pending@example.test', status: 'pending' },
] as UserData[];
const workers = [{ id: 'worker-1', uid: 'sample-user', name: '예시 작업자', role: '일반' }] as Worker[];
const companies = [{ id: 'company-1', name: '예시 회사', type: '협력사' }] as Company[];
const links = [{ id: 'link-1', uid: 'pending-user', entityType: 'company', entityId: 'company-1', entityName: '예시 회사', entitySubType: '협력사', status: 'pending', relationRole: 'staff' }] as AccountLink[];
const previewData = { companies, officeStaff: [], links };

beforeEach(() => {
    jest.resetAllMocks();
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

it('승인 전용 화면은 요청을 바로 표시하고 사용자 목록과 연결 탭은 숨긴다', async () => {
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" approvalsOnly previewData={previewData} />);
    expect(await screen.findByRole('button', { name: '승인하고 연결' })).toBeDisabled();
    expect(screen.getByText('1건 표시 · 전체 1건')).toBeInTheDocument();
    expect(screen.queryByLabelText('계정 또는 연결 대상 검색')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '작업자' })).not.toBeInTheDocument();
    expect(screen.queryByText('현재 연결된 인원·회사')).not.toBeInTheDocument();
});

it('요청을 확인한 뒤 확정해야 승인하고 취소하면 서버를 호출하지 않는다', async () => {
    render(<AccountLinkManager users={users} workers={workers} approvalsOnly actorEmail="admin@example.test" />);
    fireEvent.click(await screen.findByRole('button', { name: '승인하고 연결' }));
    expect(screen.getByText('pending@example.test 계정을 예시 회사에 연결합니다.')).toBeInTheDocument();
    expect(screen.getByText('요청 사용자: 대기 사용자 · 연결 대상: 예시 회사 · 관계: 담당자')).toBeInTheDocument();
    expect(accountLinkService.approveLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('button', { name: '연결 확정' })).not.toBeInTheDocument();
    expect(accountLinkService.approveLink).not.toHaveBeenCalled();
});

it('승인 성공 안내를 표시하고 처리된 연결 요청을 목록에서 제거한다', async () => {
    const changed = jest.fn();
    const activeUsers = users.map((user) => ({ ...user, status: 'active' as const }));
    (accountLinkService.getAllLinks as jest.Mock).mockResolvedValueOnce(links).mockResolvedValue([{ ...links[0], status: 'active' }]);
    render(<AccountLinkManager users={activeUsers} workers={workers} approvalsOnly onChanged={changed} actorEmail="admin@example.test" />);
    fireEvent.click(await screen.findByRole('button', { name: '승인하고 연결' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 확정' }));
    expect(await screen.findByText('대기 사용자님의 예시 회사 연결을 승인했습니다.')).toBeInTheDocument();
    expect(await screen.findByText('승인 대기 요청이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('0건 표시 · 전체 0건')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인하고 연결' })).not.toBeInTheDocument();
    expect(accountLinkService.approveLink).toHaveBeenCalledWith(links[0], { email: 'admin@example.test' });
    expect(changed).toHaveBeenCalledTimes(1);
});

it('승인 실패 시 요청과 확정 버튼을 유지해 재시도할 수 있다', async () => {
    (accountLinkService.approveLink as jest.Mock).mockRejectedValueOnce(new Error('일시적인 연결 오류'));
    render(<AccountLinkManager users={users} workers={workers} approvalsOnly />);
    fireEvent.click(await screen.findByRole('button', { name: '승인하고 연결' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 확정' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('일시적인 연결 오류');
    expect(screen.getByRole('button', { name: '승인하고 연결' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '연결 확정' }));
    await waitFor(() => expect(accountLinkService.approveLink).toHaveBeenCalledTimes(2));
});

it('처리 중에는 중복 확정과 범위 변경을 막는다', async () => {
    let finishApproval: () => void = () => {};
    (accountLinkService.approveLink as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => { finishApproval = resolve; }));
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="pending-user" approvalsOnly />);
    fireEvent.click(await screen.findByRole('button', { name: '승인하고 연결' }));
    const confirm = screen.getByRole('button', { name: '연결 확정' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(accountLinkService.approveLink).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '처리 중' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '전체 요청 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '승인 요청 새로고침' })).toBeDisabled();
    expect(screen.getByLabelText('승인 요청 검색')).toBeDisabled();
    await act(async () => { finishApproval(); });
});

it('반려도 확인 후 사유와 함께 처리하고 성공 안내를 표시한다', async () => {
    (accountLinkService.getAllLinks as jest.Mock).mockResolvedValueOnce(links).mockResolvedValue([{ ...links[0], status: 'rejected' }]);
    render(<AccountLinkManager users={users} workers={workers} approvalsOnly actorEmail="admin@example.test" />);
    fireEvent.click(await screen.findByRole('button', { name: '반려하기' }));
    expect(accountLinkService.rejectLink).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/반려 사유/), { target: { value: '  회사 정보 확인 필요  ' } });
    fireEvent.click(screen.getByRole('button', { name: '반려 확정' }));
    expect(await screen.findByText('대기 사용자님의 예시 회사 연결 요청을 반려했습니다.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: '반려하기' })).not.toBeInTheDocument());
    expect(accountLinkService.rejectLink).toHaveBeenCalledWith(links[0], { email: 'admin@example.test' }, '회사 정보 확인 필요');
});

it('전체와 선택한 사용자 범위를 전환하고 검색 결과 없음과 대기 없음을 구분한다', async () => {
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" approvalsOnly initialPendingScope="selected" previewData={previewData} />);
    expect(await screen.findByText('선택한 사용자의 승인 대기 요청이 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 요청 1' }));
    expect(screen.getByRole('button', { name: '승인하고 연결' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('승인 요청 검색'), { target: { value: '검색결과없음' } });
    expect(screen.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('0건 표시 · 전체 1건')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검색 지우기' }));
    expect(screen.getByRole('button', { name: '승인하고 연결' })).toBeInTheDocument();
    expect(screen.getByText('1건 표시 · 전체 1건')).toBeInTheDocument();
});

it('연결 요청 없는 대기 계정을 중복 없이 포함하고 연결 대상 지정으로 이동한다', async () => {
    const manage = jest.fn();
    const orphan = { uid: 'orphan-user', displayName: '신규 대기 계정', email: 'orphan@example.test', status: 'pending' } as UserData;
    render(<AccountLinkManager users={[...users, orphan]} workers={workers} selectedUserId={orphan.uid} approvalsOnly onManageConnections={manage} previewData={previewData} />);
    const accessButton = await screen.findByRole('button', { name: '연결 대상 지정·승인' });
    expect(screen.getByText('2건 표시 · 전체 2건')).toBeInTheDocument();
    fireEvent.click(accessButton);
    expect(manage).toHaveBeenCalledWith(orphan.uid);
    fireEvent.click(screen.getByRole('button', { name: /선택 사용자 · 신규 대기 계정 1/ }));
    expect(screen.getByText('1건 표시 · 전체 2건')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인하고 연결' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('승인 요청 검색'), { target: { value: 'orphan@example.test' } });
    expect(screen.getByRole('button', { name: '연결 대상 지정·승인' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('승인 요청 검색'), { target: { value: 'pending@example.test' } });
    expect(screen.getByText('검색 조건에 맞는 승인 요청이 없습니다.')).toBeInTheDocument();
});

it('고정 사용자는 전체 범위를 요청해도 다른 사용자의 요청이나 대기 계정을 표시하지 않는다', async () => {
    render(<AccountLinkManager users={users} workers={workers} lockedUserId="sample-user" approvalsOnly initialPendingScope="all" previewData={previewData} />);
    expect(await screen.findByText('선택한 사용자의 승인 대기 요청이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('0건 표시 · 전체 0건')).toBeInTheDocument();
    expect(screen.queryByText('pending@example.test')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체 요청/ })).not.toBeInTheDocument();
});

it('대기 중인 고정 사용자의 요청만 표시한다', async () => {
    const otherLink = { ...links[0], id: 'other-link', uid: 'sample-user', entityName: '다른 회사' } as AccountLink;
    const orphan = { uid: 'other-pending', displayName: '다른 대기 계정', status: 'pending' } as UserData;
    render(<AccountLinkManager users={[...users, orphan]} workers={workers} lockedUserId="pending-user" approvalsOnly previewData={{ ...previewData, links: [...links, otherLink] }} />);
    expect(await screen.findByRole('button', { name: '승인하고 연결' })).toBeInTheDocument();
    expect(screen.getByText('1건 표시 · 전체 1건')).toBeInTheDocument();
    expect(screen.queryByText('다른 회사')).not.toBeInTheDocument();
    expect(screen.queryByText('다른 대기 계정')).not.toBeInTheDocument();
});

it('선택 사용자 인자가 변경되면 새 사용자의 승인 요청으로 범위를 맞춘다', async () => {
    const { rerender } = render(<AccountLinkManager users={users} workers={workers} selectedUserId="pending-user" approvalsOnly initialPendingScope="selected" previewData={previewData} />);
    expect(await screen.findByRole('button', { name: '승인하고 연결' })).toBeInTheDocument();
    rerender(<AccountLinkManager users={users} workers={workers} selectedUserId="sample-user" approvalsOnly initialPendingScope="selected" previewData={previewData} />);
    expect(screen.getByText('선택한 사용자의 승인 대기 요청이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인하고 연결' })).not.toBeInTheDocument();
});

it('계정 연결 화면에서는 대기 계정의 연결 대상 지정 버튼으로 작업자 연결 탭을 연다', async () => {
    const select = jest.fn();
    render(<AccountLinkManager users={users} workers={workers} selectedUserId="pending-user" onSelectUser={select} previewData={{ ...previewData, links: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: '전체 승인 요청 1' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 대상 지정·승인' }));
    expect(select).toHaveBeenCalledWith('pending-user');
    expect(screen.getByRole('button', { name: '작업자' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '연결 대상 지정·승인' })).not.toBeInTheDocument();
});

it('연결 조회 실패 시 대기 계정을 연결 없는 요청으로 오분류하지 않고 재시도 후 목록을 표시한다', async () => {
    const manage = jest.fn();
    (accountLinkService.getAllLinks as jest.Mock).mockRejectedValueOnce(new Error('sample read failure')).mockResolvedValue(links);
    render(<AccountLinkManager users={users} workers={workers} approvalsOnly onManageConnections={manage} />);
    expect(await screen.findByText('연결 정보를 확인할 수 없어 승인 요청을 표시하지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '연결 대상 지정·승인' })).not.toBeInTheDocument();
    expect(screen.queryByText(/건 표시 · 전체/)).not.toBeInTheDocument();
    expect(screen.queryByText('승인 대기 요청이 없습니다.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인하고 연결' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByRole('button', { name: '승인하고 연결' })).toBeInTheDocument();
    expect(screen.getByText('1건 표시 · 전체 1건')).toBeInTheDocument();
    expect(manage).not.toHaveBeenCalled();
});

it('요청 직책을 서버가 적용할 직책으로 단정하지 않는다', async () => {
    const officeRequest = { ...links[0], entityType: 'office', entitySubType: '사무실', entityId: 'new_office', requestedEntity: { role: '총괄' } } as AccountLink;
    (accountLinkService.getAllLinks as jest.Mock).mockResolvedValue([officeRequest]);
    render(<AccountLinkManager users={users} workers={workers} approvalsOnly />);
    fireEvent.click(await screen.findByRole('button', { name: '승인하고 연결' }));
    expect(screen.getByText('요청 직책: 총괄')).toBeInTheDocument();
    expect(screen.queryByText('적용 직책: 총괄')).not.toBeInTheDocument();
    expect(accountLinkService.approveLink).not.toHaveBeenCalled();
});
