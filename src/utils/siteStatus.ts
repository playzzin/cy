const CLOSED_SITE_STATUSES = new Set([
    'completed',
    'closed',
    'complete',
    'inactive',
    'finished',
    'done',
    '\uB9C8\uAC10',
    '\uC644\uB8CC',
    '\uC885\uB8CC',
]);

export const normalizeSiteStatus = (status: unknown): string => (
    String(status ?? '').trim().toLowerCase()
);

export const isClosedSiteStatus = (status: unknown): boolean => (
    CLOSED_SITE_STATUSES.has(normalizeSiteStatus(status))
);

export const isClosedSite = (site: { status?: unknown } | null | undefined): boolean => (
    isClosedSiteStatus(site?.status)
);

export const getOpenSites = <T extends { status?: unknown }>(sites: readonly T[]): T[] => (
    sites.filter((site) => !isClosedSite(site))
);
