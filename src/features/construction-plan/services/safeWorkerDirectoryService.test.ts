import { httpsCallable } from 'firebase/functions';
import {
  listSafeWorkerDirectoryEntries,
  SAFE_WORKER_DIRECTORY_CALLABLE,
} from './safeWorkerDirectoryService';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

describe('safeWorkerDirectoryService', () => {
  const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the server privacy boundary and parses only whitelist fields', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        siteId: 'site-1',
        responsibleTeamId: 'team-1',
        workers: [{
          id: 'worker-1',
          name: '가작업',
          role: '반장',
          position: '기능공',
          teamId: 'team-1',
          teamName: '시공팀',
          siteId: 'site-2',
          status: 'active',
        }],
      },
    });
    mockedHttpsCallable.mockReturnValue(invoke as never);

    const entries = await listSafeWorkerDirectoryEntries({
      siteId: 'site-1',
      responsibleTeamId: 'team-1',
    });

    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      SAFE_WORKER_DIRECTORY_CALLABLE,
    );
    expect(invoke).toHaveBeenCalledWith({
      siteId: 'site-1',
      responsibleTeamId: 'team-1',
    });
    expect(entries).toEqual([{
      id: 'worker-1',
      name: '가작업',
      role: '반장',
      position: '기능공',
      status: 'active',
      teamId: 'team-1',
      teamName: '시공팀',
      siteId: 'site-2',
    }]);
  });

  it('rejects a response for a different site', async () => {
    mockedHttpsCallable.mockReturnValue(jest.fn().mockResolvedValue({
      data: { siteId: 'site-2', workers: [] },
    }) as never);

    await expect(listSafeWorkerDirectoryEntries({ siteId: 'site-1' }))
      .rejects.toThrow('construction-plan-safe-worker-directory-invalid-response');
  });
});
