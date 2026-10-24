import { userService } from './userService';
import { userFirestoreService } from './userFirestoreService';
import type { User } from 'firebase/auth';

jest.mock('./userFirestoreService', () => ({ userFirestoreService: { getUser: jest.fn(), saveUser: jest.fn() } }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({}));

beforeEach(() => jest.clearAllMocks());
it('재로그인 시 직접 수정한 이름을 로그인 제공자 이름으로 덮어쓰지 않는다', async () => {
    (userFirestoreService.getUser as jest.Mock).mockResolvedValue({ displayName: '직접 수정한 이름', status: 'active', accountType: 'worker' });
    await userService.saveUser({ uid: 'test-user', email: 'test@example.test', displayName: '제공자 이름', photoURL: null } as User);
    expect(userFirestoreService.saveUser).toHaveBeenCalledWith('test-user', expect.objectContaining({ displayName: '직접 수정한 이름' }));
});
it('처음 가입하는 계정에는 로그인 제공자의 이름을 사용한다', async () => {
    (userFirestoreService.getUser as jest.Mock).mockResolvedValue(null);
    await userService.saveUser({ uid: 'new-user', email: 'new@example.test', displayName: '가입자', photoURL: null } as User);
    expect(userFirestoreService.saveUser).toHaveBeenCalledWith('new-user', expect.objectContaining({ displayName: '가입자', status: 'pending' }));
});
