import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkerOffDutyRequestPage from './WorkerOffDutyRequestPage';
import { getRequestWorkers } from '../../services/requestWorkerService';
import { fieldScheduleRequestService } from '../../services/fieldScheduleRequestService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'leader', displayName: '신청 팀장' } }) }));
jest.mock('../../services/manpowerService', () => ({}));
jest.mock('../../services/requestWorkerService', () => ({ getRequestWorkers: jest.fn() }));
jest.mock('../../services/userService', () => ({ userService: { getUser: async () => ({ linkedWorkerIds: ['leader-worker'] }) } }));
jest.mock('../../services/fieldScheduleRequestService', () => ({
    fieldScheduleRequestService: { listByDateRange: jest.fn(), addOffDutyWorkers: jest.fn() },
    isOffDutyOnlyFieldScheduleRequest: () => true,
}));

it('소속 팀원을 선택하여 팀장 이름으로 휴무를 신청한다', async () => {
    (getRequestWorkers as jest.Mock).mockResolvedValue({ canRequestForTeam: true, workers: [
        { id: 'leader-worker', name: '신청 팀장', teamId: 'team-a' },
        { id: 'member-a', name: '팀원 테스트', teamId: 'team-a' },
    ] });
    (fieldScheduleRequestService.listByDateRange as jest.Mock).mockResolvedValue([]);
    (fieldScheduleRequestService.addOffDutyWorkers as jest.Mock).mockResolvedValue('saved');
    render(<MemoryRouter><WorkerOffDutyRequestPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /팀원 테스트/ }));
    fireEvent.click(screen.getByRole('button', { name: /휴무.*신청|선택.*등록/ }));
    await waitFor(() => expect(fieldScheduleRequestService.addOffDutyWorkers).toHaveBeenCalledWith(expect.objectContaining({
        workers: [{ id: 'member-a', name: '팀원 테스트' }], requestedById: 'leader', requestedByName: '신청 팀장',
    })));
});
