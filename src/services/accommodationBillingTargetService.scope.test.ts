import { getDocs } from 'firebase/firestore';
import { accommodationBillingTargetService } from './accommodationBillingTargetService';
import { getTeamScopedRows } from './teamScopedReadService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('firebase/firestore', () => ({ getDocs: jest.fn() }));

it('팀장 숙소 청구대상은 서버 범위 조회로 읽고 전체 목록을 요청하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue([
        { id: 'own', accommodationId: 'house-a', targetType: 'team', teamId: 'team-a' },
        { id: 'another-house', accommodationId: 'house-b', targetType: 'team', teamId: 'team-a' },
    ]);
    const rows = await accommodationBillingTargetService.listTargetsByAccommodationId('house-a');
    expect(rows.map(row => row.id)).toEqual(['own']);
    expect(getTeamScopedRows).toHaveBeenCalledWith('accommodation_billing_targets');
    expect(getDocs).not.toHaveBeenCalled();
});

it('팀 조회 실패를 빈 청구대상 목록으로 숨기지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('unavailable'));
    await expect(accommodationBillingTargetService.listTargets()).rejects.toThrow('unavailable');
    expect(getDocs).not.toHaveBeenCalled();
});
