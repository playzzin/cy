import { SENTRY_REPLAY_PRIVACY_OPTIONS } from './sentry';

describe('Sentry replay privacy policy', () => {
  it('masks ERP text and inputs and blocks construction-plan drawings and previews', () => {
    expect(SENTRY_REPLAY_PRIVACY_OPTIONS.maskAllText).toBe(true);
    expect(SENTRY_REPLAY_PRIVACY_OPTIONS.maskAllInputs).toBe(true);
    expect(SENTRY_REPLAY_PRIVACY_OPTIONS.blockAllMedia).toBe(true);
    expect(SENTRY_REPLAY_PRIVACY_OPTIONS.block).toEqual(expect.arrayContaining([
      '.construction-drawing-canvas-shell',
      '.cp-a4',
      '.cp-print-document',
    ]));
  });
});
