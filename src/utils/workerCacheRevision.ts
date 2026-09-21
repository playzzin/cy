// A successful server-side registration invalidates the existing office list.
let revision = 0;
export const getWorkerCacheRevision = () => revision;
export const invalidateWorkerCache = () => { revision += 1; };
