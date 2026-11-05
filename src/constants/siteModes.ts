// Keep the saved CRM key: menu documents and users' selected mode reference it.
export const ALLIANCE_SITE_KEY = '청연CRM';
export const ALLIANCE_SITE_NAME = '전국시스템연합';
export const INVESTMENT_LABEL = '사업계획서';
export const LEGACY_INVESTMENT_LABEL = '투자모집';
export const INVESTMENT_PATH = '/alliance/investment';
export const INVESTMENT_MENU = { id: 'alliance-investment', text: INVESTMENT_LABEL, icon: 'fa-building', path: INVESTMENT_PATH };

export const SITE_HOME_PATHS: Readonly<Record<string, string | undefined>> = {
    test: '/dashboard2',
    nation: '/dashboard3',
    [ALLIANCE_SITE_KEY]: INVESTMENT_PATH,
};
