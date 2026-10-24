import type { TeamSettlementSalesItem } from '../types/teamSettlement';

export const TEAM_SETTLEMENT_OFFICE_RATES = { contract: 10000, direct: 5000 };
export const LEGACY_TEAM_SETTLEMENT_OFFICE_RATES = { contract: 10000, direct: 10000 };

export const calculateTeamSettlementOfficeExpense = (
  sales: TeamSettlementSalesItem[],
  rates = TEAM_SETTLEMENT_OFFICE_RATES
) => {
  const sites = sales
    .filter((sale) => sale.source === 'auto'
      && (sale.origin === 'daily_report' || sale.origin === 'support_client_site')
      && (sale.kind === '도급' || sale.kind === '직영'))
    .map((sale) => {
      const manDay = Number.isFinite(sale.manDay) ? Math.max(0, Math.round(sale.manDay * 10) / 10) : 0;
      const rate = sale.kind === '도급' ? rates.contract : rates.direct;
      return { id: sale.id, siteName: sale.siteName, kind: sale.kind, manDay, rate, amount: Math.round(manDay * rate) };
    });
  const sumManDay = (kind?: string) => Math.round(sites
    .filter((site) => !kind || site.kind === kind)
    .reduce((sum, site) => sum + site.manDay, 0) * 10) / 10;
  const contractManDay = sumManDay('도급');
  const directManDay = sumManDay('직영');
  return {
    sites,
    contractManDay,
    directManDay,
    totalManDay: sumManDay(),
    totalAmount: sites.reduce((sum, site) => sum + site.amount, 0),
    memo: `도급 ${contractManDay}공수×${rates.contract.toLocaleString('ko-KR')}원 + 직영 ${directManDay}공수×${rates.direct.toLocaleString('ko-KR')}원`
  };
};
