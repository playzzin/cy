import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, runTransaction, where, orderBy, limit as queryLimit, Unsubscribe, FirestoreError } from 'firebase/firestore';
import { Task, TaskComment } from '../types/task';
import { createCollectionRepository } from './firestoreRepository';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';

const COLLECTION_NAME = 'tasks';
const DEV_TASK_STORAGE_KEY = 'cy_dev_admin_tasks_v1';
const taskRepository = createCollectionRepository<Task>({ collectionName: COLLECTION_NAME });
const devTaskSubscribers = new Set<(tasks: Task[]) => void>();

const readDevTasks = (): Task[] => {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(DEV_TASK_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed as Task[] : [];
    } catch (error) {
        console.warn('[taskService] 개발 요청 데이터를 읽지 못했습니다.', error);
        return [];
    }
};

const publishDevTasks = (tasks: Task[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DEV_TASK_STORAGE_KEY, JSON.stringify(tasks));
    devTaskSubscribers.forEach(callback => callback(tasks));
};

const createDevTaskId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `dev-task-${crypto.randomUUID()}`;
    }
    return `dev-task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getDevTask = (taskId: string) => readDevTasks().find(task => task.id === taskId) || null;

const updateDevTask = (taskId: string, updates: Partial<Task>) => {
    const tasks = readDevTasks();
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex < 0) throw new Error('task-not-found');
    const nextTasks = [...tasks];
    nextTasks[taskIndex] = { ...nextTasks[taskIndex], ...updates };
    publishDevTasks(nextTasks);
};

export const taskService = {
    async transitionTask(taskId: string, expectedStatus: Task['status'], status: Task['status'], comment: TaskComment, extra: Pick<Partial<Task>, 'assignee' | 'review'> = {}): Promise<void> {
        const makeUpdates = (current: Task): Partial<Task> => {
            if (current.status !== expectedStatus) throw new Error('다른 사용자가 진행 상태를 변경했습니다. 최신 내용을 확인한 뒤 다시 진행해 주세요.');
            return { ...extra, status, comments: [...(current.comments || []), comment] };
        };
        if (isDevAdminSessionEnabled()) {
            const current = getDevTask(taskId);
            if (!current) throw new Error('요청을 찾을 수 없습니다.');
            updateDevTask(taskId, makeUpdates(current));
            return;
        }
        await runTransaction(db, async transaction => {
            const ref = doc(db, COLLECTION_NAME, taskId);
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error('요청을 찾을 수 없습니다.');
            transaction.update(ref, makeUpdates(snapshot.data() as Task));
        });
        taskRepository.clearCache();
    },
    // Get single task
    async getTask(taskId: string): Promise<Task | null> {
        if (isDevAdminSessionEnabled()) return getDevTask(taskId);
        return taskRepository.getById(taskId);
    },

    // Get all tasks
    async getTasks(): Promise<Task[]> {
        if (isDevAdminSessionEnabled()) return readDevTasks();
        return taskRepository.list([], { cacheKey: 'all' });
    },

    // Get tasks by assignee
    async getTasksByAssignee(assignee: string): Promise<Task[]> {
        if (isDevAdminSessionEnabled()) {
            return readDevTasks()
                .filter(task => task.assignee === assignee)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return taskRepository.list([
            where('assignee', '==', assignee),
            orderBy('createdAt', 'desc')
        ], { cacheKey: `assignee:${assignee}` });
    },

    // Add new task
    async addTask(task: Omit<Task, 'id'>): Promise<string> {
        if (isDevAdminSessionEnabled()) {
            const id = createDevTaskId();
            publishDevTasks([...readDevTasks(), {
                ...task,
                id,
                createdAt: task.createdAt || new Date().toISOString(),
            }]);
            return id;
        }
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...task,
            createdAt: task.createdAt || new Date().toISOString().split('T')[0]
        });
        taskRepository.clearCache();
        return docRef.id;
    },

    // Update task
    async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
        if (isDevAdminSessionEnabled()) {
            updateDevTask(taskId, updates);
            return;
        }
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await updateDoc(taskRef, updates);
        taskRepository.clearCache();
    },

    // Delete task
    async deleteTask(taskId: string): Promise<void> {
        if (isDevAdminSessionEnabled()) {
            publishDevTasks(readDevTasks().filter(task => task.id !== taskId));
            return;
        }
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await deleteDoc(taskRef);
        taskRepository.clearCache();
    },

    // Add comment to task
    async addComment(taskId: string, comment: Omit<TaskComment, 'id'>): Promise<void> {
        if (isDevAdminSessionEnabled()) {
            const task = getDevTask(taskId);
            if (!task) throw new Error('task-not-found');
            updateDevTask(taskId, {
                comments: [...(task.comments || []), { ...comment, id: Date.now() }]
            });
            return;
        }
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await runTransaction(db, async transaction => {
            const taskSnap = await transaction.get(taskRef);
            if (!taskSnap.exists()) throw new Error('요청을 찾을 수 없습니다.');
            const taskData = taskSnap.data() as Task;
            const comments = [...(taskData.comments || []), {
                ...comment,
                id: Date.now()
            }];
            transaction.update(taskRef, { comments });
        });
        taskRepository.clearCache();
    },

    // Subscribe to real-time updates
    subscribe(callback: (tasks: Task[]) => void, onError?: (error: FirestoreError) => void): Unsubscribe {
        if (isDevAdminSessionEnabled()) {
            devTaskSubscribers.add(callback);
            callback(readDevTasks());
            const handleStorage = (event: StorageEvent) => {
                if (event.key === DEV_TASK_STORAGE_KEY) callback(readDevTasks());
            };
            window.addEventListener('storage', handleStorage);
            return () => {
                devTaskSubscribers.delete(callback);
                window.removeEventListener('storage', handleStorage);
            };
        }
        return taskRepository.subscribe(callback, [], onError);
    },

    subscribeRecent(callback: (tasks: Task[]) => void, limitCount = 5, onError?: (error: FirestoreError) => void): Unsubscribe {
        if (isDevAdminSessionEnabled()) {
            const publishRecent = (tasks: Task[]) => callback(
                [...tasks]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, limitCount)
            );
            devTaskSubscribers.add(publishRecent);
            publishRecent(readDevTasks());
            const handleStorage = (event: StorageEvent) => {
                if (event.key === DEV_TASK_STORAGE_KEY) publishRecent(readDevTasks());
            };
            window.addEventListener('storage', handleStorage);
            return () => {
                devTaskSubscribers.delete(publishRecent);
                window.removeEventListener('storage', handleStorage);
            };
        }
        return taskRepository.subscribe(callback, [
            orderBy('createdAt', 'desc'),
            queryLimit(limitCount)
        ], onError);
    }
};
