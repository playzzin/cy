import { scheduleAfterInitialLoad } from '../../utils/deferredStartup';

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN || '';
const OBSERVABILITY_BOOT_DELAY_MS = 7000;

/**
 * ERP and construction-plan screens contain worker names, phone numbers and
 * approved drawings. Replay must remain useful for timing/error diagnosis
 * without transmitting those values or rendered document media.
 */
export const SENTRY_REPLAY_PRIVACY_OPTIONS = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  mask: ['[data-construction-plan-sensitive]'],
  block: [
    '.construction-drawing-canvas-shell',
    '.cp-a4',
    '.cp-print-document',
  ],
};

const parseSampleRate = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
};

const parseTracePropagationTargets = (): string[] => (
  (process.env.REACT_APP_SENTRY_TRACE_TARGETS || 'localhost')
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean)
);

export function setupDeferredSentry() {
  if (!SENTRY_DSN || process.env.NODE_ENV !== 'production') return;

  scheduleAfterInitialLoad(() => {
    void import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn: SENTRY_DSN,
          integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(SENTRY_REPLAY_PRIVACY_OPTIONS),
          ],
          tracesSampleRate: parseSampleRate(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE, 0.2),
          tracePropagationTargets: parseTracePropagationTargets(),
          replaysSessionSampleRate: parseSampleRate(process.env.REACT_APP_SENTRY_REPLAY_SAMPLE_RATE, 0.02),
          replaysOnErrorSampleRate: parseSampleRate(process.env.REACT_APP_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE, 1),
        });
      })
      .catch((error) => {
        console.warn('Sentry initialization failed:', error);
      });
  }, { delayMs: OBSERVABILITY_BOOT_DELAY_MS });
}
