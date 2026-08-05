import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { manpowerService, type Worker } from '../services/manpowerService';
import { userService, type UserData } from '../services/userService';

const normalizeLinkedWorkerIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((id) => String(id ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((id) => id.trim()).filter(Boolean);
  }
  return [];
};

export const useLinkedWorker = () => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [linkedWorker, setLinkedWorker] = useState<Worker | null>(null);
  const [profile, setProfile] = useState<UserData | null>(null);

  useEffect(() => {
    let alive = true;

    const loadLinkedWorker = async () => {
      if (!uid) {
        if (alive) {
          setLinkedWorker(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const nextProfile = await userService.getUser(uid);
        const linkedWorkerIds = normalizeLinkedWorkerIds(nextProfile?.linkedWorkerIds);
        let worker: Worker | null = null;

        for (const workerId of linkedWorkerIds) {
          worker = await manpowerService.getWorker(workerId);
          if (worker) break;
        }

        if (!worker) {
          worker = await manpowerService.getWorkerByUid(uid);
        }
        if (alive) {
          setProfile(nextProfile);
          setLinkedWorker(worker);
        }
      } catch (error) {
        console.error('Dashboard linked worker load failed', error);
        if (alive) {
          setProfile(null);
          setLinkedWorker(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadLinkedWorker();

    return () => {
      alive = false;
    };
  }, [uid]);

  return {
    loading,
    linkedWorker,
    profile,
    userId: uid,
  };
};
