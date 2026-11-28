import { createContext } from 'react';
import type { TeamWorkerRequestData } from '../types/teamWorkerRequest';
import { getKoreanDateKey } from '../utils/koreanBusinessDate';

export const workerFormMonth = () => getKoreanDateKey().slice(0, 7);

// A single navigation can hand its authorized form read to the page once.
// A new navigation or sign-in gets a separate container.
export interface WorkerFormEntry {
  read?: {
    uid: string;
    month: string;
    started: number;
    result: Promise<TeamWorkerRequestData | undefined>;
  };
}

export const WorkerFormEntryContext = createContext<WorkerFormEntry | null>(null);

export function takeWorkerFormRead(entry: WorkerFormEntry | null, uid: string | undefined, month: string) {
  const read = entry?.read;
  if (!entry || !read) return undefined;
  delete entry.read;
  if (read.uid === uid && read.month === month && performance.now() - read.started < 15_000) {
    return read.result;
  }
  return undefined;
}
