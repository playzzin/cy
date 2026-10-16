import { getMessageRecipientUsers } from './messageRecipientDirectoryService';
import { getTeamScopedRows } from './teamScopedReadService';
import { userService } from './userService';

jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('./userService', () => ({ userService: { getAllUsers: jest.fn() } }));
beforeEach(() => jest.resetAllMocks());

it('팀장 수신자 조회는 제한된 디렉터리를 사용하고 전체 계정을 읽지 않는다', async () => {
    const rows = [{ uid: 'recipient', displayName: '수신자' }];
    (getTeamScopedRows as jest.Mock).mockResolvedValue(rows);
    expect(await getMessageRecipientUsers()).toEqual(rows);
    expect(getTeamScopedRows).toHaveBeenCalledWith('message_recipients');
    expect(userService.getAllUsers).not.toHaveBeenCalled();
});

it('제한된 조회가 거절되면 전체 계정 조회로 우회하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    await expect(getMessageRecipientUsers()).rejects.toThrow('permission-denied');
    expect(userService.getAllUsers).not.toHaveBeenCalled();
});

it('관리자는 기존 수신자 조회를 유지한다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
    (userService.getAllUsers as jest.Mock).mockResolvedValue([{ uid: 'admin-recipient' }]);
    expect(await getMessageRecipientUsers()).toEqual([{ uid: 'admin-recipient' }]);
});
