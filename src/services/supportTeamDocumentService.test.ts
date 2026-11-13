import { httpsCallable } from 'firebase/functions';
import { supportTeamDocumentService } from './supportTeamDocumentService';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'tester' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

const read = jest.fn();
const revision = 'a'.repeat(64);
const part = (base64: string, offset: number, revisionId = revision) => ({ data: {
    photo: { base64, offset, size: 4, revision: revisionId, contentType: 'image/png' },
} });
beforeEach(() => {
    read.mockReset();
    (httpsCallable as jest.Mock).mockReturnValue(read);
});

test('같은 원본의 모든 조각을 순서대로 이어 붙인 후에만 사진을 반환한다', async () => {
    read.mockResolvedValueOnce(part('AQI=', 0)).mockResolvedValueOnce(part('AwQ=', 2));
    const file = await supportTeamDocumentService.read('worker', 'identity', '가상 작업자');
    expect(read.mock.calls.map(([request]) => request)).toEqual([
        { action: 'read', workerId: 'worker', kind: 'identity', offset: 0 },
        { action: 'read', workerId: 'worker', kind: 'identity', offset: 2, revision },
    ]);
    const result = await new Promise<ArrayBuffer>(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(file!);
    });
    expect([...new Uint8Array(result)]).toEqual([1, 2, 3, 4]);
});

test.each([['경로 변경', part('AwQ=', 2, 'b'.repeat(64))], ['조각 누락', part('AwQ=', 3)], ['원본 삭제', { data: { photo: null } }]])(
    '%s 시 불완전한 신분증을 반환하지 않는다', async (_, next) => {
        read.mockResolvedValueOnce(part('AQI=', 0)).mockResolvedValueOnce(next);
        await expect(supportTeamDocumentService.read('worker', 'identity', '가상')).rejects.toThrow('image-transfer-incomplete');
    });

test('전체 사진을 반환하는 이전 서버와도 호환된다', async () => {
    read.mockResolvedValueOnce({ data: { photo: { base64: 'AQID', contentType: 'image/jpeg' } } });
    const file = await supportTeamDocumentService.read('worker', 'identity', '가상');
    expect(file?.size).toBe(3);
    expect(file?.name).toBe('가상.jpg');
});

test('퇴사자 포함 조건을 명단과 신분증의 모든 조각 및 통장사본 조회에 전달한다', async () => {
    read.mockResolvedValueOnce({ data: { workers: [] } });
    await supportTeamDocumentService.list(undefined, true);
    expect(read).toHaveBeenLastCalledWith({ action: 'list', includeRetired: true });
    read.mockResolvedValueOnce(part('AQI=', 0)).mockResolvedValueOnce(part('AwQ=', 2));
    await supportTeamDocumentService.read('retired', 'identity', '가상 퇴사자', undefined, true);
    expect(read.mock.calls.slice(1).every(([request]) => request.includeRetired === true)).toBe(true);
    read.mockResolvedValueOnce({ data: { photo: { base64: 'AQID', contentType: 'image/png' } } });
    await supportTeamDocumentService.read('retired', 'directPayBank', '가상 퇴사자', undefined, true);
    expect(read).toHaveBeenLastCalledWith({ action: 'read', workerId: 'retired', kind: 'directPayBank', includeRetired: true });
});
