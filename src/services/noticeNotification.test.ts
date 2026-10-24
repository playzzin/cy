import { Timestamp, getDoc } from 'firebase/firestore';
import { systemMessageService } from './systemMessageService';
import { messageService } from './messageService';
import { userService } from './userService';
import { auditService } from './auditService';
import { manpowerService } from './manpowerService';
import { teamService } from './teamService';

const mockSettings = { enabled: true, recipientScope: 'all', recipientIds: [] as string[], events: { 'notice.created': { enabled: true, recipientRule: { mode: 'allUsers' } } } };
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ ...jest.requireActual('firebase/firestore'), doc: jest.fn(), getDoc: jest.fn(async () => ({ exists: () => true, data: () => mockSettings })) }));
jest.mock('./messageService', () => ({ messageService: { createMessage: jest.fn(async () => 'message') } }));
jest.mock('./userService', () => ({ userService: { getAllUsers: jest.fn() } }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(async () => []) } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn(async () => []) } }));
jest.mock('./auditService', () => ({ auditService: { log: jest.fn(async () => undefined) } }));

const notice = { id: 'safety', title: '안전 공지', body: '확인해 주세요.', targetPositions: ['팀장'], category: '안전', priority: 'urgent' as const, pinned: false, expiresAt: Timestamp.fromMillis(9000000) };
const actor = { uid: 'author', name: '작성자' };
beforeEach(() => {
    jest.clearAllMocks(); mockSettings.enabled = true; mockSettings.events['notice.created'].enabled = true;
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => mockSettings });
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([]);
    (messageService.createMessage as jest.Mock).mockResolvedValue('message');
    (auditService.log as jest.Mock).mockResolvedValue(undefined);
    (userService.getAllUsers as jest.Mock).mockResolvedValue([
        { uid: 'leader', displayName: '팀장', status: 'active', position: '팀장' },
        { uid: 'worker', displayName: '작업자', status: 'active', position: '작업자' },
        { uid: 'disabled', displayName: '중지', status: 'suspended', position: '팀장' }
    ]);
});

it('intersects configured recipients with target positions and excludes inactive accounts', async () => {
    expect(await systemMessageService.notifyNoticeCreatedEvent(notice, actor)).toBe('sent');
    expect(messageService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'direct', senderId: 'author', recipientScope: 'users', recipientIds: ['leader'],
        actionUrl: '/notices?noticeId=safety', priority: 'urgent', expiresAt: notice.expiresAt
    }));
});

it('reports disabled notifications without sending anything', async () => {
    mockSettings.events['notice.created'].enabled = false;
    expect(await systemMessageService.notifyNoticeCreatedEvent(notice, actor)).toBe('disabled');
    expect(messageService.createMessage).not.toHaveBeenCalled();
});

it('reports unmatched audiences without broadcasting', async () => {
    expect(await systemMessageService.notifyNoticeCreatedEvent({ ...notice, targetPositions: ['CEO'] }, actor)).toBe('no-recipients');
    expect(messageService.createMessage).not.toHaveBeenCalled();
});

it('reports delivery failure separately from saving the notice', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (messageService.createMessage as jest.Mock).mockRejectedValue(new Error('offline'));
    expect(await systemMessageService.notifyNoticeCreatedEvent(notice, actor)).toBe('failed');
    warning.mockRestore();
});

it('does not report delivery failure when only the audit log fails', async () => {
    (auditService.log as jest.Mock).mockRejectedValue(new Error('log unavailable'));
    expect(await systemMessageService.notifyNoticeCreatedEvent(notice, actor)).toBe('sent');
});
