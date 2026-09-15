import { taskService } from './taskService';
import { Task } from '../types/task';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { runTransaction } from 'firebase/firestore';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({
    isDevAdminSessionEnabled: jest.fn(() => true),
}));
jest.mock('./firestoreRepository', () => ({
    createCollectionRepository: jest.fn(() => ({
        getById: jest.fn(),
        list: jest.fn(),
        clearCache: jest.fn(),
        subscribe: jest.fn(),
    })),
}));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    runTransaction: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
}));

const mockedIsDevAdminSessionEnabled = isDevAdminSessionEnabled as jest.MockedFunction<
    typeof isDevAdminSessionEnabled
>;

const createTask = (overrides: Partial<Omit<Task, 'id'>> = {}): Omit<Task, 'id'> => ({
    title: '개발 요청 테스트',
    description: '로컬 개발자 모드에서 저장됩니다.',
    assignee: '개발자 관리자',
    createdBy: '검증 사용자',
    priority: '보통',
    status: '요청',
    dueDate: '',
    createdAt: '2026-08-28T01:00:00.000Z',
    comments: [],
    ...overrides,
});

describe('taskService 개발자 관리자 모드', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedIsDevAdminSessionEnabled.mockReturnValue(true);
        window.localStorage.clear();
    });

    it('오래된 상태 변경 요청을 거부한다', async () => {
        const id = await taskService.addTask(createTask({ status: '진행' }));
        const comment = { id: 1, user: '검증', text: '확인 요청', time: '12:00', isSystem: true };
        await taskService.transitionTask(id, '진행', '완료', comment);
        await expect(taskService.transitionTask(id, '진행', '완료', comment)).rejects.toThrow('다른 사용자가');
        expect((await taskService.getTask(id))?.comments).toHaveLength(1);
    });

    it('서버의 최신 댓글을 유지하면서 상태를 함께 저장한다', async () => {
        mockedIsDevAdminSessionEnabled.mockReturnValue(false);
        const existing = { id: 1, user: '검증', text: '동시 등록된 댓글', time: '12:00', isSystem: false };
        const comment = { ...existing, id: 2, text: '확인 안내' };
        const transaction = { get: jest.fn().mockResolvedValue({ exists: () => true, data: () => createTask({ status: '진행', comments: [existing] }) }), update: jest.fn() };
        (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
        await taskService.transitionTask('task', '진행', '완료', comment, { assignee: '요청자' });
        expect(transaction.update).toHaveBeenCalledWith(undefined, expect.objectContaining({ status: '완료', assignee: '요청자', comments: [existing, comment] }));
    });

    it('요청을 로컬에 저장하고 실시간 구독자에게 알린다', async () => {
        const listener = jest.fn();
        const unsubscribe = taskService.subscribe(listener);

        const id = await taskService.addTask(createTask());
        const stored = await taskService.getTask(id);

        expect(listener).toHaveBeenNthCalledWith(1, []);
        expect(listener).toHaveBeenLastCalledWith([expect.objectContaining({ id, title: '개발 요청 테스트' })]);
        expect(stored).toEqual(expect.objectContaining({ id, status: '요청' }));

        unsubscribe();
    });

    it('상태 변경, 댓글 추가, 삭제를 Firebase 없이 처리한다', async () => {
        const id = await taskService.addTask(createTask());

        await taskService.updateTask(id, { status: '진행' });
        await taskService.addComment(id, {
            user: '개발자 관리자',
            text: '작업을 시작했습니다.',
            time: '오전 10:00',
            isSystem: false,
        });

        expect(await taskService.getTask(id)).toEqual(expect.objectContaining({
            status: '진행',
            comments: [expect.objectContaining({ text: '작업을 시작했습니다.' })],
        }));

        await taskService.deleteTask(id);
        expect(await taskService.getTasks()).toEqual([]);
    });

    it('최근 요청을 최신순으로 제한한다', async () => {
        await taskService.addTask(createTask({ title: '이전 요청', createdAt: '2026-08-27T01:00:00.000Z' }));
        await taskService.addTask(createTask({ title: '최신 요청', createdAt: '2026-08-28T01:00:00.000Z' }));

        const listener = jest.fn();
        const unsubscribe = taskService.subscribeRecent(listener, 1);

        expect(listener).toHaveBeenCalledWith([
            expect.objectContaining({ title: '최신 요청' }),
        ]);

        unsubscribe();
    });
});
