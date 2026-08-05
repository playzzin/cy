import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, where, orderBy, limit as queryLimit, Unsubscribe } from 'firebase/firestore';
import { Task, TaskComment } from '../types/task';
import { createCollectionRepository } from './firestoreRepository';

const COLLECTION_NAME = 'tasks';
const taskRepository = createCollectionRepository<Task>({ collectionName: COLLECTION_NAME });

export const taskService = {
    // Get single task
    async getTask(taskId: string): Promise<Task | null> {
        return taskRepository.getById(taskId);
    },

    // Get all tasks
    async getTasks(): Promise<Task[]> {
        return taskRepository.list([], { cacheKey: 'all' });
    },

    // Get tasks by assignee
    async getTasksByAssignee(assignee: string): Promise<Task[]> {
        return taskRepository.list([
            where('assignee', '==', assignee),
            orderBy('createdAt', 'desc')
        ], { cacheKey: `assignee:${assignee}` });
    },

    // Add new task
    async addTask(task: Omit<Task, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...task,
            createdAt: task.createdAt || new Date().toISOString().split('T')[0]
        });
        taskRepository.clearCache();
        return docRef.id;
    },

    // Update task
    async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await updateDoc(taskRef, updates);
        taskRepository.clearCache();
    },

    // Delete task
    async deleteTask(taskId: string): Promise<void> {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await deleteDoc(taskRef);
        taskRepository.clearCache();
    },

    // Add comment to task
    async addComment(taskId: string, comment: Omit<TaskComment, 'id'>): Promise<void> {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        const taskSnap = await getDoc(taskRef);
        if (taskSnap.exists()) {
            const taskData = taskSnap.data() as Task;
            const comments = taskData.comments || [];
            comments.push({
                ...comment,
                id: Date.now()
            });
            await updateDoc(taskRef, { comments });
            taskRepository.clearCache();
        }
    },

    // Subscribe to real-time updates
    subscribe(callback: (tasks: Task[]) => void): Unsubscribe {
        return taskRepository.subscribe(callback);
    },

    subscribeRecent(callback: (tasks: Task[]) => void, limitCount = 5): Unsubscribe {
        return taskRepository.subscribe(callback, [
            orderBy('createdAt', 'desc'),
            queryLimit(limitCount)
        ]);
    }
};
