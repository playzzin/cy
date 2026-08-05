import { scheduleAfterInitialLoad } from '../utils/deferredStartup';

type Gtag = (...args: any[]) => void;

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: Gtag;
  }
}

const GA_MEASUREMENT_ID =
  process.env.REACT_APP_GA_MEASUREMENT_ID || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || '';

const GTAG_SCRIPT_ID = 'google-analytics-gtag';
const ANALYTICS_BOOT_DELAY_MS = 7000;
let lastTrackedPagePath: string | null = null;
let analyticsInitScheduled = false;
let queuedPageView: { pagePath: string; pageTitle?: string } | null = null;

export const isGoogleAnalyticsConfigured = GA_MEASUREMENT_ID.length > 0;

const canUseBrowserAnalytics = () =>
  isGoogleAnalyticsConfigured && typeof window !== 'undefined' && typeof document !== 'undefined';

export const initializeGoogleAnalytics = () => {
  if (!canUseBrowserAnalytics()) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer?.push(arguments);
    };

  if (!document.getElementById(GTAG_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GTAG_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  }
};

const sendPageView = (pagePath: string, pageTitle?: string) => {
  if (!canUseBrowserAnalytics()) return;

  const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  if (lastTrackedPagePath === normalizedPath) return;

  lastTrackedPagePath = normalizedPath;

  window.gtag?.('event', 'page_view', {
    page_title: pageTitle || document.title || normalizedPath,
    page_location: `${window.location.origin}${normalizedPath}`,
    page_path: normalizedPath,
  });
};

const scheduleAnalyticsInitialization = () => {
  if (analyticsInitScheduled) return;
  analyticsInitScheduled = true;

  scheduleAfterInitialLoad(() => {
    initializeGoogleAnalytics();

    if (queuedPageView) {
      const { pagePath, pageTitle } = queuedPageView;
      queuedPageView = null;
      sendPageView(pagePath, pageTitle);
    }
  }, { delayMs: ANALYTICS_BOOT_DELAY_MS });
};

export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (!canUseBrowserAnalytics()) return;

  queuedPageView = { pagePath, pageTitle };
  scheduleAnalyticsInitialization();
};
