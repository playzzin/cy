export interface DailyReportCoverageSite {
  siteId: string;
  siteName: string;
  responsibleTeamName?: string;
  managerName?: string;
}

export interface DailyReportCoverageSummary {
  date: string;
  activeSiteCount: number;
  reportedSiteCount: number;
  missingSiteCount: number;
  coverageRate: number;
  missingSites: DailyReportCoverageSite[];
}

const normalizeKey = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
const asText = (value: unknown): string => String(value ?? '').trim();

const toDateKey = (date: Date | string): string => {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const isActiveSite = (site: Record<string, any>): boolean => {
  const status = normalizeKey(site.status);
  if (!status) return true;
  return ['active', '운영중', '진행중', '사용', 'open'].includes(status);
};

export const buildDailyReportCoverage = ({
  sites,
  reports,
  date = new Date(),
}: {
  sites: Array<Record<string, any>>;
  reports: Array<Record<string, any>>;
  date?: Date | string;
}): DailyReportCoverageSummary => {
  const dateKey = toDateKey(date);
  const activeSites = sites.filter(isActiveSite);
  const reportedSiteKeys = new Set<string>();

  reports.forEach((report) => {
    if (asText(report.date).slice(0, 10) !== dateKey) return;

    const siteId = asText(report.siteId);
    const siteName = normalizeKey(report.siteName);
    if (siteId) reportedSiteKeys.add(`id:${siteId}`);
    if (siteName) reportedSiteKeys.add(`name:${siteName}`);
  });

  const missingSites = activeSites
    .filter((site) => {
      const siteId = asText(site.id || site.legacyId);
      const siteName = normalizeKey(site.name);
      return !reportedSiteKeys.has(`id:${siteId}`) && !reportedSiteKeys.has(`name:${siteName}`);
    })
    .map((site, index) => ({
      siteId: asText(site.id || site.legacyId || index),
      siteName: asText(site.name) || `현장 ${index + 1}`,
      responsibleTeamName: asText(site.responsibleTeamName),
      managerName: asText(site.siteManagerName || site.managerName),
    }));

  const reportedSiteCount = Math.max(0, activeSites.length - missingSites.length);

  return {
    date: dateKey,
    activeSiteCount: activeSites.length,
    reportedSiteCount,
    missingSiteCount: missingSites.length,
    coverageRate: activeSites.length > 0 ? Math.round((reportedSiteCount / activeSites.length) * 100) : 100,
    missingSites,
  };
};
