import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Task, TaskComment } from '../types/task';

const COLLECTION_NAME = 'tasks';

export const taskService = {
    // Get single task
    async getTask(taskId: string): Promise<Task | null> {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        const taskSnap = await getDoc(taskRef);
        return taskSnap.exists() ? ({ id: taskSnap.id, ...taskSnap.data() } as Task) : null;
    },

    // Get all tasks
    async getTasks(): Promise<Task[]> {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    },

    // Get tasks by assignee
    async getTasksByAssignee(assignee: string): Promise<Task[]> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('assignee', '==', assignee),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    },

    // Add new task
    async addTask(task: Omit<Task, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...task,
            createdAt: task.createdAt || new Date().toISOString().split('T')[0]
        });
        return docRef.id;
    },

    // Update task
    async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await updateDoc(taskRef, updates);
    },

    // Delete task
    async deleteTask(taskId: string): Promise<void> {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        await deleteDoc(taskRef);
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
        }
    },

    // Subscribe to real-time updates
    subscribe(callback: (tasks: Task[]) => void): Unsubscribe {
        return onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            callback(tasks);
        });
    }
};
