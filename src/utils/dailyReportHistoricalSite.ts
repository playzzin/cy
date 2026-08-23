import type { DailyReport } from '../services/dailyReportService';
import type { Site } from '../services/siteService';

type HistoricalSiteSnapshotSource = Pick<
  DailyReport,
  | 'siteId'
  | 'siteName'
  | 'siteAddress'
  | 'responsibleTeamId'
  | 'responsibleTeamName'
  | 'teamId'
  | 'teamName'
  | 'companyId'
  | 'companyName'
  | 'constructorCompanyId'
  | 'constructorCompanyName'
  | 'partnerId'
  | 'partnerName'
  | 'siteManagerId'
  | 'siteManagerName'
  | 'siteType'
  | 'paymentType'
>;

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeKey = (value: unknown): string =>
  toText(value).replace(/\s+/g, '').toLowerCase();

const hasAttendance = (report: DailyReport): boolean => {
  const totalManDay = Number(report.totalManDay ?? 0);
  if (Number.isFinite(totalManDay) && totalManDay > 0) return true;

  return (report.workers ?? []).some((worker) => {
    const manDay = Number(worker.manDay ?? 0);
    return (Number.isFinite(manDay) && manDay > 0) || worker.status === 'attendance' || worker.status === 'half';
  });
};

const findCurrentSite = (sites: Site[], report: HistoricalSiteSnapshotSource): Site | undefined => {
  const siteId = toText(report.siteId);
  if (siteId) {
    const matchedById = sites.find((site) =>
      toText(site.id) === siteId || toText(site.legacyId) === siteId
    );
    if (matchedById) return matchedById;
  }

  const siteNameKey = normalizeKey(report.siteName);
  return siteNameKey
    ? sites.find((site) => normalizeKey(site.name) === siteNameKey)
    : undefined;
};

export const resolveHistoricalResponsibleTeam = (
  report: Pick<DailyReport, 'responsibleTeamId' | 'responsibleTeamName' | 'teamId' | 'teamName'>,
  currentSite?: Pick<Site, 'responsibleTeamId' | 'responsibleTeamName'> | null
): { teamId: string; teamName: string } => ({
  teamId:
    toText(report.responsibleTeamId) ||
    toText(report.teamId) ||
    toText(currentSite?.responsibleTeamId),
  teamName:
    toText(report.responsibleTeamName) ||
    toText(report.teamName) ||
    toText(currentSite?.responsibleTeamName),
});

const buildHistoricalSiteOption = (
  report: HistoricalSiteSnapshotSource,
  currentSite?: Site
): Site => {
  const siteId = toText(report.siteId) || toText(currentSite?.id) || toText(currentSite?.legacyId);
  const siteName = toText(report.siteName) || toText(currentSite?.name) || '현장 미지정';
  const responsibleTeam = resolveHistoricalResponsibleTeam(report, currentSite);

  return {
    ...(currentSite ?? {}),
    id: siteId,
    name: siteName,
    code: toText(currentSite?.code) || siteId || siteName,
    status: currentSite?.status ?? 'active',
    address: toText(report.siteAddress) || currentSite?.address,
    responsibleTeamId: responsibleTeam.teamId,
    responsibleTeamName: responsibleTeam.teamName,
    siteManagerId: toText(report.siteManagerId) || currentSite?.siteManagerId,
    siteManagerName: toText(report.siteManagerName) || currentSite?.siteManagerName,
    clientCompanyId: toText(report.companyId) || currentSite?.clientCompanyId,
    clientCompanyName: toText(report.companyName) || currentSite?.clientCompanyName,
    constructorCompanyId: toText(report.constructorCompanyId) || currentSite?.constructorCompanyId || currentSite?.companyId,
    constructorCompanyName: toText(report.constructorCompanyName) || currentSite?.constructorCompanyName || currentSite?.companyName,
    partnerId: toText(report.partnerId) || currentSite?.partnerId,
    partnerName: toText(report.partnerName) || currentSite?.partnerName,
    siteType: toText(report.siteType) || currentSite?.siteType,
    paymentMethod: toText(report.paymentType) || currentSite?.paymentMethod,
  } as Site;
};

export const getHistoricalAttendedSiteOptions = (
  currentSites: Site[],
  dailyReports: DailyReport[],
  endDate: string
): Site[] => {
  const normalizedEndDate = toText(endDate).slice(0, 10);
  const yearMonth = normalizedEndDate.slice(0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedEndDate) || !yearMonth) return [];

  const startDate = `${yearMonth}-01`;
  const latestBySite = new Map<string, { report: DailyReport; currentSite?: Site }>();

  [...dailyReports]
    .filter((report) => {
      const reportDate = toText(report.date).slice(0, 10);
      return reportDate >= startDate && reportDate <= normalizedEndDate && hasAttendance(report);
    })
    .sort((left, right) => toText(left.date).localeCompare(toText(right.date)))
    .forEach((report) => {
      const currentSite = findCurrentSite(currentSites, report);
      const siteId = toText(report.siteId) || toText(currentSite?.id) || toText(currentSite?.legacyId);
      const siteNameKey = normalizeKey(report.siteName) || normalizeKey(currentSite?.name);
      const key = siteId ? `id:${siteId}` : siteNameKey ? `name:${siteNameKey}` : '';
      if (!key) return;

      const current = latestBySite.get(key);
      if (!current) {
        latestBySite.set(key, { report, currentSite });
        return;
      }

      const currentHasSnapshot = Boolean(
        toText(current.report.responsibleTeamId) || toText(current.report.responsibleTeamName)
      );
      const nextHasSnapshot = Boolean(
        toText(report.responsibleTeamId) || toText(report.responsibleTeamName)
      );
      if (toText(report.date) > toText(current.report.date) || (nextHasSnapshot && !currentHasSnapshot)) {
        latestBySite.set(key, { report, currentSite });
      }
    });

  return Array.from(latestBySite.values())
    .map(({ report, currentSite }) => buildHistoricalSiteOption(report, currentSite))
    .sort((left, right) => toText(left.name).localeCompare(toText(right.name), 'ko-KR'));
};
