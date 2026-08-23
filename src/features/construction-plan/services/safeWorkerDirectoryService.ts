import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';
import {
  SafeWorkerDirectoryEntrySchema,
  SafeWorkerDirectoryScopeSchema,
  type SafeWorkerDirectoryEntry,
  type SafeWorkerDirectoryScope,
} from '../types';

export const SAFE_WORKER_DIRECTORY_CALLABLE = 'getConstructionPlanSafeWorkers';

type SafeWorkerDirectoryResponse = {
  siteId: string;
  responsibleTeamId?: string;
  workers: SafeWorkerDirectoryEntry[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseDirectoryResponse = (
  value: unknown,
  expectedSiteId: string,
): SafeWorkerDirectoryResponse => {
  if (!isRecord(value) || value.siteId !== expectedSiteId || !Array.isArray(value.workers)) {
    throw new Error('construction-plan-safe-worker-directory-invalid-response');
  }
  return {
    siteId: expectedSiteId,
    ...(typeof value.responsibleTeamId === 'string' && value.responsibleTeamId.trim()
      ? { responsibleTeamId: value.responsibleTeamId.trim() }
      : {}),
    workers: value.workers.map((worker) => SafeWorkerDirectoryEntrySchema.parse(worker)),
  };
};

/**
 * Fetches a site-scoped, server-projected worker directory. Raw worker,
 * payroll, identity, address and banking documents never reach the browser.
 */
export const listSafeWorkerDirectoryEntries = async (
  rawScope: SafeWorkerDirectoryScope,
): Promise<SafeWorkerDirectoryEntry[]> => {
  const scope = SafeWorkerDirectoryScopeSchema.parse(rawScope);
  const callable = httpsCallable<SafeWorkerDirectoryScope, unknown>(
    functions,
    SAFE_WORKER_DIRECTORY_CALLABLE,
  );
  const response = parseDirectoryResponse((await callable(scope)).data, scope.siteId);
  return response.workers;
};

export const safeWorkerDirectoryService = {
  listForSite: listSafeWorkerDirectoryEntries,
};

export default safeWorkerDirectoryService;
