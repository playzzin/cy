import { taskService } from './taskService';
import { Task } from '../types/task';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';

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
